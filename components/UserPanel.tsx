
import React, { useState, useEffect } from 'react';
import { UserProfile, SavedSession } from '../types';
import { User, LogOut, History, BrainCircuit, Trash, Save, CheckCircle, ArrowRight, XCircle, Shield, Key, ClipboardList, ChevronDown } from './icons';

interface UserPanelProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile | null;
    onLogin: (email: string, password: string) => Promise<void>;
    onRegister: (email: string, password: string, name: string) => Promise<void>;
    onCheckEmail: (email: string) => Promise<boolean>;
    onLogout: () => void;
    savedSessions: SavedSession[];
    onLoadSession: (session: SavedSession) => void;
    onDeleteSession: (sessionId: string) => void;
    onSaveCurrentSession: (title: string) => void;
    hasCurrentSession: boolean;
    onExportData: () => string;
    onImportData: (data: string) => boolean;
}

type AuthStep = 'email' | 'register-password' | 'login-password';

const UserPanel: React.FC<UserPanelProps> = ({ 
    isOpen, 
    onClose, 
    user, 
    onLogin, 
    onRegister,
    onCheckEmail,
    onLogout, 
    savedSessions, 
    onLoadSession,
    onDeleteSession,
    onSaveCurrentSession,
    hasCurrentSession,
    onExportData,
    onImportData
}) => {
    const [step, setStep] = useState<AuthStep>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const [sessionTitle, setSessionTitle] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Sync States
    const [showSyncOptions, setShowSyncOptions] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [exportString, setExportString] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [importString, setImportString] = useState('');
    const [syncMsg, setSyncMsg] = useState('');

    // Reset state when panel opens
    useEffect(() => {
        if (isOpen && !user) {
            setStep('email');
            setPassword('');
            setError(null);
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.includes('@')) {
            setError('لطفاً یک ایمیل معتبر وارد کنید.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const exists = await onCheckEmail(email);
            if (exists) {
                setStep('login-password');
            } else {
                // Direct to registration without verification
                setStep('register-password');
            }
        } catch (err: any) {
            setError(err.message || 'خطا در بررسی ایمیل.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onRegister(email, password, name);
            // Automatically logs in via App logic
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onLogin(email, password);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sessionTitle.trim()) {
            onSaveCurrentSession(sessionTitle);
            setSessionTitle('');
            setShowSaveInput(false);
        }
    };

    const handleGenerateExport = () => {
        const data = onExportData();
        setExportString(data);
        setShowExport(true);
        setShowImport(false);
    };

    const handleExecuteImport = () => {
        if (!importString.trim()) return;
        const success = onImportData(importString);
        if (success) {
            setSyncMsg('اطلاعات با موفقیت بارگذاری شد!');
            setTimeout(() => setSyncMsg(''), 3000);
            setImportString('');
            setShowImport(false);
        } else {
            setSyncMsg('کد نامعتبر است.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm fade-in" onClick={onClose}>
            <div className="w-full max-w-2xl h-[85vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30 shrink-0">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        <span>{user ? 'حساب کاربری من' : 'ورود / ثبت نام'}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
                        <XCircle className="w-6 h-6 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6">
                    {!user ? (
                        // Auth View (Simplified Flow)
                        <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto animate-slide-up">
                            <div className="mb-6 text-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                    <User className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">
                                    {step === 'email' && 'شروع کنید'}
                                    {step === 'register-password' && 'تکمیل حساب'}
                                    {step === 'login-password' && 'خوش آمدید'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {step === 'email' && 'برای دسترسی به تمام دیوایس‌ها ایمیل خود را وارد کنید.'}
                                    {step === 'register-password' && 'یک رمز عبور برای حساب خود انتخاب کنید.'}
                                    {step === 'login-password' && 'رمز عبور خود را وارد کنید.'}
                                </p>
                            </div>

                            {error && <div className="w-full p-3 mb-4 text-sm text-center text-destructive bg-destructive/10 rounded-lg animate-pulse">{error}</div>}

                            <div className="w-full space-y-4">
                                {/* Step 1: Email Input */}
                                {step === 'email' && (
                                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">ایمیل</label>
                                            <input 
                                                type="email" 
                                                required 
                                                autoFocus
                                                dir="ltr"
                                                placeholder="name@example.com"
                                                className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary text-center"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                            />
                                        </div>
                                        <button disabled={isLoading} className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex justify-center">
                                            {isLoading ? 'در حال بررسی...' : 'ادامه'}
                                        </button>
                                    </form>
                                )}

                                {/* Step 2: Set Password (Register) */}
                                {step === 'register-password' && (
                                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">نام شما (اختیاری)</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">رمز عبور</label>
                                            <input 
                                                type="password" 
                                                required 
                                                minLength={4}
                                                className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                            />
                                        </div>
                                        <button disabled={isLoading} className="w-full py-3 bg-success text-white font-bold rounded-lg hover:bg-success/90 transition-all">
                                            {isLoading ? 'در حال ساخت حساب...' : 'تکمیل ثبت نام'}
                                        </button>
                                        <button type="button" onClick={() => setStep('email')} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
                                            بازگشت
                                        </button>
                                    </form>
                                )}

                                {/* Step 3: Enter Password (Login) */}
                                {step === 'login-password' && (
                                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                                        <div className="text-center text-sm font-medium text-foreground bg-secondary/50 p-2 rounded">
                                            {email}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">رمز عبور</label>
                                            <div className="relative">
                                                <input 
                                                    type="password" 
                                                    required 
                                                    autoFocus
                                                    className="w-full p-3 pl-10 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                />
                                                <Key className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                                            </div>
                                        </div>
                                        <button disabled={isLoading} className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition-all">
                                            {isLoading ? 'در حال ورود...' : 'ورود به حساب'}
                                        </button>
                                        <button type="button" onClick={() => setStep('email')} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
                                            این ایمیل من نیست
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Dashboard View
                        <div className="space-y-8 animate-slide-up">
                            {/* Profile Summary */}
                            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/10 to-secondary rounded-xl border border-primary/20 relative overflow-hidden">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg z-10`} style={{ backgroundColor: user.avatarColor }}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="z-10">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold">{user.name}</h3>
                                        {user.isVerified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                                    </div>
                                    <p className="text-muted-foreground text-sm">{user.email}</p>
                                </div>
                                <Shield className="absolute -left-4 -bottom-4 w-32 h-32 text-primary/5 z-0" />
                            </div>
                            
                            {/* Cloud Sync Section (Hidden by default to keep it simple) */}
                            <div className="border border-border rounded-lg overflow-hidden">
                                <button 
                                    onClick={() => setShowSyncOptions(!showSyncOptions)}
                                    className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <ClipboardList className="w-4 h-4 text-primary" />
                                        <span>مدیریت دستگاه‌ها و همگام‌سازی</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showSyncOptions ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {showSyncOptions && (
                                    <div className="p-4 bg-secondary/10 animate-slide-up">
                                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                            از آنجایی که ذهن‌گاه برای حفظ حریم خصوصی شما دیتایی را روی سرور ذخیره نمی‌کند، برای انتقال اطلاعات به دستگاه جدید (مثل موبایل) از این کد استفاده کنید:
                                        </p>
                                        <div className="flex gap-2 mb-3">
                                            <button onClick={handleGenerateExport} className="flex-1 px-3 py-2 text-xs font-bold bg-primary text-white rounded hover:bg-primary-hover transition-colors">
                                                دریافت کد انتقال (Export)
                                            </button>
                                            <button onClick={() => { setShowImport(true); setShowExport(false); }} className="flex-1 px-3 py-2 text-xs font-bold border border-primary text-primary rounded hover:bg-primary hover:text-white transition-colors">
                                                وارد کردن کد (Import)
                                            </button>
                                        </div>

                                        {showExport && (
                                            <div className="animate-slide-up">
                                                <textarea 
                                                    readOnly 
                                                    value={exportString} 
                                                    className="w-full h-24 p-2 text-[10px] font-mono bg-background border border-border rounded select-all"
                                                    onClick={(e) => e.currentTarget.select()}
                                                />
                                                <p className="text-[10px] text-muted-foreground mt-1">این کد را کپی کرده و در دستگاه جدید وارد کنید.</p>
                                            </div>
                                        )}

                                        {showImport && (
                                            <div className="animate-slide-up flex flex-col gap-2">
                                                <textarea 
                                                    placeholder="کد انتقال را اینجا پیست کنید..."
                                                    value={importString}
                                                    onChange={(e) => setImportString(e.target.value)}
                                                    className="w-full h-24 p-2 text-[10px] font-mono bg-background border border-border rounded"
                                                />
                                                <button onClick={handleExecuteImport} className="self-end px-4 py-1 text-xs bg-green-600 text-white rounded font-bold">
                                                    بارگذاری اطلاعات
                                                </button>
                                            </div>
                                        )}
                                        {syncMsg && <p className="text-xs text-green-600 font-bold mt-2">{syncMsg}</p>}
                                    </div>
                                )}
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 bg-card border border-border rounded-lg text-center">
                                    <div className="text-2xl font-bold text-primary">{savedSessions.length}</div>
                                    <div className="text-xs text-muted-foreground">نقشه‌های ذخیره شده</div>
                                </div>
                                <div className="p-4 bg-card border border-border rounded-lg text-center">
                                    <div className="text-2xl font-bold text-success">0</div>
                                    <div className="text-xs text-muted-foreground">دوره تکمیل شده</div>
                                </div>
                                <div className="p-4 bg-card border border-border rounded-lg text-center">
                                    <div className="text-2xl font-bold text-orange-500">1</div>
                                    <div className="text-xs text-muted-foreground">روز تداوم</div>
                                </div>
                            </div>

                            {/* Current Session Save Action */}
                            {hasCurrentSession && (
                                <div className="p-4 border border-dashed border-primary/50 rounded-lg bg-primary/5">
                                    {!showSaveInput ? (
                                        <button onClick={() => setShowSaveInput(true)} className="w-full flex items-center justify-center gap-2 py-2 text-primary font-semibold hover:bg-primary/10 rounded-md transition-colors">
                                            <Save className="w-5 h-5" />
                                            <span>تغییر نام جلسه فعلی</span>
                                        </button>
                                    ) : (
                                        <form onSubmit={handleSaveSubmit} className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="عنوان درس (مثال: تاریخ ایران)" 
                                                className="flex-grow p-2 rounded-md border border-border bg-background"
                                                value={sessionTitle}
                                                onChange={e => setSessionTitle(e.target.value)}
                                                autoFocus
                                            />
                                            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md font-medium">ذخیره</button>
                                            <button type="button" onClick={() => setShowSaveInput(false)} className="px-3 py-2 text-muted-foreground hover:bg-secondary rounded-md">لغو</button>
                                        </form>
                                    )}
                                    <p className="text-[10px] text-center mt-2 text-muted-foreground opacity-70">تغییرات شما به صورت خودکار ذخیره می‌شوند.</p>
                                </div>
                            )}

                            {/* History List */}
                            <div>
                                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <History className="w-5 h-5" />
                                    <span>تاریخچه یادگیری</span>
                                </h4>
                                {savedSessions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed border-border">
                                        <BrainCircuit className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>هنوز هیچ درسی ذخیره نکرده‌اید.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {savedSessions.map(session => (
                                            <div key={session.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:shadow-md transition-all group">
                                                <div>
                                                    <h5 className="font-bold text-foreground">{session.title}</h5>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {new Date(session.lastModified).toLocaleDateString('fa-IR')} • پیشرفت: {Math.round(session.progressPercentage)}%
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => { onLoadSession(session); onClose(); }}
                                                        className="px-3 py-1.5 text-sm font-medium bg-secondary hover:bg-primary hover:text-white text-secondary-foreground rounded-md transition-colors flex items-center gap-1"
                                                    >
                                                        <span>ادامه</span>
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDeleteSession(session.id)}
                                                        className="p-2 text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (Logout) */}
                {user && (
                    <div className="p-4 border-t border-border bg-secondary/30 shrink-0">
                        <button onClick={onLogout} className="flex items-center gap-2 text-destructive hover:text-destructive/80 font-medium text-sm">
                            <LogOut className="w-4 h-4" />
                            <span>خروج از حساب کاربری</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserPanel;
