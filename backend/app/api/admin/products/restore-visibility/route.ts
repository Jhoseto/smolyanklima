import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { logAdminActivity } from "@/lib/admin/audit";
import { authErrorResponse, requireOfficeStaffSession } from "@/lib/admin/authGuard";

// Утилитарен административен endpoint: маркира ВСИЧКИ продукти в БД като
// видими публично (`is_active = true`, `stock_status = 'in_stock'`).
//
// Това НЕ е масово действие в смисъл на bulk actions върху избрани редове —
// преднамерено е отделено, за да остане „Изтрий“ единственото селективно
// масово действие. Тук говорим за глобална нормализация (полезна след
// импорт, след масови продажби, или когато искаме да върнем всички
// продукти обратно на витрината).

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireOfficeStaffSession();
  } catch (e) {
    const err = authErrorResponse(e);
    return withCors(req, NextResponse.json({ error: err.message }, { status: err.status }));
  }
  const supabase = session.db;

  // Update само на тези редове, които реално се нуждаят от промяна, за да
  // избегнем ненужни write-ове и трикгер на updated_at.
  const { data, error } = await supabase
    .from("products")
    .update({ stock_status: "in_stock", is_active: true })
    .or("stock_status.neq.in_stock,is_active.eq.false")
    .select("id");

  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const affected = data?.length ?? 0;
  await logAdminActivity({
    action: "product.restore_visibility_all",
    entityType: "product",
    details: { affected },
  });

  return withCors(req, NextResponse.json({ ok: true, affected }));
}
