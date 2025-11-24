
import React from 'react';
import { PodcastState } from '../types';
import { Mic, Play, Download, XCircle, Maximize, Minimize, CheckCircle } from './icons';
import WaveLoader from './ui/wave-loader';

interface PodcastPlayerProps {
    state: PodcastState;
    onMinimize: () => void;
    onClose: () => void;
}

const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ state, onMinimize, onClose }) => {
    if (state.status === 'idle') return null;

    if (state.isMinimized) {
        return (
            <div className="fixed bottom-6 left-6 z-[300] animate-slide-up">
                <button 
                    onClick={onMinimize} // Toggles minimize
                    className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl border transition-all hover:scale-110 ${
                        state.status === 'ready' 
                            ? 'bg-success text-white border-success ring-4 ring-success/20' 
                            : state.status === 'error'
                                ? 'bg-destructive text-white border-destructive'
                                : 'bg-background border-primary text-primary ring-4 ring-primary/10'
                    }`}
                >
                    {state.status === 'ready' ? <Play className="w-6 h-6" /> : 
                     state.status === 'error' ? <XCircle className="w-6 h-6" /> :
                     <Mic className="w-6 h-6 animate-pulse" />}
                    
                    {/* Status Badge */}
                    {(state.status === 'generating_script' || state.status === 'generating_audio') && (
                        <span className="absolute top-0 right-0 w-3 h-3 bg-orange-500 rounded-full border-2 border-background animate-ping" />
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 left-6 z-[300] w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            {/* Header */}
            <div className="p-3 border-b border-border flex justify-between items-center bg-secondary/20">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${state.status === 'ready' ? 'bg-success' : state.status === 'error' ? 'bg-destructive' : 'bg-orange-500 animate-pulse'}`} />
                    <h3 className="text-sm font-bold">
                        {state.status === 'ready' ? 'پخش کننده پادکست' : 'دستیار صوتی'}
                    </h3>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onMinimize} className="p-1 hover:bg-secondary rounded"><Minimize className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={onClose} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"><XCircle className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4">
                {(state.status === 'generating_script' || state.status === 'generating_audio') && (
                    <div className="flex flex-col items-center justify-center py-4 space-y-4">
                        <WaveLoader className="h-12 text-primary" />
                        <p className="text-xs text-center text-muted-foreground animate-pulse">{state.progressText}</p>
                    </div>
                )}

                {state.status === 'ready' && state.audioUrl && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center mb-2">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-bold text-success">تولید موفقیت‌آمیز بود!</p>
                        </div>
                        
                        <audio controls className="w-full h-8" src={state.audioUrl} autoPlay />
                        
                        <a 
                            href={state.audioUrl} 
                            download="zehngah-podcast.wav" 
                            className="flex items-center justify-center gap-2 w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover"
                        >
                            <Download className="w-4 h-4" />
                            دانلود فایل صوتی
                        </a>
                    </div>
                )}

                {state.status === 'error' && (
                     <div className="text-center py-4 text-destructive">
                         <p className="text-xs font-bold mb-2">خطا در تولید پادکست</p>
                         <p className="text-[10px] opacity-80">{state.progressText}</p>
                         <button onClick={onClose} className="mt-3 text-xs underline">بستن</button>
                     </div>
                )}
            </div>
        </div>
    );
};

export default PodcastPlayer;
