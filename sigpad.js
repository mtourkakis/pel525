/* Υπογραφή στην οθόνη (δάχτυλο / Pencil) → PNG dataURL κομμένο στα όρια */
(function () {
  const css = `.pelsig{position:fixed;inset:0;background:rgba(10,18,30,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
.pelsig .pelsig-box{background:#fff;border-radius:16px;width:100%;max-width:820px;padding:16px;color:#14213d;font:16px/1.35 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
.pelsig canvas{width:100%!important;max-width:none;height:260px;border:1px dashed #2b3d52;border-radius:12px;background:#fff;touch-action:none;display:block}
.pelsig p{font-size:12.5px;color:#5d6b82;margin:6px 0 10px}.pelsig .pelsig-r{display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
.pelsig button{border:0;border-radius:10px;padding:11px 16px;font:inherit;font-weight:650;font-size:15px;background:#e7ecf5;color:#14202e}.pelsig button.ok{background:#d98a00;color:#1a1a1a}`;
  function trim(cv) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return '';
    const p = 6, o = document.createElement('canvas'); o.width = x1 - x0 + 2 * p; o.height = y1 - y0 + 2 * p;
    o.getContext('2d').drawImage(cv, x0 - p, y0 - p, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  function open(title) {
    return new Promise(res => {
      if (!document.getElementById('pelsigcss')) { const s = document.createElement('style'); s.id = 'pelsigcss'; s.textContent = css; document.head.appendChild(s); }
      const m = document.createElement('div'); m.className = 'pelsig';
      m.innerHTML = `<div class="pelsig-box"><b></b><p>Υπογράψτε με το δάχτυλο ή το Pencil μέσα στο πλαίσιο.</p><canvas></canvas><div class="pelsig-r"><button data-a="c">Καθαρισμός</button><button data-a="x">Άκυρο</button><button class="ok" data-a="ok">Αποθήκευση & κλείσιμο</button></div></div>`;
      m.querySelector('b').textContent = title || 'Υπογραφή';
      document.body.appendChild(m);
      const cv = m.querySelector('canvas'), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = r.width * dpr; cv.height = r.height * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
      g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0d1f6b'; let dn = false, dirty = false;
      const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
      cv.onpointerdown = e => { dn = true; dirty = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); };
      cv.onpointermove = e => { if (!dn) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); };
      cv.onpointerup = cv.onpointercancel = () => { dn = false; };
      m.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return;
        if (a === 'c') { g.clearRect(0, 0, cv.width, cv.height); dirty = false; }
        if (a === 'x') { m.remove(); res(null); }
        if (a === 'ok') { const d = dirty ? trim(cv) : ''; m.remove(); res(d || null); } };
    });
  }
  function bytes(dataUrl) { if (!dataUrl) return null; const b = atob(dataUrl.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  window.PELSIG = { open, bytes, trim };
})();
