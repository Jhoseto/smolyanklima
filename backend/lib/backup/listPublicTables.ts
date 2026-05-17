import type { SupabaseClient } from "@supabase/supabase-js";

/** Познати public таблици (ако RPC `admin_export_list_public_tables` липсва). */
export const KNOWN_PUBLIC_TABLES = [
  "accessories",
  "accessory_images",
  "activity_logs",
  "admin_users",
  "admin_web_push_subscriptions",
  "articles",
  "brands",
  "categories",
  "category_types",
  "chat_canned_responses",
  "contact_phones",
  "contacts",
  "email_outbox",
  "features",
  "inquiries",
  "inquiry_products",
  "live_chat_messages",
  "live_chats",
  "newsletter_subscribers",
  "product_catalog_settings",
  "product_features",
  "product_images",
  "product_ratings",
  "product_specs",
  "product_types",
  "products",
  "service_protocols",
  "service_repair_protocols",
  "settings",
  "work_items",
] as const;

function isMissingBackupRpc(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  if (msg.includes("admin_export_list_public_tables")) return true;
  if (msg.includes("could not find the function")) return true;
  if (error.code === "PGRST202") return true;
  return false;
}

/** Списък public таблици за пълен JSON backup. */
export async function listPublicTablesForBackup(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.rpc("admin_export_list_public_tables");
  if (!error) {
    return ((data ?? []) as Array<{ table_name?: string }>)
      .map((r) => r.table_name)
      .filter((n): n is string => Boolean(n))
      .sort();
  }
  if (!isMissingBackupRpc(error)) {
    throw new Error(error.message);
  }
  return [...KNOWN_PUBLIC_TABLES];
}
