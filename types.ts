
export interface ChatMessage {
  role: 'user' | 'model';
  message: string;
}

export type ResourceType = 'file' | 'link' | 'text';

export interface ResourceValidation {
    isValid: boolean;
    qualityScore: number; // 0 to 100
    issues: string[]; // e.g., ["Low contrast PDF", "Audio too quiet"]
    summary: string;
}

export interface LearningResource {
    id: string;
    type: ResourceType;
    title: string;
    content: string; // The extracted text
    metadata?: any; // For page numbers or specific file info
    validation?: ResourceValidation; // New: AI Analysis result
    isProcessing?: boolean; // New: To show loading spinner per resource
    instructions?: string; // New: Specific instructions for this resource
}

export interface MindMapNode {
    id: string;
    title: string;
    parentId: string | null;
    locked: boolean;
    difficulty: number;
    isExplanatory: boolean;
    isAdaptive?: boolean; // New: Indicates if node was added dynamically
    sourcePages: number[];
    type: 'core' | 'remedial' | 'extension';
    learningObjective?: string; // New: The specific goal (e.g., "Distinguish between A and B")
    targetSkill?: string; // New: The cognitive skill (e.g., "Analysis", "Synthesis")
    children?: MindMapNode[];
  }

  export type QuestionType = 'multiple-choice' | 'short-answer';

  export interface BaseQuestion {
    id: string;
    question: string;
    difficulty: 'آسان' | 'متوسط' | 'سخت' | 'بسیار سخت' | 'چالش‌برانگیز';
    points: number;
    type: QuestionType;
    concept?: string; // New: The specific concept/dimension this question tests
  }
  
  export interface MultipleChoiceQuestion extends BaseQuestion {
    type: 'multiple-choice';
    options: string[];
    correctAnswerIndex: number;
  }
  
  export interface ShortAnswerQuestion extends BaseQuestion {
    type: 'short-answer';
    correctAnswer: string; // Example correct answer for display
  }
  
  export type QuizQuestion = MultipleChoiceQuestion | ShortAnswerQuestion;

  export interface Quiz {
    questions: QuizQuestion[];
    isStreaming?: boolean;
  }
  
  export interface Weakness {
    question: string;
    incorrectAnswer: string;
    correctAnswer: string;
  }
  
  export interface LearningPreferences {
    explanationStyle: 'faithful' | 'balanced' | 'creative';
    knowledgeLevel: 'beginner' | 'intermediate' | 'expert';
    learningFocus: 'theoretical' | 'practical' | 'analogies';
    tone: 'academic' | 'conversational' | 'concise' | 'explanatory' | 'strict';
    detailLevel: 'simple' | 'advanced'; // New: Controls mind map density
    addExplanatoryNodes: boolean;
    customInstructions: string;
    learningGoal: string;
  }

  export interface NodeContent {
    introduction: string;
    theory: string;
    example: string;
    connection: string;
    conclusion:string;
    suggestedQuestions: string[];
    interactiveTask?: string; // New: A specific prompt for the user to answer
  }

  export interface PreAssessmentAnalysis {
    overallAnalysis: string;
    strengths: string[];
    weaknesses: string[];
    recommendedLevel: string;
    // New structured data for the Adaptive Engine
    weaknessTags: string[]; 
    strengthTags: string[];
    conceptScores?: { [key: string]: number }; // New: Score per specific concept (0-100)
  }

  export enum AppStatus {
    IDLE = 'IDLE',
    WIZARD = 'WIZARD',
    LOADING = 'LOADING',
    PLAN_REVIEW = 'PLAN_REVIEW',
    PRE_ASSESSMENT = 'PRE_ASSESSMENT',
    GRADING_PRE_ASSESSMENT = 'GRADING_PRE_ASSESSMENT',
    ADAPTING_PLAN = 'ADAPTING_PLAN', // New Status
    PRE_ASSESSMENT_REVIEW = 'PRE_ASSESSMENT_REVIEW',
    LEARNING = 'LEARNING',
    VIEWING_NODE = 'VIEWING_NODE',
    TAKING_QUIZ = 'TAKING_QUIZ',
    GRADING_QUIZ = 'GRADING_QUIZ',
    QUIZ_REVIEW = 'QUIZ_REVIEW',
    ALL_NODES_COMPLETED = 'ALL_NODES_COMPLETED',
    FINAL_EXAM = 'FINAL_EXAM',
    SUMMARY = 'SUMMARY',
    ERROR = 'ERROR',
    GENERATING_REMEDIAL = 'GENERATING_REMEDIAL',
    PODCAST_CREATION = 'PODCAST_CREATION', // New status for podcast UI
    FEYNMAN_CHALLENGE = 'FEYNMAN_CHALLENGE', // New status for Reverse Teaching
    REVIEWING_FLASHCARDS = 'REVIEWING_FLASHCARDS', // New Status for SRS
    SCENARIO_SIMULATOR = 'SCENARIO_SIMULATOR', // New Status for Role-play
  }

  export type UserAnswer = string | number;

  export interface QuizResult {
    question: QuizQuestion;
    userAnswer: UserAnswer;
    isCorrect: boolean;
    score: number;
    analysis: string;
  }
  
  export interface GradingResult {
    questionId: string;
    isCorrect: boolean;
    score: number;
    analysis: string;
  }
  
  export interface NodeProgress {
      status: 'completed' | 'failed' | 'in_progress';
      attempts: number;
      proficiency: number; // 0.0 to 1.0
      explanationCount: number; // User Model: Tracks curiosity/confusion
      lastAttemptScore: number;
  }

  export interface Reward {
      id: string;
      type: 'deep_analysis' | 'notebook';
      title: string;
      content: string;
      unlockedAt: string;
      relatedNodeId?: string;
  }

  export interface UserBehavior {
      lastLoginDate: string;
      dailyStreak: number;
      studyHours: number[];
      gritScore: number;
      totalPoints: number;
  }

  export interface UserProfile {
      id: string;
      googleId?: string;
      name: string;
      email: string;
      avatarUrl?: string;
      avatarColor: string;
      joinDate: string;
  }

  // --- SRS Types ---
  export interface Flashcard {
      id: string;
      nodeId: string;
      front: string; // Question / Concept
      back: string;  // Answer / Definition
      interval: number; // Days
      repetition: number;
      easeFactor: number;
      nextReviewDate: string; // ISO Date
  }

  export type FlashcardGrade = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

  export interface SavedSession {
      id: string;
      userId: string;
      title: string;
      lastModified: string;
      progressPercentage: number;
      topic: string;
      data: SavableState;
  }

  // --- NEW TYPES FOR CHAT PERSONA ---
  export type ChatPersona = 
    | 'supportive_coach'   // Normal: Default, friendly
    | 'strict_professor'   // Normal: Academic, concise
    | 'socratic_tutor'     // Debate: Asks questions, never answers directly
    | 'devil_advocate'     // Debate: Challenges views
    | 'ruthless_critic';   // Debate: Logic checker

  // --- NEW TYPES FOR PODCAST ---
  export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  
  export type PodcastStatus = 'idle' | 'generating_script' | 'generating_audio' | 'ready' | 'error';

  export interface PodcastConfig {
      mode: 'monologue' | 'dialogue';
      speaker1: VoiceName;
      speaker2?: VoiceName; // Only for dialogue
      selectedNodeIds: string[];
  }

  export interface PodcastState {
      status: PodcastStatus;
      progressText: string;
      audioUrl: string | null;
      isMinimized: boolean;
  }

  // --- NEW TYPES FOR FEYNMAN CHALLENGE ---
  export interface FeynmanState {
      targetNode: MindMapNode;
      feedback: string | null;
      isAnalyzing: boolean;
  }

  // --- NEW TYPES FOR SCENARIO SIMULATOR ---
  export interface ScenarioOption {
      id: string;
      text: string;
  }

  export interface Scenario {
      role: string;
      context: string; // The story/situation
      options: ScenarioOption[];
  }

  export interface ScenarioOutcome {
      narrative: string; // What happened next
      analysis: string; // Why it happened (educational link)
      consequenceLevel: 'positive' | 'neutral' | 'negative';
  }

  export interface ScenarioState {
      targetNode: MindMapNode;
      currentScenario: Scenario | null;
      outcome: ScenarioOutcome | null;
      isGenerating: boolean;
      isEvaluating: boolean;
  }

  export interface AppState {
    theme: 'light' | 'balanced' | 'dark';
    status: AppStatus;
    resources: LearningResource[]; // Multi-resource support
    sourceContent: string; // Combined content for legacy support/generation
    sourcePageContents: string[] | null;
    sourceImages: { mimeType: string, data: string }[];
    preferences: LearningPreferences;
    mindMap: MindMapNode[];
    suggestedPath: string[] | null;
    preAssessment: Quiz | null;
    preAssessmentAnswers: Record<string, UserAnswer> | null;
    preAssessmentAnalysis: PreAssessmentAnalysis | null;
    activeQuiz: Quiz | null;
    activeNodeId: string | null;
    nodeContents: { [key: string]: NodeContent };
    streamingNodeContent: NodeContent | null;
    userProgress: { [key: string]: NodeProgress };
    weaknesses: Weakness[];
    finalExam: Quiz | null;
    quizResults: QuizResult[] | null;
    correctiveSummary: string;
    loadingMessage: string | null;
    error: string | null;
    isChatOpen: boolean;
    isChatFullScreen: boolean;
    isChatLoading: boolean; // New: Tracks if AI is generating response
    isDebateMode: boolean; 
    chatPersona: ChatPersona; 
    chatHistory: ChatMessage[];
    behavior: UserBehavior;
    rewards: Reward[];
    flashcards: Flashcard[]; // New SRS
    showDailyBriefing: boolean;
    dailyChallengeContent: string | null;
    currentUser: UserProfile | null;
    isUserPanelOpen: boolean;
    savedSessions: SavedSession[];
    currentSessionId: string | null;
    isAutoSaving: boolean;
    cloudSyncStatus: 'idle' | 'syncing' | 'error' | 'success';
    cloudAccessToken: string | null;
    cloudLastSync: string | null;
    // Podcast State
    podcastConfig: PodcastConfig | null;
    isPodcastMode: boolean;
    podcastState: PodcastState; 
    // Feynman State
    feynmanState: FeynmanState | null;
    // Scenario Simulator State
    scenarioState: ScenarioState | null;
  }

  export interface SavableState {
    version: number;
    resources: LearningResource[];
    sourceContent: string;
    sourcePageContents: string[] | null;
    sourceImages: { mimeType: string, data: string }[];
    preferences: LearningPreferences;
    mindMap: MindMapNode[];
    suggestedPath: string[] | null;
    preAssessmentAnalysis: PreAssessmentAnalysis | null;
    nodeContents: { [key: string]: NodeContent };
    userProgress: { [key: string]: NodeProgress };
    weaknesses: Weakness[];
    behavior: UserBehavior;
    rewards: Reward[];
    chatHistory: ChatMessage[]; 
    flashcards: Flashcard[]; // Save cards
  }
