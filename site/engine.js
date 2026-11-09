/* Ten Today engine. Every rule lives here; the screen only calls these functions.
   Pure functions: each takes a workspace and returns a new one, or throws a plain-English error. */

export const CAP = 10;                 // Today never shows more than 10
export const MANAGER_LIMIT = 10;       // Kavita approves up to 10% discount
export const SLA_DAYS = 1;             // an ask not decided in 1 day escalates to the sales head
export const GST = 0.18;

export const PEOPLE = [
  { name: 'Rahul', role: 'Sales rep', rep: true },
  { name: 'Neha', role: 'Sales rep', rep: true },
  { name: 'Kavita', role: 'Sales manager', approver: true, manager: true },
  { name: 'Arjun', role: 'Sales head', approver: true, manager: true, senior: true },
];
export const person = n => PEOPLE.find(p => p.name === n);
export const label = n => (person(n) ? `${n} · ${person(n).role}` : n);

export const STAGES = ['New lead', 'Qualified', 'Quote sent', 'Negotiation', 'Order placed'];
const NEXT_STEP = {
  'New lead': 'Qualify: confirm need, volume and decision maker',
  'Qualified': 'Send the quote',
  'Quote sent': 'Follow up on the quote',
  'Negotiation': 'Close the order',
};
const BLOCKING = ['Quote sent', 'Negotiation']; // money is waiting on these

/* ---------- dates (ISO yyyy-mm-dd, local) ---------- */
export const iso = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
export const daysBetween = (a, b) => { const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000); };
const stamp = () => new Date().toISOString();
const clone = w => JSON.parse(JSON.stringify(w));
const fail = m => { throw new Error(m); };

/* ---------- sample workspace, dated relative to today ---------- */
export function sample(today) {
  const t = (n, rep, customer, stage, overdue, value, extra = {}) => ({
    id: `T-${n}`, rep, customer, stage, title: NEXT_STEP[stage],
    due: addDays(today, -overdue), target: addDays(today, -overdue), value,
    status: 'open', reschedules: [], hold: null, approvalId: null, log: [], ...extra,
  });
  const tasks = [
    t(101, 'Rahul', 'Aarav Distributors', 'Negotiation', 6, 480000),
    t(102, 'Rahul', 'Meera Trading', 'Quote sent', 2, 260000),
    t(103, 'Rahul', 'Kiran Agencies', 'Qualified', 0, 90000),
    t(104, 'Rahul', 'Sai Enterprises', 'New lead', 7, 40000),
    t(105, 'Rahul', 'Om Traders', 'Quote sent', 3, 150000),
    t(106, 'Rahul', 'Laxmi Stores', 'Qualified', 1, 70000),
    t(107, 'Rahul', 'Vasant Retail', 'New lead', 0, 30000),
    t(108, 'Rahul', 'Ganesh Wholesale', 'Negotiation', 1, 520000),
    t(109, 'Rahul', 'Shree Mart', 'Qualified', 5, 60000),
    t(110, 'Rahul', 'Patil & Sons', 'New lead', 2, 25000),
    t(111, 'Rahul', 'Royal Foods', 'Quote sent', 0, 110000),
    t(112, 'Rahul', 'Nandi Supplies', 'New lead', 1, 20000),
    t(113, 'Rahul', 'Krishna Agro', 'Qualified', -2, 80000),
    t(114, 'Rahul', 'Ashok Bros', 'New lead', -4, 35000),
    t(201, 'Neha', 'Delta Pharma', 'Negotiation', 2, 300000),
    t(202, 'Neha', 'Sunrise Medicals', 'Quote sent', 0, 120000),
    t(203, 'Neha', 'Green Leaf', 'New lead', 1, 30000),
  ];
  tasks.find(x => x.id === 'T-111').callbackAt = '16:30';
  const w = {
    today,
    tasks,
    customers: {
      // creditLimit and outstanding in ₹; creditDays = allowed days; oldestBillDays = age of the oldest unpaid bill
      'Aarav Distributors': { marginFloorPct: 12, creditLimit: 600000, outstanding: 120000, creditDays: 30, oldestBillDays: 10 },
      'Ganesh Wholesale': { marginFloorPct: 9, creditLimit: 500000, outstanding: 186000, creditDays: 30, oldestBillDays: 42 },
      'Meera Trading': { marginFloorPct: 10, creditLimit: 300000, outstanding: 0, creditDays: 30, oldestBillDays: 0 },
      'Om Traders': { marginFloorPct: 8, creditLimit: 150000, outstanding: 140000, creditDays: 45, oldestBillDays: 12 },
      'Delta Pharma': { marginFloorPct: 11, creditLimit: 800000, outstanding: 0, creditDays: 30, oldestBillDays: 0 },
      'Royal Foods': { marginFloorPct: 10, creditLimit: 400000, outstanding: 50000, creditDays: 30, oldestBillDays: 5 },
      'Sunrise Medicals': { marginFloorPct: 9, creditLimit: 300000, outstanding: 0, creditDays: 30, oldestBillDays: 0 },
    },
    approvals: [],
    schemes: [{ id: 'SCH-01', name: 'Volume slab: 3% on orders of ₹2,00,000+', minValue: 200000, pct: 3, status: 'active', maker: 'Kavita', checker: 'Arjun', log: [] }],
    seq: { task: 300, apv: 31, sch: 1 },
    audit: [],
  };
  // One ask is already waiting for Kavita, so her desk has work from the start.
  let seeded = askDiscount(w, 'T-201', 'Neha', 8, 'Competitor quoted 9% lower on the annual order');
  // A second ask has sat with Kavita for 2 days: it escalates to the sales head on load.
  seeded = askDiscount(seeded, 'T-202', 'Neha', 5, 'Hospital tender; rival bid 5% lower');
  seeded.approvals[1].askedOn = addDays(today, -2);
  return escalate(seeded);
}

const customerOf = (w, name) => w.customers[name] ?? { marginFloorPct: 10, creditLimit: 0, outstanding: 0, creditDays: 30, oldestBillDays: 0 };
export const rupeesOff = (value, pct) => Math.round(value * pct / 100); // discount stated before GST
/* Dealer credit, the way distributor ERPs enforce it: a money ceiling and a days ceiling. */
export function creditCheck(w, customer) {
  const c = customerOf(w, customer); const why = [];
  if (c.creditLimit && c.outstanding > c.creditLimit) why.push(`over credit limit (₹${c.outstanding.toLocaleString('en-IN')} of ₹${c.creditLimit.toLocaleString('en-IN')})`);
  if (c.oldestBillDays > c.creditDays) why.push(`bill ${c.oldestBillDays} days old, credit period is ${c.creditDays} days`);
  return { ok: why.length === 0, why, ...c };
}
const findTask = (w, id) => w.tasks.find(x => x.id === id) ?? fail('Task not found.');
const findApv = (w, id) => w.approvals.find(x => x.id === id) ?? fail('Approval not found.');
const note = (w, task, who, text) => { task.log.push({ at: stamp(), who, text }); w.audit.push({ at: stamp(), who, text: `${task.id} · ${task.customer}: ${text}` }); };
const mustBeRep = (task, actor) => { if (task.rep !== actor) fail(`This is ${task.rep}'s task. Only ${task.rep} can act on it.`); };

/* ---------- the queue ---------- */
export const daysOver = (w, task) => Math.max(0, daysBetween(task.due, w.today)); // ages from the ORIGINAL target
export const tier = (w, task) => { const d = daysOver(w, task); return d >= 5 ? 1 : d >= 1 ? 2 : 3; };

export function explain(w, task) {
  const d = daysOver(w, task);
  const parts = [`P${tier(w, task)}: ${d === 0 ? 'due today' : `${d} day${d > 1 ? 's' : ''} past target`}`];
  if (BLOCKING.includes(task.stage)) parts.push(`${task.stage}: money is waiting`);
  if (task.reschedules.length) parts.push(`moved ${task.reschedules.length}× (still ageing from ${task.due})`);
  if (task.callbackAt) parts.push(`customer agreed to a call at ${task.callbackAt}`);
  return parts.join(' · ');
}

/* Today for one rep: actionable now, ranked by the four rules, capped at 10. */
export function today(w, rep) {
  const live = w.tasks.filter(x => x.rep === rep && x.status === 'open' && x.target <= w.today);
  const pinned = live.filter(x => x.callbackAt).sort((a, b) => a.callbackAt.localeCompare(b.callbackAt));
  const rest = live.filter(x => !x.callbackAt).sort((a, b) =>
    tier(w, a) - tier(w, b) ||
    (BLOCKING.includes(b.stage) ? 1 : 0) - (BLOCKING.includes(a.stage) ? 1 : 0) ||
    daysOver(w, b) - daysOver(w, a) ||
    b.value - a.value);
  const ranked = [...pinned, ...rest];
  return { list: ranked.slice(0, CAP), waiting: ranked.length - Math.min(CAP, ranked.length) };
}
/* Everything else the rep owns, so nothing disappears. */
export function inbox(w, rep) {
  const mine = w.tasks.filter(x => x.rep === rep);
  return {
    frozen: mine.filter(x => x.status === 'frozen'),
    hold: mine.filter(x => x.status === 'hold'),
    later: mine.filter(x => x.status === 'open' && x.target > w.today).sort((a, b) => a.target.localeCompare(b.target)),
    done: mine.filter(x => x.status === 'done'),
  };
}

/* ---------- rep actions ---------- */
function spawnNext(w, task, actor) {
  const i = STAGES.indexOf(task.stage);
  const nextStage = STAGES[i + 1];
  if (!nextStage || !NEXT_STEP[nextStage]) return null; // Order placed: nothing more for sales
  const id = `T-${++w.seq.task}`;
  const n = { id, rep: task.rep, customer: task.customer, stage: nextStage, title: NEXT_STEP[nextStage], due: addDays(w.today, 2), target: addDays(w.today, 2), value: task.value, status: 'open', reschedules: [], hold: null, approvalId: null, log: [], from: task.id };
  w.tasks.push(n);
  note(w, n, actor, `Created when ${task.id} moved to ${nextStage}. Due ${n.due}.`);
  return n;
}

/* ✓ Done: needs an outcome. If the deal moved stage, the next task is created once. */
export function complete(w0, id, actor, outcome, stageMoved) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  if (task.status !== 'open') fail('Only open tasks can be marked done.');
  if (!outcome || !outcome.trim()) fail('Write what happened first (one line is enough).');
  task.status = 'done'; task.doneAt = w.today; task.outcome = outcome.trim();
  note(w, task, actor, `Done: ${outcome.trim()}${task.doneAt > task.due ? ` (${daysOver(w, task)} days after the original target)` : ' (on time)'}`);
  let next = null;
  if (stageMoved && task.kind !== 'recovery') { next = spawnNext(w, task, actor); if (next) note(w, task, actor, `Stage moved to ${next.stage}. Next task ${next.id} created.`); else note(w, task, actor, 'Order placed. Nothing more for sales.'); }
  return { w, next };
}

/* Reschedule: the original target never changes, so it keeps ageing. Second move needs a blocker. */
export function reschedule(w0, id, actor, toDay, blocker) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  if (task.status !== 'open') fail('Only open tasks can be rescheduled.');
  if (!toDay || toDay <= w.today) fail('Pick a date after today.');
  if (task.reschedules.length >= 1 && !(blocker && blocker.trim())) fail('Second move: say what is blocking it. It keeps ageing from the original target either way.');
  task.reschedules.push({ to: toDay, blocker: (blocker ?? '').trim(), on: w.today });
  task.target = toDay;
  note(w, task, actor, `Moved to ${toDay}${blocker ? ` · blocker: ${blocker.trim()}` : ''}. Original target ${task.due} still counts.`);
  return w;
}

/* On hold: needs a reason and a revisit date, or it isn't allowed. */
export function putOnHold(w0, id, actor, reason, revisit) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  if (task.status !== 'open') fail('Only open tasks can go on hold.');
  if (!reason || !reason.trim()) fail('Say why it is on hold.');
  if (!revisit || revisit <= w.today) fail('Pick a revisit date after today.');
  task.status = 'hold'; task.hold = { reason: reason.trim(), revisit };
  note(w, task, actor, `On hold: ${reason.trim()}. Revisit ${revisit}.`);
  return w;
}
export function resume(w0, id, actor) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  if (task.status !== 'hold') fail('This task is not on hold.');
  task.status = 'open'; task.target = w.today; task.hold = null;
  note(w, task, actor, 'Taken off hold. Back in Today.');
  return w;
}
/* Holds whose revisit date has arrived come back by themselves. */
export function wakeHolds(w0) {
  const w = clone(w0);
  for (const t of w.tasks) if (t.status === 'hold' && t.hold.revisit <= w.today) { t.status = 'open'; t.target = w.today; note(w, t, 'System', `Revisit date ${t.hold.revisit} reached. Back in Today.`); t.hold = null; }
  return w;
}

/* ---------- discount approvals ---------- */
/* Who must approve: Kavita up to 10% and within the margin floor; the sales head for anything else,
   or when the customer is 30+ days overdue. */
export function approverFor(w, customer, pct) {
  const c = customerOf(w, customer);
  const why = [];
  if (pct > MANAGER_LIMIT) why.push(`above ${MANAGER_LIMIT}%`);
  if (pct > c.marginFloorPct) why.push(`below the margin floor (max ${c.marginFloorPct}%)`);
  why.push(...creditCheck(w, customer).why.map(x => `credit hold: ${x}`));
  return { approver: why.length ? 'Arjun' : 'Kavita', why };
}

export function askDiscount(w0, id, actor, pct, reason) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  if (task.status !== 'open') fail('Only open tasks can ask for a discount.');
  if (!BLOCKING.includes(task.stage)) fail(`Discounts are asked at Quote sent or Negotiation. This deal is at ${task.stage}.`);
  if (!(pct > 0 && pct <= 30)) fail('Enter a discount between 0.5% and 30%.');
  if (!reason || !reason.trim()) fail('Say why the customer needs it (competitor price, volume, etc.).');
  if (w.approvals.some(a => a.taskId === id && ['pending', 'countered'].includes(a.status))) fail('An ask is already open for this task.');
  const { approver, why } = approverFor(w, task.customer, pct);
  const c = customerOf(w, task.customer);
  const a = { id: `APV-2026-${String(++w.seq.apv).padStart(3, '0')}`, taskId: id, customer: task.customer, rep: actor, askPct: pct, reason: reason.trim(), value: task.value, approver, routedBecause: why, marginFloorPct: c.marginFloorPct, outstanding: c.outstanding, creditLimit: c.creditLimit, oldestBillDays: c.oldestBillDays, creditDays: c.creditDays, amount: rupeesOff(task.value, pct), askedOn: w.today, status: 'pending', capPct: null, validTo: null, decidedBy: null, log: [] };
  w.approvals.push(a);
  task.status = 'frozen'; task.approvalId = a.id;
  a.log.push({ at: stamp(), who: actor, text: `Asked ${pct}%: ${a.reason}` });
  note(w, task, actor, `Asked ${label(approver)} for ${pct}% (${a.id}). Task frozen until they decide${why.length ? `. Routed to the sales head: ${why.join(', ')}` : ''}.`);
  return w;
}

const mustDecide = (a, actor) => {
  if (a.status !== 'pending') fail('This ask is not waiting for a decision.');
  if (actor === a.rep) fail(`${a.rep} asked for this, so ${a.rep} can't decide it.`);
  const p = person(actor);
  if (!p?.approver) fail('Only a sales manager or the sales head can decide discounts.');
  if (a.approver === 'Arjun' && !p.senior) fail(`Only the sales head can decide this: ${a.routedBecause.join(', ')}.`);
};
function unfreeze(w, a, who, text) { const t = findTask(w, a.taskId); t.status = 'open'; t.target = w.today; note(w, t, who, text); return t; }

/* Approve: a cap (≤ ask) and an expiry are required. The rep's task unfreezes with the next step. */
export function approve(w0, apvId, actor, capPct, validTo, overrideNote) {
  const w = clone(w0); const a = findApv(w, apvId); mustDecide(a, actor);
  const hold = a.routedBecause.some(r => r.startsWith('credit hold'));
  if (hold && !(overrideNote && overrideNote.trim())) fail('This dealer is on credit hold. Write why you are overriding it (e.g. post-dated cheque received).');
  if (!(capPct > 0)) fail('Set the approved discount.');
  if (capPct > a.askPct) fail(`You can't approve more than was asked (${a.askPct}%).`);
  if (!person(actor).senior && (capPct > MANAGER_LIMIT || capPct > a.marginFloorPct)) fail(`Above your limit. Max ${Math.min(MANAGER_LIMIT, a.marginFloorPct)}%, or send it to the sales head.`);
  if (!validTo || validTo <= w.today) fail('Set an expiry date after today. Approvals never stay open forever.');
  Object.assign(a, { status: 'approved', capPct, validTo, decidedBy: actor, decidedOn: w.today, amount: rupeesOff(a.value, capPct), override: hold ? overrideNote.trim() : null });
  a.log.push({ at: stamp(), who: actor, text: `Approved ${capPct}% before GST (₹${a.amount.toLocaleString('en-IN')}), valid to ${validTo}${hold ? `. Credit hold overridden: ${overrideNote.trim()}` : ''}` });
  const t = unfreeze(w, a, actor, `${a.id} approved: ${capPct}% before GST, valid to ${validTo}. Send the revised quote.`);
  t.title = `Send revised quote at ${capPct}% (${a.id})`;
  return w;
}
/* Counter: offer less. The rep accepts or declines; nothing stays stuck. */
export function counter(w0, apvId, actor, capPct, validTo, why) {
  const w = clone(w0); const a = findApv(w, apvId); mustDecide(a, actor);
  if (!(capPct > 0 && capPct < a.askPct)) fail(`A counter must be below the ask (${a.askPct}%).`);
  if (!person(actor).senior && (capPct > MANAGER_LIMIT || capPct > a.marginFloorPct)) fail(`Above your limit. Max ${Math.min(MANAGER_LIMIT, a.marginFloorPct)}%.`);
  if (!validTo || validTo <= w.today) fail('Set an expiry date after today.');
  if (!why || !why.trim()) fail('Say why you are offering less.');
  if (a.routedBecause.some(r => r.startsWith('credit hold'))) fail('This dealer is on credit hold. Approve with an override note, or send it back.');
  Object.assign(a, { status: 'countered', capPct, validTo, decidedBy: actor, counterWhy: why.trim(), amount: rupeesOff(a.value, capPct) });
  a.log.push({ at: stamp(), who: actor, text: `Countered at ${capPct}%: ${why.trim()}` });
  const t = findTask(w, a.taskId); note(w, t, actor, `${a.id}: ${label(actor)} offered ${capPct}% instead of ${a.askPct}%. ${a.rep} to accept or decline.`);
  return w;
}
export function respondCounter(w0, apvId, actor, accept) {
  const w = clone(w0); const a = findApv(w, apvId);
  if (a.status !== 'countered') fail('No counter-offer is waiting.');
  if (actor !== a.rep) fail(`Only ${a.rep} can answer this counter-offer.`);
  if (accept) {
    a.status = 'approved'; a.decidedOn = w.today; a.log.push({ at: stamp(), who: actor, text: `Accepted ${a.capPct}%` });
    const t = unfreeze(w, a, actor, `Accepted ${a.capPct}% (${a.id}), valid to ${a.validTo}. Send the revised quote.`);
    t.title = `Send revised quote at ${a.capPct}% (${a.id})`;
  } else {
    a.status = 'declined'; a.log.push({ at: stamp(), who: actor, text: 'Declined the counter-offer' });
    unfreeze(w, a, actor, `Declined ${a.capPct}%. Back to negotiating without a discount.`);
  }
  return w;
}
/* Send back: a reason is required; the rep's task unfreezes so they can fix and re-ask. */
export function sendBack(w0, apvId, actor, why) {
  const w = clone(w0); const a = findApv(w, apvId); mustDecide(a, actor);
  if (!why || !why.trim()) fail('Say what is missing, so the rep can fix it.');
  Object.assign(a, { status: 'sent_back', decidedBy: actor, counterWhy: why.trim() });
  a.log.push({ at: stamp(), who: actor, text: `Sent back: ${why.trim()}` });
  unfreeze(w, a, actor, `${a.id} sent back by ${label(actor)}: ${why.trim()}. Fix it and ask again, or continue without a discount.`);
  return w;
}
/* What each approver must decide now. Senior sees everything routed to him. */
export const decisionsFor = (w, actor) => w.approvals.filter(a => a.status === 'pending' && a.approver === actor);
export const waitingDays = (w, a) => daysBetween(a.askedOn, w.today);

/* ---------- manager: workload and rebalance ---------- */
export function workload(w) {
  return PEOPLE.filter(p => p.rep).map(p => {
    const open = w.tasks.filter(t => t.rep === p.name && t.status === 'open' && t.target <= w.today);
    return { rep: p.name, actionable: open.length, overCap: Math.max(0, open.length - CAP), p1: open.filter(t => tier(w, t) === 1).length, frozen: w.tasks.filter(t => t.rep === p.name && t.status === 'frozen').length };
  });
}
/* Confirm-first in the UI; here: managers only, never a frozen (approval) task, never to a non-rep. */
export function rebalance(w0, id, actor, toRep) {
  const w = clone(w0); const task = findTask(w, id);
  if (!person(actor)?.manager) fail('Only a sales manager can move work between reps.');
  if (!person(toRep)?.rep) fail('Work can only move to a sales rep.');
  if (task.status === 'frozen') fail('This task is waiting on a discount decision. It stays with the rep who asked.');
  if (task.status !== 'open') fail('Only open tasks can be moved.');
  if (task.approvalId && w.approvals.some(a => a.id === task.approvalId && a.status === 'approved')) fail(`This deal has an approved discount (${task.approvalId}) negotiated by ${task.rep}. It stays with ${task.rep}.`);
  if (task.rep === toRep) fail(`It is already ${toRep}'s.`);
  const from = task.rep; task.rep = toRep;
  note(w, task, actor, `Moved from ${label(from)} to ${label(toRep)}. Original target ${task.due} kept.`);
  return w;
}

/* ---------- the metric ---------- */
export function metrics(w) {
  const done = w.tasks.filter(t => t.status === 'done');
  const onTime = done.filter(t => t.doneAt <= t.due).length;
  return { done: done.length, onTime, pct: done.length ? Math.round((onTime / done.length) * 100) : null, movedThrice: w.tasks.filter(t => t.reschedules.length >= 3).length };
}

/* ---------- approval clock ---------- */
/* An ask Kavita hasn't decided within SLA_DAYS moves to the sales head. Run on every load. */
export function escalate(w0) {
  const w = clone(w0);
  for (const a of w.approvals) if (a.status === 'pending' && a.approver !== 'Arjun' && daysBetween(a.askedOn, w.today) >= SLA_DAYS) {
    const from = a.approver; a.approver = 'Arjun'; a.escalated = true; a.routedBecause.push(`${from} did not decide within ${SLA_DAYS} day`);
    a.log.push({ at: stamp(), who: 'System', text: `Escalated from ${label(from)} after ${daysBetween(a.askedOn, w.today)} days` });
    note(w, findTask(w, a.taskId), 'System', `${a.id} escalated to the sales head: ${from} did not decide within ${SLA_DAYS} day.`);
  }
  return w;
}
export function turnaround(w) {
  return PEOPLE.filter(p => p.approver).map(p => {
    const decided = w.approvals.filter(a => a.decidedBy === p.name && a.decidedOn);
    return { name: p.name, decided: decided.length, escalatedAway: w.approvals.filter(a => a.escalated && a.routedBecause.some(r => r.startsWith(p.name))).length, avgDays: decided.length ? +(decided.reduce((s, a) => s + daysBetween(a.askedOn, a.decidedOn), 0) / decided.length).toFixed(1) : null };
  });
}

/* ---------- schemes: pre-approved slabs apply without asking; creating one needs maker-checker ---------- */
export function applyScheme(w0, id, actor, schemeId) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  const sc = (w.schemes ?? []).find(x => x.id === schemeId) ?? fail('Scheme not found.');
  if (sc.status !== 'active') fail('This scheme is not approved yet, so it cannot be used.');
  if (task.status !== 'open' || !BLOCKING.includes(task.stage)) fail('Schemes are applied on an open quote or negotiation.');
  if (task.value < sc.minValue) fail(`This order is ₹${task.value.toLocaleString('en-IN')}. The scheme starts at ₹${sc.minValue.toLocaleString('en-IN')}.`);
  if (task.scheme) fail('A scheme is already applied to this order.');
  task.scheme = { id: sc.id, pct: sc.pct, amount: rupeesOff(task.value, sc.pct) };
  note(w, task, actor, `Scheme ${sc.id} applied: ${sc.pct}% before GST = ₹${task.scheme.amount.toLocaleString('en-IN')}. Pre-approved, so no ask was needed.`);
  return w;
}
export function proposeScheme(w0, actor, name, minValue, pct) {
  const w = clone(w0);
  if (!person(actor)?.manager) fail('Only a sales manager can propose a scheme.');
  if (!name || !name.trim()) fail('Name the scheme.');
  if (!(minValue > 0)) fail('Set the minimum order value.');
  if (!(pct > 0 && pct <= 10)) fail('A scheme can give 0.5% to 10%. Bigger cuts go through a discount ask.');
  const sc = { id: `SCH-${String(++w.seq.sch).padStart(2, '0')}`, name: name.trim(), minValue, pct, status: 'pending', maker: actor, checker: null, log: [{ at: stamp(), who: actor, text: 'Proposed' }] };
  (w.schemes ??= []).push(sc); w.audit.push({ at: stamp(), who: actor, text: `${sc.id} proposed: ${sc.name}. Waiting for a second person to approve.` });
  return w;
}
export function approveScheme(w0, schemeId, actor) {
  const w = clone(w0); const sc = (w.schemes ?? []).find(x => x.id === schemeId) ?? fail('Scheme not found.');
  if (sc.status !== 'pending') fail('This scheme is not waiting for approval.');
  if (!person(actor)?.manager) fail('Only a sales manager or the sales head can approve schemes.');
  if (actor === sc.maker) fail(`${actor} proposed this scheme, so ${actor} can't approve it. A second person must.`);
  sc.status = 'active'; sc.checker = actor; sc.log.push({ at: stamp(), who: actor, text: 'Approved' });
  w.audit.push({ at: stamp(), who: actor, text: `${sc.id} approved: ${sc.name}. Reps can now apply it.` });
  return w;
}

/* ---------- handoff contract v1 with Every Rupee (everyrupee finance desk) ---------- */
const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = t => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/')))));
export const EVERY_RUPEE = 'https://every-rupee-gets-owner.lovable.app/demo';
export function financeLink(w, apvId) {
  const a = findApv(w, apvId);
  if (a.status !== 'approved') fail('Only approved discounts go to finance.');
  return `${EVERY_RUPEE}?apv=${enc({ v: 1, id: a.id, customer: a.customer, rep: a.rep, approver: a.decidedBy, capPct: a.capPct, validTo: a.validTo })}`;
}
/* A short payment finance handed back to the rep arrives as a recovery task. Same link twice = same task. */
export function importRecovery(w0, token) {
  let o; try { o = dec(token); } catch { fail('The task link is damaged. Send it again from Every Rupee.'); }
  if (o.v !== 1 || o.kind !== 'recovery') fail('This link is not a recovery task from Every Rupee.');
  if (!/^INV-[\w-]{1,20}$/.test(o.invoiceId ?? '')) fail('The task link has no valid bill number.');
  if (typeof o.customer !== 'string' || !o.customer.trim() || o.customer.length > 80) fail('The task link has no customer.');
  if (!(Number(o.short) > 0)) fail('The task link has no amount.');
  if (!person(o.rep)?.rep) fail('Recovery tasks go to a sales rep.');
  const existing = w0.tasks.find(t => t.source === o.invoiceId);
  if (existing) return { w: w0, task: existing, fresh: false };
  const w = clone(w0); const id = `T-${++w.seq.task}`;
  const task = { id, rep: o.rep, customer: o.customer.trim(), stage: 'Recovery', kind: 'recovery', source: o.invoiceId, title: `Recover ₹${Number(o.short).toLocaleString('en-IN')} on ${o.invoiceId}, or get it approved`, due: w.today, target: w.today, value: Number(o.short), status: 'open', reschedules: [], hold: null, approvalId: null, log: [] };
  w.tasks.push(task); note(w, task, 'System', `Sent from Every Rupee: ${o.customer} paid ₹${Number(o.short).toLocaleString('en-IN')} short on ${o.invoiceId} with no sales approval.`);
  return { w, task, fresh: true };
}
