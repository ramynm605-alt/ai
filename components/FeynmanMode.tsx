
import React, { useState, useRef, useEffect } from 'react';
import { FeynmanState } from '../types';
import { Mic, ArrowLeft, CheckCircle, XCircle, Brain } from './icons';
import WaveLoader from './ui/wave-loader';

interface FeynmanModeProps {
    state: FeynmanState;
    onSubmit: (explanation: string, audioBlob?: Blob) => void;
    onClose: () => void;
}

const FeynmanMode: React.FC<FeynmanModeProps> = ({ state, onSubmit, onClose }) => {
    const [mode, setMode] = useState<'text' | 'voice'>('voice');
    const [textInput, setTextInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stop();
            }
        };
    }, [isRecording]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Or 'audio/wav' if preferred/supported
                onSubmit("توضیح صوتی کاربر", audioBlob);
                stream.getTracks().forEach(track => track.stop()); // Stop microphone access
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Microphone access denied", err);
            alert("دسترسی به میکروفون امکان‌پذیر نیست. لطفاً از حالت متنی استفاده کنید.");
            setMode('text');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSubmitText = () => {
        if (textInput.trim()) {
            onSubmit(textInput);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="w-full max-w-lg bg-card border-2 border-orange-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
                
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500" />
                
                {/* Header */}
                <div className="p-6 pb-0 text-center">
                    <div className="w-20 h-20 mx-auto bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4 relative">
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center animate-bounce">?</div>
                        <Brain className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h2 className="text-2xl font-black text-foreground mb-2">یه لحظه صبر کن!</h2>
                    <p className="text-muted-foreground text-sm">
                        من قسمت <span className="text-foreground font-bold">«{state.targetNode.title}»</span> رو درست متوجه نشدم.<br/>
                        میشه با زبون خودت برام توضیح بدی؟
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 flex-grow flex flex-col items-center justify-center min-h-[250px]">
                    
                    {state.isAnalyzing ? (
                        <div className="text-center space-y-4">
                            <WaveLoader className="h-16 scale-150" color="rgb(249, 115, 22)" />
                            <p className="text-orange-600 animate-pulse font-medium">درحال گوش دادن و تحلیل توضیحات شما...</p>
                        </div>
                    ) : state.feedback ? (
                        <div className="w-full space-y-4 animate-slide-up">
                            <div className="bg-secondary/50 border border-border rounded-xl p-4 max-h-[300px] overflow-y-auto markdown-content">
                                <div dangerouslySetInnerHTML={{ __html: state.feedback }} />
                            </div>
                            <button 
                                onClick={onClose}
                                className="w-full py-3 bg-success hover:bg-success/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                <CheckCircle className="w-5 h-5" />
                                <span>حله، بریم ادامه درس</span>
                            </button>
                        </div>
                    ) : (
                        <div className="w-full space-y-6">
                            {/* Mode Switcher */}
                            <div className="flex p-1 bg-secondary/50 rounded-xl mx-auto max-w-[200px]">
                                <button 
                                    onClick={() => setMode('voice')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'voice' ? 'bg-background shadow text-orange-600' : 'text-muted-foreground'}`}
                                >
                                    صوتی 🎙️
                                </button>
                                <button 
                                    onClick={() => setMode('text')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'text' ? 'bg-background shadow text-blue-600' : 'text-muted-foreground'}`}
                                >
                                    متنی ⌨️
                                </button>
                            </div>

                            {mode === 'voice' ? (
                                <div className="text-center">
                                    <button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${isRecording ? 'bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-500/30' : 'bg-orange-500 hover:bg-orange-600'}`}
                                    >
                                        {isRecording ? (
                                            <div className="w-8 h-8 bg-white rounded-sm animate-pulse" />
                                        ) : (
                                            <Mic className="w-10 h-10 text-white" />
                                        )}
                                    </button>
                                    <div className="mt-4 text-2xl font-mono font-bold text-foreground">
                                        {formatTime(recordingTime)}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {isRecording ? 'در حال ضبط... (ضربه بزنید تا تمام شود)' : 'ضربه بزنید و توضیح دهید'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <textarea 
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        placeholder="توضیح خود را اینجا بنویسید... (مثل اینکه دارید به یک دوست یاد می‌دهید)"
                                        className="w-full h-40 p-4 rounded-xl bg-background border border-border focus:ring-2 focus:ring-orange-500 resize-none"
                                    />
                                    <button 
                                        onClick={handleSubmitText}
                                        disabled={!textInput.trim()}
                                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                                    >
                                        ارسال توضیح
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!state.isAnalyzing && !state.feedback && (
                    <button onClick={onClose} className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors">
                        <XCircle className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default FeynmanMode;
