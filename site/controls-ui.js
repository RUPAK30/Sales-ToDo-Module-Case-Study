import * as C from './controls.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = C.inr;
const KEY = 'tentoday-controls-v1';
const ctx = () => ({ today: C.todayIso(), settings: S.settings, history: C.HISTORY, opened: S.opened });

let S = fresh();
function fresh() { return { list: C.sampleDesk(), settings: structuredClone(C.SETTINGS), opened: { ...C.OPENED }, sel: 'D-102', view: 'servicenow', sweep: false, walk: null, pack: null, err: '', note: '' }; }
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.list?.length) S = { ...fresh(), ...s, walk: null, pack: null, err: '', note: '' }; } catch { /* first visit */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ list: S.list, settings: S.settings, opened: S.opened, sel: S.sel, view: S.view })); } catch { /* fine */ } };
const cur = () => S.list.find(d => d.id === S.sel) ?? S.list[0];
const put = d => { S.list = S.list.map(x => (x.id === d.id ? d : x)); };
const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const pill = s => `<span class="cr-p ${s}">${s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'Waiting'}</span>`;
function download(name, text, type = 'text/csv') { const u = URL.createObjectURL(new Blob([text], { type })); const a = Object.assign(document.createElement('a'), { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); }

function head(k, sw) {
  const max = Math.max(k.spent, k.earned, k.gstAtRisk, k.short, Math.abs(k.net), 1), w = v => Math.max(2, Math.round(Math.abs(v) / max * 100));
  const bar = (l, v, cls, sign) => `<div class="cr-wf-r"><span>${l}</span><div><i class="${cls}" style="width:${w(v)}%"></i></div><b class="${cls}">${sign}${inr(Math.abs(v))}</b></div>`;
  return `<div class="cr-k">
      <div><span>Spent on discounts</span><b>${inr(k.spent)}</b><small>${k.rows.filter(x => x.d.approvedBy).length} approved</small></div>
      <div><span>Net after discounts</span><b class="${k.net >= 0 ? 'ok' : 'bad'}">${k.net >= 0 ? '+' : '−'}${inr(Math.abs(k.net))}</b><small>${inr(k.earned)} extra margin from extra volume</small></div>
      <div class="${k.gstAtRisk ? 'hot' : ''}"><span>GST relief at risk</span><b>${inr(k.gstAtRisk)}</b><small>${k.nearest ? `${k.nearest.days} days to ${fmt(k.nearest.date)}` : 'Nothing open'}</small></div>
      <div><span>Pass all 7 controls</span><b>${k.passAll} of ${k.count}</b><small>${k.tickets.length} open exception${k.tickets.length === 1 ? '' : 's'} · ${k.breached} past due</small></div>
    </div>
    ${sw.items.length && sw.daysLeft >= 0 ? `<div class="cr-sw"><div><b>Last chance for FY ${sw.fy}: ${inr(sw.total)} of GST cuts aren't safe, ${sw.daysLeft} day${sw.daysLeft === 1 ? '' : 's'} before ${fmt(sw.deadline)}.</b><span>After that date a GST credit note on these invoices can't cut tax (s.34(2)); only a financial credit note is left.</span></div><button class="btn" data-a="sweep" type="button">${S.sweep ? 'Hide' : 'See'} the ${sw.items.length}</button></div>
    ${S.sweep ? `<div class="tbl"><table><thead><tr><th>Discount</th><th>Buyer</th><th>Invoice</th><th>GST at risk</th><th>What's blocking it</th></tr></thead><tbody>${sw.items.map(x => { const b = x.r.controls.find(c => c.status !== 'pass' && ['C2', 'C3', 'C4', 'C5'].includes(c.id)); return `<tr><td><button class="btn link" data-sel="${x.d.id}" type="button">${x.d.id}</button></td><td>${esc(x.d.buyer)}</td><td>${esc(x.d.invoiceNo)} · ${fmt(x.d.invoiceDate)}</td><td><b>${inr(x.r.gstAtRisk)}</b></td><td>${b ? `${b.id} · ${esc(b.text)}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : ''}` : ''}
    <div class="cr-wf" aria-label="Where the discount money went">
      ${bar('Discounts given', -k.spent, 'neg', '−')}${bar('Extra margin from extra volume', k.earned, 'pos', '+')}${bar('GST relief at risk', -k.gstAtRisk, 'neg', '−')}${bar('Cash short of approved net', -k.short, 'neg', '−')}
      <div class="cr-wf-r tot"><span>Net after discounts, if every risk lands</span><div></div><b class="${k.net - k.gstAtRisk - k.short >= 0 ? 'pos' : 'neg'}">${k.net - k.gstAtRisk - k.short >= 0 ? '+' : '−'}${inr(Math.abs(k.net - k.gstAtRisk - k.short))}</b></div>
      <p class="cr-fn">Extra margin = (order − the buyer's usual order) × 51.15% gross margin (HUL FY25, illustrative). Net = order × (margin − discount) − usual order × margin. Sample data.</p>
    </div>`;
}

function queue(k) {
  if (!k.tickets.length) return '<p class="cr-ok">No open exceptions. Every failed control has been fixed.</p>';
  const tks = [...k.tickets].sort((a, b) => b.breached - a.breached || b.rupees - a.rupees);
  return `<div class="tbl"><table class="cr-q"><thead><tr><th>Exception</th><th>Owner</th><th>Due</th><th>₹ at stake</th></tr></thead><tbody>${tks.map(t => `<tr class="${t.discount === S.sel ? 'on' : ''}"><td><button class="btn link" data-sel="${t.discount}" type="button">${t.discount} · ${t.control} ${esc(t.name)}</button><br><small>${esc(t.buyer)}</small></td><td>${esc(t.owner.who)}<br><small>${esc(t.owner.role)}</small></td><td class="${t.breached ? 'bad' : ''}">${fmt(t.due).replace(/ \d{4}$/, '')}${t.breached ? '<br><small>past due</small>' : ''}</td><td>${t.rupees ? inr(t.rupees) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

function actions(d, r) {
  const c = id => r.controls.find(x => x.id === id), b = [];
  if (c('C3').status === 'fail') b.push(`<input class="cr-in" id="cr-note" placeholder="Tax desk note: what was paid for, and is there a written agreement?"><button class="btn" data-a="rv-price" type="button">Tax desk: price cut</button><button class="btn" data-a="rv-service" type="button">Tax desk: a service</button>`);
  else if (d.review === 'service' && d.route !== 'service') b.push('<button class="btn" data-a="route-service" type="button">Settle against the buyer\'s service invoice</button>');
  else if (!d.route && d.approvedBy && c('C2').status === 'pass') b.push('<button class="btn" data-a="route-gst" type="button">Route: GST credit note</button><button class="btn" data-a="route-fin" type="button">Route: financial credit note</button>');
  if (d.route && d.route !== 'service' && (!d.cnNo || c('C4').status === 'fail' || d.ims === 'rejected')) b.push(`<button class="btn pri" data-a="issue" type="button">${d.cnNo ? 'Reissue' : 'Issue'} ${d.route === 'gst' ? 'GST' : 'financial'} credit note today</button>`);
  if (d.route === 'gst' && d.ims === 'rejected') b.push('<button class="btn" data-a="to-fin" type="button">Settle as a financial credit note</button>');
  if (d.route === 'gst' && d.cnNo && d.ims === 'pending' && c('C4').status === 'pass') b.push('<button class="btn" data-a="ims-ok" type="button">Buyer accepted in IMS</button><input class="cr-in" id="cr-rm" placeholder="Buyer\'s rejection remark from IMS"><button class="btn" data-a="ims-no" type="button">Buyer rejected</button>');
  if (c('C6').status === 'fail') b.push(`<button class="btn" data-a="pay" type="button">Record the ${inr(C.netDue(d) - d.received)} balance received</button>`);
  if (c('C2').status === 'fail') b.push('<span class="cr-h">C2 can\'t be fixed by editing: the approval stays on record. Raise it with the approver\'s manager.</span>');
  b.push(`<button class="btn ghost" data-a="tamper" type="button">${C.verify(d).ok ? 'Edit a sealed entry (test)' : 'Undo the edit'}</button>`);
  return `<div class="cr-act">${b.join('')}</div>`;
}

function detail(d, k) {
  const r = k.rows.find(x => x.d.id === d.id).r, e = r.economics, br = C.buyerRecord(ctx(), d.buyer), tk = r.tickets[0];
  const prev = tk ? (S.view === 'jira' ? C.jiraIssue(tk) : C.serviceNowIncident(tk)) : null;
  return `<div class="cr-d">
    <div class="cr-dh"><div><p class="eyebrow">${d.id} · ${esc(d.invoiceNo)} · invoice ${fmt(d.invoiceDate)}</p><h3>${esc(d.buyer)}: ${d.pct}% = ${inr(e.discount)} before GST</h3>
      <p class="cr-s">Needs <b>+${e.breakEvenPct}%</b> extra volume to break even · got <b>+${e.upliftPct}%</b> on the usual ${inr(d.baseline)} · ${e.paidBack ? `<span class="ok">paid back, ${e.multiple}× the discount in extra margin</span>` : `<span class="bad">lost ${inr(-e.net)}</span>`}<br>
      ${br.recoveryPct === null ? 'No credit notes with this buyer yet.' : `This buyer accepted <b>${br.accepted} of ${br.notes}</b> past credit notes in IMS: expect ${br.recoveryPct}% of the ${inr(r.gst)} GST cut to hold.`} Deadline ${fmt(r.deadline.date)} (${esc(r.deadline.why)}).</p></div>
      <button class="btn" data-a="pack" type="button">Open audit pack</button></div>
    <ol class="cr-c">${r.controls.map(c => `<li class="${c.status}"><b>${c.id} ${c.name}</b>${pill(c.status)}<span>${esc(c.text)}</span><small>${esc(c.owner.who)} · ${esc(c.owner.role)}</small></li>`).join('')}</ol>
    ${S.err ? `<p class="cr-err" role="alert">${esc(S.err)}</p>` : ''}${S.note ? `<p class="cr-note" role="status">${esc(S.note)}</p>` : ''}
    ${actions(d, r)}
    ${prev ? ticketCard(tk, prev) : ''}
  </div>`;
}

function ticketCard(tk, prev) {
  const jira = S.view === 'jira', f = (k, v, cls = '') => `<div class="tk-f ${cls}"><span>${k}</span><b>${v}</b></div>`;
  const pri = tk.rupees >= 10000 ? 'High' : 'Medium', num = jira ? `FINCTRL-${tk.discount.replace(/\D/g, '')}${tk.control.slice(1)}` : `INC00${tk.discount.replace(/\D/g, '')}${tk.control.slice(1)}`;
  const body = jira
    ? `<div class="tk-h jira"><span class="tk-logo">◆ FINCTRL</span><span class="tk-num">${num}</span><span class="tk-st">To Do</span></div>
       <h4>${esc(tk.control)} ${esc(tk.name)} failed · ${esc(tk.discount)} · ${esc(tk.buyer)}</h4>
       <div class="tk-g">${f('Assignee', `${esc(tk.owner.who)} <small>${esc(tk.owner.role)}</small>`)}${f('Priority', `<i class="tk-pr ${pri}"></i>${pri}`)}${f('Due date', fmt(tk.due), tk.breached ? 'bad' : '')}${f('Labels', `<em>ten-today</em> <em>${tk.control}</em>`)}${f('Rupees at risk', tk.rupees ? inr(tk.rupees) : '—')}${f('Reporter', 'Ten Today (automation)')}</div>`
    : `<div class="tk-h sn"><span class="tk-logo">now</span><span class="tk-num">Incident ${num}</span><span class="tk-st">New</span></div>
       <h4>${esc(tk.control)} ${esc(tk.name)} failed · ${esc(tk.discount)} · ${esc(tk.buyer)}</h4>
       <div class="tk-g">${f('Assignment group', esc(tk.owner.role))}${f('Assigned to', esc(tk.owner.who))}${f('Urgency', tk.rupees >= 10000 ? '1 – High' : '2 – Medium')}${f('Impact', '2 – Medium')}${f('Category', 'Finance control')}${f('Due by', fmt(tk.due), tk.breached ? 'bad' : '')}${f('Correlation ID', esc(tk.key))}${f('Rupees at risk', tk.rupees ? inr(tk.rupees) : '—')}</div>`;
  return `<div class="tk"><div class="tk-top"><b>⇄ Exception ticket for ${tk.control}</b><div class="cr-tg"><button type="button" data-view="servicenow" aria-pressed="${!jira}">ServiceNow</button><button type="button" data-view="jira" aria-pressed="${jira}">JIRA</button></div></div>
    <div class="tk-card">${body}<div class="tk-d"><span>Description</span><p>${esc(tk.text)}</p></div>
    <div class="tk-a"><span>Activity</span><p><b>Ten Today</b> opened this when ${esc(tk.control)} failed on ${fmt(tk.opened)}. Due in ${tk.owner.tat} working day${tk.owner.tat === 1 ? '' : 's'}${tk.breached ? ' · <b class="bad">past due</b>' : ''}. Closes itself when the control passes.</p></div></div>
    <p class="cr-fn">Preview of the ticket as it would appear in ${jira ? 'JIRA' : 'ServiceNow'}. Not sent. <details class="tk-j"><summary>API payload (${jira ? 'POST /rest/api/3/issue' : 'POST /api/now/table/incident'})</summary><pre>${esc(JSON.stringify(prev, null, 2))}</pre></details></p></div>`;
}

function walkHtml() {
  const s = S.walk.steps[S.walk.i], r = C.evaluate(s.d, ctx()), n = S.walk.steps.length;
  return `<div class="cr-w" role="dialog" aria-label="Walkthrough"><div class="cr-wt"><b>Step ${S.walk.i + 1} of ${n} · ${esc(s.t)}</b><button class="x" data-a="walk-x" type="button" aria-label="Close">×</button></div><p>${esc(s.s)}</p>
    <ol class="cr-c sm">${r.controls.map(c => `<li class="${c.status}"><b>${c.id} ${c.name}</b>${pill(c.status)}<span>${esc(c.text)}</span></li>`).join('')}</ol>
    <div class="cr-act"><button class="btn" data-a="walk-back" type="button" ${S.walk.i ? '' : 'disabled'}>Back</button><button class="btn pri" data-a="walk-next" type="button">${S.walk.i + 1 < n ? 'Next' : 'Done'}</button></div></div>`;
}
function packHtml() {
  const p = S.pack;
  return `<div class="cr-w" role="dialog" aria-label="Audit pack"><div class="cr-wt"><b>${p.title}</b><button class="x" data-a="pack-x" type="button" aria-label="Close">×</button></div>
    ${p.packs.map(x => `<details class="cr-pk" ${p.packs.length === 1 ? 'open' : ''}><summary><b>${x.id}</b> · ${esc(x.buyer)} · ${inr(x.discount)} · chain ${x.chain}</summary><p class="cr-s">Invoice ${esc(x.invoice)} · GST on the discount ${inr(x.gst)}</p><ul>${x.controls.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      <div class="tbl"><table><thead><tr><th>#</th><th>Date</th><th>Who</th><th>Entry</th><th>Fingerprint</th></tr></thead><tbody>${x.entries.map(e => `<tr><td>${e.n}</td><td>${e.on}</td><td>${esc(e.who)}</td><td>${esc(e.what)} <small>${esc(Object.entries(e.data).map(([a, b]) => `${a}: ${b}`).join(' · '))}</small></td><td><code>${e.fingerprint}</code></td></tr>`).join('')}</tbody></table></div></details>`).join('')}
    <div class="cr-act"><button class="btn" data-a="pack-dl" type="button">Download as JSON</button></div></div>`;
}

function render() {
  const root = $('#ctrl-room'); if (!root) return;
  const k = C.desk(S.list, ctx()), sw = C.sweep(S.list, ctx(), '2025-26'), d = cur();
  root.innerHTML = `<div class="cr-top"><div><p class="eyebrow">Post-sale discounts · rules in force from 1 Nov 2026</p><h1>Is the discount worth it, will the GST cut hold, can you prove it?</h1>
      <p class="lede">Every discount given after the sale runs through seven controls. A failed control opens an exception with an owner and a due date. Every step is sealed for the auditor.</p></div>
      <div class="cr-tb"><button class="btn pri" data-a="walk" type="button">▶ 90-second walkthrough</button></div></div>
    ${head(k, sw)}
    <div class="cr-g"><section class="card"><h2>Exceptions · ${k.tickets.length}</h2><p class="sub">Each failed control is a ticket: owner, turnaround in working days, rupees at stake.</p>${queue(k)}</section>
      <section class="card"><h2>Discounts · ${k.count}</h2><div class="cr-l">${k.rows.map(x => `<button type="button" data-sel="${x.d.id}" class="${x.d.id === d.id ? 'on' : ''}" aria-pressed="${x.d.id === d.id}"><b>${x.d.id}</b> ${esc(x.d.buyer)}<span>${x.r.controls.map(c => `<i class="${c.status}" title="${c.id} ${c.status}"></i>`).join('')}</span></button>`).join('')}</div>${detail(d, k)}</section></div>
    <section class="card cr-more"><h2>For finance, tax and audit</h2><div class="cr-act">
      <button class="btn" data-a="sample" type="button">Sample 5 discounts like an auditor</button><button class="btn" data-a="mis" type="button">Weekly control MIS (CSV)</button><button class="btn" data-a="racm" type="button">Risk and control matrix (CSV)</button>
      <label class="cr-s">GSTR-9 for FY 2025-26 filed on <input type="date" class="cr-in" id="cr-g9" value="${S.settings.gstr9Filed['2025-26'] ?? ''}"></label><button class="btn ghost" data-a="reset" type="button">Reset sample</button></div>
      <details class="cr-ru"><summary>Rules in force, with effective dates · ${C.RULES.length}</summary><div class="tbl"><table><thead><tr><th>Rule</th><th>From</th><th>To</th><th>What it says</th><th>Source</th></tr></thead><tbody>${C.RULES.map(r => `<tr><td><b>${r.id} v${r.v}</b><br><small>${esc(r.name)}</small></td><td>${fmt(r.from)}</td><td>${r.to ? fmt(r.to) : 'in force'}</td><td>${esc(r.text)}</td><td><small>${esc(r.src)}</small></td></tr>`).join('')}</tbody></table></div><p class="cr-s">Each decision records the rule version in force on its date, so a note issued on 28 Oct is judged by v1 and one issued on 2 Nov by v2.</p></details>
      <details class="cr-ru"><summary>Risk and control matrix · C1–C7</summary><div class="tbl"><table><thead><tr><th>Control</th><th>Risk</th><th>Control activity</th><th>Type · frequency</th><th>Owner</th><th>Evidence</th><th>Test</th></tr></thead><tbody>${C.RACM.map(r => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}<br><small>${esc(r[4])}</small></td><td>${esc(r[5])}</td><td>${esc(r[6])}</td><td>${esc(r[7])}</td></tr>`).join('')}</tbody></table></div></details>
      <p class="cr-fn">Not tax advice. Nothing is sent to the GST portal, ServiceNow or JIRA: IMS actions are recorded by finance and ticket payloads are previews. Sample buyers and figures.</p></section>
    ${S.walk ? walkHtml() : ''}${S.pack ? packHtml() : ''}`;
}

function act(a, el) {
  const d = cur(), today = C.todayIso(); S.err = ''; S.note = '';
  try {
    if (a === 'sweep') S.sweep = !S.sweep;
    else if (a === 'rv-price' || a === 'rv-service') put(C.taxReview(d, today, 'Farah', a === 'rv-price' ? 'price' : 'service', $('#cr-note')?.value ?? ''));
    else if (a === 'route-gst') put(C.chooseRoute(d, today, 'Farah', 'gst', 'Registered buyer; IMS action expected'));
    else if (a === 'route-fin') put(C.chooseRoute(d, today, 'Farah', 'fin', 'GST cut not worth the buyer reversing ITC'));
    else if (a === 'route-service') put(C.chooseRoute(d, today, 'Farah', 'service', 'Buyer bills the promotion service with its own GST'));
    else if (a === 'to-fin') { put(C.issueNote(C.chooseRoute(d, today, 'Farah', 'fin', `Buyer rejected in IMS: ${d.imsRemark}. GST cut given up`), today, 'Farah', `FCN-${d.id}`)); S.note = 'Settled as a financial credit note. The discount stands; the GST cut is given up and nothing goes back to IMS.'; }
    else if (a === 'issue') { const n = d.events.filter(e => e.what === 'credit note').length + 1; put(C.issueNote(d, today, 'Farah', `${d.route === 'gst' ? 'CN' : 'FCN'}-${d.id}-${n}`)); }
    else if (a === 'ims-ok') put(C.recordIms(d, today, 'Asha', 'accepted'));
    else if (a === 'ims-no') put(C.recordIms(d, today, 'Asha', 'rejected', $('#cr-rm')?.value ?? ''));
    else if (a === 'pay') put(C.recordPayment(d, today, 'Asha', C.netDue(d) - d.received, 'UTR balance'));
    else if (a === 'tamper') { const x = structuredClone(d); const i = x.events.findIndex(e => e.what === 'approved'); if (C.verify(x).ok) { x._orig = structuredClone(x.events[Math.max(0, i)]); x.events[Math.max(0, i)].data.pct = Math.max(1, d.pct - 2); S.note = `Entry #${i + 1} now says ${x.pct - 2}% instead of ${x.pct}%, as if someone edited the database. C7 names it.`; } else if (x._orig) { x.events[x._orig.n - 1] = x._orig; delete x._orig; } put(x); }
    else if (a === 'walk') S.walk = { steps: C.walkthrough(today), i: 0 };
    else if (a === 'walk-next') { if (S.walk.steps[S.walk.i].pack) { S.pack = { title: 'Audit pack · D-201', packs: [C.auditPack(S.walk.steps.at(-1).d, ctx())] }; S.walk = null; } else S.walk.i++; }
    else if (a === 'walk-back') S.walk.i = Math.max(0, S.walk.i - 1);
    else if (a === 'walk-x') S.walk = null;
    else if (a === 'pack') S.pack = { title: `Audit pack · ${d.id}`, packs: [C.auditPack(d, ctx())] };
    else if (a === 'sample') { const seed = Date.now() % 100000; S.pack = { title: `Auditor's sample of 5 · seed ${seed} (same seed, same sample)`, packs: C.auditSample(S.list, 5, seed).map(x => C.auditPack(x, ctx())) }; }
    else if (a === 'pack-x') S.pack = null;
    else if (a === 'pack-dl') return download(`audit-pack-${today}.json`, JSON.stringify(S.pack.packs, null, 2), 'application/json');
    else if (a === 'mis') return download(`ten-today-control-mis-${today}.csv`, C.misCsv(S.list, ctx()));
    else if (a === 'racm') return download('ten-today-risk-control-matrix.csv', C.racmCsv());
    else if (a === 'reset') { S = fresh(); try { localStorage.removeItem(KEY); } catch { /* fine */ } }
  } catch (e) { S.err = e.message; }
  // a ticket opens the day its control first fails
  for (const x of C.desk(S.list, ctx()).tickets) S.opened[x.key] ??= x.opened;
  save(); render();
  if (S.walk || S.pack) $('#ctrl-room .cr-w')?.scrollIntoView({ block: 'nearest' });
}

document.addEventListener('click', e => {
  const root = $('#ctrl-room'); if (!root || !root.contains(e.target)) return;
  const sel = e.target.closest('[data-sel]'); if (sel) { S.sel = sel.dataset.sel; S.err = ''; S.note = ''; save(); render(); root.querySelector('.cr-d')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  const v = e.target.closest('[data-view]'); if (v) { S.view = v.dataset.view; save(); render(); root.querySelector('.tk')?.scrollIntoView({ block: 'nearest' }); return; }
  const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a, b);
});
document.addEventListener('change', e => { if (e.target.id === 'cr-g9') { S.settings.gstr9Filed['2025-26'] = e.target.value || null; save(); render(); } });
render();
