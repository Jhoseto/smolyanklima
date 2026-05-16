export function mountPreferenceLine(includeInstallation: boolean | null | undefined): string | null {
  if (includeInstallation === true) return "Монтаж: с монтаж";
  if (includeInstallation === false) return "Монтаж: само уред";
  return null;
}

export function buildProductInquiryMessage(opts: {
  productName?: string | null;
  includeInstallation?: boolean | null;
  extraMessage?: string | null;
}): string | null {
  const parts: string[] = [];
  if (opts.productName?.trim()) parts.push(`Запитване за: ${opts.productName.trim()}`);
  const mount = mountPreferenceLine(opts.includeInstallation);
  if (mount) parts.push(mount);
  if (opts.extraMessage?.trim()) parts.push(opts.extraMessage.trim());
  return parts.length ? parts.join("\n") : null;
}

export function stripMountLines(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  const cleaned = message
    .replace(/\n?Монтаж: (с монтаж|само уред)/gi, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return cleaned || null;
}

export function applyMountPreferenceToMessage(
  message: string | null | undefined,
  includeInstallation: boolean | null | undefined,
): string | null {
  const base = stripMountLines(message);
  const mount = mountPreferenceLine(includeInstallation);
  if (!mount) return base;
  if (!base) return mount;
  return `${base}\n${mount}`;
}

export function mergeInquiryMessage(existing: string | null, line: string | null): string | null {
  if (!line) return existing;
  if (!existing?.trim()) return line;
  if (existing.includes(line)) return existing;
  return `${existing.trim()}\n${line}`;
}

/** Имена на продукти от редове „Запитване за: …“ (legacy inquiries без inquiry_products). */
export function parseProductNamesFromMessage(message?: string | null): string[] {
  if (!message?.trim()) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of message.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(/^запитване\s*за\s*:\s*(.+)$/iu);
    if (!match) continue;
    const name = match[1].trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}
