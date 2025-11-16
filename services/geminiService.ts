
import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, Quiz, LearningPreferences, NodeContent, QuizQuestion, UserAnswer, QuizResult, PreAssessmentAnalysis, ChatMessage } from '../types';
import { marked } from 'marked';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper function for retrying with exponential backoff and rate limit handling
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries <= 0) {
            console.error("API call failed after all retries:", error);
            throw new Error("متاسفانه ارتباط با هوش مصنوعی پس از چند تلاش ناموفق بود. این ممکن است به دلیل ترافیک بالا باشد. لطفاً لحظاتی بعد دوباره امتحان کنید.");
        }

        let retryAfterMs = delay;
        let isRetriable = false;

        // Check for 503 Service Unavailable
        if (error.message && error.message.includes('503')) {
            isRetriable = true;
            retryAfterMs = delay * 2; // Exponential backoff for 503
            console.warn(`API call failed with 503, retrying in ${retryAfterMs}ms... (${retries} retries left)`);
        }
        // Check for 429 Rate Limit Exceeded
        else if (error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) {
            isRetriable = true;
            try {
                // The error message from the SDK is often a JSON string, sometimes prefixed.
                const errorJsonString = error.message.substring(error.message.indexOf('{'));
                const errorDetails = JSON.parse(errorJsonString);
                const retryInfo = errorDetails?.error?.details?.find(
                    (d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
                );

                if (retryInfo?.retryDelay) {
                    const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
                    // Use suggested delay + a small buffer
                    retryAfterMs = Math.ceil(seconds * 1000) + 500;
                    console.warn(`Rate limit exceeded. Retrying in ${retryAfterMs}ms as suggested by API... (${retries} retries left)`);
                } else {
                     // Fallback to exponential backoff if retryDelay is not present
                    retryAfterMs = delay * 2;
                    console.warn(`Rate limit exceeded, no retryDelay found. Retrying in ${retryAfterMs}ms... (${retries} retries left)`);
                }
            } catch (e) {
                // If parsing fails, fall back to exponential backoff
                retryAfterMs = delay * 2;
                console.warn(`Could not parse rate limit error details. Retrying in ${retryAfterMs}ms... (${retries} retries left)`);
            }
        }

        if (isRetriable) {
            await new Promise(res => setTimeout(res, retryAfterMs));
            // The next base delay for exponential backoff continues to increase.
            return withRetry(fn, retries - 1, delay * 2);
        }

        console.error("API call failed with a non-retriable error:", error);
        throw error; // Re-throw the error if it's not retriable
    }
}

export async function generateLearningPlan(
    content: string, 
    pageContents: string[] | null, 
    images: {mimeType: string, data: string}[], 
    preferences: LearningPreferences,
    onMindMapGenerated: (mindMap: MindMapNode[], suggestedPath: string[]) => void,
    onQuestionStream: (question: QuizQuestion) => void
): Promise<Quiz> { // Returns the final quiz, but streams questions along the way
    return withRetry(async () => {
        const customInstructions = preferences.customInstructions ? `دستورالعمل سفارشی کاربر: ${preferences.customInstructions}` : '';
        // FIX: Combined broken line for 'addExplanatoryNodes' property access.
        const explanatoryInstruction = preferences.addExplanatoryNodes ? "اگر در متن به مفاهیم پیش‌نیاز اشاره شده که به خوبی توضیح داده نشده‌اند، گره‌های توضیحی اضافی برای آن‌ها ایجاد کن و isExplanatory را true قرار بده." : "";
        const learningGoalInstruction = preferences.learningGoal ? `مهم: هدف اصلی کاربر از یادگیری این موضوع '${preferences.learningGoal}' است. ساختار نقشه ذهنی و سوالات پیش‌آزمون را متناسب با این هدف طراحی کن.` : '';

        const pageContentForPrompt = pageContents
            ? `محتوای زیر بر اساس صفحه تفکک شده است. هنگام ایجاد گره‌ها، شماره صفحات مرتبط را در فیلد sourcePages مشخص کن.\n\n` + pageContents.map((text, i) => `--- صفحه ${i + 1} ---\n${text}`).join('\n\n')
            : `متن:\n---\n${content}\n---`;
        
        const prompt = `
        **وظیفه اول: ایجاد نقشه ذهنی**
        بر اساس محتوای زیر، یک طرح درس به صورت نقشه ذهنی سلسله مراتبی و **بسیار فشرده** ایجاد کن.
        1.  ساختار باید به شکل زیر باشد:
            -   **گره ریشه (Root Node):** اولین و تنها گره ریشه باید عنوانی مانند "مقدمه کلی" داشته باشد و یک نمای کلی از کل موضوع ارائه دهد. شناسه والد آن باید null باشد.
            -   **گره‌های اصلی (Main Nodes):** مفاهیم اصلی را در گره‌های مجزا و **متمایز** گروه‌بندی کن. هر مفهوم اصلی باید به طور کامل در یک گره پوشش داده شود تا از پراکندگی مطالب جلوگیری شود. **قانون عدم تکرار (بسیار مهم):** یک مفهوم نباید به طور مفصل در بیش از یک گره توضیح داده شود. اگر یک مفهوم در گره دیگری ذکر می‌شود، باید فقط به عنوان یک **مرجع کوتاه** برای نشان دادن ارتباط باشد. تنها استثنای مجاز برای تکرار جزئیات، زمانی است که یک دیدگاه جدید (مانند مقایسه یا تحلیل عمیق‌تر) ارائه می‌شود و این استثنا نباید بیش از یک بار برای یک مفهوم اتفاق بیفتد.
            -   **فشردگی:** تعداد کل گره‌ها را بین ۳ تا ۸ گره محدود کن تا نقشه ذهنی مختصر و مفید باقی بماند. هدف، درک عمیق مفاهیم کلیدی است، نه تقسیم‌بندی بیش از حد.
        2.  برای هر گره، یک امتیاز سختی بین 0.0 (بسیار آسان) تا 1.0 (بسیار دشوار) بر اساس پیچیدگی مفهوم اختصاص بده.
        3.  ${explanatoryInstruction}

        **وظیفه دوم: ایجاد پیش‌آزمون**
        یک پیش‌آزمون جامع با ۵ تا ۱۰ سوال برای سنجش دقیق دانش اولیه کاربر از کل متن طراحی کن. این آزمون باید **چالش‌برانگیز** باشد. سوالات باید **فقط و فقط** از انواع 'multiple-choice' و 'short-answer' باشند. در JSON خروجی برای هر سوال، فیلد 'type' باید دقیقا یکی از این دو رشته باشد. استفاده از هر نوع دیگری غیرمجاز است. قوانین طراحی سوالات (مفهومی بودن, بازنویسی کامل, گزینه‌های انحرافی فریبنده) که قبلاً ذکر شد را به دقت رعایت کن.
        
        **وظیفه سوم: ایجاد مسیر یادگیری پیشنهادی**
        بر اساس هدف یادگیری کاربر، سختی گره‌ها و وابستگی‌های منطقی بین آنها، یک مسیر یادگیری پیشنهادی بهینه ارائه بده. این مسیر باید به صورت یک آرایه از شناسه‌های گره‌ها (node IDs) با نام suggestedPath باشد. این مسیر باید یک ترتیب منطقی برای مطالعه گره‌ها را مشخص کند.

        ${learningGoalInstruction}
        ${customInstructions}

        **دستورالعمل خروجی (بسیار مهم):**
        خروجی باید به صورت جریانی (stream) باشد.
        1.  **ابتدا**، یک آبجکت JSON کامل و معتبر که شامل کل نقشه ذهنی (mindMap) و مسیر پیشنهادی (suggestedPath) است، محصور شده بین توکن‌های \`[MIND_MAP_START]\` و \`[MIND_MAP_END]\` ارسال کن.
        2.  **سپس**، بلافاصله شروع به ارسال سوالات پیش‌آزمون کن. هر سوال باید به صورت یک آبجکت JSON معتبر در یک خط جدید و محصور شده بین توکن‌های \`[QUESTION_START]\` و \`[QUESTION_END]\` ارسال شود.
        مثال برای فرمت سوالات:
        [QUESTION_START]
        {"id": "q1", "type": "multiple-choice", "question": "...", "options": ["...", "..."], "correctAnswerIndex": 0, "difficulty": "متوسط", "points": 10}
        [QUESTION_END]
        [QUESTION_START]
        {"id": "q2", "type": "short-answer", "question": "...", "correctAnswer": "...", "difficulty": "آسان", "points": 5}
        [QUESTION_END]

        محتوا:
        ---
        ${pageContentForPrompt}
        ---
        `;

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });

        let buffer = '';
        const questions: QuizQuestion[] = [];
        let mindMapGenerated = false;
        
        const mindMapStartToken = '[MIND_MAP_START]';
        const mindMapEndToken = '[MIND_MAP_END]';
        const questionStartToken = '[QUESTION_START]';
        const questionEndToken = '[QUESTION_END]';

        for await (const chunk of stream) {
            buffer += chunk.text;

            if (!mindMapGenerated) {
                const startIndex = buffer.indexOf(mindMapStartToken);
                const endIndex = buffer.indexOf(mindMapEndToken, startIndex);
                if (startIndex !== -1 && endIndex !== -1) {
                    const jsonStr = buffer.substring(startIndex + mindMapStartToken.length, endIndex).trim();
                    try {
                        const resultJson = JSON.parse(jsonStr);
                        
                        // FIX: The model might return mindMap as { nodes: [...] } or just an array
                        const nodesArray = resultJson.mindMap?.nodes || resultJson.mindMap;

                        if (!Array.isArray(nodesArray)) {
                            console.error("Mind map nodes data is not an array:", nodesArray);
                            throw new Error("Mind map nodes data is not an array.");
                        }

                        const mindMap: MindMapNode[] = nodesArray.map((node: any) => ({
                            id: node.id,
                            title: node.title || node.label, // The model sometimes uses 'label'
                            parentId: node.parentId === 'null' || node.parentId === '' ? null : node.parentId,
                            locked: false, // This will be set properly later
                            difficulty: node.difficulty || 0.5,
                            isExplanatory: node.isExplanatory || false,
                            sourcePages: node.sourcePages || [],
                        }));

                        const suggestedPath = resultJson.suggestedPath || [];
                        const unlockedMindMap = mindMap.map(node => ({ ...node, locked: !!node.parentId }));
                        onMindMapGenerated(unlockedMindMap, suggestedPath);
                        mindMapGenerated = true;
                    } catch (e) {
                        console.error("Failed to parse mind map JSON:", jsonStr, e);
                    }
                    buffer = buffer.substring(endIndex + mindMapEndToken.length);
                }
            }

            if (mindMapGenerated) {
                let startIndex, endIndex;
                while ((startIndex = buffer.indexOf(questionStartToken)) !== -1 && (endIndex = buffer.indexOf(questionEndToken, startIndex)) !== -1) {
                    const jsonStr = buffer.substring(startIndex + questionStartToken.length, endIndex).trim();
                    try {
                        const q = JSON.parse(jsonStr);
                        const question = { ...q };
                        if (question.type === 'multiple-choice') {
                           question.options = Array.isArray(question.options) ? question.options : [];
                        }
                        questions.push(question);
                        onQuestionStream(question);
                    } catch (e) {
                        console.error("Failed to parse streamed pre-assessment question JSON:", jsonStr, e);
                    }
                    buffer = buffer.substring(endIndex + questionEndToken.length);
                }
            }
        }
        
        return { questions };
    });
}


const preAssessmentAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        overallAnalysis: { type: Type.STRING, description: "یک تحلیل کلی و تشویق‌کننده از عملکرد کاربر در ۲-۳ جمله." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "لیستی از موضوعات یا مفاهیمی که کاربر به خوبی درک کرده است." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "لیستی از موضوعات یا مفاهیمی که کاربر نیاز به تمرکز بیشتری روی آنها دارد." },
        recommendedLevel: { type: Type.STRING, enum: ["مبتدی", "متوسط", "پیشرفته"], description: "سطح دانش توصیه‌شده برای کاربر بر اساس نتایج." }
    },
    required: ["overallAnalysis", "strengths", "weaknesses", "recommendedLevel"]
};


export async function analyzePreAssessment(
    questions: QuizQuestion[], 
    userAnswers: Record<string, UserAnswer>, 
    sourceContent: string
): Promise<PreAssessmentAnalysis> {
    return withRetry(async () => {
        const prompt = `
        شما یک مشاور آموزشی متخصص هستید. وظیفه شما تحلیل نتایج پیش‌آزمون یک دانش‌آموز است. بر اساس سوالات، پاسخ‌های صحیح، پاسخ‌های دانش‌آموز و متن اصلی درس، یک تحلیل دقیق از وضعیت دانش فعلی او ارائه دهید.

        متن اصلی درس برای مرجع:
        ---
        ${sourceContent}
        ---

        ساختار آزمون و پاسخ‌های صحیح:
        ---
        ${JSON.stringify(questions, null, 2)}
        ---

        پاسخ‌های کاربر:
        ---
        ${JSON.stringify(userAnswers, null, 2)}
        ---

        وظایف شما:
        1.  پاسخ‌های کاربر را با پاسخ‌های صحیح مقایسه کنید.
        2.  با تحلیل پاسخ‌های صحیح و غلط، **نقاط قوت (strengths)** و **نقاط ضعف (weaknesses)** مفهومی کاربر را شناسایی کنید. به جای لیست کردن سوالات، مفاهیم اصلی پشت آنها را استخراج کنید.
        3.  یک **تحلیل کلی (overallAnalysis)** کوتاه، دوستانه و تشویق‌کننده بنویسید.
        4.  سطح دانش کاربر را به عنوان **(recommendedLevel)** یکی از موارد "مبتدی"، "متوسط" یا "پیشرفته" تعیین کنید.
        5.  خروجی باید فقط یک آبجکت JSON مطابق با اسکیمای ارائه شده باشد.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: preAssessmentAnalysisSchema
            }
        });
        return JSON.parse(response.text);
    });
}

export async function generateNodeContent(
    nodeTitle: string,
    fullContent: string,
    images: { mimeType: string; data: string }[],
    style: LearningPreferences['style'],
    strengths: string[],
    weaknesses: string[],
    isIntroNode: boolean,
    onStreamUpdate: (partialContent: NodeContent) => void
): Promise<NodeContent> {
    return withRetry(async () => {
        let prompt = '';

        if (isIntroNode) {
            prompt = `شما یک دستیار آموزشی هستید. وظیفه شما ایجاد یک مقدمه جامع و کلی برای کل محتوای ارائه شده است. این مقدمه باید به تمام مفاهیم اصلی و غیرجزئی که در ادامه پوشش داده می‌شوند، اشاره کند.
            
            **قوانین مهم:**
            1.  **جامع باشید:** هیچ مفهوم کلیدی را حذف نکنید. یک نمای کلی از کل مسیر یادگیری ارائه دهید.
            2.  **ساختار ساده:** خروجی باید فقط یک متن یکپارچه باشد. از ایجاد بخش‌های مجزا مانند "تئوری"، "مثال" یا "ارتباط با سایر مفاهیم" خودداری کنید.
            3.  **روان و واضح:** متن باید به صورت روان و قابل فهم نوشته شود تا کاربر دید کلی خوبی نسبت به مطالب پیدا کند.
            
            خروجی باید در فرمت Markdown باشد. کلمات و عبارات کلیدی را با استفاده از Markdown به صورت **پررنگ** مشخص کن.

            محتوای کامل برای مرجع:
            ---
            ${fullContent}
            ---
            `;
        } else {
            let adaptiveInstruction = '';
            const isWeakTopic = weaknesses.some(w => nodeTitle.includes(w) || w.includes(nodeTitle));
            const isStrongTopic = strengths.some(s => nodeTitle.includes(s) || s.includes(nodeTitle));

            if (isWeakTopic) {
                adaptiveInstruction = "مهم: این موضوع یکی از نقاط ضعف کاربر است. توضیحات را بسیار ساده، پایه‌ای و با جزئیات کامل ارائه بده. از مثال‌های قابل فهم و تشبیه‌های ساده استفاده کن تا مفاهیم به خوبی جا بیفتند.";
            } else if (isStrongTopic) {
                adaptiveInstruction = "مهم: کاربر در این موضوع تسلط دارد. توضیحات را به صورت خلاصه‌ای پیشرفته ارائه بده و بر روی نکات ظریف، کاربردهای خاص یا ارتباط آن با مفاهیم پیچیده‌تر تمرکز کن.";
            }

            prompt = `وظیفه شما استخراج و سازماندهی **تمام** اطلاعات مربوط به مفهوم "${nodeTitle}" از متن کامل و تصاویر ارائه‌شده است. از خلاصه‌سازی یا حذف هرگونه جزئیات خودداری کنید. محتوا را به صورت جامع و کامل در پنج بخش ساختاریافته ارائه دهید.

            ${adaptiveInstruction}
            
            خروجی باید در فرمت Markdown باشد و از هدرهای دقیق زیر برای جداسازی هر بخش استفاده کنید. هر هدر باید در یک خط جداگانه باشد:
            ###INTRODUCTION###
            ###THEORY###
            ###EXAMPLE###
            ###CONNECTION###
            ###CONCLUSION###

            در هر بخش، کلمات و عبارات کلیدی را با استفاده از Markdown به صورت **پررنگ** مشخص کن و مهم‌ترین جمله (فقط یک جمله) را با استفاده از Markdown به صورت *ایتالیک* مشخص کن.

            در حین توضیح، اگر به یک مفهوم کلیدی که پیش‌نیاز این بخش است اشاره می‌کنید، از این فرمت خاص استفاده کنید: "همانطور که پیش‌تر اشاره شد[1](یادآوری: توضیح مختصری از مفهوم پیش‌نیاز در اینجا قرار دهید)، این موضوع ...". این فرمت به ما امکان می‌دهد یک یادآوری تعاملی برای کاربر ایجاد کنیم.

            متن کامل برای مرجع:
            ---
            ${fullContent}
            ---
            `;
        }

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });

        const processReminders = (text: string): string => {
            if (!text) return '';
            const regex = /\[(\d+)\]\(یادآوری:\s*([^)]+)\)/g;
            return text.replace(regex, (_match, number, reminderText) => {
                const sanitizedText = reminderText.replace(/"/g, '&quot;');
                return `<button class="reminder-trigger" data-reminder-text="${sanitizedText}" aria-label="یادآوری شماره ${number}">${number}</button>`;
            });
        };

        let fullText = '';
        const rawMarkdownContent: NodeContent = { introduction: '', theory: '', example: '', connection: '', conclusion: '' };
        
        for await (const chunk of stream) {
            fullText += chunk.text;
            
            if (isIntroNode) {
                 rawMarkdownContent.introduction = fullText;
            } else {
                const sections: (keyof NodeContent)[] = ['introduction', 'theory', 'example', 'connection', 'conclusion'];
                const headers = {
                    introduction: '###INTRODUCTION###',
                    theory: '###THEORY###',
                    example: '###EXAMPLE###',
                    connection: '###CONNECTION###',
                    conclusion: '###CONCLUSION###'
                };

                const headerKeys = Object.values(headers);
                let tempText = fullText;
                
                if (!headerKeys.some(h => tempText.includes(h))) {
                     rawMarkdownContent.introduction = tempText;
                } else {
                     for (let i = sections.length - 1; i >= 0; i--) {
                        const currentSection = sections[i];
                        const currentHeader = headers[currentSection];
                        const headerIndex = tempText.lastIndexOf(currentHeader);
            
                        if (headerIndex !== -1) {
                            const content = tempText.substring(headerIndex + currentHeader.length);
                            rawMarkdownContent[currentSection] = content;
                            tempText = tempText.substring(0, headerIndex);
                        } else {
                            rawMarkdownContent[currentSection] = '';
                        }
                    }
                }
            }
            
            const partialHtmlContent: NodeContent = {
                introduction: await marked.parse(processReminders(rawMarkdownContent.introduction)),
                theory: await marked.parse(processReminders(rawMarkdownContent.theory)),
                example: await marked.parse(processReminders(rawMarkdownContent.example)),
                connection: await marked.parse(processReminders(rawMarkdownContent.connection)),
                conclusion: await marked.parse(processReminders(rawMarkdownContent.conclusion)),
            };
            onStreamUpdate(partialHtmlContent);
        }

        const finalHtmlContent: NodeContent = {
            introduction: await marked.parse(processReminders(rawMarkdownContent.introduction)),
            theory: await marked.parse(processReminders(rawMarkdownContent.theory)),
            example: await marked.parse(processReminders(rawMarkdownContent.example)),
            connection: await marked.parse(processReminders(rawMarkdownContent.connection)),
            conclusion: await marked.parse(processReminders(rawMarkdownContent.conclusion)),
        };

        return finalHtmlContent;
    });
}

export async function generateQuiz(
    nodeTitle: string,
    fullContent: string,
    images: { mimeType: string; data: string }[],
    onQuestionStream: (question: QuizQuestion) => void
): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `برای سنجش تسلط بر مفهوم "${nodeTitle}"، یک آزمون متنوع با تعداد سوالات بین ۳ تا ۷ عدد طراحی کن. تعداد سوالات را بر اساس حجم و پیچیدگی مفهوم انتخاب کن. سوالات باید **فقط و فقط** شامل ترکیبی از انواع 'multiple-choice' و 'short-answer' باشند. فیلد 'type' در JSON باید دقیقا یکی از این دو رشته باشد.
        
        **خروجی را به صورت جریانی (stream) تولید کن.** هر سوال را به صورت یک آبجکت JSON معتبر در یک خط جدید و محصور شده بین توکن‌های [QUESTION_START] و [QUESTION_END] ارسال کن.
        مثال:
        [QUESTION_START]
        {"id": "q1", "type": "multiple-choice", "question": "...", "options": ["...", "..."], "correctAnswerIndex": 0, "difficulty": "متوسط", "points": 10}
        [QUESTION_END]
        [QUESTION_START]
        {"id": "q2", "type": "short-answer", "question": "...", "correctAnswer": "...", "difficulty": "آسان", "points": 5}
        [QUESTION_END]

        **قوانین سختگیرانه برای طراحی سوالات:**
        - **سوالات کاملاً مفهومی:** هر سوال باید یک سناریو، یک مقایسه، یا یک تحلیل علت و معلولی را مطرح کند. از سوالات ساده که پاسخشان مستقیماً در یک جمله از متن پیدا می‌شود، اکیداً خودداری کن.
        - **بازنویسی کامل:** به هیچ وجه از جملات یا عبارات کلیدی متن اصلی در صورت سوال یا گزینه‌ها استفاده نکن.
        - **هنر طراحی گزینه‌های انحرافی (Distractors):** گزینه‌های غلط باید به شدت فریبنده باشند و شامل موارد زیر باشند: حقیقتی ناقص، صحیح اما بی‌ربط، اشتباه رایج، یا بسیار شبیه به پاسخ صحیح.
        - **هدف نهایی:** کاربر باید برای انتخاب پاسخ صحیح، مجبور به فکر کردن عمیق شود.

        سوالات باید مستقیماً از محتوای ارائه شده (شامل متن و تصاویر) استخراج شوند.

        محتوای مرجع:
        ---
        ${fullContent}
        ---
        `;
        
        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });

        let buffer = '';
        const questions: QuizQuestion[] = [];
        const questionStartToken = '[QUESTION_START]';
        const questionEndToken = '[QUESTION_END]';

        for await (const chunk of stream) {
            buffer += chunk.text;
            let startIndex, endIndex;
            while ((startIndex = buffer.indexOf(questionStartToken)) !== -1 && (endIndex = buffer.indexOf(questionEndToken, startIndex)) !== -1) {
                const jsonStr = buffer.substring(startIndex + questionStartToken.length, endIndex).trim();
                try {
                    const q = JSON.parse(jsonStr);
                    const question = { ...q };
                    if (question.type === 'multiple-choice') {
                       question.options = Array.isArray(question.options) ? question.options : [];
                    }
                    questions.push(question);
                    onQuestionStream(question);
                } catch (e) {
                    console.error("Failed to parse streamed question JSON:", jsonStr, e);
                }
                buffer = buffer.substring(endIndex + questionEndToken.length);
            }
        }
        
        return { questions };
    });
}


const gradingSchema = {
    type: Type.OBJECT,
    properties: {
        results: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    questionId: { type: Type.STRING },
                    isCorrect: { type: Type.BOOLEAN },
                    score: { type: Type.INTEGER },
                    analysis: { type: Type.STRING }
                },
                required: ["questionId", "isCorrect", "score", "analysis"]
            }
        }
    },
    required: ["results"]
}

export async function gradeAndAnalyzeQuiz(questions: QuizQuestion[], userAnswers: Record<string, UserAnswer>, sourceContent: string, sourceImages: {mimeType: string, data: string}[]): Promise<(Omit<QuizResult, 'question' | 'userAnswer'> & { questionId: string })[]> {
    return withRetry(async () => {
        const prompt = `
        شما یک دستیار معلم متخصص هستید. وظیفه شما تصحیح آزمون زیر و ارائه تحلیل دقیق برای هر سوال است.

        متن اصلی و تصاویر درس برای مرجع:
        ---
        ${sourceContent}
        ---

        ساختار آزمون و پاسخ‌های صحیح:
        ---
        ${JSON.stringify(questions, null, 2)}
        ---

        پاسخ‌های کاربر:
        ---
        ${JSON.stringify(userAnswers, null, 2)}
        ---

        وظایف شما:
        1.  برای هر سوال، پاسخ کاربر را با پاسخ صحیح مقایسه کن.
        2.  برای سوالات تشریحی (short-answer)، پاسخ کاربر را بر اساس محتوای درس (شامل متن و تصاویر) و مفهوم پاسخ صحیح، ارزیابی کن. پاسخ‌های نزدیک به مفهوم را صحیح در نظر بگیر.
        3.  برای هر سوال، یک تحلیل (analysis) کوتاه بنویس:
            -   اگر پاسخ صحیح بود، کاربر را تشویق کن و نکته کلیدی سوال را یادآوری کن.
            -   اگر پاسخ غلط بود، به طور واضح توضیح بده که چرا پاسخ صحیح، درست است و چرا پاسخ کاربر اشتباه بوده است.
        4.  امتیاز (score) کسب شده برای هر سوال را مشخص کن (اگر صحیح بود، امتیاز کامل سوال، در غیر این صورت صفر).
        5.  خروجی باید فقط یک آبجکت JSON مطابق با اسکیمای ارائه شده باشد.
        `;
        
        const imageParts = sourceImages.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: {
                responseMimeType: "application/json",
                responseSchema: gradingSchema
            }
        });
        const parsedResult = JSON.parse(response.text);
        return parsedResult.results;
    });
}


export async function generateFinalExam(
    fullContent: string, 
    images: {mimeType: string, data: string}[], 
    weaknessTopics: string,
    onQuestionStream: (question: QuizQuestion) => void
): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `بر اساس کل محتوای زیر (متن و تصاویر)، یک آزمون جامع نهایی با ۱۰ سوال متنوع ایجاد کن. سوالات باید **فقط و فقط** از انواع 'multiple-choice' و 'short-answer' باشند. در طراحی سوالات، تمرکز ویژه‌ای بر روی این موضوعات که کاربر در آنها ضعف داشته، داشته باش: ${weaknessTopics}. برای هر سوال سختی و امتیاز تعریف کن.

        **خروجی را به صورت جریانی (stream) تولید کن.** هر سوال را به صورت یک آبجکت JSON معتبر در یک خط جدید و محصور شده بین توکن‌های [QUESTION_START] و [QUESTION_END] ارسال کن.
        مثال فرمت خروجی:
        [QUESTION_START]
        {"id": "q1", "type": "multiple-choice", "question": "...", "options": ["...", "..."], "correctAnswerIndex": 0, "difficulty": "متوسط", "points": 10}
        [QUESTION_END]
        [QUESTION_START]
        {"id": "q2", "type": "short-answer", "question": "...", "correctAnswer": "...", "difficulty": "آسان", "points": 5}
        [QUESTION_END]

        **قوانین سختگیرانه برای طراحی سوالات تستی (مخصوصا چندگزینه‌ای):**
        - **سوالات کاملاً مفهومی:** هر سوال باید یک سناریو، یک مقایسه، یا یک تحلیل علت و معلولی را مطرح کند. از سوالات ساده که پاسخشان مستقیماً در یک جمله از متن پیدا می‌شود، اکیداً خودداری کن.
        - **بازنویسی کامل:** به هیچ وجه از جملات یا عبارات کلیدی متن اصلی در صورت سوال یا گزینه‌ها استفاده نکن. مفاهیم را با کلمات و ساختارهای کاملاً جدید بیان کن.
        - **هنر طراحی گزینه‌های انحرافی (Distractors):** این بخش حیاتی است. گزینه‌های غلط باید به شدت فریبنده و قابل قبول به نظر برسند. هر گزینه غلط باید یکی از ویژگی‌های زیر را داشته باشد:
            * **حقیقتی ناقص:** گزینه‌ای که بخشی از آن درست است اما در کل به دلیل یک کلمه یا عبارت کلیدی، غلط محسوب می‌شود.
            * **صحیح اما بی‌ربط:** گزینه‌ای که یک عبارت کاملاً صحیح از متن است، اما پاسخ سوال مطرح شده نیست.
            * **اشتباه رایج:** گزینه‌ای که یک تصور غلط یا اشتباه متداول در مورد موضوع را بیان می‌کند.
            * **وارونه‌سازی ظریف:** گزینه‌ای که رابطه علت و معلولی را برعکس نشان می‌دهد یا یک مفهوم را به شکلی معکوس بیان می‌کند.
            * **بسیار شبیه به پاسخ صحیح:** گزینه‌ای که فقط در یک کلمه یا جزئیات بسیار کوچک با پاسخ صحیح تفاوت دارد.
        - **هدف نهایی:** کاربر پس از خواندن سوال و گزینه‌ها، باید دچار تردید جدی شود و برای انتخاب پاسخ صحیح، مجبور به فکر کردن عمیق و مراجعه به دانش مفهومی خود از متن گردد. گزینه‌ها نباید به سادگی قابل حذف باشند.

        متن کامل:
        ---
        ${fullContent}
        ---
        `;
        
        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));

        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });

        let buffer = '';
        const questions: QuizQuestion[] = [];
        const questionStartToken = '[QUESTION_START]';
        const questionEndToken = '[QUESTION_END]';

        for await (const chunk of stream) {
            buffer += chunk.text;
            let startIndex, endIndex;
            while ((startIndex = buffer.indexOf(questionStartToken)) !== -1 && (endIndex = buffer.indexOf(questionEndToken, startIndex)) !== -1) {
                const jsonStr = buffer.substring(startIndex + questionStartToken.length, endIndex).trim();
                try {
                    const q = JSON.parse(jsonStr);
                    const question = { ...q };
                    if (question.type === 'multiple-choice') {
                       question.options = Array.isArray(question.options) ? question.options : [];
                    }
                    questions.push(question);
                    onQuestionStream(question);
                } catch (e) {
                    console.error("Failed to parse streamed final exam question JSON:", jsonStr, e);
                }
                buffer = buffer.substring(endIndex + questionEndToken.length);
            }
        }
        
        return { questions };
    });
}

export async function generateCorrectiveSummary(fullContent: string, images: {mimeType: string, data: string}[], incorrectAnswers: { question: string, correctAnswer: string }[]): Promise<string> {
    return withRetry(async () => {
        const summaryPrompt = `
        بر اساس متن کامل و تصاویر زیر و لیستی از سوالاتی که کاربر به اشتباه پاسخ داده است، یک "خلاصه اصلاحی" شخصی‌سازی شده به زبان Markdown ایجاد کن. برای هر مفهوم اشتباه پاسخ داده شده، یک توضیح واضح و مختصر ارائه بده.

        متن کامل:
        ---
        ${fullContent}
        ---

        سوالات اشتباه پاسخ داده شده و پاسخ صحیح آنها:
        ${incorrectAnswers.map(item => `- سوال: ${item.question}\n  - پاسخ صحیح: ${item.correctAnswer}`).join('\n')}
        `;
        
        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: summaryPrompt }, ...imageParts] }
        });

        return await marked.parse(response.text);
    });
}

export async function generatePracticeResponse(topic: string, problem: string): Promise<string> {
    return withRetry(async () => {
        const prompt = problem 
            ? `یک راه حل کامل و گام به گام برای این مسئله ارائه بده: "${problem}"`
            : `یک سوال تمرینی (می‌تواند چندگزینه‌ای یا تشریحی باشد) در مورد موضوع "${topic}" به همراه پاسخ آن ایجاد کن.`;
        
        // FIX: The `contents` property should directly contain the prompt string, not an object with a `contents` property.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt
        });

        return await marked.parse(response.text);
    });
}

export async function generateChatResponse(history: ChatMessage[], question: string, nodeTitle: string | null, sourceContent: string): Promise<string> {
    return withRetry(async () => {
        const historyForPrompt = history.map(h => `${h.role === 'user' ? 'کاربر' : 'مربی'}: ${h.message}`).join('\n');

        const contextPrompt = nodeTitle
            ? `کاربر در حال مطالعه درسی با عنوان "${nodeTitle}" است. برای پاسخ به سوالات به این موضوع و محتوای کلی زیر توجه کن.`
            : `کاربر در حال بررسی نقشه ذهنی کلی است.`;

        const prompt = `شما یک مربی یادگیری هوشمند, صمیمی و آگاه به نام "مربی هوشمند" هستید. وظیفه شما کمک به کاربر برای درک بهتر مطالب درسی است. بر اساس متن درس و تاریخچه گفتگو به سوال کاربر پاسخ دهید. پاسخ‌های خود را به صورت Markdown ارائه دهید.

        ${contextPrompt}
        
        محتوای کلی درس برای مرجع:
        ---
        ${sourceContent}
        ---

        تاریخچه گفتگو:
        ${historyForPrompt}

        سوال جدید کاربر: ${question}

        پاسخ شما:
        `;

        // FIX: The `contents` property should directly contain the prompt string, not an object with a `contents` property.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });

        return await marked.parse(response.text);
    });
}