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
  assert.equal(st(C.issueNote(d, '2026-11-13', 'Farah', 'CN-26-040'), 'C4'), 'pass');
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
  assert.equal(st(byId('D-106'), 'C5', ctx('2026-12-01')), 'pass');
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
