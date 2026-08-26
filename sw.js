// Gerado por tools/build.mjs - nao editar a mao.
const VERSION = "v90b9a0fa07";
const SHELL = "shell-" + VERSION;
const FONTS = "fonts-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-64.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === SHELL || k === FONTS ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navegacao: serve a shell em cache, atualiza em segundo plano.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(SHELL).then((c) =>
        c.match("./index.html").then((hit) => {
          const net = fetch(req).then((res) => { c.put("./index.html", res.clone()); return res; });
          return hit || net;
        }).catch(() => fetch(req))
      )
    );
    return;
  }

  // Tipos de letra: cache-first, guarda ao primeiro uso (offline depois disso).
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(FONTS).then((c) =>
        c.match(req).then((hit) =>
          hit || fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; })
        )
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(SHELL).then((c) =>
      c.match(req).then((hit) =>
        hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })
      )
    )
  );
});
