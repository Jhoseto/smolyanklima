import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Tech Grid with Glow Points
 * Thin grid lines with pulsing glow points at intersections
 */

interface GridPoint {
  x: number;
  y: number;
  active: boolean;
  intensity: number;
}

interface TechGridProps {
  className?: string;
  gridSize?: number;
  glowColor?: string;
  lineColor?: string;
  interactive?: boolean;
}

export const TechGrid: React.FC<TechGridProps> = ({
  className = '',
  gridSize = 60,
  glowColor = '#00B4D8',
  lineColor = '#E5E7EB',
  interactive = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<GridPoint[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const initGrid = useCallback((width: number, height: number) => {
    const cols = Math.ceil(width / gridSize) + 1;
    const rows = Math.ceil(height / gridSize) + 1;
    
    pointsRef.current = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        // Only some intersections have glow points
        if (Math.random() > 0.7) {
          pointsRef.current.push({
            x: i * gridSize,
            y: j * gridSize,
            active: false,
            intensity: Math.random() * 0.5 + 0.3
          });
        }
      }
    }
  }, [gridSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        canvas.width = width;
        canvas.height = height;
        setDimensions({ width, height });
        initGrid(width, height);
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

    let time = 0;
    const animate = () => {
      time += 0.02;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;

      // Vertical lines
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw glow points
      pointsRef.current.forEach(point => {
        // Distance to mouse
        if (interactive) {
          const dx = mouseRef.current.x - point.x;
          const dy = mouseRef.current.y - point.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          point.active = distance < 100;
          if (distance < 150) {
            point.intensity = 0.8 + (150 - distance) / 150 * 0.2;
          } else {
            point.intensity = Math.max(0.3, point.intensity - 0.02);
          }
        }

        // Pulsing effect
        const pulse = Math.sin(time + point.x * 0.01 + point.y * 0.01) * 0.3 + 0.7;
        const size = point.active ? 6 : 3;
        const alpha = point.intensity * pulse;

        // Glow
        const gradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, size * 4
        );
        gradient.addColorStop(0, glowColor + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.5, glowColor + Math.floor(alpha * 100).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(point.x, point.y, size * 4, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fillStyle = point.active ? glowColor : glowColor + '80';
        ctx.globalAlpha = alpha;
        ctx.fill();

        // Active: draw connection line to nearby active points
        if (point.active && interactive) {
          pointsRef.current.forEach(otherPoint => {
            if (otherPoint === point || !otherPoint.active) return;
            
            const odx = otherPoint.x - point.x;
            const ody = otherPoint.y - point.y;
            const oDistance = Math.sqrt(odx * odx + ody * ody);
            
            if (oDistance < 150) {
              ctx.beginPath();
              ctx.moveTo(point.x, point.y);
              ctx.lineTo(otherPoint.x, otherPoint.y);
              ctx.strokeStyle = glowColor;
              ctx.lineWidth = 1;
              ctx.globalAlpha = (1 - oDistance / 150) * alpha * 0.5;
              ctx.stroke();
            }
          });
        }
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
  }, [initGrid, gridSize, glowColor, lineColor, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-auto ${className}`}
    />
  );
};
