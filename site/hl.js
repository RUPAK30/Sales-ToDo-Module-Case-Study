/* Mounts Hairline line figures on any element with data-hl="<figure>", only when it scrolls into view. */
const els = [...document.querySelectorAll('[data-hl]')];
if (els.length) {
  let lib;
  const mount = async el => {
    lib ??= await import('./vendor/hairline.js');
    const f = lib[el.dataset.hl]; if (!f || el._hl) return;
    el._hl = f(el, { intensity: +(el.dataset.hlIntensity ?? 0.55), play: true, theme: 'light', label: el.dataset.hlLabel });
  };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); } }), { rootMargin: '200px' });
  els.forEach(el => io.observe(el));
}
