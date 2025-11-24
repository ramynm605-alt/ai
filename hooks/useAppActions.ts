
import React, { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { AppStatus, ChatMessage, PodcastConfig, PodcastState, QuizResult, Reward, SavableState, SavedSession, UserAnswer, UserBehavior, UserProfile, Weakness, LearningPreferences, LearningResource, Flashcard, FlashcardGrade } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { generateChatResponse, generateDailyChallenge, generateDeepAnalysis, generateLearningPlan, generateNodeContent, generatePodcastAudio, generatePodcastScript, generateProactiveChatInitiation, generateQuiz, generateRemedialNode, gradeAndAnalyzeQuiz, analyzePreAssessment, analyzeResourceContent, evaluateFeynmanExplanation, generateFlashcards, generateCoachQuestion } from '../services/geminiService';

declare var pdfjsLib: any;

export const useAppActions = (showNotification: (msg: string, type?: 'success' | 'error' | 'coach') => void) => {
    const { state, dispatch } = useApp();

    // Helper: Promise with Timeout
    const withTimeout = (promise: Promise<any>, ms: number) => {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
        return Promise.race([promise, timeout]);
    };

    // --- Helpers for Cloud Sync ---
    const handleCloudLoad = useCallback(async (userId: string) => {
       dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'syncing' } });
       try {
           // Race cloud fetch with 10s timeout
           const cloudData = (await withTimeout(FirebaseService.loadUserData(userId), 10000)) as any;
           
           if (cloudData && cloudData.sessions) {
                const cloudTime = new Date(cloudData.lastModified || 0).getTime();
                const storedSessionsString = localStorage.getItem(`zehngah_sessions_${userId}`);
                let localTime = 0;
                let localSessions: SavedSession[] = [];
                
                if (storedSessionsString) {
                    localSessions = JSON.parse(storedSessionsString);
                    if (localSessions.length > 0) {
                        localTime = Math.max(...localSessions.map(s => new Date(s.lastModified).getTime()));
                    }
                }

                if (cloudTime > localTime) {
                    dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: cloudData.sessions });
                    localStorage.setItem(`zehngah_sessions_${userId}`, JSON.stringify(cloudData.sessions));
                    if (cloudData.behavior) {
                         dispatch({ type: 'DEBUG_UPDATE', payload: { behavior: cloudData.behavior } });
                         localStorage.setItem(`zehngah_behavior_${userId}`, JSON.stringify(cloudData.behavior));
                    }
                    dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'success', lastSync: cloudData.lastModified } });
                    showNotification("اطلاعات شما با نسخه ابری به‌روز شد.");
                } else {
                     dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'success', lastSync: cloudData.lastModified } });
                }
           } else {
                // No cloud data or load failed gracefully
                dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'idle' } });
           }
       } catch (e: any) {
           console.error("Cloud Load Error", e);
           // If timeout or error, fallback to idle/error status
           dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'error' } });
       }
    }, [dispatch, showNotification]);

    const handleCloudSave = useCallback(async (userId: string, sessions: SavedSession[], behavior: UserBehavior) => {
        dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'syncing' } });
        try {
            const timestamp = new Date().toISOString();
            const dataToSave = { sessions, behavior, lastModified: timestamp };
            
            // Reduced timeout to 8s to prevent long hangs
            const success = await withTimeout(FirebaseService.saveUserData(userId, dataToSave), 8000);
            
            if (success) {
                dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'success', lastSync: timestamp } });
            } else {
                 dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'error' } });
            }
        } catch (e: any) {
             console.error("Cloud Save Error", e);
             dispatch({ type: 'SET_CLOUD_STATUS', payload: { status: 'error' } });
        }
    }, [dispatch]);

    // --- Authentication Actions ---
    const handleLogin = async (user: UserProfile) => {
        localStorage.setItem('zehngah_current_user', JSON.stringify(user));
        dispatch({ type: 'SET_USER', payload: user });
        const storedSessions = localStorage.getItem(`zehngah_sessions_${user.id}`);
        if (storedSessions) {
            dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: JSON.parse(storedSessions) });
        } else {
            dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: [] });
        }
        showNotification(`خوش آمدید، ${user.name}`);
        await handleCloudLoad(user.id);
    };

    const handleLogout = () => {
        localStorage.removeItem('zehngah_current_user');
        dispatch({ type: 'LOGOUT' });
        showNotification("با موفقیت خارج شدید");
    };

    // --- Session Management ---
    const handleSaveSession = useCallback(async (title: string, isAutoSave = false) => {
        if (!state.currentUser) return;
        
        if (isAutoSave) dispatch({ type: 'SET_AUTO_SAVING', payload: true });

        const sessionData: SavableState = {
            version: 7, // Current Version
            resources: state.resources,
            sourceContent: state.sourceContent,
            sourcePageContents: state.sourcePageContents,
            sourceImages: state.sourceImages,
            preferences: state.preferences,
            mindMap: state.mindMap,
            suggestedPath: state.suggestedPath,
            preAssessmentAnalysis: state.preAssessmentAnalysis,
            nodeContents: state.nodeContents,
            userProgress: state.userProgress,
            weaknesses: state.weaknesses,
            behavior: state.behavior,
            rewards: state.rewards,
            chatHistory: state.chatHistory,
            flashcards: state.flashcards // SAVE FLASHCARDS
        };
        
        const totalNodes = state.mindMap.length;
        const completedNodes = Object.values(state.userProgress).filter(p => p.status === 'completed').length;
        const progress = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

        let newSessions = [...state.savedSessions];
        let sessionId = state.currentSessionId;
        const now = new Date().toISOString();

        if (sessionId) {
            const index = newSessions.findIndex(s => s.id === sessionId);
            if (index !== -1) {
                newSessions[index] = {
                    ...newSessions[index],
                    lastModified: now,
                    progressPercentage: progress,
                    data: sessionData,
                    title: (title && !isAutoSave) ? title : newSessions[index].title
                };
            } else {
                sessionId = null;
            }
        }
        
        if (!sessionId) {
            sessionId = Math.random().toString(36).substr(2, 9);
            const newSession: SavedSession = {
              id: sessionId,
              userId: state.currentUser.id,
              title: title || `جلسه ${new Date().toLocaleDateString('fa-IR')}`,
              lastModified: now,
              progressPercentage: progress,
              topic: state.mindMap[0]?.title || 'بدون عنوان',
              data: sessionData
            };
            newSessions = [newSession, ...newSessions];
            dispatch({ type: 'SET_CURRENT_SESSION_ID', payload: sessionId });
        }

        localStorage.setItem(`zehngah_sessions_${state.currentUser.id}`, JSON.stringify(newSessions));
        dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: newSessions });

        // Fire and forget cloud save, but handle state updates correctly
        handleCloudSave(state.currentUser.id, newSessions, state.behavior);

        if (isAutoSave) {
            setTimeout(() => {
                dispatch({ type: 'SET_AUTO_SAVING', payload: false });
            }, 800);
        }
    }, [state, dispatch, handleCloudSave]);

    const handleDeleteSession = (sessionId: string) => {
         if (!state.currentUser) return;
         const newSessions = state.savedSessions.filter(s => s.id !== sessionId);
         localStorage.setItem(`zehngah_sessions_${state.currentUser.id}`, JSON.stringify(newSessions));
         dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: newSessions });
         handleCloudSave(state.currentUser.id, newSessions, state.behavior);
         if (state.currentSessionId === sessionId) {
             dispatch({ type: 'SET_CURRENT_SESSION_ID', payload: null });
         }
    };

    const handleLoadSession = (session: SavedSession) => {
        if (!session || !session.data) {
            dispatch({ type: 'SET_ERROR', payload: 'خطا: داده‌های این جلسه خالی است.' });
            return;
        }
        dispatch({ type: 'LOAD_STATE', payload: session.data, sessionId: session.id });
    };

    const handleExportUserData = (): string => {
        if (!state.currentUser) return '';
        const userData = {
            user: state.currentUser,
            sessions: state.savedSessions,
            behavior: state.behavior
        };
        return btoa(unescape(encodeURIComponent(JSON.stringify(userData))));
    };

    const handleImportUserData = (importString: string) => {
        try {
            const decoded = decodeURIComponent(escape(atob(importString)));
            const userData = JSON.parse(decoded);
            
            if (!userData.user || !userData.sessions) throw new Error("فرمت نامعتبر");
            
            localStorage.setItem('zehngah_current_user', JSON.stringify(userData.user));
            dispatch({ type: 'SET_USER', payload: userData.user });

            localStorage.setItem(`zehngah_sessions_${userData.user.id}`, JSON.stringify(userData.sessions));
            dispatch({ type: 'UPDATE_SAVED_SESSIONS', payload: userData.sessions });
            
            if (userData.behavior) {
               localStorage.setItem(`zehngah_behavior_${userData.user.id}`, JSON.stringify(userData.behavior));
            }
            
            handleCloudSave(userData.user.id, userData.sessions, userData.behavior || state.behavior);

            return true;
        } catch (e: any) {
            console.error("Import failed", e);
            return false;
        }
    };

    // --- Resource Processing ---
    const processResource = async (resource: LearningResource) => {
        try {
            dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, updates: { isProcessing: true } } });
            
            const rawText = resource.content;
            const media = resource.metadata?.data ? { mimeType: resource.metadata.mimeType, data: resource.metadata.data } : null;

            const analysis = await analyzeResourceContent(
                resource.title, 
                rawText, 
                media, 
                resource.type,
                resource.metadata 
            );
            
            dispatch({ 
                type: 'UPDATE_RESOURCE', 
                payload: { 
                    id: resource.id, 
                    updates: { 
                        isProcessing: false,
                        content: analysis.extractedText, 
                        validation: analysis.validation
                    } 
                } 
            });
            showNotification(`منبع "${resource.title}" تحلیل شد.`, 'success');
        } catch (error) {
            console.error("Resource processing failed", error);
             dispatch({ 
                type: 'UPDATE_RESOURCE', 
                payload: { 
                    id: resource.id, 
                    updates: { 
                        isProcessing: false,
                        validation: {
                            isValid: false,
                            qualityScore: 0,
                            issues: ["خطا در پردازش هوشمند منبع"],
                            summary: "امکان تحلیل این فایل وجود نداشت."
                        }
                    } 
                } 
            });
            showNotification(`خطا در تحلیل منبع "${resource.title}".`, 'error');
        }
    };

    const addResource = (resource: LearningResource) => {
        if (state.resources.length >= 5) {
            showNotification("ظرفیت منابع (۵ عدد) تکمیل شده است.", "error");
            return;
        }
        dispatch({ type: 'ADD_RESOURCE', payload: { ...resource, isProcessing: true } });
        processResource(resource); 
    };

    const handleUpdateResourceContent = (id: string, newContent: string) => {
         dispatch({ type: 'UPDATE_RESOURCE', payload: { id, updates: { content: newContent } } });
    };

    const handleUpdateResourceInstructions = (id: string, instructions: string) => {
        dispatch({ type: 'UPDATE_RESOURCE', payload: { id, updates: { instructions } } });
    };

    const handleRemoveResource = (id: string) => {
        dispatch({ type: 'REMOVE_RESOURCE', payload: id });
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.type === 'application/pdf') {
          const reader = new FileReader();
          reader.onload = async (e) => {
              const arrayBuffer = e.target?.result;
              if (!arrayBuffer) return;
              try {
                  const loadingTask = pdfjsLib.getDocument(arrayBuffer);
                  const pdf = await loadingTask.promise;
                  let fullText = '';
                  for (let i = 1; i <= pdf.numPages; i++) {
                      const page = await pdf.getPage(i);
                      const textContent = await page.getTextContent();
                      const pageText = textContent.items.map((item: any) => item.str).join(' ');
                      fullText += pageText + '\n\n';
                  }
                  
                  addResource({
                      id: Math.random().toString(36).substr(2, 9),
                      type: 'file',
                      title: file.name,
                      content: fullText,
                      metadata: { mimeType: file.type }
                  });

              } catch (error: any) {
                  console.error("PDF Error:", error);
                  dispatch({ type: 'SET_ERROR', payload: 'خطا در خواندن فایل PDF.' });
              }
          };
          reader.readAsArrayBuffer(file);
      } else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const text = e.target?.result as string;
              addResource({
                  id: Math.random().toString(36).substr(2, 9),
                  type: 'file',
                  title: file.name,
                  content: text,
                  metadata: { mimeType: file.type }
              });
          };
          reader.readAsText(file);
      } else if (file.type.startsWith('image/') || file.type.startsWith('audio/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
               const result = e.target?.result as string;
               const base64Data = result.split(',')[1];
               
               const resource: LearningResource = {
                   id: Math.random().toString(36).substr(2, 9),
                   type: 'file',
                   title: file.name,
                   content: "", // Content will be filled by AI
                   metadata: { mimeType: file.type, data: base64Data }
               };
               addResource(resource);
          }
          reader.readAsDataURL(file);
      } else {
           dispatch({ type: 'SET_ERROR', payload: 'فرمت فایل پشتیبانی نمی‌شود.' });
      }
      
      event.target.value = '';
    };

    const handleStartFromText = (textInput: string) => {
        if (textInput.trim().length > 10) { 
            addResource({
                id: Math.random().toString(36).substr(2, 9),
                type: 'text',
                title: 'متن وارد شده',
                content: textInput
            });
        } else {
            showNotification('لطفاً حداقل ۱۰ کاراکتر متن وارد کنید.', 'error');
        }
    };
  
    const handleTopicStudy = (topicInput: string, options: { depth: 'general' | 'deep', length: 'brief' | 'standard' | 'comprehensive' } = { depth: 'general', length: 'standard' }) => {
        if (topicInput.trim().length > 2) {
             addResource({
                id: Math.random().toString(36).substr(2, 9),
                type: 'text',
                title: `موضوع: ${topicInput}`,
                content: topicInput,
                metadata: { isTopic: true, ...options }
            });
        } else {
            showNotification('لطفاً یک موضوع معتبر وارد کنید.', 'error');
        }
    };

    const handleUrlInput = (url: string) => {
        if (!url || url.length < 5) return;
        addResource({
            id: Math.random().toString(36).substr(2, 9),
            type: 'link',
            title: url,
            content: "" // AI will infer context
        });
    };

    const handleFinalizeResources = (globalInstructions: string = "") => {
        if (state.resources.length === 0) {
            showNotification("لطفاً حداقل یک منبع اضافه کنید.", "error");
            return;
        }

        const processing = state.resources.some(r => r.isProcessing);
        if (processing) {
             showNotification("لطفاً صبر کنید تا تحلیل منابع تمام شود.", "error");
             return;
        }

        let combinedContent = "";
        let combinedImages: { mimeType: string, data: string }[] = [];

        state.resources.forEach((res, index) => {
            let resourceHeader = `[[Resource ${index + 1}: ${res.title}]]`;
            if (res.instructions && res.instructions.trim()) {
                resourceHeader += `\n[User Instruction for this resource: ${res.instructions.trim()}]`;
            }
            combinedContent += `\n\n${resourceHeader}\n${res.content}\n----------------\n`;
            if (res.metadata?.data && res.metadata?.mimeType) {
                combinedImages.push({ mimeType: res.metadata.mimeType, data: res.metadata.data });
            }
        });

        if (globalInstructions.trim()) {
            combinedContent += `\n\n[[GLOBAL USER INSTRUCTIONS FOR RESOURCE USAGE]]\n${globalInstructions.trim()}\n`;
        }

        dispatch({ type: 'INIT_WIZARD', payload: { sourceContent: combinedContent, sourcePageContents: null, sourceImages: combinedImages } });
    };

    const handleWizardComplete = (prefs: LearningPreferences) => {
        dispatch({ type: 'FINISH_WIZARD', payload: prefs });
    };

    const generatePlanInternal = useCallback(() => {
        return generateLearningPlan(
            state.sourceContent, 
            state.sourcePageContents, 
            state.sourceImages,
            state.preferences,
            (mindMap, suggestedPath) => dispatch({ type: 'MIND_MAP_GENERATED', payload: { mindMap, suggestedPath } }),
            (question) => dispatch({ type: 'PRE_ASSESSMENT_QUESTION_STREAMED', payload: question })
        ).then(quiz => {
            dispatch({ type: 'PRE_ASSESSMENT_STREAM_END' });
            if (state.currentUser) {
                 handleSaveSession(`جلسه جدید ${new Date().toLocaleDateString('fa-IR')}`, true);
            }
        }).catch((error: any) => {
            dispatch({ type: 'SET_ERROR', payload: 'خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.' });
            throw error;
        });
    }, [state.sourceContent, state.sourcePageContents, state.sourceImages, state.preferences, state.currentUser, dispatch, handleSaveSession]);

    const triggerFeynmanChallenge = useCallback(() => {
        // If already viewing a node, prioritize current node
        let targetNode = null;
        if (state.activeNodeId) {
            targetNode = state.mindMap.find(n => n.id === state.activeNodeId);
        }
        
        // Fallback to random completed node
        if (!targetNode) {
            const completedNodeIds = Object.keys(state.userProgress).filter(id => state.userProgress[id].status === 'completed');
            if (completedNodeIds.length === 0) return;
            const randomId = completedNodeIds[Math.floor(Math.random() * completedNodeIds.length)];
            targetNode = state.mindMap.find(n => n.id === randomId);
        }

        if (targetNode) {
            dispatch({ type: 'START_FEYNMAN', payload: targetNode });
        }
    }, [state.userProgress, state.mindMap, state.activeNodeId, dispatch]);

    const submitFeynmanExplanation = async (explanation: string, audioBlob?: Blob) => {
        const targetNode = state.feynmanState?.targetNode;
        if (!targetNode) return;
        dispatch({ type: 'ANALYZING_FEYNMAN' });
        try {
            const content = state.nodeContents[targetNode.id]?.theory || state.sourceContent;
            let audioBase64 = null;
            if (audioBlob) {
                const reader = new FileReader();
                audioBase64 = await new Promise<string>((resolve) => {
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        resolve(result.split(',')[1]);
                    };
                    reader.readAsDataURL(audioBlob);
                });
            }
            const feedback = await evaluateFeynmanExplanation(targetNode.title, content, explanation, audioBase64);
            dispatch({ type: 'FEYNMAN_FEEDBACK_RECEIVED', payload: feedback });
        } catch (e) {
            console.error("Feynman Analysis Error", e);
            showNotification("خطا در تحلیل توضیح شما", 'error');
            dispatch({ type: 'CLOSE_FEYNMAN' });
        }
    };

    const handleNodeSelect = useCallback((nodeId: string) => {
         if (state.isPodcastMode) {
             dispatch({ type: 'TOGGLE_PODCAST_NODE_SELECTION', payload: nodeId });
             return;
         }
  
         if (state.activeNodeId === nodeId) return;
  
         dispatch({ type: 'SELECT_NODE', payload: nodeId });
         const node = state.mindMap.find(n => n.id === nodeId);
         
         if (state.nodeContents[nodeId]) {
             dispatch({ type: 'NODE_CONTENT_LOADED', payload: state.nodeContents[nodeId] });
         } else if (node) {
              const strengths = state.preAssessmentAnalysis?.strengths || [];
              const weaknesses = state.preAssessmentAnalysis?.weaknesses || [];
              const isIntro = node.parentId === null;
              
              dispatch({ type: 'NODE_CONTENT_STREAM_START' });
              
              let nodeContext = state.sourceContent;
              if (state.sourcePageContents && node.sourcePages.length > 0) {
                   nodeContext = node.sourcePages.map(p => state.sourcePageContents![p-1]).join('\n');
              }
  
              generateNodeContent(
                  node.title, 
                  nodeContext, 
                  state.sourceImages,
                  state.preferences, 
                  strengths, 
                  weaknesses,
                  isIntro,
                  node.type, 
                  (partialContent) => dispatch({ type: 'NODE_CONTENT_STREAM_UPDATE', payload: partialContent })
              ).then(content => {
                  dispatch({ type: 'NODE_CONTENT_STREAM_END', payload: { nodeId, content } });
              }).catch((err: any) => {
                  console.error(err);
              });
         }
    }, [state, dispatch]);

    const handleNodeNavigate = useCallback((nodeIdOrTitle: string) => {
        if (Math.random() < 0.2) triggerFeynmanChallenge();
        let nodeId = nodeIdOrTitle;
        const nodeByTitle = state.mindMap.find(n => n.title.trim() === nodeIdOrTitle.trim());
        if (nodeByTitle) nodeId = nodeByTitle.id;
        const nodeExists = state.mindMap.some(n => n.id === nodeId);
        if (nodeExists) {
            handleNodeSelect(nodeId);
             if (window.innerWidth < 768 && state.isChatOpen) {
                  dispatch({ type: 'TOGGLE_CHAT' });
             }
        } else {
            showNotification(`درس "${nodeIdOrTitle}" پیدا نشد.`, 'error');
        }
    }, [state.mindMap, state.isChatOpen, handleNodeSelect, dispatch, showNotification, triggerFeynmanChallenge]);

    const handleTakeQuiz = useCallback((nodeId: string) => {
        const node = state.mindMap.find(n => n.id === nodeId);
        if (!node) return;
        dispatch({ type: 'START_QUIZ', payload: nodeId });
         let nodeContext = state.sourceContent;
         if (state.sourcePageContents && node.sourcePages.length > 0) {
              nodeContext = node.sourcePages.map(p => state.sourcePageContents![p-1]).join('\n');
         }
        generateQuiz(node.title, nodeContext, state.sourceImages, (q) => dispatch({ type: 'QUIZ_QUESTION_STREAMED', payload: q }))
          .then(() => dispatch({ type: 'QUIZ_STREAM_END' }))
          .catch((err: any) => console.error(err));
    }, [state.mindMap, state.sourceContent, state.sourcePageContents, state.sourceImages, dispatch]);

    const handleQuizSubmit = async (answers: Record<string, UserAnswer>) => {
        dispatch({ type: 'SUBMIT_QUIZ' });
        const node = state.mindMap.find(n => n.id === state.activeNodeId);
        if (!node || !state.activeQuiz) return;
        try {
             let nodeContext = state.sourceContent;
             if (state.sourcePageContents && node.sourcePages.length > 0) {
                  nodeContext = node.sourcePages.map(p => state.sourcePageContents![p-1]).join('\n');
             }
            const gradingResults = await gradeAndAnalyzeQuiz(state.activeQuiz.questions, answers, nodeContext, state.sourceImages);
            const results: QuizResult[] = gradingResults.map((result: any) => {
                const question = state.activeQuiz?.questions.find(q => q.id === result.questionId);
                if (!question) throw new Error(`Question ${result.questionId} not found`);
                return {
                    question: question,
                    userAnswer: answers[result.questionId],
                    isCorrect: result.isCorrect,
                    score: result.score,
                    analysis: result.analysis
                };
            });
            const totalScore = results.reduce((sum, r) => sum + r.score, 0);
            const maxScore = results.reduce((sum, r) => sum + r.question.points, 0);
            const percentage = maxScore > 0 ? (totalScore / maxScore) : 0;
            let newReward: Reward | null = null;
            if (percentage >= 0.85) {
                const nodeContentText = state.nodeContents[node.id]?.theory || state.sourceContent.substring(0, 1000); 
                const rewardContent = await generateDeepAnalysis(node.title, nodeContentText);
                newReward = {
                    id: `reward_${node.id}`,
                    type: 'deep_analysis',
                    title: `تحلیل عمیق: ${node.title}`,
                    content: rewardContent,
                    unlockedAt: new Date().toISOString(),
                    relatedNodeId: node.id
                };
                dispatch({ type: 'UNLOCK_REWARD', payload: newReward });
            }
            dispatch({ type: 'QUIZ_ANALYSIS_LOADED', payload: { results } });
        } catch (err: any) {
            console.error("Error grading quiz:", err);
            dispatch({ type: 'SET_ERROR', payload: 'خطا در تصحیح آزمون. لطفاً اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.' });
        }
    };

    const handleGenerateRemedial = async () => {
        if (!state.activeNodeId || !state.quizResults) return;
        const node = state.mindMap.find(n => n.id === state.activeNodeId);
        if (!node) return;
        dispatch({ type: 'START_REMEDIAL_GENERATION' });
        const currentWeaknesses: Weakness[] = state.quizResults
            .filter(r => !r.isCorrect)
            .map(r => ({
                question: r.question.question,
                incorrectAnswer: JSON.stringify(r.userAnswer),
                correctAnswer: r.question.type === 'multiple-choice' ? r.question.options[r.question.correctAnswerIndex] : r.question.correctAnswer
            }));
        const weaknessesToPass = currentWeaknesses.length > 0 ? currentWeaknesses : state.weaknesses;
        try {
             const remedialNode = await generateRemedialNode(
                node.id, 
                node.title,
                weaknessesToPass,
                state.sourceContent,
                state.sourceImages
            );
            dispatch({ type: 'ADD_REMEDIAL_NODE', payload: { remedialNode, originalNodeId: node.id } });
        } catch (e) {
             dispatch({ type: 'SET_ERROR', payload: 'خطا در تولید درس تقویتی.' });
             dispatch({ type: 'CANCEL_REMEDIAL_GENERATION' });
        }
    };

    const handlePreAssessmentSubmit = async (answers: Record<string, UserAnswer>) => {
        if (!state.preAssessment) return;
        dispatch({ type: 'SUBMIT_PRE_ASSESSMENT', payload: answers });
        try {
            const analysis = await analyzePreAssessment(
                state.preAssessment.questions,
                answers,
                state.sourceContent
            );
            dispatch({ type: 'START_ADAPTING_PLAN' });
            let difficultyMod = 0;
            if (analysis.recommendedLevel === 'مبتدی') difficultyMod = -0.2;
            if (analysis.recommendedLevel === 'پیشرفته') difficultyMod = 0.2;
            const adaptedMindMap = state.mindMap.map(node => ({
                ...node,
                difficulty: Math.max(0.1, Math.min(0.9, node.difficulty + difficultyMod))
            }));
            dispatch({ 
                type: 'PLAN_ADAPTED', 
                payload: { 
                    analysis, 
                    mindMap: adaptedMindMap, 
                    suggestedPath: state.suggestedPath 
                } 
            });
        } catch (error) {
            console.error("Pre-assessment analysis failed", error);
            dispatch({ type: 'SET_ERROR', payload: 'خطا در تحلیل پیش‌آزمون.' });
        }
    };

    const handleChatSend = useCallback(async (message: string) => {
        const userMsg: ChatMessage = { role: 'user', message };
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMsg });
        dispatch({ type: 'SET_CHAT_LOADING', payload: true });
        try {
            let nodeTitle = null;
            let contextContent = state.sourceContent.substring(0, 1500);
            if (state.activeNodeId) {
                const node = state.mindMap.find(n => n.id === state.activeNodeId);
                if (node) {
                    nodeTitle = node.title;
                    if (state.nodeContents[node.id]) {
                        const c = state.nodeContents[node.id];
                        contextContent = `Context (${node.title}):\n${c.theory}\n---\nSource:\n${contextContent}`;
                    }
                }
            }
            const allNodeTitles = state.mindMap.map(n => n.title);
            const responseText = await generateChatResponse(
                state.chatHistory, 
                message, 
                nodeTitle, 
                contextContent,
                state.isDebateMode, 
                state.weaknesses,
                state.chatPersona, 
                allNodeTitles      
            );
            const modelMsg: ChatMessage = { role: 'model', message: responseText };
            dispatch({ type: 'ADD_CHAT_MESSAGE', payload: modelMsg });
        } catch (error) {
            dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'model', message: "متاسفانه ارتباط با سرور برقرار نشد." } });
        } finally {
            dispatch({ type: 'SET_CHAT_LOADING', payload: false });
        }
    }, [state.sourceContent, state.activeNodeId, state.mindMap, state.nodeContents, state.chatHistory, state.isDebateMode, state.weaknesses, state.chatPersona, dispatch]);
  
    const handleExplainRequest = (text: string) => {
        if (!state.isChatOpen) dispatch({ type: 'TOGGLE_CHAT' });
        handleChatSend(`لطفاً این قسمت را بیشتر توضیح بده: "${text}"`);
    };

    const handleDebateInitiation = useCallback(async () => {
        let nodeTitle = "General";
        let nodeContent = "";
        if (state.activeNodeId) {
            const node = state.mindMap.find(n => n.id === state.activeNodeId);
            if (node) nodeTitle = node.title;
            if (state.nodeContents[state.activeNodeId]) {
                nodeContent = state.nodeContents[state.activeNodeId].theory;
            }
        }
        try {
            const msgText = await generateProactiveChatInitiation(
                nodeTitle,
                nodeContent || state.sourceContent.substring(0, 1000),
                state.isDebateMode,
                state.weaknesses
            );
            dispatch({ 
                type: 'TRIGGER_PROACTIVE_DEBATE', 
                payload: { role: 'model', message: msgText }
            });
        } catch(e) {
            console.error("Failed to initiate debate manually", e);
            dispatch({ 
                type: 'ADD_CHAT_MESSAGE', 
                payload: { role: 'model', message: "متاسفانه در شروع بحث مشکلی پیش آمد." }
            });
        }
    }, [state.activeNodeId, state.mindMap, state.nodeContents, state.sourceContent, state.isDebateMode, state.weaknesses, dispatch]);

    // Interactive Coach: Triggered by the NodeView bubble to start a debate/questioning session
    const handleCoachDebateStart = useCallback(async (nodeId: string) => {
        if (!state.isChatOpen) dispatch({ type: 'TOGGLE_CHAT' });
        if (!state.isDebateMode) dispatch({ type: 'TOGGLE_DEBATE_MODE' });
        dispatch({ type: 'SET_CHAT_LOADING', payload: true });

        const node = state.mindMap.find(n => n.id === nodeId);
        if (!node) return;
        
        const content = state.nodeContents[nodeId]?.theory || state.sourceContent.substring(0, 1000);

        try {
            const question = await generateCoachQuestion(node.title, content);
            dispatch({ 
                type: 'TRIGGER_PROACTIVE_DEBATE', 
                payload: { role: 'model', message: question }
            });
        } catch (e) {
            console.error("Coach debate gen failed", e);
            dispatch({ 
                type: 'ADD_CHAT_MESSAGE', 
                payload: { role: 'model', message: "می‌خواستم سوالی بپرسم اما فراموش کردم! بیایید ادامه دهیم." }
            });
        } finally {
            dispatch({ type: 'SET_CHAT_LOADING', payload: false });
        }
    }, [state.isChatOpen, state.isDebateMode, state.mindMap, state.nodeContents, state.sourceContent, dispatch]);

    const togglePodcastMode = useCallback(() => {
        dispatch({ type: 'TOGGLE_PODCAST_MODE' });
    }, [dispatch]);

    const startPodcastGeneration = useCallback(async (config: PodcastConfig) => {
        dispatch({ type: 'TOGGLE_PODCAST_MODE' });
        dispatch({ 
            type: 'UPDATE_PODCAST_STATE', 
            payload: { status: 'generating_script', progressText: 'در حال نگارش سناریو پادکست...', audioUrl: null, isMinimized: false } 
        });
        try {
            const validContents = config.selectedNodeIds
              .map(id => ({ node: state.mindMap.find(n => n.id === id), content: state.nodeContents[id] }))
              .filter(item => item.node && item.content)
              .map(item => ({
                  title: item.node!.title,
                  text: `${item.content!.introduction}\n${item.content!.theory}\n${item.content!.conclusion}`
              }));
          if (validContents.length === 0) {
               throw new Error("محتوای متنی یافت نشد.");
          }
          const script = await generatePodcastScript(validContents, config.mode);
          dispatch({ 
              type: 'UPDATE_PODCAST_STATE', 
              payload: { status: 'generating_audio', progressText: 'در حال ضبط استودیویی (هوش مصنوعی)...' } 
          });
          const url = await generatePodcastAudio(script, config.speaker1, config.mode === 'dialogue' ? config.speaker2 : undefined, config.mode);
          dispatch({ 
              type: 'UPDATE_PODCAST_STATE', 
              payload: { status: 'ready', audioUrl: url, progressText: 'آماده پخش' } 
          });
          showNotification("پادکست شما آماده است!", "success");
        } catch (error: any) {
            console.error("Podcast Generation Error", error);
            dispatch({ 
                type: 'UPDATE_PODCAST_STATE', 
                payload: { status: 'error', progressText: 'خطا در تولید پادکست: ' + (error.message || 'مشکل ناشناخته'), audioUrl: null } 
            });
            showNotification("تولید پادکست با خطا مواجه شد.", "error");
        }
    }, [state.mindMap, state.nodeContents, dispatch, showNotification]);

    // --- SRS Actions ---
    const handleGenerateFlashcards = async () => {
        if (!state.activeNodeId) return;
        const node = state.mindMap.find(n => n.id === state.activeNodeId);
        const content = state.nodeContents[state.activeNodeId];
        if (!node || !content) {
            showNotification("ابتدا باید محتوای درس را مشاهده کنید.", 'error');
            return;
        }

        showNotification("در حال تولید کارت‌های مرور هوشمند...", "success");
        try {
            const textContent = `${content.theory}\n${content.example}`;
            const rawCards = await generateFlashcards(node.title, textContent);
            
            const newCards: Flashcard[] = rawCards.map(c => ({
                id: Math.random().toString(36).substr(2, 9),
                nodeId: node.id,
                front: c.front || "سوال نامشخص",
                back: c.back || "پاسخی برای این کارت تولید نشد.",
                interval: 0,
                repetition: 0,
                easeFactor: 2.5,
                nextReviewDate: new Date().toISOString()
            }));

            dispatch({ type: 'ADD_FLASHCARDS', payload: newCards });
            showNotification(`${newCards.length} کارت مرور به جعبه لایتنر شما اضافه شد!`, "success");
        } catch (e) {
            console.error("Flashcard generation failed", e);
            showNotification("خطا در تولید کارت‌های مرور.", 'error');
        }
    };

    const handleReviewFlashcard = (cardId: string, grade: FlashcardGrade) => {
        dispatch({ type: 'UPDATE_FLASHCARD_REVIEW', payload: { id: cardId, grade } });
    };

    const startFlashcardReview = () => {
        dispatch({ type: 'START_FLASHCARD_REVIEW' });
    };

    const exitFlashcardReview = () => {
        dispatch({ type: 'FINISH_FLASHCARD_REVIEW' });
    };

    // --- Daily Status & Notification Actions ---
    const checkDailyStatus = useCallback(() => {
        dispatch({ type: 'CHECK_DAILY_STATUS' });
    }, [dispatch]);

    const generateDailyContent = useCallback(async () => {
        try {
            const content = await generateDailyChallenge();
            dispatch({ type: 'SET_DAILY_CHALLENGE', payload: content });
        } catch (e) {
            console.error("Failed to generate daily challenge", e);
        }
    }, [dispatch]);

    return {
        generatePlanInternal,
        handleLogin,
        handleLogout,
        handleSaveSession,
        handleDeleteSession,
        handleLoadSession,
        handleExportUserData,
        handleImportUserData,
        handleEnableCloudSync: () => {
             if (state.currentUser) handleCloudLoad(state.currentUser.id);
             else showNotification("لطفاً ابتدا وارد حساب شوید.", 'error');
        },
        handleFileUpload,
        handleStartFromText,
        handleTopicStudy,
        handleUrlInput,
        handleWizardComplete,
        handleNodeSelect,
        handleNodeNavigate,
        handleTakeQuiz,
        handleQuizSubmit,
        handleGenerateRemedial,
        handlePreAssessmentSubmit,
        handleChatSend,
        handleExplainRequest,
        handleDebateInitiation,
        handleCoachDebateStart, // New
        togglePodcastMode,
        startPodcastGeneration,
        handleRemoveResource,
        handleFinalizeResources,
        handleUpdateResourceContent, 
        handleUpdateResourceInstructions, 
        triggerFeynmanChallenge, 
        submitFeynmanExplanation,
        handleGenerateFlashcards, 
        handleReviewFlashcard, 
        startFlashcardReview, 
        exitFlashcardReview,
        checkDailyStatus,
        generateDailyContent
    };
};
