/**
 * Ten Today · post-sale discount controls (C1–C7).
 * Pure rules: every number is computed from the record, every rule has an effective date,
 * every discount keeps its own hash-chained evidence. No GST portal calls; IMS actions are recorded by finance.
 * Sources: CGST s.15(3)(b) and s.34 as amended (Finance Act 2026, Notification 03/2026-CT, from 1 Nov 2026);
 * s.34(2) deadline; CBIC Circular 251/08/2025-GST (financial credit notes, promotional services);
 * GSTN IMS advisory (credit note pending for one tax period); a rejected credit note puts the tax back on the supplier's liability.
 */
import { sha256 } from './engine.js';

/* ---------- dates ---------- */
const D = 86400000;
const t = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const iso = ms => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d, n) => iso(t(d) + n * D);
export const daysBetween = (a, b) => Math.round((t(b) - t(a)) / D);
export const todayIso = () => { const n = new Date(); return iso(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
export const fyOf = d => { const y = +d.slice(0, 4), m = +d.slice(5, 7); const s = m >= 4 ? y : y - 1; return `${s}-${String(s + 1).slice(2)}`; };
const isWorking = d => new Date(t(d)).getUTCDay() !== 0;
export function addWorkingDays(d, n) { let x = d; while (n > 0) { x = addDays(x, 1); if (isWorking(x)) n--; } return x; }
export const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

/* ---------- rules with effective dates: a decision is judged by the version in force on its date ---------- */
export const RULES = [
  { id: 'PSD', v: 1, from: '2017-07-01', to: '2026-10-31', name: 'Post-sale discount, old s.15(3)(b)', text: 'A post-sale discount cuts GST only if it was agreed before or at supply and linked to specific invoices, with a credit note and the buyer reversing ITC.', src: 'CGST s.15(3)(b) as it stood until 31 Oct 2026' },
  { id: 'PSD', v: 2, from: '2026-11-01', to: null, name: 'Post-sale discount, amended', text: 'No prior agreement or invoice link needed. GST is cut only through a s.34 credit note, and only if the buyer reverses the matching ITC.', src: 'Finance Act 2026 · Notification 03/2026-CT (26 Oct 2026)' },
  { id: 'S34', v: 1, from: '2017-07-01', to: null, name: 'Credit note deadline', text: 'Declare the credit note by 30 Nov after the end of the financial year of the supply, or the annual return (GSTR-9) filing date if that is earlier.', src: 'CGST s.34(2)' },
  { id: 'IMS', v: 2, from: '2025-10-01', to: null, name: 'Buyer action on the GST portal (IMS)', text: 'The buyer can accept, reject (with a remark) or keep a credit note pending. They can act until they file their own GSTR-3B for that month, usually the 20th of the next month, and one more tax period if they mark it pending. Silence after that counts as accepted. A rejection puts the tax back on the supplier.', src: 'GSTN portal advisories (Advisory 631, 17 Oct 2025)' },
  { id: 'EI30', v: 1, from: '2025-04-01', to: null, name: '30-day e-invoice reporting', text: 'Where e-invoicing applies (turnover of ₹10 crore or more), a credit note must be reported to the e-invoice system within 30 days of its date. Report it later and the portal rejects it, so the tax cut never reaches the buyer.', src: 'E-invoice reporting rule, from 1 Apr 2025' },
  { id: 'FCN', v: 1, from: '2025-09-12', to: null, name: 'Financial credit note', text: 'A financial credit note leaves GST as billed; the buyer reverses nothing. A payment for a distinct promotion service under an explicit agreement is a separate supply, not a discount.', src: 'CBIC Circular 251/08/2025-GST' },
];
export const ruleAt = (id, date) => RULES.find(r => r.id === id && r.from <= date && (!r.to || date <= r.to)) ?? null;

/* ---------- money ---------- */
/* basis 'all' = discount on the whole order; 'above' = only on what the buyer takes above its usual order (the baseline). */
export const onAll = d => Math.round(d.value * d.pct / 100);
export const onAbove = d => Math.round(Math.max(0, d.value - d.baseline) * d.pct / 100);
export const discountOf = d => d.basis === 'above' ? onAbove(d) : onAll(d);
export const gstOf = d => Math.round(discountOf(d) * d.rate / 100);
/* Break-even extra volume for a discount d at gross margin m: d / (m − d). */
export const breakEven = (pct, margin) => Math.round(pct / (margin - pct) * 1000) / 10;
export function economics(d) {
  const m = d.margin / 100, p = d.pct / 100;
  const upliftPct = Math.round((d.value - d.baseline) / d.baseline * 1000) / 10;
  const extraMargin = Math.max(0, Math.round((d.value - d.baseline) * m));
  const net = Math.round(d.value * m - discountOf(d) - d.baseline * m); // profit with the discount minus profit at the usual order
  // On 'above', every extra rupee earns margin m and costs only d of it, so any uplift pays: break-even is 0.
  return { discount: discountOf(d), onAll: onAll(d), onAbove: onAbove(d), saved: onAll(d) - onAbove(d), breakEvenPct: d.basis === 'above' ? 0 : breakEven(d.pct, d.margin), upliftPct, extraMargin, net, paidBack: net >= 0, multiple: discountOf(d) ? Math.round(extraMargin / discountOf(d) * 10) / 10 : 0 };
}
export const netDue = d => d.value - discountOf(d); // before GST, like every amount here

/* ---------- deadlines ---------- */
export function deadline(d, settings) {
  const fy = fyOf(d.invoiceDate), y = 2000 + +fy.slice(-2);
  const cap = `${y}-11-30`, filed = settings.gstr9Filed?.[fy];
  return filed && filed < cap ? { date: filed, why: `GSTR-9 for FY ${fy} filed ${filed}` } : { date: cap, why: `30 Nov after FY ${fy}` };
}
/* The buyer's clock, in plain words: they can act in IMS until they file their own GSTR-3B for the month
   the credit note appears in — usually the 20th of the next month. If they park it as Pending, it stays open
   one more tax period (the 20th of the month after that). Only after both windows close does silence count
   as acceptance, and even then nobody has confirmed anything. */
export const imsActionBy = issued => { const y = +issued.slice(0, 4), m = +issued.slice(5, 7); return iso(Date.UTC(y, m, 20)); };
export const imsPendingExpires = issued => { const y = +issued.slice(0, 4), m = +issued.slice(5, 7) + 1; return iso(Date.UTC(y, m, 20)); };
export const imsDecideBy = imsActionBy; // kept for older callers

/* 30-day e-invoice reporting window for one document. */
export const reportBy = on => addDays(on, 30);

/* ---------- one buyer, two bills: the discount and the ad invoice arrive in the same payout ---------- */
export const OPEN_AD = {
  'Navkar Traders': [{ no: 'AD-2610-07', amount: 40000, gst: 7200 }],
  'Shree Ganesh Agencies': [{ no: 'AD-2610-11', amount: 25000, gst: 4500 }],
};
export const adOpen = buyer => OPEN_AD[buyer] ?? [];
export const adTotal = buyer => adOpen(buyer).reduce((s, x) => s + x.amount + x.gst, 0);

/* ---------- buyer track record (feeds the approval) ---------- */
export function buyerRecord(ctx, buyer) {
  const h = ctx.history[buyer] ?? [];
  const acted = h.filter(x => x !== 'pending');
  const accepted = acted.filter(x => x === 'accepted').length, rejected = acted.filter(x => x === 'rejected').length;
  return { notes: acted.length, accepted, rejected, recoveryPct: acted.length ? Math.round(accepted / acted.length * 100) : null };
}

/* ---------- owners and turnaround (working days) ---------- */
export const OWNERS = {
  C1: { who: 'Vikram', role: 'Finance controller', tat: 1 }, C2: { who: 'Vikram', role: 'Finance controller', tat: 1 },
  C3: { who: 'Farah', role: 'Tax desk', tat: 2 }, C4: { who: 'Farah', role: 'Tax desk', tat: 2 },
  C5: { who: 'Asha', role: 'Receivables', tat: 2 }, C6: { who: 'Asha', role: 'Receivables', tat: 3 }, C7: { who: 'Vikram', role: 'Finance controller', tat: 1 },
};
export const CONTROLS = [
  ['C1', 'Economics', 'Is it worth it? Break-even shown before approval'], ['C2', 'Authority', 'Right person said yes? Within limit, not the requester'],
  ['C3', 'Classification', 'Really a discount, not payment for a service?'], ['C4', 'Tax route', 'Right kind of credit note, on time, under the rule in force?'],
  ['C5', 'Recovery', 'Did the buyer accept it on the GST portal?'], ['C6', 'Cash', 'Did the agreed amount arrive?'], ['C7', 'Evidence', 'Is the record complete and untouched?'],
];

/* ---------- evidence: each discount carries its own hash chain ---------- */
const hashOf = e => sha256(JSON.stringify({ n: e.n, on: e.on, who: e.who, what: e.what, data: e.data, prev: e.prev }));
export function log(d, on, who, what, data = {}) {
  const prev = d.events.length ? d.events.at(-1).hash : 'GENESIS';
  const e = { n: d.events.length + 1, on, who, what, data, prev }; e.hash = hashOf(e); d.events.push(e); return d;
}
export function verify(d) {
  let prev = 'GENESIS';
  for (const [i, e] of d.events.entries()) { if (e.n !== i + 1 || e.prev !== prev || hashOf(e) !== e.hash) return { ok: false, at: i + 1, what: e.what }; prev = e.hash; }
  return { ok: true, count: d.events.length };
}
const has = (d, what) => d.events.some(e => e.what === what);
const ev = (d, what) => d.events.filter(e => e.what === what).at(-1);

/* ---------- actions (pure: each returns a new record) ---------- */
const cp = d => structuredClone(d);
export function request(fields, on, who) {
  const d = { ...fields, requestedBy: who, events: [] };
  const e = economics(d);
  log(d, on, who, 'requested', { buyer: d.buyer, invoice: d.invoiceNo, pct: d.pct, discount: e.discount, purpose: d.purpose });
  return log(d, on, 'system', 'economics', { breakEvenPct: e.breakEvenPct, upliftPct: e.upliftPct, net: e.net, margin: d.margin });
}
export function approve(d0, on, who, limitPct) {
  if (who === d0.requestedBy) throw new Error('C2: the requester cannot approve their own discount.');
  if (d0.pct > limitPct) throw new Error(`C2: ${d0.pct}% is above ${who}'s limit of ${limitPct}%. Route it up.`);
  const d = cp(d0); d.approvedBy = who; d.limitPct = limitPct; d.approvedOn = on;
  return log(d, on, who, 'approved', { pct: d.pct, limitPct });
}
export function taxReview(d0, on, who, verdict, note) {
  if (!note?.trim()) throw new Error('C3: write down why, so the auditor can follow it.');
  const d = cp(d0); d.review = verdict; return log(d, on, who, 'tax review', { verdict, note });
}
export function chooseRoute(d0, on, who, route, reason) {
  if (!reason?.trim()) throw new Error('C4: record the reason for the route.');
  const d = cp(d0); d.route = route; return log(d, on, who, 'route', { route, reason });
}
export function issueNote(d0, on, who, no) {
  const d = cp(d0); d.cnNo = no; d.cnOn = on; d.ims = 'pending'; d.reportedOn = null; delete d.imsRemark;
  return log(d, on, who, 'credit note', { no, taxable: discountOf(d), gst: d.route === 'gst' ? gstOf(d) : 0, rule: `PSD v${ruleAt('PSD', on).v}` });
}
/* Reporting the note to the e-invoice system. Separate from issuing it: the portal clock runs on this date. */
export function reportNote(d0, on, who, irpRef) {
  if (!d0.cnNo) throw new Error('C4: there is no credit note to report yet.');
  const d = cp(d0); d.reportedOn = on; if (irpRef) d.irpRef = irpRef;
  return log(d, on, who, 'reported', { irpRef: irpRef ?? '' });
}
/* Splitting one payout into two records: the discount, and the ad invoice. Done before any note is issued. */
export function splitRecord(d0, on, who, note) {
  if (!note?.trim()) throw new Error('C3: write down how the payout was split, so the two amounts can be told apart later.');
  const d = cp(d0); d.split = note.trim();
  return log(d, on, who, 'split', { note: note.trim(), ad: adTotal(d.buyer) });
}
export function recordIms(d0, on, who, ims, remark = '') {
  if (ims === 'rejected' && !remark.trim()) throw new Error('C5: copy the buyer\'s rejection remark from the GST portal.');
  const d = cp(d0); d.ims = ims; d.imsOn = on; if (remark) d.imsRemark = remark;
  return log(d, on, who, 'ims', { ims, remark });
}
export function recordPayment(d0, on, who, amount, ref) {
  const d = cp(d0); d.received = (d.received ?? 0) + amount; return log(d, on, who, 'payment', { amount, ref });
}

/* ---------- the seven controls ---------- */
export function evaluate(d, ctx) {
  const today = ctx.today, dl = deadline(d, ctx.settings), daysLeft = daysBetween(today, dl.date), e = economics(d), gst = gstOf(d);
  const out = {};
  const set = (id, status, text, rupees = 0) => { out[id] = { id, status, text, rupees }; };
  const apv = ev(d, 'approved'), eco = ev(d, 'economics');
  // C1
  if (d.purpose === 'early') { if (!apv) set('C1', 'wait', 'Waiting for approval · early-payment discount: judged on days of cash gained, not on extra sales'); else set('C1', 'pass', 'Early-payment discount: it buys faster cash, not more boxes, so no volume test applies'); }
  else if (!apv) set('C1', 'wait', `Waiting for approval · the buyer must buy ${e.breakEvenPct}% more than usual for this to pay for itself`);
  else if (eco && eco.n < apv.n) set('C1', 'pass', `Needed ${e.breakEvenPct}% more sales, shown before approval · got ${e.upliftPct}% · ${e.paidBack ? `paid for itself (${e.multiple}× the discount in extra profit)` : `lost ${inr(-e.net)}`}`);
  else set('C1', 'fail', 'Approved before anyone checked if it was worth it', e.discount);
  // C2
  if (!apv) set('C2', 'wait', 'Not approved yet');
  else if (apv.who === d.requestedBy || d.pct > d.limitPct) set('C2', 'fail', apv.who === d.requestedBy ? 'Approved by the requester' : `${d.pct}% approved above ${apv.who}'s ${d.limitPct}% limit`, e.discount);
  else set('C2', 'pass', `${apv.who} approved ${d.pct}% within a limit of ${d.limitPct}%`);
  // C3 — three questions in one: is it a discount at all, is it for a service, and is it arriving in one payout with something else?
  const service = d.review === 'service';
  const ads = adOpen(d.buyer), adAmt = ads.reduce((s, x) => s + x.amount + x.gst, 0);
  const adWhat = ads.map(x => `${x.no} (${inr(x.amount)} + ${inr(x.gst)} GST)`).join(', ');
  if (d.purpose === 'damage') set('C3', 'fail', `Not a discount: the goods came back damaged. This is a return against ${d.invoiceNo}, so it needs a goods-return note and the buyer's return acknowledgement. A discount credit note here would hide a return inside a price cut`);
  else if (ads.length && !d.split) set('C3', 'fail', `${d.buyer} also has an open ad invoice ${adWhat}. One payout will arrive with both the discount and that ad bill inside it, so a credit note issued now settles against a service purchase, not a discount. Split the payout into two records first`, adAmt);
  else if (d.purpose === 'promo' && !d.review) set('C3', 'fail', 'Linked to a shelf display or promotion: the tax team must decide if it is a discount or a paid service', gst);
  else set('C3', 'pass', service ? 'Tax team: a paid service, so the buyer bills it separately with its own GST' : d.review === 'price' ? `Tax team confirmed it is a price cut${d.split ? ' · payout split, ad invoice kept separate' : ''}` : `Price cut on the invoice value${d.split ? ' · payout split, ad invoice kept separate' : ''}`);
  // C4
  const psd = d.cnOn ? ruleAt('PSD', d.cnOn) : null;
  if (service) set('C4', d.route === 'service' ? 'pass' : 'fail', d.route === 'service' ? 'Settled against the buyer\'s service invoice, no credit note' : 'A service cannot go through a credit note', d.route === 'service' ? 0 : gst);
  else if (!d.route) set('C4', today > dl.date ? 'fail' : 'wait', today > dl.date ? `Deadline ${dl.date} passed with nothing issued: the tax saving is gone. Finance can still return the money with a financial credit note` : `Kind of credit note not chosen yet · ${daysLeft} days to ${dl.date} (${dl.why})`, today > dl.date ? gst : 0);
  else if (d.route === 'fin') set('C4', d.cnNo ? 'pass' : 'wait', d.cnNo ? `Financial credit note ${d.cnNo}: money back, tax unchanged, nothing for the buyer to do` : 'Financial credit note to issue');
  else if (!d.cnNo) set('C4', today > dl.date ? 'fail' : 'wait', today > dl.date ? `GST credit note not issued by ${dl.date}: the tax saving is gone. Finance can still use a financial credit note` : `GST credit note to issue · ${daysLeft} days to ${dl.date} (${dl.why})`, today > dl.date ? gst : 0);
  else if (d.cnOn > dl.date) set('C4', 'fail', `Credit note dated ${d.cnOn}, after the ${dl.date} deadline`, gst);
  else if (psd.v === 1 && !d.priorAgreement) set('C4', 'fail', `${d.cnNo} was issued on ${d.cnOn}, before the 1 Nov rule change, with no prior agreement, so it doesn't count. Reissue it now under the new rule`, gst);
  else if (ctx.settings.eInvoice && !d.reportedOn) { const by = reportBy(d.cnOn); set('C4', today > by ? 'fail' : 'wait', today > by ? `${d.cnNo} was never reported to the e-invoice system and the 30-day window closed on ${by}. The portal will reject it, so the tax cut never reaches the buyer` : `${d.cnNo} must be reported to the e-invoice system by ${by}: 30 days from ${d.cnOn}, ${daysBetween(today, by)} left`, today > by ? gst : 0); }
  else set('C4', 'pass', `GST credit note ${d.cnNo} on ${d.cnOn}, valid under the ${psd.v === 2 ? 'new (1 Nov 2026)' : 'old'} rule${d.reportedOn ? `, reported to the e-invoice system on ${d.reportedOn}` : ''}`);
  // C5 — the buyer's clock, and what to do when they refuse
  if (d.route !== 'gst' || out.C4.status === 'fail' || !d.cnNo) set('C5', d.route === 'gst' ? 'wait' : 'pass', d.route === 'gst' ? 'Waiting for a valid credit note first' : 'Nothing for the buyer to approve');
  else if (d.ims === 'accepted') set('C5', 'pass', `${d.buyer} accepted it on the GST portal on ${d.imsOn}: the ${inr(gst)} tax saving is safe`);
  else if (d.ims === 'rejected') set('C5', 'fail', `${d.buyer} rejected it on the GST portal: "${d.imsRemark}". The ${inr(gst)} tax saving is lost unless you fix and reissue, or settle with a financial credit note`, gst);
  else {
    const by = imsActionBy(d.cnOn), till = imsPendingExpires(d.cnOn);
    if (today > till) set('C5', 'pass', `Nobody replied by ${till}, so it counts as accepted. But the buyer never confirmed it: legally fine, no acknowledgement in the pack`);
    else if (today > by) set('C5', 'wait', `Kept pending past ${by}, so the buyer can still act until ${till}. Nothing is safe yet`);
    else set('C5', 'wait', `Waiting for the buyer on the GST portal until ${by} (their GSTR-3B date), and until ${till} if they mark it pending`);
  }
  // C6
  if (d.received == null) set('C6', 'wait', `Waiting for ${inr(netDue(d))} (before GST)`);
  else if (d.received >= netDue(d)) set('C6', 'pass', `${inr(d.received)} received, exactly what was agreed`);
  else set('C6', 'fail', `${inr(netDue(d) - d.received)} less than agreed`, netDue(d) - d.received);
  // C7
  const chain = verify(d), needed = ['requested', 'economics', ...(apv ? ['approved'] : []), ...(d.route ? ['route'] : []), ...(d.cnNo ? ['credit note'] : []), ...(d.received != null ? ['payment'] : [])];
  const missing = needed.filter(x => !has(d, x));
  if (!chain.ok) set('C7', 'fail', `Step #${chain.at} (${chain.what}) was changed after it was recorded`, e.discount);
  else if (missing.length) set('C7', 'fail', `Missing: ${missing.join(', ')}`);
  else if (d.route === 'gst' && d.cnNo && d.ims !== 'accepted' && today > imsPendingExpires(d.cnOn)) set('C7', 'wait', `${chain.count} steps recorded, none changed. But the buyer's acceptance is missing: this one was only accepted by silence, so the pack has no proof the buyer agreed`);
  else set('C7', 'pass', `${chain.count} recorded steps, none changed`);

  const controls = CONTROLS.map(([id, name, what]) => ({ ...out[id], name, what, owner: OWNERS[id] }));
  const tickets = controls.filter(c => c.status === 'fail').map(c => {
    const opened = ctx.opened?.[`${d.id}-${c.id}`] ?? today, due = addWorkingDays(opened, c.owner.tat);
    return { key: `${d.id}-${c.id}`, discount: d.id, buyer: d.buyer, control: c.id, name: c.name, text: c.text, owner: c.owner, rupees: c.rupees, opened, due, breached: today > due };
  });
  const gstAtRisk = d.route === 'gst' || (!d.route && !service) ? (['fail', 'wait'].includes(out.C4.status) || out.C5.status !== 'pass' ? gst : 0) : 0;
  return { controls, tickets, economics: e, gst, gstAtRisk, deadline: dl, daysLeft, chain, allPass: controls.every(c => c.status === 'pass') };
}

/* What to do when the buyer rejects: three routes, three different rupee outcomes. Plain words on purpose. */
export const recoveryRoutes = d => [
  ['Same month, before you file GSTR-3B', `Send the identical note again in GSTR-1A, the one-time correction form. Then the buyer has to accept it again on the portal. Tax saving: ${inr(gstOf(d))} back, if they agree.`],
  ['After you have filed', `Send the identical note again in the amendment table of a later GSTR-1 (Table 9C). The buyer accepts again and recomputes their GSTR-2B. Slower, same ${inr(gstOf(d))}, and it still needs their yes.`],
  ['Or close it', `Settle as a financial credit note: the money still goes back, the tax stays as billed, and nothing waits on the buyer. You give up the ${inr(gstOf(d))} tax cut and stop chasing.`],
];

/* One payout advice, split into what it actually contains. Every number is the record's own. */
export function payoutSplit(d) {
  const disc = discountOf(d), ads = adOpen(d.buyer), adAmt = ads.reduce((s, x) => s + x.amount, 0), adGst = ads.reduce((s, x) => s + x.gst, 0);
  return { gross: d.value, discount: disc, adAmount: adAmt, adGst, net: d.value - disc - adAmt - adGst, deducted: disc + adAmt + adGst, ads };
}

/* ---------- desk-level views ---------- */
export function desk(list, ctx) {
  const rows = list.map(d => ({ d, r: evaluate(d, ctx) }));
  const approved = rows.filter(x => x.d.approvedBy);
  const spent = approved.reduce((s, x) => s + x.r.economics.discount, 0);
  const earned = approved.reduce((s, x) => s + x.r.economics.extraMargin, 0);
  const net = approved.reduce((s, x) => s + x.r.economics.net, 0);
  const gstAtRisk = rows.reduce((s, x) => s + x.r.gstAtRisk, 0);
  const short = rows.reduce((s, x) => s + (x.r.controls[5].status === 'fail' ? x.r.controls[5].rupees : 0), 0);
  const tickets = rows.flatMap(x => x.r.tickets);
  const nearest = rows.filter(x => x.r.gstAtRisk && x.r.daysLeft >= 0).sort((a, b) => a.r.daysLeft - b.r.daysLeft)[0];
  return { rows, spent, earned, net, gstAtRisk, short, tickets, breached: tickets.filter(x => x.breached).length, passAll: rows.filter(x => x.r.allPass).length, count: rows.length, nearest: nearest ? { date: nearest.r.deadline.date, days: nearest.r.daysLeft } : null };
}
/* Last-chance sweep: discounts on invoices of one financial year whose GST cut is not yet safe, before that year's deadline. */
export function sweep(list, ctx, fy) {
  const items = list.filter(d => fyOf(d.invoiceDate) === fy).map(d => ({ d, r: evaluate(d, ctx) })).filter(x => x.r.gstAtRisk > 0).sort((a, b) => b.r.gstAtRisk - a.r.gstAtRisk);
  const dl = deadline({ invoiceDate: `${fy.slice(0, 4)}-04-01` }, ctx.settings);
  return { fy, items, total: items.reduce((s, x) => s + x.r.gstAtRisk, 0), deadline: dl.date, daysLeft: daysBetween(ctx.today, dl.date) };
}
export function mis(list, ctx) {
  const k = desk(list, ctx);
  const per = CONTROLS.map(([id, name]) => { const s = k.rows.map(x => x.r.controls.find(c => c.id === id).status); const decided = s.filter(x => x !== 'wait'); return { id, name, pass: s.filter(x => x === 'pass').length, fail: s.filter(x => x === 'fail').length, wait: s.filter(x => x === 'wait').length, ratePct: decided.length ? Math.round(s.filter(x => x === 'pass').length / decided.length * 100) : null }; });
  const evidence = k.rows.filter(x => x.r.controls[6].status === 'pass').length;
  return { per, kpis: [
    ['Discounts approved', k.rows.filter(x => x.d.approvedBy).length], ['Spent on discounts', inr(k.spent)], ['Extra margin from extra volume', inr(k.earned)], ['Net after discounts', inr(k.net)],
    ['GST relief at risk', inr(k.gstAtRisk)], ['Cash short of approved net', inr(k.short)], ['Passing all 7 controls', `${k.passAll} of ${k.count}`], ['Open exceptions', k.tickets.length], ['Turnaround breaches', k.breached], ['Evidence packs complete', `${evidence} of ${k.count}`],
  ] };
}
export function misCsv(list, ctx) {
  const m = mis(list, ctx), q = v => `"${String(v).replace(/"/g, '""')}"`;
  return ['KPI,Value', ...m.kpis.map(([a, b]) => `${q(a)},${q(b)}`), '', 'Control,Pass,Fail,Waiting,Pass rate %', ...m.per.map(p => [p.id + ' ' + p.name, p.pass, p.fail, p.wait, p.ratePct ?? ''].map(q).join(','))].join('\n');
}
/* Risk and control matrix, in the shape internal audit uses. */
export const RACM = [
  ['C1', 'Discounts given that never pay back', 'Break-even uplift computed and sealed before the approver can decide', 'Preventive · automated', 'Every discount', 'Finance controller', 'Economics entry earlier in the chain than the approval', 'Re-perform: break-even = d ÷ (m − d); confirm the entry precedes the approval'],
  ['C2', 'Unauthorised or self-approved discounts', 'Approver limit and maker-checker enforced by the system', 'Preventive · automated', 'Every discount', 'Finance controller', 'Approval entry with approver, limit and percentage', 'Attempt self-approval and above-limit approval; both must be refused'],
  ['C3', 'A service payment, a damaged-goods return, or a netted payout treated as a discount', 'Promotion-linked discounts held for tax review with a written reason; damage claims routed out of the discount flow; a buyer who is also your ad seller must split the payout into two records first', 'Preventive · manual', 'Each promotion-linked discount and each payout with an open ad invoice', 'Tax desk', 'Tax review entry, split entry with the two amounts named, or a goods-return reference', 'Sample promotion-linked and netted discounts; each has a review or a split before any credit note'],
  ['C4', 'GST cut claimed on an invalid or late credit note', 'Route chosen with a reason; credit note checked against the rule version in force, the s.34(2) deadline, and the 30-day e-invoice reporting window', 'Preventive · automated', 'Every credit note', 'Tax desk', 'Route and credit note entries with rule version and reported date', 'Re-perform the deadline, rule version and 30-day window from the invoice and note dates'],
  ['C5', 'GST cut lost when the buyer rejects it on the GST portal', 'The buyer\'s portal reply is recorded against their own GSTR-3B date; a rejection opens an exception with the tax restored and the three recovery routes named', 'Detective · manual', 'Each tax period', 'Receivables', 'Portal reply entry with action, date and remark, or the reissued note reference', 'Agree recorded replies to the GST portal screen for a sample'],
  ['C6', 'Short payment against the approved net', 'Payment matched to the approved net; gap opens an exception', 'Detective · automated', 'Each payment', 'Receivables', 'Payment entry with bank reference', 'Agree sample payments to the bank statement'],
  ['C7', 'Records altered after approval', 'Each discount\'s entries are hash-chained; any edit breaks the chain', 'Detective · automated', 'Continuous', 'Finance controller', 'Fingerprint check result', 'Change one stored entry in a test copy; the check must fail at that entry'],
];
export const racmCsv = () => [['Control', 'Risk', 'Control activity', 'Type', 'Frequency', 'Owner', 'Evidence', 'Test of control'], ...RACM].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');

/* Audit pack: what an auditor sees for one discount. */
export function auditPack(d, ctx) {
  const r = evaluate(d, ctx);
  return { id: d.id, buyer: d.buyer, invoice: `${d.invoiceNo} · ${d.invoiceDate}`, discount: r.economics.discount, gst: r.gst, controls: r.controls.map(c => `${c.id} ${c.name}: ${c.status.toUpperCase()} · ${c.text}`), entries: d.events.map(e => ({ n: e.n, on: e.on, who: e.who, what: e.what, data: e.data, fingerprint: e.hash.slice(0, 12) })), rules: [...new Set(d.events.filter(e => e.data?.rule).map(e => e.data.rule))], chain: r.chain.ok ? 'intact' : `broken at #${r.chain.at}` };
}
/* Seeded pick so a re-run shows the same sample for the same seed. */
export function auditSample(list, n, seed) {
  const a = [...list]; let s = seed >>> 0 || 1; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/* ---------- integration previews (sample payloads, not sent) ---------- */
export function serviceNowIncident(tk) {
  return { _note: 'Sample payload, not sent', method: 'POST', path: '/api/now/table/incident', body: { short_description: `${tk.control} ${tk.name} failed · ${tk.discount} · ${tk.buyer}`, description: tk.text, assignment_group: tk.owner.role, assigned_to: tk.owner.who, urgency: tk.rupees >= 10000 ? '1' : '2', impact: '2', category: 'Finance control', correlation_id: tk.key, u_rupees_at_risk: tk.rupees, u_due_by: tk.due } };
}
export function jiraIssue(tk) {
  return { _note: 'Sample payload, not sent', method: 'POST', path: '/rest/api/3/issue', body: { fields: { project: { key: 'FINCTRL' }, issuetype: { name: 'Task' }, summary: `${tk.control} ${tk.name} failed · ${tk.discount} · ${tk.buyer}`, description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: `${tk.text} Rupees at risk: ${tk.rupees}. Owner: ${tk.owner.who} (${tk.owner.role}).` }] }] }, labels: ['ten-today', tk.control], duedate: tk.due, priority: { name: tk.rupees >= 10000 ? 'High' : 'Medium' } } } };
}

/* ---------- sample desk: each record is built by the same actions the app uses ---------- */
export const SETTINGS = { gstr9Filed: { '2025-26': null }, eInvoice: true };
export const HISTORY = { 'Krishna Marketing': ['accepted', 'accepted', 'accepted', 'accepted'], 'Meera Trading': ['accepted', 'rejected', 'accepted', 'rejected', 'accepted'], 'Aarav Distributors': ['accepted', 'accepted'], 'Royal Foods': ['accepted', 'accepted', 'rejected'], 'Green Leaf': ['accepted'], 'Sunrise Medicals': [], 'Delta Pharma': ['accepted', 'accepted'], 'Patel Agencies': ['rejected', 'accepted'] };
const base = (id, buyer, invoiceNo, invoiceDate, value, baseline, pct, rate = 18, purpose = 'price') => ({ id, buyer, invoiceNo, invoiceDate, value, baseline, pct, margin: 51.15, rate, purpose });
export function sampleDesk() {
  const L = [];
  let d = request(base('D-101', 'Krishna Marketing', 'INV-2602-114', '2026-02-14', 1600000, 1350000, 6), '2026-10-30', 'Neha');
  d = approve(d, '2026-10-31', 'Vikram', 8); d = chooseRoute(d, '2026-11-02', 'Farah', 'gst', 'Buyer is registered and files monthly; IMS action expected'); d = issueNote(d, '2026-11-03', 'Farah', 'CN-26-031'); d = reportNote(d, '2026-11-04', 'Farah', 'IRN-31'); d = recordIms(d, '2026-11-06', 'Asha', 'accepted'); d = recordPayment(d, '2026-11-07', 'Asha', 1504000, 'UTR HDFCN26311077'); L.push(d);
  d = request(base('D-102', 'Meera Trading', 'INV-2603-208', '2026-03-20', 800000, 800000, 8), '2026-10-30', 'Neha');
  d = approve(d, '2026-10-31', 'Vikram', 8); d = chooseRoute(d, '2026-11-02', 'Farah', 'gst', 'Scheme rebate on a registered buyer'); d = issueNote(d, '2026-11-04', 'Farah', 'CN-26-032'); d = reportNote(d, '2026-11-05', 'Farah', 'IRN-32'); d = recordIms(d, '2026-11-09', 'Asha', 'rejected', 'Slab not met: 180 cases billed, slab starts at 200'); d = recordPayment(d, '2026-11-10', 'Asha', 736000, 'UTR ICICN26314402'); L.push(d);
  d = request(base('D-103', 'Aarav Distributors', 'INV-2601-041', '2026-01-10', 500000, 440000, 5), '2026-10-24', 'Neha');
  d = approve(d, '2026-10-26', 'Vikram', 8); d = chooseRoute(d, '2026-10-27', 'Farah', 'gst', 'Year-end rebate'); d = issueNote(d, '2026-10-28', 'Farah', 'CN-26-027'); d = reportNote(d, '2026-10-29', 'Farah', 'IRN-27'); d = recordPayment(d, '2026-11-02', 'Asha', 475000, 'UTR SBINN26306118'); L.push(d);
  d = request(base('D-104', 'Sunrise Medicals', 'INV-2603-077', '2026-03-05', 600000, 520000, 4, 5, 'promo'), '2026-11-05', 'Neha');
  d = approve(d, '2026-11-06', 'Vikram', 8); L.push(d);
  d = request(base('D-105', 'Green Leaf', 'INV-2512-310', '2025-12-12', 400000, 390000, 5), '2026-11-02', 'Neha');
  d = approve(d, '2026-11-03', 'Vikram', 8); d = chooseRoute(d, '2026-11-04', 'Farah', 'gst', 'Registered buyer, monthly filer'); L.push(d);
  d = request(base('D-106', 'Royal Foods', 'INV-2602-275', '2026-02-25', 900000, 760000, 7), '2026-11-02', 'Neha');
  d = approve(d, '2026-11-03', 'Vikram', 8); d = chooseRoute(d, '2026-11-04', 'Farah', 'gst', 'Registered buyer'); d = issueNote(d, '2026-11-05', 'Farah', 'CN-26-035'); d = reportNote(d, '2026-11-06', 'Farah', 'IRN-35'); d = recordPayment(d, '2026-11-11', 'Asha', 774000, 'UTR AXISN26315530'); L.push(d);
  d = request(base('D-107', 'Delta Pharma', 'INV-2610-019', '2026-10-06', 300000, 280000, 3), '2026-11-04', 'Neha');
  d = approve(d, '2026-11-04', 'Vikram', 8); d = chooseRoute(d, '2026-11-05', 'Farah', 'fin', 'Small amount; buyer asked not to reverse ITC'); d = issueNote(d, '2026-11-05', 'Farah', 'FCN-26-008'); d = recordPayment(d, '2026-11-09', 'Asha', 291000, 'UTR KKBKN26313021'); L.push(d);
  d = request(base('D-108', 'Patel Agencies', 'INV-2603-291', '2026-03-28', 500000, 490000, 12), '2026-11-06', 'Neha');
  d = cp(d); d.approvedBy = 'Vikram'; d.limitPct = 8; d.approvedOn = '2026-11-07'; d = log(d, '2026-11-07', 'Vikram', 'approved', { pct: 12, limitPct: 8, note: 'Approved by email, entered after the fact' }); L.push(d);
  // The same buyer sells us ads, so one payout carries both. Nobody has split it yet.
  d = request(base('D-109', 'Navkar Traders', 'INV-2603-301', '2026-03-12', 1000000, 860000, 6), '2026-11-11', 'Neha');
  d = approve(d, '2026-11-11', 'Vikram', 8); L.push(d);
  // Goods came back damaged: that is a return, not a discount.
  d = request(base('D-110', 'Shree Ganesh Agencies', 'INV-2603-322', '2026-03-24', 430000, 410000, 4, 18, 'damage'), '2026-11-10', 'Neha');
  d = approve(d, '2026-11-10', 'Vikram', 8); L.push(d);
  return L;
}
export const OPENED = { 'D-102-C5': '2026-11-09', 'D-103-C4': '2026-11-02', 'D-104-C3': '2026-11-06', 'D-106-C6': '2026-11-11', 'D-108-C2': '2026-11-07', 'D-109-C3': '2026-11-11', 'D-110-C3': '2026-11-10' };

/* ---------- 90-second walkthrough: one discount, end to end, through the real actions ---------- */
export function walkthrough(today) {
  const b = base('D-201', 'Navkar Traders', 'INV-2603-301', '2026-03-12', 1000000, 860000, 6);
  const S = [];
  let d = request(b, today, 'Neha'); S.push({ d, t: 'Request', s: `Neha asks to give Navkar 6% (${inr(discountOf(d))}) back on a ₹10 lakh March bill. Before anyone can say yes, Ten Today works out how much extra Navkar must buy to make it worth it: ${breakEven(6, 51.15)}% more than usual.` });
  try { approve(d, today, 'Neha', 8); } catch (e) { S.push({ d, t: 'Self-approval refused', s: e.message }); }
  d = approve(d, today, 'Vikram', 8); S.push({ d, t: 'Approved', s: 'Vikram from finance approves. He can approve up to 8%, and the "is it worth it" check was done first, so checks 1 and 2 pass.' });
  d = splitRecord(d, today, 'Asha', `Split the payout: ${inr(discountOf(d))} discount on INV-2603-301, and the ad invoice ${inr(40000)} + ${inr(7200)} GST billed separately`); S.push({ d, t: 'Split the payout', s: `Navkar also sells us ads: an open ad invoice of ${inr(40000)} plus ${inr(7200)} GST. The buyer will send one payment with the discount and the ad bill inside it. Asha splits it into two records first, so nobody has to guess later which rupee was which.` });
  d = chooseRoute(d, today, 'Farah', 'gst', 'Registered buyer, monthly filer'); d = issueNote(d, today, 'Farah', 'CN-26-041'); d = reportNote(d, today, 'Farah', 'IRN-41'); S.push({ d, t: 'GST credit note', s: `Farah from the tax team sends a tax credit note, a "minus bill" that lowers the GST on the sale, and reports it to the e-invoice system the same day. Under the rules since 1 Nov 2026 this is allowed, and for a March bill it must be done by 30 Nov 2026.` });
  d = recordIms(d, today, 'Asha', 'rejected', 'Wrong invoice reference'); S.push({ d, t: 'Buyer rejects it', s: `Navkar rejects it on the government GST portal, so the ${inr(gstOf(d))} tax saving is lost for now. Check 5 fails and a task opens for Asha with a 2-day deadline, like a ServiceNow or JIRA ticket.` });
  d = issueNote(d, today, 'Farah', 'CN-26-042'); d = reportNote(d, today, 'Farah', 'IRN-42'); d = recordIms(d, today, 'Asha', 'accepted'); S.push({ d, t: 'Fixed and accepted', s: 'Farah sends a corrected note, reports it, and Navkar accepts it. The tax saving is safe and the task closes.' });
  d = recordPayment(d, today, 'Asha', 940000, 'UTR HDFCN26317001'); S.push({ d, t: 'Cash matched', s: `Navkar pays ₹9,40,000, exactly what was agreed. Check 6 passes.` });
  S.push({ d, t: 'Audit pack', s: `All 7 checks pass. The audit pack holds ${d.events.length} recorded steps, including the split, so an auditor can see the discount and the ad invoice as two separate things. If anyone changed a step later, check 7 would show which.`, pack: true });
  return S;
}

/* ---------- weekly audit sign-off (the HDFC audit-app pattern): sealed, explained, countersigned ---------- */
export const weekOf = d => { const t0 = t(d), wd = (new Date(t0).getUTCDay() + 6) % 7; return iso(t0 - wd * D); };
export function signOff(list, ctx, who, notes = {}, prev = null) {
  const k = desk(list, ctx), open = k.tickets.map(x => x.key);
  const missing = open.filter(key => !notes[key]?.trim());
  if (missing.length) throw new Error(`Explain each open item before signing: ${missing.join(', ')}.`);
  const m = mis(list, ctx);
  const rec = { week: weekOf(ctx.today), on: ctx.today, who, kpis: m.kpis, open, notes: Object.fromEntries(open.map(key => [key, notes[key].trim()])),
    heads: Object.fromEntries(list.map(d => [d.id, [d.events.length, d.events.at(-1)?.hash ?? '']])), prev: prev?.hash ?? 'GENESIS', countersign: null };
  rec.hash = sha256(JSON.stringify({ ...rec, countersign: undefined, hash: undefined }));
  return rec;
}
export function countersign(rec, who, on) {
  if (who === rec.who) throw new Error('The person who signed can\'t countersign. A second person must.');
  return { ...rec, countersign: { who, on, hash: sha256(rec.hash + who + on) } };
}
/* Intact if the sealed record is unchanged and every discount still holds the exact entries it had at sign-off. */
export function verifySignoff(rec, list) {
  if (sha256(JSON.stringify({ ...rec, countersign: undefined, hash: undefined })) !== rec.hash) return { ok: false, why: 'The sign-off record itself was edited' };
  for (const [id, [n, h]] of Object.entries(rec.heads)) {
    const d = list.find(x => x.id === id); if (!d) return { ok: false, why: `${id} was removed after sign-off` };
    if (n && (d.events[n - 1]?.hash !== h || !verify(d).ok)) return { ok: false, why: `${id} was changed after sign-off` };
  }
  return { ok: true };
}

/* ---------- two-input request: the rep types an invoice number and a %, the desk fills in the rest ---------- */
// Invoice register (sample): what the ERP already knows. Past invoices give each buyer's usual order.
export const INVOICES = [
  ['INV-2510-118', 'Navkar Traders', '2025-10-14', 840000], ['INV-2512-044', 'Navkar Traders', '2025-12-09', 870000], ['INV-2601-210', 'Navkar Traders', '2026-01-22', 870000],
  ['INV-2603-301', 'Navkar Traders', '2026-03-12', 1000000],
  ['INV-2511-090', 'Shree Ganesh Agencies', '2025-11-03', 420000], ['INV-2601-131', 'Shree Ganesh Agencies', '2026-01-17', 400000], ['INV-2602-188', 'Shree Ganesh Agencies', '2026-02-20', 410000],
  ['INV-2603-322', 'Shree Ganesh Agencies', '2026-03-24', 430000],
  ['INV-2603-340', 'Laxmi Wholesale', '2026-03-29', 650000],
].map(([no, buyer, date, value]) => ({ no, buyer, date, value }));
export function draftRequest(invoiceNo, pct, ctx, register = INVOICES, purpose = 'price', basis = 'all') {
  const inv = register.find(x => x.no.toLowerCase() === String(invoiceNo).trim().toLowerCase());
  if (!inv) throw new Error(`No invoice ${invoiceNo} in the register. Check the number on the bill.`);
  if (!(pct > 0 && pct <= 25)) throw new Error('Enter a discount between 0.5% and 25%.');
  if (!['price', 'promo', 'damage', 'early'].includes(purpose)) throw new Error('Say what the money is for: a price cut, a promotion payment, a damage claim, or early payment.');
  const past = register.filter(x => x.buyer === inv.buyer && x.date < inv.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  const baseline = past.length ? Math.round(past.reduce((s, x) => s + x.value, 0) / past.length) : null;
  const d = { id: null, buyer: inv.buyer, invoiceNo: inv.no, invoiceDate: inv.date, value: inv.value, baseline: baseline ?? inv.value, pct, margin: 51.15, rate: 18, purpose, basis: purpose === 'price' ? basis : 'all' };
  const e = economics(d), dl = deadline(d, ctx.settings), br = buyerRecord(ctx, inv.buyer), ads = adOpen(inv.buyer);
  return { fields: d, invoice: inv, pastCount: past.length, hasBaseline: baseline !== null, economics: e, deadline: dl, daysLeft: daysBetween(ctx.today, dl.date), buyer: br,
    ads, adTotal: ads.reduce((s, x) => s + x.amount + x.gst, 0), purpose,
    gst: gstOf(d), late: ctx.today > dl.date };
}
