// Bateria de testes, corrida dentro da app com o simulador do Safari ativo.
// Parte 1 corre sobre os dados da semente; parte 2 corre depois de recarregar a página.
// O resultado aparece por cima da app e no título do separador (TESTE OK / TESTE FALHOU).
(async()=>{
const parte=new URLSearchParams(location.search).get("teste");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>document.getElementById(id);
const seg=v=>document.querySelector('#segState button[data-v="'+v+'"]').click();
const cards=()=>[...document.querySelectorAll("#grid .card")];
const letra=c=>c.querySelector("h3").textContent.slice(-1);
const card=n=>cards().find(c=>c.querySelector("h3").textContent==="Artigo "+n);
const mark=n=>card(n).querySelector(".mark").click();
const falhas=[], log=[], errs=[];
addEventListener("unhandledrejection",e=>errs.push(String(e.reason&&(e.reason.name+": "+e.reason.message))));
addEventListener("error",e=>errs.push("error: "+e.message));
const ok=(cond,msg)=>{ if(!cond) falhas.push(msg); };

// Imagem "morta" = o Safari mostrava-a em branco (blob apagado) ou a URL foi revogada.
async function morta(img){
  if(__imgDead(img)) return "blob morto";
  try{ await (await fetch(img.getAttribute("src"))).blob(); }catch(e){ return "URL revogada"; }
  return null;
}
async function grelha(label,esperados){
  await sleep(450);
  const out=[];
  for(const c of cards()){
    const i=c.querySelector("img"); let s=c.dataset.state;
    if(i){ const m=await morta(i); if(m){ s+=" "+m.toUpperCase(); falhas.push(label+": "+letra(c)+" "+m); } }
    else s+=" semfoto";
    out.push(letra(c)+"["+s+"]");
  }
  const nomes=cards().map(letra).join("");
  if(esperados!==undefined) ok(nomes===esperados,label+": esperava "+esperados+" e vi "+nomes);
  log.push(label.padEnd(32)+out.join(" "));
}
async function ecraInteiro(label){
  for(const c of cards()){
    c.querySelector(".shot").click(); await sleep(150);
    const i=document.querySelector("#vStage img");
    if(i){ const m=await morta(i); if(m) falhas.push(label+", ecrã inteiro "+letra(c)+": "+m); }
    document.querySelector("#dlgPhoto [data-close]").click(); await sleep(50);
  }
}
const idb=store=>new Promise((res,rej)=>{
  const q=indexedDB.open("colecao");
  q.onsuccess=()=>{ const d=q.result;
    if(!d.objectStoreNames.contains(store)){ d.close(); res([]); return; }
    const g=d.transaction(store).objectStore(store).getAll();
    g.onsuccess=()=>{ d.close(); res(g.result); }; g.onerror=()=>rej(g.error); };
  q.onerror=()=>rej(q.error);
});
async function dbIgualEcra(label){
  seg("all"); await sleep(300);
  const fim=await idb("articles");
  const ecra=Object.fromEntries(cards().map(c=>["t"+letra(c),c.dataset.state]));
  fim.forEach(a=>ok(ecra[a.id]===a.state,label+": base≠ecrã em "+a.id+" ("+a.state+" vs "+ecra[a.id]+")"));
  ok(fim.length===cards().length,label+": "+fim.length+" artigos na base, "+cards().length+" no ecrã");
}
const soComBlobs=()=>__shim.puts.filter(p=>!/blobs=0$/.test(p));
const png=async cor=>{
  const c=document.createElement("canvas"); c.width=c.height=900;
  const x=c.getContext("2d"); x.fillStyle=cor; x.fillRect(0,0,900,900);
  return new Promise(r=>c.toBlob(r,"image/png"));
};
const escolherFoto=async(cor)=>{
  const dt=new DataTransfer(); dt.items.add(new File([await png(cor)],"f.png",{type:"image/png"}));
  $("fileGal").files=dt.files; $("fileGal").dispatchEvent(new Event("change"));
};

await sleep(1500);

if(parte==="1"){
  // 1. migração v1 → v2
  const arts=await idb("articles"), ph=await idb("photos"), th=await idb("thumbs");
  ok(arts.length===6,"migração: esperava 6 artigos, há "+arts.length);
  ok(arts.every(a=>!("photo" in a)&&!("thumb" in a)),"migração: há artigos com fotos lá dentro");
  ok(ph.length===5,"migração: esperava 5 fotos, há "+ph.length);
  ok(th.length===5,"migração: esperava 5 miniaturas (a de E criada no arranque), há "+th.length);
  log.push("migração: "+arts.length+" artigos, "+ph.length+" fotos, "+th.length+" miniaturas");
  seg("all"); await grelha("Tudo (arranque)","ABCDEF");
  await ecraInteiro("arranque");

  // 2. o bug reportado: Quero → marcar → Já tenho → desmarcar
  __shim.puts.length=0;
  seg("want"); await grelha("Quero","ABEF");
  mark("A"); await sleep(600); await grelha("Quero, marquei A","BEF");
  seg("have"); await grelha("Já tenho","ACD");
  mark("A"); await sleep(600); await grelha("Já tenho, desmarquei A","CD");
  seg("want"); await grelha("Quero","ABEF");
  seg("all"); await grelha("Tudo","ABCDEF");
  ok(!soComBlobs().length,"marcar/desmarcar regravou fotos: "+soComBlobs().join(", "));

  // 3. vários ciclos entre separadores
  for(let k=0;k<4;k++){
    seg("want"); await sleep(300); mark("B"); await sleep(500);
    seg("have"); await sleep(300); mark("B"); await sleep(500);
    seg("all");  await sleep(300); mark("C"); await sleep(300); mark("C"); await sleep(300);
  }
  seg("all");  await grelha("Tudo após 4 ciclos","ABCDEF");
  seg("have"); await grelha("Já tenho após ciclos","CD");
  seg("want"); await grelha("Quero após ciclos","ABEF");

  // 4. marcar dentro do ecrã inteiro e navegar
  card("E").querySelector(".shot").click(); await sleep(200);
  $("vToggle").click(); await sleep(400);
  const vi=document.querySelector("#vStage img");
  ok(vi&&!(await morta(vi)),"ecrã inteiro: foto de E morreu ao marcar");
  ok($("vToggle").dataset.state==="have","ecrã inteiro: E não passou a já tenho");
  $("vNext").click(); await sleep(150); $("vPrev").click(); await sleep(150);
  $("vToggle").click(); await sleep(400);
  document.querySelector("#dlgPhoto [data-close]").click(); await sleep(100);
  await grelha("Quero após ecrã inteiro","ABEF");
  seg("all"); await ecraInteiro("após marcar");

  // 5. apagar a categoria "Cartas" (A, B, C)
  $("btnCats").click(); await sleep(200);
  document.querySelector("#catList .mini").click(); await sleep(150);
  $("confirmYes").click(); await sleep(700);
  document.querySelector("#dlgCats [data-close]").click(); await sleep(100);
  await grelha("Tudo após apagar categoria","ABCDEF");
  await ecraInteiro("após apagar categoria");

  // 6. editar sem mudar a foto, depois marcar
  card("A").querySelector(".info").click(); await sleep(200);
  $("btnSaveArt").click(); await sleep(500);
  mark("A"); await sleep(500); mark("A"); await sleep(500);
  await grelha("Tudo após editar A","ABCDEF");

  // 7. exportar e repor (o ficheiro é apanhado aqui, nada é descarregado)
  let json=null; const oc=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){ json=fetch(this.href).then(r=>r.text()); };
  $("btnBackup").click(); await sleep(100); $("btnExport").click(); await sleep(1500);
  HTMLAnchorElement.prototype.click=oc;
  const txt=await json, dados=JSON.parse(txt);
  ok(dados.articles.filter(a=>a.photo).length===5,"exportar: esperava 5 fotos no ficheiro");
  const dt=new DataTransfer(); dt.items.add(new File([txt],"c.json",{type:"application/json"}));
  $("fileRestore").files=dt.files; $("fileRestore").dispatchEvent(new Event("change")); await sleep(400);
  $("confirmYes").click(); await sleep(1500);
  ok(/^Reposto/.test($("backupMsg").textContent),"repor: "+$("backupMsg").textContent);
  document.querySelector("#dlgBackup [data-close]").click(); await sleep(100);
  await grelha("Tudo após repor","ABCDEF");
  await ecraInteiro("após repor");
  seg("want"); mark("A"); await sleep(600);
  seg("have"); await grelha("Já tenho após repor+marcar A","ACD");
  mark("A"); await sleep(600);

  await dbIgualEcra("fim da parte 1");
  try{ sessionStorage.setItem("teste.parte1",JSON.stringify({log,falhas,errs})); }catch(e){}
  location.replace("/?teste=2");
  return;
}

// ---- parte 2: depois de recarregar ----
let antes={log:["(parte 1 não correu)"],falhas:["parte 1 em falta"],errs:[]};
try{ antes=JSON.parse(sessionStorage.getItem("teste.parte1"))||antes; }catch(e){}

ok(!soComBlobs().length,"2º arranque regravou fotos: "+soComBlobs().join(", "));
seg("all"); await grelha("Tudo depois de recarregar","ABCDEF");
await ecraInteiro("depois de recarregar");

// trocar a foto de B; carregar em Guardar a meio do processamento não pode passar
const urlAntiga=card("B").querySelector("img").getAttribute("src");
card("B").querySelector(".info").click(); await sleep(200);
await escolherFoto("#16a085");
ok($("btnSaveArt").disabled,"Guardar ativo enquanto a foto processa");
$("btnSaveArt").click(); await sleep(30);
ok($("dlgArticle").open,"gravou antes de a foto estar pronta");
for(let i=0;i<40&&$("btnSaveArt").disabled;i++) await sleep(100);
$("btnSaveArt").click(); await sleep(600);
ok(card("B").querySelector("img").getAttribute("src")!==urlAntiga,"B continua com a foto antiga");
await grelha("Tudo após trocar foto de B","ABCDEF");
await ecraInteiro("após trocar foto");
mark("B"); await sleep(500);
await grelha("Tudo após marcar B","ABCDEF");

// fechar o formulário a meio do processamento não pode mexer noutro artigo
const urlC=card("C").querySelector("img").getAttribute("src");
card("C").querySelector(".info").click(); await sleep(200);
await escolherFoto("#000000");
document.querySelector("#dlgArticle [data-close]").click(); await sleep(1200);
ok(card("C").querySelector("img").getAttribute("src")===urlC,"C mudou de foto sem ser guardado");
card("D").querySelector(".info").click(); await sleep(200);
ok(!$("btnSaveArt").disabled,"Guardar ficou desativado noutro artigo");
document.querySelector("#dlgArticle [data-close]").click(); await sleep(100);

// apagar D: sai das três stores
card("D").querySelector(".info").click(); await sleep(200);
$("btnDelArt").click(); await sleep(150); $("confirmYes").click(); await sleep(600);
const todas=[...await idb("articles"),...await idb("photos"),...await idb("thumbs")];
ok(!todas.some(r=>r.id==="tD"),"D ficou na base depois de apagado");
await grelha("Tudo após apagar D","ABCEF");
await dbIgualEcra("fim da parte 2");

// ---- resultado ----
const F=[...antes.falhas,...falhas], E=[...antes.errs,...errs];
const passou=!F.length&&!E.length;
const texto=[...antes.log,...log].join("\n")+"\n\nErros JS: "+(E.length?E.join("; "):"nenhum")+
  "\n"+(passou?"TESTE OK — 0 falhas":"TESTE FALHOU — "+F.length+" falha(s):\n"+F.join("\n"));
document.title=passou?"TESTE OK":"TESTE FALHOU";
window.__resultado=texto;
const pre=document.createElement("pre");
pre.textContent=texto;
pre.style.cssText="position:fixed;inset:0;z-index:99999;margin:0;padding:16px;overflow:auto;"+
  "background:"+(passou?"#0f2a20":"#3a1414")+";color:#fff;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap";
document.body.appendChild(pre);
})().catch(e=>{
  document.title="TESTE FALHOU";
  window.__resultado="A bateria rebentou: "+(e&&e.stack||e);
  document.body.insertAdjacentHTML("beforeend",'<pre style="position:fixed;inset:0;z-index:99999;margin:0;padding:16px;background:#3a1414;color:#fff">'+
    String(window.__resultado).replace(/</g,"&lt;")+"</pre>");
});
