/* Ώρες σε μορφή 24ώρου: τα πεδία ώρας γίνονται κείμενο (π.χ. 1320 → 13:20) */
(function () {
  function norm(v) {
    const d = String(v || '').replace(/[^\d]/g, '');
    if (!d) return '';
    let h, m;
    if (d.length <= 2) { h = +d; m = 0; } else { h = +d.slice(0, d.length - 2); m = +d.slice(-2); }
    if (h > 23 || m > 59) return null;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function conv(root) {
    (root || document).querySelectorAll('input[type="time"]').forEach(el => {
      el.type = 'text'; el.setAttribute('inputmode', 'numeric'); el.setAttribute('placeholder', 'ωω:λλ'); el.setAttribute('maxlength', '5'); el.dataset.hm = '1';
    });
  }
  new MutationObserver(() => conv()).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => conv());
  document.addEventListener('input', e => { const el = e.target; if (!el.dataset || !el.dataset.hm) return;
    const d = el.value.replace(/[^\d]/g, ''); if (d.length === 4 && !el.value.includes(':')) { const n = norm(d); if (n) el.value = n; } }, true);
  document.addEventListener('focusout', e => { const el = e.target; if (!el.dataset || !el.dataset.hm) return;
    const n = norm(el.value); if (n === null) { el.style.outline = '2px solid #c62f2f'; return; } el.style.outline = '';
    if (n !== el.value) { el.value = n; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } }, true);
})();
