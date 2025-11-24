

import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, SavedSession } from '../types';
import { User, LogOut, History, BrainCircuit, Trash, Save, CheckCircle, ArrowRight, XCircle, Shield, ClipboardList, ChevronDown, Upload, RefreshCw } from './icons';

interface UserPanelProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile | null;
    onLogin: (user: UserProfile) => Promise<void>;
    onLogout: () => void;
    savedSessions: SavedSession[];
    onLoadSession: (session: SavedSession) => void;
    onDeleteSession: (sessionId: string) => void;
    onSaveCurrentSession: (title: string) => void;
    hasCurrentSession: boolean;
    onExportData: () => string;
    onImportData: (data: string) => boolean;
    cloudStatus: 'idle' | 'syncing' | 'error' | 'success';
    lastSyncTime: string | null;
    onEnableCloudSync: () => void;
}

declare var google: any;

// --- Google Icon Component (Used for badges) ---
const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const UserPanel: React.FC<UserPanelProps> = ({ 
    isOpen, 
    onClose, 
    user, 
    onLogin, 
    onLogout, 
    savedSessions, 
    onLoadSession,
    onDeleteSession,
    onSaveCurrentSession,
    hasCurrentSession,
    onExportData,
    onImportData,
    cloudStatus,
    lastSyncTime,
    onEnableCloudSync
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [sessionTitle, setSessionTitle] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);
    
    // Sync States
    const [showSyncOptions, setShowSyncOptions] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [exportString, setExportString] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [importString, setImportString] = useState('');
    const [syncMsg, setSyncMsg] = useState('');

    const googleButtonRef = useRef<HTMLDivElement>(null);

    // Robust JWT Parser to handle UTF-8 strings (like Farsi names)
    const parseJwt = (token: string) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("Failed to parse JWT", e);
            return null;
        }
    };

    const handleGoogleCallback = async (response: any) => {
        setIsLoading(true);
        try {
            const credential = response.credential;
            const profile = parseJwt(credential);

            if (profile) {
                const newUser: UserProfile = {
                    id: profile.sub, // Unique Google ID
                    googleId: profile.sub,
                    name: profile.name || 'کاربر بدون نام',
                    email: profile.email,
                    avatarUrl: profile.picture,
                    avatarColor: '#4285F4',
                    joinDate: new Date().toISOString(),
                };
                await onLogin(newUser);
            }
        } catch (error) {
            console.error("Login failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Initialize Google Button
    useEffect(() => {
        const initGoogleButton = () => {
            if (typeof google !== 'undefined' && googleButtonRef.current && !user) {
                try {
                    const clientId = "732055395775-73muf7ge9l1lfknk2fg9qujvp7im7qn5.apps.googleusercontent.com";
                    
                    google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleGoogleCallback,
                        auto_select: false,
                        cancel_on_tap_outside: true,
                        ui_mode: "bottom_sheet"
                    });

                    google.accounts.id.renderButton(
                        googleButtonRef.current,
                        { 
                            theme: "outline", 
                            size: "large", 
                            type: "standard",
                            shape: "pill",
                            text: "signin_with",
                            width: googleButtonRef.current.offsetWidth
                        }
                    );
                } catch (e) {
                    console.error("Google Sign-In Initialization Error:", e);
                }
            }
        };

        // Check for google global periodically until loaded
        const intervalId = setInterval(() => {
            if (typeof google !== 'undefined') {
                initGoogleButton();
                clearInterval(intervalId);
            }
        }, 500);

        // Resize observer to make button responsive
        let resizeObserver: ResizeObserver;
        if (googleButtonRef.current) {
            resizeObserver = new ResizeObserver(() => {
                 if (typeof google !== 'undefined' && !user) {
                     // Trigger re-render if needed, handled by Google library usually
                 }
            });
            resizeObserver.observe(googleButtonRef.current);
        }

        return () => {
            clearInterval(intervalId);
            resizeObserver?.disconnect();
        };
    }, [user, isOpen]);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm fade-in" onClick={onClose}>
            {/* Mobile: Fullscreen, Desktop: Modal */}
            <div className="w-full h-full md:h-[85vh] md:max-w-2xl flex flex-col bg-card border border-border md:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30 shrink-0">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        <span>{user ? 'پروفایل کاربری' : 'ورود به حساب'}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
                        <XCircle className="w-6 h-6 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6">
                    {!user ? (
                        // Login View
                        <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto animate-slide-up space-y-8">
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary shadow-inner animate-pulse">
                                    <BrainCircuit className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold">ورود به ذهن‌گاه</h3>
                                <p className="text-muted-foreground">
                                    برای ذخیره خودکار پیشرفت، دسترسی به تاریخچه یادگیری و همگام‌سازی بین دستگاه‌ها وارد شوید.
                                </p>
                            </div>

                            <div className="w-full space-y-4">
                                {isLoading ? (
                                     <div className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full border border-border bg-secondary/50 text-muted-foreground">
                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        <span>در حال پردازش...</span>
                                    </div>
                                ) : (
                                    <div className="w-full flex justify-center">
                                        <div ref={googleButtonRef} className="w-full h-[44px]"></div>
                                    </div>
                                )}
                                
                                <p className="text-[10px] text-center text-muted-foreground">
                                    اطلاعات شما به صورت امن در فضای ابری گوگل (Firebase) ذخیره می‌شود.
                                </p>
                            </div>
                        </div>
                    ) : (
                        // Dashboard View
                        <div className="space-y-6 md:space-y-8 animate-slide-up">
                            {/* Profile Summary */}
                            <div className="flex items-center gap-4 p-4 md:p-6 bg-gradient-to-br from-primary/10 via-card to-secondary rounded-2xl border border-primary/10 relative overflow-hidden shadow-sm">
                                {user.avatarUrl ? (
                                     <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 md:w-16 md:h-16 rounded-full shadow-lg z-10 ring-4 ring-background object-cover" />
                                ) : (
                                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold text-white shadow-lg z-10 ring-4 ring-background`} style={{ backgroundColor: user.avatarColor }}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="z-10 overflow-hidden">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg md:text-xl font-bold truncate">{user.name}</h3>
                                        <div className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold rounded-full flex items-center gap-1 whitespace-nowrap">
                                            <div className="w-3 h-3"><GoogleIcon /></div>
                                            <span>حساب گوگل</span>
                                        </div>
                                    </div>
                                    <p className="text-muted-foreground text-xs md:text-sm mt-1 truncate">{user.email}</p>
                                </div>
                                <Shield className="absolute -right-6 -bottom-6 w-32 h-32 md:w-40 md:h-40 text-primary/5 z-0 rotate-12" />
                            </div>

                            {/* Cloud Sync Status - AUTOMATIC */}
                            <div className={`p-4 border rounded-xl ${cloudStatus === 'success' ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800' : cloudStatus === 'error' ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${cloudStatus === 'success' ? 'bg-green-100 text-green-600' : cloudStatus === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>
                                            {cloudStatus === 'syncing' ? (
                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin text-blue-500" />
                                            ) : (
                                                <Upload className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">وضعیت همگام‌سازی ابری</h4>
                                            <p className="text-xs text-muted-foreground">
                                                {cloudStatus === 'success' 
                                                    ? `آخرین ذخیره خودکار: ${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('fa-IR') : 'همین الان'}` 
                                                    : cloudStatus === 'error' 
                                                        ? 'خطا در اتصال به سرور (ذخیره محلی فعال است)' 
                                                        : cloudStatus === 'syncing' 
                                                            ? 'در حال برقراری ارتباط...' 
                                                            : 'ذخیره محلی فعال است (بیکار)'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {cloudStatus !== 'syncing' && (
                                            <button 
                                                onClick={onEnableCloudSync}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                                                    cloudStatus === 'error' 
                                                    ? 'border-destructive/30 text-destructive hover:bg-destructive/10' 
                                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                                                }`}
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                <span>{cloudStatus === 'error' ? 'تلاش مجدد' : 'بروزرسانی'}</span>
                                            </button>
                                        )}

                                        {cloudStatus === 'success' && (
                                            <div className="px-3 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-full flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                <span className="hidden sm:inline">فعال</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Manual Sync Backup (Hidden by default) */}
                            <div className="border border-border rounded-lg overflow-hidden">
                                <button 
                                    onClick={() => setShowSyncOptions(!showSyncOptions)}
                                    className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                        <ClipboardList className="w-4 h-4" />
                                        <span>ابزارهای پیشرفته (Export/Import)</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showSyncOptions ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {showSyncOptions && (
                                    <div className="p-4 bg-secondary/10 animate-slide-up">
                                        <p className="text-[10px] text-muted-foreground mb-3">
                                            می‌توانید از این کد برای انتقال تمام اطلاعات و پیشرفت خود به یک مرورگر یا دستگاه دیگر استفاده کنید:
                                        </p>
                                        <div className="flex gap-2 mb-3">
                                            <button onClick={handleGenerateExport} className="flex-1 px-3 py-2 text-xs font-bold bg-primary text-white rounded hover:bg-primary-hover transition-colors">
                                                کپی کد انتقال (Export)
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
                                            </div>
                                        )}

                                        {showImport && (
                                            <div className="animate-slide-up flex flex-col gap-2">
                                                <textarea 
                                                    placeholder="کد انتقال را اینجا وارد کنید..."
                                                    value={importString}
                                                    onChange={(e) => setImportString(e.target.value)}
                                                    className="w-full h-24 p-2 text-[10px] font-mono bg-background border border-border rounded"
                                                />
                                                <button onClick={handleExecuteImport} className="self-end px-4 py-1 text-xs bg-green-600 text-white rounded font-bold">
                                                    اعمال و بارگذاری
                                                </button>
                                            </div>
                                        )}
                                        {syncMsg && <p className="text-xs text-green-600 font-bold mt-2">{syncMsg}</p>}
                                    </div>
                                )}
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-2 md:gap-4">
                                <div className="p-3 md:p-4 bg-card border border-border rounded-xl text-center shadow-sm">
                                    <div className="text-xl md:text-2xl font-bold text-primary">{savedSessions.length}</div>
                                    <div className="text-[10px] md:text-xs text-muted-foreground font-medium mt-1">دروس فعال</div>
                                </div>
                                <div className="p-3 md:p-4 bg-card border border-border rounded-xl text-center shadow-sm">
                                    <div className="text-xl md:text-2xl font-bold text-success">
                                        {savedSessions.filter(s => s.progressPercentage === 100).length}
                                    </div>
                                    <div className="text-[10px] md:text-xs text-muted-foreground font-medium mt-1">تکمیل شده</div>
                                </div>
                                <div className="p-3 md:p-4 bg-card border border-border rounded-xl text-center shadow-sm">
                                    <div className="text-xl md:text-2xl font-bold text-orange-500">
                                        {Math.floor((new Date().getTime() - new Date(user.joinDate).getTime()) / (1000 * 3600 * 24)) + 1}
                                    </div>
                                    <div className="text-[10px] md:text-xs text-muted-foreground font-medium mt-1">روز عضویت</div>
                                </div>
                            </div>

                            {/* Current Session Save Action */}
                            {hasCurrentSession && (
                                <div className="p-4 border border-dashed border-primary/50 rounded-xl bg-primary/5">
                                    {!showSaveInput ? (
                                        <button onClick={() => setShowSaveInput(true)} className="w-full flex items-center justify-center gap-2 py-2 text-primary font-semibold hover:bg-primary/10 rounded-md transition-colors">
                                            <Save className="w-5 h-5" />
                                            <span>ذخیره و نام‌گذاری درس فعلی</span>
                                        </button>
                                    ) : (
                                        <form onSubmit={handleSaveSubmit} className="flex flex-col sm:flex-row gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="عنوان درس (مثال: تاریخ ایران)" 
                                                className="flex-grow p-2 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary"
                                                value={sessionTitle}
                                                onChange={e => setSessionTitle(e.target.value)}
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded-md font-medium">ذخیره</button>
                                                <button type="button" onClick={() => setShowSaveInput(false)} className="flex-1 px-3 py-2 text-muted-foreground hover:bg-secondary rounded-md">لغو</button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* History List */}
                            <div>
                                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <History className="w-5 h-5 text-primary" />
                                    <span>تاریخچه یادگیری</span>
                                </h4>
                                {savedSessions.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                                        <BrainCircuit className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>هنوز درسی را شروع نکرده‌اید.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 pb-8">
                                        {savedSessions.map(session => (
                                            <div key={session.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:shadow-md transition-all group">
                                                <div className="overflow-hidden">
                                                    <h5 className="font-bold text-foreground truncate">{session.title}</h5>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {new Date(session.lastModified).toLocaleDateString('fa-IR')} • پیشرفت: {Math.round(session.progressPercentage)}%
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button 
                                                        onClick={() => { onLoadSession(session); onClose(); }}
                                                        className="px-3 py-1.5 text-sm font-medium bg-secondary hover:bg-primary hover:text-white text-secondary-foreground rounded-lg transition-colors flex items-center gap-1"
                                                    >
                                                        <span>ادامه</span>
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDeleteSession(session.id)}
                                                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-opacity"
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
                    <div className="p-4 border-t border-border bg-secondary/30 shrink-0 flex justify-between items-center pb-[max(16px,env(safe-area-inset-bottom))]">
                        <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {user.googleId?.substring(0, 8)}
                        </span>
                        <button onClick={onLogout} className="flex items-center gap-2 text-destructive hover:text-destructive/80 font-medium text-sm transition-colors">
                            <LogOut className="w-4 h-4" />
                            <span>خروج از حساب</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserPanel;