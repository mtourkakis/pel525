/* Κοινά έγγραφα για επισύναψη (πτυχίο, medical, examiner, τιμολόγια) — αποθήκευση στο IndexedDB της συσκευής */
(function (root) {
  const DB = 'pel_files', ST = 'f';
  let _db = null;
  function db() {
    if (_db) return _db;
    _db = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => res(r.result);
      r.onerror = () => { _db = null; rej(r.error); };
    });
    return _db;
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(ST, mode); const s = t.objectStore(ST); let out;
      const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  const put = (k, v) => tx('readwrite', s => s.put(v, k));
  const get = k => tx('readonly', s => s.get(k)).catch(() => undefined);
  const del = k => tx('readwrite', s => s.delete(k));

  const MY = [['lic', 'Πτυχίο (άδεια)'], ['med', 'Medical'], ['exm', 'Examiner certificate']];

  function kindOf(name, type) {
    if (/pdf/i.test(type || '') || /\.pdf$/i.test(name || '')) return 'pdf';
    return 'img';
  }
  async function saveFile(key, file) {
    const bytes = await file.arrayBuffer();
    await put(key, { name: file.name, type: file.type || '', kind: kindOf(file.name, file.type), bytes, added: Date.now() });
  }
  async function status() {
    const out = [];
    for (const [k, l] of MY) { const r = await get('doc:' + k); out.push({ k, l, name: r && r.name, size: r && r.bytes ? r.bytes.byteLength : 0 }); }
    return out;
  }
  /* εικόνα (jpg/png/heic κ.λπ.) → JPEG μέσω canvas, ώστε να μπαίνει πάντα στο PDF */
  function toJpeg(bytes, type) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: type || 'image/jpeg' }));
      const im = new Image();
      im.onload = () => {
        const max = 2400, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? b.arrayBuffer().then(res) : rej(new Error('jpeg')), 'image/jpeg', 0.85);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Η εικόνα δεν διαβάζεται')); };
      im.src = url;
    });
  }
  /* προσθέτει στο τέλος του PDF τα έγγραφα των keys · επιστρέφει { bytes, missing } */
  async function append(PDFLib, pdfBytes, keys) {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(pdfBytes);
    const missing = [];
    const recs = [];
    for (const key of keys) { const r = await get(key); if (r && r.files) r.files.forEach(f => recs.push([key, f])); else recs.push([key, r]); }
    for (const [key, r] of recs) {
      if (!r || !r.bytes) { if (!(key.startsWith('cand:'))) missing.push(key); continue; }
      try {
        if (r.kind === 'pdf') {
          const src = await PDFDocument.load(r.bytes, { ignoreEncryption: true });
          (await doc.copyPages(src, src.getPageIndices())).forEach(p => doc.addPage(p));
        } else {
          let img;
          if (/png/i.test(r.type)) { try { img = await doc.embedPng(r.bytes); } catch (e) { img = null; } }
          else if (/jpe?g/i.test(r.type)) { try { img = await doc.embedJpg(r.bytes); } catch (e) { img = null; } }
          if (!img) img = await doc.embedJpg(await toJpeg(r.bytes, r.type));
          const land = img.width > img.height;
          const W = land ? 842 : 595, H = land ? 595 : 842, m = 24;
          const s = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height);
          const pg = doc.addPage([W, H]);
          pg.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
        }
      } catch (e) { missing.push(key); }
    }
    return { bytes: await doc.save(), missing };
  }
  /* σκαναρισμένο έντυπο εταιρείας: οι σελίδες του μπαίνουν στη θέση των αντίστοιχων σελίδων της φόρμας
     και από πάνω μπαίνουν ΜΟΝΟ τα δικά μου (overlay). Οι υπόλοιπες σελίδες έρχονται από την εφαρμογή. */
  async function scanCount(PDFLib, key) {
    const r = await get(key); if (!r || !r.files) return 0; let n = 0;
    for (const f of r.files) { if (f.kind === 'pdf') { try { n += (await PDFLib.PDFDocument.load(f.bytes, { ignoreEncryption: true })).getPageCount(); } catch (e) { } } else n++; }
    return n;
  }
  /* JPEG της σελίδας ενός σκαναρισμένου PDF (iPhone: μία εικόνα ανά σελίδα) */
  function pageJpeg(PDFLib, d, i) {
    try {
      const { PDFName } = PDFLib; const p = d.getPage(i); const res = p.node.Resources(); const xo = res.lookup(PDFName.of('XObject'));
      if (!xo || xo.keys().length !== 1) return null;
      /* ψηφιακό PDF (με κείμενο) δεν είναι φωτογραφία σελίδας — π.χ. η μόνη εικόνα είναι το λογότυπο */
      const fo = res.lookup(PDFName.of('Font')); if (fo && fo.keys && fo.keys().length) return null;
      const st = d.context.lookup(xo.get(xo.keys()[0]));
      if (!st || !st.dict || String(st.dict.get(PDFName.of('Filter'))) !== '/DCTDecode' || !st.contents) return null;
      /* η εικόνα πρέπει να έχει αναλογίες σελίδας (όχι λογότυπο / μικρή εικόνα) */
      const iw = +String(st.dict.get(PDFName.of('Width'))), ih = +String(st.dict.get(PDFName.of('Height')));
      const { width: pw, height: ph } = p.getSize();
      if (!(iw > 0 && ih > 0) || Math.abs((iw / ih) / (pw / ph) - 1) > 0.15) return null;
      return st.contents;
    } catch (e) { return null; }
  }
  /* περίγραμμα περιεχομένου (κλάσματα 0..1, πάνω-αριστερά) — ίδιος αλγόριθμος με τα πρότυπα */
  function bboxOf(bytes, type) {
    return new Promise(res => {
      const url = URL.createObjectURL(new Blob([bytes], { type: type || 'image/jpeg' })); const im = new Image();
      im.onload = () => {
        const w = 500, h = Math.round(500 * im.naturalHeight / im.naturalWidth); const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url);
        const px = g.getImageData(0, 0, w, h).data; const cc = new Uint32Array(w), rc = new Uint32Array(h); const m = Math.floor(0.01 * w), n = Math.floor(0.01 * h);
        for (let y = n; y < h - n; y++) for (let x = m; x < w - m; x++) { const k = (y * w + x) * 4; if (0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2] < 150) { cc[x]++; rc[y]++; } }
        let x0 = -1, x1 = -1, y0 = -1, y1 = -1;
        for (let x = 0; x < w; x++) if (cc[x] >= 0.02 * h) { if (x0 < 0) x0 = x; x1 = x + 1; }
        for (let y = 0; y < h; y++) if (rc[y] >= 0.02 * w) { if (y0 < 0) y0 = y; y1 = y + 1; }
        res(x0 < 0 || y0 < 0 ? null : [x0 / w, y0 / h, x1 / w, y1 / h]);
      };
      im.onerror = () => { URL.revokeObjectURL(url); res(null); }; im.src = url;
    });
  }
  async function compose(PDFLib, fullBytes, overlayBytes, key, tplBox) {
    const { PDFDocument } = PDFLib;
    const r = await get(key); if (!r || !r.files || !r.files.length) return fullBytes;
    const full = await PDFDocument.load(fullBytes), ov = await PDFDocument.load(overlayBytes), out = await PDFDocument.create();
    const N = full.getPageCount();
    /* σελίδες σκαναρίσματος με τη σειρά: εικόνα (με περίγραμμα για ευθυγράμμιση) ή σελίδα PDF */
    const src = [];
    const addImg = async (bytes, type) => { let img = null; try { img = /png/i.test(type) ? await out.embedPng(bytes) : /jpe?g/i.test(type) ? await out.embedJpg(bytes) : null; } catch (e) { img = null; }
      if (!img) { bytes = await toJpeg(bytes, type); type = 'image/jpeg'; img = await out.embedJpg(bytes); } src.push({ img, bb: await bboxOf(bytes, type) }); };
    for (const f of r.files) {
      if (f.kind === 'pdf') { const d = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        for (let i = 0; i < d.getPageCount(); i++) { const j = pageJpeg(PDFLib, d, i); if (j) await addImg(j, 'image/jpeg'); else { const [ep] = await out.embedPdf(d, [i]); src.push({ ep }); } } }
      else await addImg(f.bytes, f.type);
    }
    const fullCopies = await out.copyPages(full, full.getPageIndices());
    const ovEmb = [];
    for (let i = 0; i < Math.min(src.length, N, ov.getPageCount()); i++) { const op = ov.getPage(i); ovEmb.push(op.node.Contents() ? await out.embedPage(op) : null); } /* κενή σελίδα overlay = τίποτα δικό μου εκεί */
    for (let i = 0; i < N; i++) {
      if (i < src.length) {
        const fp = full.getPage(i), W = fp.getWidth(), H = fp.getHeight(); const pg = out.addPage([W, H]);
        /* σχεδόν A4 → τεντώνεται σε όλη τη σελίδα· αλλιώς χωράει χωρίς παραμόρφωση */
        const o = src[i].ep || src[i].img, sw = o.width, sh = o.height, fit = Math.abs((sw / sh) / (W / H) - 1) > 0.04;
        let box = { x: 0, y: 0, width: W, height: H };
        if (fit) { const k = Math.min(W / sw, H / sh); box = { x: (W - sw * k) / 2, y: (H - sh * k) / 2, width: sw * k, height: sh * k }; }
        if (src[i].ep) pg.drawPage(src[i].ep, box); else pg.drawImage(src[i].img, box);
        if (ovEmb[i]) {
          /* ευθυγράμμιση: το περίγραμμα του προτύπου πάνω στο περίγραμμα του σκαναρίσματος */
          let T = { x: 0, y: 0, width: W, height: H }; const tb = tplBox && tplBox[String(i + 1)], sb = src[i].bb;
          if (tb && sb) {
            const sx0 = box.x + sb[0] * box.width, sx1 = box.x + sb[2] * box.width, st0 = (H - box.y - box.height) + sb[1] * box.height, st1 = (H - box.y - box.height) + sb[3] * box.height;
            const tx0 = tb[0] * W, tx1 = tb[2] * W, tt0 = tb[1] * H, tt1 = tb[3] * H;
            const kx = (sx1 - sx0) / (tx1 - tx0), ky = (st1 - st0) / (tt1 - tt0);
            if (kx > 0.85 && kx < 1.15 && ky > 0.85 && ky < 1.15) T = { x: sx0 - tx0 * kx, y: H - st0 - (H - tt0) * ky, width: W * kx, height: H * ky };
          }
          pg.drawPage(ovEmb[i], T);
        }
      } else out.addPage(fullCopies[i]);
    }
    return await out.save();
  }
  /* τιμολόγια: το Γραφείο κρατάει κάθε PDF τιμολογίου μαζί με τις εξετάσεις που περιέχει */
  async function saveInvoice(no, entries, bytes, date) {
    await put('inv:' + no, { name: 'Invoice ' + no + '.pdf', type: 'application/pdf', kind: 'pdf', bytes: bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes, added: Date.now() });
    const idx = ((await get('invindex')) || []).filter(x => x.no !== no);
    idx.push({ no, entries: entries || [], date: date || '' });
    await put('invindex', idx);
  }
  async function dropInvoice(no) { await del('inv:' + no); const idx = ((await get('invindex')) || []).filter(x => x.no !== no); await put('invindex', idx); }
  async function findInvoice(logIds) {
    const ids = [].concat(logIds); const idx = (await get('invindex')) || [];
    const m = idx.filter(x => (x.entries || []).some(e => ids.includes(e))).pop();
    return m ? { key: 'inv:' + m.no, no: m.no } : null;
  }
  /* συνημμένα ανά υποψήφιο (π.χ. Notification of Test email, FSTD certificate) */
  async function candFiles(key) { const r = await get(key); return (r && r.files) || []; }
  async function addCandFiles(key, fileList) {
    const files = await candFiles(key);
    for (const f of Array.from(fileList)) files.push({ name: f.name, type: f.type || '', kind: kindOf(f.name, f.type), bytes: await f.arrayBuffer(), added: Date.now() });
    await put(key, { files });
  }
  async function removeCandFile(key, i) { const files = await candFiles(key); files.splice(i, 1); if (files.length) await put(key, { files }); else await del(key); }
  const LABEL = { 'doc:lic': 'Πτυχίο', 'doc:med': 'Medical', 'doc:exm': 'Examiner' };
  const label = k => LABEL[k] || (k.startsWith('inv:') ? 'Τιμολόγιο ' + k.slice(4) : k);

  /* αρχείο: κάθε PDF που βγαίνει (525 / φόρμες) κρατιέται εδώ. Ίδιο αρχείο ξανά = αντικαθίσταται η παλιά έκδοση */
  async function saveOut(logId, name, bytes, meta) {
    let key = (meta && meta.key) || ('out:' + logId + '|' + name);
    /* το υπογεγραμμένο δεν σβήνεται ποτέ από νέα έκδοση: η νέα μπαίνει δίπλα */
    if (((await get('outindex')) || []).some(x => x.key === key && x.signed)) key += '|' + Date.now();
    const ab = bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
    await put(key, { name, type: 'application/pdf', kind: 'pdf', bytes: ab, added: Date.now() });
    const idx = ((await get('outindex')) || []).filter(x => x.key !== key);
    idx.push(Object.assign({ key, logId, name, saved: Date.now(), size: ab.byteLength }, meta || {}));
    await put('outindex', idx);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  }
  /* φωτογραφίες / σκαναρίσματα / PDF → ένα PDF (όλες οι σελίδες με τη σειρά) */
  async function filesToPdf(PDFLib, fileList) {
    const { PDFDocument } = PDFLib; const doc = await PDFDocument.create();
    for (const f of Array.from(fileList)) {
      const b = await f.arrayBuffer();
      if (kindOf(f.name, f.type) === 'pdf') { const d = await PDFDocument.load(b, { ignoreEncryption: true }); (await doc.copyPages(d, d.getPageIndices())).forEach(p => doc.addPage(p)); continue; }
      const im = await doc.embedJpg(await toJpeg(b, f.type));
      const land = im.width > im.height, W = land ? 842 : 595, H = land ? 595 : 842, k = Math.min((W - 24) / im.width, (H - 24) / im.height);
      const pg = doc.addPage([W, H]); pg.drawImage(im, { x: (W - im.width * k) / 2, y: (H - im.height * k) / 2, width: im.width * k, height: im.height * k });
    }
    return await doc.save();
  }
  async function addUpload(PDFLib, fileList, o) {
    const bytes = await filesToPdf(PDFLib, fileList); const id = Math.random().toString(36).slice(2, 8);
    const name = ((o.title || 'Document') + (o.cand ? '_' + o.cand : '')).replace(/[^A-Za-z0-9Α-Ωα-ωΆ-ώ]+/g, '_').replace(/^_|_$/g, '') + '.pdf';
    await saveOut(o.logId || ('up|' + id), name, bytes, { key: 'out:up|' + id, up: true, label: o.title || '', cand: o.cand || '', date: o.date || '' });
  }
  /* αντικατάσταση αποθηκευμένου PDF (π.χ. με το υπογεγραμμένο από τον υποψήφιο) — ίδιο κλειδί, ίδιο όνομα */
  async function replaceOut(PDFLib, key, fileList) {
    const bytes = await filesToPdf(PDFLib, fileList); const old = (await get(key)) || {};
    const ab = bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
    await put(key, { name: old.name || 'document.pdf', type: 'application/pdf', kind: 'pdf', bytes: ab, added: Date.now() });
    const idx = (await get('outindex')) || []; const x = idx.find(y => y.key === key); if (x) { x.size = ab.byteLength; x.saved = Date.now(); x.signed = true; }
    await put('outindex', idx);
  }
  async function listOut() { return (await get('outindex')) || []; }
  async function dropOut(key) { await del(key); await put('outindex', ((await get('outindex')) || []).filter(x => x.key !== key)); }
  async function invList() { return (await get('invindex')) || []; }
  /* λίστα τιμολογίων για επιλογή επισύναψης: αριθμός · πελάτης · ποσό · ημερομηνία (νεότερα πρώτα) */
  async function invOptions() {
    let O = {}; try { O = JSON.parse(localStorage.getItem('pel_office_v1')) || {}; } catch (e) { }
    const inv = O.invoices || [], cl = O.clients || [];
    const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
    const idx = (await get('invindex')) || [], has = new Set(idx.map(x => x.no));
    /* όλα τα τιμολόγια του Γραφείου — και όσα δεν έχουν ακόμα αποθηκευμένο PDF */
    const all = idx.map(x => ({ no: x.no, date: x.date })).concat(inv.filter(v => v.no && !has.has(v.no)).map(v => ({ no: v.no, date: v.date })));
    return all.map(x => { const i = inv.find(v => v.no === x.no) || {};
      const who = i.client === '__self' ? (i.clientLines || '').split('\n')[0] : (i.clientName || (cl.find(c => c.id === i.client) || {}).name || '');
      const tot = (i.lines || []).reduce((a, l) => { const f = num(l.fee), q = num(l.qty); return a + (f == null ? 0 : q != null ? q * f : f); }, 0);
      const d = x.date || i.date || '';
      return { no: x.no, date: d, hasPdf: has.has(x.no), label: x.no + (who ? ' · ' + who : '') + (tot ? ' · €' + tot.toFixed(2).replace('.', ',') : '') + (d ? ' · ' + d.split('-').reverse().join('/') : '') + (has.has(x.no) ? '' : ' · ⚠️ χωρίς PDF') }; })
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (parseInt(b.no) - parseInt(a.no)));
  }
  async function hasInvoicePdf(no) { return !!(await get('inv:' + no)); }
  root.PELDOCS = { MY, saveFile, get, del, put, status, append, saveInvoice, dropInvoice, findInvoice, label, candFiles, addCandFiles, removeCandFile, compose, scanCount, saveOut, listOut, dropOut, invList, addUpload, replaceOut, invOptions, hasInvoicePdf };
})(typeof window !== 'undefined' ? window : globalThis);
