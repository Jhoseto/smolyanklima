"use client";

import { useEffect, useState } from "react";

/**
 * Delays updating the returned value until `delay` ms have passed
 * since the last change — prevents search refetch on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
