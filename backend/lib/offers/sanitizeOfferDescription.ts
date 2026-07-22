/** Премахва импортния appendix „Технически данни (Condex/Bulclima/…)" от описание в оферта. */
const SUPPLIER_SPECS_APPENDIX_RE =
  /\n\n---\nТехнически данни \([^)]+\):[\s\S]*$/u;

const SUPPLIER_SPECS_APPENDIX_ALT_RE =
  /\n\nТехнически данни \([^)]+\):[\s\S]*$/u;

export function sanitizeOfferDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  let text = description.trim();
  text = text.replace(SUPPLIER_SPECS_APPENDIX_RE, "").trim();
  text = text.replace(SUPPLIER_SPECS_APPENDIX_ALT_RE, "").trim();
  return text || null;
}
