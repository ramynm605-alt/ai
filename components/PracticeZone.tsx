import React, { useState } from 'react';
import { generatePracticeResponse } from '../services/geminiService';
import Spinner from './Spinner';
import { MessageSquare } from './icons';

const PracticeZone: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [problem, setProblem] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

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
            const result = await generatePracticeResponse(topic, problem);
            setResponse(result);
        } catch (err) {
            setError('خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h2 className="pb-2 mb-4 text-xl font-bold border-b text-foreground border-border">بخش تمرین آزاد</h2>
            <div className="p-6 border rounded-lg shadow-sm bg-card">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="topic" className="block mb-2 text-sm font-medium text-card-foreground/90">تولید سوال بر اساس موضوع</label>
                        <input
                            type="text"
                            id="topic"
                            value={topic}
                            onChange={(e) => { setTopic(e.target.value); setProblem(''); }}
                            className="w-full p-2 border rounded-md border-border focus:ring-primary focus:border-primary bg-background"
                            placeholder="مثال: جنگ جهانی دوم"
                        />
                    </div>
                    <div className="text-sm text-center text-muted-foreground">یا</div>
                    <div>
                        <label htmlFor="problem" className="block mb-2 text-sm font-medium text-card-foreground/90">حل مسئله (متنی یا ریاضی)</label>
                        <textarea
                            id="problem"
                            value={problem}
                            onChange={(e) => { setProblem(e.target.value); setTopic(''); }}
                            className="w-full p-2 border rounded-md h-28 border-border focus:ring-primary focus:border-primary bg-background"
                            placeholder="مسئله خود را اینجا وارد کنید..."
                        />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <button type="submit" disabled={isLoading} className="flex items-center justify-center w-full px-4 py-2 font-semibold text-white transition-colors rounded-md bg-primary hover:bg-primary-hover disabled:bg-primary/70">
                        {isLoading ? <Spinner size={24} /> : 'ارسال'}
                    </button>
                </form>
            </div>

            {response && (
                <div className="p-6 mt-6 border rounded-lg shadow-sm bg-card">
                    <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-card-foreground">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        پاسخ هوشمند
                    </h3>
                    <div className="prose max-w-none text-card-foreground" dangerouslySetInnerHTML={{ __html: response }} />
                </div>
            )}
        </div>
    );
};

export default PracticeZone;