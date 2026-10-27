/* Ροή «Νέα εξέταση»: Εξέταση → Φόρμα & PDF → Χρέωση / Τιμολόγιο → 801.
   Κρατιέται στο sessionStorage· μια μπάρα κάτω δείχνει πού είσαι και το επόμενο βήμα. */
(function (root) {
  const K = 'pelflow';
  const get = () => { try { return JSON.parse(sessionStorage.getItem(K) || 'null'); } catch (e) { return null; } };
  const set = o => { try { o ? sessionStorage.setItem(K, JSON.stringify(o)) : sessionStorage.removeItem(K); } catch (e) { } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\?.*/, '');
  const on = {}; /* ενέργειες που δηλώνει η κάθε σελίδα (Γραφείο) */

  const css = `#pelflow{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#0f1a27;color:#fff;padding:10px 14px calc(env(safe-area-inset-bottom) + 10px);
display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 -4px 18px rgba(0,0,0,.25);font:600 14px -apple-system,system-ui,sans-serif}
#pelflow .st{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:1;min-width:0}
#pelflow .s{padding:5px 9px;border-radius:8px;background:#22324a;color:#9fb0c8;white-space:nowrap;font-size:13px}
#pelflow .s.done{background:#1f4d34;color:#bfe8cf}#pelflow .s.cur{background:#d99a3c;color:#14202e}
#pelflow .nm{color:#d99a3c;margin-right:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
#pelflow button{font:inherit;border:0;border-radius:10px;padding:9px 13px;cursor:pointer;white-space:nowrap}
#pelflow .go{background:#d99a3c;color:#14202e}#pelflow .go[disabled]{opacity:.45}
#pelflow .alt{background:#22324a;color:#dfe7f2}#pelflow .x{background:transparent;color:#9fb0c8;padding:9px 6px}
body.flowon{padding-bottom:84px}body.flowon .fab{bottom:calc(env(safe-area-inset-bottom) + 84px)!important}`;

  const STEPS = ['Εξέταση', 'Φόρμα & PDF', 'Χρέωση / Τιμολόγιο', '801'];
  function draw() {
    let el = document.getElementById('pelflow'); const f = get();
    if (!f) { if (el) el.remove(); document.body.classList.remove('flowon'); return; }
    if (!document.getElementById('pelflowcss')) { const s = document.createElement('style'); s.id = 'pelflowcss'; s.textContent = css; document.head.appendChild(s); }
    if (!el) { el = document.createElement('div'); el.id = 'pelflow'; document.body.appendChild(el); }
    document.body.classList.add('flowon');
    const off = page === 'office.html', cur = off ? (f.step === '801' ? 3 : 2) : 1;
    let btns;
    if (!off) btns = f.log ? `<button class="go" data-flow="next">Επόμενο: Χρέωση / Τιμολόγιο ›</button>`
      : `<button class="go" disabled title="Βγάλε πρώτα το PDF">Επόμενο ›</button>`;
    else if (f.step !== '801') btns = `<button class="alt" data-flow="edit">Χρέωση</button><button class="go" data-flow="inv">Τιμολόγιο</button><button class="alt" data-flow="801">801 ›</button>`;
    else btns = `<button class="alt" data-flow="inv">‹ Τιμολόγιο</button><button class="go" data-flow="end">✓ Τέλος</button>`;
    el.innerHTML = `<div class="st"><span class="nm">${esc(f.name || f.label || '')}</span>${STEPS.map((t, i) => `<span class="s ${i < cur ? 'done' : i === cur ? 'cur' : ''}">${i < cur ? '✓ ' : ''}${t}</span>`).join('')}</div>${btns}<button class="x" data-flow="quit" title="Έξοδος από τη ροή">✕</button>`;
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-flow]'); if (!b) return; ev.stopPropagation(); const a = b.dataset.flow, f = get();
    if (a === 'quit') { if (confirm('Έξοδος από τη ροή «Νέα εξέταση»;\n(Ό,τι έχεις κάνει μένει αποθηκευμένο.)')) { set(null); draw(); } return; }
    if (a === 'end') { set(null); location.href = 'home.html'; return; }
    if (a === 'next') { if (f && f.log) { f.step = 'inv'; set(f); location.href = 'office.html?flow=1'; } return; }
    if (on[a]) on[a](f);
  }, true);

  root.PELFLOW = {
    get, set, draw, on,
    start(type, label) { set({ type, label, log: null, step: 'form' }); },
    setLog(id, name) { const f = get(); if (!f) return; f.log = id; if (name) f.name = name; set(f); draw(); },
    step(s) { const f = get(); if (!f) return; f.step = s; set(f); draw(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw); else draw();
})(window);
