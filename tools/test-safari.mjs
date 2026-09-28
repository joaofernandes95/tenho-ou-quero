// Testa a app como se fosse o Safari do iPhone: node tools/test-safari.mjs [porta]
// e abre http://localhost:8798/teste num browser (Chrome serve).
//
// O Safari apaga o ficheiro de uma foto quando o registo dela na IndexedDB é regravado,
// e a foto que a app tinha em memória morre (fica em branco, e voltar a gravá-la falha).
// O Chrome não faz isto, por isso esses bugs não se veem lá. tools/teste/simulador-safari.js
// reproduz esse comportamento; tools/teste/bateria.js percorre a app e confirma que
// nenhuma imagem morre e que a base de dados bate certo com o ecrã.
//
// Usa uma porta própria: a base de dados de teste é apagada a cada corrida, e fica
// separada da que usas em node tools/serve.mjs.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const port = Number(process.argv[2] || 8798);
const ler = (p) => readFileSync(new URL(p, root), "utf8");

createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  const send = (type, body) =>
    res.writeHead(200, { "content-type": type + "; charset=utf-8", "cache-control": "no-store" }).end(body);

  if (path === "/teste") return send("text/html", ler("tools/teste/semente.html"));
  if (path === "/bateria.js") return send("text/javascript", ler("tools/teste/bateria.js"));
  if (path !== "/") { res.writeHead(404).end(); return; }

  // A app (sempre lida de src/app.html) com o simulador carregado antes do script dela;
  // com ?teste=N corre também a bateria.
  const app = ler("src/app.html");
  const teste = new URL(req.url, "http://x").searchParams.has("teste");
  send("text/html",
    "<!doctype html><html lang=pt-PT><head><meta charset=utf-8><script>" +
    ler("tools/teste/simulador-safari.js") + "</script>" +
    app.replace("<style>", "</head><body><style>") +
    (teste ? '<script src="/bateria.js"></script>' : "") +
    "</body></html>");
}).listen(port, () => console.log("Abre http://localhost:" + port + "/teste"));
