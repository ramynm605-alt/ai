
import React, { useState, useEffect } from 'react';
import { Flashcard, FlashcardGrade } from '../types';
import { XCircle, Sparkles, BrainCircuit, CheckCircle } from './icons';

interface FlashcardReviewProps {
    cards: Flashcard[];
    onGrade: (cardId: string, grade: FlashcardGrade) => void;
    onFinish: () => void;
}

const FlashcardReview: React.FC<FlashcardReviewProps> = ({ cards, onGrade, onFinish }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showGrading, setShowGrading] = useState(false);

    const currentCard = cards[currentIndex];

    useEffect(() => {
        if (currentIndex >= cards.length) {
            setTimeout(onFinish, 500);
        }
    }, [currentIndex, cards.length, onFinish]);

    const handleFlip = () => {
        if (!isFlipped) {
            setIsFlipped(true);
            setTimeout(() => setShowGrading(true), 300);
        } else {
            // If clicked again, do nothing or toggle back? Usually toggle back.
            // But we need to grade to proceed.
            // Let's allow toggle back but keep grading visible
            setIsFlipped(false);
        }
    };

    const handleGrade = (grade: FlashcardGrade) => {
        onGrade(currentCard.id, grade);
        // Reset state for next card
        setShowGrading(false);
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex(prev => prev + 1), 300); // Wait for flip animation
    };

    if (!currentCard) {
        return (
            <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-6 text-center animate-fade-in">
                <div className="space-y-4">
                    <CheckCircle className="w-20 h-20 text-success mx-auto" />
                    <h2 className="text-3xl font-bold text-foreground">مرور تکمیل شد!</h2>
                    <p className="text-muted-foreground">شما تمام کارت‌های امروز را مرور کردید.</p>
                </div>
            </div>
        );
    }

    const progress = ((currentIndex) / cards.length) * 100;

    return (
        <div className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-lg flex flex-col">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-6 h-6 text-primary" />
                    <span className="font-bold text-lg">جعبه لایتنر</span>
                </div>
                <button onClick={onFinish} className="p-2 rounded-full hover:bg-secondary">
                    <XCircle className="w-6 h-6 text-muted-foreground" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-secondary mb-4">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>

            {/* Card Area */}
            <div className="flex-grow flex items-center justify-center p-6 perspective-1000 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                
                <div 
                    className={`relative w-full max-w-md aspect-[3/4] sm:aspect-video transition-transform duration-500 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                    onClick={handleFlip}
                >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden bg-card border border-border rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 text-center">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">سوال</span>
                        <h3 className="text-xl md:text-2xl font-bold leading-relaxed text-foreground">{currentCard.front}</h3>
                        <p className="absolute bottom-6 text-xs text-muted-foreground animate-pulse">برای مشاهده پاسخ ضربه بزنید</p>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-primary/10 to-card border border-primary/20 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 text-center">
                        <span className="text-xs font-bold text-primary uppercase tracking-widest mb-4">پاسخ</span>
                        <div className="text-lg md:text-xl leading-relaxed text-foreground overflow-y-auto max-h-[70%] w-full">
                            {currentCard.back}
                        </div>
                    </div>
                </div>
            </div>

            {/* Grading Controls */}
            <div className="p-6 pb-8 h-32 flex items-center justify-center">
                {showGrading ? (
                    <div className="grid grid-cols-4 gap-3 w-full max-w-md animate-slide-up">
                        <button onClick={() => handleGrade(1)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <span className="font-bold text-sm">فراموشی</span>
                            <span className="text-[10px] opacity-70">۱ روز</span>
                        </button>
                        <button onClick={() => handleGrade(2)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors">
                            <span className="font-bold text-sm">سخت</span>
                            <span className="text-[10px] opacity-70">۲ روز</span>
                        </button>
                        <button onClick={() => handleGrade(3)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors">
                            <span className="font-bold text-sm">خوب</span>
                            <span className="text-[10px] opacity-70">۳ روز</span>
                        </button>
                        <button onClick={() => handleGrade(4)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-success/10 text-success hover:bg-success/20 transition-colors">
                            <span className="font-bold text-sm">آسان</span>
                            <span className="text-[10px] opacity-70">۴+ روز</span>
                        </button>
                    </div>
                ) : (
                    <div className="text-muted-foreground text-sm">
                        <Sparkles className="w-5 h-5 mx-auto mb-1" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlashcardReview;
