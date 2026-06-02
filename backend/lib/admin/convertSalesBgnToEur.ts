import type { SupabaseClient } from "@supabase/supabase-js";
import { BGN_PER_EUR, SALES_BGN_SALE_DATE_CUTOFF } from "@/lib/admin/currency";

export type ConvertSalesBgnPreview = {
  cutoffDate: string;
  rate: number;
  workItems: {
    count: number;
    sample: Array<{
      id: string;
      due_date: string | null;
      total_amount: number | null;
      total_amount_eur: number | null;
      purchase_price: number | null;
      purchase_price_eur: number | null;
    }>;
  };
  products: { count: number };
};

type SaleRow = {
  id: string;
  product_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  unit_price: number | null;
  total_amount: number | null;
  purchase_price: number | null;
  notes: string | null;
  amounts_converted_from_bgn_at: string | null;
};

function saleDateOf(row: SaleRow): string {
  if (row.due_date) return String(row.due_date).slice(0, 10);
  if (row.completed_at) return String(row.completed_at).slice(0, 10);
  return String(row.created_at).slice(0, 10);
}

function isTargetSale(row: SaleRow): boolean {
  if (row.amounts_converted_from_bgn_at) return false;
  return saleDateOf(row) < SALES_BGN_SALE_DATE_CUTOFF;
}

function roundEur(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function previewSalesBgnToEur(supabase: SupabaseClient): Promise<ConvertSalesBgnPreview> {
  const { data, error } = await supabase
    .from("work_items")
    .select(
      "id, product_id, due_date, completed_at, created_at, unit_price, total_amount, purchase_price, notes, amounts_converted_from_bgn_at",
    )
    .eq("event_code", "sale");

  if (error) throw error;

  const rows = (data ?? []) as SaleRow[];
  const targets = rows.filter(isTargetSale);
  const productIds = new Set(
    targets.map((r) => r.product_id).filter((id): id is string => Boolean(id)),
  );

  return {
    cutoffDate: SALES_BGN_SALE_DATE_CUTOFF,
    rate: BGN_PER_EUR,
    workItems: {
      count: targets.length,
      sample: targets.slice(0, 8).map((r) => ({
        id: r.id,
        due_date: r.due_date,
        total_amount: r.total_amount,
        total_amount_eur:
          r.total_amount != null ? roundEur(Number(r.total_amount) / BGN_PER_EUR) : null,
        purchase_price: r.purchase_price,
        purchase_price_eur:
          r.purchase_price != null ? roundEur(Number(r.purchase_price) / BGN_PER_EUR) : null,
      })),
    },
    products: { count: productIds.size },
  };
}

export async function applySalesBgnToEur(
  supabase: SupabaseClient,
): Promise<{ workItemsUpdated: number; productsUpdated: number }> {
  const { data, error } = await supabase
    .from("work_items")
    .select(
      "id, product_id, due_date, completed_at, created_at, unit_price, total_amount, purchase_price, amounts_converted_from_bgn_at",
    )
    .eq("event_code", "sale");

  if (error) throw error;

  const targets = ((data ?? []) as SaleRow[]).filter(isTargetSale);
  let workItemsUpdated = 0;
  const productIds = new Set<string>();

  for (const row of targets) {
    const patch: Record<string, number | string | null> = {
      amounts_converted_from_bgn_at: new Date().toISOString(),
    };
    if (row.unit_price != null) patch.unit_price = roundEur(Number(row.unit_price) / BGN_PER_EUR);
    if (row.total_amount != null) patch.total_amount = roundEur(Number(row.total_amount) / BGN_PER_EUR);
    if (row.purchase_price != null) patch.purchase_price = roundEur(Number(row.purchase_price) / BGN_PER_EUR);

    const { data: updated, error: upErr } = await supabase
      .from("work_items")
      .update(patch)
      .eq("id", row.id)
      .is("amounts_converted_from_bgn_at", null)
      .select("id")
      .maybeSingle();
    if (upErr) throw upErr;
    if (!updated) continue;
    workItemsUpdated += 1;
    if (row.product_id) productIds.add(row.product_id);
  }

  let productsUpdated = 0;
  for (const productId of productIds) {
    const { data: prod, error: pErr } = await supabase
      .from("products")
      .select("id, price, purchase_price, amounts_converted_from_bgn_at, is_active, show_in_public_catalog")
      .eq("id", productId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prod || prod.amounts_converted_from_bgn_at) continue;
    if (prod.is_active === true && prod.show_in_public_catalog === true) continue;

    const pPatch: Record<string, number | string | null> = {
      amounts_converted_from_bgn_at: new Date().toISOString(),
    };
    if (prod.price != null && Number(prod.price) > 0) {
      pPatch.price = roundEur(Number(prod.price) / BGN_PER_EUR);
    }
    if (prod.purchase_price != null && Number(prod.purchase_price) > 0) {
      pPatch.purchase_price = roundEur(Number(prod.purchase_price) / BGN_PER_EUR);
    }

    const { data: updatedProduct, error: puErr } = await supabase
      .from("products")
      .update(pPatch)
      .eq("id", productId)
      .is("amounts_converted_from_bgn_at", null)
      .select("id")
      .maybeSingle();
    if (puErr) throw puErr;
    if (!updatedProduct) continue;
    productsUpdated += 1;
  }

  return { workItemsUpdated, productsUpdated };
}
