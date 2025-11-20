
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { XCircle, Maximize, Minimize, ArrowRight, BrainCircuit } from './icons';

interface ChatPanelProps {
    history: ChatMessage[];
    isFullScreen: boolean;
    initialMessage: string;
    onSend: (message: string) => void;
    onClose: () => void;
    onToggleFullScreen: () => void;
    onInitialMessageConsumed: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    history,
    isFullScreen,
    initialMessage,
    onSend,
    onClose,
    onToggleFullScreen,
    onInitialMessageConsumed,
}) => {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
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
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Mobile check: Logic inside render for responsive class
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    
    // If mobile, always force fullscreen look (even if state is not 'fullscreen')
    // We use 'fixed inset-0' for full screen mobile experience
    const panelClasses = `chat-panel fixed z-[2000] flex flex-col transition-all duration-300 ease-in-out shadow-2xl bg-card border border-border
    ${(isFullScreen || isMobile) 
        ? 'fullscreen inset-0 w-full h-full rounded-none' 
        : 'bottom-6 right-6 w-[400px] h-[550px] max-w-[90vw] max-h-[80vh] rounded-2xl'
    }`;


    return (
        <div className={panelClasses}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0 bg-background/80 backdrop-blur">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-6 h-6 text-primary" />
                    <h3 className="font-bold text-card-foreground">مربی هوشمند</h3>
                </div>
                <div className="flex items-center gap-2">
                    {!isMobile && (
                        <button onClick={onToggleFullScreen} className="p-1 rounded-full text-muted-foreground hover:bg-accent">
                            {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-accent">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="flex flex-col gap-4">
                    {history.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`chat-message-bubble ${msg.role} markdown-content`}
                                dangerouslySetInnerHTML={{ __html: msg.message }}
                            />
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex justify-start">
                            <div className="chat-message-bubble model">
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
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border shrink-0 bg-background pb-[max(12px,env(safe-area-inset-bottom))]">
                <div className="relative flex items-center">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="سوال خود را بپرسید..."
                        rows={1}
                        className="w-full py-3 pr-12 overflow-y-auto bg-secondary/50 border border-border rounded-2xl resize-none pl-4 focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                        style={{ maxHeight: '120px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 flex items-center justify-center w-8 h-8 transition-colors rounded-full text-primary disabled:text-muted-foreground hover:bg-primary/10 disabled:bg-transparent"
                    >
                        <ArrowRight className="w-5 h-5 transform -rotate-180" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
