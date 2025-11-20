
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle, Lock, FileQuestion, Target, Flag, Trophy, Sparkles, BrainCircuit } from './icons';

interface MindMapProps {
    nodes: MindMapNodeType[];
    progress: { [key: string]: 'completed' | 'failed' | 'in_progress' };
    suggestedPath: string[] | null;
    onSelectNode: (id: string) => void;
    onTakeQuiz: (id: string) => void;
    theme: 'light' | 'balanced' | 'dark';
    activeNodeId: string | null;
    showSuggestedPath: boolean;
}

const formatPageNumbers = (pages: number[]): string => {
    if (!pages || pages.length === 0) return '';
    pages.sort((a, b) => a - b);
    const ranges: (number | string)[] = [];
    if (pages.length === 0) return '';
    let start = pages[0];
    for (let i = 1; i <= pages.length; i++) {
        if (i === pages.length || pages[i] !== pages[i-1] + 1) {
            const end = pages[i-1];
            if (start === end) {
                ranges.push(start);
            } else if (end === start + 1) {
                ranges.push(start, end);
            } else {
                ranges.push(`${start}-${end}`);
            }
            if (i < pages.length) {
                start = pages[i];
            }
        }
    }
    return `ص: ${ranges.join(', ')}`;
};

// Extracted component to prevent re-mounting and hover flicker
const MindMapNodeItem = React.memo(({ 
    node, 
    index, 
    status, 
    isLocked, 
    isSuggestedAndIncomplete, 
    suggestedIndex, 
    isActive, 
    isRemedial, 
    isAdaptive,
    isIntro, 
    isConclusion,
    width, 
    height, 
    isVisible, 
    isPortrait, 
    onSelect, 
    onTakeQuiz 
}: {
    node: MindMapNodeType & { x: number, y: number };
    index: number;
    status: 'completed' | 'failed' | 'in_progress' | undefined;
    isLocked: boolean;
    isSuggestedAndIncomplete: boolean | null;
    suggestedIndex: number;
    isActive: boolean;
    isRemedial: boolean;
    isAdaptive: boolean;
    isIntro: boolean;
    isConclusion: boolean;
    width: number;
    height: number;
    isVisible: boolean;
    isPortrait: boolean;
    onSelect: (id: string) => void;
    onTakeQuiz: (id: string) => void;
}) => {
    const handleNodeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isLocked) {
            onSelect(node.id);
        }
    };

    // Difficulty Color Bar
    let difficultyColor = 'bg-primary';
    if (isRemedial || isAdaptive) difficultyColor = 'bg-purple-500';
    else if (node.difficulty < 0.4) difficultyColor = 'bg-emerald-500';
    else if (node.difficulty > 0.7) difficultyColor = 'bg-rose-500';

    const baseStyle = {
        left: node.x,
        top: node.y,
        width: width,
        height: height,
        transitionDelay: `${index * 20}ms`, // Reduced delay for snappier feel
        // Use specific z-index hierarchy but rely on hover CSS for lift
        zIndex: isActive ? 40 : (isLocked ? 10 : 20),
        opacity: isLocked ? 0.6 : 1,
        filter: isLocked ? 'grayscale(0.8)' : 'none', // Removed blur filter for performance
        touchAction: 'manipulation', // Important for mobile responsiveness
    };

    // 1. Introduction Node
    if (isIntro) {
        return (
            <div
                className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute cursor-pointer select-none`}
                style={baseStyle}
                onClick={handleNodeClick}
                role="button"
            >
                <div className={`absolute inset-0 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center p-4 border transition-all duration-300 
                    ${isActive ? 'border-primary ring-4 ring-primary/20 scale-105' : 'border-white/10 hover:scale-105'} 
                    bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-800 text-white overflow-hidden`}>
                    
                    {/* Reduced opacity background for better mobile performance */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-10"></div>
                    
                    <div className="relative z-10">
                        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                            <Flag className="w-6 h-6 text-indigo-200" />
                        </div>
                        <h3 className={`font-bold leading-tight ${isPortrait ? 'text-sm' : 'text-lg'}`}>{node.title}</h3>
                        <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-1 rounded-full text-indigo-200">شروع مسیر</span>
                    </div>
                </div>
                {status === 'completed' && (
                    <div className="absolute -top-2 -right-2 z-30 bg-white rounded-full shadow-lg ring-2 ring-green-500">
                        <CheckCircle className="w-6 h-6 text-green-500 fill-white" />
                    </div>
                 )}
            </div>
        );
    }

    // 2. Conclusion Node
    if (isConclusion) {
         return (
            <div
                className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute cursor-pointer select-none`}
                style={baseStyle}
                onClick={handleNodeClick}
                role="button"
            >
                <div className={`absolute inset-0 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center p-4 border transition-all duration-300
                    ${isActive ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-emerald-500/30'} 
                    ${isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'}`}>
                    
                    {status === 'completed' ? 
                        <Trophy className="w-10 h-10 mb-2 text-yellow-300 drop-shadow-lg" /> : 
                        <Target className="w-8 h-8 mb-2 opacity-90" />
                    }
                    <h3 className={`font-bold leading-tight ${isPortrait ? 'text-sm' : 'text-lg'}`}>{node.title}</h3>
                </div>
            </div>
        );
    }

    // 3. Standard Node (Glassmorphism)
    // Note: The 'glass' class is modified in index.html to remove backdrop-filter on mobile
    return (
        <div
            className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} ${isActive ? 'active-node' : ''} ${isSuggestedAndIncomplete ? 'suggested-node' : ''} absolute rounded-xl cursor-pointer select-none`}
            style={baseStyle}
            onClick={handleNodeClick}
            role="button"
            tabIndex={isLocked ? -1 : 0}
        >
             {/* Active Pulse Ring - Hidden on locked nodes */}
             {isActive && <div className="absolute inset-0 rounded-xl ring-4 ring-primary/30 animate-pulse"></div>}

             <div className={`absolute inset-0 rounded-xl border transition-all duration-300 overflow-hidden flex flex-col shadow-sm hover:shadow-xl glass
                ${isActive ? 'border-primary/80 bg-card/90' : 'border-white/40 dark:border-white/10 hover:border-primary/50 bg-card/70'} 
                ${status === 'failed' ? 'border-destructive/60 bg-destructive/10' : ''}
                ${isRemedial ? 'border-purple-400/50 bg-purple-50/80 dark:bg-purple-900/20' : ''}
                ${isAdaptive ? 'border-blue-400/50 bg-blue-50/80 dark:bg-blue-900/20' : ''}
             `}>
                
                {/* Top Gradient Line */}
                <div className={`h-1 w-full ${status === 'failed' ? 'bg-destructive' : difficultyColor} opacity-80`} />

                <div className="flex-1 p-3 flex flex-col justify-between relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                         <h3 className={`font-bold leading-snug text-foreground line-clamp-2 ${isPortrait ? 'text-xs' : 'text-sm'} ${isRemedial || isAdaptive ? 'text-purple-700 dark:text-purple-300' : ''}`} dir="rtl">
                            {node.title}
                         </h3>
                         {isLocked && <Lock className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
                    </div>

                    {/* Footer info */}
                    <div className="flex items-end justify-between mt-2">
                         <div className="flex gap-1">
                            {node.sourcePages.length > 0 && (
                                <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                                    {formatPageNumbers(node.sourcePages)}
                                </span>
                            )}
                         </div>

                        {!isLocked && status !== 'completed' && status !== 'failed' && (
                             <div className="bg-primary/10 p-1 rounded-md text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                 {isRemedial || isAdaptive ? <Sparkles className="w-4 h-4 text-purple-500" /> : <BrainCircuit className="w-4 h-4" />}
                             </div>
                        )}
                    </div>
                </div>
             </div>

             {/* Status Badges (Floating) */}
             {status === 'completed' && (
                <div className="absolute -top-2 -left-2 z-30 bg-white dark:bg-slate-800 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] ring-1 ring-success/20">
                    <CheckCircle className="w-6 h-6 text-success fill-white dark:fill-transparent" />
                </div>
             )}
             
             {isSuggestedAndIncomplete && suggestedIndex !== -1 && (
                <div className="absolute -top-3 -right-3 z-30 flex items-center justify-center w-7 h-7 text-xs font-bold text-white rounded-full bg-gradient-to-br from-primary to-indigo-600 shadow-lg ring-2 ring-background animate-bounce">
                    {suggestedIndex + 1}
                </div>
             )}

             {/* Adaptive Badge */}
             {isAdaptive && (
                 <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 bg-blue-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                     شخصی
                 </div>
             )}
        </div>
    );
});

const MindMap: React.FC<MindMapProps> = ({ nodes, progress, suggestedPath, onSelectNode, onTakeQuiz, theme, activeNodeId, showSuggestedPath }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const hasCenteredRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 150);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Debounced Resize Observer to prevent excessive re-renders on mobile browser bar toggle
        let timeoutId: any;
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    setContainerSize(prev => {
                        // Tolerance for small mobile height changes (address bar)
                        if (Math.abs(prev.width - width) < 10 && Math.abs(prev.height - height) < 80) return prev;
                        return { width, height };
                    });
                }, 200);
            }
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => {
            resizeObserver.disconnect();
            clearTimeout(timeoutId);
        };
    }, []);

    const { positionedNodes, lines, width, height, isPortrait, nodeWidth, nodeHeight } = useMemo(() => {
        if (nodes.length === 0 || containerSize.width === 0) {
            return { positionedNodes: [], lines: [], width: 0, height: 0, isPortrait: false, nodeWidth: 0, nodeHeight: 0 };
        }

        const isPortraitLayout = containerSize.width < 768;
        // Increased spacing for better visuals
        const R_NODE_WIDTH = isPortraitLayout ? 160 : 220;
        const R_NODE_HEIGHT = isPortraitLayout ? 100 : 130;
        const R_H_GAP = isPortraitLayout ? 40 : 90; 
        const R_V_GAP = isPortraitLayout ? 80 : 120; 

        type NodeWithChildren = MindMapNodeType & { children: NodeWithChildren[], level: number, x: number, y: number };
        const nodeMap = new Map<string, NodeWithChildren>(nodes.map(n => [n.id, { ...n, children: [], level: 0, x: 0, y: 0 }]));
        const roots: NodeWithChildren[] = [];

        let conclusionNodeId: string | null = null;
        const isConclusion = (title: string) => title.includes('نتیجه‌گیری') || title.includes('جمع‌بندی') || title.toLowerCase().includes('conclusion');
        const conclusionEntry = nodes.find(n => isConclusion(n.title));
        if (conclusionEntry) conclusionNodeId = conclusionEntry.id;

        nodes.forEach(node => {
            const nodeObj = nodeMap.get(node.id)!;
            if (node.id === conclusionNodeId) return;
            if (node.parentId && nodeMap.has(node.parentId)) {
                const parent = nodeMap.get(node.parentId)!;
                if (parent.id !== conclusionNodeId) parent.children.push(nodeObj);
            } else {
                roots.push(nodeObj);
            }
        });

        if (roots.length === 0 && nodes.length > 0 && !conclusionNodeId) {
             if (nodes.length > 1 || (nodes.length === 1 && nodes[0].id !== conclusionNodeId)) {
                 const first = nodeMap.get(nodes[0].id)!;
                 if (first.id !== conclusionNodeId) roots.push(first);
             }
        }

        const levels: NodeWithChildren[][] = [];
        function assignLevels(node: MindMapNodeType, level: number) {
            const positionedNode = nodeMap.get(node.id)!;
            if(positionedNode.level > 0 && positionedNode.level !== level) return; 
            if(positionedNode.level > 0 && level > positionedNode.level) positionedNode.level = level; 
            if(positionedNode.level === 0) positionedNode.level = level;

            if (!levels[level]) levels[level] = [];
            if (!levels[level].includes(positionedNode)) levels[level].push(positionedNode);
            positionedNode.children.forEach(child => assignLevels(child, level + 1));
        }

        roots.forEach(root => assignLevels(root, 0));
        
        const positionedNodesList: NodeWithChildren[] = [];
        const lines: { x1: number, y1: number, x2: number, y2: number, parentId: string, childId: string, type?: 'normal' | 'conclusion' }[] = [];
        const PADDING = 120;
        
        let currentLeafX = 0;
        const layoutVerticalNode = (node: NodeWithChildren) => {
            node.children.forEach(layoutVerticalNode);
            if (node.children.length === 0) {
                node.x = currentLeafX;
                currentLeafX += R_NODE_WIDTH + R_H_GAP;
            } else {
                const firstChild = node.children[0];
                const lastChild = node.children[node.children.length - 1];
                node.x = (firstChild.x + lastChild.x) / 2;
            }
            node.y = node.level * (R_NODE_HEIGHT + R_V_GAP);
            positionedNodesList.push(node);
        };

        roots.forEach(root => layoutVerticalNode(root));

        let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (positionedNodesList.length > 0) {
            positionedNodesList.forEach(n => {
                minX = Math.min(minX, n.x);
                maxX = Math.max(maxX, n.x);
                maxY = Math.max(maxY, n.y);
            });
        } else {
            minX = 0; maxX = 0; maxY = 0;
        }

        if (conclusionNodeId) {
            const cNode = nodeMap.get(conclusionNodeId)!;
            const treeCenter = (minX + maxX) / 2;
            cNode.x = treeCenter; 
            cNode.y = maxY + R_V_GAP * 1.5; 
            positionedNodesList.push(cNode);
            minX = Math.min(minX, cNode.x);
            maxX = Math.max(maxX, cNode.x);
            maxY = Math.max(maxY, cNode.y);
        }

        const finalWidth = (maxX - minX) + R_NODE_WIDTH + PADDING * 2;
        const finalHeight = (maxY) + R_NODE_HEIGHT + PADDING * 2;
        const flipX = true; 
        const positionedNodesMap = new Map(positionedNodesList.map(n => [n.id, n]));
        
        positionedNodesList.forEach(node => {
            const normalizedX = node.x - minX;
            let xPos = flipX ? (maxX - minX) - normalizedX + PADDING : normalizedX + PADDING;
            
            // ROUND COORDINATES TO PREVENT BLURRINESS
            node.x = Math.round(xPos);
            node.y = Math.round(node.y + PADDING);
        });

        positionedNodesList.forEach(node => {
            if (node.id !== conclusionNodeId && node.parentId && positionedNodesMap.has(node.parentId)) {
                const parent = positionedNodesMap.get(node.parentId)!;
                if (parent.id !== conclusionNodeId) {
                    lines.push({
                        x1: Math.round(parent.x + R_NODE_WIDTH / 2),
                        y1: Math.round(parent.y + R_NODE_HEIGHT),
                        x2: Math.round(node.x + R_NODE_WIDTH / 2),
                        y2: Math.round(node.y),
                        parentId: parent.id,
                        childId: node.id,
                        type: 'normal'
                    });
                }
            }
        });

        if (conclusionNodeId && positionedNodesMap.has(conclusionNodeId)) {
            const cNode = positionedNodesMap.get(conclusionNodeId)!;
            const leafNodes = positionedNodesList.filter(n => n.id !== conclusionNodeId && n.children.length === 0);
            leafNodes.forEach(leaf => {
                lines.push({
                    x1: Math.round(leaf.x + R_NODE_WIDTH / 2),
                    y1: Math.round(leaf.y + R_NODE_HEIGHT),
                    x2: Math.round(cNode.x + R_NODE_WIDTH / 2),
                    y2: Math.round(cNode.y),
                    parentId: leaf.id,
                    childId: cNode.id,
                    type: 'conclusion'
                });
            });
        }

        return { positionedNodes: positionedNodesList, lines, width: finalWidth, height: finalHeight, isPortrait: isPortraitLayout, nodeWidth: R_NODE_WIDTH, nodeHeight: R_NODE_HEIGHT };

    }, [nodes, containerSize]);

    useEffect(() => {
        hasCenteredRef.current = false;
    }, [isPortrait]);

    useLayoutEffect(() => {
        if (positionedNodes.length > 0 && containerRef.current && !hasCenteredRef.current && width > 0) {
             const root = positionedNodes.find(n => n.parentId === null) || positionedNodes[0];
             if (root) {
                const container = containerRef.current;
                const scrollX = root.x - (container.clientWidth / 2) + (nodeWidth / 2);
                const scrollY = root.y - (container.clientHeight / 2) + (nodeHeight / 2);
                container.scrollTo({ left: scrollX, top: scrollY });
                hasCenteredRef.current = true;
             }
        }
    }, [positionedNodes.length, width, nodeWidth, nodeHeight]);

    const centerOnRoot = () => {
        if (positionedNodes.length > 0 && containerRef.current) {
           const root = positionedNodes.find(n => n.parentId === null) || positionedNodes[0];
           if (root) {
               const container = containerRef.current;
               const scrollX = root.x - (container.clientWidth / 2) + (nodeWidth / 2);
               const scrollY = root.y - (container.clientHeight / 2) + (nodeHeight / 2);
               container.scrollTo({ left: scrollX, top: scrollY, behavior: 'smooth' });
           }
       }
   };

    const suggestedNodeIds = useMemo(() => new Set(suggestedPath || []), [suggestedPath]);

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-auto bg-[radial-gradient(circle_at_center,rgba(var(--primary)/0.05)_0%,transparent_70%)]" style={{ direction: 'ltr' }}>
            <button onClick={centerOnRoot} className="absolute z-50 p-3 transition-transform rounded-full shadow-lg bottom-6 left-6 bg-card text-primary border border-border hover:bg-accent hover:scale-110 active:scale-95">
               <Target className="w-6 h-6" />
            </button>

            <div className="relative mx-auto transition-all duration-500 ease-out" style={{ width: Math.max(width, containerSize.width), height: Math.max(height, containerSize.height) }}>
                {/* Optimize SVG Rendering for Mobile */}
                <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }} shapeRendering="optimizeSpeed">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--muted-foreground))" opacity="0.5" />
                        </marker>
                        <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--primary))" />
                        </marker>
                        <marker id="arrow-conclusion" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--success))" opacity="0.6" />
                        </marker>
                    </defs>
                    {lines.map((line, i) => {
                         const isActive = activeNodeId === line.parentId || activeNodeId === line.childId;
                         const isSuggested = showSuggestedPath && suggestedNodeIds.has(line.parentId) && suggestedNodeIds.has(line.childId);
                         const isConclusionLine = line.type === 'conclusion';
                         // Smooth bezier curve
                         const cpY = (line.y2 - line.y1) * 0.5;
                         const path = `M${line.x1},${line.y1} C${line.x1},${line.y1 + cpY} ${line.x2},${line.y2 - cpY} ${line.x2},${line.y2}`;
                         
                         return (
                            <g key={i}>
                                {/* Base Line */}
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={isConclusionLine ? "rgb(var(--success))" : "rgb(var(--border))"}
                                    strokeWidth={isActive ? 3 : 2}
                                    strokeOpacity={isConclusionLine ? 0.4 : 0.3}
                                    className={`mindmap-line ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ transitionDelay: `${i * 10}ms` }}
                                    markerEnd={isConclusionLine ? "url(#arrow-conclusion)" : (isActive ? "url(#arrow-active)" : "url(#arrow)")}
                                />
                                
                                {/* Animated Flow Line (Data traveling) */}
                                {(isActive || isSuggested) && !isConclusionLine && (
                                    <path
                                        d={path}
                                        fill="none"
                                        stroke="rgb(var(--primary))"
                                        strokeWidth={2}
                                        strokeOpacity={0.8}
                                        className="mindmap-line-flow"
                                    />
                                )}
                            </g>
                         );
                    })}
                </svg>
                {positionedNodes.map((node, index) => {
                    const status = progress[node.id];
                    const isLocked = node.locked && status !== 'completed';
                    const isSuggestedAndIncomplete = showSuggestedPath && suggestedPath?.includes(node.id) && status !== 'completed';
                    const suggestedIndex = showSuggestedPath && suggestedPath ? suggestedPath.indexOf(node.id) : -1;
                    const isActive = activeNodeId === node.id;
                    const isRemedial = node.type === 'remedial';
                    const isAdaptive = node.isAdaptive || false;
                    const isIntro = node.parentId === null;
                    const isConclusion = node.title.includes('نتیجه‌گیری') || node.title.includes('جمع‌بندی') || node.title.toLowerCase().includes('conclusion');

                    return (
                        <MindMapNodeItem
                            key={node.id}
                            node={node}
                            index={index}
                            status={status}
                            isLocked={isLocked}
                            isSuggestedAndIncomplete={isSuggestedAndIncomplete}
                            suggestedIndex={suggestedIndex}
                            isActive={isActive}
                            isRemedial={isRemedial}
                            isAdaptive={isAdaptive}
                            isIntro={isIntro}
                            isConclusion={isConclusion}
                            width={nodeWidth}
                            height={nodeHeight}
                            isVisible={isVisible}
                            isPortrait={isPortrait}
                            onSelect={onSelectNode}
                            onTakeQuiz={onTakeQuiz}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default MindMap;
