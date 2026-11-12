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
  assert.match(overdue.approvals.at(-1).routedBecause.join(), /credit hold/);
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
  const m = E.rebalance(w, 'T-104', 'Kavita', 'Imran');
  assert.equal(t(m, 'T-104').rep, 'Imran'); assert.equal(t(m, 'T-104').due, t(w, 'T-104').due);
  let a = E.askDiscount(w, 'T-101', 'Rahul', 8, 'x'); a = E.approve(a, a.approvals.at(-1).id, 'Kavita', 8, E.addDays(D, 5));
  assert.throws(() => E.rebalance(a, 'T-101', 'Kavita', 'Imran'), /stays with Rahul/);
});
test('metric counts on time against the ORIGINAL target, so rescheduling cannot fake it', () => {
  let w = E.reschedule(w0(), 'T-107', 'Rahul', E.addDays(D, 1));
  w = { ...w, today: E.addDays(D, 1) };
  w = E.complete(w, 'T-107', 'Rahul', 'Called', false).w;
  assert.equal(E.metrics(w).onTime, 0); assert.equal(E.metrics(w).done, 1);
});

test('approval clock: an ask Kavita leaves for a day escalates to the sales head', () => {
  const w = w0();
  assert.equal(E.decisionsFor(w, 'Arjun').length, 1);
  const a = E.decisionsFor(w, 'Arjun')[0]; assert.ok(a.escalated); assert.match(a.routedBecause.join(), /did not decide/);
  const later = E.escalate({ ...w, today: E.addDays(D, 1) });
  assert.equal(E.decisionsFor(later, 'Kavita').length, 0);
});
test('dealer credit: over the limit or past credit days routes to the head, who must write an override', () => {
  assert.deepEqual(E.creditCheck(w0(), 'Meera Trading').ok, true);
  assert.match(E.creditCheck(w0(), 'Ganesh Wholesale').why.join(), /42 days old/);
  let w = E.askDiscount(w0(), 'T-108', 'Rahul', 5, 'Volume'); const id = w.approvals.at(-1).id;
  assert.equal(w.approvals.at(-1).approver, 'Arjun');
  assert.throws(() => E.approve(w, id, 'Arjun', 5, E.addDays(D, 5)), /overriding/);
  assert.throws(() => E.counter(w, id, 'Arjun', 3, E.addDays(D, 5), 'x'), /credit hold/);
  w = E.approve(w, id, 'Arjun', 5, E.addDays(D, 5), 'Post-dated cheque for ₹1,86,000 received');
  assert.equal(w.approvals.at(-1).amount, 26000);
});
test('schemes: a live slab applies without an ask; a new one needs a second person', () => {
  let w = E.applyScheme(w0(), 'T-101', 'Rahul', 'SCH-01');
  assert.equal(w.tasks.find(x => x.id === 'T-101').scheme.amount, 14400);
  assert.throws(() => E.applyScheme(w, 'T-101', 'Rahul', 'SCH-01'), /already/);
  assert.throws(() => E.applyScheme(w0(), 'T-105', 'Rahul', 'SCH-01'), /starts at/);
  w = E.proposeScheme(w0(), 'Kavita', 'Festive 2%', 100000, 2); const sid = w.schemes.at(-1).id;
  assert.throws(() => E.applyScheme(w, 'T-102', 'Rahul', sid), /not approved/);
  assert.throws(() => E.approveScheme(w, sid, 'Kavita'), /second person/);
  assert.throws(() => E.proposeScheme(w0(), 'Rahul', 'x', 1, 2), /manager/);
  w = E.approveScheme(w, sid, 'Arjun');
  assert.doesNotThrow(() => E.applyScheme(w, 'T-102', 'Rahul', sid));
});
test('handoff v1: approved discounts go to finance; unapproved short payments come back as one task', () => {
  let w = E.askDiscount(w0(), 'T-101', 'Rahul', 6, 'x'); const id = w.approvals.at(-1).id;
  assert.throws(() => E.financeLink(w, id), /Only approved/);
  w = E.approve(w, id, 'Kavita', 6, E.addDays(D, 30));
  const tok = new URL(E.financeLink(w, id)).searchParams.get('apv');
  const o = JSON.parse(Buffer.from(tok.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  assert.deepEqual([o.v, o.capPct, o.approver, o.rep], [1, 6, 'Kavita', 'Rahul']);
  const t = Buffer.from(JSON.stringify({ v: 1, kind: 'recovery', invoiceId: 'INV-102', customer: 'Meera Trading', short: 12400, rep: 'Rahul' })).toString('base64url');
  const r = E.importRecovery(w0(), t); assert.ok(r.fresh); assert.equal(r.task.rep, 'Rahul');
  assert.ok(E.today(r.w, 'Rahul').list.some(x => x.id === r.task.id) || E.today(r.w, 'Rahul').waiting > 0);
  assert.equal(E.importRecovery(r.w, t).fresh, false);
  assert.throws(() => E.importRecovery(w0(), 'xx'), /damaged|not a recovery/);
  const bad = Buffer.from(JSON.stringify({ v: 1, kind: 'recovery', invoiceId: 'INV-1', customer: 'X', short: 5, rep: 'Kavita' })).toString('base64url');
  assert.throws(() => E.importRecovery(w0(), bad), /sales rep/);
  const done = E.complete(r.w, r.task.id, 'Rahul', 'Customer agreed to pay', true);
  assert.equal(done.next, null);
  assert.throws(() => E.askDiscount(r.w, 'T-101', 'Rahul', 6, 'Volume'), /Blocked by Every Rupee/);
  assert.doesNotThrow(() => E.askDiscount(done.w, 'T-101', 'Rahul', 6, 'Volume'));
});
import { createHash } from 'node:crypto';
test('sealed record: SHA-256 is correct, and any edit, deletion or reorder is caught', () => {
  for (const s of ['', 'abc', '₹14,400 before GST']) assert.equal(E.sha256(s), createHash('sha256').update(s).digest('hex'));
  let w = E.askDiscount(w0(), 'T-101', 'Rahul', 6, 'x'); w = E.approve(w, w.approvals.at(-1).id, 'Kavita', 6, E.addDays(D, 10));
  assert.ok(E.verifyChain(w).ok); assert.equal(w.approvals.at(-1).seal, w.chain.at(-1).hash);
  const t = E.simulateTamper(w); assert.equal(E.verifyChain(t).ok, false); assert.ok(E.verifyChain(E.undoTamper(t)).ok);
  const del = structuredClone(w); del.chain.splice(1, 1); assert.equal(E.verifyChain(del).ok, false);
  const swap = structuredClone(w); [swap.chain[0], swap.chain[1]] = [swap.chain[1], swap.chain[0]]; assert.equal(E.verifyChain(swap).ok, false);
  const back = structuredClone(w); back.chain[2].at = '2026-01-01T00:00:00Z'; assert.equal(E.verifyChain(back).brokenAt, 3);
  const o = JSON.parse(Buffer.from(new URL(E.financeLink(w, w.approvals.at(-1).id)).searchParams.get('apv'), 'base64url').toString());
  assert.equal(o.seal, E.contractSeal(o)); assert.notEqual(o.seal, E.contractSeal({ ...o, capPct: 10 }));
  const auditOk = E.auditChain(w); assert.equal(auditOk.ok, true);
  const auditBad = E.auditChain(t); assert.equal(auditBad.ok, false); assert.equal(auditBad.blocks[auditBad.brokenAt - 1].hashMismatch, true);
  assert.equal(E.verifyFinanceContract(w, w.approvals.at(-1).id).ok, true);
  assert.equal(E.verifyFinanceContract(t, w.approvals.at(-1).id).ok, false);
});
test('order must match the approval: cap, expiry and one order per approval', () => {
  let w = E.askDiscount(w0(), 'T-101', 'Rahul', 6, 'x'); w = E.approve(w, w.approvals.at(-1).id, 'Kavita', 6, E.addDays(D, 10));
  assert.throws(() => E.complete(w, 'T-101', 'Rahul', 'closed', true), /Place order/);
  assert.throws(() => E.placeOrder(w, 'T-101', 'Rahul', 480000, 8), /at most 6%/);
  w = E.applyScheme(w, 'T-101', 'Rahul', 'SCH-01');
  const r = E.placeOrder(w, 'T-101', 'Rahul', 480000, 9); assert.equal(r.order.discountAmt, 43200); assert.ok(r.w.approvals.at(-1).used);
  assert.throws(() => E.placeOrder(w0(), 'T-102', 'Rahul', 1000, 2), /nothing approved/);
  const late = { ...w, today: E.addDays(D, 11) }; assert.throws(() => E.placeOrder(late, 'T-101', 'Rahul', 480000, 6), /expired/);
  assert.match(E.exportCsv(r.w, 'orders'), /ORD-501,Aarav Distributors,Rahul,480000,9,43200/);
});
test('working days: Sunday and holidays do not count toward escalation', () => {
  assert.equal(E.workingDaysBetween('2026-11-07', '2026-11-09'), 1); // Sat → Mon, Sun 8 Nov (also Diwali) skipped
  const w = { ...w0(), today: '2026-11-08' }; w.approvals.forEach(a => { a.approver = 'Kavita'; a.escalated = false; a.askedOn = '2026-11-07'; a.status = 'pending'; });
  assert.equal(E.decisionsFor(E.escalate(w), 'Arjun').length, 0);
});
test('delegation: approvals go to the stand-in, logged as acting for; limits still apply', () => {
  assert.throws(() => E.delegate(w0(), 'Rahul', 'Sanjay', D, D), /Only a manager/);
  assert.throws(() => E.delegate(w0(), 'Kavita', 'Sanjay', D, E.addDays(D, 40)), /30 days/);
  const { w, moved } = E.delegate(w0(), 'Kavita', 'Sanjay', D, E.addDays(D, 3));
  assert.equal(moved, 1); assert.equal(E.decisionsFor(w, 'Sanjay').length, 1);
  const n = E.askDiscount(w, 'T-101', 'Rahul', 6, 'x'); assert.equal(n.approvals.at(-1).approver, 'Sanjay'); assert.equal(n.approvals.at(-1).actingFor, 'Kavita');
  assert.throws(() => E.approve(n, n.approvals.at(-1).id, 'Sanjay', 11, E.addDays(D, 5)), /more than was asked|limit/);
  assert.equal(E.decisionsFor(E.endDelegation(w, 'Kavita'), 'Kavita').length, 0);
});
test('discount effectiveness, lost deals and CSV import are all-or-nothing', () => {
  const e = E.effectiveness(w0()); assert.equal(e.n, 12); assert.ok(e.without > e.withDisc);
  const l = E.markLost(w0(), 'T-102', 'Rahul', 'Competitor cheaper'); assert.equal(E.effectiveness(l).n, 13);
  assert.throws(() => E.importDealers(w0(), 'customer,credit_limit\nX,1'), /Missing column/);
  assert.throws(() => E.importDealers(w0(), E.DEALER_COLS.join(',') + '\nA,1,2,30,5,10\nB,x,2,30,5,10'), /Nothing imported.*Line 3/);
  assert.equal(E.importDealers(w0(), E.DEALER_COLS.join(',') + '\nNew Co,100,0,30,0,10').w.customers['New Co'].creditLimit, 100);
  assert.throws(() => E.importTasks(w0(), E.TASK_COLS.join(',') + '\nKavita,A,New lead,2026-11-10,5'), /rep must be/);
  const auto = E.importTasks(w0(), E.TASK_COLS.join(',') + '\n,Green Leaf,New lead,2026-11-10,5\n,Fresh Mart,New lead,2026-11-10,5');
  assert.deepEqual(auto.w.tasks.slice(-2).map(x => x.rep), ['Neha', 'Imran']);
  assert.equal(E.importTasks(w0(), E.TASK_COLS.join(',') + '\nNeha,A,New lead,2026-11-10,5').count, 1);
});

test('buckets: a move outside the bucket needs a reason and a second manager', () => {
  assert.equal(E.bucketOf(w0(), 'Delta Pharma'), 'Pharma'); assert.equal(E.bucketOf(w0(), 'Aarav Distributors'), 'FMCG');
  assert.throws(() => E.rebalance(w0(), 'T-104', 'Kavita', 'Neha'), /doesn't handle FMCG/);
  let w = E.rebalance(w0(), 'T-104', 'Kavita', 'Neha', 'Neha covers Sai Enterprises area this month');
  assert.equal(t(w, 'T-104').rep, 'Rahul'); const id = w.transfers.at(-1).id;
  assert.throws(() => E.rebalance(w, 'T-104', 'Kavita', 'Neha', 'again'), /already waiting/);
  assert.throws(() => E.decideTransfer(w, id, 'Kavita', true), /different manager/);
  assert.throws(() => E.decideTransfer(w, id, 'Rahul', true), /Only a manager/);
  assert.throws(() => E.decideTransfer(w, id, 'Arjun', false, ''), /why/);
  const ok = E.decideTransfer(w, id, 'Arjun', true); assert.equal(t(ok, 'T-104').rep, 'Neha');
  const no = E.decideTransfer(w, id, 'Arjun', false, 'Keep with territory owner'); assert.equal(t(no, 'T-104').rep, 'Rahul');
  assert.ok(E.verifyChain(ok).ok); assert.match(ok.chain.at(-1).text, /Approved TRF-001/);
});

test('auto-routing: overload is balanced within the bucket only', () => {
  const s = E.suggestMoves(w0()); assert.ok(s.length > 0);
  assert.ok(s.every(m => m.from === 'Rahul' && m.to === 'Imran' && m.bucket === 'FMCG'));
  let w = w0(); for (const m of s) w = E.rebalance(w, m.taskId, 'Kavita', m.to);
  assert.equal(E.workload(w).find(r => r.rep === 'Rahul').overCap, 0); assert.equal(E.suggestMoves(w).length, 0);
});
test('daily anchor: a full admin rewrite passes the chain check but fails the anchor', () => {
  const w = w0(); assert.ok(E.verifyAnchored(w).anchored);
  const edited = E.tamperEntry(w, 1, 'Asked 20% before GST');
  assert.equal(E.verifyAnchored(edited).ok, false);
  const rebuilt = E.rebuildChain(edited);
  assert.ok(E.verifyChain(rebuilt).ok); const v = E.verifyAnchored(rebuilt);
  assert.equal(v.ok, false); assert.ok(v.anchorFail);
  let x = E.askDiscount(w, 'T-101', 'Rahul', 6, 'x'); x = E.approve(x, x.approvals.at(-1).id, 'Kavita', 6, E.addDays(D, 9));
  const d = E.sealedDecision(x, x.approvals.at(-1).id); assert.match(d.entry.text, /^Approved 6%/); assert.ok(d.check.ok);
});

test('weekly MIS: every proof KPI passes on the sample and the CSV has one row per KPI', async () => {
  const E = await import('../site/engine.js');
  const w = E.escalate(E.sample('2026-11-11'));
  const m = E.mis(w);
  assert.equal(m.length, 8);
  assert.ok(m.every(r => r.kpi && r.value && r.target && r.proves));
  assert.equal(E.misCsv(w).split('\n').length, 9);
});

test('demo history: MIS opens with real numbers and today\'s queue is unchanged', () => {
  const base = E.escalate(E.sample('2026-11-11')), w = E.escalate(E.withHistory(E.sample('2026-11-11')));
  const ids = x => x.tasks.filter(t => t.status === 'open').map(t => t.id).join();
  assert.equal(ids(w), ids(base));
  assert.ok(E.mis(w).filter(r => r.target !== 'Tracked').every(r => r.ok === true));
  assert.equal(E.verifyAnchored(w).ok, true);
});

test('leave cover: work moves to a rep who knows the accounts, credit stays, hand-back restores', () => {
  let w = E.sample('2026-11-11');
  const imranOpen = w.tasks.filter(t => t.rep === 'Imran' && t.status === 'open').map(t => t.id);
  assert.throws(() => E.coverLeave(w, 'Rahul', 'Imran', 'Neha', w.today, w.today), /Only a manager/);
  assert.throws(() => E.coverLeave(w, 'Kavita', 'Imran', 'Neha', w.today, w.today), /doesn't handle FMCG/);
  const r = E.coverLeave(w, 'Kavita', 'Imran', 'Rahul', w.today, E.addDays(w.today, 3));
  assert.equal(r.moved, imranOpen.length);
  assert.ok(imranOpen.every(id => r.w.tasks.find(t => t.id === id).rep === 'Rahul'));
  assert.equal(E.activeCover(r.w, 'Imran').to, 'Rahul');
  const back = E.endCover(r.w, 'Kavita', 'Imran');
  assert.ok(imranOpen.every(id => back.w.tasks.find(t => t.id === id).rep === 'Imran'));
  assert.equal(E.verifyChain(back.w).ok, true);
});
