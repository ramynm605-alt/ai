
import React, { useState, useReducer, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { AppState, MindMapNode, Quiz, Weakness, LearningPreferences, NodeContent, AppStatus, UserAnswer, QuizResult, SavableState, PreAssessmentAnalysis, ChatMessage, QuizQuestion, NodeProgress, Reward, UserBehavior, UserProfile, SavedSession } from './types';
import { generateLearningPlan, generateNodeContent, generateQuiz, generateFinalExam, generateCorrectiveSummary, generatePracticeResponse, gradeAndAnalyzeQuiz, analyzePreAssessment, generateChatResponse, generateRemedialNode, generateDailyChallenge, generateDeepAnalysis, generateAdaptiveModifications } from './services/geminiService';
import { FirebaseService } from './services/firebaseService';
import { ArrowRight, BookOpen, Brain, BrainCircuit, CheckCircle, ClipboardList, Home, MessageSquare, Moon, Sun, XCircle, Save, Upload, FileText, Target, Maximize, Minimize, SlidersHorizontal, ChevronDown, Sparkles, Trash, Edit, Flame, Diamond, Scroll, User, LogOut, Wand, Bell, Shuffle, FileQuestion, Settings, ChevronLeft, ChevronRight } from './components/icons';
import BoxLoader from './components/ui/box-loader';
import StartupScreen from './components/StartupScreen';
import ParticleBackground from './components/ParticleBackground';
import { Sidebar, SidebarBody, SidebarLink } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy Load Components for Performance Optimization
const MindMap = React.lazy(() => import('./components/MindMap'));
const NodeView = React.lazy(() => import('./components/NodeView'));
const QuizView = React.lazy(() => import('./components/QuizView'));
const QuizReview = React.lazy(() => import('./components/QuizReview'));
const WeaknessTracker = React.lazy(() => import('./components/WeaknessTracker'));
const PracticeZone = React.lazy(() => import('./components/PracticeZone'));
const PreAssessmentReview = React.lazy(() => import('./components/PreAssessmentReview'));
const ChatPanel = React.lazy(() => import('./components/ChatPanel'));
const DailyBriefing = React.lazy(() => import('./components/DailyBriefing'));
const UserPanel = React.lazy(() => import('./components/UserPanel'));
const PersonalizationWizard = React.lazy(() => import('./components/PersonalizationWizard'));
const DebugPanel = React.lazy(() => import('./components/DebugPanel'));

const CURRENT_APP_VERSION = 7;
declare var pdfjsLib: any;
declare var google: any;

const DEFAULT_BEHAVIOR: UserBehavior = {
    lastLoginDate: new Date().toISOString(),
    dailyStreak: 1,
    studyHours: new Array(24).fill(0),
    gritScore: 0,
    totalPoints: 0
};

const RANDOM_TOPICS = [
    "مبانی اقتصاد رفتاری",
    "تاریخچه اینترنت و وب",
    "نظریه بازی‌ها (Game Theory)",
    "هوش مصنوعی و اخلاق",
    "فلسفه رواقی‌گری (Stoicism)",
    "مکانیک کوانتوم به زبان ساده",
    "تاریخ جنگ جهانی دوم",
    "تکنیک‌های مدیریت زمان",
    "روانشناسی شناختی و خطاهای ذهنی",
    "مبانی بلاکچین و کریپتوکارنسی",
    "هنر متقاعدسازی",
    "نجوم و سیاه‌چاله‌ها"
];

const initialState: AppState = {
  theme: 'dark',
  status: AppStatus.IDLE,
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
  chatHistory: [],
  // Engagement
  behavior: DEFAULT_BEHAVIOR,
  rewards: [],
  showDailyBriefing: false,
  dailyChallengeContent: null,
  // User Account
  currentUser: null,
  isUserPanelOpen: false,
  savedSessions: [],
  currentSessionId: null,
  isAutoSaving: false,
  // Cloud Sync
  cloudSyncStatus: 'idle',
  cloudAccessToken: null,
  cloudLastSync: null
};

function appReducer(state: AppState, action: any): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'INIT_WIZARD':
       return { ...state, status: AppStatus.WIZARD, sourceContent: action.payload.sourceContent, sourcePageContents: action.payload.sourcePageContents, sourceImages: action.payload.sourceImages };
    case 'FINISH_WIZARD':
       return { ...state, status: AppStatus.LOADING, preferences: action.payload, loadingMessage: 'در حال تحلیل محتوا و طراحی مسیر یادگیری شخصی...' };
    case 'START_GENERATION': // Directly from loading state
      return { ...state, status: AppStatus.LOADING, loadingMessage: 'در حال تولید نقشه ذهنی...' };
    case 'MIND_MAP_GENERATED': {
        const welcomeMessage: ChatMessage = { role: 'model', message: 'سلام! من مربی ذهن گاه شما هستم. نقشه یادگیری آماده است. بیایید با هم آن را بررسی کنیم.' };
        return { 
            ...state, 
            status: AppStatus.PLAN_REVIEW, 
            mindMap: action.payload.mindMap, 
            suggestedPath: action.payload.suggestedPath,
            preAssessment: { questions: [], isStreaming: true }, // Initialize Pre-Assessment
            loadingMessage: null, 
            chatHistory: [welcomeMessage] 
        };
    }
    case 'CONFIRM_PLAN':
        // Transition strictly to Pre-Assessment
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
        // Update study hours histogram
        const hour = new Date().getHours();
        const newStudyHours = [...state.behavior.studyHours];
        newStudyHours[hour]++;
        return { 
            ...state, 
            status: AppStatus.GRADING_QUIZ,
            behavior: { ...state.behavior, studyHours: newStudyHours } 
        };
    case 'START_REMEDIAL_GENERATION':
        return { ...state, status: AppStatus.GENERATING_REMEDIAL, loadingMessage: 'در حال ایجاد درس تقویتی...' };
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
        
        // Decrease Grit score for giving up
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
        // Increase Grit score for trying again
        return { ...state, behavior: { ...state.behavior, gritScore: state.behavior.gritScore + 1 } };
    }
    case 'UNLOCK_REWARD': {
        const newReward = action.payload;
        // Deduplicate
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
        
        // --- VALIDATION: Ensure critical data exists ---
        if (!loadedState || typeof loadedState !== 'object') {
            return { ...state, error: "فایل جلسه نامعتبر است.", status: AppStatus.IDLE };
        }
        
        const hasMindMap = loadedState.mindMap && Array.isArray(loadedState.mindMap) && loadedState.mindMap.length > 0;
        if (!hasMindMap) {
             return { ...state, error: "اطلاعات نقشه ذهنی در این جلسه یافت نشد.", status: AppStatus.IDLE };
        }
        // ----------------------------------------------

        // Validate activeNodeId: Ensure the node actually exists in the mind map
        let activeNodeId = loadedState.activeNodeId;
        if (activeNodeId && Array.isArray(loadedState.mindMap)) {
             const exists = loadedState.mindMap.some((n: any) => n.id === activeNodeId);
             if (!exists) {
                 console.warn(`Active node ${activeNodeId} not found in mind map. Resetting.`);
                 activeNodeId = null;
             }
        } else {
            activeNodeId = null;
        }

        let nextStatus = AppStatus.PLAN_REVIEW; // Default fallback if mindmap exists

        // Intelligently determine status based on what data is present
        if (loadedState.finalExam) {
            nextStatus = AppStatus.FINAL_EXAM;
        } else if (loadedState.quizResults) {
            nextStatus = AppStatus.QUIZ_REVIEW;
        } else if (loadedState.activeQuiz) {
            nextStatus = AppStatus.TAKING_QUIZ;
        } else if (activeNodeId) {
             // If active node exists, check if content is loaded
             if (loadedState.nodeContents && loadedState.nodeContents[activeNodeId]) {
                 nextStatus = AppStatus.VIEWING_NODE;
             } else {
                 // Fallback to learning if no content loaded for active node
                 nextStatus = AppStatus.LEARNING;
             }
        } else if (loadedState.userProgress && Object.keys(loadedState.userProgress).length > 0) {
             // If user has made progress, assume they are in Learning mode
             nextStatus = AppStatus.LEARNING;
        } else if (loadedState.preAssessmentAnalysis) {
            nextStatus = AppStatus.LEARNING;
        } else if (loadedState.preAssessment) {
             nextStatus = AppStatus.PRE_ASSESSMENT;
        }

        return { 
            ...initialState, 
            ...loadedState, 
            activeNodeId, // Use validated id
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

        // Only show daily briefing if user has some progress (MindMap exists)
        if (state.mindMap.length > 0) {
            if (diffHours > 24 && diffHours < 48) {
                newStreak += 1;
                showBriefing = true;
            } else if (diffHours >= 48) {
                newStreak = 1;
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
    // --- User Panel Actions ---
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
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'SET_ERROR':
      return { ...state, error: action.payload, status: AppStatus.ERROR, loadingMessage: null };
    // --- DEBUG ACTION ---
    case 'DEBUG_UPDATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const NotificationToast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [message, onClose]);

    const isError = type === 'error';

    return (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[10000] bg-card border shadow-2xl rounded-xl px-4 py-3 flex items-center gap-3 animate-slide-up ${isError ? 'border-destructive/50' : 'border-border'}`}>
            <div className={`p-1.5 rounded-full ${isError ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                {isError ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <span className="text-sm font-bold text-foreground">{message}</span>
        </div>
    );
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [showStartup, setShowStartup] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0); 
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isToolboxOpen, setIsToolboxOpen] = useState(true);

  const showNotification = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message: msg, type });
  }, []);

  // Watch for app-level errors
  useEffect(() => {
      if (state.error) {
          showNotification(state.error, 'error');
      }
  }, [state.error, showNotification]);

  // Cloud Sync Logic extracted
  const handleCloudLoad = useCallback(async (userId: string) => {
       dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'syncing' } });
       try {
           const cloudData = await FirebaseService.loadUserData(userId);
           
           if (cloudData && cloudData.sessions) {
                const cloudTime = new Date(cloudData.lastModified || 0).getTime();
                const storedSessionsString = localStorage.getItem(`zehngah_sessions_${userId}`);
                let localTime = 0;
                let localSessions: SavedSession[] = [];
                
                if (storedSessionsString) {
                    localSessions = JSON.parse(storedSessionsString);
                    if (localSessions.length > 0) {
                        localTime = Math.max(...localSessions.map(s => new Date(s.lastModified).getTime()));
                    }
                }

                if (cloudTime > localTime) {
                    dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: cloudData.sessions });
                    localStorage.setItem(`zehngah_sessions_${userId}`, JSON.stringify(cloudData.sessions));
                    if (cloudData.behavior) {
                         dispatch({ type: 'DEBUG_UPDATE', payload: { behavior: cloudData.behavior } });
                         localStorage.setItem(`zehngah_behavior_${userId}`, JSON.stringify(cloudData.behavior));
                    }
                    dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'success', lastSync: cloudData.lastModified } });
                    showNotification("اطلاعات شما با نسخه ابری به‌روز شد.");
                } else {
                     dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'success', lastSync: cloudData.lastModified } });
                }
           } else {
                dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'idle' } });
           }
       } catch (e: any) {
           console.error("Cloud Load Error", e);
           dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'error' } });
       }
  }, [showNotification]);

  const handleCloudSave = useCallback(async (userId: string, sessions: SavedSession[], behavior: UserBehavior) => {
      dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'syncing' } });
      try {
          const timestamp = new Date().toISOString();
          const dataToSave = { sessions, behavior, lastModified: timestamp };
          const success = await FirebaseService.saveUserData(userId, dataToSave);
          if (success) {
              dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'success', lastSync: timestamp } });
          } else {
               dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'error' } });
          }
      } catch (e: any) {
           console.error("Cloud Save Error", e);
           dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'error' } });
      }
  }, []);

  useEffect(() => {
      const storedTheme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', storedTheme);
      dispatch({ type: 'SET_THEME', payload: storedTheme });

      const storedUser = localStorage.getItem('zehngah_current_user');
      if (storedUser) {
          try {
              const user: UserProfile = JSON.parse(storedUser);
              dispatch({ type: 'SET_USER', payload: user });
              const storedSessions = localStorage.getItem(`zehngah_sessions_${user.id}`);
              if (storedSessions) {
                  dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: JSON.parse(storedSessions) });
              }
              handleCloudLoad(user.id);
          } catch (e: any) {
              console.error("Error parsing stored user", e);
          }
      }
  }, [handleCloudLoad]);

  useEffect(() => {
      FirebaseService.initialize();
  }, []);

  const handleEnableCloudSync = () => {
      if (state.currentUser) {
          handleCloudLoad(state.currentUser.id);
      } else {
          showNotification("لطفاً ابتدا وارد حساب شوید.", 'error');
      }
  };

  useEffect(() => {
      if (state.currentUser) {
          localStorage.setItem(`zehngah_behavior_${state.currentUser.id}`, JSON.stringify(state.behavior));
      }
  }, [state.behavior, state.currentUser]);

  useEffect(() => {
      const timer = setTimeout(() => {
          dispatch({ type: 'CHECK_DAILY_STATUS' });
      }, 2000);
      return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
      if (state.showDailyBriefing && !state.dailyChallengeContent && state.mindMap.length > 0) {
          generateDailyChallenge(state.weaknesses, state.sourceContent)
              .then(content => dispatch({ type: 'SET_DAILY_CHALLENGE', payload: content }))
              .catch((err: any) => console.error("Challenge gen failed", err));
      }
  }, [state.showDailyBriefing, state.dailyChallengeContent, state.mindMap, state.weaknesses, state.sourceContent]);

  useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'x') {
              setIsDebugOpen(prev => !prev);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogoClick = () => {
      const newCount = logoClickCount + 1;
      setLogoClickCount(newCount);
      if (newCount >= 5) {
          setIsDebugOpen(true);
          showNotification("حالت اشکال‌زدایی فعال شد");
          setLogoClickCount(0);
      }
  };

  const handleThemeToggle = () => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    dispatch({ type: 'SET_THEME', payload: newTheme });
  };

  const handleLogin = async (user: UserProfile) => {
      localStorage.setItem('zehngah_current_user', JSON.stringify(user));
      dispatch({ type: 'SET_USER', payload: user });
      const storedSessions = localStorage.getItem(`zehngah_sessions_${user.id}`);
      if (storedSessions) {
          dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: JSON.parse(storedSessions) });
      } else {
          dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: [] });
      }
      showNotification(`خوش آمدید، ${user.name}`);
      await handleCloudLoad(user.id);
  };

  const handleLogout = () => {
      localStorage.removeItem('zehngah_current_user');
      dispatch({ type: 'LOGOUT' });
      showNotification("با موفقیت خارج شدید");
  };

  // Memoized Save Session Handler
  const handleSaveSession = useCallback(async (title: string, isAutoSave = false) => {
      if (!state.currentUser) return;
      
      if (isAutoSave) dispatch({ type: 'SET_AUTO_SAVING', payload: true });

      const sessionData: SavableState = {
          version: CURRENT_APP_VERSION,
          sourceContent: state.sourceContent,
          sourcePageContents: state.sourcePageContents,
          sourceImages: state.sourceImages,
          preferences: state.preferences,
          mindMap: state.mindMap,
          suggestedPath: state.suggestedPath,
          preAssessmentAnalysis: state.preAssessmentAnalysis,
          nodeContents: state.nodeContents,
          userProgress: state.userProgress,
          weaknesses: state.weaknesses,
          behavior: state.behavior,
          rewards: state.rewards
      };
      
      const totalNodes = state.mindMap.length;
      const completedNodes = Object.values(state.userProgress).filter(p => p.status === 'completed').length;
      const progress = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

      let newSessions = [...state.savedSessions];
      let sessionId = state.currentSessionId;
      const now = new Date().toISOString();

      if (sessionId) {
          const index = newSessions.findIndex(s => s.id === sessionId);
          if (index !== -1) {
              newSessions[index] = {
                  ...newSessions[index],
                  lastModified: now,
                  progressPercentage: progress,
                  data: sessionData,
                  title: (title && !isAutoSave) ? title : newSessions[index].title
              };
          } else {
              sessionId = null;
          }
      }
      
      if (!sessionId) {
          sessionId = Math.random().toString(36).substr(2, 9);
          const newSession: SavedSession = {
            id: sessionId,
            userId: state.currentUser.id,
            title: title || `جلسه ${new Date().toLocaleDateString('fa-IR')}`,
            lastModified: now,
            progressPercentage: progress,
            topic: state.mindMap[0]?.title || 'بدون عنوان',
            data: sessionData
          };
          newSessions = [newSession, ...newSessions];
          dispatch({ type: 'SET_CURRENT_SESSION_ID', payload: sessionId });
      }

      localStorage.setItem(`zehngah_sessions_${state.currentUser.id}`, JSON.stringify(newSessions));
      dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: newSessions });

      handleCloudSave(state.currentUser.id, newSessions, state.behavior);

      if (isAutoSave) {
          setTimeout(() => {
              dispatch({ type: 'SET_AUTO_SAVING', payload: false });
          }, 800);
      }
  }, [state.currentUser, state.sourceContent, state.sourcePageContents, state.sourceImages, state.preferences, state.mindMap, state.suggestedPath, state.preAssessmentAnalysis, state.nodeContents, state.userProgress, state.weaknesses, state.behavior, state.rewards, state.savedSessions, state.currentSessionId, handleCloudSave]);

  const handleDeleteSession = (sessionId: string) => {
       if (!state.currentUser) return;
       const newSessions = state.savedSessions.filter(s => s.id !== sessionId);
       localStorage.setItem(`zehngah_sessions_${state.currentUser.id}`, JSON.stringify(newSessions));
       dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: newSessions });
       handleCloudSave(state.currentUser.id, newSessions, state.behavior);
       if (state.currentSessionId === sessionId) {
           dispatch({ type: 'SET_CURRENT_SESSION_ID', payload: null });
       }
  };

  const handleLoadSession = (session: SavedSession) => {
      if (!session || !session.data) {
          dispatch({ type: 'SET_ERROR', payload: 'خطا: داده‌های این جلسه خالی است.' });
          return;
      }
      dispatch({ type: 'LOAD_STATE', payload: session.data, sessionId: session.id });
  };
  
  // Auto-Save Logic
  useEffect(() => {
      if (state.status === AppStatus.LEARNING && state.currentUser && state.currentSessionId && state.mindMap.length > 0) {
          const timer = setTimeout(() => {
              handleSaveSession("", true);
          }, 5000);
          return () => clearTimeout(timer);
      }
  }, [state.userProgress, state.mindMap, state.rewards, state.behavior, state.status, state.currentUser, state.currentSessionId, handleSaveSession]);


  const handleExportUserData = (): string => {
      if (!state.currentUser) return '';
      const userData = {
          user: state.currentUser,
          sessions: state.savedSessions,
          behavior: state.behavior
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(userData))));
  };

  const handleImportUserData = (importString: string) => {
      try {
          const decoded = decodeURIComponent(escape(atob(importString)));
          const userData = JSON.parse(decoded);
          
          if (!userData.user || !userData.sessions) throw new Error("فرمت نامعتبر");
          
          localStorage.setItem('zehngah_current_user', JSON.stringify(userData.user));
          dispatch({ type: 'SET_USER', payload: userData.user });

          localStorage.setItem(`zehngah_sessions_${userData.user.id}`, JSON.stringify(userData.sessions));
          dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: userData.sessions });
          
          if (userData.behavior) {
             localStorage.setItem(`zehngah_behavior_${userData.user.id}`, JSON.stringify(userData.behavior));
          }
          
          handleCloudSave(userData.user.id, userData.sessions, userData.behavior || state.behavior);

          return true;
      } catch (e: any) {
          console.error("Import failed", e);
          return false;
      }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target?.result;
            if (!arrayBuffer) return;
            try {
                const loadingTask = pdfjsLib.getDocument(arrayBuffer);
                const pdf = await loadingTask.promise;
                let fullText = '';
                let pageContents: string[] = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += pageText + '\n\n';
                    pageContents.push(pageText);
                }
                 dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: fullText, sourcePageContents: pageContents, sourceImages: [] } });
            } catch (error: any) {
                console.error("PDF Error:", error);
                dispatch({ type: 'SET_ERROR', payload: 'خطا در خواندن فایل PDF.' });
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
             const result = e.target?.result as string;
             const base64Data = result.split(',')[1];
             const mimeType = file.type;
             dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: "تصویر آپلود شد.", sourcePageContents: null, sourceImages: [{mimeType, data: base64Data}] } });
        }
        reader.readAsDataURL(file);
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: text, sourcePageContents: null, sourceImages: [] } });
        };
        reader.readAsText(file);
    }
  };
  
  const handleStartFromText = () => {
      if (textInput.trim().length > 10) { 
          dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: textInput, sourcePageContents: null, sourceImages: [] } });
      } else {
          dispatch({ type: 'SET_ERROR', payload: 'لطفاً حداقل ۱۰ کاراکتر متن وارد کنید.' });
      }
  };

  const handleTopicStudy = () => {
      if (topicInput.trim().length > 2) {
          dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: topicInput, sourcePageContents: null, sourceImages: [] } });
      } else {
          dispatch({ type: 'SET_ERROR', payload: 'لطفاً یک موضوع معتبر وارد کنید.' });
      }
  };

  const handleRandomStudy = () => {
      const randomTopic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
      setTopicInput(randomTopic);
      dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: randomTopic, sourcePageContents: null, sourceImages: [] } });
  };

  const handleWizardComplete = (prefs: LearningPreferences) => {
      dispatch({ type: 'FINISH_WIZARD', payload: prefs });
  };

  const handleGeneratePlan = () => {
      if (state.mindMap.length > 0) return; 
      
      generateLearningPlan(
          state.sourceContent, 
          state.sourcePageContents, 
          state.sourceImages,
          state.preferences,
          (mindMap, suggestedPath) => dispatch({ type: 'MIND_MAP_GENERATED', payload: { mindMap, suggestedPath } }),
          (question) => dispatch({ type: 'PRE_ASSESSMENT_QUESTION_STREAMED', payload: question })
      ).then(quiz => {
          dispatch({ type: 'PRE_ASSESSMENT_STREAM_END' });
          if (state.currentUser) {
               handleSaveSession(`جلسه جدید ${new Date().toLocaleDateString('fa-IR')}`, true);
          }
      }).catch((error: any) => {
          dispatch({ type: 'SET_ERROR', payload: 'خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.' });
      });
  };

  useEffect(() => {
      if (state.status === AppStatus.LOADING) {
          handleGeneratePlan();
      }
  }, [state.status]);

  // Memoized Node Selection Handler
  const handleNodeSelect = useCallback((nodeId: string) => {
       if (state.activeNodeId === nodeId) return;

       dispatch({ type: 'SELECT_NODE', payload: nodeId });
       const node = state.mindMap.find(n => n.id === nodeId);
       
       if (state.nodeContents[nodeId]) {
           dispatch({ type: 'NODE_CONTENT_LOADED', payload: state.nodeContents[nodeId] });
       } else if (node) {
            const strengths = state.preAssessmentAnalysis?.strengths || [];
            const weaknesses = state.preAssessmentAnalysis?.weaknesses || [];
            const isIntro = node.parentId === null;
            
            dispatch({ type: 'NODE_CONTENT_STREAM_START' });
            
            let nodeContext = state.sourceContent;
            if (state.sourcePageContents && node.sourcePages.length > 0) {
                 nodeContext = node.sourcePages.map(p => state.sourcePageContents![p-1]).join('\n');
            }

            generateNodeContent(
                node.title, 
                nodeContext, 
                state.sourceImages,
                state.preferences, 
                strengths, 
                weaknesses,
                isIntro,
                node.type, 
                (partialContent) => dispatch({ type: 'NODE_CONTENT_STREAM_UPDATE', payload: partialContent })
            ).then(content => {
                dispatch({ type: 'NODE_CONTENT_STREAM_END', payload: { nodeId, content } });
            }).catch((err: any) => {
                console.error(err);
            });
       }
  }, [state.activeNodeId, state.mindMap, state.nodeContents, state.preAssessmentAnalysis, state.sourceContent, state.sourcePageContents, state.sourceImages, state.preferences]);
  
  const handleCompleteIntro = () => {
      dispatch({ type: 'COMPLETE_INTRO_NODE' });
  };

  // Memoized Quiz Handler
  const handleTakeQuiz = useCallback((nodeId: string) => {
      const node = state.mindMap.find(n => n.id === nodeId);
      if (!node) return;
      
      dispatch({ type: 'START_QUIZ', payload: nodeId });
      
       let nodeContext = state.sourceContent;
       if (state.sourcePageContents && node.sourcePages.length > 0) {
            nodeContext = node.sourcePages.map(p => state.sourcePageContents![p-1]).join('\n');
       }

      generateQuiz(node.title, nodeContext, state.sourceImages, (q) => dispatch({ type: 'QUIZ_QUESTION_STREAMED', payload: q }))
        .then(() => dispatch({ type: 'QUIZ_STREAM_END' }))
        .catch((err: any) => console.error(err));
  }, [state.mindMap, state.sourceContent, state.sourcePageContents, state.sourceImages]);

  const handleQuizSubmit = async (answers: Record<string, UserAnswer>) => {
      dispatch({ type: 'SUBMIT_QUIZ' });
      const node = state.mindMap.find(n => n.id === state.activeNodeId);
      if (!node || !state.activeQuiz) return;
      
      try {
           let nodeContext = state.sourceContent;
           if (state.sourcePageContents && node.sourcePages.length > 0) {
                nodeContext = node.sourcePages.map(p => state.sourcePageContents![p-1]).join('\n');
           }

          const gradingResults = await gradeAndAnalyzeQuiz(state.activeQuiz.questions, answers, nodeContext, state.sourceImages);
          
          const results: QuizResult[] = gradingResults.map((result) => {
              const question = state.activeQuiz?.questions.find(q => q.id === result.questionId);
              if (!question) throw new Error(`Question ${result.questionId} not found`);
              return {
                  question: question,
                  userAnswer: answers[result.questionId],
                  isCorrect: result.isCorrect,
                  score: result.score,
                  analysis: result.analysis
              };
          });

          const totalScore = results.reduce((sum, r) => sum + r.score, 0);
          const maxScore = results.reduce((sum, r) => sum + r.question.points, 0);
          const percentage = maxScore > 0 ? (totalScore / maxScore) : 0;
          let newReward: Reward | null = null;

          if (percentage >= 0.85) {
              const nodeContentText = state.nodeContents[node.id]?.theory || state.sourceContent.substring(0, 1000); 
              const rewardContent = await generateDeepAnalysis(node.title, nodeContentText);
              newReward = {
                  id: `reward_${node.id}`,
                  type: 'deep_analysis',
                  title: `تحلیل عمیق: ${node.title}`,
                  content: rewardContent,
                  unlockedAt: new Date().toISOString(),
                  relatedNodeId: node.id
              };
              dispatch({ type: 'UNLOCK_REWARD', payload: newReward });
          }

          dispatch({ type: 'QUIZ_ANALYSIS_LOADED', payload: { results } });
          
      } catch (err: any) {
          console.error(err);
      }
  };

  const handlePreAssessmentSubmit = async (answers: Record<string, UserAnswer>) => {
      if (!state.preAssessment) return;
      dispatch({ type: 'SUBMIT_PRE_ASSESSMENT', payload: answers });

      try {
          const analysis = await analyzePreAssessment(
              state.preAssessment.questions,
              answers,
              state.sourceContent
          );

          dispatch({ type: 'START_ADAPTING_PLAN' });

          let difficultyMod = 0;
          if (analysis.recommendedLevel === 'مبتدی') difficultyMod = -0.2;
          if (analysis.recommendedLevel === 'پیشرفته') difficultyMod = 0.2;

          const adaptedMindMap = state.mindMap.map(node => ({
              ...node,
              difficulty: Math.max(0.1, Math.min(0.9, node.difficulty + difficultyMod))
          }));

          dispatch({ 
              type: 'PLAN_ADAPTED', 
              payload: { 
                  analysis, 
                  mindMap: adaptedMindMap, 
                  suggestedPath: state.suggestedPath 
              } 
          });

      } catch (error) {
          console.error("Pre-assessment analysis failed", error);
          dispatch({ type: 'SET_ERROR', payload: 'خطا در تحلیل پیش‌آزمون.' });
      }
  };

  // Memoized Chat Handler
  const handleChatSend = useCallback(async (message: string) => {
      const userMsg: ChatMessage = { role: 'user', message };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMsg });

      try {
          let nodeTitle = null;
          let contextContent = state.sourceContent.substring(0, 1500);
          
          if (state.activeNodeId) {
              const node = state.mindMap.find(n => n.id === state.activeNodeId);
              if (node) {
                  nodeTitle = node.title;
                  if (state.nodeContents[node.id]) {
                      const c = state.nodeContents[node.id];
                      contextContent = `Context (${node.title}):\n${c.theory}\n---\nSource:\n${contextContent}`;
                  }
              }
          }

          const responseText = await generateChatResponse(
              state.chatHistory, 
              message, 
              nodeTitle, 
              contextContent
          );
          
          const modelMsg: ChatMessage = { role: 'model', message: responseText };
          dispatch({ type: 'ADD_CHAT_MESSAGE', payload: modelMsg });
      } catch (error) {
          dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'model', message: "متاسفانه ارتباط با سرور برقرار نشد." } });
      }
  }, [state.sourceContent, state.activeNodeId, state.mindMap, state.nodeContents, state.chatHistory]);

  const handleExplainRequest = (text: string) => {
      if (!state.isChatOpen) dispatch({ type: 'TOGGLE_CHAT' });
      handleChatSend(`لطفاً این قسمت را بیشتر توضیح بده: "${text}"`);
  };

  const handleRetryQuiz = () => {
      dispatch({ type: 'START_PERSONALIZED_LEARNING' });
  };

  const links = [
    {
        label: "خانه",
        href: "#",
        icon: <Home className="text-foreground h-5 w-5 flex-shrink-0" />,
        onClick: () => {
            if (state.status === AppStatus.IDLE) {
                showNotification('شما در صفحه خانه حضور دارید', 'error');
            } else {
                dispatch({ type: 'RESET' });
            }
        }
    },
    {
        label: "مربی هوشمند",
        href: "#",
        icon: <MessageSquare className="text-foreground h-5 w-5 flex-shrink-0" />,
        onClick: () => dispatch({ type: 'TOGGLE_CHAT' })
    },
    {
        label: "پروفایل من",
        href: "#",
        icon: <User className="text-foreground h-5 w-5 flex-shrink-0" />,
        onClick: () => dispatch({ type: 'TOGGLE_USER_PANEL' })
    }
  ];
  
  const ToolboxContent = () => (
      <div className="w-full h-full flex flex-col">
        <div className="p-4 border-b border-border font-bold text-foreground flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5" />
                <span>جعبه ابزار</span>
            </div>
            <button 
                onClick={() => setIsToolboxOpen(false)}
                className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground lg:hidden"
                title="بستن جعبه ابزار"
            >
                <ChevronLeft className="w-5 h-5 rotate-180" />
            </button>
             <button 
                onClick={() => setIsToolboxOpen(false)}
                className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground hidden lg:block"
                title="بستن جعبه ابزار"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
        </div>
        <div className="flex-grow overflow-y-auto p-2">
                <WeaknessTracker weaknesses={state.weaknesses} />
                <div className="h-px bg-border my-2 mx-4"></div>
                <PracticeZone />
        </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-background text-foreground overflow-hidden font-vazir transition-colors duration-300" dir="rtl">
      {showStartup && <StartupScreen onAnimationEnd={() => setShowStartup(false)} />}
      
      <ParticleBackground theme={state.theme} />

      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center z-[2000]"><BoxLoader size={150} /></div>}>

      {notification && <NotificationToast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      {isDebugOpen && (
          <DebugPanel 
              state={state}
              dispatch={dispatch}
              onClose={() => setIsDebugOpen(false)}
              onNotify={showNotification}
          />
      )}

      {state.showDailyBriefing && (
          <DailyBriefing 
              streak={state.behavior.dailyStreak}
              challengeContent={state.dailyChallengeContent}
              nextNode={state.mindMap.find(n => state.userProgress[n.id]?.status !== 'completed' && !n.locked) || null}
              onContinue={() => dispatch({ type: 'DISMISS_BRIEFING' })}
              onDismiss={() => dispatch({ type: 'DISMISS_BRIEFING' })}
          />
      )}

      {state.status === AppStatus.WIZARD && (
          <PersonalizationWizard 
             initialPreferences={state.preferences}
             onSubmit={handleWizardComplete}
             onSkip={() => handleWizardComplete(state.preferences)}
          />
      )}

      <UserPanel 
          isOpen={state.isUserPanelOpen}
          onClose={() => dispatch({ type: 'TOGGLE_USER_PANEL' })}
          user={state.currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          savedSessions={state.savedSessions}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
          onSaveCurrentSession={(title) => handleSaveSession(title, false)}
          hasCurrentSession={state.mindMap.length > 0}
          onExportData={handleExportUserData}
          onImportData={handleImportUserData}
          cloudStatus={state.cloudSyncStatus}
          lastSyncTime={state.cloudLastSync}
          onEnableCloudSync={handleEnableCloudSync}
      />

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody className="justify-between gap-10">
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col gap-2">
                    <div onClick={handleLogoClick} className="flex items-center gap-2 font-black text-lg text-foreground py-2 cursor-pointer mb-4">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                            <Brain className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ 
                                display: sidebarOpen ? "inline-block" : "none",
                                opacity: sidebarOpen ? 1 : 0
                            }}
                            transition={{ duration: 0.2 }}
                            className="font-extrabold tracking-tight whitespace-pre"
                        >
                            ذهن گاه
                        </motion.span>
                    </div>
                    {links.map((link, idx) => (
                        <SidebarLink key={idx} link={link} />
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-4">
                 <div className="flex justify-center md:justify-start px-2">
                    <ThemeToggle 
                        theme={state.theme} 
                        onToggle={handleThemeToggle} 
                        className={!sidebarOpen ? "w-8 h-4" : ""}
                    />
                 </div>

                 {state.currentUser ? (
                    <SidebarLink 
                        link={{
                            label: state.currentUser.name,
                            href: "#",
                            icon: state.currentUser.avatarUrl ? (
                                <img
                                    src={state.currentUser.avatarUrl}
                                    className="h-7 w-7 flex-shrink-0 rounded-full"
                                    width={50}
                                    height={50}
                                    alt="Avatar"
                                />
                            ) : (
                                 <div className="h-7 w-7 flex-shrink-0 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold" style={{ backgroundColor: state.currentUser.avatarColor }}>
                                    {state.currentUser.name.charAt(0).toUpperCase()}
                                </div>
                            ),
                            onClick: () => dispatch({ type: 'TOGGLE_USER_PANEL' })
                        }}
                    />
                 ) : (
                     <SidebarLink 
                        link={{
                            label: "ورود به حساب",
                            href: "#",
                            icon: <div className="h-7 w-7 flex-shrink-0 rounded-full bg-secondary flex items-center justify-center"><User className="w-4 h-4" /></div>,
                            onClick: () => dispatch({ type: 'TOGGLE_USER_PANEL' })
                        }}
                     />
                 )}
                 
                 {state.isAutoSaving && (
                     <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse px-2">
                         <Save className="w-3 h-3" />
                         <motion.span 
                            animate={{ display: sidebarOpen ? "inline-block" : "none" }}
                         >
                             ذخیره خودکار...
                         </motion.span>
                     </div>
                )}
                {state.cloudSyncStatus === 'syncing' && (
                     <div className="flex items-center gap-2 text-xs text-blue-500 animate-pulse px-2">
                         <Upload className="w-3 h-3" />
                         <motion.span 
                            animate={{ display: sidebarOpen ? "inline-block" : "none" }}
                         >
                             همگام‌سازی...
                         </motion.span>
                     </div>
                )}
            </div>
        </SidebarBody>
      </Sidebar>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
        
        <div className="flex-grow relative z-10 overflow-y-auto scroll-smooth">
             
            {state.status === AppStatus.IDLE && (
                <div className="max-w-5xl mx-auto mt-4 md:mt-10 p-4 md:p-6 space-y-6 md:space-y-8 animate-slide-up pb-32">
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600 py-2">
                           یادگیری عمیق با طعم هوش مصنوعی
                        </h2>
                        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            محتوای آموزشی خود را بارگذاری کنید یا یک موضوع را انتخاب کنید تا ذهن‌گاه آن را به یک نقشه ذهنی تعاملی، آزمون و مسیر یادگیری تبدیل کند.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                         <div className="stylish-textarea-wrapper p-1 bg-gradient-to-br from-border to-transparent">
                            <div className="bg-card rounded-xl p-4 h-full flex flex-col relative">
                                <div className="flex items-center gap-2 mb-3 text-primary">
                                    <FileText className="w-5 h-5" />
                                    <span className="font-bold">متن خام</span>
                                </div>
                                <textarea 
                                    className="w-full flex-grow bg-transparent border-none resize-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50 min-h-[120px] mb-12" 
                                    placeholder="متن مقاله، جزوه یا کتاب خود را اینجا پیست کنید..."
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <button 
                                        onClick={handleStartFromText}
                                        disabled={!textInput.trim()}
                                        className="w-full py-3 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                                    >
                                        <span>شروع پردازش</span>
                                        <Wand className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                         <div className="stylish-textarea-wrapper p-1 bg-gradient-to-b from-border to-transparent">
                            <div className="bg-card rounded-xl p-4 h-full flex flex-col relative">
                                <div className="flex items-center justify-between gap-2 mb-3 text-purple-500">
                                    <div className="flex items-center gap-2">
                                        <FileQuestion className="w-5 h-5" />
                                        <span className="font-bold">کاوش موضوعی</span>
                                    </div>
                                    <button 
                                        onClick={handleRandomStudy}
                                        className="p-1.5 bg-purple-500/10 rounded-full hover:bg-purple-500/20 transition-colors"
                                        title="موضوع شانسی"
                                    >
                                        <Shuffle className="w-4 h-4" />
                                    </button>
                                </div>
                                <textarea 
                                    className="w-full flex-grow bg-transparent border-none resize-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50 min-h-[120px] mb-12" 
                                    placeholder="موضوعی که دوست دارید یاد بگیرید را بنویسید (مثلاً: تاریخ روم باستان)..."
                                    value={topicInput}
                                    onChange={(e) => setTopicInput(e.target.value)}
                                />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <button 
                                        onClick={handleTopicStudy}
                                        disabled={!topicInput.trim()}
                                        className="w-full py-3 flex items-center justify-center gap-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                                    >
                                        <span>تحقیق و ساخت مسیر</span>
                                        <BrainCircuit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="stylish-textarea-wrapper p-1 bg-gradient-to-bl from-border to-transparent group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                             <div className="bg-card rounded-xl p-4 h-full flex flex-col items-center justify-center text-center border-2 border-dashed border-transparent group-hover:border-primary/20 transition-all min-h-[200px]">
                                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-primary shadow-sm">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <h3 className="font-bold text-lg">آپلود فایل</h3>
                                <p className="text-sm text-muted-foreground mt-2">PDF، متن یا تصویر</p>
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,image/*" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-8 md:mt-12">
                        {[
                            { icon: BrainCircuit, title: "نقشه ذهنی", desc: "ساختاردهی هوشمند" },
                            { icon: Target, title: "آزمون تطبیقی", desc: "سنجش دقیق سطح" },
                            { icon: MessageSquare, title: "مربی شخصی", desc: "رفع اشکال آنی" },
                            { icon: Sparkles, title: "خلاصه ساز", desc: "مرور سریع" }
                        ].map((f, i) => (
                            <div key={i} className="p-3 md:p-4 rounded-xl bg-secondary/30 border border-border text-center hover:bg-secondary/50 transition-colors">
                                <f.icon className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 text-primary" />
                                <h4 className="font-bold text-xs md:text-sm">{f.title}</h4>
                                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {state.status === AppStatus.ERROR && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 fade-in p-8 text-center">
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
                         <XCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold">خطایی رخ داده است</h2>
                    <p className="text-muted-foreground max-w-md">{state.error || 'مشکلی پیش آمده.'}</p>
                    <button 
                        onClick={() => dispatch({ type: 'RESET' })}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-bold flex items-center gap-2"
                    >
                        <span>بازگشت به خانه</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {(state.status === AppStatus.LOADING || state.status === AppStatus.GENERATING_REMEDIAL || state.status === AppStatus.GRADING_PRE_ASSESSMENT || state.status === AppStatus.ADAPTING_PLAN) && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 fade-in">
                    <BoxLoader size={120} />
                    <p className="text-xl font-medium text-muted-foreground animate-pulse px-4 text-center">
                        {state.loadingMessage || (state.status === AppStatus.GRADING_PRE_ASSESSMENT ? 'در حال تحلیل پاسخ‌ها و تعیین سطح...' : 'در حال پردازش...')}
                    </p>
                    {state.status === AppStatus.ADAPTING_PLAN && (
                        <div className="flex items-center gap-2 text-sm text-purple-500 bg-purple-500/10 px-3 py-1 rounded-full">
                             <Sparkles className="w-4 h-4 animate-pulse" />
                             <span>بهینه‌سازی هوشمند مسیر یادگیری</span>
                        </div>
                    )}
                </div>
            )}

            {state.status === AppStatus.PLAN_REVIEW && (
                 <div className="flex flex-col h-full">
                    <div className="flex-grow relative">
                        <MindMap 
                            nodes={state.mindMap} 
                            progress={{}} 
                            suggestedPath={state.suggestedPath}
                            onSelectNode={() => {}} 
                            onTakeQuiz={() => {}}
                            theme={state.theme}
                            activeNodeId={null}
                            showSuggestedPath={true}
                        />
                         <div className="absolute bottom-20 md:bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
                             <div className="bg-card/90 backdrop-blur border border-border p-4 rounded-xl shadow-2xl text-center">
                                 <h3 className="font-bold text-lg mb-2">نقشه یادگیری شما آماده است</h3>
                                 <p className="text-sm text-muted-foreground mb-4">این ساختار بر اساس محتوای شما طراحی شده است. برای شخصی‌سازی بیشتر، ابتدا یک پیش‌آزمون کوتاه می‌دهیم.</p>
                                 <button 
                                    onClick={() => dispatch({ type: 'CONFIRM_PLAN', payload: { mindMap: state.mindMap } })}
                                    className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                                >
                                    <span>تایید و شروع پیش‌آزمون</span>
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {state.status === AppStatus.PRE_ASSESSMENT && state.preAssessment && (
                <QuizView 
                    title="پیش‌آزمون تعیین سطح" 
                    quiz={state.preAssessment} 
                    onSubmit={handlePreAssessmentSubmit} 
                />
            )}

            {state.status === AppStatus.PRE_ASSESSMENT_REVIEW && state.preAssessmentAnalysis && (
                <PreAssessmentReview 
                    analysis={state.preAssessmentAnalysis} 
                    onStart={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} 
                />
            )}

            {(state.status === AppStatus.LEARNING || state.status === AppStatus.VIEWING_NODE || state.status === AppStatus.TAKING_QUIZ || state.status === AppStatus.GRADING_QUIZ || state.status === AppStatus.QUIZ_REVIEW) && (
                <div className="flex flex-col h-full relative">
                    <div className="absolute inset-0 z-0">
                        <MindMap 
                            nodes={state.mindMap} 
                            progress={Object.keys(state.userProgress).reduce((acc, key) => ({...acc, [key]: state.userProgress[key].status}), {} as {[key: string]: 'completed' | 'failed' | 'in_progress'})} 
                            suggestedPath={state.suggestedPath}
                            onSelectNode={handleNodeSelect} 
                            onTakeQuiz={handleTakeQuiz}
                            theme={state.theme}
                            activeNodeId={state.activeNodeId}
                            showSuggestedPath={true}
                        />
                         {state.status === AppStatus.LEARNING && (
                            <div className="absolute top-4 right-4 z-30 bg-card/80 backdrop-blur p-3 rounded-lg border border-border shadow-sm max-w-[200px] hidden md:block">
                                <p className="text-xs text-muted-foreground">مسیر پیشنهادی با شماره مشخص شده است. از گره شماره ۱ شروع کنید.</p>
                            </div>
                        )}
                    </div>

                    {state.status !== AppStatus.LEARNING && (
                        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto animate-zoom-in">
                            {state.status === AppStatus.VIEWING_NODE && state.activeNodeId && (
                                <NodeView 
                                    node={state.mindMap.find(n => n.id === state.activeNodeId)!} 
                                    content={state.streamingNodeContent || state.nodeContents[state.activeNodeId] || { introduction: '', theory: '', example: '', connection: '', conclusion: '', suggestedQuestions: [] }} 
                                    onBack={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })}
                                    onStartQuiz={() => handleTakeQuiz(state.activeNodeId!)}
                                    onNavigate={handleNodeSelect}
                                    prevNode={null}
                                    nextNode={null}
                                    onExplainRequest={handleExplainRequest}
                                    isIntroNode={state.mindMap.find(n => n.id === state.activeNodeId)?.parentId === null}
                                    onCompleteIntro={handleCompleteIntro}
                                    unlockedReward={state.rewards.find(r => r.relatedNodeId === state.activeNodeId)}
                                    isStreaming={!!state.streamingNodeContent}
                                />
                            )}

                            {state.status === AppStatus.TAKING_QUIZ && state.activeQuiz && (
                                <QuizView 
                                    title={`آزمون: ${state.mindMap.find(n => n.id === state.activeNodeId)?.title}`} 
                                    quiz={state.activeQuiz} 
                                    onSubmit={handleQuizSubmit} 
                                />
                            )}

                            {state.status === AppStatus.GRADING_QUIZ && (
                                <div className="flex flex-col items-center justify-center h-full space-y-4">
                                    <BoxLoader size={100} />
                                    <p className="text-lg font-medium">در حال تصحیح و تحلیل پاسخ‌ها...</p>
                                    <p className="text-sm text-muted-foreground animate-pulse">اگر عملکردتان عالی باشد، پاداش دریافت می‌کنید...</p>
                                </div>
                            )}

                            {state.status === AppStatus.QUIZ_REVIEW && state.quizResults && (
                                <QuizReview 
                                    results={state.quizResults} 
                                    onFinish={handleRetryQuiz} 
                                    attempts={state.userProgress[state.activeNodeId!]?.attempts || 1}
                                    onForceUnlock={() => dispatch({ type: 'FORCE_UNLOCK_NODE' })}
                                    rewardUnlocked={!!state.rewards.find(r => r.relatedNodeId === state.activeNodeId && new Date(r.unlockedAt).getTime() > Date.now() - 60000)}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        <motion.div 
            className="hidden lg:flex flex-col border-r border-border bg-card/50 backdrop-blur-sm shrink-0 relative z-10 overflow-hidden transition-all h-full"
            initial={{ width: 320, opacity: 1 }}
            animate={{ 
                width: isToolboxOpen ? 320 : 0,
                opacity: isToolboxOpen ? 1 : 0
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
        >
            <div className="w-[20rem] h-full">
                <ToolboxContent />
            </div>
        </motion.div>

        <AnimatePresence>
            {isToolboxOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsToolboxOpen(false)}
                        className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        style={{ touchAction: 'none' }}
                    />
                    <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="lg:hidden fixed top-0 left-0 bottom-0 w-80 max-w-[85%] bg-card border-r border-border z-[70] shadow-2xl h-[100dvh] overflow-hidden"
                    >
                        <ToolboxContent />
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        <AnimatePresence>
        {!isToolboxOpen && (
            <motion.div 
                className="absolute left-0 bottom-8 z-50"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
            >
                <button 
                    onClick={() => setIsToolboxOpen(true)}
                    className="flex items-center gap-2 bg-card border border-border border-l-0 rounded-r-xl p-3 shadow-lg hover:bg-secondary transition-all group"
                    title="باز کردن جعبه ابزار"
                >
                    <SlidersHorizontal className="w-5 h-5 text-primary" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary hidden lg:block" />
                     <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary lg:hidden rotate-180" />
                </button>
            </motion.div>
        )}
        </AnimatePresence>

        {state.isChatOpen && (
            <ChatPanel 
                history={state.chatHistory} 
                isFullScreen={state.isChatFullScreen} 
                initialMessage=""
                onSend={handleChatSend} 
                onClose={() => dispatch({ type: 'TOGGLE_CHAT' })}
                onToggleFullScreen={() => dispatch({ type: 'TOGGLE_FULLSCREEN_CHAT' })}
                onInitialMessageConsumed={() => {}}
            />
        )}
      
      </main>

      </Suspense>
    </div>
  );
}

export default App;
