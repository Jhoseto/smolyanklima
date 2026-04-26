import React from 'react';
import { motion } from 'motion/react';

const brands = [
  { name: 'DAIKIN', color: 'hover:text-[#00A1E4]' },
  { name: 'MITSUBISHI ELECTRIC', color: 'hover:text-[#E60012]' },
  { name: 'SAMSUNG', color: 'hover:text-[#1428A0]' },
  { name: 'GREE', color: 'hover:text-[#0082CA]' },
  { name: 'TOSHIBA', color: 'hover:text-[#FF0000]' },
  { name: 'FUJITSU', color: 'hover:text-[#ED1C24]' },
  { name: 'PANASONIC', color: 'hover:text-[#003B91]' },
  { name: 'HITACHI', color: 'hover:text-[#E1001A]' },
  { name: 'MIDEA', color: 'hover:text-[#007DC5]' },
  { name: 'SHARP', color: 'hover:text-[#E60012]' },
];

export const BrandsSection = () => {
  // Triple the brands for a seamless marquee
  const marqueeBrands = [...brands, ...brands, ...brands];

  return (
    <div className="bg-transparent py-4 overflow-hidden relative group">
      {/* Side Fades */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      <div className="relative flex">
        <motion.div
          animate={{ x: [0, '-33.33%'] }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear",
          }}
          className="flex items-center gap-16 md:gap-24 whitespace-nowrap px-8"
        >
          {marqueeBrands.map((brand, index) => (
            <div
              key={index}
              className={`text-2xl md:text-3xl font-black tracking-tighter text-gray-300 transition-all duration-300 ${brand.color} cursor-default select-none flex items-center gap-2 group/brand`}
            >
              <span className="opacity-40 group-hover/brand:opacity-100 transition-opacity">
                {brand.name}
              </span>
              <div className="w-1 h-1 rounded-full bg-[#FF4D00] opacity-0 group-hover/brand:opacity-100 transition-opacity" />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
