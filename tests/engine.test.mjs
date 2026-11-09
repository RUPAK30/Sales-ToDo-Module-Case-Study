import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../site/engine.js';
const D = '2026-11-10';
const w0 = () => E.sample(D);
const t = (w, id) => w.tasks.find(x => x.id === id);

test('Today is capped at 10 and the rest are counted, not hidden', () => {
  const q = E.today(w0(), 'Rahul');
  assert.equal(q.list.length, 10); assert.ok(q.waiting > 0);
});
test('ranking: pinned callback first, then P1 before P2 before P3, money-blocking first within a tier', () => {
  const w = w0(); const { list } = E.today(w, 'Rahul');
  assert.equal(list[0].id, 'T-111');
  const tiers = list.slice(1).map(x => E.tier(w, x));
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b));
  const p1 = list.filter(x => E.tier(w, x) === 1); assert.equal(p1[0].stage, 'Negotiation');
});
test('value is only a tie-break: a big new deal never jumps an older task', () => {
  const w = w0(); const { list } = E.today(w, 'Rahul');
  assert.ok(list.findIndex(x => x.id === 'T-104') < list.findIndex(x => x.id === 'T-108'));
});
test('future tasks wait in the inbox, not in Today', () => {
  const w = w0(); assert.ok(!E.today(w, 'Rahul').list.some(x => x.id === 'T-113'));
  assert.ok(E.inbox(w, 'Rahul').later.some(x => x.id === 'T-113'));
});
test('done needs an outcome; a stage move creates the next task exactly once', () => {
  assert.throws(() => E.complete(w0(), 'T-103', 'Rahul', ' ', true), /what happened/);
  const { w, next } = E.complete(w0(), 'T-103', 'Rahul', 'Sent specs', true);
  assert.equal(t(w, 'T-103').status, 'done'); assert.equal(next.stage, 'Quote sent'); assert.equal(next.from, 'T-103');
  assert.throws(() => E.complete(w, 'T-103', 'Rahul', 'again', true), /Only open/);
});
test('only the owner acts on a task', () => {
  assert.throws(() => E.complete(w0(), 'T-103', 'Neha', 'x', false), /Rahul's task/);
});
test('reschedule keeps the original target; the second move needs a blocker', () => {
  let w = E.reschedule(w0(), 'T-104', 'Rahul', E.addDays(D, 2));
  assert.equal(t(w, 'T-104').due, E.addDays(D, -7));
  assert.throws(() => E.reschedule(w, 'T-104', 'Rahul', E.addDays(D, 3)), /blocking/);
  assert.throws(() => E.reschedule(w0(), 'T-104', 'Rahul', D), /after today/);
  w = E.reschedule(w, 'T-104', 'Rahul', E.addDays(D, 3), 'Owner travelling');
  assert.equal(t(w, 'T-104').reschedules.length, 2);
});
test('on hold needs a reason and a revisit date, and comes back on that date', () => {
  assert.throws(() => E.putOnHold(w0(), 'T-106', 'Rahul', '', E.addDays(D, 3)), /why/);
  assert.throws(() => E.putOnHold(w0(), 'T-106', 'Rahul', 'Budget freeze', D), /revisit/);
  let w = E.putOnHold(w0(), 'T-106', 'Rahul', 'Budget freeze', E.addDays(D, 3));
  assert.equal(t(w, 'T-106').status, 'hold');
  w = E.wakeHolds({ ...w, today: E.addDays(D, 3) }); assert.equal(t(w, 'T-106').status, 'open');
});
test('a discount ask freezes the task and routes to the right approver', () => {
  const w = E.askDiscount(w0(), 'T-101', 'Rahul', 8, 'Competitor price');
  assert.equal(t(w, 'T-101').status, 'frozen');
  assert.equal(w.approvals.at(-1).approver, 'Kavita');
  assert.ok(!E.today(w, 'Rahul').list.some(x => x.id === 'T-101'));
  const big = E.askDiscount(w0(), 'T-101', 'Rahul', 13, 'Volume');
  assert.equal(big.approvals.at(-1).approver, 'Arjun');
  const overdue = E.askDiscount(w0(), 'T-108', 'Rahul', 5, 'Volume');
  assert.match(overdue.approvals.at(-1).routedBecause.join(), /overdue/);
  assert.throws(() => E.askDiscount(w0(), 'T-103', 'Rahul', 5, 'x'), /Quote sent or Negotiation/);
  assert.throws(() => E.askDiscount(w, 'T-101', 'Rahul', 5, 'x'), /Only open/);
});
test('approve needs a cap within limits and an expiry; the task returns with the next step', () => {
  let w = E.askDiscount(w0(), 'T-101', 'Rahul', 8, 'Competitor price'); const id = w.approvals.at(-1).id;
  assert.throws(() => E.approve(w, id, 'Rahul', 8, E.addDays(D, 10)), /can't decide/);
  assert.throws(() => E.approve(w, id, 'Neha', 8, E.addDays(D, 10)), /Only a sales manager/);
  assert.throws(() => E.approve(w, id, 'Kavita', 9, E.addDays(D, 10)), /more than was asked/);
  assert.throws(() => E.approve(w, id, 'Kavita', 8, D), /expiry/);
  w = E.approve(w, id, 'Kavita', 8, E.addDays(D, 10));
  assert.equal(t(w, 'T-101').status, 'open'); assert.match(t(w, 'T-101').title, /revised quote at 8%/);
  assert.ok(E.today(w, 'Rahul').list.some(x => x.id === 'T-101'));
});
test('the manager cannot decide what is routed to the sales head', () => {
  const w = E.askDiscount(w0(), 'T-101', 'Rahul', 13, 'Volume'); const id = w.approvals.at(-1).id;
  assert.throws(() => E.approve(w, id, 'Kavita', 10, E.addDays(D, 5)), /sales head/);
  assert.equal(E.approve(w, id, 'Arjun', 12, E.addDays(D, 5)).approvals.at(-1).status, 'approved');
});
test('counter-offer: rep accepts or declines; either way the task is live again', () => {
  let w = E.askDiscount(w0(), 'T-101', 'Rahul', 8, 'x'); const id = w.approvals.at(-1).id;
  assert.throws(() => E.counter(w, id, 'Kavita', 8, E.addDays(D, 5), 'y'), /below the ask/);
  w = E.counter(w, id, 'Kavita', 5, E.addDays(D, 5), 'Margin');
  assert.equal(t(w, 'T-101').status, 'frozen');
  assert.throws(() => E.respondCounter(w, id, 'Kavita', true), /Only Rahul/);
  const yes = E.respondCounter(w, id, 'Rahul', true);
  assert.equal(yes.approvals.at(-1).status, 'approved'); assert.equal(t(yes, 'T-101').status, 'open');
  const no = E.respondCounter(w, id, 'Rahul', false);
  assert.equal(no.approvals.at(-1).status, 'declined'); assert.equal(t(no, 'T-101').status, 'open');
});
test('send back needs a reason and unfreezes the task so the rep can re-ask', () => {
  let w = E.askDiscount(w0(), 'T-101', 'Rahul', 8, 'x'); const id = w.approvals.at(-1).id;
  assert.throws(() => E.sendBack(w, id, 'Kavita', ''), /missing/);
  w = E.sendBack(w, id, 'Kavita', 'Attach competitor quote');
  assert.equal(t(w, 'T-101').status, 'open');
  assert.doesNotThrow(() => E.askDiscount(w, 'T-101', 'Rahul', 6, 'Quote attached'));
});
test('the seeded ask waits for Kavita from day one', () => {
  assert.equal(E.decisionsFor(w0(), 'Kavita').length, 1);
});
test('rebalance: managers only, never a frozen task, never to a non-rep', () => {
  const w = w0();
  assert.throws(() => E.rebalance(w, 'T-104', 'Rahul', 'Neha'), /Only a sales manager/);
  assert.throws(() => E.rebalance(w, 'T-201', 'Kavita', 'Rahul'), /discount decision/);
  assert.throws(() => E.rebalance(w, 'T-104', 'Kavita', 'Arjun'), /sales rep/);
  const m = E.rebalance(w, 'T-104', 'Kavita', 'Neha');
  assert.equal(t(m, 'T-104').rep, 'Neha'); assert.equal(t(m, 'T-104').due, t(w, 'T-104').due);
  let a = E.askDiscount(w, 'T-101', 'Rahul', 8, 'x'); a = E.approve(a, a.approvals.at(-1).id, 'Kavita', 8, E.addDays(D, 5));
  assert.throws(() => E.rebalance(a, 'T-101', 'Kavita', 'Neha'), /stays with Rahul/);
});
test('metric counts on time against the ORIGINAL target, so rescheduling cannot fake it', () => {
  let w = E.reschedule(w0(), 'T-107', 'Rahul', E.addDays(D, 1));
  w = { ...w, today: E.addDays(D, 1) };
  w = E.complete(w, 'T-107', 'Rahul', 'Called', false).w;
  assert.equal(E.metrics(w).onTime, 0); assert.equal(E.metrics(w).done, 1);
});
