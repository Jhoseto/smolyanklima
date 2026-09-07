/** Сигнал към други табове/устройства в същия браузър, че каталогът е променен. */
const BC_CHANNEL = "sk-admin-products-catalog";
const EVENT = "sk-admin-products-catalog-reload";

export function notifyAdminProductsCatalogChanged(): void {
  if (typeof window === "undefined") return;
  try {
    const bc = new BroadcastChannel(BC_CHANNEL);
    bc.postMessage({ t: Date.now() });
    bc.close();
  } catch {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function subscribeAdminProductsCatalogReload(onReload: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => onReload();
  window.addEventListener(EVENT, handler);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_CHANNEL);
    bc.onmessage = handler;
  } catch {
    /* Safari / стари браузъри — само CustomEvent fallback */
  }

  return () => {
    window.removeEventListener(EVENT, handler);
    bc?.close();
  };
}
