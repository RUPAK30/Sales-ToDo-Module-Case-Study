import * as E from './engine.js?v=1794245868';

const KEY = 'tentoday-product-v3';
const fits = x => x && Array.isArray(x.chain) && Array.isArray(x.orders) && Array.isArray(x.delegations) && Array.isArray(x.lost) && Array.isArray(x.schemes) && x.seq && x.seq.ord;
const realToday = E.iso(new Date());
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const fmt = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const time = t => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

let sealEdit = 0, signedIn = false; let w, actor = 'Rahul', panel = null, result = null, flashId = null, sealRes = null, sealOpen = false;

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && fits(s.w) && s.w.today === realToday) { w = s.w; actor = s.actor || actor; signedIn = !!s.signedIn; return; } } catch { /* storage unavailable */ }
  w = E.sample(realToday);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ w, actor, signedIn })); } catch { /* fine without */ } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600); }

/* Run an engine action. On success: save, toast, re-render. On failure: show the engine's own words. */
function act(fn, msg, after) {
  try { const out = fn(); w = out.w ?? out; sealRes = null; save(); toast(msg); after?.(out); render(); return true; }
  catch (e) { if (panel) { panel.err = e.message; renderPanel(); } else { result = { err: e.message }; render(); } return false; }
}

const isRep = n => E.person(n).rep;
const tierChip = task => { const t = E.tier(w, task); return task.callbackAt ? `<span class="chip pin">${esc(task.callbackAt)} call</span>` : `<span class="chip p${t}">P${t}</span>`; };
const apvOf = task => w.approvals.find(a => a.id === task.approvalId);
const counters = rep => w.approvals.filter(a => a.status === 'countered' && a.rep === rep);

/* ---------- actor switch ---------- */
function renderActors() {
  const p = E.person(actor);
  $('#actors').innerHTML = signedIn ? `<span class="who on">${esc(actor)} <small>${esc(p.role)}${p.buckets ? ` · ${esc(p.buckets.join(', '))}` : ''}</small></span><button type="button" class="btn link" id="signout">Sign out</button>` : '';
  document.querySelector('.actor > span').textContent = signedIn ? 'Signed in as' : '';
  document.querySelector('.actor').hidden = !signedIn;
}
function renderSignIn() {
  const badge = n => { const p = E.person(n); return p.rep ? E.today(w, n).list.length + counters(n).length : E.decisionsFor(w, n).length + E.transfersFor(w, n).length; };
  $('#desk').innerHTML = `<section class="signin card"><h2>Sign in</h2><p class="sub">Demo accounts: no passwords, and your data stays in this browser. In the real product each person signs in with their company account and sees only their own desk. Nobody can switch to someone else's view.</p>
    <div class="accts">${E.PEOPLE.map(p => `<button type="button" class="acct" data-signin="${p.name}"><b>${p.name}</b><span>${esc(p.role)}${p.buckets ? ` · ${esc(p.buckets.join(', '))}` : ''}</span>${badge(p.name) ? `<i>${badge(p.name)} ${p.rep ? 'today' : 'to decide'}</i>` : ''}</button>`).join('')}</div>
    <p class="hint" style="margin-top:10px">New here? Press <b>▶ 60-second tour</b>: it starts with the rep's queue, then the manager's decision, then the sealed record.</p></section>`;
  $('#seal').hidden = true; $('#next').hidden = true;
}
function switchTo(n) { actor = n; signedIn = true; result = null; panel = null; sealRes = null; sealEdit = 0; try { $('#panel').close(); } catch { } save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

/* ---------- sealed record: visible on every screen ---------- */
function renderSeal() {
  const el = $('#seal'); const n = w.chain.length; const r = sealRes;
  const st = e => !r ? '' : r.ok ? 'ok' : e.n < r.brokenAt ? 'ok' : e.n === r.brokenAt ? 'bad' : 'after';
  const tag = e => ({ ok: '✓ matches', bad: '✗ edited', after: '⚠ link broken' }[st(e)] ?? '');
  const blocks = w.chain.map((e, k) => `${k ? `<span class="link ${r && !r.ok && e.n >= r.brokenAt ? 'cut' : ''}" aria-hidden="true">→</span>` : ''}<div class="blk ${st(e)}"><small>#${e.n} · ${esc(e.who)}</small><span class="tx">${esc(e.text.length > 64 ? e.text.slice(0, 62) + '…' : e.text)}</span><code title="${esc(e.hash)}">${esc(e.hash.slice(0, 8))}</code><em>${e.n === 1 ? 'first block' : `built from #${e.n - 1}'s <code>${esc(e.prev.slice(0, 6))}</code>`}</em>${st(e) === 'bad' && w.tampered?.n === e.n ? `<em>sealed as: <s>${esc((w.tampered.original.match(/\d+(\.\d+)?%/) || [''])[0])}</s> → now ${esc((e.text.match(/\d+(\.\d+)?%/) || [''])[0])}</em>` : ''}${tag(e) ? `<b>${tag(e)}</b>` : ''}</div>`).join('');
  const status = !r ? `<div class="res idle">Not checked in this view yet. Press <b>Verify record</b> to recompute every fingerprint.</div>`
    : r.ok ? `<div class="res ok">✓ Checked just now as ${esc(E.label(actor))}: all ${r.count} fingerprints recomputed and match. Nothing was changed.</div>`
    : `<div class="res no">✗ Block #${r.brokenAt} was edited after it was recorded: recomputing its fingerprint gives a different value from the one sealed.${n - r.brokenAt ? ` Blocks #${r.brokenAt + 1}–#${n} were built on the original, so they can't be trusted either.` : ''}</div>`;
  el.className = 'seal' + (r && !r.ok ? ' bad' : '');
  el.innerHTML = `<div class="top"><div><b class="t">🔒 Sealed approval record</b> <span class="hint">· one record for the whole team · ${n} block${n === 1 ? '' : 's'}</span></div>
    <div class="acts"><button class="btn ok" type="button" data-seal="verify">Verify record</button><button class="btn" type="button" data-seal="${w.tampered ? 'undo' : 'tamper'}">${w.tampered ? 'Undo the edit' : 'Try tampering yourself'}</button></div></div>
    <div class="cv" id="cv">${blocks || '<p class="hint">Nothing recorded yet.</p>'}</div>
    ${sealEdit ? (() => { const e = w.chain[sealEdit - 1]; return `<div class="dbx"><p class="k">⚠ Outside the app · raw database row</p><p class="hint" style="margin:0 0 6px;color:#D6D3D1">The app has no edit button for this record. An insider with database access could change a stored row directly, like this. No new fingerprint is made, because that only happens when a decision goes through the app.</p>
      <div class="row"><label>Block<select id="db-n">${w.chain.map(x => `<option value="${x.n}" ${x.n === sealEdit ? 'selected' : ''}>#${x.n} · ${esc(x.who)}</option>`).join('')}</select></label></div>
      <label style="margin-top:6px">text<textarea id="db-text" rows="2">${esc(e.text)}</textarea></label>
      <p class="mono" style="margin:4px 0 0;font-size:.72rem;color:#A8A29E">who: ${esc(e.who)} · at: ${esc(e.at)} · stored fingerprint: ${esc(e.hash.slice(0, 16))}…</p>
      <div class="row" style="margin-top:8px"><button class="btn pri" type="button" data-seal="dbsave">Save to database</button><button class="btn" type="button" data-seal="dbcancel" style="background:transparent;color:#fff;border-color:#57534E">Cancel</button></div><div id="db-err"></div></div>`; })() : ''}
    ${status}
    <details class="how"><summary>How it works, in 3 steps</summary><ol class="steps"><li><b>Fingerprint.</b> Each decision (ask, approval, counter, hand-over, order) gets a SHA-256 fingerprint of its exact words, time and person.</li><li><b>Chain.</b> Each fingerprint is built from the previous one too, so blocks are linked like the arrows above.</li><li><b>Verify.</b> Recomputing every fingerprint shows instantly if any block was edited, deleted, reordered or backdated, and which one.</li></ol><p class="hint" style="margin:6px 0 0">It proves the record wasn't altered after the fact. It doesn't prove a decision was right. Not a blockchain: one company keeps it. Approvals sent to Every Rupee carry their fingerprint, so finance can tell if the link was edited.</p></details>`;
  const cv = $('#cv'); if (cv) cv.scrollLeft = r && !r.ok ? Math.max(0, cv.querySelector('.blk.bad')?.offsetLeft - 20) : cv.scrollWidth;
}

/* Manager tools: secondary sections live in one centred tabbed panel, one at a time. */
let toolTab = 'movebox', toolChosen = false;
const TOOLS = [['movebox', 'Move a task'], ['leave', 'Leave'], ['eff', 'Discount wins'], ['schemes', 'Schemes'], ['turn', 'Turnaround'], ['data', 'Your data'], ['act', 'Activity']];
function moveFit() {
  const el = $('#mv-fit'); const t = w.tasks.find(x => x.id === $('#mv-task')?.value); const to = $('#mv-to')?.value; if (!el || !t || !to) return;
  const bk = E.bucketOf(w, t.customer); const ok = E.owns(to, bk);
  el.innerHTML = to === t.rep ? `It's already ${esc(to)}'s.` : ok ? `<b style="color:var(--ok)">✓ Same bucket:</b> ${esc(t.customer)} is ${bk === 'FMCG' ? 'an' : 'a'} ${bk} dealer and ${esc(to)} handles ${bk}. It moves directly.` : `<b style="color:var(--bad)">✗ Wrong bucket:</b> ${esc(t.customer)} is ${bk === 'FMCG' ? 'an' : 'a'} ${bk} dealer, but ${esc(to)} handles ${esc(E.person(to).buckets.join(', '))}. Needs a reason and a second manager's approval.`;
  const btn = $('#mv-ask'); if (btn) btn.textContent = ok ? 'Move…' : 'Request transfer…';
}
function buildTools() {
  const desk = $('#desk'); const have = TOOLS.filter(([id]) => desk.querySelector('#' + id)); if (!have.length) return;
  if (!have.some(([id]) => id === toolTab)) toolTab = have[0][0];
  const closed = !toolChosen && matchMedia('(max-width:600px)').matches;
  const wrap = document.createElement('section'); wrap.className = 'tools card'; wrap.setAttribute('aria-label', 'Manager tools');
  wrap.innerHTML = `<div class="ttabs" role="tablist">${have.map(([id, l]) => `<button type="button" role="tab" aria-selected="${!closed && id === toolTab}" class="${!closed && id === toolTab ? 'on' : ''}" data-tool="${id}">${l}</button>`).join('')}</div><div class="tbody"></div>`;
  const body = wrap.querySelector('.tbody');
  for (const [id] of have) { const el = desk.querySelector('#' + id); el.classList.add('tool'); el.hidden = closed || id !== toolTab; body.append(el); }
  desk.querySelectorAll('.side').forEach(sd => { if (!sd.children.length) sd.remove(); });
  desk.append(wrap);
}

/* Mobile: secondary cards collapse to their heading; tap to open. */
const openCards = new Set();
function collapseForMobile() {
  if (!matchMedia('(max-width:600px)').matches) return;
  document.querySelectorAll('#desk .card:not(.tool):not(.tools)').forEach((c, k) => {
    const h = c.querySelector('h2'); if (!h) return; const key = h.textContent.replace(/[\d·]+/g, '').trim();
    if (k === 0 || c.id === 'asks') return; // the main list always stays open
    c.classList.add('fold'); if (!openCards.has(key)) c.classList.add('cl');
    h.setAttribute('role', 'button'); h.tabIndex = 0;
    h.onclick = () => { c.classList.toggle('cl'); c.classList.contains('cl') ? openCards.delete(key) : openCards.add(key); };
  });
}

/* ---------- do this next ---------- */
function renderNext() {
  const el = $('#next');
  if (result) {
    el.className = 'next' + (result.err ? '' : ' calm');
    el.innerHTML = result.err ? `<div><p class="k">Not allowed</p><p>${esc(result.err)}</p></div>` :
      `<div><p class="k">✓ Done</p><p>${esc(result.text)}</p>${result.sub ? `<p class="s">${esc(result.sub)}</p>` : ''}</div>${result.switchTo ? `<button class="btn pri" data-actor="${result.switchTo}" type="button">Sign in as ${esc(E.label(result.switchTo))} →</button>` : ''}`;
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
    const d = E.decisionsFor(w, actor); const tq = E.transfersFor(w, actor);
    if (!d.length && tq.length) { el.className = 'next'; el.innerHTML = `<div><p class="k">Do this next</p><p><b>Decide ${tq.length} transfer request${tq.length > 1 ? 's' : ''} outside a rep's bucket.</b></p><p class="s">${esc(tq[0].customer)} (${esc(tq[0].bucket)}) from ${esc(tq[0].from)} to ${esc(tq[0].to)}, requested by ${esc(tq[0].by)}: “${esc(tq[0].reason)}”</p></div><button class="btn pri" data-tool="movebox" type="button">Review it</button>`; return; }
    if (d.length) { text = `Decide ${d.length} discount ask${d.length > 1 ? 's' : ''}. The rep's task is frozen until you do.`; sub = `Oldest: ${d[0].customer}, ${d[0].askPct}% asked by ${d[0].rep}, waiting ${E.waitingDays(w, d[0])} day(s).${tq.length ? ` Then ${tq.length} transfer request${tq.length > 1 ? 's' : ''} in Manager tools → Move a task.` : ''}`; btn = `<button class="btn pri" data-go="#asks" type="button">Review the ask</button>`; }
    else { const over = E.workload(w).filter(r => r.overCap); calm = !over.length; k = over.length ? 'Do this next' : 'All clear'; text = over.length ? `${over.map(r => r.rep).join(', ')} ha${over.length > 1 ? 've' : 's'} more than ${E.CAP} tasks due.` : 'No asks waiting for you.'; sub = over.length ? 'Move a task to someone with room. Approval tasks stay with the rep who asked.' : 'Team workload is below.'; if (over.length) btn = `<button class="btn pri" data-tool="movebox" type="button">Rebalance</button>`; }
  }
  el.className = 'next' + (calm ? ' calm' : '');
  el.innerHTML = `<div><p class="k">${k}</p><p><b>${esc(text)}</b></p>${sub ? `<p class="s">${esc(sub)}</p>` : ''}</div>${btn}`;
}

/* ---------- rep desk ---------- */
function repDesk() {
  const q = E.today(w, actor), ib = E.inbox(w, actor), m = E.metrics(w);
  const r = E.repSnapshot(w, actor);
  const snap = `<section class="snap" aria-label="My snapshot"><p class="k">My snapshot · only your work, not compared with anyone</p><div class="tiles">
    <div class="${r.toAnswer ? 'warn' : ''}"><span>Asks with approvers</span><b>${r.waiting}</b><small>${r.toAnswer ? `${r.toAnswer} counter-offer waiting for your answer` : 'the clock is on them, not you'}</small></div>
    <div class="${r.expiring ? 'warn' : ''}"><span>Approved, not yet booked</span><b>${r.approvedOpen}</b><small>${r.expiring ? `${r.expiring} expiring within 3 days: book or re-ask` : 'book the order before the approval expires'}</small></div>
    <div><span>Orders booked</span><b>${r.orders}</b><small>${inr(r.booked)} · every one within its approval</small></div>
    <div><span>Done by the original date</span><b>${r.onTime === null ? '–' : r.onTime + '%'}</b><small>${r.done} task${r.done === 1 ? '' : 's'} done · moving a date doesn't reset it</small></div>
    <div class="${r.intact ? 'good' : 'bad'}"><span>Approval record</span><b>${r.intact ? '✓ Intact' : '✗ Altered'}</b><small>${r.blocks} of your decisions sealed · <a href="#seal">verify</a></small></div>
  </div></section>`;
  const row = (t, i) => `<li><button type="button" class="task ${i === 0 ? 'top' : ''} ${flashId === t.id ? 'flash' : ''}" data-open="${t.id}"><span class="rank">${i + 1}</span><span><span class="c">${esc(t.customer)}</span> ${tierChip(t)}<span class="chip p3">${esc(t.stage)}</span><div class="t">${esc(t.title)}</div><div class="why">${esc(E.explain(w, t))}</div></span><span class="val">${inr(t.value)}</span></button></li>`;
  const mini = (arr, f, none) => arr.length ? `<ul class="mini">${arr.map(t => `<li><button type="button" data-open="${t.id}"><b>${esc(t.customer)}</b> · ${f(t)}</button></li>`).join('')}</ul>` : `<p class="empty">${none}</p>`;
  const frozenLine = t => { const a = apvOf(t); return a?.status === 'countered' ? `<span class="chip st-bad">Counter: ${a.capPct}%</span> your answer needed` : `<span class="chip st-frozen">Waiting</span> ${a ? `${E.label(a.approver)} · ${a.askPct}% asked` : ''}`; };
  return `${snap}<div class="grid">
    <div class="card"><h2>Today · ${q.list.length} of ${E.CAP}</h2><p class="sub">Ranked: past-target tier → money-blocking stage → days overdue → deal value (tie-break only). A callback pinned at the customer's time sits above the tiers.</p>
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
    <div class="top"><h3>${esc(a.customer)} · ${a.askPct}% asked ${a.escalated ? '<span class="chip st-bad">Escalated</span>' : ''}</h3><span class="chip ${E.waitingDays(w, a) >= 1 ? 'st-bad' : 'p3'}">waiting ${E.waitingDays(w, a)} day(s)</span></div>
    <p class="hint">${a.id} · asked by ${esc(E.label(a.rep))}: “${esc(a.reason)}”</p>
    <div class="facts"><div><span>Deal value</span><b>${inr(a.value)}</b></div><div><span>Margin floor</span><b>max ${a.marginFloorPct}%</b></div><div class="${a.routedBecause.some(r => r.startsWith('credit hold')) ? 'bad' : ''}"><span>Dealer credit</span><b>${inr(a.outstanding)} of ${inr(a.creditLimit)}</b><span>oldest bill ${a.oldestBillDays}d · allowed ${a.creditDays}d</span></div></div>
    <p class="hint">Ask: ${a.askPct}% before GST = <b>${inr(a.amount)}</b> off ${inr(a.value)}.</p>
    ${a.routedBecause.length ? `<p class="route">Sent to the sales head because: ${esc(a.routedBecause.join(', '))}.</p>` : ''}
    <div class="row">
      <label>Approve up to (%)<input type="number" step="0.5" min="0.5" max="${a.askPct}" value="${lim}" data-f="cap" style="width:90px"></label>
      <label>Valid to<input type="date" min="${E.addDays(w.today, 1)}" value="${exp}" data-f="exp"></label>
      <button type="button" class="btn ok" data-dec="approve" data-id="${a.id}">Approve</button>
    </div>
    <div class="row">
      <label style="flex:1">${a.routedBecause.some(r => r.startsWith('credit hold')) ? 'Override reason (required to approve a dealer on credit hold)' : 'Note (needed to counter or send back)'}<input data-f="why" maxlength="160" placeholder="e.g. Margin too thin; attach the competitor quote"></label>
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
  const im = E.impact(w);
  const snap = `<section class="snap" aria-label="Leadership snapshot"><p class="k">Leadership snapshot · live from this desk</p><div class="tiles">
    <div><span>Discount held back</span><b>${inr(im.notGiven)}</b><small>asked but not approved, before GST</small></div>
    <div><span>Discount given on orders</span><b>${inr(im.given)}</b><small>${im.orders} order${im.orders === 1 ? '' : 's'} · ${inr(im.orderValue)} booked · none above approval</small></div>
    <div class="${im.oldest >= E.SLA_DAYS ? 'warn' : ''}"><span>Asks waiting</span><b>${im.pending}</b><small>${im.pending ? `oldest ${im.oldest} working day(s) · ` : ''}${im.escalated} escalated · avg decision ${im.avgDecision ?? '–'} d</small></div>
    <div class="${im.creditHolds ? 'warn' : ''}"><span>Credit holds caught</span><b>${im.creditHolds}</b><small>dealer over limit or past credit days</small></div>
    <div class="${im.intact ? 'good' : 'bad'}"><span>Approval record</span><b>${im.intact ? '✓ Intact' : '✗ Altered'}</b><small>${im.blocks} sealed blocks · <a href="#seal">verify</a></small></div>
  </div></section>`;
  return `${snap}<div class="grid">
    <div class="side">
      <div class="card" id="asks"><h2>Discount asks for you · ${d.length}</h2><p class="sub">Each shows the three numbers you need: the ask, the margin floor and the dealer's credit.</p>
        ${d.length ? d.map(askCard).join('') : '<p class="empty">Nothing waiting for you.</p>'}
        ${others.length ? `<p class="more">${others.length} other ask(s) waiting for ${others.map(a => esc(E.label(a.approver))).join(', ')}.</p>` : ''}
      </div>
      <div class="card"><h2>Decided</h2>${decided.length ? `<ul class="mini">${decided.map(a => `<li><b>${esc(a.customer)}</b> · ${a.askPct}% asked by ${esc(a.rep)} · ${statusChip(a)} <small>by ${esc(a.decidedBy ?? '')}</small>${a.seal ? ` <span class="sealchip" title="Fingerprint in the sealed record">🔒 ${esc(a.seal.slice(0, 8))}</span>` : ''}${a.actingFor ? ` <small class="hint">acting for ${esc(a.actingFor)}</small>` : ''}${a.used ? ` <span class="chip st-ok">used on ${esc(a.orderId)}</span>` : ''}${a.status === 'approved' ? `<br><span class="hint">${a.capPct}% before GST = ${inr(a.amount)}${a.override ? ` · credit override: ${esc(a.override)}` : ''}</span><br><a class="btn link" href="${E.financeLink(w, a.id)}" target="_blank" rel="noopener">Send ${a.id} to finance in Every Rupee ↗</a>` : ''}</li>`).join('')}</ul>` : '<p class="empty">No decisions yet.</p>'}</div>
    </div>
    <div class="side">
      <div class="card" id="team"><h2>Team workload</h2><p class="sub">Who has more than ${E.CAP} due. No productivity scores.</p>
        <table><thead><tr><th>Rep</th><th>Bucket</th><th>Due now</th><th>P1</th><th>Waiting on approval</th></tr></thead><tbody>${wl.map(r => `<tr><td>${esc(E.label(r.rep))}</td><td>${esc(E.person(r.rep).buckets.join(', '))}</td><td class="${r.overCap ? 'over' : ''}">${r.actionable}${r.overCap ? ` (${r.overCap} over)` : ''}</td><td>${r.p1}</td><td>${r.frozen}</td></tr>`).join('')}</tbody></table>
        <div class="box" id="movebox" style="margin-top:12px"><b>Move a task</b>
          <div class="row"><label style="flex:1">Task<select id="mv-task">${opts.map(t => `<option value="${t.id}" ${t.transferPending ? 'disabled' : ''}>${esc(t.rep)} · ${esc(t.customer)} · ${E.bucketOf(w, t.customer)} · P${E.tier(w, t)}${t.transferPending ? ' · transfer waiting' : ''}</option>`).join('')}</select></label>
          <label>To<select id="mv-to">${wl.slice().sort((x, y) => x.actionable - y.actionable).map(r => `<option value="${r.rep}">${r.rep} (${E.person(r.rep).buckets.join(', ')})</option>`).join('')}</select></label></div>
          ${(() => { const sg = E.suggestMoves(w); return sg.length ? `<div class="box" style="margin:8px 0;border-color:#A7F3D0;background:#F0FDF4"><b>Suggested by the rules · same bucket only</b><p class="hint" style="margin:0">Reps over ${E.CAP} get their lowest-ranked tasks offered to a same-bucket rep with room. Cross-bucket moves are never suggested.</p>${sg.map(m => `<div class="row" style="justify-content:space-between;border-top:1px solid #D1FAE5;padding-top:6px"><span><b>${esc(m.customer)}</b> (${m.bucket}) · ${esc(m.from)} → ${esc(m.to)}</span><button type="button" class="btn ok" data-sug="${m.taskId}|${m.to}">Accept</button></div>`).join('')}</div>` : `<p class="hint" style="margin:6px 0">No suggested moves: nobody is over ${E.CAP} with a same-bucket colleague who has room.</p>`; })()}
          <p class="hint" id="mv-fit" style="margin:6px 0"></p>
          <div id="mv-confirm"><button type="button" class="btn" id="mv-ask">Move…</button></div>
          ${(() => { const tq = E.transfersFor(w, actor); const mine = (w.transfers ?? []).filter(x => x.status === 'pending' && x.by === actor); return (tq.length ? `<div class="box" style="margin-top:10px;border-color:var(--tt-line);background:var(--tt-soft)"><b>Transfers waiting for you</b>${tq.map(x => `<div style="display:grid;gap:6px;border-top:1px solid var(--tt-line);padding-top:8px"><span><b>${esc(x.customer)}</b> (${esc(x.bucket)}) · ${esc(x.from)} → ${esc(x.to)}, who handles ${esc(E.person(x.to).buckets.join(', '))} · asked by ${esc(x.by)}: “${esc(x.reason)}”</span><div class="row"><input id="tr-why-${x.id}" placeholder="Reason if you reject" maxlength="120" style="flex:1"><button type="button" class="btn ok" data-tr="${x.id}" data-ok="1">Approve</button><button type="button" class="btn" data-tr="${x.id}" data-ok="0">Reject</button></div></div>`).join('')}</div>` : '') + (mine.length ? `<p class="hint" style="margin-top:8px">Your request${mine.length > 1 ? 's' : ''} waiting for another manager: ${mine.map(x => `${esc(x.customer)} → ${esc(x.to)}`).join(', ')}.</p>` : ''); })()}
          <p class="hint">Original target is kept, so a moved task doesn't look newer. Tasks waiting on a discount can't be moved.</p>
        </div>
      </div>
      ${E.person(actor).senior ? '' : (() => { const d = (w.delegations ?? []).find(x => x.from === actor); const subs = E.PEOPLE.filter(p => p.approver && p.name !== actor); return `<div class="card" id="leave"><h2>Going on leave?</h2><p class="sub">Hand your approvals to a stand-in for set dates. Every decision is logged as “acting for ${esc(actor)}”, with the same limits.</p>${d ? `<div class="wait">Handed to <b>${esc(E.label(d.to))}</b> from ${fmt(d.start)} to ${fmt(d.end)}. <button class="btn link" data-leave="end" type="button">End it now</button></div>` : `<div class="row"><label>Stand-in<select id="l-to">${subs.map(p => `<option value="${p.name}">${esc(E.label(p.name))}</option>`).join('')}</select></label><label>From<input type="date" id="l-from" value="${w.today}"></label><label>To<input type="date" id="l-end" value="${E.addDays(w.today, 3)}"></label></div><button class="btn" data-leave="go" type="button" style="margin-top:8px">Hand over</button><div id="l-err"></div>`}</div>`; })()}
      ${(() => { const e = E.effectiveness(w); return `<div class="card" id="eff"><h2>Do discounts win deals?</h2><p class="sub">Last quarter plus every order and loss recorded here (${e.n} deals). Discount use, not rep scoring.</p><div class="metric"><div><b>${e.withDisc ?? '–'}%</b><span>won with a discount</span></div><div><b>${e.without ?? '–'}%</b><span>won without one</span></div></div><table style="margin-top:10px"><thead><tr><th>Rep</th><th>Deals</th><th>Discounted</th><th>Avg %</th><th>Won w/ disc.</th><th>Won w/o</th></tr></thead><tbody>${e.by.map(r => `<tr><td>${esc(r.rep)}</td><td>${r.deals}</td><td>${r.discounted}</td><td>${r.avgPct ?? '–'}</td><td>${r.withDisc ?? '–'}%</td><td>${r.without ?? '–'}%</td></tr>`).join('')}</tbody></table></div>`; })()}
      <div class="card" id="data"><h2>Your data</h2><p class="sub">Import dealers or open tasks from CSV. A file with any bad row is rejected whole, with the line numbers. Export approvals and orders with their fingerprints.</p>
        <div class="row"><label>Dealers CSV<input type="file" accept=".csv,text/csv" id="imp-dealers"></label><label>Tasks CSV<input type="file" accept=".csv,text/csv" id="imp-tasks"></label></div>
        <p class="hint" style="margin-top:6px">Dealer columns: ${E.DEALER_COLS.join(', ')} · Task columns: ${E.TASK_COLS.join(', ')} (leave rep blank to auto-assign by bucket) · <button class="btn link" data-tpl="dealers" type="button">dealer template</button> · <button class="btn link" data-tpl="tasks" type="button">task template</button></p>
        <div class="row" style="margin-top:6px"><button class="btn" data-exp="approvals" type="button">Export approvals</button><button class="btn" data-exp="orders" type="button">Export orders</button></div><div id="imp-res"></div></div>
      <div class="card" id="schemes"><h2>Schemes</h2><p class="sub">A live slab applies without an ask. A new scheme needs a second person to approve it.</p>
        <ul class="mini">${(w.schemes ?? []).map(sc => `<li><b>${sc.id}</b> · ${esc(sc.name)} <span class="chip ${sc.status === 'active' ? 'st-ok' : 'st-frozen'}">${sc.status === 'active' ? 'Live' : 'Waiting for approval'}</span><br><small class="hint">by ${esc(sc.maker)}${sc.checker ? `, approved by ${esc(sc.checker)}` : ''}</small>${sc.status === 'pending' ? (sc.maker === actor ? '<br><span class="hint">You proposed it, so someone else must approve it.</span>' : `<br><button class="btn" style="margin-top:4px" data-sch="${sc.id}" type="button">Approve ${sc.id}</button>`) : ''}</li>`).join('')}</ul>
        <div class="box" style="margin-top:10px"><b>Propose a scheme</b><div class="row"><label style="flex:1">Name<input id="s-name" maxlength="60" placeholder="e.g. Festive slab 2%"></label><label>Min order (₹)<input id="s-min" type="number" value="100000" style="width:120px"></label><label>%<input id="s-pct" type="number" step="0.5" value="2" style="width:70px"></label></div><button class="btn" id="s-go" type="button">Propose</button><div id="s-err"></div></div>
      </div>
      <div class="card" id="turn"><h2>Approval turnaround</h2><table><thead><tr><th>Approver</th><th>Decided</th><th>Avg days</th><th>Escalated away</th></tr></thead><tbody>${E.turnaround(w).map(r => `<tr><td>${esc(E.label(r.name))}</td><td>${r.decided}</td><td>${r.avgDays ?? '–'}</td><td class="${r.escalatedAway ? 'over' : ''}">${r.escalatedAway}</td></tr>`).join('')}</tbody></table><p class="hint" style="margin-top:6px">An ask not decided within ${E.SLA_DAYS} day moves to the sales head.</p></div>
      <div class="card" id="act"><h2>Activity</h2>${w.audit.length ? `<ul class="hist">${w.audit.slice(-8).reverse().map(l => `<li><small>${time(l.at)} · ${esc(E.label(l.who))}</small>${esc(l.text)}</li>`).join('')}</ul>` : '<p class="empty">No activity yet.</p>'}</div>
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
  const scheme = (w.schemes ?? []).find(x => x.status === 'active' && t.value >= x.minValue);
  if (mine && t.status === 'open' && ['Quote sent', 'Negotiation'].includes(t.stage)) { tabs.push(['order', 'Place order']); if (scheme && !t.scheme) tabs.push(['scheme', 'Apply scheme']); if (!(a && a.status === 'approved' && !a.used)) tabs.push(['ask', 'Ask discount']); tabs.push(['lost', 'Deal lost']); }
  const al = E.allowedPct(w, t);
  if (mine && a?.status === 'countered') tabs.unshift(['counter', 'Answer counter']);
  if (!panel.tab || !tabs.some(x => x[0] === panel.tab)) panel.tab = tabs[0]?.[0] ?? null;
  const tomorrow = E.addDays(w.today, 1);
  const forms = {
    done: `<label>What happened? (one line)<input id="f-out" maxlength="160" placeholder="e.g. Spoke to owner; sending the quote today"></label><label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="f-moved" ${t.stage === 'Negotiation' || t.kind === 'recovery' ? 'disabled' : ''}> The deal moved to the next stage${E.STAGES[E.STAGES.indexOf(t.stage) + 1] ? ` (${E.STAGES[E.STAGES.indexOf(t.stage) + 1]})` : ''}: create the next task</label><button class="btn pri" data-do="done" type="button">Mark done</button>`,
    move: `<div class="row"><label>New date<input type="date" id="f-date" min="${tomorrow}" value="${tomorrow}"></label><label style="flex:1">${t.reschedules.length ? 'What is blocking it? (required)' : 'Blocker (optional the first time)'}<input id="f-block" maxlength="120"></label></div><p class="hint">It keeps ageing from the original target (${fmt(t.due)}) wherever you move it.</p><button class="btn pri" data-do="move" type="button">Reschedule</button>`,
    hold: `<div class="row"><label style="flex:1">Why on hold?<input id="f-why" maxlength="120" placeholder="e.g. Customer budget frozen till month end"></label><label>Revisit on<input type="date" id="f-rev" min="${tomorrow}" value="${E.addDays(w.today, 7)}"></label></div><p class="hint">It comes back into Today by itself on the revisit date.</p><button class="btn pri" data-do="hold" type="button">Put on hold</button>`,
    ask: `<div class="row"><label>Discount (%)<input type="number" id="f-pct" min="0.5" max="30" step="0.5" value="8" style="width:100px"></label><label style="flex:1">Why does the customer need it?<input id="f-reason" maxlength="160" placeholder="e.g. Competitor quoted 9% lower"></label></div><p class="route" id="f-route"></p><p class="hint">Asking freezes this task until the approver decides. The clock moves to them.</p><button class="btn pri" data-do="ask" type="button">Send the ask</button>`,
    order: `<div class="row"><label>Order value (₹)<input type="number" id="f-val" min="1" value="${t.value}" style="width:140px"></label><label>Discount given (% before GST)<input type="number" id="f-disc" min="0" step="0.5" value="${al.pct}" style="width:110px"></label></div><p class="hint">Allowed here: <b>${al.pct}%</b>${al.approval ? ` (${al.approval.capPct}% approved in ${al.approval.id}, valid to ${fmt(al.approval.validTo)}${al.approval.used ? ', already used' : ''})` : ' (nothing approved)'}${t.scheme ? ` + scheme ${t.scheme.pct}%` : ''}. Anything above is blocked. One approval covers one order.</p><button class="btn pri" data-do="order" type="button">Place order</button>`,
    lost: `<label>Why was it lost?<input id="f-lost" maxlength="120" placeholder="e.g. Competitor 4% cheaper; customer delayed purchase"></label><p class="hint">Lost deals feed the discount-effectiveness view, so managers see whether discounts actually win deals.</p><button class="btn" data-do="lost" type="button">Mark as lost</button>`,
    scheme: scheme ? `<p><b>${scheme.id}</b> · ${esc(scheme.name)}</p><p class="hint">This order is ${inr(t.value)}, so it qualifies: ${scheme.pct}% before GST = <b>${inr(E.rupeesOff(t.value, scheme.pct))}</b>. The scheme is pre-approved, so no ask is needed.</p><button class="btn pri" data-do="scheme" data-s="${scheme.id}" type="button">Apply ${scheme.pct}%</button>` : '',
    counter: a?.status === 'countered' ? `<p>${esc(E.label(a.decidedBy))} offered <b>${a.capPct}%</b> instead of ${a.askPct}%, valid to ${fmt(a.validTo)}. “${esc(a.counterWhy)}”</p><div class="row"><button class="btn pri" data-do="accept" type="button">Accept ${a.capPct}%</button><button class="btn" data-do="decline" type="button">Decline</button></div>` : '',
  };
  let state = '';
  if (t.status === 'frozen' && a?.status === 'pending') state = `<div class="wait">Frozen: waiting for <b>${esc(E.label(a.approver))}</b> to decide ${a.askPct}% (${a.id}).${a.routedBecause.length ? ` Sent to the sales head because ${esc(a.routedBecause.join(', '))}.` : ''} <button class="btn link" data-actor="${a.approver}" type="button">Sign in as ${esc(a.approver)} →</button></div>`;
  if (t.status === 'hold') state = `<div class="wait">On hold: ${esc(t.hold.reason)}. Back in Today on ${fmt(t.hold.revisit)}. ${mine ? '<button class="btn link" data-do="resume" type="button">Take it off hold now</button>' : ''}</div>`;
  if (t.status === 'done') state = `<div class="done">Done: ${esc(t.outcome)}</div>`;
  if (!mine && t.status === 'open') state = `<div class="wait">This is ${esc(E.label(t.rep))}'s task. <button class="btn link" data-actor="${t.rep}" type="button">Sign in as ${esc(t.rep)} →</button></div>`;
  $('#panel-body').innerHTML = `
    <div class="ph"><div><h2 id="p-title" style="margin:0">${esc(t.customer)}</h2><p class="hint">${t.id} · ${esc(t.stage)} · ${inr(t.value)} · ${esc(E.label(t.rep))}</p></div><button class="x" data-close aria-label="Close" type="button">×</button></div>
    <p style="margin:0"><b>${esc(t.title)}</b></p>
    ${t.scheme ? `<p class="hint">Scheme ${t.scheme.id} applied: ${t.scheme.pct}% before GST = ${inr(t.scheme.amount)}.</p>` : ''}
    ${(() => { const c = E.creditCheck(w, t.customer); return c.creditLimit ? `<p class="hint">Dealer credit: ${inr(c.outstanding)} of ${inr(c.creditLimit)} used · oldest bill ${c.oldestBillDays}d of ${c.creditDays}d allowed${c.ok ? '' : ` · <b style="color:var(--bad)">credit hold</b>`}</p>` : ''; })()}
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
  el.textContent = `${pct}% before GST = ${inr(E.rupeesOff(t.value, pct))} off. Goes to ${E.label(r.approver)}${r.why.length ? ` because: ${r.why.join(', ')}` : ` (within ${E.MANAGER_LIMIT}% and the margin floor)`}.`;
}
function panelAction(kind) {
  const t = w.tasks.find(x => x.id === panel.id); const v = s => $(s)?.value ?? '';
  panel.err = '';
  const ok = html => { panel.done = html; flashId = t.id; };
  if (kind === 'done') act(() => E.complete(w, t.id, actor, v('#f-out'), $('#f-moved')?.checked), 'Marked done.', out => ok(out.next ? `✓ Done. The deal moved to <b>${esc(out.next.stage)}</b>, so the next task was created: ${esc(out.next.title)} (due ${fmt(out.next.due)}).<div class="row"><button class="btn" data-open="${out.next.id}" type="button">Open the new task</button><button class="btn pri" data-close type="button">Back to Today</button></div>` : `✓ Done and logged.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'move') act(() => E.reschedule(w, t.id, actor, v('#f-date'), v('#f-block')), 'Rescheduled.', () => ok(`✓ Moved to ${fmt(v('#f-date'))}. It's in “Coming up” and still ages from ${fmt(t.due)}.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'hold') act(() => E.putOnHold(w, t.id, actor, v('#f-why'), v('#f-rev')), 'On hold.', () => ok(`✓ On hold until ${fmt(v('#f-rev'))}. It returns to Today by itself then.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'scheme') { const sc = w.schemes.find(x => x.id === $('[data-do="scheme"]').dataset.s); act(() => E.applyScheme(w, t.id, actor, sc.id), 'Scheme applied.', () => ok(`✓ ${sc.id} applied: ${sc.pct}% before GST = ${inr(E.rupeesOff(t.value, sc.pct))} off. Pre-approved, so no ask was needed.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`)); }
  if (kind === 'order') act(() => E.placeOrder(w, t.id, actor, Number(v('#f-val')), Number(v('#f-disc'))), 'Order placed.', out => ok(`✓ ${out.order.id} placed: ${inr(out.order.value)} at ${out.order.discountPct}% before GST (${inr(out.order.discountAmt)} off). Sealed as <code>${esc(out.order.seal.slice(0, 12))}</code>.${out.order.approvalId ? ` ${esc(out.order.approvalId)} is now used and can't cover another order.` : ''}<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'lost') act(() => E.markLost(w, t.id, actor, v('#f-lost')), 'Marked lost.', () => ok('✓ Marked lost. It counts in the discount-effectiveness view.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>'));
  if (kind === 'resume') act(() => E.resume(w, t.id, actor), 'Back in Today.', () => ok('✓ Back in Today.'));
  if (kind === 'ask') act(() => E.askDiscount(w, t.id, actor, Number(v('#f-pct')), v('#f-reason')), 'Ask sent.', out => { const a = out.approvals.at(-1); ok(`✓ Sent ${a.id} to <b>${esc(E.label(a.approver))}</b>. This task is frozen until they decide, so it has left your Today.<div class="row"><button class="btn pri" data-actor="${a.approver}" type="button">Sign in as ${esc(a.approver)} →</button><button class="btn" data-close type="button">Back to Today</button></div>`); });
  if (kind === 'accept' || kind === 'decline') { const a = apvOf(t); act(() => E.respondCounter(w, a.id, actor, kind === 'accept'), kind === 'accept' ? 'Counter accepted.' : 'Counter declined.', () => ok(kind === 'accept' ? `✓ Accepted ${a.capPct}%. The task is back in Today: send the revised quote.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>` : '✓ Declined. The task is back in Today to negotiate without a discount.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>')); }
}
function decide(kind, id) {
  const card = $(`#ask-${CSS.escape(id)}`); const f = n => card.querySelector(`[data-f="${n}"]`).value;
  const a = w.approvals.find(x => x.id === id);
  const run = { approve: () => E.approve(w, id, actor, Number(f('cap')), f('exp'), f('why')), counter: () => E.counter(w, id, actor, Number(f('cap')), f('exp'), f('why')), back: () => E.sendBack(w, id, actor, f('why')) }[kind];
  const text = { approve: `Approved ${f('cap')}% for ${a.customer}, valid to ${fmt(f('exp'))}.`, counter: `Offered ${f('cap')}% to ${a.rep} for ${a.customer}.`, back: `Sent ${a.customer}'s ask back to ${a.rep}.` }[kind];
  const sub = { approve: `${a.rep}'s task is unfrozen and back in Today as “send the revised quote”. Use “Send to finance” under Decided so Every Rupee checks payments against this cap.`, counter: `${a.rep} must accept or decline. Their task stays frozen until then.`, back: `${a.rep}'s task is back in Today with your note, so they can fix it and ask again.` }[kind];
  try { w = run(); save(); toast(text); const sealed = w.approvals.find(x => x.id === id)?.seal; sealRes = null; result = { text: text + (kind === 'approve' && sealed ? ` Sealed as ${sealed.slice(0, 12)}.` : ''), sub, switchTo: a.rep }; flashId = a.taskId; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch (e) { let el = card.querySelector('.err'); if (!el) { el = document.createElement('div'); el.className = 'err'; el.setAttribute('role', 'alert'); card.prepend(el); } el.textContent = e.message; }
}

function render() {
  try { renderInner(); } catch (e) { console.error(e); try { localStorage.removeItem(KEY); } catch { } w = E.escalate(E.sample(realToday)); actor = 'Rahul'; panel = null; result = { text: 'The saved session was from an older version, so a fresh sample was loaded.' }; renderInner(); }
}
function renderInner() {
  renderActors(); if (!signedIn) { $('#next').hidden = true; return renderSignIn(); } $('#seal').hidden = false; $('#next').hidden = false; renderSeal(); renderNext();
  $('#desk').innerHTML = isRep(actor) ? repDesk() : managerDesk();
  if (panel && $('#panel').open) renderPanel();
  flashId = null;
  if (!isRep(actor)) { buildTools(); moveFit(); }
  collapseForMobile();
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('button,[data-open]'); if (!b) return;
  if (b.dataset.actor) return switchTo(b.dataset.actor);
  if (b.dataset.signin) { signedIn = true; result = null; return switchTo(b.dataset.signin); }
  if (b.id === 'signout') { signedIn = false; result = null; panel = null; sealRes = null; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (b.dataset.sug) { const [id, to] = b.dataset.sug.split('|'); try { w = E.rebalance(w, id, actor, to); save(); sealRes = null; const t = w.tasks.find(x => x.id === id); toast('Suggested move accepted.'); result = { text: `Moved ${t.customer} to ${E.label(to)}: same ${E.bucketOf(w, t.customer)} bucket, suggested by the rules.`, sub: 'Original target kept. Sealed in the record.' }; render(); } catch (err) { result = { err: err.message }; render(); } return; }
  if (b.dataset.open) return openTask(b.dataset.open, b.dataset.tab);
  if (b.hasAttribute('data-close')) { panel = null; $('#panel').close(); return; }
  if (b.dataset.tab && panel) { panel.tab = b.dataset.tab; panel.err = ''; return renderPanel(); }
  if (b.dataset.do) return panelAction(b.dataset.do);
  if (b.dataset.dec) return decide(b.dataset.dec, b.dataset.id);
  if (b.dataset.go) { document.querySelector(b.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (b.id === 'reset') { w = E.sample(realToday); actor = 'Rahul'; result = null; panel = null; save(); render(); toast('Sample reset.'); return; }
  if (b.id === 'mv-ask') { const t = w.tasks.find(x => x.id === $('#mv-task').value); const to = $('#mv-to').value; const bk = E.bucketOf(w, t.customer); const fits = E.owns(to, bk);
    $('#mv-confirm').innerHTML = fits ? `<p class="hint" style="margin-bottom:6px">Move <b>${esc(t.customer)}</b> from ${esc(t.rep)} to ${esc(to)}, within the ${bk} bucket?</p><div class="row"><button type="button" class="btn pri" id="mv-yes" data-t="${t.id}" data-to="${to}">Yes, move it</button><button type="button" class="btn" id="mv-no">Cancel</button></div>`
      : `<div class="err" style="margin-bottom:6px">${esc(to)} handles ${esc(E.person(to).buckets.join(', '))}; <b>${esc(t.customer)}</b> is ${bk === "FMCG" ? "an" : "a"} ${bk} dealer. This is a wrong-bucket move, so it needs a reason and a second manager's approval. It stays with ${esc(t.rep)} until then.</div><div class="row"><input id="mv-why" placeholder="Why should it move? (required)" maxlength="140" style="flex:1"><button type="button" class="btn pri" id="mv-yes" data-t="${t.id}" data-to="${to}">Send for approval</button><button type="button" class="btn" id="mv-no">Cancel</button></div>`; return; }
  if (b.id === 'mv-no') { $('#mv-confirm').innerHTML = '<button type="button" class="btn" id="mv-ask">Move…</button>'; moveFit(); return; }
  if (b.dataset.tool) { toolTab = b.dataset.tool; toolChosen = true; document.querySelectorAll('.ttabs button').forEach(x => { const on = x.dataset.tool === toolTab; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }); document.querySelectorAll('.tbody .tool').forEach(x => { x.hidden = x.id !== toolTab; }); if (!b.closest('.ttabs')) $('.tools')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (b.dataset.seal) { if (b.dataset.seal === 'verify') sealRes = E.verifyChain(w); if (b.dataset.seal === 'tamper') { const ap = [...w.chain].reverse().find(x => /^Approved/.test(x.text)) ?? w.chain.find(x => /%/.test(x.text)) ?? w.chain[0]; sealEdit = ap?.n ?? 0; sealRes = null; }
    if (b.dataset.seal === 'dbcancel') sealEdit = 0;
    if (b.dataset.seal === 'dbsave') { try { w = E.tamperEntry(w, Number($('#db-n').value), $('#db-text').value); save(); sealEdit = 0; sealRes = null; toast('Row changed in the database. Now press Verify record.'); } catch (err) { $('#db-err').innerHTML = `<div class="err" style="margin-top:6px">${esc(err.message)}</div>`; return; } } if (b.dataset.seal === 'undo') { w = E.undoTamper(w); save(); sealEdit = 0; sealRes = E.verifyChain(w); } return renderSeal(); }
  if (b.dataset.leave) { try { if (b.dataset.leave === 'end') { w = E.endDelegation(w, actor); result = { text: 'Hand-over ended. New asks come to you again.' }; } else { const r = E.delegate(w, actor, $('#l-to').value, $('#l-from').value, $('#l-end').value); w = r.w; result = { text: `Approvals handed to ${E.label($('#l-to').value)}.`, sub: r.moved ? `${r.moved} waiting ask moved to them now. Each decision is logged as acting for ${actor}.` : `New asks go to them during those dates, logged as acting for ${actor}.`, switchTo: $('#l-to').value }; } save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { $('#l-err').innerHTML = `<div class="err" style="margin-top:6px">${esc(err.message)}</div>`; } return; }
  if (b.dataset.exp || b.dataset.tpl) { const txt = b.dataset.exp ? E.exportCsv(w, b.dataset.exp) : (b.dataset.tpl === 'dealers' ? E.DEALER_COLS.join(',') + '\nSample Traders,300000,50000,30,10,8' : E.TASK_COLS.join(',') + `\nRahul,Sample Traders,Quote sent,${w.today},150000\n,City Pharma,New lead,${w.today},40000`); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/csv' })), download: `tentoday-${b.dataset.exp || b.dataset.tpl + '-template'}.csv` }); document.body.append(a); a.click(); a.remove(); toast('CSV downloaded.'); return; }
  if (b.dataset.sch) { try { w = E.approveScheme(w, b.dataset.sch, actor); save(); toast('Scheme approved.'); result = { text: `${b.dataset.sch} is live.`, sub: 'Reps can now apply it to qualifying orders without asking.' }; render(); } catch (err) { result = { err: err.message }; render(); } window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (b.id === 's-go') { try { w = E.proposeScheme(w, actor, $('#s-name').value, Number($('#s-min').value), Number($('#s-pct').value)); save(); const sc = w.schemes.at(-1); toast('Scheme proposed.'); result = { text: `${sc.id} proposed: ${sc.name}.`, sub: 'It is not usable until a second person approves it.', switchTo: actor === 'Kavita' ? 'Arjun' : 'Kavita' }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { $('#s-err').innerHTML = `<div class="err" role="alert" style="margin-top:6px">${esc(err.message)}</div>`; } return; }
  if (b.id === 'mv-yes') { try { w = E.rebalance(w, b.dataset.t, actor, b.dataset.to, $('#mv-why')?.value); save(); sealRes = null; const t = w.tasks.find(x => x.id === b.dataset.t);
    if (w.lastTransfer) { const tr = w.transfers.find(x => x.id === w.lastTransfer); const by = E.PEOPLE.find(p => p.manager && p.name !== actor && p.senior)?.name ?? 'Arjun'; toast('Transfer request sent.'); result = { text: `${tr.id}: ${t.customer} → ${tr.to} sent for approval.`, sub: `Wrong bucket (${tr.bucket} dealer, ${tr.to} handles ${E.person(tr.to).buckets.join(', ')}). It stays with ${tr.from} until another manager approves. Sealed in the record.`, switchTo: actor === 'Arjun' ? 'Kavita' : by }; }
    else { toast('Task moved.'); result = { text: `Moved ${t.customer} to ${E.label(t.rep)}, same ${E.bucketOf(w, t.customer)} bucket.`, sub: 'The original target is kept, so it keeps its place in their ranking. Sealed in the record.', switchTo: t.rep }; }
    render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { $('#mv-confirm').insertAdjacentHTML('afterbegin', `<div class="err" role="alert" style="margin-bottom:6px">${esc(err.message)}</div>`); } return; }
  if (b.dataset.tr) { try { const ok = b.dataset.ok === '1'; w = E.decideTransfer(w, b.dataset.tr, actor, ok, $(`#tr-why-${CSS.escape(b.dataset.tr)}`)?.value); save(); sealRes = null; const tr = w.transfers.find(x => x.id === b.dataset.tr); toast(ok ? 'Transfer approved.' : 'Transfer rejected.'); result = { text: ok ? `${tr.id} approved: ${tr.customer} is now with ${E.label(tr.to)}.` : `${tr.id} rejected: ${tr.customer} stays with ${E.label(tr.from)}.`, sub: `Decided by ${actor}, not ${tr.by} who asked. Sealed in the record.`, switchTo: ok ? tr.to : tr.from }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { b.closest('div').insertAdjacentHTML('beforebegin', `<div class="err" role="alert">${esc(err.message)}</div>`); } return; }
});
document.addEventListener('input', e => { if (e.target.id === 'f-pct') routePreview(); });
document.addEventListener('change', e => { if (e.target.id === 'mv-task' || e.target.id === 'mv-to') { $('#mv-confirm').innerHTML = '<button type="button" class="btn" id="mv-ask">Move…</button>'; moveFit(); } if (e.target.id === 'db-n') { sealEdit = Number(e.target.value); renderSeal(); } });
document.addEventListener('change', async e => {
  if (!['imp-dealers', 'imp-tasks'].includes(e.target.id) || !e.target.files[0]) return;
  const text = await e.target.files[0].text(); const out = $('#imp-res');
  try { const r = e.target.id === 'imp-dealers' ? E.importDealers(w, text) : E.importTasks(w, text); w = r.w; save(); result = { text: `Imported ${r.count} ${e.target.id === 'imp-dealers' ? 'dealer(s)' : 'task(s)'}.`, sub: 'Credit checks and ranking now use your data.' }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch (err) { out.innerHTML = `<div class="err" role="alert" style="margin-top:8px">${esc(err.message)}</div>`; e.target.value = ''; }
});
$('#panel').addEventListener('close', () => { panel = null; });

load(); w = E.escalate(E.wakeHolds(w));
(() => {
  const tok = new URLSearchParams(location.search).get('task'); if (!tok) return;
  try { const r = E.importRecovery(w, tok); w = r.w; actor = r.task.rep; signedIn = true; save(); result = { text: r.fresh ? `New task from Every Rupee: ${r.task.title}.` : `Already in ${r.task.rep}'s list: ${r.task.title}.`, sub: `Finance handed this short payment to ${r.task.rep}. Recover it from ${r.task.customer}, or get it approved. Open it in Today.` }; setTimeout(() => openTask(r.task.id), 300); }
  catch (e) { result = { err: e.message }; }
  try { history.replaceState(null, '', location.pathname); } catch { }
})();
render();

/* ---------- 60-second guided tour: runs the real engine on a fresh sample ---------- */
const TOUR = [
  { who: 'Rahul', k: 'The rep', h: '100 open leads. 10 actions today.', p: 'Rahul has 17 open tasks: 12 are due now, and Today shows at most 10 of them, so the two over the cap are counted, not hidden. Ranked by rules he can read: days past target, money-blocking stage, then deal value as a tie-break.', run: () => { w = E.sample(realToday); }, at: () => $('#desk .card') },
  { who: 'Rahul', k: 'Scheme, no ask', h: 'A live scheme applies by itself', p: 'Aarav’s ₹4.8L order qualifies for the 3% volume slab. Pre-approved, so it applies at once: ₹14,400 off before GST, logged.', run: () => { w = E.applyScheme(w, 'T-101', 'Rahul', 'SCH-01'); }, open: 'T-101', at: () => $('#panel') },
  { who: 'Rahul', k: 'Discount ask', h: 'He asks for 6% more. The task freezes.', p: 'The ask goes to Kavita, who is allowed to decide up to 10% within the margin floor. Rahul’s task leaves Today; the clock is now on her.', run: () => { w = E.askDiscount(w, 'T-101', 'Rahul', 6, 'Rival quoted 7% lower'); }, at: () => document.querySelectorAll('#desk .side .card')[0] },
  { who: 'Kavita', k: 'The approver', h: 'Three numbers to decide', p: 'Kavita sees the ask in rupees before GST, the margin floor and the dealer’s credit. She can approve, counter or send back. She can’t decide her own asks.', at: () => [...document.querySelectorAll('.ask')].find(x => x.textContent.includes('Aarav')) },
  { who: 'Kavita', k: 'Decision', h: 'Approved with a cap and an expiry', p: 'Rahul’s task comes back as “send the revised quote”. The decision is sealed in the record above. “Send to finance” passes it, fingerprint included, to Every Rupee, which checks the short payment against this exact cap.', run: () => { const a = w.approvals.find(x => x.taskId === 'T-101' && x.status === 'pending'); w = E.approve(w, a.id, 'Kavita', 6, E.addDays(w.today, 14)); }, at: () => document.querySelector('a[href*="every-rupee"]')?.closest('.card') },
  { who: 'Arjun', k: 'Controls', h: 'Nothing sits, nothing slips', p: 'An ask Kavita left for 2 days escalated to Arjun. A dealer past his credit days can only be approved with a written override, like a post-dated cheque.', at: () => $('#asks') },
  { who: 'Arjun', k: 'Sealed record', h: 'Someone quietly edits an old approval', p: 'We changed an old approval straight in the database, bypassing the app, the way an insider might. Then we verified. Its fingerprint no longer matches, so the record shows exactly which entry was altered. Rahul can’t claim 10% was approved when 6% was.', run: () => { w = E.simulateTamper(w); sealOpen = true; sealRes = null; }, after: () => { sealRes = E.verifyChain(w); renderSeal(); }, at: () => $('#seal') },
];
let tStep = -1, tTimer = null, tPaused = false; const STEP_MS = 9000;
const tourEl = Object.assign(document.createElement('div'), { id: 'tour' }); tourEl.setAttribute('role', 'dialog'); tourEl.setAttribute('aria-label', 'Guided tour'); document.body.append(tourEl);
function tourShow(i) {
  clearTimeout(tTimer); document.querySelectorAll('.tour-hi').forEach(x => x.classList.remove('tour-hi'));
  if (i >= TOUR.length) return tourEnd(true);
  tStep = i; const s = TOUR[i];
  try { $('#panel').open && $('#panel').close(); } catch { } panel = null; result = null;
  s.run?.(); actor = s.who; signedIn = true; save(); render();
  if (s.open) { openTask(s.open); const d = $('#panel'); d.close(); d.show(); }
  s.after?.();
  const t = s.at?.(); if (t) { t.classList.add('tour-hi'); if (!s.open) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  tourEl.innerHTML = `<p class="k">${i + 1} / ${TOUR.length} · ${s.k} · acting as ${esc(E.label(s.who))}</p><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p><div class="bar2"><i></i></div><div class="ctl"><button type="button" data-t="exit">Exit</button><button type="button" data-t="pause">${tPaused ? 'Play' : 'Pause'}</button><button type="button" class="go" data-t="next">${i === TOUR.length - 1 ? 'Finish' : 'Next →'}</button></div>`;
  tourEl.classList.add('on');
  const bar = tourEl.querySelector('.bar2 i');
  if (!tPaused) { requestAnimationFrame(() => { bar.style.transition = `width ${STEP_MS}ms linear`; bar.style.width = '100%'; }); tTimer = setTimeout(() => tourShow(i + 1), STEP_MS); }
}
function tourEnd(finished) {
  clearTimeout(tTimer); tStep = -1; tourEl.classList.remove('on'); document.querySelectorAll('.tour-hi').forEach(x => x.classList.remove('tour-hi'));
  try { $('#panel').open && $('#panel').close(); } catch { } panel = null;
  w = E.escalate(E.sample(realToday)); actor = 'Rahul'; signedIn = false; sealRes = null; sealOpen = false; save();
  result = null;
  render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
tourEl.addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  if (b.dataset.t === 'exit') return tourEnd(false);
  if (b.dataset.t === 'next') { tPaused = false; return tourShow(tStep + 1); }
  if (b.dataset.t === 'pause') { tPaused = !tPaused; if (tPaused) { clearTimeout(tTimer); const bar = tourEl.querySelector('.bar2 i'); bar.style.transition = 'none'; bar.style.width = getComputedStyle(bar).width; b.textContent = 'Play'; } else tourShow(tStep); }
});
$('#tour-go').addEventListener('click', () => { tPaused = false; tourShow(0); });
document.addEventListener('keydown', e => { if (tStep >= 0 && e.key === 'Escape') tourEnd(false); });
if (new URLSearchParams(location.search).get('tour') === '1') { try { history.replaceState(null, '', location.pathname); } catch { } setTimeout(() => tourShow(0), 400); }
