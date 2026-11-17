import * as C from './controls.js';
const $ = s => document.querySelector(s), inr = C.inr;
const today = C.todayIso();

// countdown: the open s.34(2) window for the latest closed financial year; rolls to the next one after 30 Nov
{ const y = +today.slice(0, 4), cap = today <= `${y}-11-30` ? `${y}-11-30` : `${y + 1}-11-30`, fy = `${+cap.slice(0, 4) - 1}-${cap.slice(2, 4)}`;
  const b = $('#cd-days'), t = $('#cd-text');
  if (b) { b.textContent = C.daysBetween(today, cap); t.textContent = `left to fix last year's tax paperwork (30 Nov ${cap.slice(0, 4)}).`; } }

// money found in the sample: same engine, same data as the app
const list = C.sampleDesk(), K = C.desk(list, { today, settings: C.SETTINGS, history: C.HISTORY, opened: C.OPENED });
const lost = K.rows.filter(x => x.d.approvedBy && x.r.economics.net < 0), lostAmt = lost.reduce((a, x) => a - x.r.economics.net, 0);
const lostSpend = lost.reduce((a, x) => a + x.r.economics.discount, 0), badShare = Math.round(lostSpend / K.spent * 100);
const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
const lakh = n => '₹' + (n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' lakh';
set('#m-spent', lakh(K.spent)); set('#m-stake', '₹' + Math.round((lostAmt + K.gstAtRisk + K.short) / K.spent * 100)); set('#m-abs', lakh(lostAmt + K.gstAtRisk + K.short)); set('#m-lost', inr(lostAmt)); set('#m-gst', inr(K.gstAtRisk)); set('#m-short', inr(K.short));
set('#m-ns', '₹' + (K.earned / K.spent).toFixed(2));
{ // 100 coins: one per rupee of every ₹100 given back
  const box = document.getElementById('coins');
  if (box) {
    const raw = { l: lostAmt / K.spent * 100, g: K.gstAtRisk / K.spent * 100, s: K.short / K.spent * 100 };
    const n = { l: Math.round(raw.l), g: Math.round(raw.g), s: Math.round(raw.s) };
    const stake = Math.round((lostAmt + K.gstAtRisk + K.short) / K.spent * 100); n.l += stake - (n.l + n.g + n.s);
    n.k = 100 - n.l - n.g - n.s;
    // An isometric block of ₹100, drawn in the same hairline style as the figures below it, cut into four slabs.
    const C = Math.cos(Math.PI / 6), S = 0.5, W = 64, D = 64, U = 1.25; // U = px of height per rupee
    const P = (x, y, z) => `${(62 + (x - y) * C).toFixed(1)},${(148 + (x + y) * S - z).toFixed(1)}`;
    const box = (z0, h) => {
      const z1 = z0 + h;
      return `<path class="sf sf-l" d="M${P(0, D, z0)} L${P(W, D, z0)} L${P(W, D, z1)} L${P(0, D, z1)}Z"/>
        <path class="sf sf-r" d="M${P(W, 0, z0)} L${P(W, D, z0)} L${P(W, D, z1)} L${P(W, 0, z1)}Z"/>
        <path class="sf sf-t" d="M${P(0, 0, z1)} L${P(W, 0, z1)} L${P(W, D, z1)} L${P(0, D, z1)}Z"/>
        <path class="sf-in" d="M${P(9, 9, z1)} L${P(W - 9, 9, z1)} L${P(W - 9, D - 9, z1)} L${P(9, D - 9, z1)}Z"/>`;
    };
    const order = [['k', 'comes back'], ['s', 'paid short'], ['g', 'GST waiting'], ['l', 'lost']];
    let z = 0, gap = 3, out = '';
    order.forEach(([c, name], idx) => {
      const h = Math.max(4, n[c] * U), mid = z + h / 2, [lx, ly] = P(W, 0, mid).split(',').map(Number);
      out += `<g class="sl sl-${c}" style="--i:${idx}">${box(z, h)}<path class="ld" d="M${lx + 2},${ly} h14"/><text x="${lx + 19}" y="${ly + 3.5}"><tspan class="tn">₹${n[c]}</tspan> ${name}</text></g>`;
      z += h + gap;
    });
        const host = document.getElementById('coins');
    host.className = 'slabs'; host.setAttribute('aria-label', `A block of ₹100 cut into four slabs: ₹${n.k} comes back, ₹${n.s} paid short, ₹${n.g} GST waiting, ₹${n.l} lost`);
    host.innerHTML = `<svg viewBox="0 -6 250 226" aria-hidden="true">${out}</svg>`;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tiles = [...document.querySelectorAll('.mny-g [data-seg]')];
    const setHi = c => { if (c) host.dataset.hi = c; else delete host.dataset.hi; tiles.forEach(t => t.classList.toggle('hot', t.dataset.seg === c)); };
    const cycle = ['l', 'g', 's', 'k']; let ci = 0, timer = null, busy = false;
    const play = () => { if (calm || timer) return; timer = setInterval(() => { if (!busy) setHi(cycle[ci++ % 4]); }, 1700); };
    host.addEventListener('pointermove', e => { busy = true; const r = host.getBoundingClientRect(), f = (e.clientY - r.top) / r.height; setHi(f < .36 ? 'l' : f < .47 ? 'g' : f < .58 ? 's' : 'k'); });
    host.addEventListener('pointerleave', () => { busy = false; setHi(null); });
    tiles.forEach(t => { t.addEventListener('mouseenter', () => busy = true); t.addEventListener('mouseleave', () => busy = false); });
    const go = () => { host.classList.add('in'); setTimeout(play, 1400); };
    if (calm || !('IntersectionObserver' in window)) go(); else { const io = new IntersectionObserver(e => { if (e[0].isIntersecting) { go(); io.disconnect(); } }, { threshold: .4 }); io.observe(host); }
    document.querySelectorAll('.mny-g [data-seg]').forEach(t => {
      const hostEl = document.getElementById('coins'); const on = () => { hostEl.dataset.hi = t.dataset.seg; document.querySelectorAll('.mny-g [data-seg]').forEach(x => x.classList.toggle('hot', x === t)); }, off = () => { delete hostEl.dataset.hi; document.querySelectorAll('.mny-g .hot').forEach(x => x.classList.remove('hot')); };
      t.addEventListener('mouseenter', on); t.addEventListener('mouseleave', off); t.addEventListener('focus', on); t.addEventListener('blur', off);
    });
  }
}
{ const h = $('#hook'); if (h) h.addEventListener('click', () => { const back = Math.round(K.earned / K.spent * 100); h.setAttribute('aria-expanded', 'true'); h.classList.add('open');
  set('#hook-v', `₹${back}`); set('#hook-s', `On 10 sample discounts, every ₹100 given back brought only ₹${back} of extra profit. Ten Today shows this before anyone says yes.`); }); }

// what it's worth at your scale
{ const bad = $('#w-bad'); if (bad) bad.value = badShare;
  const cr = n => '₹' + (n >= 1 ? n.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' crore' : Math.round(n * 100).toLocaleString('en-IN') + ' lakh');
  const calc = () => { const v = id => +$(id).value || 0, rev = v('#w-rev'), tr = v('#w-trade'), b = v('#w-bad'), po = v('#w-post'), spend = rev * tr / 100;
    set('#w-rev-v', cr(rev)); set('#w-trade-v', tr + '% of sales'); set('#w-bad-v', b + '%'); set('#w-post-v', po + '%');
    $('#w-ans').innerHTML = `A <b>${cr(rev)}</b> company gives about <b>${cr(spend)}</b> a year back to retailers. Roughly <b class="bad">${cr(spend * b / 100)}</b> of it never comes back as extra sales.`;
    $('#w-b1').style.width = (100 - b) + '%'; $('#w-b2').style.width = b + '%'; set('#w-o3', cr(spend * po / 100 * 0.18)); };
  document.querySelectorAll('.wk-sl input').forEach(i => i.addEventListener('input', calc)); if ($('#w-rev')) calc(); }

const root = $('#demo');
if (root) {
  const steps = C.walkthrough(today);
  const M = [ // one group per walkthrough step; [kind, who, text, time]. The Meera File.
    [['buyer', 'Meera Trading', 'Give us 8% on the March invoice. We\'ll push your range this quarter.', '10:02 am'], ['me', 'Neha · sales', 'Asking for 8% (₹64,000) back on the ₹8 lakh bill.', '10:05 am ✓✓'], ['warn', 'To be worth it, Meera must buy 18.5% more than usual.']],
    [['me', 'Neha · sales', 'It\'s urgent, approving it myself.', '10:07 am ✓✓'], ['bad', 'Blocked: the person who asks can\'t say yes.']],
    [['them', 'Vikram · finance', 'Approved 8%, exactly my limit. I saw the break-even.', '11:40 am'], ['ok', 'Right person, within limit.']],
    [['them', 'Farah · tax', 'GST credit note CN-26-032 sent and reported.', '2:30 pm'], ['warn', '₹11,520 of GST now waits for Meera to accept it on the GST portal.']],
    [['day', '2 days later'], ['buyer', 'GST portal · Meera Trading', 'Rejected: "Slab not met: 180 cases billed, slab starts at 200".', '9:10 am'], ['bad', '₹11,520 of GST at risk. Incident for Asha, 48 hours. Meera blocked from new discounts.']],
    [['day', '3 days later'], ['buyer', 'Bank · Meera Trading', '₹7,36,000 received.', '10:45 am'], ['ok', 'Every Rupee: the bill minus ₹64,000, to the rupee.']],
    [['them', 'Farah · tax', 'Meera is right, she never hit the slab. Settling it as a financial credit note.', '11:20 am'], ['warn', 'Closed. The ₹11,520 tax cut is given up on the record, not hidden.']],
    [['bad', 'One question still says no: Meera bought nothing extra. ₹64,000 bought no sales.'], ['ok', 'Every step is fingerprinted: change one later and it shows.']],
  ];
  let typing = null, i = 0, timer = null, inView = false, manual = false, started = false, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PLAIN = { C1: 'Worth it?', C2: 'Right person?', C3: 'Really a price cut?', C4: 'Paperwork on time?', C5: 'Retailer accepted?', C6: 'Right money?', C7: 'Record untouched?' };
    const bubble = ([k, a, b, m3]) => k === 'day' ? `<div class="td">${a}</div>` : ['ok', 'bad', 'warn'].includes(k) ? `<div class="ts ${k}"><span>${a}</span></div>` : `<div class="tb ${k}"><p class="tb-w">${a}</p><div class="tb-m">${b}<span class="tm">${m3 ?? ''}</span></div></div>`;
  function draw(anim) {
    const s = steps[i], r = C.evaluate(s.d, { today, settings: C.SETTINGS, history: {}, opened: {} }), e = r.economics;
    const refused = s.t.startsWith('Self');
    $('#dm-n').textContent = `${i + 1} / ${steps.length}`;
    $('#dm-prog').style.width = `${(i + 1) / steps.length * 100}%`;
    $('#dm-cap').innerHTML = `<b>${s.t}.</b> ${s.s}`;
    const box = $('#dm-msgs'), past = M.slice(0, i).map(g => g.map(bubble).join('')).join(''), now = M[i].map(m => bubble(m).replace(/^<div class="/, '<div class="in ')).join('');
    clearTimeout(typing);
    if (anim && M[i][0][0] !== 'day') {
      const who = ['bad', 'ok', 'warn'].includes(M[i][0][0]) ? 'Ten Today is checking' : `${M[i][0][1].split(' · ')[0]} is typing`;
      box.innerHTML = past + `<div class="ty"><span>${who}</span><i></i><i></i><i></i></div>`; box.scrollTop = box.scrollHeight;
      typing = setTimeout(() => { box.innerHTML = past + now; box.scrollTop = box.scrollHeight; }, 750);
    } else { box.innerHTML = past + now; box.scrollTop = box.scrollHeight; }
    $('.ph-tap').textContent = i === steps.length - 1 ? '↺ Tap to replay' : 'Tap for the next step →';
    const prev = i > 0 ? C.evaluate(steps[i - 1].d, { today, settings: C.SETTINGS, history: {}, opened: {} }).controls : null;
    const OWN = { C1: 'Vikram', C2: 'Vikram', C3: 'Farah', C4: 'Farah', C5: 'Asha', C6: 'Asha', C7: 'Audit' };
    const stOf = (c, d) => refused && c.id === 'C2' ? 'fail' : c.id === 'C5' && !d.cnNo ? 'idle' : c.status;
    const ICON = { pass: '<svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>', fail: '<svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6"/></svg>', wait: '<i></i>', idle: '' };
    const LBL = { pass: 'Yes', fail: 'No', wait: 'Waiting', idle: 'Not yet' };
    $('#dm-c').innerHTML = r.controls.map((c, k) => { const st = stOf(c, s.d), was = prev ? (i - 1 === 1 && c.id === 'C2' ? 'fail' : stOf(prev[k], steps[i - 1].d)) : st, ch = prev && st !== was;
      return `<li class="${st}${ch ? ' ch' : ''}"><span class="dn">${ICON[st]}</span><b>${PLAIN[c.id]}</b><em>${OWN[c.id]}</em><span class="dl">${LBL[st]}</span>${ch || (st === 'fail') ? `<small>${(c.text.split(' · ')[0].match(/^.*?\.(?=\s|$)/) || [c.text.split(' · ')[0]])[0]}</small>` : ''}</li>`; }).join('');
    $('#ph-cs').innerHTML = r.controls.map(c => { const st = stOf(c, s.d); return `<span class="${st}"><i></i>${c.id}</span>`; }).join('');
    const c5 = r.controls[4].status, gst = r.gst, cash = r.controls[5].status, max = Math.max(e.discount, e.extraMargin);
    const gstState = !s.d.cnNo ? ['idle', 'Not sent yet', 0] : c5 === 'fail' ? ['bad', 'Rejected: at risk', 35] : c5 === 'pass' ? ['ok', 'Accepted: safe', 100] : ['wait', 'Waiting on Meera', 60];
    const due = C.netDue(s.d), got = cash === 'pass' ? s.d.received : 0;
    $('#dm-m').innerHTML = `<div class="lg"><p class="lg-k">Worth it?</p>
        <div class="lg-r"><span>Given back</span><i class="out" style="--w:${e.discount / max * 100}%"></i><b>${inr(e.discount)}</b></div>
        <div class="lg-r"><span>Extra profit</span><i class="in" style="--w:${e.approvedBy || i >= 2 ? e.extraMargin / max * 100 : 0}%"></i><b class="ok">${i >= 2 ? inr(e.extraMargin) : '—'}</b></div>
        <p class="lg-n">${i >= 2 ? `Net <span class="${e.net >= 0 ? 'ok' : 'bad'}">${e.net >= 0 ? '+' : '−'}${inr(Math.abs(e.net))}</span>: it paid for itself` : 'Shown before anyone says yes'}</p></div>
      <div class="lg2"><div class="g ${gstState[0]}"><p class="lg-k">GST on it</p><b>${inr(gst)}</b><span class="mt"><i style="--w:${gstState[2]}%"></i></span><small>${gstState[1]}</small></div>
      <div class="g ${got ? 'ok' : 'idle'}"><p class="lg-k">Cash</p><b>${inr(due)}</b><span class="mt"><i style="--w:${got ? 100 : 0}%"></i></span><small>${got ? 'Received, to the rupee' : 'Due from Meera'}</small></div></div>`;
    const tk = r.tickets.find(t => t.control === 'C5');
    $('#dm-tk').innerHTML = tk ? `<div class="dm-t"><span class="dm-tl">Ticket</span><b>INC · Retailer rejected the credit note · Meera Trading</b><small>Asha, receivables · due ${new Date(tk.due + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · ₹${tk.rupees.toLocaleString('en-IN')} at stake</small></div>` : '';
    $('#dm-play').textContent = playing ? '❚❚ Pause' : i === steps.length - 1 ? '↺ Replay' : '▶ Play';
  }
  const go = (n, anim = true) => { i = Math.max(0, Math.min(steps.length - 1, n)); draw(anim); };
  // reading pace: time to read what just appeared, plus the typing beat; never rushed, never dragging
  const dwell = n => { const words = M[n].map(m => (m[2] || m[1] || '')).join(' ').split(/\s+/).length; return Math.min(7000, 2400 + words * 170); };
  const tick = () => { clearTimeout(timer); if (!playing || !inView) return; timer = setTimeout(() => { if (i < steps.length - 1) { go(i + 1); tick(); } else { playing = false; draw(false); } }, dwell(i)); };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-dm]'); if (!b) return;
    if (b.dataset.dm === 'play') { manual = false; if (!playing && i === steps.length - 1) go(0); playing = !playing; draw(false); tick(); return; }
    manual = true; playing = false; clearTimeout(timer); if (b.dataset.dm === 'next' && i === steps.length - 1) return go(0); go(i + (b.dataset.dm === 'next' ? 1 : -1));
  });
  // Plays by itself when the phone comes into view, pauses when it scrolls away, picks up where it left off.
  go(0, false);
  const phone = root.querySelector('.ph-fr') || root;
  new IntersectionObserver(en => {
    inView = en[0].isIntersecting;
    if (!inView) { clearTimeout(timer); clearTimeout(typing); return; }
    if (manual || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!started) { started = true; playing = true; go(0, true); tick(); return; }
    if (playing) { draw(false); tick(); }
  }, { threshold: .55 }).observe(phone);
}
