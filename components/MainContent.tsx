
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAppActions } from '../hooks/useAppActions';
import { AppStatus, LearningResource } from '../types';
import { FileText, Wand, FileQuestion, Shuffle, BrainCircuit, Upload, ArrowRight, ArrowLeft, Sparkles, Target, MessageSquare, XCircle, FileAudio, Youtube, Link, Globe, Music, Trash, CheckCircle, Info, Edit, Save, SlidersHorizontal } from './icons';
import BoxLoader from './ui/box-loader';
import MindMap from './MindMap';
import NodeView from './NodeView';
import QuizView from './QuizView';
import QuizReview from './QuizReview';
import PreAssessmentReview from './PreAssessmentReview';
import PersonalizationWizard from './PersonalizationWizard';

const RANDOM_TOPICS = [
    "مبانی اقتصاد رفتاری",
    "تاریخچه اینترنت و وب",
    "نظریه بازی‌ها (Game Theory)",
    "هوش مصنوعی و اخلاق",
    "فلسفه رواقی‌گری (Stoicism)",
    "مکانیک کوانتوم به زبان ساده",
    "تاریخ جنگ جهانی دوم",
    "تکنیک‌های مدیریت زمان",
    "روانشناسی شناختی و خطاهای ذهنی",
    "مبانی بلاکچین و کریپتوکارنسی",
    "هنر متقاعدسازی",
    "نجوم و سیاه‌چاله‌ها"
];

interface MainContentProps {
    actions: ReturnType<typeof useAppActions>;
}

type InputTab = 'explore' | 'upload' | 'text' | 'link';
type ViewMode = 'landing' | 'action';

const MainContent: React.FC<MainContentProps> = ({ actions }) => {
    const { state, dispatch } = useApp();
    const [textInput, setTextInput] = useState('');
    const [topicInput, setTopicInput] = useState('');
    const [linkInput, setLinkInput] = useState('');
    const [activeTab, setActiveTab] = useState<InputTab>('upload');
    const [viewMode, setViewMode] = useState<ViewMode>('landing');
    const [globalInstructions, setGlobalInstructions] = useState('');
    
    // Research Customization State
    const [researchDepth, setResearchDepth] = useState<'general' | 'deep'>('deep');
    const [researchLength, setResearchLength] = useState<'brief' | 'standard' | 'comprehensive'>('standard');
    
    // Resource Review Modal State
    const [reviewResource, setReviewResource] = useState<LearningResource | null>(null);
    const [editedContent, setEditedContent] = useState('');
    
    // Toggle instruction input per resource
    const [expandedInstructionId, setExpandedInstructionId] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasStartedGeneration = useRef(false);

    const handleRandomStudy = () => {
        const randomTopic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
        setTopicInput(randomTopic);
    };

    const handleEnterAction = (tab: InputTab) => {
        setActiveTab(tab);
        setViewMode('action');
    };

    const handleBackToLanding = () => {
        setViewMode('landing');
    };

    const handleOpenReview = (resource: LearningResource) => {
        if (resource.isProcessing) return;
        setReviewResource(resource);
        setEditedContent(resource.content);
    };

    const handleSaveReview = () => {
        if (reviewResource) {
            actions.handleUpdateResourceContent(reviewResource.id, editedContent);
            setReviewResource(null);
        }
    };

    // Trigger plan generation when status is LOADING
    useEffect(() => {
        if (state.status === AppStatus.LOADING && state.mindMap.length === 0 && !hasStartedGeneration.current) {
            // Check sourceContent which is set by INIT_WIZARD when finalizing resources
            if (state.sourceContent || (state.sourceImages && state.sourceImages.length > 0)) {
                hasStartedGeneration.current = true;
                actions.generatePlanInternal().catch(err => {
                    console.error("Plan generation failed:", err);
                    hasStartedGeneration.current = false;
                });
            }
        }
        
        if (state.status !== AppStatus.LOADING) {
            hasStartedGeneration.current = false;
        }
    }, [state.status, state.mindMap.length, state.sourceContent, state.sourceImages, actions]);

    const renderResourceList = () => {
        if (state.resources.length === 0) return null;

        return (
            <div className="mt-8 bg-card border border-border rounded-2xl p-4 md:p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <span>منابع انتخاب شده</span>
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{state.resources.length}/5</span>
                    </h3>
                </div>
                <div className="space-y-3">
                    {state.resources.map((res, idx) => (
                        <div key={res.id} className={`border rounded-xl transition-all ${res.isProcessing ? 'bg-secondary/10 border-border opacity-70' : 'bg-secondary/30 border-border hover:border-primary/30'}`}>
                            <div 
                                onClick={() => handleOpenReview(res)}
                                className="flex items-center justify-between p-3 cursor-pointer"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground shrink-0 border border-border relative">
                                        {res.isProcessing ? (
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                {res.type === 'file' ? <FileText className="w-5 h-5" /> : 
                                                 res.type === 'link' ? <Link className="w-5 h-5" /> :
                                                 <FileQuestion className="w-5 h-5" />}
                                                 
                                                 {/* Validation Badge */}
                                                 {res.validation && (
                                                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${res.validation.isValid ? 'bg-success' : 'bg-orange-500'}`} />
                                                 )}
                                            </>
                                        )}
                                    </div>
                                    <div className="overflow-hidden text-right">
                                        <span className="text-sm font-medium truncate block">{res.title}</span>
                                        {!res.isProcessing && res.validation && (
                                            <span className={`text-[10px] ${res.validation.isValid ? 'text-success' : 'text-orange-500'}`}>
                                                {res.validation.isValid ? 'تایید شده' : 'نیاز به بررسی'} • {res.validation.qualityScore}% کیفیت
                                            </span>
                                        )}
                                         {res.isProcessing && <span className="text-[10px] text-muted-foreground animate-pulse">در حال تحلیل هوشمند...</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedInstructionId(expandedInstructionId === res.id ? null : res.id);
                                        }}
                                        className={`p-2 rounded-lg transition-colors ${expandedInstructionId === res.id || res.instructions ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-secondary'}`}
                                        title="افزودن دستورالعمل خاص"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            actions.handleRemoveResource(res.id);
                                        }}
                                        className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Inline Instruction Input */}
                            {(expandedInstructionId === res.id || (res.instructions && res.instructions.length > 0)) && (
                                <div className="px-3 pb-3 animate-slide-up">
                                    <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-2 focus-within:ring-1 focus-within:ring-primary">
                                        <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <input 
                                            type="text" 
                                            placeholder="دستورالعمل خاص برای این منبع (مثلاً: فقط فصل ۲ را بخوان)"
                                            className="flex-grow bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                                            value={res.instructions || ''}
                                            onChange={(e) => actions.handleUpdateResourceInstructions(res.id, e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Global Instructions */}
                <div className="mt-6">
                    <label className="block text-xs font-bold text-muted-foreground mb-2">دستورالعمل کلی برای ترکیب منابع (اختیاری)</label>
                    <textarea 
                        className="w-full p-3 rounded-xl bg-secondary/30 border border-border text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent h-24 placeholder:text-muted-foreground/50"
                        placeholder="مثلاً: لطفاً تعاریف را از منبع اول بردار و مثال‌ها را از منبع دوم..."
                        value={globalInstructions}
                        onChange={(e) => setGlobalInstructions(e.target.value)}
                    />
                </div>

                <div className="mt-6">
                     <button 
                        onClick={() => actions.handleFinalizeResources(globalInstructions)}
                        disabled={state.resources.some(r => r.isProcessing)}
                        className="w-full py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                    >
                        <span>شروع پردازش و ساخت نقشه</span>
                        <Sparkles className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    };

    const renderReviewModal = () => {
        if (!reviewResource) return null;

        const validation = reviewResource.validation;

        return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setReviewResource(null)}>
                <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
                         <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border border-border shrink-0">
                                {reviewResource.type === 'file' ? <FileText className="w-6 h-6 text-primary" /> : 
                                 reviewResource.type === 'link' ? <Link className="w-6 h-6 text-primary" /> :
                                 <FileQuestion className="w-6 h-6 text-primary" />}
                             </div>
                             <div>
                                 <h3 className="font-bold text-base truncate max-w-[200px] md:max-w-xs">{reviewResource.title}</h3>
                                 <p className="text-xs text-muted-foreground">پیش‌نمایش محتوای استخراج شده</p>
                             </div>
                         </div>
                         <button onClick={() => setReviewResource(null)} className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full transition-colors">
                             <XCircle className="w-6 h-6" />
                         </button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-6 space-y-6">
                        
                        {/* Analysis Card */}
                        {validation && (
                            <div className={`p-4 rounded-xl border ${validation.isValid ? 'bg-success/5 border-success/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    {validation.isValid ? <CheckCircle className="w-5 h-5 text-success" /> : <Info className="w-5 h-5 text-orange-500" />}
                                    <span className={`font-bold ${validation.isValid ? 'text-success' : 'text-orange-500'}`}>
                                        {validation.isValid ? 'کیفیت مناسب' : 'نکات قابل توجه'}
                                    </span>
                                    <span className="text-xs bg-background px-2 py-0.5 rounded-full border border-border text-muted-foreground mr-auto">
                                        امتیاز کیفیت: {validation.qualityScore}/100
                                    </span>
                                </div>
                                <p className="text-sm text-foreground mb-3 font-medium">{validation.summary}</p>
                                {validation.issues.length > 0 && (
                                    <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                                        {validation.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Extracted Text Editor */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-bold text-muted-foreground">متن استخراج شده توسط هوش مصنوعی</label>
                                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">قابل ویرایش</span>
                            </div>
                            <textarea 
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="w-full h-64 p-4 rounded-xl bg-secondary/20 border border-border focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-sm leading-relaxed"
                                placeholder="متن استخراج شده اینجا نمایش داده می‌شود..."
                            />
                            <p className="text-[10px] text-muted-foreground mt-2">
                                * این متن مبنای تولید نقشه ذهنی خواهد بود. اگر متن ناقص است یا ایراد دارد، می‌توانید آن را اصلاح کنید.
                            </p>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-secondary/10 flex justify-end gap-3">
                         <button 
                            onClick={() => setReviewResource(null)}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                        >
                            انصراف
                        </button>
                        <button 
                            onClick={handleSaveReview}
                            className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-hover flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
                        >
                            <Save className="w-4 h-4" />
                            <span>ذخیره تغییرات</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const renderInputSection = () => {
        // If max resources reached, block input UI
        if (state.resources.length >= 5) {
             return (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                    <h3 className="font-bold text-yellow-600 mb-1">ظرفیت تکمیل شد</h3>
                    <p className="text-sm text-yellow-600/80 mb-4">شما ۵ منبع را انتخاب کرده‌اید. برای اضافه کردن مورد جدید، یکی از موارد لیست پایین را حذف کنید.</p>
                </div>
             )
        }

        switch (activeTab) {
            case 'explore':
                return (
                    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col relative animate-fade-in">
                        <div className="flex items-center justify-between gap-2 mb-6">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600">
                                    <BrainCircuit className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-foreground">کاوش موضوعی</h3>
                                    <p className="text-xs text-muted-foreground">تحقیق هوشمند و تولید محتوا توسط AI</p>
                                </div>
                             </div>
                             <button 
                                onClick={handleRandomStudy}
                                className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-full hover:bg-secondary/80 transition-colors"
                            >
                                <Shuffle className="w-3 h-3" />
                                <span>شانسی</span>
                            </button>
                        </div>
                        
                        <div className="relative mb-6">
                            <input 
                                type="text"
                                className="w-full px-4 py-4 pr-12 text-lg bg-background border-2 border-border rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-muted-foreground/50"
                                placeholder="مثلاً: استراتژی بازاریابی دیجیتال..."
                                value={topicInput}
                                onChange={(e) => setTopicInput(e.target.value)}
                                onKeyPress={(e) => {
                                    if(e.key === 'Enter' && topicInput.trim()) {
                                        actions.handleTopicStudy(topicInput, { depth: researchDepth, length: researchLength });
                                        setTopicInput('');
                                    }
                                }}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <FileQuestion className="w-6 h-6" />
                            </div>
                        </div>

                        {/* Research Settings */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground">عمق تحقیق</label>
                                <div className="flex bg-secondary/50 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setResearchDepth('general')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${researchDepth === 'general' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        کلیات
                                    </button>
                                    <button 
                                        onClick={() => setResearchDepth('deep')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${researchDepth === 'deep' ? 'bg-background text-purple-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        عمیق و تحلیلی
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground">حجم محتوا</label>
                                <div className="flex bg-secondary/50 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setResearchLength('brief')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${researchLength === 'brief' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        خلاصه
                                    </button>
                                    <button 
                                        onClick={() => setResearchLength('standard')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${researchLength === 'standard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        استاندارد
                                    </button>
                                    <button 
                                        onClick={() => setResearchLength('comprehensive')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${researchLength === 'comprehensive' ? 'bg-background text-purple-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        جامع
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button 
                                onClick={() => {
                                    actions.handleTopicStudy(topicInput, { depth: researchDepth, length: researchLength });
                                    setTopicInput('');
                                }}
                                disabled={!topicInput.trim()}
                                className="w-full py-4 flex items-center justify-center gap-2 bg-secondary text-foreground border border-border font-bold rounded-xl hover:bg-purple-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <span>شروع تحقیق و افزودن به منابع</span>
                                <ArrowRight className="w-5 h-5 rotate-180" />
                            </button>
                        </div>
                    </div>
                );

            case 'upload':
                return (
                    <div 
                        className="bg-card rounded-2xl p-6 border-2 border-dashed border-primary/20 hover:border-primary/50 transition-all flex flex-col items-center justify-center text-center group cursor-pointer animate-fade-in relative overflow-hidden min-h-[300px]"
                        onClick={() => fileInputRef.current?.click()}
                    >
                         <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="w-10 h-10 text-primary" />
                        </div>
                        
                        <h3 className="text-xl font-bold text-foreground mb-2">بارگذاری فایل</h3>
                        <p className="text-muted-foreground max-w-xs mx-auto mb-8">
                            فایل خود را اینجا رها کنید یا کلیک کنید (PDF, TXT, Image, Audio)
                        </p>

                        <div className="flex flex-wrap justify-center gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium text-muted-foreground">
                                <FileText className="w-4 h-4" /> PDF / TXT
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium text-muted-foreground">
                                <FileAudio className="w-4 h-4" /> MP3 / WAV
                            </div>
                        </div>

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={actions.handleFileUpload} 
                            accept=".pdf,.txt,image/*,audio/*" 
                        />
                    </div>
                );

            case 'text':
                return (
                     <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col animate-fade-in">
                        <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-lg text-foreground">متن خام</h3>
                        </div>

                         <textarea 
                            className="w-full flex-grow p-4 bg-secondary/30 rounded-xl border border-border resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-foreground placeholder:text-muted-foreground/50 min-h-[120px] mb-6" 
                            placeholder="متن مقاله، جزوه یا کتاب خود را اینجا پیست کنید..."
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                        />

                        <div className="mt-auto">
                            <button 
                                onClick={() => {
                                    actions.handleStartFromText(textInput);
                                    setTextInput('');
                                }}
                                disabled={textInput.trim().length < 10}
                                className="w-full py-4 flex items-center justify-center gap-2 bg-secondary text-foreground border border-border font-bold rounded-xl hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <span>افزودن متن</span>
                                <ArrowRight className="w-5 h-5 rotate-180" />
                            </button>
                        </div>
                    </div>
                );
            
            case 'link':
                return (
                    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col animate-fade-in">
                        <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-teal-500/10 rounded-lg text-teal-600">
                                <Globe className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-lg text-foreground">لینک وب‌سایت</h3>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-4">
                            لینک مقاله یا صفحه وب مورد نظر خود را وارد کنید تا هوش مصنوعی محتوای آن را استخراج کند.
                        </p>

                        <div className="relative mb-6 flex-grow">
                            <input 
                                type="url"
                                className="w-full px-4 py-4 pr-12 text-lg bg-background border-2 border-border rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all placeholder:text-muted-foreground/50 text-left ltr"
                                placeholder="https://example.com/article..."
                                value={linkInput}
                                onChange={(e) => setLinkInput(e.target.value)}
                                style={{ direction: 'ltr' }}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <Link className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button 
                                onClick={() => {
                                    actions.handleUrlInput(linkInput);
                                    setLinkInput('');
                                }}
                                disabled={linkInput.length < 5}
                                className="w-full py-4 flex items-center justify-center gap-2 bg-secondary text-foreground border border-border font-bold rounded-xl hover:bg-teal-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <span>افزودن لینک</span>
                                <ArrowRight className="w-5 h-5 rotate-180" />
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex-grow relative z-10 overflow-y-auto scroll-smooth">
            {reviewResource && renderReviewModal()}
            
            {state.status === AppStatus.IDLE && (
                <div className="max-w-5xl mx-auto mt-6 md:mt-12 p-4 md:p-6 pb-32">
                    
                    {viewMode === 'landing' ? (
                        /* LANDING MODE: Hero + Main Choices */
                        <div className="animate-slide-up">
                            {/* Hero Section */}
                            <div className="text-center space-y-6 mb-12">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/50 border border-border text-xs font-medium text-muted-foreground mb-2">
                                     <Sparkles className="w-3.5 h-3.5 text-primary" />
                                     <span>هوش مصنوعی نسخه ۲.۵</span>
                                </div>
                                <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-purple-600 leading-tight">
                                   امروز چه چیزی یاد می‌گیریم؟
                                </h2>
                                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                                    پلتفرم هوشمند تبدیل محتوا به مسیر یادگیری تعاملی.
                                    <br className="hidden md:block" />
                                    یکی از روش‌های زیر را برای شروع انتخاب کنید:
                                </p>
                            </div>

                            {/* Main Action Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                {/* Option 1: Source Upload */}
                                <button 
                                    onClick={() => handleEnterAction('upload')}
                                    className="relative group p-8 rounded-3xl bg-card border-2 border-primary/20 hover:border-primary transition-all duration-300 text-center shadow-lg hover:shadow-2xl hover:shadow-primary/10 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                                        <Upload className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3">بارگذاری منابع</h3>
                                    <p className="text-muted-foreground text-sm">
                                        ترکیب چندین منبع (تا ۵ عدد) از فایل‌های PDF، صوتی یا متن برای دقت بالاتر.
                                    </p>
                                    <div className="mt-6 inline-flex items-center gap-2 text-primary font-bold text-sm">
                                        <span>مدیریت منابع</span>
                                        <ArrowLeft className="w-4 h-4" />
                                    </div>
                                </button>

                                {/* Option 2: Topic Exploration */}
                                <button 
                                    onClick={() => handleEnterAction('explore')}
                                    className="relative group p-8 rounded-3xl bg-card border-2 border-border hover:border-purple-500/50 transition-all duration-300 text-center shadow-lg hover:shadow-2xl hover:shadow-purple-500/10 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-20 h-20 mx-auto bg-purple-500/10 rounded-full flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform">
                                        <BrainCircuit className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3">کاوش موضوعی</h3>
                                    <p className="text-muted-foreground text-sm">
                                        فقط یک موضوع وارد کنید (مثل "اقتصاد خرد") تا هوش مصنوعی برایتان محتوا تولید کند.
                                    </p>
                                    <div className="mt-6 inline-flex items-center gap-2 text-purple-600 font-bold text-sm">
                                        <span>شروع کاوش</span>
                                        <ArrowLeft className="w-4 h-4" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ACTION MODE: Tabs & Inputs */
                        <div className="max-w-4xl mx-auto animate-slide-up">
                            {/* Back Button */}
                            <div className="flex items-center justify-between mb-6">
                                <button 
                                    onClick={handleBackToLanding}
                                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
                                >
                                    <div className="p-2 rounded-full bg-secondary group-hover:bg-secondary/80">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold">بازگشت</span>
                                </button>
                                {activeTab !== 'explore' && state.resources.length > 0 && (
                                    <div className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                                        {state.resources.length} منبع اضافه شده
                                    </div>
                                )}
                            </div>

                            {/* Custom Tabs */}
                            <div className="flex p-1 bg-secondary/50 rounded-2xl mb-6 mx-auto max-w-3xl overflow-x-auto">
                                <button 
                                    onClick={() => setActiveTab('upload')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 min-w-[100px] rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'upload' ? 'bg-background text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Upload className="w-5 h-5" />
                                    <span>آپلود فایل</span>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('link')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 min-w-[100px] rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'link' ? 'bg-background text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Link className="w-5 h-5" />
                                    <span>لینک وب</span>
                                </button>
                                 <button 
                                    onClick={() => setActiveTab('text')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 min-w-[100px] rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'text' ? 'bg-background text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <FileText className="w-5 h-5" />
                                    <span>متن</span>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('explore')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 min-w-[100px] rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'explore' ? 'bg-background text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <BrainCircuit className="w-5 h-5" />
                                    <span>موضوع</span>
                                </button>
                            </div>

                            {/* Input Area Content */}
                            <div>
                                {renderInputSection()}
                            </div>

                            {/* Resource List (Visible if resources exist) */}
                            {renderResourceList()}

                        </div>
                    )}
                </div>
            )}

            {state.status === AppStatus.WIZARD && (
                <PersonalizationWizard 
                    initialPreferences={state.preferences}
                    onSubmit={actions.handleWizardComplete}
                    onSkip={() => actions.handleWizardComplete(state.preferences)}
                />
            )}

            {state.status === AppStatus.ERROR && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 fade-in p-8 text-center">
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
                         <XCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold">خطایی رخ داده است</h2>
                    <p className="text-muted-foreground max-w-md">{state.error || 'مشکلی پیش آمده.'}</p>
                    <button 
                        onClick={() => dispatch({ type: 'RESET' })}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-bold flex items-center gap-2"
                    >
                        <span>بازگشت به خانه</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {(state.status === AppStatus.LOADING || state.status === AppStatus.GENERATING_REMEDIAL || state.status === AppStatus.GRADING_PRE_ASSESSMENT || state.status === AppStatus.ADAPTING_PLAN || state.status === AppStatus.GRADING_QUIZ) && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 fade-in">
                    <BoxLoader size={120} />
                    <p className="text-xl font-medium text-muted-foreground animate-pulse px-4 text-center">
                        {state.loadingMessage || 
                         (state.status === AppStatus.GRADING_PRE_ASSESSMENT ? 'در حال تحلیل پاسخ‌ها و تعیین سطح...' : 
                          state.status === AppStatus.GRADING_QUIZ ? 'در حال تصحیح آزمون و تحلیل عملکرد...' : 
                          'در حال پردازش...')}
                    </p>
                    {state.status === AppStatus.ADAPTING_PLAN && (
                        <div className="flex items-center gap-2 text-sm text-purple-500 bg-purple-500/10 px-3 py-1 rounded-full">
                             <Sparkles className="w-4 h-4 animate-pulse" />
                             <span>بهینه‌سازی هوشمند مسیر یادگیری</span>
                        </div>
                    )}
                </div>
            )}

            {state.status === AppStatus.PLAN_REVIEW && (
                 <div className="flex flex-col h-full">
                    <div className="flex-grow relative">
                        <MindMap 
                            nodes={state.mindMap} 
                            progress={{}} 
                            suggestedPath={state.suggestedPath}
                            onSelectNode={() => {}} 
                            onTakeQuiz={() => {}}
                            theme={state.theme}
                            activeNodeId={null}
                            showSuggestedPath={true}
                        />
                         <div className="absolute bottom-20 md:bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
                             <div className="bg-card/90 backdrop-blur border border-border p-4 rounded-xl shadow-2xl text-center">
                                 <h3 className="font-bold text-lg mb-2">نقشه یادگیری آماده است</h3>
                                 <p className="text-sm text-muted-foreground mb-4">این ساختار بر اساس محتوای شما طراحی شده است. برای شخصی‌سازی بیشتر، ابتدا یک پیش‌آزمون کوتاه می‌دهیم.</p>
                                 <button 
                                    onClick={() => dispatch({ type: 'CONFIRM_PLAN', payload: { mindMap: state.mindMap } })}
                                    className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                                >
                                    <span>تایید و شروع پیش‌آزمون</span>
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {state.status === AppStatus.PRE_ASSESSMENT && state.preAssessment && (
                <QuizView 
                    title="پیش‌آزمون تعیین سطح" 
                    quiz={state.preAssessment} 
                    onSubmit={actions.handlePreAssessmentSubmit} 
                />
            )}

            {state.status === AppStatus.PRE_ASSESSMENT_REVIEW && state.preAssessmentAnalysis && (
                <PreAssessmentReview 
                    analysis={state.preAssessmentAnalysis} 
                    onStart={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} 
                />
            )}

            {(state.status === AppStatus.LEARNING || state.status === AppStatus.VIEWING_NODE || state.status === AppStatus.TAKING_QUIZ || state.status === AppStatus.QUIZ_REVIEW) && (
                <div className="flex flex-col h-full relative">
                    <div className="absolute inset-0 z-0">
                        <MindMap 
                            nodes={state.mindMap} 
                            progress={Object.keys(state.userProgress).reduce((acc, key) => ({...acc, [key]: state.userProgress[key].status}), {} as {[key: string]: 'completed' | 'failed' | 'in_progress'})} 
                            suggestedPath={state.suggestedPath}
                            onSelectNode={actions.handleNodeSelect} 
                            onTakeQuiz={actions.handleTakeQuiz}
                            theme={state.theme}
                            activeNodeId={state.activeNodeId}
                            showSuggestedPath={true}
                            isSelectionMode={state.isPodcastMode}
                            selectedNodeIds={state.podcastConfig?.selectedNodeIds}
                        />
                         {state.status === AppStatus.LEARNING && (
                            <div className="absolute top-4 right-4 z-30 bg-card/80 backdrop-blur p-3 rounded-lg border border-border shadow-sm max-w-[200px] hidden md:block">
                                <p className="text-xs text-muted-foreground">مسیر پیشنهادی با شماره مشخص شده است. از گره شماره ۱ شروع کنید.</p>
                            </div>
                        )}
                    </div>

                    {state.status !== AppStatus.LEARNING && !state.isPodcastMode && (
                        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto animate-zoom-in">
                            {state.status === AppStatus.VIEWING_NODE && state.activeNodeId && (
                                <NodeView 
                                    node={state.mindMap.find(n => n.id === state.activeNodeId)!} 
                                    content={state.streamingNodeContent || state.nodeContents[state.activeNodeId] || { introduction: '', theory: '', example: '', connection: '', conclusion: '', suggestedQuestions: [] }} 
                                    onBack={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })}
                                    onStartQuiz={() => actions.handleTakeQuiz(state.activeNodeId!)}
                                    onNavigate={actions.handleNodeSelect}
                                    prevNode={null}
                                    nextNode={null}
                                    onExplainRequest={actions.handleExplainRequest}
                                    isIntroNode={state.mindMap.find(n => n.id === state.activeNodeId)?.parentId === null}
                                    onCompleteIntro={() => dispatch({ type: 'COMPLETE_INTRO_NODE' })}
                                    unlockedReward={state.rewards.find(r => r.relatedNodeId === state.activeNodeId)}
                                    isStreaming={!!state.streamingNodeContent}
                                />
                            )}

                            {state.status === AppStatus.TAKING_QUIZ && state.activeQuiz && (
                                <QuizView 
                                    title={`آزمون: ${state.mindMap.find(n => n.id === state.activeNodeId)?.title}`} 
                                    quiz={state.activeQuiz} 
                                    onSubmit={actions.handleQuizSubmit} 
                                />
                            )}

                            {state.status === AppStatus.QUIZ_REVIEW && state.quizResults && (
                                <QuizReview 
                                    results={state.quizResults} 
                                    onFinish={() => dispatch({ type: 'START_PERSONALIZED_LEARNING' })} 
                                    attempts={state.userProgress[state.activeNodeId!]?.attempts || 1}
                                    onForceUnlock={() => dispatch({ type: 'FORCE_UNLOCK_NODE' })}
                                    rewardUnlocked={!!state.rewards.find(r => r.relatedNodeId === state.activeNodeId && new Date(r.unlockedAt).getTime() > Date.now() - 60000)}
                                    onGenerateRemedial={actions.handleGenerateRemedial}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MainContent;
