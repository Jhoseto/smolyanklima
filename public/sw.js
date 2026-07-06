/**
 * Public site service worker — lightweight static cache + offline shell fallback.
 * Admin PWA uses /admin/sw-admin.js separately.
 *
 * IMPORTANT: Never cache-first /_next/* or admin/login assets. Turbopack chunk
 * filenames are stable across deploys; stale JS + fresh SSR HTML → React #418.
 */
const CACHE = "sk-public-v2";
const PRECACHE = ["/", "/index.html", "/manifest.json", "/favicon.ico", "/icon-192.png", "/icon.svg"];

/** Next.js admin/login — must always hit network (no SW cache-first). */
function isNextOrAdminPath(pathname) {
  return (
    pathname.startsWith("/_next/")
    || pathname.startsWith("/admin")
    || pathname === "/login"
    || pathname.startsWith("/login/")
    || pathname.startsWith("/api/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("sk-public-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(async () => {
      // Drop poisoned Next chunks cached by sk-public-v1
      const cache = await caches.open(CACHE);
      const reqs = await cache.keys();
      await Promise.all(
        reqs
          .filter((r) => isNextOrAdminPath(new URL(r.url).pathname))
          .map((r) => cache.delete(r)),
      );
    }).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Next/admin — avoids stale bundle hydration crashes in production.
  if (isNextOrAdminPath(url.pathname)) return;

  if (/\.(js|css|png|jpe?g|webp|svg|woff2?|ico|json)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response.ok) return response;
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        });
      }),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html")),
    );
  }
});
