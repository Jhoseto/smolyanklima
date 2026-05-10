/* eslint-disable no-undef */
/** Service worker само за push известия — без fetch handler, за да не се бърка с Next/SPA. */
self.addEventListener("push", (event) => {
  let data = { title: "Смолян Клима — админ", body: "", url: "/admin/chat" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "sk-admin-live-chat",
      data: { url: data.url || "/admin/chat", tag: data.tag },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin/chat";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url.includes("/admin") && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
