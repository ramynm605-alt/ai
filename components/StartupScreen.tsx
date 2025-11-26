
import React, { useState } from 'react';
import { AuroraBackground } from './ui/aurora-background';
import { Button } from './ui/button';
import { ArrowRight, Brain, Shield, Lock, FileText, CheckCircle } from './icons';

interface StartupScreenProps {
  onAnimationEnd: () => void;
}

const TermsModal: React.FC<{ onAccept: () => void }> = ({ onAccept }) => {
    const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'ai'>('terms');

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 fade-in">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-border bg-secondary/20">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                        <Shield className="w-5 h-5 text-primary" />
                        قوانین و حریم خصوصی
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">برای استفاده از ذهن‌گاه، لطفاً موارد زیر را مطالعه و تایید کنید.</p>
                </div>
                
                <div className="flex bg-secondary/50 p-1 mx-4 mt-4 rounded-lg">
                    <button onClick={() => setActiveTab('terms')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'terms' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>شرایط استفاده</button>
                    <button onClick={() => setActiveTab('privacy')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'privacy' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>حریم خصوصی</button>
                    <button onClick={() => setActiveTab('ai')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'ai' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>هوش مصنوعی</button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow text-sm leading-relaxed text-muted-foreground">
                    {activeTab === 'terms' && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 mt-1 shrink-0" />
                                <p>شما موافقت می‌کنید که از این پلتفرم فقط برای مقاصد آموزشی و قانونی استفاده کنید.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 mt-1 shrink-0" />
                                <p>انتشار یا آپلود محتوای غیرقانونی، خشونت‌آمیز یا ناقض کپی‌رایت ممنوع است.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 mt-1 shrink-0" />
                                <p>ما مسئولیتی در قبال صحت کامل محتوای تولید شده توسط هوش مصنوعی نداریم.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'privacy' && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex items-start gap-2">
                                <Lock className="w-4 h-4 mt-1 shrink-0" />
                                <p>اطلاعات شما (مانند سابقه چت و پیشرفت) در مرورگر شما یا سرورهای امن Firebase ذخیره می‌شود.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <Lock className="w-4 h-4 mt-1 shrink-0" />
                                <p>ما اطلاعات شخصی شما را به هیچ طرف ثالثی نمی‌فروشیم.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <Lock className="w-4 h-4 mt-1 shrink-0" />
                                <p>متون ارسالی شما برای پردازش به سرویس Google Gemini ارسال می‌شود اما برای آموزش مدل استفاده نمی‌شود.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'ai' && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex items-start gap-2">
                                <Brain className="w-4 h-4 mt-1 shrink-0" />
                                <p><strong className="text-foreground">احتمال خطا (Hallucination):</strong> هوش مصنوعی ممکن است گاهی اطلاعات نادرست یا ساختگی ارائه دهد.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <Brain className="w-4 h-4 mt-1 shrink-0" />
                                <p>این ابزار نباید به عنوان تنها منبع برای تصمیم‌گیری‌های پزشکی، حقوقی یا مالی استفاده شود.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <Brain className="w-4 h-4 mt-1 shrink-0" />
                                <p>همیشه اطلاعات حساس را با منابع معتبر چک کنید.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-secondary/20 flex justify-end">
                    <Button onClick={onAccept} className="w-full md:w-auto flex items-center gap-2 font-bold">
                        <CheckCircle className="w-4 h-4" />
                        <span>مطالعه کردم و می‌پذیرم</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}

const StartupScreen: React.FC<StartupScreenProps> = ({ onAnimationEnd }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Check if user has already accepted terms (persisted in localStorage)
  const hasAcceptedTerms = localStorage.getItem('zehngah_terms_accepted') === 'true';

  const handleStartClick = () => {
      if (!hasAcceptedTerms) {
          setShowTerms(true);
      } else {
          proceed();
      }
  };

  const handleAcceptTerms = () => {
      localStorage.setItem('zehngah_terms_accepted', 'true');
      setShowTerms(false);
      proceed();
  };

  const proceed = () => {
    setIsExiting(true);
    setTimeout(() => {
      onAnimationEnd();
    }, 800);
  };

  return (
    <div className={`fixed inset-0 z-[9999] transition-opacity duration-700 ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <AuroraBackground showRadialGradient={true}>
        <div
          className={`relative z-10 flex flex-col items-center justify-center h-full px-4 text-center transition-all duration-700 transform ${isExiting ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}`}
        >
            <div className="mb-8 relative group cursor-pointer">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse group-hover:bg-primary/30 transition-all"></div>
                <Brain className="w-24 h-24 text-foreground relative z-10 drop-shadow-2xl transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-foreground mb-6 tracking-tight drop-shadow-lg">
                ذهن گاه
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl mb-10 max-w-md leading-relaxed font-light">
                سفری به اعماق یادگیری با هوش مصنوعی
            </p>

            <Button 
                size="lg" 
                onClick={handleStartClick} 
                className="text-lg font-bold px-8 py-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
                <span>شروع یادگیری</span>
                <ArrowRight className="mr-2 w-5 h-5 rotate-180" />
            </Button>
            
            {!hasAcceptedTerms && (
                <p className="mt-4 text-[10px] text-muted-foreground/60">با کلیک بر روی شروع، قوانین و حریم خصوصی را می‌پذیرید.</p>
            )}
        </div>
      </AuroraBackground>
      
      {showTerms && <TermsModal onAccept={handleAcceptTerms} />}
    </div>
  );
};

export default StartupScreen;
