


export interface MindMapNode {
    id: string;
    title: string;
    parentId: string | null;
    locked: boolean;
    difficulty: number;
    isExplanatory: boolean;
    sourcePages: number[];
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
  }
  
  export interface Weakness {
    question: string;
    incorrectAnswer: string;
    correctAnswer: string;
  }
  
  export interface LearningPreferences {
    style: 'faithful' | 'balanced' | 'creative';
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
  }

  export interface PreAssessmentAnalysis {
    overallAnalysis: string;
    strengths: string[];
    weaknesses: string[];
    recommendedLevel: string;
  }

  export enum AppStatus {
    IDLE = 'IDLE',
    LOADING = 'LOADING',
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
  }

  export type UserAnswer = string | number;

  export interface QuizResult {
    question: QuizQuestion;
    userAnswer: UserAnswer;
    isCorrect: boolean;
    score: number;
    analysis: string;
  }
  
  export interface AppState {
    theme: 'light' | 'balanced' | 'dark';
    status: AppStatus;
    sourceContent: string;
    sourcePageContents: string[] | null;
    sourceImages: { mimeType: string, data: string }[];
    preferences: LearningPreferences;
    mindMap: MindMapNode[];
    preAssessment: Quiz | null;
    preAssessmentAnswers: Record<string, UserAnswer> | null;
    preAssessmentAnalysis: PreAssessmentAnalysis | null;
    activeQuiz: Quiz | null;
    activeNodeId: string | null;
    nodeContents: { [key: string]: NodeContent };
    userProgress: { [key: string]: 'completed' | 'failed' | 'in_progress' };
    weaknesses: Weakness[];
    finalExam: Quiz | null;
    quizResults: QuizResult[] | null;
    correctiveSummary: string;
    loadingMessage: string | null;
    error: string | null;
  }

  export interface SavableState {
    version: number;
    sourceContent: string;
    sourcePageContents: string[] | null;
    sourceImages: { mimeType: string, data: string }[];
    preferences: LearningPreferences;
    mindMap: MindMapNode[];
    preAssessmentAnalysis: PreAssessmentAnalysis | null;
    nodeContents: { [key: string]: NodeContent };
    userProgress: { [key: string]: 'completed' | 'failed' | 'in_progress' };
    weaknesses: Weakness[];
  }