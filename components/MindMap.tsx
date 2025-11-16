
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
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 70;
const H_GAP = 50;
const V_GAP = 90;

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
}> = ({ node, progress, onSelectNode, style, isOnSuggestedPath }) => {
    
    const isCompleted = progress[node.id] === 'completed';
    const isLocked = node.locked && !isCompleted;

    const pageInfo = formatPageNumbers(node.sourcePages);

    let baseClasses = 'w-[160px] min-h-[70px] p-2 rounded-2xl flex flex-col items-center justify-center text-card-foreground text-sm font-semibold relative transition-all duration-300 border-2 select-none shadow-md bg-card';
    let borderClasses = '';
    let glowClasses = '';

    if (isLocked) {
        baseClasses += ' opacity-50 grayscale cursor-not-allowed';
        borderClasses = 'border-muted';
    } else {
        baseClasses += ' cursor-pointer hover:scale-105';
        if (isOnSuggestedPath) {
            borderClasses = 'border-primary';
            glowClasses = 'shadow-[0_0_15px_rgb(var(--primary))]';
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
        <div style={style} className={`${baseClasses} ${borderClasses} ${glowClasses}`} onClick={handleClick}>
             {isCompleted && <CheckCircle className="absolute w-6 h-6 p-0.5 text-success bg-card rounded-full -top-2 -right-2" />}
            <span className="text-center">{node.title}</span>
            {pageInfo && <span className="mt-1 text-xs font-normal text-muted-foreground">{pageInfo}</span>}
        </div>
    );
};

// Main MindMap component
const MindMap: React.FC<MindMapProps> = ({ nodes, progress, suggestedPath, onSelectNode, theme }) => {

    const { positions, width, height } = useMemo(() => {
        if (nodes.length === 0) {
          return { positions: {}, width: 0, height: 0 };
        }

        const buildTree = (list: MindMapNodeType[]): (MindMapNodeType & { children: MindMapNodeType[] })[] => {
            const listCopy: (MindMapNodeType & { children: MindMapNodeType[] })[] = JSON.parse(JSON.stringify(list));
            const map: { [key: string]: number } = {};
            const roots: (MindMapNodeType & { children: MindMapNodeType[] })[] = [];
            
            listCopy.forEach((node, i) => {
                map[node.id] = i;
                node.children = [];
            });
    
            listCopy.forEach(node => {
                if (node.parentId && map[node.parentId] !== undefined) {
                    listCopy[map[node.parentId]].children.push(node);
                } else {
                    roots.push(node);
                }
            });
            return roots;
        };

        const calculateLayout = (treeRoots: (MindMapNodeType & { children: MindMapNodeType[], subtreeWidth?: number })[]) => {
            const positions: { [key: string]: { x: number, y: number } } = {};
            let maxHeight = 0;
            
            const calculateSubtreeWidths = (node: any) => {
                if (!node.children || node.children.length === 0) {
                    node.subtreeWidth = NODE_WIDTH;
                    return;
                }
                let childrenWidth = 0;
                node.children.forEach((child: any, index: number) => {
                    calculateSubtreeWidths(child);
                    childrenWidth += child.subtreeWidth + (index > 0 ? H_GAP : 0);
                });
                node.subtreeWidth = Math.max(NODE_WIDTH, childrenWidth);
            };
            
            const assignPositions = (node: any, x: number, y: number) => {
                const myWidth = node.subtreeWidth;
                const childrenWidth = node.children.reduce((acc: number, child: any, index: number) => acc + child.subtreeWidth + (index > 0 ? H_GAP : 0), 0);
                
                const currentX = x + (myWidth - NODE_WIDTH) / 2;
                positions[node.id] = { x: currentX, y };
                maxHeight = Math.max(maxHeight, y + NODE_HEIGHT);
    
                let childX = x + (myWidth - childrenWidth) / 2;
                node.children.forEach((child: any) => {
                    assignPositions(child, childX, y + NODE_HEIGHT + V_GAP);
                    childX += child.subtreeWidth + H_GAP;
                });
            };
    
            let currentX = 0;
            treeRoots.forEach(root => {
                calculateSubtreeWidths(root);
                assignPositions(root, currentX, 0);
                currentX += root.subtreeWidth + H_GAP;
            });
    
            const totalWidth = Math.max(0, currentX - H_GAP);
            return { positions, width: totalWidth, height: maxHeight };
        };

        const tree = buildTree(nodes);
        const { positions, width, height } = calculateLayout(tree);
        return { positions, width, height };
    }, [nodes]);
    
    const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
    const viewRef = useRef(view);
    viewRef.current = view;

    const [isPanning, setIsPanning] = useState(false);
    const startPoint = useRef({ x: 0, y: 0 });
    const pinchStartDist = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const [showSuggestedPath, setShowSuggestedPath] = useState(false);
    const suggestedPathSet = useMemo(() => new Set(suggestedPath || []), [suggestedPath]);


    useEffect(() => {
        const container = containerRef.current;
        if (!container || width === 0 || height === 0) {
            return;
        }

        const centerAndFit = () => {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            if (containerWidth === 0 || containerHeight === 0) return;

            const scaleX = containerWidth / (width + H_GAP);
            const scaleY = containerHeight / (height + V_GAP);
            const initialScale = Math.min(scaleX, scaleY) * 0.9;

            const initialX = (containerWidth - width * initialScale) / 2;
            const initialY = (containerHeight - height * initialScale) / 2;

            setView({ x: initialX, y: initialY, scale: initialScale });
        };

        const observer = new ResizeObserver(centerAndFit);
        observer.observe(container);

        centerAndFit();

        return () => {
            observer.disconnect();
        };
    }, [width, height]);
    
    const getTouchDistance = (touches: React.TouchList | TouchList) => {
        const touch1 = touches[0];
        const touch2 = touches[1];
        return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsPanning(true);
        startPoint.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning) return;
        e.preventDefault();
        const dx = e.clientX - startPoint.current.x;
        const dy = e.clientY - startPoint.current.y;
        startPoint.current = { x: e.clientX, y: e.clientY };
        setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
    };

    const handleMouseUpOrLeave = () => {
        setIsPanning(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const newScale = e.deltaY < 0 ? viewRef.current.scale * zoomFactor : viewRef.current.scale / zoomFactor;
        const clampedScale = Math.max(0.2, newScale);

        const rect = containerRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const mapX = (mouseX - viewRef.current.x) / viewRef.current.scale;
        const mapY = (mouseY - viewRef.current.y) / viewRef.current.scale;

        const newX = mouseX - mapX * clampedScale;
        const newY = mouseY - mapY * clampedScale;
        
        setView({ x: newX, y: newY, scale: clampedScale });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            e.preventDefault();
            setIsPanning(true);
            startPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            e.preventDefault();
            setIsPanning(false);
            pinchStartDist.current = getTouchDistance(e.touches);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isPanning) {
            e.preventDefault();
            const dx = e.touches[0].clientX - startPoint.current.x;
            const dy = e.touches[0].clientY - startPoint.current.y;
            startPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const currentDist = getTouchDistance(e.touches);
            const scaleChange = currentDist / pinchStartDist.current;
            pinchStartDist.current = currentDist;
            
            const newScale = viewRef.current.scale * scaleChange;
            const clampedScale = Math.max(0.2, newScale);

            const rect = containerRef.current!.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

            const mapX = (midX - viewRef.current.x) / viewRef.current.scale;
            const mapY = (midY - viewRef.current.y) / viewRef.current.scale;
            
            const newX = midX - mapX * clampedScale;
            const newY = midY - mapY * clampedScale;

            setView({ x: newX, y: newY, scale: clampedScale });
        }
    };
    
    const handleTouchEnd = (e: React.TouchEvent) => {
         setIsPanning(false);
         if (e.touches.length < 2) {
            pinchStartDist.current = 0;
         }
         if (e.touches.length === 1) { // If one finger remains, start panning
            setIsPanning(true);
            startPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
         }
    };

    if (nodes.length === 0) return null;

    return (
        <div className="relative w-full h-full">
            {suggestedPath && suggestedPath.length > 0 && (
                <button
                    onClick={() => setShowSuggestedPath(prev => !prev)}
                    title="نمایش مسیر پیشنهادی هوش مصنوعی"
                    className={`absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all shadow-md ${showSuggestedPath ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-accent'}`}
                >
                    <Sparkles className="w-5 h-5" />
                    مسیر پیشنهادی
                </button>
            )}
            <div 
                ref={containerRef}
                className={`w-full h-full overflow-hidden bg-background ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <ParticleBackground theme={theme} />
                <div
                    className="relative"
                    style={{
                        width,
                        height,
                        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                    <svg width={width} height={height} className="absolute top-0 left-0" style={{ pointerEvents: 'none' }}>
                        {nodes.map(node => {
                            if (!node.parentId || !positions[node.id] || !positions[node.parentId]) return null;
                            
                            const parentPos = positions[node.parentId];
                            const childPos = positions[node.id];
                            const startX = parentPos.x + NODE_WIDTH / 2;
                            const startY = parentPos.y + NODE_HEIGHT;
                            const endX = childPos.x + NODE_WIDTH / 2;
                            const endY = childPos.y;
                            
                            const pathData = `M ${startX} ${startY} C ${startX} ${startY + V_GAP / 2}, ${endX} ${endY - V_GAP / 2}, ${endX} ${endY}`;
                            
                            const isConsecutivePathConnection = showSuggestedPath && suggestedPath && (
                                (suggestedPath.indexOf(node.id) === suggestedPath.indexOf(node.parentId) + 1) ||
                                (suggestedPath.indexOf(node.parentId) === suggestedPath.indexOf(node.id) + 1)
                            );

                            const strokeColor = isConsecutivePathConnection ? 'rgb(var(--primary))' : 'rgb(var(--muted) / 0.5)';
                            const strokeWidth = isConsecutivePathConnection ? "3" : "2";
                            const style = isConsecutivePathConnection ? { filter: 'drop-shadow(0 0 3px rgb(var(--primary) / 0.7))' } : {};
                            
                            return (
                                <path
                                    key={`${node.parentId}-${node.id}`}
                                    d={pathData}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    fill="none"
                                    className="transition-all duration-500"
                                    style={style}
                                />
                            );
                        })}
                    </svg>
                    {nodes.map(node => {
                        const pos = positions[node.id];
                        if (!pos) return null;
                        return (
                            <MindMapNode
                                key={node.id}
                                node={node}
                                progress={progress}
                                onSelectNode={onSelectNode}
                                style={{
                                    position: 'absolute',
                                    left: pos.x,
                                    top: pos.y,
                                }}
                                isOnSuggestedPath={showSuggestedPath && suggestedPathSet.has(node.id)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MindMap;
