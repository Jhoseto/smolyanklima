import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductMatchConfidence = "high" | "medium" | "low";

export interface ProductMatchSuggestion {
  product_id: string;
  label: string;
  confidence: ProductMatchConfidence;
  reason: string;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
}

export interface ProtocolMatchInput {
  ac_brand?: string | null;
  ac_model?: string | null;
  serial_number?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  product_id?: string | null;
}

function effectiveSerialForMatch(input: ProtocolMatchInput): string | null {
  const indoor = input.indoor_unit_serial?.trim();
  const outdoor = input.outdoor_unit_serial?.trim();
  if (indoor || outdoor) {
    if (indoor && outdoor) return `${indoor} / ${outdoor}`;
    return indoor ?? outdoor ?? null;
  }
  return input.serial_number?.trim() || null;
}

type ProductRow = {
  id: string;
  name: string;
  model_code?: string | null;
  model_number?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  brands?: { name?: string | null } | null;
};

const PRODUCT_SELECT =
  "id,name,model_code,model_number,indoor_unit_serial,outdoor_unit_serial,brands(name)";

function brandFromRow(p: ProductRow): string {
  return p.brands?.name?.trim() ?? "";
}

export function productCatalogLabelFromRow(p: ProductRow): string {
  const brand = brandFromRow(p);
  const model = (p.model_code || p.model_number || "").trim();
  if (brand && model) return `${brand} ${model}`;
  if (brand && p.name.toLowerCase().startsWith(brand.toLowerCase())) return p.name;
  if (brand) return `${brand} ${p.name}`.trim();
  return p.name;
}

/** Разделя legacy „Panasonic 563CEX2“ в ac_model, когато ac_brand е празен. */
export function normalizeProtocolBrandModel(
  acBrand: string | null | undefined,
  acModel: string | null | undefined,
): { brand: string; model: string; combined: string } {
  const brand = (acBrand ?? "").trim();
  const model = (acModel ?? "").trim();
  if (brand) {
    return { brand, model, combined: [brand, model].filter(Boolean).join(" ") };
  }
  if (!model) return { brand: "", model: "", combined: "" };
  const parts = model.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { brand: parts[0], model: parts.slice(1).join(" "), combined: model };
  }
  return { brand: "", model, combined: model };
}

/** Премахва „Вътр.:“ / „Външ.:“ префикси от legacy serial_number. */
function stripSerialLabelPrefix(value: string): string {
  return value
    .replace(/^(вътр\.?|vutr\.?|indoor)\s*:?\s*/i, "")
    .replace(/^(външ\.?|vunsh\.?|outdoor)\s*:?\s*/i, "")
    .trim();
}

/** Парсва „563CEX2 / 563CEX2“ или единичен сериен номер. */
export function parseProtocolSerialTokens(serial: string | null | undefined): string[] {
  const raw = (serial ?? "").trim();
  if (!raw) return [];
  const tokens = raw
    .split(/[/|,;]+/)
    .map((s) => stripSerialLabelPrefix(s.trim()))
    .filter(Boolean);
  return [...new Set(tokens.map((t) => t.toLowerCase()))];
}

/**
 * Legacy поле serial_number: първата част е вътрешно тяло, втората — външно.
 * При една част — не знаем кое е; при две еднакви (563CEX2 / 563CEX2) — и двете.
 */
export function parseProtocolSerialPair(serial: string | null | undefined): {
  tokens: string[];
  indoorHint: string | null;
  outdoorHint: string | null;
} {
  const raw = (serial ?? "").trim();
  if (!raw) return { tokens: [], indoorHint: null, outdoorHint: null };
  const parts = raw
    .split(/[/|,;]+/)
    .map((s) => stripSerialLabelPrefix(s.trim()))
    .filter(Boolean);
  const tokens = [...new Set(parts.map((t) => t.toLowerCase()))];
  if (parts.length >= 2) {
    return {
      tokens,
      indoorHint: parts[0] || null,
      outdoorHint: parts[1] || null,
    };
  }
  return {
    tokens,
    indoorHint: parts[0] ?? null,
    outdoorHint: null,
  };
}

function serialPairMatchesProduct(
  pair: ReturnType<typeof parseProtocolSerialPair>,
  row: ProductRow,
): { hit: boolean; confidence: ProductMatchConfidence; reason: string } {
  const indoor = normalizeToken(row.indoor_unit_serial ?? "");
  const outdoor = normalizeToken(row.outdoor_unit_serial ?? "");
  if (!indoor && !outdoor) {
    return { hit: false, confidence: "low", reason: "" };
  }

  const hintIn = pair.indoorHint ? normalizeToken(pair.indoorHint) : "";
  const hintOut = pair.outdoorHint ? normalizeToken(pair.outdoorHint) : "";

  const tokenInProduct = (t: string) => t === indoor || t === outdoor;

  if (hintIn && hintOut) {
    if (!tokenInProduct(hintIn) || !tokenInProduct(hintOut)) {
      return { hit: false, confidence: "low", reason: "" };
    }

    const ordered =
      (hintIn === indoor && hintOut === outdoor) ||
      (hintIn === outdoor && hintOut === indoor);
    const identicalHints = hintIn === hintOut;
    const productIdentical = indoor && outdoor && indoor === outdoor;

    if (ordered || (identicalHints && (productIdentical || hintIn === indoor || hintIn === outdoor))) {
      return {
        hit: true,
        confidence: "high",
        reason: "Съвпадение по двата серийни номера (вътрешно / външно)",
      };
    }

    return {
      hit: true,
      confidence: "medium",
      reason: "Частично съвпадение по сериен номер",
    };
  }

  if (hintIn && tokenInProduct(hintIn)) {
    return { hit: true, confidence: "high", reason: "Съвпадение по сериен номер" };
  }

  return { hit: false, confidence: "low", reason: "" };
}

function normalizeToken(s: string): string {
  return s.trim().toLowerCase();
}

function addSuggestion(
  map: Map<string, ProductMatchSuggestion>,
  row: ProductRow,
  confidence: ProductMatchConfidence,
  reason: string,
) {
  if (!row.id) return;
  const existing = map.get(row.id);
  const rank = { high: 3, medium: 2, low: 1 };
  if (existing && rank[existing.confidence] >= rank[confidence]) return;
  map.set(row.id, {
    product_id: row.id,
    label: productCatalogLabelFromRow(row),
    confidence,
    reason,
    indoor_unit_serial: row.indoor_unit_serial ?? null,
    outdoor_unit_serial: row.outdoor_unit_serial ?? null,
  });
}

export async function findProductMatchesForRepairProtocol(
  db: SupabaseClient,
  input: ProtocolMatchInput,
  options?: { limit?: number },
): Promise<ProductMatchSuggestion[]> {
  const limit = options?.limit ?? 8;
  const map = new Map<string, ProductMatchSuggestion>();

  if (input.product_id) {
    const { data } = await db
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", input.product_id)
      .maybeSingle();
    if (data) {
      addSuggestion(map, data as ProductRow, "high", "Вече свързан продукт");
      return [...map.values()];
    }
  }

  const serialPair = parseProtocolSerialPair(effectiveSerialForMatch(input));
  const serialTokens = serialPair.tokens.length > 0 ? serialPair.tokens : parseProtocolSerialTokens(input.serial_number);
  if (serialTokens.length > 0) {
    const orParts: string[] = [];
    for (const token of serialTokens) {
      const esc = token.replace(/[%_]/g, "");
      if (!esc) continue;
      orParts.push(`indoor_unit_serial.ilike.${esc}`);
      orParts.push(`outdoor_unit_serial.ilike.${esc}`);
    }
    if (orParts.length > 0) {
      const { data } = await db
        .from("products")
        .select(PRODUCT_SELECT)
        .or(orParts.join(","))
        .limit(limit);
      for (const row of (data ?? []) as ProductRow[]) {
        const match = serialPairMatchesProduct(serialPair, row);
        if (match.hit) {
          addSuggestion(map, row, match.confidence, match.reason);
        } else {
          const indoor = normalizeToken(row.indoor_unit_serial ?? "");
          const outdoor = normalizeToken(row.outdoor_unit_serial ?? "");
          const hitSerial = serialTokens.some((t) => t === indoor || t === outdoor);
          if (hitSerial) {
            addSuggestion(map, row, "medium", "Частично съвпадение по сериен номер");
          }
        }
      }
    }
  }

  const { brand, model, combined } = normalizeProtocolBrandModel(
    input.ac_brand,
    input.ac_model,
  );
  const searchTerms = [...new Set([combined, model, brand].map((s) => s.trim()).filter(Boolean))];

  for (const term of searchTerms) {
    const esc = term.replace(/[%_]/g, "");
    if (esc.length < 2) continue;
    const { data: byModel } = await db
      .from("products")
      .select(PRODUCT_SELECT)
      .or(`model_code.ilike.%${esc}%,model_number.ilike.%${esc}%,name.ilike.%${esc}%`)
      .limit(limit);
    for (const row of (byModel ?? []) as ProductRow[]) {
      const rowBrand = brandFromRow(row).toLowerCase();
      const rowModel = (row.model_code || row.model_number || row.name).toLowerCase();
      const brandOk = !brand || rowBrand.includes(brand.toLowerCase()) || brand.toLowerCase().includes(rowBrand);
      const modelOk = !model || rowModel.includes(model.toLowerCase()) || model.toLowerCase().includes(rowModel);
      const confidence: ProductMatchConfidence =
        brand && model && brandOk && modelOk ? "medium" : "low";
      addSuggestion(
        map,
        row,
        confidence,
        brand && model ? "Съвпадение по марка и модел" : "Съвпадение по текст в каталога",
      );
    }
  }

  const ranked = [...map.values()].sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1 };
    return rank[b.confidence] - rank[a.confidence];
  });
  return ranked.slice(0, limit);
}

/** Попълва формата от DB — разделя legacy combined полета. */
export function hydrateRepairProtocolClientFields(data: {
  ac_brand?: string | null;
  ac_model?: string | null;
  serial_number?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
}): {
  ac_brand: string;
  ac_model: string;
  indoor_unit_serial: string;
  outdoor_unit_serial: string;
} {
  const normalized = normalizeProtocolBrandModel(data.ac_brand, data.ac_model);

  let indoor = (data.indoor_unit_serial ?? "").trim();
  let outdoor = (data.outdoor_unit_serial ?? "").trim();
  if (!indoor && !outdoor && data.serial_number?.trim()) {
    const pair = parseProtocolSerialPair(data.serial_number);
    indoor = pair.indoorHint ?? "";
    outdoor = pair.outdoorHint ?? "";
  }

  return {
    ac_brand: normalized.brand,
    ac_model: normalized.model,
    indoor_unit_serial: indoor,
    outdoor_unit_serial: outdoor,
  };
}

/** Търси сервизен протокол за продажба — product_id, work_item или серийни/марка-модел. */
export async function findRepairProtocolForSale(
  db: SupabaseClient,
  opts: {
    saleProductId?: string | null;
    installWorkItemId?: string | null;
    product?: {
      indoor_unit_serial?: string | null;
      outdoor_unit_serial?: string | null;
      brand_name?: string | null;
      model_code?: string | null;
      name?: string | null;
    } | null;
  },
): Promise<Record<string, unknown> | null> {
  const serviceSelect =
    "id,protocol_number,status,date,service_kind,ac_brand,ac_model,serial_number,product_id,client_name";

  if (opts.saleProductId) {
    const { data: byProduct, error: byProductErr } = await db
      .from("service_repair_protocols")
      .select(serviceSelect)
      .eq("product_id", opts.saleProductId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byProductErr && byProduct) return byProduct as Record<string, unknown>;
    if (
      byProductErr &&
      !String(byProductErr.message ?? "").toLowerCase().includes("product_id")
    ) {
      throw byProductErr;
    }
  }

  if (opts.installWorkItemId) {
    const { data: byInstall } = await db
      .from("service_repair_protocols")
      .select(serviceSelect)
      .eq("work_item_id", opts.installWorkItemId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byInstall) return byInstall as Record<string, unknown>;
  }

  const p = opts.product;
  if (!p) return null;

  const serialTokens = [
    p.indoor_unit_serial,
    p.outdoor_unit_serial,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);

  if (serialTokens.length > 0) {
    let query = db
      .from("service_repair_protocols")
      .select(serviceSelect)
      .is("product_id", null)
      .order("date", { ascending: false })
      .limit(5);

    for (const token of serialTokens) {
      const esc = token.replace(/[%_]/g, "");
      if (esc) query = query.ilike("serial_number", `%${esc}%`);
    }

    const { data: candidates } = await query;
    const best = (candidates ?? []).find((row) => {
      const parsed = parseProtocolSerialPair((row as { serial_number?: string }).serial_number);
      const productIndoor = normalizeToken(p.indoor_unit_serial ?? "");
      const productOutdoor = normalizeToken(p.outdoor_unit_serial ?? "");
      if (productIndoor && productOutdoor) {
        return parsed.tokens.includes(productIndoor) && parsed.tokens.includes(productOutdoor);
      }
      return parsed.tokens.some(
        (t) => t === productIndoor || t === productOutdoor,
      );
    });
    if (best) return best as Record<string, unknown>;
  }

  const brand = (p.brand_name ?? "").trim();
  const model = (p.model_code ?? p.name ?? "").trim();
  if (brand || model) {
    const filters: string[] = [];
    if (brand) filters.push(`ac_brand.ilike.%${brand.replace(/[%_]/g, "")}%`);
    if (model) filters.push(`ac_model.ilike.%${model.replace(/[%_]/g, "")}%`);
    const { data: byBrandModel } = await db
      .from("service_repair_protocols")
      .select(serviceSelect)
      .or(filters.join(","))
      .is("product_id", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byBrandModel) return byBrandModel as Record<string, unknown>;
  }

  return null;
}

const REPAIR_PROTOCOL_LIST_SELECT =
  "id,protocol_number,status,date,service_kind,ac_brand,ac_model,serial_number,product_id,client_name";

/**
 * Batch lookup на сервизни протоколи за списък продукти.
 * 1) Една заявка по product_id (бърз път)
 * 2) Само за липсващи — legacy match по серийни/марка (ограничен паралелизъм)
 */
export async function findRepairProtocolsForProductIds(
  db: SupabaseClient,
  productIds: string[],
): Promise<Record<string, Record<string, unknown>>> {
  const map: Record<string, Record<string, unknown>> = {};
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data: linkedRows, error: linkErr } = await db
    .from("service_repair_protocols")
    .select(REPAIR_PROTOCOL_LIST_SELECT)
    .in("product_id", ids)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (linkErr) {
    const missingCol = /product_id|42703|does not exist|undefined_column/i.test(linkErr.message ?? "");
    if (!missingCol) throw linkErr;
  } else {
    for (const row of linkedRows ?? []) {
      const pid = String((row as { product_id?: string }).product_id ?? "");
      if (pid && !map[pid]) map[pid] = row as Record<string, unknown>;
    }
  }

  const missingIds = ids.filter((id) => !map[id]);
  if (missingIds.length === 0) return map;

  const { data: products, error: prodErr } = await db
    .from("products")
    .select("id, name, model_code, indoor_unit_serial, outdoor_unit_serial, brands:brand_id(name)")
    .in("id", missingIds);

  if (prodErr) throw prodErr;

  const CHUNK = 8;
  const list = products ?? [];
  for (let i = 0; i < list.length; i += CHUNK) {
    await Promise.all(
      list.slice(i, i + CHUNK).map(async (product) => {
        const pid = String((product as { id: string }).id);
        const brandsEmbed = (product as { brands?: { name?: string | null } | null }).brands;
        try {
          const protocol = await findRepairProtocolForSale(db, {
            product: {
              indoor_unit_serial: (product.indoor_unit_serial as string | null) ?? null,
              outdoor_unit_serial: (product.outdoor_unit_serial as string | null) ?? null,
              brand_name: brandsEmbed?.name ?? null,
              model_code: (product.model_code as string | null) ?? null,
              name: (product.name as string | null) ?? null,
            },
          });
          if (protocol) map[pid] = protocol;
        } catch {
          /* пропускаме единични грешки */
        }
      }),
    );
  }

  return map;
}
