
import React, { useRef, useEffect } from 'react';

interface ParticleBackgroundProps {
    theme: 'light' | 'dark' | 'balanced';
}

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ theme }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: any[] = [];
        
        // Reduce particles significantly on mobile to prevent lag
        const isMobile = window.innerWidth < 768;
        const particleCount = isMobile ? 20 : 80;

        const setCanvasDimensions = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        
        const getParticleColors = () => {
            if (theme === 'light') {
                return {
                    bg: 'rgba(37, 99, 235, 0.03)', // Very faint royal blue for depth
                    fg: 'rgba(37, 99, 235, 0.08)', // Slightly stronger blue for foreground
                };
            }
            // Dark and Balanced themes use the dark particle colors
            return {
                bg: 'rgba(120, 170, 220, 0.04)',
                fg: 'rgba(255, 255, 255, 0.05)',
            };
        };

        class Particle {
            x: number;
            y: number;
            radius: number;
            vx: number;
            vy: number;
            opacity: number;
            isForeground: boolean;

            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.isForeground = Math.random() > 0.5;
                
                if (this.isForeground) { // Foreground particles
                    this.radius = Math.random() * 1.5 + 1; // 1 to 2.5
                    this.opacity = 0.08;
                    this.vx = (Math.random() - 0.5) * 0.3; // Slower
                    this.vy = (Math.random() - 0.5) * 0.3;
                } else { // Background particles
                    this.radius = Math.random() * 1 + 0.5; // 0.5 to 1.5
                    this.opacity = 0.05;
                    this.vx = (Math.random() - 0.5) * 0.2; // Even slower
                    this.vy = (Math.random() - 0.5) * 0.2;
                }
            }

            draw(context: CanvasRenderingContext2D, colors: ReturnType<typeof getParticleColors>) {
                context.beginPath();
                context.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                context.fillStyle = this.isForeground ? colors.fg : colors.bg;
                context.fill();
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Wall collision
                if (this.x < 0 || this.x > canvas.width) {
                    this.vx *= -1;
                }
                if (this.y < 0 || this.y > canvas.height) {
                    this.vy *= -1;
                }
            }
        }

        const init = () => {
            setCanvasDimensions();
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const colors = getParticleColors();
            particles.forEach(particle => {
                particle.update();
                particle.draw(ctx, colors);
            });
        };

        init();
        animate();

        window.addEventListener('resize', init);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', init);
        };
    }, [theme]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 z-0 w-full h-full pointer-events-none"
        />
    );
};

export default ParticleBackground;
