
import React, { useState } from 'react';
import { ScenarioState } from '../types';
import { Gamepad, Target, XCircle, ArrowRight, User, BrainCircuit, CheckCircle, Flame } from './icons';
import BoxLoader from './ui/box-loader';
import { motion, AnimatePresence } from 'framer-motion';

interface ScenarioSimulatorProps {
    state: ScenarioState;
    onDecision: (optionId: string) => void;
    onClose: () => void;
}

const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({ state, onDecision, onClose }) => {
    const { targetNode, currentScenario, outcome, isGenerating, isEvaluating } = state;

    if (isGenerating || !currentScenario) {
        return (
            <div className="fixed inset-0 z-[400] bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
                <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                    <Gamepad className="w-20 h-20 text-indigo-400 relative z-10" />
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-2">اتاق فرمان شبیه‌سازی</h2>
                <p className="text-zinc-400 text-sm mb-8">در حال بارگذاری سناریوی: <span className="text-indigo-300">{targetNode.title}</span></p>
                <BoxLoader size={60} color="#818cf8" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[400] bg-zinc-950 text-zinc-100 overflow-hidden font-mono">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/10 bg-black/40 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/50">
                        <User className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                        <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">نقش شما</div>
                        <div className="text-lg font-bold text-white">{currentScenario.role}</div>
                    </div>
                </div>
                <button 
                    onClick={onClose} 
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
                >
                    <XCircle className="w-6 h-6" />
                </button>
            </div>

            {/* Main Area */}
            <div className="relative z-10 container mx-auto max-w-4xl h-[calc(100vh-90px)] flex flex-col p-4 md:p-8 overflow-y-auto">
                
                <AnimatePresence mode="wait">
                    {!outcome ? (
                        <motion.div 
                            key="scenario"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            {/* Situation Card */}
                            <div className="bg-zinc-900/80 border border-zinc-800 p-6 md:p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                                <div className="flex items-start gap-4">
                                    <Target className="w-8 h-8 text-indigo-400 shrink-0 mt-1 animate-pulse" />
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-bold mb-4 text-white">وضعیت اضطراری</h3>
                                        <p className="text-base md:text-lg leading-loose text-zinc-300">
                                            {currentScenario.context}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {currentScenario.options.map((option, idx) => (
                                    <button
                                        key={option.id}
                                        onClick={() => onDecision(option.id)}
                                        disabled={isEvaluating}
                                        className="relative group p-6 bg-zinc-900/50 border border-zinc-800 hover:border-indigo-500/50 rounded-xl text-right transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col h-full"
                                    >
                                        <div className="absolute top-4 left-4 text-zinc-600 text-4xl font-black opacity-20 group-hover:text-indigo-500 group-hover:opacity-40 transition-colors">
                                            {idx + 1}
                                        </div>
                                        <p className="text-sm md:text-base text-zinc-200 font-medium z-10">{option.text}</p>
                                        <div className="mt-auto pt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 text-xs font-bold uppercase tracking-wider">
                                            انتخاب مسیر <ArrowRight className="w-3 h-3 inline-block mr-1 rotate-180" />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {isEvaluating && (
                                <div className="flex items-center justify-center gap-3 text-indigo-400 py-4 animate-pulse">
                                    <BrainCircuit className="w-5 h-5" />
                                    <span>هوش مصنوعی در حال شبیه‌سازی پیامدها...</span>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="outcome"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8"
                        >
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.5)] ${
                                outcome.consequenceLevel === 'positive' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' :
                                outcome.consequenceLevel === 'negative' ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50' :
                                'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                            }`}>
                                {outcome.consequenceLevel === 'positive' ? <CheckCircle className="w-12 h-12" /> :
                                 outcome.consequenceLevel === 'negative' ? <Flame className="w-12 h-12" /> :
                                 <Target className="w-12 h-12" />}
                            </div>

                            <div>
                                <h3 className={`text-3xl font-black mb-2 ${
                                    outcome.consequenceLevel === 'positive' ? 'text-emerald-400' :
                                    outcome.consequenceLevel === 'negative' ? 'text-rose-400' :
                                    'text-amber-400'
                                }`}>
                                    {outcome.consequenceLevel === 'positive' ? 'موفقیت استراتژیک' :
                                     outcome.consequenceLevel === 'negative' ? 'شکست عملیاتی' :
                                     'نتیجه خنثی'}
                                </h3>
                                <div className="w-20 h-1 bg-current mx-auto rounded-full opacity-50 mb-6" />
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-right w-full">
                                <div className="mb-6">
                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-2 tracking-wider">گزارش میدانی</div>
                                    <p className="text-zinc-100 leading-relaxed">{outcome.narrative}</p>
                                </div>
                                <div className="border-t border-zinc-800 pt-6">
                                    <div className="text-xs text-indigo-400 uppercase font-bold mb-2 tracking-wider flex items-center gap-2">
                                        <BrainCircuit className="w-4 h-4" />
                                        تحلیل آموزشی
                                    </div>
                                    <p className="text-zinc-400 text-sm leading-relaxed">{outcome.analysis}</p>
                                </div>
                            </div>

                            <button 
                                onClick={onClose}
                                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform active:scale-95"
                            >
                                بازگشت به درس
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

export default ScenarioSimulator;
