

import React, { useState, useReducer, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { AppState, MindMapNode, Quiz, Weakness, LearningPreferences, NodeContent, AppStatus, UserAnswer, QuizResult, SavableState, PreAssessmentAnalysis, ChatMessage, QuizQuestion, NodeProgress, Reward, UserBehavior, UserProfile, SavedSession } from './types';
import { generateLearningPlan, generateNodeContent, generateQuiz, generateFinalExam, generateCorrectiveSummary, generatePracticeResponse, gradeAndAnalyzeQuiz, analyzePreAssessment, generateChatResponse, generateRemedialNode, generateDailyChallenge, generateDeepAnalysis } from './services/geminiService';
import { ArrowRight, BookOpen, Brain, BrainCircuit, CheckCircle, ClipboardList, Home, MessageSquare, Moon, Sun, XCircle, Save, Upload, FileText, Target, Maximize, Minimize, SlidersHorizontal, ChevronDown, Sparkles, Trash, Edit, Flame, Diamond, Scroll, User, LogOut, Wand } from './components/icons';
import Spinner from './components/Spinner';
import StartupScreen from './components/StartupScreen';
import ParticleBackground from './components/ParticleBackground';

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

const CURRENT_APP_VERSION = 7;
declare var pdfjsLib: any;

// --- Security Utility ---
const hashPassword = async (password: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
// ------------------------

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
  isAutoSaving: false
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
    case 'PRE_ASSESSMENT_ANALYSIS_LOADED':
        return { ...state, status: AppStatus.PRE_ASSESSMENT_REVIEW, preAssessmentAnalysis: action.payload };
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
      return { ...state, finalExam: { ...state.finalExam, questions: [...state.finalExam.questions, action.payload] }, activeQuiz: { ...state.activeQuiz!, questions: [...state.activeQuiz!.questions, action.payload] } };
    case 'FINAL_EXAM_STREAM_END':
      if (!state.finalExam) return state;
      return { ...state, finalExam: { ...state.finalExam, isStreaming: false }, activeQuiz: { ...state.activeQuiz!, isStreaming: false } };
    case 'COMPLETE_FINAL_EXAM':
        return { ...state, status: AppStatus.GRADING_QUIZ };
    case 'SUMMARY_LOADED':
        return { ...state, status: AppStatus.SUMMARY, finalExam: null, correctiveSummary: action.payload.summary };
    case 'LOAD_STATE':
        return { ...initialState, ...action.payload, currentUser: state.currentUser, savedSessions: state.savedSessions, currentSessionId: action.sessionId, status: action.payload.preAssessmentAnalysis ? AppStatus.LEARNING : AppStatus.IDLE };
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
        return { ...state, currentUser: null, savedSessions: [], currentSessionId: null };
    case 'UPDATE_SAVED_SESSIONS':
        return { ...state, savedSessions: action.payload };
    case 'SET_CURRENT_SESSION_ID':
        return { ...state, currentSessionId: action.payload };
    case 'SET_AUTO_SAVING':
        return { ...state, isAutoSaving: action.payload };
    case 'TOGGLE_CHAT':
      return { ...state, isChatOpen: !state.isChatOpen };
    case 'TOGGLE_FULLSCREEN_CHAT':
      return { ...state, isChatFullScreen: !state.isChatFullScreen };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'SET_ERROR':
      return { ...state, error: action.payload, status: AppStatus.ERROR, loadingMessage: null };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [showStartup, setShowStartup] = useState(true);
  const [textInput, setTextInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      // Initialize Theme
      const storedTheme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', storedTheme);
      dispatch({ type: 'SET_THEME', payload: storedTheme });

      // Initialize User from LocalStorage
      const storedUser = localStorage.getItem('zehngah_current_user');
      if (storedUser) {
          try {
              const user: UserProfile = JSON.parse(storedUser);
              dispatch({ type: 'SET_USER', payload: user });
              
              // Load sessions
              const storedSessions = localStorage.getItem(`zehngah_sessions_${user.id}`);
              if (storedSessions) {
                  dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: JSON.parse(storedSessions) });
              }
          } catch (e) {
              console.error("Error parsing stored user", e);
          }
      }
  }, []);

  // Persist behavior changes to local storage for the current user if logged in, or generic storage
  useEffect(() => {
      if (state.currentUser) {
          localStorage.setItem(`zehngah_behavior_${state.currentUser.id}`, JSON.stringify(state.behavior));
      }
  }, [state.behavior, state.currentUser]);

  useEffect(() => {
      // Check daily status once on mount
      const timer = setTimeout(() => {
          dispatch({ type: 'CHECK_DAILY_STATUS' });
      }, 2000);
      return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
      // Load Daily Challenge if needed
      if (state.showDailyBriefing && !state.dailyChallengeContent && state.mindMap.length > 0) {
          generateDailyChallenge(state.weaknesses, state.sourceContent)
              .then(content => dispatch({ type: 'SET_DAILY_CHALLENGE', payload: content }))
              .catch(err => console.error("Challenge gen failed", err));
      }
  }, [state.showDailyBriefing, state.dailyChallengeContent, state.mindMap, state.weaknesses, state.sourceContent]);


  const handleThemeChange = (theme: 'light' | 'balanced' | 'dark') => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  // --- Auth Handlers ---
  
  const checkEmailExists = async (email: string): Promise<boolean> => {
      const usersStr = localStorage.getItem('zehngah_users');
      const users: UserProfile[] = usersStr ? JSON.parse(usersStr) : [];
      return users.some(u => u.email.toLowerCase() === email.toLowerCase());
  };

  const handleLogin = async (email: string, password: string) => {
      const usersStr = localStorage.getItem('zehngah_users');
      let users: UserProfile[] = usersStr ? JSON.parse(usersStr) : [];
      
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
          throw new Error('کاربری با این ایمیل یافت نشد.');
      }

      const inputHash = await hashPassword(password);
      if (user.passwordHash !== inputHash) {
          throw new Error('رمز عبور اشتباه است.');
      }

      localStorage.setItem('zehngah_current_user', JSON.stringify(user));
      dispatch({ type: 'SET_USER', payload: user });
      
      // Load sessions
      const storedSessions = localStorage.getItem(`zehngah_sessions_${user.id}`);
      if (storedSessions) {
          dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: JSON.parse(storedSessions) });
      }
  };

  const handleRegister = async (email: string, password: string, name: string) => {
      const usersStr = localStorage.getItem('zehngah_users');
      let users: UserProfile[] = usersStr ? JSON.parse(usersStr) : [];
      
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('این ایمیل قبلاً ثبت شده است.');
      }

      const passHash = await hashPassword(password);
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newUser: UserProfile = {
          id: Math.random().toString(36).substr(2, 9),
          name: name || email.split('@')[0],
          email: email.toLowerCase(),
          passwordHash: passHash,
          avatarColor: randomColor,
          joinDate: new Date().toISOString(),
          isVerified: true // Since they passed the verification step
      };

      users.push(newUser);
      localStorage.setItem('zehngah_users', JSON.stringify(users));
      
      // Auto login
      localStorage.setItem('zehngah_current_user', JSON.stringify(newUser));
      dispatch({ type: 'SET_USER', payload: newUser });
      dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: [] });
  };

  const handleLogout = () => {
      localStorage.removeItem('zehngah_current_user');
      dispatch({ type: 'LOGOUT' });
  };

  const handleSaveSession = (title: string, isAutoSave = false) => {
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

      if (sessionId) {
          // Update existing session
          const index = newSessions.findIndex(s => s.id === sessionId);
          if (index !== -1) {
              newSessions[index] = {
                  ...newSessions[index],
                  lastModified: new Date().toISOString(),
                  progressPercentage: progress,
                  data: sessionData,
                  title: (title && !isAutoSave) ? title : newSessions[index].title
              };
          } else {
              // Session ID exists but not found in list (shouldn't happen, but safety fallback)
              sessionId = null;
          }
      }
      
      if (!sessionId) {
          // Create new session
          sessionId = Math.random().toString(36).substr(2, 9);
          const newSession: SavedSession = {
            id: sessionId,
            userId: state.currentUser.id,
            title: title || `جلسه ${new Date().toLocaleDateString('fa-IR')}`,
            lastModified: new Date().toISOString(),
            progressPercentage: progress,
            topic: state.mindMap[0]?.title || 'بدون عنوان',
            data: sessionData
          };
          newSessions = [newSession, ...newSessions];
          dispatch({ type: 'SET_CURRENT_SESSION_ID', payload: sessionId });
      }

      localStorage.setItem(`zehngah_sessions_${state.currentUser.id}`, JSON.stringify(newSessions));
      dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: newSessions });

      if (isAutoSave) {
          setTimeout(() => {
              dispatch({ type: 'SET_AUTO_SAVING', payload: false });
          }, 800);
      }
  };

  const handleDeleteSession = (sessionId: string) => {
       if (!state.currentUser) return;
       const newSessions = state.savedSessions.filter(s => s.id !== sessionId);
       localStorage.setItem(`zehngah_sessions_${state.currentUser.id}`, JSON.stringify(newSessions));
       dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: newSessions });
       if (state.currentSessionId === sessionId) {
           dispatch({ type: 'SET_CURRENT_SESSION_ID', payload: null });
       }
  };

  const handleLoadSession = (session: SavedSession) => {
      dispatch({ type: 'LOAD_STATE', payload: session.data, sessionId: session.id });
  };
  
  // --- Auto-Save Logic ---
  useEffect(() => {
      // Only auto-save if user is logged in, has a session ID, and there is content
      if (state.status === AppStatus.LEARNING && state.currentUser && state.currentSessionId && state.mindMap.length > 0) {
          const timer = setTimeout(() => {
              handleSaveSession("", true);
          }, 3000); // Auto-save 3 seconds after last change
          return () => clearTimeout(timer);
      }
  }, [state.userProgress, state.mindMap, state.rewards, state.behavior, state.status, state.currentUser, state.currentSessionId]);


  // --- Export/Import Data Logic (Multi-Device Sync Simulation) ---
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
          
          // 1. Update/Merge User
          const usersStr = localStorage.getItem('zehngah_users');
          let users: UserProfile[] = usersStr ? JSON.parse(usersStr) : [];
          // Check if user exists, if not add them
          if (!users.some(u => u.email === userData.user.email)) {
              users.push(userData.user);
              localStorage.setItem('zehngah_users', JSON.stringify(users));
          }
          
          // 2. Set Current User
          localStorage.setItem('zehngah_current_user', JSON.stringify(userData.user));
          dispatch({ type: 'SET_USER', payload: userData.user });

          // 3. Update Sessions
          localStorage.setItem(`zehngah_sessions_${userData.user.id}`, JSON.stringify(userData.sessions));
          dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: userData.sessions });
          
          // 4. Update Behavior
          if (userData.behavior) {
             localStorage.setItem(`zehngah_behavior_${userData.user.id}`, JSON.stringify(userData.behavior));
          }

          return true;
      } catch (e) {
          console.error("Import failed", e);
          return false;
      }
  };
  // ----------------------------

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
                 // TRIGGER WIZARD INSTEAD OF GENERATION
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
             // TRIGGER WIZARD
             dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: "تصویر آپلود شد.", sourcePageContents: null, sourceImages: [{mimeType, data: base64Data}] } });
        }
        reader.readAsDataURL(file);
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            // TRIGGER WIZARD
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

  const handleWizardComplete = (prefs: LearningPreferences) => {
      dispatch({ type: 'FINISH_WIZARD', payload: prefs });
      // The useEffect below will trigger handleGeneratePlan because status becomes LOADING
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
          // Auto-init session on first generation if logged in
          if (state.currentUser) {
               handleSaveSession(`جلسه جدید ${new Date().toLocaleDateString('fa-IR')}`, true);
          }
      }).catch((error: any) => {
          dispatch({ type: 'SET_ERROR', payload: 'خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.' });
      });
  };

  // Trigger generation automatically when status is LOADING (which happens after Wizard)
  useEffect(() => {
      if (state.status === AppStatus.LOADING) {
          handleGeneratePlan();
      }
  }, [state.status]);

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
                node.type, // Pass the node type (core, remedial, etc.)
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

  const handleTakeQuiz = (nodeId: string) => {
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
  };

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

          dispatch({ type: 'QUIZ_ANALYSIS_LOADED', payload: { results } });
          
          const totalScore = results.reduce((sum, r) => sum + r.score, 0);
          const maxScore = results.reduce((sum, r) => sum + r.question.points, 0);
          const percentage = maxScore > 0 ? (totalScore / maxScore) : 0;

          if (percentage >= 0.85) {
              const nodeContentText = state.nodeContents[node.id]?.theory || '';
              const rewardContent = await generateDeepAnalysis(node.title, nodeContentText);
              
              const reward: Reward = {
                  id: `reward_${node.id}`,
                  type: 'deep_analysis',
                  title: `تحلیل عمیق: ${node.title}`,
                  content: rewardContent,
                  unlockedAt: new Date().toISOString(),
                  relatedNodeId: node.id
              };
              
              dispatch({ type: 'UNLOCK_REWARD', payload: reward });
          }
          
      } catch (err: any) {
          console.error(err);
      }
  };

  const handlePreAssessmentSubmit = async (answers: Record<string, UserAnswer>) => {
      dispatch({ type: 'SUBMIT_PRE_ASSESSMENT', payload: answers });
      if (state.preAssessment) {
          try {
            const analysis = await analyzePreAssessment(state.preAssessment.questions, answers, state.sourceContent);
            dispatch({ type: 'PRE_ASSESSMENT_ANALYSIS_LOADED', payload: analysis });
          } catch (err: any) {
              console.error(err);
          }
      }
  };

  const handleExplainRequest = (text: string) => {
      dispatch({ type: 'RECORD_EXPLANATION_REQUEST' });
      dispatch({ type: 'TOGGLE_CHAT' });
      const msg: ChatMessage = { role: 'user', message: `می‌توانی درباره "${text}" بیشتر توضیح دهی؟` };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: msg });
      
      const activeNodeTitle = state.activeNodeId ? state.mindMap.find(n => n.id === state.activeNodeId)?.title || null : null;

      generateChatResponse([...state.chatHistory, msg], text, activeNodeTitle, state.sourceContent)
        .then(response => dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'model', message: response } }))
        .catch((err: any) => console.error(err));
  };

  const handleChatSend = (message: string) => {
      const msg: ChatMessage = { role: 'user', message };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: msg });
      const activeNodeTitle = state.activeNodeId ? state.mindMap.find(n => n.id === state.activeNodeId)?.title || null : null;
      generateChatResponse([...state.chatHistory, msg], message, activeNodeTitle, state.sourceContent)
        .then(response => dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'model', message: response } }))
        .catch((err: any) => console.error(err));
  };

  const handleRetryQuiz = () => {
      const result = state.quizResults;
      if (!result) return;

      const failedQuestions = result.filter(r => !r.isCorrect);
      const parentNode = state.mindMap.find(n => n.id === state.activeNodeId);
      
      if (failedQuestions.length > 0 && parentNode) {
           dispatch({ type: 'START_REMEDIAL_GENERATION' });
           const weaknesses: Weakness[] = failedQuestions.map(r => ({
               question: r.question.question,
               incorrectAnswer: String(r.userAnswer),
               correctAnswer: r.question.type === 'multiple-choice' ? r.question.options[r.question.correctAnswerIndex] : r.question.correctAnswer
           }));

            let nodeContext = state.sourceContent;
            if (state.sourcePageContents && parentNode.sourcePages.length > 0) {
                    nodeContext = parentNode.sourcePages.map(p => state.sourcePageContents![p-1]).join('\n');
            }

           generateRemedialNode(parentNode.title, weaknesses, nodeContext, state.sourceImages)
            .then(remedialNode => {
                 remedialNode.parentId = parentNode.parentId; 
                 dispatch({ type: 'ADD_REMEDIAL_NODE', payload: { remedialNode, originalNodeId: parentNode.id } });
            })
            .catch(() => dispatch({ type: 'CANCEL_REMEDIAL_GENERATION' }));
      } else {
           dispatch({ type: 'RETRY_QUIZ_IMMEDIATELY' });
           dispatch({ type: 'START_PERSONALIZED_LEARNING' });
           dispatch({ type: 'SELECT_NODE', payload: state.activeNodeId }); 
      }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-vazir transition-colors duration-300" dir="rtl">
      {showStartup && <StartupScreen onAnimationEnd={() => setShowStartup(false)} />}
      
      <ParticleBackground theme={state.theme} />

      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center z-[2000]"><Spinner size={50} /></div>}>

      {/* Daily Briefing Overlay */}
      {state.showDailyBriefing && (
          <DailyBriefing 
              streak={state.behavior.dailyStreak}
              challengeContent={state.dailyChallengeContent}
              nextNode={state.mindMap.find(n => state.userProgress[n.id]?.status !== 'completed' && !n.locked) || null}
              onContinue={() => dispatch({ type: 'DISMISS_BRIEFING' })}
              onDismiss={() => dispatch({ type: 'DISMISS_BRIEFING' })}
          />
      )}

      {/* Personalization Wizard Overlay */}
      {state.status === AppStatus.WIZARD && (
          <PersonalizationWizard 
             initialPreferences={state.preferences}
             onSubmit={handleWizardComplete}
             onSkip={() => handleWizardComplete(state.preferences)}
          />
      )}

      {/* User Panel Overlay */}
      <UserPanel 
          isOpen={state.isUserPanelOpen}
          onClose={() => dispatch({ type: 'TOGGLE_USER_PANEL' })}
          user={state.currentUser}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onCheckEmail={checkEmailExists}
          onLogout={handleLogout}
          savedSessions={state.savedSessions}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
          onSaveCurrentSession={(title) => handleSaveSession(title, false)}
          hasCurrentSession={state.mindMap.length > 0}
          onExportData={handleExportUserData}
          onImportData={handleImportUserData}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/80 backdrop-blur-md z-50 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                 <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">ذهن گاه</h1>
            {state.isAutoSaving && (
                 <div className="flex items-center gap-2 mr-4 text-xs text-muted-foreground animate-pulse">
                     <Save className="w-3 h-3" />
                     <span>ذخیره خودکار...</span>
                 </div>
            )}
        </div>
        
        <div className="flex items-center gap-3">
           <button 
              onClick={() => dispatch({ type: 'TOGGLE_USER_PANEL' })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary hover:bg-accent transition-colors border border-transparent hover:border-primary/20"
           >
               {state.currentUser ? (
                   <>
                       <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: state.currentUser.avatarColor }}>
                           {state.currentUser.name.charAt(0).toUpperCase()}
                       </div>
                       <span className="text-sm font-medium hidden sm:block">{state.currentUser.name}</span>
                   </>
               ) : (
                   <>
                       <User className="w-5 h-5 text-muted-foreground" />
                       <span className="text-sm font-medium text-muted-foreground hidden sm:block">ورود / ثبت نام</span>
                   </>
               )}
           </button>

           <button onClick={() => dispatch({ type: 'TOGGLE_CHAT' })} className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative">
              <MessageSquare className="w-5 h-5" />
              {state.chatHistory.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>}
           </button>
           <div className="w-px h-6 bg-border mx-1"></div>
           <button onClick={() => handleThemeChange('light')} className={`p-2 rounded-full transition-all ${state.theme === 'light' ? 'bg-yellow-100 text-yellow-600 shadow-inner' : 'hover:bg-accent text-muted-foreground'}`}><Sun className="w-5 h-5" /></button>
           <button onClick={() => handleThemeChange('balanced')} className={`p-2 rounded-full transition-all ${state.theme === 'balanced' ? 'bg-slate-200 text-slate-700 shadow-inner' : 'hover:bg-accent text-muted-foreground'}`}><SlidersHorizontal className="w-5 h-5" /></button>
           <button onClick={() => handleThemeChange('dark')} className={`p-2 rounded-full transition-all ${state.theme === 'dark' ? 'bg-indigo-900/50 text-indigo-300 shadow-inner' : 'hover:bg-accent text-muted-foreground'}`}><Moon className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-grow relative overflow-hidden flex flex-col md:flex-row main-content">
        
        <div className="flex-grow relative z-10 overflow-y-auto scroll-smooth">
             
             {/* Status: IDLE / Input */}
            {state.status === AppStatus.IDLE && (
                <div className="max-w-4xl mx-auto mt-10 p-6 space-y-8 animate-slide-up pb-32">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600 py-2">
                           یادگیری عمیق با طعم هوش مصنوعی
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            محتوای آموزشی خود را بارگذاری کنید تا ذهن‌گاه آن را به یک نقشه ذهنی تعاملی، آزمون‌های هوشمند و مسیر یادگیری شخصی‌سازی شده تبدیل کند.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Text Input */}
                         <div className="stylish-textarea-wrapper p-1 bg-gradient-to-br from-border to-transparent">
                            <div className="bg-card rounded-xl p-4 h-full flex flex-col relative">
                                <div className="flex items-center gap-2 mb-3 text-primary">
                                    <FileText className="w-5 h-5" />
                                    <span className="font-bold">متن خام</span>
                                </div>
                                <textarea 
                                    className="w-full flex-grow bg-transparent border-none resize-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50 min-h-[150px] mb-12" 
                                    placeholder="متن مقاله، جزوه یا کتاب خود را اینجا پیست کنید..."
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <button 
                                        onClick={handleStartFromText}
                                        disabled={!textInput.trim()}
                                        className="w-full py-2 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                    >
                                        <span>شروع و شخصی‌سازی</span>
                                        <Wand className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* File Upload */}
                        <div className="stylish-textarea-wrapper p-1 bg-gradient-to-bl from-border to-transparent group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                             <div className="bg-card rounded-xl p-4 h-full flex flex-col items-center justify-center text-center border-2 border-dashed border-transparent group-hover:border-primary/20 transition-all">
                                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-primary">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <h3 className="font-bold text-lg">آپلود فایل</h3>
                                <p className="text-sm text-muted-foreground mt-2">PDF، متن یا تصویر</p>
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,image/*" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                        {[
                            { icon: BrainCircuit, title: "نقشه ذهنی", desc: "ساختاردهی هوشمند" },
                            { icon: Target, title: "آزمون تطبیقی", desc: "سنجش دقیق سطح" },
                            { icon: MessageSquare, title: "مربی شخصی", desc: "رفع اشکال آنی" },
                            { icon: Sparkles, title: "خلاصه ساز", desc: "مرور سریع" }
                        ].map((f, i) => (
                            <div key={i} className="p-4 rounded-xl bg-secondary/30 border border-border text-center hover:bg-secondary/50 transition-colors">
                                <f.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                                <h4 className="font-bold text-sm">{f.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading State */}
            {(state.status === AppStatus.LOADING || state.status === AppStatus.GENERATING_REMEDIAL || state.status === AppStatus.GRADING_PRE_ASSESSMENT) && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 fade-in">
                    <Spinner />
                    <p className="text-xl font-medium text-muted-foreground animate-pulse">
                        {state.loadingMessage || (state.status === AppStatus.GRADING_PRE_ASSESSMENT ? 'در حال تحلیل پاسخ‌ها و تعیین سطح...' : 'در حال پردازش...')}
                    </p>
                </div>
            )}

            {/* Plan Review (Initial Mind Map) */}
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
                         <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
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

            {/* Pre-Assessment */}
            {state.status === AppStatus.PRE_ASSESSMENT && state.preAssessment && (
                <QuizView 
                    title="پیش‌آزمون تعیین سطح" 
                    quiz={state.preAssessment} 
                    onSubmit={handlePreAssessmentSubmit} 
                />
            )}

             {/* Pre-Assessment Review */}
            {state.status === AppStatus.PRE_ASSESSMENT_REVIEW && state.preAssessmentAnalysis && (
                <PreAssessmentReview 
                    analysis={state.preAssessmentAnalysis} 
                    onStart={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} 
                />
            )}

            {/* Main Learning View (MindMap + Content) */}
            {(state.status === AppStatus.LEARNING || state.status === AppStatus.VIEWING_NODE || state.status === AppStatus.TAKING_QUIZ || state.status === AppStatus.GRADING_QUIZ || state.status === AppStatus.QUIZ_REVIEW) && (
                <div className="flex flex-col h-full relative">
                    {/* MindMap Area - Occupies full space */}
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
                            <div className="absolute top-4 right-4 z-30 bg-card/80 backdrop-blur p-3 rounded-lg border border-border shadow-sm max-w-[200px]">
                                <p className="text-xs text-muted-foreground">مسیر پیشنهادی با شماره مشخص شده است. از گره شماره ۱ شروع کنید.</p>
                            </div>
                        )}
                    </div>

                    {/* Content/Quiz Area Overlay */}
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
                                    <Spinner size={80} />
                                    <p className="text-lg font-medium">در حال تصحیح و تحلیل پاسخ‌ها...</p>
                                </div>
                            )}

                            {state.status === AppStatus.QUIZ_REVIEW && state.quizResults && (
                                <QuizReview 
                                    results={state.quizResults} 
                                    onFinish={handleRetryQuiz} 
                                    attempts={state.userProgress[state.activeNodeId!]?.attempts || 1}
                                    onForceUnlock={() => dispatch({ type: 'FORCE_UNLOCK_NODE' })}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Right/Bottom Panel */}
        <div className="hidden lg:flex flex-col w-80 border-r border-border bg-card/50 backdrop-blur-sm shrink-0 relative z-10">
            <div className="p-4 border-b border-border font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5" />
                <span>جعبه ابزار</span>
            </div>
            <div className="flex-grow overflow-y-auto">
                 <WeaknessTracker weaknesses={state.weaknesses} />
                 <div className="h-px bg-border my-2 mx-4"></div>
                 <PracticeZone />
            </div>
        </div>

        {/* Chat Panel Overlay */}
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

        {/* Mobile Bottom Nav */}
        <div className="lg:hidden bottom-nav">
            <button className="bottom-nav-item active" onClick={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })}>
                <Home className="w-6 h-6" />
                <span>خانه</span>
            </button>
             <button className="bottom-nav-item" onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}>
                <MessageSquare className="w-6 h-6" />
                <span>مربی</span>
            </button>
            <button className="bottom-nav-item" onClick={() => dispatch({ type: 'TOGGLE_USER_PANEL' })}>
                <User className="w-6 h-6" />
                <span>پروفایل</span>
            </button>
        </div>

    </div>
  );
}

export default App;