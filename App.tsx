
import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useAppActions } from './hooks/useAppActions';
import { AppStatus, UserProfile } from './types';
import { FirebaseService } from './services/firebaseService';
import { Home, MessageSquare, Mic, User, SlidersHorizontal, ChevronLeft, ChevronRight, Brain, Save, Upload, CheckCircle, XCircle, Play, ArrowRight } from './components/icons';
import BoxLoader from './components/ui/box-loader';
import StartupScreen from './components/StartupScreen';
import ParticleBackground from './components/ParticleBackground';
import { Sidebar, SidebarBody, SidebarLink } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';
import MainContent from './components/MainContent';

// Lazy Load Overlays
const WeaknessTracker = React.lazy(() => import('./components/WeaknessTracker'));
const PracticeZone = React.lazy(() => import('./components/PracticeZone'));
const ChatPanel = React.lazy(() => import('./components/ChatPanel'));
const DailyBriefing = React.lazy(() => import('./components/DailyBriefing'));
const UserPanel = React.lazy(() => import('./components/UserPanel'));
const DebugPanel = React.lazy(() => import('./components/DebugPanel'));
const PodcastCreator = React.lazy(() => import('./components/PodcastCreator'));
const PodcastPlayer = React.lazy(() => import('./components/PodcastPlayer'));
const FeynmanMode = React.lazy(() => import('./components/FeynmanMode'));

const NotificationToast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [message, onClose]);
    const isError = type === 'error';
    return (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[10000] bg-card border shadow-2xl rounded-xl px-4 py-3 flex items-center gap-3 animate-slide-up ${isError ? 'border-destructive/50' : 'border-border'}`}>
            <div className={`p-1.5 rounded-full ${isError ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                {isError ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <span className="text-sm font-bold text-foreground">{message}</span>
        </div>
    );
}

const AppLayout = () => {
    const { state, dispatch } = useApp();
    const [showStartup, setShowStartup] = useState(true);
    const [isDebugOpen, setIsDebugOpen] = useState(false);
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isToolboxOpen, setIsToolboxOpen] = useState(true);
    const [logoClickCount, setLogoClickCount] = useState(0);
    
    // New local state for Podcast flow
    const [showPodcastWizard, setShowPodcastWizard] = useState(false);

    const showNotification = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message: msg, type });
    }, []);

    const actions = useAppActions(showNotification);

    useEffect(() => {
        if (state.error) showNotification(state.error, 'error');
    }, [state.error, showNotification]);

    useEffect(() => {
        // Automatically close sidebar when entering podcast selection mode
        if (state.isPodcastMode) {
            setSidebarOpen(false);
            setShowPodcastWizard(false); // Reset wizard state when mode starts
        }
    }, [state.isPodcastMode]);

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', storedTheme);
        dispatch({ type: 'SET_THEME', payload: storedTheme });

        const storedUser = localStorage.getItem('zehngah_current_user');
        if (storedUser) {
            try {
                const user: UserProfile = JSON.parse(storedUser);
                dispatch({ type: 'SET_USER', payload: user });
                const storedSessions = localStorage.getItem(`zehngah_sessions_${user.id}`);
                if (storedSessions) {
                    dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: JSON.parse(storedSessions) });
                }
            } catch (e: any) {
                console.error("Error parsing stored user", e);
            }
        }
        FirebaseService.initialize();
    }, [dispatch]);

    // Debug Mode Trigger
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'x') {
                setIsDebugOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleLogoClick = () => {
        const newCount = logoClickCount + 1;
        setLogoClickCount(newCount);
        if (newCount >= 5) {
            setIsDebugOpen(true);
            showNotification("حالت اشکال‌زدایی فعال شد");
            setLogoClickCount(0);
        }
    };

    const handleThemeToggle = () => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        dispatch({ type: 'SET_THEME', payload: newTheme });
    };

    const links = [
        {
            label: "خانه",
            href: "#",
            icon: <Home className="text-foreground h-5 w-5 flex-shrink-0" />,
            onClick: () => {
                if (state.status === AppStatus.IDLE) {
                    showNotification('شما در صفحه خانه حضور دارید', 'error');
                } else {
                    dispatch({ type: 'RESET' });
                }
            }
        },
        {
            label: "مربی هوشمند",
            href: "#",
            icon: <MessageSquare className="text-foreground h-5 w-5 flex-shrink-0" />,
            onClick: () => dispatch({ type: 'TOGGLE_CHAT' })
        },
        {
            label: "ساخت پادکست",
            href: "#",
            icon: <Mic className="text-foreground h-5 w-5 flex-shrink-0" />,
            onClick: () => {
                 if (state.status !== AppStatus.LEARNING && state.status !== AppStatus.VIEWING_NODE) {
                     showNotification('لطفاً ابتدا وارد مسیر یادگیری شوید.', 'error');
                 } else {
                     actions.togglePodcastMode(); 
                 }
            }
        },
        {
            label: "پروفایل من",
            href: "#",
            icon: <User className="text-foreground h-5 w-5 flex-shrink-0" />,
            onClick: () => dispatch({ type: 'TOGGLE_USER_PANEL' })
        }
    ];

    const ToolboxContent = () => (
        <div className="w-full h-full flex flex-col">
          <div className="p-4 border-b border-border font-bold text-foreground flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5" />
                  <span>جعبه ابزار</span>
              </div>
              <button 
                  onClick={() => setIsToolboxOpen(false)}
                  className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground lg:hidden"
              >
                  <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
               <button 
                  onClick={() => setIsToolboxOpen(false)}
                  className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground hidden lg:block"
              >
                  <ChevronLeft className="w-5 h-5" />
              </button>
          </div>
          <div className="flex-grow overflow-y-auto p-2">
                  <Suspense fallback={<BoxLoader size={30} />}>
                      <WeaknessTracker weaknesses={state.weaknesses} />
                      <div className="h-px bg-border my-2 mx-4"></div>
                      <PracticeZone />
                  </Suspense>
          </div>
      </div>
    );

    return (
        <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-background text-foreground overflow-hidden font-vazir transition-colors duration-300" dir="rtl">
            {showStartup && <StartupScreen onAnimationEnd={() => setShowStartup(false)} />}
            <ParticleBackground theme={state.theme} />
            
            <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center z-[2000]"><BoxLoader size={150} /></div>}>
                {notification && <NotificationToast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
                
                {isDebugOpen && <DebugPanel state={state} dispatch={dispatch} onClose={() => setIsDebugOpen(false)} onNotify={showNotification} />}
                
                {state.showDailyBriefing && (
                    <DailyBriefing 
                        streak={state.behavior.dailyStreak}
                        challengeContent={state.dailyChallengeContent}
                        nextNode={state.mindMap.find(n => state.userProgress[n.id]?.status !== 'completed' && !n.locked) || null}
                        onContinue={() => dispatch({ type: 'DISMISS_BRIEFING' })}
                        onDismiss={() => dispatch({ type: 'DISMISS_BRIEFING' })}
                    />
                )}

                {/* FEYNMAN CHALLENGE MODE UI */}
                {state.status === AppStatus.FEYNMAN_CHALLENGE && state.feynmanState && (
                    <FeynmanMode 
                        state={state.feynmanState}
                        onSubmit={actions.submitFeynmanExplanation}
                        onClose={() => dispatch({ type: 'CLOSE_FEYNMAN' })}
                    />
                )}

                {/* Podcast UI Flow */}
                <AnimatePresence>
                {state.isPodcastMode && state.podcastConfig && (
                    <div className="relative z-[100]">
                         {/* Phase 1: Selection Floating Bar */}
                         {!showPodcastWizard && (
                             <motion.div 
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[150] w-full max-w-lg px-4"
                             >
                                 <div className="glass-panel p-4 rounded-2xl flex items-center justify-between shadow-2xl border border-primary/20 bg-background/80 backdrop-blur-md">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary animate-pulse">
                                              <Mic className="w-5 h-5" />
                                          </div>
                                          <div>
                                              <p className="text-sm font-bold">انتخاب محتوای پادکست</p>
                                              <p className="text-xs text-muted-foreground">
                                                  {state.podcastConfig.selectedNodeIds.length > 0 
                                                    ? `${state.podcastConfig.selectedNodeIds.length} درس انتخاب شده` 
                                                    : 'روی درس‌ها کلیک کنید'}
                                              </p>
                                          </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                          <button 
                                            onClick={() => dispatch({ type: 'TOGGLE_PODCAST_MODE' })}
                                            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                          >
                                              <XCircle className="w-6 h-6" />
                                          </button>
                                          <button 
                                            onClick={() => setShowPodcastWizard(true)}
                                            disabled={state.podcastConfig.selectedNodeIds.length === 0}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow-lg hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                          >
                                              <span>ادامه</span>
                                              <ArrowRight className="w-4 h-4 rotate-180" />
                                          </button>
                                      </div>
                                 </div>
                             </motion.div>
                         )}

                         {/* Phase 2: Configuration Wizard */}
                         {showPodcastWizard && (
                              <PodcastCreator 
                                  selectedNodes={state.mindMap.filter(n => state.podcastConfig!.selectedNodeIds.includes(n.id))}
                                  onClose={() => setShowPodcastWizard(false)} // Go back to selection
                                  onRemoveNode={(id) => dispatch({ type: 'TOGGLE_PODCAST_NODE_SELECTION', payload: id })}
                                  onStartGeneration={actions.startPodcastGeneration}
                              />
                         )}
                    </div>
                )}
                </AnimatePresence>

                <PodcastPlayer state={state.podcastState} onMinimize={() => dispatch({ type: 'UPDATE_PODCAST_STATE', payload: { isMinimized: !state.podcastState.isMinimized } })} onClose={() => dispatch({ type: 'UPDATE_PODCAST_STATE', payload: { status: 'idle' } })} />

                <UserPanel 
                    isOpen={state.isUserPanelOpen}
                    onClose={() => dispatch({ type: 'TOGGLE_USER_PANEL' })}
                    user={state.currentUser}
                    onLogin={actions.handleLogin}
                    onLogout={actions.handleLogout}
                    savedSessions={state.savedSessions}
                    onLoadSession={actions.handleLoadSession}
                    onDeleteSession={actions.handleDeleteSession}
                    onSaveCurrentSession={(title) => actions.handleSaveSession(title, false)}
                    hasCurrentSession={state.mindMap.length > 0}
                    onExportData={actions.handleExportUserData}
                    onImportData={actions.handleImportUserData}
                    cloudStatus={state.cloudSyncStatus}
                    lastSyncTime={state.cloudLastSync}
                    onEnableCloudSync={actions.handleEnableCloudSync}
                />

                <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
                    <SidebarBody className="justify-between gap-10">
                        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                            <div className="flex flex-col gap-2">
                                <div onClick={handleLogoClick} className="flex items-center gap-2 font-black text-lg text-foreground py-2 cursor-pointer mb-4">
                                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                        <Brain className="w-5 h-5 text-primary-foreground" />
                                    </div>
                                    <motion.span initial={{ opacity: 0 }} animate={{ display: sidebarOpen ? "inline-block" : "none", opacity: sidebarOpen ? 1 : 0 }} className="font-extrabold tracking-tight whitespace-pre">ذهن گاه</motion.span>
                                </div>
                                {links.map((link, idx) => <SidebarLink key={idx} link={link} />)}
                            </div>
                        </div>
                        <div className="flex flex-col gap-4">
                             <div className="flex justify-center md:justify-start px-2">
                                <ThemeToggle theme={state.theme} onToggle={handleThemeToggle} className={!sidebarOpen ? "w-8 h-4" : ""} />
                             </div>
                             {state.currentUser ? (
                                <SidebarLink link={{ label: state.currentUser.name, href: "#", icon: state.currentUser.avatarUrl ? <img src={state.currentUser.avatarUrl} className="h-7 w-7 rounded-full" alt="Avatar" /> : <div className="h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold" style={{ backgroundColor: state.currentUser.avatarColor }}>{state.currentUser.name.charAt(0).toUpperCase()}</div>, onClick: () => dispatch({ type: 'TOGGLE_USER_PANEL' }) }} />
                             ) : (
                                 <SidebarLink link={{ label: "ورود به حساب", href: "#", icon: <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center"><User className="w-4 h-4" /></div>, onClick: () => dispatch({ type: 'TOGGLE_USER_PANEL' }) }} />
                             )}
                             {state.isAutoSaving && <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse px-2"><Save className="w-3 h-3" /><motion.span animate={{ display: sidebarOpen ? "inline-block" : "none" }}>ذخیره خودکار...</motion.span></div>}
                             {state.cloudSyncStatus === 'syncing' && <div className="flex items-center gap-2 text-xs text-blue-500 animate-pulse px-2"><Upload className="w-3 h-3" /><motion.span animate={{ display: sidebarOpen ? "inline-block" : "none" }}>همگام‌سازی...</motion.span></div>}
                        </div>
                    </SidebarBody>
                </Sidebar>

                <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
                    <MainContent actions={actions} />
                    
                    <motion.div className="hidden lg:flex flex-col border-r border-border bg-card/50 backdrop-blur-sm shrink-0 relative z-10 overflow-hidden transition-all h-full" initial={{ width: 320, opacity: 1 }} animate={{ width: isToolboxOpen ? 320 : 0, opacity: isToolboxOpen ? 1 : 0 }}>
                        <div className="w-[20rem] h-full"><ToolboxContent /></div>
                    </motion.div>

                    <AnimatePresence>
                        {isToolboxOpen && (
                            <>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsToolboxOpen(false)} className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" style={{ touchAction: 'none' }} />
                                <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} className="lg:hidden fixed top-0 left-0 bottom-0 w-80 max-w-[85%] bg-card border-r border-border z-[70] shadow-2xl h-[100dvh] overflow-hidden">
                                    <ToolboxContent />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                    <AnimatePresence>
                    {!isToolboxOpen && (
                        <motion.div className="absolute left-0 bottom-8 z-50" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}>
                            <button onClick={() => setIsToolboxOpen(true)} className="flex items-center gap-2 bg-card border border-border border-l-0 rounded-r-xl p-3 shadow-lg hover:bg-secondary transition-all group">
                                <SlidersHorizontal className="w-5 h-5 text-primary" />
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary hidden lg:block" />
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary lg:hidden rotate-180" />
                            </button>
                        </motion.div>
                    )}
                    </AnimatePresence>

                    {state.isChatOpen && (
                        <ChatPanel 
                            history={state.chatHistory} 
                            isFullScreen={state.isChatFullScreen} 
                            isDebateMode={state.isDebateMode} 
                            chatPersona={state.chatPersona}
                            isThinking={state.isChatLoading} 
                            initialMessage=""
                            onSend={actions.handleChatSend} 
                            onClose={() => dispatch({ type: 'TOGGLE_CHAT' })}
                            onToggleFullScreen={() => dispatch({ type: 'TOGGLE_FULLSCREEN_CHAT' })}
                            onToggleDebateMode={() => dispatch({ type: 'TOGGLE_DEBATE_MODE' })} 
                            onInitialMessageConsumed={() => {}}
                            onInitiateDebate={actions.handleDebateInitiation}
                            onSetPersona={(persona) => dispatch({ type: 'SET_CHAT_PERSONA', payload: persona })}
                            onNodeSelect={actions.handleNodeNavigate} 
                        />
                    )}
                </main>
            </Suspense>
        </div>
    );
};

const App = () => (
    <AppProvider>
        <AppLayout />
    </AppProvider>
);

export default App;
