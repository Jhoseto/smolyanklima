/** Коригира остарели формулировки в запазените условия за монтаж. */

const TERMS_CLOSING_REPLACEMENTS: ReadonlyArray<readonly [from: string, to: string]> = [
  [
    "• Всички услуги и материали по точка 2 се заплащат допълнително от клиента по ценоразпис на сервиза.",
    "• Всички услуги и материали извън стандартния монтаж се заплащат допълнително от клиента по ценоразпис на сервиза.",
  ],
  [
    "Всички услуги и материали по точка 2 се заплащат допълнително от клиента по ценоразпис на сервиза.",
    "Всички услуги и материали извън стандартния монтаж се заплащат допълнително от клиента по ценоразпис на сервиза.",
  ],
];

export function normalizeOfferTermsNote(text: string | null | undefined): string | null {
  if (text == null) return null;
  let out = text;
  for (const [from, to] of TERMS_CLOSING_REPLACEMENTS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}
