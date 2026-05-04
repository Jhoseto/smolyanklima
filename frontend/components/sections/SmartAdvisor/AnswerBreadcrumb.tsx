import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { WizardAnswers } from './types';

interface AnswerLabel {
  key: keyof WizardAnswers;
  stepIndex: number;
  label: string;
}

interface AnswerBreadcrumbProps {
  answers: WizardAnswers;
  stepLabels: Record<keyof WizardAnswers, (val: string | string[]) => string>;
  onClickChip: (stepIndex: number) => void;
  stepKeyOrder: (keyof WizardAnswers)[];
}

export const AnswerBreadcrumb: React.FC<AnswerBreadcrumbProps> = ({
  answers,
  stepLabels,
  onClickChip,
  stepKeyOrder,
}) => {
  const chips: AnswerLabel[] = [];

  for (const [idx, key] of stepKeyOrder.entries()) {
    const val = answers[key];
    if (!val) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (typeof val === 'string' && !val.trim()) continue;

    const label = stepLabels[key]?.(val as string | string[]) ?? String(val);
    chips.push({ key, stepIndex: idx, label });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <AnimatePresence mode="popLayout">
        {chips.map(chip => (
          <motion.button
            key={chip.key}
            type="button"
            onClick={() => onClickChip(chip.stepIndex)}
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-[#EBF5FF] border border-[#00B4D8]/25 text-[#0077B6] text-xs font-medium hover:bg-[#00B4D8]/15 transition-colors"
          >
            {chip.label}
            <span className="w-4 h-4 rounded-full bg-[#00B4D8]/15 flex items-center justify-center hover:bg-[#00B4D8]/30 transition-colors">
              <X className="w-2.5 h-2.5" strokeWidth={2} />
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
};
