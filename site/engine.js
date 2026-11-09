/* Ten Today engine. Every rule lives here; the screen only calls these functions.
   Pure functions: each takes a workspace and returns a new one, or throws a plain-English error. */

export const CAP = 10;                 // Today never shows more than 10
export const MANAGER_LIMIT = 10;       // Kavita approves up to 10% discount
export const SLA_DAYS = 1;             // an ask not decided in 1 day escalates to the sales head
export const GST = 0.18;

export const PEOPLE = [
  { name: 'Rahul', role: 'Sales rep', rep: true, buckets: ['FMCG'] },
  { name: 'Imran', role: 'Sales rep', rep: true, buckets: ['FMCG'] },
  { name: 'Neha', role: 'Sales rep', rep: true, buckets: ['Pharma'] },
  { name: 'Kavita', role: 'Sales manager', approver: true, manager: true },
  { name: 'Sanjay', role: 'Area sales manager', approver: true, manager: true },
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
    t(301, 'Imran', 'Balaji Provisions', 'Qualified', 1, 55000),
    t(302, 'Imran', 'Sri Durga Stores', 'New lead', 0, 18000),
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
    approvals: [], orders: [], chain: [], delegations: [], lost: [], transfers: [],
    // Last quarter's closed deals, so discount effectiveness has a baseline.
    past: [
      { rep: 'Rahul', pct: 8, won: true }, { rep: 'Rahul', pct: 10, won: false }, { rep: 'Rahul', pct: 9, won: false }, { rep: 'Rahul', pct: 7, won: true },
      { rep: 'Rahul', pct: 0, won: true }, { rep: 'Rahul', pct: 0, won: false }, { rep: 'Rahul', pct: 12, won: false },
      { rep: 'Neha', pct: 4, won: true }, { rep: 'Neha', pct: 0, won: true }, { rep: 'Neha', pct: 0, won: true }, { rep: 'Neha', pct: 5, won: true }, { rep: 'Neha', pct: 0, won: false },
    ],
    schemes: [{ id: 'SCH-01', name: 'Volume slab: 3% on orders of ₹2,00,000+', minValue: 200000, pct: 3, status: 'active', maker: 'Kavita', checker: 'Arjun', log: [] }],
    seq: { task: 400, apv: 31, sch: 1, ord: 500 },
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
  if (stageMoved && task.stage === 'Negotiation') fail('To close the deal, use Place order: it checks the discount against what was approved.');
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
  const dg = activeDelegate(w, approver); if (dg) { a.approver = dg.to; a.actingFor = approver; }
  record(w, actor, `Asked ${pct}% before GST for ${task.customer} (${task.id}), routed to ${a.approver}${a.actingFor ? ` acting for ${a.actingFor}` : ''}`, a.id);
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
  a.seal = record(w, actor, `Approved ${capPct}% before GST for ${a.customer}, valid to ${validTo}${a.actingFor ? `, acting for ${a.actingFor}` : ''}${hold ? `, credit override: ${overrideNote.trim()}` : ''}`, a.id);
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
  record(w, actor, `Countered at ${capPct}% for ${a.customer}: ${why.trim()}`, a.id);
  const t = findTask(w, a.taskId); note(w, t, actor, `${a.id}: ${label(actor)} offered ${capPct}% instead of ${a.askPct}%. ${a.rep} to accept or decline.`);
  return w;
}
export function respondCounter(w0, apvId, actor, accept) {
  const w = clone(w0); const a = findApv(w, apvId);
  if (a.status !== 'countered') fail('No counter-offer is waiting.');
  if (actor !== a.rep) fail(`Only ${a.rep} can answer this counter-offer.`);
  if (accept) {
    a.status = 'approved'; a.decidedOn = w.today; a.log.push({ at: stamp(), who: actor, text: `Accepted ${a.capPct}%` });
    a.seal = record(w, actor, `Accepted the ${a.capPct}% counter for ${a.customer}, valid to ${a.validTo}`, a.id);
    const t = unfreeze(w, a, actor, `Accepted ${a.capPct}% (${a.id}), valid to ${a.validTo}. Send the revised quote.`);
    t.title = `Send revised quote at ${a.capPct}% (${a.id})`;
  } else {
    a.status = 'declined'; a.log.push({ at: stamp(), who: actor, text: 'Declined the counter-offer' });
    record(w, actor, `Declined the counter for ${a.customer}`, a.id);
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
  record(w, actor, `Sent back ${a.customer}'s ask: ${why.trim()}`, a.id);
  unfreeze(w, a, actor, `${a.id} sent back by ${label(actor)}: ${why.trim()}. Fix it and ask again, or continue without a discount.`);
  return w;
}
/* What each approver must decide now. Senior sees everything routed to him. */
export const decisionsFor = (w, actor) => w.approvals.filter(a => a.status === 'pending' && a.approver === actor);
export const waitingDays = (w, a) => workingDaysBetween(a.askedOn, w.today);

/* ---------- manager: workload and rebalance ---------- */
export function workload(w) {
  return PEOPLE.filter(p => p.rep).map(p => {
    const open = w.tasks.filter(t => t.rep === p.name && t.status === 'open' && t.target <= w.today);
    return { rep: p.name, actionable: open.length, overCap: Math.max(0, open.length - CAP), p1: open.filter(t => tier(w, t) === 1).length, frozen: w.tasks.filter(t => t.rep === p.name && t.status === 'frozen').length };
  });
}
/* Confirm-first in the UI; here: managers only, never a frozen (approval) task, never to a non-rep. */
/* Buckets, like the ownership buckets in a bank MIS: each dealer sits in one bucket, each rep owns buckets. */
export const PHARMA = ['Delta Pharma', 'Sunrise Medicals', 'Green Leaf'];
export const bucketOf = (w, customer) => w.customers[customer]?.bucket ?? (PHARMA.includes(customer) ? 'Pharma' : 'FMCG');
export const owns = (rep, bucket) => !!person(rep)?.buckets?.includes(bucket);
/* Same bucket: the manager moves it. Wrong bucket: a request with a reason that a different manager must approve. */
export function rebalance(w0, id, actor, toRep, reason) {
  const w = clone(w0); const task = findTask(w, id);
  if (!person(actor)?.manager) fail('Only a sales manager can move work between reps.');
  if (task.kind === 'recovery') fail('Recovery tasks stay with the rep finance named.');
  if (!person(toRep)?.rep) fail('Work can only move to a sales rep.');
  if (task.status === 'frozen') fail('This task is waiting on a discount decision. It stays with the rep who asked.');
  if (task.status !== 'open') fail('Only open tasks can be moved.');
  if (task.approvalId && w.approvals.some(a => a.id === task.approvalId && a.status === 'approved')) fail(`This deal has an approved discount (${task.approvalId}) negotiated by ${task.rep}. It stays with ${task.rep}.`);
  if (task.rep === toRep) fail(`It is already ${toRep}'s.`);
  if ((w.transfers ?? []).some(x => x.taskId === id && x.status === 'pending')) fail('A transfer request for this task is already waiting.');
  const bucket = bucketOf(w, task.customer);
  if (!owns(toRep, bucket)) {
    if (!reason || !reason.trim()) fail(`${toRep} doesn't handle ${bucket} dealers. Give a reason; a second manager must approve this.`);
    const tr = { id: `TRF-${String((w.transfers ??= []).length + 1).padStart(3, '0')}`, taskId: id, customer: task.customer, from: task.rep, to: toRep, bucket, reason: reason.trim(), by: actor, on: w.today, status: 'pending' };
    w.transfers.push(tr); task.transferPending = tr.id;
    note(w, task, actor, `Transfer to ${label(toRep)} requested (${tr.id}): outside their ${person(toRep).buckets.join('/')} bucket. Waiting for a second manager.`);
    record(w, actor, `Requested ${task.id} (${task.customer}, ${bucket}) move to ${toRep}, outside their bucket: ${reason.trim()}`, tr.id);
    w.lastTransfer = tr.id; return w;
  }
  const from = task.rep; task.rep = toRep;
  note(w, task, actor, `Moved from ${label(from)} to ${label(toRep)} within the ${bucket} bucket. Original target ${task.due} kept.`);
  record(w, actor, `Moved ${task.id} (${task.customer}) from ${from} to ${toRep}, same ${bucket} bucket`, task.id);
  delete w.lastTransfer; return w;
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
  for (const a of w.approvals) if (a.status === 'pending' && a.approver !== 'Arjun' && workingDaysBetween(a.askedOn, w.today) >= SLA_DAYS) {
    const from = a.approver; a.approver = 'Arjun'; a.escalated = true; a.routedBecause.push(`${from} did not decide within ${SLA_DAYS} day`);
    a.log.push({ at: stamp(), who: 'System', text: `Escalated from ${label(from)} after ${workingDaysBetween(a.askedOn, w.today)} working days` });
    record(w, 'System', `Escalated ${a.customer}'s ask from ${from} to Arjun`, a.id);
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
  const o = { v: 1, id: a.id, customer: a.customer, rep: a.rep, approver: a.decidedBy, capPct: a.capPct, validTo: a.validTo };
  return `${EVERY_RUPEE}?apv=${enc({ ...o, seal: contractSeal(o) })}`;
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

/* ---------- tamper-evident record (a hash chain, not a blockchain) ---------- */
/* Compact synchronous SHA-256 so the engine stays pure and testable. Input is UTF-8 encoded first. */
export function sha256(str) {
  const ascii = unescape(encodeURIComponent(str));
  const rr = (v, a) => (v >>> a) | (v << (32 - a)); const maxWord = 2 ** 32; let result = '';
  const words = []; const bitLen = ascii.length * 8; let hash = []; const k = [];
  let pc = 0; const comp = {};
  for (let c = 2; pc < 64; c++) { if (!comp[c]) { for (let i = 0; i < 313; i += c) comp[i] = c; hash[pc] = (c ** 0.5 * maxWord) | 0; k[pc++] = (c ** (1 / 3) * maxWord) | 0; } }
  hash = hash.slice(0, 8); let m = ascii + '\x80'; while (m.length % 64 - 56) m += '\x00';
  for (let i = 0; i < m.length; i++) words[i >> 2] |= m.charCodeAt(i) << ((3 - i) % 4) * 8;
  words[words.length] = (bitLen / maxWord) | 0; words[words.length] = bitLen;
  for (let j = 0; j < words.length;) {
    const W = words.slice(j, j += 16); const old = hash; hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = W[i - 15], w2 = W[i - 2], a = hash[0], e = hash[4];
      const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (W[i] = i < 16 ? W[i] : (W[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + W[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
  return result;
}
const entryHash = e => sha256(JSON.stringify({ n: e.n, at: e.at, who: e.who, text: e.text, ref: e.ref, prev: e.prev }));
/* Every approval decision is appended with the fingerprint of the entry before it. Returns the new hash. */
export function record(w, who, text, ref) {
  const prev = w.chain.length ? w.chain.at(-1).hash : 'GENESIS';
  const e = { n: w.chain.length + 1, at: stamp(), who, text, ref: ref ?? null, prev };
  e.hash = entryHash(e); w.chain.push(e); return e.hash;
}
/* Recompute every fingerprint. Any edit, deletion, reorder or backdating breaks the chain from that entry on. */
export function verifyChain(w) {
  let prev = 'GENESIS';
  for (let i = 0; i < w.chain.length; i++) {
    const e = w.chain[i];
    if (e.n !== i + 1 || e.prev !== prev || entryHash(e) !== e.hash) return { ok: false, brokenAt: i + 1, entry: e };
    prev = e.hash;
  }
  return { ok: true, count: w.chain.length, head: prev };
}
/* Demo only: quietly edit an old entry the way an insider might, without re-sealing it. */
export function simulateTamper(w0) {
  const w = clone(w0); const e = [...w.chain].reverse().find(x => /^Approved/.test(x.text)) ?? w.chain.find(x => /%/.test(x.text)) ?? w.chain[0];
  if (!e) fail('Nothing recorded yet.');
  w.tampered = { n: e.n, original: e.text }; e.text = e.text.replace(/(\d+(\.\d+)?)%/, (m, n) => `${Number(n) + 4}%`);
  return w;
}
/* Demo: edit one stored block directly, as a database admin could, bypassing the app (no new fingerprint). */
export function tamperEntry(w0, n, text) {
  const w = clone(w0); const e = w.chain[n - 1] ?? fail('No such block.');
  if (!text || !text.trim() || text.trim() === e.text) fail('Change the text first.');
  if (w.tampered && w.tampered.n !== n) w.chain[w.tampered.n - 1].text = w.tampered.original;
  w.tampered = { n, original: w.tampered?.n === n ? w.tampered.original : e.text }; e.text = text.trim(); return w;
}
export function undoTamper(w0) { const w = clone(w0); if (w.tampered) { w.chain[w.tampered.n - 1].text = w.tampered.original; delete w.tampered; } return w; }
/* The fingerprint carried to Every Rupee: the receiver recomputes it from the fields it received. */
export const contractSeal = o => sha256(JSON.stringify([o.v, o.id, o.customer, o.rep, o.approver, o.capPct, o.validTo]));

/* ---------- working days: Sundays and national holidays don't count against an approver ---------- */
export const HOLIDAYS = ['2026-01-26', '2026-03-04', '2026-08-15', '2026-10-02', '2026-10-20', '2026-11-08', '2026-12-25'];
export const isWorkingDay = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).getDay() !== 0 && !HOLIDAYS.includes(d); };
export function workingDaysBetween(a, b) { let n = 0; for (let d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (isWorkingDay(d)) n++; return n; }

/* ---------- leave and delegation ---------- */
export function activeDelegate(w, name) { return (w.delegations ?? []).find(d => d.from === name && d.start <= w.today && w.today <= d.end) ?? null; }
export function delegate(w0, actor, to, start, end) {
  const w = clone(w0);
  if (!person(actor)?.approver || person(actor).senior) fail('Only a manager who approves discounts can hand over their approvals.');
  if (!person(to)?.approver) fail('Hand over to someone who can approve discounts.');
  if (to === actor) fail('Pick someone else.');
  if (!start || !end || end < start) fail('Set a start and an end date.');
  if (end < w.today) fail('The end date has passed.');
  if (daysBetween(start, end) > 30) fail('Hand over for 30 days at most; longer needs a role change, not a delegation.');
  if (activeDelegate(w, to)?.to === actor) fail(`${to} has already handed over to you. That would loop.`);
  w.delegations = (w.delegations ?? []).filter(d => d.from !== actor);
  w.delegations.push({ from: actor, to, start, end });
  let moved = 0;
  if (start <= w.today) for (const a of w.approvals) if (a.status === 'pending' && a.approver === actor) { a.approver = to; a.actingFor = actor; moved++; a.log.push({ at: stamp(), who: 'System', text: `Moved to ${to}: ${actor} is away` }); }
  record(w, actor, `Handed approvals to ${to} from ${start} to ${end}${moved ? ` (${moved} waiting ask moved)` : ''}`, null);
  return { w, moved };
}
export function endDelegation(w0, actor) {
  const w = clone(w0); if (!activeDelegate(w, actor) && !(w.delegations ?? []).some(d => d.from === actor)) fail('No hand-over to end.');
  w.delegations = w.delegations.filter(d => d.from !== actor); record(w, actor, 'Back: ended the approval hand-over', null); return w;
}

/* ---------- placing the order: the discount given can't exceed what was approved ---------- */
export function allowedPct(w, task) {
  const a = w.approvals.find(x => x.id === task.approvalId && x.status === 'approved');
  return { approval: a ?? null, pct: (a && !a.used ? a.capPct : 0) + (task.scheme?.pct ?? 0) };
}
export function placeOrder(w0, id, actor, orderValue, discountPct) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  if (task.status !== 'open' || !BLOCKING.includes(task.stage)) fail('Orders are placed from an open quote or negotiation.');
  if (!(orderValue > 0)) fail('Enter the order value.');
  if (!(discountPct >= 0)) fail('Enter the discount given (0 if none).');
  const { approval, pct } = allowedPct(w, task);
  if (approval?.used) fail(`${approval.id} was already used on order ${approval.orderId}. One approval covers one order.`);
  if (approval && approval.validTo < w.today) fail(`${approval.id} expired on ${approval.validTo}. Ask again before booking the order.`);
  if (discountPct > pct + 1e-9) fail(`You can give at most ${pct}% here (${approval ? `${approval.capPct}% approved` : 'nothing approved'}${task.scheme ? ` + ${task.scheme.pct}% scheme` : ''}). Book at ${pct}% or ask again.`);
  const ord = { id: `ORD-${++w.seq.ord}`, taskId: id, rep: actor, customer: task.customer, value: orderValue, discountPct, discountAmt: rupeesOff(orderValue, discountPct), approvalId: approval?.id ?? null, scheme: task.scheme?.id ?? null, on: w.today };
  w.orders.push(ord);
  if (approval) { approval.used = true; approval.orderId = ord.id; }
  task.status = 'done'; task.doneAt = w.today; task.outcome = `Order ${ord.id} placed at ${discountPct}%`; task.stage = 'Order placed';
  note(w, task, actor, `Order ${ord.id}: ₹${orderValue.toLocaleString('en-IN')} at ${discountPct}% before GST (₹${ord.discountAmt.toLocaleString('en-IN')} off)${approval ? `, within ${approval.id}` : ''}.`);
  ord.seal = record(w, actor, `Order ${ord.id} for ${task.customer}: ₹${orderValue.toLocaleString('en-IN')} at ${discountPct}%${approval ? ` under ${approval.id}` : ''}`, ord.id);
  return { w, order: ord };
}
export function markLost(w0, id, actor, reason) {
  const w = clone(w0); const task = findTask(w, id); mustBeRep(task, actor);
  if (task.status !== 'open' || !BLOCKING.includes(task.stage)) fail('Only an open quote or negotiation can be marked lost.');
  if (!reason || !reason.trim()) fail('Say why it was lost (price, competitor, timing…).');
  const a = w.approvals.find(x => x.id === task.approvalId && x.status === 'approved');
  w.lost.push({ rep: actor, customer: task.customer, pct: a?.capPct ?? 0, reason: reason.trim(), on: w.today });
  task.status = 'done'; task.doneAt = w.today; task.outcome = `Lost: ${reason.trim()}`;
  note(w, task, actor, `Deal lost: ${reason.trim()}`); record(w, actor, `Deal lost for ${task.customer}${a ? ` despite ${a.capPct}% approved` : ''}: ${reason.trim()}`, task.id);
  return w;
}
/* Did discounts buy deals? Past quarter plus everything closed here. */
export function effectiveness(w) {
  const rows = [...(w.past ?? []), ...w.orders.map(o => ({ rep: o.rep, pct: o.discountPct, won: true })), ...(w.lost ?? []).map(l => ({ rep: l.rep, pct: l.pct, won: false }))];
  const rate = r => (r.length ? Math.round(100 * r.filter(x => x.won).length / r.length) : null);
  const by = PEOPLE.filter(p => p.rep).map(p => { const r = rows.filter(x => x.rep === p.name); const d = r.filter(x => x.pct > 0); return { rep: p.name, deals: r.length, discounted: d.length, withDisc: rate(d), without: rate(r.filter(x => !x.pct)), avgPct: d.length ? +(d.reduce((s, x) => s + x.pct, 0) / d.length).toFixed(1) : null }; });
  return { by, withDisc: rate(rows.filter(x => x.pct > 0)), without: rate(rows.filter(x => !x.pct)), n: rows.length };
}

/* ---------- bring your own data: all-or-nothing CSV import, CSV export ---------- */
const rowsOf = (text, cols) => {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) fail('The file needs a header row and at least one data row.');
  const head = lines[0].split(',').map(h => h.trim().toLowerCase());
  const missing = cols.filter(c => !head.includes(c)); if (missing.length) fail(`Missing column(s): ${missing.join(', ')}. Expected: ${cols.join(', ')}.`);
  if (lines.length > 501) fail('Import at most 500 rows at a time.');
  return lines.slice(1).map((l, i) => { const v = l.split(','); return { line: i + 2, get: c => (v[head.indexOf(c)] ?? '').trim() }; });
};
export const DEALER_COLS = ['customer', 'credit_limit', 'outstanding', 'credit_days', 'oldest_bill_days', 'margin_floor_pct'];
export const TASK_COLS = ['rep', 'customer', 'stage', 'due', 'value'];
export function importDealers(w0, text) {
  const w = clone(w0); const errs = []; const out = {};
  for (const r of rowsOf(text, DEALER_COLS)) {
    const name = r.get('customer'); const n = c => Number(r.get(c));
    if (!name || name.length > 80) errs.push(`Line ${r.line}: customer name missing`);
    for (const c of DEALER_COLS.slice(1)) if (!(n(c) >= 0) || r.get(c) === '') errs.push(`Line ${r.line}: ${c} must be a number ≥ 0`);
    if (n('margin_floor_pct') > 50) errs.push(`Line ${r.line}: margin_floor_pct over 50`);
    if (out[name]) errs.push(`Line ${r.line}: ${name} appears twice`);
    out[name] = { marginFloorPct: n('margin_floor_pct'), creditLimit: n('credit_limit'), outstanding: n('outstanding'), creditDays: n('credit_days'), oldestBillDays: n('oldest_bill_days') };
  }
  if (errs.length) fail(`Nothing imported. Fix these first: ${errs.slice(0, 5).join('; ')}${errs.length > 5 ? ` (+${errs.length - 5} more)` : ''}.`);
  Object.assign(w.customers, out); w.audit.push({ at: stamp(), who: 'Import', text: `${Object.keys(out).length} dealer(s) imported` });
  return { w, count: Object.keys(out).length };
}
export function importTasks(w0, text) {
  const w = clone(w0); const errs = []; const add = [];
  for (const r of rowsOf(text, TASK_COLS)) {
    const rep = r.get('rep'), stage = r.get('stage'), due = r.get('due'), value = Number(r.get('value')), customer = r.get('customer');
    if (!person(rep)?.rep) errs.push(`Line ${r.line}: rep must be one of ${PEOPLE.filter(p => p.rep).map(p => p.name).join(', ')}`);
    if (!customer) errs.push(`Line ${r.line}: customer missing`);
    if (!NEXT_STEP[stage]) errs.push(`Line ${r.line}: stage must be one of ${Object.keys(NEXT_STEP).join(', ')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) errs.push(`Line ${r.line}: due must be yyyy-mm-dd`);
    if (!(value > 0)) errs.push(`Line ${r.line}: value must be above 0`);
    add.push({ rep, customer, stage, due, value });
  }
  if (errs.length) fail(`Nothing imported. Fix these first: ${errs.slice(0, 5).join('; ')}${errs.length > 5 ? ` (+${errs.length - 5} more)` : ''}.`);
  for (const t of add) w.tasks.push({ id: `T-${++w.seq.task}`, rep: t.rep, customer: t.customer, stage: t.stage, title: NEXT_STEP[t.stage], due: t.due, target: t.due, value: t.value, status: 'open', reschedules: [], hold: null, approvalId: null, log: [{ at: stamp(), who: 'Import', text: 'Imported from CSV' }] });
  w.audit.push({ at: stamp(), who: 'Import', text: `${add.length} task(s) imported` });
  return { w, count: add.length };
}
const csvCell = v => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
export function exportCsv(w, kind) {
  const rows = kind === 'orders'
    ? [['order', 'customer', 'rep', 'value', 'discount_pct_before_gst', 'discount_rs', 'approval', 'scheme', 'date', 'seal'], ...w.orders.map(o => [o.id, o.customer, o.rep, o.value, o.discountPct, o.discountAmt, o.approvalId, o.scheme, o.on, o.seal])]
    : [['approval', 'customer', 'rep', 'asked_pct', 'status', 'approved_pct_before_gst', 'approved_rs', 'valid_to', 'decided_by', 'acting_for', 'used_on_order', 'seal'], ...w.approvals.map(a => [a.id, a.customer, a.rep, a.askPct, a.status, a.capPct, a.status === 'approved' ? a.amount : '', a.validTo, a.decidedBy, a.actingFor, a.orderId, a.seal])];
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

/* ---------- leadership snapshot: what a sales head, finance and product would ask first ---------- */
export function impact(w) {
  const decided = w.approvals.filter(a => a.status !== 'pending');
  const notGiven = decided.reduce((s, a) => s + (['approved', 'countered'].includes(a.status) ? rupeesOff(a.value, Math.max(0, a.askPct - (a.capPct ?? 0))) : ['sent_back', 'declined'].includes(a.status) ? rupeesOff(a.value, a.askPct) : 0), 0);
  const given = w.orders.reduce((s, o) => s + o.discountAmt, 0);
  const pend = w.approvals.filter(a => a.status === 'pending');
  const t = decided.filter(a => a.decidedOn);
  return {
    notGiven, given, orders: w.orders.length, orderValue: w.orders.reduce((s, o) => s + o.value, 0),
    pending: pend.length, oldest: pend.length ? Math.max(...pend.map(a => workingDaysBetween(a.askedOn, w.today))) : 0,
    escalated: w.approvals.filter(a => a.escalated).length, creditHolds: w.approvals.filter(a => a.routedBecause.some(r => r.startsWith('credit hold'))).length,
    avgDecision: t.length ? +(t.reduce((s, a) => s + workingDaysBetween(a.askedOn, a.decidedOn), 0) / t.length).toFixed(1) : null,
    intact: verifyChain(w).ok, blocks: w.chain.length,
  };
}
/* The rep's own snapshot: only their work, no team comparison. */
export function repSnapshot(w, rep) {
  const mine = w.approvals.filter(a => a.rep === rep);
  const orders = w.orders.filter(o => o.rep === rep);
  const done = w.tasks.filter(t => t.rep === rep && t.status === 'done');
  return {
    waiting: mine.filter(a => a.status === 'pending').length, toAnswer: mine.filter(a => a.status === 'countered').length,
    approvedOpen: mine.filter(a => a.status === 'approved' && !a.used && a.validTo >= w.today).length,
    expiring: mine.filter(a => a.status === 'approved' && !a.used && a.validTo >= w.today && daysBetween(w.today, a.validTo) <= 3).length,
    orders: orders.length, booked: orders.reduce((s, o) => s + o.value, 0),
    onTime: done.length ? Math.round(100 * done.filter(t => t.doneAt <= t.due).length / done.length) : null, done: done.length,
    intact: verifyChain(w).ok, blocks: w.chain.filter(e => e.who === rep).length,
  };
}

export function decideTransfer(w0, trId, actor, approveIt, why) {
  const w = clone(w0); const tr = (w.transfers ?? []).find(x => x.id === trId) ?? fail('Transfer not found.');
  if (tr.status !== 'pending') fail('This transfer is already decided.');
  if (!person(actor)?.manager) fail('Only a manager can decide transfers.');
  if (actor === tr.by) fail(`${actor} requested this transfer, so a different manager must decide it.`);
  if (!approveIt && !(why && why.trim())) fail('Say why it stays where it is.');
  const task = findTask(w, tr.taskId); delete task.transferPending;
  tr.status = approveIt ? 'approved' : 'rejected'; tr.decidedBy = actor; tr.note = (why ?? '').trim();
  if (approveIt) { task.rep = tr.to; note(w, task, actor, `${tr.id} approved: moved to ${label(tr.to)} outside the ${tr.bucket} bucket. Original target kept.`); }
  else note(w, task, actor, `${tr.id} rejected: stays with ${label(tr.from)}. ${tr.note}`);
  record(w, actor, `${approveIt ? 'Approved' : 'Rejected'} ${tr.id}: ${tr.customer} ${approveIt ? `now with ${tr.to}` : `stays with ${tr.from}`}${tr.note ? ` (${tr.note})` : ''}`, tr.id);
  return w;
}
export const transfersFor = (w, actor) => (w.transfers ?? []).filter(t => t.status === 'pending' && t.by !== actor && person(actor)?.manager);
