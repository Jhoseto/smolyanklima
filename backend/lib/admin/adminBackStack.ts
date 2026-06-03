/**
 * Android / PWA hardware back: първо затваря overlay (модал), после навигация в /admin,
 * без излизане от инсталираното приложение.
 */

const SK_ADMIN = "skAdminV1";

type BackLayer = {
  id: string;
  onClose: () => void;
};

const layers: BackLayer[] = [];
let installed = false;
let suppressPopCount = 0;

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function adminStateKind(): string | undefined {
  const state = history.state as Record<string, unknown> | null;
  const v = state?.[SK_ADMIN];
  return typeof v === "string" ? v : undefined;
}

/** Първоначален „trap“ в историята — един back не затваря PWA. */
function seedAdminHistoryTrap(): void {
  const state = history.state as Record<string, unknown> | null;
  if (!state?.[SK_ADMIN]) {
    history.replaceState({ ...(state ?? {}), [SK_ADMIN]: "base" }, "");
  }
  if (adminStateKind() !== "trap") {
    history.pushState({ [SK_ADMIN]: "trap" }, "");
  }
}

function rearmTrapIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (!isAdminPath(window.location.pathname)) return;
  if (layers.length > 0) return;
  if (adminStateKind() !== "trap") return;
  history.pushState({ [SK_ADMIN]: "trap" }, "");
}

function handlePopState(): void {
  if (suppressPopCount > 0) {
    suppressPopCount--;
    return;
  }

  const top = layers.pop();
  if (top) {
    top.onClose();
    queueMicrotask(rearmTrapIfNeeded);
    return;
  }

  const path = window.location.pathname;

  if (!isAdminPath(path)) {
    suppressPopCount++;
    history.pushState({ [SK_ADMIN]: "trap" }, "", "/admin");
    return;
  }

  if (adminStateKind() === "trap") {
    history.pushState({ [SK_ADMIN]: "trap" }, "");
  }
}

/** Вика се веднъж от AdminBackNavigation (admin layout). */
export function installAdminBackNavigation(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!installed) {
    installed = true;
    seedAdminHistoryTrap();
    window.addEventListener("popstate", handlePopState);
  }
  return () => {};
}

export function pushAdminBackLayer(id: string, onClose: () => void): void {
  layers.push({ id, onClose });
  history.pushState({ [SK_ADMIN]: "overlay", id }, "");
}

/** Премахва слой; при затваряне с X — синхронизира history.back(). */
export function popAdminBackLayer(id: string, fromPopstate: boolean): void {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  layers.splice(idx, 1);
  if (!fromPopstate && adminStateKind() === "overlay") {
    suppressPopCount++;
    history.back();
  }
  queueMicrotask(rearmTrapIfNeeded);
}
