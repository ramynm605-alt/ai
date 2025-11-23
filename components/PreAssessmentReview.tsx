
import React from 'react';
import { PreAssessmentAnalysis } from '../types';
import { BrainCircuit, CheckCircle, Target, ArrowRight, Shield } from './icons';

interface PreAssessmentReviewProps {
    analysis: PreAssessmentAnalysis;
    onStart: () => void;
}

const ConceptProgressBar: React.FC<{ label: string; score: number }> = ({ label, score }) => {
    let colorClass = 'bg-primary';
    if (score < 50) colorClass = 'bg-destructive';
    else if (score < 80) colorClass = 'bg-yellow-500';
    else colorClass = 'bg-success';

    return (
        <div className="mb-3">
            <div className="flex justify-between text-sm font-medium mb-1">
                <span className="text-card-foreground">{label}</span>
                <span className={score < 50 ? 'text-destructive font-bold' : 'text-muted-foreground'}>{score}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-1000 ease-out ${colorClass}`} 
                    style={{ width: `${score}%` }} 
                />
            </div>
        </div>
    );
};

const PreAssessmentReview: React.FC<PreAssessmentReviewProps> = ({ analysis, onStart }) => {
    return (
        <div className="flex items-center justify-center min-h-full p-4 bg-background sm:p-6 md:p-8">
            <div className="w-full max-w-4xl p-6 space-y-8 border rounded-xl shadow-lg md:p-8 bg-card animate-slide-up">
                
                {/* Header */}
                <div className="text-center border-b border-border pb-6">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20 text-primary shadow-inner">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-bold text-card-foreground">کارنامه تحلیلی مهارت‌ها</h2>
                    <p className="mt-2 text-muted-foreground">تحلیل دقیق عملکرد شما در ابعاد مختلف یادگیری</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Narrative Analysis */}
                    <div className="space-y-6">
                        <div className="p-5 border rounded-xl bg-secondary/30 border-border">
                            <h3 className="mb-3 text-lg font-bold text-secondary-foreground flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-primary" />
                                تحلیل ساختاری مربی
                            </h3>
                            <p className="text-secondary-foreground/90 leading-relaxed text-justify text-sm">
                                {analysis.overallAnalysis}
                            </p>
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <span className="inline-flex items-center px-3 py-1 text-sm font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                                   سطح پیشنهادی: {analysis.recommendedLevel}
                                </span>
                            </div>
                        </div>
                        
                         {/* Key Insights */}
                        <div className="grid grid-cols-1 gap-4">
                            {/* Strengths */}
                            <div className="p-4 border rounded-lg bg-success/5 border-success/20">
                                <h3 className="flex items-center gap-2 mb-3 text-sm font-bold text-success">
                                    <CheckCircle className="w-4 h-4" />
                                    نقاط قوت (مسلط)
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.strengthTags.length > 0 ? analysis.strengthTags.map((tag, i) => (
                                        <span key={i} className="px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/10 rounded border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300">{tag}</span>
                                    )) : <span className="text-xs text-muted-foreground">موردی یافت نشد</span>}
                                </div>
                            </div>

                            {/* Weaknesses */}
                            <div className="p-4 border rounded-lg bg-destructive/5 border-destructive/20">
                                <h3 className="flex items-center gap-2 mb-3 text-sm font-bold text-destructive">
                                    <Target className="w-4 h-4" />
                                    نیاز به بازآموزی
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                     {analysis.weaknessTags.length > 0 ? analysis.weaknessTags.map((tag, i) => (
                                        <span key={i} className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-500/10 rounded border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300">{tag}</span>
                                    )) : <span className="text-xs text-muted-foreground">موردی یافت نشد</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Quantitative Scores */}
                    <div className="p-6 bg-secondary/10 rounded-xl border border-border flex flex-col h-full">
                        <h3 className="mb-6 text-lg font-bold text-card-foreground text-center">توزیع مهارت‌های شناختی</h3>
                        <div className="flex-grow space-y-6">
                            {analysis.conceptScores ? Object.entries(analysis.conceptScores).map(([key, score]) => (
                                <ConceptProgressBar key={key} label={key} score={score} />
                            )) : (
                                <div className="text-center text-muted-foreground py-10">داده‌های نموداری در دسترس نیست.</div>
                            )}
                        </div>
                        <div className="mt-8 p-3 bg-background/50 rounded-lg text-xs text-muted-foreground text-center border border-border/50">
                            * نمرات زیر ۵۰٪ نشان‌دهنده شکاف عمیق در یادگیری آن بُعد است.
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={onStart} 
                        className="group flex items-center justify-center w-full gap-3 px-4 py-4 text-lg font-bold text-white transition-all duration-200 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.01] active:scale-95">
                        <span>تایید برنامه و شروع یادگیری</span>
                        <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-[-4px]" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreAssessmentReview;
