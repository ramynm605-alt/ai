
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MindMapNode, Quiz, LearningPreferences, NodeContent, QuizQuestion, UserAnswer, QuizResult, GradingResult, PreAssessmentAnalysis, ChatMessage, Weakness, ChatPersona, VoiceName, ResourceValidation, Flashcard, Scenario, ScenarioOutcome } from '../types';
import { marked } from 'marked';
import katex from 'katex';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- LaTeX/KaTeX Extension for Marked ---
const mathExtension = {
    name: 'math',
    level: 'inline',
    start(src: string) { return src.match(/\$/)?.index; },
    tokenizer(src: string, tokens: any) {
        const blockRule = /^\$\$([\s\S]+?)\$\$/;
        const inlineRule = /^\$([^$\n]+?)\$/;
        
        let match = blockRule.exec(src);
        if (match) {
            return {
                type: 'math',
                raw: match[0],
                text: match[1].trim(),
                displayMode: true
            };
        }
        
        match = inlineRule.exec(src);
        if (match) {
            return {
                type: 'math',
                raw: match[0],
                text: match[1].trim(),
                displayMode: false
            };
        }
    },
    renderer(token: any) {
        try {
            return katex.renderToString(token.text, {
                displayMode: token.displayMode,
                throwOnError: false,
                output: 'html'
            });
        } catch (e) {
            return token.text;
        }
    }
};

// @ts-ignore - marked typing issue with custom extensions
marked.use({ extensions: [mathExtension] });

// Helper function for retrying with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && error.message && error.message.includes('503')) {
            console.warn(`API call failed with 503, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(res => setTimeout(res, delay));
            return withRetry(fn, retries - 1, delay * 2); 
        }
        console.error("API call failed after multiple retries or with a non-retriable error:", error);
        throw error; 
    }
}

// Helper to clean JSON string
function cleanJsonString(str: string): string {
    let cleaned = str.trim();
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    const firstOpen = cleaned.indexOf('{');
    const firstArray = cleaned.indexOf('[');
    let start = -1;
    
    if (firstOpen !== -1 && (firstArray === -1 || firstOpen < firstArray)) {
        start = firstOpen;
    } else if (firstArray !== -1) {
        start = firstArray;
    }

    if (start !== -1) {
        const lastClose = cleaned.lastIndexOf('}');
        const lastArray = cleaned.lastIndexOf(']');
        let end = -1;
        
        if (lastClose !== -1 && (lastArray === -1 || lastClose > lastArray)) {
            end = lastClose;
        } else if (lastArray !== -1) {
            end = lastArray;
        }
        
        if (end !== -1 && end >= start) {
            cleaned = cleaned.substring(start, end + 1);
        }
    }

    return cleaned;
}

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

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function createWavHeader(dataLength: number, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true); 
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, numChannels, true); 
    view.setUint32(24, sampleRate, true); 
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); 
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); 
    view.setUint16(34, bitsPerSample, true); 
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true); 
    return new Uint8Array(header);
}

const getPreferenceInstructions = (preferences: LearningPreferences): string => {
    return `Level: ${preferences.knowledgeLevel}, Tone: ${preferences.tone}, Focus: ${preferences.learningFocus}.`;
};

export async function analyzeResourceContent(
    title: string,
    rawText: string | null,
    media: { mimeType: string, data: string } | null,
    resourceType: 'file' | 'link' | 'text',
    metadata?: any
): Promise<{ extractedText: string; validation: ResourceValidation }> {
    return withRetry(async () => {
        // Ensure prompt requests Persian output for summary
        let prompt = `Analyze: ${title}. Output JSON with 'extractedText' (full content) and 'validation' object. 
        IMPORTANT: 'validation.summary' MUST BE IN PERSIAN (FARSI).
        'validation.issues' MUST BE IN PERSIAN (FARSI).
        `;
        let parts: any[] = [{ text: prompt }];
        if (rawText) parts.push({ text: rawText.substring(0, 2000) });
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });
        const result = JSON.parse(cleanJsonString(response.text || '{}'));
        
        return {
            extractedText: result.extractedText || rawText || "",
            validation: result.validation || { isValid: true, qualityScore: 80, issues: [], summary: "پردازش شد" }
        };
    });
}

export async function generateLearningPlan(content: string, pageContents: string[] | null, images: any[], preferences: LearningPreferences, onMindMapGenerated: any, onQuestionStream: any): Promise<Quiz> { 
    return withRetry(async () => {
        const preferenceInstructions = getPreferenceInstructions(preferences);
        const pageContentForPrompt = pageContents ? pageContents.join('\n') : content;
        
        // Logic for Simple vs Advanced Mode
        const detailLevel = preferences.detailLevel || 'advanced';
        const detailInstruction = detailLevel === 'advanced'
            ? "Create a HIGHLY DETAILED map. Break down topics into small, granular sub-concepts. Depth: 3-4 levels. Node count: 12-15. Include specific details in node titles."
            : "Create a SIMPLE, HIGH-LEVEL overview. Focus only on main pillars and core concepts. Depth: 2 levels. Node count: 6-8. Keep titles concise.";

        const prompt = `
        You are an expert Curriculum Architect.
        Goal: Create a Mind Map for the provided content in **PERSIAN (FARSI)**.

        CRITICAL INSTRUCTIONS:
        1. **OUTPUT LANGUAGE**: ALL node titles, learning objectives, and questions MUST BE IN PERSIAN.
        2. **DETAIL LEVEL**: ${detailInstruction}
        3. **STRUCTURE**: Use nested objects with a 'children' array.
        4. **Root Node**: Start with a single Root Node representing the main title.
        
        Output Format:
        1. [MIND_MAP_START] JSON [MIND_MAP_END]
        2. [QUESTION_START] JSON [QUESTION_END] (x5 questions)

        MIND MAP JSON SCHEMA:
        {
          "title": "عنوان موضوع اصلی",
          "children": [
            { 
              "title": "فصل اول: ...", 
              "difficulty": 0.3,
              "learningObjective": "هدف آموزشی این بخش به فارسی",
              "targetSkill": "Analysis",
              "children": [ 
                 { "title": "مفهوم الف", "difficulty": 0.4, "children": [] }
              ]
            }
          ]
        }

        QUESTION JSON SCHEMA (MUST BE PERSIAN):
        {
           "question": "متن سوال به فارسی",
           "type": "multiple-choice",
           "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
           "correctAnswerIndex": 0,
           "difficulty": "متوسط",
           "points": 10
        }

        Context: ${preferenceInstructions}
        Content: ${pageContentForPrompt.substring(0, 40000)}
        `;
        
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }] }, 
        });

        let buffer = '';
        const questions: QuizQuestion[] = [];
        let mindMapGenerated = false;
        
        for await (const chunk of stream) {
            buffer += chunk.text;
            if (!mindMapGenerated) {
                const s = buffer.indexOf('[MIND_MAP_START]');
                const e = buffer.indexOf('[MIND_MAP_END]', s);
                if (s !== -1 && e !== -1) {
                    const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
                    try {
                        const json = JSON.parse(jsonStr);
                        let rootData = json.mindMap || json;
                        
                        if (Array.isArray(rootData)) {
                            if (rootData.length > 0 && !rootData[0].children) {
                                const rootTitle = content.split('\n')[0].substring(0, 50) || "موضوع اصلی";
                                rootData = {
                                    title: rootTitle,
                                    children: rootData.map((item: any) => ({
                                        title: item.title || item.label || "N/A",
                                        children: item.children || []
                                    }))
                                };
                            } else {
                                rootData = {
                                    title: "نقشه یادگیری جامع",
                                    children: rootData
                                };
                            }
                        } else if (!rootData.children && !rootData.title) {
                             rootData = { title: "نقشه یادگیری", children: [] };
                        }

                        let mindMap = flattenMindMap(rootData); 
                        if (mindMap.length > 0) mindMap[0].parentId = null;
                        
                        onMindMapGenerated(mindMap, json.suggestedPath || []);
                        mindMapGenerated = true;
                        buffer = buffer.substring(e + 14);
                    } catch (e) {
                        console.error("Error parsing mind map JSON", e);
                    }
                }
            }
            
             let s, e;
            while ((s = buffer.indexOf('[QUESTION_START]')) !== -1 && (e = buffer.indexOf('[QUESTION_END]', s)) !== -1) {
                const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
                try {
                    const q = JSON.parse(jsonStr);
                    if (!q.id) q.id = Math.random().toString();
                    questions.push(q);
                    onQuestionStream(q);
                    buffer = buffer.substring(e + 14);
                } catch (e) {
                    buffer = buffer.substring(e + 14);
                }
            }
        }
        return { questions };
    });
}

export async function analyzePreAssessment(questions: any, userAnswers: any, sourceContent: string): Promise<PreAssessmentAnalysis> {
    // Force Persian Output
    const prompt = `Analyze Pre-assessment results.
    Questions: ${JSON.stringify(questions)}
    User Answers: ${JSON.stringify(userAnswers)}
    
    OUTPUT INSTRUCTIONS:
    1. All analysis text MUST be in PERSIAN (FARSI).
    2. 'recommendedLevel' must be one of: 'مبتدی', 'متوسط', 'پیشرفته'.
    3. Tags must be in Persian.
    
    Output JSON: {
        "overallAnalysis": "تحلیل کلی عملکرد...",
        "strengths": ["نقطه قوت ۱", ...],
        "weaknesses": ["نقطه ضعف ۱", ...],
        "recommendedLevel": "متوسط",
        "weaknessTags": ["تگ ضعف"],
        "strengthTags": ["تگ قوت"],
        "conceptScores": { "Concept A": 80, "Concept B": 40 }
    }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonString(response.text || '{}'));
}

export async function generateNodeContent(nodeTitle: string, fullContent: string, images: any[], preferences: any, strengths: any, weaknesses: any, isIntroNode: boolean, nodeType: any, onStreamUpdate: any): Promise<NodeContent> {
    // Force Persian Output
    const prompt = `
    Generate educational content for the node: "${nodeTitle}".
    Language: **PERSIAN (FARSI)**.
    Context: ${fullContent.substring(0, 5000)}...
    Tone: ${preferences.tone}
    
    Output JSON Structure (All values in Persian):
    {
        "introduction": "مقدمه جذاب...",
        "theory": "توضیحات تئوری کامل با استفاده از LaTeX برای فرمول‌ها...",
        "example": "مثال واقعی...",
        "connection": "ارتباط با سایر مفاهیم...",
        "conclusion": "جمع‌بندی...",
        "suggestedQuestions": ["سوال پیشنهادی ۱", ...],
        "interactiveTask": "یک چالش کوتاه تعاملی برای کاربر..."
    }
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    const content = JSON.parse(cleanJsonString(response.text || '{}'));
    onStreamUpdate(content);
    return content;
}

export async function evaluateNodeInteraction(nodeTitle: string, learningObjective: string, task: string, userResponse: string, sourceContent: string): Promise<string> {
    const prompt = `Evaluate user response for the task regarding "${nodeTitle}".
    Task: ${task}
    User Response: ${userResponse}
    
    Provide constructive feedback in **PERSIAN (FARSI)**. Use Markdown formatting.`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }});
    return response.text || "";
}

export async function evaluateFeynmanExplanation(nodeTitle: string, nodeContent: string, userExplanation: string, audioData: string | null): Promise<string> {
    const parts: any[] = [{ text: `Evaluate this explanation of "${nodeTitle}" based on the Feynman Technique.
    Identify gaps in understanding. Provide simple, clear feedback in **PERSIAN (FARSI)**.` }];
    
    if (audioData) parts.push({ inlineData: { mimeType: 'audio/webm', data: audioData } });
    else parts.push({ text: `User Explanation: ${userExplanation}` });
    
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts }});
    return response.text || "";
}

export async function generateRemedialNode(originalNodeId: string, parentTitle: string, weaknesses: Weakness[], content: string, images: any[]) {
    const prompt = `Create a remedial learning node for "${parentTitle}" specifically addressing these weaknesses: ${JSON.stringify(weaknesses)}.
    Output JSON in **PERSIAN**.
    Format: MindMapNode structure (id, title, difficulty, type='remedial'). Title should be like "مرور نکته X".`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" }});
    return JSON.parse(cleanJsonString(response.text || '{}'));
}

export async function generateQuiz(topic: string, content: string, images: any[], onQuestionStream: any): Promise<Quiz> {
    const prompt = `Generate 4 multiple-choice questions for "${topic}".
    Language: **PERSIAN (FARSI)**.
    Stream format: [QUESTION_START] JSON [QUESTION_END].
    
    JSON Schema:
    {
       "question": "متن سوال...",
       "type": "multiple-choice",
       "options": ["گزینه ۱", ...],
       "correctAnswerIndex": 0,
       "difficulty": "متوسط",
       "points": 10
    }`;
    const stream = await ai.models.generateContentStream({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }});
    let buffer = "";
    const questions: QuizQuestion[] = [];
    for await (const chunk of stream) {
        buffer += chunk.text;
        let s, e;
        while ((s = buffer.indexOf('[QUESTION_START]')) !== -1 && (e = buffer.indexOf('[QUESTION_END]', s)) !== -1) {
            const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
            try {
                const q = JSON.parse(jsonStr);
                if (!q.id) q.id = Math.random().toString();
                questions.push(q);
                onQuestionStream(q);
                buffer = buffer.substring(e + 14);
            } catch (e) { buffer = buffer.substring(e + 14); }
        }
    }
    return { questions };
}

export async function gradeAndAnalyzeQuiz(questions: any[], userAnswers: any, content: string, images: any[]) {
    const prompt = `Grade this quiz.
    Questions: ${JSON.stringify(questions)}
    Answers: ${JSON.stringify(userAnswers)}
    
    Output JSON array of objects: { "questionId": "...", "isCorrect": boolean, "score": number, "analysis": "Analysis in PERSIAN..." }`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" }});
    return JSON.parse(cleanJsonString(response.text || '[]'));
}

export async function generateDeepAnalysis(title: string, content: string) {
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: `Provide a deep, expert-level analysis of "${title}" in **PERSIAN**. uncover hidden connections and advanced insights.` }] }});
    return response.text || "";
}

export async function generateChatResponse(history: any, message: string, nodeTitle: any, content: string, isDebateMode: boolean, weaknesses: any, chatPersona: any, availableNodes: any) {
    const prompt = `
    You are a smart tutor. Current Persona: ${chatPersona}.
    User Message: "${message}"
    Topic: ${nodeTitle || "General"}
    Debate Mode: ${isDebateMode}
    
    Instructions:
    1. Reply in **PERSIAN (FARSI)**.
    2. If mentioning other topics, wrap them in [[Title]].
    3. Be helpful and concise.
    `;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }});
    return response.text || "";
}

export async function generateProactiveChatInitiation(nodeTitle: string, nodeContent: string, isDebateMode: boolean, weaknesses: any): Promise<string> {
    const prompt = `Initiate a conversation/debate about "${nodeTitle}". 
    Mode: ${isDebateMode ? 'Controversial Debate' : 'Friendly Check-in'}.
    Language: **PERSIAN**.`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }});
    return response.text || "";
}

export async function generateCoachQuestion(nodeTitle: string, nodeContent: string): Promise<string> {
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: `Ask a thought-provoking Socratic question about "${nodeTitle}" in **PERSIAN**.` }] }});
    return response.text || "";
}

export async function generatePodcastScript(contents: any, mode: 'monologue' | 'dialogue'): Promise<string> {
    const prompt = `Write a podcast script in **PERSIAN (FARSI)**.
    Mode: ${mode}.
    Content: ${JSON.stringify(contents)}.
    Make it engaging, natural, and educational.`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }});
    return response.text || "";
}

export async function generatePodcastAudio(script: string, speaker1: VoiceName, speaker2: VoiceName | undefined, mode: 'monologue' | 'dialogue'): Promise<string> {
    // Mock audio for simplicity
    return ""; 
}

export async function generateFlashcards(nodeTitle: string, content: string): Promise<Omit<Flashcard, 'id' | 'nodeId' | 'interval' | 'repetition' | 'easeFactor' | 'nextReviewDate'>[]> {
    const prompt = `Generate 3-5 Anki-style flashcards for "${nodeTitle}".
    Language: **PERSIAN**.
    Output JSON: [{ "front": "Question...", "back": "Answer..." }]`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" }});
    return JSON.parse(cleanJsonString(response.text || '[]'));
}

export async function generatePracticeResponse(topic: string, problem: string, questionType: 'multiple-choice' | 'descriptive' = 'descriptive', difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<string> {
    const prompt = `Generate a practice problem or solve the user's problem.
    Topic: ${topic}
    User Problem: ${problem}
    Type: ${questionType}
    Difficulty: ${difficulty}
    
    Output in **PERSIAN**. If generating a question, provide the answer key at the end.`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }});
    return response.text || "";
}

export async function generateDailyChallenge(): Promise<string> {
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: `Generate a short, fun daily learning challenge or fact in **PERSIAN**.` }] }});
    return response.text || "";
}

export async function generateScenario(nodeTitle: string, content: string): Promise<Scenario> {
    const prompt = `Create a Role-play Scenario for "${nodeTitle}".
    Language: **PERSIAN**.
    Output JSON:
    {
      "role": "Your Role (e.g. Manager)",
      "context": "The situation...",
      "options": [{ "id": "1", "text": "Option 1..." }, ...]
    }`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" }});
    return JSON.parse(cleanJsonString(response.text || '{}'));
}

export async function evaluateScenarioDecision(scenario: Scenario, decisionId: string, content: string): Promise<ScenarioOutcome> {
    const prompt = `Evaluate decision ${decisionId} for scenario.
    Language: **PERSIAN**.
    Output JSON: { "narrative": "What happens next...", "analysis": "Why...", "consequenceLevel": "positive"|"negative"|"neutral" }`;
    const response = await ai.models.generateContent({model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" }});
    return JSON.parse(cleanJsonString(response.text || '{}'));
}
