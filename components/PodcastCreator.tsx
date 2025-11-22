
import React, { useState } from 'react';
import { MindMapNode, NodeContent, VoiceName } from '../types';
import { generatePodcastScript, generatePodcastAudio } from '../services/geminiService';
import { XCircle, Mic, Users, User, Play, Download, CheckCircle } from './icons';
import BoxLoader from './ui/box-loader';

interface PodcastCreatorProps {
    selectedNodes: MindMapNode[];
    nodeContents: { [key: string]: NodeContent };
    onClose: () => void;
    onRemoveNode: (id: string) => void;
}

const VOICES: { id: VoiceName; gender: string; style: string }[] = [
    { id: 'Puck', gender: 'مرد', style: 'بم و قوی' },
    { id: 'Charon', gender: 'مرد', style: 'جدی و رسمی' },
    { id: 'Kore', gender: 'زن', style: 'آرام و ملایم' },
    { id: 'Fenrir', gender: 'مرد', style: 'پرانرژی' },
    { id: 'Zephyr', gender: 'زن', style: 'دوستانه' },
];

const PodcastCreator: React.FC<PodcastCreatorProps> = ({ selectedNodes, nodeContents, onClose, onRemoveNode }) => {
    const [mode, setMode] = useState<'monologue' | 'dialogue'>('monologue');
    const [speaker1, setSpeaker1] = useState<VoiceName>('Kore');
    const [speaker2, setSpeaker2] = useState<VoiceName>('Puck');
    const [step, setStep] = useState<'config' | 'generating' | 'playing'>('config');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [progressText, setProgressText] = useState('');

    const handleGenerate = async () => {
        setStep('generating');
        try {
            // 1. Prepare Content
            const validContents = selectedNodes
                .filter(n => nodeContents[n.id])
                .map(n => ({
                    title: n.title,
                    text: `${nodeContents[n.id].introduction}\n${nodeContents[n.id].theory}\n${nodeContents[n.id].conclusion}`
                }));

            if (validContents.length === 0) {
                alert("محتوای متنی برای نودهای انتخاب شده یافت نشد. لطفاً ابتدا وارد درس‌ها شوید تا محتوا تولید شود.");
                setStep('config');
                return;
            }

            setProgressText('در حال نگارش سناریو پادکست...');
            const script = await generatePodcastScript(validContents, mode);

            setProgressText('در حال ضبط استودیویی (هوش مصنوعی)...');
            const url = await generatePodcastAudio(script, speaker1, mode === 'dialogue' ? speaker2 : undefined, mode);
            
            setAudioUrl(url);
            setStep('playing');
        } catch (error) {
            console.error(error);
            alert("خطا در تولید پادکست. لطفاً دوباره تلاش کنید.");
            setStep('config');
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm fade-in">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Mic className="w-5 h-5 text-primary" />
                        ساخت پادکست هوشمند
                    </h2>
                    <button onClick={onClose}><XCircle className="w-6 h-6 text-muted-foreground hover:text-destructive" /></button>
                </div>

                <div className="p-6 flex-grow overflow-y-auto">
                    {step === 'config' && (
                        <div className="space-y-6 animate-slide-up">
                            
                            {/* Selected Nodes */}
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground mb-2">مباحث انتخاب شده ({selectedNodes.length})</h3>
                                <div className="flex flex-wrap gap-2">
                                    {selectedNodes.map(node => (
                                        <div key={node.id} className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                                            <span className="truncate max-w-[150px]">{node.title}</span>
                                            <button onClick={() => onRemoveNode(node.id)} className="hover:text-destructive"><XCircle className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                </div>
                                {selectedNodes.length === 0 && <p className="text-xs text-destructive">لطفاً حداقل یک درس انتخاب کنید.</p>}
                            </div>

                            {/* Mode Selection */}
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground mb-2">نوع پادکست</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => setMode('monologue')}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${mode === 'monologue' ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-secondary'}`}
                                    >
                                        <User className="w-6 h-6" />
                                        <span className="text-xs font-bold">تک‌نفره (سخنرانی)</span>
                                    </button>
                                    <button 
                                        onClick={() => setMode('dialogue')}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${mode === 'dialogue' ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-secondary'}`}
                                    >
                                        <Users className="w-6 h-6" />
                                        <span className="text-xs font-bold">دونفره (گفتگو)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Voice Selection */}
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground mb-2">انتخاب صدا</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">گوینده اول (میزبان)</span>
                                        <select 
                                            value={speaker1} 
                                            onChange={(e) => setSpeaker1(e.target.value as VoiceName)}
                                            className="bg-secondary border border-border rounded-lg px-3 py-1 text-sm"
                                        >
                                            {VOICES.map(v => <option key={v.id} value={v.id}>{v.id} ({v.gender} - {v.style})</option>)}
                                        </select>
                                    </div>
                                    
                                    {mode === 'dialogue' && (
                                        <div className="flex items-center justify-between animate-fade-in">
                                            <span className="text-sm">گوینده دوم (مهمان)</span>
                                            <select 
                                                value={speaker2} 
                                                onChange={(e) => setSpeaker2(e.target.value as VoiceName)}
                                                className="bg-secondary border border-border rounded-lg px-3 py-1 text-sm"
                                            >
                                                {VOICES.map(v => <option key={v.id} value={v.id}>{v.id} ({v.gender} - {v.style})</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in py-10">
                            <BoxLoader size={80} />
                            <p className="text-center text-muted-foreground animate-pulse">{progressText}</p>
                        </div>
                    )}

                    {step === 'playing' && audioUrl && (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-slide-up">
                            <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center text-success ring-8 ring-success/5">
                                <CheckCircle className="w-12 h-12" />
                            </div>
                            <h3 className="text-xl font-bold text-center">پادکست شما آماده است!</h3>
                            
                            <audio controls className="w-full mt-4" src={audioUrl} autoPlay />

                            <div className="flex gap-3 w-full">
                                <a 
                                    href={audioUrl} 
                                    download="zehngah-podcast.wav" 
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover font-bold"
                                >
                                    <Download className="w-5 h-5" />
                                    دانلود
                                </a>
                                <button 
                                    onClick={() => setStep('config')}
                                    className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 font-bold"
                                >
                                    ساخت جدید
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                {step === 'config' && (
                    <div className="p-4 border-t border-border">
                        <button 
                            onClick={handleGenerate} 
                            disabled={selectedNodes.length === 0}
                            className="w-full py-3 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Play className="w-5 h-5" />
                            <span>تولید پادکست</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PodcastCreator;
