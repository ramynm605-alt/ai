
import React, { useState } from 'react';
import { LearningPreferences } from '../types';
import { BrainCircuit, SlidersHorizontal, Target, Wand, ArrowRight, CheckCircle, MessageSquare, Layers } from './icons';

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

    const toneOptions: { id: LearningPreferences['tone']; label: string; desc: string; example: string }[] = [
        { 
            id: 'academic', 
            label: 'رسمی و آکادمیک', 
            desc: 'دقیق، علمی و بدون حاشیه',
            example: '«طبق قانون دوم نیوتن، نیرو برابر است با حاصل‌ضرب جرم در شتاب.»'
        },
        { 
            id: 'conversational', 
            label: 'دوستانه و صمیمی', 
            desc: 'ساده، مثل یک دوست',
            example: '«ببین، زور وارد شده به جسم میشه وزنش ضربدر شتابی که میگیره.»'
        },
        { 
            id: 'concise', 
            label: 'خلاصه‌گو', 
            desc: 'کوتاه، تیتروار و سریع',
            example: '«F=ma. نیرو = جرم × شتاب. تمام.»'
        },
        { 
            id: 'explanatory', 
            label: 'شدیداً توضیح‌دهنده', 
            desc: 'ریشه‌یابی و باز کردن کامل مطلب',
            example: '«برای درک نیرو، باید بدانیم که جرم، مقاومت جسم در برابر تغییر حرکت است...»'
        },
        { 
            id: 'strict', 
            label: 'سخت‌گیر', 
            desc: 'متمرکز بر تعاریف دقیق و اصول',
            example: '«دقت کنید! نیرو بردار است. هرگز جهت بردار شتاب را فراموش نکنید.»'
        }
    ];

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
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 fade-in">
                            {/* Detail Level Selector */}
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Layers className="w-5 h-5 text-primary" />
                                ساختار نقشه ذهنی
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => updatePref('detailLevel', 'simple')}
                                    className={`p-4 rounded-xl border-2 text-right transition-all flex flex-col gap-2 ${prefs.detailLevel === 'simple' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                >
                                    <div className="font-bold text-lg">ساده و کلی</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        فقط سرفصل‌های اصلی و مهم. مناسب برای مرور سریع یا دریافت دید کلی.
                                    </p>
                                    <div className="w-full h-1 bg-secondary mt-2 rounded-full overflow-hidden">
                                        <div className="w-1/3 h-full bg-primary/50"></div>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => updatePref('detailLevel', 'advanced')}
                                    className={`p-4 rounded-xl border-2 text-right transition-all flex flex-col gap-2 ${prefs.detailLevel === 'advanced' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                >
                                    <div className="font-bold text-lg">پیشرفته و دقیق</div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        جزئیات بالا، زیرشاخه‌های متعدد و عمیق. مناسب برای تسلط کامل.
                                    </p>
                                    <div className="w-full h-1 bg-secondary mt-2 rounded-full overflow-hidden">
                                        <div className="w-full h-full bg-primary"></div>
                                    </div>
                                </button>
                            </div>

                            <h3 className="text-xl font-bold flex items-center gap-2 mt-8">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                لحن بیان مربی
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {toneOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => updatePref('tone', opt.id)}
                                        className={`p-4 rounded-xl border-2 text-right transition-all group ${prefs.tone === opt.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <div className="font-bold mb-1 text-base">{opt.label}</div>
                                                <div className="text-xs text-muted-foreground">{opt.desc}</div>
                                            </div>
                                            <div className={`text-xs px-3 py-2 rounded-lg italic bg-secondary/50 text-secondary-foreground border border-border/50 max-w-full sm:max-w-[50%] ${prefs.tone === opt.id ? 'bg-background' : ''}`}>
                                                <span className="opacity-70 text-[10px] block mb-1">نمونه:</span>
                                                {opt.example}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
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
