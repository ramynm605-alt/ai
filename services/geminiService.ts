import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, Quiz, LearningPreferences, NodeContent, QuizQuestion, UserAnswer, QuizResult } from '../types';
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
                    isExplanatory: { type: Type.BOOLEAN, description: "آیا این یک گره توضیحی اضافی است یا خیر." }
                },
                required: ["id", "title", "parentId", "difficulty", "isExplanatory"]
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
                            type: { type: Type.STRING, enum: ["multiple-choice"]},
                            question: { type: Type.STRING, description: "متن سوال." },
                            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "آرایه‌ای از گزینه‌های پاسخ." },
                            correctAnswerIndex: { type: Type.INTEGER, description: "ایندکس پاسخ صحیح در آرایه گزینه‌ها." },
                            difficulty: { type: Type.STRING, enum: ['آسان', 'متوسط', 'سخت'] },
                            points: { type: Type.INTEGER },
                        },
                        required: ["id", "type", "question", "options", "correctAnswerIndex", "difficulty", "points"]
                    }
                }
            },
            required: ["questions"]
        }
    },
    required: ["mindMap", "preAssessment"]
};

export async function generateLearningPlan(content: string, preferences: LearningPreferences): Promise<{ mindMap: MindMapNode[], preAssessment: Quiz }> {
    return withRetry(async () => {
        const customInstructions = preferences.customInstructions ? `دستورالعمل سفارشی کاربر: ${preferences.customInstructions}` : '';
        const explanatoryInstruction = preferences.addExplanatoryNodes ? "اگر در متن به مفاهیم پیش‌نیاز اشاره شده که به خوبی توضیح داده نشده‌اند، گره‌های توضیحی اضافی برای آن‌ها ایجاد کن و isExplanatory را true قرار بده." : "";

        const prompt = `بر اساس متن زیر، یک طرح درس به صورت نقشه ذهنی سلسله مراتبی ایجاد کن.
    1.  مفاهیم اصلی و فرعی را شناسایی کن. بر اساس پیچیدگی و حجم متن، یک نقشه ذهنی با تعداد کل گره‌ها بین ۲ تا ۱۱ ایجاد کن. برای متون کوتاه‌تر و ساده‌تر، تعداد گره‌ها را به ۲ یا ۳ محدود کن. برای متون پیچیده و طولانی، تعداد را به سمت ۱۱ افزایش بده. هدف ایجاد یک مسیر یادگیری جامع و در عین حال مختصر است.
    2.  برای هر گره، یک امتیاز سختی بین 0.0 (بسیار آسان) تا 1.0 (بسیار دشوار) بر اساس پیچیدگی مفهوم اختصاص بده.
    3.  ${explanatoryInstruction}
    4.  همچنین، یک پیش‌آزمون با ۵ سوال چهارگزینه‌ای برای سنجش دانش اولیه کاربر از کل متن طراحی کن. سوالات باید دارای سطوح سختی و امتیاز متفاوت باشند. گزینه‌های اشتباه باید منطقی و گمراه‌کننده باشند تا نیاز به دقت بالا داشته باشند.
    5.  خروجی باید یک شیء JSON با دو کلید mindMap و preAssessment باشد. برای هر گره در نقشه ذهنی یک id منحصر به فرد، title، parentId (برای گره ریشه null)، difficulty و isExplanatory ارائه بده.

        ${customInstructions}

        متن:
        ---
        ${content}
        ---
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: mindMapSchema,
            },
        });

        const resultText = response.text;
        const resultJson = JSON.parse(resultText);

        const mindMap = resultJson.mindMap.map((node: any) => ({
            ...node,
            parentId: node.parentId === 'null' || node.parentId === '' ? null : node.parentId
        }));

        return { mindMap, preAssessment: resultJson.preAssessment };
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

export async function generateNodeContent(nodeTitle: string, fullContent: string, style: LearningPreferences['style']): Promise<NodeContent> {
    return withRetry(async () => {
        const styleInstruction = {
            faithful: "توضیحات باید کاملاً وفادار به متن اصلی و بدون اطلاعات اضافی باشد.",
            balanced: "توضیحات باید بر اساس متن اصلی باشد اما برای وضوح بیشتر می‌تواند کمی گسترش یابد.",
            creative: "توضیحات می‌تواند خلاقانه، با مثال‌های جدید و گسترده‌تر از متن اصلی باشد تا درک عمیق‌تری ایجاد کند."
        };

        const prompt = `مفهوم "${nodeTitle}" را بر اساس متن کامل ارائه شده، توضیح بده. ساختار توضیحات باید شامل پنج بخش باشد: مقدمه، تئوری، مثال، ارتباط (با مفاهیم دیگر) و نتیجه‌گیری. سبک توضیحات باید '${style}' باشد. ${styleInstruction[style]}.

        مهم: در هر بخش، کلمات و عبارات کلیدی را با استفاده از Markdown به صورت **پررنگ** مشخص کن و مهم‌ترین جمله (فقط یک جمله) را با استفاده از Markdown به صورت *ایتالیک* مشخص کن.

        متن کامل برای مرجع:
        ---
        ${fullContent}
        ---
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
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
            type: { type: Type.STRING, enum: ["multiple-choice", "short-answer", "matching"] },
            question: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['آسان', 'متوسط', 'سخت'] },
            points: { type: Type.INTEGER },
            // Multiple-choice specific
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswerIndex: { type: Type.INTEGER },
            // Short-answer specific
            correctAnswer: { type: Type.STRING },
            // Matching specific
            stems: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING } } } },
            options_matching: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING } } } }, // Renamed to avoid conflict
            correctPairs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stemId: { type: Type.STRING }, optionId: { type: Type.STRING } } } },
        },
        required: ["id", "type", "question", "difficulty", "points"]
      }
    }
  },
  required: ["questions"]
};

export async function generateQuiz(nodeTitle: string, fullContent: string): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `برای سنجش تسلط بر مفهوم "${nodeTitle}"، یک آزمون متنوع با تعداد سوالات بین ۳ تا ۷ عدد طراحی کن. تعداد سوالات را بر اساس حجم و پیچیدگی مفهوم انتخاب کن. سوالات باید شامل ترکیبی از انواع 'multiple-choice', 'short-answer', و 'matching' باشند.
        
        برای هر سوال موارد زیر را مشخص کن:
        -   یک id منحصر به فرد
        -   نوع سوال (type)
        -   متن سوال (question)
        -   درجه سختی (difficulty: 'آسان', 'متوسط', 'سخت')
        -   امتیاز (points: آسان=5, متوسط=10, سخت=15)

        برای سوالات 'multiple-choice'، گزینه‌های اشتباه باید بسیار شبیه به پاسخ صحیح و قابل قبول به نظر برسند تا کاربر را به چالش بکشند و نیاز به دقت بالا داشته باشند.
        سوالات باید مستقیماً از محتوای ارائه شده استخراج شوند. برای سوالات matching، کلید options را به options_matching تغییر نام بده تا با سوالات multiple-choice تداخل نداشته باشد.

        محتوای مرجع:
        ---
        ${fullContent}
        ---
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
            }
        });

        const parsed = JSON.parse(response.text);
        // Remap options_matching to options for matching questions
        parsed.questions.forEach((q: any) => {
            if(q.type === 'matching') {
                q.options = q.options_matching;
                delete q.options_matching;
            }
        });

        return parsed;
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

export async function gradeAndAnalyzeQuiz(questions: QuizQuestion[], userAnswers: Record<string, UserAnswer>, sourceContent: string): Promise<(Omit<QuizResult, 'question' | 'userAnswer'> & { questionId: string })[]> {
    return withRetry(async () => {
        const prompt = `
        شما یک دستیار معلم متخصص هستید. وظیفه شما تصحیح آزمون زیر و ارائه تحلیل دقیق برای هر سوال است.

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
        1.  برای هر سوال، پاسخ کاربر را با پاسخ صحیح مقایسه کن.
        2.  برای سوالات تشریحی (short-answer)، پاسخ کاربر را بر اساس محتوای درس و مفهوم پاسخ صحیح، ارزیابی کن. پاسخ‌های نزدیک به مفهوم را صحیح در نظر بگیر.
        3.  برای هر سوال، یک تحلیل (analysis) کوتاه بنویس:
            -   اگر پاسخ صحیح بود، کاربر را تشویق کن و نکته کلیدی سوال را یادآوری کن.
            -   اگر پاسخ غلط بود، به طور واضح توضیح بده که چرا پاسخ صحیح، درست است و چرا پاسخ کاربر اشتباه بوده است.
        4.  امتیاز (score) کسب شده برای هر سوال را مشخص کن (اگر صحیح بود، امتیاز کامل سوال، در غیر این صورت صفر).
        5.  خروجی باید فقط یک آبجکت JSON مطابق با اسکیمای ارائه شده باشد.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: gradingSchema
            }
        });
        const parsedResult = JSON.parse(response.text);
        return parsedResult.results;
    });
}


export async function generateFinalExam(fullContent: string, weaknessTopics: string): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `بر اساس کل متن زیر، یک آزمون جامع نهایی با ۱۰ سوال متنوع (multiple-choice, short-answer) ایجاد کن. در طراحی سوالات، تمرکز ویژه‌ای بر روی این موضوعات که کاربر در آنها ضعف داشته، داشته باش: ${weaknessTopics}. برای هر سوال سختی و امتیاز تعریف کن.

        متن کامل:
        ---
        ${fullContent}
        ---
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
            }
        });
        const parsed = JSON.parse(response.text);
        // Remap options_matching to options for matching questions if any
        parsed.questions.forEach((q: any) => {
            if(q.type === 'matching') {
                q.options = q.options_matching;
                delete q.options_matching;
            }
        });
        return parsed;
    });
}

export async function generateCorrectiveSummary(fullContent: string, incorrectAnswers: { question: string, correctAnswer: string }[]): Promise<string> {
    return withRetry(async () => {
        const summaryPrompt = `
        بر اساس متن کامل زیر و لیستی از سوالاتی که کاربر به اشتباه پاسخ داده است، یک "خلاصه اصلاحی" شخصی‌سازی شده به زبان Markdown ایجاد کن. برای هر مفهوم اشتباه پاسخ داده شده، یک توضیح واضح و مختصر ارائه بده.

        متن کامل:
        ---
        ${fullContent}
        ---

        سوالات اشتباه پاسخ داده شده و پاسخ صحیح آنها:
        ${incorrectAnswers.map(item => `- سوال: ${item.question}\n  - پاسخ صحیح: ${item.correctAnswer}`).join('\n')}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: summaryPrompt
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