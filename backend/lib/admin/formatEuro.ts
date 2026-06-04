/**
 * Детерминистично форматиране на EUR — без toLocaleString (различно на Node vs браузър → hydration #418).
 */
export function formatAdminPriceEuro(n: number, opts?: { decimals?: boolean }): string {
  if (!Number.isFinite(n)) return "0";
  if (opts?.decimals) {
    const fixed = (Math.round(n * 100) / 100).toFixed(2);
    const [intPart, frac] = fixed.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${grouped},${frac}`;
  }
  const rounded = Math.round(n);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Дата YYYY-MM-DD → ДД.ММ.ГГГГ без timezone shift. */
export function formatAdminDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
