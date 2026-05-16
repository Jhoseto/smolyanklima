import type { SupabaseClient } from "@supabase/supabase-js";
import { appendProductToInquiry, findActiveInquiryForPhone } from "./inquiryProducts";
import {
  applyMountPreferenceToMessage,
  buildProductInquiryMessage,
  mergeInquiryMessage,
} from "./inquiryMessage";
import {
  fetchInquiryMetaForMerge,
  insertInquiryRow,
  updateInquiryRow,
} from "./inquiryWrite";

export type SubmitInquiryInput = {
  source: "contact" | "product" | "wizard" | "quick_view" | "ai";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  message?: string;
  productSlug?: string;
  productName?: string;
  serviceType?: "sale" | "installation" | "maintenance" | "repair";
  /** true = с монтаж, false = само уред */
  includeInstallation?: boolean;
};

async function linkProductToInquiry(
  supabase: SupabaseClient,
  inquiryId: string,
  opts: {
    productId: string | null;
    productSlug?: string | null;
    productName: string;
  },
): Promise<void> {
  if (!opts.productId && !opts.productName) return;
  try {
    await appendProductToInquiry(supabase, inquiryId, {
      productId: opts.productId,
      productSlug: opts.productSlug ?? null,
      productName: opts.productName,
    });
  } catch {
    /* inquiry_products може да липсва преди миграция 0053 */
  }
}

export async function submitPublicInquiry(
  supabase: SupabaseClient,
  input: SubmitInquiryInput,
): Promise<{ id: string; created_at: string; status: string; merged: boolean }> {
  let productId: string | null = null;
  let productName = input.productName?.trim() || null;

  if (input.productSlug) {
    const { data: p } = await supabase
      .from("products")
      .select("id,name")
      .eq("slug", input.productSlug)
      .maybeSingle();
    productId = (p as { id?: string } | null)?.id ?? null;
    if (!productName) productName = (p as { name?: string } | null)?.name ?? null;
  }

  const productLine = productName != null ? `Запитване за: ${productName}` : null;

  const existing = await findActiveInquiryForPhone(supabase, input.customerPhone);

  if (existing) {
    const existingRow = await fetchInquiryMetaForMerge(supabase, existing.id);

    let mergedMessage = mergeInquiryMessage(existing.message, productLine);
    if (input.includeInstallation !== undefined) {
      mergedMessage = applyMountPreferenceToMessage(mergedMessage, input.includeInstallation);
    }

    const patch: Record<string, unknown> = {
      message: mergedMessage,
      updated_at: new Date().toISOString(),
    };
    if (input.customerName.trim().length > existing.customer_name.trim().length) {
      patch.customer_name = input.customerName.trim();
    }
    if (input.includeInstallation !== undefined) {
      patch.include_installation = input.includeInstallation;
    }

    await updateInquiryRow(supabase, existing.id, patch);

    await linkProductToInquiry(supabase, existing.id, {
      productId,
      productSlug: input.productSlug ?? null,
      productName: productName ?? input.productSlug ?? "Климатик",
    });

    return {
      id: existing.id,
      created_at: existingRow?.created_at ?? new Date().toISOString(),
      status: existingRow?.status ?? "new",
      merged: true,
    };
  }

  const message =
    productName != null || input.includeInstallation !== undefined
      ? buildProductInquiryMessage({
          productName,
          includeInstallation: input.includeInstallation,
          extraMessage: input.message,
        })
      : input.message?.trim() || null;

  const insertRow: Record<string, unknown> = {
    source: input.source,
    customer_name: input.customerName.trim(),
    customer_phone: input.customerPhone.trim(),
    customer_email: input.customerEmail,
    message,
    product_id: productId,
    service_type: input.serviceType,
  };
  if (input.includeInstallation !== undefined) {
    insertRow.include_installation = input.includeInstallation;
  }

  const inserted = await insertInquiryRow(supabase, insertRow);

  await linkProductToInquiry(supabase, inserted.id, {
    productId,
    productSlug: input.productSlug ?? null,
    productName: productName ?? input.productSlug ?? "Климатик",
  });

  return {
    id: inserted.id,
    created_at: inserted.created_at,
    status: inserted.status,
    merged: false,
  };
}
