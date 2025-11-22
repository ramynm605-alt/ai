
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { XCircle, Maximize, Minimize, ArrowRight, BrainCircuit, Flame } from './icons';

interface ChatPanelProps {
    history: ChatMessage[];
    isFullScreen: boolean;
    isDebateMode?: boolean; 
    initialMessage: string;
    onSend: (message: string) => void;
    onClose: () => void;
    onToggleFullScreen: () => void;
    onToggleDebateMode?: () => void;
    onInitialMessageConsumed: () => void;
    onInitiateDebate?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    history,
    isFullScreen,
    isDebateMode = false,
    initialMessage,
    onSend,
    onClose,
    onToggleFullScreen,
    onToggleDebateMode,
    onInitialMessageConsumed,
    onInitiateDebate
}) => {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showStarterOptions, setShowStarterOptions] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        const lastMessage = history[history.length - 1];
        if (lastMessage?.message === '...') {
            setIsTyping(true);
        } else {
            setIsTyping(false);
        }
    }, [history]);

    useEffect(() => {
        if (initialMessage) {
            setInput(initialMessage);
            onInitialMessageConsumed();
        }
    }, [initialMessage, onInitialMessageConsumed]);

    const handleSend = () => {
        if (input.trim()) {
            onSend(input);
            setInput('');
            if (showStarterOptions) setShowStarterOptions(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleToggleDebate = () => {
        if (onToggleDebateMode) {
            onToggleDebateMode();
            // If we are turning it ON (currently false), show options
            if (!isDebateMode) {
                setShowStarterOptions(true);
            } else {
                setShowStarterOptions(false);
            }
        }
    };

    const handleAIStart = () => {
        if (onInitiateDebate) {
            onInitiateDebate();
        }
        setShowStarterOptions(false);
    };

    const handleUserStart = () => {
        setShowStarterOptions(false);
    };

    // Improved Responsive Classes
    const panelClasses = `chat-panel fixed z-[2000] flex flex-col transition-all duration-300 ease-in-out shadow-2xl bg-card border border-border
    ${isFullScreen 
        ? 'inset-0 w-full h-full rounded-none' 
        : 'bottom-0 w-full h-[85dvh] rounded-t-2xl border-x md:h-[600px] md:w-[400px] md:bottom-6 md:right-6 md:rounded-2xl md:border-t'
    }`;

    return (
        <div className={panelClasses}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0 bg-background/80 backdrop-blur rounded-t-2xl md:rounded-t-2xl">
                <div className="flex items-center gap-2">
                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300 ${isDebateMode ? 'bg-orange-500/20' : 'bg-primary/10'}`}>
                         {isDebateMode ? <Flame className="w-5 h-5 text-orange-500 animate-pulse" /> : <BrainCircuit className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                         <h3 className="font-bold text-card-foreground text-sm">مربی هوشمند</h3>
                         <div className="flex items-center gap-1">
                             <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${isDebateMode ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                             <span className="text-[10px] text-muted-foreground transition-opacity duration-300">{isDebateMode ? 'حالت بحث عمیق' : 'پاسخگو'}</span>
                         </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {onToggleDebateMode && (
                        <button 
                            onClick={handleToggleDebate} 
                            className={`p-1.5 rounded-lg transition-all ${isDebateMode ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-muted-foreground hover:bg-accent'}`}
                            title={isDebateMode ? "غیرفعال کردن حالت بحث" : "فعال کردن حالت بحث"}
                        >
                            <Flame className="w-4 h-4" />
                        </button>
                    )}
                    <div className="w-px h-4 bg-border mx-1" />
                    <button onClick={onToggleFullScreen} className="hidden md:block p-1.5 rounded-full text-muted-foreground hover:bg-accent">
                        {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-full text-muted-foreground hover:bg-accent">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-grow p-4 overflow-y-auto bg-secondary/5 relative">
                <div className="flex flex-col gap-4">
                    {history.length === 0 && isDebateMode && !showStarterOptions && (
                        <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300 text-xs text-center animate-fade-in">
                            حالت بحث فعال است. منتظر شروع شما هستم.
                        </div>
                    )}
                    {history.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`chat-message-bubble ${msg.role} markdown-content text-sm leading-relaxed max-w-[85%] p-3 rounded-2xl ${
                                    msg.role === 'user' 
                                        ? 'bg-primary text-primary-foreground rounded-br-none' 
                                        : `bg-secondary text-secondary-foreground rounded-bl-none border border-border ${isDebateMode ? 'border-orange-500/20 bg-orange-50/50 dark:bg-orange-900/10' : ''}`
                                }`}
                                dangerouslySetInnerHTML={{ __html: msg.message }}
                            />
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex justify-start">
                            <div className="bg-secondary text-secondary-foreground p-3 rounded-2xl rounded-bl-none border border-border">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div ref={messagesEndRef} />
                
                {/* Debate Starter Selection Overlay */}
                {showStarterOptions && isDebateMode && (
                    <div className="absolute bottom-4 left-4 right-4 animate-slide-up z-10">
                        <div className="bg-card/95 backdrop-blur-md border border-orange-500/30 shadow-2xl rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-orange-600 dark:text-orange-400 font-bold text-sm">
                                <Flame className="w-4 h-4" />
                                <span>چه کسی بحث را شروع کند؟</span>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={handleAIStart}
                                    className="flex-1 py-2 px-3 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors active:scale-95"
                                >
                                    مربی (هوش مصنوعی)
                                </button>
                                <button 
                                    onClick={handleUserStart}
                                    className="flex-1 py-2 px-3 bg-secondary text-secondary-foreground border border-border text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors active:scale-95"
                                >
                                    من شروع می‌کنم
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border shrink-0 bg-background pb-[max(12px,env(safe-area-inset-bottom))]">
                <div className="relative flex items-center">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={isDebateMode ? "استدلال خود را بنویسید..." : "سوال خود را بپرسید..."}
                        rows={1}
                        className={`w-full py-3 pr-12 overflow-y-auto bg-secondary/50 border rounded-2xl resize-none pl-4 focus:ring-2 focus:border-transparent text-foreground placeholder:text-muted-foreground transition-colors ${isDebateMode ? 'border-orange-500/30 focus:ring-orange-500' : 'border-border focus:ring-primary'}`}
                        style={{ maxHeight: '120px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className={`absolute right-2 flex items-center justify-center w-8 h-8 transition-colors rounded-full disabled:text-muted-foreground hover:bg-opacity-10 disabled:bg-transparent ${isDebateMode ? 'text-orange-500 hover:bg-orange-500' : 'text-primary hover:bg-primary'}`}
                    >
                        <ArrowRight className="w-5 h-5 transform -rotate-180" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
