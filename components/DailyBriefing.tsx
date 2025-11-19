
import React from 'react';
import { Flame, Target, ArrowRight, CheckCircle } from './icons';
import { MindMapNode } from '../types';

interface DailyBriefingProps {
    streak: number;
    challengeContent: string | null;
    nextNode: MindMapNode | null;
    onContinue: () => void;
    onDismiss: () => void;
}

const DailyBriefing: React.FC<DailyBriefingProps> = ({ streak, challengeContent, nextNode, onContinue, onDismiss }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 fade-in">
            <div className="w-full max-w-lg overflow-hidden border shadow-2xl bg-card rounded-2xl border-border">
                {/* Header */}
                <div className="p-6 text-center text-white bg-gradient-to-r from-primary to-primary/80">
                    <div className="flex items-center justify-center mb-3">
                        <div className="flex items-center justify-center w-16 h-16 bg-white/20 rounded-full ring-4 ring-white/10">
                            <Flame className="w-8 h-8 text-yellow-300 drop-shadow-md animate-pulse" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold">روز بخیر قهرمان!</h2>
                    <p className="mt-1 text-primary-foreground/90">شما <span className="font-bold text-yellow-300 text-xl px-1">{streak}</span> روز متوالی است که در حال یادگیری هستید.</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Daily Challenge Card */}
                    {challengeContent && (
                        <div className="p-4 border-l-4 rounded-r-lg bg-secondary/50 border-primary">
                            <div className="flex items-center gap-2 mb-2 text-primary">
                                <Target className="w-5 h-5" />
                                <h3 className="font-bold">چالش مرور سریع</h3>
                            </div>
                            <div className="text-sm leading-relaxed markdown-content text-card-foreground/90" dangerouslySetInnerHTML={{ __html: challengeContent }} />
                        </div>
                    )}

                    {/* Next Step */}
                    {nextNode ? (
                        <div className="text-center">
                            <p className="mb-3 text-muted-foreground">آماده‌ای برای ادامه مسیر؟</p>
                            <button 
                                onClick={onContinue}
                                className="flex items-center justify-center w-full gap-2 py-4 text-lg font-bold text-white transition-transform rounded-xl bg-primary hover:bg-primary-hover hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20"
                            >
                                <span>ادامه درس: {nextNode.title}</span>
                                <ArrowRight className="w-6 h-6" />
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                             <button 
                                onClick={onDismiss}
                                className="flex items-center justify-center w-full gap-2 py-4 text-lg font-bold text-white transition-transform rounded-xl bg-success hover:bg-success/90 hover:scale-[1.02] active:scale-95"
                            >
                                <CheckCircle className="w-6 h-6" />
                                <span>ورود به داشبورد</span>
                            </button>
                        </div>
                    )}
                    
                    <button onClick={onDismiss} className="w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                        الان نه، بعداً
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyBriefing;