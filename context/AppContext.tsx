
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, AppStatus, ChatMessage, MindMapNode, NodeProgress, PodcastConfig, PodcastState, Quiz, QuizResult, Reward, SavedSession, UserBehavior, UserProfile, Weakness, LearningPreferences, PreAssessmentAnalysis, NodeContent, UserAnswer, FeynmanState, Flashcard, FlashcardGrade } from '../types';

// --- Default Behavior & Initial State ---
const DEFAULT_BEHAVIOR: UserBehavior = {
    lastLoginDate: new Date().toISOString(),
    dailyStreak: 1,
    studyHours: new Array(24).fill(0),
    gritScore: 0,
    totalPoints: 0
};

const initialState: AppState = {
  theme: 'dark',
  status: AppStatus.IDLE,
  resources: [],
  sourceContent: '',
  sourcePageContents: null,
  sourceImages: [],
  preferences: {
    explanationStyle: 'balanced',
    knowledgeLevel: 'intermediate',
    learningFocus: 'practical',
    tone: 'conversational',
    addExplanatoryNodes: false,
    customInstructions: '',
    learningGoal: '',
  },
  mindMap: [],
  suggestedPath: null,
  preAssessment: null,
  preAssessmentAnswers: null,
  preAssessmentAnalysis: null,
  activeQuiz: null,
  activeNodeId: null,
  nodeContents: {},
  streamingNodeContent: null,
  userProgress: {},
  weaknesses: [],
  finalExam: null,
  quizResults: null,
  correctiveSummary: '',
  loadingMessage: null,
  error: null,
  isChatOpen: false,
  isChatFullScreen: false,
  isChatLoading: false,
  isDebateMode: false, 
  chatPersona: 'supportive_coach', 
  chatHistory: [],
  behavior: DEFAULT_BEHAVIOR,
  rewards: [],
  flashcards: [],
  showDailyBriefing: false,
  dailyChallengeContent: null,
  currentUser: null,
  isUserPanelOpen: false,
  savedSessions: [],
  currentSessionId: null,
  isAutoSaving: false,
  cloudSyncStatus: 'idle',
  cloudAccessToken: null,
  cloudLastSync: null,
  podcastConfig: { mode: 'monologue', speaker1: 'Puck', selectedNodeIds: [] },
  isPodcastMode: false,
  podcastState: {
      status: 'idle',
      progressText: '',
      audioUrl: null,
      isMinimized: false
  },
  feynmanState: null,
};

// --- Helper: SM-2 Algorithm for SRS ---
const calculateNextReview = (
    grade: FlashcardGrade, 
    previousInterval: number, 
    previousRepetition: number, 
    previousEaseFactor: number
): { interval: number, repetition: number, easeFactor: number } => {
    let interval: number;
    let repetition: number;
    let easeFactor: number;

    if (grade >= 3) {
        if (previousRepetition === 0) {
            interval = 1;
        } else if (previousRepetition === 1) {
            interval = 6;
        } else {
            interval = Math.round(previousInterval * previousEaseFactor);
        }
        repetition = previousRepetition + 1;
    } else {
        interval = 1;
        repetition = 0;
    }

    easeFactor = previousEaseFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    return { interval, repetition, easeFactor };
};

// --- Reducer Function ---
function appReducer(state: AppState, action: any): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    // ... existing cases ...
    case 'ADD_RESOURCE':
       return { ...state, resources: [...state.resources, action.payload] };
    case 'REMOVE_RESOURCE':
       return { ...state, resources: state.resources.filter(r => r.id !== action.payload) };
    case 'UPDATE_RESOURCE':
        return {
            ...state,
            resources: state.resources.map(r => r.id === action.payload.id ? { ...r, ...action.payload.updates } : r)
        };
    case 'CLEAR_RESOURCES':
       return { ...state, resources: [], sourceContent: '', sourceImages: [] };
    case 'INIT_WIZARD':
       return { 
           ...state, 
           status: AppStatus.WIZARD, 
           sourceContent: action.payload.sourceContent,
       };
    case 'FINISH_WIZARD':
       return { ...state, status: AppStatus.LOADING, preferences: action.payload, loadingMessage: 'در حال تحلیل منابع و طراحی نقشه ذهنی...' };
    case 'START_GENERATION':
      return { ...state, status: AppStatus.LOADING, loadingMessage: 'در حال تولید نقشه ذهنی...' };
    case 'MIND_MAP_GENERATED': {
        const welcomeMessage: ChatMessage = { role: 'model', message: 'سلام! من مربی ذهن گاه شما هستم. نقشه یادگیری آماده است. بیایید با هم آن را بررسی کنیم.' };
        return { 
            ...state, 
            status: AppStatus.PLAN_REVIEW, 
            mindMap: action.payload.mindMap, 
            suggestedPath: action.payload.suggestedPath,
            preAssessment: { questions: [], isStreaming: true }, 
            loadingMessage: null, 
            chatHistory: [welcomeMessage] 
        };
    }
    case 'CONFIRM_PLAN':
        return { ...state, status: AppStatus.PRE_ASSESSMENT };
    case 'PRE_ASSESSMENT_QUESTION_STREAMED':
      if (!state.preAssessment) return state;
      return { ...state, preAssessment: { ...state.preAssessment, questions: [...state.preAssessment.questions, action.payload] } };
    case 'PRE_ASSESSMENT_STREAM_END':
      if (!state.preAssessment) return state;
      return { ...state, preAssessment: { ...state.preAssessment, isStreaming: false } };
    case 'SUBMIT_PRE_ASSESSMENT':
        return { ...state, status: AppStatus.GRADING_PRE_ASSESSMENT, preAssessmentAnswers: action.payload };
    case 'START_ADAPTING_PLAN':
         return { ...state, status: AppStatus.ADAPTING_PLAN, loadingMessage: 'هوش مصنوعی در حال بازآرایی نقشه یادگیری بر اساس عملکرد شماست...' };
    case 'PLAN_ADAPTED':
         return { 
             ...state, 
             status: AppStatus.PRE_ASSESSMENT_REVIEW, 
             preAssessmentAnalysis: action.payload.analysis,
             mindMap: action.payload.mindMap,
             suggestedPath: action.payload.suggestedPath,
             loadingMessage: null
         };
    case 'START_PERSONALIZED_LEARNING':
      return { ...state, status: AppStatus.LEARNING, activeNodeId: null, activeQuiz: null, quizResults: null };
    case 'SELECT_NODE':
      return { ...state, activeNodeId: action.payload, streamingNodeContent: null };
    case 'NODE_CONTENT_STREAM_START':
        return { ...state, status: AppStatus.VIEWING_NODE, streamingNodeContent: { introduction: '', theory: '', example: '', connection: '', conclusion: '', suggestedQuestions: [] } };
    case 'NODE_CONTENT_STREAM_UPDATE':
        return { ...state, streamingNodeContent: action.payload };
    case 'NODE_CONTENT_STREAM_END':
        return { ...state, nodeContents: { ...state.nodeContents, [action.payload.nodeId]: action.payload.content }, streamingNodeContent: null };
    case 'NODE_CONTENT_LOADED':
        return { ...state, status: AppStatus.VIEWING_NODE, nodeContents: { ...state.nodeContents, [state.activeNodeId!]: action.payload }, streamingNodeContent: null };
    case 'START_QUIZ':
      return { ...state, status: AppStatus.TAKING_QUIZ, activeNodeId: action.payload, activeQuiz: { questions: [], isStreaming: true } };
    case 'QUIZ_QUESTION_STREAMED':
      if (!state.activeQuiz) return state;
      return { ...state, activeQuiz: { ...state.activeQuiz, questions: [...state.activeQuiz.questions, action.payload] } };
    case 'QUIZ_STREAM_END':
      if (!state.activeQuiz) return state;
      return { ...state, activeQuiz: { ...state.activeQuiz, isStreaming: false } };
    case 'SUBMIT_QUIZ':
        const hour = new Date().getHours();
        const newStudyHours = [...state.behavior.studyHours];
        newStudyHours[hour]++;
        return { 
            ...state, 
            status: AppStatus.GRADING_QUIZ,
            behavior: { ...state.behavior, studyHours: newStudyHours } 
        };
    case 'START_REMEDIAL_GENERATION':
        return { ...state, status: AppStatus.GENERATING_REMEDIAL, loadingMessage: 'در حال تحلیل اشتباهات و ایجاد درس تقویتی...' };
    case 'CANCEL_REMEDIAL_GENERATION': 
        return { ...state, status: AppStatus.QUIZ_REVIEW, loadingMessage: null };
    case 'ADD_REMEDIAL_NODE': {
        const { remedialNode, originalNodeId } = action.payload;
        const newMindMap = [...state.mindMap, remedialNode];
        let newPath = [...(state.suggestedPath || [])];
        const originalIndex = newPath.indexOf(originalNodeId);
        if (originalIndex !== -1) {
            newPath.splice(originalIndex + 1, 0, remedialNode.id);
        } else {
            newPath.push(remedialNode.id);
        }
        return { 
            ...state, 
            mindMap: newMindMap, 
            suggestedPath: newPath, 
            status: AppStatus.LEARNING, 
            activeNodeId: remedialNode.id,
            quizResults: null,
            activeQuiz: null,
            loadingMessage: null 
        };
    }
    case 'QUIZ_ANALYSIS_LOADED': {
        const { results } = action.payload;
        const totalScore = results.reduce((sum: number, r: QuizResult) => sum + r.score, 0);
        const maxScore = results.reduce((sum: number, r: QuizResult) => sum + r.question.points, 0);
        const proficiency = maxScore > 0 ? totalScore / maxScore : 0;
        const passed = proficiency >= 0.7;

        const currentProgress = state.userProgress[state.activeNodeId!] || { status: 'in_progress', attempts: 0, proficiency: 0, explanationCount: 0, lastAttemptScore: 0 };
        const attempts = currentProgress.attempts + 1;
        const status: NodeProgress['status'] = passed ? 'completed' : 'failed';

        const newProgress = { 
            ...state.userProgress, 
            [state.activeNodeId!]: { 
                status, 
                attempts,
                proficiency,
                explanationCount: currentProgress.explanationCount,
                lastAttemptScore: totalScore
            } 
        };
        
        let newMindMap = [...state.mindMap];
        if (passed) {
            newMindMap = newMindMap.map(node => {
                if (node.parentId === state.activeNodeId) {
                    return { ...node, locked: false };
                }
                return node;
            });
        }

        const newWeaknesses = [...state.weaknesses];
        results.forEach((r: QuizResult) => {
            if (!r.isCorrect) {
                 if (!newWeaknesses.some(w => w.question === r.question.question)) {
                     newWeaknesses.push({ 
                         question: r.question.question, 
                         incorrectAnswer: JSON.stringify(r.userAnswer), 
                         correctAnswer: r.question.type === 'multiple-choice' ? r.question.options[r.question.correctAnswerIndex] : r.question.correctAnswer 
                     });
                 }
            }
        });

        return { 
            ...state, 
            status: AppStatus.QUIZ_REVIEW, 
            userProgress: newProgress, 
            weaknesses: newWeaknesses,
            mindMap: newMindMap,
            quizResults: results,
        };
    }
    case 'RECORD_EXPLANATION_REQUEST': {
        const nodeId = state.activeNodeId;
        if (!nodeId) return state;
        const current = state.userProgress[nodeId] || { status: 'in_progress', attempts: 0, proficiency: 0, explanationCount: 0, lastAttemptScore: 0 };
        return {
            ...state,
            userProgress: {
                ...state.userProgress,
                [nodeId]: { ...current, explanationCount: current.explanationCount + 1 }
            }
        };
    }
    case 'FORCE_UNLOCK_NODE': { 
        const nodeId = state.activeNodeId!;
        const current = state.userProgress[nodeId] || { status: 'in_progress', attempts: 0, proficiency: 0, explanationCount: 0, lastAttemptScore: 0 };
        const newBehavior = { ...state.behavior, gritScore: state.behavior.gritScore - 1 };
        const newProgress = { ...state.userProgress, [nodeId]: { ...current, status: 'completed' as const } };
        const newMindMap = state.mindMap.map(node => 
            node.parentId === nodeId ? { ...node, locked: false } : node
        );
         return {
            ...state,
            status: AppStatus.LEARNING,
            activeNodeId: null,
            activeQuiz: null,
            quizResults: null,
            userProgress: newProgress,
            mindMap: newMindMap,
            behavior: newBehavior
        };
    }
    case 'RETRY_QUIZ_IMMEDIATELY': {
        return { ...state, behavior: { ...state.behavior, gritScore: state.behavior.gritScore + 1 } };
    }
    case 'UNLOCK_REWARD': {
        const newReward = action.payload;
        if (state.rewards.some(r => r.id === newReward.id)) return state;
        return { ...state, rewards: [...state.rewards, newReward] };
    }
     case 'COMPLETE_INTRO_NODE': {
        const rootNodeId = state.mindMap.find(n => n.parentId === null)?.id;
        if (!rootNodeId) return { ...state, status: AppStatus.LEARNING, activeNodeId: null };
        const newProgress = { ...state.userProgress, [rootNodeId]: { status: 'completed' as const, attempts: 1, proficiency: 1, explanationCount: 0, lastAttemptScore: 100 } };
        const newMindMap = state.mindMap.map(node => node.parentId === rootNodeId ? { ...node, locked: false } : node);
        return { ...state, status: AppStatus.LEARNING, activeNodeId: null, userProgress: newProgress, mindMap: newMindMap };
    }
    case 'START_FINAL_EXAM': {
      const finalExamQuiz: Quiz = { questions: [], isStreaming: true };
      return { ...state, status: AppStatus.FINAL_EXAM, finalExam: finalExamQuiz, activeQuiz: finalExamQuiz, activeNodeId: 'final_exam', loadingMessage: null };
    }
    case 'FINAL_EXAM_QUESTION_STREAMED':
      if (!state.finalExam) return state;
      return { 
          ...state, 
          finalExam: { ...state.finalExam, questions: [...state.finalExam.questions, action.payload] }, 
          activeQuiz: state.activeQuiz ? { ...state.activeQuiz, questions: [...state.activeQuiz.questions, action.payload] } : state.activeQuiz
      };
    case 'FINAL_EXAM_STREAM_END':
      if (!state.finalExam) return state;
      return { ...state, finalExam: { ...state.finalExam, isStreaming: false }, activeQuiz: { ...state.activeQuiz!, isStreaming: false } };
    case 'COMPLETE_FINAL_EXAM':
        return { ...state, status: AppStatus.GRADING_QUIZ };
    case 'SUMMARY_LOADED':
        return { ...state, status: AppStatus.SUMMARY, finalExam: null, correctiveSummary: action.payload.summary };
    case 'RESET':
        return { 
            ...initialState, 
            currentUser: state.currentUser, 
            savedSessions: state.savedSessions, 
            behavior: state.behavior,
            theme: state.theme
        };
    case 'LOAD_STATE': {
        const loadedState = action.payload;
        if (!loadedState || typeof loadedState !== 'object') {
            return { ...state, error: "فایل جلسه نامعتبر است.", status: AppStatus.IDLE };
        }
        const hasMindMap = loadedState.mindMap && Array.isArray(loadedState.mindMap) && loadedState.mindMap.length > 0;
        if (!hasMindMap) {
             return { ...state, error: "اطلاعات نقشه ذهنی در این جلسه یافت نشد.", status: AppStatus.IDLE };
        }
        let activeNodeId = loadedState.activeNodeId;
        if (activeNodeId && Array.isArray(loadedState.mindMap)) {
             const exists = loadedState.mindMap.some((n: any) => n.id === activeNodeId);
             if (!exists) {
                 activeNodeId = null;
             }
        } else {
            activeNodeId = null;
        }

        let nextStatus = AppStatus.PLAN_REVIEW; 

        if (loadedState.finalExam) {
            nextStatus = AppStatus.FINAL_EXAM;
        } else if (loadedState.quizResults) {
            nextStatus = AppStatus.QUIZ_REVIEW;
        } else if (loadedState.activeQuiz) {
            nextStatus = AppStatus.TAKING_QUIZ;
        } else if (activeNodeId) {
             if (loadedState.nodeContents && loadedState.nodeContents[activeNodeId]) {
                 nextStatus = AppStatus.VIEWING_NODE;
             } else {
                 nextStatus = AppStatus.LEARNING;
             }
        } else if (loadedState.userProgress && Object.keys(loadedState.userProgress).length > 0) {
             nextStatus = AppStatus.LEARNING;
        } else if (loadedState.preAssessmentAnalysis) {
            nextStatus = AppStatus.LEARNING;
        } else if (loadedState.preAssessment) {
             nextStatus = AppStatus.PRE_ASSESSMENT;
        }

        return { 
            ...initialState, 
            ...loadedState, 
            resources: loadedState.resources || [], // Backward compatibility
            chatHistory: loadedState.chatHistory || [],
            flashcards: loadedState.flashcards || [], // Load flashcards
            activeNodeId, 
            currentUser: state.currentUser, 
            savedSessions: state.savedSessions, 
            currentSessionId: action.sessionId, 
            status: nextStatus,
            loadingMessage: null,
            error: null
        };
    }
    case 'CHECK_DAILY_STATUS': {
        const lastLogin = new Date(state.behavior.lastLoginDate);
        const now = new Date();
        const diffHours = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
        
        let newStreak = state.behavior.dailyStreak;
        let showBriefing = false;

        if (state.mindMap.length > 0) {
            if (diffHours > 24 && diffHours < 48) {
                newStreak += 1;
                showBriefing = true;
            } else if (diffHours >= 48) {
                newStreak = 1;
                showBriefing = true;
            } else if (new Date(state.behavior.lastLoginDate).getDate() !== now.getDate()) {
                // Same day logic to ensure daily brief shows at least once a day
                showBriefing = true;
            }
        }

        const newBehavior = { 
            ...state.behavior, 
            lastLoginDate: now.toISOString(), 
            dailyStreak: newStreak 
        };

        return {
            ...state,
            behavior: newBehavior,
            showDailyBriefing: showBriefing
        };
    }
    case 'DISMISS_BRIEFING':
        return { ...state, showDailyBriefing: false };
    case 'SET_DAILY_CHALLENGE':
        return { ...state, dailyChallengeContent: action.payload };
    case 'TOGGLE_USER_PANEL':
        return { ...state, isUserPanelOpen: !state.isUserPanelOpen };
    case 'SET_USER':
        return { ...state, currentUser: action.payload };
    case 'LOGOUT':
        return { ...state, currentUser: null, savedSessions: [], currentSessionId: null, cloudAccessToken: null, cloudSyncStatus: 'idle' };
    case 'UPDATE_SAVED_SESSIONS':
        return { ...state, savedSessions: action.payload };
    case 'SET_CURRENT_SESSION_ID':
        return { ...state, currentSessionId: action.payload };
    case 'SET_AUTO_SAVING':
        return { ...state, isAutoSaving: action.payload };
    case 'SET_CLOUD_STATUS':
        return { ...state, cloudSyncStatus: action.payload.status, cloudLastSync: action.payload.lastSync || state.cloudLastSync };
    case 'TOGGLE_CHAT':
      return { ...state, isChatOpen: !state.isChatOpen };
    case 'TOGGLE_FULLSCREEN_CHAT':
      return { ...state, isChatFullScreen: !state.isChatFullScreen };
    case 'TOGGLE_DEBATE_MODE':
      return { ...state, isDebateMode: !state.isDebateMode };
    case 'SET_CHAT_PERSONA':
        return { ...state, chatPersona: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'SET_CHAT_LOADING':
        return { ...state, isChatLoading: action.payload };
    case 'TRIGGER_PROACTIVE_DEBATE':
        if (state.isChatOpen) return state;
        return { ...state, isChatOpen: true, chatHistory: [...state.chatHistory, action.payload] };
    case 'SET_ERROR':
      return { ...state, error: action.payload, status: AppStatus.ERROR, loadingMessage: null };
    case 'DEBUG_UPDATE':
      return { ...state, ...action.payload };
    // Podcast Actions
    case 'TOGGLE_PODCAST_MODE':
        return { 
            ...state, 
            isPodcastMode: !state.isPodcastMode,
            podcastConfig: !state.isPodcastMode ? { ...state.podcastConfig!, selectedNodeIds: [] } : state.podcastConfig
        };
    case 'TOGGLE_PODCAST_NODE_SELECTION': {
        const nodeId = action.payload;
        const currentSelection = state.podcastConfig?.selectedNodeIds || [];
        let newSelection;
        if (currentSelection.includes(nodeId)) {
            newSelection = currentSelection.filter(id => id !== nodeId);
        } else {
            newSelection = [...currentSelection, nodeId];
        }
        return { ...state, podcastConfig: { ...state.podcastConfig!, selectedNodeIds: newSelection } };
    }
    case 'UPDATE_PODCAST_STATE':
        return { ...state, podcastState: { ...state.podcastState, ...action.payload } };
    
    // Feynman Challenge Actions
    case 'START_FEYNMAN':
        return { 
            ...state, 
            status: AppStatus.FEYNMAN_CHALLENGE, 
            feynmanState: { targetNode: action.payload, feedback: null, isAnalyzing: false } 
        };
    case 'ANALYZING_FEYNMAN':
        return { ...state, feynmanState: { ...state.feynmanState!, isAnalyzing: true } };
    case 'FEYNMAN_FEEDBACK_RECEIVED':
        return { ...state, feynmanState: { ...state.feynmanState!, isAnalyzing: false, feedback: action.payload } };
    case 'CLOSE_FEYNMAN':
        return { ...state, status: AppStatus.LEARNING, feynmanState: null };

    // --- SRS Actions ---
    case 'ADD_FLASHCARDS': {
        const newCards = action.payload;
        // Prevent duplicates
        const uniqueNewCards = newCards.filter((nc: Flashcard) => !state.flashcards.some(ec => ec.front === nc.front));
        return { ...state, flashcards: [...state.flashcards, ...uniqueNewCards] };
    }
    case 'START_FLASHCARD_REVIEW':
        return { ...state, status: AppStatus.REVIEWING_FLASHCARDS };
    case 'FINISH_FLASHCARD_REVIEW':
        return { ...state, status: AppStatus.LEARNING }; // Or back to Dashboard/Idle depending on context
    case 'UPDATE_FLASHCARD_REVIEW': {
        const { id, grade } = action.payload;
        const cardIndex = state.flashcards.findIndex(c => c.id === id);
        if (cardIndex === -1) return state;

        const card = state.flashcards[cardIndex];
        const { interval, repetition, easeFactor } = calculateNextReview(grade, card.interval, card.repetition, card.easeFactor);
        
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + interval);

        const updatedCard: Flashcard = {
            ...card,
            interval,
            repetition,
            easeFactor,
            nextReviewDate: nextDate.toISOString()
        };

        const newFlashcards = [...state.flashcards];
        newFlashcards[cardIndex] = updatedCard;

        return { ...state, flashcards: newFlashcards };
    }

    default:
      return state;
  }
}

// ... (AppContext creation and Provider - NO CHANGES) ...
interface AppContextProps {
  state: AppState;
  dispatch: React.Dispatch<any>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
