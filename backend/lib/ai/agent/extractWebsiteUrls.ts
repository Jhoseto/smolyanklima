const URL_IN_TEXT =
  /https?:\/\/[^\s<>"')\]]+/gi;
const BARE_DOMAIN =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:bg|com|net|org|eu)\b/gi;

/** Извлича URL-и от бележки/адрес на доставчик. */
export function extractWebsiteUrls(...parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    const text = (part ?? "").trim();
    if (!text) continue;

    for (const m of text.matchAll(URL_IN_TEXT)) {
      const raw = m[0].replace(/[.,;]+$/, "");
      try {
        const u = new URL(raw);
        if (u.protocol === "http:" || u.protocol === "https:") {
          const norm = u.origin;
          if (!seen.has(norm)) {
            seen.add(norm);
            out.push(norm);
          }
        }
      } catch {
        /* skip */
      }
    }

    for (const m of text.matchAll(BARE_DOMAIN)) {
      const host = m[0].toLowerCase();
      if (host.includes("@")) continue;
      const norm = `https://${host}`;
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push(norm);
      }
    }
  }

  return out;
}

export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function hostnamesMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/^www\./, "");
  const nb = b.toLowerCase().replace(/^www\./, "");
  return na === nb || na.endsWith(`.${nb}`) || nb.endsWith(`.${na}`);
}
