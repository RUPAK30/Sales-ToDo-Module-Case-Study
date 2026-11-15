/* Small, data-driven pictures for each screen. Pure functions: data in, HTML/SVG out. */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lakh = n => n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : `₹${Math.round(n / 1000)}k`;
const ini = s => s.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

/* Today: ten slots, coloured by urgency, height by deal value; the overflow waits outside the frame. */
export function todayStrip(list, waiting, tierOf, cap = 10) {
  const max = Math.max(1, ...list.map(t => t.value));
  const slots = Array.from({ length: cap }, (_, i) => {
    const t = list[i];
    if (!t) return `<li class="vz-slot empty"><i style="--h:18%"></i><span>—</span></li>`;
    const tr = t.kind === 'cure' ? 's-cure' : 's-p' + tierOf(t);
    return `<li class="vz-slot ${tr}" title="${esc(t.customer)} · ${esc(t.stage)}"><i style="--h:${Math.max(18, t.value / max * 100)}%"></i><span>${ini(t.customer)}</span><em>${i + 1}</em></li>`;
  }).join('');
  const extra = waiting ? `<div class="vz-wait"><b>+${waiting}</b><span>waiting outside the 10</span></div>` : '';
  return `<figure class="vz vz-today"><div class="vz-row"><ol>${slots}</ol>${extra}</div>
    <figcaption><span class="lg lg-p1">5+ days late</span><span class="lg lg-p2">late</span><span class="lg lg-p3">on time</span><span class="lg lg-cure">cash gap</span><span class="lg lg-h">taller = bigger deal</span></figcaption></figure>`;
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

/* Approvals: every ask on one ruler of discount %, with who may approve each band and the margin floor. */
export function limitLadder(approvals, mgrLimit = 10) {
  const top = Math.max(16, ...approvals.map(a => a.askPct + 2));
  const x = p => (p / top * 100).toFixed(1);
  const seen = {}; const dots = approvals.map((a, i) => { const k = Math.round(a.askPct); seen[k] = (seen[k] ?? -1) + 1; return a; }).map((a, i, arr) => { const k = Math.round(a.askPct), lvl = arr.slice(0, i).filter(b => Math.abs(b.askPct - a.askPct) < 1.5).length; return `<span class="dot ${a.status}" style="--x:${x(a.askPct)}%;--y:${lvl * 34}px" title="${esc(a.customer)} · ${a.askPct}% · ${esc(a.status)}"><i></i><b>${a.askPct}%</b><small>${esc(a.customer.split(' ')[0])}</small></span>`; }).join('');
  return `<figure class="vz vz-ladder"><div class="lad"><div class="band k" style="--w:${x(mgrLimit)}%"><span>Sales manager · up to ${mgrLimit}%</span></div><div class="band a"><span>Sales head · above ${mgrLimit}%</span></div><div class="pts">${dots}</div>
    <div class="ticks">${[0, 5, 10, 15, top].filter((v, i, a) => a.indexOf(v) === i && v <= top).map(v => `<i style="--x:${x(v)}%">${v}%</i>`).join('')}</div></div>
    <figcaption><span class="lg lg-pending">waiting</span><span class="lg lg-approved">approved</span><span class="lg lg-countered">countered</span><span class="lg lg-sent_back">sent back</span></figcaption></figure>`;
}

/* Pulse: a ring for "done by the original date", and a count of tasks moved three times. */
export function ring(pct, label, sub) {
  const r = 34, c = 2 * Math.PI * r, v = pct ?? 0;
  return `<figure class="vz vz-ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" class="bg"/><circle cx="42" cy="42" r="${r}" class="fg" style="stroke-dasharray:${(v / 100 * c).toFixed(1)} ${c.toFixed(1)}"/></svg><b>${pct === null ? '–' : pct + '%'}</b><figcaption><strong>${esc(label)}</strong>${esc(sub)}</figcaption></figure>`;
}

/* Discount controls: ten retailers × seven checks, one cell each. */
export function heatmap(rows, names, link) {
  const head = names.map((n, i) => `<th title="${esc(n)}">C${i + 1}<small>${esc(n)}</small></th>`).join('');
  const body = rows.map(r => `<tr><th><b>${esc(r.name)}</b><small>${esc(r.id)} · ${esc(r.money)}</small></th>${r.cells.map((s, i) => `<td><a class="${s}" href="${link(r.id, i)}" aria-label="${esc(r.name)} C${i + 1}: ${s}"></a></td>`).join('')}</tr>`).join('');
  return `<figure class="vz vz-heat"><table><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
    <figcaption><span class="lg lg-pass">yes</span><span class="lg lg-fail">no: a task is open</span><span class="lg lg-wait">waiting</span> · tap a cell to open it</figcaption></figure>`;
}
