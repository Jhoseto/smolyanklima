import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, RotateCcw, MessageCircle, CheckCircle2, Send,
  Clock, Home, Square, Sun, Snowflake, Star as StarIcon, Coins, Building, Layers,
} from 'lucide-react';
import { RecommendationCard } from './RecommendationCard';
import { postPublicInquiry } from '../../../data/postInquiry';
import { formatWizardMessage, LABEL_MAP } from './wizard-utils';
import type { ResultTier, WizardAnswers } from './types';

interface ResultsScreenProps {
  tiers: ResultTier[] | null;
  answers: WizardAnswers;
  onReset: () => void;
  onOpenChat?: () => void;
}

const ANALYZING_MESSAGES = [
  'Анализираме вашия профил...',
  'Намираме перфектните модели...',
  'Готово!',
];

// ── Small helper — one summary row ────────────────────────────────────────────

const SummaryRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2.5 py-2 border-b border-gray-100 last:border-0">
    <span className="text-gray-400 shrink-0">{icon}</span>
    <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
    <span className="text-xs font-semibold text-gray-800">{value}</span>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ tiers, answers, onReset, onOpenChat }) => {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [minTimeDone, setMinTimeDone] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedTiers, setSubmittedTiers] = useState<ResultTier[]>([]);

  const hasContact = !!(answers.name?.trim() && answers.phone?.trim());

  // Minimum animation duration: 1.8s
  useEffect(() => {
    const total = 1800;
    const step = 30;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += step;
      setProgress(Math.min((elapsed / total) * 100, 100));
      setMsgIdx(Math.min(
        Math.floor((elapsed / total) * ANALYZING_MESSAGES.length),
        ANALYZING_MESSAGES.length - 1,
      ));
      if (elapsed >= total) { clearInterval(timer); setMinTimeDone(true); }
    }, step);
    return () => clearInterval(timer);
  }, []);

  const showResults = minTimeDone && tiers !== null;

  const toggleSelect = (productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!tiers || selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const chosen = tiers.filter(t => selectedIds.has(t.scored.product.id));
    const result = await postPublicInquiry({
      source: 'wizard',
      customerName: answers.name!.trim(),
      customerPhone: answers.phone!.trim(),
      message: formatWizardMessage(answers, tiers, [...selectedIds]),
      serviceType: 'sale',
    });
    setSubmitting(false);
    if (result.ok) {
      setSubmittedTiers(chosen);
      setSubmitted(true);
    } else {
      setSubmitError('Грешка при изпращане. Опитайте отново или се свържете с нас директно.');
    }
  };

  const PRIORITY_LABELS: Record<string, string> = {
    quiet: 'Тиха работа', efficiency: 'А+++ клас', wifi: 'WiFi управление',
    purification: 'Чист въздух', design: 'Стилен дизайн', fast: 'Бърз монтаж',
  };

  return (
    <AnimatePresence mode="wait">

      {/* ── 1. Loading ── */}
      {!showResults ? (
        <motion.div
          key="analyzing"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 gap-8"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00B4D8]/20 to-[#0077B6]/20 flex items-center justify-center"
          >
            <Sparkles className="w-8 h-8 text-[#00B4D8]" strokeWidth={1.5} />
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIdx}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
              className="text-lg font-outfit font-light text-gray-600"
            >
              {ANALYZING_MESSAGES[msgIdx]}
            </motion.p>
          </AnimatePresence>
          <div className="w-64 h-[3px] rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#00B4D8] to-[#0077B6]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>

      /* ── 2. Success panel ── */
      ) : submitted ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col gap-6"
        >
          {/* Top confirmation card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-6 flex flex-col sm:flex-row items-start gap-4">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 }}
              className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0"
            >
              <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={1.75} />
            </motion.div>
            <div>
              <h3 className="text-xl font-outfit font-black text-gray-900 mb-1">
                Запитването е изпратено успешно!
              </h3>
              <p className="text-sm text-gray-600 font-medium mb-2">
                Ще се свържем с <strong>{answers.name}</strong> на{' '}
                <a href={`tel:${answers.phone}`} className="text-[#0077B6] font-bold">{answers.phone}</a>
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 rounded-full px-3 py-1 w-fit">
                <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                В работно време отговаряме до 1 час
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Survey summary */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Вашият профил</p>
              <SummaryRow icon={<Home className="w-3.5 h-3.5" />}       label="Помещение"   value={LABEL_MAP.roomType[answers.roomType ?? ''] ?? '—'} />
              <SummaryRow icon={<Square className="w-3.5 h-3.5" />}     label="Площ"        value={LABEL_MAP.area[answers.area ?? ''] ?? '—'} />
              <SummaryRow icon={<Sun className="w-3.5 h-3.5" />}        label="Изложение"   value={LABEL_MAP.orientation[answers.orientation ?? ''] ?? '—'} />
              <SummaryRow icon={<Snowflake className="w-3.5 h-3.5" />}  label="Употреба"    value={LABEL_MAP.usage[answers.usage ?? ''] ?? '—'} />
              <SummaryRow icon={<StarIcon className="w-3.5 h-3.5" />}   label="Приоритети"  value={(answers.priorities ?? []).map(p => PRIORITY_LABELS[p] ?? p).join(' · ') || '—'} />
              <SummaryRow icon={<Coins className="w-3.5 h-3.5" />}      label="Бюджет"      value={LABEL_MAP.budget[answers.budget ?? ''] ?? '—'} />
              <SummaryRow icon={<Building className="w-3.5 h-3.5" />}   label="Етаж"        value={LABEL_MAP.floor[answers.floor ?? ''] ?? '—'} />
              <SummaryRow icon={<Layers className="w-3.5 h-3.5" />}     label="Тип сграда"  value={LABEL_MAP.buildingType[answers.buildingType ?? ''] ?? '—'} />
            </div>

            {/* Selected products */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Избрани климатици</p>
              <div className="flex flex-col gap-3">
                {submittedTiers.map((tier) => {
                  const p = tier.scored.product;
                  const total = Math.round(p.price + tier.scored.installCost);
                  return (
                    <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-wider">{p.brand}</p>
                        <p className="text-xs font-bold text-gray-900 leading-snug">{p.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          €{p.price} + €{tier.scored.installCost} монтаж ={' '}
                          <strong className="text-gray-700">€{total} общо</strong>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 border-t border-gray-100">
            {onOpenChat && (
              <button type="button" onClick={onOpenChat}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#EBF5FF] text-[#00B4D8] text-sm font-bold hover:bg-[#00B4D8] hover:text-white transition-all"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                Задайте въпрос на AI асистента
              </button>
            )}
            <button type="button" onClick={onReset}
              className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
              Започни отначало
            </button>
          </div>
        </motion.div>

      /* ── 3. Results ── */
      ) : (
        <motion.div
          key="results"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-8"
        >
          {/* Header */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
              className="w-14 h-14 rounded-full bg-[#EBF5FF] flex items-center justify-center mx-auto mb-4"
            >
              <Sparkles className="w-7 h-7 text-[#00B4D8]" strokeWidth={1.5} />
            </motion.div>
            <h3 className="text-2xl font-outfit font-black text-gray-900 mb-2">Вашите препоръки</h3>
            <p className="text-gray-500 text-sm font-light">
              {hasContact
                ? 'Маркирайте климатиците, за които искате оферта, след което натиснете „Пусни запитване"'
                : 'Подбрахме тези модели специално за вашия профил'}
            </p>
          </div>

          {/* Cards */}
          {tiers && tiers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
              {tiers.map((tier, i) => (
                <RecommendationCard
                  key={tier.scored.product.id}
                  tier={tier}
                  index={i}
                  selectable={hasContact}
                  selected={selectedIds.has(tier.scored.product.id)}
                  onToggleSelect={() => toggleSelect(tier.scored.product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm font-light">
              Не намерихме подходящи продукти. Опитайте отново с различни критерии.
            </div>
          )}

          {/* Submit CTA — only for users with contact info */}
          {hasContact && tiers && tiers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-3"
            >
              {submitError && (
                <p className="text-sm text-red-600 font-medium text-center">{submitError}</p>
              )}
              <motion.button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={selectedIds.size === 0 || submitting}
                whileHover={selectedIds.size > 0 && !submitting ? { scale: 1.02 } : {}}
                whileTap={selectedIds.size > 0 && !submitting ? { scale: 0.97 } : {}}
                className={[
                  'flex items-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold transition-all shadow-md',
                  selectedIds.size > 0 && !submitting
                    ? 'bg-gradient-to-r from-[#00B4D8] to-[#0077B6] text-white shadow-[#00B4D8]/30 hover:shadow-lg hover:shadow-[#00B4D8]/40'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none',
                ].join(' ')}
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
                {submitting
                  ? 'Изпращане...'
                  : selectedIds.size === 0
                    ? 'Маркирайте климатик(ци)'
                    : `Пусни запитване за ${selectedIds.size} ${selectedIds.size === 1 ? 'климатик' : 'климатика'}`}
              </motion.button>
              <p className="text-[11px] text-gray-400 font-light">
                🔒 Ще се свържем с вас на посочения телефон
              </p>
            </motion.div>
          )}

          {/* Bottom actions */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-gray-100"
          >
            {onOpenChat && (
              <button type="button" onClick={onOpenChat}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#EBF5FF] text-[#00B4D8] text-sm font-bold hover:bg-[#00B4D8] hover:text-white transition-all"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                Задайте въпрос за тези модели
              </button>
            )}
            <button type="button" onClick={onReset}
              className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
              Започни отначало
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
