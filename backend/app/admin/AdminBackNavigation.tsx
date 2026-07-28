"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  cancelAllAdminBackLayers,
  installAdminBackNavigation,
} from "@/lib/admin/adminBackStack";

/** Глобална обработка на Android back в admin PWA. */
export function AdminBackNavigation() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  useEffect(() => installAdminBackNavigation(), []);

  // При route change: махни overlay слоевете БЕЗ history.back(), за да не се
  // отмени Next.js навигацията от cleanup на unmount-нати страници (dashboard panel и др.).
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      cancelAllAdminBackLayers();
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  return null;
}
