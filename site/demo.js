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
set('#m-spent', lakh(K.spent)); set('#m-stake', lakh(lostAmt + K.gstAtRisk + K.short)); set('#m-lost', inr(lostAmt)); set('#m-gst', inr(K.gstAtRisk)); set('#m-short', inr(K.short));
set('#m-ns', '₹' + (K.earned / K.spent).toFixed(2));
{ const h = $('#hook'); if (h) h.addEventListener('click', () => { const back = Math.round(K.earned / K.spent * 100); h.setAttribute('aria-expanded', 'true'); h.classList.add('open');
  set('#hook-v', `₹${back}`); set('#hook-s', `On 8 sample discounts, every ₹100 given back brought only ₹${back} of extra profit. Ten Today shows this before anyone says yes.`); }); }

// what it's worth at your scale
{ const bad = $('#w-bad'); if (bad) bad.value = badShare;
  const cr = n => '₹' + (n >= 1 ? n.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' crore' : Math.round(n * 100).toLocaleString('en-IN') + ' lakh');
  const calc = () => { const v = id => +$(id).value || 0, rev = v('#w-rev'), tr = v('#w-trade'), b = v('#w-bad'), po = v('#w-post'), spend = rev * tr / 100;
    set('#w-rev-v', cr(rev)); set('#w-trade-v', tr + '% of sales'); set('#w-bad-v', b + '%'); set('#w-post-v', po + '%');
    $('#w-ans').innerHTML = `A <b>${cr(rev)}</b> company spends about <b>${cr(spend)}</b> a year on discounts. Roughly <b class="bad">${cr(spend * b / 100)}</b> of it doesn't pay for itself.`;
    $('#w-b1').style.width = (100 - b) + '%'; $('#w-b2').style.width = b + '%'; set('#w-o3', cr(spend * po / 100 * 0.18)); };
  document.querySelectorAll('.wk-sl input').forEach(i => i.addEventListener('input', calc)); if ($('#w-rev')) calc(); }

const root = $('#demo');
if (root) {
  const steps = C.walkthrough(today);
  const M = [
    [['buyer', 'Navkar Traders', 'Give us 6% on the March invoice, or we move volume next quarter.'], ['me', 'Neha · commercial', 'Asking for 6% (₹60,000) as a post-sale discount.'], ['ok', 'Check: to make up for ₹60,000, Navkar must buy 13.3% more than usual. They bought 16.3% more, so it\'s worth it.']],
    [['me', 'Neha · commercial', 'It\'s urgent, approving it myself.'], ['bad', 'Blocked: you can\'t approve your own request.']],
    [['them', 'Vikram · finance controller', 'Approved 6%, within my 8% limit.'], ['ok', 'Recorded. The "is it worth it" check was done before the yes.']],
    [['them', 'Farah · tax desk', 'Tax credit note CN-26-041 sent to the buyer.'], ['warn', '₹10,800 tax saving now waits for Navkar to approve it on the GST site. Deadline 30 Nov 2026.']],
    [['buyer', 'GST site · Navkar Traders', 'Rejected: "Wrong invoice reference".'], ['bad', 'Rejected, so the ₹10,800 tax saving is lost for now. A task opens for Asha, due in 2 working days.']],
    [['them', 'Farah · tax desk', 'Sent a corrected note, CN-26-042.'], ['buyer', 'GST site · Navkar Traders', 'Accepted.'], ['ok', 'Tax saving is safe. Task closed.']],
    [['day', '3 weeks later'], ['ok', '₹9,40,000 received, exactly what was agreed.']],
    [['ok', 'All 7 checks pass. Every step is fingerprinted, so any later change would show.']],
  ];
  let typing = null, i = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, timer = null;
  const PLAIN = { C1: 'Worth it?', C2: 'Right person said yes?', C3: 'Really a discount?', C4: 'Paperwork right and on time?', C5: 'Buyer accepted?', C6: 'Right money arrived?', C7: 'Record untouched?' };
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
    $('#dm-c').innerHTML = r.controls.map(c => { const st = refused && c.id === 'C2' ? 'fail' : c.status; return `<li class="${st}"><i></i><b>${c.id} · ${PLAIN[c.id]}</b><span>${st === 'pass' ? 'Pass' : st === 'fail' ? 'Fail' : 'Waiting'}</span></li>`; }).join('');
    $('#ph-cs').innerHTML = r.controls.map(c => { const st = refused && c.id === 'C2' ? 'fail' : c.status; return `<span class="${st}"><i></i>${c.id}</span>`; }).join('');
    const c5 = r.controls[4].status, gst = r.gst, cash = r.controls[5].status;
    const gstState = !s.d.cnNo ? ['wait', 'Not started'] : c5 === 'fail' ? ['bad', `${inr(gst)} comes back`] : c5 === 'pass' ? ['ok', `${inr(gst)} secured`] : ['wait', `${inr(gst)} waiting on buyer`];
    $('#dm-m').innerHTML = `<div><span>Discount</span><b>${inr(e.discount)}</b></div><div><span>Extra profit from extra sales</span><b class="ok">${inr(e.extraMargin)}</b><small>net ${e.net >= 0 ? '+' : '−'}${inr(Math.abs(e.net))}</small></div><div><span>Tax saving</span><b class="${gstState[0]}">${gstState[1]}</b></div><div><span>Cash</span><b class="${cash === 'pass' ? 'ok' : 'wait'}">${cash === 'pass' ? `${inr(s.d.received)} matched` : `${inr(C.netDue(s.d))} due`}</b></div>`;
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
