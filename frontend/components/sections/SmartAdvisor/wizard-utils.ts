import type { WizardAnswers, ResultTier } from './types';

export const LABEL_MAP: Record<string, Record<string, string>> = {
  roomType:     { bedroom: 'Спалня', living: 'Дневна', kids: 'Детска', office: 'Офис', kitchen: 'Кухня', commercial: 'Търговски' },
  area:         { tiny: 'до 20 м²', small: '20–30 м²', medium: '30–45 м²', large: '45–60 м²', xlarge: 'над 60 м²' },
  orientation:  { north: 'Север', south: 'Юг/Запад', top: 'Горен ет.', unknown: 'Без данни' },
  usage:        { cooling: 'Само лято', both: 'Лято и зима', heating: 'Основно зима' },
  budget:       { budget: 'до €450', mid: '€450–720', comfort: '€720–1 150', premium: 'над €1 150' },
  floor:        { ground: 'Партерен', low: '2–5 ет.', mid: '6–10 ет.', high: 'Над 10 ет.' },
  buildingType: { panel: 'Панелен', brick: 'Тухлена', house: 'Къща', office: 'Офис сгр.', new: 'Ново стр.' },
};

const PRIORITY_FULL: Record<string, string> = {
  quiet:        'Тиха работа',
  efficiency:   'Висока ефективност (А+++)',
  wifi:         'WiFi управление',
  purification: 'Чист въздух',
  design:       'Стилен дизайн',
  fast:         'Бърз монтаж',
};

export function formatWizardMessage(
  answers: WizardAnswers,
  tiers: ResultTier[],
  selectedIds?: string[],
): string {
  const lines: string[] = [
    '📋 АНКЕТА ЗА ИЗБОР НА КЛИМАТИК',
    '',
    `🏠 Тип помещение  : ${LABEL_MAP.roomType[answers.roomType ?? ''] ?? '—'}`,
    `📐 Площ           : ${LABEL_MAP.area[answers.area ?? ''] ?? '—'}`,
    `☀️  Изложение     : ${LABEL_MAP.orientation[answers.orientation ?? ''] ?? '—'}`,
    `❄️  Употреба      : ${LABEL_MAP.usage[answers.usage ?? ''] ?? '—'}`,
    `⭐ Приоритети     : ${(answers.priorities ?? []).map(p => PRIORITY_FULL[p] ?? p).join(' · ') || '—'}`,
    `💰 Бюджет         : ${LABEL_MAP.budget[answers.budget ?? ''] ?? '—'}`,
    `🏗️  Монтаж – Етаж : ${LABEL_MAP.floor[answers.floor ?? ''] ?? '—'}`,
    `🏘️  Монтаж – Сграда: ${LABEL_MAP.buildingType[answers.buildingType ?? ''] ?? '—'}`,
  ];

  const selected = selectedIds && selectedIds.length > 0
    ? tiers.filter(t => selectedIds.includes(t.scored.product.id))
    : tiers;

  if (selected.length > 0) {
    const header = selectedIds && selectedIds.length > 0
      ? '✅ ИЗБРАНИ КЛИМАТИЦИ ЗА ОФЕРТА:'
      : '📊 ПРЕПОРЪЧАНИ КЛИМАТИЦИ:';
    lines.push('', header);
    const tierNames = ['Икономичен', 'Препоръчан', 'Премиум'];
    selected.forEach((tier, i) => {
      const p = tier.scored.product;
      const install = tier.scored.installCost;
      const total = Math.round(p.price + install);
      const tierIdx = tiers.indexOf(tier);
      lines.push(
        `${i + 1}. [${tierNames[tierIdx] ?? tier.tierLabel}] ${p.brand} ${p.name}` +
        ` — €${p.price} + €${install} монтаж = €${total} общо`,
      );
    });
  }

  return lines.join('\n');
}
