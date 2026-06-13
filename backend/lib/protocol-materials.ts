/** Пълен списък на материалите от хартиения приемно-предавателен протокол. */
export interface ProtocolMaterial {
  id: string;
  name: string;
  unit: string;
  column: "left" | "right";
}

// ─────────────────────────────────────────────────────────────────────────────
// Пълен ред на материалите за PDF/преглед (ляво→дясно от хартиения протокол)
// ─────────────────────────────────────────────────────────────────────────────
const PDF_MATERIALS_ORDERED: ProtocolMaterial[] = [
  // Ляв стълб (оригинал)
  { id: "pipe_635",       name: "Тръба Ф6,35 + изолация 6х6",      unit: "м",   column: "left" },
  { id: "pipe_952",       name: "Тръба Ф9,52 + изолация 10х6",     unit: "м",   column: "left" },
  { id: "pipe_127",       name: "Тръба Ф12,7 + изолация 12х6",     unit: "м",   column: "left" },
  { id: "pipe_1587",      name: "Тръба Ф15,87 + изолация 16х6",    unit: "м",   column: "left" },
  { id: "pipe_18",        name: "Тръба Ф18 + изолация 18х6",       unit: "м",   column: "left" },
  { id: "dyubel_prp_80",  name: "Дюбел PRP 10x80 + винт 7x80",     unit: "бр.", column: "left" },
  { id: "dyubel_prp_100", name: "Дюбел PRP 10x100 + винт 7x100",   unit: "бр.", column: "left" },
  { id: "dyubel_prp_120", name: "Дюбел PRP 10x120 + винт 7x120",   unit: "бр.", column: "left" },
  { id: "dyubel_prp_140", name: "Дюбел PRP 10x140 + винт 7x140",   unit: "бр.", column: "left" },
  { id: "dyubel_prp_160", name: "Дюбел PRP 10x160 + винт 7x160",   unit: "бр.", column: "left" },
  { id: "dyubel_tx",      name: "Дюбел TX RPC 10x200",              unit: "бр.", column: "left" },
  { id: "dyubel_gips",    name: "Дюбел за гипсокартон 10x35",       unit: "бр.", column: "left" },
  { id: "dyubel_trv",     name: "Дюбел TPB 8x60 + винт 5x70",       unit: "бр.", column: "left" },
  { id: "piron_6x40",     name: "Пирон-дюбел PKK 6x40",             unit: "бр.", column: "left" },
  { id: "piron_6x80",     name: "Пирон-дюбел PKK 6x80",             unit: "бр.", column: "left" },
  { id: "piron_8x60",     name: "Пирон-дюбел PKK 8x60",             unit: "бр.", column: "left" },
  { id: "gaika_6",        name: "Конусна гайка Ф6 CP",              unit: "бр.", column: "left" },
  { id: "gaika_10",       name: "Конусна гайка Ф10 CP",             unit: "бр.", column: "left" },
  // Десен стълб (оригинал + нови pri_*)
  { id: "kabel_shvps_3x15",  name: "Кабел ШВПС 3х1,5",                  unit: "м",      column: "right" },
  { id: "kabel_shvps_4x1",   name: "Кабел ШВПС 4х1",                    unit: "м",      column: "right" },
  { id: "kabel_shvps_5x1",   name: "Кабел ШВПС 5х1",                    unit: "м",      column: "right" },
  { id: "kabel_shvps_2x25",  name: "Кабел ШВПС 2х2,5",                  unit: "м",      column: "right" },
  { id: "kabel_shvps_2x4",   name: "Кабел ШВПС 2х4",                    unit: "м",      column: "right" },
  { id: "kabel_shvps_4x15",  name: "Кабел ШВПС 4х1,5",                  unit: "м",      column: "right" },
  { id: "kabel_svt",         name: "Кабел СВТ 3х2,5",                   unit: "м",      column: "right" },
  { id: "stoiki_malki",      name: "Стойки малки 40/45 /поцинковани/",   unit: "бр.",    column: "right" },
  { id: "stoiki_golemi",     name: "Стойки големи 40/55 /поцинковани/",  unit: "бр.",    column: "right" },
  { id: "stoiki_koloni",     name: "Стойки колони 50/60 /поцинковани/",  unit: "бр.",    column: "right" },
  { id: "stoiki_podovi",     name: "Стойки подови 14/43 /поцинковани/",  unit: "бр.",    column: "right" },
  { id: "stoiki_tavani",     name: "Стойки тавани /поцинковани/",        unit: "бр.",    column: "right" },
  { id: "drenaj_markuch",    name: "Дренажен маркуч 5/8",                unit: "м",      column: "right" },
  { id: "tava_klima",        name: "Тава за климатик с държач",          unit: "бр.",    column: "right" },
  { id: "tamponi",           name: "Тампони",                            unit: "компл.", column: "right" },
  { id: "sprei",             name: "Спрей за климатици",                 unit: "бр.",    column: "right" },
  { id: "drenaj_pompa",      name: "Дренажна помпа",                     unit: "бр.",    column: "right" },
  { id: "transformator",     name: "Трансформатор 100V-18A/ 200V-18A",   unit: "бр.",    column: "right" },
  { id: "pri_gofre",         name: "Гофре",                              unit: "м",      column: "right" },
  { id: "pri_kabel_3x25",    name: "Кабел - 3 х 2,5",                   unit: "м",      column: "right" },
  { id: "pri_izolatsia",     name: "Изолация",                           unit: "м",      column: "right" },
  { id: "pri_shaiba_f8",     name: "Шайби - Ф8",                        unit: "бр.",    column: "right" },
  { id: "pri_bolt_8x30",     name: "Болт - 8 х 30",                     unit: "бр.",    column: "right" },
  { id: "pri_gaika_f8",      name: "Гайка - Ф8",                        unit: "бр.",    column: "right" },
  { id: "pri_vint_7x80",     name: "Винт - 7 х 80",                     unit: "бр.",    column: "right" },
  { id: "pri_vint_7x100",    name: "Винт - 7 х 100",                    unit: "бр.",    column: "right" },
  { id: "pri_vint_7x120",    name: "Винт - 7 х 120",                    unit: "бр.",    column: "right" },
  { id: "pri_vint_7x140",    name: "Винт - 7 х 140",                    unit: "бр.",    column: "right" },
  { id: "pri_vint_7x160",    name: "Винт - 7 х 160",                    unit: "бр.",    column: "right" },
  { id: "pri_dyubel_16x200", name: "Дюбел - 16 х 200",                  unit: "бр.",    column: "right" },
  { id: "pri_vint_5x70",     name: "Винт - 5 х 70",                     unit: "бр.",    column: "right" },
];

/** Равномерно разделяне на две колони за PDF и преглед (26 + 26 реда). */
const PDF_SPLIT_AT = Math.ceil(PDF_MATERIALS_ORDERED.length / 2);

export const PDF_LEFT_MATERIALS: ProtocolMaterial[] = PDF_MATERIALS_ORDERED
  .slice(0, PDF_SPLIT_AT)
  .map(m => ({ ...m, column: "left" as const }));

export const PDF_RIGHT_MATERIALS: ProtocolMaterial[] = PDF_MATERIALS_ORDERED
  .slice(PDF_SPLIT_AT)
  .map(m => ({ ...m, column: "right" as const }));

// ─────────────────────────────────────────────────────────────────────────────
// Стъпка 2 в уизарда — Главни монтажни елементи
// Ползва ОРИГИНАЛНИТЕ ID-та за позиции вече в PDF, нови само за наистина нови.
// ─────────────────────────────────────────────────────────────────────────────
export const PRIMARY_MATERIALS: ProtocolMaterial[] = [
  { id: "pipe_635",        name: "Тръба - Ф6",        unit: "м",   column: "left" },
  { id: "pipe_952",        name: "Тръба - Ф10",       unit: "м",   column: "left" },
  { id: "pipe_127",        name: "Тръба - Ф12",       unit: "м",   column: "left" },
  { id: "pri_gofre",       name: "Гофре",              unit: "м",   column: "left" },
  { id: "kabel_shvps_3x15",name: "Кабел - 3 х 1,5",  unit: "м",   column: "left" },
  { id: "pri_kabel_3x25",  name: "Кабел - 3 х 2,5",  unit: "м",   column: "left" },
  { id: "kabel_svt",       name: "СВТ - 3 х 2,5",    unit: "м",   column: "left" },
  { id: "pri_izolatsia",   name: "Изолация",           unit: "м",   column: "left" },
  { id: "stoiki_golemi",   name: "Стойки - 40/55",   unit: "бр.", column: "left" },
  { id: "pri_shaiba_f8",   name: "Шайби - Ф8",       unit: "бр.", column: "left" },
  { id: "pri_bolt_8x30",   name: "Болт - 8 х 30",    unit: "бр.", column: "left" },
  { id: "pri_gaika_f8",    name: "Гайка - Ф8",       unit: "бр.", column: "left" },
  { id: "dyubel_prp_80",   name: "Дюбел - 10 х 80",  unit: "бр.", column: "left" },
  { id: "pri_vint_7x80",   name: "Винт - 7 х 80",    unit: "бр.", column: "left" },
  { id: "dyubel_prp_100",  name: "Дюбел - 10 х 100", unit: "бр.", column: "left" },
  { id: "pri_vint_7x100",  name: "Винт - 7 х 100",   unit: "бр.", column: "left" },
  { id: "dyubel_prp_120",  name: "Дюбел - 10 х 120", unit: "бр.", column: "left" },
  { id: "pri_vint_7x120",  name: "Винт - 7 х 120",   unit: "бр.", column: "left" },
  { id: "dyubel_prp_140",  name: "Дюбел - 10 х 140", unit: "бр.", column: "left" },
  { id: "pri_vint_7x140",  name: "Винт - 7 х 140",   unit: "бр.", column: "left" },
  { id: "dyubel_prp_160",  name: "Дюбел - 10 х 160", unit: "бр.", column: "left" },
  { id: "pri_vint_7x160",  name: "Винт - 7 х 160",   unit: "бр.", column: "left" },
  { id: "pri_dyubel_16x200",name: "Дюбел - 16 х 200",unit: "бр.", column: "left" },
  { id: "dyubel_trv",      name: "Дюбел - 8 х 60",   unit: "бр.", column: "left" },
  { id: "pri_vint_5x70",   name: "Винт - 5 х 70",    unit: "бр.", column: "left" },
];

/** ID-та от PRIMARY_MATERIALS, взети директно от оригиналните масиви. */
const PRIMARY_REUSED_IDS = new Set([
  "pipe_635", "pipe_952", "pipe_127",
  "kabel_shvps_3x15", "kabel_svt", "stoiki_golemi",
  "dyubel_prp_80", "dyubel_prp_100", "dyubel_prp_120",
  "dyubel_prp_140", "dyubel_prp_160", "dyubel_trv",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Стъпка 3 в уизарда — Допълнителни тръби & дюбели (без тези вече в PRIMARY)
// ─────────────────────────────────────────────────────────────────────────────
export const LEFT_MATERIALS: ProtocolMaterial[] = PDF_LEFT_MATERIALS.filter(
  m => !PRIMARY_REUSED_IDS.has(m.id),
);

// ─────────────────────────────────────────────────────────────────────────────
// Стъпка 4 в уизарда — Допълнителни кабели & стойки (без тези вече в PRIMARY)
// ─────────────────────────────────────────────────────────────────────────────
export const RIGHT_MATERIALS: ProtocolMaterial[] = PDF_RIGHT_MATERIALS.filter(
  m => !PRIMARY_REUSED_IDS.has(m.id) && !m.id.startsWith("pri_"),
);

// ─────────────────────────────────────────────────────────────────────────────
// Пълен набор за сериализация на payload-а — всички уникални ID-та от уизарда.
// ─────────────────────────────────────────────────────────────────────────────
export const PROTOCOL_MATERIALS: ProtocolMaterial[] = [
  ...PRIMARY_MATERIALS,
  ...LEFT_MATERIALS,
  ...RIGHT_MATERIALS,
];

export const MOUNT_TYPES = [
  "вишка", "скеле", "тераса",
  "под прозорец", "наземен", "демонтаж",
  "камък", "тухла", "бетон", "друго",
] as const;

export type MountType = typeof MOUNT_TYPES[number];

export interface MaterialEntry {
  id: string;
  name: string;
  unit: string;
  qty: number;
}

export interface AccessoriesEntry {
  cable_channels_m: number;
  outer_corner: number;
  inner_corner: number;
  angle_out: number;
  connector: number;
  inner_cap: number;
  outer_cap: number;
  end_cap: number;
  holder: number;
}

export const EMPTY_ACCESSORIES: AccessoriesEntry = {
  cable_channels_m: 0,
  outer_corner: 0,
  inner_corner: 0,
  angle_out: 0,
  connector: 0,
  inner_cap: 0,
  outer_cap: 0,
  end_cap: 0,
  holder: 0,
};

/** Ред и текст като на хартиената бланка (ред „Кабелни канали …"). */
export const ACCESSORIES_LABELS: Record<keyof AccessoriesEntry, string> = {
  cable_channels_m: "Кабелни канали/ м",
  outer_corner:     "Външен ъгъл/ бр.",
  inner_corner:     "Вътрешен ъгъл/ бр.",
  angle_out:        "L-ъгъл/ бр.",
  connector:        "Конектор/ бр.",
  inner_cap:        "Вътрешна капачка/ бр.",
  outer_cap:        "Външна капачка/ бр.",
  end_cap:          "Краен капак/ бр.",
  holder:           "Държач/ бр.",
};
