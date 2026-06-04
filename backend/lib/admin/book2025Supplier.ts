/** Кратки имена от Book2025.xls → официални имена в контакти/филтри. */
const BOOK2025_SUPPLIER_CANONICAL: Record<string, string> = {
  БИТТЕЛ: "БИТТЕЛ ЕООД",
  КОНДЕКС: "КОНДЕКС ООД",
  ДИМЕЛИ: "ДИМЕЛИ ЕООД",
  БУЛКЛИМА: "БУЛКЛИМА ЕООД",
  БУЛКИМА: "БУЛКЛИМА ЕООД",
  КЛИМАКОМ: "КЛИМАКОМ",
  БИТТЕЛЕООД: "БИТТЕЛ ЕООД",
};

export function canonicalBook2025Supplier(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const key = trimmed.toLocaleUpperCase("bg-BG").replace(/\s+/g, "");
  return BOOK2025_SUPPLIER_CANONICAL[key] ?? trimmed;
}

export const BOOK2025_IMPORT_NOTE_PREFIX = "Импорт Book2025, ред ";

export function book2025ImportNote(sheetRow: number): string {
  return `${BOOK2025_IMPORT_NOTE_PREFIX}${sheetRow}`;
}
