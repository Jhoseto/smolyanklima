(function () {
  try {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function (rs) {
      rs.forEach(function (r) {
        var u =
          (r.active && r.active.scriptURL) ||
          (r.installing && r.installing.scriptURL) ||
          "";
        if (/\/sw\.js$/.test(u)) r.unregister();
      });
    });
    if ("caches" in window) {
      caches.keys().then(function (ks) {
        ks.forEach(function (k) {
          if (k.indexOf("sk-public-") === 0) caches.delete(k);
        });
      });
    }
  } catch (e) {
    /* ignore */
  }
})();
