import React from 'react';

interface LogoProps {
  className?: string;
  isDark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo = ({ className = "", isDark = false, size = 'md' }: LogoProps) => {
  const sizes = {
    sm: {
      text: 'text-lg sm:text-xl',
      icon: 'h-7 sm:h-8',
      margin: 'mr-1'
    },
    md: {
      text: 'text-xl sm:text-2xl',
      icon: 'h-8 sm:h-9',
      margin: 'mr-1.5'
    },
    lg: {
      text: 'text-2xl sm:text-3xl',
      icon: 'h-10 sm:h-12',
      margin: 'mr-2'
    }
  };

  const current = sizes[size];

  return (
    <div className={`flex items-center group select-none ${className}`}>

      {/* Unified word container */}
      <div className={`flex items-center tracking-[-0.05em] font-sans font-black leading-none uppercase ${current.text}`}>

        {/* Precision SVG Icon acting as the letter C */}
        <svg
          viewBox="0 5 73 90"
          className={`${current.icon} ${current.margin} w-auto shrink-0 transition-transform duration-500 group-hover:scale-105`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Exact Brand Orange Gradient */}
            <linearGradient id="brandOrange" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF4D00" />
              <stop offset="50%" stopColor="#FF6A00" />
              <stop offset="100%" stopColor="#FF2A4D" />
            </linearGradient>

            {/* Exact Brand Blue Gradient */}
            <linearGradient id="brandBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00B4D8" />
              <stop offset="100%" stopColor="#0077B6" />
            </linearGradient>

            {/* Premium Drop Shadow */}
            <filter id="logoShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Degree Symbol (Top Left) - Moved further out */}
          <circle cx="12" cy="12" r="5" stroke="url(#brandOrange)" strokeWidth="3" fill="none" filter="url(#logoShadow)" />

          {/* Top Arc (Orange) - Open C Shape */}
          <path
            d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z"
            fill="url(#brandOrange)"
            filter="url(#logoShadow)"
          />

          {/* Bottom Arc (Blue) - Open C Shape */}
          <path
            d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z"
            fill="url(#brandBlue)"
            filter="url(#logoShadow)"
          />

          {/* Center Dot Top Half (Orange) */}
          <path
            d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z"
            fill="url(#brandOrange)"
            filter="url(#logoShadow)"
          />

          {/* Center Dot Bottom Half (Blue) */}
          <path
            d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z"
            fill="url(#brandBlue)"
            filter="url(#logoShadow)"
          />
        </svg>

        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D]">
          СМОЛЯН
        </span>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6]">
          КЛИМА
        </span>
      </div>

    </div>
  );
};
