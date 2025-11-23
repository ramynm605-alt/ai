
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MindMapNode, Quiz, LearningPreferences, NodeContent, QuizQuestion, UserAnswer, QuizResult, GradingResult, PreAssessmentAnalysis, ChatMessage, Weakness, ChatPersona, VoiceName, ResourceValidation, Flashcard } from '../types';
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
             3. "validation": Assess the research quality.
             
             ${jsonFormatInstruction}
             
             Example JSON:
             \`\`\`json
             {
                "isValid": boolean,
                "qualityScore": number (0-100),
                "issues": string[],
                "summary": "Short summary of what was found.",
                "extractedText": "The FULL RESEARCHED ARTICLE content in Persian (Markdown)..."
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
             2. "extractedText": Compile a detailed educational text.
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
             2. Clean up the text.
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
        if (resourceType === 'link' || isTopicResearch) {
            const jsonMatch = textToParse.match(/```json\s*([\s\S]*?)\s*```/) || textToParse.match(/```\s*([\s\S]*?)\s*```/);
            if (jsonMatch) textToParse = jsonMatch[1];
        } else {
            textToParse = cleanJsonString(textToParse);
        }

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
        Act as an expert curriculum designer.
        Create a comprehensive Learning Mind Map and Pre-Assessment based on the content.
        Context: ${contextInstruction}
        Preferences: ${preferenceInstructions}
        
        Language: Persian (Farsi).
        
        Output Format (Stream):
        1. First, output the Mind Map JSON structure wrapped in [MIND_MAP_START] and [MIND_MAP_END].
           Structure: { mindMap: [{ id, title, parentId, ... }], suggestedPath: [id1, id2...] }
        2. Then, output 5 pre-assessment questions ONE BY ONE.
           Each question must be wrapped in [QUESTION_START] and [QUESTION_END].
           Format: { "id": "...", "question": "...", "type": "multiple-choice", "options": [...], "correctAnswerIndex": 0, "difficulty": "...", "points": 10 }
        
        Content: ${pageContentForPrompt.substring(0, 30000)}
        `;
        
        const parts: any[] = [{ text: prompt }];
        images.forEach(img => parts.push({ inlineData: img }));

        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts },
        });

        let buffer = '';
        const questions: QuizQuestion[] = [];
        let mindMapGenerated = false;
        
        for await (const chunk of stream) {
            buffer += chunk.text;
            
            // Parse Mind Map
            if (!mindMapGenerated) {
                const s = buffer.indexOf('[MIND_MAP_START]');
                const e = buffer.indexOf('[MIND_MAP_END]', s);
                if (s !== -1 && e !== -1) {
                    try {
                        const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
                        const json = JSON.parse(jsonStr);
                        let mindMap = flattenMindMap(json.mindMap || json);
                        if (mindMap.length > 0) mindMap[0].parentId = null;
                        onMindMapGenerated(mindMap, json.suggestedPath || []);
                        mindMapGenerated = true;
                        buffer = buffer.substring(e + 14); // Clear buffer up to end of mind map
                    } catch (err) {
                        console.error("Error parsing mind map:", err);
                    }
                }
            }

            // Parse Questions Stream
            let s, e;
            while ((s = buffer.indexOf('[QUESTION_START]')) !== -1 && (e = buffer.indexOf('[QUESTION_END]', s)) !== -1) {
                try {
                    const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
                    const q = JSON.parse(jsonStr);
                    if (!q.id) q.id = Math.random().toString(36).substr(2, 9);
                    questions.push(q);
                    onQuestionStream(q);
                } catch (err) {
                    console.error("Error parsing question:", err);
                }
                buffer = buffer.substring(e + 14);
            }
        }
        return { questions };
    });
}

export async function generateQuiz(topic: string, content: string, images: any[], onQuestionStream: (q: QuizQuestion) => void): Promise<Quiz> {
    return withRetry(async () => {
        const prompt = `
        You are a strict examiner. Create a quiz about "${topic}".
        Content to test: ${content.substring(0, 10000)}...
        
        Generate 5 questions.
        Mix of Multiple Choice (4 options) and Short Answer.
        Difficulty: Vary between 'آسان', 'متوسط', 'سخت', 'چالش‌برانگیز'.
        Language: Persian (Farsi).
        
        Format:
        For each question, output strictly:
        [QUESTION_START]
        {
          "question": "...",
          "type": "multiple-choice" | "short-answer",
          "options": ["A", "B", "C", "D"], // Only for multiple-choice
          "correctAnswerIndex": 0, // Only for multiple-choice
          "correctAnswer": "...", // For short-answer
          "difficulty": "...",
          "points": 10
        }
        [QUESTION_END]
        
        Do not wrap in markdown blocks inside the tags.
        `;

        const parts: any[] = [{ text: prompt }];
        images.forEach(img => parts.push({ inlineData: img }));

        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash", // Flash is faster for quizzes
            contents: { parts }
        });

        let buffer = '';
        const questions: QuizQuestion[] = [];

        for await (const chunk of stream) {
            buffer += chunk.text;
            let s, e;
            while ((s = buffer.indexOf('[QUESTION_START]')) !== -1 && (e = buffer.indexOf('[QUESTION_END]', s)) !== -1) {
                const jsonStr = buffer.substring(s + 16, e);
                try {
                    const q = JSON.parse(cleanJsonString(jsonStr));
                    if (!q.id) q.id = Math.random().toString(36).substr(2, 9);
                    questions.push(q);
                    onQuestionStream(q);
                } catch (err) {
                    console.error("Failed to parse quiz question:", err);
                }
                buffer = buffer.substring(e + 14);
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
            "overallAnalysis": "Detailed analysis...",
            "strengths": ["Topic A", "Topic B"],
            "weaknesses": ["Topic C"],
            "recommendedLevel": "مبتدی" | "متوسط" | "پیشرفته",
            "weaknessTags": ["Concept X", "Concept Y"],
            "strengthTags": ["Concept Z"],
            "conceptScores": { "Concept X": 40, "Concept Y": 90 }
        }
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    });
}

export async function generateNodeContent(
    nodeTitle: string, 
    fullContent: string, 
    images: any[], 
    preferences: any, 
    strengths: any, 
    weaknesses: any, 
    isIntroNode: boolean, 
    nodeType: any, 
    onStreamUpdate: (content: NodeContent) => void
): Promise<NodeContent> {
    return withRetry(async () => {
        const prefInstructions = getPreferenceInstructions(preferences);
        const prompt = `
        Act as a master teacher. Create detailed lesson content for: "${nodeTitle}".
        Context: ${fullContent.substring(0, 15000)}
        ${prefInstructions}
        User Strengths: ${strengths.join(', ')}
        User Weaknesses: ${weaknesses.join(', ')}
        Is Intro Node: ${isIntroNode}
        
        Output valid JSON (streaming friendly, but we parse final).
        For streaming, I need you to output sections sequentially labeled:
        [INTRO] ... [THEORY] ... [EXAMPLE] ... [CONNECTION] ... [CONCLUSION] ... [TASK] ... [QUESTIONS_START] json_array [QUESTIONS_END]
        
        Content should be in Persian, Markdown format.
        interactiveTask: A specific question or small exercise for the user to answer in a text box.
        `;

        const parts: any[] = [{ text: prompt }];
        images.forEach(img => parts.push({ inlineData: img }));

        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: { parts }
        });

        let buffer = '';
        let currentContent: NodeContent = { introduction: '', theory: '', example: '', connection: '', conclusion: '', suggestedQuestions: [] };
        
        const extractSection = (tag: string, endTag: string | null) => {
            const s = buffer.indexOf(tag);
            if (s === -1) return null;
            let e = -1;
            if (endTag) {
                e = buffer.indexOf(endTag, s);
            } else {
                // If no end tag, find the *next* known tag
                const tags = ['[THEORY]', '[EXAMPLE]', '[CONNECTION]', '[CONCLUSION]', '[TASK]', '[QUESTIONS_START]'];
                let minIdx = -1;
                tags.forEach(t => {
                    const idx = buffer.indexOf(t, s + tag.length);
                    if (idx !== -1 && (minIdx === -1 || idx < minIdx)) minIdx = idx;
                });
                e = minIdx;
            }
            
            if (e !== -1) {
                return buffer.substring(s + tag.length, e).trim();
            }
            return buffer.substring(s + tag.length).trim(); // Ongoing
        };

        for await (const chunk of stream) {
            buffer += chunk.text;
            currentContent.introduction = extractSection('[INTRO]', null) || currentContent.introduction;
            currentContent.theory = extractSection('[THEORY]', null) || currentContent.theory;
            currentContent.example = extractSection('[EXAMPLE]', null) || currentContent.example;
            currentContent.connection = extractSection('[CONNECTION]', null) || currentContent.connection;
            currentContent.conclusion = extractSection('[CONCLUSION]', null) || currentContent.conclusion;
            currentContent.interactiveTask = extractSection('[TASK]', null) || currentContent.interactiveTask;
            
            onStreamUpdate(currentContent);
        }
        
        // Final parse for questions
        const qS = buffer.indexOf('[QUESTIONS_START]');
        const qE = buffer.indexOf('[QUESTIONS_END]', qS);
        if (qS !== -1 && qE !== -1) {
            try {
                currentContent.suggestedQuestions = JSON.parse(cleanJsonString(buffer.substring(qS + 17, qE)));
            } catch (e) {}
        }

        return currentContent;
    });
}

export async function evaluateNodeInteraction(nodeTitle: string, learningObjective: string, task: string, userResponse: string, sourceContent: string): Promise<string> {
    const prompt = `
    Evaluate the user's response to the interactive task.
    Node: ${nodeTitle}
    Objective: ${learningObjective}
    Task: ${task}
    User Response: ${userResponse}
    Source Context: ${sourceContent.substring(0, 2000)}
    
    Provide constructive feedback in Persian (Markdown).
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] }
    });
    return marked.parse(response.text || '') as string;
}

export async function evaluateFeynmanExplanation(nodeTitle: string, nodeContent: string, userExplanation: string, audioData: string | null): Promise<string> {
    const parts: any[] = [];
    parts.push({ text: `
    The user is using the Feynman Technique to explain "${nodeTitle}".
    Original Content: ${nodeContent.substring(0, 5000)}
    
    Analyze their explanation for:
    1. Accuracy
    2. Simplicity (did they use jargon?)
    3. Completeness
    
    Provide feedback in Persian (Markdown). Be encouraging but point out gaps.
    `});
    
    if (audioData) {
        parts.push({ inlineData: { mimeType: 'audio/webm', data: audioData } }); // Assuming webm from MediaRecorder
    } else {
        parts.push({ text: `User Explanation: ${userExplanation}` });
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts }
    });
    return marked.parse(response.text || '') as string;
}

export async function generateRemedialNode(originalNodeId: string, parentTitle: string, weaknesses: Weakness[], content: string, images: any[]) {
    const prompt = `
    Create a remedial lesson node to address these weaknesses: ${JSON.stringify(weaknesses)}.
    Parent Topic: ${parentTitle}
    
    Output JSON:
    {
      "id": "remedial_${Date.now()}",
      "title": "Remedial: ...",
      "parentId": "${originalNodeId}",
      "locked": false,
      "difficulty": 0.3,
      "isExplanatory": true,
      "sourcePages": [],
      "type": "remedial",
      "isAdaptive": true
    }
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
}

export async function gradeAndAnalyzeQuiz(questions: any[], userAnswers: any, content: string, images: any[]) {
    const prompt = `
    Grade this quiz.
    Questions: ${JSON.stringify(questions)}
    User Answers: ${JSON.stringify(userAnswers)}
    Content Context: ${content.substring(0, 2000)}
    
    Output JSON Array:
    [
      {
        "questionId": "...",
        "isCorrect": boolean,
        "score": number,
        "analysis": "Why correct/incorrect? Explain in Persian."
      }
    ]
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '[]');
}

export async function generateDeepAnalysis(title: string, content: string) {
    const prompt = `Provide a deep, advanced analysis of "${title}" based on: ${content.substring(0, 5000)}. Include hidden connections, critical perspectives, and advanced applications. Persian Markdown.`;
    const r = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: { parts: [{ text: prompt }] } });
    return marked.parse(r.text || '') as string;
}

export async function generateChatResponse(history: any, message: string, nodeTitle: any, content: string, isDebateMode: boolean, weaknesses: any, chatPersona: any, availableNodes: any) {
    const prompt = `
    You are an AI Tutor. Persona: ${chatPersona}.
    Mode: ${isDebateMode ? 'DEBATE (Challenge the user, find fallacies)' : 'HELPFUL (Guide the user)'}.
    Current Node: ${nodeTitle}
    Content: ${content.substring(0, 3000)}
    Chat History: ${JSON.stringify(history.slice(-5))}
    User Message: ${message}
    
    If referencing other topics, use format [[Topic Title]].
    Language: Persian.
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || '';
}

export async function generateProactiveChatInitiation(nodeTitle: string, nodeContent: string, isDebateMode: boolean, weaknesses: any): Promise<string> {
    const prompt = `
    Initiate a conversation with the student about "${nodeTitle}".
    Mode: ${isDebateMode ? 'Provocative Debate Starter' : 'Curiosity Spark'}.
    Content: ${nodeContent.substring(0, 1000)}
    Language: Persian. Keep it short and engaging (under 30 words).
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || '';
}

export async function generatePodcastScript(contents: any, mode: any): Promise<string> {
    const prompt = `
    Write a podcast script in Persian.
    Mode: ${mode}
    Topics: ${JSON.stringify(contents)}
    Format: 
    Speaker1: ...
    Speaker2: ... (if dialogue)
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || '';
}

export async function generatePodcastAudio(script: string, speaker1: any, speaker2: any, mode: any): Promise<string> {
    // Simulating audio generation for now as per request structure limits, 
    // or implementing simplified TTS if API allows. 
    // Since the actual TTS API call is complex with multi-speaker config, we'll stick to the provided example logic.
    
    const config: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1 } }
        }
    };
    
    if (mode === 'dialogue' && speaker2) {
        config.speechConfig = {
            multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                    { speaker: 'Speaker1', voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1 } } },
                    { speaker: 'Speaker2', voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2 } } }
                ]
            }
        };
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: script }] },
        config
    });

    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64) {
        return `data:audio/mp3;base64,${base64}`;
    }
    throw new Error("Audio generation failed");
}

// --- NEW: Generate Flashcards ---
const flashcardSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            front: { type: Type.STRING, description: "The question or concept to recall." },
            back: { type: Type.STRING, description: "The answer or explanation." }
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

export async function generatePracticeResponse(topic: string, problem: string): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        You are an intelligent tutor.
        User Request:
        Topic: ${topic}
        Problem: ${problem}

        Instructions:
        1. If a problem is provided, solve it step-by-step with clear explanations.
        2. If only a topic is provided, create a relevant practice scenario or question and explain the solution.
        3. If both are provided, use the topic as context to solve the problem.
        
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
