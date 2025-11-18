
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle, Lock, FileQuestion, Target } from './icons';

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

const MindMap: React.FC<MindMapProps> = ({ nodes, progress, suggestedPath, onSelectNode, onTakeQuiz, theme, activeNodeId, showSuggestedPath }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const hasCenteredRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100); // Delay for animation
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                // Only update if dimensions actually changed significantly to prevent jitter
                setContainerSize(prev => {
                    if (Math.abs(prev.width - width) < 10 && Math.abs(prev.height - height) < 50) return prev;
                    return { width, height };
                });
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const { positionedNodes, lines, width, height, isPortrait, nodeWidth, nodeHeight } = useMemo(() => {
        if (nodes.length === 0 || containerSize.width === 0) {
            return { positionedNodes: [], lines: [], width: 0, height: 0, isPortrait: false, nodeWidth: 0, nodeHeight: 0 };
        }

        const isPortraitLayout = containerSize.width < 768;

        // Dynamic sizing adjustments for Mobile
        let nodeScaleFactor = 1.0;
        if (isPortraitLayout) {
             nodeScaleFactor = 0.9; 
        }

        // Reduced gaps for tighter mobile packing
        const R_NODE_WIDTH = isPortraitLayout ? 130 * nodeScaleFactor : 160;
        const R_NODE_HEIGHT = isPortraitLayout ? 70 * nodeScaleFactor : 70;
        const R_H_GAP = isPortraitLayout ? 15 : 50; 
        const R_V_GAP = isPortraitLayout ? 60 : 90; 


        type NodeWithChildren = MindMapNodeType & { children: NodeWithChildren[], level: number, x: number, y: number };
        const nodeMap = new Map<string, NodeWithChildren>(nodes.map(n => [n.id, { ...n, children: [], level: 0, x: 0, y: 0 }]));
        const roots: NodeWithChildren[] = [];

        // Build Tree Structure
        nodes.forEach(node => {
            if (node.parentId && nodeMap.has(node.parentId)) {
                nodeMap.get(node.parentId)!.children.push(nodeMap.get(node.id)!);
            } else {
                roots.push(nodeMap.get(node.id)!);
            }
        });

        // Defensive: If no roots found (circular or broken), force first node as root
        if (roots.length === 0 && nodes.length > 0) {
             roots.push(nodeMap.get(nodes[0].id)!);
        }

        const levels: NodeWithChildren[][] = [];
        
        function assignLevels(node: MindMapNodeType, level: number) {
            const positionedNode = nodeMap.get(node.id)!;
            // Prevent infinite recursion in cyclic graphs
            if(positionedNode.level > 0 && positionedNode.level !== level) return; 
            if(positionedNode.level > 0 && level > positionedNode.level) positionedNode.level = level; 
            if(positionedNode.level === 0) positionedNode.level = level;

            if (!levels[level]) {
                levels[level] = [];
            }
            if (!levels[level].includes(positionedNode)) {
                levels[level].push(positionedNode);
            }
            positionedNode.children.forEach(child => assignLevels(child, level + 1));
        }

        roots.forEach(root => assignLevels(root, 0));
        
        const positionedNodesList: NodeWithChildren[] = [];
        const lines: { x1: number, y1: number, x2: number, y2: number, parentId: string, childId: string }[] = [];
        // Increased padding to prevent cut-off on mobile
        const PADDING = 100;
        let finalWidth = 0;
        let finalHeight = 0;

        if (isPortraitLayout) {
            // --- Vertical Tree Layout (Top-to-Bottom) for Mobile ---
            
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

        } else {
            // --- Standard Layout for Desktop (still Top-to-Bottom for Org Chart style) ---
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
        }

        // Calculate Bounds
        let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
        positionedNodesList.forEach(n => {
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x);
            maxY = Math.max(maxY, n.y);
        });

        finalWidth = maxX - minX + R_NODE_WIDTH + PADDING * 2;
        finalHeight = maxY + R_NODE_HEIGHT + PADDING * 2;

        // Normalize & RTL FLIP
        const flipX = true; 

        const positionedNodesMap = new Map(positionedNodesList.map(n => [n.id, n]));
        
        positionedNodesList.forEach(node => {
            // Normalize X to start at PADDING
            const normalizedX = node.x - minX;
            
            if (flipX) {
                // Flip: What was Left becomes Right
                node.x = (maxX - minX) - normalizedX + PADDING;
            } else {
                node.x = normalizedX + PADDING;
            }
            
            node.y = node.y + PADDING;
        });

        // Generate Lines
        positionedNodesList.forEach(node => {
            if (node.parentId && positionedNodesMap.has(node.parentId)) {
                const parent = positionedNodesMap.get(node.parentId)!;
                lines.push({
                    x1: parent.x + R_NODE_WIDTH / 2,
                    y1: parent.y + R_NODE_HEIGHT,
                    x2: node.x + R_NODE_WIDTH / 2,
                    y2: node.y,
                    parentId: parent.id,
                    childId: node.id,
                });
            }
        });

        return { positionedNodes: positionedNodesList, lines, width: finalWidth, height: finalHeight, isPortrait: isPortraitLayout, nodeWidth: R_NODE_WIDTH, nodeHeight: R_NODE_HEIGHT };

    }, [nodes, containerSize]);

    // Reset centering if layout mode changes (rotation)
    useEffect(() => {
        hasCenteredRef.current = false;
    }, [isPortrait]);

    const centerOnRoot = () => {
         if (positionedNodes.length > 0 && containerRef.current) {
            const root = positionedNodes.find(n => n.parentId === null) || positionedNodes[0];
            if (root) {
                const container = containerRef.current;
                const scrollX = root.x - (container.clientWidth / 2) + (nodeWidth / 2);
                const scrollY = root.y - (container.clientHeight / 2) + (nodeHeight / 2);
                
                container.scrollTo({
                    left: scrollX,
                    top: scrollY,
                    behavior: 'smooth'
                });
            }
        }
    };

    // Scroll to Root Node on Load (Only once per layout mode)
    useLayoutEffect(() => {
        if (positionedNodes.length > 0 && containerRef.current && !hasCenteredRef.current && width > 0) {
            // Immediate scroll without animation for initial load to prevent jump
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

    const suggestedNodeIds = useMemo(() => new Set(suggestedPath || []), [suggestedPath]);

    const NodeComponent: React.FC<{ node: MindMapNodeType & { x?: number, y?: number }; index: number }> = ({ node, index }) => {
        const status = progress[node.id];
        const isLocked = node.locked && status !== 'completed';
        const isSuggestedAndIncomplete = showSuggestedPath && suggestedPath?.includes(node.id) && status !== 'completed';
        const suggestedIndex = showSuggestedPath && suggestedPath ? suggestedPath.indexOf(node.id) : -1;
        const isActive = activeNodeId === node.id;

        let borderClass = 'border-border';
        if (status === 'completed') borderClass = 'border-success';
        else if (status === 'failed') borderClass = 'border-destructive';
        else if (isSuggestedAndIncomplete) borderClass = 'border-primary/50';

        const handleNodeClick = () => {
            if (!isLocked) {
                onSelectNode(node.id);
            }
        };

        const handleQuizClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onTakeQuiz(node.id);
        };

        const isIntroNode = node.parentId === null;

        const difficultyLevelText = node.difficulty < 0.4 ? 'آسان' : node.difficulty < 0.7 ? 'متوسط' : 'سخت';
        const difficultyColorClass = node.difficulty < 0.4 ? 'bg-success' : node.difficulty < 0.7 ? 'bg-primary' : 'bg-destructive';

        return (
            <div
                className={`mindmap-node ${isVisible ? 'mindmap-node-visible' : ''} ${isActive ? 'active-node' : ''} ${isSuggestedAndIncomplete ? 'suggested-node' : ''} absolute flex flex-col justify-between p-1.5 text-center border-2 rounded-lg shadow-lg cursor-pointer bg-card text-card-foreground ${borderClass} overflow-hidden`}
                style={{
                    left: node.x,
                    top: node.y,
                    width: nodeWidth,
                    height: nodeHeight,
                    transitionDelay: `${index * 50}ms`,
                    zIndex: isLocked ? 10 : 20 // Base z-index
                }}
                onClick={handleNodeClick}
                aria-disabled={isLocked}
                role="button"
                tabIndex={isLocked ? -1 : 0}
            >
                {isLocked && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-secondary/90 backdrop-blur-[2px]">
                        <Lock className="w-6 h-6 text-muted-foreground" />
                    </div>
                )}
                
                {isSuggestedAndIncomplete && suggestedIndex !== -1 && (
                    <div className="absolute flex items-center justify-center w-5 h-5 font-bold rounded-full -top-2 -right-2 bg-primary text-primary-foreground text-xs ring-2 ring-background z-30">
                        {suggestedIndex + 1}
                    </div>
                )}

                <div className="flex flex-col justify-center w-full h-full px-1" dir="rtl">
                    <h3 className={`${isPortrait ? 'text-xs' : 'text-sm'} font-bold leading-tight line-clamp-2`}>{node.title}</h3>
                    {node.sourcePages && node.sourcePages.length > 0 && 
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatPageNumbers(node.sourcePages)}</p>
                    }
                </div>
                
                <div className="absolute bottom-1 left-1 flex items-center gap-1">
                    <div 
                        className={`w-2 h-2 rounded-full ${difficultyColorClass}`}
                        title={`سطح دشواری: ${difficultyLevelText}`}
                    />
                </div>

                 {status !== 'completed' && !isLocked && !isIntroNode && (
                    <button 
                        onClick={handleQuizClick} 
                        className="absolute bottom-1 right-1 flex items-center justify-center w-5 h-5 transition-transform rounded-full text-primary-foreground bg-primary hover:bg-primary-hover active:scale-95 z-20"
                        title="شروع آزمون"
                    >
                        <FileQuestion className="w-2.5 h-2.5" />
                    </button>
                )}

                {status === 'completed' && (
                    <div className="absolute flex items-center justify-center w-5 h-5 rounded-full -bottom-2.5 -right-1 bg-success z-20">
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-auto bg-background/50" style={{ direction: 'ltr' }}>
             {/* direction: ltr on container prevents browser RTL scroll weirdness with absolute positioning */}
             
            <button 
                onClick={centerOnRoot}
                className="absolute z-50 p-3 transition-transform rounded-full shadow-lg bottom-6 left-6 bg-card text-primary border border-border hover:bg-accent hover:scale-110 active:scale-95"
                title="تمرکز بر مقدمه"
            >
               <Target className="w-6 h-6" />
            </button>

            <div className="relative mx-auto" style={{ width: Math.max(width, containerSize.width), height: Math.max(height, containerSize.height) }}>
                <svg className="absolute top-0 left-0" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
                            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--muted))" />
                        </marker>
                    </defs>
                    {lines.map((line, i) => {
                         const isActive = activeNodeId === line.parentId || activeNodeId === line.childId;
                         const isSuggested = showSuggestedPath && suggestedNodeIds.has(line.parentId) && suggestedNodeIds.has(line.childId);
                         
                         // Simple Bezier curve for vertical tree
                         const path = `M${line.x1},${line.y1} C${line.x1},${line.y1 + (line.y2 - line.y1) / 2} ${line.x2},${line.y2 - (line.y2 - line.y1) / 2} ${line.x2},${line.y2}`;
                         
                         return (
                            <path
                                key={i}
                                d={path}
                                fill="none"
                                stroke="rgb(var(--border))"
                                strokeWidth="2"
                                className={`mindmap-line ${isVisible ? 'mindmap-line-visible' : ''} ${isActive ? 'mindmap-line-active' : ''} ${isSuggested ? 'suggested-line' : ''}`}
                                style={{ transitionDelay: `${i * 50}ms` }}
                            />
                         );
                    })}
                </svg>
                {positionedNodes.map((node, index) => (
                    <NodeComponent key={node.id} node={node} index={index} />
                ))}
            </div>
        </div>
    );
};

export default MindMap;
