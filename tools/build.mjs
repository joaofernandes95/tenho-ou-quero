// Gera index.html (PWA instalavel), artifact.html (versao para Artifact) e sw.js
// a partir de src/app.html. Correr: node tools/build.mjs
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const app = readFileSync(new URL("src/app.html", root), "utf8");

// Tudo antes do primeiro <style> e preambulo de <head>; o resto e corpo da pagina.
const cut = app.indexOf("<style>");
if (cut < 0) throw new Error("src/app.html sem bloco <style>");
const head = app.slice(0, cut).trim();
const body = app.slice(cut).trim();

const HTML = `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="description" content="Wishlist com fotos: o que já tenho e o que ainda quero.">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#191d23" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" href="./icons/favicon-64.png" sizes="64x64" type="image/png">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="A Minha Wishlist">
${head}
</head>
<body>
${body}
<script>
// Regista o service worker e, quando sai uma versão nova, recarrega uma vez sozinho —
// senão fica-se preso na versão em cache sem perceber porquê.
if ("serviceWorker" in navigator) {
  addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
    var recarregou = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (recarregou) return;
      recarregou = true;
      location.reload();
    });
  });
}
</script>
</body>
</html>
`;

writeFileSync(new URL("index.html", root), HTML, "utf8");
copyFileSync(new URL("src/app.html", root), new URL("artifact.html", root));

const version = createHash("sha256").update(HTML).digest("hex").slice(0, 10);

const SW = `// Gerado por tools/build.mjs - nao editar a mao.
const VERSION = "v${version}";
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
`;

writeFileSync(new URL("sw.js", root), SW, "utf8");
console.log("index.html + artifact.html + sw.js (" + version + ")");
