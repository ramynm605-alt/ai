
import React, { useState, useReducer, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { AppState, MindMapNode, Quiz, Weakness, LearningPreferences, NodeContent, AppStatus, UserAnswer, QuizResult, SavableState, PreAssessmentAnalysis, ChatMessage, QuizQuestion, NodeProgress, Reward, UserBehavior, UserProfile, SavedSession } from './types';
import { generateLearningPlan, generateNodeContent, generateQuiz, generateFinalExam, generateCorrectiveSummary, generatePracticeResponse, gradeAndAnalyzeQuiz, analyzePreAssessment, generateChatResponse, generateRemedialNode, generateDailyChallenge, generateDeepAnalysis, generateAdaptiveModifications, generateProactiveChatInitiation } from './services/geminiService';
import { FirebaseService } from './services/firebaseService';
import { ArrowRight, BookOpen, Brain, BrainCircuit, CheckCircle, ClipboardList, Home, MessageSquare, Moon, Sun, XCircle, Save, Upload, FileText, Target, Maximize, Minimize, SlidersHorizontal, ChevronDown, Sparkles, Trash, Edit, Flame, Diamond, Scroll, User, LogOut, Wand, Bell, Shuffle, FileQuestion, Settings, ChevronLeft, ChevronRight } from './components/icons';
import Box