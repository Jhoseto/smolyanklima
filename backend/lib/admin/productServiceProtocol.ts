/** Само налични климатици (не аксесоари) могат да отварят сервизен протокол. */
export function canProductServiceProtocol(p: {
  catalog_item?: "product" | "accessory";
  stock_status: string;
}): boolean {
  if (p.catalog_item === "accessory") return false;
  return p.stock_status === "in_stock";
}

export type ServiceProtocolButtonState = "none" | "draft" | "signed";

export function serviceProtocolButtonState(
  protocol: LinkedRepairProtocolSummary | null | undefined,
): ServiceProtocolButtonState {
  if (!protocol) return "none";
  return protocol.status === "signed" ? "signed" : "draft";
}

export function serviceProtocolButtonTitle(
  p: { catalog_item?: "product" | "accessory"; stock_status: string },
  protocol: LinkedRepairProtocolSummary | null | undefined,
): string {
  if (!canProductServiceProtocol(p)) {
    return "Само за налични климатици";
  }
  const state = serviceProtocolButtonState(protocol);
  if (state === "signed") {
    return "Сервизен протокол — завършен. Отвори за преглед";
  }
  if (state === "draft") {
    return "Сервизен протокол — започнат, не е финализиран. Продължи попълването";
  }
  return "Създай сервизен протокол с попълнени марка, модел и серийни №";
}

export function serviceProtocolButtonClass(
  p: { catalog_item?: "product" | "accessory"; stock_status: string },
  protocol: LinkedRepairProtocolSummary | null | undefined,
  variant: "icon" | "mobile" = "icon",
): string {
  const base =
    variant === "mobile"
      ? "flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[44px] text-[10px] font-bold leading-tight min-w-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border"
      : "inline-flex items-center justify-center w-[34px] h-[34px] rounded-xl border shrink-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed";

  if (!canProductServiceProtocol(p)) {
    return `${base} ${variant === "mobile" ? "text-slate-400" : "bg-white text-slate-400 border-slate-300"}`;
  }

  const state = serviceProtocolButtonState(protocol);
  if (state === "signed") {
    return `${base} ${
      variant === "mobile"
        ? "text-white bg-emerald-600 border-emerald-700 shadow-sm hover:bg-emerald-700 active:bg-emerald-800"
        : "bg-emerald-600 text-white border-emerald-700 shadow-sm hover:bg-emerald-700 active:bg-emerald-800 focus:ring-emerald-300"
    }`;
  }
  if (state === "draft") {
    return `${base} ${
      variant === "mobile"
        ? "text-amber-900 bg-amber-50 border-amber-300 hover:bg-amber-100 active:bg-amber-200"
        : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 active:bg-amber-200 focus:ring-amber-200"
    }`;
  }
  return `${base} ${
    variant === "mobile"
      ? "text-violet-800 bg-violet-50 border-violet-300 hover:bg-violet-100 active:bg-violet-200"
      : "bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100 active:bg-violet-200 focus:ring-violet-200"
  }`;
}

export type ProductServiceProtocolInitial = {
  service_kind: "client" | "recycle";
  product_id: string;
  ac_brand: string;
  ac_model: string;
  indoor_unit_serial: string;
  outdoor_unit_serial: string;
  date: string;
};

export function productToServiceProtocolInitialData(p: {
  id: string;
  name: string;
  model_code?: string | null;
  product_condition: "new" | "used";
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  brands?: { name?: string } | null;
}): ProductServiceProtocolInitial {
  const brand = p.brands?.name?.trim() ?? "";
  const modelCode = (p.model_code ?? "").trim();
  let model = modelCode;
  if (!model && brand && p.name.toLowerCase().startsWith(brand.toLowerCase())) {
    model = p.name.slice(brand.length).trim();
  } else if (!model) {
    model = p.name.trim();
  }

  return {
    service_kind: p.product_condition === "used" ? "recycle" : "client",
    product_id: p.id,
    ac_brand: brand,
    ac_model: model,
    indoor_unit_serial: p.indoor_unit_serial?.trim() ?? "",
    outdoor_unit_serial: p.outdoor_unit_serial?.trim() ?? "",
    date: new Date().toISOString().slice(0, 10),
  };
}

export type LinkedRepairProtocolSummary = {
  id: string;
  protocol_number: string;
  date: string;
  ac_brand: string | null;
  ac_model: string | null;
  client_name: string | null;
  service_kind: "client" | "recycle" | null;
  status: string;
};

export function repairProtocolRowToSummary(
  row: Record<string, unknown>,
): LinkedRepairProtocolSummary {
  return {
    id: String(row.id),
    protocol_number: String(row.protocol_number ?? ""),
    date: String(row.date ?? ""),
    ac_brand: (row.ac_brand as string | null) ?? null,
    ac_model: (row.ac_model as string | null) ?? null,
    client_name: (row.client_name as string | null) ?? null,
    service_kind: row.service_kind === "recycle" ? "recycle" : "client",
    status: String(row.status ?? ""),
  };
}
