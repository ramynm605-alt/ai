import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, Quiz, LearningPreferences, NodeContent, QuizQuestion, UserAnswer, QuizResult, PreAssessmentAnalysis, ChatMessage } from '../types';
import { marked } from 'marked';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper function for retrying with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        // Only retry on 503 Service Unavailable errors
        if (retries > 0 && error.message && error.message.includes('503')) {
            console.warn(`API call failed with 503, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(res => setTimeout(res, delay));
            return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
        }
        console.error("API call failed after multiple retries or with a non-retriable error:", error);
        throw error; // Re-throw the error if retries are exhausted or it's not a 503
    }
}


const mindMapSchema = {
    type: Type.OBJECT,
    properties: {
        mindMap: {
            type: Type.ARRAY,
            description: "آرایه‌ای از گره‌های نقشه ذهنی.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "یک شناسه منحصر به فرد برای گره." },
                    title: { type: Type.STRING, description: "عنوان گره یا مفهوم." },
                    parentId: { type: Type.STRING, description: "شناسه گره والد. برای گره ریشه null است." },
                    difficulty: { type: Type.NUMBER, description: "امتیاز سختی از 0.0 (آسان) تا 1.0 (دشوار)." },
                    isExplanatory: { type: Type.BOOLEAN, description: "آیا این یک گره توضیحی اضافی است یا خیر." },
                    sourcePages: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "شماره صفحاتی از منبع که این گره به آنها مربوط است." }
                },
                required: ["id", "title", "parentId", "difficulty", "isExplanatory", "sourcePages"]
            }
        },
        preAssessment: {
            type: Type.OBJECT,
            description: "یک آزمون اولیه برای سنجش دانش کاربر.",
            properties: {
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["multiple-choice", "short-answer"] },
                            question: { type: Type.STRING },
                            difficulty: { type: Type.STRING, enum: ['آسان', 'متوسط', 'سخت'] },
                            points: { type: Type.INTEGER },
                            // Multiple-choice specific
                            mcOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswerIndex: { type: Type.INTEGER },
                            // Short-answer specific
                            correctAnswer: { type: Type.STRING },
                        },
                        required: ["id", "type", "question", "difficulty", "points"]
                    }
                }
            },
            required: ["questions"]
        }
    },
    required: ["mindMap", "preAssessment"]
};

export async function generateLearningPlan(content: string, pageContents: string[] | null, images: {mimeType: string, data: string}[], preferences: LearningPreferences): Promise<{ mindMap: MindMapNode[], preAssessment: Quiz }> {
    return withRetry(async () => {
        const customInstructions = preferences.customInstructions ? `دستورالعمل سفارشی کاربر: ${preferences.customInstructions}` : '';
        const explanatoryInstruction = preferences.addExplanatoryNodes ? "اگر در متن به مفاهیم پیش‌نیاز اشاره شده که به خوبی توضیح داده نشده‌اند، گره‌های توضیحی اضافی برای آن‌ها ایجاد کن و isExplanatory را true قرار بده." : "";
        const learningGoalInstruction = preferences.learningGoal ? `مهم: هدف اصلی کاربر از یادگیری این موضوع '${preferences.learningGoal}' است. ساختار نقشه ذهنی و سوالات پیش‌آزمون را متناسب با این هدف طراحی کن.` : '';

        const pageContentForPrompt = pageContents
            ? `محتوای زیر بر اساس صفحه تفکیک شده است. هنگام ایجاد گره‌ها، شماره صفحات مرتبط را در فیلد sourcePages مشخص کن.\n\n` + pageContents.map((text, i) => `--- صفحه ${i + 1} ---\n${text}`).join('\n\n')
            : `متن:\n---\n${content}\n---`;

        const prompt = `بر اساس محتوای زیر، یک طرح درس به صورت نقشه ذهنی سلسله مراتبی ایجاد کن.
    1.  مفاهیم اصلی و فرعی را شناسایی کن. بر اساس پیچیدگی و حجم متن، یک نقشه ذهنی با تعداد کل گره‌ها بین ۲ تا ۱۱ ایجاد کن. برای متون کوتاه‌تر و ساده‌تر، تعداد گره‌ها را به ۲ یا ۳ محدود کن. برای متون پیچیده و طولانی، تعداد را به سمت ۱۱ افزایش بده. هدف ایجاد یک مسیر یادگیری جامع و در عین حال مختصر است.
    2.  برای هر گره، یک امتیاز سختی بین 0.0 (بسیار آسان) تا 1.0 (بسیار دشوار) بر اساس پیچیدگی مفهوم اختصاص بده.
    3.  ${explanatoryInstruction}
    4.  همچنین، یک پیش‌آزمون جامع با ۵ تا ۱۰ سوال برای سنجش دقیق دانش اولیه کاربر از کل متن طراحی کن. این آزمون باید **چالش‌برانگیز** باشد و شامل **ترکیب متنوعی** از انواع سوالات زیر باشد:
        -   **چهارگزینه‌ای (multiple-choice):** سوالات مفهومی و تحلیلی.
        -   **درست یا نادرست (true/false):** این نوع سوال را با فرمت \`multiple-choice\` بساز که گزینه‌ها فقط "درست" و "نادرست" باشند.
        -   **تشریحی کوتاه (short-answer):** سوالاتی که نیازمند پاسخ کوتاه و دقیق برای سنجش درک مفهومی هستند.
        -   **جای خالی (fill-in-the-blank):** این نوع سوال را با فرمت \`short-answer\` بساز و در متن سوال از \`____\` برای نشان دادن جای خالی استفاده کن.

    5.  برای تمام سوالات، از **قوانین سختگیرانه** زیر پیروی کن:
        - **سوالات کاملاً مفهومی و تحلیلی:** هر سوال باید یک سناریو، یک مقایسه، یا یک تحلیل علت و معلولی را مطرح کند. از سوالات ساده که پاسخشان مستقیماً در یک جمله از متن پیدا می‌شود، اکیداً خودداری کن.
        - **بازنویسی کامل:** به هیچ وجه از جملات یا عبارات کلیدی متن اصلی در صورت سوال یا گزینه‌ها استفاده نکن. مفاهیم را با کلمات و ساختارهای کاملاً جدید بیان کن.
        - **هنر طراحی گزینه‌های انحرافی (برای سوالات چندگزینه‌ای):** این بخش حیاتی است. گزینه‌های غلط باید به شدت فریبنده و قابل قبول به نظر برسند. هر گزینه غلط باید یکی از ویژگی‌های زیر را داشته باشد:
            * **حقیقتی ناقص:** گزینه‌ای که بخشی از آن درست است اما در کل به دلیل یک کلمه یا عبارت کلیدی، غلط محسوب می‌شود.
            * **صحیح اما بی‌ربط:** گزینه‌ای که یک عبارت کاملاً صحیح از متن است، اما پاسخ سوال مطرح شده نیست.
            * **اشتباه رایج:** گزینه‌ای که یک تصور غلط یا اشتباه متداول در مورد موضوع را بیان می‌کند.
            * **وارونه‌سازی ظریف:** گزینه‌ای که رابطه علت و معلولی را برعکس نشان می‌دهد یا یک مفهوم را به شکلی معکوس بیان می‌کند.
            * **بسیار شبیه به پاسخ صحیح:** گزینه‌ای که فقط در یک کلمه یا جزئیات بسیار کوچک با پاسخ صحیح تفاوت دارد.
        - **هدف نهایی:** کاربر پس از خواندن سوال و گزینه‌ها، باید دچار تردید جدی شود و برای انتخاب پاسخ صحیح، مجبور به فکر کردن عمیق و مراجعه به دانش مفهومی خود از متن گردد. گزینه‌ها نباید به سادگی قابل حذف باشند.
    6.  ${learningGoalInstruction}
    7.  خروجی باید یک شیء JSON با دو کلید mindMap و preAssessment باشد. برای هر گره در نقشه ذهنی یک id منحصر به فرد، title، parentId (برای گره ریشه null)، difficulty، isExplanatory و sourcePages (آرایه‌ای از شماره صفحات مرتبط) ارائه بده.

        ${customInstructions}

        محتوا:
        ---
        ${pageContentForPrompt}
        ---
        `;

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: {
                responseMimeType: "application/json",
                responseSchema: mindMapSchema,
            },
        });

        const resultText = response.text;
        const resultJson = JSON.parse(resultText);

        const mindMap = resultJson.mindMap.map((node: any) => ({
            ...node,
            parentId: node.parentId === 'null' || node.parentId === '' ? null : node.parentId,
            sourcePages: node.sourcePages || [],
        }));
        
        const sanitizedQuestions = resultJson.preAssessment.questions.map((q: any) => {
            const question = { ...q };
            if (question.type === 'multiple-choice') {
                question.options = Array.isArray(question.mcOptions) ? question.mcOptions : [];
                delete question.mcOptions;
            }
            return question;
        });
        
        const sanitizedPreAssessment = { ...resultJson.preAssessment, questions: sanitizedQuestions };

        return { mindMap, preAssessment: sanitizedPreAssessment };
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


const nodeContentSchema = {
    type: Type.OBJECT,
    properties: {
        introduction: { type: Type.STRING },
        theory: { type: Type.STRING },
        example: { type: Type.STRING },
        connection: { type: Type.STRING },
        conclusion: { type: Type.STRING }
    },
    required: ["introduction", "theory", "example", "connection", "conclusion"]
};

export async function generateNodeContent(nodeTitle: string, fullContent: string, images: {mimeType: string, data: string}[], style: LearningPreferences['style'], strengths: string[], weaknesses: string[]): Promise<NodeContent> {
    return withRetry(async () => {
        let adaptiveInstruction = '';
        const isWeakTopic = weaknesses.some(w => nodeTitle.includes(w) || w.includes(nodeTitle));
        const isStrongTopic = strengths.some(s => nodeTitle.includes(s) || s.includes(nodeTitle));

        if (isWeakTopic) {
            adaptiveInstruction = "مهم: این موضوع یکی از نقاط ضعف کاربر است. توضیحات را بسیار ساده، پایه‌ای و با جزئیات کامل ارائه بده. از مثال‌های قابل فهم و تشبیه‌های ساده استفاده کن تا مفاهیم به خوبی جا بیفتند.";
        } else if (isStrongTopic) {
            adaptiveInstruction = "مهم: کاربر در این موضوع تسلط دارد. توضیحات را به صورت خلاصه‌ای پیشرفته ارائه بده و بر روی نکات ظریف، کاربردهای خاص یا ارتباط آن با مفاهیم پیچیده‌تر تمرکز کن.";
        }


        const prompt = `وظیفه شما استخراج و سازماندهی **تمام** اطلاعات مربوط به مفهوم "${nodeTitle}" از متن کامل و تصاویر ارائه‌شده است. از خلاصه‌سازی یا حذف هرگونه جزئیات خودداری کنید. محتوا را به صورت جامع و کامل در پنج بخش ساختاریافته ارائه دهید: مقدمه، تئوری، مثال، ارتباط و نتیجه‌گیری.
        
        ${adaptiveInstruction}
        
        ساختار توضیحات باید شامل پنج بخش باشد: مقدمه، تئوری، مثال، ارتباط (با مفاهیم دیگر) و نتیجه‌گیری.

        مهم: در هر بخش، کلمات و عبارات کلیدی را با استفاده از Markdown به صورت **پررنگ** مشخص کن و مهم‌ترین جمله (فقط یک جمله) را با استفاده از Markdown به صورت *ایتالیک* مشخص کن.

        متن کامل برای مرجع:
        ---
        ${fullContent}
        ---
        `;
        
        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: {
                responseMimeType: "application/json",
                responseSchema: nodeContentSchema,
            }
        });

        const parsedJson = JSON.parse(response.text);

        // Convert markdown to HTML for each section
        const htmlContent: NodeContent = {
            introduction: marked.parse(parsedJson.introduction) as string,
            theory: marked.parse(parsedJson.theory) as string,
            example: marked.parse(parsedJson.example) as string,
            connection: marked.parse(parsedJson.connection) as string,
            conclusion: marked.parse(parsedJson.conclusion) as string,
        };

        return htmlContent;
    });
}

const quizSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["multiple-choice", "short-answer"] },
            question: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['آسان', 'متوسط', 'سخت'] },
            points: { type: Type.INTEGER },
            // Multiple-choice specific
            mcOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswerIndex: { type: Type.INTEGER },
            // Short-answer specific
            correctAnswer: { type: Type.STRING },
        },
        required: ["id", "type", "question", "difficulty", "points"]
      }
    }
  },
  required: ["questions"]
};

export async function generateQuiz(nodeTitle: string, fullContent: string, images: {mimeType: string, data: string}[]): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `برای سنجش تسلط بر مفهوم "${nodeTitle}"، یک آزمون متنوع با تعداد سوالات بین ۳ تا ۷ عدد طراحی کن. تعداد سوالات را بر اساس حجم و پیچیدگی مفهوم انتخاب کن. سوالات باید شامل ترکیبی از انواع 'multiple-choice' و 'short-answer' باشند.
        
        برای هر سوال موارد زیر را مشخص کن:
        -   یک id منحصر به فرد
        -   نوع سوال (type)
        -   متن سوال (question)
        -   درجه سختی (difficulty: 'آسان', 'متوسط', 'سخت')
        -   امتیاز (points: آسان=5, متوسط=10, سخت=15)

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

        سوالات باید مستقیماً از محتوای ارائه شده (شامل متن و تصاویر) استخراج شوند.

        محتوای مرجع:
        ---
        ${fullContent}
        ---
        `;
        
        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
            }
        });

        const parsed = JSON.parse(response.text);
        
        const sanitizedQuestions = parsed.questions.map((q: any) => {
            const question = { ...q };
            if (question.type === 'multiple-choice') {
                question.options = Array.isArray(question.mcOptions) ? question.mcOptions : [];
                delete question.mcOptions;
            }
            return question;
        });

        return { ...parsed, questions: sanitizedQuestions };
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


export async function generateFinalExam(fullContent: string, images: {mimeType: string, data: string}[], weaknessTopics: string): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `بر اساس کل محتوای زیر (متن و تصاویر)، یک آزمون جامع نهایی با ۱۰ سوال متنوع (multiple-choice, short-answer) ایجاد کن. در طراحی سوالات، تمرکز ویژه‌ای بر روی این موضوعات که کاربر در آنها ضعف داشته، داشته باش: ${weaknessTopics}. برای هر سوال سختی و امتیاز تعریف کن.

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

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
            }
        });
        const parsed = JSON.parse(response.text);
        
        const sanitizedQuestions = parsed.questions.map((q: any) => {
            const question = { ...q };
            if (question.type === 'multiple-choice') {
                question.options = Array.isArray(question.mcOptions) ? question.mcOptions : [];
                delete question.mcOptions;
            }
            return question;
        });

        return { ...parsed, questions: sanitizedQuestions };
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

        return marked.parse(response.text);
    });
}

export async function generatePracticeResponse(topic: string, problem: string): Promise<string> {
    return withRetry(async () => {
        const prompt = problem 
            ? `یک راه حل کامل و گام به گام برای این مسئله ارائه بده: "${problem}"`
            : `یک سوال تمرینی (می‌تواند چندگزینه‌ای یا تشریحی باشد) در مورد موضوع "${topic}" به همراه پاسخ آن ایجاد کن.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt
        });

        return marked.parse(response.text);
    });
}

export async function generateChatResponse(history: ChatMessage[], question: string, nodeTitle: string | null, sourceContent: string): Promise<string> {
    return withRetry(async () => {
        const historyForPrompt = history.map(h => `${h.role === 'user' ? 'کاربر' : 'مربی'}: ${h.message}`).join('\n');

        const contextPrompt = nodeTitle
            ? `کاربر در حال مطالعه درسی با عنوان "${nodeTitle}" است. برای پاسخ به سوالات به این موضوع و محتوای کلی زیر توجه کن.`
            : `کاربر در حال بررسی نقشه ذهنی کلی است.`;

        const prompt = `شما یک مربی یادگیری هوشمند، صمیمی و آگاه به نام "مربی هوشمند" هستید. وظیفه شما کمک به کاربر برای درک بهتر مطالب درسی است. بر اساس متن درس و تاریخچه گفتگو به سوال کاربر پاسخ دهید. پاسخ‌های خود را به صورت Markdown ارائه دهید.

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

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });

        return marked.parse(response.text) as string;
    });
}