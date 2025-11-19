
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
    sourcePages: number[];
    type: 'core' | 'remedial' | 'extension'; // Added for Adaptive Branching
    children?: MindMapNode[];
  }

  export type QuestionType = 'multiple-choice' | 'short-answer';

  export interface BaseQuestion {
    id: string;
    question: string;
    difficulty: 'آسان' | 'متوسط' | 'سخت';
    points: number;
    type: QuestionType;
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
  }

  export interface PreAssessmentAnalysis {
    overallAnalysis: string;
    strengths: string[];
    weaknesses: string[];
    recommendedLevel: string;
  }

  export enum AppStatus {
    IDLE = 'IDLE',
    WIZARD = 'WIZARD', // New status for Personalization Wizard
    LOADING = 'LOADING',
    PLAN_REVIEW = 'PLAN_REVIEW',
    PRE_ASSESSMENT = 'PRE_ASSESSMENT',
    GRADING_PRE_ASSESSMENT = 'GRADING_PRE_ASSESSMENT',
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

  // --- Engagement Loop Additions ---
  export interface Reward {
      id: string;
      type: 'deep_analysis' | 'notebook';
      title: string;
      content: string;
      unlockedAt: string;
      relatedNodeId?: string; // If attached to a specific node
  }

  export interface UserBehavior {
      lastLoginDate: string; // ISO string
      dailyStreak: number;
      studyHours: number[]; // Histogram of study hours (0-23)
      gritScore: number; // Metric for persistence (retries vs quits)
      totalPoints: number; // Professional currency
  }
  // ---------------------------------

  // --- User Panel & Account Additions ---
  export interface UserProfile {
      id: string;
      name: string;
      email: string;
      passwordHash: string; // Added for Security
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
      data: SavableState; // The full state blob
  }
  // --------------------------------------

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
    // Coach/Chat state
    isChatOpen: boolean;
    isChatFullScreen: boolean;
    chatHistory: ChatMessage[];
    
    // Engagement State
    behavior: UserBehavior;
    rewards: Reward[];
    showDailyBriefing: boolean;
    dailyChallengeContent: string | null;

    // User Account State
    currentUser: UserProfile | null;
    isUserPanelOpen: boolean;
    savedSessions: SavedSession[];
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
    // Save Engagement Data
    behavior: UserBehavior;
    rewards: Reward[];
  }
