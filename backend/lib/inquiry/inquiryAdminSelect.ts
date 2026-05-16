/** Полета за admin списък/детайл на inquiries (без include_installation). */
export const INQUIRY_ADMIN_SELECT_BASE =
  "id,source,customer_name,customer_phone,customer_email,message,product_id,service_type,status,priority,assigned_to,admin_notes,created_at,updated_at";

/** С предпочитание за монтаж (миграция 0054). */
export const INQUIRY_ADMIN_SELECT =
  "id,source,customer_name,customer_phone,customer_email,message,product_id,service_type,include_installation,status,priority,assigned_to,admin_notes,created_at,updated_at";

export type InquiryAdminRow = {
  id: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  message?: string | null;
  product_id?: string | null;
  service_type?: string | null;
  include_installation?: boolean | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at?: string;
};

export function withDefaultIncludeInstallation<T extends Record<string, unknown>>(
  rows: T[],
): Array<T & { include_installation: boolean | null }> {
  return rows.map((row) => ({
    ...row,
    include_installation:
      "include_installation" in row && row.include_installation !== undefined
        ? (row.include_installation as boolean | null)
        : null,
  }));
}
