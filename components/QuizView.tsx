
import React, { useState, useEffect } from 'react';
import { Quiz, QuizQuestion, MultipleChoiceQuestion, ShortAnswerQuestion, MatchingQuestion, MatchingItem, UserAnswer } from '../types';
import { Shuffle } from './icons';

interface QuizViewProps {
    title: string;
    quiz: Quiz;
    onSubmit: (answers: Record<string, UserAnswer>) => void;
}

const getDifficultyChip = (difficulty: 'آسان' | 'متوسط' | 'سخت') => {
    const styles = {
        'آسان': 'bg-green-100 text-green-800',
        'متوسط': 'bg-yellow-100 text-yellow-800',
        'سخت': 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[difficulty]}`}>{difficulty}</span>;
}


const MultipleChoiceRenderer: React.FC<{ question: MultipleChoiceQuestion; answer: number | null; onAnswer: (answer: number) => void; }> = ({ question, answer, onAnswer }) => (
    <div className="space-y-3">
        {question.options.map((option, index) => (
            <button
                key={index}
                onClick={() => onAnswer(index)}
                className={`block w-full p-4 text-right border-2 rounded-lg transition-all duration-200 ${
                    answer === index ? 'bg-primary/20 border-primary text-primary font-semibold' : 'bg-background border-border hover:border-primary'
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
            className="w-full p-3 transition-colors duration-200 border rounded-md shadow-sm h-36 bg-background text-foreground border-border focus:ring-ring focus:border-primary"
            placeholder="پاسخ خود را اینجا بنویسید..."
        />
    </div>
);

const MatchingRenderer: React.FC<{ question: MatchingQuestion; answer: Record<string, string>; onAnswer: (answer: Record<string, string>) => void; }> = ({ question, answer, onAnswer }) => {
    const [selectedStem, setSelectedStem] = useState<MatchingItem | null>(null);
    const [shuffledOptions, setShuffledOptions] = useState<MatchingItem[]>([]);

    useEffect(() => {
        setShuffledOptions([...question.options].sort(() => Math.random() - 0.5));
    }, [question.options]);

    const handleStemClick = (stem: MatchingItem) => {
        if (answer[stem.id]) return; // Already matched
        setSelectedStem(stem);
    };

    const handleOptionClick = (option: MatchingItem) => {
        if (!selectedStem) return;
        if (Object.values(answer).includes(option.id)) return; // Option already used
        
        onAnswer({ ...answer, [selectedStem.id]: option.id });
        setSelectedStem(null);
    };

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Stems Column */}
            <div className="space-y-3">
                <h4 className="font-semibold text-center text-muted-foreground">موارد</h4>
                {question.stems.map(stem => {
                    const isMatched = !!answer[stem.id];
                    const isSelected = selectedStem?.id === stem.id;
                    return (
                        <button
                            key={stem.id}
                            onClick={() => handleStemClick(stem)}
                            disabled={isMatched}
                            className={`w-full p-3 text-right border-2 rounded-lg transition-all ${
                                isMatched ? 'bg-green-100 border-green-300 cursor-default' : 
                                isSelected ? 'border-primary ring-2 ring-primary' : 'bg-background border-border hover:border-primary/70'
                            }`}
                        >
                            {stem.text}
                        </button>
                    );
                })}
            </div>
            {/* Options Column */}
            <div className="space-y-3">
                 <h4 className="font-semibold text-center text-muted-foreground">توضیحات</h4>
                {shuffledOptions.map(option => {
                    const isMatched = Object.values(answer).includes(option.id);
                    return (
                        <button
                            key={option.id}
                            onClick={() => handleOptionClick(option)}
                            disabled={isMatched || !selectedStem}
                            className={`w-full p-3 text-right border-2 rounded-lg transition-all ${
                                isMatched ? 'bg-green-100 border-green-300 cursor-default' :
                                selectedStem ? 'bg-background border-border hover:border-primary/70 cursor-pointer' : 'bg-muted/30 border-border cursor-not-allowed'
                            }`}
                        >
                            {option.text}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const QuizView: React.FC<QuizViewProps> = ({ title, quiz, onSubmit }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});

    const handleAnswer = (questionId: string, answer: UserAnswer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleNext = () => {
        if (currentQuestionIndex < quiz.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };
    
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const currentAnswer = answers[currentQuestion.id];
    const isAnswered = currentAnswer !== undefined && (typeof currentAnswer !== 'string' || currentAnswer.trim() !== '');

    const renderQuestion = (question: QuizQuestion) => {
        switch (question.type) {
            case 'multiple-choice':
                return <MultipleChoiceRenderer question={question} answer={currentAnswer as number | null} onAnswer={(ans) => handleAnswer(question.id, ans)} />;
            case 'short-answer':
                return <ShortAnswerRenderer question={question} answer={(currentAnswer as string) || ''} onAnswer={(ans) => handleAnswer(question.id, ans)} />;
            case 'matching':
                return <MatchingRenderer question={question} answer={(currentAnswer as Record<string, string>) || {}} onAnswer={(ans) => handleAnswer(question.id, ans)} />;
            default:
                return <p>نوع سوال پشتیبانی نمی‌شود.</p>;
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-full p-4 sm:p-6 bg-background">
            <div className="w-full max-w-3xl p-6 border rounded-lg shadow-xl sm:p-8 bg-card">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold text-card-foreground">{title}</h2>
                    <p className="text-sm text-muted-foreground">سوال {currentQuestionIndex + 1} از {quiz.questions.length}</p>
                </div>

                <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-2">
                        {getDifficultyChip(currentQuestion.difficulty)}
                        <span className="text-sm font-semibold text-primary">{currentQuestion.points} امتیاز</span>
                     </div>
                </div>
                
                <div className="mb-8">
                    <p className="text-lg font-semibold leading-relaxed text-card-foreground/90">{currentQuestion.question}</p>
                </div>
                
                {renderQuestion(currentQuestion)}

                <div className="flex justify-between mt-8">
                    <button onClick={handlePrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 font-semibold rounded-md text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50">قبلی</button>
                    {currentQuestionIndex === quiz.questions.length - 1 ? (
                        <button onClick={() => onSubmit(answers)} disabled={!isAnswered} className="px-6 py-2 font-semibold text-white rounded-md bg-success hover:bg-success/90 disabled:opacity-50">ثبت آزمون</button>
                    ) : (
                        <button onClick={handleNext} disabled={!isAnswered} className="px-6 py-2 font-semibold text-white rounded-md bg-primary hover:bg-primary-hover disabled:opacity-50">بعدی</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizView;