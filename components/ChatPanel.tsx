
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatPersona } from '../types';
import { XCircle, Maximize, Minimize, ArrowRight, BrainCircuit, Flame, Settings, CheckCircle } from './icons';

interface ChatPanelProps {
    history: ChatMessage[];
    isFullScreen: boolean;
    isDebateMode?: boolean; 
    chatPersona: ChatPersona; // Receive current persona
    isThinking: boolean; // New Prop: Controls the loading indicator
    initialMessage: string;
    onSend: (message: string) => void;
    onClose: () => void;
    onToggleFullScreen: () => void;
    onToggleDebateMode?: () => void;
    onInitialMessageConsumed: () => void;
    onInitiateDebate?: () => void;
    onSetPersona: (persona: ChatPersona) => void; // Setter
    onNodeSelect: (nodeId: string) => void; // Navigation handler
}

const PERSONA_OPTIONS: { id: ChatPersona; label: string; icon: string; desc: string; type: 'normal' | 'debate' }[] = [
    { id: 'supportive_coach', label: 'مربی دلسوز', icon: '🌱', desc: 'دوستانه و حمایتی (پیش‌فرض)', type: 'normal' },
    { id: 'strict_professor', label: 'استاد سخت‌گیر', icon: '🎓', desc: 'رسمی و دقیق', type: 'normal' },
    { id: 'socratic_tutor', label: 'روش سقراطی', icon: '🤔', desc: 'فقط سوال می‌پرسد', type: 'debate' },
    { id: 'devil_advocate', label: 'وکیل مدافع شیطان', icon: '😈', desc: 'مخالفت با هر نظر شما', type: 'debate' },
    { id: 'ruthless_critic', label: 'منتقد بی‌رحم', icon: '⚖️', desc: 'شکارچی مغالطه‌های منطقی', type: 'debate' },
];

const ChatPanel: React.FC<ChatPanelProps> = ({
    history,
    isFullScreen,
    isDebateMode = false,
    chatPersona,
    isThinking,
    initialMessage,
    onSend,
    onClose,
    onToggleFullScreen,
    onToggleDebateMode,
    onInitialMessageConsumed,
    onInitiateDebate,
    onSetPersona,
    onNodeSelect
}) => {
    const [input, setInput] = useState('');
    const [showStarterOptions, setShowStarterOptions] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isThinking]);

    // Node Link Click Handling via Event Delegation
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleLinkClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            // Check if user clicked a text node inside specific formatting
            // Since the service returns [[Title]], we need to render it specially.
            // However, since we use 'marked', we need a post-process logic in the renderer OR 
            // we rely on the service returning valid Markdown links or button-like structures.
            
            // Current Strategy: The service wraps titles in [[...]]. 
            // We need a regex replacement in the render to turn [[...]] into a clickable span.
            // But for now, let's check if the service output raw text.
            
            // Assuming the service returns standard text with [[Title]].
            // We will handle the transformation in the render loop below.
            
            if (target.classList.contains('node-ref-link')) {
                const title = target.getAttribute('data-node-title');
                if (title) {
                    onNodeSelect(title);
                }
            }
        };

        container.addEventListener('click', handleLinkClick);
        return () => container.removeEventListener('click', handleLinkClick);
    }, [onNodeSelect]);


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
            // Logic to auto-switch persona based on mode toggle if needed
            // For now, we let the user choose manually or keep current.
            if (!isDebateMode) { // Turning ON
                 // Maybe suggest a debate persona?
                 setShowStarterOptions(true);
            } else {
                 setShowStarterOptions(false);
            }
        }
    };

    const handleAIStart = () => {
        if (onInitiateDebate) onInitiateDebate();
        setShowStarterOptions(false);
    };

    const handleUserStart = () => {
        setShowStarterOptions(false);
    };

    const panelClasses = `chat-panel fixed z-[2000] flex flex-col transition-all duration-300 ease-in-out shadow-2xl bg-card border border-border
    ${isFullScreen 
        ? 'inset-0 w-full h-full rounded-none' 
        : 'bottom-0 w-full h-[85dvh] rounded-t-2xl border-x md:h-[600px] md:w-[400px] md:bottom-6 md:right-6 md:rounded-2xl md:border-t'
    }`;

    // Function to transform [[Title]] into clickable spans
    const processMessageContent = (html: string) => {
        // Regex to find [[...]]
        // Note: Since 'marked' runs first, [[...]] usually survives unless it looks like a link.
        return html.replace(/\[\[(.*?)\]\]/g, (match, title) => {
            return `<span class="node-ref-link text-primary font-bold cursor-pointer hover:underline bg-primary/10 px-1 rounded" data-node-title="${title}">${title}</span>`;
        });
    };

    return (
        <div className={panelClasses}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0 bg-background/80 backdrop-blur rounded-t-2xl md:rounded-t-2xl">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowSettings(!showSettings)}>
                    <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300 ${isDebateMode ? 'bg-orange-500/20' : 'bg-primary/10'}`}>
                         {isDebateMode ? <Flame className="w-5 h-5 text-orange-500 animate-pulse" /> : <BrainCircuit className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                         <h3 className="font-bold text-card-foreground text-sm">مربی هوشمند</h3>
                         <div className="flex items-center gap-1">
                             <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${isDebateMode ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                             <span className="text-[10px] text-muted-foreground transition-opacity duration-300">
                                 {PERSONA_OPTIONS.find(p => p.id === chatPersona)?.label || 'مربی'}
                             </span>
                         </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-1.5 rounded-lg transition-all ${showSettings ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <button onClick={onToggleFullScreen} className="hidden md:block p-1.5 rounded-full text-muted-foreground hover:bg-accent">
                        {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-full text-muted-foreground hover:bg-accent">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Settings Overlay */}
            {showSettings && (
                <div className="absolute top-14 left-0 right-0 z-20 bg-card/95 backdrop-blur-md border-b border-border shadow-lg p-4 animate-slide-up">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-sm">تنظیم لحن و شخصیت مربی</h4>
                        <button onClick={() => setShowSettings(false)} className="text-xs text-primary hover:underline">بستن</button>
                    </div>
                    
                    {/* Normal Modes */}
                    <div className="mb-3">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">حالت عادی</span>
                        <div className="grid grid-cols-1 gap-2 mt-1">
                            {PERSONA_OPTIONS.filter(p => p.type === 'normal').map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => onSetPersona(p.id)}
                                    className={`flex items-center gap-3 p-2 rounded-lg border transition-all text-right ${chatPersona === p.id ? 'bg-primary/10 border-primary' : 'bg-secondary/30 border-transparent hover:bg-secondary/50'}`}
                                >
                                    <span className="text-xl">{p.icon}</span>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-foreground">{p.label}</div>
                                        <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                                    </div>
                                    {chatPersona === p.id && <CheckCircle className="w-4 h-4 text-primary" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Debate Modes */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">حالت بحث چالشی</span>
                            {onToggleDebateMode && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">{isDebateMode ? 'روشن' : 'خاموش'}</span>
                                    <button 
                                        onClick={handleToggleDebate}
                                        className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isDebateMode ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isDebateMode ? 'translate-x-0' : '-translate-x-4'}`} />
                                    </button>
                                </div>
                            )}
                        </div>
                         <div className={`grid grid-cols-1 gap-2 mt-1 ${!isDebateMode ? 'opacity-50 pointer-events-none' : ''}`}>
                            {PERSONA_OPTIONS.filter(p => p.type === 'debate').map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => onSetPersona(p.id)}
                                    className={`flex items-center gap-3 p-2 rounded-lg border transition-all text-right ${chatPersona === p.id ? 'bg-orange-500/10 border-orange-500' : 'bg-secondary/30 border-transparent hover:bg-secondary/50'}`}
                                >
                                    <span className="text-xl">{p.icon}</span>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-foreground">{p.label}</div>
                                        <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                                    </div>
                                    {chatPersona === p.id && <CheckCircle className="w-4 h-4 text-orange-500" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-grow p-4 overflow-y-auto bg-secondary/5 relative" ref={messagesContainerRef}>
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
                                dangerouslySetInnerHTML={{ __html: processMessageContent(msg.message) }}
                            />
                        </div>
                    ))}
                    {isThinking && (
                         <div className="flex justify-start animate-fade-in">
                            <div className="bg-secondary text-secondary-foreground p-3 rounded-2xl rounded-bl-none border border-border shadow-sm">
                                <div className="flex items-center gap-2 h-4">
                                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce"></div>
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
                        disabled={!input.trim() || isThinking}
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
