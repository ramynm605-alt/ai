import React, { useRef, useEffect } from 'react';

interface SpinnerProps {
    size?: number;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 150 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        canvas.width = size;
        canvas.height = size;

        const NODE_COUNT = Math.max(5, Math.floor(size / 12));
        const MAX_DIST = size * 0.6;

        const nodes: any[] = [];
        
        const getCssVar = (varName: string) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        
        let nodeColor: string;
        let lineRgb: string;

        // Function to update colors based on CSS variables
        const updateColors = () => {
            const theme = document.documentElement.getAttribute('data-theme') || 'balanced';
            const primaryColor = getCssVar('--primary');
            nodeColor = `rgb(${primaryColor})`;

            if (theme === 'dark') {
                lineRgb = '255, 215, 0'; // Pale Gold for dark theme
            } else {
                // For light and balanced themes, a muted color works well.
                lineRgb = getCssVar('--muted-foreground'); 
            }
        };

        updateColors();

        for (let i = 0; i < NODE_COUNT; i++) {
            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                radius: Math.random() * (size / 100) + 1,
            });
        }

        const draw = () => {
            if (!ctx) return;
            // Update colors on each frame in case theme changes while loading
            updateColors();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Lines
            for (let i = 0; i < NODE_COUNT; i++) {
                for (let j = i + 1; j < NODE_COUNT; j++) {
                    let dx = nodes[i].x - nodes[j].x;
                    let dy = nodes[i].y - nodes[j].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MAX_DIST) {
                        ctx.strokeStyle = `rgba(${lineRgb}, ${1 - dist / MAX_DIST})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // Nodes
            nodes.forEach(node => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = nodeColor;
                ctx.shadowColor = nodeColor;
                ctx.shadowBlur = 6;
                ctx.fill();
            });
            ctx.shadowBlur = 0;

            // Move
            nodes.forEach(node => {
                node.x += node.vx;
                node.y += node.vy;

                if (node.x - node.radius < 0) { node.x = node.radius; node.vx *= -1; }
                if (node.x + node.radius > canvas.width) { node.x = canvas.width - node.radius; node.vx *= -1; }
                if (node.y - node.radius < 0) { node.y = node.radius; node.vy *= -1; }
                if (node.y + node.radius > canvas.height) { node.y = canvas.height - node.radius; node.vy *= -1; }
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [size]);

    return (
        <div className="flex items-center justify-center" style={{ width: `${size}px`, height: `${size}px` }}>
             <canvas ref={canvasRef} />
        </div>
    );
};

export default Spinner;