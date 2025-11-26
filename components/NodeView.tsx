
import React, { useState, useRef, useEffect } from 'react';
import { MindMapNode, NodeContent, Reward } from '../types';
import { ArrowRight, MessageSquare, Sparkles, Diamond, XCircle, BrainCircuit, Edit, Shuffle, Target, CheckCircle, ArrowLeft, ClipboardList, Mic, Flame, Gamepad, GraduationCap } from './icons';
import { evaluateNodeInteraction } from '../services/geminiService';
import WaveLoader from './ui/wave-loader';
import BoxLoader from './ui/box-loader';
import { marked } from 'marked';

interface NodeViewProps {
    node: MindMapNode;
    content: NodeContent;
    onBack: () => void;
    onStartQuiz: () => void;
    onNavigate: (nodeId: string) => void;
    prevNode: MindMapNode | null;
    nextNode: MindMapNode | null;
    onExplainRequest: (text: string) => void;
    isIntroNode: boolean;
    onCompleteIntro?: () => void;
    unlockedReward?: Reward;
    isStreaming?: boolean;
    onGenerateFlashcards?: () => void;
    onTriggerFeynman?: () => void; // New
    onTriggerDebate?: () => void; // New
    onStartScenario?: () => void; // New
}

const parseMarkdown = (text: string | undefined | null) => {
    if (!text) return '';
    try {
        return marked.parse(text) as string;
    } catch (e) {
        console.error("Markdown parsing error", e);
        return text || '';
    }
};

const HeroLoader: React.FC<{ text?: string }> = ({ text = "در حال نگارش درس..." }) => (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="relative mb-6 flex items-center justify-center">
            <WaveLoader className="h-16 scale-150" color="rgb(var(--primary))" />
        </div>
        <h3 className="text-xl font-bold text-foreground animate-pulse text-center px-4">{text}</h3>
    </div>
);

const StreamLoader: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-dashed border-primary/30 animate-pulse my-4">
        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-full">
             <Edit className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{text}</span>
    </div>
);

const Section: React.FC<{ title: string; content: string; delay: number }> = ({ title, content, delay }) => (
    <div className="mb-8 md:mb-12 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
        <h3 className="pb-3 md:pb-4 mb-4 md:mb-6 text-xl md:text-2xl font-extrabold border-b-2 text-foreground/90 border-border/50 flex items-center gap-3">
            <div className="w-1.5 h-6 md:h-8 bg-gradient-to-b from-primary to-indigo-500 rounded-full"></div>
            {title}
        </h3>
        <div className="node-content-section markdown-content leading-loose text-base md:text-lg text-card-foreground/90 select-text" dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
    </div>
);

const CoachBubble: React.FC<{ type: 'feynman' | 'debate', onClick: () => void, onClose: () => void }> = ({ type, onClick, onClose }) => {
    const isFeynman = type === 'feynman';
    return (
        <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] animate-slide-up flex items-end gap-2">
            <div className="relative group">
                <button 
                    onClick={onClose}
                    className="absolute -top-2 -left-2 bg-secondary hover:bg-destructive text-muted-foreground hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                >
                    <XCircle className="w-3 h-3" />
                </button>
                
                <button 
                    onClick={onClick}
                    className={`flex items-center gap-3 p-4 rounded-2xl shadow-2xl border transition-transform hover:scale-105 active:scale-95 cursor-pointer ${isFeynman ? 'bg-orange-500 text-white border-orange-400' : 'bg-indigo-600 text-white border-indigo-500'}`}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isFeynman ? 'bg-white/20' : 'bg-white/20'}`}>
                        {isFeynman ? <Mic className="w-5 h-5" /> : <Flame className="w-5 h-5 animate-pulse" />}
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] opacity-80 font-bold mb-0.5">{isFeynman ? 'چالش مربی' : 'بحث آزاد'}</p>
                        <p className="text-xs font-bold">
                            {isFeynman ? 'میتونی اینو برام توضیح بدی؟ 🤔' : 'من با این قسمت مخالفم! نظرت چیه؟ 🤨'}
                        </p>
                    </div>
                </button>
            </div>
        </div>
    );
};

const NodeView: React.FC<NodeViewProps> = ({ node, content, onBack, onStartQuiz, onNavigate, prevNode, nextNode, onExplainRequest, isIntroNode, onCompleteIntro, unlockedReward, isStreaming, onGenerateFlashcards, onTriggerFeynman, onTriggerDebate, onStartScenario }) => {
    const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);
    const [reminderPopup, setReminderPopup] = useState<{ x: number; y: number; content: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'content' | 'reward'>('content');
    
    // Interactive Coach State
    const [coachNotification, setCoachNotification] = useState<'feynman' | 'debate' | null>(null);
    
    const viewRef = useRef<HTMLDivElement>(null);

    // Interactive Task State
    const [taskInput, setTaskInput] = useState('');
    const [taskFeedback, setTaskFeedback] = useState<string | null>(null);
    const [isEvaluatingTask, setIsEvaluatingTask] = useState(false);

    // Trigger Coach Notification Timer
    useEffect(() => {
        if (isStreaming || isIntroNode) return;
        
        // Random time between 30s and 60s
        const delay = Math.floor(Math.random() * (60000 - 30000 + 1) + 30000);
        
        const timer = setTimeout(() => {
            // Randomly choose type: 60% Feynman, 40% Debate
            const type = Math.random() > 0.4 ? 'feynman' : 'debate';
            setCoachNotification(type);
        }, delay);

        return () => clearTimeout(timer);
    }, [node.id, isStreaming, isIntroNode]);

    const handleCoachClick = () => {
        if (coachNotification === 'feynman' && onTriggerFeynman) {
            onTriggerFeynman();
        } else if (coachNotification === 'debate' && onTriggerDebate) {
            onTriggerDebate();
        }
        setCoachNotification(null);
    };

    const handleTaskSubmit = async () => {
        if (!taskInput.trim() || !content.interactiveTask) return;
        setIsEvaluatingTask(true);
        try {
            const feedback = await evaluateNodeInteraction(
                node.title, 
                node.learningObjective || "General", 
                content.interactiveTask, 
                taskInput, 
                content.theory || ""
            );
            setTaskFeedback(feedback);
        } catch (e) {
            setTaskFeedback("خطا در ارتباط با مربی. لطفاً دوباره تلاش کنید.");
        } finally {
            setIsEvaluatingTask(false);
        }
    };

    const handleSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 3) {
            const text = selection.toString().trim();
            try {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setReminderPopup(null); 
                let x = rect.left + rect.width / 2;
                let y = rect.top - 10;
                if (x < 50) x = 50;
                if (x > window.innerWidth - 50) x = window.innerWidth - 50;
                if (y < 60) y = rect.bottom + 10;
                setSelectionPopup({ x, y, text });
            } catch (e) {
                console.log("Selection error", e);
            }
        } else {
            setSelectionPopup(null);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        setTimeout(() => { handleSelection(); }, 100);
    };

    useEffect(() => {
        const handleClickOutside = () => {
            if (selectionPopup) setSelectionPopup(null);
            if (reminderPopup) setReminderPopup(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectionPopup, reminderPopup]);

    const isEmpty = !content.introduction && !content.theory && !content.example && !isStreaming;

    // Check if we have enough content to show navigation, even if conclusion is missing
    const hasContent = content.theory || content.introduction || content.example;

    return (
        <div className="min-h-screen bg-background/95" ref={viewRef} onMouseUp={handleSelection} onTouchEnd={handleTouchEnd}>
             {selectionPopup && (
                <div
                    className="selection-popup animate-pop-in fixed z-[200] bg-foreground text-background px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 cursor-pointer"
                    style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translateX(-50%) translateY(-100%)' }}
                    onClick={() => {
                        onExplainRequest(selectionPopup.text);
                        setSelectionPopup(null);
                    }}
                >
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm font-bold whitespace-nowrap">پرسش از مربی</span>
                </div>
            )}

            {/* Coach Notification Bubble */}
            {coachNotification && (
                <CoachBubble 
                    type={coachNotification} 
                    onClick={handleCoachClick} 
                    onClose={() => setCoachNotification(null)} 
                />
            )}

            {/* Hero Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between gap-4">
                     <div className="flex items-center gap-2 md:gap-3 flex-1 overflow-hidden">
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-accent transition-colors group shrink-0">
                            <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground group-hover:text-primary" />
                        </button>
                        <h2 className="text-sm sm:text-xl font-bold truncate leading-tight">{activeTab === 'content' ? node.title : unlockedReward?.title}</h2>
                     </div>
                     
                     {/* Skill Badge in Header */}
                     {!isIntroNode && node.targetSkill && (
                         <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md text-xs font-medium text-primary">
                             <Target className="w-3 h-3" />
                             <span>مهارت: {node.targetSkill}</span>
                         </div>
                     )}

                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        {/* Desktop Action Buttons Group */}
                        {activeTab === 'content' && !isStreaming && !isIntroNode && (
                            <div className="hidden sm:flex gap-2">
                                {onGenerateFlashcards && (
                                    <button 
                                        onClick={onGenerateFlashcards}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-colors border border-yellow-500/20"
                                        title="ساخت فلش‌کارت مرور"
                                    >
                                        <ClipboardList className="w-4 h-4" />
                                        <span>مرور</span>
                                    </button>
                                )}
                                {onStartScenario && (
                                    <button 
                                        onClick={onStartScenario}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all border border-white/10 animate-pulse-slow"
                                        title="شبیه‌سازی موقعیت"
                                    >
                                        <Gamepad className="w-4 h-4" />
                                        <span>شبیه‌سازی</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {unlockedReward && (
                            <div className="flex items-center p-1 space-x-1 space-x-reverse rounded-lg bg-secondary/80 border border-border">
                                <button onClick={() => setActiveTab('content')} className={`px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-bold rounded-md transition-all ${activeTab === 'content' ? 'bg-background shadow text-primary' : 'text-muted-foreground'}`}>درس</button>
                                <button onClick={() => setActiveTab('reward')} className={`flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-bold rounded-md transition-all ${activeTab === 'reward' ? 'bg-purple-100 text-purple-700' : 'text-muted-foreground'}`}>
                                    <Diamond className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                    <span className="hidden sm:inline">تحلیل</span>
                                </button>
                            </div>
                        )}
                         <button onClick={onBack} className="sm:hidden p-2"><XCircle className="w-5 h-5 text-muted-foreground" /></button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-32">
                {/* Title Area with Objective */}
                <div className="text-center mb-8 md:mb-12 animate-slide-up">
                     <h1 className="text-2xl md:text-5xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600 mb-2 md:mb-4">
                        {activeTab === 'content' ? node.title : unlockedReward?.title}
                     </h1>
                     {activeTab === 'content' && node.learningObjective && (
                         <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-secondary/50 border border-border text-xs md:text-sm text-muted-foreground">
                             <Target className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                             <span className="font-medium">هدف: {node.learningObjective}</span>
                         </div>
                     )}
                </div>

                {isEmpty && (
                    <div className="text-center py-10 animate-fade-in">
                        <p className="text-muted-foreground mb-4">محتوای این درس بارگذاری نشد.</p>
                        <button onClick={() => onNavigate(node.id)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"><Shuffle className="w-4 h-4" /><span>تلاش مجدد</span></button>
                    </div>
                )}
                
                {activeTab === 'content' ? (
                    isIntroNode ? (
                        !content.introduction && isStreaming ? <HeroLoader text="در حال آماده‌سازی نقشه راه..." /> : (
                             <div className="node-content-section markdown-content leading-loose text-base md:text-lg text-card-foreground/90 animate-slide-up p-4 md:p-6 border border-border/50 rounded-3xl bg-card/30 shadow-sm select-text" dangerouslySetInnerHTML={{ __html: parseMarkdown(content.introduction) }} />
                        )
                    ) : (
                        <div className="space-y-8 md:space-y-12">
                             {/* Standard Sections */}
                             {(content.introduction || isStreaming) && (<div className="min-h-[100px]">{content.introduction && <Section title="مقدمه" content={content.introduction} delay={0} />}</div>)}
                             {(content.theory || (isStreaming && content.introduction)) && (<div className="min-h-[100px]">{content.theory && <Section title="تئوری و مفاهیم" content={content.theory} delay={100} />}</div>)}
                             {(content.example || (isStreaming && content.theory)) && (<div className="min-h-[100px]">{content.example && <Section title="مثال کاربردی" content={content.example} delay={200} />}</div>)}
                             {(content.connection || (isStreaming && content.example)) && (<div className="min-h-[100px]">{content.connection && <Section title="ارتباط با سایر مفاهیم" content={content.connection} delay={300} />}</div>)}
                             
                             {/* Interactive Task Section */}
                             {(content.interactiveTask || (isStreaming && content.connection)) && (
                                <div className="min-h-[100px] animate-slide-up" style={{ animationDelay: '400ms' }}>
                                     {content.interactiveTask ? (
                                         <div className="bg-gradient-to-br from-secondary/30 to-primary/5 border-2 border-primary/20 rounded-2xl p-5 md:p-8 shadow-lg">
                                             <h3 className="flex items-center gap-3 text-lg md:text-xl font-bold text-primary mb-4">
                                                 <BrainCircuit className="w-6 h-6" />
                                                 چالش یادگیری فعال
                                             </h3>
                                             <p className="text-base md:text-lg leading-relaxed mb-6 text-foreground/90 font-medium">{content.interactiveTask}</p>
                                             
                                             {!taskFeedback ? (
                                                 <div className="space-y-4">
                                                     <textarea 
                                                         value={taskInput}
                                                         onChange={(e) => setTaskInput(e.target.value)}
                                                         placeholder="پاسخ و تحلیل خود را اینجا بنویسید..."
                                                         className="w-full p-4 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary min-h-[120px] resize-none"
                                                     />
                                                     <button 
                                                         onClick={handleTaskSubmit}
                                                         disabled={isEvaluatingTask || !taskInput.trim()}
                                                         className="w-full sm:w-auto px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                                                     >
                                                         {isEvaluatingTask ? (
                                                             <>
                                                                 <WaveLoader className="h-4 w-16" color="white" />
                                                                 <span>در حال تحلیل پاسخ...</span>
                                                             </>
                                                         ) : (
                                                             <>
                                                                 <span>ارسال برای تحلیل مربی</span>
                                                                 <ArrowLeft className="w-5 h-5" />
                                                             </>
                                                         )}
                                                     </button>
                                                 </div>
                                             ) : (
                                                 <div className="bg-background/80 border border-primary/20 rounded-xl p-5 animate-fade-in">
                                                     <div className="flex items-center gap-2 mb-3 text-success font-bold">
                                                         <CheckCircle className="w-5 h-5" />
                                                         <span>بازخورد هوشمند مربی</span>
                                                     </div>
                                                     <div className="markdown-content leading-loose text-card-foreground" dangerouslySetInnerHTML={{ __html: parseMarkdown(taskFeedback) }} />
                                                     <button onClick={() => setTaskFeedback(null)} className="mt-4 text-sm text-primary hover:underline">تلاش مجدد / ویرایش پاسخ</button>
                                                 </div>
                                             )}
                                         </div>
                                     ) : (
                                         isStreaming && content.connection && <StreamLoader text="در حال طراحی چالش تعاملی..." />
                                     )}
                                </div>
                             )}

                             {(content.conclusion || (isStreaming && content.interactiveTask)) && (<div className="min-h-[100px]">{content.conclusion && <Section title="نتیجه‌گیری" content={content.conclusion} delay={500} />}</div>)}
                        </div>
                    )
                ) : (
                    <div className="bg-purple-50/50 dark:bg-purple-900/10 p-6 md:p-8 rounded-3xl border border-purple-100 dark:border-purple-800 animate-slide-up shadow-xl">
                         <div className="node-content-section markdown-content leading-loose text-base md:text-lg text-card-foreground/90" dangerouslySetInnerHTML={{ __html: parseMarkdown(unlockedReward?.content) }} />
                    </div>
                )}
                
                {/* Footer Actions - Show if content exists, even if conclusion is missing */}
                {activeTab === 'content' && !isStreaming && hasContent && (
                    <div className="w-full mt-8 md:mt-12 p-4 md:p-6 bg-card/50 border border-border/50 rounded-2xl animate-slide-up" style={{ animationDelay: '600ms' }}>
                        
                        {/* Mobile Action Buttons - Ensure visibility */}
                        {!isIntroNode && (
                            <div className="sm:hidden grid grid-cols-1 gap-3 mb-4">
                                {onGenerateFlashcards && (
                                    <button 
                                        onClick={onGenerateFlashcards}
                                        className="w-full flex items-center justify-center gap-2 py-3 text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 rounded-xl font-bold"
                                    >
                                        <ClipboardList className="w-5 h-5" />
                                        <span>افزودن کارت مرور</span>
                                    </button>
                                )}
                                {onStartScenario && (
                                    <button 
                                        onClick={onStartScenario}
                                        className="w-full flex items-center justify-center gap-2 py-3 text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl font-bold shadow-lg hover:shadow-purple-500/30 active:scale-95 transition-all"
                                    >
                                        <Gamepad className="w-5 h-5" />
                                        <span>شبیه‌سازی سناریو</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4">
                            {isIntroNode ? (
                                    <button onClick={() => onCompleteIntro ? onCompleteIntro() : onBack()} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 font-bold text-white text-lg transition-all duration-300 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-95">
                                    <span>شروع یادگیری و مشاهده نقشه راه</span>
                                    <GraduationCap className="w-6 h-6" />
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => prevNode && onNavigate(prevNode.id)} disabled={!prevNode} className="w-full sm:w-auto px-6 py-3 font-semibold transition-all duration-200 rounded-xl text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50">درس قبلی</button>
                                    <button onClick={onStartQuiz} className="w-full sm:w-auto flex-grow max-w-md px-8 py-4 font-bold text-lg text-white transition-all duration-300 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                                        <span>آماده‌ام، برویم برای آزمون!</span>
                                        <ArrowRight className="w-5 h-5 transform rotate-180" />
                                    </button>
                                    <button onClick={() => nextNode && onNavigate(nextNode.id)} disabled={!nextNode || nextNode.locked} className="w-full sm:w-auto px-6 py-3 font-semibold transition-all duration-200 rounded-xl text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50">درس بعدی</button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NodeView;
