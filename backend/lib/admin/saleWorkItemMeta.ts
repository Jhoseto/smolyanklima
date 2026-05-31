/** Извлича метаданни за продажба от notes (fallback за стари записи). */

function segmentAfterMarker(notes: string, marker: string): string | null {
  const idx = notes.toLowerCase().indexOf(marker.toLowerCase());
  if (idx < 0) return null;
  let tail = notes.slice(idx + marker.length).trim();
  const sep = tail.indexOf(" · ");
  if (sep >= 0) tail = tail.slice(0, sep).trim();
  return tail || null;
}

export function supplierFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  return segmentAfterMarker(notes, "доставчик:");
}

export function supplierInvoiceFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  return segmentAfterMarker(notes, "ф-ра доставка:");
}

export type SaleSupplierFields = {
  supplier_name?: string | null;
  supplier_invoice_number?: string | null;
  notes?: string | null;
  products?: { supplier_invoice_number?: string | null } | null;
};

export function saleSupplierName(row: SaleSupplierFields): string | null {
  const direct = (row.supplier_name ?? "").trim();
  if (direct) return direct;
  return supplierFromNotes(row.notes);
}

export function saleSupplierInvoice(row: SaleSupplierFields): string | null {
  const direct = (row.supplier_invoice_number ?? "").trim();
  if (direct) return direct;
  const fromNotes = supplierInvoiceFromNotes(row.notes);
  if (fromNotes) return fromNotes;
  const fromProduct = (row.products?.supplier_invoice_number ?? "").trim();
  return fromProduct || null;
}
