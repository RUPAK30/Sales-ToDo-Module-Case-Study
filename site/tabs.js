/* Sections for a static page: one fixed set, its own #hash each, back button works, each remembers its scroll. */
(function () {
  var TABS = [['overview', 'Overview', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'], ['try', 'Try it', 'M8 5v14l11-7z'], ['spec', 'Spec', 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6'], ['sources', 'Sources', 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM20 17v4H6.5']];
  var ALIAS = { proof: 'try', sources: 'sources' };
  var nav = document.createElement('nav'); nav.className = 'sx-bar'; nav.setAttribute('aria-label', 'Sections');
  nav.innerHTML = '<ul>' + TABS.map(function (t) { return '<li><a href="#' + t[0] + '" data-go="' + t[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + t[2] + '"/></svg><span>' + t[1] + '</span></a></li>'; }).join('') + '</ul>';
  var head = document.querySelector('header.appbar'); head.parentNode.insertBefore(nav, head.nextSibling);
  var cur = null, mem = {};
  function pick() { var h = location.hash.slice(1); return TABS.some(function (t) { return t[0] === h; }) ? h : (ALIAS[h] || 'overview'); }
  function show(t, restore) {
    if (cur) mem[cur] = window.scrollY;
    cur = t; document.body.dataset.tab = t;
    document.querySelectorAll('[data-sec]').forEach(function (el) { el.classList.toggle('on', el.dataset.sec.split(' ').indexOf(t) > -1); });
    nav.querySelectorAll('a').forEach(function (a) { if (a.dataset.go === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo({ top: restore ? (mem[t] || 0) : 0, behavior: 'instant' });
  }
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-go]'); if (!a) return; e.preventDefault();
    var t = a.dataset.go;
    if (t === cur) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    history.pushState(null, '', '#' + t); show(t, true);
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a || a.dataset.go) return;
    var id = a.getAttribute('href').slice(1), t = TABS.some(function (x) { return x[0] === id; }) ? id : ALIAS[id];
    if (!t) return; e.preventDefault(); history.pushState(null, '', '#' + t); show(t, false);
  });
  window.addEventListener('popstate', function () { show(pick(), true); });
  show(pick(), false);
})();
