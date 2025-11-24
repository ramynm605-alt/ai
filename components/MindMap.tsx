
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
    isSelectionMode?: boolean;
    selectedNodeIds?: string[];
}

const MindMapNodeItem = React.memo(({ 
    node, 
    index, 
    status, 
    isLocked, 
    isSuggestedAndIncomplete, 
    suggestedIndex, 
    isActive, 
    isSelected, 
    isSelectionMode, 
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
        if (!isLocked || isSelectionMode) {
            onSelect(node.id);
        }
    };

    let difficultyColor = 'bg-blue-500'; 
    if (isRemedial || isAdaptive) difficultyColor = 'bg-purple-500';
    else if (node.difficulty < 0.4) difficultyColor = 'bg-emerald-500'; 
    else if (node.difficulty > 0.7) difficultyColor = 'bg-rose-500';    

    const baseStyle = {
        left: node.x,
        top: node.y,
        width: width,
        height: height,
        transitionDelay: `${index * 30}ms`,
        zIndex: isActive || isSelected ? 50 : (isLocked ? 10 : 20),
        touchAction: 'manipulation',
        transform: `translate(-50%, 0)`, // Center the node on its X coordinate
    };
    
    const selectionClass = isSelectionMode 
        ? isSelected 
            ? 'ring-4 ring-primary scale-105 border-primary' 
            : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:scale-105' 
        : '';

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
                    <h3 className={`font-bold text-foreground leading-snug line-clamp-2 ${isPortrait ? 'text-xs' : 'text-sm'}`}>{node.title}</h3>
                    {!isPortrait && <span className="mt-1 text-[9px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-secondary">نقطه شروع</span>}
                </div>
                {status === 'completed' && (
                    <div className="absolute -top-1 -right-1 z-30 bg-background rounded-full ring-2 ring-background">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </div>
                 )}
            </div>
        );
    }

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
                    <h3 className={`font-bold text-foreground leading-snug line-clamp-2 ${isPortrait ? 'text-xs' : 'text-sm'}`}>{node.title}</h3>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute select-none outline-none`}
            style={baseStyle}
            onClick={handleNodeClick}
            role="button"
            tabIndex={isLocked ? -1 : 0}
        >
             <div className={`
                absolute inset-0 rounded-xl transition-all duration-300 overflow-hidden flex flex-col items-center justify-center text-center
                bg-card/95 backdrop-blur-sm border
                ${isActive 
                    ? 'border-primary ring-1 ring-primary shadow-[0_4px_20px_-8px_rgba(var(--primary)/0.2)] transform scale-[1.02] z-50' 
                    : 'border-border/60 hover:border-border hover:shadow-md'
                }
                ${status === 'failed' ? 'border-destructive/30 bg-destructive/5' : ''}
                ${isLocked && !isSelectionMode ? 'opacity-60 grayscale-[0.8] pointer-events-none' : ''}
                ${selectionClass}
            `}>
                 <div className={`absolute right-0 top-0 bottom-0 w-1 ${difficultyColor} opacity-80`} />

                 <div className="w-full h-full p-3 px-4 flex flex-col items-center justify-center relative">
                    <div className="absolute top-2 left-2 flex gap-1">
                        {status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {isLocked && <Lock className="w-3 h-3 text-muted-foreground/40" />}
                    </div>

                    <h3 
                        className={`
                            font-bold leading-relaxed text-foreground/90 w-full
                            ${isPortrait ? 'text-xs line-clamp-3' : 'text-sm line-clamp-3'}
                            ${isLocked && !isSelectionMode ? 'text-muted-foreground' : ''}
                        `} 
                        dir="rtl"
                        title={node.title}
                    >
                        {node.title}
                    </h3>
                    
                    <div className="absolute bottom-2 w-full flex items-center justify-center gap-2">
                         {(isRemedial || isAdaptive) && (
                             <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-purple-500/10">
                                 <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                 {!isPortrait && <span className="text-[8px] text-purple-600 font-semibold">تکمیلی</span>}
                             </div>
                         )}
                    </div>
                 </div>
            </div>

             {isSuggestedAndIncomplete && suggestedIndex !== -1 && !isSelectionMode && (
                <div className="absolute -top-2 -right-2 z-30 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-primary-foreground rounded-full bg-primary shadow-sm ring-2 ring-background animate-bounce">
                    {suggestedIndex + 1}
                </div>
             )}

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
                    setContainerSize({ width, height });
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

        const isMobile = containerSize.width < 768;
        
        // Layout Config
        const NODE_WIDTH = isMobile ? 140 : 200;
        const NODE_HEIGHT = isMobile ? 80 : 100;
        const HORIZONTAL_GAP = isMobile ? 30 : 60; 
        const VERTICAL_GAP = isMobile ? 80 : 120; 

        type AugmentedNode = Omit<MindMapNodeType, 'children'> & { 
            x: number; 
            y: number; 
            children: AugmentedNode[]; 
            treeWidth: number; 
            level: number 
        };

        // Build Tree
        const nodeMap = new Map<string, AugmentedNode>(nodes.map(n => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { children, ...rest } = n;
            return [n.id, { ...rest, x: 0, y: 0, children: [], treeWidth: 0, level: 0 } as AugmentedNode];
        }));
        const roots: AugmentedNode[] = [];
        
        // Separate Conclusion Node
        let conclusionNode: AugmentedNode | null = null;
        
        nodes.forEach(node => {
            const nodeObj = nodeMap.get(node.id)!;
            const isConclusion = node.title.includes('نتیجه‌گیری') || node.title.includes('جمع‌بندی') || node.title.toLowerCase().includes('conclusion');
            
            if (isConclusion && !conclusionNode) {
                conclusionNode = nodeObj;
                return; // Don't add to normal tree
            }

            if (node.parentId && nodeMap.has(node.parentId)) {
                const parent = nodeMap.get(node.parentId)!;
                // Avoid cycles or attaching to conclusion
                if (parent !== conclusionNode) {
                    parent.children.push(nodeObj);
                } else {
                    roots.push(nodeObj); 
                }
            } else {
                roots.push(nodeObj);
            }
        });

        // If no root found but nodes exist (e.g. circular or disconnected), pick first non-conclusion
        if (roots.length === 0 && nodes.length > 0 && !conclusionNode) {
             roots.push(nodeMap.get(nodes[0].id)!);
        }

        // 1. Calculate Subtree Widths (Recursive Post-Order)
        const calculateTreeWidth = (node: AugmentedNode) => {
            if (node.children.length === 0) {
                node.treeWidth = NODE_WIDTH;
                return;
            }
            let totalWidth = 0;
            node.children.forEach(child => {
                calculateTreeWidth(child);
                totalWidth += child.treeWidth;
            });
            // Add gaps between children
            totalWidth += (node.children.length - 1) * HORIZONTAL_GAP;
            node.treeWidth = Math.max(NODE_WIDTH, totalWidth);
        };

        roots.forEach(calculateTreeWidth);

        // 2. Assign Positions (Recursive Pre-Order)
        const positionedNodesList: AugmentedNode[] = [];
        const assignPositions = (node: AugmentedNode, startX: number, y: number, level: number) => {
            node.level = level;
            
            // Center node relative to its own allocated width
            node.x = startX + node.treeWidth / 2; 
            node.y = y;
            positionedNodesList.push(node);

            let currentChildX = startX;
            
            // If the node is wider than its children combined (rare with this algo), center children
            const childrenTotalWidth = node.children.reduce((acc, c) => acc + c.treeWidth, 0) + (node.children.length - 1) * HORIZONTAL_GAP;
            if (childrenTotalWidth < node.treeWidth) {
                currentChildX += (node.treeWidth - childrenTotalWidth) / 2;
            }

            node.children.forEach(child => {
                assignPositions(child, currentChildX, y + VERTICAL_GAP + NODE_HEIGHT, level + 1);
                currentChildX += child.treeWidth + HORIZONTAL_GAP;
            });
        };

        let currentRootX = 0;
        roots.forEach(root => {
            assignPositions(root, currentRootX, HORIZONTAL_GAP, 0);
            currentRootX += root.treeWidth + HORIZONTAL_GAP * 2; // Gap between major trees
        });

        // 3. Handle Conclusion Node (Place at bottom, centered)
        let maxY = 0;
        let minX = Infinity;
        let maxX = -Infinity;

        positionedNodesList.forEach(n => {
            if (n.y > maxY) maxY = n.y;
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
        });

        if (conclusionNode) {
            const treeCenter = (minX + maxX) / 2;
            conclusionNode.x = treeCenter || (NODE_WIDTH / 2); // Fallback if empty
            conclusionNode.y = maxY + VERTICAL_GAP + NODE_HEIGHT;
            positionedNodesList.push(conclusionNode);
            maxY = conclusionNode.y;
        }

        // 4. Normalize Coordinates (Add padding)
        const PADDING = isMobile ? 40 : 100;
        const totalWidth = Math.max(containerSize.width, currentRootX + PADDING * 2);
        const totalHeight = maxY + NODE_HEIGHT + PADDING * 2;

        // Center the whole structure horizontally in the canvas if it's smaller than container
        const offsetX = Math.max(0, (containerSize.width - currentRootX) / 2);
        
        positionedNodesList.forEach(n => {
            n.x += offsetX + PADDING; // Shift right
            n.y += PADDING;
        });

        // 5. Generate Lines
        const lines: any[] = [];
        const linesMap = new Map(positionedNodesList.map(n => [n.id, n]));

        positionedNodesList.forEach(node => {
            if (node.parentId && linesMap.has(node.parentId) && node !== conclusionNode) {
                const parent = linesMap.get(node.parentId)!;
                lines.push({
                    x1: parent.x,
                    y1: parent.y + NODE_HEIGHT,
                    x2: node.x,
                    y2: node.y,
                    parentId: parent.id,
                    childId: node.id,
                    type: 'normal'
                });
            }
        });

        // Conclusion Lines (Connect all leaves)
        if (conclusionNode) {
            const leaves = positionedNodesList.filter(n => n !== conclusionNode && n.children.length === 0);
            // Limit connections to prevent clutter - maybe only last level leaves or major branches?
            // For now, connect reasonable leaves.
            leaves.forEach(leaf => {
                // Logic: Connect leaf if it's at the bottom-most level of its branch
                lines.push({
                    x1: leaf.x,
                    y1: leaf.y + NODE_HEIGHT,
                    x2: conclusionNode!.x,
                    y2: conclusionNode!.y,
                    parentId: leaf.id,
                    childId: conclusionNode!.id,
                    type: 'conclusion'
                });
            });
        }

        return { 
            positionedNodes: positionedNodesList, 
            lines, 
            width: totalWidth, 
            height: totalHeight, 
            isPortrait: isMobile, 
            nodeWidth: NODE_WIDTH, 
            nodeHeight: NODE_HEIGHT 
        };

    }, [nodes, containerSize]);

    useEffect(() => {
        hasCenteredRef.current = false;
    }, [isPortrait, nodes.length]);

    useLayoutEffect(() => {
        if (positionedNodes.length > 0 && containerRef.current && !hasCenteredRef.current && width > 0) {
             const root = positionedNodes.find(n => n.parentId === null) || positionedNodes[0];
             if (root) {
                const container = containerRef.current;
                // Scroll to top-center
                const scrollX = (width - container.clientWidth) / 2;
                container.scrollTo({ left: scrollX, top: 0 });
                hasCenteredRef.current = true;
             }
        }
    }, [positionedNodes.length, width]);

    const centerOnRoot = () => {
        if (positionedNodes.length > 0 && containerRef.current) {
           const container = containerRef.current;
           const scrollX = (width - container.clientWidth) / 2;
           container.scrollTo({ left: scrollX, top: 0, behavior: 'smooth' });
       }
   };

    const suggestedNodeIds = useMemo(() => new Set(suggestedPath || []), [suggestedPath]);
    const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-auto bg-background/5 touch-pan-x touch-pan-y custom-scrollbar" style={{ direction: 'ltr' }}>
            <button onClick={centerOnRoot} className="absolute z-50 p-3 transition-transform rounded-full shadow-md bottom-24 md:bottom-6 left-4 md:left-6 bg-card text-primary border border-border hover:bg-secondary hover:scale-110 active:scale-95">
               <Target className="w-5 h-5" />
            </button>

            <div className="relative transition-all duration-500 ease-out origin-top-center" style={{ width: width, height: height }}>
                <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
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

                         // Bezier Curve Calculation
                         // M x1 y1 C x1 (y1+dy) x2 (y2-dy) x2 y2
                         const dy = (line.y2 - line.y1) * 0.5;
                         const path = `M${line.x1},${line.y1} C${line.x1},${line.y1 + dy} ${line.x2},${line.y2 - dy} ${line.x2},${line.y2}`;
                         
                         return (
                            <g key={i}>
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={isConclusionLine ? "rgb(var(--success))" : "rgb(var(--border))"}
                                    strokeWidth={isActive || isSelectionInvolved ? 2.5 : 1.5}
                                    strokeOpacity={isActive || isSelectionInvolved ? 1 : (isConclusionLine ? 0.2 : 0.4)}
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
