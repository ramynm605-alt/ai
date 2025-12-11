
import React, { useState } from 'react';
import { HandoutConfig } from '../types';
import { FileText, SlidersHorizontal, CheckCircle, Wand, XCircle } from './icons';

interface HandoutWizardProps {
    onGenerate: (config: HandoutConfig) => void;
    onClose: () => void;
}

const HandoutWizard: React.FC<HandoutWizardProps> = ({ onGenerate, onClose }) => {
    const [config, setConfig] = useState<HandoutConfig>({
        detailLevel: 'standard',
        style: 'academic',
        includeExamples: true,
        includeQuiz: true
    });

    const updateConfig = (key: keyof HandoutConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-border bg-primary/5 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="w-6 h-6 text-primary" />
                        تنظیمات تولید جزوه
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Detail Level */}
                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-3">سطح جزئیات</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'summary', label: 'خلاصه مرور' },
                                { id: 'standard', label: 'استاندارد' },
                                { id: 'comprehensive', label: 'جامع و کامل' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => updateConfig('detailLevel', opt.id)}
                                    className={`py-3 px-2 rounded-xl text-xs font-bold border-2 transition-all ${config.detailLevel === opt.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Style */}
                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-3">سبک نگارش</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'academic', label: 'رسمی (کتابی)' },
                                { id: 'casual', label: 'خودمانی' },
                                { id: 'bullet-points', label: 'تیتروار (نکته‌ای)' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => updateConfig('style', opt.id)}
                                    className={`py-3 px-2 rounded-xl text-xs font-bold border-2 transition-all ${config.style === opt.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-secondary/30 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={config.includeExamples} 
                                onChange={(e) => updateConfig('includeExamples', e.target.checked)}
                                className="w-5 h-5 text-primary rounded focus:ring-primary"
                            />
                            <span className="text-sm font-medium">شامل مثال‌های کاربردی</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-secondary/30 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={config.includeQuiz} 
                                onChange={(e) => updateConfig('includeQuiz', e.target.checked)}
                                className="w-5 h-5 text-primary rounded focus:ring-primary"
                            />
                            <span className="text-sm font-medium">افزودن آزمون کوتاه در انتهای جزوه</span>
                        </label>
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-secondary/10">
                    <button 
                        onClick={() => onGenerate(config)}
                        className="w-full py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Wand className="w-5 h-5" />
                        <span>تولید جزوه هوشمند</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HandoutWizard;
