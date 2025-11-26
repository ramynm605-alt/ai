
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

// --- Helper Functions ---

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && (error.status === 503 || error.message?.includes('503') || error.message?.includes('overloaded'))) {
            console.warn(`API call failed, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(res => setTimeout(res, delay));
            return withRetry(fn, retries - 1, delay * 2); 
        }
        console.error("API call failed after retries:", error);
        throw error; 
    }
}

function cleanJsonString(str: string): string {
    let cleaned = str.trim();
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
    // Remove standard comments
    cleaned = cleaned.replace(/\/\/.*$/gm, ''); 
    // Fix common JSON trailng comma errors loosely
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
        locked: !!parentId, // Adjusted: nodes with a parent are locked by default
        difficulty: typeof node.difficulty === 'number' ? node.difficulty : 0.5,
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

// --- Services ---

export async function analyzeResourceContent(
    title: string,
    rawText: string | null,
    media: { mimeType: string, data: string } | null,
    resourceType: 'file' | 'link' | 'text',
    metadata?: any
): Promise<{ extractedText: string; validation: ResourceValidation }> {
    return withRetry(async () => {
        let prompt;
        let parts: any[] = [];

        if (metadata?.isTopic) {
             const depthInstruction = metadata.depth === 'deep' 
                ? "Provide a deep, academic analysis with technical details." 
                : "Provide a general overview suitable for beginners.";
            const lengthInstruction = metadata.length === 'comprehensive'
                ? "Write a very detailed and comprehensive article."
                : metadata.length === 'brief' 
                    ? "Write a concise summary of key points." 
                    : "Write a standard length educational article.";

            prompt = `
            ROLE: Educational Content Generator.
            TASK: Conduct research and generate a comprehensive educational resource about the topic: "${rawText || title}".
            LANGUAGE: **PERSIAN (FARSI)**.
            
            SETTINGS:
            - ${depthInstruction}
            - ${lengthInstruction}
            
            INSTRUCTIONS:
            1. Write a structured article with clear headings (Markdown).
            2. Include definitions, history (if relevant), key theories, and examples.
            3. The content must be substantial and educational, as it will be used to generate a learning map.
            
            OUTPUT FORMAT (JSON):
            {
                "extractedText": "The full generated content in Persian Markdown...",
                "validation": {
                    "isValid": true,
                    "qualityScore": 100,
                    "issues": [],
                    "summary": "Description of the generated topic."
                }
            }
            `;
            parts.push({ text: prompt });
        } else {
            prompt = `
            ROLE: Senior Content Analyst & Educational Architect.
            TASK: Deeply analyze the provided resource titled "${title}" to create a high-fidelity knowledge base.
            
            CRITICAL INSTRUCTIONS:
            1. **DO NOT SUMMARIZE**. Instead, EXTRACT and RESTRUCTURE all key educational concepts, definitions, formulas, and arguments.
            2. If the text is messy (e.g. PDF OCR errors), clean it up but keep the original meaning.
            3. Organize the output using Markdown headings (#, ##, ###) to show hierarchy.
            4. Ensure technical terms are preserved.
            5. If the content is very short/irrelevant, mark 'isValid' as false.
            
            OUTPUT FORMAT (JSON):
            {
                "extractedText": "The structured, detailed content in Persian (or original language if code)...",
                "validation": {
                    "isValid": boolean,
                    "qualityScore": number (0-100),
                    "issues": ["Specific issue in Persian (e.g. 'متن ناخوانا')", ...],
                    "summary": "A professional summary of the content coverage in PERSIAN."
                }
            }
            `;
            parts.push({ text: prompt });
            if (rawText) parts.push({ text: `CONTENT START:\n${rawText.substring(0, 300000)}\nCONTENT END` }); // Increased context limit for chunking
            if (media) parts.push({ inlineData: media });
        }
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Using Flash for speed and efficiency
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

export async function generateLearningPlan(
    content: string, 
    pageContents: string[] | null, 
    images: any[], 
    preferences: LearningPreferences, 
    onMindMapGenerated: any, 
    onQuestionStream: any
): Promise<Quiz> { 
    return withRetry(async () => {
        const detailInstruction = preferences.detailLevel === 'advanced'
            ? "STRUCTURE: Consolidated Hierarchy. Group concepts into 8-10 comprehensive nodes. STRICT MAX: 10 NODES."
            : "STRUCTURE: High-Level Overview. Group concepts into 5-8 nodes. STRICT MAX: 8 NODES.";

        const prompt = `
        You are a World-Class Curriculum Architect.
        
        CONTEXT:
        User Knowledge Level: ${preferences.knowledgeLevel}
        Learning Focus: ${preferences.learningFocus}
        Tone: ${preferences.tone}
        Goal: ${preferences.learningGoal || "General Mastery"}
        
        TASK:
        Create a structured Learning Mind Map based on the provided content.
        The output must be in **PERSIAN (FARSI)**.
        
        CRITICAL CONSTRAINT: **MAXIMUM 10 NODES TOTAL**.
        Because of this limit, you must **CHUNK** the content effectively.
        - Do not create a node for every small detail.
        - Group related concepts into one "Core Node".
        - Each node should represent a significant chunk of knowledge.
        
        ${detailInstruction}
        
        REQUIREMENTS:
        1. **Root Node**: Main Topic.
        2. **Children**: Ordered logically from prerequisites to advanced concepts.
        3. **Attributes**:
           - 'learningObjective': Specific goal (e.g., "Explain the role of ATP").
           - 'targetSkill': Bloom's taxonomy level (e.g., Remember, Understand, Analyze).
           - 'difficulty': 0.1 (Easy) to 1.0 (Hard).
        4. **Questions**: Generate 5 pre-assessment questions to gauge initial knowledge.
        
        STREAMING FORMAT:
        1. Emit [MIND_MAP_START] followed by the JSON object of the mind map, then [MIND_MAP_END].
        2. Emit [QUESTION_START] followed by a Question JSON, then [QUESTION_END] (repeat 5 times).

        MIND MAP JSON SCHEMA:
        {
          "title": "Main Topic",
          "suggestedPath": ["id1", "id2"...], // Logical order IDs
          "mindMap": [
            { 
              "id": "unique_id",
              "title": "Title in Persian", 
              "difficulty": 0.3,
              "learningObjective": "Objective in Persian",
              "targetSkill": "Analysis",
              "children": [ ... ]
            }
          ]
        }

        QUESTION JSON SCHEMA:
        {
           "id": "q1",
           "question": "Question text in Persian",
           "type": "multiple-choice",
           "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
           "correctAnswerIndex": 0,
           "difficulty": "متوسط",
           "points": 10
        }

        CONTENT TO ANALYZE:
        ${content.substring(0, 500000)}
        `;
        
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash", // Using Flash
            contents: { parts: [{ text: prompt }] }, 
        });

        let buffer = '';
        const questions: QuizQuestion[] = [];
        let mindMapGenerated = false;
        
        for await (const chunk of stream) {
            buffer += chunk.text;
            
            // Extract Mind Map
            if (!mindMapGenerated) {
                const s = buffer.indexOf('[MIND_MAP_START]');
                const e = buffer.indexOf('[MIND_MAP_END]', s);
                if (s !== -1 && e !== -1) {
                    const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
                    try {
                        const json = JSON.parse(jsonStr);
                        let rootData = json.mindMap || json;
                        
                        // Normalize root
                        if (Array.isArray(rootData)) {
                            rootData = {
                                title: "نقشه یادگیری",
                                children: rootData
                            };
                        }

                        let mindMap = flattenMindMap(rootData); 
                        if (mindMap.length > 0) mindMap[0].parentId = null;
                        
                        // Generate default path if missing
                        const path = json.suggestedPath || mindMap.map(n => n.id);
                        
                        onMindMapGenerated(mindMap, path);
                        mindMapGenerated = true;
                        buffer = buffer.substring(e + 14);
                    } catch (e) {
                        console.error("MindMap Parsing Error", e);
                    }
                }
            }
            
            // Extract Questions
            let s, e;
            while ((s = buffer.indexOf('[QUESTION_START]')) !== -1 && (e = buffer.indexOf('[QUESTION_END]', s)) !== -1) {
                const jsonStr = cleanJsonString(buffer.substring(s + 16, e));
                try {
                    const q = JSON.parse(jsonStr);
                    if (!q.id) q.id = Math.random().toString();
                    questions.push(q);
                    onQuestionStream(q);
                    buffer = buffer.substring(e + 14);
                } catch (err) {
                    buffer = buffer.substring(e + 14);
                }
            }
        }
        return { questions };
    });
}

export async function analyzePreAssessment(questions: any, userAnswers: any, sourceContent: string): Promise<PreAssessmentAnalysis> {
    const prompt = `
    ROLE: Educational Data Analyst.
    TASK: Analyze pre-assessment results to adapt the learning path.
    LANGUAGE: **PERSIAN (FARSI)**.
    
    INPUT:
    Questions: ${JSON.stringify(questions)}
    User Answers: ${JSON.stringify(userAnswers)}
    
    OUTPUT JSON:
    {
        "overallAnalysis": "Detailed narrative analysis of the user's current knowledge state, identifying specific gaps.",
        "strengths": ["List of concepts the user knows well"],
        "weaknesses": ["List of concepts the user struggles with"],
        "recommendedLevel": "مبتدی" | "متوسط" | "پیشرفته",
        "weaknessTags": ["Short Tag 1", "Short Tag 2"],
        "strengthTags": ["Short Tag 1", "Short Tag 2"],
        "conceptScores": { "Concept Name": score_0_to_100, ... }
    }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonString(response.text || '{}'));
}

export async function generateNodeContent(
    nodeTitle: string, 
    fullContent: string, 
    images: any[], 
    preferences: any, 
    strengths: string[], 
    weaknesses: string[], 
    isIntroNode: boolean, 
    nodeType: any, 
    onStreamUpdate: any
): Promise<NodeContent> {
    return withRetry(async () => {
        const contextInstructions = isIntroNode 
            ? "This is the Introduction node. Provide a high-level roadmap, motivate the learner, and explain WHY this topic matters."
            : "This is a specific concept node. Go deep into the mechanics, proofs, or details.";

        const prompt = `
        ROLE: Master Teacher / Textbook Author.
        TOPIC: "${nodeTitle}"
        TONE: ${preferences.tone}
        CONTEXT: ${contextInstructions}
        
        USER PROFILE:
        - Strengths: ${strengths.join(', ')}
        - Weaknesses: ${weaknesses.join(', ')} (Address these carefully if relevant)
        - Style: ${preferences.learningFocus}
        
        TASK:
        Generate rich, interactive educational content in **PERSIAN**.
        Use **Markdown** extensively (bolding keywords, lists, code blocks).
        Use **LaTeX** for math ($...$ or $$...$$).
        
        JSON OUTPUT STRUCTURE:
        {
            "introduction": "Hook the reader. Define the concept simply.",
            "theory": "The core explanation. Use analogies if requested. Be rigorous but clear. Address 'How' and 'Why'.",
            "example": "A concrete, real-world scenario or solved problem step-by-step.",
            "connection": "How this connects to previous/next topics or broader field.",
            "conclusion": "Summary + Key Takeaways (bullet points).",
            "suggestedQuestions": ["Thought-provoking question 1", "Question 2"],
            "interactiveTask": "A specific small task/question for the user to answer in the text box (e.g. 'Explain X in your own words' or 'Solve this mini-problem')."
        }
        
        SOURCE MATERIAL:
        ${fullContent.substring(0, 50000)}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Using Flash
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        
        const content = JSON.parse(cleanJsonString(response.text || '{}'));
        onStreamUpdate(content);
        return content;
    });
}

export async function evaluateNodeInteraction(nodeTitle: string, learningObjective: string, task: string, userResponse: string, sourceContent: string): Promise<string> {
    const prompt = `
    ROLE: Socratic Tutor.
    TASK: Evaluate the user's response to a learning task.
    
    Topic: ${nodeTitle}
    Objective: ${learningObjective}
    Task: ${task}
    User Response: "${userResponse}"
    
    INSTRUCTIONS:
    1. Analyze the response for correctness and depth.
    2. If correct, praise specific details and extend the idea slightly.
    3. If incorrect/incomplete, provide a hint or a counter-example to guide them (do not just give the answer).
    4. Output in **PERSIAN**. Use Markdown.
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
}

export async function evaluateFeynmanExplanation(
    nodeTitle: string, 
    nodeContent: string, 
    userExplanation: string, 
    audioData: string | null
): Promise<string> {
    const prompt = `
    ROLE: Feynman Technique Evaluator.
    TASK: The user is trying to explain "${nodeTitle}" simply. Evaluate their explanation.
    
    CRITERIA:
    1. **Simplicity**: Did they avoid jargon?
    2. **Accuracy**: Is it factually correct?
    3. **Completeness**: Did they miss key parts?
    4. **Analogy**: Did they use a good analogy?
    
    INPUT:
    Original Content: ${nodeContent.substring(0, 5000)}
    User Explanation: ${userExplanation || "(Audio Provided)"}
    
    OUTPUT (PERSIAN, Markdown):
    - Give a score (0-100).
    - "What you understood well" (Green checkmarks).
    - "What was fuzzy/wrong" (Warning signs).
    - "Simplified correction" (How you would explain the missing part).
    `;

    let parts: any[] = [{ text: prompt }];
    if (audioData) {
        parts.push({ inlineData: { mimeType: 'audio/webm', data: audioData } });
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Flash 2.0 is good for multimodal
        contents: { parts }
    });
    return response.text || "";
}

export async function generateRemedialNode(originalNodeId: string, parentTitle: string, weaknesses: Weakness[], content: string, images: any[]) {
    const prompt = `
    TASK: Create a 'Remedial' (Correction) Node for a user who failed "${parentTitle}".
    FOCUS: Address these specific weaknesses: ${JSON.stringify(weaknesses)}.
    
    OUTPUT JSON (MindMapNode format):
    {
        "id": "remedial_${Math.random().toString(36).substr(2, 5)}",
        "title": "Review: [Specific Concept]",
        "parentId": "${originalNodeId}",
        "type": "remedial",
        "difficulty": 0.3,
        "isExplanatory": true,
        "learningObjective": "Address specific misconceptions about...",
        "targetSkill": "Understanding"
    }
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }, 
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonString(response.text || '{}'));
}

export async function generateQuiz(topic: string, content: string, images: any[], onQuestionStream: any): Promise<Quiz> {
    const prompt = `
    TASK: Generate 4 high-quality quiz questions for "${topic}".
    LANGUAGE: Persian.
    
    CRITICAL RULES:
    1. **Structure**: Generate EXACTLY 3 "multiple-choice" questions and 1 "short-answer" question.
    2. **Short Answer**: The 4th question MUST be 'short-answer' type to test deep understanding and explanation ability.
    3. **Distractors**: Wrong answers for multiple-choice must be plausible misconceptions.
    4. **Difficulty**: Mix of Medium and Hard.
    
    STREAM FORMAT:
    [QUESTION_START] JSON [QUESTION_END]
    
    JSON SCHEMA (Multiple Choice):
    {
       "question": "Question text...",
       "type": "multiple-choice",
       "options": ["A", "B", "C", "D"],
       "correctAnswerIndex": 0,
       "difficulty": "سخت",
       "points": 20,
       "concept": "Concept being tested"
    }

    JSON SCHEMA (Short Answer):
    {
       "question": "Deep, open-ended question requiring explanation...",
       "type": "short-answer",
       "correctAnswer": "Key points that should be in the answer...", 
       "difficulty": "چالش‌برانگیز",
       "points": 40,
       "concept": "Concept being tested"
    }
    
    CONTENT: ${content.substring(0, 20000)}
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
            } catch (e) { buffer = buffer.substring(e + 14); }
        }
    }
    return { questions };
}

export async function gradeAndAnalyzeQuiz(questions: any[], userAnswers: any, content: string, images: any[]) {
    const prompt = `
    TASK: Grade the user's quiz and provide detailed feedback.
    LANGUAGE: Persian.
    
    INPUT:
    Questions: ${JSON.stringify(questions)}
    User Answers: ${JSON.stringify(userAnswers)}
    
    INSTRUCTIONS:
    1. For multiple-choice: 0 or full points.
    2. For short-answer: Analyze the text. Give partial credit (0 to full points) based on key concepts mentioned vs expected answer.
    3. Provide "analysis" for every question explaining the logic.
    
    OUTPUT JSON Array:
    [
      {
        "questionId": "id",
        "isCorrect": boolean (true if score > 0),
        "score": number,
        "analysis": "Detailed feedback..."
      }
    ]
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }, 
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonString(response.text || '[]'));
}

export async function generateDeepAnalysis(title: string, content: string) {
    const prompt = `
    ROLE: Deep Learning Specialist.
    TASK: Provide an "Advanced Insight" / "Deep Dive" into "${title}".
    AUDIENCE: A student who has just mastered the basics and wants to go further.
    
    CONTENT REQUIREMENTS (Persian, Markdown):
    1. **Hidden Connections**: Connect this topic to unrelated fields (e.g. Biology -> Engineering).
    2. **Paradoxes/Nuances**: Is there a counter-intuitive aspect?
    3. **Future Implications**: Where is this field going?
    4. **Mental Model**: Provide a unique visualization or mental model to remember this forever.
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Using Flash
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
}

export async function generateChatResponse(
    history: ChatMessage[], 
    message: string, 
    nodeTitle: string | null, 
    content: string, 
    isDebateMode: boolean, 
    weaknesses: Weakness[], 
    chatPersona: ChatPersona, 
    availableNodes: string[]
) {
    const personaInstructions = {
        'supportive_coach': "You are a friendly, encouraging coach. Use emojis. Celebrate small wins. Guide gently.",
        'strict_professor': "You are a rigorous academic professor. Demand precision. No emojis. Focus on definitions and logic.",
        'socratic_tutor': "You NEVER give the answer. You ONLY ask guiding questions to lead the user to the truth.",
        'devil_advocate': "You disagree with everything the user says (politely but firmly) to test their arguments. Challenge assumptions.",
        'ruthless_critic': "You find logical fallacies and weak points in the user's understanding. Be direct and critical."
    };

    const prompt = `
    ROLE: ${personaInstructions[chatPersona] || personaInstructions['supportive_coach']}
    MODE: ${isDebateMode ? "DEBATE/CHALLENGE (Push back on ideas)" : "ASSISTANCE (Help understand)"}
    TOPIC: ${nodeTitle || "General"}
    
    CONTEXT FROM LESSON:
    ${content.substring(0, 5000)}
    
    USER MESSAGE: "${message}"
    
    INSTRUCTIONS:
    1. Reply in **PERSIAN**.
    2. Keep it concise (under 150 words unless explaining a complex theory).
    3. If you reference another topic from this list: [${availableNodes.slice(0, 20).join(', ')}], wrap it like [[Topic Name]] to create a link.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
}

export async function generateProactiveChatInitiation(nodeTitle: string, nodeContent: string, isDebateMode: boolean, weaknesses: any): Promise<string> {
    const prompt = `
    TASK: Initiate a conversation with the user about "${nodeTitle}".
    MODE: ${isDebateMode ? 'Controversial/Challenge' : 'Check-in'}.
    
    If Debate Mode:
    - Start with a controversial statement or a tricky question about the topic.
    
    If Check-in Mode:
    - Ask if they understood the main concept or need a specific example.
    
    Language: Persian. Short and engaging.
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
}

export async function generateCoachQuestion(nodeTitle: string, nodeContent: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: `Ask a single, deep, Socratic question about "${nodeTitle}" to test understanding. Persian. Short.` }] }
    });
    return response.text || "";
}

export async function generatePodcastScript(contents: any[], mode: 'monologue' | 'dialogue'): Promise<string> {
    return withRetry(async () => {
        const prompt = `
        TASK: Write a Podcast Script in **PERSIAN** based on the provided educational content.
        MODE: ${mode}
        
        CHARACTERS (if dialogue):
        - Speaker 1 (Host): Enthusiastic, asks questions, clarifies.
        - Speaker 2 (Expert): Knowledgeable, uses analogies, calm.
        
        STRUCTURE:
        1. Intro: Hook the listener.
        2. Body: Discuss key points dynamically. Use "Wait, so you mean..." or "Exactly!" to sound natural.
        3. Conclusion: Summary.
        
        FORMAT:
        Speaker1: Text...
        Speaker2: Text...
        
        CONTENT TO COVER:
        ${JSON.stringify(contents).substring(0, 20000)}
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: { parts: [{ text: prompt }] }
        });
        return response.text || "";
    });
}

export async function generatePodcastAudio(
    script: string, 
    speaker1: VoiceName, 
    speaker2: VoiceName | undefined, 
    mode: 'monologue' | 'dialogue'
): Promise<string> {
    return withRetry(async () => {
        // Clean script for TTS (Remove Speaker labels for single block if needed, but multi-speaker needs config)
        // For this implementation, we will use the specialized Gemini TTS model
        
        let speechConfig;
        if (mode === 'dialogue' && speaker2) {
            speechConfig = {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        { speaker: 'Speaker1', voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1 } } },
                        { speaker: 'Speaker2', voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2 } } }
                    ]
                }
            };
        } else {
            speechConfig = {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: speaker1 }
                }
            };
        }

        // Ensure the script has the Speaker1:/Speaker2: labels if dialogue mode, 
        // otherwise clean it for monologue.
        let finalScript = script;
        if (mode === 'monologue') {
            finalScript = script.replace(/Speaker\d+:/g, '').trim();
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts", // Special model for TTS
            contents: [{ parts: [{ text: finalScript }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: speechConfig
            }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio generated");

        // Convert raw PCM to WAV for browser playback
        // Gemini TTS returns raw PCM (24kHz, mono usually)
        const pcmData = base64ToUint8Array(base64Audio);
        const wavHeader = createWavHeader(pcmData.length, 24000, 1, 16);
        const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
        return URL.createObjectURL(wavBlob);
    });
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

export async function generateFlashcards(nodeTitle: string, content: string): Promise<Omit<Flashcard, 'id' | 'nodeId' | 'interval' | 'repetition' | 'easeFactor' | 'nextReviewDate'>[]> {
    const prompt = `
    TASK: Create 5 Anki-style flashcards for "${nodeTitle}".
    LANGUAGE: Persian.
    
    GUIDELINES:
    - Front: A clear question or term.
    - Back: Concise answer or definition.
    - Focus on key facts, definitions, and relationships.
    
    OUTPUT JSON:
    [
      { "front": "Question...", "back": "Answer..." }
    ]
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }, { text: content.substring(0, 5000) }] }, 
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonString(response.text || '[]'));
}

export async function generatePracticeResponse(topic: string, problem: string, questionType: 'multiple-choice' | 'descriptive' = 'descriptive', difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<string> {
    const prompt = `
    TASK: ${topic ? `Generate a ${difficulty} practice problem about "${topic}"` : `Solve this problem: "${problem}"`}.
    TYPE: ${questionType}.
    LANGUAGE: Persian.
    
    OUTPUT FORMAT:
    - Problem Statement
    - (If solving) Step-by-step Solution using Markdown/LaTeX.
    - (If generating) The problem, then a hidden/spoiler Answer Key at the bottom.
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
}

export async function generateDailyChallenge(): Promise<string> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: `Generate a fascinating "Did you know?" fact or a mini-logic puzzle in Persian. Keep it short and fun.` }] }
    });
    return response.text || "";
}

export async function generateScenario(nodeTitle: string, content: string): Promise<Scenario> {
    const prompt = `
    TASK: Create a Role-Play Scenario to test understanding of "${nodeTitle}".
    LANGUAGE: Persian.
    
    RULES:
    1. The 'context' must describe a challenging real-world situation related to the topic.
    2. The 'role' must be a specific job or character.
    3. Provide exactly 3 distinct options.
    
    JSON SCHEMA:
    {
      "role": "The user's role (e.g. CEO, Doctor)",
      "context": "The situation description (Conflict, Problem, Mystery)",
      "options": [
        { "id": "A", "text": "Decision A" },
        { "id": "B", "text": "Decision B" },
        { "id": "C", "text": "Decision C" }
      ]
    }
    
    CONTENT: ${content.substring(0, 5000)}
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }, 
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonString(response.text || '{}'));
}

export async function evaluateScenarioDecision(scenario: Scenario, decisionId: string, content: string): Promise<ScenarioOutcome> {
    const prompt = `
    TASK: Evaluate the outcome of decision "${decisionId}" in the scenario.
    SCENARIO: ${scenario.context}
    ROLE: ${scenario.role}
    LANGUAGE: Persian.
    
    OUTPUT JSON:
    {
      "narrative": "What happens next? (Story format)",
      "analysis": "Why did this happen? Link back to the educational theory.",
      "consequenceLevel": "positive" | "neutral" | "negative"
    }
    `;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: { parts: [{ text: prompt }] }, 
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonString(response.text || '{}'));
}
