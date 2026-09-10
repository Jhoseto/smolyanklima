"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/** Fleet modals над layout overflow — render в document.body. */
export function FleetModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
