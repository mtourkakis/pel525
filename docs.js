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

  root.PELDOCS = { MY, saveFile, get, del, put, status, append, saveInvoice, dropInvoice, findInvoice, label, candFiles, addCandFiles, removeCandFile };
})(typeof window !== 'undefined' ? window : globalThis);
