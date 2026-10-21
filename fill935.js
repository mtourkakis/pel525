/* PEL-FCL 935 (Rev. 3, 04/11/2024) – εκπαιδευτές: FI / IRI / TRI. Fill engine (pdf-lib), browser & node. */
(function (root) {
  /* σελίδες του 935.pdf (μόνο όσες χρειάζονται) → θέση στο αρχείο */
  const SRC = [49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 61, 71, 73, 92, 93, 94, 95, 96, 97, 98, 99, 100];
  const IX = {}; SRC.forEach((n, i) => IX[n] = i);

  const KINDS = {
    FI: { label: 'FI(A)', aoc: 'fi' },
    IRI: { label: 'IRI(A)', aoc: 'fi' },
    TRI: { label: 'TRI(A)', aoc: 'tri' }
  };
  const APPS = { issue: 'Initial issue', reval: 'Revalidation', renew: 'Renewal', ext: 'Extension of privileges' };

  /* Page Submission Table 1 (σελ. 5) */
  function pagesFor(c) {
    const k = c.kind, a = c.app, aoc = aocOn(c);
    const FIA = [92, 93, 94, 95], TRA = [96, 97, 98];
    let p;
    if (k === 'FI') p = a === 'issue' ? [49, 50, 51, 52, ...FIA, 100] : a === 'reval' ? [49, 50, 56, ...(aoc ? FIA : []), 100] : a === 'renew' ? [49, 50, 57, ...FIA, 100] : [49, 50, 53, 54, 55, ...(aoc ? FIA : []), 100];
    else if (k === 'IRI') p = a === 'issue' ? [49, 50, 51, 71, ...FIA, 99, 100] : a === 'reval' ? [49, 50, 73, ...(aoc ? FIA : []), 100] : [49, 50, 73, ...FIA, 100];
    else p = a === 'issue' ? [49, 50, 51, 58, 59, ...TRA, 100] : a === 'reval' ? [49, 50, 61, ...(aoc ? TRA : []), 100] : [49, 50, 61, ...TRA, 100];
    return p;
  }
  function aocOn(c) { return c.app === 'issue' || c.app === 'renew' || !(c.aoc && c.aoc.off); }

  /* items του Assessment of Competence */
  const FI_SEC = [
    { s: '1', t: 'Theoretical knowledge oral', it: ['Air law', 'Aircraft general knowledge', 'Flight performance and planning', 'Human performance and limitations', 'Meteorology', 'Navigation', 'Operational procedures', 'Principles of flight', 'Training administration'] },
    { s: '2', t: 'Pre-flight briefing', it: ['Visual presentation', 'Technical accuracy', 'Clarity of explanation', 'Clarity of speech', 'Instructional technique', 'Use of models and aids', 'Student participation'] },
    { s: '3', t: 'Flight', it: ['Arrangement of demo', 'Synchronization of speech with demo', 'Correction of faults', 'Aircraft handling / FSTD operation', 'Instructional technique', 'General airmanship and safety', 'Positioning and use of airspace'] },
    { s: '4', t: 'Multi-engine exercises', it: ['Actions following an engine failure shortly after take-off', 'SE approach and go-around', 'SE approach and landing'] },
    { s: '5', t: 'Post-flight de-briefing', it: ['Visual presentation', 'Technical accuracy', 'Clarity of explanation', 'Clarity of speech', 'Instructional technique', 'Use of models and aids', 'Student participation'] }
  ];
  const TRI_SEC = [
    { s: '1', t: 'General', it: ['Safety awareness', 'Aircraft technical knowledge', 'Knowledge, skills and attitudes (TRI/SFI role)', 'Human factors in man-machine environment, CRM', 'Identification and correction of errors', 'Standard operating procedures', 'Training administration'] },
    { s: '2', t: 'Pre-flight briefing', it: ['Presentation technique', 'Technical accuracy', 'Clarity of explanation', 'Clarity of speech', 'Instructional technique', 'Use of training aids', 'Student participation'] },
    { s: '3', t: 'Flight', it: ['Effectiveness of demonstration exercise', 'Correction of errors or techniques', 'Aircraft / FSTD operation', 'Instructional technique', 'General airmanship and safety', 'Positioning and use of airspace', 'Interaction with student'] },
    { s: '4', t: 'Post-flight debriefing', it: ['Presentation technique', 'Technical accuracy', 'Clarity of explanation', 'Clarity of speech', 'Instructional technique', 'Use of training aids', 'Student participation'] }
  ];

  /* ---------- βοηθητικά ---------- */
  function clean(s) {
    if (s == null) return '';
    const m = { 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '✓': 'v' };
    return String(s).replace(/[^\x20-\x7E -ÿ]/g, ch => m[ch] || '').trim();
  }
  function dmy(iso) { if (!iso) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso); }
  function mins(t) { const m = /^(\d{1,2}):?(\d{2})$/.exec(String(t || '').trim()); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function hhmm(t) { const n = mins(t); return n == null ? clean(t) : String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function dur(a, b) { const x = mins(a), y = mins(b); if (x == null || y == null) return ''; let d = y - x; if (d < 0) d += 1440; return String(Math.floor(d / 60)).padStart(2, '0') + ':' + String(d % 60).padStart(2, '0'); }
  function name(a) { return [a.surname, a.first].filter(Boolean).join(' ').toUpperCase(); }

  /* αποτέλεσμα ενότητας από τα items: F αν κάποιο F, N/A αν όλα N/A, P αν όλα P/NA, '' αν κενό */
  function secResult(m, s, n, att) {
    let any = false, f = false, allNa = true;
    for (let i = 1; i <= n; i++) {
      const x = (m && m[s + '.' + i]) || {};
      if (x.na) continue; allNa = false;
      const v = att === 2 ? (x.a2 || x.a1) : x.a1;
      if (v) any = true; if (v === 'F') f = true;
    }
    if (allNa) return 'N/A';
    return f ? 'F' : any ? 'P' : '';
  }
  function suggestResult(c) {
    const S = KINDS[c.kind].aoc === 'tri' ? TRI_SEC : FI_SEC; const m = (c.aoc && c.aoc.m) || {};
    const r = S.map(x => secResult(m, x.s, x.it.length, 1));
    const oth = ((c.aoc && c.aoc.oth) || []).filter(o => o && o.d).map(o => o.a1);
    if (r.includes('F') || oth.includes('F')) return KINDS[c.kind].aoc === 'tri' ? 'fail' : 'partial';
    if (r.some(x => x === 'P')) return 'pass';
    return '';
  }

  async function build(o) {
    const { PDFLib, pdfBytes, c, ex } = o;
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const tpl = await PDFDocument.load(pdfBytes);
    const font = await tpl.embedFont(StandardFonts.Helvetica), bold = await tpl.embedFont(StandardFonts.HelveticaBold);
    const INK = rgb(0.05, 0.12, 0.45), STAMP = rgb(0.12, 0.2, 0.55), WHITE = rgb(1, 1, 1);
    let sigImg = null; if (o.sigBytes) { try { sigImg = await tpl.embedPng(o.sigBytes); } catch (e) { sigImg = null; } }
    const pages = tpl.getPages();
    const pg = n => pages[IX[n]]; const H = n => pg(n).getHeight();
    const A = c.a || {}, D = c.d || {}, AO = c.aoc || {};
    const NM = name(A);

    function fit(t, w, s, f) { f = f || font; let z = s; while (z > 5 && f.widthOfTextAtSize(t, z) > w) z -= 0.25; return z; }
    /* κείμενο: p = σελίδα (αρίθμηση εντύπου), x, y = γραμμή βάσης από πάνω */
    function T(p, x, y, t, s, op) {
      t = clean(t); if (!t) return; op = op || {}; s = s || 10; const f = op.bold ? bold : font;
      const z = op.w ? fit(t, op.w, s, f) : s; let xx = x;
      if (op.center) xx = x - f.widthOfTextAtSize(t, z) / 2;
      pg(p).drawText(t, { x: xx, y: H(p) - y, size: z, font: f, color: op.color || INK });
    }
    function C(p, x0, x1, y, t, s) { T(p, (x0 + x1) / 2, y, t, s || 9.5, { center: true, w: x1 - x0 - 4 }); } /* κεντραρισμένο σε κελί */
    function tick(p, cx, cy, sz) {
      sz = sz || 4.5; const P = pg(p), h = H(p);
      P.drawLine({ start: { x: cx - sz * 0.8, y: h - cy }, end: { x: cx - sz * 0.2, y: h - cy - sz * 0.7 }, thickness: 1.4, color: INK });
      P.drawLine({ start: { x: cx - sz * 0.2, y: h - cy - sz * 0.7 }, end: { x: cx + sz, y: h - cy + sz * 0.9 }, thickness: 1.4, color: INK });
    }
    function box(p, b, on) { if (on) tick(p, b[0] + (b[2] || 13) / 2, b[1] + (b[3] || 13) / 2, Math.min(b[2] || 13, b[3] || 13) * 0.4); }
    function ring(p, x0, x1, top, bot) { pg(p).drawEllipse({ x: (x0 + x1) / 2, y: H(p) - (top + bot) / 2, xScale: (x1 - x0) / 2 + 5, yScale: (bot - top) / 2 + 3, borderColor: INK, borderWidth: 1 }); }
    function strike(p, x0, y0, x1, y1) { pg(p).drawLine({ start: { x: x0, y: H(p) - y0 }, end: { x: x1, y: H(p) - y1 }, thickness: 0.9, color: INK }); }
    function cells(p, xs, w, y, chars, s) { chars.forEach((ch, i) => { if (ch && xs[i] != null) T(p, xs[i] + w / 2, y, ch, s || 10, { center: true, w: w - 2 }); }); }
    function stamp(p, x, top, w, small) {
      const s = small ? 5.6 : 6.8, l1 = clean(ex.stamp1 || ''), l2 = clean(ex.stamp2 || '');
      if (l1) pg(p).drawText(l1, { x, y: H(p) - top, size: fit(l1, w, s, bold), font: bold, color: STAMP });
      if (l2) pg(p).drawText(l2, { x, y: H(p) - top - s - 1.5, size: fit(l2, w, s, bold), font: bold, color: STAMP });
      if (sigImg) { const sh = small ? 15 : 20, sw = Math.min(w * 0.6, sigImg.width / sigImg.height * sh); pg(p).drawImage(sigImg, { x: x + w * 0.12, y: H(p) - top - sh * 0.55, width: sw, height: sh, opacity: 0.95 }); }
    }
    const exNo = clean(ex.number || '');
    const exName = clean([ex.title, ex.surname, ex.first].filter(Boolean).join(' ').toUpperCase());
    const exIni = clean(((ex.first || '')[0] || '') + '.' + ((ex.surname || '')[0] || '') + '.').toUpperCase();

    /* αριθμός άδειας στα 6 κόκκινα κουτιά: EL | FCL. | ψηφία */
    function licChars() {
      const d = String(A.licNo || '').replace(/\D/g, '');
      if (!d) return [];
      if (d.length <= 4) return ['EL', 'FCL.'].concat(d.split(''));
      return ['EL', 'FCL.', d];
    }
    function header(p, top, bot) { /* Applicant's name + License number (κεφαλίδα) */
      const y = bot - (bot - top) / 2 + 3.5;
      T(p, 98, y, NM, 10.5, { w: 196 });
      const ch = licChars(); const xs = [358, 394.2, 430.4, 466.6, 502.8, 539];
      if (ch.length === 3) { cells(p, xs, 36.2, y, ch.slice(0, 2), 10); T(p, 430.4 + 4, y, ch[2], 11, { w: 140 }); }
      else cells(p, xs, 36.2, y, ch, 11);
    }

    /* ---------- σελ. 49: προσωπικά στοιχεία & άδεια ---------- */
    T(49, 100, 231, A.surname && A.surname.toUpperCase(), 10, { w: 225 });
    T(49, 388, 231, A.first && A.first.toUpperCase(), 10, { w: 170 });
    T(49, 140, 255, A.title || 'Mr', 9.5, { w: 42 });
    T(49, 306, 255, dmy(A.dob), 9.5, { w: 82 });
    T(49, 446, 255, (A.nat || 'HELLENIC').toUpperCase(), 9.5, { w: 115 });
    T(49, 127, 278, (A.addr1 || '').toUpperCase(), 9.5, { w: 425 });
    T(49, 60, 302, (A.addr2 || '').toUpperCase(), 9.5, { w: 490 });
    box(49, [155, 316, 12, 12], A.postalSame !== false);
    if (A.postalSame === false) T(49, 172, 326, (A.postal || '').toUpperCase(), 9.5, { w: 380 });
    T(49, 122, 373, A.tel, 9.5, { w: 205 });
    T(49, 388, 373, A.mobile, 9.5, { w: 166 });
    T(49, 113, 397, A.email, 9.5, { w: 437 });
    { const d = (A.appDate || '').replace(/\D/g, ''); /* yyyymmdd → dd mm yyyy */
      if (d.length === 8) cells(49, [131, 152, 174, 195, 215, 236, 256, 277], 16.5, 424.5, (d.slice(6, 8) + d.slice(4, 6) + d.slice(0, 4)).split(''), 10.5); }
    box(49, [541, 415, 12, 12], !!A.contactChanged);
    T(49, 108, 483, (A.licType || '').toUpperCase(), 10, { w: 74 });
    T(49, 245, 483, (A.cat || 'AEROPLANE').toUpperCase(), 9, { w: 78 });
    { const ch = licChars(), xs = [384, 417, 450, 483, 516, 549];
      if (ch.length === 3) { cells(49, xs, 33, 483.5, ch.slice(0, 2), 10); T(49, 454, 483.5, ch[2], 11, { w: 125 }); } else cells(49, xs, 33, 483.5, ch, 11); }
    const RT = [[531, 551], [551, 571], [571, 590], [590, 609], [609, 628], [628, 648], [648, 667], [667, 686], [686, 706], [706, 725]];
    const BX = [535.4, 555.7, 574.7, 594.1, 613.3, 633.4, 651.9, 671.1, 690.6, 710.1];
    const rows = [...(A.cls || []).slice(0, 5).concat(Array(5).fill(null)).slice(0, 5), ...(A.oth || []).slice(0, 5).concat(Array(5).fill(null)).slice(0, 5)];
    rows.forEach((r, i) => {
      if (!r || !clean(r.t)) return; const [t0, t1] = RT[i], y = t1 - (t1 - t0) / 2 + 3.5;
      T(49, 127, y, r.t.toUpperCase(), 9.5, { w: 252 });
      C(49, 384, 459, y, dmy(r.exp), 9);
      if (!r.nv && r.v !== false) { box(49, [465.4, BX[i], 12, 12], true); C(49, 482, 582, y, exIni, 9); }
    });
    if (aocOn(c)) { stamp(49, 196, 735.5, 150, true); T(49, 453, 739.5, exNo.replace(/\//g, '.'), 8, { w: 125 }); }

    /* ---------- σελ. 50: δήλωση ---------- */
    box(50, [80.8, 221.8, 12.2, 12.5], c.app === 'issue');
    box(50, [158.6, 221.8, 12.2, 12.5], c.app === 'reval');
    box(50, [219.6, 221.8, 12.3, 12.5], c.app === 'renew');
    box(50, [350.9, 221.8, 12.2, 12.5], c.app === 'ext');
    const also = D.also || {};
    box(50, [233.7, 276.8, 16.5, 17.2], c.kind === 'FI' || also.FI);
    box(50, [233.7, 300.3, 16.5, 17.2], c.kind === 'TRI' || also.TRI);
    box(50, [233.7, 347.6, 16.5, 17.2], c.kind === 'IRI' || also.IRI);
    T(50, 342, 406, (D.aocAc || '').toUpperCase(), 10, { w: 228 });
    T(50, 226, 430.5, (D.restr || '').toUpperCase(), 9.5, { w: 345 });
    T(50, 222, 454.5, (D.ext || '').toUpperCase(), 9.5, { w: 350 });
    if (c.app === 'reval') T(50, 410, 512, dmy(D.lastAoc), 10, { w: 160 });
    box(50, [108.3, 537.4, 12.2, 12.8], true);
    box(50, [401.7, 537.4, 12.2, 12.8], aocOn(c));
    T(50, 462, 569.5, dmy(A.appDate), 10, { w: 105 });

    /* ---------- σελ. 51: προηγούμενη εμπειρία (αρχική έκδοση) ---------- */
    const PR = c.pre || {};
    [[29, 136, PR.tot], [136, 244, PR.pic], [244, 352, PR.m6], [352, 431, PR.inst], [431, 511, PR.xc]].forEach(([a, b, v]) => C(51, a, b, 228, v, 10));
    [[236, 261, PR.sp], [261, 285, PR.mp], [285, 314, PR.sect], [314, 341, PR.ffs]].forEach(([a, b, v]) => C(51, 511, 575, b - (b - a) / 2 + 3.5, v, 10));
    T(51, 470, 468, dmy(PR.meIr), 9.5, { w: 100 });
    if (c.kind === 'FI' && c.app === 'issue') {
      const PE = c.pe || {};
      T(51, 96, 641, (PE.name || NM), 9.5, { w: 315 }); box(51, [96, 646, 12, 12], true);
      T(51, 103, 677, (PE.ato || '').toUpperCase(), 9.5, { w: 265 }); T(51, 470, 677, dmy(PE.date), 9.5, { w: 100 });
      T(51, 346, 701, (PE.instr || '').toUpperCase(), 9.5, { w: 225 }); T(51, 458, 726, PE.lic, 9.5, { w: 115 });
    }

    /* ---------- δηλώσεις ολοκλήρωσης εκπαίδευσης (52 FI / 58-59 TRI / 71 IRI) ---------- */
    const CR = c.crs || {}; const cOff = CR.An || []; const cA = [0, 1, 2].map(i => cOff[i] ? false : true);
    T(52, 200, 188, (CR.ato || '').toUpperCase(), 9.5, { w: 200 }); T(52, 471, 188, CR.appr, 9.5, { w: 100 });
    T(52, 155, 209, (CR.by || 'HCAA').toUpperCase(), 9.5, { w: 415 }); T(52, 45, 236.5, NM, 10, { w: 450 });
    box(52, [233, 244, 12, 12], true); T(52, 160, 288, (CR.cat || 'AEROPLANE').toUpperCase(), 10, { w: 150 });
    [[549, 329], [550, 350], [550, 381]].forEach((b, i) => box(52, [b[0], b[1], 16, 17], cA[i] !== false));
    T(52, 174, 610, (CR.sign || '').toUpperCase(), 9.5, { w: 395 }); T(52, 440, 633.5, dmy(CR.date), 9.5, { w: 130 });

    T(58, 251, 188, (CR.ato || '').toUpperCase(), 9, { w: 100 }); T(58, 464, 188, CR.appr, 9.5, { w: 108 });
    T(58, 251, 209, (CR.by || 'HCAA').toUpperCase(), 9.5, { w: 320 }); T(58, 45, 237, NM, 10, { w: 450 });
    T(58, 140, 308, (CR.type || D.aocAc || '').toUpperCase(), 10, { w: 170 });
    [[551, 343], [550, 369], [551, 396]].forEach((b, i) => box(58, [b[0], b[1], 13, 14], cA[i] !== false));
    box(58, [553, 441, 14, 14], !!(CR.tri4 || [])[0]); box(58, [552, 470, 14, 14], !!(CR.tri4 || [])[1]);
    T(59, 180, 337, (CR.sign || '').toUpperCase(), 10, { w: 380 }); T(59, 475, 376, dmy(CR.date), 10, { w: 95 });

    T(71, 178, 188, (CR.ato || '').toUpperCase(), 9.5, { w: 222 }); T(71, 477, 188, CR.appr, 9.5, { w: 95 });
    T(71, 137, 209, (CR.by || 'HCAA').toUpperCase(), 9.5, { w: 430 }); T(71, 45, 237, NM, 10, { w: 450 });
    T(71, 172, 308, (CR.cat || 'AEROPLANE').toUpperCase(), 10, { w: 150 });
    box(71, [551, 355, 13, 14], cA[0] !== false); box(71, [548, 428, 14, 14], cA[1] !== false); box(71, [550, 572, 13, 14], !!CR.B);
    T(71, 188, 634, (CR.sign || '').toUpperCase(), 9.5, { w: 380 }); T(71, 442, 672, dmy(CR.date), 9.5, { w: 128 });

    /* ---------- section 8 / 7a: revalidation, renewal, extension ---------- */
    const S8 = c.s8 || {}, t8 = S8.t || {};
    [53, 56, 61, 73].forEach(p => header(p, p === 53 || p === 73 ? 144 : 147, p === 53 || p === 73 ? 172 : 175));
    T(56, 245, 264, dmy(S8.exp), 10, { w: 180 });
    box(56, [409, 309, 14, 14], t8.hrs); box(56, [409, 369, 14, 14], t8.ir); box(56, [408, 513, 14, 14], t8.ref); box(56, [407, 664, 14, 14], t8.aoc);
    T(57, 207, 217, dmy(S8.exp), 10, { w: 175 });
    box(57, [369, 258, 13, 14], t8.ref); box(57, [368, 353, 13, 14], t8.aoc);
    if (c.app === 'reval') { T(61, 245, 264, dmy(S8.exp), 10, { w: 180 }); box(61, [407, 309, 14, 14], t8.sim); box(61, [407, 358, 14, 14], t8.air); box(61, [409, 384, 13, 14], t8.ref); box(61, [407, 457, 14, 13], t8.aoc); }
    else { T(61, 207, 611, dmy(S8.exp), 10, { w: 178 }); box(61, [368, 652, 13, 14], t8.sect); box(61, [368, 700, 13, 14], t8.ref); box(61, [368, 739, 13, 14], t8.aoc); }
    if (c.app === 'reval') { T(73, 233, 267, dmy(S8.exp), 10, { w: 215 }); box(73, [438, 331, 13, 14], t8.hrs); box(73, [436, 412, 13, 14], t8.ref); box(73, [436, 466, 13, 13], t8.aoc); }
    else { T(73, 223, 621, dmy(S8.exp), 10, { w: 205 }); box(73, [416, 656, 14, 14], t8.ref); box(73, [414, 697, 14, 14], t8.aoc); }
    const EX = c.ext || {};
    const EXB = { c1: [53, 426, 259], ac1: [53, 426, 405], ac2: [53, 428, 462], e: [53, 426, 548], f1: [53, 428, 649], f2: [53, 425, 691], f3: [53, 427, 723], g: [54, 426, 204], h1: [54, 427, 280], h2: [54, 428, 329], h3: [54, 427, 389], i1: [54, 426, 466], j1: [54, 428, 625], j2: [54, 427, 691] };
    Object.keys(EXB).forEach(k => { const [p, x, y] = EXB[k]; box(p, [x, y, 13, 14], !!EX[k]); });

    /* ---------- Assessment of Competence FI / CRI / IRI (92–95) ---------- */
    const M = AO.m || {}, FL = AO.fl || [], f1 = FL[0] || {}, f2 = FL[1] || {};
    [92, 93, 94, 95].forEach(p => header(p, p === 92 ? 132 : 139, p === 92 ? 159 : 166));
    T(92, 412, 227, dmy(f1.date || A.appDate), 10, { w: 150 });
    function fiRows(p, sec, tops, cols) {
      tops.forEach((r, i) => {
        const x = M[sec + '.' + (i + 1)] || {}; const y = r[1] - (r[1] - r[0]) / 2 + 3.5;
        if (x.na) C(p, cols[0], cols[1], y, 'N/A', 8.5);
        else { C(p, cols[1], cols[2], y, x.a1, 10); C(p, cols[2], cols[3], y, x.a2, 10); }
        T(p, cols[3] + 4, y, x.c, 8.5, { w: cols[4] - cols[3] - 8 });
      });
    }
    const R92a = [[305, 320], [320, 335], [335, 351], [351, 366], [366, 381], [381, 397], [397, 412], [412, 427], [427, 459]];
    const R92b = [[521, 536], [536, 552], [552, 567], [567, 582], [582, 598], [598, 613], [613, 628]];
    const R92c = [[668, 683], [683, 698], [698, 713], [713, 729], [729, 744], [744, 759], [759, 775]];
    const K92 = [247, 278, 320, 363, 575];
    fiRows(92, '1', R92a, K92); fiRows(92, '2', R92b, K92); fiRows(92, '3', R92c, K92);
    const K93 = [249, 284, 327, 370, 575];
    fiRows(93, '4', [[250, 273], [273, 293], [293, 313]], K93);
    fiRows(93, '5', [[391, 411], [411, 431], [431, 450], [450, 470], [470, 490], [490, 510], [510, 530]], K93);
    const OTH = (AO.oth || []).filter(o => o && clean(o.d));
    const R93o = [[599, 619], [619, 639], [639, 659], [659, 679], [679, 699], [699, 719], [719, 740], [740, 760], [760, 780]];
    OTH.slice(0, 9).forEach((o, i) => { const [t0, t1] = R93o[i], y = t1 - (t1 - t0) / 2 + 3.5; T(93, 40, y, o.d, 8.5, { w: 240 }); C(93, 284, 327, y, o.a1, 10); C(93, 327, 370, y, o.a2, 10); T(93, 374, y, o.c, 8.5, { w: 196 }); });
    if (KINDS[c.kind].aoc === 'fi' && OTH.length < 9) { const t = R93o[OTH.length][0]; strike(93, 40, 778, 560, t + 2); }
    /* σελ. 94: Section 7 */
    const res = AO.result || suggestResult(c);
    T(94, 34, 354, NM, 10, { w: 200 });
    T(94, 244, 361, exName, 9, { w: 140 }); stamp(94, 400, 352, 150, true);
    const R1 = [[367, 402], [402, 431]], R2 = [[451, 485], [485, 515]];
    function flight(p, f, rr, cols) {
      const ya = rr[0][1] - (rr[0][1] - rr[0][0]) / 2 + 3.5, yb = rr[1][1] - (rr[1][1] - rr[1][0]) / 2 + 3.5;
      C(p, cols[0], cols[1], ya, (f.type || '').toUpperCase(), 10); C(p, cols[2], cols[3], ya, (f.reg || '').toUpperCase(), 10); C(p, cols[4], cols[5], ya, dmy(f.date), 10);
      C(p, cols[0], cols[1], yb, f.off && hhmm(f.off), 10); C(p, cols[2], cols[3], yb, f.on && hhmm(f.on), 10); C(p, cols[4], cols[5], yb, dur(f.off, f.on), 10);
    }
    const K94 = [103, 218, 301, 391, 455, 579];
    if (f1.type || f1.reg || f1.date) { pg(94).drawRectangle({ x: 456, y: H(94) - 395, width: 120, height: 20, color: WHITE }); flight(94, f1, R1, K94); }
    if (f2.type || f2.reg || f2.date) { pg(94).drawRectangle({ x: 456, y: H(94) - 480, width: 120, height: 20, color: WHITE }); flight(94, f2, R2, K94); }
    const SEC = KINDS[c.kind].aoc === 'tri' ? TRI_SEC : FI_SEC;
    const sr = FI_SEC.map(x => secResult(M, x.s, x.it.length, 1)).concat([OTH.length ? (OTH.some(o => o.a1 === 'F') ? 'F' : 'P') : '']);
    const K94r = [174, 239, 301, 379, 443, 514, 578];
    sr.forEach((v, i) => C(94, K94r[i] + 8, K94r[i + 1], 530.5, v, 10));
    sr.forEach((v, i) => { if (v === 'F' && res === 'partial') tick(94, (K94r[i] + K94r[i + 1]) / 2, 551, 5); });
    if (res === 'pass') ring(94, 224, 254, 568, 579);
    if (res === 'partial') ring(94, 206, 272, 590, 601);
    if (res === 'fail') ring(94, 226, 250, 614, 625);
    if (AO.fiName) T(94, 36, 700, AO.fiName.toUpperCase(), 9, { w: 280 });
    stamp(94, 36, 743, 150, true); T(94, 200, 750, exNo.replace(/\//g, '.'), 9.5, { w: 170, bold: true });
    { const d = dmy(f1.date || A.appDate); pg(94).drawRectangle({ x: 456, y: H(94) - 748, width: 115, height: 14, color: WHITE }); T(94, 470, 744, d, 10.5, { w: 100 }); }
    pg(94).drawRectangle({ x: 456, y: H(94) - 796, width: 115, height: 14, color: WHITE }); T(94, 470, 792, dmy(f1.date || A.appDate), 10.5, { w: 100 });
    T(94, 200, 797, A.licNo ? 'EL.FCL.' + String(A.licNo).replace(/\D/g, '') : '', 9.5, { w: 170 });
    /* σελ. 95: Partial pass – 2η προσπάθεια, αλλιώς διαγραφή */
    const PP = AO.pp || {};
    if (res === 'partial' && PP.on) {
      const g1 = (PP.fl || [])[0] || {}, g2 = (PP.fl || [])[1] || {};
      T(95, 28, 365, NM, 10, { w: 205 });
      T(95, 244, 372, exName, 9, { w: 140 }); stamp(95, 400, 363, 150, true);
      const K95 = [111, 225, 310, 396, 459, 575];
      if (g1.type || g1.reg || g1.date) { pg(95).drawRectangle({ x: 460, y: H(95) - 412, width: 114, height: 26, color: WHITE }); flight(95, g1, [[377, 418], [418, 458]], K95); }
      if (g2.type || g2.reg || g2.date) { pg(95).drawRectangle({ x: 460, y: H(95) - 515, width: 114, height: 26, color: WHITE }); flight(95, g2, [[479, 522], [522, 563]], K95); }
      const sr2 = FI_SEC.map(x => secResult(M, x.s, x.it.length, 2)).concat([OTH.length ? (OTH.some(o => (o.a2 || o.a1) === 'F') ? 'F' : 'P') : '']);
      const K95r = [180, 248, 310, 383, 455, 526, 575];
      sr2.forEach((v, i) => C(95, K95r[i] + 8, K95r[i + 1], 577, v, 10));
      const r2 = PP.result || (sr2.includes('F') ? 'fail' : 'pass');
      box(95, [448, r2 === 'pass' ? 594 : 625, 10, 11], true);
      stamp(95, 30, 748, 150, true); T(95, 195, 756, exNo.replace(/\//g, '.'), 9.5, { w: 170, bold: true });
      pg(95).drawRectangle({ x: 462, y: H(95) - 764, width: 110, height: 14, color: WHITE }); T(95, 470, 760, dmy(g1.date), 10.5, { w: 100 });
      pg(95).drawRectangle({ x: 462, y: H(95) - 813, width: 110, height: 14, color: WHITE }); T(95, 470, 809, dmy(g1.date), 10.5, { w: 100 });
    } else strike(95, 40, 815, 560, 190);

    /* ---------- Assessment of Competence TRI / SFI (96–98) ---------- */
    [96, 97].forEach(p => header(p, 132, 159)); header(98, 144, 172);
    T(96, 412, 227, dmy(f1.date || A.appDate), 10, { w: 150 });
    function triRows(p, sec, tops) {
      tops.forEach((r, i) => {
        const x = M[sec + '.' + (i + 1)] || {}; const y = r[1] - (r[1] - r[0]) / 2 + 3.5; const v = x.a2 || x.a1;
        if (v === 'P') tick(p, 330.5, y - 3.5, 5); if (v === 'F') tick(p, 366, y - 3.5, 5);
        if (x.na) C(p, 313, 384, y, 'N/A', 8.5);
        T(p, 388, y, x.c, 8.5, { w: 183 });
      });
    }
    triRows(96, '1', [[326, 353], [353, 380], [380, 407], [407, 434], [434, 461], [461, 488], [488, 516]]);
    triRows(96, '2', [[564, 590], [590, 616], [616, 642], [642, 669], [669, 696], [696, 723], [723, 750]]);
    triRows(97, '3', [[224, 248], [248, 272], [272, 295], [295, 319], [319, 343], [343, 367], [367, 390]]);
    triRows(97, '4', [[466, 490], [490, 513], [513, 537], [537, 561], [561, 585], [585, 608], [608, 632]]);
    OTH.slice(0, 3).forEach((o, i) => { const t0 = [708, 728, 748][i], y = t0 + 13.5; T(97, 82, y, o.d, 8.5, { w: 228 }); const v = o.a2 || o.a1; if (v === 'P') tick(97, 330.5, y - 3.5, 5); if (v === 'F') tick(97, 366, y - 3.5, 5); T(97, 388, y, o.c, 8.5, { w: 183 }); });
    const TR = c.tri || {};
    T(98, 256, 225, (TR.fstd || f1.reg || '').toUpperCase(), 10, { w: 320 });
    T(98, 256, 250.5, (TR.loc || '').toUpperCase(), 10, { w: 320 });
    T(98, 256, 276, (TR.type || f1.type || D.aocAc || '').toUpperCase(), 10, { w: 320 });
    C(98, 120, 206, 301.5, f1.on && hhmm(f1.on), 10); C(98, 304, 391, 301.5, f1.off && hhmm(f1.off), 10); C(98, 475, 582, 301.5, dur(f1.off, f1.on), 10);
    (TR.cand || []).slice(0, 2).forEach((k, i) => {
      if (!k) return; const y = [352, 377][i];
      T(98, 210, y, (k.n || '').toUpperCase(), 9.5, { w: 178 }); T(98, 395, y, k.l, 9.5, { w: 183 });
      if (k.pf === 'PF') tick(98, 102, y - 5, 4); if (k.pf === 'PM') tick(98, 172, y - 5, 4);
    });
    box(98, [365, 401, 11, 11], TR.trg === 'fstd'); box(98, [549, 400, 11, 11], TR.trg === 'ac');
    box(98, [293, 448, 11, 12], res === 'pass'); box(98, [413, 448, 11, 12], res === 'fail' || res === 'partial');
    T(98, 420, 527, dmy(f1.date || A.appDate), 10, { w: 150 });
    T(98, 120, 683, exName, 10, { w: 300 });
    stamp(98, 90, 709, 160, true); T(98, 270, 719, exNo.replace(/\//g, '.'), 9, { w: 120, bold: true });
    T(98, 430, 715, dmy(f1.date || A.appDate), 10, { w: 140 });

    /* ---------- μόνο οι σελίδες της περίπτωσης ---------- */
    const out = await PDFDocument.create();
    const want = pagesFor(c);
    const cp = await out.copyPages(tpl, want.map(n => IX[n]));
    cp.forEach(p => out.addPage(p));
    return await out.save();
  }

  function label(c) {
    const k = KINDS[c.kind].label, a = { issue: 'ISSUE', reval: 'REVAL', renew: 'RENEWAL', ext: 'EXT' }[c.app];
    return 'AoC ' + k + ' ' + a;
  }

  function checks(c) {
    const W = []; const A = c.a || {}, AO = c.aoc || {}, f1 = (AO.fl || [])[0] || {};
    if (!A.surname || !A.first) W.push('Λείπει ονοματεπώνυμο υποψηφίου.');
    if (!String(A.licNo || '').replace(/\D/g, '')) W.push('Λείπει ο αριθμός άδειας.');
    if (!A.appDate) W.push('Λείπει η ημερομηνία αίτησης.');
    if (aocOn(c)) {
      if (!f1.date) W.push('Λείπει η ημερομηνία της πτήσης του AoC.');
      if (!f1.type) W.push('Λείπει ο τύπος/κλάση αεροσκάφους της πτήσης.');
      if (!AO.result && !suggestResult(c)) W.push('Δεν έχουν βαθμολογηθεί items στο Assessment of Competence.');
    }
    if ((c.app === 'reval' || c.app === 'renew') && !(c.s8 && c.s8.exp)) W.push('Λείπει η λήξη του πιστοποιητικού (Section 8).');
    if (c.app === 'reval' && c.kind === 'FI') { const t = (c.s8 && c.s8.t) || {}; const n = [t.hrs, t.ref, t.aoc].filter(Boolean).length; if (n < 2) W.push('FI revalidation: χρειάζονται τουλάχιστον 2 από τα 3 (ώρες, refresher, AoC).'); }
    if (c.app === 'reval' && c.kind === 'TRI') { const t = (c.s8 && c.s8.t) || {}; const n = [t.sim || t.air, t.ref, t.aoc].filter(Boolean).length; if (n < 2) W.push('TRI revalidation: χρειάζονται 2 από τα 1, 2, 3.'); }
    if (c.app === 'reval' && !(c.d && c.d.lastAoc)) W.push('ℹ️ Revalidation: η ΥΠΑ ζητά την ημερομηνία του τελευταίου AoC (σελ. 50).');
    const r = AO.result || suggestResult(c);
    if (r === 'partial' && !(AO.pp && AO.pp.on)) W.push('ℹ️ PARTIAL PASS: η σελ. 95 (2η προσπάθεια) θα βγει διαγραμμένη μέχρι να γίνει η επανεξέταση.');
    return W;
  }

  root.PEL935 = { SRC, KINDS, APPS, FI_SEC, TRI_SEC, pagesFor, aocOn, build, suggestResult, secResult, label, checks, dmy, dur, hhmm };
})(typeof window !== 'undefined' ? window : globalThis);
