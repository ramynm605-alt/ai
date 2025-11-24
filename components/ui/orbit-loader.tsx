
import React from "react";
import { cn } from "../../lib/utils";

interface OrbitLoaderProps {
  className?: string;
  size?: number;
  color?: string;
}

const OrbitLoader: React.FC<OrbitLoaderProps> = ({ className, size = 60, color = "#6366f1" }) => {
  return (
    <div 
        className={cn("relative flex items-center justify-center", className)}
        style={{ width: size, height: size }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes orbit-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes orbit-spin-rev {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pulse-core {
          0%, 100% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
      `}} />
      
      {/* Outer Ring */}
      <div 
        className="absolute inset-0 border-2 border-dashed rounded-full opacity-30"
        style={{ 
            borderColor: color,
            animation: 'orbit-spin 10s linear infinite' 
        }}
      />

      {/* Middle Ring */}
      <div 
        className="absolute inset-2 border-2 border-t-transparent rounded-full"
        style={{ 
            borderColor: color,
            borderTopColor: 'transparent',
            animation: 'orbit-spin 1.5s linear infinite' 
        }}
      />

      {/* Inner Ring */}
      <div 
        className="absolute inset-4 border-2 border-b-transparent rounded-full opacity-60"
        style={{ 
            borderColor: color,
            borderBottomColor: 'transparent',
            animation: 'orbit-spin-rev 2s linear infinite' 
        }}
      />

      {/* Core */}
      <div 
        className="absolute w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]"
        style={{ 
            backgroundColor: color,
            color: color,
            animation: 'pulse-core 1s ease-in-out infinite' 
        }}
      />
    </div>
  );
};

export default OrbitLoader;
