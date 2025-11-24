
import React, { useState, useRef } from 'react';
import { generatePracticeResponse } from '../services/geminiService';
import BoxLoader from './ui/box-loader';
import { MessageSquare, SlidersHorizontal, CheckCircle, Calculator } from './icons';
import MathKeyboard from './MathKeyboard';

const PracticeZone: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [problem, setProblem] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Configuration State
    const [showConfig, setShowConfig] = useState(false);
    const [questionType, setQuestionType] = useState<'multiple-choice' | 'descriptive'>('descriptive');
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    
    // Math Keyboard State
    const [showMathKeyboard, setShowMathKeyboard] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleMathInsert = (text: string, cursorOffset = 0) => {
        if (!textareaRef.current) return;
        
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        
        // Wrap in $...$ if not already present (basic heuristic)
        // Ideally, we just insert the latex code and let the user manage context, 
        // or wrapper could be implicit. For now, raw insert.
        const textToInsert = `$${text}$`; 
        
        const newValue = value.substring(0, start) + textToInsert + value.substring(end);
        setProblem(newValue);
        
        // Restore focus and move cursor
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + textToInsert.length + cursorOffset;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic && !problem) {
            setError('لطفاً یک موضوع برای تولید سوال یا یک مسئله برای حل وارد کنید.');
            return;
        }
        setIsLoading(true);
        setError('');
        setResponse('');
        try {
            const result = await generatePracticeResponse(topic, problem, questionType, difficulty);
            setResponse(result);
        } catch (err) {
            setError('خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h2 className="pb-2 mb-4 text-xl font-bold border-b text-foreground border-border flex items-center justify-between">
                <span>بخش تمرین آزاد</span>
                <button 
                    onClick={() => setShowConfig(!showConfig)}
                    className={`p-2 rounded-lg transition-colors ${showConfig ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
                    title="تنظیمات پیشرفته"
                >
                    <SlidersHorizontal className="w-5 h-5" />
                </button>
            </h2>

            <div className="p-6 border rounded-lg shadow-sm bg-card">
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Configuration Panel */}
                    {showConfig && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-secondary/20 rounded-xl animate-slide-up border border-border/50 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-2">نوع سوال</label>
                                <div className="flex bg-background rounded-lg p-1 border border-border">
                                    <button
                                        type="button"
                                        onClick={() => setQuestionType('descriptive')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${questionType === 'descriptive' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        تشریحی/حل مسئله
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQuestionType('multiple-choice')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${questionType === 'multiple-choice' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        تستی (چهارگزینه‌ای)
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-2">سطح دشواری</label>
                                <div className="flex bg-background rounded-lg p-1 border border-border">
                                    <button
                                        type="button"
                                        onClick={() => setDifficulty('easy')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${difficulty === 'easy' ? 'bg-green-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        آسان
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDifficulty('medium')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${difficulty === 'medium' ? 'bg-yellow-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        متوسط
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDifficulty('hard')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${difficulty === 'hard' ? 'bg-red-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        سخت
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="topic" className="block mb-2 text-sm font-medium text-card-foreground/90">موضوع (برای تولید سوال)</label>
                        <input
                            type="text"
                            id="topic"
                            value={topic}
                            onChange={(e) => { setTopic(e.target.value); if(e.target.value) setProblem(''); }}
                            className="w-full p-2 border rounded-md border-border focus:ring-primary focus:border-primary bg-background"
                            placeholder="مثال: انتگرال دوگانه، تاریخ مشروطه..."
                        />
                    </div>
                    
                    <div className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2 before:h-px before:w-10 before:bg-border after:h-px after:w-10 after:bg-border">
                        <span>یا حل مسئله خاص</span>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="problem" className="text-sm font-medium text-card-foreground/90">صورت سوال / مسئله</label>
                            <button 
                                type="button"
                                onClick={() => setShowMathKeyboard(!showMathKeyboard)}
                                className={`text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-secondary transition-colors ${showMathKeyboard ? 'text-primary font-bold' : 'text-muted-foreground'}`}
                            >
                                <Calculator className="w-3 h-3" />
                                <span>کیبورد ریاضی</span>
                            </button>
                        </div>
                        
                        <textarea
                            id="problem"
                            ref={textareaRef}
                            value={problem}
                            onChange={(e) => { setProblem(e.target.value); if(e.target.value) setTopic(''); }}
                            className="w-full p-3 border rounded-md h-32 border-border focus:ring-primary focus:border-primary bg-background font-mono text-sm"
                            placeholder="مسئله خود را اینجا وارد کنید..."
                            style={{ direction: 'ltr', textAlign: 'right' }}
                        />
                        
                        {showMathKeyboard && (
                            <div className="mt-2 animate-fade-in">
                                <MathKeyboard onInsert={handleMathInsert} />
                            </div>
                        )}
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    
                    <button type="submit" disabled={isLoading} className="flex items-center justify-center w-full px-4 py-3 font-semibold text-white transition-colors rounded-xl bg-primary hover:bg-primary-hover disabled:bg-primary/70 min-h-[48px] shadow-lg shadow-primary/20">
                        {isLoading ? <BoxLoader size={24} /> : 'شروع تمرین هوشمند'}
                    </button>
                </form>
            </div>

            {response && (
                <div className="p-6 mt-6 border rounded-lg shadow-sm bg-card animate-slide-up">
                    <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-card-foreground">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        پاسخ مربی
                    </h3>
                    <div className="markdown-content max-w-none text-card-foreground" dangerouslySetInnerHTML={{ __html: response }} />
                </div>
            )}
        </div>
    );
};

export default PracticeZone;
