/* PEL-FCL forms – fill engine (pdf-lib). Works in browser and node. */
(function (root) {
  const ITEMS = {
    CPL: [
      { s: '1', t: 'Pre-flight operations and departure', it: [['a', 'Pre-flight, planning, docs, M&B, weather, NOTAMs'], ['b', 'Aeroplane inspection and servicing'], ['c', 'Taxiing and take-off'], ['d', 'Performance considerations and trim'], ['e', 'Aerodrome and traffic pattern operations'], ['f', 'Departure procedure, altimeter, lookout'], ['g', 'ATC liaison – R/T']] },
      { s: '2', t: 'General airwork', it: [['a', 'Visual control: S&L, climb, descent, lookout'], ['b', 'Critically low airspeeds, stalls'], ['c', 'Turns, landing config, steep turns 45°'], ['d', 'Critically high airspeeds, spiral dives'], ['e1', 'Instruments (i) level flight, hdg/alt/IAS'], ['e2', 'Instruments (ii) climbing/descending turns 10–30°'], ['e3', 'Instruments (iii) unusual attitudes'], ['e4', 'Instruments (iv) limited panel'], ['f', 'ATC liaison – R/T']] },
      { s: '3', t: 'En-route procedures', it: [['a', 'Visual control, cruise, range/endurance'], ['b', 'Orientation, map reading'], ['c', 'Altitude, speed, heading control, lookout'], ['d', 'Altimeter setting, ATC liaison – R/T'], ['e', 'Flight progress, log, fuel, track error'], ['f', 'Weather, trends, diversion planning'], ['g', 'Tracking NDB/VOR, facilities, diversion']] },
      { s: '4', t: 'Approach and landing procedures', it: [['a', 'Arrival procedures, altimeter, checks, lookout'], ['b', 'ATC liaison – R/T'], ['c', 'Go-around from low height'], ['d', 'Normal / crosswind landing'], ['e', 'Short field landing'], ['f', 'Idle power approach & landing (SE only)'], ['g', 'Landing without flaps'], ['h', 'Post flight actions']] },
      { s: '5', t: 'Abnormal and emergency procedures', it: [['a', 'Simulated EFATO, fire drill'], ['b', 'Equipment malfunctions (gear, elec, brakes)'], ['c', 'Forced landing (simulated)'], ['d', 'ATC liaison – R/T'], ['e', 'Oral questions']] },
      { s: '6', t: 'Simulated asymmetric flight & class/type items', it: [['a', 'Simulated engine failure during take-off'], ['b', 'Asymmetric approach and go-around'], ['c', 'Asymmetric approach and full stop landing'], ['d', 'Engine shutdown and restart'], ['e', 'ATC liaison – R/T, airmanship'], ['f1', '(i) Systems incl. autopilot'], ['f2', '(ii) Pressurisation system'], ['f3', '(iii) De-icing / anti-icing'], ['g', 'Oral questions']] }
    ],
    IR: [
      { s: '1', t: 'Pre-flight operations and departure', it: [['a', 'Flight manual, performance, M&B'], ['b', 'ATS document, weather document'], ['c', 'ATC flight plan, IFR plan/log'], ['d', 'Navaids for departure/arrival/approach'], ['e', 'Pre-flight inspection'], ['f', 'Weather minima'], ['g', 'Taxiing'], ['h', 'PBN departure (if applicable)'], ['i', 'Pre-take-off briefing, take-off'], ['j', '(°) Transition to instrument flight'], ['k', '(°) Instrument departure incl. PBN, altimeter'], ['l', '(°) ATC liaison – R/T']] },
      { s: '2', t: 'General handling (°)', it: [['a', 'Control solely by instruments, speeds, trim'], ['b', 'Climbing/descending Rate 1 turns'], ['c', 'Unusual attitudes, 45° turns'], ['d', '(*) Approach to stall recovery'], ['e', 'Limited panel']] },
      { s: '3', t: 'En-route IFR procedures (°)', it: [['a', 'Tracking, interception NDB/VOR/waypoints'], ['b', 'Navigation system and radio aids'], ['c', 'Level flight, hdg/alt/IAS, power, trim'], ['d', 'Altimeter settings'], ['e', 'Timing, ETAs (en-route hold)'], ['f', 'Flight progress, log, fuel, systems'], ['g', 'Ice protection procedures'], ['h', 'ATC liaison – R/T']] },
      { s: '3a', t: 'Arrival procedures', it: [['a', 'Setting/checking navaids'], ['b', 'Arrival procedures, altimeter checks'], ['c', 'Altitude and speed constraints'], ['d', 'PBN arrival (if applicable)']] },
      { s: '4', t: '3D operations (°)', it: [['a', 'Navaids, vertical path, RNP APCH checks'], ['b', 'Approach & landing briefing, checks'], ['c', '(+) Holding procedure'], ['d', 'Compliance with published procedure'], ['e', 'Approach timing'], ['f', 'Alt, speed, heading (stabilised)'], ['g', '(+) Go-around action'], ['h', '(+) Missed approach / landing'], ['i', 'ATC liaison – R/T']] },
      { s: '5', t: '2D operations (°)', it: [['a', 'Navaids, RNP APCH checks'], ['b', 'Approach & landing briefing, checks'], ['c', '(+) Holding procedure'], ['d', 'Compliance with published procedure'], ['e', 'Approach timing'], ['f', 'Alt/dist to MAPt, speed, hdg, SDFs'], ['g', '(+) Go-around action'], ['h', '(+) Missed approach / landing'], ['i', '(+) ATC liaison – R/T']] },
      { s: '6', t: 'One engine inoperative (ME only) (°)', it: [['a', 'Simulated EF after T/O or on go-around'], ['b', 'OEI approach, go-around, missed approach'], ['c', 'OEI approach and landing'], ['d', 'ATC liaison – R/T']] }
    ]
  };

  const GR = { 'Α':'A','Β':'V','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'TH','Ι':'I','Κ':'K','Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P','Ρ':'R','Σ':'S','Τ':'T','Υ':'Y','Φ':'F','Χ':'CH','Ψ':'PS','Ω':'O','Ά':'A','Έ':'E','Ή':'I','Ί':'I','Ό':'O','Ύ':'Y','Ώ':'O','Ϊ':'I','Ϋ':'Y' };
  function clean(s) {
    s = String(s == null ? '' : s);
    let o = '';
    for (const ch of s) {
      const up = ch.toUpperCase();
      if (GR[up]) { o += ch === up ? GR[up] : GR[up].toLowerCase(); continue; }
      if (ch === 'ς') { o += 's'; continue; }
      const code = ch.charCodeAt(0);
      if (code < 256 || '–—‘’“”•€'.includes(ch)) o += ch; else o += ch.normalize('NFD').replace(/[^\x00-\xff]/g, '');
    }
    return o;
  }
  function dmy(iso, sep) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const d = sep === undefined ? '/' : sep;
    return m[3] + d + m[2] + d + m[1];
  }
  function hhmm(t) { return t ? t.replace(':', '') : ''; }
  function mins(t) { if (!t) return null; const m = /^(\d{1,2}):?(\d{2})$/.exec(t); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function dur(dep, arr) {
    const a = mins(dep), b = mins(arr);
    if (a == null || b == null) return '';
    let d = b - a; if (d < 0) d += 1440;
    return Math.floor(d / 60) + ':' + String(d % 60).padStart(2, '0');
  }
  function sectionResult(marks, sec, att) {
    let any = false, fail = false;
    for (const [id] of sec.it) {
      const v = (marks[sec.s + id] || [])[att];
      if (v === 'F') fail = true;
      if (v === 'P' || v === 'NA') any = true;
    }
    return fail ? 'F' : any ? 'P' : '';
  }
  function fullName(a) { return [a.first, a.surname].filter(Boolean).join(' ').toUpperCase(); }
  function latestDate(fl) { return (fl || []).map(f => f.date).filter(Boolean).sort().pop() || ''; }
  function joinU(arr) { return [...new Set(arr.filter(Boolean))].join(' / '); }
  function testSummary(t) {
    // the passing attempt flights (retest if present)
    const use = t.result === 'pass' ? t.flights : (t.retest && t.retest.result === 'pass' ? t.retest.flights : null);
    const all = [...(t.flights || []), ...((t.retest && t.retest.flights) || [])].filter(f => f.date || f.type);
    const fl = use || [];
    return {
      passed: !!use,
      passDate: use ? latestDate(fl) : '',
      types: joinU(all.map(f => f.type)),
      regs: joinU(all.map(f => f.reg))
    };
  }

  async function build(opts) {
    const { PDFLib, layout, pdfBytes, ex, c, form, pagesMode, sigBytes } = opts;
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const L = layout[form];
    const doc = await PDFDocument.load(pdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const INK = rgb(0.05, 0.12, 0.45), STAMP = rgb(0.12, 0.2, 0.55);
    const pages = doc.getPages();
    let sigImg = null;
    if (sigBytes) { try { sigImg = await doc.embedPng(sigBytes); } catch (e) { sigImg = null; } }
    const pg = p => pages[p - 1];
    const H = p => pg(p).getHeight();

    function fit(t, w, s, f) { f = f || font; let size = s; while (size > 5 && f.widthOfTextAtSize(t, size) > w) size -= 0.25; return size; }
    function text(key, val, o) {
      const d = L.text[key]; if (!d) return;
      const t = clean(val); if (!t) return;
      const f = (o && o.bold) ? bold : font;
      if (d.lines) {
        const words = t.split(/\s+/); const lines = []; let cur = '';
        for (const w of words) { const n = cur ? cur + ' ' + w : w; if (f.widthOfTextAtSize(n, d.s) > d.w && cur) { lines.push(cur); cur = w; } else cur = n; }
        if (cur) lines.push(cur);
        lines.slice(0, d.lines).forEach((ln, i) => pg(d.p).drawText(ln, { x: d.x, y: H(d.p) - d.y - i * d.lh, size: d.s, font: f, color: INK }));
        return;
      }
      const size = fit(t, d.w, d.s, f);
      if (/date|dob|notif/.test(key)) pg(d.p).drawRectangle({ x: d.x - 1.5, y: H(d.p) - d.y - 2.5, width: Math.min(d.w, f.widthOfTextAtSize(t, size) + 3), height: size + 3, color: rgb(1, 1, 1) });
      pg(d.p).drawText(t, { x: d.x, y: H(d.p) - d.y + (/date|dob|notif/.test(key) ? 0 : 2.2), size, font: f, color: INK });
    }
    function at(p, x, top, t, s, o) {
      t = clean(t); if (!t) return;
      const f = (o && o.bold) ? bold : font;
      const size = o && o.w ? fit(t, o.w, s, f) : s;
      let xx = x;
      if (o && o.center) xx = x - f.widthOfTextAtSize(t, size) / 2;
      pg(p).drawText(t, { x: xx, y: H(p) - top, size, font: f, color: (o && o.color) || INK });
    }
    function tick(p, cx, cy, sz) {
      sz = sz || 6; const page = pg(p), h = H(p);
      page.drawLine({ start: { x: cx - sz * 0.8, y: h - cy }, end: { x: cx - sz * 0.2, y: h - cy - sz * 0.7 }, thickness: 1.4, color: INK });
      page.drawLine({ start: { x: cx - sz * 0.2, y: h - cy - sz * 0.7 }, end: { x: cx + sz, y: h - cy + sz * 0.9 }, thickness: 1.4, color: INK });
    }
    function boxTick(key, on) {
      const b = L.box && L.box[key]; if (!b || !on) return;
      tick(b.p, b.x + b.w / 2, b.top + b.h / 2, Math.min(b.w, b.h) * 0.42);
    }
    function circle(p, b) {
      const [x0, t0, x1, t1] = b;
      pg(p).drawEllipse({ x: (x0 + x1) / 2, y: H(p) - (t0 + t1) / 2, xScale: (x1 - x0) / 2 + 4, yScale: (t1 - t0) / 2 + 3.5, borderColor: INK, borderWidth: 1 });
    }
    function stamp(p, x, top, w, small) {
      const s = small ? 5.6 : 6.8;
      const l1 = clean(ex.stamp1 || ''), l2 = clean(ex.stamp2 || '');
      if (l1) pg(p).drawText(l1, { x, y: H(p) - top, size: fit(l1, w, s, bold), font: bold, color: STAMP });
      if (l2) pg(p).drawText(l2, { x, y: H(p) - top - s - 1.5, size: fit(l2, w, s, bold), font: bold, color: STAMP });
      if (sigImg) {
        const sh = small ? 16 : 22; const sw = Math.min(w * 0.7, sigImg.width / sigImg.height * sh);
        pg(p).drawImage(sigImg, { x: x + w * 0.15, y: H(p) - top - sh * 0.55, width: sw, height: sh, opacity: 0.95 });
      }
    }
    function sig(key) {
      const d = L.sig && L.sig[key]; if (!d) return;
      const w1 = Math.max(bold.widthOfTextAtSize(clean(ex.stamp1 || ''), 6.8), bold.widthOfTextAtSize(clean(ex.stamp2 || ''), 6.8));
      if (w1) pg(d.p).drawRectangle({ x: d.x - 2, y: H(d.p) - d.top - 17 - 9.5, width: Math.min(d.w, w1) + 4, height: 18, color: rgb(1, 1, 1) });
      stamp(d.p, d.x, d.top + 17, d.w);
    }
    function cells(key, str) {
      const d = L.cells[key]; if (!d) return;
      const chars = clean(str).replace(/\s/g, '').split('');
      d.xs.forEach((x, i) => { if (chars[i]) { const w = (d.xs[i + 1] ? Math.min(d.xs[i + 1] - x, 20) : 16); at(d.p, x + w / 2, d.top + d.h - 4.5, chars[i], 10, { center: true }); } });
    }
    function flights(fl, def, rows, cols, p) {
      (fl || []).slice(0, rows.length).forEach((f, i) => {
        const [t0, t1] = rows[i]; const y = t1 - (t1 - t0) / 2 + 3.2;
        const vals = [dmy(f.date), f.type, f.reg, hhmm(f.dep), hhmm(f.arr), dur(f.dep, f.arr)];
        vals.forEach((v, j) => { const cx = (cols[j] + cols[j + 1]) / 2; at(p, cx, y, v, 9, { center: true, w: cols[j + 1] - cols[j] - 4 }); });
      });
    }
    function marksTables(kind, t) {
      const secs = ITEMS[kind]; let ri = 0;
      const rows = L.rows; const results = L.results;
      secs.forEach((sec, si) => {
        for (const [id] of sec.it) {
          const r = rows[ri++]; const m = t.marks[sec.s + id] || [];
          const cy = (r.y0 + r.y1) / 2;
          [0, 1].forEach(att => {
            const v = m[att]; if (!v) return;
            if (v === 'P') tick(r.p, r.cx[att * 2], cy, 5);
            else if (v === 'F') tick(r.p, r.cx[att * 2 + 1], cy, 5);
            else if (v === 'NA') at(r.p, r.cx[att * 2], cy + 2.5, 'N/A', 7, { center: true, w: 24 });
          });
          const cm = t.comments && t.comments[sec.s + id];
          if (cm) { const x = r.cx[3] + 16; at(r.p, x, cy + 3, cm, 7.5, { w: 562 - x }); }
        }
        const res = results[si];
        let stamped = false;
        [0, 1].forEach(att => {
          const sr = sectionResult(t.marks, sec, att);
          if (!sr) return;
          circle(res.p, res.boxes[att * 2 + (sr === 'F' ? 1 : 0)]);
          if (!stamped) { stamp(res.p, res.boxes[3][2] + 20, res.top - 1, 150, true); stamped = true; }
        });
      });
    }

    const A = c.applicant || {}; const name = fullName(A); const dob = dmy(A.dob);
    const exName = clean(ex.displayName || '').toUpperCase();
    const cpl = c.cpl || {}, ir = c.ir || {};
    let keep = null;
    /* στοιχεία υποψηφίου στη σελίδα 1 (320B / 420A) */
    const U = v => (v || '').toUpperCase();
    const licNoFull = A.licNo ? (/^EL/i.test(A.licNo) ? U(A.licNo) : 'EL/FCL/' + A.licNo) : '';
    function applicantPage() {
      text('a_surname', U(A.surname)); text('a_first', U(A.first)); text('a_title', A.title); text('a_dob', dob);
      text('a_nat', U(A.nationality)); text('a_pobtown', U(A.pobTown)); text('a_pobcountry', U(A.pobCountry));
      text('a_addr1', U([A.address, A.city].filter(Boolean).join(', '))); text('a_postcode', A.postcode);
      text('a_tel', A.tel); text('a_mobile', A.mobile); text('a_email', A.email);
      if (licNoFull || A.licType) {
        text('a_lstate', U(A.licState || 'GREECE')); text('a_ltype', U(A.licType || 'PPL(A)')); text('a_ltype2', U(A.licType || 'PPL(A)'));
        text('a_lcat', 'AEROPLANE'); text('a_lno', licNoFull); text('a_lno2', licNoFull); text('a_lexp', dmy(A.licExp));
      }
    }

    if (form === '320A' || form === '320B') {
      const s = testSummary(cpl);
      text('s9_name', name);
      text('s9_passdate', dmy(s.passDate)); text('s9_actype', s.types); text('s9_reg', s.regs);
      text('s9_exname', exName); text('s9_exnum', ex.number); text('s9_auth', ex.authority);
      sig('s9_sig'); text('s9_date', dmy(c.signDate || s.passDate));
      if (form === '320B' && c.tests.ir) {
        const si = testSummary(ir);
        text('s10_name', name); text('s10_passdate', dmy(si.passDate)); text('s10_actype', si.types); text('s10_reg', si.regs);
        boxTick('s10_pbn_yes', ir.pbn === 'yes'); boxTick('s10_pbn_no', ir.pbn === 'no');
        text('s10_exname', exName); text('s10_exnum', ex.number); text('s10_auth', ex.authority);
        sig('s10_sig'); text('s10_date', dmy(c.signDate || si.passDate));
      }
      text('p2_name', name); text('p2_dob', dob); text('p2_attempt', cpl.attempt || '1'); text('p2_date', dmy(cpl.flights && cpl.flights[0] && cpl.flights[0].date));
      text('p2_place', cpl.place); text('p2_logname', name); text('p2_exname', exName); text('p2_exnum', ex.number); text('p2_auth', ex.authority);
      text('p2_notif', dmy(cpl.notif || c.notif)); sig('p2_sig');
      text('p2_tbl_attempt', cpl.attempt || '1');
      flights(cpl.flights, null, L.flights.rows, L.flights.cols, L.flights.p);
      boxTick('res_pass', cpl.result === 'pass'); boxTick('res_partial', cpl.result === 'partial'); boxTick('res_fail', cpl.result === 'fail');
      if (cpl.result === 'partial' || cpl.result === 'fail') { text('p2_ft_ac', cpl.ft && cpl.ft.ac); text('p2_ft_sim', cpl.ft && cpl.ft.sim); text('p2_ft_gnd', cpl.ft && cpl.ft.gnd); }
      if (cpl.retest && cpl.retest.on) {
        flights(cpl.retest.flights, null, L.flights.rrows, L.flights.rcols, L.flights.p);
        boxTick('rres_pass', cpl.retest.result === 'pass'); boxTick('rres_fail', cpl.retest.result === 'fail');
        if (cpl.retest.result === 'fail') { text('p2r_ft_ac', cpl.retest.ft && cpl.retest.ft.ac); text('p2r_ft_sim', cpl.retest.ft && cpl.retest.ft.sim); text('p2r_ft_gnd', cpl.retest.ft && cpl.retest.ft.gnd); }
      }
      text('p6_name', name); text('p6_dob', dob);
      if (form === '320B') {
        applicantPage();
        const sep = c.classSE != null ? c.classSE : cpl.engine === 'SE', mep = c.classME != null ? c.classME : cpl.engine !== 'SE';
        boxTick('cls_sep', sep); boxTick('cls_mep', mep);
        const ct = c.courseType || (c.tests.ir ? 'cplir' : 'cpl');
        boxTick('crs_atp', ct === 'atp'); boxTick('crs_cplir', ct === 'cplir'); boxTick('crs_cpl', ct === 'cpl');
        text('s6_name', name); text('s12_date', dmy(c.signDate));
      }
      marksTables('CPL', cpl);
      keep = form === '320B' ? [3, 4, 5, 6, 7, 8] : [4, 5, 6, 7, 8];
    }
    if (form === '420A') {
      text('p2_name', name); text('p2_dob', dob); text('p2_logname', name); text('p2_exname', exName); text('p2_exnum', ex.number); text('p2_auth', ex.authority);
      text('p2_notif', dmy(ir.notif || c.notif)); sig('p2_sig'); text('p2_tbl_attempt', ir.attempt || '1');
      flights(ir.flights, null, L.flights.rows, L.flights.cols, L.flights.p);
      boxTick('res_pass', ir.result === 'pass'); boxTick('res_partial', ir.result === 'partial'); boxTick('res_fail', ir.result === 'fail');
      if (ir.result === 'partial' || ir.result === 'fail') { text('p2_ft_ac', ir.ft && ir.ft.ac); text('p2_ft_sim', ir.ft && ir.ft.sim); text('p2_ft_gnd', ir.ft && ir.ft.gnd); }
      text('p2_comments', ir.comment);
      if (ir.retest && ir.retest.on) {
        flights(ir.retest.flights, null, L.flights.rrows, L.flights.rcols, L.flights.p);
        boxTick('rres_pass', ir.retest.result === 'pass'); boxTick('rres_fail', ir.retest.result === 'fail');
        if (ir.retest.result === 'fail') { text('p2r_ft_ac', ir.retest.ft && ir.retest.ft.ac); text('p2r_ft_sim', ir.retest.ft && ir.retest.ft.sim); text('p2r_ft_gnd', ir.retest.ft && ir.retest.ft.gnd); }
        text('p2r_comments', ir.retest.comment);
      }
      [5, 6, 7, 8].forEach(p => { text('h' + p + '_name', name); text('h' + p + '_dob', dob); });
      applicantPage(); text('a_decldate', dmy(c.signDate)); text('a_appdate', dmy(c.signDate));
      boxTick('ir_se', ir.engine === 'SE'); boxTick('ir_me', ir.engine !== 'SE');
      marksTables('IR', ir);
      keep = [4, 5, 6, 7, 8];
    }
    if (form === '1000') {
      const T = c.ato || {};
      cells('lic', A.licNo || '');
      text('surname', (A.surname || '').toUpperCase()); text('first', (A.first || '').toUpperCase()); text('title', A.title);
      cells('dob', dmy(A.dob, ''));
      text('addr1', (A.address || '').toUpperCase()); text('postcode', A.postcode); text('mobile', A.mobile); text('email', A.email);
      text('ato', (T.name || '').toUpperCase()); text('atono', T.number); text('atoaddr', (T.address || '').toUpperCase()); text('atotel', T.tel); text('atoemail', T.email);
      cells('appdate', dmy(c.pbnAppDate || c.signDate, '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1$2$3').replace(/^(\d{2})(\d{2})\d{2}(\d{2})$/, '$1$2$3'));
      cells('exlic', ex.licNo || '');
      text('exstate', ex.state); cells('exdob', dmy(ex.dob, ''));
      text('exsurname', (ex.surname || '').toUpperCase()); text('exfirst', (ex.first || '').toUpperCase()); text('extitle', ex.title);
      text('exmobile', ex.mobile); text('exemail', ex.email);
      sig('exsig');
      cells('exdate', dmy(c.signDate, '').replace(/^(\d{2})(\d{2})\d{2}(\d{2})$/, '$1$2$3'));
      const cl = c.pbnChecklist || {};
      boxTick('cl_pc', cl.pc); boxTick('cl_lic', cl.lic); boxTick('cl_pbn', cl.pbn); boxTick('cl_ato', cl.ato);
      keep = [1, 2];
    }
    if (pagesMode === 'examiner' && keep) {
      const total = doc.getPageCount();
      for (let i = total; i >= 1; i--) if (!keep.includes(i)) doc.removePage(i - 1);
    }
    return await doc.save();
  }

  function checks(c, ex) {
    const W = [], A = c.applicant || {};
    const need = (v, msg) => { if (!v) W.push(msg); };
    need(A.surname && A.first, 'Λείπει ονοματεπώνυμο υποψηφίου.');
    need(A.dob, 'Λείπει ημερομηνία γέννησης υποψηφίου.');
    need(ex.number, 'Λείπει αριθμός εξεταστή (Ρυθμίσεις).');
    const tests = [];
    if (c.tests.cpl) tests.push(['CPL', c.cpl, ITEMS.CPL]);
    if (c.tests.ir) tests.push(['IR', c.ir, ITEMS.IR]);
    for (const [k, t, secs] of tests) {
      const fl = (t.flights || []).filter(f => f.date || f.type || f.dep);
      if (!fl.length) W.push(k + ': δεν υπάρχει καμία πτήση στα Details of Flight(s).');
      fl.forEach((f, i) => {
        if (!f.date || !f.type || !f.reg) W.push(`${k}: πτήση ${i + 1} – λείπει ημερομηνία/τύπος/registration.`);
        if (f.dep && f.arr && mins(f.arr) <= mins(f.dep)) W.push(`${k}: πτήση ${i + 1} – η άφιξη είναι πριν/ίδια με την αναχώρηση.`);
      });
      if (!t.result) W.push(k + ': δεν έχει επιλεγεί αποτέλεσμα (Pass / Partial / Fail).');
      const failed = secs.filter(s => sectionResult(t.marks || {}, s, 0) === 'F').length;
      const empty = [];
      secs.forEach(s => s.it.forEach(([id]) => { if (!(t.marks[s.s + id] || [])[0]) empty.push(s.s + id); }));
      if (t.result === 'pass' && failed) W.push(`${k}: αποτέλεσμα Pass αλλά ${failed} ενότητα(ες) έχουν Fail.`);
      if (t.result === 'fail' && !failed) W.push(`${k}: αποτέλεσμα Fail χωρίς καμία ενότητα Fail.`);
      if (empty.length) W.push(`${k}: ${empty.length} στοιχεία χωρίς σημείωση (π.χ. ${empty.slice(0, 5).join(', ')}).`);
      const notif = t.notif || c.notif; const first = fl.map(f => f.date).filter(Boolean).sort()[0];
      if (!notif) W.push(k + ': λείπει η ημερομηνία Notification of Test στην HCAA.');
      else if (first && notif > first) W.push(k + ': η ειδοποίηση στην HCAA είναι μετά την ημερομηνία του test.');
      if (c.signDate && first && c.signDate < first) W.push(k + ': η ημερομηνία υπογραφής είναι πριν από το test.');
      const last = fl.map(f => f.date).filter(Boolean).sort().pop();
      if (last) { const d = new Date(last); d.setDate(d.getDate() + 14); W.push(`ℹ️ ${k}: υποβολή Part 2 στην HCAA έως ${dmy(d.toISOString().slice(0, 10))}.`); }
    }
    if (c.tests.ir) {
      const ir = c.ir;
      if (!ir.pbn) W.push('IR: δεν έχει δηλωθεί PBN competency (YES/NO) – περνά στο 320B Ενότ. 10.');
      if (ir.engine === 'SE' && ITEMS.IR[6].it.some(([id]) => (ir.marks['6' + id] || [])[0] && (ir.marks['6' + id] || [])[0] !== 'NA')) W.push('IR: Single-engine αλλά η Ενότητα 6 (OEI) έχει σημειώσεις.');
      if (ir.pbn === 'yes') W.push('ℹ️ IR/PBN: μία προσέγγιση στην Ενότ. 4 ή 5 πρέπει να είναι RNP APCH.');
    }
    if (c.tests.cpl && c.cpl.engine === 'ME') {
      const v = (c.cpl.marks['4f'] || [])[0]; if (v && v !== 'NA') W.push('CPL: ME αεροσκάφος – το 4f (idle power, single-engine only) συνήθως N/A.');
    }
    if (c.course === 'integrated' && c.tests.ir && !c.tests.cpl) W.push('Integrated: επιλέχθηκε μόνο IR – συνήθως το 320B συνοδεύεται από CPL test.');
    if (c.tests.pbn) {
      const cl = c.pbnChecklist || {};
      if (!cl.lic || !cl.pbn || !cl.ato || !cl.pc) W.push('PEL-FCL 1000: συνημμένα που λείπουν από το checklist: ' + [!cl.pc && 'Skill Test', !cl.lic && 'άδεια εξεταστή', !cl.pbn && 'PBN endorsement εξεταστή', !cl.ato && 'επιστολή αρχής για ATO'].filter(Boolean).join(', ') + '.');
      if (c.tests.ir && c.ir.pbn !== 'yes') W.push('PEL-FCL 1000 επιλεγμένο αλλά στο IR το PBN δεν είναι YES.');
    }
    if (c.course === 'integrated' && c.tests.ir) W.push('ℹ️ CPL/IR integrated: επισύναψε το PEL-FCL 420A Part 2 μαζί με το 320B.');
    return W;
  }

  root.PELFILL = { ITEMS, build, checks, dur, dmy, sectionResult, testSummary };
})(typeof window !== 'undefined' ? window : globalThis);
