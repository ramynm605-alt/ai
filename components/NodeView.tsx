
import React, { useState, useRef, useEffect } from 'react';
import { MindMapNode, NodeContent, Reward } from '../types';
import { ArrowRight, MessageSquare, Sparkles, Diamond, XCircle, BrainCircuit, Edit, Shuffle } from './icons';

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
}

const HeroLoader: React.FC<{ text?: string }> = ({ text = "در حال طراحی درس برای شما..." }) => (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75"></div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-full border-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                 <BrainCircuit className="w-10 h-10 text-primary animate-pulse" />
            </div>
        </div>
        <h3 className="text-xl font-bold text-foreground animate-pulse text-center px-4">{text}</h3>
        <div className="mt-2 flex gap-1">
             <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
             <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
             <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
    </div>
);

const StreamLoader: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-dashed border-primary/30 animate-pulse my-4">
        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-full">
             <Edit className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{text}</span>
        <div className="w-1.5 h-4 bg-primary/50 ml-auto animate-pulse rounded-full"></div>
    </div>
);

const Section: React.FC<{ title: string; content: string; delay: number }> = ({ title, content, delay }) => (
    <div className="mb-12 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
        <h3 className="pb-4 mb-6 text-2xl font-extrabold border-b-2 text-foreground/90 border-border/50 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-gradient-to-b from-primary to-indigo-500 rounded-full"></div>
            {title}
        </h3>
        {content ? (
            <div className="node-content-section markdown-content leading-loose text-lg text-card-foreground/90 select-text" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
            <div className="space-y-3 animate-pulse">
                 <div className="h-4 bg-muted/20 rounded w-3/4"></div>
                 <div className="h-4 bg-muted/20 rounded w-full"></div>
                 <div className="h-4 bg-muted/20 rounded w-5/6"></div>
            </div>
        )}
    </div>
);

const NodeView: React.FC<NodeViewProps> = ({ node, content, onBack, onStartQuiz, onNavigate, prevNode, nextNode, onExplainRequest, isIntroNode, onCompleteIntro, unlockedReward, isStreaming }) => {
    const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);
    const [reminderPopup, setReminderPopup] = useState<{ x: number; y: number; content: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'content' | 'reward'>('content');
    const viewRef = useRef<HTMLDivElement>(null);

    const handleSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 3) {
            const text = selection.toString().trim();
            try {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setReminderPopup(null); 
                
                // Ensure popup stays within screen bounds on mobile
                let x = rect.left + rect.width / 2;
                let y = rect.top - 10;
                
                if (x < 50) x = 50;
                if (x > window.innerWidth - 50) x = window.innerWidth - 50;
                if (y < 60) y = rect.bottom + 10; // Show below if too close to top

                setSelectionPopup({ x, y, text });
            } catch (e) {
                console.log("Selection error", e);
            }
        } else {
            setSelectionPopup(null);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        // Allow browser native selection first, then check
        setTimeout(() => {
            handleSelection();
        }, 100);
    };

    useEffect(() => {
        const handleClickOutside = () => {
            if (selectionPopup) setSelectionPopup(null);
            if (reminderPopup) setReminderPopup(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [selectionPopup, reminderPopup]);

    useEffect(() => {
        const handleReminderClick = (event: MouseEvent | TouchEvent) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('reminder-trigger')) {
                event.preventDefault(); // Prevent default link/button behavior
                event.stopPropagation();
                const reminderContent = target.dataset.reminderText;
                if (reminderContent) {
                    const rect = target.getBoundingClientRect();
                    setReminderPopup(null);
                    
                    let x = rect.left + rect.width / 2;
                    let y = rect.top;
                    
                    // Mobile adjust
                    if (x < 100) x = 100;
                    if (x > window.innerWidth - 100) x = window.innerWidth - 100;
                    
                    setReminderPopup({
                        content: reminderContent,
                        x: x,
                        y: y,
                    });
                }
            }
        };
        const container = viewRef.current;
        // Add both click and touchend
        container?.addEventListener('click', handleReminderClick);
        container?.addEventListener('touchend', handleReminderClick);
        return () => {
            container?.removeEventListener('click', handleReminderClick);
            container?.removeEventListener('touchend', handleReminderClick);
        };
    }, []);

    const isEmpty = !content.introduction && !content.theory && !content.example && !isStreaming;

    return (
        <div className="min-h-screen bg-background/95" ref={viewRef} onMouseUp={handleSelection} onTouchEnd={handleTouchEnd}>
             {selectionPopup && (
                <div
                    className="selection-popup animate-pop-in fixed z-[200] bg-foreground text-background px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 cursor-pointer"
                    style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translateX(-50%) translateY(-100%)' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => {
                        onExplainRequest(selectionPopup.text);
                        setSelectionPopup(null);
                    }}
                >
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm font-bold whitespace-nowrap">پرسش از مربی</span>
                </div>
            )}
            {reminderPopup && (
                 <div
                    className="reminder-popup fixed z-[200] bg-card border border-border shadow-2xl p-3 rounded-xl text-sm max-w-[250px] text-center"
                    style={{ left: reminderPopup.x, top: reminderPopup.y, transform: 'translateX(-50%) translateY(-110%)' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <div className="font-bold mb-1 text-primary">یادآوری</div>
                    {reminderPopup.content}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-card border-r border-b border-border rotate-45"></div>
                </div>
            )}

            {/* Hero Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                     <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-accent transition-colors group shrink-0">
                            <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                        </button>
                        <h2 className="text-lg sm:text-xl font-bold truncate">{activeTab === 'content' ? node.title : unlockedReward?.title}</h2>
                     </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                        {unlockedReward && (
                            <div className="flex items-center p-1 space-x-1 space-x-reverse rounded-lg bg-secondary/80 border border-border">
                                <button 
                                    onClick={() => setActiveTab('content')}
                                    className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'content' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    درس
                                </button>
                                <button 
                                    onClick={() => setActiveTab('reward')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${activeTab === 'reward' ? 'bg-purple-100 dark:bg-purple-900/30 shadow text-purple-700 dark:text-purple-300' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Diamond className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">تحلیل</span>
                                </button>
                            </div>
                        )}
                         <button onClick={onBack} className="sm:hidden p-2">
                             <XCircle className="w-6 h-6 text-muted-foreground" />
                         </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-6 py-10 pb-32">
                {/* Title Area */}
                <div className="text-center mb-12 animate-slide-up">
                     <h1 className="text-3xl md:text-5xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600 mb-4">
                        {activeTab === 'content' ? node.title : unlockedReward?.title}
                     </h1>
                     {activeTab === 'content' && !isStreaming && (
                         <p className="text-muted-foreground text-sm sm:text-base">برای درک بهتر، قسمتی از متن را انتخاب کنید.</p>
                     )}
                </div>

                {isEmpty && (
                    <div className="text-center py-10 animate-fade-in">
                        <p className="text-muted-foreground mb-4">محتوای این درس بارگذاری نشد.</p>
                        <button 
                            onClick={() => onNavigate(node.id)} 
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                        >
                            <Shuffle className="w-4 h-4" />
                            <span>تلاش مجدد</span>
                        </button>
                    </div>
                )}
                
                {activeTab === 'content' ? (
                    isIntroNode ? (
                        (!content.introduction && isStreaming) ? (
                             <HeroLoader text="در حال آماده‌سازی نقشه راه..." />
                        ) : (
                             content.introduction ? (
                                <div className="node-content-section markdown-content leading-loose text-lg text-card-foreground/90 animate-slide-up p-6 border border-border/50 rounded-3xl bg-card/30 shadow-sm select-text" dangerouslySetInnerHTML={{ __html: content.introduction }} />
                             ) : (
                                <HeroLoader />
                             )
                        )
                    ) : (
                        <div className="space-y-12">
                             {/* Introduction Section */}
                             {(content.introduction || isStreaming) && (
                                <div className="min-h-[100px]">
                                    {content.introduction && <Section title="مقدمه" content={content.introduction} delay={0} />}
                                    {!content.introduction && isStreaming && <HeroLoader />}
                                </div>
                             )}

                             {/* Theory Section */}
                             {(content.theory || (isStreaming && content.introduction)) && (
                                <div className="min-h-[100px]">
                                     {content.theory && <Section title="تئوری و مفاهیم" content={content.theory} delay={100} />}
                                     {!content.theory && isStreaming && content.introduction && <StreamLoader text="در حال تشریح مفاهیم..." />}
                                </div>
                             )}

                             {/* Example Section */}
                             {(content.example || (isStreaming && content.theory)) && (
                                <div className="min-h-[100px]">
                                     {content.example && <Section title="مثال کاربردی" content={content.example} delay={200} />}
                                     {!content.example && isStreaming && content.theory && <StreamLoader text="در حال یافتن مثال‌های کاربردی..." />}
                                </div>
                             )}

                             {/* Connection Section */}
                             {(content.connection || (isStreaming && content.example)) && (
                                <div className="min-h-[100px]">
                                     {content.connection && <Section title="ارتباط با سایر مفاهیم" content={content.connection} delay={300} />}
                                     {!content.connection && isStreaming && content.example && <StreamLoader text="در حال بررسی ارتباطات موضوعی..." />}
                                </div>
                             )}

                             {/* Conclusion Section */}
                             {(content.conclusion || (isStreaming && content.connection)) && (
                                <div className="min-h-[100px]">
                                     {content.conclusion && <Section title="نتیجه‌گیری" content={content.conclusion} delay={400} />}
                                     {!content.conclusion && isStreaming && content.connection && <StreamLoader text="در حال جمع‌بندی نهایی..." />}
                                </div>
                             )}
                        </div>
                    )
                ) : (
                    <div className="bg-purple-50/50 dark:bg-purple-900/10 p-8 rounded-3xl border border-purple-100 dark:border-purple-800 animate-slide-up shadow-xl">
                        <div className="flex items-center gap-4 mb-8 text-purple-700 dark:text-purple-300 pb-6 border-b border-purple-200 dark:border-purple-800">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl shadow-inner">
                                <Diamond className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">محتویات ویژه: تحلیل عمیق</h3>
                                <p className="text-sm opacity-80">پاداش عملکرد عالی شما در آزمون</p>
                            </div>
                        </div>
                         <div className="node-content-section markdown-content leading-loose text-lg text-card-foreground/90" dangerouslySetInnerHTML={{ __html: unlockedReward?.content || '' }} />
                    </div>
                )}
                
                {activeTab === 'content' && (
                    <>
                        {content.suggestedQuestions && content.suggestedQuestions.length > 0 && (
                            <div className="mt-16 mb-10 p-6 bg-secondary/20 rounded-2xl border border-secondary animate-slide-up" style={{ animationDelay: '500ms' }}>
                                <div className="flex items-center gap-3 mb-6 text-base font-bold text-muted-foreground uppercase tracking-wider">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    <span>سؤالات پیشنهادی برای پرسش از مربی</span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {content.suggestedQuestions.map((q, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => onExplainRequest(q)}
                                            className="px-5 py-3 text-sm text-right bg-card hover:bg-primary hover:text-primary-foreground text-card-foreground rounded-xl transition-all hover:shadow-md border border-border hover:border-primary duration-300"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        {(!isStreaming || content.conclusion) && (
                            <div className="w-full mt-12 p-6 bg-card/50 border border-border/50 rounded-2xl animate-slide-up" style={{ animationDelay: '600ms' }}>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    {isIntroNode ? (
                                         <button 
                                            onClick={() => onCompleteIntro ? onCompleteIntro() : onBack()} 
                                            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 font-bold text-white text-lg transition-all duration-300 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-95">
                                            <span>شروع یادگیری و مشاهده نقشه راه</span>
                                            <ArrowRight className="w-6 h-6 transform rotate-180" />
                                        </button>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => prevNode && onNavigate(prevNode.id)} 
                                                disabled={!prevNode}
                                                className="w-full sm:w-auto px-6 py-3 font-semibold transition-all duration-200 rounded-xl text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                                                درس قبلی
                                            </button>
                                            
                                            <button 
                                                onClick={onStartQuiz} 
                                                className="w-full sm:w-auto flex-grow max-w-md px-8 py-4 font-bold text-lg text-white transition-all duration-300 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                                                <span>آماده‌ام، برویم برای آزمون!</span>
                                                <ArrowRight className="w-5 h-5 transform rotate-180" />
                                            </button>

                                            <button 
                                                onClick={() => nextNode && onNavigate(nextNode.id)} 
                                                disabled={!nextNode || nextNode.locked}
                                                className="w-full sm:w-auto px-6 py-3 font-semibold transition-all duration-200 rounded-xl text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                                >
                                                درس بعدی
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default NodeView;
