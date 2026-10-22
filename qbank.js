/* Κοινό παράθυρο ερωτήσεων (tap → απάντηση) για σετ τύπου {CATS, BANK}.
   QBANK.open([{ key:'cpl', title:'CPL', data: window.CPLQ }, …])  – νέο σετ (π.χ. Wizz Air) = νέο αντικείμενο στη λίστα. */
(function () {
  const css = `.qbm{position:fixed;inset:0;background:rgba(10,18,30,.6);z-index:30;display:flex;justify-content:center;align-items:flex-start;padding:calc(env(safe-area-inset-top) + 14px) 14px 14px}
.qbm .qbx{background:#fff;color:#14213d;border-radius:16px;width:100%;max-width:820px;max-height:calc(100vh - 30px);overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 16px;font:16px/1.4 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
.qbm .qh{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.qbm .qh b{flex:1;font-size:16px}
.qbm button{font:inherit}
.qbm .qb{border:0;border-radius:9px;padding:7px 11px;font-size:13px;font-weight:650;background:#e7ecf5;color:#14202e}
.qbm .qb.dk{background:#14202e;color:#fff}
.qbm .sg{display:flex;flex-wrap:wrap;gap:4px;background:#e7ecf5;border-radius:10px;padding:3px;margin:8px 0}
.qbm .sg button{border:0;background:transparent;padding:7px 10px;border-radius:8px;font-size:13.5px;font-weight:600;color:#2b3d52}
.qbm .sg button.on{background:#14202e;color:#fff}
.qbm .ht{font-size:12.5px;color:#5d6b82}
.qbm .fq{border-top:1px solid #d8dee9;padding:10px 2px}
.qbm .fqq{border:0;background:none;font-weight:650;text-align:left;padding:0;color:#14213d;width:100%;font-size:15.5px}
.qbm .k{color:#2b3d52;font-size:12.5px;margin-right:4px}
.qbm ol{list-style:none;margin:6px 0;padding-left:4px;font-size:14.5px}.qbm li{padding:3px 6px;border-radius:7px;margin:2px 0}
.qbm li.ok{background:#dcf2e5;color:#1d8a4e;font-weight:600}.qbm li.no{color:#5d6b82}
.qbm .fqe{font-size:14px;background:#f4f6fa;border-left:3px solid #1d8a4e;padding:7px 10px;border-radius:0 8px 8px 0}`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  function open(sets, start) {
    sets = sets.filter(s => s.data && s.data.BANK);
    if (!sets.length) return;
    if (!document.getElementById('qbcss')) { const st = document.createElement('style'); st.id = 'qbcss'; st.textContent = css; document.head.appendChild(st); }
    let set = sets.find(s => s.key === start) || sets[0], sel = 'all', shown = {};
    const L = 'ABCD';
    const m = document.createElement('div'); m.className = 'qbm';
    const draw = () => {
      const { CATS, BANK } = set.data;
      const list = BANK.map((q, i) => [q, i]).filter(([q]) => sel === 'all' || q.cat === sel);
      m.innerHTML = `<div class="qbx"><div class="qh"><b>${esc(set.title)} · ερωτήσεις</b><button class="qb" data-all="1">Όλες οι απαντήσεις</button><button class="qb dk" data-x="1">Κλείσιμο</button></div>
        ${sets.length > 1 ? `<div class="sg">${sets.map(s => `<button data-set="${s.key}" class="${s === set ? 'on' : ''}">${esc(s.title)} (${s.data.BANK.length})</button>`).join('')}</div>` : ''}
        <div class="sg"><button data-c="all" class="${sel === 'all' ? 'on' : ''}">Όλα (${BANK.length})</button>${CATS.filter(c => BANK.some(q => q.cat === c.id)).map(c => `<button data-c="${c.id}" class="${sel === c.id ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</div>
        ${list.map(([q, i], n) => `<div class="fq"><button class="fqq" data-t="${i}"><span class="k">${n + 1}.</span> ${esc(q.q)}</button>${q.ref ? `<div class="ht">${esc(q.ref)}</div>` : ''}
          <ol>${q.o.map((o, k) => `<li class="${shown[i] ? (k === q.a ? 'ok' : 'no') : ''}"><b>${L[k]}.</b> ${esc(o)}${shown[i] ? (k === q.a ? ' <b>✓</b>' : ' ✗') : ''}</li>`).join('')}</ol>
          ${shown[i] ? `<div class="fqe">${esc(q.e)}</div>` : `<button class="qb" data-t="${i}">Δείξε απάντηση</button>`}</div>`).join('')}</div>`;
    };
    const keep = f => { const bx = m.querySelector('.qbx'), st = bx ? bx.scrollTop : 0; f(); draw(); m.querySelector('.qbx').scrollTop = st; };
    m.addEventListener('click', e => {
      e.stopPropagation(); const b = e.target.closest('button'); if (!b) { if (e.target === m) m.remove(); return; }
      if (b.dataset.x) return m.remove();
      if (b.dataset.set) { set = sets.find(s => s.key === b.dataset.set); sel = 'all'; shown = {}; draw(); return; }
      if (b.dataset.c) { sel = b.dataset.c; draw(); m.querySelector('.qbx').scrollTop = 0; return; }
      if (b.dataset.all) return keep(() => { const vis = set.data.BANK.map((q, i) => i).filter(i => sel === 'all' || set.data.BANK[i].cat === sel); const any = vis.some(i => !shown[i]); vis.forEach(i => shown[i] = any); });
      if (b.dataset.t) return keep(() => { const i = +b.dataset.t; shown[i] = !shown[i]; });
    });
    draw(); document.body.appendChild(m);
  }
  window.QBANK = { open };
})();
