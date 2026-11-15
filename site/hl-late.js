/* The app redraws its screens, so mount figures as they appear and stop the ones that were removed. */
let lib; const live = new Map();
const mount = async el => { live.set(el, null); lib ??= await import('./vendor/hairline.js'); const f = lib[el.dataset.hl]; if (f && el.isConnected) live.set(el, f(el, { intensity: 0.55, play: true, theme: 'light', label: el.dataset.hlLabel })); };
const scan = () => {
  for (const [el, fig] of live) if (!el.isConnected) { fig?.destroy(); live.delete(el); }
  document.querySelectorAll('[data-hl]').forEach(el => { if (!live.has(el)) mount(el); });
};
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); scan();
