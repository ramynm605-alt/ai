
import React, { useState, useEffect } from 'react';
import { StorySlide } from '../types';
import { XCircle, ChevronLeft, ChevronRight } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

interface StoryViewerProps {
    slides: StorySlide[];
    onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ slides, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') handleNext(); // RTL: Right is usually 'next' in localized UX but logically prev in time? Let's stick to visual flow. Actually right arrow usually means Next in LTR, but in RTL UI it might be flipped. Let's assume standard click.
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex]);

    const currentSlide = slides[currentIndex];

    return (
        <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
            <div className="relative w-full h-full md:max-w-[450px] md:h-[85vh] bg-black md:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                
                {/* Progress Bars */}
                <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
                    {slides.map((_, idx) => (
                        <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                            <div 
                                className={`h-full bg-white transition-all duration-300 ${idx < currentIndex ? 'w-full' : idx === currentIndex ? 'w-full animate-progress' : 'w-0'}`}
                                style={idx === currentIndex ? { transitionDuration: '5s', width: '100%' } : {}}
                            />
                        </div>
                    ))}
                </div>

                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/80 hover:text-white">
                    <XCircle className="w-8 h-8" />
                </button>

                {/* Tap Areas */}
                <div className="absolute inset-0 z-10 flex">
                    <div className="w-1/3 h-full" onClick={handlePrev} />
                    <div className="w-2/3 h-full" onClick={handleNext} />
                </div>

                {/* Slide Content */}
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`w-full h-full flex flex-col justify-center p-8 bg-gradient-to-br ${currentSlide.bgGradient}`}
                    >
                        <div className="text-center space-y-8">
                            <div className="text-8xl animate-bounce-slow drop-shadow-lg filter">
                                {currentSlide.emoji}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-white drop-shadow-md leading-tight">
                                {currentSlide.title}
                            </h2>
                            <p className="text-lg md:text-xl font-medium text-white/90 leading-relaxed drop-shadow-sm">
                                {currentSlide.content}
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>
                
                <div className="absolute bottom-6 left-0 right-0 text-center z-20">
                     <p className="text-white/50 text-xs font-bold tracking-widest uppercase">
                         برای ادامه ضربه بزنید
                     </p>
                </div>
            </div>
        </div>
    );
};

export default StoryViewer;