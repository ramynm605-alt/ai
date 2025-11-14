
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MindMapNode as MindMapNodeType } from '../types';
import { CheckCircle } from './icons';

interface MindMapProps {
    nodes: MindMapNodeType[];
    progress: { [key: string]: 'completed' | 'failed' | 'in_progress' };
    onSelectNode: (id: string) => void;
    onTakeQuiz: (id: string) => void; // This is kept for type consistency, but nodes are now single-action
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const H_GAP = 50;
const V_GAP = 90;


// Node component - purely for presentation
const MindMapNode: React.FC<{
    node: MindMapNodeType;
    progress: MindMapProps['progress'];
    onSelectNode: MindMapProps['onSelectNode'];
    style: React.CSSProperties;
}> = ({ node, progress, onSelectNode, style }) => {
    
    const isCompleted = progress[node.id] === 'completed';
    const isLocked = node.locked && !isCompleted;

    // Determine styles based on node state
    let baseClasses = 'w-[160px] h-[60px] rounded-full flex items-center justify-center text-white text-sm font-bold relative transition-all duration-300 border-2 select-none shadow-md';
    let borderClasses = '';
    let glowClasses = '';

    if (isLocked) {
        baseClasses += ' bg-slate-800 border-gray-700 opacity-40 grayscale cursor-not-allowed';
    } else {
        baseClasses += ' cursor-pointer';
        if (isCompleted) {
            baseClasses += ' bg-green-800';
            borderClasses = 'border-green-500';
            glowClasses = 'hover:shadow-[0_0_15px_theme(colors.green.500)]';
        } else {
            baseClasses += ' bg-slate-800';
            if (node.isExplanatory) {
                borderClasses = 'border-purple-500';
                glowClasses = 'hover:shadow-[0_0_15px_theme(colors.purple.500)]';
            } else if (node.difficulty < 0.4) {
                borderClasses = 'border-indigo-600';
                glowClasses = 'hover:shadow-[0_0_15px_theme(colors.indigo.600)]';
            } else if (node.difficulty < 0.7) {
                borderClasses = 'border-gray-500';
                glowClasses = 'hover:shadow-[0_0_15px_theme(colors.gray.500)]';
            } else {
                borderClasses = 'border-red-600';
                glowClasses = 'hover:shadow-[0_0_15px_theme(colors.red.600)]';
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
             {isCompleted && <CheckCircle className="absolute w-6 h-6 p-0.5 text-green-400 bg-gray-900 rounded-full -top-2 -right-2" />}
            <span className="text-center">{node.title}</span>
        </div>
    );
};

// Main MindMap component
const MindMap: React.FC<MindMapProps> = ({ nodes, progress, onSelectNode }) => {

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

    useEffect(() => {
        if (width > 0 && height > 0 && containerRef.current) {
            const containerEl = containerRef.current;
            const containerWidth = containerEl.clientWidth;
            const containerHeight = containerEl.clientHeight;

            if (containerWidth === 0 || containerHeight === 0) return;

            const scaleX = containerWidth / (width + H_GAP);
            const scaleY = containerHeight / (height + V_GAP);
            const initialScale = Math.min(scaleX, scaleY, 1) * 0.9;

            const initialX = (containerWidth - width * initialScale) / 2;
            const initialY = (containerHeight - height * initialScale) / 2;

            setView({ x: initialX, y: initialY, scale: initialScale });
        }
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
        const clampedScale = Math.max(0.2, Math.min(2, newScale));

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
            const clampedScale = Math.max(0.2, Math.min(2, newScale));

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
                        const isParentCompleted = progress[node.parentId] === 'completed';
                        
                        return (
                            <path
                                key={`${node.parentId}-${node.id}`}
                                d={pathData}
                                stroke={isParentCompleted ? 'rgb(var(--primary))' : 'rgb(var(--muted))'}
                                strokeWidth="2"
                                fill="none"
                                className="transition-all duration-500"
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
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default MindMap;
