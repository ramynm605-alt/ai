
import React, { useState } from 'react';
import { AppState, AppStatus, NodeProgress } from '../types';
import { XCircle, Trash, CheckCircle, Shield, Diamond, Target, Flame } from './icons';

interface DebugPanelProps {
    state: AppState;
    dispatch: React.Dispatch<any>;
    onClose: () => void;
    onNotify: (msg: string) => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ state, dispatch, onClose, onNotify }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'nodes' | 'user'>('general');

    const handleUnlockAll = () => {
        const newMindMap = state.mindMap.map(node => ({ ...node, locked: false }));
        dispatch({ type: 'DEBUG_UPDATE', payload: { mindMap: newMindMap } });
        onNotify("تمام درس‌ها باز شدند");
    };

    const handleResetProgress = () => {
        const newMindMap = state.mindMap.map(node => ({ ...node, locked: !!node.parentId }));
        dispatch({ 
            type: 'DEBUG_UPDATE', 
            payload: { 
                userProgress: {}, 
                mindMap: newMindMap, 
                activeNodeId: null, 
                status: AppStatus.LEARNING 
            } 
        });
        onNotify("پیشرفت کاربر ریست شد");
    };

    const handleForceCompleteActive = () => {
        if (!state.activeNodeId) {
            onNotify("هیچ درسی انتخاب نشده است");
            return;
        }
        const current = state.userProgress[state.activeNodeId] || { attempts: 0, proficiency: 0, explanationCount: 0, lastAttemptScore: 0 };
        const newProgress = { 
            ...state.userProgress, 
            [state.activeNodeId]: { ...current, status: 'completed' as const, proficiency: 1, lastAttemptScore: 100 } 
        };
        const newMindMap = state.mindMap.map(node => node.parentId === state.activeNodeId ? { ...node, locked: false } : node);
        dispatch({ 
            type: 'DEBUG_UPDATE', 
            payload: { 
                userProgress: newProgress, 
                mindMap: newMindMap,
                status: AppStatus.LEARNING 
            } 
        });
        onNotify("درس با موفقیت پاس شد");
    };

    const handleForceFailActive = () => {
        if (!state.activeNodeId) {
             onNotify("هیچ درسی انتخاب نشده است");
            return;
        }
        const current = state.userProgress[state.activeNodeId] || { attempts: 0, proficiency: 0, explanationCount: 0, lastAttemptScore: 0 };
        const newProgress = { 
            ...state.userProgress, 
            [state.activeNodeId]: { ...current, status: 'failed' as const, proficiency: 0.4, lastAttemptScore: 40 } 
        };
        dispatch({ type: 'DEBUG_UPDATE', payload: { userProgress: newProgress } });
        onNotify("درس مردود شد");
    };

    const handleAddDiamond = () => {
        if(!state.activeNodeId) {
            onNotify("هیچ درسی انتخاب نشده است");
            return;
        }
        const reward = {
            id: `debug_reward_${Date.now()}`,
            type: 'deep_analysis' as const,
            title: 'پاداش تست دیباگ',
            content: '### محتوای محرمانه\nاین یک پاداش تست است که توسط پنل ادمین ایجاد شده.\n\n* نکته ۱: این یک تست است.\n* نکته ۲: سیستم پاداش کار می‌کند.',
            unlockedAt: new Date().toISOString(),
            relatedNodeId: state.activeNodeId
        };
        dispatch({ type: 'UNLOCK_REWARD', payload: reward });
        onNotify("پاداش الماس اضافه شد");
    };

    const handleSetGrit = (val: number) => {
        dispatch({ type: 'DEBUG_UPDATE', payload: { behavior: { ...state.behavior, gritScore: val } } });
    };

    const handleSetStreak = (val: number) => {
        dispatch({ type: 'DEBUG_UPDATE', payload: { behavior: { ...state.behavior, dailyStreak: val } } });
    };

    const tabClass = (tab: string) => `flex-1 py-2 text-sm font-bold text-center transition-colors border-b-2 ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;

    return (
        <div className="fixed bottom-4 left-4 right-4 sm:right-auto z-[9999] sm:w-96 max-h-[80vh] bg-black/90 backdrop-blur-md text-white border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden font-mono text-xs animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-2 text-red-400">
                    <Shield className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider">Debug Console</span>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white"><XCircle className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-900/50">
                <button onClick={() => setActiveTab('general')} className={tabClass('general')}>General</button>
                <button onClick={() => setActiveTab('nodes')} className={tabClass('nodes')}>Nodes</button>
                <button onClick={() => setActiveTab('user')} className={tabClass('user')}>User</button>
            </div>

            {/* Content */}
            <div className="p-4 flex-grow overflow-y-auto space-y-4">
                
                {activeTab === 'general' && (
                    <div className="space-y-3">
                        <div className="p-2 bg-gray-800 rounded">
                            <div className="text-gray-400 mb-1">Current State:</div>
                            <div className="font-bold text-green-400">{state.status}</div>
                        </div>
                        <button onClick={handleResetProgress} className="w-full flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-bold">
                            <Trash className="w-4 h-4" />
                            Reset All Progress
                        </button>
                         <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-gray-800 rounded text-center">
                                <div className="text-gray-500">Nodes</div>
                                <div className="text-lg font-bold">{state.mindMap.length}</div>
                            </div>
                            <div className="p-2 bg-gray-800 rounded text-center">
                                <div className="text-gray-500">Weaknesses</div>
                                <div className="text-lg font-bold">{state.weaknesses.length}</div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'nodes' && (
                    <div className="space-y-3">
                         <button onClick={handleUnlockAll} className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold">
                            Unlock All Nodes (God Mode)
                        </button>
                        
                        <div className="h-px bg-gray-700 my-2"></div>
                        
                        <div className="text-gray-400 mb-1">Active Node Actions:</div>
                        {state.activeNodeId ? (
                            <div className="space-y-2">
                                <div className="text-xs text-yellow-400 truncate mb-2">ID: {state.activeNodeId}</div>
                                <button onClick={handleForceCompleteActive} className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-bold">
                                    <CheckCircle className="w-4 h-4" />
                                    Force Complete (Pass)
                                </button>
                                <button onClick={handleForceFailActive} className="w-full flex items-center justify-center gap-2 py-2 bg-orange-600 hover:bg-orange-700 rounded text-white font-bold">
                                    <XCircle className="w-4 h-4" />
                                    Force Fail (Remedial)
                                </button>
                                <button onClick={handleAddDiamond} className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-bold">
                                    <Diamond className="w-4 h-4" />
                                    Unlock Reward (Diamond)
                                </button>
                            </div>
                        ) : (
                            <div className="text-center text-gray-600 italic py-4">No active node selected. Click on a node in background to select it.</div>
                        )}
                    </div>
                )}

                {activeTab === 'user' && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-400">Grit Score (Perseverance)</span>
                                <span className="font-bold text-yellow-400">{state.behavior.gritScore}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="20" 
                                value={state.behavior.gritScore} 
                                onChange={(e) => handleSetGrit(parseInt(e.target.value))}
                                className="w-full accent-yellow-500" 
                            />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-400">Daily Streak</span>
                                <span className="font-bold text-orange-400">{state.behavior.dailyStreak}</span>
                            </div>
                             <input 
                                type="range" 
                                min="0" max="100" 
                                value={state.behavior.dailyStreak} 
                                onChange={(e) => handleSetStreak(parseInt(e.target.value))}
                                className="w-full accent-orange-500" 
                            />
                        </div>
                        <div className="h-px bg-gray-700"></div>
                         <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-400" />
                            <span>Goal: {state.preferences.learningGoal || 'None'}</span>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default DebugPanel;
