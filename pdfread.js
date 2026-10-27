/* Ανάγνωση στοιχείων υποψηφίου από ψηφιακό (όχι φωτογραφημένο) έντυπο ΑΠΑ — ενότητα «PERSONAL DETAILS».
   Δουλεύει με τις θέσεις των λέξεων: κάθε τιμή είναι γραμμένη πάνω στη γραμμή με τις τελίτσες της ετικέτας της. */
(function (root) {
  let lib = null;
  function load() {
    if (lib) return Promise.resolve(lib);
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'pdf.min.js';
      s.onload = () => { lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js'; res(lib); };
      s.onerror = () => rej(new Error('pdf.js')); document.head.appendChild(s);
    });
  }
  const KEYS = [['surname', /\bSurname\b/i], ['first', /\bFirst\s+Name/i], ['title', /\bTitle\b/i], ['dob', /Date\s+of\s+Birth/i],
    ['nationality', /\bNationality\b/i], ['pobTown', /Place\s+of\s+Birth/i], ['pobCountry', /\(Country\)/i], ['address', /\bPermanent\b/i],
    ['postcode', /\bPost\s*code\b/i], ['tel', /\bContact\s+Tel/i], ['mobile', /\bMobile\s+Tel/i], ['email', /\bE-?mail\b/i], ['fax', /\bFax\b/i]];
  /* λέξεις των ετικετών (όταν μια ετικέτα είναι σπασμένη σε κομμάτια) */
  const LW = new Set('surname first name name(s) names title (mr / mrs ms etc) etc date of birth birth: (dd/mm/yyyy) nationality place (town) (country) country town permanent address postcode post code contact tel tel. no no. mobile e-mail email fax number'.split(' '));
  const isLabel = s => { if (/\.{4,}/.test(s) || KEYS.some(k => k[1].test(s))) return true;
    const t = s.toLowerCase().split(/\s+/).filter(Boolean); return t.length > 1 ? t.every(w => LW.has(w)) : LW.has(t[0]) && !/^(mrs|ms)$/.test(t[0]); };

  async function personal(bytes) {
    const pdfjs = await load();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice ? bytes.slice(0) : bytes) }).promise;
    for (let pn = 1; pn <= Math.min(doc.numPages, 3); pn++) {
      const pg = await doc.getPage(pn), H = pg.view[3], tc = await pg.getTextContent();
      const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ x: it.transform[4], y: H - it.transform[5], w: it.width, s: it.str }));
      const anchors = [];
      for (const it of items) for (const [k, re] of KEYS) { const m = re.exec(it.s); if (m) anchors.push({ k, y: it.y, x: it.x + it.w * m.index / it.s.length }); }
      if (!anchors.some(a => a.k === 'surname')) continue;
      const top = Math.min(...anchors.filter(a => a.k === 'surname').map(a => a.y)) - 20, bot = Math.max(...anchors.map(a => a.y)) + 2;
      const out = {}, add = (k, v, x) => { (out[k] = out[k] || []).push({ v, x }); };
      for (const it of items) {
        if (isLabel(it.s) || it.y < top || it.y > bot) continue;
        /* η γραμμή-ετικέτα αμέσως από κάτω (ή η ίδια) */
        const rows = anchors.filter(a => a.y - it.y >= -2 && a.y - it.y <= 14); if (!rows.length) continue;
        const ry = Math.min(...rows.map(a => a.y)), row = rows.filter(a => Math.abs(a.y - ry) < 3).sort((a, b) => a.x - b.x);
        let f = null; for (const a of row) if (a.x <= it.x + 6) f = a.k;
        if (!f) f = row.some(a => a.k === 'postcode') ? 'address' : row[0].k; /* γραμμή διεύθυνσης χωρίς ετικέτα αριστερά */
        add(f, it.s.trim(), it.x);
      }
      const j = k => (out[k] || []).sort((a, b) => a.x - b.x).map(o => o.v).join(' ').replace(/\s+/g, ' ').trim();
      const r = {};
      ['surname', 'first', 'title', 'nationality', 'pobTown', 'pobCountry', 'tel', 'mobile', 'postcode'].forEach(k => { const v = j(k); if (v) r[k] = v; });
      if (r.title && /\s/.test(r.title)) delete r.title; /* λευκό έντυπο: «Mrs Ms» της ετικέτας */
      const em = j('email').replace(/\s+/g, ''); if (/@/.test(em)) r.email = em;
      const d = /(\d{1,2})\D+(\d{1,2})\D+(\d{4})/.exec(j('dob')); if (d) r.dob = d[3] + '-' + d[2].padStart(2, '0') + '-' + d[1].padStart(2, '0');
      const ad = j('address'); if (ad) { const i = ad.lastIndexOf(','); if (i > 0 && i < ad.length - 1) { r.address = ad.slice(0, i).trim(); r.city = ad.slice(i + 1).trim(); } else r.address = ad; }
      if (r.postcode) r.postcode = r.postcode.replace(/\s+/g, '');
      return r;
    }
    return {};
  }
  root.PELREAD = { personal };
})(window);
