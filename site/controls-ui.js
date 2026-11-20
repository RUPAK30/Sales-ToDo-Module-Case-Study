import * as C from './controls.js';
import * as V from './viz.js?v=8';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = C.inr;
const KEY = 'tentoday-controls-v2';
const ctx = () => ({ today: C.todayIso(), settings: S.settings, history: C.HISTORY, opened: S.opened });

let S = fresh();
function fresh() { return { list: C.sampleDesk(), settings: structuredClone(C.SETTINGS), opened: { ...C.OPENED }, sel: 'D-102', view: 'servicenow', sweep: false, walk: null, pack: null, sign: null, signoffs: [], err: '', note: '' }; }
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.list?.length) S = { ...fresh(), ...s, settings: { ...structuredClone(C.SETTINGS), ...(s.settings ?? {}) }, walk: null, pack: null, sign: null, err: '', note: '' }; } catch { /* first visit */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ list: S.list, settings: S.settings, opened: S.opened, sel: S.sel, view: S.view, signoffs: S.signoffs })); } catch { /* fine */ } };
const cur = () => S.list.find(d => d.id === S.sel) ?? S.list[0];
const put = d => { S.list = S.list.map(x => (x.id === d.id ? d : x)); };
const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const pill = s => `<span class="cr-p ${s}">${s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'Waiting'}</span>`;
function download(name, text, type = 'text/csv') { const u = URL.createObjectURL(new Blob([text], { type })); const a = Object.assign(document.createElement('a'), { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); }

function head(k, sw) {
  const max = Math.max(k.spent, k.earned, k.gstAtRisk, k.short, Math.abs(k.net), 1), w = v => Math.max(2, Math.round(Math.abs(v) / max * 100));
  const bar = (l, v, cls, sign) => `<div class="cr-wf-r"><span>${l}</span><div><i class="${cls}" style="width:${w(v)}%"></i></div><b class="${cls}">${sign}${inr(Math.abs(v))}</b></div>`;
  const lost = k.rows.filter(x => x.d.approvedBy && x.r.economics.net < 0).reduce((a, x) => a - x.r.economics.net, 0), risk = lost + k.gstAtRisk + k.short;
  return `<div class="cr-k">
      <div><span>Money given back</span><b>${inr(k.spent)}</b><small>to ${k.count} retailers · ${inr(risk)} of it at risk</small></div>
      <div class="${lost ? 'hot' : ''}"><span>Didn't bring enough extra sales</span><b class="${lost ? 'bad' : 'ok'}">${inr(lost)}</b><small>lost on discounts that didn't pay for themselves</small></div>
      <div class="${k.gstAtRisk ? 'hot' : ''}"><span>Tax that may not come back</span><b>${inr(k.gstAtRisk)}</b><small>${k.nearest ? `retailers haven't accepted yet · ${k.nearest.days} days to ${fmt(k.nearest.date)}` : 'Nothing open'}</small></div>
      <div class="${k.short ? 'hot' : ''}"><span>Paid less than agreed</span><b>${inr(k.short)}</b><small>${k.passAll} of ${k.count} got "yes" to all 7 · ${k.tickets.length} tasks open</small></div>
    </div>
    ${sw.items.length && sw.daysLeft >= 0 ? `<div class="cr-sw"><div><b>Last chance: ${inr(sw.total)} of GST on last year's bills is not safe yet. ${sw.daysLeft} day${sw.daysLeft === 1 ? '' : 's'} left (${fmt(sw.deadline)}).</b><span>After that, you can still give the money back, but you can't get the GST back on it (the law: s.34(2)).</span></div><button class="btn" data-a="sweep" type="button">${S.sweep ? 'Hide' : 'See'} the ${sw.items.length}</button></div>
    ${S.sweep ? `<div class="tbl"><table><thead><tr><th>Discount</th><th>Retailer</th><th>Invoice</th><th>GST at risk</th><th>What's blocking it</th></tr></thead><tbody>${sw.items.map(x => { const b = x.r.controls.find(c => c.status !== 'pass' && ['C2', 'C3', 'C4', 'C5'].includes(c.id)); return `<tr><td><button class="btn link" data-sel="${x.d.id}" type="button">${x.d.id}</button></td><td>${esc(x.d.buyer)}</td><td>${esc(x.d.invoiceNo)} · ${fmt(x.d.invoiceDate)}</td><td><b>${inr(x.r.gstAtRisk)}</b></td><td>${b ? `${b.id} · ${esc(b.text)}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : ''}` : ''}
    <details class="cr-more-d"><summary>How these numbers add up</summary><div class="cr-wf" aria-label="Where the discount money went">
      ${bar('Money given back', -k.spent, 'neg', '−')}${bar('Profit from extra sales', k.earned, 'pos', '+')}${bar('Tax that may not come back', -k.gstAtRisk, 'neg', '−')}${bar('Paid less than agreed', -k.short, 'neg', '−')}
      <div class="cr-wf-r tot"><span>Where you end up if every risk comes true</span><div></div><b class="${k.net - k.gstAtRisk - k.short >= 0 ? 'pos' : 'neg'}">${k.net - k.gstAtRisk - k.short >= 0 ? '+' : '−'}${inr(Math.abs(k.net - k.gstAtRisk - k.short))}</b></div>
      <p class="cr-fn">How it's worked out: extra profit = (this order − the retailer's usual order) × <b>51.15%</b>. That 51.15% is a stand-in, not a fact about these retailers: it is Hindustan Unilever's FY25 gross margin (StockAnalysis). Every example uses the same number. A real brand puts in its own margin, and the answer changes — 6% off needs 13.3% more buying at 51.15%, 17.6% at 40%, 42.9% at 20%. Sample data.</p>
    </div></details>`;
}

function queue(k) {
  if (!k.tickets.length) return '<p class="cr-ok">No open tickets. Every failed check has been fixed.</p>';
  const tks = [...k.tickets].sort((a, b) => b.breached - a.breached || b.rupees - a.rupees);
  return `<div class="tbl"><table class="cr-q"><thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>₹ at stake</th></tr></thead><tbody>${tks.map(t => `<tr class="${t.discount === S.sel ? 'on' : ''}"><td><button class="btn link" data-sel="${t.discount}" type="button">${esc(t.buyer)}: ${esc(t.name)}</button><br><small>${t.discount} · ${t.control}</small></td><td>${esc(t.owner.who)}<br><small>${esc(t.owner.role)}</small></td><td class="${t.breached ? 'bad' : ''}">${fmt(t.due).replace(/ \d{4}$/, '')}${t.breached ? '<br><small>past due</small>' : ''}</td><td>${t.rupees ? inr(t.rupees) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

function actions(d, r) {
  const c = id => r.controls.find(x => x.id === id), b = [];
  const ads = C.adOpen(d.buyer), netted = ads.length && !d.split;
  if (!d.approvedBy) b.push('<button class="btn pri" data-a="approve" type="button">Approve as Vikram (limit 8%)</button><button class="btn" data-a="approve-self" type="button">Try approving as Neha (the requester)</button>');
  if (c('C3').status === 'fail') {
    if (d.purpose === 'damage') b.push('<span class="cr-h">This is a return, not a discount. It stays stuck here until someone moves it onto a goods-return note against the invoice, with the retailer\'s return acknowledgement.</span>');
    else if (netted) b.push(`<input class="cr-in" id="cr-note" aria-label="How you split the payout" placeholder="e.g. ₹60,000 discount; ₹47,200 ad bill"><button class="btn pri" data-a="split" type="button">Split the payout into two records</button>`);
    else b.push(`<input class="cr-in" id="cr-note" placeholder="Tax desk note: what was paid for, and is there a written agreement?"><button class="btn" data-a="rv-price" type="button">Tax team: it is a price cut</button><button class="btn" data-a="rv-service" type="button">Tax team: it is a paid service</button>`);
  }
  else if (d.review === 'service' && d.route !== 'service') b.push('<button class="btn" data-a="route-service" type="button">Settle against the retailer\'s service invoice</button>');
  else if (!d.route && d.approvedBy && c('C2').status === 'pass') b.push('<button class="btn" data-a="route-gst" type="button">Use a GST credit note (tax goes down too)</button><button class="btn" data-a="route-fin" type="button">Use a financial credit note (money back, tax unchanged)</button>');
  if (d.route && d.route !== 'service' && (!d.cnNo || c('C4').status === 'fail' || d.ims === 'rejected')) b.push(`<button class="btn pri" data-a="issue" type="button">${d.cnNo ? 'Reissue' : 'Issue'} ${d.route === 'gst' ? 'GST' : 'financial'} credit note today</button>`);
  if (d.route === 'gst' && d.cnNo && !d.reportedOn) b.push('<button class="btn pri" data-a="report" type="button">Report it to the e-invoice system today (30-day clock)</button>');
  if (d.route === 'gst' && d.ims === 'rejected') b.push('<button class="btn" data-a="to-fin" type="button">Settle as a financial credit note</button>');
  if (d.route === 'gst' && d.cnNo && d.ims === 'pending' && c('C4').status !== 'fail') b.push('<button class="btn" data-a="ims-ok" type="button">Retailer accepted on the GST portal (IMS)</button><input class="cr-in" id="cr-rm" placeholder="Retailer\'s rejection remark from IMS"><button class="btn" data-a="ims-no" type="button">Retailer rejected</button>');
  if (c('C6').status === 'fail') b.push(`<button class="btn" data-a="pay" type="button">Record the ${inr(C.netDue(d) - d.received)} balance received</button>`);
  if (c('C2').status === 'fail') b.push('<span class="cr-h">Check 2 can\'t be fixed by editing: the over-limit approval stays on record, as it should. Raise it with the approver\'s manager.</span>');
  b.push(`<button class="btn ghost" data-a="tamper" type="button">${C.verify(d).ok ? 'Edit a sealed entry (test)' : 'Undo the edit'}</button>`);
  return `<div class="cr-act">${b.join('')}</div>`;
}

/* The retailer refused. Three ways out, three different rupee outcomes. */
function routes(d) {
  if (d.ims !== 'rejected') return '';
  return `<details class="cr-rt"><summary><b>Three ways to fix a rejection</b> (for the tax team)</summary><ol>${C.recoveryRoutes(d).map(([t, s]) => `<li><b>${esc(t)}</b><span>${esc(s)}</span></li>`).join('')}</ol></details>`;
}

/* One payment, two different things inside it. The number an accounts person recognises from their own month. */
function payoutBox(d, p, gst) {
  return `<div class="cr-py"><b>One payment, two different things · ${esc(d.invoiceNo)}</b>
    <p>${esc(d.buyer)} also sends us bills for ads or shelf space. So this one payment settles two different things: a discount we gave them, and a bill they sent us.</p>
    <div><span>The bill we raised</span><b>${inr(p.gross)}</b></div>
    <div><span>Discount we gave</span><b>−${inr(p.discount)}</b></div>
    <div><span>Bill they sent us for ads</span><b>−${inr(p.adAmount)}</b></div>
    <div><span>GST on their ad bill</span><b>−${inr(p.adGst)}</b></div>
    <div class="tot"><span>Net amount paid</span><b>${inr(p.net)}</b></div>
    <p>${inr(p.deducted)} comes off, but only ${inr(p.discount)} is a discount. The other ${inr(p.adAmount + p.adGst)} is a purchase: they sold us ads, so they bill us with their own GST and we claim the ${inr(p.adGst)} back. The ${inr(gst)} GST on the discount sits on the credit note, not here.</p>
    <p>Record the split first, then issue any note.</p></div>`;
}
function payout(d) {
  const p = C.payoutSplit(d);
  if (!p.ads.length) return '';
  return payoutBox(d, p, C.gstOf(d));
}

/* Live link: send this discount to the ServiceNow app and show what ServiceNow did with it. */
const SN = {};
function snCard(d) {
  const st = SN[d.id];
  const head = `<div class="sn-c"><div class="sn-h"><div><p class="eyebrow">Live in ServiceNow</p><b>Send this discount to the ServiceNow app</b><span>The same rule runs there natively: Vikram (finance) approves up to his 8% limit, anything above is routed up to the CFO, nobody approves their own request, and every step is logged on the record.</span></div>
    <button class="btn pri" data-sn="${d.id}" type="button"${st?.busy ? ' disabled' : ''}>${st?.busy ? 'Sending…' : '↗ Send to ServiceNow'}</button></div>`;
  if (!st || st.busy) return head + '</div>';
  if (st.error) return head + `<p class="sn-r bad">${esc(st.error)}</p></div>`;
  const r = st.res, req = `<details class="sn-req"><summary>The exact request</summary><pre>${esc(r.request.method + ' ' + r.request.endpoint + '\n' + JSON.stringify(r.request.body, null, 2))}</pre></details>`;
  if (!r.live) {
    const why = { not_configured: 'The live connection is not switched on yet.', asleep: 'The ServiceNow demo instance is asleep (free developer instances pause when idle).', refused: 'ServiceNow refused the request.' }[r.why] ?? 'ServiceNow did not answer.';
    return head + `<p class="sn-r wait">${why} Here is exactly what it would receive.</p>${req}</div>`;
  }
  if (r.blocked) return head + `<ol class="sn-steps">
      <li class="bad">ServiceNow <b>blocked</b> this request: ${esc(r.retailer)} still has an open credit-note rejection on <b>${esc(r.blocked_by)}</b>.</li>
      <li class="wait">No new discount for this retailer until Receivables resolves it (C5). The block runs inside ServiceNow, not in this page.</li></ol>${req}</div>`;
  return head + `<ol class="sn-steps">
      <li class="ok"><b>${esc(r.number)}</b> created in ServiceNow</li>
      <li class="${r.approval_state ? 'ok' : 'wait'}">Routed to <b>${esc(r.routed_to)}</b>${r.reason ? `: “${esc(r.reason)}”` : ' (approval being routed)'}</li>
      <li class="wait">Waiting for a person to approve. Nobody can approve their own request.</li></ol>${req}</div>`;
}

function detail(d, k) {
  const r = k.rows.find(x => x.d.id === d.id).r, e = r.economics, br = C.buyerRecord(ctx(), d.buyer), tk = r.tickets[0];
  const prev = tk ? (S.view === 'jira' ? C.jiraIssue(tk) : C.serviceNowIncident(tk)) : null;
  return `<div class="cr-d">
    <div class="cr-dh"><div><p class="eyebrow">${d.id} · ${esc(d.invoiceNo)} · invoice ${fmt(d.invoiceDate)}</p><h3>${esc(d.buyer)}: you gave ${inr(e.discount)} back (${d.pct}%)</h3>
      <p class="cr-s">We assume the brand keeps <b>₹${Math.round(d.margin)}</b> of every ₹100 (<b>${d.margin}%</b> margin). At that margin the retailer had to buy <b>${e.breakEvenPct}%</b> more than their usual ${inr(d.baseline)}. They bought <b>${e.upliftPct}%</b> more · ${e.paidBack ? `<span class="ok">so it paid for itself: ${e.multiple}× the discount in extra profit</span>` : `<span class="bad">so it lost ${inr(-e.net)}</span>`}<br>
      ${br.recoveryPct === null ? 'No credit notes with this retailer yet.' : `This retailer accepted <b>${br.accepted} of ${br.notes}</b> past credit notes on the GST portal, so expect about ${br.recoveryPct}% of the ${inr(r.gst)} tax saving to hold.`} Last date for the tax credit note: ${fmt(r.deadline.date)}.</p></div>
      <button class="btn" data-a="pack" type="button">Open audit pack</button></div>
    <ol class="cr-c cr-x">${r.controls.map(c => `<li class="${c.status}${S.focus === c.id ? ' focus' : ''}" id="cr-${c.id}"><b title="Why this check">${c.id} ${c.name}</b><span>${esc(c.text)}</span><small>${esc(c.owner.who)}</small></li>`).join('')}</ol>
    ${S.err ? `<p class="cr-err" role="alert">${esc(S.err)}</p>` : ''}${S.note ? `<p class="cr-note" role="status">${esc(S.note)}</p>` : ''}
    ${payout(d)}
    ${routes(d)}
    ${actions(d, r)}
    ${snCard(d)}
    ${prev ? `<details class="cr-more-d"><summary>See this as a ServiceNow or JIRA ticket</summary>${ticketCard(tk, prev)}</details>` : ''}
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
    <p class="cr-fn">Preview of the ticket as it would appear in ${jira ? 'JIRA' : 'ServiceNow'}. Not sent. <button type="button" class="btn link" data-copy="1">Copy the API call (${jira ? 'POST /rest/api/3/issue' : 'POST /api/now/table/incident'})</button></p></div>`;
}

function signBlock() {
  const wk = C.weekOf(C.todayIso()), done = S.signoffs.find(x => x.week === wk), fmtW = w => `week of ${fmt(w)}`;
  const hist = S.signoffs.slice().reverse().map(r => { const v = C.verifySignoff(r, S.list);
    return `<li class="${v.ok ? 'ok' : 'bad'}"><b>${fmtW(r.week)}</b><span>Signed by ${esc(r.who)} on ${fmt(r.on)}${r.countersign ? ` · countersigned by ${esc(r.countersign.who)}` : ''} · ${r.open.length} open item${r.open.length === 1 ? '' : 's'} explained</span>
      <em>${v.ok ? '🔒 intact' : '⚠ ' + esc(v.why)}</em><code title="fingerprint">${r.hash.slice(0, 10)}</code>${r.countersign ? '' : `<button class="btn link" data-cs="${r.week}" type="button">Countersign as Arjun</button>`}</li>`; }).join('');
  return `<div class="so"><div class="so-h"><div><b>Weekly audit sign-off</b><span>The finance controller signs off the week's checks. Open items need a one-line reason. The record is sealed and a second person countersigns.</span></div>
    ${done ? `<span class="so-done">✓ ${fmtW(wk)} signed</span>` : `<button class="btn pri" data-a="sign" type="button">Sign off this week</button>`}</div>
    ${hist ? `<ul class="so-l">${hist}</ul>` : '<p class="cr-s">No sign-offs yet.</p>'}</div>`;
}
function signHtml() {
  const k = C.desk(S.list, ctx()), m = C.mis(S.list, ctx());
  return `<div class="cr-w" role="dialog" aria-label="Sign off this week"><div class="cr-wt"><b>Sign off the week of ${fmt(C.weekOf(C.todayIso()))}</b><button class="x" data-a="sign-x" type="button" aria-label="Close">×</button></div>
    <div class="so-k">${m.kpis.slice(4).map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>
    ${k.tickets.length ? `<p class="cr-s" style="margin:10px 0 6px"><b>${k.tickets.length} items are still open.</b> Write one line on each, so an auditor can see why you signed anyway.</p>
    <ol class="so-n">${k.tickets.map(t => `<li><label><b>${t.key}</b> · ${esc(t.name)} · ${esc(t.buyer)}${t.rupees ? ` · ${inr(t.rupees)}` : ''}<input class="cr-in" data-note="${t.key}" placeholder="e.g. Asha chasing the retailer, reissue by Monday" value="${esc(S.signNotes?.[t.key] ?? '')}"></label></li>`).join('')}</ol>` : '<p class="cr-s">Every check passes. Nothing to explain.</p>'}
    ${S.err ? `<p class="cr-err" role="alert">${esc(S.err)}</p>` : ''}
    <div class="cr-act"><button class="btn pri" data-a="sign-go" type="button">Sign as Vikram, finance controller</button></div></div>`;
}
function askPreview(inv, pct, purpose = 'price', basis = 'above') {
  if (!inv || !pct) return '<p class="cr-s">Type an invoice number and a %, and say what the money is for. Ten Today fills in the rest from the invoice register and past orders.</p>';
  let r; try { r = C.draftRequest(inv, +pct, ctx(), C.INVOICES, purpose, basis); } catch (e) { return `<p class="cr-err">${esc(e.message)}</p>`; }
  const e = r.economics, f = r.fields, p = r.ads.length ? C.payoutSplit(f) : null;
  return `<dl class="ask-pv">
    <dt>Retailer and bill</dt><dd><b>${esc(f.buyer)}</b> · ${fmt(f.invoiceDate)} · ${inr(f.value)}</dd>
    <dt>Discount</dt><dd><b>${inr(e.discount)}</b> before GST (${inr(r.gst)} GST)</dd>
    ${purpose === 'price' && r.hasBaseline ? `<dt>On all of it, or only the extra?</dt><dd>${inr(e.onAll)} vs <b>${inr(e.onAbove)}</b> · ${e.saved > 0 ? `<span class="ok">paying only on the extra saves ${inr(e.saved)}</span>` : 'no extra over the usual order, so nothing is earned on the extra-only basis'}</dd>` : ''}
    <dt>What they usually buy</dt><dd>${r.hasBaseline ? `${inr(f.baseline)} (average of last ${r.pastCount})` : 'No past orders: break-even shown, extra sales unknown'}</dd>
    <dt>Does it pay for itself?</dt><dd>We assume the brand keeps ₹${Math.round(f.margin)} of every ₹100 (${f.margin}% margin). Needs <b>${e.breakEvenPct}%</b> more buying${r.hasBaseline ? ` · got <b>${e.upliftPct}%</b> · ${e.paidBack ? '<span class="ok">yes</span>' : `<span class="bad">no, loses ${inr(-e.net)}</span>`}` : ''}</dd>
    <dt>Past notes with them</dt><dd>${r.buyer.recoveryPct === null ? 'No credit notes with this retailer yet' : `Accepted ${r.buyer.accepted} of ${r.buyer.notes} credit notes`}</dd>
    <dt>Last date for the tax cut</dt><dd>${r.late ? '<span class="bad">Passed: only a financial credit note is possible</span>' : `${fmt(r.deadline.date)} · ${r.daysLeft} days`}</dd>
    <dt>What is this money for</dt><dd>${purpose === 'damage' ? '<span class="bad">A damage claim is not a discount. It needs a goods-return note and the retailer\'s return acknowledgement.</span>' : purpose === 'promo' ? 'A promotion or ad payment: we are buying something from the retailer, so it needs its own GST invoice, not a discount note.' : purpose === 'early' ? 'Early payment: judged on how many days sooner the cash arrives, not on extra sales.' : basis === 'above' ? 'A price cut, only on what the retailer takes above its usual order.' : 'A price cut on the whole bill.'}</dd>
  </dl>
  ${p ? payoutBox(f, p, r.gst) : ''}
  <button class="btn pri" data-a="ask-go" type="button">Send for approval</button>`;
}
function askCard() {
  const p = S.ask?.purpose ?? 'price';
  const opts = [['price', 'Price cut on the bill', 'Money off the price. Nothing else changes.'],
    ['promo', 'Promotion or ad payment', 'A display, a slot, an ad. We bought something from the retailer, so it is a purchase, not a discount.'],
    ['damage', 'Damage claim', 'Goods came back damaged. That is a return, and it needs a return note, not a discount.'],
    ['early', 'Paid us early', 'Money off for paying before the due date. It buys faster cash, not more boxes, so no volume test.']];
  const b = S.ask?.basis ?? 'above';
  return `<section class="card ask"><h2>Ask for a discount</h2><p class="sub">Two numbers and one question: what is the money actually for? Everything else is filled in from data Ten Today already has.</p>
    <div class="ask-in"><label>Invoice number<input class="cr-in" id="ask-inv" list="ask-list" placeholder="INV-2603-301" value="${esc(S.ask?.inv ?? '')}" autocomplete="off"></label><label>Discount %<input class="cr-in" id="ask-pct" type="number" min="0.5" max="25" step="0.5" placeholder="6" value="${esc(S.ask?.pct ?? '')}"></label></div>
    <div class="ask-why" role="radiogroup" aria-label="What is the money for?">${opts.map(([v, t, s]) => `<label class="ask-o"><input type="radio" name="ask-purpose" value="${v}"${p === v ? ' checked' : ''}><b>${t}</b><span>${s}</span></label>`).join('')}</div>
    ${p === 'price' ? `<div class="ask-why" role="radiogroup" aria-label="Discount on which part of the order?"><label class="ask-o"><input type="radio" name="ask-basis" value="above"${b === 'above' ? ' checked' : ''}><b>Only on the extra boxes</b><span>Usual order at full price. The discount applies only above it. Recommended.</span></label><label class="ask-o"><input type="radio" name="ask-basis" value="all"${b === 'all' ? ' checked' : ''}><b>On the whole order</b><span>Every box gets the discount, including the ones the retailer was going to take anyway.</span></label></div>` : ''}
    <datalist id="ask-list">${C.INVOICES.filter(x => x.date >= '2026-03-01').map(x => `<option value="${x.no}">${esc(x.buyer)}</option>`).join('')}</datalist>
    <div id="ask-pv">${askPreview(S.ask?.inv, S.ask?.pct, p, b)}</div></section>`;
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
  root.innerHTML = `<div class="cr-top cr-center"><p class="eyebrow">Discount controls</p><h1>Every rupee you give back after a sale, checked.</h1>
      <p class="cr-sub">Seven questions for each discount. A "no" goes to a named person, with a deadline and the rupees at stake.</p>
      <div class="cr-tb"><a class="btn pri" href="case.html">The Meera File, live →</a><button class="btn" data-a="walk" type="button">▶ Walkthrough</button><a class="btn" href="ba.html">BA pack</a></div></div>
    <a class="feat" href="case.html"><span class="feat-k">Featured case</span><b>The Meera File</b><span>₹64,000 given back · ₹11,520 GST given up · C1 open with Vikram in ServiceNow</span><em>Open it live →</em></a>
    <details class="card st1 st1-fold"><summary>The seven questions, told through Meera</summary><ol class="st1-l">
      <li><span class="ck-n">1</span><div><b>Is it worth it?</b><span>Meera had to buy 18.5% more than usual for the ₹64,000 to pay for itself. She bought nothing extra, so no: the whole ₹64,000 bought no sales. Paying only on sales above her usual order would have cost nothing.</span></div></li>
      <li><span class="ck-n">2</span><div><b>Did the right person say yes?</b><span>Neha tried to approve her own request: refused. Vikram approved it, at exactly his 8% limit.</span></div></li>
      <li><span class="ck-n">3</span><div><b>Is it really a price cut?</b><span>Yes. No ad bill or service mixed in, so it can go on a discount credit note.</span></div></li>
      <li><span class="ck-n">4</span><div><b>Right paperwork, on time?</b><span>Farah sends a GST credit note (a "minus bill"), under the rule in force since 1 Nov 2026, and reports it on time.</span></div></li>
      <li><span class="ck-n">5</span><div><b>Did the retailer accept it?</b><span>Meera rejected it on the GST portal: "slab not met". ₹11,520 of tax at risk, an incident for Asha within 48 hours, and Meera blocked from new discounts. Today it is still open with Asha in ServiceNow. How it closes: Meera was right, so it is settled as a financial credit note, with the ₹11,520 given up on the record.</span></div></li>
      <li><span class="ck-n">6</span><div><b>Did the right money arrive?</b><span>Every Rupee matched ₹7,36,000: the bill minus the agreed ₹64,000, to the rupee.</span></div></li>
      <li><span class="ck-n">7</span><div><b>Can anyone change the record?</b><span>Every step is fingerprinted in Ten Today and sealed in ServiceNow. Edit one later and it shows exactly which.</span></div></li>
    </ol></details>
    <h2 class="st1-h">Your 10 retailers this year</h2>
    ${head(k, sw)}
    <section class="card"><h2>Pick a retailer to see its seven answers</h2>${V.heatmap(k.rows.map(x => ({ id: x.d.id, name: x.d.buyer, money: inr(C.discountOf(x.d)), cells: x.r.controls.map(c => ({ s: c.status, rupees: c.rupees, who: c.owner?.who ?? '', text: c.text })) })), k.rows[0].r.controls.map(c => c.name), (id, n) => `#controls/${id}/C${n + 1}`)}<p class="sub">Green = yes, red = no, yellow = waiting.</p><div class="cr-l">${k.rows.map(x => `<button type="button" data-sel="${x.d.id}" class="${x.d.id === d.id ? 'on' : ''}" aria-pressed="${x.d.id === d.id}"><b>${esc(x.d.buyer)}</b> <small style="color:#6B6460">${x.d.id}</small><span>${x.r.controls.map(c => `<i class="${c.status}" title="${c.id} ${c.status}"></i>`).join('')}</span></button>`).join('')}</div>${detail(d, k)}</section>
    <details class="cr-more-d card"><summary>Try it yourself: ask for a discount</summary>${askCard()}</details>
    <details class="cr-more-d card"><summary>Every "no" as a task · ${k.tickets.length} open</summary><figure class="hl-tag"><div class="hl" data-hl="relay" data-hl-label="A hub and branches; the path to the tile under the pointer lights hop by hop"></div><figcaption><b>Each "no" travels to one person.</b> The path lights hop by hop, from the failed check to its owner, the way a task here moves to Vikram, Farah or Asha with a due date.</figcaption></figure><p class="sub">Each one has an owner, a due date in working days, and the rupees at stake, like a ServiceNow or JIRA ticket.</p>${queue(k)}</details>
    <div class="one-flow" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin:14px 0;padding:12px;border:1px solid #ECE7E1;border-radius:14px;background:#fff">
  <a href="app.html#today" style="text-decoration:none;color:#1C1917;padding:8px 10px;border-radius:10px;"><small style="display:block;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B6460">① Before the sale · Today desk</small><b>Each rep's top-10 to-do.</b> A discount on the price is asked for here; the sales manager (Kavita) approves.</a>
  <a href="app.html#controls" style="text-decoration:none;color:#1C1917;padding:8px 10px;border-radius:10px;background:#F5F2EE;"><small style="display:block;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B6460">② After the sale · Discount controls</small><b>Money given back later.</b> Rebates and credit notes; finance (Vikram) approves and seven checks run.</a>
  <a href="https://everyrupee-o2c.vercel.app/" style="text-decoration:none;color:#1C1917;padding:8px 10px;border-radius:10px"><small style="display:block;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B6460">③ When cash arrives · Every Rupee ↗</small><b>Payment matched.</b> A short payment becomes a task, and a rep with one open can't ask for a new discount.</a>
</div>

    <details class="cr-more-d card"><summary>For finance, tax and audit: sign-off, reports, rules</summary><section class="cr-more">${signBlock()}<div class="cr-act">
      <a class="btn" href="ba.html#uat">Run the UAT live →</a><button class="btn" data-a="sample" type="button">Pick 5 at random, like an auditor</button><button class="btn" data-a="mis" type="button">Weekly report of the checks (CSV)</button><button class="btn" data-a="racm" type="button">Risk and control matrix: what can go wrong, which check stops it (CSV)</button>
      <label class="cr-s">GSTR-9 for FY 2025-26 filed on <input type="date" class="cr-in" id="cr-g9" value="${S.settings.gstr9Filed['2025-26'] ?? ''}"></label><button class="btn ghost" data-a="reset" type="button">Reset sample</button></div>
      <p class="cr-s" style="margin:8px 0 0"><label><input type="checkbox" id="cr-ei"${S.settings.eInvoice ? ' checked' : ''}> We must report every credit note to the e-invoice system (turnover of ₹10 crore or more). Then the 30-day clock in check 4 applies.</label></p>
      <details class="cr-ru"${innerWidth > 640 ? " open" : ""}><summary>Terms in plain words</summary><dl class="cr-gl">
        <dt>Post-sale discount</dt><dd>Money given back to a retailer after the bill, for example a 6% rebate for hitting a target.</dd>
        <dt>Credit note</dt><dd>A "minus bill". A <b>GST credit note</b> also lowers the tax on the sale; a <b>financial credit note</b> returns money but leaves the tax as billed.</dd>
        <dt>GST portal reply page (IMS)</dt><dd>The page on the GST portal where the retailer accepts or rejects your credit note. They can act until they file their own GSTR-3B, usually the 20th of the next month, and one more tax period if they mark it Pending. Rejected means your tax saving is lost; silence after that counts as accepted, but nobody has confirmed it.</dd>
        <dt>Netting</dt><dd>One payment carrying two things: a discount you gave, and a bill the retailer sent you. The bank shows one amount; the tax needs two records.</dd>
        <dt>Ad invoice</dt><dd>The retailer's bill to you for an ad, a slot or a display. It carries its own GST. It is a purchase you make, not a discount you give, so it must never be settled with a discount note.</dd>
        <dt>E-invoice 30-day clock</dt><dd>Where e-invoicing applies, a credit note must be reported to the e-invoice system within 30 days of its date. After that the portal rejects it and the tax cut never reaches the retailer.</dd>
        <dt>Damage claim</dt><dd>Goods came back damaged. That is a return, not a discount: it needs a goods-return note and the retailer's acknowledgement, not a credit note that hides it inside a price cut.</dd>
        <dt>Last date for a tax cut (s.34(2))</dt><dd>The last date to issue a credit note that lowers tax: 30 Nov after the financial year of the bill, or the annual return date if that is earlier.</dd>
        <dt>Gross margin (51.15%)</dt><dd>What is left of each ₹100 of sales after paying for the goods. Every example uses <b>51.15%</b> — Hindustan Unilever's FY25 margin (StockAnalysis). It is a stand-in, not a fact about these retailers. A thinner margin makes a discount costlier: 6% off needs 13.3% more buying at 51.15%, but 42.9% more at 20%.</dd>
        <dt>Break-even</dt><dd>How much more the retailer must buy for the discount to pay for itself: discount ÷ (margin − discount). 8% at the 51.15% margin (Meera) needs 18.5% more.</dd>
        <dt>Maker-checker</dt><dd>The person who asks can't be the person who approves.</dd>
        <dt>Exception / ticket</dt><dd>A failed check turned into a task with an owner, a due date and the money at stake.</dd>
        <dt>Hash chain (tamper-evident)</dt><dd>Each recorded step carries a fingerprint of the one before it, so changing any old entry breaks every fingerprint after it and shows exactly where.</dd>
        <dt>Risk and control matrix</dt><dd>The auditor's table: what can go wrong, which check stops it, who owns it, and how to test it.</dd>
      </dl></details>
      <details class="cr-ru"><summary>Rules in force, with effective dates · ${C.RULES.length}</summary><div class="tbl"><table><thead><tr><th>Rule</th><th>From</th><th>To</th><th>What it says</th><th>Source</th></tr></thead><tbody>${C.RULES.map(r => `<tr><td><b>${r.id} v${r.v}</b><br><small>${esc(r.name)}</small></td><td>${fmt(r.from)}</td><td>${r.to ? fmt(r.to) : 'in force'}</td><td>${esc(r.text)}</td><td><small>${esc(r.src)}</small></td></tr>`).join('')}</tbody></table></div><p class="cr-s">Rules change, so each decision is judged by the version in force on its date: a note issued on 28 Oct follows the old rule (v1), one issued on 2 Nov the new one (v2).</p></details>
      <details class="cr-ru"><summary>Risk and control matrix · C1–C7</summary><div class="tbl"><table><thead><tr><th>Control</th><th>Risk</th><th>Control activity</th><th>Type · frequency</th><th>Owner</th><th>Evidence</th><th>Test</th></tr></thead><tbody>${C.RACM.map(r => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}<br><small>${esc(r[4])}</small></td><td>${esc(r[5])}</td><td>${esc(r[6])}</td><td>${esc(r[7])}</td></tr>`).join('')}</tbody></table></div></details>
      <p class="cr-fn">Not tax advice. Nothing is sent to the GST portal: finance records what the retailer did there. “Send to ServiceNow” creates a real record in a ServiceNow developer instance; JIRA tickets are previews. Sample retailers and figures.</p></section></details>
    ${S.walk ? walkHtml() : ''}${S.pack ? packHtml() : ''}${S.sign ? signHtml() : ''}`;
}

function act(a, el) {
  const d = cur(), today = C.todayIso(); S.err = ''; S.note = '';
  try {
    if (a === 'sweep') S.sweep = !S.sweep;
    else if (a === 'split') put(C.splitRecord(d, today, 'Asha', $('#cr-note')?.value ?? ''));
    else if (a === 'report') put(C.reportNote(d, today, 'Farah', `IRN-${d.id}`));
    else if (a === 'rv-price' || a === 'rv-service') put(C.taxReview(d, today, 'Farah', a === 'rv-price' ? 'price' : 'service', $('#cr-note')?.value ?? ''));
    else if (a === 'route-gst') put(C.chooseRoute(d, today, 'Farah', 'gst', 'Registered buyer; IMS action expected'));
    else if (a === 'route-fin') put(C.chooseRoute(d, today, 'Farah', 'fin', 'GST cut not worth the retailer reversing ITC'));
    else if (a === 'route-service') put(C.chooseRoute(d, today, 'Farah', 'service', 'Retailer bills the promotion service with its own GST'));
    else if (a === 'to-fin') { put(C.issueNote(C.chooseRoute(d, today, 'Farah', 'fin', `Retailer rejected in IMS: ${d.imsRemark}. GST cut given up`), today, 'Farah', `FCN-${d.id}`)); S.note = 'Settled as a financial credit note. The discount stands; the GST cut is given up and nothing goes back to IMS.'; }
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
    else if (a === 'ask-go') { const r = C.draftRequest(S.ask.inv, +S.ask.pct, ctx(), C.INVOICES, S.ask.purpose ?? 'price', S.ask.basis ?? 'above'); const id = `D-${101 + S.list.length}`; S.list = [...S.list, C.request({ ...r.fields, id }, today, 'Neha')]; S.sel = id; S.ask = { inv: '', pct: '' }; S.note = `${id} sent to Vikram with the break-even, retailer record and deadline filled in.`; }
    else if (a === 'approve') put(C.approve(d, today, 'Vikram', 8));
    else if (a === 'approve-self') put(C.approve(d, today, 'Neha', 8));
    else if (a === 'sign') { S.sign = true; S.signNotes = {}; }
    else if (a === 'sign-x') S.sign = null;
    else if (a === 'sign-go') { document.querySelectorAll('[data-note]').forEach(i => { S.signNotes[i.dataset.note] = i.value; }); const r = C.signOff(S.list, ctx(), 'Vikram', S.signNotes, S.signoffs.at(-1)); S.signoffs = [...S.signoffs, r]; S.sign = null; S.note = `Signed. Fingerprint ${r.hash.slice(0, 10)}. Arjun can countersign below.`; }
    else if (a === 'reset') { S = fresh(); try { localStorage.removeItem(KEY); } catch { /* fine */ } }
  } catch (e) { S.err = e.message; }
  // a ticket opens the day its control first fails
  for (const x of C.desk(S.list, ctx()).tickets) S.opened[x.key] ??= x.opened;
  save(); render();
  if (S.walk || S.pack) $('#ctrl-room .cr-w')?.scrollIntoView({ block: 'nearest' });
}

document.addEventListener('click', e => {
  const snb = e.target.closest('[data-sn]'); if (snb) { const id = snb.dataset.sn; SN[id] = { busy: true }; render();
    fetch('/api/servicenow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
      .then(async r => { const j = await r.json().catch(() => ({})); SN[id] = r.ok ? { res: j } : { error: j.error ?? 'Could not reach the server.' }; })
      .catch(() => { SN[id] = { error: 'Could not reach the server.' }; }).finally(render); return; }
  const root = $('#ctrl-room'); if (!root || !root.contains(e.target)) return;
  const sel = e.target.closest('[data-sel]'); if (sel) { S.focus = null; S.sel = sel.dataset.sel; S.err = ''; S.note = ''; save(); render(); root.querySelector('.cr-d')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  const v = e.target.closest('[data-view]'); if (v) { S.view = v.dataset.view; save(); render(); root.querySelector('.tk')?.scrollIntoView({ block: 'nearest' }); return; }
  const cpy = e.target.closest('[data-copy]'); if (cpy) { const r = C.evaluate(cur(), ctx()), tk = r.tickets[0]; if (tk) navigator.clipboard?.writeText(JSON.stringify(S.view === 'jira' ? C.jiraIssue(tk) : C.serviceNowIncident(tk), null, 2)).then(() => { cpy.textContent = 'Copied ✓'; }); return; }
  const cs = e.target.closest('[data-cs]'); if (cs) { S.signoffs = S.signoffs.map(r => (r.week === cs.dataset.cs ? C.countersign(r, 'Arjun', C.todayIso()) : r)); save(); render(); return; }
  const b = e.target.closest('[data-a]'); if (b) { if (b.dataset.a === 'sign-go') document.querySelectorAll('[data-note]').forEach(i => { (S.signNotes ??= {})[i.dataset.note] = i.value; }); act(b.dataset.a, b); }
});
document.addEventListener('input', e => { if (e.target.id === 'ask-inv' || e.target.id === 'ask-pct') { S.ask = { ...(S.ask ?? {}), inv: $('#ask-inv').value, pct: $('#ask-pct').value }; $('#ask-pv').innerHTML = askPreview(S.ask.inv, S.ask.pct, S.ask.purpose ?? 'price', S.ask.basis ?? 'above'); } });
document.addEventListener('change', e => {
  if (e.target.id === 'cr-g9') { S.settings.gstr9Filed['2025-26'] = e.target.value || null; save(); render(); }
  else if (e.target.id === 'cr-ei') { S.settings.eInvoice = e.target.checked; save(); render(); }
  else if (e.target.name === 'ask-purpose') { S.ask = { ...(S.ask ?? {}), purpose: e.target.value }; render(); }
  else if (e.target.name === 'ask-basis') { S.ask = { ...(S.ask ?? {}), basis: e.target.value }; $('#ask-pv').innerHTML = askPreview(S.ask.inv, S.ask.pct, S.ask.purpose ?? 'price', S.ask.basis); }
});

/* Deep links: app.html#controls/D-102/C5 · #controls/sweep · #controls/walk */
function deepLink() {
  const p = location.hash.slice(1).split('/'); if (p[0] !== 'controls' || p.length < 2) return;
  $('#drawer') && ($('#drawer').hidden = true);
  if (p[1] === 'sweep') S.sweep = true;
  else if (p[1] === 'ask' || p[1] === 'signoff') { render(); return setTimeout(() => document.querySelector(p[1] === 'ask' ? '#ctrl-room .ask' : '#ctrl-room .so')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120); }
  else if (p[1] === 'walk') S.walk = { steps: C.walkthrough(C.todayIso()), i: 0 };
  else if (S.list.some(d => d.id === p[1])) { S.sel = p[1]; S.focus = p[2] ?? null; }
  render();
  setTimeout(() => (document.querySelector(p[1] === 'sweep' ? '.cr-sw' : S.focus ? `#cr-${S.focus}` : p[1] === 'walk' ? '#ctrl-room .cr-w' : '#ctrl-room .cr-d'))?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
}
window.addEventListener('hashchange', deepLink);
render();
deepLink();
