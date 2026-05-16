import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

function stripInstallColumn(patch: Record<string, unknown>): Record<string, unknown> {
  const { include_installation: _omit, ...rest } = patch;
  return rest;
}

export async function updateInquiryRow(
  supabase: SupabaseClient,
  inquiryId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("inquiries").update(patch).eq("id", inquiryId);
  if (!error) return;
  if (
    "include_installation" in patch &&
    isPostgrestMissingColumn(error, "include_installation")
  ) {
    const { error: retryErr } = await supabase
      .from("inquiries")
      .update(stripInstallColumn(patch))
      .eq("id", inquiryId);
    if (retryErr) throw new Error(retryErr.message);
    return;
  }
  throw new Error(error.message);
}

export async function insertInquiryRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ id: string; created_at: string; status: string }> {
  let { data, error } = await supabase
    .from("inquiries")
    .insert(row)
    .select("id,created_at,status")
    .single();

  if (error && "include_installation" in row && isPostgrestMissingColumn(error, "include_installation")) {
    ({ data, error } = await supabase
      .from("inquiries")
      .insert(stripInstallColumn(row))
      .select("id,created_at,status")
      .single());
  }

  if (error || !data?.id) throw new Error(error?.message ?? "Insert failed");
  return {
    id: data.id as string,
    created_at: String(data.created_at),
    status: String(data.status),
  };
}

export async function fetchInquiryMetaForMerge(
  supabase: SupabaseClient,
  inquiryId: string,
): Promise<{ created_at: string; status: string; message: string | null } | null> {
  let { data, error } = await supabase
    .from("inquiries")
    .select("created_at,status,message,include_installation")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error && isPostgrestMissingColumn(error, "include_installation")) {
    ({ data, error } = await supabase
      .from("inquiries")
      .select("created_at,status,message")
      .eq("id", inquiryId)
      .maybeSingle());
  }

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    created_at: String(data.created_at),
    status: String(data.status),
    message: (data.message as string | null) ?? null,
  };
}
