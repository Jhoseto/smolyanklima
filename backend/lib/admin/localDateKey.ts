/** Календарна дата YYYY-MM-DD в часовата зона на офиса (по подразбиране София). */
export function adminLocalDateKey(date = new Date(), timeZone = "Europe/Sofia"): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}
