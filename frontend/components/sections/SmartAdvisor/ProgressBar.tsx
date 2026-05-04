import React from 'react';
import { motion } from 'motion/react';

interface ProgressBarProps {
  current: number;  // 0-indexed
  total: number;
  installationSteps: number[]; // step indices that are installation-related
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, installationSteps }) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Dots + line */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < current;
          const active = i === current;
          const isInstall = installationSteps.includes(i);
          return (
            <React.Fragment key={i}>
              {/* Dot */}
              <motion.span
                animate={{
                  width: active ? 20 : 8,
                  backgroundColor: done || active ? '#00B4D8' : isInstall ? '#94a3b8' : '#e2e8f0',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="h-2 rounded-full shrink-0"
              />
              {/* Connector line */}
              {i < total - 1 && (
                <span className="flex-1 h-[2px] rounded-full bg-gray-100 overflow-hidden">
                  <motion.span
                    className="block h-full bg-[#00B4D8] rounded-full"
                    animate={{ scaleX: done ? 1 : 0 }}
                    initial={{ scaleX: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{ transformOrigin: 'left' }}
                  />
                </span>
              )}
            </React.Fragment>
          );
        })}

        {/* Counter */}
        <span className="ml-2 text-xs font-light text-gray-400 shrink-0 tabular-nums">
          {current + 1} / {total}
        </span>
      </div>

      {/* Installation group label */}
      {installationSteps.includes(current) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5"
        >
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
            🔧 Монтажни въпроси
          </span>
          <span className="text-[11px] text-gray-400">влияят на цената на монтажа</span>
        </motion.div>
      )}
    </div>
  );
};
