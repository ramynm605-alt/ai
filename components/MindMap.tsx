
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle, Lock, FileQuestion, Target, Flag, Trophy, Sparkles } from './icons';

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

        // Updated dimensions for the new card design
        const R_NODE_WIDTH = isPortraitLayout ? 160 : 220;
        const R_NODE_HEIGHT = isPortraitLayout ? 100 : 130;
        const R_H_GAP = isPortraitLayout ? 30 : 70; 
        const R_V_GAP = isPortraitLayout ? 70 : 100; 


        type NodeWithChildren = MindMapNodeType & { children: NodeWithChildren[], level: number, x: number, y: number };
        const nodeMap = new Map<string, NodeWithChildren>(nodes.map(n => [n.id, { ...n, children: [], level: 0, x: 0, y: 0 }]));
        const roots: NodeWithChildren[] = [];

        // Identify Conclusion Node to treat it specially
        let conclusionNodeId: string | null = null;
        const isConclusion = (title: string) => title.includes('نتیجه‌گیری') || title.includes('جمع‌بندی') || title.toLowerCase().includes('conclusion');
        
        const conclusionEntry = nodes.find(n => isConclusion(n.title));
        if (conclusionEntry) {
            conclusionNodeId = conclusionEntry.id;
        }

        // Build Tree Structure
        nodes.forEach(node => {
            const nodeObj = nodeMap.get(node.id)!;
            
            // SKIP adding conclusion node to the tree structure here
            if (node.id === conclusionNodeId) return;

            if (node.parentId && nodeMap.has(node.parentId)) {
                const parent = nodeMap.get(node.parentId)!;
                // Prevent circular reference or adding conclusion as parent in logic
                if (parent.id !== conclusionNodeId) {
                    parent.children.push(nodeObj);
                }
            } else {
                roots.push(nodeObj);
            }
        });

        // Defensive: If no roots found (circular or broken), force first node as root
        if (roots.length === 0 && nodes.length > 0 && !conclusionNodeId) {
             // Only if conclusion wasn't the only node
             if (nodes.length > 1 || (nodes.length === 1 && nodes[0].id !== conclusionNodeId)) {
                 const first = nodeMap.get(nodes[0].id)!;
                 if (first.id !== conclusionNodeId) roots.push(first);
             }
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
        const lines: { x1: number, y1: number, x2: number, y2: number, parentId: string, childId: string, type?: 'normal' | 'conclusion' }[] = [];
        // Increased padding to prevent cut-off
        const PADDING = 100;
        let finalWidth = 0;
        let finalHeight = 0;

        // Standard layout
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

        // Calculate Bounds of the tree
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

        // Position Conclusion Node at the bottom center
        if (conclusionNodeId) {
            const cNode = nodeMap.get(conclusionNodeId)!;
            // Center relative to the entire tree width
            const treeCenter = (minX + maxX) / 2;
            
            cNode.x = treeCenter; // Centered relative to bounds
            cNode.y = maxY + R_V_GAP * 1.5; // Add extra gap below the tree
            
            positionedNodesList.push(cNode);
            
            // Update bounds
            minX = Math.min(minX, cNode.x);
            maxX = Math.max(maxX, cNode.x);
            maxY = Math.max(maxY, cNode.y);
        }

        finalWidth = (maxX - minX) + R_NODE_WIDTH + PADDING * 2;
        finalHeight = (maxY) + R_NODE_HEIGHT + PADDING * 2;

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
            // Standard Lines (Parent -> Child)
            // Skip if node is Conclusion (we handle its connections separately)
            if (node.id !== conclusionNodeId && node.parentId && positionedNodesMap.has(node.parentId)) {
                const parent = positionedNodesMap.get(node.parentId)!;
                // Don't draw line if parent is Conclusion (shouldn't happen logic wise but safety first)
                if (parent.id !== conclusionNodeId) {
                    lines.push({
                        x1: parent.x + R_NODE_WIDTH / 2,
                        y1: parent.y + R_NODE_HEIGHT,
                        x2: node.x + R_NODE_WIDTH / 2,
                        y2: node.y,
                        parentId: parent.id,
                        childId: node.id,
                        type: 'normal'
                    });
                }
            }
        });

        // Generate Conclusion Lines (Leaf Nodes -> Conclusion)
        if (conclusionNodeId && positionedNodesMap.has(conclusionNodeId)) {
            const cNode = positionedNodesMap.get(conclusionNodeId)!;
            
            // Find leaf nodes (nodes with no children in the layout)
            // We iterate positionedNodesList because `node.children` was populated earlier
            // Only consider 'core' or 'remedial' nodes, not the conclusion itself
            const leafNodes = positionedNodesList.filter(n => 
                n.id !== conclusionNodeId && 
                n.children.length === 0
            );

            leafNodes.forEach(leaf => {
                lines.push({
                    x1: leaf.x + R_NODE_WIDTH / 2,
                    y1: leaf.y + R_NODE_HEIGHT,
                    x2: cNode.x + R_NODE_WIDTH / 2,
                    y2: cNode.y,
                    parentId: leaf.id,
                    childId: cNode.id,
                    type: 'conclusion'
                });
            });
        }

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
        const isRemedial = node.type === 'remedial';
        
        // Determine node type
        const isIntro = node.parentId === null;
        const isConclusion = node.title.includes('نتیجه‌گیری') || node.title.includes('جمع‌بندی') || node.title.toLowerCase().includes('conclusion');

        const handleNodeClick = () => {
            if (!isLocked) {
                onSelectNode(node.id);
            }
        };

        const handleQuizClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onTakeQuiz(node.id);
        };

        // Difficulty Color Bar
        let difficultyColor = 'bg-primary';
        if (isRemedial) difficultyColor = 'bg-purple-500';
        else if (node.difficulty < 0.4) difficultyColor = 'bg-success';
        else if (node.difficulty > 0.7) difficultyColor = 'bg-destructive';

        const baseStyle = {
            left: node.x,
            top: node.y,
            width: nodeWidth,
            height: nodeHeight,
            transitionDelay: `${index * 50}ms`,
            zIndex: isActive ? 50 : (isLocked ? 10 : 20),
            opacity: isLocked ? 0.75 : 1,
            filter: isLocked ? 'grayscale(0.8)' : 'none',
        };

        // 1. Introduction Node Design
        if (isIntro) {
            return (
                <div
                    className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute cursor-pointer transition-all duration-300`}
                    style={baseStyle}
                    onClick={handleNodeClick}
                    role="button"
                >
                    <div className={`absolute inset-0 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center p-4 border-2 transition-transform hover:scale-105 ${isActive ? 'ring-4 ring-primary/30' : ''} bg-gradient-to-br from-primary via-primary/90 to-primary/70 border-primary-foreground/20 text-primary-foreground`}>
                        <Flag className="w-8 h-8 mb-2 opacity-90" />
                        <h3 className={`font-bold leading-tight ${isPortrait ? 'text-sm' : 'text-lg'}`}>{node.title}</h3>
                        <span className="text-xs opacity-80 mt-1 font-medium bg-primary-foreground/20 px-2 py-0.5 rounded-full">شروع مسیر</span>
                    </div>
                    {status === 'completed' && (
                        <div className="absolute -top-2 -right-2 z-30 bg-card rounded-full p-1 shadow-md ring-2 ring-success">
                            <CheckCircle className="w-5 h-5 text-success fill-current" />
                        </div>
                     )}
                </div>
            );
        }

        // 2. Conclusion Node Design
        if (isConclusion) {
             return (
                <div
                    className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} absolute cursor-pointer transition-all duration-300`}
                    style={baseStyle}
                    onClick={handleNodeClick}
                    role="button"
                >
                    <div className={`absolute inset-0 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center p-4 border-2 transition-transform hover:scale-105 ${isActive ? 'ring-4 ring-success/30' : ''} ${isLocked ? 'bg-muted' : 'bg-gradient-to-br from-emerald-500 to-teal-600 border-white/20 text-white'}`}>
                        {status === 'completed' ? 
                            <Trophy className="w-8 h-8 mb-2 text-yellow-300 drop-shadow-md" /> : 
                            <Target className="w-8 h-8 mb-2 opacity-90" />
                        }
                        <h3 className={`font-bold leading-tight ${isPortrait ? 'text-sm' : 'text-lg'}`}>{node.title}</h3>
                         <span className="text-xs opacity-80 mt-1 font-medium bg-white/20 px-2 py-0.5 rounded-full">پایان مسیر</span>
                    </div>
                </div>
            );
        }

        // 3. Standard & Remedial Node Design
        return (
            <div
                className={`mindmap-node group ${isVisible ? 'mindmap-node-visible' : ''} ${isActive ? 'active-node' : ''} ${isSuggestedAndIncomplete ? 'suggested-node' : ''} absolute rounded-xl transition-all duration-300 cursor-pointer`}
                style={baseStyle}
                onClick={handleNodeClick}
                role="button"
                tabIndex={isLocked ? -1 : 0}
            >
                 <div className={`absolute inset-0 bg-card rounded-xl border transition-all overflow-hidden flex flex-col shadow-sm hover:shadow-md ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border group-hover:border-primary/50'} ${isRemedial ? 'border-dashed border-2 border-purple-400 bg-purple-50 dark:bg-purple-900/10' : ''}`}>
                    
                    {/* Colored Difficulty Strip (Left side in LTR, Right side in RTL layout) */}
                    <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${difficultyColor} opacity-80`} />

                    <div className="flex-1 p-3 pl-3 pr-4 flex flex-col justify-between relative z-10">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                             <h3 className={`font-bold leading-snug text-foreground line-clamp-2 ${isPortrait ? 'text-xs' : 'text-sm'} ${isRemedial ? 'text-purple-700 dark:text-purple-300' : ''}`} dir="rtl">
                                {node.title}
                             </h3>
                             {isLocked && <Lock className="w-4 h-4 text-muted-foreground/70 shrink-0" />}
                        </div>

                        {/* Footer info */}
                        <div className="flex items-end justify-between mt-2">
                             <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                {formatPageNumbers(node.sourcePages) || (isRemedial ? 'تقویتی' : (node.isExplanatory ? 'توضیحی' : 'درس'))}
                            </span>

                            {!isLocked && status !== 'completed' && (
                                 <div className="text-primary/30 group-hover:text-primary transition-colors">
                                     {isRemedial ? <Sparkles className="w-5 h-5 text-purple-500" /> : <FileQuestion className="w-5 h-5" />}
                                 </div>
                            )}
                        </div>
                    </div>
                 </div>

                 {/* Status Badges (Pop out) */}
                 {status === 'completed' && (
                    <div className="absolute -top-2 -left-2 z-30 bg-card rounded-full p-0.5 shadow-md ring-1 ring-success/20">
                        <CheckCircle className="w-5 h-5 text-success fill-current" />
                    </div>
                 )}
                 
                 {isSuggestedAndIncomplete && suggestedIndex !== -1 && (
                    <div className="absolute -top-3 -left-3 z-30 flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-primary shadow-md ring-2 ring-background animate-bounce">
                        {suggestedIndex + 1}
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
                        <marker id="arrow-conclusion" viewBox="0 0 10 10" refX="8" refY="5"
                            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--success))" opacity="0.6" />
                        </marker>
                    </defs>
                    {lines.map((line, i) => {
                         const isActive = activeNodeId === line.parentId || activeNodeId === line.childId;
                         const isSuggested = showSuggestedPath && suggestedNodeIds.has(line.parentId) && suggestedNodeIds.has(line.childId);
                         const isConclusionLine = line.type === 'conclusion';
                         
                         // Curve calculation
                         const path = `M${line.x1},${line.y1} C${line.x1},${line.y1 + (line.y2 - line.y1) / 2} ${line.x2},${line.y2 - (line.y2 - line.y1) / 2} ${line.x2},${line.y2}`;
                         
                         return (
                            <path
                                key={i}
                                d={path}
                                fill="none"
                                stroke={isConclusionLine ? "rgb(var(--success))" : "rgb(var(--border))"}
                                strokeWidth={isActive ? 2.5 : 1.5}
                                strokeDasharray={isConclusionLine ? "5,5" : "none"}
                                strokeOpacity={isConclusionLine ? 0.6 : 1}
                                markerEnd={isConclusionLine ? "url(#arrow-conclusion)" : "url(#arrow)"}
                                className={`mindmap-line ${isVisible ? 'mindmap-line-visible' : ''} ${isActive ? 'mindmap-line-active' : ''} ${isSuggested && !isConclusionLine ? 'suggested-line' : ''}`}
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
