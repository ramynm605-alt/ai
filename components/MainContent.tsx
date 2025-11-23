
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAppActions } from '../hooks/useAppActions';
import { AppStatus } from '../types';
import { FileText, Wand, FileQuestion, Shuffle, BrainCircuit, Upload, ArrowRight, Sparkles, Target, MessageSquare, XCircle } from './icons';
import BoxLoader from './ui/box-loader';
import MindMap from './MindMap';
import NodeView from './NodeView';
import QuizView from './QuizView';
import QuizReview from './QuizReview';
import PreAssessmentReview from './PreAssessmentReview';
import PersonalizationWizard from './PersonalizationWizard';

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

interface MainContentProps {
    actions: ReturnType<typeof useAppActions>;
}

const MainContent: React.FC<MainContentProps> = ({ actions }) => {
    const { state, dispatch } = useApp();
    const [textInput, setTextInput] = useState('');
    const [topicInput, setTopicInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasStartedGeneration = useRef(false);

    const handleRandomStudy = () => {
        const randomTopic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
        setTopicInput(randomTopic);
        dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: randomTopic, sourcePageContents: null, sourceImages: [] } });
    };

    // Trigger plan generation when status is LOADING
    useEffect(() => {
        if (state.status === AppStatus.LOADING && state.mindMap.length === 0 && !hasStartedGeneration.current) {
            if (state.sourceContent || (state.sourceImages && state.sourceImages.length > 0)) {
                hasStartedGeneration.current = true;
                actions.generatePlanInternal().catch(err => {
                    console.error("Plan generation failed:", err);
                    hasStartedGeneration.current = false;
                });
            }
        }
        
        if (state.status !== AppStatus.LOADING) {
            hasStartedGeneration.current = false;
        }
    }, [state.status, state.mindMap.length, state.sourceContent, state.sourceImages, actions]);

    return (
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
                                        onClick={() => actions.handleStartFromText(textInput)}
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
                                        onClick={() => actions.handleTopicStudy(topicInput)}
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
                                <input type="file" ref={fileInputRef} className="hidden" onChange={actions.handleFileUpload} accept=".pdf,.txt,image/*" />
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

            {state.status === AppStatus.WIZARD && (
                <PersonalizationWizard 
                    initialPreferences={state.preferences}
                    onSubmit={actions.handleWizardComplete}
                    onSkip={() => actions.handleWizardComplete(state.preferences)}
                />
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

            {(state.status === AppStatus.LOADING || state.status === AppStatus.GENERATING_REMEDIAL || state.status === AppStatus.GRADING_PRE_ASSESSMENT || state.status === AppStatus.ADAPTING_PLAN || state.status === AppStatus.GRADING_QUIZ) && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 fade-in">
                    <BoxLoader size={120} />
                    <p className="text-xl font-medium text-muted-foreground animate-pulse px-4 text-center">
                        {state.loadingMessage || 
                         (state.status === AppStatus.GRADING_PRE_ASSESSMENT ? 'در حال تحلیل پاسخ‌ها و تعیین سطح...' : 
                          state.status === AppStatus.GRADING_QUIZ ? 'در حال تصحیح آزمون و تحلیل عملکرد...' : 
                          'در حال پردازش...')}
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
                    onSubmit={actions.handlePreAssessmentSubmit} 
                />
            )}

            {state.status === AppStatus.PRE_ASSESSMENT_REVIEW && state.preAssessmentAnalysis && (
                <PreAssessmentReview 
                    analysis={state.preAssessmentAnalysis} 
                    onStart={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} 
                />
            )}

            {(state.status === AppStatus.LEARNING || state.status === AppStatus.VIEWING_NODE || state.status === AppStatus.TAKING_QUIZ || state.status === AppStatus.QUIZ_REVIEW) && (
                <div className="flex flex-col h-full relative">
                    <div className="absolute inset-0 z-0">
                        <MindMap 
                            nodes={state.mindMap} 
                            progress={Object.keys(state.userProgress).reduce((acc, key) => ({...acc, [key]: state.userProgress[key].status}), {} as {[key: string]: 'completed' | 'failed' | 'in_progress'})} 
                            suggestedPath={state.suggestedPath}
                            onSelectNode={actions.handleNodeSelect} 
                            onTakeQuiz={actions.handleTakeQuiz}
                            theme={state.theme}
                            activeNodeId={state.activeNodeId}
                            showSuggestedPath={true}
                            isSelectionMode={state.isPodcastMode}
                            selectedNodeIds={state.podcastConfig?.selectedNodeIds}
                        />
                         {state.status === AppStatus.LEARNING && (
                            <div className="absolute top-4 right-4 z-30 bg-card/80 backdrop-blur p-3 rounded-lg border border-border shadow-sm max-w-[200px] hidden md:block">
                                <p className="text-xs text-muted-foreground">مسیر پیشنهادی با شماره مشخص شده است. از گره شماره ۱ شروع کنید.</p>
                            </div>
                        )}
                    </div>

                    {state.status !== AppStatus.LEARNING && !state.isPodcastMode && (
                        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto animate-zoom-in">
                            {state.status === AppStatus.VIEWING_NODE && state.activeNodeId && (
                                <NodeView 
                                    node={state.mindMap.find(n => n.id === state.activeNodeId)!} 
                                    content={state.streamingNodeContent || state.nodeContents[state.activeNodeId] || { introduction: '', theory: '', example: '', connection: '', conclusion: '', suggestedQuestions: [] }} 
                                    onBack={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })}
                                    onStartQuiz={() => actions.handleTakeQuiz(state.activeNodeId!)}
                                    onNavigate={actions.handleNodeSelect}
                                    prevNode={null}
                                    nextNode={null}
                                    onExplainRequest={actions.handleExplainRequest}
                                    isIntroNode={state.mindMap.find(n => n.id === state.activeNodeId)?.parentId === null}
                                    onCompleteIntro={() => dispatch({ type: 'COMPLETE_INTRO_NODE' })}
                                    unlockedReward={state.rewards.find(r => r.relatedNodeId === state.activeNodeId)}
                                    isStreaming={!!state.streamingNodeContent}
                                />
                            )}

                            {state.status === AppStatus.TAKING_QUIZ && state.activeQuiz && (
                                <QuizView 
                                    title={`آزمون: ${state.mindMap.find(n => n.id === state.activeNodeId)?.title}`} 
                                    quiz={state.activeQuiz} 
                                    onSubmit={actions.handleQuizSubmit} 
                                />
                            )}

                            {state.status === AppStatus.QUIZ_REVIEW && state.quizResults && (
                                <QuizReview 
                                    results={state.quizResults} 
                                    onFinish={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} 
                                    attempts={state.userProgress[state.activeNodeId!]?.attempts || 1}
                                    onForceUnlock={() => dispatch({ type: 'FORCE_UNLOCK_NODE' })}
                                    rewardUnlocked={!!state.rewards.find(r => r.relatedNodeId === state.activeNodeId && new Date(r.unlockedAt).getTime() > Date.now() - 60000)}
                                    onGenerateRemedial={actions.handleGenerateRemedial}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MainContent;
