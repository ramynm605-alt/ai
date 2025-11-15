import React from 'react';
import { PreAssessmentAnalysis } from '../types';
import { BrainCircuit, CheckCircle, Target, ArrowRight } from './icons';

interface PreAssessmentReviewProps {
    analysis: PreAssessmentAnalysis;
    onStart: () => void;
}

const PreAssessmentReview: React.FC<PreAssessmentReviewProps> = ({ analysis, onStart }) => {
    return (
        <div className="flex items-center justify-center min-h-full p-4 bg-background sm:p-6 md:p-8">
            <div className="w-full max-w-3xl p-6 space-y-8 border rounded-xl shadow-lg md:p-8 bg-card">
                <div className="text-center">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 text-primary">
                        <BrainCircuit className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-bold text-card-foreground">تحلیل پیش‌آزمون شما</h2>
                    <p className="mt-2 text-muted-foreground">در اینجا خلاصه‌ای از دانش فعلی شما بر اساس پاسخ‌هایتان آمده است.</p>
                </div>

                <div className="p-4 border rounded-lg bg-secondary/50 border-border">
                    <h3 className="mb-2 text-lg font-semibold text-secondary-foreground">ارزیابی کلی</h3>
                    <p className="text-secondary-foreground/80">{analysis.overallAnalysis}</p>
                    <div className="mt-3">
                        <span className="px-3 py-1 text-sm font-medium rounded-full bg-primary/20 text-primary">
                           سطح پیشنهادی: {analysis.recommendedLevel}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Strengths */}
                    <div className="p-4 border rounded-lg bg-card border-success/30">
                        <h3 className="flex items-center gap-2 mb-3 text-lg font-semibold text-success">
                            <CheckCircle className="w-6 h-6" />
                            نقاط قوت
                        </h3>
                        <ul className="space-y-2 list-disc list-inside text-card-foreground/90">
                            {analysis.strengths.map((strength, index) => (
                                <li key={index}>{strength}</li>
                            ))}
                        </ul>
                    </div>

                    {/* Weaknesses */}
                    <div className="p-4 border rounded-lg bg-card border-destructive/30">
                        <h3 className="flex items-center gap-2 mb-3 text-lg font-semibold text-destructive">
                            <Target className="w-6 h-6" />
                            موضوعات نیازمند تمرکز
                        </h3>
                        <ul className="space-y-2 list-disc list-inside text-card-foreground/90">
                            {analysis.weaknesses.map((weakness, index) => (
                                <li key={index}>{weakness}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div>
                    <button 
                        onClick={onStart} 
                        className="flex items-center justify-center w-full gap-2 px-4 py-3 font-semibold transition-transform duration-200 rounded-md text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring active:scale-95">
                        <span>شروع مسیر یادگیری شخصی‌سازی شده</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreAssessmentReview;
