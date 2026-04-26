import React from 'react';
import { motion } from 'motion/react';

export const SkeletonCard = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex flex-col h-full animate-pulse"
    >
      {/* Top badges skeleton */}
      <div className="flex justify-between items-start mb-4">
        <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
      </div>

      {/* Image skeleton */}
      <div className="w-full aspect-square bg-gray-100 rounded-2xl mb-6"></div>

      {/* Brand & Title */}
      <div className="w-1/3 h-3 bg-gray-200 rounded-full mb-3"></div>
      <div className="w-3/4 h-6 bg-gray-200 rounded-full mb-4"></div>

      {/* Specs skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="w-1/3 h-5 bg-gray-100 rounded-full"></div>
        <div className="w-1/3 h-5 bg-gray-100 rounded-full"></div>
      </div>

      {/* Price skeleton */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
        <div className="w-24 h-8 bg-gray-200 rounded-full"></div>
        <div className="w-24 h-4 bg-gray-100 rounded-full"></div>
      </div>
    </motion.div>
  );
};
