import * as C from './controls.js';
const $ = s => document.querySelector(s), inr = C.inr;
const today = C.todayIso();

// countdown to the FY 2025-26 credit-note deadline
{ const d = C.daysBetween(today, '2026-11-30'), b = $('#cd-days'), t = $('#cd-text');
  if (b) { if (d >= 0) b.textContent = d; else { b.textContent = 'Closed'; t.textContent = 'FY 2025-26 credit-note window shut on 30 Nov 2026'; } } }

const root = $('#demo');
if (root) {
  const steps = C.walkthrough(today);
  const M = [
    [['buyer', 'Navkar Traders', 'Give us 6% on the March invoice, or we move volume next quarter.'], ['me', 'Neha · commercial', 'Asking for 6% (₹60,000) as a post-sale discount.'], ['ok', 'Break-even: needs +13.3% extra volume. Navkar is at +16.3% on its usual ₹8,60,000, so it pays back.']],
    [['me', 'Neha · commercial', 'It\'s urgent, approving it myself.'], ['bad', 'Refused: the person who asked can\'t approve (C2).']],
    [['them', 'Vikram · finance controller', 'Approved 6%, within my 8% limit.'], ['ok', 'Sealed. The break-even was on record before the approval.']],
    [['them', 'Farah · tax desk', 'GST credit note CN-26-041 issued. Rule in force since 1 Nov 2026: no prior agreement needed.'], ['warn', '₹10,800 GST cut now waits on Navkar accepting in IMS. Deadline 30 Nov 2026.']],
    [['buyer', 'IMS · Navkar Traders', 'Rejected: "Wrong invoice reference".'], ['bad', '₹10,800 of tax comes back (Rule 67B). Ticket opened for Asha in receivables, due in 2 working days.']],
    [['them', 'Farah · tax desk', 'Reissued as CN-26-042 with the right invoice reference.'], ['buyer', 'IMS · Navkar Traders', 'Accepted.'], ['ok', 'The GST cut holds. Ticket closed.']],
    [['day', '3 weeks later'], ['ok', '₹9,40,000 received. Matches the approved net.']],
    [['ok', 'All 7 controls pass. Every entry is fingerprinted: change one and C7 names it.']],
  ];
  let typing = null, i = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, timer = null;
  const T = { me: '4:12 pm ✓✓', them: '4:20 pm', buyer: '4:31 pm' };
  const bubble = ([k, a, b]) => k === 'day' ? `<div class="td">${a}</div>` : ['ok', 'bad', 'warn'].includes(k) ? `<div class="ts ${k}"><span>${a}</span></div>` : `<div class="tb ${k}"><p class="tb-w">${a}</p><div class="tb-m">${b}<span class="tm">${T[k] ?? ''}</span></div></div>`;
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
    $('#dm-c').innerHTML = r.controls.map(c => { const st = refused && c.id === 'C2' ? 'fail' : c.status; return `<li class="${st}"><i></i><b>${c.id} ${c.name}</b><span>${st === 'pass' ? 'Pass' : st === 'fail' ? 'Fail' : 'Waiting'}</span></li>`; }).join('');
    $('#ph-cs').innerHTML = r.controls.map(c => { const st = refused && c.id === 'C2' ? 'fail' : c.status; return `<span class="${st}"><i></i>${c.id}</span>`; }).join('');
    const c5 = r.controls[4].status, gst = r.gst, cash = r.controls[5].status;
    const gstState = !s.d.cnNo ? ['wait', 'Not issued yet'] : c5 === 'fail' ? ['bad', `${inr(gst)} comes back`] : c5 === 'pass' ? ['ok', `${inr(gst)} secured`] : ['wait', `${inr(gst)} waiting on IMS`];
    $('#dm-m').innerHTML = `<div><span>Discount</span><b>${inr(e.discount)}</b></div><div><span>Extra margin from extra volume</span><b class="ok">${inr(e.extraMargin)}</b><small>net ${e.net >= 0 ? '+' : '−'}${inr(Math.abs(e.net))}</small></div><div><span>GST cut</span><b class="${gstState[0]}">${gstState[1]}</b></div><div><span>Cash</span><b class="${cash === 'pass' ? 'ok' : 'wait'}">${cash === 'pass' ? `${inr(s.d.received)} matched` : `${inr(C.netDue(s.d))} due`}</b></div>`;
    const tk = r.tickets.find(t => t.control === 'C5');
    $('#dm-tk').innerHTML = tk ? `<div class="dm-t"><span class="dm-tl">now</span><b>Incident · C5 Recovery failed · Navkar Traders</b><small>Assigned to ${tk.owner.who}, ${tk.owner.role} · due ${new Date(tk.due + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · ₹${tk.rupees.toLocaleString('en-IN')} at stake</small></div>` : '';
    $('#dm-play').textContent = playing ? '❚❚ Pause' : i === steps.length - 1 ? '↺ Replay' : '▶ Play';
  }
  const go = (n, anim = true) => { i = Math.max(0, Math.min(steps.length - 1, n)); draw(anim); };
  const tick = () => { clearTimeout(timer); if (!playing) return; timer = setTimeout(() => { if (i < steps.length - 1) { go(i + 1); tick(); } else { playing = false; draw(false); } }, i === 0 ? 4200 : 3600); };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-dm]'); if (!b) return;
    if (b.dataset.dm === 'play') { if (!playing && i === steps.length - 1) go(0); playing = !playing; draw(false); tick(); return; }
    playing = false; clearTimeout(timer); if (b.dataset.dm === 'next' && i === steps.length - 1) return go(0); go(i + (b.dataset.dm === 'next' ? 1 : -1));
  });
  // start playing only once the demo is on screen
  go(0, false);
  if (playing) new IntersectionObserver((en, ob) => { if (en[0].isIntersecting) { ob.disconnect(); tick(); } }, { threshold: .35 }).observe(root);
}
