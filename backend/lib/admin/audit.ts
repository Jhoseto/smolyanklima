import { adminDb } from "@/lib/admin/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditInput = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  return UUID_RE.test(v) ? v : null;
}

export async function logAdminActivity(input: AuditInput) {
  try {
    const supabase = await adminDb();
    const anon = await createSupabaseServerClient();
    const {
      data: { user },
    } = await anon.auth.getUser();

    const details: Record<string, unknown> = { ...(input.details ?? {}) };
    if (input.entityId && !asUuidOrNull(input.entityId)) {
      details.rawEntityId = input.entityId;
    }

    await supabase.from("activity_logs").insert({
      user_id: user?.id ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: asUuidOrNull(input.entityId),
      details: Object.keys(details).length > 0 ? details : null,
    });
  } catch (error) {
    console.error("[audit] failed to write activity log", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
}
