
import React, { useState, useEffect } from 'react';
import { Flashcard } from '../types';
import { CheckCircle, XCircle, Refresh, Layers } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

interface FlashcardSystemProps {
    flashcards: Flashcard[];
    onUpdateCard: (id: string, success: boolean) => void;
}

const FlashcardSystem: React.FC<FlashcardSystemProps> = ({ flashcards, onUpdateCard }) => {
    const [activeCardIndex, setActiveCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);

    useEffect(() => {
        // Filter cards due for review
        const now = Date.now();
        const due = flashcards.filter(c => c.nextReviewDate <= now);
        setReviewQueue(due);
    }, [flashcards]);

    const currentCard = reviewQueue[activeCardIndex];

    const handleNext = (success: boolean) => {
        if (!currentCard) return;
        
        setIsFlipped(false);
        setTimeout(() => {
            onUpdateCard(currentCard.id, success);
            // Move to next card locally or finish
            if (activeCardIndex < reviewQueue.length - 1) {
                setActiveCardIndex(prev => prev + 1);
            } else {
                // Finished queue, force refresh via prop update effect or show empty state
                setReviewQueue([]);
            }
        }, 300);
    };

    if (reviewQueue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-card text-muted-foreground rounded-xl border border-dashed border-border">
                <CheckCircle className="w-16 h-16 mb-4 text-success opacity-50" />
                <h3 className="text-xl font-semibold text-foreground">همه کارت‌ها مرور شدند!</h3>
                <p className="mt-2 text-sm">کارت‌های بعدی در زمان مناسب نمایش داده می‌شوند.</p>
                <div className="mt-6 grid grid-cols-5 gap-2 w-full max-w-xs">
                    {[1, 2, 3, 4, 5].map(box => (
                        <div key={box} className="flex flex-col items-center">
                            <div className="text-[10px] text-muted-foreground mb-1">جعبه {box}</div>
                            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary" 
                                    style={{ width: `${(flashcards.filter(c => c.box === box).length / Math.max(1, flashcards.length)) * 100}%` }} 
                                />
                            </div>
                             <div className="text-[10px] font-bold mt-1">{flashcards.filter(c => c.box === box).length}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    <span>مرور لایتنر ({activeCardIndex + 1}/{reviewQueue.length})</span>
                </h3>
                <div className="text-xs text-muted-foreground">جعبه: {currentCard.box}</div>
            </div>

            <div className="flex-grow relative perspective-1000">
                <motion.div 
                    className="w-full h-full relative cursor-pointer preserve-3d transition-transform duration-500"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    onClick={() => setIsFlipped(!isFlipped)}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-card to-secondary border border-border rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg">
                        <div className="text-center font-bold text-lg md:text-xl text-foreground leading-relaxed">
                            {currentCard.front}
                        </div>
                        <div className="absolute bottom-4 text-xs text-muted-foreground animate-pulse">
                            برای مشاهده پاسخ ضربه بزنید
                        </div>
                    </div>

                    {/* Back */}
                    <div 
                        className="absolute inset-0 backface-hidden bg-primary text-primary-foreground rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg overflow-y-auto"
                        style={{ transform: 'rotateY(180deg)' }}
                    >
                        <div className="text-center font-medium text-base md:text-lg leading-relaxed">
                            {currentCard.back}
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className="mt-6 flex gap-3">
                <button 
                    onClick={() => handleNext(false)}
                    className="flex-1 py-3 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                    <XCircle className="w-5 h-5" />
                    <span>فراموش کردم</span>
                </button>
                <button 
                    onClick={() => handleNext(true)}
                    className="flex-1 py-3 bg-success/10 text-success hover:bg-success/20 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                    <CheckCircle className="w-5 h-5" />
                    <span>بلدم</span>
                </button>
            </div>
        </div>
    );
};

export default FlashcardSystem;