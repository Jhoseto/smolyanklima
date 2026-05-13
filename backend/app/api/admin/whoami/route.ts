import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/whoami
 *
 * Връща текущия логнат потребител + неговия admin профил (ако има).
 *
 * ВАЖНО: Този endpoint НЕ изисква admin роля — той е „discovery“ за UI-а
 * (страницата иска да знае дали user е master_admin, office_staff, etc.,
 * за да реши какви бутони да рендерира). Затова ползваме anon server клиент
 * с cookies — НЕ adminDb(), защото service-role клиент няма user session
 * и не може да върне реалния user.
 */

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) return withCors(req, NextResponse.json({ error: userErr.message }, { status: 500 }));
  if (!user) return withCors(req, NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 }));

  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("id,is_active,role,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (adminErr) return withCors(req, NextResponse.json({ error: adminErr.message }, { status: 500 }));

  return withCors(
    req,
    NextResponse.json({
      data: {
        user: { id: user.id, email: user.email },
        admin: adminRow ?? null,
        isActiveAdmin: Boolean(adminRow?.is_active),
      },
    }),
  );
}

