/* Small, data-driven pictures for each screen. Pure functions: data in, HTML/SVG out. */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lakh = n => n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : `₹${Math.round(n / 1000)}k`;
const ini = s => s.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

/* Today: one line per slot — rank, who, why it's here (days late or a booked call), and a bar for deal size. */
export function todayStrip(list, waiting, tierOf, cap = 10, lateBy = () => 0, flash = null) {
  const max = Math.max(1, ...list.map(t => t.value));
  const kind = t => t.kind === 'cure' ? 's-cure' : 's-p' + tierOf(t);
  const n = k => list.filter(t => kind(t) === k).length;
  const total = list.reduce((a, t) => a + t.value, 0);
  const head = `<p class="vz-h"><b>${list.length} of ${cap} slots used · ${lakh(total)} of deals.</b> ${n('s-p1') ? `<span class="t1">${n('s-p1')} are 5+ days late</span>, ` : ''}${n('s-p2') ? `<span class="t2">${n('s-p2')} late</span>, ` : ''}${n('s-p3')} on time.</p>`;
  const why = t => t.kind === 'cure' ? 'cash gap' : t.callbackAt ? `⏰ call at ${esc(t.callbackAt)}` : lateBy(t) ? `${lateBy(t)} day${lateBy(t) > 1 ? 's' : ''} late` : 'due today';
  const rows = list.map((t, i) => `<li class="${kind(t)}" style="--d:${i * 45}ms"><button type="button" class="vz-tr task${flash === t.id ? ' flash' : ''}" data-open="${t.id}"><em>${i + 1}</em><span class="nm"><b>${esc(t.customer)}</b><small>${esc(t.title || t.stage)}</small></span><span class="br"><i style="--w:${Math.max(6, t.value / max * 100)}%"></i><u>${lakh(t.value)}</u></span><span class="wy">${why(t)}</span></button></li>`).join('');
  const extra = waiting ? `<p class="vz-more"><b>+${waiting} more due</b>, kept out so the list stays at ${cap}. They move up as you finish these.</p>` : '';
  return `<figure class="vz vz-today2">${head}<ol>${rows}</ol>${extra}
    <figcaption><span class="lg lg-p1">5+ days late</span><span class="lg lg-p2">late</span><span class="lg lg-p3">on time</span><span class="lg lg-cure">cash gap</span><span>bar = deal size</span></figcaption></figure>`;
}

/* Team: due-now per rep against the cap line; the red part is the P1 share. */
export function workloadBars(wl, cap, onLeave = []) {
  const max = Math.max(cap + 3, ...wl.map(r => r.actionable));
  const rows = wl.map(r => {
    const away = onLeave.includes(r.rep);
    return `<div class="vz-wl${r.overCap ? ' over' : ''}${away ? ' away' : ''}"><b>${esc(r.rep)}${away ? ' <small>on leave</small>' : ''}</b>
      <span class="bar"><i class="all" style="--w:${r.actionable / max * 100}%"></i><i class="p1" style="--w:${r.p1 / max * 100}%"></i><u style="--x:${cap / max * 100}%"></u></span>
      <em>${r.actionable}${r.overCap ? ` <small>+${r.overCap} over</small>` : ''}</em></div>`;
  }).join('');
  return `<figure class="vz vz-team">${rows}<figcaption><span class="lg lg-p1">P1 (5+ days late)</span><span class="lg lg-all">due now</span><span class="lg lg-cap">the ${cap}-task line</span></figcaption></figure>`;
}

/* Cover: the person on leave, arrows to the person holding their deals, credit staying home. */
export function coverMap(pairs) {
  if (!pairs.length) return '';
  return `<figure class="vz vz-cover">${pairs.map(p => `<div class="cvm">
      <span class="pp away"><i>${ini(p.from)}</i><b>${esc(p.from)}</b><small>on leave till ${esc(p.till)}</small></span>
      <span class="arr"><span class="ln"></span><em>${p.n} deal${p.n === 1 ? '' : 's'} handed over</em><em class="cr">credit stays with ${esc(p.from)}</em></span>
      <span class="pp"><i>${ini(p.to)}</i><b>${esc(p.to)}</b><small>covering</small></span></div>`).join('')}</figure>`;
}

/* Approvals: one row per ask on the same ruler of discount %, against who may approve each band. */
export function limitLadder(approvals, mgrLimit = 10) {
  const top = Math.max(15, ...approvals.map(a => a.askPct + 2)), x = p => (p / top * 100).toFixed(1);
  const LBL = { pending: 'waiting', approved: 'approved', countered: 'countered', sent_back: 'sent back', declined: 'declined' };
  const by = k => approvals.filter(a => a.status === k).length;
  const over = approvals.filter(a => a.askPct > mgrLimit).length;
  const head = `<p class="vz-h"><b>${approvals.length} discount asks.</b> ${by('pending')} waiting, ${by('approved')} approved${by('countered') ? `, ${by('countered')} countered` : ''}. ${over ? `${over} above ${mgrLimit}%, so only the sales head can say yes.` : `All within ${mgrLimit}%, the sales manager's limit.`}</p>`;
  const rows = approvals.map((a, i) => `<div class="lr ${a.status}" style="--d:${i * 80}ms"><span class="lw"><b>${esc(a.customer)}</b><small>${esc(a.rep)} asked · ${a.status === 'pending' ? `with ${esc(a.approver)}` : `${LBL[a.status]}${a.capPct ? ` at ${a.capPct}%` : ''}`}</small></span>
      <span class="lrl"><i class="bk" style="--w:${x(mgrLimit)}%"></i><i class="dt" style="--x:${x(a.askPct)}%"><b>${a.askPct}%</b></i>${a.capPct && a.capPct !== a.askPct ? `<i class="cp" style="--x:${x(a.capPct)}%"></i>` : ''}</span>
      <span class="st">${LBL[a.status] ?? a.status}</span></div>`).join('');
  const ticks = [0, 5, mgrLimit, top].filter((v, i, a) => a.indexOf(v) === i).map(v => `<i style="--x:${x(v)}%">${v}%</i>`).join('');
  return `<figure class="vz vz-ladder2">${head}<div class="lh"><span></span><span class="bands"><em class="k" style="--w:${x(mgrLimit)}%">Sales manager can approve</em><em class="a">Sales head only</em></span><span></span></div>${rows}<div class="lh"><span></span><span class="tk">${ticks}</span><span></span></div></figure>`;
}

/* Pulse: a ring for "done by the original date", and a count of tasks moved three times. */
export function ring(pct, label, sub) {
  const r = 34, c = 2 * Math.PI * r, v = pct ?? 0;
  return `<figure class="vz vz-ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" class="bg"/><circle cx="42" cy="42" r="${r}" class="fg" style="stroke-dasharray:${(v / 100 * c).toFixed(1)} ${c.toFixed(1)}"/></svg><b>${pct === null ? '–' : pct + '%'}</b><figcaption><strong>${esc(label)}</strong>${esc(sub)}</figcaption></figure>`;
}

/* Discount controls: each retailer is one flow line through the seven checks (like a Flow Designer path).
   ● passed  ○ waiting on someone  ◆ stopped here: rupees at stake and who fixes it. */
export function heatmap(rows, names, link) {
  const k = n => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`;
  const all = rows.flatMap(r => r.cells), yes = all.filter(c => c.s === 'pass').length, no = all.filter(c => c.s === 'fail'), wait = all.filter(c => c.s === 'wait').length;
  const clean = rows.filter(r => r.cells.every(c => c.s === 'pass')).length;
  const head = `<p class="vz-h"><b>${clean} of ${rows.length} retailers are cleared end to end.</b> Across all ${all.length} answers: <span class="ok">${yes} yes</span>, <span class="t1">${no.length} stopped (${k(no.reduce((a, c) => a + (c.rupees || 0), 0))} at stake)</span>, <span class="t2">${wait} waiting</span>.</p>`;
  const W = 7, cols = names.map((n, i) => `<span><b>C${i + 1}</b>${esc(n)}</span>`).join('');
  const line = r => {
    const firstStop = r.cells.findIndex(c => c.s !== 'pass');
    const segs = r.cells.slice(0, -1).map((c, i) => `<i class="sg ${firstStop === -1 || i < firstStop ? 'on' : 'off'}" style="--i:${i}"></i>`).join('');
    const nodes = r.cells.map((c, i) => `<a class="nd ${c.s === 'wait' ? 'pend' : c.s}" style="--i:${i}" href="${link(r.id, i)}" title="C${i + 1} ${esc(names[i])}: ${esc(c.text)}"><span class="mk">${c.s === 'pass' ? '<svg viewBox="0 0 12 12"><path d="M2.6 6.3l2.2 2.2 4.6-4.9"/></svg>' : c.s === 'fail' ? '<svg viewBox="0 0 12 12"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5"/></svg>' : ''}</span>${c.s === 'fail' ? `<em>${c.rupees ? k(c.rupees) : 'stopped'}<small>${esc(c.who)} to fix</small></em>` : c.s === 'wait' ? `<em class="w">waiting<small>${esc(c.who)}</small></em>` : ''}</a>`).join('');
    const y = r.cells.filter(c => c.s === 'pass').length;
    return `<div class="fl"><div class="fl-n"><b>${esc(r.name)}</b><small>${esc(r.money)} given back</small></div><div class="fl-t">${segs}${nodes}</div><div class="fl-s ${y === W ? 'ok' : ''}">${y === W ? 'Cleared' : `${y}/${W}`}</div></div>`;
  };
  return `<figure class="vz vz-flow">${head}<div class="fl fl-h"><div></div><div class="fl-c">${cols}</div><div></div></div>${rows.map(line).join('')}
    <figcaption><span class="lgx"><i class="nd pass"><span class="mk"></span></i>passed</span><span class="lgx"><i class="nd pend"><span class="mk"></span></i>waiting on that person</span><span class="lgx"><i class="nd fail"><span class="mk"></span></i>stopped: rupees at stake, who fixes it</span><span>Tap any point to open it.</span></figcaption></figure>`;
}
