
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle, Lock, FileQuestion } from './icons';

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
    
    return `صفحات: ${ranges.join(', ')}`;
};

const MindMap: React.FC<MindMapProps> = ({ nodes, progress, suggestedPath, onSelectNode, onTakeQuiz, theme, activeNodeId, showSuggestedPath }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100); // Delay for animation
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setContainerSize({ width, height });
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const { positionedNodes, lines, width, height, isPortrait } = useMemo(() => {
        if (nodes.length === 0 || containerSize.width === 0) {
            return { positionedNodes: [], lines: [], width: 0, height: 0, isPortrait: false };
        }

        const isPortraitLayout = containerSize.width < 768;

        const R_NODE_WIDTH = isPortraitLayout ? 180 : 160;
        const R_NODE_HEIGHT = isPortraitLayout ? 80 : 70; // Increased height for mobile
        const R_H_GAP = isPortraitLayout ? 80 : 50;
        const R_V_GAP = isPortraitLayout ? 40 : 90;

        type NodeWithChildren = MindMapNodeType & { children: NodeWithChildren[], level: number, x: number, y: number };
        const nodeMap = new Map<string, NodeWithChildren>(nodes.map(n => [n.id, { ...n, children: [], level: 0, x: 0, y: 0 }]));
        const roots: NodeWithChildren[] = [];

        nodes.forEach(node => {
            if (node.parentId && nodeMap.has(node.parentId)) {
                nodeMap.get(node.parentId)!.children.push(nodeMap.get(node.id)!);
            } else {
                roots.push(nodeMap.get(node.id)!);
            }
        });

        const levels: NodeWithChildren[][] = [];
        
        function assignLevels(node: MindMapNodeType, level: number) {
            const positionedNode = nodeMap.get(node.id)!;
            if(positionedNode.level > 0 && positionedNode.level !== level) return;
            if(positionedNode.level > 0) return;
            
            positionedNode.level = level;
            if (!levels[level]) {
                levels[level] = [];
            }
            levels[level].push(positionedNode);
            positionedNode.children.forEach(child => assignLevels(child, level + 1));
        }

        roots.forEach(root => assignLevels(root, 0));
        
        const positionedNodesList: NodeWithChildren[] = [];
        const lines: { x1: number, y1: number, x2: number, y2: number, parentId: string, childId: string }[] = [];
        let finalWidth = 0;
        let finalHeight = 0;
        const PADDING = 30;

        if (isPortraitLayout) {
            // Vertical Layout Logic
            let yOffset = 0;
            levels.forEach((levelNodes, level) => {
                let xOffset = level * (R_NODE_WIDTH + R_H_GAP);
                levelNodes.forEach((node, i) => {
                    node.x = xOffset;
                    node.y = yOffset + i * (R_NODE_HEIGHT + R_V_GAP);
                    positionedNodesList.push(node);
                });
            });

            const positionedNodesMap = new Map<string, NodeWithChildren>(positionedNodesList.map(n => [n.id, n]));
            
            let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;

            const calculateTreeLayout = (node: NodeWithChildren, level: number, yPos: number): number => {
                node.x = level * (R_NODE_WIDTH + R_H_GAP);
                
                if (node.children.length === 0) {
                    node.y = yPos;
                    minY = Math.min(minY, node.y);
                    maxY = Math.max(maxY, node.y + R_NODE_HEIGHT);
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x + R_NODE_WIDTH);
                    return yPos + R_NODE_HEIGHT + R_V_GAP;
                }
                
                let currentY = yPos;
                const childYPositions: number[] = [];
                node.children.forEach(child => {
                    const childNode = positionedNodesMap.get(child.id)!;
                    childYPositions.push(currentY + (childNode.children.length > 0 ? (R_NODE_HEIGHT / 2) : 0));
                    currentY = calculateTreeLayout(childNode, level + 1, currentY);
                });
                
                const firstChildY = positionedNodesMap.get(node.children[0].id)!.y;
                const lastChildY = positionedNodesMap.get(node.children[node.children.length - 1].id)!.y;
                node.y = firstChildY + (lastChildY - firstChildY) / 2;

                minY = Math.min(minY, node.y);
                maxY = Math.max(maxY, node.y + R_NODE_HEIGHT);
                minX = Math.min(minX, node.x);
                maxX = Math.max(maxX, node.x + R_NODE_WIDTH);

                return currentY;
            }

            calculateTreeLayout(roots[0], 0, 0);

            positionedNodesMap.forEach(node => {
                if(node.parentId) {
                    const parent = positionedNodesMap.get(node.parentId)!;
                     lines.push({
                        x1: parent.x + R_NODE_WIDTH,
                        y1: parent.y + R_NODE_HEIGHT / 2,
                        x2: node.x,
                        y2: node.y + R_NODE_HEIGHT / 2,
                        parentId: parent.id,
                        childId: node.id,
                    });
                }
            });

            finalWidth = maxX - minX + PADDING * 2;
            finalHeight = maxY - minY + PADDING * 2;

            positionedNodesMap.forEach(node => {
                node.x = node.x - minX + PADDING;
                node.y = node.y - minY + PADDING;
            });
            lines.forEach(line => {
                line.x1 = line.x1 - minX + PADDING;
                line.y1 = line.y1 - minY + PADDING;
                line.x2 = line.x2 - minX + PADDING;
                line.y2 = line.y2 - minY + PADDING;
            });

            return { positionedNodes: Array.from(positionedNodesMap.values()), lines, width: finalWidth, height: finalHeight, isPortrait: isPortraitLayout };

        } else {
            // Horizontal Layout Logic
            const maxWidth = (Math.max(...levels.map(level => level.length)) * (R_NODE_WIDTH + R_H_GAP));
            levels.forEach((levelNodes, level) => {
                const levelWidth = levelNodes.length * (R_NODE_WIDTH + R_H_GAP);
                const startX = (maxWidth - levelWidth) / 2;
                levelNodes.forEach((node, i) => {
                    node.x = startX + i * (R_NODE_WIDTH + R_H_GAP);
                    node.y = level * (R_NODE_HEIGHT + R_V_GAP);
                    positionedNodesList.push(node);
                });
            });
            
            const positionedNodesMap = new Map<string, NodeWithChildren>(positionedNodesList.map(n => [n.id, n]));
            positionedNodesList.forEach(node => {
                node.children.forEach(child => {
                     const childNode = positionedNodesMap.get(child.id);
                     if(childNode) {
                        lines.push({
                            x1: node.x + R_NODE_WIDTH / 2,
                            y1: node.y + R_NODE_HEIGHT,
                            x2: childNode.x + R_NODE_WIDTH / 2,
                            y2: childNode.y,
                            parentId: node.id,
                            childId: child.id,
                        });
                     }
                });
            });
            
            finalWidth = maxWidth + PADDING * 2;
            finalHeight = (levels.length * (R_NODE_HEIGHT + R_V_GAP)) - R_V_GAP + PADDING * 2;
        }

        positionedNodesList.forEach(n => { n.x += PADDING; n.y += PADDING; });
        lines.forEach(l => { l.x1 += PADDING; l.x2 += PADDING; l.y1 += PADDING; l.y2 += PADDING; });

        return { positionedNodes: positionedNodesList, lines, width: finalWidth, height: finalHeight, isPortrait: isPortraitLayout };

    }, [nodes, containerSize]);

    const needsHorizontalScroll = width > containerSize.width;
    const justificationClass = needsHorizontalScroll ? 'justify-start' : 'justify-center';
    
    const suggestedNodeIds = useMemo(() => new Set(suggestedPath || []), [suggestedPath]);

    const NodeComponent: React.FC<{ node: MindMapNodeType & { x?: number, y?: number }; index: number }> = ({ node, index }) => {
        const status = progress[node.id];
        const isLocked = node.locked && status !== 'completed';
        const isSuggestedAndIncomplete = showSuggestedPath && suggestedPath?.includes(node.id) && status !== 'completed';
        const suggestedIndex = showSuggestedPath && suggestedPath ? suggestedPath.indexOf(node.id) : -1;
        const isActive = activeNodeId === node.id;

        const R_NODE_WIDTH = isPortrait ? 180 : 160;
        const R_NODE_HEIGHT = isPortrait ? 80 : 70;

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
                className={`mindmap-node ${isVisible ? 'mindmap-node-visible' : ''} ${isActive ? 'active-node' : ''} ${isSuggestedAndIncomplete ? 'suggested-node' : ''} absolute flex flex-col items-center justify-center p-3 text-center border-2 rounded-lg shadow-lg cursor-pointer bg-card text-card-foreground ${borderClass}`}
                style={{
                    left: node.x,
                    top: node.y,
                    width: R_NODE_WIDTH,
                    height: R_NODE_HEIGHT,
                    transitionDelay: `${index * 50}ms`
                }}
                onClick={handleNodeClick}
                aria-disabled={isLocked}
                role="button"
                tabIndex={isLocked ? -1 : 0}
            >
                {isLocked && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm"><Lock className="w-6 h-6 text-muted-foreground" /></div>}
                
                {/* Difficulty Badge - Bottom Left */}
                <div 
                    className={`absolute bottom-2 left-2 w-3 h-3 rounded-full ${difficultyColorClass}`}
                    title={`سطح دشواری: ${difficultyLevelText}`}
                />

                {/* Suggested Path Step Number */}
                {isSuggestedAndIncomplete && suggestedIndex !== -1 && (
                    <div className="absolute flex items-center justify-center w-6 h-6 font-bold rounded-full -top-2 -right-2 bg-primary text-primary-foreground text-xs ring-2 ring-background">
                        {suggestedIndex + 1}
                    </div>
                )}

                <div className="flex flex-col items-center justify-center flex-grow">
                    <h3 className="text-sm font-bold">{node.title}</h3>
                    {node.sourcePages && node.sourcePages.length > 0 && 
                        <p className="mt-1 text-xs text-muted-foreground">{formatPageNumbers(node.sourcePages)}</p>
                    }
                </div>
                
                {/* Quiz Icon Button - Bottom Right */}
                {status !== 'completed' && !isLocked && !isIntroNode && (
                    <button 
                        onClick={handleQuizClick} 
                        className="absolute bottom-2 right-2 flex items-center justify-center w-7 h-7 rounded-full text-primary-foreground bg-primary hover:bg-primary-hover active:scale-95 transition-transform"
                        title="شروع آزمون"
                    >
                        <FileQuestion className="w-4 h-4" />
                    </button>
                )}

                {/* Completion Check - Bottom Center */}
                {status === 'completed' && (
                    <div className="absolute flex items-center justify-center w-6 h-6 rounded-full -bottom-3 bg-success">
                        <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={containerRef} className={`relative flex items-start w-full h-full ${justificationClass}`}>
            <div className="relative" style={{ width, height }}>
                <svg className="absolute top-0 left-0" style={{ width, height, overflow: 'visible' }}>
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
                            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--muted))" />
                        </marker>
                    </defs>
                    {lines.map((line, i) => {
                         const isActive = activeNodeId === line.parentId || activeNodeId === line.childId;
                         const isSuggested = showSuggestedPath && suggestedNodeIds.has(line.parentId) && suggestedNodeIds.has(line.childId);
                         const R_H_GAP = isPortrait ? 80 : 50;
                         const R_V_GAP = isPortrait ? 40 : 90;
                         const path = isPortrait
                            ? `M${line.x1},${line.y1} C${line.x1 + R_H_GAP / 2},${line.y1} ${line.x2 - R_H_GAP / 2},${line.y2} ${line.x2},${line.y2}`
                            : `M${line.x1},${line.y1} C${line.x1},${line.y1 + R_V_GAP / 2} ${line.x2},${line.y2 - R_V_GAP / 2} ${line.x2},${line.y2}`;
                         
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
