
import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, Quiz, LearningPreferences, NodeContent, QuizQuestion, UserAnswer, QuizResult, GradingResult, PreAssessmentAnalysis, ChatMessage, Weakness, ChatPersona } from '../types';
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

// Helper to escape regex characters
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to auto-link node titles in text
function autoLinkNodeTitles(text: string, titles: string[]): string {
    if (!text || !titles || titles.length === 0) return text;

    const placeholders: string[] = [];
    
    // 1. Protect existing matches (already wrapped in [[...]])
    let currentText = text.replace(/\[\[(.*?)\]\]/g, (match) => {
        placeholders.push(match);
        return `__PH_${placeholders.length - 1}__`;
    });

    // 2. Sort titles by length descending to match longest phrases first
    const sortedTitles = [...titles].sort((a, b) => b.length - a.length);

    // 3. Replace titles with placeholders wrapping them in brackets
    for (const title of sortedTitles) {
        if (title.trim().length < 2) continue; // Skip very short titles
        const escapedTitle = escapeRegExp(title);
        const regex = new RegExp(escapedTitle, 'g');
        
        currentText = currentText.replace(regex, (match) => {
             placeholders.push(`[[${match}]]`);
             return `__PH_${placeholders.length - 1}__`;
        });
    }

    // 4. Restore placeholders
    return currentText.replace(/__PH_(\d+)__/g, (_, index) => placeholders[parseInt(index)]);
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
        isAdaptive: false,
        learningObjective: node.learningObjective || "درک مفاهیم پایه",
        targetSkill: node.targetSkill || "درک مطلب"
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
): Promise<Quiz> { 
    return withRetry(async () => {
        const preferenceInstructions = getPreferenceInstructions(preferences);
        
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
        **وظیفه اول: ایجاد نقشه ذهنی (Chunking) با اهداف آموزشی روشن**
        ${contextInstruction}
        
        **قوانین ساختاری (بسیار مهم):**
        1. هر گره (Node) باید **حتماً** دو فیلد جدید داشته باشد:
           - \`learningObjective\`: یک جمله کوتاه که هدف یادگیری آن گره را مشخص کند (مثلاً: "درک تفاوت بین X و Y").
           - \`targetSkill\`: مهارت شناختی هدف (مثلاً: "تحلیل"، "استنباط"، "کاربرد"، "نقد"، "به‌خاطرسپاری").
        2. **اصل عدم هم‌پوشانی:** گره فرزند نباید کل محتوای گره پدر را تکرار کند.
        3. **گره ریشه (اجباری):** باید دقیقاً یک گره با parentId: null با عنوان "مقدمه و نقشه راه" وجود داشته باشد.
        4. **گره پایان (اجباری):** آخرین گره باید "جمع‌بندی و نتیجه‌گیری" باشد.
        5. **فشردگی:** بین ۵ تا ۱۲ گره کل.

        **فرمت JSON گره:**
        {
            "id": "string",
            "title": "string",
            "parentId": "string | null",
            "learningObjective": "هدف یادگیری مشخص این گره",
            "targetSkill": "مهارت شناختی هدف",
            ...
        }

        **وظیفه دوم: ایجاد پیش‌آزمون هوشمند (۵ سوال)**
        ۵ سوال طراحی کن که هر کدام **دقیقاً** یک بُعد مشخص از متن را بسنجد.
        تگ‌ها (concept): "واژگان"، "مفاهیم اصلی"، "استنباط"، "ساختار"، "کاربرد".
        
        **فرمت JSON سوال:**
        باید دقیقا از این ساختار استفاده کنی. نوع سوال همیشه باید "multiple-choice" باشد.
        {
          "question": "متن سوال",
          "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
          "correctAnswerIndex": number,
          "type": "multiple-choice",
          "difficulty": "متوسط",
          "points": 20,
          "concept": "یکی از تگ‌های بالا"
        }

        **دستورالعمل خروجی (استریم):**
        1. ابتدا \`mindMap\` و \`suggestedPath\` را بین \`[MIND_MAP_START]\` و \`[MIND_MAP_END]\` بفرست.
        2. سپس سوالات را تک تک بین \`[QUESTION_START]\` و \`[QUESTION_END]\` بفرست.

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

                        const mapNode = (node: any): MindMapNode => ({
                            id: node.id,
                            title: node.title || node.label,
                            parentId: node.parentId === 'null' || node.parentId === '' ? null : node.parentId,
                            locked: false,
                            difficulty: node.difficulty || 0.5,
                            isExplanatory: node.isExplanatory || false,
                            sourcePages: node.sourcePages || [],
                            type: 'core',
                            isAdaptive: false,
                            learningObjective: node.learningObjective || "آشنایی با مفاهیم پایه",
                            targetSkill: node.targetSkill || "درک مطلب"
                        });

                        if (Array.isArray(resultJson.mindMap)) {
                            mindMap = resultJson.mindMap.map(mapNode);
                        } else if (resultJson.mindMap && Array.isArray(resultJson.mindMap.nodes)) {
                             mindMap = resultJson.mindMap.nodes.map(mapNode);
                        } else if (resultJson.mindMap && typeof resultJson.mindMap === 'object') {
                            mindMap = flattenMindMap(resultJson.mindMap);
                        } else {
                            mindMap = [];
                        }

                        if (mindMap.length > 0) {
                             const nodeIds = new Set(mindMap.map(n => n.id));
                             const roots = mindMap.filter(n => n.parentId === null || !nodeIds.has(n.parentId));
                             
                             if (roots.length === 0) {
                                 mindMap[0].parentId = null;
                                 mindMap[0].title = "مقدمه و نقشه راه";
                             }
                             
                             const conclusionNode = mindMap.find(n => n.title.includes('نتیجه‌گیری') || n.title.includes('جمع‌بندی'));
                             if (!conclusionNode) {
                                  const conclusionId = 'synthetic_conclusion_' + Math.random().toString(36).substr(2, 5);
                                  const rootNode = mindMap.find(n => n.parentId === null);
                                  mindMap.push({
                                      id: conclusionId,
                                      title: 'جمع‌بندی و نتیجه‌گیری',
                                      parentId: rootNode ? rootNode.id : mindMap[0].id,
                                      locked: true,
                                      difficulty: 0.3,
                                      isExplanatory: false,
                                      sourcePages: [],
                                      type: 'core',
                                      isAdaptive: false,
                                      learningObjective: "جمع‌بندی آموخته‌ها",
                                      targetSkill: "تلفیق و نتیجه‌گیری"
                                  });
                             }
                        }

                        let suggestedPath = resultJson.suggestedPath || [];
                         const actualRoot = mindMap.find(n => n.parentId === null);
                        if (actualRoot && !suggestedPath.includes(actualRoot.id)) {
                             suggestedPath.unshift(actualRoot.id);
                        }
                        const unlockedMindMap = mindMap.map(node => ({ ...node, locked: !!node.parentId }));
                        onMindMapGenerated(unlockedMindMap, suggestedPath);
                        mindMapGenerated = true;
                    } catch (e) {
                        console.error("Failed to parse mind map JSON:", e);
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

                        if (!question.type) {
                             if (question.options || question.choices) question.type = 'multiple-choice';
                             else question.type = 'short-answer';
                        }
                        if (question.type === 'multiple_choice') question.type = 'multiple-choice';
                        
                        if (question.type === 'multiple-choice') {
                           if (!question.options && question.choices) {
                               question.options = question.choices;
                           }
                           question.options = Array.isArray(question.options) ? question.options : [];
                           
                           if (typeof question.correctAnswerIndex !== 'number') {
                               question.correctAnswerIndex = 0;
                           }
                        }
                        
                        if (!question.concept) question.concept = "عمومی";
                        if (!question.difficulty) question.difficulty = "متوسط";
                        if (!question.points) question.points = 20;
                        if (!question.id) question.id = Math.random().toString(36).substr(2, 9);

                        questions.push(question);
                        onQuestionStream(question);
                    } catch (e) {
                        console.error("Failed to parse question:", e);
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
        overallAnalysis: { type: Type.STRING, description: "تحلیل کلی و بی‌رحمانه." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "نقاط قوت واقعی." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "نقاط ضعف واقعی." },
        recommendedLevel: { type: Type.STRING, enum: ["مبتدی", "متوسط", "پیشرفته"], description: "سطح." },
        weaknessTags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "کلمات کلیدی ضعف‌ها." },
        strengthTags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "کلمات کلیدی قوت‌ها." },
        conceptScores: { 
            type: Type.OBJECT, 
            description: "امتیاز درصد (۰ تا ۱۰۰) برای هر کانسپت (واژگان، استنباط، و...).",
            properties: {
                "واژگان": { type: Type.NUMBER },
                "مفاهیم اصلی": { type: Type.NUMBER },
                "استنباط": { type: Type.NUMBER },
                "ساختار": { type: Type.NUMBER },
                "کاربرد": { type: Type.NUMBER }
            }
        }
    },
    required: ["overallAnalysis", "strengths", "weaknesses", "recommendedLevel", "weaknessTags", "strengthTags", "conceptScores"]
};

export async function analyzePreAssessment(
    questions: QuizQuestion[], 
    userAnswers: Record<string, UserAnswer>, 
    sourceContent: string
): Promise<PreAssessmentAnalysis> {
    return withRetry(async () => {
        const prompt = `
        تو یک ممتحن سخت‌گیر و دقیق هستی. (Ruthless Examiner).
        
        وظیفه:
        پاسخ‌های کاربر به پیش‌آزمون را تحلیل کن.
        هر سوال یک تگ 'concept' دارد (مثلاً: واژگان، استنباط، ساختار).
        
        قوانین تحلیل:
        1. **امتیازدهی تفکیکی:** برای هر کانسپت (Concept) جداگانه امتیاز (۰ تا ۱۰۰) محاسبه کن.
        2. **عدم تعارف:** اگر کاربر پاسخ‌ها را غلط داده، صریحاً بگو که در آن بخش ضعف دارد.
        
        متن منبع:
        ${sourceContent.substring(0, 3000)}...

        سوالات و پاسخ‌ها:
        ${JSON.stringify({questions, userAnswers}, null, 2)}
        
        خروجی JSON مطابق اسکیما.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", responseSchema: preAssessmentAnalysisSchema }
        });
        
        const cleanText = cleanJsonString(response.text || '{}');
        return JSON.parse(cleanText);
    });
}

export async function generateAdaptiveModifications(
    currentMindMap: MindMapNode[],
    analysis: PreAssessmentAnalysis
): Promise<any[]> {
    return withRetry(async () => {
         const prompt = `
        You are the "Adaptive Engine".
        Weak Topics: ${JSON.stringify(analysis.weaknessTags)}
        Current Mind Map: ${JSON.stringify(currentMindMap.map(n => ({ id: n.id, title: n.title })))}
        
        Suggest 'ADD_NODE' or 'UNLOCK_NODE' modifications.
        Return JSON array of modifications.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        const cleanText = cleanJsonString(response.text || '[]');
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
        
        const specificInstruction = `
        عنوان درس: "${nodeTitle}"
        نقش آموزشی: معلم خصوصی.
        هدف: نه تنها انتقال دانش، بلکه **درگیر کردن فعال کاربر** (Active Learning).
        `;

        const prompt = `
        ${specificInstruction}

        ${preferenceInstructions}
        
        **قوانین فرمت خروجی (Markdown + Task):**
        1. ساختار ۵ بخشی استاندارد (INTRODUCTION, THEORY, EXAMPLE, CONNECTION, CONCLUSION).
        2. **بخش تعاملی (حیاتی):** یک وظیفه تعاملی (Interactive Task) ایجاد کن.
           - این یک سوال چندگزینه‌ای نیست.
           - یک چالش کوچک، یک سوال تفکر انتقادی، یا یک سناریوی کوتاه است که کاربر باید در یک باکس متنی پاسخ دهد.
           - هدف این تسک، سنجش واقعی یادگیری همین درس است.
           - مثال برای نود تحلیلی: "متن زیر را بخوان و بگو خطای منطقی آن کجاست؟"
           - مثال برای نود نتیجه‌گیری: "با توجه به آنچه یاد گرفتیم، در یک جمله اصلی‌ترین پیام را خلاصه کن."
        
        فرمت خروجی:
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
        ###INTERACTIVE_TASK###
        (متن چالش یا سوال باز برای کاربر)
        ###QUESTIONS###
        سوال ۱؟
        سوال ۲؟
        سوال ۳؟

        محتوای منبع (Source Content):
        ${fullContent}
        `;

        const imageParts = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
        
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
        const contentObj: NodeContent = { introduction: '', theory: '', example: '', connection: '', conclusion: '', suggestedQuestions: [], interactiveTask: '' };
        
        let lastUpdate = 0;
        const UPDATE_INTERVAL = 150; 

        for await (const chunk of stream) {
            fullText += chunk.text;
            
            const now = Date.now();
            if (now - lastUpdate < UPDATE_INTERVAL) continue;
            lastUpdate = now;

            const headers = {
                introduction: '###INTRODUCTION###',
                theory: '###THEORY###',
                example: '###EXAMPLE###',
                connection: '###CONNECTION###',
                conclusion: '###CONCLUSION###',
                interactiveTask: '###INTERACTIVE_TASK###',
                questions: '###QUESTIONS###'
            };

            for (const [key, header] of Object.entries(headers)) {
                const start = fullText.lastIndexOf(header);
                if (start !== -1) {
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
                    } else if (key === 'interactiveTask') {
                        contentObj.interactiveTask = sectionText.trim();
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
                suggestedQuestions: contentObj.suggestedQuestions,
                interactiveTask: contentObj.interactiveTask
            });
        }
        
        return {
             introduction: await marked.parse(processReminders(contentObj.introduction)),
             theory: await marked.parse(processReminders(contentObj.theory)),
             example: await marked.parse(processReminders(contentObj.example)),
             connection: await marked.parse(processReminders(contentObj.connection)),
             conclusion: await marked.parse(processReminders(contentObj.conclusion)),
             suggestedQuestions: contentObj.suggestedQuestions,
             interactiveTask: contentObj.interactiveTask
        };
    });
}

export async function evaluateNodeInteraction(
    nodeTitle: string,
    learningObjective: string,
    task: string,
    userResponse: string,
    sourceContent: string
): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        Act as a pedagogical expert.
        
        Context: The student is learning "${nodeTitle}".
        Learning Objective: "${learningObjective}".
        Task assigned: "${task}".
        
        Student's Answer: "${userResponse}".
        
        Source Content Reference: "${sourceContent.substring(0, 2000)}..."
        
        Your Goal: Provide dynamic, specific feedback.
        1. If the answer is correct and deep: Validate it and connect it to the next concept.
        2. If the answer is shallow: Ask a follow-up question to deepen understanding.
        3. If the answer is wrong: Gently correct the specific misconception (don't just say "wrong").
        
        Output: Return the response in Persian (Markdown). Keep it concise and encouraging.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
        });

        return await marked.parse(response.text || '');
    });
}

export async function generateRemedialNode(originalNodeId: string, parentTitle: string, weaknesses: Weakness[], content: string, images: any[]) {
    const prompt = `Create Remedial Node JSON for "${parentTitle}" mistakes: ${JSON.stringify(weaknesses)}.`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    const data = JSON.parse(cleanJsonString(response.text || '{}'));
    return {
        id: 'remedial_' + Math.random().toString(36).substr(2, 9),
        title: data.title || `مرور: ${parentTitle}`,
        parentId: originalNodeId, // Linked to original node as requested
        locked: false,
        difficulty: 0.3,
        isExplanatory: true,
        sourcePages: [],
        type: 'remedial' as const,
        isAdaptive: true,
        learningObjective: "رفع اشکال و یادگیری مجدد",
        targetSkill: "بازآموزی"
    };
}
export async function generateQuiz(topic: string, content: string, images: any[], onQuestionStream: any): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `Generate 3 quiz questions for "${topic}". 
        JSON format required: 
        {
          "question": "string",
          "options": ["opt1", "opt2", "opt3", "opt4"],
          "correctAnswerIndex": number,
          "type": "multiple-choice",
          "difficulty": "متوسط",
          "points": 20
        }
        Stream each question wrapped in [QUESTION_START] and [QUESTION_END].`;

        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
        });
        const questions: QuizQuestion[] = [];
        let buffer = '';
        for await (const chunk of stream) {
            buffer += chunk.text;
            let s, e;
            while ((s = buffer.indexOf('[QUESTION_START]')) !== -1 && (e = buffer.indexOf('[QUESTION_END]', s)) !== -1) {
                try {
                    const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
                    const q = JSON.parse(jsonStr);
                    
                    if(!q.id) q.id = Math.random().toString(36).substr(2,9);
                    
                    if (!q.type && (q.options || q.choices)) q.type = 'multiple-choice';
                    if (q.type === 'multiple-choice') {
                        if (!q.options && q.choices) q.options = q.choices;
                        if (!q.options) q.options = [];
                    }

                    questions.push(q);
                    onQuestionStream(q);
                } catch(err) {
                    console.error("Quiz parsing error", err);
                }
                buffer = buffer.substring(e + 14);
            }
        }
        return { questions, isStreaming: false };
    });
}

const gradingSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            questionId: { type: Type.STRING },
            isCorrect: { type: Type.BOOLEAN },
            score: { type: Type.NUMBER },
            analysis: { type: Type.STRING }
        },
        required: ["questionId", "isCorrect", "score", "analysis"]
    }
};

export async function gradeAndAnalyzeQuiz(questions: any[], userAnswers: any, content: string, images: any[]) {
    return withRetry(async () => {
        const prompt = `
        Grade this quiz.
        
        Source Content: ${content.substring(0, 2000)}.
        
        Questions and User Answers: 
        ${JSON.stringify({ questions, userAnswers })}
        
        Instructions:
        1. For each question, determine if the answer is correct.
        2. Assign a score based on correctness (points are defined in question).
        3. Provide a brief analysis/feedback in Persian.
        4. **CRITICAL**: Return an array of objects. Each object MUST represent one question and MUST use the EXACT 'id' from the input question as 'questionId'.
        
        Output JSON Format (Strict):
        [
          { "questionId": "EXACT_ID_FROM_INPUT", "isCorrect": boolean, "score": number, "analysis": "string" }
        ]
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { 
                responseMimeType: "application/json",
                responseSchema: gradingSchema
            }
        });

        return JSON.parse(cleanJsonString(response.text || '[]'));
    });
}

export async function generateFinalExam(content: string, images: any[], weaknessTopics: string, onQuestionStream: any): Promise<Quiz> {
    return generateQuiz("Final Exam", content, images, onQuestionStream);
}
export async function generateCorrectiveSummary(content: string, images: any[], incorrectItems: any[]) {
    return "Summary";
}
export async function generatePracticeResponse(topic: string, problem: string) {
    const prompt = topic ? `Practice problem for ${topic}` : `Solve ${problem}`;
    const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
    return marked.parse(r.text || '');
}

// -------------------- CHAT & DEBATE LOGIC --------------------

export async function generateProactiveChatInitiation(
    nodeTitle: string, 
    nodeContent: string, 
    isDebateMode: boolean,
    weaknesses: Weakness[]
): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        You are the "Zehn-Gah AI Tutor".
        The user just started reading the node: "${nodeTitle}".
        Content snippet: "${nodeContent ? nodeContent.substring(0, 500) : 'No content yet'}...".
        
        User Weaknesses (if any): ${JSON.stringify(weaknesses.map(w => w.question))}
        Debate Mode: ${isDebateMode ? 'ON' : 'OFF'}

        Goal: Initiate a conversation proactively.
        
        Instructions:
        1. If Debate Mode is ON: Challenge the user immediately. Pick a concept from the text and play Devil's Advocate or ask a provocative question to test their understanding. Be the "Ruthless Critic" but constructive. Reference their past weaknesses if relevant to this topic.
        2. If Debate Mode is OFF: Be the "Supportive Mentor". Offer a helpful insight or ask if they need clarity on a specific complex term in the text.
        3. Keep it short (under 40 words).
        4. Language: Persian.
        5. Output format: Just the message text.
        `;
        
        const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
        return marked.parse(r.text || '');
    });
}

export async function generateChatResponse(
    history: ChatMessage[], 
    message: string, 
    nodeTitle: string | null, 
    content: string,
    isDebateMode: boolean = false,
    weaknesses: Weakness[] = [],
    chatPersona: ChatPersona = 'supportive_coach',
    availableNodes: string[] = []
) {
    
    // --- PERSONA DEFINITIONS ---
    const personas = {
        supportive_coach: `
            Role: Supportive & Patient Coach.
            Tone: Friendly, encouraging, empathetic.
            Style: Simplify complex topics, use analogies, praise good questions.
        `,
        strict_professor: `
            Role: Strict Academic Professor.
            Tone: Formal, precise, authoritative.
            Style: Focus on accuracy, definitions, and academic rigor. Correct terminologies immediately. No fluff.
        `,
        socratic_tutor: `
            Role: Socratic Tutor.
            Tone: Curious, questioning.
            Style: NEVER give the answer directly. Guide the user by asking follow-up questions. Make them think.
        `,
        devil_advocate: `
            Role: Devil's Advocate.
            Tone: Challenging, skeptical.
            Style: Whatever the user says, present the counter-argument. Test the robustness of their logic.
        `,
        ruthless_critic: `
            Role: Ruthless Logic Critic.
            Tone: Sharp, direct, analytical.
            Style: Spot logical fallacies immediately. Demand evidence. Dismantle weak arguments.
        `
    };

    const selectedPersonaInstruction = personas[chatPersona] || personas['supportive_coach'];

    const prompt = `
    **SYSTEM INSTRUCTION: YOU ARE THE ZEHNL-GAH AI TUTOR**
    
    **Current Persona:**
    ${selectedPersonaInstruction}

    **Context:**
    - Current Topic/Node: "${nodeTitle || "General Discussion"}"
    - Source Content (Reference): ${content.substring(0, 2000)}
    - Debate Mode Active: ${isDebateMode ? "YES (Lean into the challenge aspects)" : "NO"}
    
    **Reference Linking Rule (VERY IMPORTANT):**
    If you mention another topic that exists in the "Available Nodes" list below, you MUST wrap its title in double brackets like this: [[Node Title]].
    This will create a clickable link for the user.
    
    **Available Nodes for Linking:**
    ${JSON.stringify(availableNodes)}

    **Conversation History:**
    ${history.slice(-6).map(h => `${h.role}: ${h.message}`).join('\n')}
    
    **User Input:** ${message}
    
    **Output:**
    Response in Persian (Markdown).
    `;

    const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
    
    const rawText = r.text || '';
    // Post-process to ensure links are created even if the model forgets
    const linkedText = autoLinkNodeTitles(rawText, availableNodes);
    
    return marked.parse(linkedText);
}

export async function generateDailyChallenge(weaknesses: any[], content: string) {
    const prompt = "Daily challenge.";
    const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
    return marked.parse(r.text || '');
}
export async function generateDeepAnalysis(title: string, content: string) {
    const prompt = `Deep analysis for ${title}.`;
    const r = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: { parts: [{ text: prompt }] } });
    return marked.parse(r.text || '');
}
