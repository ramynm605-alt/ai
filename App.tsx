import React, { useState, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, MindMapNode, Quiz, Weakness, LearningPreferences, NodeContent, AppStatus, UserAnswer, QuizResult, SavableState, PreAssessmentAnalysis, ChatMessage } from './types';
import { generateLearningPlan, generateNodeContent, generateQuiz, generateFinalExam, generateCorrectiveSummary, generatePracticeResponse, gradeAndAnalyzeQuiz, analyzePreAssessment, generateChatResponse } from './services/geminiService';
import { ArrowRight, BookOpen, BrainCircuit, CheckCircle, ClipboardList, Home, MessageSquare, Moon, Sun, XCircle, Save, Upload, FileText, Target, Maximize, Minimize } from './components/icons';
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

const CURRENT_APP_VERSION = 3;
declare var pdfjsLib: any;


const initialState: AppState = {
  theme: 'balanced',
  status: AppStatus.IDLE,
  sourceContent: '',
  sourcePageContents: null,
  sourceImages: [],
  preferences: {
    style: 'balanced',
    addExplanatoryNodes: false,
    customInstructions: '',
    learningGoal: '',
  },
  mindMap: [],
  preAssessment: null,
  preAssessmentAnswers: null,
  preAssessmentAnalysis: null,
  activeQuiz: null,
  activeNodeId: null,
  nodeContents: {},
  userProgress: {},
  weaknesses: [],
  finalExam: null,
  quizResults: null,
  correctiveSummary: '',
  loadingMessage: null,
  error: null,
  // Coach/Chat state
  isChatOpen: false,
  isChatFullScreen: false,
  chatHistory: [],
};

function appReducer(state: AppState, action: any): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'START_GENERATION':
      return { ...initialState, theme: state.theme, status: AppStatus.LOADING, sourceContent: action.payload.sourceContent, sourcePageContents: action.payload.sourcePageContents, sourceImages: action.payload.sourceImages, preferences: action.payload.preferences, loadingMessage: 'در حال تحلیل محتوای شما و ساخت نقشه ذهنی...' };
    case 'PLAN_GENERATED':
        const welcomeMessage: ChatMessage = { role: 'model', message: 'سلام! من مربی هوشمند شما هستم. هر سوالی در مورد این طرح درس دارید، از من بپرسید.' };
        return { ...state, status: AppStatus.PRE_ASSESSMENT, mindMap: action.payload.mindMap, preAssessment: action.payload.preAssessment, loadingMessage: null, chatHistory: [welcomeMessage] };
    case 'SUBMIT_PRE_ASSESSMENT':
        return { ...state, status: AppStatus.GRADING_PRE_ASSESSMENT, preAssessmentAnswers: action.payload };
    case 'PRE_ASSESSMENT_ANALYSIS_LOADED':
        return { ...state, status: AppStatus.PRE_ASSESSMENT_REVIEW, preAssessmentAnalysis: action.payload };
    case 'START_PERSONALIZED_LEARNING':
      return { ...state, status: AppStatus.LEARNING, activeNodeId: null, activeQuiz: null, quizResults: null };
    case 'SELECT_NODE':
      return { ...state, status: AppStatus.LOADING, activeNodeId: action.payload, loadingMessage: 'در حال آماده‌سازی درس...' };
    case 'NODE_CONTENT_LOADED':
      return { ...state, status: AppStatus.VIEWING_NODE, nodeContents: { ...state.nodeContents, [state.activeNodeId!]: action.payload }, loadingMessage: null };
    case 'START_QUIZ':
      return { ...state, status: AppStatus.LOADING, activeNodeId: action.payload, loadingMessage: 'در حال طراحی سوالات آزمون...' };
    case 'QUIZ_LOADED':
        return { ...state, status: AppStatus.TAKING_QUIZ, activeQuiz: action.payload, loadingMessage: null };
    case 'SUBMIT_QUIZ':
        return { ...state, status: AppStatus.GRADING_QUIZ };
    case 'QUIZ_ANALYSIS_LOADED': {
        const { results } = action.payload;
        
        const totalScore = results.reduce((sum: number, r: QuizResult) => sum + r.score, 0);
        const maxScore = results.reduce((sum: number, r: QuizResult) => sum + r.question.points, 0);
        const passed = maxScore > 0 && (totalScore / maxScore) >= 0.7;

        const newWeaknesses = [...state.weaknesses];
        results.forEach((r: QuizResult) => {
            if (!r.isCorrect) {
                 const questionText = r.question.question;
                 if (!newWeaknesses.some(w => w.question === questionText)) {
                     const correctAnswerText = 
                        r.question.type === 'multiple-choice' 
                        ? r.question.options[r.question.correctAnswerIndex] 
                        : r.question.correctAnswer;
                     
                     newWeaknesses.push({ 
                         question: questionText, 
                         incorrectAnswer: JSON.stringify(r.userAnswer), 
                         correctAnswer: correctAnswerText 
                     });
                 }
            }
        });
        
        const newProgress: AppState['userProgress'] = { ...state.userProgress, [state.activeNodeId!]: passed ? 'completed' : 'failed' };
        
        let newMindMap = [...state.mindMap];
        if (passed) {
            newMindMap = newMindMap.map(node => {
                if (node.parentId === state.activeNodeId) {
                    return { ...node, locked: false };
                }
                return node;
            });
        }

        const allNodesCompleted = newMindMap.every(node => newProgress[node.id] === 'completed');
        
        return { 
            ...state, 
            status: AppStatus.QUIZ_REVIEW, 
            userProgress: newProgress, 
            weaknesses: newWeaknesses,
            mindMap: newMindMap,
            quizResults: results,
            ...(allNodesCompleted && { allNodesCompletedStatus: AppStatus.ALL_NODES_COMPLETED })
        };
    }
    case 'START_FINAL_EXAM':
        return { ...state, status: AppStatus.LOADING, loadingMessage: 'در حال آماده‌سازی آزمون نهایی...' };
    case 'FINAL_EXAM_LOADED':
        return { ...state, status: AppStatus.FINAL_EXAM, finalExam: action.payload, activeQuiz: action.payload, activeNodeId: 'final_exam', loadingMessage: null };
    case 'COMPLETE_FINAL_EXAM': // This is now just for submitting the exam
        return { ...state, status: AppStatus.GRADING_QUIZ };
    case 'SUMMARY_LOADED':
        return { ...state, status: AppStatus.SUMMARY, finalExam: null, correctiveSummary: action.payload.summary };
    case 'LOAD_STATE':
        const loadedState = action.payload;
        const status = loadedState.preAssessmentAnalysis ? AppStatus.LEARNING : AppStatus.IDLE;
        return {
            ...initialState,
            ...loadedState,
            sourceImages: loadedState.sourceImages || [],
            sourcePageContents: loadedState.sourcePageContents || null,
            theme: state.theme,
            status: status,
            loadingMessage: null,
            error: null,
            chatHistory: loadedState.chatHistory || [{ role: 'model', message: 'سلام! من مربی هوشمند شما هستم. از سرگیری یادگیری شما خوشحالم.' }]
        };
    case 'RESET':
      return { ...initialState, theme: state.theme };
    case 'ERROR':
      return { ...state, status: AppStatus.ERROR, error: action.payload, loadingMessage: null };
    // Chat Actions
    case 'OPEN_CHAT':
        return { ...state, isChatOpen: true };
    case 'CLOSE_CHAT':
        return { ...state, isChatOpen: false, isChatFullScreen: false };
    case 'TOGGLE_CHAT_FULLSCREEN':
        return { ...state, isChatFullScreen: !state.isChatFullScreen };
    case 'ADD_CHAT_MESSAGE':
        return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    default:
      return state;
  }
}

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }> = ({ active, onClick, icon, children }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${active ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground hover:bg-accent'}`}>
        {icon}
        {children}
    </button>
);


export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [currentView, setCurrentView] = useState<'learning' | 'weaknesses' | 'practice'>('learning');
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [chatInitialMessage, setChatInitialMessage] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('smart-learner-theme', state.theme);
  }, [state.theme]);

  // Load theme from local storage on initial load
  useEffect(() => {
    const savedTheme = localStorage.getItem('smart-learner-theme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'balanced' || savedTheme === 'dark')) {
      dispatch({ type: 'SET_THEME', payload: savedTheme });
    }
  }, []);

  const handleStart = async (sourceContent: string, sourcePageContents: string[] | null, sourceImages: {mimeType: string, data: string}[], preferences: LearningPreferences) => {
    dispatch({ type: 'START_GENERATION', payload: { sourceContent, sourcePageContents, sourceImages, preferences } });
    try {
      const { mindMap, preAssessment } = await generateLearningPlan(sourceContent, sourcePageContents, sourceImages, preferences);
      const unlockedMindMap = mindMap.map(node => ({ ...node, locked: !!node.parentId }));
      dispatch({ type: 'PLAN_GENERATED', payload: { mindMap: unlockedMindMap, preAssessment } });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ERROR', payload: 'خطا در ایجاد طرح درس. لطفاً دوباره تلاش کنید.' });
    }
  };
  
  const handleSubmitPreAssessment = async (answers: Record<string, UserAnswer>) => {
    dispatch({ type: 'SUBMIT_PRE_ASSESSMENT', payload: answers });
    try {
        const analysis = await analyzePreAssessment(state.preAssessment!.questions, answers, state.sourceContent);
        dispatch({ type: 'PRE_ASSESSMENT_ANALYSIS_LOADED', payload: analysis });
    } catch (err) {
        console.error(err);
        dispatch({ type: 'ERROR', payload: 'خطا در تحلیل پیش‌آزمون. لطفاً دوباره تلاش کنید.' });
    }
  };

  const handleSelectNode = useCallback(async (nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', payload: nodeId });
    try {
        if (state.nodeContents[nodeId]) {
            dispatch({ type: 'NODE_CONTENT_LOADED', payload: state.nodeContents[nodeId] });
            return;
        }
        const strengths = state.preAssessmentAnalysis?.strengths || [];
        const weaknesses = state.preAssessmentAnalysis?.weaknesses || [];
        const content = await generateNodeContent(state.mindMap.find(n => n.id === nodeId)!.title, state.sourceContent, state.sourceImages, state.preferences.style, strengths, weaknesses);
        dispatch({ type: 'NODE_CONTENT_LOADED', payload: content });
    } catch (err) {
        console.error(err);
        dispatch({ type: 'ERROR', payload: 'خطا در بارگذاری محتوای درس.' });
    }
  }, [state.mindMap, state.sourceContent, state.sourceImages, state.preferences.style, state.nodeContents, state.preAssessmentAnalysis]);

  const handleStartQuiz = useCallback(async (nodeId: string) => {
    dispatch({ type: 'START_QUIZ', payload: nodeId });
    try {
        const quiz = await generateQuiz(state.mindMap.find(n => n.id === nodeId)!.title, state.sourceContent, state.sourceImages);
        dispatch({ type: 'QUIZ_LOADED', payload: quiz });
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


  const handleStartFinalExam = async () => {
    dispatch({ type: 'START_FINAL_EXAM' });
    try {
        const weaknessTopics = state.weaknesses.map(w => state.mindMap.find(n => n.title.includes(w.question.substring(0,20)))?.title).filter(Boolean).join(', ');
        const exam = await generateFinalExam(state.sourceContent, state.sourceImages, weaknessTopics);
        dispatch({ type: 'FINAL_EXAM_LOADED', payload: exam });
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
    dispatch({ type: 'START_PERSONALIZED_LEARNING' });
  };
  
  const handleSaveProgress = () => {
    const savableState: SavableState = {
        version: CURRENT_APP_VERSION,
        sourceContent: state.sourceContent,
        sourcePageContents: state.sourcePageContents,
        sourceImages: state.sourceImages,
        preferences: state.preferences,
        mindMap: state.mindMap,
        preAssessmentAnalysis: state.preAssessmentAnalysis,
        nodeContents: state.nodeContents,
        userProgress: state.userProgress,
        weaknesses: state.weaknesses,
    };
    const blob = new Blob([JSON.stringify(savableState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-learner-progress-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const migrateState = (loadedData: any): Partial<AppState> => {
      const version = loadedData.version || 0;
      if (version < CURRENT_APP_VERSION) {
          // In the future, migration logic for older versions would go here.
          // For now, we just ensure the shape is compatible.
      }
      // Ensure all required fields exist, falling back to initial state defaults.
      const migratedState = { ...initialState, ...loadedData };
      return migratedState;
  };

  const handleLoadProgress = (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const loadedData = JSON.parse(event.target?.result as string);
              const migratedData = migrateState(loadedData);
              dispatch({ type: 'LOAD_STATE', payload: migratedData });
          } catch (e) {
              console.error("Failed to load or parse file", e);
              dispatch({ type: 'ERROR', payload: 'فایل ذخیره شده معتبر نیست یا خراب شده است.' });
          }
      };
      reader.readAsText(file);
  };

  const handleSendChatMessage = async (message: string) => {
    const userMessage: ChatMessage = { role: 'user', message };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMessage });
    
    // Add a temporary loading message for the model
    const loadingMessage: ChatMessage = { role: 'model', message: '...' };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: loadingMessage });

    try {
        const activeNodeTitle = state.activeNodeId ? state.mindMap.find(n => n.id === state.activeNodeId)?.title || null : null;
        const response = await generateChatResponse([...state.chatHistory, userMessage], message, activeNodeTitle, state.sourceContent);
        const modelMessage: ChatMessage = { role: 'model', message: response };

        // Replace the loading message with the actual response
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: modelMessage });
        const historyWithoutLoading = [...state.chatHistory, userMessage, modelMessage];
        dispatch({type: 'ADD_CHAT_MESSAGE', payload: { ...state, chatHistory: historyWithoutLoading }});


    } catch (err) {
        console.error("Chat error:", err);
        const errorMessage: ChatMessage = { role: 'model', message: 'متاسفانه در حال حاضر قادر به پاسخگویی نیستم. لطفاً دوباره تلاش کنید.' };
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: errorMessage });
        const historyWithoutLoading = [...state.chatHistory, userMessage, errorMessage];
        dispatch({type: 'ADD_CHAT_MESSAGE', payload: { ...state, chatHistory: historyWithoutLoading }});
    }
  };
  
    const handleExplainRequest = (text: string) => {
        setChatInitialMessage(`لطفاً این بخش را بیشتر توضیح بده: "${text}"`);
        dispatch({ type: 'OPEN_CHAT' });
    };

  const orderedNodes = useMemo(() => {
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
        if (originalNode) {
            ordered.push(originalNode);
        }
        if (node.children) {
            queue.push(...node.children);
        }
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
        return <HomePage onStart={handleStart} onLoad={handleLoadProgress} />;
      case AppStatus.LOADING:
        return <LoadingScreen message={state.loadingMessage || 'در حال پردازش...'} subMessage="این فرآیند ممکن است کمی طول بکشد." />;
      case AppStatus.GRADING_PRE_ASSESSMENT:
        return <LoadingScreen message="در حال تحلیل پیش‌آزمون شما..." subMessage="هوش مصنوعی در حال شناسایی نقاط قوت و ضعف شماست." />;
      case AppStatus.GRADING_QUIZ:
        return <LoadingScreen message="در حال تصحیح آزمون..." subMessage="هوش مصنوعی در حال تحلیل پاسخ‌های شماست." />;
      case AppStatus.PRE_ASSESSMENT:
        return <QuizView title="پیش‌آزمون هوشمند" quiz={state.preAssessment!} onSubmit={handleSubmitPreAssessment} />;
      case AppStatus.PRE_ASSESSMENT_REVIEW:
        return <PreAssessmentReview analysis={state.preAssessmentAnalysis!} onStart={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} />;
      case AppStatus.LEARNING:
      case AppStatus.ALL_NODES_COMPLETED:
        const allNodesCompleted = state.mindMap.length > 0 && state.mindMap.every(node => state.userProgress[node.id] === 'completed');
        return (
            <div className="p-4 sm:p-6 md:p-8 flex flex-col h-full">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h1 className="text-2xl font-bold text-foreground">نقشه راه یادگیری شما</h1>
                    <div className="flex items-center gap-2 p-1 bg-secondary rounded-lg">
                        <TabButton active={currentView === 'learning'} onClick={() => setCurrentView('learning')} icon={<BrainCircuit />}>نقشه ذهنی</TabButton>
                        <TabButton active={currentView === 'weaknesses'} onClick={() => setCurrentView('weaknesses')} icon={<XCircle />}>نقاط ضعف</TabButton>
                        <TabButton active={currentView === 'practice'} onClick={() => setCurrentView('practice')} icon={<ClipboardList />}>تمرین</TabButton>
                    </div>
                </div>
                {allNodesCompleted && (
                    <div className="p-4 mb-6 text-center text-success-foreground bg-success/20 border-r-4 border-success rounded-md">
                        <h3 className="font-bold">تبریک!</h3>
                        <p>شما تمام بخش‌های این طرح درس را با موفقیت به پایان رساندید. اکنون برای آزمون نهایی آماده شوید.</p>
                        <button onClick={handleStartFinalExam} className="px-6 py-2 mt-3 font-semibold text-white transition-transform duration-200 bg-success rounded-md hover:bg-success/90 active:scale-95">
                            شروع آزمون نهایی
                        </button>
                    </div>
                )}
                <div className="flex-grow overflow-auto">
                    {currentView === 'learning' && <MindMap nodes={state.mindMap} progress={state.userProgress} onSelectNode={handleSelectNode} onTakeQuiz={handleStartQuiz} />}
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
        
        return <NodeView 
                    node={activeNode!} 
                    content={state.nodeContents[state.activeNodeId!]} 
                    onBack={handleBackToPlan} 
                    onStartQuiz={() => handleStartQuiz(state.activeNodeId!)}
                    onNavigate={handleSelectNode}
                    prevNode={prevNode}
                    nextNode={nextNode}
                    onExplainRequest={handleExplainRequest}
                />;
      }
      case AppStatus.TAKING_QUIZ:
        const quizNode = state.mindMap.find(n => n.id === state.activeNodeId);
        return <QuizView title={`آزمون: ${quizNode?.title}`} quiz={state.activeQuiz!} onSubmit={handleSubmitQuiz} />;
      case AppStatus.QUIZ_REVIEW:
        return <QuizReview results={state.quizResults!} onFinish={handleBackToPlan} />;
      case AppStatus.FINAL_EXAM:
          return <QuizView title="آزمون نهایی" quiz={state.finalExam!} onSubmit={handleCompleteFinalExam} />;
      case AppStatus.SUMMARY:
        return (
            <div className="p-8 mx-auto max-w-4xl">
                <h1 className="mb-4 text-3xl font-bold text-foreground">خلاصه اصلاحی شما</h1>
                <p className="mb-6 text-muted-foreground">این یک جزوه شخصی‌سازی شده بر اساس سوالاتی است که در آزمون نهایی به اشتباه پاسخ دادید. برای مرور و تقویت یادگیری خود از آن استفاده کنید.</p>
                <div className="p-6 prose bg-card border rounded-lg max-w-none text-card-foreground" dangerouslySetInnerHTML={{ __html: state.correctiveSummary }} />
                <button onClick={() => dispatch({ type: 'RESET' })} className="px-6 py-2 mt-8 font-semibold transition-transform duration-200 rounded-md text-primary-foreground bg-primary hover:bg-primary-hover active:scale-95">
                    شروع یک موضوع جدید
                </button>
            </div>
        );
      case AppStatus.ERROR:
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
                <XCircle className="w-16 h-16" />
                <h2 className="mt-4 text-2xl font-bold">خطا رخ داد</h2>
                <p className="mt-2">{state.error}</p>
                <button onClick={() => dispatch({ type: 'RESET' })} className="px-6 py-2 mt-6 font-semibold transition-transform duration-200 rounded-md text-destructive-foreground bg-destructive hover:bg-destructive/90 active:scale-95">
                    بازگشت به صفحه اصلی
                </button>
            </div>
        );
      default:
        return null;
    }
  }

  const hasProgress = state.status !== AppStatus.IDLE && state.status !== AppStatus.LOADING;

  if (showStartupScreen) {
    return <StartupScreen onAnimationEnd={() => setShowStartupScreen(false)} />;
  }

  return (
    <div className="flex flex-col w-full min-h-screen transition-colors duration-300 bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b shadow-sm bg-card border-border">
             <div className="flex items-center gap-3">
                <div className="p-2 rounded-full text-primary-foreground bg-primary">
                    <BookOpen className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold text-primary">یادگیرنده هوشمند</h1>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center p-1 space-x-1 rounded-lg bg-secondary">
                    <button onClick={() => dispatch({ type: 'SET_THEME', payload: 'light' })} className={`p-1.5 rounded-md ${state.theme === 'light' ? 'bg-card shadow-sm' : 'hover:bg-card/50'}`} aria-label="Light theme"><Sun className="w-5 h-5" /></button>
                    <button onClick={() => dispatch({ type: 'SET_THEME', payload: 'balanced' })} className={`p-1.5 rounded-md ${state.theme === 'balanced' ? 'bg-card shadow-sm' : 'hover:bg-card/50'}`} aria-label="Balanced theme"><div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-gray-700"></div></button>
                    <button onClick={() => dispatch({ type: 'SET_THEME', payload: 'dark' })} className={`p-1.5 rounded-md ${state.theme === 'dark' ? 'bg-card shadow-sm' : 'hover:bg-card/50'}`} aria-label="Dark theme"><Moon className="w-5 h-5" /></button>
                </div>
                {hasProgress && (
                    <>
                        <button onClick={handleSaveProgress} className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md sm:px-4 text-secondary-foreground bg-secondary hover:bg-accent" title="ذخیره پیشرفت">
                            <Save className="w-4 h-4" />
                            <span className="hidden sm:inline">ذخیره</span>
                        </button>
                        <button onClick={() => dispatch({type: 'RESET'})} className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md sm:px-4 text-secondary-foreground bg-secondary hover:bg-accent" title="شروع مجدد">
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline">شروع مجدد</span>
                        </button>
                    </>
                )}
            </div>
        </header>
        <main className="flex-grow overflow-auto">
            {renderContent()}
        </main>
        {hasProgress && (
            <>
                <button 
                    onClick={() => dispatch({ type: 'OPEN_CHAT' })} 
                    className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-transform transform hover:scale-110"
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
        <footer className="p-4 text-sm text-center border-t text-muted-foreground bg-card border-border">
            © {new Date().getFullYear()} پایه های چهار پایه. تمام حقوق محفوظ است.
        </footer>
    </div>
  );
}

const HomePage: React.FC<{ onStart: (content: string, pageContents: string[] | null, images: {mimeType: string, data: string}[], preferences: LearningPreferences) => void; onLoad: (file: File) => void; }> = ({ onStart, onLoad }) => {
    const [sourceContent, setSourceContent] = useState('');
    const [sourcePageContents, setSourcePageContents] = useState<string[] | null>(null);
    const [sourceImages, setSourceImages] = useState<{mimeType: string, data: string}[]>([]);
    const [preferences, setPreferences] = useState<LearningPreferences>({
        style: 'balanced',
        addExplanatoryNodes: false,
        customInstructions: '',
        learningGoal: '',
    });
    const [isParsingPdf, setIsParsingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState('');
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

    const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onLoad(file);
        }
    };

    const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                const processedImages = new Set<string>();

                for (let i = 1; i <= pdf.numPages; i++) {
                    setPdfProgress(`در حال پردازش صفحه ${i} از ${pdf.numPages}...`);
                    const page = await pdf.getPage(i);
                    
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    pageTexts.push(pageText);

                    const operatorList = await page.getOperatorList();
                    for (let j = 0; j < operatorList.fnArray.length; j++) {
                        if (operatorList.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
                            const imageName = operatorList.argsArray[j][0];
                            if (processedImages.has(imageName)) continue;
                            
                            try {
                                const img = await page.objs.get(imageName);
                                if (!img || !img.data) continue;

                                let mimeType: string;
                                let base64Data: string;

                                if (img.kind === pdfjsLib.ImageKind.JPEG) {
                                    mimeType = 'image/jpeg';
                                    let binary = '';
                                    for (let k = 0; k < img.data.length; k++) {
                                        binary += String.fromCharCode(img.data[k]);
                                    }
                                    base64Data = window.btoa(binary);
                                } else {
                                    mimeType = 'image/png';
                                    const canvas = document.createElement('canvas');
                                    canvas.width = img.width;
                                    canvas.height = img.height;
                                    const ctx = canvas.getContext('2d');
                                    if (!ctx) continue;

                                    const imageData = ctx.createImageData(img.width, img.height);
                                    if (img.data.length === img.width * img.height * 3) { // RGB
                                        const rgbaData = new Uint8ClampedArray(img.width * img.height * 4);
                                        for (let k = 0; k < img.width * img.height; k++) {
                                            rgbaData[k * 4] = img.data[k * 3];
                                            rgbaData[k * 4 + 1] = img.data[k * 3 + 1];
                                            rgbaData[k * 4 + 2] = img.data[k * 3 + 2];
                                            rgbaData[k * 4 + 3] = 255;
                                        }
                                        imageData.data.set(rgbaData);
                                    } else if (img.data.length === img.width * img.height) { // Grayscale
                                        const rgbData = new Uint8ClampedArray(img.width * img.height * 4);
                                        for (let k = 0; k < img.data.length; k++) {
                                            rgbData[k * 4] = rgbData[k * 4 + 1] = rgbData[k * 4 + 2] = img.data[k];
                                            rgbData[k * 4 + 3] = 255;
                                        }
                                        imageData.data.set(rgbData);
                                    } else {
                                        continue;
                                    }
                                    ctx.putImageData(imageData, 0, 0);
                                    base64Data = canvas.toDataURL(mimeType).split(',')[1];
                                }
                                images.push({ mimeType, data: base64Data });
                                processedImages.add(imageName);
                            } catch (e) {
                                console.warn(`Could not process image ${imageName}:`, e);
                            }
                        }
                    }
                }
                setPdfProgress(`پردازش کامل شد! ${images.length} تصویر استخراج شد.`);
                setSourcePageContents(pageTexts);
                setSourceContent(pageTexts.join('\n\n'));
                setSourceImages(images);
            } catch (error) {
                console.error("Error parsing PDF:", error);
                alert("خطا در پردازش فایل PDF. لطفاً از یک فایل معتبر استفاده کنید.");
                setPdfProgress('');
            } finally {
                setIsParsingPdf(false);
                setTimeout(() => setPdfProgress(''), 3000);
            }
        };
        reader.onerror = () => {
            console.error("Error reading file.");
            alert("خطا در خواندن فایل.");
            setIsParsingPdf(false);
            setPdfProgress('');
        }
        reader.readAsArrayBuffer(file);

        if (e.target) e.target.value = '';
    };

    return (
        <div className="flex items-center justify-center min-h-full p-4 bg-gradient-to-br sm:p-6 md:p-8 from-primary/10 via-background to-secondary/20">
            <div className="w-full max-w-3xl p-6 space-y-8 border rounded-xl shadow-lg md:p-8 bg-card">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-card-foreground">موضوع یادگیری خود را وارد کنید</h2>
                    <p className="mt-2 text-muted-foreground">متن خود را کپی کنید، یک PDF بارگذاری کنید، یا یک فایل پیشرفت را باز کنید.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <textarea
                            value={sourceContent}
                            onChange={(e) => setSourceContent(e.target.value)}
                            className="w-full px-3 py-2 transition-colors duration-200 border rounded-md shadow-sm h-60 bg-background text-foreground border-border focus:ring-ring focus:border-primary disabled:bg-muted/50"
                            placeholder="مثال: فصل اول کتاب تاریخ خود را اینجا قرار دهید یا یک فایل PDF بارگذاری کنید..."
                            disabled={isParsingPdf}
                        />
                         {isParsingPdf && <div className="py-2 text-sm text-center text-muted-foreground">{pdfProgress}</div>}
                    </div>
                    
                    <div className="p-4 border rounded-md bg-secondary/50 border-border">
                      <h3 className="mb-4 font-semibold text-secondary-foreground">شخصی‌سازی یادگیری</h3>
                        <div>
                          <label htmlFor="learningGoal" className="block mb-2 text-sm font-medium text-secondary-foreground">هدف شما از یادگیری چیست؟</label>
                          <input 
                            type="text" 
                            id="learningGoal"
                            value={preferences.learningGoal} 
                            onChange={e => setPreferences({...preferences, learningGoal: e.target.value})} 
                            className="w-full p-2 border rounded-md bg-background border-border focus:ring-ring focus:border-primary" 
                            placeholder="مثال: برای امتحان آماده می‌شوم، فقط از روی کنجکاوی، ..."/>
                        </div>
                      <div className="grid grid-cols-1 gap-6 mt-4 md:grid-cols-2">
                        <div>
                          <label className="block mb-2 text-sm font-medium text-secondary-foreground">سبک توضیحات</label>
                           <select value={preferences.style} onChange={e => setPreferences({...preferences, style: e.target.value as any})} className="w-full p-2 border rounded-md bg-background border-border focus:ring-ring focus:border-primary">
                               <option value="faithful">وفادار به متن</option>
                               <option value="balanced">متعادل</option>
                               <option value="creative">خلاقانه و گسترده</option>
                           </select>
                        </div>
                         <div>
                          <label className="block mb-2 text-sm font-medium text-secondary-foreground">دستورالعمل‌های سفارشی (اختیاری)</label>
                          <input type="text" value={preferences.customInstructions} onChange={e => setPreferences({...preferences, customInstructions: e.target.value})} className="w-full p-2 border rounded-md bg-background border-border focus:ring-ring focus:border-primary" placeholder="مثال: روی جنبه تاریخی تمرکز کن"/>
                        </div>
                      </div>
                      <div className="flex items-center mt-4 space-x-2 space-x-reverse">
                        <input
                            type="checkbox"
                            id="addExplanatoryNodes"
                            checked={preferences.addExplanatoryNodes}
                            onChange={e => setPreferences({...preferences, addExplanatoryNodes: e.target.checked})}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <label htmlFor="addExplanatoryNodes" className="text-sm font-medium text-secondary-foreground">افزودن گره‌های توضیحی برای مفاهیم پیش‌نیاز</label>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        <button type="submit" className="flex items-center justify-center flex-grow w-full gap-2 px-4 py-3 font-semibold transition-transform duration-200 rounded-md text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring active:scale-95 disabled:bg-primary/70" disabled={!sourceContent.trim() || isParsingPdf}>
                            <span>ایجاد طرح یادگیری</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <div className="flex gap-4">
                            <input type="file" ref={pdfInputRef} onChange={handlePdfFileChange} accept=".pdf" className="hidden" />
                            <button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isParsingPdf} className="flex items-center justify-center w-full gap-2 px-4 py-3 font-semibold transition-transform duration-200 rounded-md sm:w-auto text-secondary-foreground bg-secondary hover:bg-accent active:scale-95 disabled:opacity-70">
                                {isParsingPdf ? <><Spinner /><span>در حال پردازش...</span></> : <><FileText className="w-5 h-5" /><span>بارگذاری PDF</span></>}
                            </button>
                            <input type="file" ref={jsonInputRef} onChange={handleJsonFileChange} accept=".json" className="hidden" />
                            <button type="button" onClick={() => jsonInputRef.current?.click()} className="flex items-center justify-center w-full gap-2 px-4 py-3 font-semibold transition-transform duration-200 rounded-md sm:w-auto text-secondary-foreground bg-secondary hover:bg-accent active:scale-95">
                                 <Upload className="w-5 h-5" />
                                <span>بارگذاری پیشرفت</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};