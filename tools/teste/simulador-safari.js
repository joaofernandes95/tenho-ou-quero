// Simula a semântica do WebKit para blobs da IndexedDB:
// um Blob lido de um registo morre quando esse registo é regravado ou apagado.
// - URLs criadas a partir de um blob morto deixam de carregar (fetch falha).
// - put() de um valor que contenha um blob morto falha (como no Safari).
(function(){
  const dead = new WeakSet();
  const origin = new Map();            // "store|key" -> Set<Blob>
  const urlBlob = new Map();           // url -> Blob
  window.__shim = { dead, urlBlob, puts: [] };

  function blobsIn(v, out = []) {
    if (v instanceof Blob) out.push(v);
    else if (v && typeof v === "object") for (const k in v) blobsIn(v[k], out);
    return out;
  }
  function keyOf(store, value, key) {
    const kp = store.keyPath;
    return store.name + "|" + (key !== undefined ? key : (kp ? value[kp] : "?"));
  }
  function track(store, value, key) {
    const bs = blobsIn(value); if (!bs.length) return;
    const k = keyOf(store, value, key);
    if (!origin.has(k)) origin.set(k, new Set());
    bs.forEach(b => origin.get(k).add(b));
  }
  function kill(k) {
    const s = origin.get(k); if (!s) return;
    s.forEach(b => dead.add(b)); origin.delete(k);
  }
  // Cada leitura devolve Blobs "de disco": marca-os como pertencentes ao registo.
  function wrapRead(req, store, many) {
    req.addEventListener("success", () => {
      const r = req.result; if (r == null) return;
      if (many) r.forEach(v => track(store, v));
      else if (r instanceof IDBCursorWithValue) track(store, r.value, r.primaryKey);
      else track(store, r);
    });
    return req;
  }
  const P = IDBObjectStore.prototype;
  const oGet = P.get, oGetAll = P.getAll, oPut = P.put, oAdd = P.add, oDel = P.delete, oCur = P.openCursor;
  P.get = function (k) { return wrapRead(oGet.call(this, k), this, false); };
  P.getAll = function (...a) { return wrapRead(oGetAll.apply(this, a), this, true); };
  P.openCursor = function (...a) { return wrapRead(oCur.apply(this, a), this, false); };
  function write(orig) {
    return function (value, key) {
      if (blobsIn(value).some(b => dead.has(b)))
        throw new DOMException("simulated WebKitBlobResource error", "UnknownError");
      const k = keyOf(this, value, key);
      window.__shim.puts.push(k + " blobs=" + blobsIn(value).length);
      const req = orig.apply(this, arguments);
      req.transaction.addEventListener("complete", () => kill(k));
      return req;
    };
  }
  P.put = write(oPut); P.add = write(oAdd);
  P.delete = function (k) {
    const req = oDel.call(this, k);
    const n = this.name;
    req.transaction.addEventListener("complete", () => kill(n + "|" + k));
    return req;
  };
  const oURL = URL.createObjectURL;
  URL.createObjectURL = function (b) { const u = oURL.call(URL, b); urlBlob.set(u, b); return u; };
  // Uma <img> com URL de blob morto: igual ao Safari, fica em branco.
  window.__imgDead = img => { const b = urlBlob.get(img.getAttribute("src")); return !!(b && dead.has(b)); };
})();
