/* Lincoln-Plugin вЂ” service worker (РєСЌС€ РґР»СЏ РѕС„Р»Р°Р№РЅ-СЂРµР¶РёРјР°) */
var CACHE = "lincoln-plugin-v65";
var CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(CORE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  function offlineFallback() {
    return caches.match("./index.html").then(function (hit) {
      if (hit) return hit;
      return caches.match("./").then(function (root) {
        if (root) return root;
        return new Response("Офлайн: откройте сайт при подключении к сети.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      });
    });
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        /* кэшируем только успешные ответы, иначе 404 затрёт офлайн-копию */
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        }
        return res;
      }).catch(function () {
        return offlineFallback();
      })
    );
    return;
  }

  /* Данные и файлы плагинов — всегда сначала из сети, чтобы каталог не залипал */
  var isData = /\.(json|webmanifest)$/i.test(url.pathname);
  var isDownload = url.pathname.indexOf("/plugins/") !== -1 || url.pathname.indexOf("/themes/") !== -1;

  if (isData || isDownload) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || offlineFallback();
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return offlineFallback();
      });
    })
  );
});