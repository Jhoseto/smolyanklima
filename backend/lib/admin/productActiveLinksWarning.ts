import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductActiveLink = {
  kind: "reservation" | "pending_sale";
  workItemId: string;
  customerName: string | null;
  dueDate: string | null;
};

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

/**
 * Проверява дали продукт има активна резервация или чакаща продажба (изчаква монтаж),
 * преди твърдо изтриване — за да предупредим админа какво точно ще се случи.
 */
export async function findProductActiveLinks(
  db: SupabaseClient,
  productId: string,
): Promise<ProductActiveLink[]> {
  const links: ProductActiveLink[] = [];

  const { data: reservation } = await db
    .from("work_items")
    .select("id,customer_name,due_date,status")
    .eq("product_id", productId)
    .eq("event_code", "reservation")
    .in("status", ["planned", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reservation) {
    const r = reservation as { id: string; customer_name?: string | null; due_date?: string | null };
    links.push({ kind: "reservation", workItemId: r.id, customerName: r.customer_name ?? null, dueDate: r.due_date ?? null });
  }

  const { data: sale } = await db
    .from("work_items")
    .select("id,customer_name,due_date,status,sale_install_state")
    .eq("product_id", productId)
    .eq("event_code", "sale")
    .eq("sale_install_state", "pending_mount")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sale) {
    const s = sale as { id: string; customer_name?: string | null; due_date?: string | null };
    links.push({ kind: "pending_sale", workItemId: s.id, customerName: s.customer_name ?? null, dueDate: s.due_date ?? null });
  }

  return links;
}

/** Ясно, конкретно съобщение на разбираем език за админа — какво точно ще се случи. */
export function productActiveLinkWarningMessage(links: ProductActiveLink[]): string {
  const sentences = links.map((l) => {
    const who = l.customerName?.trim() ? ` за клиент „${l.customerName.trim()}“` : "";
    const when = fmtDate(l.dueDate);
    const whenText = when ? ` (дата: ${when})` : "";
    if (l.kind === "reservation") {
      return (
        `Продуктът има АКТИВНА РЕЗЕРВАЦИЯ${who}${whenText}. ` +
        `Ако продължите, продуктът ще бъде изтрит завинаги, а резервацията ще остане в календара, ` +
        `но вече без връзка към климатик — няма да можете да я приключите или анулирате нормално.`
      );
    }
    return (
      `Продуктът има ЧАКАЩА ПРОДАЖБА (изчаква монтаж)${who}${whenText}. ` +
      `Ако продължите, продуктът ще бъде изтрит завинаги, а продажбата ще остане в историята на продажбите, ` +
      `но вече без връзка към климатик — монтажът и отказът на продажбата няма да работят нормално.`
    );
  });
  return sentences.join(" ");
}

/** Кратко резюме за bulk предупреждения — по едно изречение на артикул. */
export function productActiveLinkWarningLine(productName: string, links: ProductActiveLink[]): string {
  const kinds = links.map((l) => (l.kind === "reservation" ? "активна резервация" : "чакаща продажба (монтаж)"));
  return `„${productName}“ има ${kinds.join(" и ")}.`;
}
