
"use client";
import React, { useRef, useEffect, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SparklesCoreProps {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  particleDensity?: number;
  particleColor?: string;
  speed?: number;
}

export const SparklesCore = (props: SparklesCoreProps) => {
  const {
    id,
    className,
    background,
    minSize,
    maxSize,
    particleDensity,
    particleColor,
    speed = 1,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [particles, setParticles] = useState<any[]>([]);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      setContext(canvasRef.current.getContext("2d"));
    }
  }, []);

  useEffect(() => {
    if (context && canvasRef.current) {
      const canvas = canvasRef.current;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;

      const particleCount = particleDensity || 50;
      const newParticles = [];

      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * ((maxSize || 1) - (minSize || 0.5)) + (minSize || 0.5),
          speedX: (Math.random() - 0.5) * (speed || 1),
          speedY: (Math.random() - 0.5) * (speed || 1),
          opacity: Math.random(),
          opacitySpeed: (Math.random() - 0.5) * 0.02,
        });
      }
      setParticles(newParticles);

      const render = () => {
        context.clearRect(0, 0, width, height);
        if (background) {
            context.fillStyle = background;
            context.fillRect(0, 0, width, height);
        }

        newParticles.forEach((particle) => {
          particle.x += particle.speedX;
          particle.y += particle.speedY;
          particle.opacity += particle.opacitySpeed;

          if (particle.opacity <= 0 || particle.opacity >= 1) {
            particle.opacitySpeed *= -1;
          }

          if (particle.x < 0) particle.x = width;
          if (particle.x > width) particle.x = 0;
          if (particle.y < 0) particle.y = height;
          if (particle.y > height) particle.y = 0;

          context.globalAlpha = particle.opacity;
          context.fillStyle = particleColor || "#FFFFFF";
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          context.fill();
        });

        animationFrameId.current = requestAnimationFrame(render);
      };

      render();
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [context, minSize, maxSize, particleDensity, particleColor, speed, background]);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={className}
      style={{
        background: background || "transparent",
      }}
    />
  );
};
