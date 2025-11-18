

import React, { useState, useRef, useEffect } from 'react';
import { MindMapNode, NodeContent } from '../types';
import { ArrowRight, MessageSquare, Sparkles } from './icons';

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
}

const LoadingSkeleton: React.FC = () => (
    <div className="space-y-2 animate-pulse">
        <div className="h-4 rounded bg-muted/20 w-3/4"></div>
        <div className="h-4 rounded bg-muted/20 w-full"></div>
        <div className="h-4 rounded bg-muted/20 w-5/6"></div>
    </div>
);


const Section: React.FC<{ title: string; content: string }> = ({ title, content }) => (
    <div className="mb-6">
        <h3 className="pb-2 mb-3 text-xl font-semibold border-b-2 text-primary border-primary/30">{title}</h3>
        {content ? (
            <div className="node-content-section markdown-content leading-relaxed text-card-foreground/90" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
            <LoadingSkeleton />
        )}
    </div>
);

const NodeView: React.FC<NodeViewProps> = ({ node, content, onBack, onStartQuiz, onNavigate, prevNode, nextNode, onExplainRequest, isIntroNode }) => {
    const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null);
    const [reminderPopup, setReminderPopup] = useState<{ x: number; y: number; content: string } | null>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    const handleMouseUp = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 5) {
            const text = selection.toString().trim();
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (viewRef.current) {
                const containerRect = viewRef.current.getBoundingClientRect();
                setReminderPopup(null); 
                setSelectionPopup({
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.top - containerRect.top - 10, 
                    text: text,
                });
            }
        } else {
            setSelectionPopup(null);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectionPopup) setSelectionPopup(null);
            if (reminderPopup) setReminderPopup(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectionPopup, reminderPopup]);

    // Reminder handling logic remains the same
    useEffect(() => {
        const handleReminderClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('reminder-trigger')) {
                const reminderContent = target.dataset.reminderText;
                if (reminderContent) {
                    const rect = target.getBoundingClientRect();
                    const containerRect = viewRef.current!.getBoundingClientRect();
                    setSelectionPopup(null);
                    setReminderPopup({
                        content: reminderContent,
                        x: rect.left - containerRect.left + rect.width / 2,
                        y: rect.top - containerRect.top,
                    });
                    event.stopPropagation(); 
                }
            }
        };
        const container = viewRef.current;
        container?.addEventListener('click', handleReminderClick);
        return () => {
            container?.removeEventListener('click', handleReminderClick);
        };
    }, []);


    return (
        <div className="relative max-w-4xl p-4 mx-auto sm:p-6 md:p-8" ref={viewRef} onMouseUp={handleMouseUp}>
             {selectionPopup && (
                <div
                    className="selection-popup"
                    style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translateX(-50%) translateY(-100%)' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                        onExplainRequest(selectionPopup.text);
                        setSelectionPopup(null);
                    }}
                >
                    <MessageSquare className="w-4 h-4" />
                    <span>توضیح بیشتر</span>
                </div>
            )}
            {reminderPopup && (
                 <div
                    className="reminder-popup"
                    style={{ left: reminderPopup.x, top: reminderPopup.y }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {reminderPopup.content}
                </div>
            )}

            <button onClick={onBack} className="flex items-center gap-2 mb-6 text-sm font-medium text-primary hover:underline">
                <ArrowRight className="w-4 h-4 transform rotate-180" />
                <span>بازگشت به نقشه ذهنی</span>
            </button>
            <div className="p-6 border rounded-lg shadow-lg sm:p-8 bg-card border-border">
                <h2 className="mb-8 text-3xl font-bold text-center text-card-foreground">{node.title}</h2>
                {isIntroNode ? (
                    content.introduction ? (
                         <div className="node-content-section markdown-content leading-relaxed text-card-foreground/90" dangerouslySetInnerHTML={{ __html: content.introduction }} />
                    ) : (
                        <LoadingSkeleton />
                    )
                ) : (
                    <>
                        {content.introduction && <Section title="مقدمه" content={content.introduction} />}
                        {content.theory && <Section title="تئوری" content={content.theory} />}
                        {content.example && <Section title="مثال کاربردی" content={content.example} />}
                        {content.connection && <Section title="ارتباط با سایر مفاهیم" content={content.connection} />}
                        {content.conclusion && <Section title="نتیجه‌گیری" content={content.conclusion} />}
                    </>
                )}
                
                {content.suggestedQuestions && content.suggestedQuestions.length > 0 && (
                    <div className="mt-8 mb-6">
                        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span>سؤالات پیشنهادی (از مربی بپرسید):</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {content.suggestedQuestions.map((q, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onExplainRequest(q)}
                                    className="px-3 py-1.5 text-sm text-left bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-full transition-colors border border-transparent hover:border-primary/30"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className={`flex flex-col items-center gap-4 pt-6 mt-8 border-t border-border sm:flex-row ${isIntroNode ? 'sm:justify-center' : 'sm:justify-between'}`}>
                    {isIntroNode ? (
                         <button 
                            onClick={onBack} 
                            className="flex items-center gap-2 px-8 py-3 font-bold text-white transition-transform duration-200 rounded-lg bg-primary hover:bg-primary-hover active:scale-95">
                            <span>شروع یادگیری و مشاهده نقشه راه</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={() => prevNode && onNavigate(prevNode.id)} 
                                disabled={!prevNode}
                                className="w-full px-6 py-2 font-semibold transition-all duration-200 rounded-lg sm:w-auto text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed hover:disabled:-translate-y-0 active:scale-95 hover:-translate-y-0.5">
                                درس قبلی
                            </button>
                            <button onClick={onStartQuiz} className="order-first w-full px-8 py-3 font-bold text-white transition-transform duration-200 rounded-lg sm:order-none sm:w-auto bg-primary hover:bg-primary-hover active:scale-95">
                                آماده‌ام، برویم برای آزمون!
                            </button>
                            <button 
                                onClick={() => nextNode && onNavigate(nextNode.id)} 
                                disabled={!nextNode || nextNode.locked}
                                className="w-full px-6 py-2 font-semibold transition-all duration-200 rounded-lg sm:w-auto text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed hover:disabled:-translate-y-0 active:scale-95 hover:-translate-y-0.5"
                                title={nextNode?.locked ? 'ابتدا باید درس فعلی را کامل کنید' : ''}
                                >
                                درس بعدی
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NodeView;
