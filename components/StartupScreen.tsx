
import React from 'react';
import BrainAnimation from './BrainAnimation';

interface StartupScreenProps {
  onAnimationEnd: () => void;
}

const StartupScreen: React.FC<StartupScreenProps> = ({ onAnimationEnd }) => {
  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-screen transition-colors duration-300 bg-background text-foreground fade-out"
      style={{ animationDelay: '4s' }}
      onAnimationEnd={onAnimationEnd}
    >
      <BrainAnimation />
    </div>
  );
};

export default StartupScreen;