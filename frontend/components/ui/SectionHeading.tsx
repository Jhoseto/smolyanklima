import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface SectionHeadingProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center';
}

export const SectionHeading = ({ title, subtitle, className, align = 'center' }: SectionHeadingProps) => {
  return (
    <div className={cn("flex flex-col gap-3", align === 'center' ? 'items-center text-center' : 'items-start text-left', className)}>
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-lg text-gray-500 max-w-2xl"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
};
