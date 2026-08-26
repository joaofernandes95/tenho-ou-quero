// Servidor estatico para testar a app localmente: node tools/serve.mjs [porta]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.argv[2] || 8787);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = join(root, normalize(path).replace(/^([/\\])+/, ""));
  if (!file.startsWith(root)) { res.writeHead(403).end("forbidden"); return; }
  try {
    await stat(file);
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    }).end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("404");
  }
}).listen(port, () => console.log("http://localhost:" + port));
