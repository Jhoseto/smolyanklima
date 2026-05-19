/**
 * EU етикет A … A+++ от текст или supplier assets (Climacom: А-2.png → A++).
 * Нормализира кирилско „А“ (U+0410) към латинско A.
 */

export function normalizeEnergyClassLetters(text: string): string {
  return text.replace(/\u0410/g, "A");
}

/** Парсва A, A+, A++, A+++ от текст (най-дългото съвпадение първо).
 *  Обработва и формати с интервали: "A ++", "A + + +" → нормализира до "A++", "A+++".
 */
export function parseEnergyClassFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const t = normalizeEnergyClassLetters(text.trim());
  // Match A with optional spaces before/between plus signs (e.g. "A ++", "A + + +")
  const withPlus = t.match(/A\s*\+\s*\+\s*\+|A\s*\+\s*\+|A\s*\+(?![\s*+])/i);
  if (withPlus) return withPlus[0]!.replace(/\s+/g, "").toUpperCase();
  if (/^A$/i.test(t)) return "A";
  const afterNum = t.match(/(\d+[.,]?\d*)\s+(A)\b(?!\s*\+)/i);
  if (afterNum) return afterNum[2]!.toUpperCase();
  return null;
}

/**
 * Climacom: `…/А-2.png` → A++ (цифрата = брой „+“).
 * Също `A++.png`, `a-plus-3`, текст в alt/title.
 */
export function parseEnergyClassFromImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const base = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "");
  const climacom = base.match(/(?:^|[-_])([AА])-(\d)\.(?:png|jpe?g|webp|svg)$/i);
  if (climacom) {
    const pluses = Number(climacom[2]);
    if (Number.isFinite(pluses) && pluses >= 0 && pluses <= 3) {
      return pluses === 0 ? "A" : `A${"+".repeat(pluses)}`;
    }
  }
  return parseEnergyClassFromText(base);
}

/** Енергиен клас от редове „Енергиен клас при охл./отопл.“ и вграден клас в SEER/SCOP (Climacom). */
export function extractClimacomEnergyClasses(html: string): { cool: string | null; heat: string | null } {
  let cool: string | null = null;
  let heat: string | null = null;
  const stripLabel = (frag: string) =>
    frag
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  for (const block of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    if (!/охлажд|seer|scop|енерги|cooling|heating|energy efficiency/i.test(block)) continue;
    for (const row of block.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells: string[] = [];
      for (const td of row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)) {
        cells.push(td[1]!);
      }
      if (cells.length < 2) continue;
      const valueHtml = cells.find((c) => /<img/i.test(c)) ?? cells[cells.length - 1]!;
      const label = cells
        .filter((c) => c !== valueHtml)
        .map(stripLabel)
        .filter(Boolean)
        .join(" ");

      if ((/енергиен клас|energy efficiency/.test(label)) && /охл|cooling/.test(label)) {
        cool = parseEnergyClassFromHtmlFragment(valueHtml) ?? cool;
      }
      if ((/енергиен клас|energy efficiency/.test(label)) && /отопл|heating/.test(label)) {
        heat = parseEnergyClassFromHtmlFragment(valueHtml) ?? heat;
      }
      if (label.includes("seer") && !label.includes("енергиен")) {
        cool = parseEnergyClassFromText(stripLabel(valueHtml)) ?? cool;
      }
      if (label.includes("scop") && !label.includes("енергиен")) {
        heat = parseEnergyClassFromText(stripLabel(valueHtml)) ?? heat;
      }
    }
  }
  return { cool, heat };
}

/** Текст + <img src> в клетка от таблица (не целия HTML документ). */
export function parseEnergyClassFromHtmlFragment(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const fromImg = parseEnergyClassFromImageUrl(m[1]);
    if (fromImg) return fromImg;
  }
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return parseEnergyClassFromText(text);
}
