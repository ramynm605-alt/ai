
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle, Sparkles, Lock } from './icons';

interface MindMapProps {
    nodes: MindMapNodeType[];
    progress: { [key: string]: 'completed' | 'failed' | 'in_progress' };
    suggestedPath: string[] | null;
    onSelectNode: (id: string) => void;
    onTakeQuiz: (id: string) => void;
    theme: 'light' | 'balanced' | 'dark';
    activeNodeId: string | null;
}

// Unified node dimensions for all screen orientations
const NODE_WIDTH = 160;
const NODE_HEIGHT = 70;
const H_GAP = 50;
const V_GAP = 90; // Base vertical gap

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

const MindMap: React.FC<MindMapProps> = ({ nodes, progress, suggestedPath, onSelectNode, onTakeQuiz, theme, activeNodeId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100); // Delay for animation
        return () => clearTimeout(timer);
    }, []);

    const { positionedNodes, lines, width, height } = useMemo(() => {
        if (nodes.length === 0) {
            return { positionedNodes: [], lines: [], width: 0, height: 0 };
        }

        type NodeWithChildren = MindMapNodeType & { children: NodeWithChildren[], level: number, x: number, y: number };
        // FIX: The Map constructor expects an array of key-value pairs ([key, value]).
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
        
        // FIX: Changed function signature to accept MindMapNodeType to resolve recursive type issue.
        // The implementation now looks up the full NodeWithChildren from the map to ensure properties are correctly set and accessed.
        function assignLevels(node: MindMapNodeType, level: number) {
            const positionedNode = nodeMap.get(node.id)!;
            // Prevent reprocessing to avoid infinite loops in case of cyclic dependencies
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
        const maxWidth = (Math.max(...levels.map(level => level.length)) * (NODE_WIDTH + H_GAP));

        levels.forEach((levelNodes, level) => {
            const levelWidth = levelNodes.length * (NODE_WIDTH + H_GAP);
            const startX = (maxWidth - levelWidth) / 2;
            levelNodes.forEach((node, i) => {
                node.x = startX + i * (NODE_WIDTH + H_GAP);
                node.y = level * (NODE_HEIGHT + V_GAP);
                positionedNodesList.push(node);
            });
        });
        
        const positionedNodesMap = new Map<string, NodeWithChildren>(positionedNodesList.map(n => [n.id, n]));

        const lines: { x1: number, y1: number, x2: number, y2: number, parentId: string, childId: string }[] = [];
        positionedNodesList.forEach(node => {
            node.children.forEach(child => {
                 const childNode = positionedNodesMap.get(child.id);
                 if(childNode) {
                    lines.push({
                        x1: node.x + NODE_WIDTH / 2,
                        y1: node.y + NODE_HEIGHT,
                        x2: childNode.x + NODE_WIDTH / 2,
                        y2: childNode.y,
                        parentId: node.id,
                        childId: child.id,
                    });
                 }
            });
        });

        const PADDING = 20;
        const finalWidth = maxWidth + PADDING * 2;
        const finalHeight = (levels.length * (NODE_HEIGHT + V_GAP)) - V_GAP + PADDING * 2;
        
        positionedNodesList.forEach(n => {
            n.x += PADDING;
            n.y += PADDING;
        });
        lines.forEach(l => {
            l.x1 += PADDING;
            l.x2 += PADDING;
            l.y1 += PADDING;
            l.y2 += PADDING;
        });


        return { positionedNodes: positionedNodesList, lines, width: finalWidth, height: finalHeight };

    }, [nodes]);

    const NodeComponent: React.FC<{ node: MindMapNodeType & { x?: number, y?: number } }> = ({ node }) => {
        const status = progress[node.id];
        const isLocked = node.locked && status !== 'completed';
        const isSuggested = suggestedPath?.includes(node.id);
        const isActive = activeNodeId === node.id;

        let borderClass = 'border-border';
        if (isActive) borderClass = 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background';
        else if (status === 'completed') borderClass = 'border-success';
        else if (status === 'failed') borderClass = 'border-destructive';
        else if (isSuggested && !status) borderClass = 'border-primary/50';

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

        return (
            <div
                className={`mindmap-node ${isVisible ? 'mindmap-node-visible' : ''} absolute flex flex-col items-center justify-center p-3 text-center transition-all duration-300 transform border-2 rounded-lg shadow-lg cursor-pointer bg-card text-card-foreground hover:shadow-xl hover:-translate-y-1 ${borderClass}`}
                style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                onClick={handleNodeClick}
                aria-disabled={isLocked}
                role="button"
                tabIndex={isLocked ? -1 : 0}
            >
                {isLocked && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm"><Lock className="w-6 h-6 text-muted-foreground" /></div>}
                <h3 className="text-sm font-bold">{node.title}</h3>
                
                {node.sourcePages && node.sourcePages.length > 0 && 
                    <p className="mt-1 text-xs text-muted-foreground">{formatPageNumbers(node.sourcePages)}</p>
                }
                
                {isSuggested && !status && <Sparkles className="absolute w-5 h-5 -top-2 -right-2 text-primary" />}
                
                {status === 'completed' && (
                     <div className="absolute flex items-center justify-center w-6 h-6 rounded-full -bottom-3 bg-success">
                        <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                )}
                
                {status !== 'completed' && !isLocked && !isIntroNode && (
                    <button onClick={handleQuizClick} className="px-3 py-1 mt-auto text-xs font-semibold rounded-md text-primary-foreground bg-primary hover:bg-primary-hover">
                        آزمون
                    </button>
                )}

            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-auto">
            <div className="relative" style={{ width, height, minWidth: '100%', minHeight: '100%' }}>
                <svg className="absolute top-0 left-0" style={{ width, height }}>
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
                            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--muted))" />
                        </marker>
                    </defs>
                    {lines.map((line, i) => {
                         const isActive = activeNodeId === line.parentId || activeNodeId === line.childId;
                         return (
                            <path
                                key={i}
                                d={`M${line.x1},${line.y1} C${line.x1},${line.y1 + V_GAP / 2} ${line.x2},${line.y2 - V_GAP / 2} ${line.x2},${line.y2}`}
                                fill="none"
                                stroke="rgb(var(--border))"
                                strokeWidth="2"
                                className={`mindmap-line ${isVisible ? 'mindmap-line-visible' : ''} ${isActive ? 'mindmap-line-active' : ''}`}
                                style={{ transitionDelay: `${i * 50}ms` }}
                            />
                         );
                    })}
                </svg>
                {positionedNodes.map(node => (
                    <NodeComponent key={node.id} node={node} />
                ))}
            </div>
        </div>
    );
};

export default MindMap;
