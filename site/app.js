import * as E from './engine.js';

const KEY = 'tentoday-product-v1';
const realToday = E.iso(new Date());
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const fmt = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const time = t => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

let w, actor = 'Rahul', panel = null, result = null, flashId = null;

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.w && s.w.today === realToday) { w = s.w; actor = s.actor || actor; return; } } catch { /* storage unavailable */ }
  w = E.sample(realToday);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ w, actor })); } catch { /* fine without */ } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600); }

/* Run an engine action. On success: save, toast, re-render. On failure: show the engine's own words. */
function act(fn, msg, after) {
  try { const out = fn(); w = out.w ?? out; save(); toast(msg); after?.(out); render(); return true; }
  catch (e) { if (panel) { panel.err = e.message; renderPanel(); } else { result = { err: e.message }; render(); } return false; }
}

const isRep = n => E.person(n).rep;
const tierChip = task => { const t = E.tier(w, task); return task.callbackAt ? `<span class="chip pin">${esc(task.callbackAt)} call</span>` : `<span class="chip p${t}">P${t}</span>`; };
const apvOf = task => w.approvals.find(a => a.id === task.approvalId);
const counters = rep => w.approvals.filter(a => a.status === 'countered' && a.rep === rep);

/* ---------- actor switch ---------- */
function renderActors() {
  $('#actors').innerHTML = E.PEOPLE.map(p => {
    const n = p.rep ? E.today(w, p.name).list.length + counters(p.name).length : E.decisionsFor(w, p.name).length;
    return `<button type="button" class="who ${p.name === actor ? 'on' : ''}" data-actor="${p.name}">${p.name} <small>${p.role}</small>${n ? `<span class="badge" title="${p.rep ? 'in Today' : 'waiting for a decision'}">${n}</span>` : ''}</button>`;
  }).join('');
}
function switchTo(n) { actor = n; result = null; panel = null; try { $('#panel').close(); } catch { } save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

/* ---------- do this next ---------- */
function renderNext() {
  const el = $('#next');
  if (result) {
    el.className = 'next' + (result.err ? '' : ' calm');
    el.innerHTML = result.err ? `<div><p class="k">Not allowed</p><p>${esc(result.err)}</p></div>` :
      `<div><p class="k">✓ Done</p><p>${esc(result.text)}</p>${result.sub ? `<p class="s">${esc(result.sub)}</p>` : ''}</div>${result.switchTo ? `<button class="btn pri" data-actor="${result.switchTo}" type="button">See it as ${esc(E.label(result.switchTo))} →</button>` : ''}`;
    return;
  }
  let k = 'Do this next', text, sub = '', btn = '', calm = false;
  if (isRep(actor)) {
    const c = counters(actor)[0];
    const q = E.today(w, actor);
    const quote = q.list.find(t => t.approvalId && apvOf(t)?.status === 'approved' && /revised quote/.test(t.title));
    if (c) { text = `${E.label(c.decidedBy)} offered ${c.capPct}% instead of ${c.askPct}% for ${c.customer}.`; sub = 'Accept it or decline it. Your task stays frozen until you answer.'; btn = `<button class="btn pri" data-open="${c.taskId}" data-tab="counter" type="button">Answer the counter-offer</button>`; }
    else if (quote) { text = `Approved: send ${quote.customer} the revised quote.`; sub = quote.title; btn = `<button class="btn pri" data-open="${quote.id}" type="button">Open it</button>`; }
    else if (q.list.length) { const t = q.list[0]; text = `Start with #1: ${t.customer}. ${t.title}.`; sub = `Why it's on top: ${E.explain(w, t)}`; btn = `<button class="btn pri" data-open="${t.id}" type="button">Open #1</button>`; }
    else { calm = true; k = 'All clear'; text = 'Nothing left in Today.'; sub = 'New tasks arrive when deals move or dates come round.'; }
  } else {
    const d = E.decisionsFor(w, actor);
    if (d.length) { text = `Decide ${d.length} discount ask${d.length > 1 ? 's' : ''}. The rep's task is frozen until you do.`; sub = `Oldest: ${d[0].customer}, ${d[0].askPct}% asked by ${d[0].rep}, waiting ${E.waitingDays(w, d[0])} day(s).`; btn = `<button class="btn pri" data-go="#asks" type="button">Review the ask</button>`; }
    else { const over = E.workload(w).filter(r => r.overCap); calm = !over.length; k = over.length ? 'Do this next' : 'All clear'; text = over.length ? `${over.map(r => r.rep).join(', ')} ha${over.length > 1 ? 've' : 's'} more than ${E.CAP} tasks due.` : 'No asks waiting for you.'; sub = over.length ? 'Move a task to someone with room. Approval tasks stay with the rep who asked.' : 'Team workload is below.'; if (over.length) btn = `<button class="btn pri" data-go="#team" type="button">Rebalance</button>`; }
  }
  el.className = 'next' + (calm ? ' calm' : '');
  el.innerHTML = `<div><p class="k">${k}</p><p><b>${esc(text)}</b></p>${sub ? `<p class="s">${esc(sub)}</p>` : ''}</div>${btn}`;
}

/* ---------- rep desk ---------- */
function repDesk() {
  const q = E.today(w, actor), ib = E.inbox(w, actor), m = E.metrics(w);
  const row = (t, i) => `<li><button type="button" class="task ${i === 0 ? 'top' : ''} ${flashId === t.id ? 'flash' : ''}" data-open="${t.id}"><span class="rank">${i + 1}</span><span><span class="c">${esc(t.customer)}</span> ${tierChip(t)}<span class="chip p3">${esc(t.stage)}</span><div class="t">${esc(t.title)}</div><div class="why">${esc(E.explain(w, t))}</div></span><span class="val">${inr(t.value)}</span></button></li>`;
  const mini = (arr, f, none) => arr.length ? `<ul class="mini">${arr.map(t => `<li><button type="button" data-open="${t.id}"><b>${esc(t.customer)}</b> · ${f(t)}</button></li>`).join('')}</ul>` : `<p class="empty">${none}</p>`;
  const frozenLine = t => { const a = apvOf(t); return a?.status === 'countered' ? `<span class="chip st-bad">Counter: ${a.capPct}%</span> your answer needed` : `<span class="chip st-frozen">Waiting</span> ${a ? `${E.label(a.approver)} · ${a.askPct}% asked` : ''}`; };
  return `<div class="grid">
    <div class="card"><h2>Today · ${q.list.length} of ${E.CAP}</h2><p class="sub">Ranked: past-target tier → money-blocking stage → days overdue → deal value (tie-break only). Click a task to act.</p>
      ${q.list.length ? `<ol class="list">${q.list.map(row).join('')}</ol>` : '<p class="empty">Nothing due. Well done.</p>'}
      ${q.waiting ? `<p class="more">+${q.waiting} more due, kept out so Today stays at ${E.CAP}. They move up as you finish these.</p>` : ''}
    </div>
    <div class="side">
      <div class="card"><h2>Waiting on others</h2>${mini(ib.frozen, frozenLine, 'No discount asks open.')}</div>
      <div class="card"><h2>On hold</h2>${mini(ib.hold, t => `back ${fmt(t.hold.revisit)} · ${esc(t.hold.reason)}`, 'Nothing on hold.')}</div>
      <div class="card"><h2>Coming up</h2>${mini(ib.later, t => `${fmt(t.target)} · ${esc(t.title)}`, 'Nothing scheduled.')}</div>
      <div class="card"><h2>Done</h2>${mini(ib.done, t => `${esc(t.outcome)} ${t.doneAt <= t.due ? '<span class="chip st-ok">on time</span>' : '<span class="chip st-bad">late</span>'}`, 'Nothing done yet today.')}</div>
      <div class="card"><h2>Team metric</h2><div class="metric"><div><b>${m.pct === null ? '–' : m.pct + '%'}</b><span>done by the original target (${m.onTime}/${m.done})</span></div><div><b>${m.movedThrice}</b><span>tasks moved 3+ times (guardrail)</span></div></div></div>
    </div></div>`;
}

/* ---------- approver desk ---------- */
function askCard(a) {
  const lim = E.person(actor).senior ? a.askPct : Math.min(a.askPct, E.MANAGER_LIMIT, a.marginFloorPct);
  const exp = E.addDays(w.today, 14);
  return `<div class="ask ${flashId === a.id ? 'flash' : ''}" id="ask-${a.id}">
    <div class="top"><h3>${esc(a.customer)} · ${a.askPct}% asked</h3><span class="chip ${E.waitingDays(w, a) >= 1 ? 'st-bad' : 'p3'}">waiting ${E.waitingDays(w, a)} day(s)</span></div>
    <p class="hint">${a.id} · asked by ${esc(E.label(a.rep))}: “${esc(a.reason)}”</p>
    <div class="facts"><div><span>Deal value</span><b>${inr(a.value)}</b></div><div><span>Margin floor</span><b>max ${a.marginFloorPct}%</b></div><div class="${a.overdueDays >= E.OVERDUE_BLOCK_DAYS ? 'bad' : ''}"><span>Customer overdue</span><b>${a.overdueAmt ? `${inr(a.overdueAmt)} · ${a.overdueDays}d` : 'None'}</b></div></div>
    ${a.routedBecause.length ? `<p class="route">Sent to the sales head because: ${esc(a.routedBecause.join(', '))}.</p>` : ''}
    <div class="row">
      <label>Approve up to (%)<input type="number" step="0.5" min="0.5" max="${a.askPct}" value="${lim}" data-f="cap" style="width:90px"></label>
      <label>Valid to<input type="date" min="${E.addDays(w.today, 1)}" value="${exp}" data-f="exp"></label>
      <button type="button" class="btn ok" data-dec="approve" data-id="${a.id}">Approve</button>
    </div>
    <div class="row">
      <label style="flex:1">Note (needed to counter or send back)<input data-f="why" maxlength="160" placeholder="e.g. Margin too thin; attach the competitor quote"></label>
      <button type="button" class="btn" data-dec="counter" data-id="${a.id}">Counter at the % above</button>
      <button type="button" class="btn" data-dec="back" data-id="${a.id}">Send back</button>
    </div>
    ${!E.person(actor).senior ? `<p class="hint">Your limit: up to ${E.MANAGER_LIMIT}% and within the margin floor. Anything else goes to Arjun.</p>` : ''}
  </div>`;
}
function managerDesk() {
  const d = E.decisionsFor(w, actor);
  const others = w.approvals.filter(a => a.status === 'pending' && a.approver !== actor);
  const decided = w.approvals.filter(a => a.status !== 'pending').slice().reverse();
  const wl = E.workload(w);
  const opts = w.tasks.filter(t => t.status === 'open' && t.target <= w.today && !w.approvals.some(a => a.id === t.approvalId && a.status === 'approved'));
  const statusChip = a => ({ approved: `<span class="chip st-ok">Approved ${a.capPct}% to ${fmt(a.validTo)}</span>`, countered: `<span class="chip st-frozen">Countered ${a.capPct}%</span>`, sent_back: '<span class="chip st-bad">Sent back</span>', declined: '<span class="chip st-hold">Counter declined</span>' }[a.status] ?? '');
  return `<div class="grid">
    <div class="side">
      <div class="card" id="asks"><h2>Discount asks for you · ${d.length}</h2><p class="sub">Each shows the three numbers you need: the ask, the margin floor and what the customer already owes.</p>
        ${d.length ? d.map(askCard).join('') : '<p class="empty">Nothing waiting for you.</p>'}
        ${others.length ? `<p class="more">${others.length} other ask(s) waiting for ${others.map(a => esc(E.label(a.approver))).join(', ')}.</p>` : ''}
      </div>
      <div class="card"><h2>Decided</h2>${decided.length ? `<ul class="mini">${decided.map(a => `<li><b>${esc(a.customer)}</b> · ${a.askPct}% asked by ${esc(a.rep)} · ${statusChip(a)} <small>by ${esc(a.decidedBy ?? '')}</small>${a.status === 'approved' ? `<br><a class="hint" href="https://every-rupee-gets-owner.lovable.app/demo" target="_blank" rel="noopener">${a.id}: finance checks short payments against this cap in Every Rupee ↗</a>` : ''}</li>`).join('')}</ul>` : '<p class="empty">No decisions yet.</p>'}</div>
    </div>
    <div class="side">
      <div class="card" id="team"><h2>Team workload</h2><p class="sub">Who has more than ${E.CAP} due. No productivity scores.</p>
        <table><thead><tr><th>Rep</th><th>Due now</th><th>P1</th><th>Waiting on approval</th></tr></thead><tbody>${wl.map(r => `<tr><td>${esc(E.label(r.rep))}</td><td class="${r.overCap ? 'over' : ''}">${r.actionable}${r.overCap ? ` (${r.overCap} over)` : ''}</td><td>${r.p1}</td><td>${r.frozen}</td></tr>`).join('')}</tbody></table>
        <div class="box" style="margin-top:12px"><b>Move a task</b>
          <div class="row"><label style="flex:1">Task<select id="mv-task">${opts.map(t => `<option value="${t.id}">${esc(t.rep)} · ${esc(t.customer)} · P${E.tier(w, t)}</option>`).join('')}</select></label>
          <label>To<select id="mv-to">${wl.slice().sort((x, y) => x.actionable - y.actionable).map(r => `<option>${r.rep}</option>`).join('')}</select></label></div>
          <div id="mv-confirm"><button type="button" class="btn" id="mv-ask">Move…</button></div>
          <p class="hint">Original target is kept, so a moved task doesn't look newer. Tasks waiting on a discount can't be moved.</p>
        </div>
      </div>
      <div class="card"><h2>Activity</h2>${w.audit.length ? `<ul class="hist">${w.audit.slice(-8).reverse().map(l => `<li><small>${time(l.at)} · ${esc(E.label(l.who))}</small>${esc(l.text)}</li>`).join('')}</ul>` : '<p class="empty">No activity yet.</p>'}</div>
    </div></div>`;
}

/* ---------- task panel ---------- */
function openTask(id, tab) { panel = { id, tab: tab ?? null, err: '', done: null }; renderPanel(); const d = $('#panel'); if (!d.open) d.showModal(); }
function renderPanel() {
  if (!panel) return;
  const t = w.tasks.find(x => x.id === panel.id); const a = apvOf(t);
  const mine = t.rep === actor;
  const tabs = [];
  if (mine && t.status === 'open') tabs.push(['done', '✓ Done'], ['move', 'Reschedule'], ['hold', 'On hold']);
  if (mine && t.status === 'open' && ['Quote sent', 'Negotiation'].includes(t.stage)) tabs.push(['ask', 'Ask discount']);
  if (mine && a?.status === 'countered') tabs.unshift(['counter', 'Answer counter']);
  if (!panel.tab || !tabs.some(x => x[0] === panel.tab)) panel.tab = tabs[0]?.[0] ?? null;
  const tomorrow = E.addDays(w.today, 1);
  const forms = {
    done: `<label>What happened? (one line)<input id="f-out" maxlength="160" placeholder="e.g. Spoke to owner; sending the quote today"></label><label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="f-moved" ${t.stage !== 'Order placed' ? '' : 'disabled'}> The deal moved to the next stage${E.STAGES[E.STAGES.indexOf(t.stage) + 1] ? ` (${E.STAGES[E.STAGES.indexOf(t.stage) + 1]})` : ''}: create the next task</label><button class="btn pri" data-do="done" type="button">Mark done</button>`,
    move: `<div class="row"><label>New date<input type="date" id="f-date" min="${tomorrow}" value="${tomorrow}"></label><label style="flex:1">${t.reschedules.length ? 'What is blocking it? (required)' : 'Blocker (optional the first time)'}<input id="f-block" maxlength="120"></label></div><p class="hint">It keeps ageing from the original target (${fmt(t.due)}) wherever you move it.</p><button class="btn pri" data-do="move" type="button">Reschedule</button>`,
    hold: `<div class="row"><label style="flex:1">Why on hold?<input id="f-why" maxlength="120" placeholder="e.g. Customer budget frozen till month end"></label><label>Revisit on<input type="date" id="f-rev" min="${tomorrow}" value="${E.addDays(w.today, 7)}"></label></div><p class="hint">It comes back into Today by itself on the revisit date.</p><button class="btn pri" data-do="hold" type="button">Put on hold</button>`,
    ask: `<div class="row"><label>Discount (%)<input type="number" id="f-pct" min="0.5" max="30" step="0.5" value="8" style="width:100px"></label><label style="flex:1">Why does the customer need it?<input id="f-reason" maxlength="160" placeholder="e.g. Competitor quoted 9% lower"></label></div><p class="route" id="f-route"></p><p class="hint">Asking freezes this task until the approver decides. The clock moves to them.</p><button class="btn pri" data-do="ask" type="button">Send the ask</button>`,
    counter: a?.status === 'countered' ? `<p>${esc(E.label(a.decidedBy))} offered <b>${a.capPct}%</b> instead of ${a.askPct}%, valid to ${fmt(a.validTo)}. “${esc(a.counterWhy)}”</p><div class="row"><button class="btn pri" data-do="accept" type="button">Accept ${a.capPct}%</button><button class="btn" data-do="decline" type="button">Decline</button></div>` : '',
  };
  let state = '';
  if (t.status === 'frozen' && a?.status === 'pending') state = `<div class="wait">Frozen: waiting for <b>${esc(E.label(a.approver))}</b> to decide ${a.askPct}% (${a.id}).${a.routedBecause.length ? ` Sent to the sales head because ${esc(a.routedBecause.join(', '))}.` : ''} <button class="btn link" data-actor="${a.approver}" type="button">See it as ${esc(a.approver)} →</button></div>`;
  if (t.status === 'hold') state = `<div class="wait">On hold: ${esc(t.hold.reason)}. Back in Today on ${fmt(t.hold.revisit)}. ${mine ? '<button class="btn link" data-do="resume" type="button">Take it off hold now</button>' : ''}</div>`;
  if (t.status === 'done') state = `<div class="done">Done: ${esc(t.outcome)}</div>`;
  if (!mine && t.status === 'open') state = `<div class="wait">This is ${esc(E.label(t.rep))}'s task. <button class="btn link" data-actor="${t.rep}" type="button">See it as ${esc(t.rep)} →</button></div>`;
  $('#panel-body').innerHTML = `
    <div class="ph"><div><h2 id="p-title" style="margin:0">${esc(t.customer)}</h2><p class="hint">${t.id} · ${esc(t.stage)} · ${inr(t.value)} · ${esc(E.label(t.rep))}</p></div><button class="x" data-close aria-label="Close" type="button">×</button></div>
    <p style="margin:0"><b>${esc(t.title)}</b></p>
    ${t.status === 'open' ? `<p class="hint">Why it's here: ${esc(E.explain(w, t))}</p>` : ''}
    ${panel.done ? `<div class="done">${panel.done}</div>` : ''}
    ${state}
    ${panel.err ? `<div class="err" role="alert">${esc(panel.err)}</div>` : ''}
    ${panel.tab && !panel.done ? `<div class="tabs">${tabs.map(([k, l]) => `<button type="button" class="${k === panel.tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="box">${forms[panel.tab]}</div>` : ''}
    <div><b style="font-size:.85rem">History</b>${t.log.length ? `<ul class="hist" style="margin-top:6px">${t.log.slice().reverse().map(l => `<li><small>${time(l.at)} · ${esc(E.label(l.who))}</small>${esc(l.text)}</li>`).join('')}</ul>` : '<p class="empty">No actions yet.</p>'}</div>`;
  if (panel.tab === 'ask') routePreview();
}
function routePreview() {
  const t = w.tasks.find(x => x.id === panel.id); const pct = Number($('#f-pct')?.value || 0); const el = $('#f-route'); if (!el) return;
  const r = E.approverFor(w, t.customer, pct);
  el.textContent = `Goes to ${E.label(r.approver)}${r.why.length ? ` because: ${r.why.join(', ')}` : ` (within ${E.MANAGER_LIMIT}% and the margin floor)`}.`;
}
function panelAction(kind) {
  const t = w.tasks.find(x => x.id === panel.id); const v = s => $(s)?.value ?? '';
  panel.err = '';
  const ok = html => { panel.done = html; flashId = t.id; };
  if (kind === 'done') act(() => E.complete(w, t.id, actor, v('#f-out'), $('#f-moved')?.checked), 'Marked done.', out => ok(out.next ? `✓ Done. The deal moved to <b>${esc(out.next.stage)}</b>, so the next task was created: ${esc(out.next.title)} (due ${fmt(out.next.due)}).<div class="row"><button class="btn" data-open="${out.next.id}" type="button">Open the new task</button><button class="btn pri" data-close type="button">Back to Today</button></div>` : `✓ Done and logged.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'move') act(() => E.reschedule(w, t.id, actor, v('#f-date'), v('#f-block')), 'Rescheduled.', () => ok(`✓ Moved to ${fmt(v('#f-date'))}. It's in “Coming up” and still ages from ${fmt(t.due)}.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'hold') act(() => E.putOnHold(w, t.id, actor, v('#f-why'), v('#f-rev')), 'On hold.', () => ok(`✓ On hold until ${fmt(v('#f-rev'))}. It returns to Today by itself then.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'resume') act(() => E.resume(w, t.id, actor), 'Back in Today.', () => ok('✓ Back in Today.'));
  if (kind === 'ask') act(() => E.askDiscount(w, t.id, actor, Number(v('#f-pct')), v('#f-reason')), 'Ask sent.', out => { const a = out.approvals.at(-1); ok(`✓ Sent ${a.id} to <b>${esc(E.label(a.approver))}</b>. This task is frozen until they decide, so it has left your Today.<div class="row"><button class="btn pri" data-actor="${a.approver}" type="button">See it as ${esc(a.approver)} →</button><button class="btn" data-close type="button">Back to Today</button></div>`); });
  if (kind === 'accept' || kind === 'decline') { const a = apvOf(t); act(() => E.respondCounter(w, a.id, actor, kind === 'accept'), kind === 'accept' ? 'Counter accepted.' : 'Counter declined.', () => ok(kind === 'accept' ? `✓ Accepted ${a.capPct}%. The task is back in Today: send the revised quote.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>` : '✓ Declined. The task is back in Today to negotiate without a discount.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>')); }
}
function decide(kind, id) {
  const card = $(`#ask-${CSS.escape(id)}`); const f = n => card.querySelector(`[data-f="${n}"]`).value;
  const a = w.approvals.find(x => x.id === id);
  const run = { approve: () => E.approve(w, id, actor, Number(f('cap')), f('exp')), counter: () => E.counter(w, id, actor, Number(f('cap')), f('exp'), f('why')), back: () => E.sendBack(w, id, actor, f('why')) }[kind];
  const text = { approve: `Approved ${f('cap')}% for ${a.customer}, valid to ${fmt(f('exp'))}.`, counter: `Offered ${f('cap')}% to ${a.rep} for ${a.customer}.`, back: `Sent ${a.customer}'s ask back to ${a.rep}.` }[kind];
  const sub = { approve: `${a.rep}'s task is unfrozen and back in Today as “send the revised quote”.`, counter: `${a.rep} must accept or decline. Their task stays frozen until then.`, back: `${a.rep}'s task is back in Today with your note, so they can fix it and ask again.` }[kind];
  try { w = run(); save(); toast(text); result = { text, sub, switchTo: a.rep }; flashId = a.taskId; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch (e) { let el = card.querySelector('.err'); if (!el) { el = document.createElement('div'); el.className = 'err'; el.setAttribute('role', 'alert'); card.prepend(el); } el.textContent = e.message; }
}

function render() {
  renderActors(); renderNext();
  $('#desk').innerHTML = isRep(actor) ? repDesk() : managerDesk();
  if (panel && $('#panel').open) renderPanel();
  flashId = null;
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('button,[data-open]'); if (!b) return;
  if (b.dataset.actor) return switchTo(b.dataset.actor);
  if (b.dataset.open) return openTask(b.dataset.open, b.dataset.tab);
  if (b.hasAttribute('data-close')) { panel = null; $('#panel').close(); return; }
  if (b.dataset.tab && panel) { panel.tab = b.dataset.tab; panel.err = ''; return renderPanel(); }
  if (b.dataset.do) return panelAction(b.dataset.do);
  if (b.dataset.dec) return decide(b.dataset.dec, b.dataset.id);
  if (b.dataset.go) { document.querySelector(b.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (b.id === 'reset') { w = E.sample(realToday); actor = 'Rahul'; result = null; panel = null; save(); render(); toast('Sample reset.'); return; }
  if (b.id === 'mv-ask') { const t = w.tasks.find(x => x.id === $('#mv-task').value); const to = $('#mv-to').value; $('#mv-confirm').innerHTML = `<p class="hint" style="margin-bottom:6px">Move <b>${esc(t.customer)}</b> from ${esc(t.rep)} to ${esc(to)}?</p><div class="row"><button type="button" class="btn pri" id="mv-yes" data-t="${t.id}" data-to="${to}">Yes, move it</button><button type="button" class="btn" id="mv-no">Cancel</button></div>`; return; }
  if (b.id === 'mv-no') return render();
  if (b.id === 'mv-yes') { try { w = E.rebalance(w, b.dataset.t, actor, b.dataset.to); save(); const t = w.tasks.find(x => x.id === b.dataset.t); toast('Task moved.'); result = { text: `Moved ${t.customer} to ${E.label(t.rep)}.`, sub: 'The original target is kept, so it keeps its place in their ranking.', switchTo: t.rep }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { $('#mv-confirm').innerHTML = `<div class="err" role="alert">${esc(err.message)}</div><button type="button" class="btn" id="mv-no" style="margin-top:6px">OK</button>`; } }
});
document.addEventListener('input', e => { if (e.target.id === 'f-pct') routePreview(); });
$('#panel').addEventListener('close', () => { panel = null; });

load(); w = E.wakeHolds(w); render();
