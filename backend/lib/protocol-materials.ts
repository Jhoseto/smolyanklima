/** Пълен списък на материалите от хартиения приемно-предавателен протокол. */
export interface ProtocolMaterial {
  id: string;
  name: string;
  unit: string;
  column: "left" | "right";
}

/** Текстовете следват хартиения протокол (еднакви интервали и означения като на бланката). */
export const PROTOCOL_MATERIALS: ProtocolMaterial[] = [
  // ── Ляв стълб ──────────────────────────────────────────────────────────────
  { id: "pipe_635",   name: "Тръба Ф6,35 + изолация 6х6",    unit: "м",  column: "left" },
  { id: "pipe_952",   name: "Тръба Ф9,52 + изолация 10х6",   unit: "м",  column: "left" },
  { id: "pipe_127",   name: "Тръба Ф12,7 + изолация 12х6",   unit: "м",  column: "left" },
  { id: "pipe_1587",  name: "Тръба Ф15,87 + изолация 16х6",  unit: "м",  column: "left" },
  { id: "pipe_18",    name: "Тръба Ф18 + изолация 18х6",    unit: "м",  column: "left" },
  { id: "dyubel_prp_80",  name: "Дюбел PRP 10x80 + винт 7x80",    unit: "бр.", column: "left" },
  { id: "dyubel_prp_100", name: "Дюбел PRP 10x100 + винт 7x100",  unit: "бр.", column: "left" },
  { id: "dyubel_prp_120", name: "Дюбел PRP 10x120 + винт 7x120",  unit: "бр.", column: "left" },
  { id: "dyubel_prp_140", name: "Дюбел PRP 10x140 + винт 7x140",  unit: "бр.", column: "left" },
  { id: "dyubel_prp_160", name: "Дюбел PRP 10x160 + винт 7x160",  unit: "бр.", column: "left" },
  { id: "dyubel_tx",       name: "Дюбел TX RPC 10x200",             unit: "бр.", column: "left" },
  { id: "dyubel_gips",     name: "Дюбел за гипсокартон 10x35",      unit: "бр.", column: "left" },
  { id: "dyubel_trv",      name: "Дюбел TPB 8x60 + винт 5x70",      unit: "бр.", column: "left" },
  { id: "piron_6x40",      name: "Пирон-дюбел PKK 6x40",            unit: "бр.", column: "left" },
  { id: "piron_6x80",      name: "Пирон-дюбел PKK 6x80",            unit: "бр.", column: "left" },
  { id: "piron_8x60",      name: "Пирон-дюбел PKK 8x60",            unit: "бр.", column: "left" },
  { id: "gaika_6",         name: "Конусна гайка Ф6 CP",             unit: "бр.", column: "left" },
  { id: "gaika_10",        name: "Конусна гайка Ф10 CP",            unit: "бр.", column: "left" },

  // ── Десен стълб ────────────────────────────────────────────────────────────
  { id: "kabel_shvps_3x15",  name: "Кабел ШВПС 3х1,5",              unit: "м",  column: "right" },
  { id: "kabel_shvps_4x1",   name: "Кабел ШВПС 4х1",                unit: "м",  column: "right" },
  { id: "kabel_shvps_5x1",   name: "Кабел ШВПС 5х1",                unit: "м",  column: "right" },
  { id: "kabel_shvps_2x25",  name: "Кабел ШВПС 2х2,5",              unit: "м",  column: "right" },
  { id: "kabel_shvps_2x4",   name: "Кабел ШВПС 2х4",                unit: "м",  column: "right" },
  { id: "kabel_shvps_4x15",  name: "Кабел ШВПС 4х1,5",              unit: "м",  column: "right" },
  { id: "kabel_svt",         name: "Кабел СВТ 3х2,5",               unit: "м",  column: "right" },
  { id: "stoiki_malki",      name: "Стойки малки 40/45 /поцинковани/", unit: "бр.", column: "right" },
  { id: "stoiki_golemi",     name: "Стойки големи 40/55 /поцинковани/", unit: "бр.", column: "right" },
  { id: "stoiki_koloni",     name: "Стойки колони 50/60 /поцинковани/", unit: "бр.", column: "right" },
  { id: "stoiki_podovi",     name: "Стойки подови 14/43 /поцинковани/", unit: "бр.", column: "right" },
  { id: "stoiki_tavani",     name: "Стойки тавани /поцинковани/",    unit: "бр.", column: "right" },
  { id: "drenaj_markuch",    name: "Дренажен маркуч 5/8",            unit: "м",  column: "right" },
  { id: "tava_klima",        name: "Тава за климатик с държач",      unit: "бр.", column: "right" },
  { id: "tamponi",           name: "Тампони",                         unit: "компл.", column: "right" },
  { id: "sprei",             name: "Спрей за климатици",             unit: "бр.", column: "right" },
  { id: "drenaj_pompa",      name: "Дренажна помпа",                 unit: "бр.", column: "right" },
  { id: "transformator",     name: "Трансформатор 100V-18A/ 200V-18A", unit: "бр.", column: "right" },
];

export const LEFT_MATERIALS  = PROTOCOL_MATERIALS.filter(m => m.column === "left");
export const RIGHT_MATERIALS = PROTOCOL_MATERIALS.filter(m => m.column === "right");

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

/** Ред и текст като на хартиената бланка (ред „Кабелни канали …“). */
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
