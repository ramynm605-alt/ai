
import React from "react";
import { Moon, Sun } from "./icons";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThemeToggleProps {
  className?: string;
  theme: 'light' | 'dark' | 'balanced';
  onToggle: () => void;
}

export function ThemeToggle({ className, theme, onToggle }: ThemeToggleProps) {
  // Treat 'balanced' as light for the toggle visual, or check specifically for 'dark'
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        "flex w-16 h-8 p-1 rounded-full cursor-pointer transition-all duration-300 border box-border select-none",
        isDark
          ? "bg-zinc-950 border-zinc-800"
          : "bg-white border-zinc-200",
        className
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      dir="ltr" // Force LTR to ensure translation animation works correctly regardless of app direction
    >
      <div className="flex justify-between items-center w-full">
        <div
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300 shadow-sm",
            isDark
              ? "transform translate-x-0 bg-zinc-800"
              : "transform translate-x-8 bg-gray-200"
          )}
        >
          {isDark ? (
            <Moon
              className="w-3.5 h-3.5 text-white"
              strokeWidth={1.5}
            />
          ) : (
            <Sun
              className="w-3.5 h-3.5 text-gray-700"
              strokeWidth={1.5}
            />
          )}
        </div>
        <div
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300",
            isDark
              ? "bg-transparent"
              : "transform -translate-x-8"
          )}
        >
          {isDark ? (
            <Sun
              className="w-3.5 h-3.5 text-gray-500"
              strokeWidth={1.5}
            />
          ) : (
            <Moon
              className="w-3.5 h-3.5 text-black"
              strokeWidth={1.5}
            />
          )}
        </div>
      </div>
    </div>
  );
}
