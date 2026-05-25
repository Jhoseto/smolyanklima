import React, { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
        ease: [0.22, 1, 0.36, 1] as const, // Custom cubic-bezier for premium feel
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
        ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      className="relative w-full"
    >
      {children}
    </motion.div>
  );
};
