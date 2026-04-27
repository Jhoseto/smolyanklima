import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

/**
 * Premium Gradient Mesh Morphing Background
 * Living, breathing gradient that slowly morphs like oil in water
 */

interface GradientMeshMorphingProps {
  className?: string;
  intensity?: 'subtle' | 'normal' | 'strong';
  colors?: string[];
}

export const GradientMeshMorphing: React.FC<GradientMeshMorphingProps> = ({
  className = '',
  intensity = 'normal',
  colors = ['#00B4D8', '#FF4D00', '#4F46E5', '#06B6D4']
}) => {
  const intensityMap = {
    subtle: { opacity: 0.3, blur: 100 },
    normal: { opacity: 0.5, blur: 80 },
    strong: { opacity: 0.7, blur: 60 }
  };

  const { opacity, blur } = intensityMap[intensity];

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors[0]} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity,
          top: '-10%',
          left: '-10%'
        }}
        animate={{
          x: [0, 100, 50, 150, 0],
          y: [0, 50, 100, 25, 0],
          scale: [1, 1.2, 0.9, 1.1, 1]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
      
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors[1]} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity,
          top: '40%',
          right: '-5%'
        }}
        animate={{
          x: [0, -80, -40, -100, 0],
          y: [0, 60, -30, 40, 0],
          scale: [1, 0.8, 1.3, 0.9, 1]
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2
        }}
      />
      
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors[2]} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacity * 0.8,
          bottom: '10%',
          left: '20%'
        }}
        animate={{
          x: [0, 60, -40, 80, 0],
          y: [0, -40, 60, -20, 0],
          scale: [1, 1.1, 0.85, 1.15, 1]
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4
        }}
      />
      
      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors[3]} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacity * 0.6,
          top: '20%',
          right: '30%'
        }}
        animate={{
          x: [0, -50, 30, -70, 0],
          y: [0, 40, -50, 20, 0],
          scale: [1, 0.9, 1.2, 0.8, 1]
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1
        }}
      />

      {/* Noise texture overlay for premium feel */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  );
};
