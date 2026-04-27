import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Bokeh Light Orbs - Premium Blurred Glow Effect
 * Soft glowing orbs that move slowly and avoid mouse
 */

interface Orb {
  x: number;
  y: number;
  size: number;
  targetSize: number;
  color: string;
  opacity: number;
  speedX: number;
  speedY: number;
}

interface BokehOrbsProps {
  className?: string;
  orbCount?: number;
  colors?: string[];
  interactive?: boolean;
}

export const BokehOrbs: React.FC<BokehOrbsProps> = ({
  className = '',
  orbCount = 8,
  colors = ['#FF4D00', '#00B4D8', '#4F46E5'],
  interactive = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<Orb[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>();

  const initOrbs = useCallback((width: number, height: number) => {
    orbsRef.current = [];
    for (let i = 0; i < orbCount; i++) {
      const size = Math.random() * 150 + 100;
      orbsRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size,
        targetSize: size,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random() * 0.3 + 0.1,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3
      });
    }
  }, [orbCount, colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        initOrbs(canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      orbsRef.current.forEach(orb => {
        // Mouse interaction - orbs avoid mouse
        if (interactive) {
          const dx = mouseRef.current.x - orb.x;
          const dy = mouseRef.current.y - orb.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 250) {
            const force = (250 - distance) / 250;
            orb.x -= (dx / distance) * force * 3;
            orb.y -= (dy / distance) * force * 3;
            orb.targetSize = orb.size * (1 + force * 0.3); // Grow near mouse
          } else {
            orb.targetSize = orb.size;
          }
        }

        // Smooth size transition
        const currentSize = orb.targetSize * 0.98 + (orb.targetSize || orb.size) * 0.02;

        // Update position
        orb.x += orb.speedX;
        orb.y += orb.speedY;

        // Gentle floating
        orb.x += Math.sin(Date.now() * 0.001 + orb.size) * 0.2;
        orb.y += Math.cos(Date.now() * 0.001 + orb.size) * 0.2;

        // Wrap around screen
        if (orb.x < -orb.size) orb.x = canvas.width + orb.size;
        if (orb.x > canvas.width + orb.size) orb.x = -orb.size;
        if (orb.y < -orb.size) orb.y = canvas.height + orb.size;
        if (orb.y > canvas.height + orb.size) orb.y = -orb.size;

        // Draw orb with heavy blur
        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, currentSize
        );
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(0.5, orb.color + '40'); // 25% opacity
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = orb.opacity;
        ctx.fill();

        // Additional glow layer
        const glowGradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, currentSize * 1.5
        );
        glowGradient.addColorStop(0, orb.color + '20'); // 12% opacity
        glowGradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, currentSize * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.globalAlpha = orb.opacity * 0.5;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initOrbs, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-auto ${className}`}
    />
  );
};
