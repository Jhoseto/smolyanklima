/** Премахва „Източник: https://…“ от импортирани описания (не се показва публично/в админ). */
export function stripImportSourceFromDescription(
  description: string | null | undefined,
): string | null {
  if (!description?.trim()) return null;
  const cut = description.search(/\n\nИзточник:\s*https?:\/\//i);
  if (cut >= 0) {
    const trimmed = description.slice(0, cut).trim();
    return trimmed || null;
  }
  if (/^Източник:\s*https?:\/\//i.test(description.trim())) return null;
  return description.trim();
}
