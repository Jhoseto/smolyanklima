/** Разделя условия за монтаж: основен текст + последен ред (удебелен при показ). */
export function splitOfferTermsEmphasis(terms: string): { body: string; emphasis: string | null } {
  const lines = terms.replace(/\r\n/g, "\n").split("\n");
  let lastIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]?.trim()) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) return { body: terms.trim(), emphasis: null };

  const emphasis = lines[lastIdx]!.trim();
  const bodyLines = lines.slice(0, lastIdx);
  while (bodyLines.length > 0 && !bodyLines[bodyLines.length - 1]?.trim()) {
    bodyLines.pop();
  }
  return { body: bodyLines.join("\n"), emphasis };
}
