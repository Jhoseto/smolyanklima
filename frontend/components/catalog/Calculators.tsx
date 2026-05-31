import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Calculator, TrendingDown, TrendingUp } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';
import {
  bgnToEur,
  compareProductsVsOldUnit,
  defaultOldCoolingKw,
  EVN_TARIFF,
  evnEffectivePriceEur,
  roomCoolingLoadKw,
  isEnergyCompareEligible,
  type OldUnitTier,
  SIZING_STATUS_LABEL,
} from '../../lib/catalog/energySavings';
import {
  calculateRoomSizing,
  type InsulationLevel,
} from '../../lib/catalog/roomSizing';

type CompareEnergySavingsProps = {
  products: CatalogProduct[];
};

function CompactSlider({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  accentClass,
}: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  accentClass: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[10px] text-gray-600">
        <span>{label}</span>
        <span className="font-bold text-gray-900">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-1 w-full ${accentClass}`}
      />
    </div>
  );
}

const OLD_TIER_LABELS: { id: OldUnitTier; label: string }[] = [
  { id: 'very_old', label: 'Много стар' },
  { id: 'old', label: 'Стар' },
  { id: 'average', label: 'Среден' },
  { id: 'good', label: 'Добър инвертор' },
];

/** Икономия на ток (EVN) — реалистично сравнение спрямо стар уред. */
export function CompareEnergySavings({ products }: CompareEnergySavingsProps) {
  const [area, setArea] = useState(25);
  const [insulation, setInsulation] = useState<InsulationLevel>('good');
  const [oldCoolingKw, setOldCoolingKw] = useState(2.5);
  const [oldTier, setOldTier] = useState<OldUnitTier>('average');
  const [oldHasInverter, setOldHasInverter] = useState(true);
  const [hoursPerDay, setHoursPerDay] = useState(24);
  const [oldTouched, setOldTouched] = useState(false);

  useEffect(() => {
    if (!oldTouched) setOldCoolingKw(defaultOldCoolingKw(area, insulation));
  }, [area, insulation, oldTouched]);

  useEffect(() => {
    const minKw = Math.max(1, Math.round(roomCoolingLoadKw(area, insulation) * 0.7 * 10) / 10);
    setOldCoolingKw((kw) => (kw < minKw ? minKw : kw));
  }, [area, insulation]);

  useEffect(() => {
    if (oldTier === 'good') setOldHasInverter(true);
    if (oldTier === 'very_old') setOldHasInverter(false);
  }, [oldTier]);

  const oldNominalMinKw = Math.max(1, Math.round(roomCoolingLoadKw(area, insulation) * 0.7 * 10) / 10);

  const priceEur = evnEffectivePriceEur();
  const dayEur = bgnToEur(EVN_TARIFF.dayBgnPerKwh);
  const nightEur = bgnToEur(EVN_TARIFF.nightBgnPerKwh);

  const {
    roomLoadKw,
    oldDrawKw,
    oldSeerUsed,
    oldLoadFraction,
    oldCorrectionFactor,
    oldMonthlyEur,
    oldUndersized,
    rows,
  } = useMemo(
      () =>
        compareProductsVsOldUnit(products, {
          areaM2: area,
          insulation,
          hoursPerDay,
          oldCoolingKw,
          oldTier,
          oldHasInverter,
        }),
      [products, area, insulation, hoursPerDay, oldCoolingKw, oldTier, oldHasInverter],
    );

  const comparableRows = rows.filter(
    (r) => isEnergyCompareEligible(r.product) && r.sizingStatus !== 'undersized',
  );
  const bestDelta =
    comparableRows.length > 0 ? Math.max(...comparableRows.map((r) => r.monthlyDeltaEur)) : 0;

  return (
    <div className="mt-4 rounded-xl border border-[#00B4D8]/15 bg-gradient-to-br from-[#F0F9FF]/90 to-[#E8F4FD]/60 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-yellow-500" />
        <h3 className="text-xs font-bold text-gray-900">Разход ток · EVN</h3>
        <span className="ml-auto text-[9px] text-gray-400">КЕВР {EVN_TARIFF.kevrDecision}</span>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <CompactSlider
          label="Площ"
          valueLabel={`${area} m²`}
          min={10}
          max={80}
          step={1}
          value={area}
          onChange={setArea}
          accentClass="accent-[#00B4D8]"
        />
        <div className="flex flex-col justify-end">
          <span className="mb-0.5 text-[10px] text-gray-600">Изолация</span>
          <div className="flex rounded-md bg-white/80 p-0.5 text-[10px] font-bold ring-1 ring-gray-200/80">
            <button
              type="button"
              onClick={() => setInsulation('good')}
              className={`flex-1 rounded px-1 py-0.5 ${insulation === 'good' ? 'bg-[#EBF5FF] text-[#0077B6]' : 'text-gray-500'}`}
            >
              Добра
            </button>
            <button
              type="button"
              onClick={() => setInsulation('poor')}
              className={`flex-1 rounded px-1 py-0.5 ${insulation === 'poor' ? 'bg-[#FFF7F2] text-[#FF4D00]' : 'text-gray-500'}`}
            >
              Слаба
            </button>
          </div>
        </div>
        <CompactSlider
          label="Часове/ден"
          valueLabel={hoursPerDay >= 24 ? '24ч (непрек.)' : `${hoursPerDay}ч`}
          min={1}
          max={24}
          step={1}
          value={hoursPerDay}
          onChange={setHoursPerDay}
          accentClass="accent-[#00B4D8]"
        />
      </div>

      <div className="mb-2 rounded-lg bg-white/70 px-2 py-1.5 ring-1 ring-gray-200/80">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">Старият климатик</p>
        <div className="mb-1.5 grid grid-cols-2 gap-1 sm:grid-cols-4">
          {OLD_TIER_LABELS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOldTier(t.id)}
              className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                oldTier === t.id ? 'bg-yellow-100 text-yellow-800' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={oldTier === 'good' ? '' : 'grid grid-cols-2 gap-2'}>
          <CompactSlider
            label="Номинал стар (kW)"
            valueLabel={`${oldCoolingKw}`}
            min={oldNominalMinKw}
            max={7}
            step={0.1}
            value={oldCoolingKw}
            onChange={(v) => {
              setOldTouched(true);
              setOldCoolingKw(v);
            }}
            accentClass="accent-yellow-500"
          />
          {oldTier !== 'good' && (
          <div className="flex flex-col justify-end">
            <span className="mb-0.5 text-[10px] text-gray-600">Инвертор</span>
            <button
              type="button"
              disabled={oldTier === 'very_old'}
              title={oldTier === 'very_old' ? 'Много стари уреди (преди ~2005) нямат инвертор' : undefined}
              onClick={() => setOldHasInverter((v) => !v)}
              className={`rounded-md py-1 text-[10px] font-bold ring-1 ${
                oldTier === 'very_old'
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 ring-gray-200'
                  : oldHasInverter
                    ? 'bg-[#EBF5FF] text-[#0077B6] ring-[#00B4D8]/30'
                    : 'bg-gray-50 text-gray-500 ring-gray-200'
              }`}
            >
              {oldHasInverter ? 'Да' : 'Не'}
            </button>
          </div>
          )}
        </div>
      </div>

      <p className="mb-2 text-center text-[9px] leading-snug text-gray-500">
        EVN €{dayEur.toFixed(4)} ден · €{nightEur.toFixed(4)} нощ/kWh · нужда ~{roomLoadKw.toFixed(2)} kW
        <br />
        Стар уред: SEER ~{oldSeerUsed.toFixed(1)} · к={oldCorrectionFactor.toFixed(2)} ·{' '}
        {Math.round(oldLoadFraction * 100)}% нат. · ~{oldDrawKw.toFixed(3)} kW ток →{' '}
        <span className="font-semibold">€{oldMonthlyEur.toFixed(2)}</span>/мес.
      </p>
      <p className="mb-2 text-center text-[9px] leading-snug text-amber-800/90">
        Сметката: еднаква нужда ÷ (SEER × k). Преразмерен модел → нисък k → по-висок разход. Червено = по-скъп от
        стария.
      </p>
      {oldUndersized && (
        <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-center text-[9px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
          Номиналът е под нуждите на помещението — сметката ползва нуждата ~{roomLoadKw.toFixed(1)} kW, не по-ниския
          номинал. По-малък номинал не означава по-малка сметка.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(
          ({
            product,
            drawKw,
            seerUsed,
            loadFraction,
            correctionFactor,
            sizingStatus,
            monthlyCostEur,
            monthlyDeltaEur,
          }) => {
            const eligible = isEnergyCompareEligible(product);
            const undersized = sizingStatus === 'undersized';
            const saves = monthlyDeltaEur > 0.5 && eligible && !undersized;
            const costsMore = monthlyDeltaEur < -0.5 && eligible;
            const isBest = monthlyDeltaEur === bestDelta && saves;

            return (
            <div
              key={product.id}
              className={`rounded-lg border bg-white px-2.5 py-2 ${
                !eligible || undersized
                  ? 'border-amber-300 bg-amber-50/40'
                  : costsMore
                    ? 'border-red-300 bg-red-50/50'
                    : isBest
                      ? 'border-green-400 bg-green-50/40'
                      : 'border-gray-100'
              }`}
            >
              <p className="truncate text-[9px] font-bold uppercase text-[#00B4D8]">{product.brand}</p>
              <p className="mb-1 truncate text-[11px] font-bold leading-tight text-gray-900">{product.model}</p>
              <p className="text-[9px] text-gray-500">
                {drawKw} kW · SEER {seerUsed.toFixed(1)}
                {loadFraction != null ? ` · ${Math.round(loadFraction * 100)}% нат.` : ''}
                {correctionFactor != null ? ` · к=${correctionFactor.toFixed(2)}` : ''}
                {sizingStatus && sizingStatus !== 'good' ? ` · ${SIZING_STATUS_LABEL[sizingStatus]}` : ''} · €
                {monthlyCostEur.toFixed(2)}/мес.
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-1 border-t border-gray-100 pt-1">
                <span className="text-[9px] text-gray-500">спрямо стар</span>
                <motion.span
                  key={monthlyDeltaEur}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`text-sm font-black ${
                    costsMore ? 'text-red-600' : saves ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {costsMore && (
                    <span className="inline-flex items-center gap-0.5">
                      <TrendingUp className="h-3 w-3" />+€{Math.abs(monthlyDeltaEur).toFixed(2)}
                    </span>
                  )}
                  {saves && (
                    <span className="inline-flex items-center gap-0.5">
                      <TrendingDown className="h-3 w-3" />−€{monthlyDeltaEur.toFixed(2)}
                    </span>
                  )}
                  {!saves && !costsMore && eligible && !undersized && '≈ €0'}
                  {(undersized || !eligible) && (
                    <span className="text-[10px] font-bold text-amber-700">неприложимо</span>
                  )}
                </motion.span>
              </div>
              {isBest && (
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-bold text-green-700">
                  най-икономичен
                </span>
              )}
              {costsMore && (
                <span className="mt-0.5 text-[8px] font-bold text-red-600">по-скъп от стария</span>
              )}
              {undersized && (
                <p className="mt-0.5 text-[8px] font-bold leading-snug text-amber-700">
                  Не покрива нуждата — реалният разход ще е по-висок
                </p>
              )}
              {!eligible && (
                <p className="mt-0.5 text-[8px] font-bold leading-snug text-amber-700">
                  Само външно тяло / непълна система — сравнението не е приложимо
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-center text-[8px] leading-snug text-gray-400">
        Формула: месечен ток ≈ (нужда ÷ (SEER × k)) × часове × 30 × EVN €/kWh. Натоварване = нужда ÷ номинал;
        k коригира спрямо EN 14825 профила.
      </p>
    </div>
  );
}

export const PowerCalculator = () => {
  const [area, setArea] = useState(25);
  const [insulation, setInsulation] = useState<InsulationLevel>('good');

  const sizing = useMemo(
    () => calculateRoomSizing(area, insulation),
    [area, insulation],
  );

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
          <Calculator className="h-4 w-4 text-blue-500" />
        </div>
        <h3 className="font-bold text-gray-900">Нужна мощност</h3>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <label className="mb-1 flex justify-between text-gray-600">
            <span>Площ (м²)</span>
            <span className="font-bold text-gray-900">{area}</span>
          </label>
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={area}
            onChange={(e) => setArea(Number(e.target.value))}
            className="w-full accent-[#00B4D8]"
          />
        </div>

        <div className="flex rounded-lg bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setInsulation('good')}
            className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-colors ${
              insulation === 'good' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Добра изолация
          </button>
          <button
            type="button"
            onClick={() => setInsulation('poor')}
            className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-colors ${
              insulation === 'poor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Слаба изолация
          </button>
        </div>
      </div>

      <div className="mt-5 text-center">
        <p className="mb-1 text-xs text-gray-500">Препоръчителна мощност:</p>
        <motion.p
          key={sizing.label}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xl font-black text-[#FF4D00]"
        >
          ~{sizing.label}
        </motion.p>
        <p className="mt-1 text-[10px] leading-snug text-gray-400">
          ≈ {sizing.requiredKw.toLocaleString('bg-BG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
          {' · '}
          типично до ~{sizing.typicalMaxM2} m² при{' '}
          {insulation === 'good' ? 'добра' : 'слаба'} изолация
        </p>
      </div>
    </div>
  );
}
