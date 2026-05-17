const BRAND_ALIASES: Array<{ patterns: RegExp[]; brandName: string }> = [
  // Конкретни марки преди „General“ (серия Fujitsu General).
  { patterns: [/\bauratsu\b/i], brandName: "Auratsu" },
  { patterns: [/\baspen\b/i], brandName: "Aspen" },
  { patterns: [/\batlantic\b/i], brandName: "Atlantic" },
  { patterns: [/\bwilliams\b/i], brandName: "Williams" },
  { patterns: [/\bolimpia\s*splendid\b/i], brandName: "Olimpia Splendid" },
  { patterns: [/\bkaisai\b/i], brandName: "Kaisai" },
  { patterns: [/\bdaikin\b/i], brandName: "Daikin" },
  { patterns: [/\bmitsubishi\s*electric\b/i], brandName: "Mitsubishi Electric" },
  { patterns: [/\bmitsubishi\s*heavy\b/i], brandName: "Mitsubishi Heavy" },
  { patterns: [/\bsamsung\b/i], brandName: "Samsung" },
  { patterns: [/\blg\b/i], brandName: "LG" },
  { patterns: [/\bgree\b/i], brandName: "Gree" },
  { patterns: [/\bpanasonic\b/i], brandName: "Panasonic" },
  { patterns: [/\bhitachi\b/i], brandName: "Hitachi" },
  { patterns: [/\bcarrier\b/i], brandName: "Carrier" },
  { patterns: [/\btoshiba\b/i], brandName: "Toshiba" },
  { patterns: [/\bmidea\b/i], brandName: "Midea" },
  { patterns: [/\bsharp\b/i], brandName: "Sharp" },
  { patterns: [/\bnacional\b/i], brandName: "Nacional" },
  { patterns: [/general\s*fujitsu/i, /\bfujitsu\b/i, /\bgeneral\b/i], brandName: "Fujitsu" },
];

export function extractModelCode(text: string): string | null {
  const slash = text.match(/\b([A-Z]{2,}[\dA-Z-]*)\s*\/\s*([A-Z]{2,}[\dA-Z-]*)\b/i);
  if (slash) return `${slash[1]!.toUpperCase()}/${slash[2]!.toUpperCase()}`;
  const matches = text.match(/\b([A-Z]{2,}[\dA-Z-]{2,})\b/g);
  if (!matches?.length) return null;
  const candidates = matches.filter((c) => c.length >= 5 && !/^(BGN|EUR|SEER|SCOP|WIFI)$/i.test(c));
  return candidates.length ? candidates[candidates.length - 1]!.toUpperCase() : null;
}

export function resolveBrandName(title: string, brandHint?: string | null): string | null {
  const hay = `${brandHint ?? ""} ${title}`;
  for (const { patterns, brandName } of BRAND_ALIASES) {
    if (patterns.some((p) => p.test(hay))) return brandName;
  }
  return brandHint?.trim() || null;
}
