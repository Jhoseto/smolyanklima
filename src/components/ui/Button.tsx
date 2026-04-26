import React from 'react';
import { cn } from '../../lib/utils';
import { motion, HTMLMotionProps } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-[#FF4D00] text-white hover:bg-[#E64500] focus:ring-[#FF4D00]",
      secondary: "bg-white text-gray-900 shadow-sm border border-gray-200 hover:bg-gray-50 focus:ring-gray-200",
      outline: "bg-transparent border-2 border-[#FF4D00] text-[#FF4D00] hover:bg-[#FF4D00] hover:text-white",
      ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-6 text-base",
      lg: "h-14 px-8 text-lg",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
