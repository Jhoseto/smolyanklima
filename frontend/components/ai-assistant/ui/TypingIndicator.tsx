/**
 * Typing Indicator Component
 * Shows when AI is composing a response
 */

import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  text?: string;
  primaryColor: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  text = 'Асистентът пише...',
  primaryColor,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        backgroundColor: 'white',
        borderRadius: '16px 16px 16px 4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        border: '1px solid #e2e8f0',
        maxWidth: 'fit-content',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: index * 0.15,
              ease: 'easeInOut',
            }}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: primaryColor,
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 13,
          color: '#64748b',
          fontStyle: 'italic',
        }}
      >
        {text}
      </span>
    </div>
  );
};

export default TypingIndicator;
