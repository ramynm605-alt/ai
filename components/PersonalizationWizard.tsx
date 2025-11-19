
import React, { useState } from 'react';
import { LearningPreferences } from '../types';
import { BrainCircuit, SlidersHorizontal, Target, Wand, ArrowRight, CheckCircle, MessageSquare } from './icons';

interface PersonalizationWizardProps {
    onSubmit: (preferences: LearningPreferences) => void;
    initialPreferences: LearningPreferences;
    onSkip: () => void;
}

const PersonalizationWizard: React.FC<PersonalizationWizardProps> = ({ onSubmit, initialPreferences, onSkip }) => {
    const [step, setStep] = useState(1);
    const [prefs, setPrefs] = useState<LearningPreferences>(initialPreferences);

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const handleFinish = () => {
        onSubmit(prefs);
    };

    const updatePref = (key: keyof LearningPreferences, value: any) => {
        setPrefs(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
            <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
                
                {/* Header */}
                <div className="bg-primary/10 p-6 text-center border-b border-primary/10">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
                        <Wand className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">شخصی‌سازی یادگیری</h2>
                    <p className="text-muted-foreground mt-2">کمک کنید تا هوش مصنوعی بهترین تجربه را برای شما بسازد.</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-secondary">
                    <div 
                        className="h-full bg-primary transition-all duration-300 ease-out" 
                        style={{ width: `${(step / 3) * 100}%` }} 
                    />
                </div>

                {/* Content */}
                <div className="flex-grow p-8 overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-6 fade-in">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-primary" />
                                سطح دانش فعلی شما
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { id: 'beginner', label: 'مبتدی', desc: 'تازه می‌خواهم شروع کنم' },
                                    { id: 'intermediate', label: 'متوسط', desc: 'چیزهایی می‌دانم' },
                                    { id: 'expert', label: 'پیشرفته', desc: 'تسلط دارم، جزئیات می‌خواهم' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => updatePref('knowledgeLevel', opt.id)}
                                        className={`p-4 rounded-xl border-2 text-right transition-all ${prefs.knowledgeLevel === opt.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <div className="font-bold mb-1">{opt.label}</div>
                                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>

                            <h3 className="text-xl font-bold flex items-center gap-2 mt-8">
                                <SlidersHorizontal className="w-5 h-5 text-primary" />
                                سبک یادگیری
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { id: 'theoretical', label: 'تئوری محور', desc: 'مفاهیم و تعاریف' },
                                    { id: 'practical', label: 'کاربردی', desc: 'مثال‌های واقعی' },
                                    { id: 'analogies', label: 'تمثیلی', desc: 'با داستان و تشبیه' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => updatePref('learningFocus', opt.id)}
                                        className={`p-4 rounded-xl border-2 text-right transition-all ${prefs.learningFocus === opt.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <div className="font-bold mb-1">{opt.label}</div>
                                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>

                            <h3 className="text-xl font-bold flex items-center gap-2 mt-8">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                لحن بیان مربی
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { id: 'academic', label: 'رسمی و آکادمیک', desc: 'دقیق، علمی و بدون حاشیه' },
                                    { id: 'conversational', label: 'دوستانه و صمیمی', desc: 'ساده، مثل یک دوست' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => updatePref('tone', opt.id)}
                                        className={`p-4 rounded-xl border-2 text-right transition-all ${prefs.tone === opt.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <div className="font-bold mb-1">{opt.label}</div>
                                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 fade-in">
                             <h3 className="text-xl font-bold flex items-center gap-2">
                                <Target className="w-5 h-5 text-primary" />
                                هدف شما چیست؟
                            </h3>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-muted-foreground">هدف اصلی از یادگیری این مطلب (اختیاری)</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {['آمادگی برای امتحان', 'پروژه کاری', 'یادگیری عمیق', 'مرور سریع', 'سرگرمی'].map(goal => (
                                        <button 
                                            key={goal}
                                            onClick={() => updatePref('learningGoal', goal)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${prefs.learningGoal === goal ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80'}`}
                                        >
                                            {goal}
                                        </button>
                                    ))}
                                </div>
                                <input 
                                    type="text" 
                                    className="w-full p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary"
                                    placeholder="یا هدف خود را بنویسید..."
                                    value={prefs.learningGoal}
                                    onChange={(e) => updatePref('learningGoal', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-muted-foreground">دستورالعمل خاص (اختیاری)</label>
                                <textarea 
                                    className="w-full p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary min-h-[100px] resize-none"
                                    placeholder="مثلاً: لطفاً از مثال‌های ورزشی استفاده کن، یا خیلی ساده توضیح بده..."
                                    value={prefs.customInstructions || ''}
                                    onChange={(e) => updatePref('customInstructions', e.target.value)}
                                />
                            </div>

                             <div className="flex items-center gap-4 p-4 border border-border rounded-xl mt-2 bg-card/50">
                                <input 
                                    type="checkbox" 
                                    id="explanatory" 
                                    className="w-5 h-5 text-primary rounded focus:ring-primary"
                                    checked={prefs.addExplanatoryNodes}
                                    onChange={(e) => updatePref('addExplanatoryNodes', e.target.checked)}
                                />
                                <label htmlFor="explanatory" className="text-sm cursor-pointer select-none">
                                    <span className="block font-bold">اضافه کردن گره‌های پیش‌نیاز</span>
                                    <span className="text-muted-foreground text-xs">اگر مفاهیم پایه‌ای نیاز باشد، به صورت خودکار اضافه شود.</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 fade-in text-center py-8">
                            <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-bold">همه چیز آماده است!</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                هوش مصنوعی اکنون با در نظر گرفتن سطح 
                                <span className="font-bold text-primary mx-1">
                                    {prefs.knowledgeLevel === 'beginner' ? 'مبتدی' : prefs.knowledgeLevel === 'intermediate' ? 'متوسط' : 'پیشرفته'}
                                </span>
                                و تمرکز بر 
                                <span className="font-bold text-primary mx-1">
                                    {prefs.learningFocus === 'theoretical' ? 'تئوری' : prefs.learningFocus === 'practical' ? 'کاربرد' : 'تشبیه'}
                                </span>
                                محتوای شما را تحلیل خواهد کرد.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-border flex justify-between items-center bg-secondary/30">
                    {step === 1 ? (
                        <button onClick={onSkip} className="text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg">
                            رد کردن (تنظیمات پیش‌فرض)
                        </button>
                    ) : (
                        <button onClick={prevStep} className="text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg">
                            مرحله قبل
                        </button>
                    )}

                    {step < 3 ? (
                        <button onClick={nextStep} className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all active:scale-95">
                            <span>بعدی</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button onClick={handleFinish} className="flex items-center gap-2 px-8 py-3 bg-success text-white font-bold rounded-xl hover:bg-success/90 transition-all active:scale-95 shadow-lg shadow-success/20">
                            <span>شروع جادوگری</span>
                            <Wand className="w-5 h-5" />
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default PersonalizationWizard;
