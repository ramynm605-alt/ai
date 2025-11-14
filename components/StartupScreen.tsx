
import React from 'react';
import { BookOpen } from './icons';

interface StartupScreenProps {
  onAnimationEnd: () => void;
}

const StartupScreen: React.FC<StartupScreenProps> = ({ onAnimationEnd }) => {
  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-screen transition-colors duration-300 bg-background text-foreground fade-out"
      style={{ animationDelay: '2s' }}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="flex flex-col items-center gap-4 fade-in">
        <div className="p-4 rounded-full text-primary-foreground bg-primary">
          <BookOpen className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-primary">یادگیرنده هوشمند</h1>
      </div>
    </div>
  );
};

export default StartupScreen;
