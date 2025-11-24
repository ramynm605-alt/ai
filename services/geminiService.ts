
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
// Handles $...$ for inline math and $$...$$ for block math
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

// Helper to clean JSON string from markdown code blocks and other noise
function cleanJsonString(str: string): string {
    let cleaned = str.trim();
    
    // Generic markdown block removal
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');

    // Remove any trailing commas before closing braces (common AI error)
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    // Robust Extraction: Find the first '{' or '[' and the last '}' or ']'
    const firstOpen = cleaned.indexOf('{');
    const firstArray = cleaned.indexOf('[');
    let start = -1;
    
    // Determine start index (whichever comes first and exists)
    if (firstOpen !== -1 && (firstArray === -1 || firstOpen < firstArray)) {
        start = firstOpen;
    } else if (firstArray !== -1) {
        start = firstArray;
    }

    if (start !== -1) {
        const lastClose = cleaned.lastIndexOf('}');
        const lastArray = cleaned.lastIndexOf(']');
        let end = -1;
        
        // Determine end index (whichever comes last and exists)
        if (lastClose !== -1 && (lastArray === -1 || lastClose > lastArray)) {
            end = lastClose;
        } else if (lastArray !== -1) {
            end = lastArray;
        }
        
        // Extract the JSON substring if valid start/end found
        if (end !== -1 && end >= start) {
            cleaned = cleaned.substring(start, end + 1);
        }
    }

    return cleaned;
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

// Audio Helper Functions
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

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true); // ChunkSize
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true); // Subchunk2Size

    return new Uint8Array(header);
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
            conversational: 'دوستانه و محاوره‌ای',
            concise: 'بسیار خلاصه، تیتروار و مینیمال (Direct & Concise)',
            explanatory: 'بسیار پرجزئیات، تشریحی و با مثال‌های فراوان (Highly Explanatory)',
            strict: 'سخت‌گیرانه، دستوری و متمرکز بر دقت علمی (Strict & Demanding)'
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

// ... (analyzeResourceContent, generateLearningPlan, etc. remain unchanged) ...
export async function analyzeResourceContent(
    title: string,
    rawText: string | null,
    media: { mimeType: string, data: string } | null,
    resourceType: 'file' | 'link' | 'text',
    metadata?: any
): Promise<{ extractedText: string; validation: ResourceValidation }> {
    return withRetry(async () => {
        let prompt = "";
        let parts: any[] = [];
        let config: any = { responseMimeType: "application/json" };
        const isMedia = !!media;
        const isTopicResearch = metadata?.isTopic;

        const jsonFormatInstruction = `
        IMPORTANT: Output valid JSON inside a code block.
        - Ensure all double quotes inside string values are properly escaped (\\").
        - Ensure newlines in text are escaped as \\n.
        - Do NOT break the JSON structure.
        - Use LaTeX ($...$ or $$...$$) for mathematical expressions.
        `;

        if (isTopicResearch) {
             config = {
                 tools: [{ googleSearch: {} }]
             };
             const depth = metadata?.depth || 'general';
             const length = metadata?.length || 'standard';
             let lengthPrompt = "approx 800-1200 words";
             if (length === 'brief') lengthPrompt = "approx 400-600 words, concise overview";
             if (length === 'comprehensive') lengthPrompt = "approx 2000-3000 words, extremely detailed and exhaustive";
             let depthPrompt = "Focus on: Definition, History, Core Concepts.";
             if (depth === 'deep') depthPrompt = "Focus on: Advanced Concepts, Critical Analysis, Contradicting Theories, and In-depth Case Studies.";

             prompt = `
             You are a Comprehensive Research Assistant for an educational platform.
             The user wants to study the topic: "${title.replace('موضوع: ', '')}".
             
             Research Settings:
             - Depth: ${depth} (${depthPrompt})
             - Length: ${length} (${lengthPrompt})
             
             Tasks:
             1. Use Google Search to find high-quality, accurate information matching these settings.
             2. "extractedText": Compile a well-structured educational article in Persian based on your research.
                - Organize it with clear headings (Introduction, Main Concepts, Examples, Conclusion).
                - Ensure the content length matches the request: ${lengthPrompt}.
                - Ensure the depth matches the request: ${depthPrompt}.
                - Use LaTeX ($...$) for all mathematical notation.
             3. "validation": Assess the research quality.
             
             ${jsonFormatInstruction}
             
             Example JSON:
             \`\`\`json
             {
                "isValid": boolean,
                "qualityScore": number (0-100),
                "issues": string[],
                "summary": "Short summary of what was found.",
                "extractedText": "The FULL RESEARCHED ARTICLE content in Persian (Markdown + LaTeX)..."
             }
             \`\`\`
             `;
             parts = [{ text: prompt }];

        } else if (resourceType === 'link') {
             config = {
                 tools: [{ googleSearch: {} }]
             };
             prompt = `
             You are a Resource Validator for an education app.
             The user provided a link: "${title}".
             Tasks:
             1. Use Google Search to find the comprehensive content of this page or video.
             2. "extractedText": Compile a detailed educational text. Use LaTeX format ($...$) for math.
             3. "validation": Assess quality.
             ${jsonFormatInstruction}
             Output JSON: { "isValid": boolean, "qualityScore": number, "issues": string[], "summary": string, "extractedText": string }
             `;
             parts = [{ text: prompt }];
        } else if (isMedia) {
            prompt = `
            You are a Resource Validator. Analyze the attached media (${media?.mimeType}).
            Tasks:
            1. Transcribe the text (if image) or audio (if audio file). 
            2. Assess the quality.
            3. Convert any mathematical expressions found into LaTeX format ($...$).
            ${jsonFormatInstruction}
            Output JSON: { "isValid": boolean, "qualityScore": number, "issues": string[], "summary": string, "extractedText": string }
            `;
            parts = [
                { text: prompt },
                { inlineData: { mimeType: media!.mimeType, data: media!.data } }
            ];
        } else {
             prompt = `
             You are a Resource Validator. Analyze the following text.
             Tasks:
             1. Check for gibberish.
             2. Clean up the text. Ensure mathematical formulas are properly formatted in LaTeX ($...$).
             ${jsonFormatInstruction}
             Text: ${rawText ? rawText.substring(0, 5000) : "No text"}...
             Output JSON: { "isValid": boolean, "qualityScore": number, "issues": string[], "summary": string, "extractedText": string }
             `;
             parts = [{ text: prompt }];
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: config
        });

        let textToParse = response.text || '{}';
        textToParse = cleanJsonString(textToParse);

        let result;
        try {
            const sanitized = textToParse.replace(/[\u0000-\u001F]+/g, (match) => (match === '\n' || match === '\r' || match === '\t') ? match : '');
            result = JSON.parse(sanitized);
        } catch (e) {
            let extractedContent = textToParse;
            const contentMatch = textToParse.match(/"extractedText"\s*:\s*"([\s\S]*)"\s*}/);
            if (contentMatch && contentMatch[1]) {
                extractedContent = contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
            } 
            result = { isValid: true, qualityScore: 60, issues: ["Recovered"], summary: "Parsed with fallback", extractedText: extractedContent };
        }
        
        if (rawText && (!result.extractedText || result.extractedText.length < rawText.length / 2)) {
             result.extractedText = rawText;
        }

        return {
            extractedText: result.extractedText || rawText || "",
            validation: {
                isValid: result.isValid ?? true,
                qualityScore: result.qualityScore ?? 80,
                issues: result.issues || [],
                summary: result.summary || "بدون توضیحات"
            }
        };
    });
}

export async function generateLearningPlan(content: string, pageContents: string[] | null, images: any[], preferences: LearningPreferences, onMindMapGenerated: any, onQuestionStream: any): Promise<Quiz> { 
    return withRetry(async () => {
        const preferenceInstructions = getPreferenceInstructions(preferences);
        const isMultiSource = content.includes("[[Resource");
        const isTopicMode = !isMultiSource && content.length < 500 && !pageContents && images.length === 0;
        let contextInstruction = isTopicMode ? "Topic Mode" : "Semantic Extraction";
        const pageContentForPrompt = pageContents ? pageContents.join('\n') : content;
        
        const prompt = `
        Create Mind Map and Pre-Assessment.
        ${contextInstruction}
        ${preferenceInstructions}
        
        Format:
        1. [MIND_MAP_START] JSON [MIND_MAP_END]
        2. [QUESTION_START] JSON [QUESTION_END] (x5)

        CRITICAL: DO NOT put markdown ticks (\`\`\`json) INSIDE the tags. Just the raw JSON string.

        Question JSON Schema (Strict):
        For 'multiple-choice': { "type": "multiple-choice", "question": "...", "options": ["A","B","C","D"], "correctAnswerIndex": 0, "difficulty": "متوسط", "points": 10 }
        
        Content: ${pageContentForPrompt.substring(0, 30000)}
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
                        let mindMap = flattenMindMap(json.mindMap || json); 
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
                    console.error("Error parsing question JSON", e);
                    buffer = buffer.substring(e + 14);
                }
            }
        }
        return { questions };
    });
}

export async function analyzePreAssessment(questions: any, userAnswers: any, sourceContent: string): Promise<PreAssessmentAnalysis> {
    return withRetry(async () => {
        const prompt = `
        Analyze the user's pre-assessment results.
        
        Questions: ${JSON.stringify(questions)}
        User Answers: ${JSON.stringify(userAnswers)}
        
        Output JSON:
        {
            "overallAnalysis": "...",
            "strengths": ["concept1", ...],
            "weaknesses": ["concept2", ...],
            "recommendedLevel": "beginner" | "intermediate" | "expert",
            "weaknessTags": ["tag1", "tag2"],
            "strengthTags": ["tag3", "tag4"],
            "conceptScores": { "concept1": 80, "concept2": 40 }
        }
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        return JSON.parse(cleanJsonString(response.text || '{}'));
    });
}

export async function generateNodeContent(nodeTitle: string, fullContent: string, images: any[], preferences: any, strengths: any, weaknesses: any, isIntroNode: boolean, nodeType: any, onStreamUpdate: any): Promise<NodeContent> {
    return withRetry(async () => {
        const prompt = `
        Generate detailed educational content for the node: "${nodeTitle}".
        Context: ${fullContent.substring(0, 20000)}
        
        IMPORTANT: Use LaTeX format for all mathematical formulas.
        - Inline: $E=mc^2$
        - Block: $$ \int_{a}^{b} x^2 dx $$
        
        Format (JSON):
        {
            "introduction": "Markdown...",
            "theory": "Markdown with LaTeX...",
            "example": "Markdown...",
            "connection": "Markdown...",
            "conclusion": "Markdown...",
            "suggestedQuestions": ["q1", "q2"],
            "interactiveTask": "A prompt for the user to do something..."
        }
        `;

        const response = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts: [{ text: prompt }] }
        });

        let fullText = "";
        for await (const chunk of response) {
            fullText += chunk.text;
        }
        
        const jsonStr = cleanJsonString(fullText);
        let content;
        try {
            content = JSON.parse(jsonStr);
            const parseMarkdown = async (text: string) => {
                if (!text) return "";
                try {
                    return await marked.parse(text);
                } catch(e) {
                    return text;
                }
            };

            content.introduction = await parseMarkdown(content.introduction);
            content.theory = await parseMarkdown(content.theory);
            content.example = await parseMarkdown(content.example);
            content.connection = await parseMarkdown(content.conclusion);
            content.conclusion = await parseMarkdown(content.conclusion);
            
        } catch(e) {
            const htmlText = await marked.parse(fullText) as string;
            content = {
                introduction: htmlText,
                theory: "",
                example: "",
                connection: "",
                conclusion: "",
                suggestedQuestions: []
            };
        }
        
        onStreamUpdate(content);
        return content;
    });
}

export async function evaluateNodeInteraction(nodeTitle: string, learningObjective: string, task: string, userResponse: string, sourceContent: string): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        Evaluate user response for task: "${task}" in node "${nodeTitle}".
        User Response: "${userResponse}"
        
        Provide helpful feedback in Persian using Markdown.
        Use LaTeX ($...$) for math.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] }
        });
        
        const text = response.text || "Feedback unavailable.";
        return await marked.parse(text) as string;
    });
}

export async function evaluateFeynmanExplanation(nodeTitle: string, nodeContent: string, userExplanation: string, audioData: string | null): Promise<string> {
    return withRetry(async () => {
        const parts: any[] = [
            { text: `User is explaining "${nodeTitle}" in their own words (Feynman Technique). \nReference Content: ${nodeContent.substring(0, 2000)} \n\nEvaluate their explanation. Identify misconceptions or missing key points. Be encouraging. Use LaTeX for math.` }
        ];
        if (audioData) {
            parts.push({ inlineData: { mimeType: 'audio/webm', data: audioData } }); 
        } else {
            parts.push({ text: `User Explanation: ${userExplanation}` });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts }
        });
        return marked.parse(response.text || '') as string;
    });
}

export async function generateRemedialNode(originalNodeId: string, parentTitle: string, weaknesses: Weakness[], content: string, images: any[]) {
    return withRetry(async () => {
        const prompt = `
        Create a remedial node for "${parentTitle}" addressing these weaknesses: ${JSON.stringify(weaknesses)}.
        Output JSON: { "id": "rem_...", "title": "...", "difficulty": 0.3, "isExplanatory": true, ... }
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJsonString(response.text || '{}'));
    });
}

export async function generateQuiz(topic: string, content: string, images: any[], onQuestionStream: any): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `
        Generate 4 questions for the topic: "${topic}".
        Content Context: ${content.substring(0, 3000)}

        Task: Create 3 "multiple-choice" questions and 1 "short-answer" question.

        CRITICAL OUTPUT FORMAT:
        Stream each question one by one. Wrap each JSON object with [QUESTION_START] and [QUESTION_END].
        DO NOT use markdown code blocks (like \`\`\`json). Just output the raw tags and raw JSON.

        Schema for 'multiple-choice':
        [QUESTION_START]
        {
            "type": "multiple-choice",
            "question": "...",
            "options": ["A", "B", "C", "D"],
            "correctAnswerIndex": 0,
            "difficulty": "متوسط",
            "points": 10
        }
        [QUESTION_END]

        Schema for 'short-answer':
        [QUESTION_START]
        {
            "type": "short-answer",
            "question": "...",
            "correctAnswer": "...",
            "difficulty": "سخت",
            "points": 20
        }
        [QUESTION_END]

        Language: Persian (Farsi).
        Use LaTeX for math ($...$).
        `;
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] }
        });
        
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
                } catch (e) {
                    console.error("Error parsing question JSON", e);
                    buffer = buffer.substring(e + 14);
                }
            }
        }
        return { questions };
    });
}

export async function gradeAndAnalyzeQuiz(questions: any[], userAnswers: any, content: string, images: any[]) {
    return withRetry(async () => {
        const prompt = `
        Grade this quiz.
        Questions: ${JSON.stringify(questions)}
        Answers: ${JSON.stringify(userAnswers)}
        
        Output JSON array: [{ "questionId": "...", "isCorrect": boolean, "score": number, "analysis": "..." }]
        Use LaTeX ($...$) in analysis if needed.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJsonString(response.text || '[]'));
    });
}

export async function generateDeepAnalysis(title: string, content: string) {
    const prompt = `Deep analysis for ${title}. Use LaTeX for math formulas.`;
    const r = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: { parts: [{ text: prompt }] } });
    return marked.parse(r.text || '');
}

export async function generateChatResponse(history: any, message: string, nodeTitle: any, content: string, isDebateMode: boolean, weaknesses: any, chatPersona: any, availableNodes: any) {
    return withRetry(async () => {
        const personaPrompt = isDebateMode ? 
            `You are in DEBATE MODE. Persona: ${chatPersona}. Challenge the user.` : 
            `You are a Tutor. Persona: ${chatPersona}. Helpful and guiding.`;
            
        const prompt = `
        ${personaPrompt}
        IMPORTANT: You MUST respond in Persian (Farsi).
        IMPORTANT: Use LaTeX for ANY math formula ($...$ or $$...$$).
        Context: ${content.substring(0, 2000)}
        Current Node: ${nodeTitle}
        User: ${message}
        
        Available Nodes for linking: ${JSON.stringify(availableNodes)}
        If relevant, link to nodes using [[Node Title]].
        `;
        const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
        return r.text || '';
    });
}

export async function generateProactiveChatInitiation(nodeTitle: string, nodeContent: string, isDebateMode: boolean, weaknesses: any): Promise<string> {
    return withRetry(async () => {
        const prompt = `Initiate a ${isDebateMode ? 'debate' : 'conversation'} about ${nodeTitle}. Language: Persian (Farsi). Use LaTeX for math if applicable.`;
        const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
        return r.text || '';
    });
}

export async function generateCoachQuestion(nodeTitle: string, nodeContent: string): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        You are a proactive tutor observing a student reading about "${nodeTitle}".
        Content Context: ${nodeContent.substring(0, 1000)}
        
        Task: Generate a short, provocative, and engaging question (max 20 words) to challenge the student or initiate a debate about this specific topic.
        Language: Persian (Farsi) ONLY.
        Tone: Curious, slightly challenging, or Socratic.
        `;
        const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
        return r.text?.trim() || 'نظرت درباره این موضوع چیه؟';
    });
}

export async function generatePodcastScript(contents: any, mode: 'monologue' | 'dialogue'): Promise<string> {
    return withRetry(async () => {
        const naturalStyleInstructions = `
        STYLE GUIDE (CRITICAL):
        1. **Conversational Persian:** Write in strictly colloquial Persian (محاوره‌ای), NOT formal (کتابی). Use "می‌رم" instead of "می‌روم", "اینه" instead of "این است".
        2. **Human Touch:** Include natural speech markers. 
           - Use **"هممم..."** (Hmmm...) for thinking pauses. 
           - Use **"خب..."** (Well...) to transition.
           - Use **"آها!"** (Aha!) for realization.
           - Use **"..."** (Ellipsis) to indicate short pauses/breathing.
        3. **Pacing:** Vary sentence length. Short, punchy sentences mixed with longer explanations.
        4. **Emotion:** Show excitement, curiosity, or surprise using punctuation (!, ?).
        5. **Math:** If there are formulas, explain them verbally (e.g. "ای برابر است با ام سی به توان دو"). Do not use LaTeX in podcast script.
        `;

        let prompt = "";
        if (mode === 'dialogue') {
            prompt = `
            You are a Professional Podcast Producer. Write a script in Persian between a Host (named Host) and a Guest (named Guest).
            
            ${naturalStyleInstructions}
            
            Topic Content: ${JSON.stringify(contents)}
            
            Format:
            Host: [Text]
            Guest: [Text]
            
            Specific Dialogue Instructions:
            - Start immediately with a catchy intro and a unique creative name for the episode (e.g. "رادیو ذهن", "عمیق شو").
            - The Host is curious and energetic. The Guest is knowledgeable but humble.
            - Include small interruptions or agreements like "آره آره دقیقاً!" or "جدی؟!".
            - End with a warm sign-off.
            `;
        } else {
            prompt = `
            You are a Professional Podcast Producer. Write a script for a solo podcaster (Monologue) in Persian.
            
            ${naturalStyleInstructions}
            
            Topic Content: ${JSON.stringify(contents)}
            
            Format: Just the spoken text (No "Host:" label needed).
            
            Specific Monologue Instructions:
            - Start with a creative episode name.
            - Talk DIRECTLY to the listener ("دوست من", "شما").
            - Ask rhetorical questions to keep engagement ("تا حالا فکر کردید چرا...؟").
            - Use "هممم" to pretend you are thinking about a complex point.
            - End with a call to action or a thought-provoking question.
            `;
        }
        const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: prompt }] } });
        return r.text || '';
    });
}

export async function generatePodcastAudio(script: string, speaker1: VoiceName, speaker2: VoiceName | undefined, mode: 'monologue' | 'dialogue'): Promise<string> {
    return withRetry(async () => {
        // REAL IMPLEMENTATION
        try {
            const truncatedScript = script.substring(0, 2000); 

            let speechConfig: any;

            if (mode === 'dialogue' && speaker2) {
                speechConfig = {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: [
                            {
                                speaker: 'Host',
                                voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1 } }
                            },
                            {
                                speaker: 'Guest',
                                voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2 } }
                            }
                        ]
                    }
                };
            } else {
                speechConfig = {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1 } }
                };
            }

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: truncatedScript }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: speechConfig
                }
            });
            
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio) {
                const rawAudioBytes = base64ToUint8Array(base64Audio);
                const wavHeader = createWavHeader(rawAudioBytes.length, 24000, 1, 16); // Assuming 24kHz, Mono, 16-bit
                
                const wavBytes = new Uint8Array(wavHeader.length + rawAudioBytes.length);
                wavBytes.set(wavHeader, 0);
                wavBytes.set(rawAudioBytes, wavHeader.length);
                
                const wavBase64 = uint8ArrayToBase64(wavBytes);
                return `data:audio/wav;base64,${wavBase64}`;
            }
        } catch (e) {
            console.warn("TTS Failed", e);
            throw e;
        }
        
        throw new Error("Failed to generate audio.");
    });
}

const flashcardSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            front: { type: Type.STRING, description: "The question or concept to recall." },
            back: { type: Type.STRING, description: "The answer or explanation. MUST BE FILLED." }
        },
        required: ["front", "back"]
    }
};

export async function generateFlashcards(
    nodeTitle: string,
    content: string
): Promise<Omit<Flashcard, 'id' | 'nodeId' | 'interval' | 'repetition' | 'easeFactor' | 'nextReviewDate'>[]> {
    return withRetry(async () => {
        const prompt = `
        You are an expert in Spaced Repetition Systems (SRS).
        
        Task: Create 3 to 5 high-quality flashcards based on the lesson: "${nodeTitle}".
        Content: ${content.substring(0, 3000)}...
        
        Rules for Flashcards:
        1. **Atomic Principle:** One idea per card.
        2. **Active Recall:** Use questions that force the user to think, not just recognize.
        3. **Cloze Deletion Style (Optional):** You can use fill-in-the-blanks if appropriate (e.g., "The capital of France is [...]").
        4. **Language:** Persian (Farsi).
        5. **MANDATORY:** You MUST provide the 'back' field (Answer). It cannot be empty. If the answer is simple, provide a short definition. If it's complex, summarize it.
        6. **Math:** Use LaTeX ($...$) for any formulas.
        
        Output JSON Format:
        [
          { "front": "Question?", "back": "Answer" },
          { "front": "Term", "back": "Definition" }
        ]
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: flashcardSchema
            }
        });

        const cleanText = cleanJsonString(response.text || '[]');
        return JSON.parse(cleanText);
    });
}

export async function generatePracticeResponse(topic: string, problem: string, questionType: 'multiple-choice' | 'descriptive' = 'descriptive', difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<string> {
    return withRetry(async () => {
        const typePrompt = questionType === 'multiple-choice' ? 'Create a multiple-choice question (with 4 options) based on the request.' : 'Create a descriptive/analytical problem or question.';
        const diffPrompt = `Difficulty Level: ${difficulty}`;
        
        const prompt = `
        You are an intelligent tutor.
        User Request:
        Topic: ${topic}
        Problem Context (if any): ${problem}
        
        Configuration:
        - ${typePrompt}
        - ${diffPrompt}

        Instructions:
        1. If a specific problem is provided, solve it step-by-step with clear explanations.
        2. If only a topic is provided, generate a practice question matching the configuration.
        3. If generated question is multiple-choice, provide the question, options, and then the correct answer with explanation in a hidden/toggleable format if possible (or just plain text at the end).
        4. Use LaTeX ($...$ or $$...$$) for ALL math equations.
        
        Language: Persian (Farsi).
        Output Format: Markdown HTML (use bold, lists, code blocks if needed).
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] }
        });
        
        const text = response.text || "متاسفانه پاسخی تولید نشد.";
        return marked.parse(text) as string;
    });
}

export async function generateDailyChallenge(): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        Generate a "Daily Micro-Learning Challenge" for a student.
        
        Content:
        1. A fascinating fact, a quick mental exercise, or a critical thinking question.
        2. Keep it short (under 50 words).
        3. Language: Persian (Farsi).
        4. Tone: Energetic and motivating.
        5. Use LaTeX ($...$) for numbers or formulas if needed.
        
        Output Format: Markdown HTML.
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] }
        });
        
        const text = response.text || "چالش امروز آماده نیست.";
        return marked.parse(text) as string;
    });
}

// --- Scenario Simulator Functions ---

export async function generateScenario(nodeTitle: string, content: string): Promise<Scenario> {
    return withRetry(async () => {
        const prompt = `
        You are a Scenario Designer for an educational role-playing game.
        Topic: "${nodeTitle}"
        Content: ${content.substring(0, 2000)}...

        Task: Create an immersive decision-making scenario.
        1. Assign a Role (e.g., CEO, Historian, Scientist).
        2. Describe a specific Crisis or Challenge related to the topic.
        3. Provide 3 distinct Options. One should be optimal based on the content, others might have trade-offs or be common misconceptions.

        Language: Persian (Farsi).
        
        IMPORTANT: Return PURE JSON. No markdown ticks (\`\`\`json). 
        
        Output JSON:
        {
            "role": "Title (e.g. مدیر پروژه)",
            "context": "Story/Situation description (approx 50 words).",
            "options": [
                { "id": "A", "text": "Action 1" },
                { "id": "B", "text": "Action 2" },
                { "id": "C", "text": "Action 3" }
            ]
        }
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        const json = JSON.parse(cleanJsonString(response.text || '{}'));
        if (!json.options) throw new Error("Invalid scenario format");
        return json;
    });
}

export async function evaluateScenarioDecision(scenario: Scenario, decisionId: string, content: string): Promise<ScenarioOutcome> {
    return withRetry(async () => {
        const selectedOption = scenario.options.find(o => o.id === decisionId)?.text || "Unknown";
        
        const prompt = `
        The user is playing a simulation about "${scenario.role}".
        Situation: ${scenario.context}
        User Choice: "${selectedOption}"
        Reference Content: ${content.substring(0, 2000)}

        Task: Simulate the consequence of this decision.
        1. Narrative: What happens next? (Positive or negative outcome).
        2. Analysis: Explain WHY based on the educational content.
        3. Level: 'positive', 'neutral', or 'negative'.

        Language: Persian (Farsi).
        
        IMPORTANT: Return PURE JSON.
        
        Output JSON:
        {
            "narrative": "Story of what happened...",
            "analysis": "Educational explanation...",
            "consequenceLevel": "positive" | "neutral" | "negative"
        }
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        return JSON.parse(cleanJsonString(response.text || '{}'));
    });
}
