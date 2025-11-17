

import React, { useState, useEffect } from 'react';
import { Quiz, QuizQuestion, MultipleChoiceQuestion, ShortAnswerQuestion, UserAnswer } from '../types';

interface QuizViewProps {
    title: string;
    quiz: Quiz;
    onSubmit: (answers: Record<string, UserAnswer>) => void;
}

const getDifficultyChip = (difficulty: 'آسان' | 'متوسط' | 'سخت') => {
    const styles = {
        'آسان': 'bg-success/20 text-success',
        'متوسط': 'bg-yellow-400/20 text-yellow-600',
        'سخت': 'bg-destructive/20 text-destructive',
    };
    // A little hacky, but need to adjust for dark mode text colors
    const darkStyles = {
        'آسان': 'dark:text-green-300',
        'متوسط': 'dark:text-yellow-300',
        'سخت': 'dark:text-red-300'
    }

    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[difficulty]} ${darkStyles[difficulty]}`}>{difficulty}</span>;
}


const MultipleChoiceRenderer: React.FC<{ question: MultipleChoiceQuestion; answer: number | null; onAnswer: (answer: number) => void; }> = ({ question, answer, onAnswer }) => (
    <div className="space-y-3">
        {question.options.map((option, index) => (
            <button
                key={index}
                onClick={() => onAnswer(index)}
                className={`block w-full p-4 text-right border-2 rounded-lg transition-all duration-200 text-foreground ${
                    answer === index ? 'bg-primary/20 border-primary font-semibold scale-[1.01]' : 'bg-background border-border hover:border-primary/70 hover:bg-accent hover:-translate-y-1'
                }`}
            >
                {option}
            </button>
        ))}
    </div>
);

const ShortAnswerRenderer: React.FC<{ question: ShortAnswerQuestion; answer: string; onAnswer: (answer: string) => void; }> = ({ question, answer, onAnswer }) => (
    <div>
        <textarea
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            className="w-full p-3 transition-colors duration-200 border rounded-md shadow-sm h-36 bg-background text-foreground border-border focus:ring-2 focus:ring-ring focus:border-primary"
            placeholder="پاسخ خود را اینجا بنویسید..."
        />
    </div>
);

const QuizView: React.FC<QuizViewProps> = ({ title, quiz, onSubmit }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
    
    useEffect(() => {
        // If a new question is streamed in and we are on the "waiting" screen, move to it
        if (quiz.questions.length > 0 && currentQuestionIndex >= quiz.questions.length) {
            setCurrentQuestionIndex(quiz.questions.length - 1);
        }
    }, [quiz.questions.length, currentQuestionIndex]);

    const handleAnswer = (questionId: string, answer: UserAnswer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleNext = () => {
        if (currentQuestionIndex < quiz.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else if (quiz.isStreaming) {
            // Move to a "waiting for next question" state
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };
    
    if (quiz.questions.length === 0 && quiz.isStreaming) {
        return (
             <div className="flex items-center justify-center min-h-full p-4 sm:p-6 bg-background">
                <div className="w-full max-w-3xl p-6 text-center border rounded-lg shadow-xl sm:p-8 bg-card">
                     <h2 className="text-2xl font-bold text-card-foreground">{title}</h2>
                     <p className="mt-4 text-muted-foreground">در حال آماده‌سازی سوالات آزمون...</p>
                </div>
            </div>
        )
    }

    const isWaitingForQuestion = currentQuestionIndex >= quiz.questions.length;

    const currentQuestion = !isWaitingForQuestion ? quiz.questions[currentQuestionIndex] : null;
    const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
    const isAnswered = currentAnswer !== undefined && (typeof currentAnswer !== 'string' || currentAnswer.trim() !== '');

    const renderQuestion = (question: QuizQuestion) => {
        switch (question.type) {
            case 'multiple-choice':
                return <MultipleChoiceRenderer question={question} answer={currentAnswer as number | null} onAnswer={(ans) => handleAnswer(question.id, ans)} />;
            case 'short-answer':
                return <ShortAnswerRenderer question={question} answer={(currentAnswer as string) || ''} onAnswer={(ans) => handleAnswer(question.id, ans)} />;
            default:
                return <p>نوع سوال پشتیبانی نمی‌شود.</p>;
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-full p-4 sm:p-6 bg-background">
            <div className="w-full max-w-3xl p-6 border rounded-lg shadow-xl sm:p-8 bg-card">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold text-card-foreground">{title}</h2>
                    <p className="text-sm text-muted-foreground">
                        {quiz.isStreaming && quiz.questions.length === 0 ? '...' : `سوال ${currentQuestionIndex + 1} از ${quiz.questions.length}${quiz.isStreaming ? '+' : ''}`}
                    </p>
                </div>

                {isWaitingForQuestion ? (
                    <div className="py-20 text-center text-muted-foreground">در حال ایجاد سوال بعدی...</div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-8">
                             <div className="flex items-center gap-2">
                                {getDifficultyChip(currentQuestion!.difficulty)}
                                <span className="text-sm font-semibold text-primary">{currentQuestion!.points} امتیاز</span>
                             </div>
                        </div>
                        
                        <div className="mb-8">
                            <p className="text-lg font-semibold leading-relaxed text-card-foreground/90">{currentQuestion!.question}</p>
                        </div>
                        
                        {renderQuestion(currentQuestion!)}
                    </>
                )}


                <div className="flex justify-between mt-8">
                    <button onClick={handlePrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 font-semibold rounded-md text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 active:scale-95">قبلی</button>
                    {currentQuestionIndex === quiz.questions.length - 1 && !quiz.isStreaming ? (
                        <button onClick={() => onSubmit(answers)} disabled={!isAnswered} className="px-6 py-2 font-semibold text-white rounded-md bg-success hover:bg-success/90 disabled:opacity-50 active:scale-95">ثبت آزمون</button>
                    ) : (
                        <button onClick={handleNext} disabled={!isAnswered || isWaitingForQuestion} className="px-6 py-2 font-semibold text-white rounded-md bg-primary hover:bg-primary-hover disabled:opacity-50 active:scale-95">بعدی</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizView;