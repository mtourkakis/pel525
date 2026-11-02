import * as pdfjsLib from './lib/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.mjs';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// lower-case + strip accents (Greek τόνοι) so "πτηση" finds "Πτήση"
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 1800); };
const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };

/* ---------- IndexedDB ---------- */
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('omreader', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('docs', { keyPath: 'id' });
      d.createObjectStore('files');
      d.createObjectStore('text');
      d.createObjectStore('favs', { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    const r = fn(s); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => rej(t.error);
  });
}
const get = (st, k) => tx(st, 'readonly', s => s.get(k));
const all = st => tx(st, 'readonly', s => s.getAll());
const put = (st, v, k) => tx(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k));
const del = (st, k) => tx(st, 'readwrite', s => s.delete(k));

/* ---------- state ---------- */
const S = { docs: [], favs: [], doc: null, pdf: null, text: {}, zoom: 1, hits: [], hitIdx: 0, hitTerm: '', cur: 1 };
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

/* ---------- theme ---------- */
function applyTheme() { document.body.classList.toggle('day', LS.get('day', false)); }
function toggleTheme() { LS.set('day', !LS.get('day', false)); applyTheme(); }
$('#themeBtn1').onclick = $('#themeBtn2').onclick = toggleTheme;
applyTheme();

/* ---------- views ---------- */
function show(id) { for (const v of ['home', 'doc', 'reader', 'rest']) $('#' + v).classList.toggle('hidden', v !== id); }

/* ---------- import ---------- */
$('#addBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { for (const f of e.target.files) await importPdf(f); e.target.value = ''; renderHome(); };

function modal(html) { $('#modalHost').innerHTML = `<div class="modal"><div class="card">${html}</div></div>`; return $('#modalHost .card'); }
const closeModal = () => $('#modalHost').innerHTML = '';

async function importPdf(file) {
  const card = modal(`<h3>Εισαγωγή: ${esc(file.name)}</h3><div id="pmsg" class="s">Άνοιγμα…</div><div class="prog"><i id="pbar"></i></div>`);
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
    const id = 'd' + Date.now();
    // outline -> flat tree with page numbers
    $('#pmsg').textContent = 'Περιεχόμενα…';
    const outline = unwrap(await resolveOutline(pdf, await pdf.getOutline() || []));
    // text for search
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const tc = await p.getTextContent();
      pages.push(tc.items.map(it => it.str).join(' ').replace(/\s+/g, ' '));
      p.cleanup();
      if (i % 5 === 0 || i === pdf.numPages) { $('#pbar').style.width = (i / pdf.numPages * 100) + '%'; $('#pmsg').textContent = `Ευρετήριο αναζήτησης: σελ. ${i} / ${pdf.numPages}`; await new Promise(r => setTimeout(r)); }
    }
    const guess = /(om|part)[\s_-]*a(?![a-z])/i.test(file.name) ? 'OM-A' : /(om|part)[\s_-]*b(?![a-z])/i.test(file.name) ? 'OM-B' : file.name.replace(/\.pdf$/i, '').slice(0, 12);
    const doc = { id, name: file.name.replace(/\.pdf$/i, ''), short: guess, pages: pdf.numPages, added: Date.now(), outline, last: 1 };
    await put('files', new Blob([buf], { type: 'application/pdf' }), id);
    await put('text', pages, id);
    await put('docs', doc);
    pdf.destroy();
    closeModal();
    await loadAll();
    renameDoc(doc, true);
  } catch (err) {
    console.error(err);
    card.innerHTML = `<h3>Σφάλμα</h3><p>Δεν μπόρεσα να ανοίξω το αρχείο.<br><small>${esc(err.message || err)}</small></p><div class="btns"><button class="ib" id="mok">OK</button></div>`;
    $('#mok').onclick = closeModal;
  }
}

// if bookmarks are wrapped in 1-3 outer folders (e.g. "OMA Rev 9.pdf"), lift the big folder's chapters to the top
function unwrap(o) {
  for (let n = 0; n < 3 && o.length && o.length <= 3; n++) {
    const big = o.reduce((a, b) => (b.kids.length > a.kids.length ? b : a));
    if (big.kids.length < 4) break;
    o = o.flatMap(x => x === big ? x.kids : [x]);
  }
  return o;
}
async function resolveOutline(pdf, items, depth = 0) {
  const out = [];
  for (const it of items) {
    let page = null;
    try {
      let dest = it.dest;
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (Array.isArray(dest) && dest[0]) page = (typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0])) + 1;
    } catch {}
    const kids = depth < 4 && it.items?.length ? await resolveOutline(pdf, it.items, depth + 1) : [];
    if (!page && kids.length) page = kids[0].page;
    out.push({ title: (it.title || '').trim().replace(/\.pdf$/i, '') || '—', page, kids });
  }
  return out;
}

function renameDoc(doc, isNew) {
  modal(`<h3>${isNew ? 'Ονομασία εγχειριδίου' : 'Επεξεργασία'}</h3>
    <label class="s">Σύντομο όνομα (π.χ. OM-A, OM-B)</label><input id="mShort" value="${esc(doc.short)}">
    <label class="s">Πλήρες όνομα</label><input id="mName" value="${esc(doc.name)}">
    <div class="btns">${isNew ? '' : '<button class="ib" id="mDel" style="color:var(--red)">Διαγραφή</button>'}<button class="ib" id="mCancel">Άκυρο</button><button class="ib acc" id="mSave">Αποθήκευση</button></div>`);
  $('#mCancel').onclick = closeModal;
  $('#mSave').onclick = async () => { doc.short = $('#mShort').value.trim() || doc.short; doc.name = $('#mName').value.trim() || doc.name; await put('docs', doc); closeModal(); await loadAll(); renderHome(); };
  if (!isNew) $('#mDel').onclick = async () => {
    if (!confirm(`Διαγραφή του ${doc.short} από αυτή τη συσκευή;`)) return;
    await del('docs', doc.id); await del('files', doc.id); await del('text', doc.id);
    for (const f of S.favs.filter(f => f.docId === doc.id)) await del('favs', f.id);
    delete S.text[doc.id]; closeModal(); await loadAll(); renderHome();
  };
}

/* ---------- data ---------- */
async function loadAll() {
  S.docs = (await all('docs')).sort((a, b) => a.short.localeCompare(b.short));
  S.favs = await all('favs');
}
async function textOf(id) { return S.text[id] ||= await get('text', id) || []; }

/* ---------- home ---------- */
function favChip(f) {
  const d = S.docs.find(x => x.id === f.docId);
  return `<button class="chip" data-fav="${f.id}"><b>${esc(d?.short || '')}</b>${esc(f.title)} <span class="s">σ.${f.page}</span></button>`;
}
function bindFavs(root) {
  root.querySelectorAll('[data-fav]').forEach(b => {
    const f = S.favs.find(x => x.id == b.dataset.fav);
    b.onclick = () => openReader(f.docId, f.page);
    let t; b.oncontextmenu = e => e.preventDefault();
    b.ontouchstart = () => t = setTimeout(() => editFav(f), 600);
    b.ontouchend = b.ontouchmove = () => clearTimeout(t);
  });
}
function renderHome() {
  show('home');
  const docs = $('#docs');
  if (!S.docs.length) {
    docs.outerHTML = `<div id="docs" class="empty"><div style="font-size:42px">📘</div><p>Δεν υπάρχει ακόμα εγχειρίδιο.<br>Πρόσθεσε το OM-A και το OM-B (PDF).</p><button class="ib acc" onclick="document.getElementById('fileIn').click()">＋ Προσθήκη PDF</button></div>`;
  } else {
    docs.outerHTML = `<div class="grid" id="docs">${S.docs.map(d => `
      <button class="tile doc" data-doc="${d.id}">
        <span class="more ib" data-edit="${d.id}" style="min-width:40px;height:40px;font-size:18px">⋯</span>
        <div><div class="big">${esc(d.short)}</div><div class="t">${esc(d.name)}</div></div>
        <div class="s">${d.pages} σελίδες · τελευταία: σελ. ${d.last || 1}</div>
      </button>`).join('')}</div>`;
    document.querySelectorAll('[data-doc]').forEach(b => b.onclick = e => {
      if (e.target.closest('[data-edit]')) { e.stopPropagation(); return renameDoc(S.docs.find(d => d.id === b.dataset.doc)); }
      openDoc(b.dataset.doc);
    });
  }
  $('#favWrap').classList.toggle('hidden', !S.favs.length);
  $('#favs').innerHTML = S.favs.map(favChip).join('');
  bindFavs($('#favs'));
  runSearch($('#qAll').value, null, $('#homeResults'), $('#homeMain'));
}

/* ---------- search ---------- */
async function search(q, docId) {
  const nq = norm(q.trim()); if (nq.length < 2) return [];
  const out = [];
  for (const d of S.docs.filter(d => !docId || d.id === docId)) {
    const pages = await textOf(d.id);
    for (let i = 0; i < pages.length; i++) {
      const raw = pages[i], n = norm(raw);
      let at = n.indexOf(nq), count = 0, first = at;
      while (at >= 0) { count++; at = n.indexOf(nq, at + nq.length); }
      if (count) out.push({ doc: d, page: i + 1, count, snip: snippet(raw, first, nq.length) });
    }
  }
  return out;
}
function snippet(raw, at, len) {
  // normalized string has the same length as raw except removed combining marks; NFC text keeps 1:1 mostly
  const a = Math.max(0, at - 70), b = Math.min(raw.length, at + len + 90);
  return (a ? '…' : '') + esc(raw.slice(a, at)) + '<mark>' + esc(raw.slice(at, at + len)) + '</mark>' + esc(raw.slice(at + len, b)) + (b < raw.length ? '…' : '');
}
async function runSearch(q, docId, box, main) {
  if (q.trim().length < 2) { box.innerHTML = ''; main.classList.remove('hidden'); return; }
  const res = await search(q, docId);
  main.classList.add('hidden');
  const total = res.reduce((s, r) => s + r.count, 0);
  box.innerHTML = `<h2>${res.length ? `${total} αποτελέσματα σε ${res.length} σελίδες` : 'Κανένα αποτέλεσμα'}</h2>` +
    res.slice(0, 300).map((r, i) => `<button class="res" data-i="${i}"><div class="h"><span><b>${esc(r.doc.short)}</b> · σελ. ${r.page}</span><span>${r.count}×</span></div><div class="x">${r.snip}</div></button>`).join('');
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    const r = res[b.dataset.i];
    const hits = res.filter(x => x.doc.id === r.doc.id).map(x => x.page);
    openReader(r.doc.id, r.page, { term: q.trim(), hits });
  });
}
$('#qAll').oninput = debounce(e => runSearch(e.target.value, null, $('#homeResults'), $('#homeMain')), 250);
$('#qDoc').oninput = debounce(e => runSearch(e.target.value, S.doc?.id, $('#docResults'), $('#docMain')), 250);

/* ---------- doc (chapters) ---------- */
function openDoc(id) {
  const d = S.docs.find(x => x.id === id); S.doc = d; S.hitTerm = '';
  show('doc');
  $('#docTitle').innerHTML = `${esc(d.short)}<small>${esc(d.name)}</small>`;
  $('#qDoc').value = ''; $('#docResults').innerHTML = ''; $('#docMain').classList.remove('hidden');
  $('#docContinue').textContent = `▶ σελ. ${d.last || 1}`;
  $('#docContinue').onclick = () => openReader(d.id, d.last || 1);
  const favs = S.favs.filter(f => f.docId === id);
  $('#docFavWrap').classList.toggle('hidden', !favs.length);
  $('#docFavs').innerHTML = favs.map(favChip).join(''); bindFavs($('#docFavs'));
  const ch = d.outline?.length ? d.outline : autoChapters(d);
  $('#chapters').innerHTML = ch.map((c, i) => `
    <button class="tile" data-ch="${i}"><span class="pg">σ.${c.page ?? '–'}</span>
      <div class="t" style="padding-right:56px">${esc(c.title)}</div>
      <div class="s">${c.kids?.length ? `${c.kids.length} ενότητες ›` : 'Άνοιγμα ›'}</div></button>`).join('');
  document.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => {
    const c = ch[b.dataset.ch];
    if (c.kids?.length) showSections(c); else openReader(d.id, c.page || 1);
  });
}
function autoChapters(d) { // no bookmarks in PDF: blocks of 20 pages
  const out = []; for (let p = 1; p <= d.pages; p += 20) out.push({ title: `Σελίδες ${p}–${Math.min(d.pages, p + 19)}`, page: p, kids: [] }); return out;
}
function showSections(c) {
  const card = modal(`<h3>${esc(c.title)}</h3><div style="max-height:60vh;overflow:auto">${treeHtml([{ ...c, kids: [] }, ...c.kids])}</div><div class="btns" style="margin-top:12px"><button class="ib" id="mCancel">Κλείσιμο</button></div>`);
  $('#mCancel').onclick = closeModal;
  bindTree(card, p => { closeModal(); openReader(S.doc.id, p); });
}
function treeHtml(list) {
  return list.map(c => `<button class="row" data-p="${c.page || 1}"><span>${esc(c.title)}</span><span>σ.${c.page ?? '–'}</span></button>${c.kids?.length ? `<div class="sub">${treeHtml(c.kids)}</div>` : ''}`).join('');
}
function bindTree(root, go) { root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => go(+b.dataset.p)); }
$('#docBack').onclick = () => { loadAll().then(renderHome); };

/* ---------- reader ---------- */
let io, renderQ = new Set(), rendered = new Map(), ratio = 1.414;
async function openReader(docId, page = 1, opts = {}) {
  const d = S.docs.find(x => x.id === docId);
  if (S.pdfId !== docId || !S.pdf) {
    S.pdf?.destroy(); S.pdf = null;
    const blob = await get('files', docId);
    S.pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    S.pdfId = docId;
  }
  S.doc = d; show('reader');
  $('#rdTitle').textContent = d.short;
  S.zoom = LS.get('zoom', 1);
  S.hitTerm = opts.term || ''; S.hits = opts.hits || []; S.hitIdx = Math.max(0, S.hits.indexOf(page));
  $('#hitBar').classList.toggle('hidden', !S.hitTerm);
  const p1 = await S.pdf.getPage(1); const vp = p1.getViewport({ scale: 1 }); ratio = vp.height / vp.width;
  buildPages(); updateHitBar();
  requestAnimationFrame(() => goPage(page));
  $('#tocList').innerHTML = d.outline?.length ? treeHtml(d.outline) : '<p class="s" style="padding:10px">Το PDF δεν έχει σελιδοδείκτες.</p>';
  bindTree($('#tocList'), p => { closeToc(); goPage(p); });
}
function pageWidth() { const w = $('#pages').clientWidth; return Math.round(Math.min(w - 24, 1000) * S.zoom); }
function buildPages() {
  const box = $('#pages'); box.innerHTML = ''; rendered.clear(); io?.disconnect();
  const w = pageWidth(), h = Math.round(w * ratio);
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= S.pdf.numPages; i++) {
    const el = document.createElement('div'); el.className = 'page'; el.dataset.p = i;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.innerHTML = `<span class="no">${i}</span>`; frag.append(el);
  }
  box.append(frag);
  io = new IntersectionObserver(ents => {
    for (const e of ents) { const p = +e.target.dataset.p; if (e.isIntersecting) renderPage(p, e.target); else unrender(p, e.target); }
  }, { root: box, rootMargin: '1200px 0px' });
  box.querySelectorAll('.page').forEach(el => io.observe(el));
}
async function renderPage(n, el) {
  if (rendered.has(n) || renderQ.has(n)) return; renderQ.add(n);
  try {
    const page = await S.pdf.getPage(n);
    const w = pageWidth(); const base = page.getViewport({ scale: 1 });
    const scale = w / base.width; const vp = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const c = document.createElement('canvas'); c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
    el.style.height = Math.round(vp.height) + 'px';
    await page.render({ canvasContext: c.getContext('2d'), viewport: page.getViewport({ scale: scale * dpr }) }).promise;
    if (!renderQ.has(n)) return; // was cancelled
    el.querySelector('canvas')?.remove(); el.prepend(c);
    rendered.set(n, true);
    if (S.hitTerm) highlight(page, vp, el);
  } catch (e) { console.warn(e); } finally { renderQ.delete(n); }
}
function unrender(n, el) { renderQ.delete(n); if (!rendered.has(n)) return; el.querySelector('canvas')?.remove(); el.querySelectorAll('.hl').forEach(x => x.remove()); rendered.delete(n); }
const mctx = document.createElement('canvas').getContext('2d'); mctx.font = '100px Helvetica, Arial, sans-serif';
const mw = t => mctx.measureText(t).width || 1;
async function highlight(page, vp, el) {
  const nq = norm(S.hitTerm); const tc = await page.getTextContent();
  for (const it of tc.items) {
    const ns = norm(it.str); let at = ns.indexOf(nq); if (at < 0 || !it.str.length) continue;
    const [a, b, , d, e, f] = it.transform; const fh = Math.hypot(b, d) || it.height;
    while (at >= 0) {
      const W = mw(it.str), x0 = e + it.width * (mw(it.str.slice(0, at)) / W), x1 = e + it.width * (mw(it.str.slice(0, at + nq.length)) / W);
      const r = vp.convertToViewportRectangle([x0, f - fh * 0.2, x1, f + fh * 0.95]);
      const hl = document.createElement('div'); hl.className = 'hl';
      Object.assign(hl.style, { left: Math.min(r[0], r[2]) + 'px', top: Math.min(r[1], r[3]) + 'px', width: Math.abs(r[2] - r[0]) + 'px', height: Math.abs(r[3] - r[1]) + 'px' });
      el.append(hl); at = ns.indexOf(nq, at + nq.length);
    }
  }
}
function goPage(p) {
  p = Math.max(1, Math.min(S.pdf.numPages, p));
  const el = $(`#pages .page[data-p="${p}"]`); if (el) $('#pages').scrollTop = el.offsetTop - 12;
  setCur(p);
}
function setCur(p) {
  S.cur = p; $('#pageInd').textContent = `${p} / ${S.pdf.numPages}`;
  const fav = S.favs.find(f => f.docId === S.doc.id && f.page === p);
  $('#favBtn').textContent = fav ? '★' : '☆'; $('#favBtn').classList.toggle('on', !!fav);
}
const saveLast = debounce(async () => { if (S.doc) { S.doc.last = S.cur; await put('docs', S.doc); } }, 800);
$('#pages').addEventListener('scroll', () => {
  const box = $('#pages'), y = box.scrollTop + box.clientHeight * 0.35, els = box.children;
  let lo = 0, hi = els.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (els[m].offsetTop <= y) lo = m; else hi = m - 1; }
  const p = lo + 1; if (p !== S.cur) { setCur(p); saveLast(); }
}, { passive: true });

$('#rdBack').onclick = async () => { S.doc.last = S.cur; await put('docs', S.doc); await loadAll(); S.hitTerm = ''; openDoc(S.doc.id); };
$('#pageInd').onclick = () => {
  modal(`<h3>Μετάβαση σε σελίδα</h3><input id="mPg" type="number" inputmode="numeric" min="1" max="${S.pdf.numPages}" value="${S.cur}"><div class="btns"><button class="ib" id="mCancel">Άκυρο</button><button class="ib acc" id="mGo">Μετάβαση</button></div>`);
  const i = $('#mPg'); i.focus(); i.select();
  const go = () => { const v = +i.value; closeModal(); if (v) goPage(v); };
  $('#mGo').onclick = go; i.onkeydown = e => e.key === 'Enter' && go(); $('#mCancel').onclick = closeModal;
};
function setZoom(z) { const keep = S.cur; S.zoom = Math.max(0.6, Math.min(3, z)); LS.set('zoom', S.zoom); buildPages(); requestAnimationFrame(() => goPage(keep)); }
$('#zoomIn').onclick = () => setZoom(S.zoom + 0.25);
$('#zoomOut').onclick = () => setZoom(S.zoom - 0.25);
let rz; window.addEventListener('resize', () => { if ($('#reader').classList.contains('hidden')) return; clearTimeout(rz); rz = setTimeout(() => setZoom(S.zoom), 300); });

/* favourites */
$('#favBtn').onclick = async () => {
  const ex = S.favs.find(f => f.docId === S.doc.id && f.page === S.cur);
  if (ex) { await del('favs', ex.id); await loadAll(); setCur(S.cur); return toast('Αφαιρέθηκε από τα αγαπημένα'); }
  modal(`<h3>★ Νέο αγαπημένο</h3><label class="s">${esc(S.doc.short)} · σελίδα ${S.cur}</label><input id="mFav" placeholder="π.χ. Crosswind limits" value="${esc(sectionTitle(S.cur))}"><div class="btns"><button class="ib" id="mCancel">Άκυρο</button><button class="ib acc" id="mSave">Αποθήκευση</button></div>`);
  const i = $('#mFav'); i.focus(); i.select(); $('#mCancel').onclick = closeModal;
  $('#mSave').onclick = async () => { await put('favs', { docId: S.doc.id, page: S.cur, title: i.value.trim() || `Σελ. ${S.cur}` }); closeModal(); await loadAll(); setCur(S.cur); toast('Αποθηκεύτηκε ★'); };
};
function sectionTitle(p) { // deepest outline entry starting at or before p
  let best = ''; const walk = l => { for (const c of l) { if (c.page && c.page <= p) best = c.title; if (c.kids) walk(c.kids); } };
  walk(S.doc.outline || []); return best;
}
function editFav(f) {
  modal(`<h3>Αγαπημένο</h3><input id="mFav" value="${esc(f.title)}"><div class="btns"><button class="ib" id="mDel" style="color:var(--red)">Διαγραφή</button><button class="ib" id="mCancel">Άκυρο</button><button class="ib acc" id="mSave">Αποθήκευση</button></div>`);
  $('#mCancel').onclick = closeModal;
  $('#mDel').onclick = async () => { await del('favs', f.id); closeModal(); await loadAll(); refreshCurrent(); };
  $('#mSave').onclick = async () => { f.title = $('#mFav').value.trim() || f.title; await put('favs', f); closeModal(); await loadAll(); refreshCurrent(); };
}
function refreshCurrent() { if (!$('#doc').classList.contains('hidden')) openDoc(S.doc.id); else renderHome(); }

/* search hits navigation */
function updateHitBar() { if (!S.hitTerm) return; $('#hitLbl').textContent = `«${S.hitTerm}» · ${S.hitIdx + 1}/${S.hits.length}`; }
$('#hitPrev').onclick = () => { if (!S.hits.length) return; S.hitIdx = (S.hitIdx - 1 + S.hits.length) % S.hits.length; updateHitBar(); goPage(S.hits[S.hitIdx]); };
$('#hitNext').onclick = () => { if (!S.hits.length) return; S.hitIdx = (S.hitIdx + 1) % S.hits.length; updateHitBar(); goPage(S.hits[S.hitIdx]); };
$('#hitClose').onclick = () => { S.hitTerm = ''; $('#hitBar').classList.add('hidden'); document.querySelectorAll('.hl').forEach(x => x.remove()); };

/* table of contents drawer */
const closeToc = () => { $('#drawer').classList.remove('open'); $('#shade').classList.add('hidden'); };
$('#tocBtn').onclick = () => { $('#drawer').classList.add('open'); $('#shade').classList.remove('hidden'); };
$('#tocClose').onclick = $('#shade').onclick = closeToc;

/* ---------- start ---------- */
(async () => {
  try { navigator.storage?.persist?.(); } catch {}
  await loadAll(); renderHome();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

/* ---------- rest calculator (OM-A 7.2.4) ---------- */
const hm = m => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const pad = n => String(n).padStart(2, '0');
const fmtDT = d => `${['Κυρ','Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ'][d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toLocalInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const segVal = id => $(`#${id} .sel`).dataset.v;
document.querySelectorAll('#rest .seg').forEach(g => g.onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  g.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); calcRest();
});
$('#restBtn').onclick = () => {
  const saved = LS.get('rest', null);
  if (saved) { $('#rOn').value = saved.on; $('#rOff').value = saved.off; }
  else { const n = new Date(); n.setMinutes(0, 0, 0); $('#rOff').value = toLocalInput(n); n.setHours(n.getHours() - 10); $('#rOn').value = toLocalInput(n); }
  show('rest'); calcRest();
};
$('#restBack').onclick = () => renderHome();
$('#rOn').oninput = $('#rOff').oninput = () => calcRest();
function calcRest() {
  const on = new Date($('#rOn').value), off = new Date($('#rOff').value);
  if (isNaN(on) || isNaN(off) || off <= on) { $('#rOut').innerHTML = '<p class="s" style="margin:18px 4px">Βάλε duty on και duty off (το off μετά το on).</p>'; return; }
  LS.set('rest', { on: $('#rOn').value, off: $('#rOff').value });
  const duty = (off - on) / 60000;                       // minutes
  const home = segVal('rBase') === 'home';
  const floor = (home ? 12 : 10) * 60;
  const base = Math.max(duty, floor);
  const tz = [0, 1, 2, 3][+segVal('rTz')] * 60;
  const ext = +segVal('rExt') * 60;
  const total = base + tz + ext;
  const next = new Date(off.getTime() + total * 60000);
  const rows = [
    ['Προηγούμενο duty period', hm(duty)],
    [`Ελάχιστο ${home ? 'στη βάση' : 'εκτός βάσης'}`, hm(floor)],
    ['Βάση rest (το μεγαλύτερο)', hm(base)],
    tz ? ['+ ζώνες ώρας (7.2.4.3.1)', '+' + hm(tz)] : null,
    ext ? ['+ planned extension (7.2.2.3.1)', '+' + hm(ext)] : null,
  ].filter(Boolean);
  $('#rOut').innerHTML = `
    <h2>Αποτέλεσμα</h2>
    <div class="tile" style="min-height:0">
      <div class="s">Minimum rest</div><div class="big2">${hm(total)}</div>
      <div class="s" style="margin-top:6px">Νωρίτερο επόμενο report</div><div class="big2" style="font-size:32px">${fmtDT(next)}</div>
      <div style="margin-top:8px">${rows.map(r => `<div class="kv"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('')}</div>
      <div class="s" style="margin-top:10px">Πρέπει επίσης να μένουν 8 ώρες συνεχόμενου ύπνου, χωρίς τη μετακίνηση και τα γεύματα.</div>
    </div>`;
}
