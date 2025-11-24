
import React, { useState } from 'react';
import { AuroraBackground } from './ui/aurora-background';
import { Button } from './ui/button';
import { ArrowRight, Brain } from './icons';

interface StartupScreenProps {
  onAnimationEnd: () => void;
}

const StartupScreen: React.FC<StartupScreenProps> = ({ onAnimationEnd }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleStart = () => {
    setIsExiting(true);
    setTimeout(() => {
      onAnimationEnd();
    }, 800);
  };

  return (
    <div className={`fixed inset-0 z-[9999] transition-opacity duration-700 ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <AuroraBackground showRadialGradient={true}>
        <div
          className={`relative z-10 flex flex-col items-center justify-center h-full px-4 text-center transition-all duration-700 transform ${isExiting ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}`}
        >
            <div className="mb-8 relative group cursor-pointer">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse group-hover:bg-primary/30 transition-all"></div>
                <Brain className="w-24 h-24 text-foreground relative z-10 drop-shadow-2xl transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-foreground mb-6 tracking-tight drop-shadow-lg">
                ذهن گاه
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl mb-10 max-w-md leading-relaxed font-light">
                سفری به اعماق یادگیری با هوش مصنوعی
            </p>

            <Button 
                size="lg" 
                onClick={handleStart} 
                className="text-lg font-bold px-8 py-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
                <span>شروع یادگیری</span>
                <ArrowRight className="mr-2 w-5 h-5 rotate-180" />
            </Button>
        </div>
      </AuroraBackground>
    </div>
  );
};

export default StartupScreen;