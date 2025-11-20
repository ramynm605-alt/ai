
export interface ChatMessage {
  role: 'user' | 'model';
  message: string;
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
    difficulty: 'آسان' | 'متوسط' | 'سخت';
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
    tone: 'academic' | 'conversational';
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

  export interface SavedSession {
      id: string;
      userId: string;
      title: string;
      lastModified: string;
      progressPercentage: number;
      topic: string;
      data: SavableState;
  }

  export interface AppState {
    theme: 'light' | 'balanced' | 'dark';
    status: AppStatus;
    sourceContent: string;
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
    chatHistory: ChatMessage[];
    behavior: UserBehavior;
    rewards: Reward[];
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
  }

  export interface SavableState {
    version: number;
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
  }
