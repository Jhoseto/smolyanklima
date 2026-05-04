import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { StepOption } from './types';

interface OptionCardProps {
  option: StepOption;
  selected: boolean;
  onSelect: (value: string) => void;
  multiMode?: boolean;
  disabled?: boolean;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  option,
  selected,
  onSelect,
  multiMode = false,
  disabled = false,
}) => {
  const { Icon, label, sublabel, value } = option;

  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onSelect(value)}
      whileHover={disabled ? {} : { y: -2, scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className={[
        'relative w-full flex flex-col items-center justify-center gap-3 p-5 rounded-[1.25rem]',
        'border-2 transition-all duration-200 text-center focus:outline-none',
        selected
          ? 'border-[#00B4D8] bg-[#EBF5FF] shadow-sm shadow-[#00B4D8]/10'
          : 'border-gray-100 bg-white hover:border-[#00B4D8]/50 hover:bg-[#F0FDFE]',
        disabled && !selected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      aria-pressed={selected}
    >
      {/* Selected checkmark */}
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#00B4D8] flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
        </motion.span>
      )}

      {/* Icon */}
      <span className={`transition-colors duration-200 ${selected ? 'text-[#00B4D8]' : 'text-gray-400'}`}>
        <Icon className="w-7 h-7" strokeWidth={1.5} />
      </span>

      {/* Label */}
      <span className={`font-semibold text-sm leading-tight transition-colors duration-200 ${selected ? 'text-[#00B4D8]' : 'text-gray-700'}`}>
        {label}
      </span>

      {/* Sublabel */}
      {sublabel && (
        <span className="text-[11px] text-gray-400 font-normal leading-tight">{sublabel}</span>
      )}

      {/* Multi-mode selection fill animation */}
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0.3 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 rounded-[1.25rem] bg-[#00B4D8]/15 pointer-events-none"
        />
      )}
    </motion.button>
  );
};
