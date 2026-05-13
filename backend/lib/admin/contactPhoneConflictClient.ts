/**
 * Префлайт към GET /api/admin/contacts/phone-conflict — извиквайте преди POST/PUT
 * на контакт с нов основен телефон, за да се избегне raw DB грешка и да се
 * покаже ясно съобщение.
 */
export async function assertNoContactPrimaryPhoneDuplicate(
  phone: string,
  excludeContactId?: string | null,
): Promise<void> {
  const p = phone.trim();
  if (p.length < 3) return;
  const sp = new URLSearchParams({ phone: p });
  if (excludeContactId?.trim()) sp.set("excludeContactId", excludeContactId.trim());
  const res = await fetch(`/api/admin/contacts/phone-conflict?${sp.toString()}`, { credentials: "include" });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { conflict?: boolean; contact?: { fullName: string; phone: string } };
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || "Грешка при проверка на телефона");
  if (json.data?.conflict && json.data.contact) {
    const c = json.data.contact;
    throw new Error(
      `Този телефон (${c.phone}) вече е записан за контакт „${c.fullName}“. Отворете съществуващия контакт или сменете номера.`,
    );
  }
}
