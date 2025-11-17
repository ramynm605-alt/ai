

import React from 'react';
import { QuizResult, QuizQuestion } from '../types';
import { CheckCircle, XCircle } from './icons';

interface QuizReviewProps {
    results: QuizResult[];
    onFinish: () => void;
}

const getAnswerText = (question: QuizQuestion, answer: any): string => {
    if (question.type === 'multiple-choice') {
        return question.options[answer as number] || "پاسخ داده نشده";
    }
    if (question.type === 'short-answer') {
        return (answer as string) || "پاسخ داده نشده";
    }
    return "نامشخص";
};


const QuestionReviewCard: React.FC<{ result: QuizResult }> = ({ result }) => {
    const { question, userAnswer, isCorrect, analysis, score } = result;

    const renderAnswers = () => {
        if (question.type === 'multiple-choice') {
            return (
                <>
                    <div className="flex items-start p-2 mt-2 rounded-md bg-destructive/10 text-destructive">
                        <XCircle className="w-5 h-5 ml-2 shrink-0" />
                        <span>پاسخ شما: {getAnswerText(question, userAnswer)}</span>
                    </div>
                    <div className="flex items-start p-2 mt-2 rounded-md bg-success/10 text-success">
                        <CheckCircle className="w-5 h-5 ml-2 shrink-0" />
                        <span>پاسخ صحیح: {question.options[question.correctAnswerIndex]}</span>
                    </div>
                </>
            );
        }
        if (question.type === 'short-answer') {
             return (
                <>
                    <div className="flex items-start p-2 mt-2 rounded-md bg-destructive/10 text-destructive">
                        <XCircle className="w-5 h-5 ml-2 shrink-0" />
                        <p className="break-words">پاسخ شما: {getAnswerText(question, userAnswer)}</p>
                    </div>
                    <div className="flex items-start p-2 mt-2 rounded-md bg-success/10 text-success">
                        <CheckCircle className="w-5 h-5 ml-2 shrink-0" />
                        <p className="break-words">پاسخ صحیح: {question.correctAnswer}</p>
                    </div>
                </>
            );
        }
        return null;
    }

    return (
        <div className={`p-4 border-l-4 rounded-lg shadow-sm ${isCorrect ? 'bg-success/10 border-success' : 'bg-destructive/10 border-destructive'}`}>
            <div className="flex items-center justify-between">
                <p className="font-semibold text-card-foreground">{question.question}</p>
                <span className={`font-bold ${isCorrect ? 'text-success' : 'text-destructive'}`}>
                    {score} / {question.points}
                </span>
            </div>
            {!isCorrect && renderAnswers()}
            <div className="p-3 mt-4 rounded-md bg-secondary">
                <h4 className="font-semibold text-secondary-foreground">تحلیل هوش مصنوعی:</h4>
                <p className="mt-1 text-sm text-secondary-foreground/80">{analysis}</p>
            </div>
        </div>
    );
};


const QuizReview: React.FC<QuizReviewProps> = ({ results, onFinish }) => {
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const maxScore = results.reduce((sum, r) => sum + r.question.points, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = percentage >= 70;

    return (
        <div className="max-w-4xl p-4 mx-auto sm:p-6 md:p-8">
            <div className="p-6 mb-8 text-center border rounded-lg shadow-lg bg-card">
                <h1 className="mb-2 text-3xl font-bold text-foreground">نتایج آزمون</h1>
                <p className="text-muted-foreground">امتیاز شما: <span className={`font-bold ${passed ? 'text-success' : 'text-destructive'}`}>{totalScore}</span> از <span className="font-bold">{maxScore}</span></p>
                 <div className="w-full h-4 mx-auto mt-4 rounded-full bg-secondary max-w-sm">
                    <div 
                        className={`h-full text-center text-white rounded-full transition-all duration-500 ease-out ${passed ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`} 
                        style={{ width: `${percentage}%` }}
                    >
                    </div>
                </div>
                <p className={`mt-2 text-lg font-semibold ${passed ? 'text-success' : 'text-destructive'}`}>{percentage}%</p>
                {passed ? (
                    <p className="mt-2 text-green-600">عالی! شما این بخش را با موفقیت پشت سر گذاشتید.</p>
                ) : (
                    <p className="mt-2 text-red-600">نیاز به مرور بیشتر دارید. نقاط ضعف شما ثبت شد.</p>
                )}
            </div>

            <div className="space-y-6">
                {results.map(result => (
                    <QuestionReviewCard key={result.question.id} result={result} />
                ))}
            </div>

            <div className="mt-8 text-center">
                <button onClick={onFinish} className="px-8 py-3 font-bold text-white transition-transform duration-200 rounded-lg bg-primary hover:bg-primary-hover active:scale-95">
                    ادامه مسیر یادگیری
                </button>
            </div>
        </div>
    );
};

export default QuizReview;