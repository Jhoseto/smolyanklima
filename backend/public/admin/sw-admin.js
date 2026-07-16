/* eslint-disable no-undef */
/**
 * Service worker за админ панела.
 *
 * Отговорности:
 *  1. Push известия (live chat и др.)
 *  2. Background Sync — flush на offline mutation_queue след възстановяване на мрежа
 *     дори когато прозорецът е затворен. Работи изцяло на базата на IndexedDB
 *     (без shared code с приложението — SW е изолиран контекст).
 *
 * Без fetch handler — Next App Router сам обслужва навигацията.
 */

const SK_OFFLINE_DB = "sk-admin-offline";
const SK_OFFLINE_DB_VERSION = 1;
const SK_SYNC_TAG = "sk-admin-mutation-sync";
const SK_MAX_RETRIES = 5;

/* ───────────── Activate веднага (иначе новият SW чака затворени табове) ───────────── */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ───────────── Push известия ───────────── */

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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const c of clientList) {
        if (c.url.includes("/admin") && "focus" in c) {
          await c.focus();
          if (typeof c.navigate === "function") {
            try {
              await c.navigate(url);
            } catch {
              /* navigate не се поддържа навсякъде */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

/* ───────────── Background Sync ───────────── */

self.addEventListener("sync", (event) => {
  if (event.tag === SK_SYNC_TAG) {
    event.waitUntil(flushQueueInSwWithLock());
  }
});

// Fallback: message от страницата → форсиран flush (Safari няма Background Sync).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FLUSH_QUEUE") {
    event.waitUntil(flushQueueInSwWithLock().then(() => {
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        list.forEach(c => c.postMessage({ type: "QUEUE_FLUSHED" }));
      });
    }));
  }
});

/**
 * Multi-tab защита: SW и tab-овете използват един и същи lock name,
 * така че никога не флъшваме паралелно (виж P2/P5 в кода ревюто).
 * Ако lock-а е зает от tab → SW skip-ва this run; tab-ът ще довърши работата.
 */
function flushQueueInSwWithLock() {
  if (self.locks && typeof self.locks.request === "function") {
    return self.locks.request("sk-offline-sync", { ifAvailable: true }, async (lock) => {
      if (!lock) return; // друг tab/SW в момента flush-ва
      await flushQueueInSw();
    });
  }
  return flushQueueInSw();
}

/* ───────────── IndexedDB helpers (изолиран SW контекст) ───────────── */

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SK_OFFLINE_DB, SK_OFFLINE_DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      // SW не прави schema migrations — само чете/пише.
    };
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAllByCreatedAt(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutation_queue", "readonly");
    const req = tx.objectStore("mutation_queue").index("by-createdAt").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function putMutation(db, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutation_queue", "readwrite");
    const req = tx.objectStore("mutation_queue").put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutation_queue", "readwrite");
    const req = tx.objectStore("mutation_queue").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getIdMap(db, localId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("id_map", "readonly");
    const req = tx.objectStore("id_map").get(localId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putIdMap(db, entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("id_map", "readwrite");
    const req = tx.objectStore("id_map").put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getDocument(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readonly");
    const req = tx.objectStore("documents").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putDocument(db, doc) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readwrite");
    const req = tx.objectStore("documents").put(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteDocument(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readwrite");
    const req = tx.objectStore("documents").delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ───────────── Flush алгоритъм (огледало на lib/offline/sync.ts) ───────────── */

async function flushQueueInSw() {
  let db;
  try {
    db = await openOfflineDb();
  } catch {
    return; // няма IDB → нищо за правене
  }

  const pending = (await getAllByCreatedAt(db)).filter(m => m.status !== "syncing");

  for (const m of pending) {
    if (!m.id || m.retries >= SK_MAX_RETRIES) continue;
    try {
      m.status = "syncing";
      m.updatedAt = Date.now();
      await putMutation(db, m);

      let endpoint = m.endpoint;
      if (endpoint.includes(":localId") && m.localId) {
        const entry = await getIdMap(db, m.localId);
        if (!entry?.serverId) {
          m.status = "pending";
          await putMutation(db, m);
          continue;
        }
        endpoint = endpoint.replace(":localId", entry.serverId);
      }

      const init = {
        method: m.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      };
      if (m.body !== undefined && m.method !== "DELETE") {
        init.body = JSON.stringify(m.body);
      }
      if (m.idempotencyKey) {
        init.headers["Idempotency-Key"] = m.idempotencyKey;
      }

      const res = await fetch(endpoint, init);
      if (!res.ok && res.status !== 204) {
        const isClient = res.status >= 400 && res.status < 500;
        m.status = "error";
        m.retries = isClient ? SK_MAX_RETRIES : m.retries + 1;
        m.lastError = `HTTP ${res.status}`;
        m.updatedAt = Date.now();
        await putMutation(db, m);
        continue;
      }

      if (m.method === "POST" && m.localId) {
        try {
          const json = await res.clone().json();
          const serverId = (json && json.data && json.data.id) || (json && json.id);
          if (serverId) {
            await putIdMap(db, { localId: m.localId, serverId, kind: m.kind, createdAt: Date.now() });
            const old = await getDocument(db, m.localId);
            if (old) {
              const next = Object.assign({}, old, { key: serverId, serverId, dirty: false, updatedAt: Date.now() });
              await putDocument(db, next);
              await deleteDocument(db, m.localId);
            }
          }
        } catch { /* ignore */ }
      }

      await deleteMutation(db, m.id);
    } catch (e) {
      m.status = "error";
      m.retries = (m.retries || 0) + 1;
      m.lastError = String(e && e.message || e);
      m.updatedAt = Date.now();
      try { await putMutation(db, m); } catch { /* ignore */ }
    }
  }
}
