import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп до одит лога." }, { status: 403 }));
  }

  const supabase = session.db;

  const [{ data: users, error: usersErr }, { data: entities, error: entitiesErr }] = await Promise.all([
    supabase.from("admin_users").select("id,name,email").eq("is_active", true).order("name", { ascending: true }),
    supabase
      .from("activity_logs")
      .select("entity_type")
      .not("entity_type", "is", null)
      .order("entity_type", { ascending: true })
      .limit(500),
  ]);

  if (usersErr) return withCors(req, NextResponse.json({ error: usersErr.message }, { status: 500 }));
  if (entitiesErr) return withCors(req, NextResponse.json({ error: entitiesErr.message }, { status: 500 }));

  const entityTypes = Array.from(new Set((entities ?? []).map((x) => x.entity_type).filter(Boolean)));
  return withCors(req, NextResponse.json({ data: { users: users ?? [], entityTypes } }));
}
