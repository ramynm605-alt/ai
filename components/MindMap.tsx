
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle, Sparkles } from './icons';
import ParticleBackground from './ParticleBackground';

interface MindMapProps {
    nodes: MindMapNodeType[];
    progress: { [key: string]: 'completed' | 'failed' | 'in_progress' };
    suggestedPath: string[] | null;
    onSelectNode: (id: string) => void;
    onTakeQuiz: (id: string) => void;
    theme: 'light' | 'balanced' | 'dark';
    activeNodeId: string | null;
}

const NODE_WIDTH_LANDSCAPE = 160;
const NODE_HEIGHT_LANDSCAPE = 70;
const H_GAP_LANDSCAPE = 50;
const V_GAP_LANDSCAPE = 90;

const NODE_WIDTH_PORTRAIT = 120;
const NODE_HEIGHT_PORTRAIT = 80; // Taller to accommodate wrapped text
const H_GAP_PORTRAIT = 20;
const V_GAP_PORTRAIT = 70;

const formatPageNumbers = (pages: number[]): string => {
    if (!pages || pages.length === 0) return '';
    
    const sortedPages = [...new Set(pages)].sort((a, b) => a - b);
    
    if (sortedPages.length === 0) return '';
    
    const ranges: string[] = [];
    let start = sortedPages[0];
    let end = sortedPages[0];

    for (let i = 1; i < sortedPages.length; i++) {
        if (sortedPages[i] === end + 1) {
            end = sortedPages[i];
        } else {
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            start = end = sortedPages[i];
        }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    
    return `ص: ${ranges.join(', ')}`;
};


// Node component - purely for presentation
const MindMapNode: React.FC<{
    node: MindMapNodeType;
    progress: MindMapProps['progress'];
    onSelectNode: MindMapProps['onSelectNode'];
    style: React.CSSProperties;
    isOnSuggestedPath: boolean;
    isActive: boolean;
    className: string;
}> = ({ node, progress, onSelectNode, style, isOnSuggestedPath, isActive, className }) => {
    
    const isCompleted = progress[node.id] === 'completed';
    const isLocked = node.locked && !isCompleted;

    const pageInfo = formatPageNumbers(node.sourcePages);

    let baseClasses = 'min-h-[70px] p-2 rounded-2xl flex flex-col items-center justify-center text-card-foreground text-sm font-semibold relative border-2 select-none shadow-md bg-card transition-all duration-300';
    let borderClasses = '';
    let glowClasses = '';

    if (isActive) {
        baseClasses += ' scale-110';
        borderClasses = 'border-primary';
        glowClasses = 'shadow-[0_0_15px_rgb(var(--primary))]';
    } else if (isLocked) {
        baseClasses += ' opacity-50 grayscale cursor-not-allowed';
        borderClasses = 'border-muted';
    } else {
        baseClasses += ' cursor-pointer hover:scale-105';
        if (isOnSuggestedPath && !isCompleted) {
            borderClasses = 'border-primary';
            glowClasses = 'shadow-[0_0_15px_rgb(var(--primary)_/_0.5)]';
        } else if (isCompleted) {
            borderClasses = 'border-success';
            glowClasses = 'hover:shadow-[0_0_15px_rgb(var(--success))]';
        } else {
            if (node.isExplanatory) {
                borderClasses = 'border-accent';
                glowClasses = 'hover:shadow-[0_0_15px_rgb(var(--accent))]';
            } else if (node.difficulty < 0.4) {
                borderClasses = 'border-border';
                glowClasses = 'hover:shadow-[0_0_15px_rgb(var(--foreground)_/_0.5)]';
            } else if (node.difficulty < 0.7) {
                borderClasses = 'border-muted';
                glowClasses = 'hover:shadow-[0_0_15px_rgb(var(--muted))]';
            } else {
                borderClasses = 'border-destructive';
                glowClasses = 'hover:shadow-[0_0_15px_rgb(var(--destructive))]';
            }
        }
    }
    
    const handleClick = () => {
        if (!isLocked) {
            onSelectNode(node.id);
        }
    };

    return (
        <div style={style} className={`${baseClasses} ${borderClasses} ${glowClasses} ${className}`} onClick={handleClick}>
             {isCompleted && <CheckCircle className="absolute w-6 h-6 p-0.5 text-success bg-card rounded-full -top-2 -right-2" />}
            <span className="text-center">{node.title}</span>
            {pageInfo && <span className="mt-1 text-xs font-normal text-muted-foreground">{pageInfo}</span>}
        </div>
    );
};

// Main MindMap component
const MindMap: React.FC<MindMapProps> = ({ nodes, progress, suggestedPath, onSelectNode, theme, activeNodeId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0 && (width !== containerSize.width || height !== containerSize.height)) {
                    setContainerSize({ width, height });
                }
            }
        });
        const currentRef = containerRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }
        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [containerSize.width, containerSize.height]);

    const { positions, mapWidth, mapHeight, vGap, nodeWidth } = useMemo(() => {
        if (nodes.length === 0) {
          return { positions: {}, mapWidth: 0, mapHeight: 0, vGap: V_GAP_LANDSCAPE, nodeWidth: NODE_WIDTH_LANDSCAPE };
        }

        type MindMapNodeWithChildren = Omit<MindMapNodeType, 'children'> & { children: MindMapNodeWithChildren[] };

        const buildTree = (list: MindMapNodeType[]): MindMapNodeWithChildren[] => {
            const map = new Map<string, MindMapNodeWithChildren>();
            list.forEach(node => {
                map.set(node.id, { ...node, children: [] });
            });

            const roots: MindMapNodeWithChildren[] = [];
            map.forEach(node => {
                if (node.parentId && map.has(node.parentId)) {
                    map.get(node.parentId)!.children.push(node);
                } else {
                    roots.push(node);
                }
            });
            return roots;
        };

        const tree = buildTree(nodes);
        const nodeLevelMap = new Map<string, number>();
        const q: [MindMapNodeWithChildren, number][] = tree.map(n => [n, 0]);
        while(q.length > 0) {
            const [node, level] = q.shift()!;
            nodeLevelMap.set(node.id, level);
            node.children.forEach(child => q.push([child, level + 1]));
        }

        const nodesPerLevel: { [level: number]: number } = {};
        for (const level of nodeLevelMap.values()) {
            nodesPerLevel[level] = (nodesPerLevel[level] || 0) + 1;
        }
        const widestLevelCount = Math.max(1, ...Object.values(nodesPerLevel));

        const isPortrait = containerSize.width > 0 && containerSize.height > containerSize.width;

        let NODE_WIDTH = isPortrait ? NODE_WIDTH_PORTRAIT : NODE_WIDTH_LANDSCAPE;
        let NODE_HEIGHT = isPortrait ? NODE_HEIGHT_PORTRAIT : NODE_HEIGHT_LANDSCAPE;
        let H_GAP = isPortrait ? H_GAP_PORTRAIT : H_GAP_LANDSCAPE;
        
        const requiredWidth = (widestLevelCount * NODE_WIDTH) + Math.max(0, widestLevelCount - 1) * H_GAP;
        const availableWidth = containerSize.width - 16; // some padding
        
        if (isPortrait && availableWidth > 0 && requiredWidth > availableWidth) {
            const ratio = availableWidth / requiredWidth;
            NODE_WIDTH *= ratio;
            H_GAP *= ratio;
        }


        const maxLevel = Math.max(0, ...Array.from(nodeLevelMap.values()));
        const numLevels = maxLevel + 1;
        const V_GAP = isPortrait ? V_GAP_PORTRAIT : V_GAP_LANDSCAPE;
        
        const defaultTotalHeight = numLevels * NODE_HEIGHT + Math.max(0, numLevels - 1) * V_GAP;
        let dynamicVGap = V_GAP;
        
        if (containerSize.height > defaultTotalHeight && numLevels > 1) {
            const availableHeight = containerSize.height - 16; // some padding
            if (availableHeight > defaultTotalHeight) {
                dynamicVGap = (availableHeight - numLevels * NODE_HEIGHT) / (numLevels - 1);
            }
        }

        const finalPositions: { [key: string]: { node: MindMapNodeType; x: number; y: number; level: number } } = {};
        const next: { [level: number]: number } = {};
        const mod: { [level: number]: number } = {};
        
        const setInitialX = (node: MindMapNodeWithChildren) => {
            node.children.forEach(child => setInitialX(child));
            const level = nodeLevelMap.get(node.id)!;
            if (!next[level]) next[level] = 0;
            if (!mod[level]) mod[level] = 0;

            let x = next[level];
            let modSum = 0;

            if (node.children.length > 0) {
                const firstChildX = finalPositions[node.children[0].id].x;
                const lastChildX = finalPositions[node.children[node.children.length - 1].id].x;
                x = (firstChildX + lastChildX) / 2;
            }
            modSum = next[level] > x ? next[level] - x : 0;
            
            finalPositions[node.id] = {
                node: nodes.find(n => n.id === node.id)!,
                x: x,
                y: 0, // y is set in the next pass
                level,
            };

            mod[level] += modSum;
            next[level] = x + NODE_WIDTH + H_GAP + modSum;
        };

        tree.slice().reverse().forEach(root => setInitialX(root));

        let maxWidth = 0;

        const calculateFinalX = (node: MindMapNodeWithChildren, modSum = 0) => {
            const level = nodeLevelMap.get(node.id)!;
            const y = level * (NODE_HEIGHT + dynamicVGap);
            const x = finalPositions[node.id].x + modSum;

            finalPositions[node.id].x = x;
            finalPositions[node.id].y = y;

            if (x > maxWidth) { maxWidth = x; }

            let childModSum = modSum;
            if (mod[level]) childModSum += mod[level];
            
            node.children.forEach(child => calculateFinalX(child, childModSum));
        };

        tree.forEach(root => calculateFinalX(root));

        const minX = Math.min(0, ...Object.values(finalPositions).map(p => p.x));
        if (minX < 0) {
            Object.values(finalPositions).forEach(p => p.x -= minX);
            maxWidth -= minX;
        }

        const calculatedWidth = maxWidth + NODE_WIDTH;
        const calculatedHeight = numLevels * NODE_HEIGHT + Math.max(0, numLevels - 1) * dynamicVGap;

        return { positions: finalPositions, mapWidth: calculatedWidth, mapHeight: calculatedHeight, vGap: dynamicVGap, nodeWidth: NODE_WIDTH };
    }, [nodes, containerSize]);

    const scale = useMemo(() => {
        if (!containerSize.width || !containerSize.height || !mapWidth || !mapHeight) {
            return 1;
        }
        
        const scaleX = (containerSize.width / mapWidth);
        const scaleY = (containerSize.height / mapHeight);
        
        // Don't scale up, only scale down to fit the container.
        return Math.min(scaleX, scaleY, 1);
    }, [containerSize, mapWidth, mapHeight]);
    
    return (
        <div ref={containerRef} className="relative flex items-start justify-end w-full h-full p-4 overflow-auto">
            <div 
                className="relative" 
                style={{ 
                    width: mapWidth, 
                    height: mapHeight, 
                    transform: `scale(${scale})`, 
                    transformOrigin: 'top left' 
                }}
            >
                <ParticleBackground theme={theme} />
                <svg className="absolute top-0 left-0" style={{ width: mapWidth, height: mapHeight }}>
                    <defs>
                        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{stopColor: 'rgb(var(--muted))', stopOpacity: 0.8}} />
                            <stop offset="100%" style={{stopColor: 'rgb(var(--muted))', stopOpacity: 0.2}} />
                        </linearGradient>
                    </defs>
                    {nodes.filter(node => node.parentId && positions[node.id] && positions[node.parentId]).map(node => {
                        const parentPos = positions[node.parentId];
                        const childPos = positions[node.id];
                        const isPortrait = containerSize.width > 0 && containerSize.height > containerSize.width;
                        const NODE_HEIGHT = isPortrait ? NODE_HEIGHT_PORTRAIT : NODE_HEIGHT_LANDSCAPE;

                        const d = `M ${parentPos.x + nodeWidth / 2} ${parentPos.y + NODE_HEIGHT} C ${parentPos.x + nodeWidth / 2} ${parentPos.y + NODE_HEIGHT + vGap/2}, ${childPos.x + nodeWidth / 2} ${childPos.y - vGap/2}, ${childPos.x + nodeWidth / 2} ${childPos.y}`;
                        
                        const isActiveLine = childPos.node.id === activeNodeId;
                        const lineClasses = `mindmap-line ${isMounted ? 'mindmap-line-visible' : ''} ${isActiveLine ? 'mindmap-line-active' : ''}`;
                        const transitionDelay = `${parentPos.level * 100 + 50}ms`;

                        return (
                            <path 
                                key={`${node.parentId}-${node.id}`} 
                                d={d} 
                                stroke={isActiveLine ? '' : "url(#line-gradient)"} 
                                strokeWidth="2" 
                                fill="none"
                                className={lineClasses}
                                style={{ transitionDelay }}
                            />
                        );
                    })}
                </svg>
                <div className="relative">
                    {Object.values(positions).map(({ node, x, y, level }) => (
                        <MindMapNode
                            key={node.id}
                            node={node}
                            progress={progress}
                            onSelectNode={onSelectNode}
                            style={{
                                position: 'absolute',
                                left: x,
                                top: y,
                                width: nodeWidth,
                                transitionDelay: `${level * 100}ms`
                            }}
                            isOnSuggestedPath={!!suggestedPath?.includes(node.id)}
                            isActive={node.id === activeNodeId}
                            className={`mindmap-node ${isMounted ? 'mindmap-node-visible' : ''}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MindMap;
