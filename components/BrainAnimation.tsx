import React, { useRef, useEffect } from 'react';

const BrainAnimation: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        
        const size = 300;
        canvas.width = size;
        canvas.height = size;

        // Data derived from the logo image
        const nodes = [
            { x: 135.5, y: 153, size: 3, type: 'secondary' }, { x: 172.5, y: 159.5, size: 3, type: 'secondary' },
            { x: 151, y: 125, size: 7, type: 'secondary' }, { x: 194.5, y: 110, size: 6, type: 'primary' },
            { x: 161.5, y: 100, size: 4.5, type: 'secondary' }, { x: 181.5, y: 76.5, size: 5, type: 'primary' },
            { x: 135, y: 60, size: 5, type: 'primary' }, { x: 100, y: 50, size: 3, type: 'secondary' },
            { x: 120, y: 120, size: 4, type: 'secondary' }, { x: 81, y: 105.5, size: 5, type: 'primary' },
            { x: 90, y: 140, size: 3.5, type: 'secondary' }, { x: 74, y: 161, size: 4, type: 'primary' },
            { x: 104.5, y: 81, size: 3.5, type: 'primary' }, { x: 169.5, y: 135.5, size: 4, type: 'secondary' },
            { x: 210, y: 145, size: 3, type: 'primary' }, { x: 191, y: 175, size: 4, type: 'secondary' },
            { x: 115, y: 185, size: 3, type: 'secondary' }, { x: 155, y: 190, size: 4, type: 'primary' }
        ];

        const connections = [
            [9, 12], [9, 8], [9, 10], [9, 11], [12, 7], [12, 6], [8, 2], [8, 4], [10, 11], [10, 2], [10, 0],
            [11, 16], [6, 5], [6, 4], [4, 2], [4, 5], [4, 3], [2, 0], [2, 13], [2, 1], [3, 5], [3, 13], [3, 14],
            [13, 1], [13, 15], [1, 15], [1, 17], [15, 17], [16, 17], [0, 1]
        ];

        const wirePaths = [
            "M150,50 C110,55 85,85 81,105.5", "M104.5,81 C95,85 85,95 81,105.5",
            "M70,130 C75,120 81,105.5 81,105.5", "M81,105.5 C85,125 90,140 90,140",
            "M70,130 C65,145 74,161 74,161", "M74,161 C85,175 100,180 115,185",
            "M115,185 C125,195 140,195 155,190", "M125,240 C110,225 105,200 115,185",
            "M150,50 C190,55 215,85 220,110", "M181.5,76.5 C190,85 200,95 205,110", "M230,130 C225,120 215,115 205,110",
            "M194.5,110 C190,120 180,130 169.5,135.5", "M230,130 C235,145 225,155 210,145",
            "M210,145 C200,160 191,175 191,175", "M191,175 C180,185 170,195 155,190",
            "M175,240 C190,225 200,200 191,175", "M125,240 Q150,220 175,240", "M120,120 C125,135 135.5,153 135.5,153",
            "M151,125 C145,135 135.5,153 135.5,153", "M161.5,100 C155,110 151,125 151,125",
            "M169.5,135.5 C165,145 155,155 150,160", "M172.5,159.5 C165,165 155,175 155,190"
        ].map(p => new Path2D(p));

        const getCssVar = (varName: string) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        
        let primaryColor: string, successColor: string, mutedColor: string, outlineColor: string;
        
        const updateColors = () => {
             primaryColor = `rgb(${getCssVar('--primary')})`;
             successColor = `rgb(${getCssVar('--success')})`;
             mutedColor = `rgb(${getCssVar('--muted-foreground')})`;
             const theme = document.documentElement.getAttribute('data-theme');
             outlineColor = theme === 'dark' ? 'rgba(230, 231, 234, 0.3)' : `rgba(${getCssVar('--foreground')}, 0.5)`;
        }
        
        updateColors();
        
        let startTime = 0;
        const wireframeDuration = 1500;
        const nodesDuration = 1000;
        const connectionsDuration = 1000;
        const phase1End = wireframeDuration;
        const phase2End = phase1End + nodesDuration;
        const phase3End = phase2End + connectionsDuration;

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        
        const draw = (timestamp: number) => {
            if (!ctx) return;
            if (startTime === 0) startTime = timestamp;
            const elapsed = timestamp - startTime;

            updateColors(); // Update colors every frame
            ctx.clearRect(0, 0, size, size);

            // Phase 1: Draw Wireframe
            const wireframeProgress = easeOutCubic(Math.min(1, elapsed / wireframeDuration));
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            const totalPaths = wirePaths.length;
            const pathsToDraw = Math.floor(wireframeProgress * totalPaths);
            for (let i = 0; i < pathsToDraw; i++) {
                ctx.stroke(wirePaths[i]);
            }
            if (pathsToDraw < totalPaths) {
                const remainderProgress = (wireframeProgress * totalPaths) - pathsToDraw;
                // This part is tricky in canvas. We'll just fade in the last segment.
                ctx.globalAlpha = remainderProgress;
                ctx.stroke(wirePaths[pathsToDraw]);
                ctx.globalAlpha = 1;
            }

            // Phase 2: Draw Nodes
            if (elapsed > phase1End) {
                const phase2Progress = easeOutCubic(Math.min(1, (elapsed - phase1End) / nodesDuration));
                nodes.forEach((node, i) => {
                    const delayFactor = i / nodes.length * 0.5; // Stagger appearance
                    const nodeProgress = Math.min(1, Math.max(0, (phase2Progress - delayFactor) * 2));
                    if (nodeProgress > 0) {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, node.size * nodeProgress, 0, Math.PI * 2);
                        const color = node.type === 'primary' ? primaryColor : successColor;
                        ctx.fillStyle = color;
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 8;
                        ctx.fill();
                    }
                });
                ctx.shadowBlur = 0;
            }

            // Phase 3: Draw Connections
            if (elapsed > phase2End) {
                const phase3Progress = easeOutCubic(Math.min(1, (elapsed - phase2End) / connectionsDuration));
                ctx.strokeStyle = mutedColor;
                ctx.lineWidth = 0.7;
                ctx.globalAlpha = Math.min(0.7, phase3Progress);
                const connectionsToDraw = Math.floor(phase3Progress * connections.length);
                 for (let i = 0; i < connectionsToDraw; i++) {
                    const conn = connections[i];
                    const n1 = nodes[conn[0]];
                    const n2 = nodes[conn[1]];
                    ctx.beginPath();
                    ctx.moveTo(n1.x, n1.y);
                    ctx.lineTo(n2.x, n2.y);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }

            // Phase 4: Pulsing
            if (elapsed > phase3End) {
                nodes.forEach((node, i) => {
                    const pulse = Math.sin(elapsed * 0.0015 + i) * 0.5 + 0.5; // slow pulse
                    const color = node.type === 'primary' ? primaryColor : successColor;
                    
                    // Draw main node
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();

                    // Glow effect
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.size + pulse * 4, 0, Math.PI * 2);
                    ctx.globalAlpha = (1 - pulse) * 0.3;
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                });
            }


            animationFrameId = requestAnimationFrame(draw);
        };

        animationFrameId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="flex flex-col items-center gap-4 text-center fade-in">
            <canvas ref={canvasRef} style={{width: 250, height: 250}}/>
            <h1 className="text-3xl font-bold text-primary">ذهن گاه</h1>
            <p className="text-muted-foreground">در حال آماده‌سازی محیط یادگیری شما...</p>
        </div>
    );
};

export default BrainAnimation;
