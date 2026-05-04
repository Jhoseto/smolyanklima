import React, { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BedDouble, Sofa, Baby, Briefcase, UtensilsCrossed, Store,
  Square, Home, Building, Building2,
  Moon, Sun, MoveUp, HelpCircle,
  Snowflake, Flame, CloudSun,
  VolumeX, Zap, Wifi, Wind, Sparkles, Clock,
  Coins, CreditCard, Star, Gem,
  Layers, Trees, Hammer,
  Landmark,
  ChevronLeft, ChevronRight, User, Phone, Info,
} from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { AnswerBreadcrumb } from './AnswerBreadcrumb';
import { OptionCard } from './OptionCard';
import { ResultsScreen } from './ResultsScreen';
import { getThreeTiers } from './advisor-logic';
import { getAllProducts } from '../../../data/productService';
import { LABEL_MAP, formatWizardMessage } from './wizard-utils';
import type { WizardAnswers, OptionStepDef, StepDef, ResultTier } from './types';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  {
    type: 'single',
    key: 'roomType',
    question: 'Какво помещение ще климатизирате?',
    subtitle: 'Изберете типа стая',
    options: [
      { value: 'bedroom',    label: 'Спалня',           sublabel: 'Тих режим',           Icon: BedDouble },
      { value: 'living',     label: 'Дневна стая',       sublabel: 'По-голямо',           Icon: Sofa },
      { value: 'kids',       label: 'Детска стая',       sublabel: 'Пречистване',         Icon: Baby },
      { value: 'office',     label: 'Офис',              sublabel: 'Тих и ефективен',     Icon: Briefcase },
      { value: 'kitchen',    label: 'Кухня',             sublabel: 'Мощно охлаждане',     Icon: UtensilsCrossed },
      { value: 'commercial', label: 'Търговски обект',   sublabel: 'Промишлен тип',       Icon: Store },
    ],
  },
  {
    type: 'single',
    key: 'area',
    question: 'Каква е площта на помещението?',
    subtitle: 'Приблизително е достатъчно',
    hint: 'Измерете дължината × ширината на стаята (без стените)',
    options: [
      { value: 'tiny',   label: 'До 20 м²',     sublabel: 'Малка стая',          Icon: Square },
      { value: 'small',  label: '20 – 30 м²',   sublabel: 'Стандартна стая',     Icon: Home },
      { value: 'medium', label: '30 – 45 м²',   sublabel: 'Просторна стая',      Icon: Home },
      { value: 'large',  label: '45 – 60 м²',   sublabel: 'Голямо пространство', Icon: Building },
      { value: 'xlarge', label: 'Над 60 м²',    sublabel: 'Открито / двуетажно', Icon: Building2 },
    ],
  },
  {
    type: 'single',
    key: 'orientation',
    question: 'Как е изложена стаята?',
    subtitle: 'Слънчевите стаи изискват по-мощен климатик',
    options: [
      { value: 'north',   label: 'Север',           sublabel: 'Хладна / засенчена',  Icon: Moon },
      { value: 'south',   label: 'Юг или Запад',    sublabel: 'Слънчева / топла',    Icon: Sun },
      { value: 'top',     label: 'Горен етаж',      sublabel: 'Покрив / таван',      Icon: MoveUp },
      { value: 'unknown', label: 'Не съм сигурен',  sublabel: 'Ще преценим сами',    Icon: HelpCircle },
    ],
  },
  {
    type: 'single',
    key: 'usage',
    question: 'Кога планирате да ползвате климатика?',
    subtitle: 'Инверторните модели са идеални за отопление',
    options: [
      { value: 'cooling', label: 'Само лято',          sublabel: 'Само охлаждане',       Icon: Snowflake },
      { value: 'both',    label: 'Лято и зима',        sublabel: 'Охлаждане + отопление', Icon: CloudSun },
      { value: 'heating', label: 'Основно зима',       sublabel: 'Основно отопление',    Icon: Flame },
    ],
  },
  {
    type: 'multi',
    key: 'priorities',
    question: 'Кое е важно за вас?',
    subtitle: 'Изберете до 3 характеристики',
    maxSelect: 3,
    options: [
      { value: 'quiet',        label: 'Тиха работа',        sublabel: '≤ 19 dB',          Icon: VolumeX },
      { value: 'efficiency',   label: 'Висока ефективност', sublabel: 'А+++ клас',        Icon: Zap },
      { value: 'wifi',         label: 'WiFi управление',    sublabel: 'От телефон',        Icon: Wifi },
      { value: 'purification', label: 'Чист въздух',        sublabel: 'HEPA / PM2.5',     Icon: Wind },
      { value: 'design',       label: 'Стилен дизайн',      sublabel: 'Тънък корпус',     Icon: Sparkles },
      { value: 'fast',         label: 'Бърз монтаж',        sublabel: 'До 48 часа',       Icon: Clock },
    ],
  },
  {
    type: 'single',
    key: 'budget',
    question: 'Какъв е вашият бюджет?',
    subtitle: 'Включва климатика и монтажа',
    options: [
      { value: 'budget',  label: 'До €450',         sublabel: 'Покрива ~60% от каталога', Icon: Coins },
      { value: 'mid',     label: '€450 – €720',     sublabel: 'Покрива ~80% от каталога', Icon: CreditCard },
      { value: 'comfort', label: '€720 – €1 150',   sublabel: 'Покрива ~90% от каталога', Icon: Star },
      { value: 'premium', label: 'Над €1 150',      sublabel: 'Целият каталог',            Icon: Gem },
    ],
  },
  // ── Installation steps ──
  {
    type: 'single',
    key: 'floor',
    question: 'На кой етаж се намира помещението?',
    subtitle: 'Влияе на дължината на тръбите и монтажната цена',
    group: 'install',
    options: [
      { value: 'ground', label: 'Партерен / 1-ви', sublabel: 'Стандартен монтаж',   Icon: Building },
      { value: 'low',    label: '2-ри – 5-ти',     sublabel: 'Стандартен монтаж',   Icon: Building },
      { value: 'mid',    label: '6-ти – 10-ти',    sublabel: '+€20–40 монтаж',      Icon: Building2 },
      { value: 'high',   label: 'Над 10-ти',       sublabel: '+€75–130 монтаж',     Icon: Landmark },
    ],
  },
  {
    type: 'single',
    key: 'buildingType',
    question: 'Какъв тип е сградата?',
    subtitle: 'Помага да определим правилния монтажен метод',
    group: 'install',
    hint: 'Видът на строителството влияе на метода на закрепване и изолация',
    options: [
      { value: 'panel',  label: 'Панелен блок',       sublabel: 'Стандартно пробиване',  Icon: Layers },
      { value: 'brick',  label: 'Тухлена сграда',     sublabel: 'Стандартен монтаж',     Icon: Home },
      { value: 'house',  label: 'Къща / Вила',        sublabel: 'Мулти-сплит опции',     Icon: Trees },
      { value: 'office', label: 'Офис сграда',        sublabel: 'Касетъчен тип',         Icon: Briefcase },
      { value: 'new',    label: 'Ново строителство',  sublabel: 'Предварителна подготовка', Icon: Hammer },
    ],
  },
  {
    type: 'contact',
    question: 'Да изпратим ли безплатна оферта?',
    subtitle: 'Не е задължително — можете да продължите без',
  },
];

// ── Breadcrumb mappings ────────────────────────────────────────────────────────
// LABEL_MAP is imported from wizard-utils

const STEP_LABELS: Record<keyof WizardAnswers, (val: string | string[]) => string> = {
  roomType:     v => LABEL_MAP.roomType[v as string] ?? String(v),
  area:         v => LABEL_MAP.area[v as string] ?? String(v),
  orientation:  v => LABEL_MAP.orientation[v as string] ?? String(v),
  usage:        v => LABEL_MAP.usage[v as string] ?? String(v),
  priorities:   v => (v as string[]).map(p => ({ quiet: 'Тихо', efficiency: 'А+++', wifi: 'WiFi', purification: 'Чист въздух', design: 'Дизайн', fast: 'Бърз монтаж' })[p] ?? p).join(' · '),
  budget:       v => LABEL_MAP.budget[v as string] ?? String(v),
  floor:        v => LABEL_MAP.floor[v as string] ?? String(v),
  buildingType: v => LABEL_MAP.buildingType[v as string] ?? String(v),
  name:         v => v as string,
  phone:        v => v as string,
};

const STEP_KEY_ORDER: (keyof WizardAnswers)[] = [
  'roomType', 'area', 'orientation', 'usage', 'priorities',
  'budget', 'floor', 'buildingType',
];

const INSTALLATION_STEPS = [6, 7]; // indices in STEPS array

// ── Helpers ───────────────────────────────────────────────────────────────────

function isStepAnswered(step: StepDef, answers: WizardAnswers): boolean {
  if (step.type === 'contact') return true; // always skippable
  const key = (step as OptionStepDef).key;
  const val = answers[key];
  if (Array.isArray(val)) return val.length > 0;
  return !!val;
}

// ── Slide animation variants ───────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 70 : -70, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -70 : 70, opacity: 0 }),
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface WizardFlowProps {
  onOpenChat?: () => void;
  onResultsMode?: (active: boolean) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const WizardFlow: React.FC<WizardFlowProps> = ({ onOpenChat, onResultsMode }) => {
  const [[stepIdx, direction], setStepWithDir] = useState<[number, number]>([0, 1]);
  const [answers, setAnswers] = useState<WizardAnswers>({});
  const [showResults, setShowResults] = useState(false);
  const [tiers, setTiers] = useState<ResultTier[] | null>(null);

  // Pending auto-advance timer ref (to avoid double-advance)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback((target: number) => {
    setStepWithDir([target, target > stepIdx ? 1 : -1]);
  }, [stepIdx]);

  const submitAnswers = useCallback(async (finalAnswers: WizardAnswers) => {
    setShowResults(true);
    onResultsMode?.(true);
    try {
      const products = await getAllProducts();
      const result = getThreeTiers(products, finalAnswers);
      setTiers(result);

      // Users with contact info will choose products and submit via "Пусни запитване".
      // Anonymous users (no contact) → results only, no inquiry sent.
    } catch {
      setTiers([]);
    }
  }, [onResultsMode]);

  const handleNext = useCallback(() => {
    if (stepIdx < STEPS.length - 1) {
      navigate(stepIdx + 1);
    } else {
      submitAnswers(answers);
    }
  }, [stepIdx, answers, navigate, submitAnswers]);

  const handleBack = useCallback(() => {
    if (stepIdx > 0) navigate(stepIdx - 1);
  }, [stepIdx, navigate]);

  // Single-select: store answer and auto-advance after brief visual delay
  const handleSelectSingle = useCallback((key: keyof WizardAnswers, value: string) => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);
    autoAdvanceRef.current = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) {
        setStepWithDir(prev => [prev[0] + 1, 1]);
      } else {
        submitAnswers(newAnswers);
      }
    }, 220);
  }, [answers, stepIdx, submitAnswers]);

  // Multi-select: toggle, respect maxSelect
  const handleSelectMulti = useCallback((key: keyof WizardAnswers, value: string, maxSelect: number) => {
    const current = (answers[key] as string[] | undefined) ?? [];
    let next: string[];
    if (current.includes(value)) {
      next = current.filter(v => v !== value);
    } else if (current.length < maxSelect) {
      next = [...current, value];
    } else {
      // Max reached — replace last selection
      next = [...current.slice(0, maxSelect - 1), value];
    }
    setAnswers({ ...answers, [key]: next });
  }, [answers]);

  // Click a breadcrumb chip → jump back to that step
  const handleChipClick = useCallback((stepIndex: number) => {
    navigate(stepIndex);
  }, [navigate]);

  const handleReset = useCallback(() => {
    setStepWithDir([0, -1]);
    setAnswers({});
    setShowResults(false);
    setTiers(null);
    onResultsMode?.(false);
  }, [onResultsMode]);

  // ── Results phase ────────────────────────────────────────────────────────────
  if (showResults) {
    return (
      <ResultsScreen
        tiers={tiers}
        answers={answers}
        onReset={handleReset}
        onOpenChat={onOpenChat}
      />
    );
  }

  const currentStep = STEPS[stepIdx];
  const answered = isStepAnswered(currentStep, answers);
  const isLastStep = stepIdx === STEPS.length - 1;

  // ── Quiz phase ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Progress bar + breadcrumb */}
      <div>
        <ProgressBar
          current={stepIdx}
          total={STEPS.length}
          installationSteps={INSTALLATION_STEPS}
        />
        <AnswerBreadcrumb
          answers={answers}
          stepLabels={STEP_LABELS}
          onClickChip={handleChipClick}
          stepKeyOrder={STEP_KEY_ORDER}
        />
      </div>

      {/* Step slide */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepIdx}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -60 && answered) handleNext();
              if (info.offset.x > 60 && stepIdx > 0) handleBack();
            }}
            className="touch-pan-y select-none"
          >
            <StepContent
              step={currentStep}
              answers={answers}
              onSelectSingle={handleSelectSingle}
              onSelectMulti={handleSelectMulti}
              onContactChange={(name, phone) => setAnswers(a => ({ ...a, name, phone }))}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between pt-2">
        {/* Back button */}
        <motion.button
          type="button"
          onClick={handleBack}
          disabled={stepIdx === 0}
          whileTap={stepIdx > 0 ? { scale: 0.96 } : {}}
          className={[
            'flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all',
            stepIdx === 0
              ? 'text-gray-200 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
          ].join(' ')}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          Назад
        </motion.button>

        <div className="flex items-center gap-3">
          {/* Skip — only on contact step */}
          {currentStep.type === 'contact' && (
            <button
              type="button"
              onClick={() => submitAnswers(answers)}
              className="text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
              Пропусни
            </button>
          )}

          {/* Forward / Submit */}
          {currentStep.type !== 'single' && (
            <motion.button
              type="button"
              onClick={isLastStep ? () => submitAnswers(answers) : handleNext}
              disabled={!answered && currentStep.type !== 'contact'}
              whileHover={answered || currentStep.type === 'contact' ? { scale: 1.02 } : {}}
              whileTap={answered || currentStep.type === 'contact' ? { scale: 0.97 } : {}}
              className={[
                'flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-bold transition-all',
                answered || currentStep.type === 'contact'
                  ? 'bg-gradient-to-r from-[#00B4D8] to-[#0077B6] text-white shadow-md shadow-[#00B4D8]/25 hover:shadow-lg hover:shadow-[#00B4D8]/30'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              ].join(' ')}
            >
              {isLastStep ? 'Виж препоръките' : 'Напред'}
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Swipe hint — mobile only */}
      <p className="sm:hidden text-center text-[11px] text-gray-300 font-light -mt-2">
        Плъзнете наляво/надясно за навигация
      </p>
    </div>
  );
};

// ── StepContent ────────────────────────────────────────────────────────────────

interface StepContentProps {
  step: StepDef;
  answers: WizardAnswers;
  onSelectSingle: (key: keyof WizardAnswers, value: string) => void;
  onSelectMulti: (key: keyof WizardAnswers, value: string, max: number) => void;
  onContactChange: (name: string, phone: string) => void;
}

const StepContent: React.FC<StepContentProps> = ({
  step, answers, onSelectSingle, onSelectMulti, onContactChange,
}) => {
  const [showHint, setShowHint] = useState(false);
  const [localName, setLocalName] = useState(answers.name ?? '');
  const [localPhone, setLocalPhone] = useState(answers.phone ?? '');

  // Contact step
  if (step.type === 'contact') {
    return (
      <div className="flex flex-col gap-6 max-w-sm mx-auto py-4">
        <div className="text-center">
          <h3 className="text-xl font-outfit font-semibold text-gray-900 mb-1">{step.question}</h3>
          <p className="text-sm text-gray-400 font-light">{step.subtitle}</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Напр. Иван Петров"
              value={localName}
              onChange={e => { setLocalName(e.target.value); onContactChange(e.target.value, localPhone); }}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-[#00B4D8] focus:ring-2 focus:ring-[#00B4D8]/10 transition-all"
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" strokeWidth={1.5} />
            <input
              type="tel"
              placeholder="Телефон"
              value={localPhone}
              onChange={e => { setLocalPhone(e.target.value); onContactChange(localName, e.target.value); }}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-[#00B4D8] focus:ring-2 focus:ring-[#00B4D8]/10 transition-all"
            />
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 font-light">
          🔒 Не споделяме данни с трети страни
        </p>
      </div>
    );
  }

  // Option step (single or multi)
  const optionStep = step as OptionStepDef;
  const { key, question, subtitle, type, options, maxSelect = 1, hint } = optionStep;
  const selectedValues = type === 'multi'
    ? ((answers[key] as string[] | undefined) ?? [])
    : [(answers[key] as string | undefined) ?? ''];

  const selectedCount = type === 'multi' ? selectedValues.length : 0;

  // Grid cols: 2 for ≤ 4 options, 3 for 6 options
  const gridCols = options.length <= 4
    ? 'grid-cols-2 sm:grid-cols-2'
    : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="flex flex-col gap-5">
      {/* Question */}
      <div className="text-center">
        <h3 className="text-xl font-outfit font-semibold text-gray-900 mb-1">{question}</h3>
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm text-gray-400 font-light">{subtitle}</p>
          {type === 'multi' && (
            <span className="text-xs font-bold text-[#00B4D8] tabular-nums">
              ({selectedCount}/{maxSelect})
            </span>
          )}
        </div>
      </div>

      {/* Hint toggle */}
      {hint && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHint(h => !h)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00B4D8] transition-colors"
          >
            <Info className="w-3.5 h-3.5" strokeWidth={1.5} />
            {showHint ? 'Скрий' : 'Как да определя?'}
          </button>
          <AnimatePresence>
            {showHint && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5 text-center max-w-xs"
              >
                {hint}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Options grid */}
      <div className={`grid ${gridCols} gap-3`}>
        {options.map(opt => {
          const isSelected = selectedValues.includes(opt.value);
          const isDisabled = type === 'multi' && !isSelected && selectedCount >= maxSelect;

          return (
            <OptionCard
              key={opt.value}
              option={opt}
              selected={isSelected}
              multiMode={type === 'multi'}
              disabled={isDisabled}
              onSelect={val => {
                if (type === 'single') {
                  onSelectSingle(key, val);
                } else {
                  onSelectMulti(key, val, maxSelect);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
