/**
 * Константи и типове за сервизния протокол (профилактика/ремонт/диагностика).
 *
 * Огледало на `protocol-materials.ts` от приемно-предавателния протокол —
 * стандартизира опциите за form selects, label-ите за UI/PDF и
 * стойностите, които се записват в БД.
 *
 * ВАЖНО: Стойностите (`value`) трябва да са синхрон с CHECK constraint-ите
 * в `0041_service_repair_protocols.sql`. Не променяй без миграция.
 */

// ─── Японски марки климатици ───────────────────────────────────────────
// Списък с марките, при които „зареждане на кантар“ е стандартна
// препоръка от производителя. UI ще показва „На кантар“ опцията само
// при тези марки.
export const JAPANESE_BRANDS = [
  "Daikin",
  "Mitsubishi Electric",
  "Mitsubishi Heavy",
  "Fujitsu",
  "Toshiba",
  "Panasonic",
  "Nacional",
  "National",
  "Hitachi",
  "Sharp",
] as const;

export function isJapaneseBrand(brandOrModel: string | null | undefined): boolean {
  if (!brandOrModel) return false;
  const normalized = brandOrModel.toLowerCase();
  return JAPANESE_BRANDS.some((b) => normalized.includes(b.toLowerCase()));
}

// ─── Тип-стойности (enum-and) ──────────────────────────────────────────

export type FreonChargeMethod = "none" | "scale" | "standard";

export type BearingsState = "ok" | "noisy" | "lubricated" | "replaced";

export type NoiseLevel = "quiet" | "normal" | "elevated" | "loud" | "very_loud";

export type RepairProtocolStatus = "prepared" | "in_progress" | "signed";

/** Тип сервизен протокол: клиентски сервиз или рециклиране за магазина. */
export type RepairServiceKind = "client" | "recycle";

export const SERVICE_KIND_OPTIONS: { value: RepairServiceKind; label: string; hint: string }[] = [
  {
    value: "client",
    label: "Сервиз за клиент",
    hint: "Клиент от указателя, адрес и сериен номер",
  },
  {
    value: "recycle",
    label: "Сервиз рециклиране",
    hint: "Втора употреба за магазина — без клиент и сериен №",
  },
];

export const SERVICE_KIND_LABEL: Record<RepairServiceKind, string> = {
  client: "Сервиз за клиент",
  recycle: "Сервиз рециклиране",
};

// ─── UI опции (value + label-и на български) ───────────────────────────

export const FREON_CHARGE_OPTIONS: { value: FreonChargeMethod; label: string }[] = [
  { value: "none", label: "Няма зареждане" },
  { value: "scale", label: "Зареден на кантар (японски)" },
  { value: "standard", label: "Стандартно зареждане" },
];

export const BEARINGS_OPTIONS: { value: BearingsState; label: string }[] = [
  { value: "ok", label: "В ред" },
  { value: "noisy", label: "Шумни" },
  { value: "lubricated", label: "Смазани" },
  { value: "replaced", label: "Сменени" },
];

export const NOISE_OPTIONS: { value: NoiseLevel; label: string }[] = [
  { value: "quiet", label: "Тих" },
  { value: "normal", label: "Нормален" },
  { value: "elevated", label: "Повишен" },
  { value: "loud", label: "Висок" },
  { value: "very_loud", label: "Много висок" },
];

/** Сервизна оценка 1-5 със звезди + кратко описание. */
export const SERVICE_RATING_OPTIONS = [
  { value: 1, label: "1 — Много лошо състояние" },
  { value: 2, label: "2 — Лошо" },
  { value: 3, label: "3 — Средно" },
  { value: 4, label: "4 — Добро" },
  { value: 5, label: "5 — Отлично" },
] as const;

// ─── Lookups за label-и (използва се от PDF и preview) ────────────────

export const FREON_CHARGE_LABEL: Record<FreonChargeMethod, string> = {
  none: "Няма зареждане",
  scale: "Зареден на кантар",
  standard: "Стандартно зареждане",
};

export const BEARINGS_LABEL: Record<BearingsState, string> = {
  ok: "В ред",
  noisy: "Шумни",
  lubricated: "Смазани",
  replaced: "Сменени",
};

export const NOISE_LABEL: Record<NoiseLevel, string> = {
  quiet: "Тих",
  normal: "Нормален",
  elevated: "Повишен",
  loud: "Висок",
  very_loud: "Много висок",
};

export const STATUS_LABEL: Record<RepairProtocolStatus, string> = {
  prepared: "Подготвен",
  in_progress: "В процес на изпълнение",
  signed: "Подписан",
};
