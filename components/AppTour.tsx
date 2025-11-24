
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle } from './icons';

interface TourStep {
    targetId: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface AppTourProps {
    isOpen: boolean;
    onClose: () => void;
}

const TOUR_STEPS: TourStep[] = [
    {
        targetId: 'sidebar-logo',
        title: 'به ذهن‌گاه خوش آمدید!',
        content: 'اینجا مرکز کنترل یادگیری شماست. از این منو می‌توانید به بخش‌های مختلف دسترسی داشته باشید.',
        position: 'right'
    },
    {
        targetId: 'tour-theme-toggle',
        title: 'تنظیمات ظاهری',
        content: 'با کلیک روی این دکمه، حالت روز یا شب را متناسب با سلیقه و نور محیط تنظیم کنید.',
        position: 'right'
    },
    {
        targetId: 'tour-main-content',
        title: 'بوم اصلی یادگیری',
        content: 'این بخش اصلی برنامه است. تمام نقشه‌های ذهنی، درس‌ها و آزمون‌ها در اینجا نمایش داده می‌شوند.',
        position: 'center' 
    },
    {
        targetId: 'tour-input-methods',
        title: 'روش‌های ورودی',
        content: 'محتوای خود را از طریق آپلود فایل، لینک وب، متن خام یا جستجوی موضوعی وارد کنید تا هوش مصنوعی آن را تحلیل کند.',
        position: 'bottom'
    },
    {
        targetId: 'tour-chat-btn',
        title: 'مربی هوشمند',
        content: 'هر سوالی داشتید از مربی بپرسید. او همیشه آماده پاسخگویی، رفع اشکال و حتی بحث چالشی است.',
        position: 'left'
    },
    {
        targetId: 'tour-podcast-btn',
        title: 'استودیو پادکست',
        content: 'درس‌های خود را انتخاب کنید تا هوش مصنوعی آن‌ها را به یک پادکست شنیدنی تبدیل کند. عالی برای یادگیری در حرکت!',
        position: 'left'
    },
    {
        targetId: 'tour-flashcard-btn',
        title: 'جعبه لایتنر (مرور)',
        content: 'کارت‌های مرور به صورت هوشمند و بر اساس منحنی فراموشی به شما نمایش داده می‌شوند تا مطالب را هرگز فراموش نکنید.',
        position: 'left'
    },
    {
        targetId: 'tour-toolbox-btn',
        title: 'جعبه ابزار',
        content: 'دسترسی سریع به تمرین‌های آزاد، مرور نقاط ضعف گذشته و ابزارهای کمکی دیگر.',
        position: 'top'
    },
    {
        targetId: 'tour-profile-btn',
        title: 'پروفایل و ذخیره‌سازی',
        content: 'برای ذخیره همیشگی پیشرفت خود و دسترسی از دستگاه‌های دیگر، وارد حساب کاربری شوید.',
        position: 'right'
    }
];

const AppTour: React.FC<AppTourProps> = ({ isOpen, onClose }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    
    const currentStep = TOUR_STEPS[currentStepIndex];

    useEffect(() => {
        if (isOpen) {
            // Initial measurement
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
            updateTargetRect();

            const handleResize = () => {
                setWindowSize({ width: window.innerWidth, height: window.innerHeight });
                updateTargetRect();
            };
            
            window.addEventListener('resize', handleResize);
            window.addEventListener('scroll', updateTargetRect, true); // Capture scroll
            document.body.style.overflow = 'hidden'; // Lock scroll
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            window.removeEventListener('resize', () => {});
            window.removeEventListener('scroll', updateTargetRect, true);
            document.body.style.overflow = '';
        };
    }, [isOpen, currentStepIndex]);

    const updateTargetRect = () => {
        const element = document.getElementById(currentStep.targetId);
        if (element) {
            const rect = element.getBoundingClientRect();
            // Ensure rect is not zero-sized or hidden
            if (rect.width > 0 && rect.height > 0) {
                setTargetRect(rect);
            } else {
                setTargetRect(null);
            }
        } else {
            setTargetRect(null); 
        }
    };

    const handleNext = () => {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            onClose();
            setCurrentStepIndex(0);
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        onClose();
        setCurrentStepIndex(0);
    };

    if (!isOpen) return null;

    // --- Smart Positioning Logic ---
    let popoverStyle: React.CSSProperties = {};
    const isMobile = windowSize.width < 768;
    const margin = 16;
    const cardWidth = 300;
    const estimatedCardHeight = 200; // Approximation for calculations

    if (isMobile) {
        // MOBILE STRATEGY: Always fix to bottom center (Bottom Sheet style)
        // This guarantees it's never off-screen.
        popoverStyle = {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: '350px',
            zIndex: 5001 // Above the overlay
        };
    } else {
        // DESKTOP STRATEGY: Popover with collision detection
        if (targetRect) {
            let pos = currentStep.position || 'bottom';
            
            // 1. Check collisions and flip if necessary
            // Check Bottom overflow
            if (pos === 'bottom' && targetRect.bottom + estimatedCardHeight + margin > windowSize.height) {
                pos = 'top';
            }
            // Check Top overflow
            if (pos === 'top' && targetRect.top - estimatedCardHeight - margin < 0) {
                pos = 'bottom';
            }
            // Check Right overflow (for sidebar items)
            if (pos === 'right' && targetRect.right + cardWidth + margin > windowSize.width) {
                pos = 'left';
            }
            // Check Left overflow
            if (pos === 'left' && targetRect.left - cardWidth - margin < 0) {
                pos = 'right';
            }

            // If Main Content covers mostly everything, force Center
            if (currentStep.targetId === 'tour-main-content') {
                pos = 'center';
            }

            // 2. Apply positions based on decided `pos`
            if (pos === 'center') {
                popoverStyle = {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                };
            } else if (pos === 'top') {
                popoverStyle = {
                    bottom: windowSize.height - targetRect.top + margin,
                    left: targetRect.left + (targetRect.width / 2) - (cardWidth / 2),
                };
            } else if (pos === 'bottom') {
                popoverStyle = {
                    top: targetRect.bottom + margin,
                    left: targetRect.left + (targetRect.width / 2) - (cardWidth / 2),
                };
            } else if (pos === 'left') {
                popoverStyle = {
                    top: targetRect.top + (targetRect.height / 2),
                    right: windowSize.width - targetRect.left + margin, // Anchor to right of the available space (left of target)
                    transform: 'translateY(-50%)'
                };
            } else if (pos === 'right') {
                popoverStyle = {
                    top: targetRect.top + (targetRect.height / 2),
                    left: targetRect.right + margin,
                    transform: 'translateY(-50%)'
                };
            }

            // 3. Horizontal Clamping (Keep card within screen X-axis)
            if (pos === 'top' || pos === 'bottom') {
                const currentLeft = popoverStyle.left as number;
                const clampedLeft = Math.max(margin, Math.min(currentLeft, windowSize.width - cardWidth - margin));
                popoverStyle.left = clampedLeft;
            }
        } else {
            // Fallback if target hidden on desktop
            popoverStyle = {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
            };
        }
    }

    return (
        <div className="fixed inset-0 z-[5000] overflow-hidden">
            {/* Spotlight Overlay */}
            <div 
                className="absolute inset-0 transition-all duration-500 ease-in-out"
                style={{
                    // We use a massive box-shadow to create the "hole" effect
                    // If rect is null (e.g. target hidden), we just show a full dark overlay (rect size 0) centered
                    boxShadow: targetRect 
                        ? `0 0 0 9999px rgba(0, 0, 0, 0.75)` 
                        : `0 0 0 9999px rgba(0, 0, 0, 0.75)`, // Always dark
                    // Position the hole
                    top: targetRect ? targetRect.top : '50%',
                    left: targetRect ? targetRect.left : '50%',
                    width: targetRect ? targetRect.width : 0,
                    height: targetRect ? targetRect.height : 0,
                    borderRadius: targetRect && targetRect.height > 60 ? '12px' : '8px', // Rough heuristic for buttons vs areas
                    // If no target, hole size is 0, effectively full overlay
                }}
            >
                {/* Optional: Pulse ring around the target */}
                {targetRect && (
                    <div className="absolute inset-[-4px] border-2 border-primary/50 rounded-xl animate-pulse pointer-events-none" />
                )}
            </div>

            {/* Popover Card */}
            <div 
                className="absolute bg-card text-card-foreground p-5 rounded-2xl shadow-2xl border border-border transition-all duration-500 animate-slide-up flex flex-col"
                style={{
                    width: isMobile ? 'calc(100% - 32px)' : '320px',
                    maxWidth: '350px',
                    ...popoverStyle
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                        مرحله {currentStepIndex + 1} از {TOUR_STEPS.length}
                    </span>
                    <button onClick={handleSkip} className="text-muted-foreground hover:text-destructive transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                
                <h3 className="text-lg font-bold mb-2 text-primary">{currentStep.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground mb-6">{currentStep.content}</p>
                
                <div className="flex items-center justify-between mt-auto">
                    <button 
                        onClick={handlePrev} 
                        disabled={currentStepIndex === 0}
                        className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors px-2 py-1"
                    >
                        قبلی
                    </button>
                    <button 
                        onClick={handleNext}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                        <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'پایان' : 'بعدی'}</span>
                        {currentStepIndex === TOUR_STEPS.length - 1 ? <CheckCircle className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppTour;
