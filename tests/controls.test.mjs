import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../site/controls.js';

const ctx = (today = '2026-11-13', settings = C.SETTINGS) => ({ today, settings, history: C.HISTORY, opened: C.OPENED });
const L = C.sampleDesk();
const byId = id => L.find(d => d.id === id);
const st = (d, id, c = ctx()) => C.evaluate(d, c).controls.find(x => x.id === id).status;

test('rules are effective-dated: 31 Oct is PSD v1, 1 Nov is PSD v2', () => {
  assert.equal(C.ruleAt('PSD', '2026-10-31').v, 1);
  assert.equal(C.ruleAt('PSD', '2026-11-01').v, 2);
});

test('s.34(2) deadline follows the invoice year, capped by the GSTR-9 filing date', () => {
  assert.equal(C.deadline({ invoiceDate: '2026-02-14' }, C.SETTINGS).date, '2026-11-30');
  assert.equal(C.deadline({ invoiceDate: '2026-10-06' }, C.SETTINGS).date, '2027-11-30');
  assert.equal(C.deadline({ invoiceDate: '2026-02-14' }, { gstr9Filed: { '2025-26': '2026-11-20' } }).date, '2026-11-20');
  assert.equal(C.deadline({ invoiceDate: '2026-02-14' }, { gstr9Filed: { '2025-26': '2026-12-20' } }).date, '2026-11-30');
});

test('break-even = d / (m − d): 6% at 51.15% needs +13.3%', () => assert.equal(C.breakEven(6, 51.15), 13.3));

test('economics are computed, not typed: net = value·(m−d) − baseline·m', () => {
  const e = C.economics(byId('D-101'));
  assert.equal(e.discount, 96000);
  assert.equal(e.net, Math.round(1600000 * (0.5115 - 0.06) - 1350000 * 0.5115));
  assert.equal(e.paidBack, true);
  assert.equal(C.economics(byId('D-102')).paidBack, false);
});

test('C1 needs the break-even sealed before the approval', () => assert.equal(st(byId('D-101'), 'C1'), 'pass'));

test('C2 refuses self-approval and above-limit approval; a back-door entry still fails', () => {
  const d = C.request({ id: 'X', buyer: 'B', invoiceNo: 'I', invoiceDate: '2026-02-01', value: 100000, baseline: 100000, pct: 9, margin: 51.15, rate: 18, purpose: 'price' }, '2026-11-10', 'Neha');
  assert.throws(() => C.approve(d, '2026-11-10', 'Neha', 10), /requester/);
  assert.throws(() => C.approve(d, '2026-11-10', 'Vikram', 8), /above/);
  assert.equal(st(byId('D-108'), 'C2'), 'fail');
});

test('C3 holds a promotion-linked discount for tax review; a service cannot go through a credit note', () => {
  let d = byId('D-104');
  assert.equal(st(d, 'C3'), 'fail');
  assert.throws(() => C.taxReview(d, '2026-11-12', 'Farah', 'service', ''), /why/);
  d = C.taxReview(d, '2026-11-12', 'Farah', 'service', 'Shelf display for 4 weeks under a written agreement');
  assert.equal(st(d, 'C3'), 'pass');
  assert.equal(st(d, 'C4'), 'fail');
  assert.equal(st(C.chooseRoute(d, '2026-11-12', 'Farah', 'service', 'Buyer bills the display'), 'C4'), 'pass');
});

test('C4: a note issued 28 Oct without prior agreement is invalid under PSD v1; reissued after 1 Nov it is valid', () => {
  const d = byId('D-103');
  assert.equal(st(d, 'C4'), 'fail');
  const again = C.reportNote(C.issueNote(d, '2026-11-13', 'Farah', 'CN-26-040'), '2026-11-13', 'Farah', 'IRN-40');
  assert.equal(st(again, 'C4'), 'pass');
  assert.equal(st({ ...d, priorAgreement: true }, 'C4'), 'pass');
});

test('C4: past the deadline with no credit note, the GST cut is gone and is counted at risk', () => {
  const d = byId('D-105');
  assert.equal(st(d, 'C4'), 'wait');
  const r = C.evaluate(d, ctx('2026-12-01'));
  assert.equal(r.controls[3].status, 'fail');
  assert.equal(r.gstAtRisk, C.gstOf(d));
});

test('C5: rejection fails with the tax restored; pending past one tax period is deemed accepted', () => {
  const rej = C.evaluate(byId('D-102'), ctx());
  assert.equal(rej.controls[4].status, 'fail');
  assert.equal(rej.controls[4].rupees, C.gstOf(byId('D-102')));
  assert.throws(() => C.recordIms(byId('D-106'), '2026-11-13', 'Asha', 'rejected'), /remark/);
  assert.equal(st(byId('D-106'), 'C5'), 'wait');
  assert.equal(st(byId('D-106'), 'C5', ctx('2026-12-21')), 'wait', 'buyer can still act, or park it one more period');
  assert.equal(st(byId('D-106'), 'C5', ctx('2027-01-21')), 'pass', 'both windows closed: accepted by silence');
});

test('C6 measures the gap against the approved net', () => {
  const r = C.evaluate(byId('D-106'), ctx());
  assert.equal(r.controls[5].status, 'fail');
  assert.equal(r.controls[5].rupees, 63000);
});

test('C7: changing one sealed entry breaks the chain at that entry', () => {
  const d = structuredClone(byId('D-101'));
  assert.equal(st(d, 'C7'), 'pass');
  d.events[2].data.pct = 4;
  const c7 = C.evaluate(d, ctx()).controls[6];
  assert.equal(c7.status, 'fail');
  assert.match(c7.text, /#3/);
});

test('a financial credit note puts no GST at risk and needs no IMS action', () => {
  const r = C.evaluate(byId('D-107'), ctx());
  assert.equal(r.gstAtRisk, 0);
  assert.equal(r.allPass, true);
});

test('exceptions carry owner, working-day due date and breach flag', () => {
  const tk = C.evaluate(byId('D-102'), ctx()).tickets.find(t => t.control === 'C5');
  assert.equal(tk.owner.role, 'Receivables');
  assert.equal(tk.due, '2026-11-11');
  assert.equal(tk.breached, true);
  assert.equal(C.serviceNowIncident(tk).body.correlation_id, 'D-102-C5');
  assert.equal(C.jiraIssue(tk).body.fields.duedate, '2026-11-11');
});

test('last-chance sweep lists FY 2025-26 discounts whose GST cut is not safe, largest first', () => {
  const s = C.sweep(L, ctx(), '2025-26');
  assert.equal(s.deadline, '2026-11-30');
  assert.equal(s.daysLeft, 17);
  assert.ok(!s.items.some(x => x.d.id === 'D-101'));
  assert.ok(s.items.every((x, i, a) => !i || a[i - 1].r.gstAtRisk >= x.r.gstAtRisk));
});

test('buyer record feeds recovery odds', () => assert.equal(C.buyerRecord(ctx(), 'Meera Trading').recoveryPct, 60));

test('MIS, RACM and audit sample are consistent', () => {
  const m = C.mis(L, ctx());
  assert.equal(m.per.length, 7);
  assert.equal(C.RACM.length, 7);
  assert.equal(C.racmCsv().split('\n').length, 8);
  assert.deepEqual(C.auditSample(L, 5, 42).map(d => d.id), C.auditSample(L, 5, 42).map(d => d.id));
  assert.equal(C.auditPack(byId('D-101'), ctx()).chain, 'intact');
});

test('walkthrough ends with all seven controls passing', () => {
  const s = C.walkthrough('2026-11-13');
  assert.equal(C.evaluate(s.at(-1).d, ctx()).allPass, true);
  assert.ok(s.some(x => /refused|requester/i.test(x.t + x.s)));
});

test('weekly sign-off: every open item needs a note, the signer cannot countersign, later edits show', () => {
  const list = C.sampleDesk(), c = ctx();
  assert.throws(() => C.signOff(list, c, 'Vikram', {}), /Explain each open item/);
  const notes = Object.fromEntries(C.desk(list, c).tickets.map(t => [t.key, 'Owner chasing, due this week']));
  const rec = C.signOff(list, c, 'Vikram', notes);
  assert.equal(rec.week, '2026-11-09');
  assert.ok(C.verifySignoff(rec, list).ok);
  assert.throws(() => C.countersign(rec, 'Vikram', '2026-11-13'), /second person/);
  assert.equal(C.countersign(rec, 'Arjun', '2026-11-13').countersign.who, 'Arjun');
  const moved = structuredClone(list); moved[0].events[1].data.net = 1;
  assert.match(C.verifySignoff(rec, moved).why, /D-101 was changed/);
  const later = structuredClone(list); later[1] = C.recordPayment(later[1], '2026-11-14', 'Asha', 1, 'x');
  assert.ok(C.verifySignoff(rec, later).ok, 'new entries after sign-off are fine');
});

test('two-input request fills buyer, usual order, break-even, buyer record and deadline from the invoice', () => {
  const r = C.draftRequest('inv-2603-301', 6, ctx());
  assert.equal(r.fields.buyer, 'Navkar Traders');
  assert.equal(r.fields.baseline, Math.round((840000 + 870000 + 870000) / 3));
  assert.equal(r.economics.breakEvenPct, 13.3);
  assert.equal(r.deadline.date, '2026-11-30');
  assert.throws(() => C.draftRequest('INV-9999', 6, ctx()), /No invoice/);
  assert.throws(() => C.draftRequest('INV-2603-301', 0, ctx()), /between/);
  const first = C.draftRequest('INV-2603-340', 5, ctx());
  assert.equal(first.hasBaseline, false, 'no history: says so instead of guessing');
});

test('the buyer clock is their GSTR-3B date, not month-end: the 20th of the next month, plus one pending period', () => {
  assert.equal(C.imsActionBy('2026-11-05'), '2026-12-20');
  assert.equal(C.imsPendingExpires('2026-11-05'), '2027-01-20');
  assert.equal(C.imsActionBy('2026-12-28'), '2027-01-20');
  assert.equal(C.imsPendingExpires('2026-12-28'), '2027-02-20');
});

test('C3 blocks a payout that also carries an open ad invoice until it is split into two records', () => {
  const d = byId('D-109');
  assert.deepEqual(C.adOpen('Navkar Traders').map(x => x.no), ['AD-2610-07']);
  assert.equal(C.adTotal('Navkar Traders'), 47200);
  const c3 = C.evaluate(d, ctx()).controls[2];
  assert.equal(c3.status, 'fail');
  assert.match(c3.text, /ad invoice/);
  assert.equal(c3.rupees, 47200);
  assert.throws(() => C.splitRecord(d, '2026-11-13', 'Asha', ''), /how the payout was split/);
  const split = C.splitRecord(d, '2026-11-13', 'Asha', '₹60,000 discount on the invoice; ₹47,200 ad bill paid separately');
  assert.equal(C.evaluate(split, ctx()).controls[2].status, 'pass');
});

test('a damage claim is routed out of the discount flow instead of being given a credit note', () => {
  const c3 = C.evaluate(byId('D-110'), ctx()).controls[2];
  assert.equal(c3.status, 'fail');
  assert.match(c3.text, /goods-return note/);
});

test('C4: an unreported credit note waits, then fails when the 30-day e-invoice window closes', () => {
  const note = C.issueNote(byId('D-101'), '2026-11-03', 'Farah', 'CN-99');
  assert.equal(C.reportBy('2026-11-03'), '2026-12-03');
  const waiting = C.evaluate(note, ctx('2026-11-20')).controls[3];
  assert.equal(waiting.status, 'wait');
  assert.match(waiting.text, /2026-12-03/);
  assert.equal(C.evaluate(note, ctx('2026-12-04')).controls[3].status, 'fail');
  const reported = C.reportNote(note, '2026-11-04', 'Farah', 'IRN-1');
  assert.equal(C.evaluate(reported, ctx('2026-11-20')).controls[3].status, 'pass');
});

test('accepted by silence is a pass on C5 but leaves the audit pack short of the buyer\'s word', () => {
  const late = C.evaluate(byId('D-106'), ctx('2027-01-25'));
  assert.equal(late.controls[4].status, 'pass');
  assert.match(late.controls[4].text, /never confirmed/);
  assert.equal(late.controls[6].status, 'wait');
  assert.match(late.controls[6].text, /accepted by silence/);
});

test('a rejection names three recovery routes with the rupee outcome of each', () => {
  const d = byId('D-102'), r = C.recoveryRoutes(d);
  assert.equal(r.length, 3);
  assert.match(r[0][1], /GSTR-1A/);
  assert.match(r[1][1], /Table 9C/);
  assert.match(r[2][1], /tax stays as billed/);
  assert.ok(r.every(x => x[1].includes(C.inr(C.gstOf(d)))));
});

test('the payout advice adds up: what was deducted, and which part is a discount', () => {
  const p = C.payoutSplit(byId('D-109'));
  assert.equal(p.gross, 1000000);
  assert.equal(p.discount, 60000);
  assert.equal(p.adAmount, 40000);
  assert.equal(p.adGst, 7200);
  assert.equal(p.deducted, 107200);
  assert.equal(p.net, 892800);
});

test('the request says what the money is for, and a damage claim is not priced as a discount', () => {
  assert.throws(() => C.draftRequest('INV-2603-301', 6, ctx(), C.INVOICES, 'bribe'), /what the money is for/);
  const dmg = C.draftRequest('INV-2603-322', 4, ctx(), C.INVOICES, 'damage');
  assert.equal(dmg.purpose, 'damage');
  assert.equal(C.evaluate(C.request({ ...dmg.fields, id: 'X' }, '2026-11-10', 'Neha'), ctx()).controls[2].status, 'fail');
  const netted = C.draftRequest('INV-2603-301', 6, ctx());
  assert.equal(netted.adTotal, 47200, 'the request already shows the open ad invoice');
});

test('basis "above": discount only on boxes above the usual order (₹12 vs ₹2 rule)', () => {
  const d = { value: 12, baseline: 10, pct: 100 / 12 * 1, margin: 51.15, rate: 18 };
  const all = { value: 1200000, baseline: 1000000, pct: 6, margin: 51.15, rate: 18, basis: 'all' };
  const above = { ...all, basis: 'above' };
  assert.equal(C.discountOf(all), 72000);
  assert.equal(C.discountOf(above), 12000);
  const e = C.economics(above);
  assert.equal(e.saved, 60000);
  assert.equal(e.breakEvenPct, 0);
  assert.ok(C.economics(above).net > C.economics(all).net);
  assert.equal(C.discountOf({ ...above, value: 900000 }), 0); // below baseline: nothing paid
  void d;
});

test('early payment is a fourth reason: no volume test, and basis stays on the whole order', () => {
  const r = C.draftRequest(C.INVOICES.at(-1).no, 2, ctx(), C.INVOICES, 'early', 'above');
  assert.equal(r.fields.basis, 'all');
  const c1 = C.evaluate(C.request({ ...r.fields, id: 'D-T' }, '2026-11-13', 'Neha'), ctx()).controls.find(x => x.id === 'C1');
  assert.match(c1.text ?? c1.note ?? JSON.stringify(c1), /early-payment/i);
  assert.throws(() => C.draftRequest(C.INVOICES.at(-1).no, 2, ctx(), C.INVOICES, 'gift'), /early payment/);
});
