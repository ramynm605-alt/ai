

import React, { useState } from 'react';
import { UserProfile, SavedSession } from '../types';
import { User, LogOut, History, BrainCircuit, Trash, Save, CheckCircle, ArrowRight, XCircle, Shield, Key } from './icons';

interface UserPanelProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile | null;
    onLogin: (email: string, password: string) => Promise<void>;
    onRegister: (email: string, password: string, name: string) => Promise<void>;
    onLogout: () => void;
    savedSessions: SavedSession[];
    onLoadSession: (session: SavedSession) => void;
    onDeleteSession: (sessionId: string) => void;
    onSaveCurrentSession: (title: string) => void;
    hasCurrentSession: boolean;
}

const UserPanel: React.FC<UserPanelProps> = ({ 
    isOpen, 
    onClose, 
    user, 
    onLogin, 
    onRegister, 
    onLogout, 
    savedSessions, 
    onLoadSession,
    onDeleteSession,
    onSaveCurrentSession,
    hasCurrentSession
}) => {
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [sessionTitle, setSessionTitle] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            if (authMode === 'login') {
                await onLogin(email, password);
            } else {
                await onRegister(email, password, name);
            }
        } catch (err: any) {
            setError(err.message || 'خطایی رخ داد');
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm fade-in" onClick={onClose}>
            <div className="w-full max-w-2xl h-[85vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30 shrink-0">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        <span>{user ? 'داشبورد کاربری' : 'حساب کاربری'}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
                        <XCircle className="w-6 h-6 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6">
                    {!user ? (
                        // Auth View
                        <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto">
                            <div className="mb-8 text-center">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                    <User className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">{authMode === 'login' ? 'ورود به حساب' : 'ساخت حساب جدید'}</h3>
                                <p className="text-muted-foreground">برای ذخیره ایمن پیشرفت و دسترسی به نقشه‌های ذهنی خود وارد شوید.</p>
                            </div>

                            {/* Security Assurance */}
                            <div className="w-full mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3 items-start text-left" dir="rtl">
                                <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">تضمین امنیت حریم خصوصی</p>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        رمز عبور شما با الگوریتم پیشرفته <span className="font-mono bg-background px-1 rounded">SHA-256</span> هش می‌شود. 
                                        تمامی اطلاعات حساب و تاریخچه یادگیری شما <strong>فقط در حافظه مرورگر خودتان</strong> (Local Storage) ذخیره می‌شود و به هیچ سروری ارسال نمی‌گردد.
                                    </p>
                                </div>
                            </div>

                            {error && <div className="w-full p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}

                            <form onSubmit={handleAuthSubmit} className="w-full space-y-4">
                                {authMode === 'register' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">نام کامل</label>
                                        <input 
                                            type="text" 
                                            required 
                                            className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium mb-1">ایمیل</label>
                                    <input 
                                        type="email" 
                                        required 
                                        className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">رمز عبور</label>
                                    <div className="relative">
                                        <input 
                                            type="password" 
                                            required 
                                            minLength={4}
                                            className="w-full p-3 pl-10 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                        />
                                        <Key className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                                    </div>
                                </div>
                                <button className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">
                                    {authMode === 'login' ? 'ورود امن' : 'ثبت نام و رمزنگاری'}
                                </button>
                            </form>

                            <div className="mt-6 text-center text-sm">
                                {authMode === 'login' ? (
                                    <p>حساب ندارید؟ <button onClick={() => { setAuthMode('register'); setError(null); }} className="text-primary font-bold hover:underline">ثبت نام کنید</button></p>
                                ) : (
                                    <p>حساب دارید؟ <button onClick={() => { setAuthMode('login'); setError(null); }} className="text-primary font-bold hover:underline">وارد شوید</button></p>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Dashboard View
                        <div className="space-y-8">
                            {/* Profile Summary */}
                            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/10 to-secondary rounded-xl border border-primary/20 relative overflow-hidden">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg z-10`} style={{ backgroundColor: user.avatarColor }}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="z-10">
                                    <h3 className="text-xl font-bold">{user.name}</h3>
                                    <p className="text-muted-foreground text-sm">{user.email}</p>
                                    <p className="text-xs text-muted-foreground mt-1 opacity-70">عضویت: {new Date(user.joinDate).toLocaleDateString('fa-IR')}</p>
                                </div>
                                <Shield className="absolute -left-4 -bottom-4 w-32 h-32 text-primary/5 z-0" />
                            </div>

                             {/* Security Status */}
                             <div className="flex items-center gap-2 text-xs text-success bg-success/10 p-2 rounded-lg border border-success/20">
                                <Shield className="w-4 h-4" />
                                <span>حساب شما با رمزنگاری SHA-256 محافظت می‌شود.</span>
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
                                            <span>ذخیره وضعیت فعلی در پروفایل</span>
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
