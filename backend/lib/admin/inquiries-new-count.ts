import type { adminDb } from "@/lib/admin/db";

/** Брой запитвания със статус `new` — лека заявка за навигационен badge. */
export async function fetchNewInquiriesCount(
  supabase: Awaited<ReturnType<typeof adminDb>>,
): Promise<number> {
  const { count, error } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error) throw error;
  return count ?? 0;
}
