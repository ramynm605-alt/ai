
import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, Quiz, LearningPreferences, NodeContent, QuizQuestion, UserAnswer, QuizResult, GradingResult, PreAssessmentAnalysis, ChatMessage, Weakness } from '../types';
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

// Helper to clean JSON string from markdown code blocks
function cleanJsonString(str: string): string {
    return str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
}

// Helper to flatten recursive mind map structure
function flattenMindMap(node: any, parentId: string | null = null): MindMapNode[] {
    const currentNode: MindMapNode = {
        id: node.id || Math.random().toString(36).substr(2, 9),
        title: node.title || node.label || "بدون عنوان",
        parentId: parentId,
        locked: false,
        difficulty: node.difficulty || 0.5,
        isExplanatory: node.isExplanatory || false,
        sourcePages: node.sourcePages || [],
        type: 'core',
    };

    let childrenNodes: MindMapNode[] = [];
    if (node.children && Array.isArray(node.children)) {
        childrenNodes = node.children.flatMap((child: any) => flattenMindMap(child, currentNode.id));
    }

    return [currentNode, ...childrenNodes];
}

const getPreferenceInstructions = (preferences: LearningPreferences): string => {
    const translations = {
        knowledgeLevel: {
            beginner: 'مبتدی',
            intermediate: 'متوسط',
            expert: 'پیشرفته'
        },
        learningFocus: {
            theoretical: 'عمق تئوری',
            practical: 'مثال‌های عملی',
            analogies: 'تشبیه‌ها و مثال‌های ساده'
        },
        tone: {
            academic: 'آکادمیک و رسمی',
            conversational: 'دوستانه و محاوره‌ای'
        }
    };

    const instructions = [
        preferences.learningGoal ? `مهم: هدف اصلی کاربر از یادگیری این موضوع '${preferences.learningGoal}' است. تمام مثال‌ها و ساختار درس را بر این اساس تنظیم کن.` : '',
        `سطح دانش کاربر: ${translations.knowledgeLevel[preferences.knowledgeLevel]}. توضیحات و سوالات را متناسب با این سطح تنظیم کن.`,
        `تمرکز یادگیری کاربر بر ${translations.learningFocus[preferences.learningFocus]} است.`,
        `لحن توضیحات باید ${translations.tone[preferences.tone]} باشد.`,
        preferences.addExplanatoryNodes ? "اگر در متن به مفاهیم پیش‌نیاز اشاره شده که به خوبی توضیح داده نشده‌اند، گره‌های توضیحی اضافی برای آن‌ها ایجاد کن و isExplanatory را true قرار بده." : "",
        preferences.customInstructions ? `دستورالعمل سفارشی کاربر: ${preferences.customInstructions}` : ''
    ].filter(Boolean).join('\n');

    return instructions;
};


export async function generateLearningPlan(
    content: string, 
    pageContents: string[] | null, 
    images: {mimeType: string, data: string}[], 
    preferences: LearningPreferences,
    onMindMapGenerated: (mindMap: MindMapNode[], suggestedPath: string[]) => void,
    onQuestionStream: (question: QuizQuestion) => void
): Promise<Quiz> { // Returns the final quiz, but streams questions along the way
    return withRetry(async () => {
        const preferenceInstructions = getPreferenceInstructions(preferences);
        
        // Check if this is "Topic Mode" (short content, no pages)
        const isTopicMode = content.length < 500 && !pageContents && images.length === 0;
        
        let contextInstruction = "";
        if (isTopicMode) {
            contextInstruction = `
            *** حالت تحقیق موضوعی (Topic Mode) ***
            متن ورودی کاربر کوتاه است: "${content}".
            وظیفه تو این است که به عنوان یک متخصص، خودت یک برنامه درسی (Curriculum) جامع و سلسله‌مراتبی برای یادگیری این موضوع طراحی کنی.
            از دانش داخلی خودت استفاده کن. سرفصل‌ها باید از مقدماتی تا پیشرفته باشند.
            `;
        } else {
            contextInstruction = `
            *** حالت استخراج محتوا (Extraction Mode) ***
            وظیفه تو استخراج ساختار و نقشه ذهنی بر اساس محتوای متنی ارائه شده در پایین است.
            فقط از مطالبی که در متن وجود دارد استفاده کن.
            `;
        }

        const pageContentForPrompt = pageContents
            ? `محتوای زیر بر اساس صفحه تفکک شده است. هنگام ایجاد گره‌ها، شماره صفحات مرتبط را در فیلد sourcePages مشخص کن.\n\n` + pageContents.map((text, i) => `--- صفحه ${i + 1} ---\n${text}`).join('\n\n')
            : `متن:\n---\n${content}\n---`;
        
        const prompt = `
        **وظیفه اول: ایجاد نقشه ذهنی (Chunking)**
        ${contextInstruction}
        بر اساس اولویت‌های کاربر، یک طرح درس به صورت نقشه ذهنی سلسله مراتبی ایجاد کن.
        
        **قوانین ساختاری (بسیار مهم - تفکیک محتوا):**
        1. **اصل عدم هم‌پوشانی (Mutually Exclusive):** موضوعات را به گونه‌ای خرد کن که محتوای هر گره کاملاً متمایز باشد. گره فرزند نباید کل محتوای گره پدر را تکرار کند، بلکه باید جزئی از آن باشد.
        2.  **گره ریشه (اجباری):** باید دقیقاً یک گره با parentId: null وجود داشته باشد. عنوان آن باید "مقدمه و نقشه راه" باشد.
        3.  **گره‌های اصلی:** سایر گره‌ها باید به طور مستقیم یا غیرمستقیم فرزند این گره باشند.
        4.  **گره پایان (اجباری):** آخرین گره در مسیر یادگیری باید "جمع‌بندی و نتیجه‌گیری" باشد.
        5.  **تشخیص نوع محتوا:** اگر متن ریاضی است، گره‌ها باید "قضیه/اثبات" باشند. اگر تاریخ است، "رویداد/تحلیل". ساختار را هوشمندانه انتخاب کن.
        6.  **فشردگی:** بین ۵ تا ۱۲ گره کل.

        **وظیفه دوم: ایجاد پیش‌آزمون تطبیقی**
        ۵ سوال طراحی کن که دانش اولیه کاربر را بسنجد.
        سوالات باید **فقط و فقط** از انواع 'multiple-choice' و 'short-answer' باشند.

        **فرمت دقیق JSON برای سوالات (حیاتی):**
        برای سوالات چندگزینه‌ای حتماً آرایه 'options' را پر کن.
        
        نمونه چندگزینه‌ای:
        {
          "id": "q1",
          "type": "multiple-choice",
          "question": "متن سوال؟",
          "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
          "correctAnswerIndex": 0,
          "difficulty": "آسان",
          "points": 10
        }

        نمونه کوتاه‌پاسخ:
        {
          "id": "q2",
          "type": "short-answer",
          "question": "متن سوال؟",
          "correctAnswer": "پاسخ",
          "difficulty": "متوسط",
          "points": 20
        }

        **وظیفه سوم: مسیر پیشنهادی**
        ترتیب منطقی مطالعه گره‌ها (suggestedPath).
        این آرایه باید با ID گره ریشه شروع شود و با ID گره نتیجه‌گیری تمام شود.

        **اولویت‌های شخصی‌سازی کاربر:**
        ---
        ${preferenceInstructions}
        ---

        **دستورالعمل خروجی (استریم):**
        1.  ابتدا آبجکت JSON شامل \`mindMap\` و \`suggestedPath\` را بین \`[MIND_MAP_START]\` و \`[MIND_MAP_END]\` بفرست.
            فرمت MindMap: آرایه‌ای از آبجکت‌های { id, title, parentId, difficulty, isExplanatory, sourcePages }.
        2.  سپس سوالات را تک تک بین \`[QUESTION_START]\` و \`[QUESTION_END]\` بفرست.

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
                    let jsonStr = buffer.substring(startIndex + mindMapStartToken.length, endIndex).trim();
                    jsonStr = cleanJsonString(jsonStr);
                    
                    try {
                        const resultJson = JSON.parse(jsonStr);
                        let mindMap: MindMapNode[] = [];

                        // Handle different JSON structures (Flat Array vs Nested Object)
                        if (Array.isArray(resultJson.mindMap)) {
                            mindMap = resultJson.mindMap.map((node: any) => ({
                                id: node.id,
                                title: node.title || node.label,
                                parentId: node.parentId === 'null' || node.parentId === '' ? null : node.parentId,
                                locked: false,
                                difficulty: node.difficulty || 0.5,
                                isExplanatory: node.isExplanatory || false,
                                sourcePages: node.sourcePages || [],
                                type: 'core',
                            }));
                        } else if (resultJson.mindMap && Array.isArray(resultJson.mindMap.nodes)) {
                             mindMap = resultJson.mindMap.nodes.map((node: any) => ({
                                id: node.id,
                                title: node.title || node.label,
                                parentId: node.parentId === 'null' || node.parentId === '' ? null : node.parentId,
                                locked: false,
                                difficulty: node.difficulty || 0.5,
                                isExplanatory: node.isExplanatory || false,
                                sourcePages: node.sourcePages || [],
                                type: 'core',
                            }));
                        } else if (resultJson.mindMap && typeof resultJson.mindMap === 'object') {
                            mindMap = flattenMindMap(resultJson.mindMap);
                        } else {
                            console.error("Unexpected mindMap structure", resultJson);
                            mindMap = [];
                        }

                        if (mindMap.length === 0) {
                            throw new Error("Mind map parsing failed or empty.");
                        }

                        // --- POST-PROCESSING: Ensure Single Root/Introduction Node ---
                        const nodeIds = new Set(mindMap.map(n => n.id));
                        const roots = mindMap.filter(n => n.parentId === null || !nodeIds.has(n.parentId));
                        
                        if (roots.length === 0) {
                             // Cycle detected or no null parents? Pick the first one as root.
                             if (mindMap.length > 0) {
                                mindMap[0].parentId = null;
                                mindMap[0].title = "مقدمه و نقشه راه";
                             }
                        } else if (roots.length > 1) {
                            // Multiple roots found. Attempt to find an existing "Intro" node or create a synthetic super-root.
                            const introNode = roots.find(r => r.title.includes('مقدمه') || r.title.toLowerCase().includes('intro') || r.title.toLowerCase().includes('overview'));
                            let rootId: string;
                            
                            if (introNode) {
                                rootId = introNode.id;
                                // Link all other roots to this intro node
                                roots.forEach(r => {
                                    if (r.id !== rootId) r.parentId = rootId;
                                });
                            } else {
                                // Create synthetic root
                                rootId = 'synthetic_root_' + Math.random().toString(36).substr(2, 5);
                                const newRoot: MindMapNode = {
                                    id: rootId,
                                    title: 'مقدمه و نقشه راه',
                                    parentId: null,
                                    locked: false,
                                    difficulty: 0.1,
                                    isExplanatory: true,
                                    sourcePages: [],
                                    type: 'core',
                                };
                                mindMap.unshift(newRoot);
                                // Link old roots to new root
                                roots.forEach(r => r.parentId = rootId);
                            }
                        } else {
                             // Exactly one root. Ensure title is reasonable.
                             if (roots[0].title === 'بدون عنوان' || !roots[0].title) {
                                 roots[0].title = 'مقدمه و نقشه راه';
                             }
                        }
                        
                        // --- Ensure Conclusion Node Exists ---
                        const conclusionNode = mindMap.find(n => n.title.includes('نتیجه‌گیری') || n.title.includes('جمع‌بندی'));
                        if (!conclusionNode && mindMap.length > 0) {
                             // No conclusion node found? Create one.
                             const conclusionId = 'synthetic_conclusion_' + Math.random().toString(36).substr(2, 5);
                             const rootNode = mindMap.find(n => n.parentId === null);
                             // We attach it to root for data consistency, but UI will handle visual placement
                             mindMap.push({
                                 id: conclusionId,
                                 title: 'جمع‌بندی و نتیجه‌گیری',
                                 parentId: rootNode ? rootNode.id : mindMap[0].id,
                                 locked: true,
                                 difficulty: 0.3,
                                 isExplanatory: false,
                                 sourcePages: [],
                                 type: 'core',
                             });
                        }
                        // -------------------------------------------------------------

                        let suggestedPath = resultJson.suggestedPath || [];
                        // Ensure root is first in suggested path
                        const actualRoot = mindMap.find(n => n.parentId === null);
                        if (actualRoot && !suggestedPath.includes(actualRoot.id)) {
                             suggestedPath.unshift(actualRoot.id);
                        }
                        
                        // Ensure conclusion is last in suggested path
                        const actualConclusion = mindMap.find(n => n.title.includes('نتیجه‌گیری') || n.title.includes('جمع‌بندی'));
                         if (actualConclusion && !suggestedPath.includes(actualConclusion.id)) {
                             suggestedPath.push(actualConclusion.id);
                        } else if (actualConclusion) {
                             // Move to end if exists but in wrong place (unlikely but safe)
                             suggestedPath = suggestedPath.filter(id => id !== actualConclusion.id);
                             suggestedPath.push(actualConclusion.id);
                        }

                        const unlockedMindMap = mindMap.map(node => ({ ...node, locked: !!node.parentId }));
                        onMindMapGenerated(unlockedMindMap, suggestedPath);
                        mindMapGenerated = true;
                    } catch (e) {
                        console.error("Failed to parse mind map JSON:", e, jsonStr);
                    }
                    buffer = buffer.substring(endIndex + mindMapEndToken.length);
                }
            }

            if (mindMapGenerated) {
                let startIndex, endIndex;
                while ((startIndex = buffer.indexOf(questionStartToken)) !== -1 && (endIndex = buffer.indexOf(questionEndToken, startIndex)) !== -1) {
                    let jsonStr = buffer.substring(startIndex + questionStartToken.length, endIndex).trim();
                    jsonStr = cleanJsonString(jsonStr);

                    try {
                        const q = JSON.parse(jsonStr);
                        const question = { ...q };
                        if (question.type === 'multiple-choice') {
                           // Robustness: handle if model uses 'choices' instead of 'options'
                           if (!question.options && question.choices) {
                               question.options = question.choices;
                           }
                           question.options = Array.isArray(question.options) ? question.options : [];
                        }
                        questions.push(question);
                        onQuestionStream(question);
                    } catch (e) {
                        console.error("Failed to parse question:", e, jsonStr);
                    }
                    buffer = buffer.substring(endIndex + questionEndToken.length);
                }
            }
        }
        
        return { questions };
    });
}

// ... (PreAssessmentAnalysis code remains similar, mostly prompt tweaks if needed)
const preAssessmentAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        overallAnalysis: { type: Type.STRING, description: "تحلیل کلی و دوستانه." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "نقاط قوت." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "نقاط قابل بهبود." },
        recommendedLevel: { type: Type.STRING, enum: ["مبتدی", "متوسط", "پیشرفته"], description: "سطح پیشنهادی." }
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
        نتایج پیش‌آزمون کاربر را تحلیل کن.
        به جای قضاوت (ضعیف/قوی)، از ادبیات "رشد" استفاده کن (مثلاً: "این مباحث برایت جدید است").
        اگر کاربر سوالات سخت را غلط زده ولی آسان‌ها را درست، پیشنهاد سطح متوسط بده.
        
        متن:
        ${sourceContent.substring(0, 5000)}... (truncated)

        سوالات و پاسخ‌ها:
        ${JSON.stringify({questions, userAnswers}, null, 2)}
        
        خروجی JSON مطابق اسکیما.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", responseSchema: preAssessmentAnalysisSchema }
        });
        // Ensure cleaning even for schema mode if necessary, though usually not needed
        const cleanText = cleanJsonString(response.text || '{}');
        return JSON.parse(cleanText);
    });
}

export async function generateNodeContent(
    nodeTitle: string,
    fullContent: string,
    images: { mimeType: string; data: string }[],
    preferences: LearningPreferences,
    strengths: string[],
    weaknesses: string[],
    isIntroNode: boolean,
    nodeType: 'core' | 'remedial' | 'extension',
    onStreamUpdate: (partialContent: NodeContent) => void
): Promise<NodeContent> {
    return withRetry(async () => {
        const preferenceInstructions = getPreferenceInstructions(preferences);
        
        // Check if this is "Topic Mode" (short content)
        const isTopicMode = fullContent.length < 500 && images.length === 0;

        let specificInstruction = '';
        
        if (nodeType === 'remedial') {
            // CRITICAL FIX FOR REMEDIAL NODES:
            // Ensure it ONLY covers the weaknesses, not the whole topic again.
            specificInstruction = `
            *** حالت درس تقویتی (Remedial Mode) ***
            کاربر در مبحث "${nodeTitle}" دچار کج‌فهمی شده است.
            مشکلات خاص کاربر (ضعف‌ها): ${weaknesses.length > 0 ? JSON.stringify(weaknesses) : 'عدم درک مفاهیم پایه این بخش'}.
            
            دستورالعمل ویژه:
            1. **فقط و فقط** روی رفع این نقاط ضعف تمرکز کن.
            2. از تکرار کل درس خودداری کن. مستقیم سر اصل مطلب برو.
            3. توضیح بده چرا پاسخ‌های اشتباه (در صورت وجود در متن ضعف) غلط بوده‌اند.
            4. یک مثال بسیار ساده و متفاوت از درس اصلی بزن تا گره ذهنی باز شود.
            `;
        } else {
            if (isTopicMode) {
                // GENERATIVE CONTENT INSTRUCTION
                specificInstruction = `
                *** حالت تولید محتوا (Generative Mode) ***
                عنوان درس: "${nodeTitle}"
                موضوع کلی: "${fullContent}" (این متن ممکن است فقط یک تیتر باشد).
                
                دستورالعمل ویژه:
                1. شما باید محتوای آموزشی کامل و دقیق برای این بخش را **تولید** کنید.
                2. فرض کن منبع متنی وجود ندارد و تو مرجع دانش هستی.
                3. مطالب باید دقیق، علمی و ساختاریافته باشند.
                4. تمرکز مطلق روی جزئیات همین بخش ("${nodeTitle}") داشته باش.
                `;
            } else {
                 // EXTRACTION CONTENT INSTRUCTION
                specificInstruction = `
                *** حالت درس اصلی (Core Lesson) ***
                عنوان درس: "${nodeTitle}"
                
                دستورالعمل ویژه (جلوگیری از تکرار):
                1. **فقط** مطالبی را از متن استخراج کن که **دقیقاً** زیرمجموعه "${nodeTitle}" هستند.
                2. از نوشتن مقدمه‌های کلی که مربوط به کل کتاب/مقاله است خودداری کن.
                3. از نوشتن مطالبی که احتمالا در گره‌های والد یا فرزند این گره می‌آید پرهیز کن.
                4. تمرکز مطلق روی جزئیات همین بخش داشته باش.
                `;
            }
        }

        let adaptiveInstruction = '';
        if (nodeType !== 'remedial') {
             if (weaknesses.some(w => nodeTitle.includes(w))) {
                adaptiveInstruction = "کاربر قبلاً در مفاهیم مرتبط با این عنوان ضعف نشان داده. کمی ساده‌تر و با مثال بیشتر توضیح بده.";
            } else if (strengths.some(s => nodeTitle.includes(s))) {
                adaptiveInstruction = "کاربر در این موضوع مسلط است. سریع‌تر از بدیهیات بگذر و به نکات ظریف و پیشرفته بپرداز.";
            }
        }

        const prompt = `
        نقش تو: معلم خصوصی هوشمند.
        
        ${specificInstruction}

        ${preferenceInstructions}
        ${adaptiveInstruction}
        
        **قوانین فرمت خروجی:**
        1. ساختار ۵ بخشی (INTRODUCTION, THEORY, EXAMPLE, CONNECTION, CONCLUSION).
        2. در انتهای خروجی، ۳ "سوال پیشنهادی" (Suggested Questions) ایجاد کن.
        3. فرمت سوالات: هر سوال را در یک خط جداگانه بعد از هدر ###QUESTIONS### بنویس.

        فرمت خروجی (Markdown):
        ###INTRODUCTION###
        ...
        ###THEORY###
        ...
        ###EXAMPLE###
        ...
        ###CONNECTION###
        ...
        ###CONCLUSION###
        ...
        ###QUESTIONS###
        سوال ۱؟
        سوال ۲؟
        سوال ۳؟

        محتوای منبع (Source Content):
        ${fullContent}
        `;

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        
        // SWITCH TO FLASH FOR SPEED
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });

        const processReminders = (text: string) => {
             if (!text) return '';
            const regex = /\[(\d+)\]\(یادآوری:\s*([^)]+)\)/g;
            return text.replace(regex, (_match, number, reminderText) => {
                const sanitizedText = reminderText.replace(/"/g, '&quot;');
                return `<button class="reminder-trigger" data-reminder-text="${sanitizedText}">${number}</button>`;
            });
        };

        let fullText = '';
        const contentObj: NodeContent = { introduction: '', theory: '', example: '', connection: '', conclusion: '', suggestedQuestions: [] };
        
        for await (const chunk of stream) {
            fullText += chunk.text;
            
            const headers = {
                introduction: '###INTRODUCTION###',
                theory: '###THEORY###',
                example: '###EXAMPLE###',
                connection: '###CONNECTION###',
                conclusion: '###CONCLUSION###',
                questions: '###QUESTIONS###'
            };

            // ROBUST PARSING:
            // If we are at the beginning and no header is found yet, treat everything as Introduction
            if (!fullText.includes('###INTRODUCTION###') && !fullText.includes('###THEORY###') && fullText.length > 20) {
                 contentObj.introduction = fullText;
            }

            // Standard parsing
            for (const [key, header] of Object.entries(headers)) {
                const start = fullText.lastIndexOf(header);
                if (start !== -1) {
                    // Find the next header to define the end of this section
                    let end = -1;
                    let minDist = Infinity;
                    for (const h of Object.values(headers)) {
                        const idx = fullText.indexOf(h, start + header.length);
                        if (idx !== -1 && idx < minDist) {
                            minDist = idx;
                            end = idx;
                        }
                    }
                    
                    const sectionText = end === -1 
                        ? fullText.substring(start + header.length) 
                        : fullText.substring(start + header.length, end);

                    if (key === 'questions') {
                        contentObj.suggestedQuestions = sectionText.trim().split('\n').filter(q => q.trim().length > 0);
                    } else {
                        // @ts-ignore
                        contentObj[key] = sectionText;
                    }
                }
            }

            onStreamUpdate({
                introduction: await marked.parse(processReminders(contentObj.introduction)),
                theory: await marked.parse(processReminders(contentObj.theory)),
                example: await marked.parse(processReminders(contentObj.example)),
                connection: await marked.parse(processReminders(contentObj.connection)),
                conclusion: await marked.parse(processReminders(contentObj.conclusion)),
                suggestedQuestions: contentObj.suggestedQuestions
            });
        }

        // FINAL FALLBACK: If headers failed completely but text exists, dump it all in Theory
        if (!contentObj.introduction && !contentObj.theory && fullText.trim().length > 0) {
             contentObj.theory = fullText;
        }
        
        // Final pass
        return {
             introduction: await marked.parse(processReminders(contentObj.introduction)),
             theory: await marked.parse(processReminders(contentObj.theory)),
             example: await marked.parse(processReminders(contentObj.example)),
             connection: await marked.parse(processReminders(contentObj.connection)),
             conclusion: await marked.parse(processReminders(contentObj.conclusion)),
             suggestedQuestions: contentObj.suggestedQuestions
        };
    });
}

// --- NEW: Generate Remedial Node for Adaptive Branching ---
export async function generateRemedialNode(
    parentTitle: string,
    weaknesses: Weakness[],
    content: string,
    images: { mimeType: string; data: string }[]
): Promise<MindMapNode> {
    return withRetry(async () => {
        const prompt = `
        The student failed the quiz for the topic "${parentTitle}".
        Their specific mistakes were:
        ${JSON.stringify(weaknesses.map(w => w.question), null, 2)}
        
        Create a "Remedial Node" (Mini-lesson) that focuses ONLY on explaining these specific weak points simpler and with better examples.
        
        Output JSON format:
        {
           "title": "Title for remedial lesson (e.g. 'Review: [Concept]')",
           "difficulty": 0.3,
           "isExplanatory": true
        }
        `;
        
        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: { responseMimeType: "application/json" }
        });
        
        const cleanText = cleanJsonString(response.text || '{}');
        const data = JSON.parse(cleanText);
        
        return {
            id: 'remedial_' + Math.random().toString(36).substr(2, 9),
            title: data.title || `مرور: ${parentTitle}`,
            parentId: null, // Will be set by the caller
            locked: false,
            difficulty: data.difficulty || 0.3,
            isExplanatory: true,
            sourcePages: [],
            type: 'remedial'
        };
    });
}

export async function generateQuiz(
    topic: string,
    content: string,
    images: { mimeType: string; data: string }[],
    onQuestionStream: (question: QuizQuestion) => void
): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `
        Generate a quiz with 3 to 5 questions about "${topic}" based on the provided content.
        
        Mix of 'multiple-choice' and 'short-answer'.
        Language: Persian.
        
        Output format:
        Send each question JSON object between [QUESTION_START] and [QUESTION_END] markers.
        
        Example JSON for multiple-choice:
        {
          "id": "unique_id",
          "type": "multiple-choice",
          "question": "Question text?",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correctAnswerIndex": 0,
          "difficulty": "متوسط",
          "points": 10
        }

        Example JSON for short-answer:
        {
          "id": "unique_id",
          "type": "short-answer",
          "question": "Question text?",
          "correctAnswer": "Expected key phrase or answer",
          "difficulty": "سخت",
          "points": 20
        }

        Content:
        ${content.substring(0, 20000)}
        `;

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash", // Using flash for speed on quiz generation
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });

        const questions: QuizQuestion[] = [];
        let buffer = '';
        const startToken = '[QUESTION_START]';
        const endToken = '[QUESTION_END]';

        for await (const chunk of stream) {
            buffer += chunk.text;
            let startIndex, endIndex;
            while ((startIndex = buffer.indexOf(startToken)) !== -1 && (endIndex = buffer.indexOf(endToken, startIndex)) !== -1) {
                let jsonStr = buffer.substring(startIndex + startToken.length, endIndex).trim();
                // CLEANUP: Remove markdown code block syntax if present
                jsonStr = cleanJsonString(jsonStr);
                try {
                    const q = JSON.parse(jsonStr);
                    // Simple ID generation if missing
                    if (!q.id) q.id = Math.random().toString(36).substr(2, 9);
                    if (q.type === 'multiple-choice') {
                         if (!q.options && q.choices) q.options = q.choices;
                         q.options = Array.isArray(q.options) ? q.options : [];
                    }
                    questions.push(q);
                    onQuestionStream(q);
                } catch (e) {
                    console.error("Failed to parse quiz question", e, jsonStr);
                }
                buffer = buffer.substring(endIndex + endToken.length);
            }
        }

        return { questions, isStreaming: false };
    });
}

export async function gradeAndAnalyzeQuiz(
    questions: QuizQuestion[],
    userAnswers: Record<string, UserAnswer>,
    content: string,
    images: { mimeType: string; data: string }[]
): Promise<GradingResult[]> {
     return withRetry(async () => {
        const prompt = `
        Grade the following quiz answers based on the content.
        Language: Persian.
        
        For 'multiple-choice', validate the index.
        For 'short-answer', determine if the meaning is correct.
        
        Provide a helpful 'analysis' for each question, explaining why it is correct or incorrect.

        Content:
        ${content.substring(0, 10000)}

        Questions and User Answers:
        ${JSON.stringify({ questions, userAnswers }, null, 2)}

        Output Schema: Array of QuizResult objects.
        `;

        const schema = {
             type: Type.ARRAY,
             items: {
                 type: Type.OBJECT,
                 properties: {
                     questionId: { type: Type.STRING },
                     isCorrect: { type: Type.BOOLEAN },
                     score: { type: Type.NUMBER },
                     analysis: { type: Type.STRING }
                 },
                 required: ['questionId', 'isCorrect', 'score', 'analysis']
             }
        };

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }, ...imageParts] },
            config: { responseMimeType: "application/json", responseSchema: schema }
        });

        const cleanText = cleanJsonString(response.text || '[]');
        const results = JSON.parse(cleanText);
        return results;
     });
}

export async function generateFinalExam(
    content: string, 
    images: {mimeType: string, data: string}[], 
    weaknessTopics: string,
    onQuestionStream: (question: QuizQuestion) => void
): Promise<Quiz> {
    return withRetry(async () => {
         const prompt = `
        Create a Final Exam (10 questions).
        Content: ${content.substring(0, 20000)}
        
        Focus heavily on these weak topics: ${weaknessTopics}
        
        Format: JSON stream (same as [QUESTION_START]...[QUESTION_END]).
        Language: Persian.
        `;
        
        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro", // Pro for better final exam
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });

        const questions: QuizQuestion[] = [];
        let buffer = '';
        const startToken = '[QUESTION_START]';
        const endToken = '[QUESTION_END]';

        for await (const chunk of stream) {
            buffer += chunk.text;
            let startIndex, endIndex;
            while ((startIndex = buffer.indexOf(startToken)) !== -1 && (endIndex = buffer.indexOf(endToken, startIndex)) !== -1) {
                let jsonStr = buffer.substring(startIndex + startToken.length, endIndex).trim();
                // CLEANUP: Remove markdown code block syntax if present
                jsonStr = cleanJsonString(jsonStr);
                try {
                    const q = JSON.parse(jsonStr);
                    if (!q.id) q.id = Math.random().toString(36).substr(2, 9);
                    if (q.type === 'multiple-choice') {
                        if (!q.options && q.choices) q.options = q.choices;
                        q.options = Array.isArray(q.options) ? q.options : [];
                   }
                    questions.push(q);
                    onQuestionStream(q);
                } catch (e) {
                     console.error("Failed to parse final exam question", e, jsonStr);
                }
                buffer = buffer.substring(endIndex + endToken.length);
            }
        }

        return { questions, isStreaming: false };
    });
}

export async function generateCorrectiveSummary(
    content: string,
    images: {mimeType: string, data: string}[],
    incorrectItems: { question: string, correctAnswer: string }[]
): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        Create a corrective study summary (Markdown) for the student based on their mistakes.
        
        Mistakes:
        ${JSON.stringify(incorrectItems, null, 2)}
        
        Source Material:
        ${content.substring(0, 20000)}
        
        Tone: Encouraging and explanatory.
        Language: Persian.
        `;

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }, ...imageParts] },
        });
        
        return await marked.parse(response.text || '');
    });
}

export async function generatePracticeResponse(topic: string, problem: string): Promise<string> {
     return withRetry(async () => {
        const prompt = topic 
            ? `Generate a practice problem about "${topic}". Language: Persian. Output Markdown.`
            : `Solve this problem step by step: "${problem}". Language: Persian. Output Markdown.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
        });

        return await marked.parse(response.text || '');
     });
}

export async function generateChatResponse(
    history: ChatMessage[],
    message: string,
    activeNodeTitle: string | null,
    sourceContent: string
): Promise<string> {
    return withRetry(async () => {
        const context = `
        You are a helpful AI tutor named "Mobi".
        Current Context: ${activeNodeTitle ? `Studying node: ${activeNodeTitle}` : 'General Review'}.
        Source Content Snippet: ${sourceContent.substring(0, 5000)}...
        
        Answer the user's message in Persian. Be concise, helpful, and friendly.
        `;
        
        // Convert ChatMessage[] to SDK format
        // SDK expects { role: 'user' | 'model', parts: { text: string }[] }
        const chatHistory = history.slice(0, -1).map(m => ({
            role: m.role,
            parts: [{ text: m.message }]
        }));
        
        const chat = ai.chats.create({
             model: 'gemini-2.5-flash',
             history: chatHistory,
             config: { systemInstruction: context }
        });
        
        // Send the last message
        const lastMsg = history[history.length - 1].message;
        const result = await chat.sendMessage({ message: lastMsg });
        
        return await marked.parse(result.text || '');
    });
}

// --- ENGAGEMENT LOOP FUNCTIONS ---

export async function generateDailyChallenge(
    weaknesses: Weakness[],
    content: string
): Promise<string> {
    return withRetry(async () => {
        const weakSpot = weaknesses.length > 0 
            ? weaknesses[Math.floor(Math.random() * weaknesses.length)]
            : null;

        const prompt = weakSpot
            ? `The user struggled with: "${weakSpot.question}". Create a "Daily Flash Challenge" (Markdown). Start with a quick recap of the concept, then ask a single thought-provoking question to test if they understand it now. Language: Persian. Brief and engaging.`
            : `Create a "Daily Flash Challenge" (Markdown) based on a random key concept from the content. Brief and engaging. Language: Persian. Content: ${content.substring(0, 10000)}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
        });
        
        return await marked.parse(response.text || '');
    });
}

export async function generateDeepAnalysis(
    nodeTitle: string,
    nodeContent: string
): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        Act as a world-class expert on the topic "${nodeTitle}".
        
        The student has mastered the basics. Now, provide a "Deep Dive Analysis" reward content (Markdown).
        Language: Persian (Farsi).

        **Strict Output Structure:**
        
        ### 🔬 تحلیل میکروسکوپی (Micro-Analysis)
        Deconstruct the concept into its smallest mechanics. Explain *exactly* how it works under the hood, removing abstraction.
        
        ### 💡 نکات طلایی و کنکوری (Golden Tips)
        Provide exactly 3 non-obvious, expert-level tips in bullet points. These should be practical "aha moments".
        
        ### ⚠️ دام‌های پنهان (Hidden Pitfalls)
        What is the #1 mistake people make with this concept, even after learning it? How to avoid it?
        
        ### 🔗 زنجیره دانش (Knowledge Chain)
        Briefly explain how this specific concept connects to a more advanced topic they haven't learned yet.

        Content Context: ${nodeContent.substring(0, 4000)}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro", // Use Pro for high-quality reward content
            contents: { parts: [{ text: prompt }] },
        });
        
        return await marked.parse(response.text || '');
    });
}
