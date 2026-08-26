# Tenho ou Quero

Checklist com fotos para gerir uma coleção. PWA instalável, dados 100% no telemóvel
(IndexedDB — as fotos são guardadas como blobs, redimensionadas a 1200px/JPEG 85%).

## Estrutura

- `src/app.html` — **fonte única**: estilos, markup e script da app. É aqui que se edita.
- `tools/build.mjs` — gera `index.html` (PWA), `artifact.html` (versão Artifact) e `sw.js`.
- `tools/make-icons.mjs` — gera os PNG em `icons/` (sem dependências).
- `tools/serve.mjs` — servidor estático local para testar.

## Correr

```sh
node tools/build.mjs     # depois de editar src/app.html
node tools/serve.mjs      # http://localhost:8787
```

Nunca editar `index.html`, `artifact.html` ou `sw.js` à mão — são gerados.
