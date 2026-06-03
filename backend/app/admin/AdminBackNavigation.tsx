"use client";

import { useEffect } from "react";
import { installAdminBackNavigation } from "@/lib/admin/adminBackStack";

/** Глобална обработка на Android back в админ PWA. */
export function AdminBackNavigation() {
  useEffect(() => installAdminBackNavigation(), []);
  return null;
}
