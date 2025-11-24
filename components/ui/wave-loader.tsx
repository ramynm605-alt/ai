
import React from "react";
import { cn } from "../../lib/utils";

interface WaveLoaderProps {
  className?: string;
  color?: string;
}

const WaveLoader: React.FC<WaveLoaderProps> = ({ className, color }) => {
  return (
    <div className={cn("flex items-center justify-center gap-1 h-12", className)}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1.5); opacity: 1; }
        }
        .wave-bar {
          animation: wave 1s ease-in-out infinite;
          background-color: var(--loader-color);
          width: 4px;
          height: 100%;
          border-radius: 99px;
        }
      `}} />
      {[...Array(5)].map((_, i) => (
        <div 
            key={i} 
            className="wave-bar" 
            style={{ 
                animationDelay: `${i * 0.1}s`,
                "--loader-color": color || "currentColor" 
            } as React.CSSProperties} 
        />
      ))}
    </div>
  );
};

export default WaveLoader;
