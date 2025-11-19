
import React, { useState, useEffect } from 'react';
import BrainAnimation from './BrainAnimation';

interface StartupScreenProps {
  onAnimationEnd: () => void;
}

const StartupScreen: React.FC<StartupScreenProps> = ({ onAnimationEnd }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('در حال راه‌اندازی موتور هوشمند...');

  useEffect(() => {
    const stages = [
      { pct: 30, msg: 'بارگذاری پایگاه دانش...' },
      { pct: 60, msg: 'بررسی وضعیت سیستم...' },
      { pct: 85, msg: 'شخصی‌سازی محیط یادگیری...' },
      { pct: 100, msg: 'آماده‌سازی نهایی...' }
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage >= stages.length) {
        clearInterval(interval);
        return;
      }
      
      const stage = stages[currentStage];
      setProgress(stage.pct);
      setStatus(stage.msg);
      currentStage++;
    }, 900); 

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center w-full h-screen bg-background text-foreground fade-out"
      style={{ animationDelay: '4s', animationFillMode: 'forwards' }}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="relative flex flex-col items-center">
          <BrainAnimation />
          
          <div className="mt-12 w-64 space-y-3 animate-pulse">
              <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden backdrop-blur-sm border border-border/50">
                  <div 
                      className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                      style={{ width: `${progress}%` }}
                  />
              </div>
              <p className="text-xs text-center text-muted-foreground font-mono h-5 tracking-wide">{status}</p>
          </div>
      </div>
    </div>
  );
};

export default StartupScreen;
