
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle, Lock, Target, Flag, Trophy, Sparkles } from './icons';

interface MindMapProps {
    nodes: MindMapNodeType[];
    progress: { [key: string]: 'completed' | 'failed' | 'in_progress' };
    suggestedPath: string[] | null;
    onSelectNode: (id: string) => void;
    onTakeQuiz: (id: string) => void;
    theme: 'light' | 'balanced' | 'dark';
    activeNodeId: string | null;
    showSuggestedPath: boolean;
    // New Props for Selection Mode
    isSelectionMode?: boolean;
    selectedNodeIds?: string[];
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
    return `ص ${ranges.join('، ')}`;
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
    isSelected, // New Prop
    isSelectionMode, // New Prop
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
    isSelected: boolean;
    isSelectionMode: boolean;
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
        // In selection mode, we allow clicking locked nodes if needed, or restrict it
        // Here we assume selection is allowed if not locked, or if it's just for content generation we might want only unlocked nodes.
        // Let's stick to unlocking logic: user can select any node they have access to (unlocked).
        if (!isLocked || isSelectionMode) {
            onSelect(node.id);
        }
    };

    // Elegant color palette for difficulty/type indicators
    let difficultyColor = 'bg-blue-500'; // Default/Medium
    if (isRemedial || isAdaptive) difficultyColor = 'bg-purple-500';
    else if (node.difficulty < 0.4) difficultyColor = 'bg-emerald-500'; // Easy
    else if (node.difficulty > 0.7) difficultyColor = 'bg-rose-500';    // Hard

    const baseStyle = {
        left: node.x,
        top: node.y,
        width: width,
        height: height,
        transitionDelay: `${index * 30}ms`,
        zIndex: isActive || isSelected ? 50 : (isLocked ? 10 : 20),
        touchAction: 'manipulation',
    };
    
    // Selection visuals
    const selectionClass = isSelectionMode 
        ? isSelected 
            ? 'ring-4 ring-primary scale-105 border-primary' 
            : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:scale-105' 
        : '';

    // 1. Introduction Node - Minimal & Clean
    if (isIntro) {
        return (
            <div
                className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute cursor-pointer select-none`}
                style={baseStyle}
                onClick={handleNodeClick}
                role="button"
            >
                <div className={`
                    absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center p-3 transition-all duration-300
                    bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30
                    ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                    ${selectionClass}
                `}>
                    <div className="w-8 h-8 mb-2 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Flag className="w-4 h-4" />
                    </div>
                    <h3 className={`font-bold text-foreground ${isPortrait ? 'text-xs' : 'text-sm'}`}>{node.title}</h3>
                    {!isPortrait && <span className="mt-1 text-[9px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-secondary">نقطه شروع</span>}
                </div>
                {status === 'completed' && (
                    <div className="absolute -top-1 -right-1 z-30 bg-background rounded-full ring-2 ring-background">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </div>
                 )}
                 {isSelected && (
                    <div className="absolute -top-2 -left-2 z-40 bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                 )}
            </div>
        );
    }

    // 2. Conclusion Node - Minimal & Clean
    if (isConclusion) {
         return (
            <div
                className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute cursor-pointer select-none`}
                style={baseStyle}
                onClick={handleNodeClick}
                role="button"
            >
                <div className={`
                    absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center p-3 transition-all duration-300
                    ${isLocked ? 'bg-secondary/50 border border-transparent opacity-60' : 'bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-emerald-500/30'}
                    ${isActive ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background' : ''}
                    ${selectionClass}
                `}>
                    <div className={`w-8 h-8 mb-2 rounded-full flex items-center justify-center ${status === 'completed' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                        {status === 'completed' ? <Trophy className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                    </div>
                    <h3 className={`font-bold text-foreground ${isPortrait ? 'text-xs' : 'text-sm'}`}>{node.title}</h3>
                </div>
                {isSelected && (
                    <div className="absolute -top-2 -left-2 z-40 bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                 )}
            </div>
        );
    }

    // 3. Standard Node - Minimal, Card-based, Refined
    return (
        <div
            className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute select-none outline-none`}
            style={baseStyle}
            onClick={handleNodeClick}
            role="button"
            tabIndex={isLocked ? -1 : 0}
        >
             <div className={`
                absolute inset-0 rounded-xl transition-all duration-300 overflow-hidden flex flex-col
                bg-card/95 backdrop-blur-sm border
                ${isActive 
                    ? 'border-primary ring-1 ring-primary shadow-[0_4px_20px_-8px_rgba(var(--primary)/0.2)] transform scale-[1.02] z-50' 
                    : 'border-border/60 hover:border-border hover:shadow-md'
                }
                ${status === 'failed' ? 'border-destructive/30 bg-destructive/5' : ''}
                ${isLocked && !isSelectionMode ? 'opacity-60 grayscale-[0.8] pointer-events-none' : ''}
                ${selectionClass}
            `}>
                 {/* Minimal Status Strip (RTL placement: Right) */}
                 <div className={`absolute right-0 top-0 bottom-0 w-1 ${difficultyColor} opacity-80`} />

                 <div className="flex-1 p-3 pl-4 pr-4 flex flex-col relative">
                    {/* Header Section */}
                    <div className="flex justify-between items-start gap-2">
                        <h3 className={`
                            font-medium leading-snug text-foreground/90
                            ${isPortrait ? 'text-[11px]' : 'text-sm'}
                            ${isLocked && !isSelectionMode ? 'text-muted-foreground' : ''}
                        `} dir="rtl">
                            {node.title}
                        </h3>
                        
                        {/* Status Icons */}
                        <div className="shrink-0 flex flex-col gap-1 items-center">
                            {status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {isLocked && <Lock className="w-3 h-3 text-muted-foreground/40" />}
                        </div>
                    </div>
                    
                    {/* Footer Info */}
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/30">
                         {/* Page Numbers */}
                         <span className="text-[9px] text-muted-foreground/70 font-mono tracking-tight h-3">
                             {!isPortrait && node.sourcePages.length > 0 && formatPageNumbers(node.sourcePages)}
                         </span>
                         
                         {/* Node Type Badge */}
                         {(isRemedial || isAdaptive) && (
                             <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-purple-500/10 ml-auto">
                                 <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                 {!isPortrait && <span className="text-[8px] text-purple-600 font-semibold">تکملی</span>}
                             </div>
                         )}
                    </div>
                 </div>
            </div>

             {/* Suggested Path Badge */}
             {isSuggestedAndIncomplete && suggestedIndex !== -1 && !isSelectionMode && (
                <div className="absolute -top-2 -right-2 z-30 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-primary-foreground rounded-full bg-primary shadow-sm ring-2 ring-background animate-bounce">
                    {suggestedIndex + 1}
                </div>
             )}

             {/* Selection Badge */}
             {isSelected && (
                <div className="absolute -top-2 -left-2 z-50 bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-background animate-pop-in">
                    <CheckCircle className="w-4 h-4" />
                </div>
             )}
        </div>
    );
});

const MindMap: React.FC<MindMapProps> = ({ 
    nodes, 
    progress, 
    suggestedPath, 
    onSelectNode, 
    onTakeQuiz, 
    theme, 
    activeNodeId, 
    showSuggestedPath,
    isSelectionMode = false,
    selectedNodeIds = []
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const hasCenteredRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 150);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        let timeoutId: any;
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    if (Math.abs(prev.width - width) < 10 && Math.abs(prev.height - height) < 80) return prev;
                    setContainerSize({ width, height });
                }, 200);
            }
        });
        // Helper to fix prev usage inside callback
        let prev = { width: 0, height: 0 }; 
        
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

        const isMobile = containerSize.width < 768;
        
        // Compact, minimal dimensions
        const R_NODE_WIDTH = isMobile ? 140 : 200;
        const R_NODE_HEIGHT = isMobile ? 80 : 100;
        const R_H_GAP = isMobile ? 20 : 60; 
        const R_V_GAP = isMobile ? 50 : 100; 

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
        const PADDING = isMobile ? 60 : 120;
        
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
            cNode.y = maxY + R_V_GAP * 1.2; // Less gap for conclusion
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

        return { positionedNodes: positionedNodesList, lines, width: finalWidth, height: finalHeight, isPortrait: isMobile, nodeWidth: R_NODE_WIDTH, nodeHeight: R_NODE_HEIGHT };

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
    const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-auto bg-background/5 touch-pan-x touch-pan-y" style={{ direction: 'ltr' }}>
            <button onClick={centerOnRoot} className="absolute z-50 p-3 transition-transform rounded-full shadow-md bottom-24 md:bottom-6 left-4 md:left-6 bg-card text-primary border border-border hover:bg-secondary hover:scale-110 active:scale-95">
               <Target className="w-5 h-5" />
            </button>

            <div className="relative mx-auto transition-all duration-500 ease-out" style={{ width: Math.max(width, containerSize.width), height: Math.max(height, containerSize.height) }}>
                <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }} shapeRendering="geometricPrecision">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--muted-foreground))" opacity="0.3" />
                        </marker>
                        <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--primary))" />
                        </marker>
                        <marker id="arrow-conclusion" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--success))" opacity="0.4" />
                        </marker>
                    </defs>
                    {lines.map((line, i) => {
                         const isActive = activeNodeId === line.parentId || activeNodeId === line.childId;
                         const isSuggested = showSuggestedPath && suggestedNodeIds.has(line.parentId) && suggestedNodeIds.has(line.childId);
                         const isConclusionLine = line.type === 'conclusion';
                         const isSelectionInvolved = isSelectionMode && (selectedSet.has(line.parentId) || selectedSet.has(line.childId));

                         // Thinner, simpler bezier
                         const cpY = (line.y2 - line.y1) * 0.5;
                         const path = `M${line.x1},${line.y1} C${line.x1},${line.y1 + cpY} ${line.x2},${line.y2 - cpY} ${line.x2},${line.y2}`;
                         
                         return (
                            <g key={i}>
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={isConclusionLine ? "rgb(var(--success))" : "rgb(var(--border))"}
                                    strokeWidth={isActive || isSelectionInvolved ? 2 : 1.5}
                                    strokeOpacity={isActive || isSelectionInvolved ? 1 : 0.3}
                                    className={`mindmap-line ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ transitionDelay: `${i * 5}ms` }}
                                    markerEnd={isConclusionLine ? "url(#arrow-conclusion)" : (isActive ? "url(#arrow-active)" : "url(#arrow)")}
                                />
                                {(isActive || (isSuggested && !isSelectionMode)) && !isConclusionLine && (
                                    <path
                                        d={path}
                                        fill="none"
                                        stroke="rgb(var(--primary))"
                                        strokeWidth={1.5}
                                        strokeOpacity={0.7}
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
                    const isSelected = selectedSet.has(node.id);

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
                            isSelected={isSelected}
                            isSelectionMode={isSelectionMode}
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
