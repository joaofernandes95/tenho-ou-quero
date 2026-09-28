# Tenho ou Quero

Checklist com fotos para gerir uma coleção. PWA instalável, dados 100% no telemóvel
(IndexedDB — as fotos são guardadas como blobs, redimensionadas a 1200px/JPEG 85%).

## Estrutura

- `src/app.html` — **fonte única**: estilos, markup e script da app. É aqui que se edita.
- `tools/build.mjs` — gera `index.html` (PWA), `artifact.html` (versão Artifact) e `sw.js`.
- `tools/make-icons.mjs` — gera os PNG em `icons/` (sem dependências).
- `tools/serve.mjs` — servidor estático local para testar.
- `tools/test-safari.mjs` — testa a app a simular o Safari do iPhone (ver abaixo).

## Correr

```sh
node tools/build.mjs     # depois de editar src/app.html
node tools/serve.mjs      # http://localhost:8787
```

## Testar

```sh
node tools/test-safari.mjs   # e abrir http://localhost:8798/teste
```

No Safari, regravar um registo da IndexedDB apaga o ficheiro da foto antiga e a foto que a
app tinha em memória morre (fica em branco; voltar a gravá-la falha). O Chrome não faz isso,
por isso esses bugs não aparecem lá. O teste simula esse comportamento, parte de dados no
formato antigo (testa a migração) e percorre separadores, marcar/desmarcar, ecrã inteiro,
categorias, editar, trocar foto, apagar, exportar/repor e recarregar. No fim o separador fica
com o título **TESTE OK** ou **TESTE FALHOU** e a lista do que falhou. Demora ~1 minuto;
deixar o separador à frente (em segundo plano o Chrome abranda-o).

Regra que evita estes bugs: as fotos vivem nas stores `photos`/`thumbs`; o artigo em
`articles` só tem dados. Nunca regravar uma foto a não ser para a substituir.

Nunca editar `index.html`, `artifact.html` ou `sw.js` à mão — são gerados.
