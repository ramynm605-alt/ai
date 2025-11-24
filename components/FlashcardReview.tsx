
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Flashcard, FlashcardGrade, MindMapNode } from '../types';
import { XCircle, Sparkles, BrainCircuit, CheckCircle, ArrowRight, Keyboard, Target } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

interface FlashcardReviewProps {
    cards: Flashcard[];
    mindMap: MindMapNode[];
    onGrade: (cardId: string, grade: FlashcardGrade) => void;
    onFinish: () => void;
}

const FlashcardReview: React.FC<FlashcardReviewProps> = ({ cards, mindMap, onGrade, onFinish }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [direction, setDirection] = useState(0); // For slide animation

    const currentCard = cards[currentIndex];

    const contextLabel = useMemo(() => {
        if (!currentCard) return '';
        const node = mindMap.find(n => n.id === currentCard.nodeId);
        if (!node) return '';
        
        // Find root topic
        let root = node;
        while (root.parentId) {
            const parent = mindMap.find(n => n.id === root.parentId);
            if (parent) root = parent;
            else break;
        }
        
        if (root.id === node.id) return node.title;
        return `${root.title} / ${node.title}`;
    }, [currentCard, mindMap]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!currentCard) return;

            if (e.code === 'Space' || e.key === 'Enter') {
                if (!isFlipped) {
                    setIsFlipped(true);
                }
            } else if (isFlipped) {
                switch (e.key) {
                    case '1': handleGrade(1); break;
                    case '2': handleGrade(2); break;
                    case '3': handleGrade(3); break;
                    case '4': handleGrade(4); break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFlipped, currentCard, currentIndex]);

    const handleGrade = useCallback((grade: FlashcardGrade) => {
        if (!currentCard) return;
        
        setDirection(1);
        // Slight delay to allow animation to start visually
        setTimeout(() => {
            onGrade(currentCard.id, grade);
            setIsFlipped(false);
            
            if (currentIndex < cards.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                onFinish();
            }
            setDirection(0);
        }, 200);
    }, [currentCard, currentIndex, cards.length, onGrade, onFinish]);

    // Completion State
    if (!currentCard) {
        return (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-6 text-center"
            >
                <div className="space-y-6 max-w-md w-full bg-card border border-border p-8 rounded-3xl shadow-2xl">
                    <motion.div 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        className="w-24 h-24 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto"
                    >
                        <CheckCircle className="w-12 h-12" />
                    </motion.div>
                    <div>
                        <h2 className="text-3xl font-black text-foreground mb-2">مرور تکمیل شد!</h2>
                        <p className="text-muted-foreground">شما تمام کارت‌های امروز را با موفقیت مرور کردید. حافظه شما در حال تقویت است.</p>
                    </div>
                    <button 
                        onClick={onFinish}
                        className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-transform active:scale-95"
                    >
                        بازگشت به میز کار
                    </button>
                </div>
            </motion.div>
        );
    }

    const progress = ((currentIndex) / cards.length) * 100;

    return (
        <div className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-xl flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-4 md:p-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-3 bg-card/50 px-4 py-2 rounded-full border border-border/50 backdrop-blur-md">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                    <span className="font-bold text-sm md:text-base">جعبه لایتنر</span>
                    <span className="text-xs text-muted-foreground border-r border-border pr-2 mr-1">
                        {currentIndex + 1} / {cards.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg text-xs text-muted-foreground">
                        <Keyboard className="w-4 h-4" />
                        <span>Space: چرخش | 1-4: نمره</span>
                    </div>
                    <button onClick={onFinish} className="p-2 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Progress Line */}
            <div className="w-full h-1 bg-secondary/30 absolute top-0 left-0">
                <motion.div 
                    className="h-full bg-gradient-to-r from-primary to-purple-500" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>

            {/* Main Card Area */}
            <div className="flex-grow flex flex-col items-center justify-center p-4 md:p-8 relative [perspective:1000px]">
                
                <div className="relative w-full max-w-xl aspect-[4/5] md:aspect-[16/10]">
                    <motion.div
                        className="w-full h-full relative [transform-style:preserve-3d] cursor-pointer"
                        initial={false}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                        onClick={() => !isFlipped && setIsFlipped(true)}
                    >
                        {/* FRONT FACE */}
                        <div 
                            className="absolute inset-0 [backface-visibility:hidden] w-full h-full bg-card border-2 border-border/60 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center p-8 text-center z-20"
                        >
                            {/* Context Badge */}
                            <div className="absolute top-6 left-0 right-0 flex justify-center">
                                <div className="flex items-center gap-1.5 bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-muted-foreground border border-border/50 shadow-sm">
                                    <Target className="w-3 h-3" />
                                    <span className="max-w-[200px] truncate">{contextLabel}</span>
                                </div>
                            </div>

                            <div className="flex-grow flex flex-col items-center justify-center w-full">
                                <span className="inline-block px-3 py-1 rounded-full bg-secondary text-xs font-bold text-muted-foreground mb-6">سوال</span>
                                <h3 className="text-2xl md:text-4xl font-black leading-relaxed text-foreground select-none" dir="rtl">
                                    {currentCard.front}
                                </h3>
                            </div>
                            <div className="mt-auto text-sm text-muted-foreground/50 font-medium flex items-center gap-2 animate-pulse">
                                <span>برای مشاهده پاسخ ضربه بزنید</span>
                                <ArrowRight className="w-4 h-4 rotate-180" />
                            </div>
                        </div>

                        {/* BACK FACE */}
                        <div 
                            className="absolute inset-0 [backface-visibility:hidden] w-full h-full bg-gradient-to-br from-secondary to-card border-2 border-primary/20 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
                            style={{ 
                                transform: 'rotateY(180deg)' 
                            }}
                        >
                            {/* Context Badge (Back) */}
                            <div className="absolute top-0 left-0 right-0 z-30 p-4 flex justify-center">
                                <div className="flex items-center gap-1.5 bg-background/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-muted-foreground border border-border/20">
                                    <Target className="w-3 h-3" />
                                    <span className="max-w-[200px] truncate">{contextLabel}</span>
                                </div>
                            </div>

                            <div className="p-6 border-b border-border/50 bg-primary/5 flex justify-between items-center pt-12">
                                <span className="text-xs font-bold text-primary uppercase tracking-widest">پاسخ صحیح</span>
                                <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-grow p-6 md:p-8 overflow-y-auto custom-scrollbar text-center flex items-center justify-center">
                                <div className="text-lg md:text-2xl leading-loose text-foreground font-bold" dir="rtl">
                                    {currentCard.back}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

            </div>

            {/* Controls Area */}
            <div className="h-auto min-h-[160px] p-4 md:p-8 flex items-center justify-center z-20 bg-gradient-to-t from-background via-background/90 to-transparent">
                <AnimatePresence mode="wait">
                    {!isFlipped ? (
                        <motion.button
                            key="flip-btn"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            onClick={() => setIsFlipped(true)}
                            className="px-10 py-4 bg-foreground text-background text-lg font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform active:scale-95"
                        >
                            مشاهده پاسخ
                        </motion.button>
                    ) : (
                        <motion.div 
                            key="grading-btns"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-4 gap-2 md:gap-4 w-full max-w-2xl"
                        >
                            <GradingButton 
                                label="فراموشی" 
                                subLabel="تکرار فردا" 
                                color="bg-destructive" 
                                onClick={() => handleGrade(1)} 
                                shortcut="1"
                            />
                            <GradingButton 
                                label="سخت" 
                                subLabel="۲ روز" 
                                color="bg-orange-500" 
                                onClick={() => handleGrade(2)} 
                                shortcut="2"
                            />
                            <GradingButton 
                                label="خوب" 
                                subLabel="۳ روز" 
                                color="bg-blue-500" 
                                onClick={() => handleGrade(3)} 
                                shortcut="3"
                            />
                            <GradingButton 
                                label="آسان" 
                                subLabel="۴+ روز" 
                                color="bg-success" 
                                onClick={() => handleGrade(4)} 
                                shortcut="4"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const GradingButton: React.FC<{ label: string; subLabel: string; color: string; onClick: () => void; shortcut: string }> = ({ label, subLabel, color, onClick, shortcut }) => (
    <button 
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center p-3 md:p-4 rounded-2xl bg-card border border-border hover:border-transparent transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-95 active:translate-y-0"
    >
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 ${color} transition-opacity rounded-2xl`} />
        <span className={`text-sm md:text-lg font-bold mb-1 group-hover:scale-110 transition-transform ${color.replace('bg-', 'text-')}`}>{label}</span>
        <span className="text-[10px] md:text-xs text-muted-foreground font-medium">{subLabel}</span>
        <span className="absolute top-1 left-2 text-[9px] text-muted-foreground/30 hidden md:block">{shortcut}</span>
    </button>
);

export default FlashcardReview;
