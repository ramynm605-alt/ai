
import React, { useState, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, MindMapNode, Quiz, Weakness, LearningPreferences, NodeContent, AppStatus, UserAnswer, QuizResult, SavableState, PreAssessmentAnalysis, ChatMessage, QuizQuestion, NodeProgress } from './types';
import { generateLearningPlan, generateNodeContent, generateQuiz, generateFinalExam, generateCorrectiveSummary, generatePracticeResponse, gradeAndAnalyzeQuiz, analyzePreAssessment, generateChatResponse } from './services/geminiService';
import { ArrowRight, BookOpen, Brain, BrainCircuit, CheckCircle, ClipboardList, Home, MessageSquare, Moon, Sun, XCircle, Save, Upload, FileText, Target, Maximize, Minimize, SlidersHorizontal, ChevronDown, Sparkles, Trash, Edit } from './components/icons';
import MindMap from './components/MindMap';
import NodeView from './components/NodeView';
import QuizView from './components/QuizView';
import QuizReview from './components/QuizReview';
import WeaknessTracker from './components/WeaknessTracker';
import PracticeZone from './components/PracticeZone';
import Spinner from './components/Spinner';
import StartupScreen from './components/StartupScreen';
import PreAssessmentReview from './components/PreAssessmentReview';
import ChatPanel from './components/ChatPanel';
import ParticleBackground from './components/ParticleBackground';

const CURRENT_APP_VERSION = 4;
declare var pdfjsLib: any;


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
};

function appReducer(state: AppState, action: any): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'START_GENERATION':
      return { ...initialState, theme: state.theme, status: AppStatus.LOADING, sourceContent: action.payload.sourceContent, sourcePageContents: action.payload.sourcePageContents, sourceImages: action.payload.sourceImages, preferences: action.payload.preferences, loadingMessage: 'در حال تحلیل و ساختاردهی محتوای شما...' };
    case 'MIND_MAP_GENERATED': {
        const welcomeMessage: ChatMessage = { role: 'model', message: 'سلام! من مربی ذهن گاه شما هستم. ساختار پیشنهادی درس آماده است. آن را بررسی کنید.' };
        return { 
            ...state, 
            status: AppStatus.PLAN_REVIEW, // New Step
            mindMap: action.payload.mindMap, 
            suggestedPath: action.payload.suggestedPath,
            preAssessment: { questions: [], isStreaming: true },
            loadingMessage: null, 
            chatHistory: [welcomeMessage] 
        };
    }
    case 'CONFIRM_PLAN': // Transition from Review to Pre-Assessment
        return { ...state, status: AppStatus.PRE_ASSESSMENT, mindMap: action.payload.mindMap };
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
        return { ...state, status: AppStatus.GRADING_QUIZ };
    case 'QUIZ_ANALYSIS_LOADED': {
        const { results } = action.payload;
        const totalScore = results.reduce((sum: number, r: QuizResult) => sum + r.score, 0);
        const maxScore = results.reduce((sum: number, r: QuizResult) => sum + r.question.points, 0);
        const passed = maxScore > 0 && (totalScore / maxScore) >= 0.7;

        const currentProgress = state.userProgress[state.activeNodeId!] || { status: 'in_progress', attempts: 0 };
        const attempts = currentProgress.attempts + 1;
        const status: NodeProgress['status'] = passed ? 'completed' : 'failed';

        const newProgress = { ...state.userProgress, [state.activeNodeId!]: { status, attempts } };
        
        // Unlock next nodes logic
        let newMindMap = [...state.mindMap];
        if (passed) {
            newMindMap = newMindMap.map(node => {
                if (node.parentId === state.activeNodeId) {
                    return { ...node, locked: false };
                }
                return node;
            });
        }

        // Weakness tracking logic (same as before)
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
    case 'FORCE_UNLOCK_NODE': { // Mercy Rule
        const nodeId = state.activeNodeId!;
        const newProgress = { ...state.userProgress, [nodeId]: { status: 'completed' as const, attempts: state.userProgress[nodeId].attempts } };
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
        };
    }
     case 'COMPLETE_INTRO_NODE': {
        const rootNodeId = state.mindMap.find(n => n.parentId === null)?.id;
        if (!rootNodeId) return { ...state, status: AppStatus.LEARNING, activeNodeId: null };
        const newProgress = { ...state.userProgress, [rootNodeId]: { status: 'completed' as const, attempts: 1 } };
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
        return { ...initialState, ...action.payload, status: action.payload.preAssessmentAnalysis ? AppStatus.LEARNING : AppStatus.IDLE };
    case 'RESET':
      return { ...initialState, theme: state.theme };
    case 'ERROR':
      return { ...state, status: AppStatus.ERROR, error: action.payload, loadingMessage: null };
    case 'OPEN_CHAT':
        return { ...state, isChatOpen: true };
    case 'CLOSE_CHAT':
        return { ...state, isChatOpen: false, isChatFullScreen: false };
    case 'TOGGLE_CHAT_FULLSCREEN':
        return { ...state, isChatFullScreen: !state.isChatFullScreen };
    case 'ADD_CHAT_MESSAGE':
        const newHistory = [...state.chatHistory];
        if (newHistory.length > 0 && newHistory[newHistory.length - 1].message === '...') {
            newHistory[newHistory.length - 1] = action.payload;
        } else {
            newHistory.push(action.payload);
        }
        return { ...state, chatHistory: newHistory };
    default:
      return state;
  }
}

// ... (TabButton and BottomNavItem components remain same)
const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }> = ({ active, onClick, icon, children }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${active ? 'bg-primary text-primary-foreground shadow-md' : 'text-secondary-foreground hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5'}`}>
        {icon}
        {children}
    </button>
);

const BottomNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`bottom-nav-item ${active ? 'active' : ''}`}>
        <div className="w-6 h-6">{icon}</div>
        <span>{label}</span>
    </button>
);

// Plan Review Component
const PlanReview: React.FC<{ 
    nodes: MindMapNode[], 
    onConfirm: (updatedNodes: MindMapNode[]) => void 
}> = ({ nodes, onConfirm }) => {
    const [currentNodes, setCurrentNodes] = useState(nodes);

    const handleDelete = (id: string) => {
        // Can't delete root
        const node = currentNodes.find(n => n.id === id);
        if (!node?.parentId) return;
        
        // Simple removal for now (children would be orphaned in a real app, but prompt usually ensures depth 1 or 2)
        setCurrentNodes(currentNodes.filter(n => n.id !== id));
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-full p-6">
             <div className="w-full max-w-3xl p-6 border rounded-lg shadow-lg bg-card">
                <h2 className="mb-4 text-2xl font-bold text-center">بررسی ساختار درس</h2>
                <p className="mb-6 text-center text-muted-foreground">قبل از شروع، می‌توانید بخش‌های اضافی را حذف کنید تا مسیر یادگیری کوتاه‌تر شود.</p>
                
                <div className="space-y-2 max-h-[60vh] overflow-y-auto mb-6">
                    {currentNodes.map(node => (
                        <div key={node.id} className="flex items-center justify-between p-3 border rounded-md bg-background border-border">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${node.parentId ? 'bg-secondary-foreground' : 'bg-primary'}`}></div>
                                <span className={node.parentId ? '' : 'font-bold'}>{node.title}</span>
                            </div>
                            {node.parentId && (
                                <button onClick={() => handleDelete(node.id)} className="p-2 transition-colors rounded-full text-destructive hover:bg-destructive/10">
                                    <Trash className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={() => onConfirm(currentNodes)} className="w-full py-3 font-bold text-white rounded-lg bg-primary hover:bg-primary-hover">
                    تایید طرح و شروع آزمون تعیین سطح
                </button>
             </div>
        </div>
    );
};


export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [currentView, setCurrentView] = useState<'learning' | 'weaknesses' | 'practice'>('learning');
  const [showSuggestedPath, setShowSuggestedPath] = useState(true);
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [chatInitialMessage, setChatInitialMessage] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // ... (handleStart and other handlers)

  const handleStart = async (sourceContent: string, sourcePageContents: string[] | null, sourceImages: {mimeType: string, data: string}[], preferences: LearningPreferences) => {
    dispatch({ type: 'START_GENERATION', payload: { sourceContent, sourcePageContents, sourceImages, preferences } });
    try {
      await generateLearningPlan(
            sourceContent, 
            sourcePageContents, 
            sourceImages, 
            preferences,
            (mindMap, suggestedPath) => {
                dispatch({ type: 'MIND_MAP_GENERATED', payload: { mindMap, suggestedPath } });
            },
            (question) => {
                dispatch({ type: 'PRE_ASSESSMENT_QUESTION_STREAMED', payload: question });
            }
        );
        dispatch({ type: 'PRE_ASSESSMENT_STREAM_END' });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ERROR', payload: 'خطا در ایجاد طرح درس. لطفاً دوباره تلاش کنید.' });
    }
  };

  const handleConfirmPlan = (updatedNodes: MindMapNode[]) => {
      dispatch({ type: 'CONFIRM_PLAN', payload: { mindMap: updatedNodes } });
  };

  // ... (Rest of handlers: handleSubmitPreAssessment, handleSelectNode, etc. remain mostly same)
    
  const handleSubmitPreAssessment = async (answers: Record<string, UserAnswer>) => {
    dispatch({ type: 'SUBMIT_PRE_ASSESSMENT', payload: answers });
    try {
        const analysis = await analyzePreAssessment(state.preAssessment!.questions, answers, state.sourceContent);
        dispatch({ type: 'PRE_ASSESSMENT_ANALYSIS_LOADED', payload: analysis });
    } catch (err) {
        console.error(err);
        dispatch({ type: 'ERROR', payload: 'خطا در تحلیل پیش‌آزمون.' });
    }
  };

  const handleSelectNode = useCallback(async (nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', payload: nodeId });
    try {
        if (state.nodeContents[nodeId]) {
            dispatch({ type: 'NODE_CONTENT_LOADED', payload: state.nodeContents[nodeId] });
            return;
        }
        dispatch({ type: 'NODE_CONTENT_STREAM_START' });
        const strengths = state.preAssessmentAnalysis?.strengths || [];
        const weaknesses = state.preAssessmentAnalysis?.weaknesses || [];
        const isIntroNode = state.mindMap.find(n => n.id === nodeId)?.parentId === null;

        const content = await generateNodeContent(
            state.mindMap.find(n => n.id === nodeId)!.title,
            state.sourceContent,
            state.sourceImages,
            state.preferences,
            strengths,
            weaknesses,
            isIntroNode,
            (partialContent) => {
                dispatch({ type: 'NODE_CONTENT_STREAM_UPDATE', payload: partialContent });
            }
        );
        dispatch({ type: 'NODE_CONTENT_STREAM_END', payload: { nodeId, content } });
    } catch (err) {
        console.error(err);
        dispatch({ type: 'ERROR', payload: 'خطا در بارگذاری محتوای درس.' });
    }
}, [state.mindMap, state.sourceContent, state.sourceImages, state.preferences, state.nodeContents, state.preAssessmentAnalysis]);

  const handleStartQuiz = useCallback(async (nodeId: string) => {
    dispatch({ type: 'START_QUIZ', payload: nodeId });
    try {
        const finalQuiz = await generateQuiz(
            state.mindMap.find(n => n.id === nodeId)!.title,
            state.sourceContent,
            state.sourceImages,
            (question: QuizQuestion) => {
                dispatch({ type: 'QUIZ_QUESTION_STREAMED', payload: question });
            }
        );
        dispatch({ type: 'QUIZ_STREAM_END', payload: finalQuiz });
    } catch (err) {
        console.error(err);
        dispatch({ type: 'ERROR', payload: 'خطا در ایجاد آزمون.' });
    }
  }, [state.mindMap, state.sourceContent, state.sourceImages]);

  const handleSubmitQuiz = useCallback(async (answers: Record<string, UserAnswer>) => {
    dispatch({ type: 'SUBMIT_QUIZ' });
    try {
        const gradedResults = await gradeAndAnalyzeQuiz(state.activeQuiz!.questions, answers, state.sourceContent, state.sourceImages);
        
        const resultsWithFullData = gradedResults.map(res => {
            const question = state.activeQuiz!.questions.find(q => q.id === res.questionId)!;
            return {
                ...res,
                question,
                userAnswer: answers[question.id],
            };
        });
        
        dispatch({ type: 'QUIZ_ANALYSIS_LOADED', payload: { results: resultsWithFullData } });

    } catch (err) {
        console.error(err);
        dispatch({ type: 'ERROR', payload: 'خطا در تصحیح آزمون.' });
    }
  }, [state.activeQuiz, state.sourceContent, state.sourceImages]);

  // ... (Final exam handlers, save/load etc.)
  const handleStartFinalExam = async () => {
    dispatch({ type: 'START_FINAL_EXAM' });
    try {
        const weaknessTopics = state.weaknesses.map(w => state.mindMap.find(n => n.title.includes(w.question.substring(0,20)))?.title).filter(Boolean).join(', ');
        await generateFinalExam(
            state.sourceContent, 
            state.sourceImages, 
            weaknessTopics,
            (question) => {
                dispatch({ type: 'FINAL_EXAM_QUESTION_STREAMED', payload: question });
            }
        );
        dispatch({ type: 'FINAL_EXAM_STREAM_END' });
    } catch (err) {
        dispatch({ type: 'ERROR', payload: 'خطا در ایجاد آزمون نهایی.' });
    }
  };

  const handleCompleteFinalExam = async (answers: Record<string, UserAnswer>) => {
    dispatch({ type: 'COMPLETE_FINAL_EXAM' });
    try {
        const incorrectAnswersForSummary = Object.entries(answers).map(([qid, uAns]) => {
          const q = state.finalExam!.questions.find(q => q.id === qid)!;
          let isCorrect = false;
          if (q.type === 'multiple-choice') isCorrect = uAns === q.correctAnswerIndex;
          return { q, uAns, isCorrect };
        })
        .filter(item => !item.isCorrect)
        .map(item => ({ question: item.q.question, correctAnswer: item.q.type === 'multiple-choice' ? item.q.options[item.q.correctAnswerIndex] : 'Complex Answer' }));

        const summary = await generateCorrectiveSummary(state.sourceContent, state.sourceImages, incorrectAnswersForSummary);
        dispatch({ type: 'SUMMARY_LOADED', payload: { summary } });
    } catch (err) {
        dispatch({ type: 'ERROR', payload: 'خطا در ایجاد خلاصه اصلاحی.' });
    }
  };

  const handleBackToPlan = () => {
    const rootNodeId = state.mindMap.find(n => n.parentId === null)?.id;
    if (rootNodeId && state.activeNodeId === rootNodeId) {
        dispatch({ type: 'COMPLETE_INTRO_NODE' });
    } else {
        dispatch({ type: 'START_PERSONALIZED_LEARNING' });
    }
  };
  
  const handleForceUnlock = () => {
      dispatch({ type: 'FORCE_UNLOCK_NODE' });
  };

   // ... (Save/Load/Chat handlers same as before)
  const handleSaveProgress = () => {
      // ... same code
      const savableState: SavableState = {
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
    };
    const blob = new Blob([JSON.stringify(savableState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zehn-gah-progress-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadProgress = (file: File) => {
      // ... same code
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const loadedData = JSON.parse(event.target?.result as string);
              dispatch({ type: 'LOAD_STATE', payload: loadedData });
          } catch (e) {
              dispatch({ type: 'ERROR', payload: 'فایل ذخیره شده معتبر نیست.' });
          }
      };
      reader.readAsText(file);
  };

  const handleSendChatMessage = async (message: string) => {
      // ... same code
    const userMessage: ChatMessage = { role: 'user', message };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMessage });
    
    const loadingMessage: ChatMessage = { role: 'model', message: '...' };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: loadingMessage });

    try {
        const activeNodeTitle = state.activeNodeId ? state.mindMap.find(n => n.id === state.activeNodeId)?.title || null : null;
        const historyForAI = [...state.chatHistory, userMessage];
        const response = await generateChatResponse(historyForAI, message, activeNodeTitle, state.sourceContent);
        const modelMessage: ChatMessage = { role: 'model', message: response };
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: modelMessage });

    } catch (err) {
        const errorMessage: ChatMessage = { role: 'model', message: 'خطا در برقراری ارتباط.' };
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: errorMessage });
    }
  };
  
    const handleExplainRequest = (text: string) => {
        setChatInitialMessage(text.endsWith('?') ? text : `لطفاً این بخش را بیشتر توضیح بده: "${text}"`);
        dispatch({ type: 'OPEN_CHAT' });
    };

  const orderedNodes = useMemo(() => {
      // ... same code
      if (!state.mindMap || state.mindMap.length === 0) return [];
    type MindMapNodeWithChildren = MindMapNode & { children: MindMapNodeWithChildren[] };
    const nodesById = new Map<string, MindMapNodeWithChildren>(state.mindMap.map(node => [node.id, { ...node, children: [] }]));
    const roots: MindMapNodeWithChildren[] = [];
    state.mindMap.forEach(node => {
        const currentNode = nodesById.get(node.id)!;
        if (node.parentId && nodesById.has(node.parentId)) {
            nodesById.get(node.parentId)!.children.push(currentNode);
        } else {
            roots.push(currentNode);
        }
    });
    const ordered: MindMapNode[] = [];
    const queue: MindMapNodeWithChildren[] = [...roots];
    while (queue.length > 0) {
        const node = queue.shift()!;
        const originalNode = state.mindMap.find(n => n.id === node.id);
        if (originalNode) { ordered.push(originalNode); }
        if (node.children) { queue.push(...node.children); }
    }
    return ordered;
  }, [state.mindMap]);

  
  const renderContent = () => {
    const LoadingScreen = ({ message, subMessage }: { message: string, subMessage?: string }) => (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 text-center bg-background/80 backdrop-blur-sm fade-in">
            <Spinner />
            <div>
                <p className="text-xl font-semibold text-foreground">{message}</p>
                {subMessage && <p className="mt-2 text-muted-foreground">{subMessage}</p>}
            </div>
        </div>
    );
    
    switch (state.status) {
      case AppStatus.IDLE:
        return <HomePage onStart={handleStart} onLoad={handleLoadProgress} theme={state.theme} />;
      case AppStatus.LOADING:
        return <LoadingScreen message={state.loadingMessage || 'در حال پردازش...'} subMessage="هوش مصنوعی در حال ساخت ساختار بهینه برای شماست." />;
      case AppStatus.PLAN_REVIEW:
          return <PlanReview nodes={state.mindMap} onConfirm={handleConfirmPlan} />;
      case AppStatus.GRADING_PRE_ASSESSMENT:
        return <LoadingScreen message="در حال تحلیل پاسخ‌ها..." subMessage="در حال تنظیم سطح دشواری برای شما." />;
      case AppStatus.GRADING_QUIZ:
        return <LoadingScreen message="در حال تصحیح..." />;
      case AppStatus.PRE_ASSESSMENT:
        return <QuizView title="پیش‌آزمون تعیین سطح" quiz={state.preAssessment!} onSubmit={handleSubmitPreAssessment} />;
      case AppStatus.PRE_ASSESSMENT_REVIEW:
        return <PreAssessmentReview analysis={state.preAssessmentAnalysis!} onStart={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} />;
      case AppStatus.LEARNING:
      case AppStatus.ALL_NODES_COMPLETED:
        const allNodesCompleted = state.mindMap.length > 0 && state.mindMap.every(node => state.userProgress[node.id]?.status === 'completed');
        const nodeProgressMap = Object.entries(state.userProgress).reduce((acc, [key, val]) => ({ ...acc, [key]: val.status }), {} as Record<string, string>);

        return (
            <div className="flex flex-col h-full p-4 sm:p-6 md:p-8">
                <div className="flex flex-col items-center gap-4 mb-6 md:flex-row md:justify-between">
                    <h1 className="text-2xl font-bold text-foreground">نقشه راه یادگیری</h1>
                    <div className="flex flex-col items-stretch gap-2 sm:items-center sm:flex-row">
                        <div className="hidden sm:flex items-center justify-center gap-2 p-1 bg-secondary rounded-xl">
                            <TabButton active={currentView === 'learning'} onClick={() => setCurrentView('learning')} icon={<BrainCircuit />}>نقشه ذهنی</TabButton>
                            <TabButton active={currentView === 'weaknesses'} onClick={() => setCurrentView('weaknesses')} icon={<XCircle />}>نقاط ضعف</TabButton>
                            <TabButton active={currentView === 'practice'} onClick={() => setCurrentView('practice')} icon={<ClipboardList />}>تمرین</TabButton>
                        </div>
                        <button onClick={() => setShowSuggestedPath(!showSuggestedPath)} className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${showSuggestedPath ? 'bg-primary text-primary-foreground shadow-md' : 'text-secondary-foreground hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5'}`}>
                            <Sparkles className="w-5 h-5" />
                            <span>مسیر پیشنهادی</span>
                        </button>
                    </div>
                </div>
                {allNodesCompleted && (
                    <div className="p-4 mb-6 text-center text-success-foreground bg-success/20 border-r-4 border-success rounded-md">
                        <h3 className="font-bold">تبریک!</h3>
                        <p>تمام مراحل با موفقیت طی شد. آماده آزمون نهایی هستید؟</p>
                        <button onClick={handleStartFinalExam} className="px-6 py-2 mt-3 font-semibold text-white transition-transform duration-200 bg-success rounded-md hover:bg-success/90 active:scale-95">
                            شروع آزمون نهایی
                        </button>
                    </div>
                )}
                <div className={`flex-grow min-h-0 ${currentView !== 'learning' ? 'overflow-auto' : ''}`}>
                    {/* Remove overflow-auto for learning view to prevent nested scrollbars with MindMap */}
                    {currentView === 'learning' && <MindMap nodes={state.mindMap} progress={nodeProgressMap as any} suggestedPath={state.suggestedPath} onSelectNode={handleSelectNode} onTakeQuiz={handleStartQuiz} theme={state.theme} activeNodeId={state.activeNodeId} showSuggestedPath={showSuggestedPath} />}
                    {currentView === 'weaknesses' && <WeaknessTracker weaknesses={state.weaknesses} />}
                    {currentView === 'practice' && <PracticeZone />}
                </div>
            </div>
        );
      case AppStatus.VIEWING_NODE: {
        const activeNode = state.mindMap.find(n => n.id === state.activeNodeId);
        const currentIndex = orderedNodes.findIndex(n => n.id === state.activeNodeId);
        const prevNode = currentIndex > 0 ? orderedNodes[currentIndex - 1] : null;
        const nextNode = currentIndex < orderedNodes.length - 1 ? orderedNodes[currentIndex + 1] : null;
        const content = state.streamingNodeContent ?? state.nodeContents[state.activeNodeId!];

        if (!activeNode || !content) {
             return <LoadingScreen message="در حال آماده‌سازی درس..." />;
        }
        
        const isIntroNode = activeNode.parentId === null;

        return <NodeView 
                    node={activeNode} 
                    content={content} 
                    onBack={handleBackToPlan} 
                    onStartQuiz={() => handleStartQuiz(state.activeNodeId!)}
                    onNavigate={handleSelectNode}
                    prevNode={prevNode}
                    nextNode={nextNode}
                    onExplainRequest={handleExplainRequest}
                    isIntroNode={isIntroNode}
                />;
      }
      case AppStatus.TAKING_QUIZ:
        const quizNode = state.mindMap.find(n => n.id === state.activeNodeId);
        return <QuizView title={`آزمون: ${quizNode?.title}`} quiz={state.activeQuiz!} onSubmit={handleSubmitQuiz} />;
      case AppStatus.QUIZ_REVIEW:
          const attempts = state.userProgress[state.activeNodeId!]?.attempts || 0;
        return <QuizReview results={state.quizResults!} onFinish={handleBackToPlan} attempts={attempts} onForceUnlock={handleForceUnlock} />;
      case AppStatus.FINAL_EXAM:
          return <QuizView title="آزمون نهایی" quiz={state.finalExam!} onSubmit={handleCompleteFinalExam} />;
      case AppStatus.SUMMARY:
        return (
            <div className="p-8 mx-auto max-w-4xl">
                <h1 className="mb-4 text-3xl font-bold text-foreground">جزوه مرور هوشمند</h1>
                <p className="mb-6 text-muted-foreground">این جزوه فقط شامل نکاتی است که در آن‌ها ضعف داشتید.</p>
                <div className="p-6 markdown-content bg-card border rounded-lg max-w-none text-card-foreground" dangerouslySetInnerHTML={{ __html: state.correctiveSummary }} />
                <button onClick={() => dispatch({ type: 'RESET' })} className="px-6 py-2 mt-8 font-semibold transition-transform duration-200 rounded-md text-primary-foreground bg-primary hover:bg-primary-hover active:scale-95">
                    شروع یک موضوع جدید
                </button>
            </div>
        );
      case AppStatus.ERROR:
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
                <XCircle className="w-16 h-16" />
                <h2 className="mt-4 text-2xl font-bold">خطا</h2>
                <p className="mt-2">{state.error}</p>
                <button onClick={() => dispatch({ type: 'RESET' })} className="px-6 py-2 mt-6 font-semibold transition-transform duration-200 rounded-md text-destructive-foreground bg-destructive hover:bg-destructive/90 active:scale-95">
                    بازگشت
                </button>
            </div>
        );
      default:
        return null;
    }
  }
  
  // ... (Render logic similar to previous)
  const hasProgress = state.status !== AppStatus.IDLE && state.status !== AppStatus.LOADING;
  const showBottomNav = hasProgress && (state.status === AppStatus.LEARNING || state.status === AppStatus.ALL_NODES_COMPLETED);

  if (showStartupScreen) {
    return <StartupScreen onAnimationEnd={() => setShowStartupScreen(false)} />;
  }
  
  return (
      // ... Same structure
     <div className="flex flex-col w-full h-screen transition-colors duration-300 bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b shadow-sm bg-card border-border shrink-0">
             <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#C8A05A] text-[#0F172A]">
                    <Brain className="w-6 h-6" />
                </div>
                <h1 className="hidden text-xl font-bold sm:block text-[#C8A05A]">ذهن گاه</h1>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center p-1 space-x-1 rounded-lg bg-secondary">
                    <button onClick={() => dispatch({ type: 'SET_THEME', payload: 'light' })} className={`p-1.5 rounded-md transition-all ${state.theme === 'light' ? 'bg-card shadow-sm ring-1 ring-inset ring-border' : 'hover:bg-card/50'}`} aria-label="Light theme"><Sun className="w-5 h-5" /></button>
                    <button onClick={() => dispatch({ type: 'SET_THEME', payload: 'balanced' })} className={`p-1.5 rounded-md transition-all ${state.theme === 'balanced' ? 'bg-card shadow-sm ring-1 ring-inset ring-border' : 'hover:bg-card/50'}`} aria-label="Balanced theme"><div className="w-5 h-5 bg-slate-500 rounded-full"></div></button>
                    <button onClick={() => dispatch({ type: 'SET_THEME', payload: 'dark' })} className={`p-1.5 rounded-md transition-all ${state.theme === 'dark' ? 'bg-card shadow-sm ring-1 ring-inset ring-border' : 'hover:bg-card/50'}`} aria-label="Dark theme"><Moon className="w-5 h-5" /></button>
                </div>
                {hasProgress && (
                    <>
                        <button onClick={handleSaveProgress} className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg sm:px-4 text-secondary-foreground bg-secondary hover:bg-accent hover:-translate-y-0.5 active:scale-95" title="ذخیره پیشرفت">
                            <Save className="w-4 h-4" />
                            <span className="hidden sm:inline">ذخیره</span>
                        </button>
                        <button onClick={() => dispatch({type: 'RESET'})} className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg sm:px-4 text-secondary-foreground bg-secondary hover:bg-accent hover:-translate-y-0.5 active:scale-95" title="شروع مجدد">
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline">شروع مجدد</span>
                        </button>
                    </>
                )}
            </div>
        </header>
        <main className="flex-grow overflow-auto main-content">
            {renderContent()}
        </main>

        {showBottomNav && (
            <nav className="bottom-nav sm:hidden">
                <BottomNavItem icon={<BrainCircuit />} label="نقشه ذهنی" active={currentView === 'learning'} onClick={() => setCurrentView('learning')} />
                <BottomNavItem icon={<XCircle />} label="نقاط ضعف" active={currentView === 'weaknesses'} onClick={() => setCurrentView('weaknesses')} />
                <BottomNavItem icon={<ClipboardList />} label="تمرین" active={currentView === 'practice'} onClick={() => setCurrentView('practice')} />
            </nav>
        )}

        {hasProgress && (
            <>
                <button 
                    onClick={() => dispatch({ type: 'OPEN_CHAT' })} 
                    className="fixed z-50 flex items-center justify-center w-16 h-16 transition-transform duration-200 transform rounded-full shadow-lg bottom-6 right-6 sm:bottom-6 bg-primary text-primary-foreground hover:bg-primary-hover hover:scale-110 active:scale-100"
                    style={{ bottom: showBottomNav ? '80px' : '24px' }}
                    aria-label="Open chat"
                >
                    <MessageSquare className="w-8 h-8" />
                </button>
                {state.isChatOpen && (
                    <ChatPanel
                        history={state.chatHistory}
                        isFullScreen={state.isChatFullScreen}
                        onSend={handleSendChatMessage}
                        onClose={() => dispatch({ type: 'CLOSE_CHAT' })}
                        onToggleFullScreen={() => dispatch({ type: 'TOGGLE_CHAT_FULLSCREEN' })}
                        initialMessage={chatInitialMessage}
                        onInitialMessageConsumed={() => setChatInitialMessage('')}
                    />
                )}
            </>
        )}
        <footer className="p-4 text-sm text-center border-t main-footer text-muted-foreground bg-card border-border shrink-0">
            © {new Date().getFullYear()} ذهن گاه. تمام حقوق محفوظ است.
        </footer>
    </div>
  );
}

// Updated Personalization Steps
const personalizationSteps = [
    {
        name: 'learningGoal',
        title: 'هدف اصلی شما چیست؟',
        type: 'radio',
        icon: Target,
        options: [
            { value: 'امتحان نهایی', label: 'آمادگی برای امتحان (نمره محور)' },
            { value: 'درک عمیق', label: 'یادگیری عمیق و مفهومی (بدون عجله)' },
            { value: 'مرور سریع', label: 'مرور و جمع‌بندی (بازیابی اطلاعات)' },
            { value: 'کاربرد عملی', label: 'استفاده در پروژه یا کار (عملی)' },
        ]
    },
    {
        name: 'knowledgeLevel',
        title: 'سطح دانش فعلی شما چیست؟',
        type: 'radio',
        icon: BrainCircuit,
        options: [
            { value: 'beginner', label: 'مبتدی (تازه کار)' },
            { value: 'intermediate', label: 'متوسط (آشنایی دارم)' },
            { value: 'expert', label: 'پیشرفته (می‌خواهم مسلط شوم)' },
        ]
    },
    {
        name: 'learningFocus',
        title: 'سبک یادگیری مورد علاقه؟',
        type: 'radio',
        icon: BrainCircuit,
        options: [
            { value: 'theoretical', label: 'چرایی و تئوری' },
            { value: 'practical', label: 'چگونگی و مثال' },
            { value: 'analogies', label: 'داستان و تشبیه' },
        ]
    },
    // ... tone and final step similar
    {
        name: 'tone',
        title: 'لحن مربی چگونه باشد؟',
        type: 'radio',
        icon: MessageSquare,
        options: [
            { value: 'conversational', label: 'دوستانه و ساده' },
            { value: 'academic', label: 'رسمی و دقیق' },
        ]
    },
    {
        name: 'final',
        title: 'تنظیمات نهایی',
        type: 'final',
        icon: CheckCircle,
    }
];

// Personalization Wizard Component (Logic updated for new options structure)
const PersonalizationWizard: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    preferences: LearningPreferences;
    onPreferencesChange: (newPrefs: LearningPreferences) => void;
}> = ({ isOpen, onClose, preferences, onPreferencesChange }) => {
    // ... existing logic, just ensure it renders the new options correctly
    const [currentStep, setCurrentStep] = useState(0);
    
    useEffect(() => {
        if (isOpen) setCurrentStep(0);
    }, [isOpen]);

    const handleNext = () => {
        if (currentStep < personalizationSteps.length - 1) setCurrentStep(currentStep + 1);
    };
    
    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    }

    const handleSelectOption = (name: keyof LearningPreferences, value: any) => {
        onPreferencesChange({ ...preferences, [name]: value });
        setTimeout(() => handleNext(), 300);
    };
    
    if (!isOpen) return null;

    return (
        <div className={`wizard-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
            <div className="wizard-container" onClick={e => e.stopPropagation()}>
                <div className="wizard-steps-wrapper">
                    <div className="wizard-steps" style={{ transform: `translateX(${currentStep * 100}%)` }}>
                        {personalizationSteps.map((step, index) => (
                            <div key={index} className="wizard-step">
                                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 text-primary shrink-0">
                                    <step.icon className="w-8 h-8" />
                                </div>
                                <h3 className="mb-6 text-xl font-bold text-card-foreground shrink-0">{step.title}</h3>
                                <div className="wizard-step-content">
                                    {step.type === 'radio' && (
                                        <div className="w-full max-w-lg wizard-radio-group">
                                            {step.options?.map(option => (
                                                <div key={option.value}>
                                                    <input
                                                        type="radio"
                                                        id={`${step.name}-${option.value}`}
                                                        name={step.name}
                                                        value={option.value}
                                                        checked={preferences[step.name as keyof LearningPreferences] === option.value}
                                                        onChange={() => handleSelectOption(step.name as keyof LearningPreferences, option.value)}
                                                        className="wizard-radio-input"
                                                    />
                                                    <label htmlFor={`${step.name}-${option.value}`} className="wizard-radio-label">{option.label}</label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {step.type === 'final' && (
                                        <div className="w-full max-w-md space-y-4">
                                        <div>
                                            <label htmlFor="customInstructions" className="block mb-2 text-sm font-medium text-secondary-foreground">دستورالعمل خاص (اختیاری)</label>
                                            <input 
                                                type="text" 
                                                id="customInstructions"
                                                value={preferences.customInstructions} 
                                                onChange={e => onPreferencesChange({...preferences, customInstructions: e.target.value})} 
                                                className="w-full p-2 border rounded-md bg-background border-border focus:ring-2 focus:ring-ring focus:border-primary" 
                                                placeholder="مثال: تمرکز بر فرمول‌ها"/>
                                        </div>
                                        <div className="flex items-center justify-center pt-2 space-x-2 space-x-reverse">
                                                <input
                                                    type="checkbox"
                                                    id="addExplanatoryNodes"
                                                    checked={preferences.addExplanatoryNodes}
                                                    onChange={e => onPreferencesChange({...preferences, addExplanatoryNodes: e.target.checked})}
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                                />
                                                <label htmlFor="addExplanatoryNodes" className="text-sm font-medium text-secondary-foreground">گره‌های توضیحی اضافه کن</label>
                                        </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-border">
                     <div className="flex items-center justify-between">
                        <button onClick={handlePrev} disabled={currentStep === 0} className="px-4 py-2 font-semibold rounded-md text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 active:scale-95">قبلی</button>
                        {currentStep < personalizationSteps.length - 1 ? (
                             <button onClick={handleNext} className="px-4 py-2 font-semibold rounded-md text-primary-foreground bg-primary hover:bg-primary-hover active:scale-95">بعدی</button>
                        ) : (
                             <button onClick={onClose} className="px-4 py-2 font-semibold rounded-md text-primary-foreground bg-success hover:bg-success/90 active:scale-95">تایید و ادامه</button>
                        )}
                     </div>
                     <div className="w-full h-1 mt-4 rounded-full bg-muted">
                        <div className="h-1 rounded-full bg-primary" style={{ width: `${((currentStep + 1) / personalizationSteps.length) * 100}%`, transition: 'width 0.3s ease' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// HomePage component remains mostly same, just ensure props are passed
const HomePage: React.FC<{ onStart: (content: string, pageContents: string[] | null, images: {mimeType: string, data: string}[], preferences: LearningPreferences) => void; onLoad: (file: File) => void; theme: AppState['theme'] }> = ({ onStart, onLoad, theme }) => {
    const [sourceContent, setSourceContent] = useState('');
    const [sourcePageContents, setSourcePageContents] = useState<string[] | null>(null);
    const [sourceImages, setSourceImages] = useState<{mimeType: string, data: string}[]>([]);
    const [preferences, setPreferences] = useState<LearningPreferences>({
        explanationStyle: 'balanced',
        knowledgeLevel: 'intermediate',
        learningFocus: 'practical',
        tone: 'conversational',
        addExplanatoryNodes: false,
        customInstructions: '',
        learningGoal: '',
    });
    const [isParsingPdf, setIsParsingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState('');
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const jsonInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sourceContent.trim().length < 50) {
            alert("لطفاً محتوای کافی برای تحلیل وارد کنید (حداقل ۵۰ کاراکتر).");
            return;
        }
        onStart(sourceContent, sourcePageContents, sourceImages, preferences);
    };
    
    // ... File handling same as previous code
    const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onLoad(file);
    };

    const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
         // ... Same PDF parsing logic as before ...
          const file = e.target.files?.[0];
        if (!file) return;

        setIsParsingPdf(true);
        setPdfProgress('در حال خواندن فایل...');
        setSourceContent('');
        setSourcePageContents(null);
        setSourceImages([]);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                if (!event.target?.result) throw new Error("File could not be read.");

                const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                
                const pageTexts: string[] = [];
                const images: { mimeType: string; data: string }[] = [];
                // Simplistic image extraction for now to save space in this block
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    setPdfProgress(`در حال پردازش صفحه ${i} از ${pdf.numPages}...`);
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    pageTexts.push(pageText);
                }
                setSourcePageContents(pageTexts);
                setSourceContent(pageTexts.join('\n\n'));
                setSourceImages(images);
            } catch (error) {
                alert("خطا در پردازش فایل PDF.");
            } finally {
                setIsParsingPdf(false);
                setPdfProgress('');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="relative flex flex-col items-center justify-center min-h-full p-4 sm:p-6 md:p-8">
            <ParticleBackground theme={theme} />
             <PersonalizationWizard 
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                preferences={preferences}
                onPreferencesChange={setPreferences}
            />
            <div className="relative z-10 w-full max-w-3xl p-6 space-y-8 md:p-8">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-foreground">موضوع یادگیری خود را وارد کنید</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="stylish-textarea-wrapper">
                         <FileText className="absolute w-6 h-6 top-4 right-4 text-muted-foreground/50" />
                        <textarea
                            value={sourceContent}
                            onChange={(e) => setSourceContent(e.target.value)}
                            className="w-full px-4 py-4 pr-12 transition-all duration-200 border-none rounded-lg shadow-sm h-60 bg-transparent text-foreground focus:ring-0 disabled:bg-muted/50 placeholder:text-muted-foreground"
                            placeholder="محتوا را اینجا کپی کنید یا فایل PDF آپلود کنید..."
                            disabled={isParsingPdf}
                        />
                         {isParsingPdf && <div className="py-2 text-sm text-center text-muted-foreground">{pdfProgress}</div>}
                    </div>
                    
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <button type="submit" className="flex items-center justify-center flex-grow w-full gap-2 px-4 py-3 font-semibold transition-transform duration-200 rounded-md text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring active:scale-95 disabled:bg-primary/70" disabled={!sourceContent.trim() || isParsingPdf}>
                            <span>ایجاد طرح یادگیری</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => setIsWizardOpen(true)} className="flex items-center justify-center w-full gap-2 px-4 py-3 font-semibold transition-transform duration-200 rounded-md sm:w-auto text-secondary-foreground bg-secondary hover:bg-accent active:scale-95">
                             <SlidersHorizontal className="w-5 h-5 text-primary" />
                            <span>شخصی‌سازی</span>
                        </button>
                    </div>

                     <div className="flex justify-center gap-4">
                        <input type="file" ref={pdfInputRef} onChange={handlePdfFileChange} accept=".pdf" className="hidden" />
                        <button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isParsingPdf} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-transform duration-200 rounded-md text-secondary-foreground bg-secondary/70 hover:bg-accent active:scale-95 disabled:opacity-70">
                            {isParsingPdf ? <><Spinner /><span>...</span></> : <><FileText className="w-4 h-4" /><span>PDF</span></>}
                        </button>
                        <input type="file" ref={jsonInputRef} onChange={handleJsonFileChange} accept=".json" className="hidden" />
                        <button type="button" onClick={() => jsonInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-transform duration-200 rounded-md text-secondary-foreground bg-secondary/70 hover:bg-accent active:scale-95">
                             <Upload className="w-4 h-4" />
                            <span>باز کردن</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
