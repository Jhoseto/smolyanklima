"use client";

import { useEffect, useId, useRef } from "react";
import { popAdminBackLayer, pushAdminBackLayer } from "@/lib/admin/adminBackStack";

/**
 * Регистрира overlay (модал, drawer) за hardware back.
 * @param active — true докато overlay е отворен
 * @param onClose — затваряне (същото като X / backdrop)
 */
export function useAdminBackHandler(active: boolean, onClose: () => void, layerId?: string) {
  const autoId = useId();
  const idRef = useRef(layerId ?? autoId);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    idRef.current = layerId ?? autoId;
  }, [layerId, autoId]);

  useEffect(() => {
    if (!active) return;
    const id = idRef.current;
    pushAdminBackLayer(id, () => onCloseRef.current());
    return () => popAdminBackLayer(id, false);
  }, [active]);
}
