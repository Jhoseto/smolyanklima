const LEGAL_SUFFIX_RE = /\s+(ЕООД|EOOD|ООД|OOD|ЕТ|EAD|АД|AD)\.?$/iu;

/** Известни различни изписвания → единен ключ. */
const SUPPLIER_KEY_ALIASES: Record<string, string> = {
  БУЛКЛИМА: "БУЛКИМА",
};

const CORPORATE_TAIL_RE =
  /\s+(ИНЖЕНЕРИНГ|INZHENERING|ТРЕЙД|TRADE|ГРУП|GROUP|БЪЛГАРИЯ|BULGARIA)\.?\s*$/iu;

/** Ключ за групиране: без правна форма/описател, без интервали и тирета, главни букви. */
export function normalizeSupplierKey(name: string): string {
  let s = name.trim();
  s = s.replace(LEGAL_SUFFIX_RE, "");
  s = s.replace(CORPORATE_TAIL_RE, "");
  s = s.replace(/[-_/]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const compact = s.toLocaleUpperCase("bg-BG").replace(/\s/g, "");
  return SUPPLIER_KEY_ALIASES[compact] ?? compact;
}

function hasLegalSuffix(name: string): boolean {
  return LEGAL_SUFFIX_RE.test(name.trim());
}

/** Кратко име за показване — предпочита вариант без ЕООД/ООД. */
export function pickSupplierDisplayLabel(rawNames: string[]): string {
  const trimmed = rawNames.map((n) => n.trim()).filter(Boolean);
  if (!trimmed.length) return "";
  const withoutSuffix = trimmed.filter((n) => !hasLegalSuffix(n));
  const pool = withoutSuffix.length ? withoutSuffix : trimmed;
  return [...pool].sort((a, b) => a.length - b.length || a.localeCompare(b, "bg"))[0];
}

export type GroupedSupplier = {
  key: string;
  label: string;
  variants: string[];
};

export function groupSupplierNames(rawNames: Iterable<string>): GroupedSupplier[] {
  const groups = new Map<string, Set<string>>();
  for (const raw of rawNames) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeSupplierKey(name);
    if (!key) continue;
    let set = groups.get(key);
    if (!set) {
      set = new Set();
      groups.set(key, set);
    }
    set.add(name);
  }

  const merged = new Map<string, GroupedSupplier>();
  for (const [key, variantsSet] of groups) {
    const variants = [...variantsSet];
    const label = pickSupplierDisplayLabel(variants);
    const labelKey = label.toLocaleUpperCase("bg-BG");
    const existing = merged.get(labelKey);
    if (!existing) {
      merged.set(labelKey, { key, label, variants });
      continue;
    }
    const allVariants = [...new Set([...existing.variants, ...variants])];
    merged.set(labelKey, {
      key: existing.key,
      label: pickSupplierDisplayLabel(allVariants),
      variants: allVariants,
    });
  }

  return [...merged.values()].sort((a, b) => a.label.localeCompare(b.label, "bg"));
}

export function mergeSupplierGroups(...lists: GroupedSupplier[][]): GroupedSupplier[] {
  const names: string[] = [];
  for (const list of lists) {
    for (const g of list) {
      for (const v of g.variants) {
        const t = v.trim();
        if (t) names.push(t);
      }
    }
  }
  return groupSupplierNames(names);
}

export function supplierNameMatchesKey(supplierName: string, key: string): boolean {
  return normalizeSupplierKey(supplierName) === normalizeSupplierKey(key);
}

/** PostgREST `.or()` — намира всички варианти на името. */
export function supplierFilterOrClause(key: string, variants?: string[]): string {
  const patterns = new Set<string>();
  const seeds = variants?.length ? variants : [key];
  for (const raw of seeds) {
    const v = raw.trim();
    if (!v) continue;
    patterns.add(v);
    patterns.add(`${v}%`);
  }
  const compact = normalizeSupplierKey(key);
  if (compact) {
    patterns.add(`${compact}%`);
    patterns.add(compact);
    const hyphenated = compact.replace(/(\D)(\d)/, "$1-$2").replace(/(\d)(\D)/, "$1-$2");
    if (hyphenated !== compact) patterns.add(`${hyphenated}%`);
  }
  return [...patterns].map((p) => `supplier_name.ilike.${p}`).join(",");
}
