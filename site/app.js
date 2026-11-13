import * as E from './engine.js?v=1794488317';

const KEY = 'tentoday-product-v11';
const fits = x => x && Array.isArray(x.chain) && Array.isArray(x.orders) && Array.isArray(x.delegations) && Array.isArray(x.lost) && Array.isArray(x.schemes) && x.seq && x.seq.ord;
const realToday = E.iso(new Date());
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const fmt = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const time = t => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

let drillBackup = null, sealEdit = 0, signedIn = true; let w, actor = 'Rahul', panel = null, result = null, flashId = null, sealRes = null, sealOpen = false;

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && fits(s.w) && s.w.today === realToday) { w = s.w; actor = s.actor || actor; signedIn = true; return; } } catch { /* storage unavailable */ }
  w = E.withHistory(E.sample(realToday));
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ w, actor, signedIn })); } catch { /* fine without */ } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600); }

/* Run an engine action. On success: save, toast, re-render. On failure: show the engine's own words. */
function act(fn, msg, after) {
  try { const out = fn(); w = out.w ?? out; sealRes = null; result = null; save(); toast(msg); after?.(out); render(); return true; }
  catch (e) { if (panel) { panel.err = e.message; renderPanel(); } else { result = { err: e.message }; render(); } return false; }
}

const isRep = n => E.person(n).rep;
const tierChip = task => { const t = E.tier(w, task); return task.callbackAt ? `<span class="chip pin">${esc(task.callbackAt)} call</span>` : `<span class="chip p${t}">P${t}</span>`; };
const apvOf = task => w.approvals.find(a => a.id === task.approvalId);
const counters = rep => w.approvals.filter(a => a.status === 'countered' && a.rep === rep);

const ROLE_WHY = {
  Rahul: 'FMCG Sales Rep · Sees his top 10 tasks today. Can apply pre-approved schemes, or ask Kavita for a discount (which freezes his task).',
  Neha: 'Pharma Sales Rep · Handles Pharma shops only. FMCG tasks cannot be dumped on her without a second manager’s approval.',
  Imran: 'FMCG Sales Rep · Takes overflow FMCG tasks when Rahul has more than 10 due today.',
  Kavita: 'Sales Manager · Approves or counters discount asks up to 10% (if within margin floor). Needs Arjun to co-sign new schemes.',
  Sanjay: 'Area Sales Manager · Acts as stand-in approver when Kavita goes on leave (every decision is logged as "acting for Kavita").',
  Arjun: 'Sales Head · Approves big discounts (>10%), dealers on credit hold, and any ask Kavita leaves undecided for more than 1 day.',
};

/* ---------- actor switch ---------- */
function renderActors() {
  const badge = n => { const p = E.person(n); return p.rep ? E.today(w, n).list.length + counters(n).length : E.decisionsFor(w, n).length + E.transfersFor(w, n).length; };
  const mainSeats = ['Rahul', 'Neha', 'Kavita', 'Arjun', 'Imran', 'Sanjay'];
  $('#actors').innerHTML = mainSeats.map(name => {
    const p = E.person(name);
    const b = badge(name);
    const on = actor === name;
    return `<button type="button" class="who ${on ? 'on' : ''}" data-actor="${name}"><b>${esc(name)}</b> <small>${esc(p.role)}${p.buckets ? ` · ${esc(p.buckets.join(', '))}` : ''}</small>${p.rep && E.activeCover(w, name) ? `<span class="badge off">on leave</span>` : b ? `<span class="badge">${b} ${p.rep ? 'due' : 'wait'}</span>` : ''}</button>`;
  }).join('');
  const whyEl = $('#actor-why');
  if (whyEl) whyEl.textContent = ROLE_WHY[actor] || '';
}
function renderQ2CBridge() {
  const el = $('#q2c-bridge'); if (!el) return;
  const rec = w.tasks.find(t => t.kind === 'recovery' && t.status === 'open');
  const approved = [...w.approvals].reverse().find(a => a.status === 'approved');
  const audit = E.auditChain(w);
  el.innerHTML = `<div class="q2c-in">
    <div style="width:100%">
      <span class="q2c-k">HOW SALES (TEN TODAY) &amp; FINANCE (EVERY RUPEE) STOP VERBAL DISCOUNT LEAKS</span>
      <p class="q2c-p" style="max-width:none;margin-bottom:10px">In real business, a salesperson promises a discount on a call, and weeks later the shop pays less than the invoice. These two live connections keep Sales and Finance in sync:</p>
      <div class="q2c-cards">
        <div class="q2c-card ${rec ? 'active-hold' : ''}">
          <div class="q2c-card-hd">
            <span class="q2c-dir">1 · INBOUND FROM FINANCE (EVERY RUPEE → TEN TODAY)</span>
            <span class="chip ${rec ? 'st-bad' : 'p3'}">${rec ? '⛔ Rahul Blocked' : 'Ready to test'}</span>
          </div>
          <b>What if a shop deducts ₹9,440 without an approved discount?</b>
          <p>${rec
            ? `<b style="color:var(--bad)">Active right now:</b> Krishna Marketing paid <b>₹9,440 short</b> on bill <code>INV-5031</code> with no approval on record. Finance sent task <b>${esc(rec.id)}</b> to Rahul's queue and <b>locked Rahul from asking for any new discounts</b> until he collects the ₹9,440 or attaches proof.`
            : `When a shop short-pays an invoice and claims "Rahul promised us a discount" with no record in Ten Today, Finance routes the ₹9,440 gap back to Rahul and <b>freezes his ability to ask for new discounts</b> after 15 days.`}</p>
          <div class="row" style="margin-top:6px">
            <button type="button" class="btn ${rec ? 'ok' : ''}" data-q2c="${rec ? 'clear-rec' : 'sim-rec'}">${rec ? `✓ Resolve ₹9,440 short-payment & unblock Rahul` : '⚡ Test this: Send ₹9,440 unapproved short-payment from Finance'}</button>
            ${rec ? `<button type="button" class="btn pri" data-q2c="try-blocked-ask">Try asking for a discount as Rahul (watch it block) →</button>` : ''}
          </div>
        </div>
        <div class="q2c-card">
          <div class="q2c-card-hd">
            <span class="q2c-dir">2 · OUTBOUND TO FINANCE (TEN TODAY → EVERY RUPEE)</span>
            <span class="chip ${approved ? (audit.ok ? 'st-ok' : 'st-bad') : 'p3'}">${approved ? (audit.ok ? `✓ ${approved.id} Sealed` : '✗ Seal Broken') : 'Needs 1 approval'}</span>
          </div>
          <b>What happens when a manager approves a discount here?</b>
          <p>${approved
            ? `<b>${esc(approved.decidedBy)}</b> approved <b>${approved.capPct}% off</b> for <b>${esc(approved.customer)}</b> (<code>${esc(approved.id)}</code>). It is sealed with SHA-256 fingerprint <code>${esc((approved.seal || '').slice(0, 8))}</code> so when the shop pays less, Finance's desk clears the ${approved.capPct}% automatically.`
            : `When Kavita or Arjun approves a discount, Ten Today seals the cap, expiry date, and SHA-256 fingerprint into a link for Finance so the customer's short-payment clears automatically on Day 0.`}</p>
          <div class="row" style="margin-top:6px">
            ${approved
              ? (audit.ok
                  ? `<a class="btn pri" href="${E.financeLink(w, approved.id)}" target="_blank" rel="noopener">Send ${esc(approved.id)} (${approved.capPct}% · 🔒 ${esc((approved.seal || '').slice(0, 8))}) to Every Rupee (Finance) ↗</a>`
                  : `<button type="button" class="btn" disabled>⛔ Blocked: Block #${audit.brokenAt} was tampered in DB (undo edit below first)</button>`)
              : `<button type="button" class="btn pri" data-q2c="quick-apv">✓ Approve Delta Pharma's 8% ask as Kavita to test Finance handoff →</button>`}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function switchTo(n) { for (const k in segOn) delete segOn[k]; tab = isRep(n) ? 'today' : 'approvals'; try { history.replaceState(null, '', '#' + tab); } catch { } actor = n; signedIn = true; result = null; panel = null; sealRes = null; sealEdit = 0; try { $('#panel').close(); } catch { } save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

/* ---------- sealed record: visible on every screen ---------- */
function renderSeal() {
  const el = $('#seal'); const n = w.chain.length;
  const audit = E.auditChain(w);
  const r0 = sealRes ? audit : null; const anc = E.verifyAnchored(w);
  const r = r0 && r0.ok && anc.anchorFail ? { ...r0, ok: false, anchorFail: true, brokenAt: anc.brokenAt } : r0;
  const st = b => !r ? '' : b.status === 'ok' ? 'ok' : b.status === 'tampered' ? 'bad' : 'after';
  const tag = b => ({ ok: '✓ matches seal', bad: '✗ edited in DB', after: '⚠ link broken' }[st(b)] ?? '');
  const blocks = audit.blocks.map((b, k) => `${k ? `<span class="link ${r && !r.ok && b.n >= r.brokenAt ? 'cut' : ''}" aria-hidden="true">→</span>` : ''}<div class="blk ${st(b)}"><small>#${b.n} · ${esc(b.who)}</small><span class="tx">${esc(b.text.length > 64 ? b.text.slice(0, 62) + '…' : b.text)}</span><code title="Stored seal: ${esc(b.storedHash)}">${esc(b.storedHash.slice(0, 8))}</code>${r && b.hashMismatch ? `<code style="background:#FEE2E2;border-color:#EF4444;color:#991B1B" title="Recomputed SHA-256: ${esc(b.recomputedHash)}">now: ${esc(b.recomputedHash.slice(0, 8))} ≠</code>` : ''}<em>${b.n === 1 ? 'first block' : `built from #${b.n - 1}'s <code>${esc(b.storedPrev.slice(0, 6))}</code>`}</em>${st(b) === 'bad' && w.tampered?.n === b.n ? `<em>was: <s>${esc(w.tampered.original.slice(0, 42))}…</s></em>` : ''}${tag(b) ? `<b>${tag(b)}</b>` : ''}</div>`).join('');
  const status = !r ? `<div class="res idle">Press <b>Verify</b> to check nothing was changed.</div>`
    : r.anchorFail ? `<div class="res no">✗ <b>Whole chain rewritten.</b> Every link looks consistent, but block #${r.brokenAt} no longer matches the anchor shared with ${esc(w.anchor.to)} at ${esc(w.anchor.at)}. An admin rewrite is caught too.</div>`
    : r.ok ? `<div class="res ok">✓ Checked just now as ${esc(E.label(actor))}: all ${r.count} fingerprints match${anc.anchored ? ` and the chain still ends at yesterday's anchor (${esc(w.anchor.hash.slice(0, 8))}, shared with ${esc(w.anchor.to)})` : ''}. No discount or decision was edited after the fact.</div>`
    : (() => {
        const badBlk = r.blocks[r.brokenAt - 1];
        const cascadeCount = n - r.brokenAt;
        return `<div class="res no">✗ <b>TAMPERING CAUGHT AT BLOCK #${r.brokenAt} (${esc(badBlk.who)}):</b><br>
        · Original sealed fingerprint: <code>${esc(badBlk.storedHash.slice(0, 20))}…</code><br>
        · New fingerprint after edit: <code>${esc(badBlk.recomputedHash.slice(0, 20))}…</code> (does not match!)<br>
        ${cascadeCount > 0 ? `· <b>Chain broken:</b> Block${cascadeCount > 1 ? 's' : ''} #${r.brokenAt + 1}–#${n} were built on Block #${r.brokenAt}, so they are automatically flagged too. Sending to Finance is locked.` : '· Sending to Finance is locked until the original record is restored.'}</div>`;
      })();
  el.className = 'seal' + (r && !r.ok ? ' bad' : '');
  el.innerHTML = `<div class="top"><div><b class="t">🔒 Signed decisions: if anyone edits one later, it shows</b> <span class="hint">· ${n} block${n === 1 ? '' : 's'}${w.anchor ? ` · anchored daily: ${esc(w.anchor.hash.slice(0, 8))} shared with ${esc(w.anchor.to)} at ${esc(w.anchor.at)}` : ''}</span></div>
    <div class="acts"><button class="btn ok" type="button" data-seal="verify">Verify record</button><button class="btn" type="button" data-seal="${w.tampered ? 'undo' : 'tamper'}">${w.tampered ? 'Undo the drill' : 'Run an audit drill'}</button></div></div>
    <div class="cv" id="cv">${blocks || '<p class="hint">Nothing recorded yet.</p>'}</div>
    ${sealEdit ? (() => { const e = w.chain[sealEdit - 1]; const liveCalc = E.sha256(JSON.stringify({ n: e.n, at: e.at, who: e.who, text: e.text, ref: e.ref, prev: e.prev })); return `<div class="dbx"><p class="k">⚠ Outside the app · raw database row (insider edit test)</p><p class="hint" style="margin:0 0 6px;color:#D6D3D1">There is no "Edit" button in the app. But what if someone with database access quietly changes a stored discount from <b>8%</b> to <b>12%</b>? Change the text below (or click the orange button) and press <b>Save &amp; check</b> to see how the SHA-256 fingerprint catches it immediately.</p>
      <div class="row"><label>Block<select id="db-n">${w.chain.map(x => `<option value="${x.n}" ${x.n === sealEdit ? 'selected' : ''}>#${x.n} · ${esc(x.who)} (${esc(x.text.slice(0, 36))}…)</option>`).join('')}</select></label>
      <button class="btn" type="button" data-seal="preset-inflate" style="background:#292524;color:#9FD1CA;border-color:#9FD1CA;font-size:.76rem;padding:6px 10px">⚡ Change discount % by +4% in DB</button></div>
      <label style="margin-top:6px">Stored database text (type anything below to tamper)<textarea id="db-text" rows="2">${esc(e.text)}</textarea></label>
      <div class="mono" style="margin:4px 0 0;font-size:.72rem;color:#A8A29E;display:grid;gap:2px">
        <span>who: <b>${esc(e.who)}</b> · time: <b>${esc(e.at)}</b></span>
        <span>original sealed fingerprint: <code style="background:#292524;color:#86EFAC;border-color:#3F3A36">${esc(e.hash.slice(0, 28))}…</code></span>
        <span id="db-live-hash">new fingerprint as you type: <code style="background:#292524;color:#9FD1CA;border-color:#3F3A36">${esc(liveCalc.slice(0, 28))}…</code></span>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:6px;color:#9FD1CA"><input type="checkbox" id="db-rebuild"> Admin with full access: also recompute every fingerprint after the edit</label>
      <div class="row" style="margin-top:8px"><button class="btn pri" type="button" data-seal="dbsave">Save to database &amp; verify</button><button class="btn" type="button" data-seal="dbcancel" style="background:transparent;color:#fff;border-color:#57534E">Cancel</button></div><div id="db-err"></div></div>`; })() : ''}
    ${status}
    <details class="how"><summary>Tamper-evident, not tamper-proof: what that means</summary><p class="hint" style="margin:6px 0 0">Tamper-evident, not tamper-proof: it detects edits, it doesn't prevent them. Same model as Microsoft's SQL Ledger (a chain of blocks plus a digest kept outside the database). Supports the auditor's Rule 11(g) check that the audit trail wasn't tampered with. Production writes it on the server.</p></details>
    <details class="how"><summary>Why this matters in plain words (3 steps)</summary><ol class="steps"><li><b>Digital seal.</b> Every ask, approval, counter-offer, or order creates a unique SHA-256 fingerprint from the person, time, and exact discount %.</li><li><b>Linked blocks.</b> Each block's fingerprint includes the block before it. If someone changes an old 6% approval to 10%, that block's fingerprint changes and breaks every block after it.</li><li><b>Checked by Finance.</b> When an approval is sent to Every Rupee (Finance), the fingerprint travels with it so Finance knows the discount wasn't altered on the way.</li></ol></details>`;
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
  const wrap = document.createElement('section'); wrap.className = 'tools card'; wrap.dataset.in = 'today'; wrap.setAttribute('aria-label', 'Manager tools');
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
    if (k === 0 || c.querySelector('.task') || c.id === 'asks' || (c.closest('[data-in]')?.dataset.in ?? 'today') !== 'today') return; // the main list, and every non-Today tab, stays open
    c.classList.add('fold'); if (!openCards.has(key)) c.classList.add('cl');
    h.setAttribute('role', 'button'); h.tabIndex = 0;
    h.onclick = () => { c.classList.toggle('cl'); c.classList.contains('cl') ? openCards.delete(key) : openCards.add(key); };
  });
}

/* ---------- do this next ---------- */
function renderNext() {
  const el = $('#next'); el.hidden = !result; if (el.hidden) return;
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
  const snap = `<section class="snap" aria-label="Since you started"><p class="k">Since you started · only your work, not compared with anyone</p><div class="tiles">
    <div class="${r.toAnswer ? 'warn' : ''}"><span>Asks with approvers</span><b>${r.waiting}</b><small>${r.toAnswer ? `${r.toAnswer} counter-offer waiting for your answer` : 'the clock is on them, not you'}</small></div>
    <div class="${r.expiring ? 'warn' : ''}"><span>Approved, not yet booked</span><b>${r.approvedOpen}</b><small>${r.expiring ? `${r.expiring} expiring within 3 days: book or re-ask` : 'book the order before the approval expires'}</small></div>
    <div><span>Orders booked</span><b>${r.orders}</b><small>${inr(r.booked)} · every one within its approval</small></div>
    <div><span>Done by the original date</span><b>${r.onTime === null ? '–' : r.onTime + '%'}</b><small>${r.done} task${r.done === 1 ? '' : 's'} done · moving a date doesn't reset it</small></div>
    <div class="${r.intact ? 'good' : 'bad'}"><span>Approval record</span><b>${r.intact ? '✓ Intact' : '✗ Altered'}</b><small>${r.blocks} of your decisions sealed · <a href="#seal">verify</a></small></div>
  </div></section>`;
  const row = (t, i) => `<li><button type="button" class="task ${i === 0 ? 'top' : ''} ${flashId === t.id ? 'flash' : ''}" data-open="${t.id}"><span class="rank">${i + 1}</span><span><span class="c">${esc(t.customer)}</span> ${tierChip(t)}<span class="chip p3">${esc(t.stage)}</span><div class="t">${esc(t.title)}</div><div class="why">${esc(E.explain(w, t))}</div></span><span class="val">${inr(t.value)}</span></button></li>`;
  const mini = (arr, f, none) => arr.length ? `<ul class="mini">${arr.map(t => `<li><button type="button" data-open="${t.id}"><b>${esc(t.customer)}</b> · ${f(t)}</button></li>`).join('')}</ul>` : `<p class="empty">${none}</p>`;
  const frozenLine = t => { const a = apvOf(t); return a?.status === 'countered' ? `<span class="chip st-bad">Counter: ${a.capPct}%</span> your answer needed` : `<span class="chip st-frozen">Waiting</span> ${a ? `${E.label(a.approver)} · ${a.askPct}% asked` : ''}`; };
  return `${coverCard()}${cnCard()}${impactCard()}<div id="c-week" data-in="pulse">${misTable()}${snap}</div><div class="grid">
    <div class="card" data-in="today"><h2>Today · ${q.list.length} of ${E.CAP}</h2><p class="sub">Ranked: past-target tier → money-blocking stage → days overdue → deal value (tie-break only). A callback pinned at the customer's time sits above the tiers.</p>
      ${q.list.length ? `<ol class="list">${q.list.map(row).join('')}</ol>` : '<p class="empty">Nothing due. Well done.</p>'}
      ${q.waiting ? `<p class="more">+${q.waiting} more due, kept out so Today stays at ${E.CAP}. They move up as you finish these.</p>` : ''}
    </div>
    <div class="side">
      <div class="card" id="c-myasks" data-in="approvals"><h2>Your discount asks</h2>${mini(ib.frozen, frozenLine, 'No discount asks open.')}</div>
      <div class="card" id="c-hold" data-in="today"><h2>On hold</h2>${mini(ib.hold, t => `back ${fmt(t.hold.revisit)} · ${esc(t.hold.reason)}`, 'Nothing on hold.')}</div>
      <div class="card" id="c-later" data-in="today"><h2>Coming up</h2>${mini(ib.later, t => `${fmt(t.target)} · ${esc(t.title)}`, 'Nothing scheduled.')}</div>
      <div class="card" id="c-done" data-in="today"><h2>Done</h2>${mini(ib.done, t => `${esc(t.outcome)} ${t.doneAt <= t.due ? '<span class="chip st-ok">on time</span>' : '<span class="chip st-bad">late</span>'}`, 'Nothing done yet today.')}</div>
      <div class="card" data-in="pulse"><h2>Team metric</h2><div class="metric"><div><b>${m.pct === null ? '–' : m.pct + '%'}</b><span>done by the original target (${m.onTime}/${m.done})</span></div><div><b>${m.movedThrice}</b><span>tasks moved 3+ times (guardrail)</span></div></div></div>
    </div></div>`;
}

/* ---------- approver desk ---------- */
function gstLine(a, pct, mode, rate) {
  const g = E.gstEffect(a.value, pct, mode, rate, w.today), D = fmtY(g.deadline ?? w.today);
  if (mode === 'invoice') return `<b>On the invoice:</b> the bill is simply ${inr(g.disc)} lower and GST is charged on the net price. Nothing to chase later.`;
  if (mode === 'gstcn') return `<b>GST credit note:</b> your GST on this sale drops by ${inr(g.gst)}, but only if ${esc(a.customer)} reverses the same ${inr(g.gst)} of input tax credit. Declare it by ${D} (s.34(2)), or the ${inr(g.gst)} stays paid.`;
  return `<b>Financial credit note:</b> ${inr(g.disc)} off, but your GST stays as billed (${inr(g.gst)} not reduced). The buyer keeps their input tax credit.`;
}
function askCard(a) {
  const lim = E.person(actor).senior ? a.askPct : Math.min(a.askPct, E.MANAGER_LIMIT, a.marginFloorPct);
  const exp = E.addDays(w.today, 14);
  return `<div class="ask ${flashId === a.id ? 'flash' : ''}" id="ask-${a.id}">
    <div class="top"><h3>${esc(a.customer)} · ${a.askPct}% asked ${a.escalated ? '<span class="chip st-bad">Escalated</span>' : ''}</h3><span class="chip ${E.waitingDays(w, a) >= 1 ? 'st-bad' : 'p3'}">waiting ${E.waitingDays(w, a)} day(s)</span></div>
    <p class="hint">${a.id} · asked by ${esc(E.label(a.rep))}: “${esc(a.reason)}”</p>
    <div class="facts"><div><span>Deal value</span><b>${inr(a.value)}</b></div><div><span>Margin floor</span><b>max ${a.marginFloorPct}%</b></div><div class="${a.routedBecause.some(r => r.startsWith('credit hold')) ? 'bad' : ''}"><span>Dealer credit</span><b>${inr(a.outstanding)} of ${inr(a.creditLimit)}</b><span>oldest bill ${a.oldestBillDays}d · allowed ${a.creditDays}d</span></div></div>
    <p class="hint">Ask: ${a.askPct}% before GST = <b>${inr(a.amount)}</b> off ${inr(a.value)}.</p>
    ${a.routedBecause.length ? `<p class="route">Sent to the sales head because: ${esc(a.routedBecause.join(', '))}.</p>` : ''}
    <div class="gstrow"><label>How is it given?<select data-f="gst">${Object.entries(E.GST_MODES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label>GST rate (sample)<select data-f="rate">${E.GST_RATES.map(x => `<option${x === 18 ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <p class="gstc" data-gstc="${a.id}">${gstLine(a, lim, 'invoice', 18)}</p>
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
function misTable() {
  return `<section class="mis" id="c-mis" aria-label="Weekly MIS"><div class="mis-h"><div><p class="k">Weekly MIS · computed live from this desk</p><h2>Is every control working?</h2></div><button class="btn" id="mis-dl2" type="button">⬇ CSV</button></div>
    <div class="mis-w"><table><thead><tr><th>KPI</th><th>This week</th><th>Target</th><th>Status</th><th class="hide-m">What it proves</th></tr></thead><tbody>${E.mis(w).map(r => `<tr><td>${esc(r.kpi)}</td><td><b data-rip="mis-${esc(r.kpi).slice(0, 24)}">${esc(r.value)}</b></td><td>${esc(r.target)}</td><td>${r.ok == null ? (r.value === '–' ? '<span class="chip">No data yet</span>' : '<span class="chip st-warn">● Watching</span>') : `<span class="chip ${r.ok ? 'st-ok' : 'st-bad'}">${r.ok ? (r.target === 'Tracked' ? '● Tracked' : '✓ Pass') : '✗ Fail'}</span>`}</td><td class="hide-m">${esc(r.proves)}</td></tr>`).join('')}</tbody></table></div>
    <p class="mis-f">Built like the weekly MIS I ran at HDFC Bank: 15+ KPIs, prep cut from 8 hours to 3. Here it takes zero prep. <b>Try it:</b> decide or leave an ask, or book an order, and watch a row change.</p></section>`;
}

/* Team & Cover: who is in, who is out, who has their work. Credit for covered deals stays with the person on leave. */
/* GST credit notes: what happens after a discount is given as a s.34 credit note (rules from 1 Nov 2026). */
let cnRemark = {};
function cnCard() {
  const notes = w.approvals.filter(a => a.status === 'approved' && a.cn && (a.gst?.mode === 'gstcn' || a.cn.settledAs));
  if (!notes.length) return '';
  const g = E.gstAtRisk(w), mgr = !isRep(actor);
  const row = a => {
    const fx = E.gstEffect(a.value, a.capPct, 'gstcn', a.gst.rate, a.decidedOn), by = E.imsDecideBy(a.cn.issuedOn), late = a.cn.ims === 'pending' && w.today > by;
    const tone = a.cn.settledAs ? 'none' : a.cn.ims === 'accepted' ? 'ok' : a.cn.ims === 'rejected' || late ? 'bad' : 'warn';
    const next = a.cn.settledAs ? `Settled as a financial credit note: the ${inr(fx.disc)} discount stands, GST stays as billed. Nothing to file.`
      : a.cn.ims === 'accepted' ? `Accepted in IMS. Your GST cut of ${inr(fx.gst)} holds.`
      : a.cn.ims === 'rejected' ? `Rejected: “${esc(a.cn.remark)}”. The ${inr(fx.gst)} GST cut doesn't hold. Fix the note, or settle it as a financial credit note before ${fmtY(fx.deadline)}.`
      : late ? `Pending past ${fmtY(by)}: the buyer has had a full tax period. Call them, or treat it as rejected.` : `Waiting for ${esc(a.customer)} to accept in IMS (by ${fmtY(by)}). Until then the ${inr(fx.gst)} cut doesn't hold.`;
    const msg = `Hi ${a.customer} team, credit note ${a.cn.no} for ${inr(fx.disc + fx.gst)} (${a.capPct}% discount + ${a.gst.rate}% GST, ref ${a.id}) is issued. Please accept it in IMS and reverse ${inr(fx.gst)} of input tax credit this month.`;
    const body = JSON.stringify(E.eInvoiceCrn(a), null, 2);
    return `<li class="cn ${tone}"><p class="cn-h"><b>${esc(a.customer)}</b> · ${a.cn.no} · ${inr(fx.disc)} + ${a.gst.rate}% GST = ${inr(fx.disc + fx.gst)} <span>${a.cn.settledAs ? 'Financial credit note' : 'GST credit note (s.34)'}</span></p><p class="cn-n">${next}</p>
      ${a.cn.settledAs ? '' : `<div class="cn-a">${mgr ? `<span class="cn-l">Buyer's IMS action, from the GST portal:</span><div class="seg" role="group" aria-label="IMS action for ${a.cn.no}">${['accepted', 'pending', 'rejected'].map(k => `<button type="button" data-ims="${k}" data-id="${a.id}" aria-pressed="${a.cn.ims === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>${a.cn.ims === 'rejected' ? `<button class="btn" type="button" data-fin="${a.id}">Settle as financial credit note</button>` : `<input class="cn-r" data-rem="${a.id}" placeholder="Their remark, if rejecting" value="${esc(cnRemark[a.id] ?? '')}">`}` : `<span class="cn-l">Buyer's IMS action: <b>${a.cn.ims}</b> (finance records it)</span>`}</div>
      <details class="api cn-more"><summary>Message for the buyer · e-invoice (CRN)</summary><button class="btn" type="button" data-copy="${esc(msg)}">Copy message for the buyer</button><p class="api-n">NIC e-invoice schema, document type CRN, referring to the original sale. Needed where e-invoicing applies. GSTIN, HSN and invoice fields are placeholders. Sample payload, not sent to the IRP.</p><pre>${esc(body)}</pre><button class="btn" type="button" data-copy="${esc(body)}">Copy payload</button></details>`}</li>`;
  };
  return `<section class="card cnc" id="gst-cn" data-in="approvals pulse"><p class="k">GST credit notes · rules in force from 1 Nov 2026</p><h2>${g.count ? `${inr(g.gst)} of GST relief doesn't hold yet` : 'Every GST cut you claimed holds'}</h2>
  <p class="hint">A post-sale discount cuts your GST only through a s.34 credit note, and only once the buyer reverses the same input tax credit by accepting it in IMS.${g.deadline ? ` Declare by <b>${fmtY(g.deadline)}</b> (${g.daysLeft} days), or the GST stays paid for good.` : ''}</p>
  <ul class="cnl">${notes.map(row).join('')}</ul>
  <div class="cn-f"><button class="btn" type="button" id="gstr1-dl">⬇ GSTR-1 Table 9B (JSON)</button><small>Credit notes to registered buyers, in the GST offline-tool format. Financial credit notes are left out. Sources: Finance Act 2026 · Notification 03/2026-CT · CBIC Circular 251/08/2025 · GSTN IMS advisory. A workflow, not tax advice.</small></div></section>`;
}
function coverCard() {
  const reps = E.PEOPLE.filter(p => p.rep), out = reps.filter(p => E.activeCover(w, p.name));
  const orphan = w.tasks.filter(t => t.status === 'open' && E.activeCover(w, t.rep)).length;
  const strip = `<div class="cv-strip"><span><b>${reps.length - out.length}</b> in</span><span><b>${out.length}</b> on leave${out.length ? ` (${out.map(p => `${esc(p.name)} till ${fmt(E.activeCover(w, p.name).end)}`).join(', ')})` : ''}</span><span class="${orphan ? 'bad' : 'ok'}">${orphan ? `${orphan} deal${orphan === 1 ? '' : 's'} with nobody` : 'Every open deal has an owner'}</span></div>`;
  const rows = out.map(p => { const c = E.activeCover(w, p.name), n = w.tasks.filter(t => t.coverFor === p.name && t.status === 'open').length;
    return `<div class="cv-row"><div><b>${esc(p.name)} is on leave till ${fmt(c.end)}.</b> ${n ? `${n} of ${p.name === 'Imran' ? 'his' : 'their'} deals ${n === 1 ? 'is' : 'are'} with <b>${esc(c.to)}</b>` : `Nothing open; ${esc(c.to)} covers anything new`}, still credited to ${esc(p.name)}.</div>${isRep(actor) ? '' : `<button class="btn" type="button" data-cover="end" data-rep="${p.name}">Hand back to ${esc(p.name)}</button>`}</div>`; }).join('');
  const mine = isRep(actor) ? (() => { const c = (w.covers ?? []).find(x => x.to === actor && E.activeCover(w, x.rep)); const n = c ? w.tasks.filter(t => t.coverFor === c.rep && t.rep === actor && t.status === 'open').length : 0; return c ? `<p class="cv-me">You're covering <b>${esc(c.rep)}</b> till ${fmt(c.end)}: ${n} of his deals are in your list, marked “for ${esc(c.rep)}”. The credit stays his.</p>` : E.activeCover(w, actor) ? `<p class="cv-me">You're on leave. Your deals are with ${esc(E.activeCover(w, actor).to)}.</p>` : ''; })() : '';
  const form = isRep(actor) ? '' : `<details class="cv-form"${out.length ? '' : ' open'}><summary>Someone going on leave?</summary><div class="row"><label>Who<select id="cv-rep">${reps.map(p => `<option>${p.name}</option>`).join('')}</select></label><label>Covered by<select id="cv-to">${reps.map(p => `<option${p.name === 'Rahul' ? ' selected' : ''}>${p.name}</option>`).join('')}</select></label><label>From<input type="date" id="cv-from" value="${w.today}"></label><label>Till<input type="date" id="cv-end" value="${E.addDays(w.today, 3)}"></label></div><button class="btn pri" type="button" data-cover="start">Hand over their deals</button><p class="hint">Cover goes to someone who handles the same dealers. Credit stays with the person on leave.</p></details>`;
  return `<section class="card cov" id="cover" data-in="team"><h2>Who's in, who's covering</h2>${strip}${rows}${mine}${form}</section>`;
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

  return `${coverCard()}${cnCard()}${impactCard()}<div id="c-week" data-in="pulse">${misTable()}${snap}</div><div class="grid">
    <div class="side">
      <div class="card" id="asks" data-in="approvals"><h2>Discount asks for you · ${d.length}</h2><p class="sub">Each shows the three numbers you need: the ask, the margin floor and the dealer's credit.</p>
        ${d.length ? d.map(askCard).join('') : '<p class="empty">Nothing waiting for you.</p>'}
        ${others.length ? `<p class="more">${others.length} other ask(s) waiting for ${others.map(a => esc(E.label(a.approver))).join(', ')}.</p>` : ''}
      </div>
      <div class="card" id="c-decided" data-in="approvals"><h2>Decided</h2>${decided.length ? `<ul class="mini">${decided.map(a => `<li><b>${esc(a.customer)}</b> · ${a.askPct}% asked by ${esc(a.rep)} · ${statusChip(a)}${a.gst ? ` · <span class="chip">${esc(E.GST_MODES[a.gst.mode])}</span>${payloadBox(a, a.customer)}` : ''} <small>by ${esc(a.decidedBy ?? '')}</small>${a.seal ? ` <span class="sealchip" title="Fingerprint in the sealed record">🔒 ${esc(a.seal.slice(0, 8))}</span>` : ''}${a.actingFor ? ` <small class="hint">acting for ${esc(a.actingFor)}</small>` : ''}${a.used ? ` <span class="chip st-ok">used on ${esc(a.orderId)}</span>` : ''}${a.status === 'approved' ? `<br><span class="hint">${a.capPct}% before GST = ${inr(a.amount)}${a.override ? ` · credit override: ${esc(a.override)}` : ''}</span><br><a class="btn link" href="${E.financeLink(w, a.id)}" target="_blank" rel="noopener">Send ${a.id} to finance in Every Rupee ↗</a> · <button type="button" class="btn link" data-chk="${a.id}">Check what was really approved</button>` : ''}</li>`).join('')}</ul>` : '<p class="empty">No decisions yet.</p>'}</div>
    </div>
    <div class="side">
      <div class="card" id="team" data-in="today team"><h2>Team workload</h2><p class="sub">Who has more than ${E.CAP} due. No productivity scores.</p>
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
      ${E.person(actor).senior ? '' : (() => { const d = (w.delegations ?? []).find(x => x.from === actor); const subs = E.PEOPLE.filter(p => p.approver && p.name !== actor); return `<div class="card" id="leave" data-in="team"><h2>Going on leave?</h2><p class="sub">Hand your approvals to a stand-in for set dates. Every decision is logged as “acting for ${esc(actor)}”, with the same limits.</p>${d ? `<div class="wait">Handed to <b>${esc(E.label(d.to))}</b> from ${fmt(d.start)} to ${fmt(d.end)}. <button class="btn link" data-leave="end" type="button">End it now</button></div>` : `<div class="row"><label>Stand-in<select id="l-to">${subs.map(p => `<option value="${p.name}">${esc(E.label(p.name))}</option>`).join('')}</select></label><label>From<input type="date" id="l-from" value="${w.today}"></label><label>To<input type="date" id="l-end" value="${E.addDays(w.today, 3)}"></label></div><button class="btn" data-leave="go" type="button" style="margin-top:8px">Hand over</button><div id="l-err"></div>`}</div>`; })()}
      ${(() => { const e = E.effectiveness(w); return `<div class="card" id="eff" data-in="pulse"><h2>Do discounts win deals?</h2><p class="sub">Last quarter plus every order and loss recorded here (${e.n} deals). Discount use, not rep scoring.</p><div class="metric"><div><b>${e.withDisc ?? '–'}%</b><span>won with a discount</span></div><div><b>${e.without ?? '–'}%</b><span>won without one</span></div></div><table style="margin-top:10px"><thead><tr><th>Rep</th><th>Deals</th><th>Discounted</th><th>Avg %</th><th>Won w/ disc.</th><th>Won w/o</th></tr></thead><tbody>${e.by.map(r => `<tr><td>${esc(r.rep)}</td><td>${r.deals}</td><td>${r.discounted}</td><td>${r.avgPct ?? '–'}</td><td>${r.withDisc ?? '–'}%</td><td>${r.without ?? '–'}%</td></tr>`).join('')}</tbody></table></div>`; })()}
      <div class="card" id="data" data-in="pulse"><h2>Your data</h2><p class="sub">Import dealers or open tasks from CSV. A file with any bad row is rejected whole, with the line numbers. Export approvals and orders with their fingerprints.</p>
        <div class="row"><label>Dealers CSV<input type="file" accept=".csv,text/csv" id="imp-dealers"></label><label>Tasks CSV<input type="file" accept=".csv,text/csv" id="imp-tasks"></label></div>
        <p class="hint" style="margin-top:6px">Dealer columns: ${E.DEALER_COLS.join(', ')} · Task columns: ${E.TASK_COLS.join(', ')} (leave rep blank to auto-assign by bucket) · <button class="btn link" data-tpl="dealers" type="button">dealer template</button> · <button class="btn link" data-tpl="tasks" type="button">task template</button></p>
        <div class="row" style="margin-top:6px"><button class="btn" data-exp="approvals" type="button">Export approvals</button><button class="btn" data-exp="orders" type="button">Export orders</button></div><div id="imp-res"></div></div>
      <div class="card" id="schemes" data-in="approvals"><h2>Schemes</h2><p class="sub">A live slab applies without an ask. A new scheme needs a second person to approve it.</p>
        <ul class="mini">${(w.schemes ?? []).map(sc => `<li><b>${sc.id}</b> · ${esc(sc.name)} <span class="chip ${sc.status === 'active' ? 'st-ok' : 'st-frozen'}">${sc.status === 'active' ? 'Live' : 'Waiting for approval'}</span><br><small class="hint">by ${esc(sc.maker)}${sc.checker ? `, approved by ${esc(sc.checker)}` : ''}</small>${sc.status === 'pending' ? (sc.maker === actor ? '<br><span class="hint">You proposed it, so someone else must approve it.</span>' : `<br><button class="btn" style="margin-top:4px" data-sch="${sc.id}" type="button">Approve ${sc.id}</button>`) : ''}</li>`).join('')}</ul>
        <div class="box" style="margin-top:10px"><b>Propose a scheme</b><div class="row"><label style="flex:1">Name<input id="s-name" maxlength="60" placeholder="e.g. Festive slab 2%"></label><label>Min order (₹)<input id="s-min" type="number" value="100000" style="width:120px"></label><label>%<input id="s-pct" type="number" step="0.5" value="2" style="width:70px"></label></div><button class="btn" id="s-go" type="button">Propose</button><div id="s-err"></div></div>
      </div>
      <div class="card" id="turn" data-in="pulse"><h2>Approval turnaround</h2><table><thead><tr><th>Approver</th><th>Decided</th><th>Avg days</th><th>Escalated away</th></tr></thead><tbody>${E.turnaround(w).map(r => `<tr><td>${esc(E.label(r.name))}</td><td>${r.decided}</td><td>${r.avgDays ?? '–'}</td><td class="${r.escalatedAway ? 'over' : ''}">${r.escalatedAway}</td></tr>`).join('')}</tbody></table><p class="hint" style="margin-top:6px">An ask not decided within ${E.SLA_DAYS} day moves to the sales head.</p></div>
      <div class="card" id="act" data-in="approvals"><h2>Activity</h2>${w.audit.length ? `<ul class="hist">${w.audit.slice(-8).reverse().map(l => `<li><small>${time(l.at)} · ${esc(E.label(l.who))}</small>${esc(l.text)}</li>`).join('')}</ul>` : '<p class="empty">No activity yet.</p>'}</div>
    </div></div>`;
}

/* ---------- task panel ---------- */
const wide = () => matchMedia('(min-width:1100px)').matches;
function openTask(id, tab) { panel = { id, tab: tab ?? null, err: '', done: null }; renderPanel(); const d = $('#panel'); if (!d.open) { wide() ? d.show() : d.showModal(); } document.body.classList.toggle('insp', wide()); document.querySelectorAll('.task.sel').forEach(x => x.classList.remove('sel')); document.querySelector(`.task[data-open="${id}"]`)?.classList.add('sel'); }
/* The deal as a thread: people's messages, with Ten Today speaking only when a rule applies. Built from the real history. */
function threadHtml(t) {
  const out = [], aps = w.approvals.filter(a => a.taskId === t.id), apv = id => aps.find(a => a.id === id);
  const tm = at => { try { return new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
  const msg = (who, text, at, side) => out.push(`<div class="tb ${side}"><p class="tb-w">${esc(who)}${at ? ` · ${tm(at)}` : ''}</p><div class="tb-m">${text}</div></div>`);
  const sys = (tone, text) => out.push(`<div class="ts ${tone}"><span>${text}</span></div>`);
  out.push(`<div class="td">${esc(t.stage)} · ${inr(t.value)} · owned by ${esc(t.rep)}${t.coverFor ? ` for ${esc(t.coverFor)} (on leave; credit stays his)` : ''}</div>`);
  for (const l of t.log) {
    const ask = /\((APV-[\d-]+)\)/.exec(l.text), a = ask && /^Asked/.test(l.text) ? apv(ask[1]) : null;
    if (a) {
      msg(`${a.customer}, as noted by ${a.rep}`, `“${esc(a.reason)}”`, null, 'buyer');
      msg(a.rep, `Asking ${esc(E.label(a.approver).split(' · ')[0])} for <b>${a.askPct}%</b> (${inr(E.rupeesOff(a.value, a.askPct))} off).`, l.at, a.rep === actor ? 'me' : 'them');
      const floor = E.dealerFloor(w, a.customer), cr = E.creditCheck(w, a.customer);
      sys(a.routedBecause.length ? 'warn' : 'ok', `${a.askPct <= floor ? '✓ Within the margin floor' : `! Below the margin floor (max ${floor}%)`} · ${a.askPct <= E.MANAGER_LIMIT ? `✓ within Kavita's ${E.MANAGER_LIMIT}%` : `! above Kavita's ${E.MANAGER_LIMIT}%`} · ${cr.ok ? '✓ credit clear' : '! credit hold'}. ${esc(E.label(a.approver).split(' · ')[0])} decides; silence for a working day moves it up. The task waits.`);
      continue;
    }
    const dec = /^(APV-[\d-]+) approved/.exec(l.text), d = dec ? apv(dec[1]) : null;
    if (d) {
      msg(d.decidedBy, `Approved <b>${d.capPct}%</b>${d.capPct < d.askPct ? ` (asked ${d.askPct}%)` : ''}${d.gst ? ` · ${esc(E.GST_MODES[d.gst.mode].toLowerCase())}` : ''}.`, l.at, d.decidedBy === actor ? 'me' : 'them');
      const g = d.gst ? E.gstEffect(d.value, d.capPct, d.gst.mode, d.gst.rate, d.decidedOn) : null;
      sys('ok', `🔒 Sealed${d.seal ? ` (${d.seal.slice(0, 8)})` : ''}: ${inr(g?.disc ?? d.amount)} off ${inr(d.value)}, valid to ${fmt(d.validTo)}.${g && d.gst.mode === 'gstcn' ? ` The buyer must reverse ${inr(g.gst)} of ITC.` : ''} Nobody can book above this.`);
      continue;
    }
    msg(l.who === 'System' ? 'Ten Today' : l.who, esc(l.text), l.at, l.who === 'System' ? 'sysm' : l.who === actor ? 'me' : 'them');
  }
  for (const a of aps) {
    if (a.status === 'pending') sys('warn', `⏳ Waiting on ${esc(E.label(a.approver).split(' · ')[0])}. ${E.waitingDays(w, a) >= 1 ? 'Past a working day: it moves up next.' : 'Decided by the end of tomorrow, or it moves up.'}`);
    if (a.cn && a.gst?.mode === 'gstcn') { const g = E.gstEffect(a.value, a.capPct, 'gstcn', a.gst.rate, a.decidedOn); sys(a.cn.ims === 'accepted' ? 'ok' : a.cn.ims === 'rejected' ? 'bad' : 'warn', a.cn.ims === 'accepted' ? `IMS: ${esc(a.customer)} accepted credit note ${a.cn.no}. The ${inr(g.gst)} GST cut holds.` : a.cn.ims === 'rejected' ? `IMS: ${esc(a.customer)} rejected ${a.cn.no}: “${esc(a.cn.remark)}”. The ${inr(g.gst)} GST cut doesn't hold. Fix by ${fmtY(g.deadline)}.` : `IMS: credit note ${a.cn.no} is with ${esc(a.customer)} to accept (by ${fmtY(E.imsDecideBy(a.cn.issuedOn))}).`); }
    if (a.cn?.settledAs) sys('none', `${a.cn.no} settled as a financial credit note: discount stands, GST stays as billed.`);
  }
  if (t.log.length === 0) sys('none', `Nothing on this deal yet. It's on today's list because it's ${esc(why1(t))}.`);
  return `<div class="thread">${out.join('')}</div>`;
}
function renderPanel() {
  if (!panel) return;
  const t = w.tasks.find(x => x.id === panel.id); const a = apvOf(t);
  const mine = t.rep === actor;
  const tabs = [];
  if (t.kind === 'cure' && t.status === 'open' && (mine || !isRep(actor))) tabs.push(['cure', 'Clear the gap']);
  else if (mine && t.status === 'open') tabs.push(['done', '✓ Done'], ['move', 'Reschedule'], ['hold', 'On hold']);
  const scheme = (w.schemes ?? []).find(x => x.status === 'active' && t.value >= x.minValue);
  if (mine && t.status === 'open' && ['Quote sent', 'Negotiation'].includes(t.stage)) { tabs.push(['order', 'Place order']); if (scheme && !t.scheme) tabs.push(['scheme', 'Apply scheme']); if (!(a && a.status === 'approved' && !a.used)) tabs.push(['ask', 'Ask discount']); tabs.push(['lost', 'Deal lost']); }
  const al = E.allowedPct(w, t);
  if (mine && a?.status === 'countered') tabs.unshift(['counter', 'Answer counter']);
  if (!panel.tab || !tabs.some(x => x[0] === panel.tab)) panel.tab = tabs[0]?.[0] ?? null;
  const tomorrow = E.addDays(w.today, 1);
  const co = t.kind === 'cure' ? w.orders.find(o => o.id === t.source) : null;
  const forms = {
    cure: co ? `<p class="hint" style="margin:0 0 8px">${esc(t.customer)} paid ${inr(co.paid.received)} against ${inr(E.netOf(co))}. Clear the ${inr(co.incentive.gap)} gap by ${fmtY(co.incentive.cureBy)} and the ${inr(co.incentive.held)} on hold becomes earned. Miss it, and that part is simply not earned. Nothing is ever deducted from pay.</p><div class="row"><label>How<select id="f-how"><option value="collected">Collected the balance</option><option value="approved">Approved after the fact</option></select></label><label style="flex:1">UTR, cheque or approval reference<input id="f-ref" maxlength="40" placeholder="e.g. HDFCN52026111212345"></label></div><button class="btn pri" data-do="cure" type="button">Clear the gap</button>` : '',
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
  if (a?.status === 'pending' && E.decisionsFor(w, actor).some(x => x.id === a.id)) state = `<div class="decide"><p class="rail-k">Your decision</p>${askCard(a)}</div>`;
  if (t.status === 'hold') state = `<div class="wait">On hold: ${esc(t.hold.reason)}. Back in Today on ${fmt(t.hold.revisit)}. ${mine ? '<button class="btn link" data-do="resume" type="button">Take it off hold now</button>' : ''}</div>`;
  if (t.status === 'done') state = `<div class="done">Done: ${esc(t.outcome)}</div>`;
  if (!mine && t.status === 'open') state = `<div class="wait">This is ${esc(E.label(t.rep))}'s task. <button class="btn link" data-actor="${t.rep}" type="button">Sign in as ${esc(t.rep)} →</button></div>`;
  $('#panel-body').innerHTML = `
    <div class="ph"><button class="back" data-close aria-label="Back" type="button">‹</button><span class="av" aria-hidden="true">${esc(t.customer.split(' ').map(x => x[0]).join('').slice(0, 2))}</span><div><h2 id="p-title" style="margin:0">${esc(t.customer)}</h2><p class="hint">${esc(t.title)}</p></div><button class="x" data-close aria-label="Close" type="button">×</button></div>
    ${threadHtml(t)}
    ${t.scheme ? `<p class="hint">Scheme ${t.scheme.id} applied: ${t.scheme.pct}% before GST = ${inr(t.scheme.amount)}.</p>` : ''}
    ${(() => { const c = E.creditCheck(w, t.customer); return c.creditLimit ? `<p class="hint">Dealer credit: ${inr(c.outstanding)} of ${inr(c.creditLimit)} used · oldest bill ${c.oldestBillDays}d of ${c.creditDays}d allowed${c.ok ? '' : ` · <b style="color:var(--bad)">credit hold</b>`}</p>` : ''; })()}
    ${(() => { const ap = w.approvals.find(x => x.taskId === t.id && x.status === 'approved' && !x.used); if (!ap || !mine) return ''; const off = E.rupeesOff(ap.value, ap.capPct); return `<div class="done"><b>Approved: ${ap.capPct}% by ${esc(E.label(ap.decidedBy).split(' · ')[0])}.</b> The buyer can have exactly this, and Every Rupee will check payment against it.</div>` + waText(`Hi ${t.customer} team, confirmed: ${ap.capPct}% off your order of ${inr(ap.value)}, so ${inr(ap.value - off)} before GST. Valid till ${fmt(ap.validTo)}. ${ap.gst?.mode === 'gstcn' ? `It comes as a GST credit note after delivery: please accept it in IMS and reverse ${inr(E.gstEffect(ap.value, ap.capPct, 'gstcn', ap.gst.rate, ap.decidedOn).gst)} of input tax credit that month. ` : ap.gst?.mode === 'fincn' ? 'It comes as a financial credit note; your GST input stays as billed. ' : 'It will show on the invoice itself. '}Ref ${ap.id}${ap.seal ? ` · ${ap.seal.slice(0, 8)}` : ''}.`) + payloadBox(ap, t.customer); })()}
    ${panel.done ? `<div class="done">${panel.done}</div>` : ''}
    ${state}
    ${panel.err ? `<div class="err" role="alert">${esc(panel.err)}</div>` : ''}
    ${panel.tab && !panel.done ? `<div class="tabs">${tabs.map(([k, l]) => `<button type="button" class="${k === panel.tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="box">${forms[panel.tab]}</div>` : ''}
    `;
  if (panel.tab === 'ask') routePreview();
}
function routePreview() {
  const t = w.tasks.find(x => x.id === panel.id); const pct = Number($('#f-pct')?.value || 0); const el = $('#f-route'); if (!el) return;
  const r = E.approverFor(w, t.customer, pct), floor = E.dealerFloor(w, t.customer), cr = E.creditCheck(w, t.customer);
  const off = E.rupeesOff(t.value, pct), who = E.label(r.approver).split(' · ')[0];
  const line = (ok, txt) => `<li class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '!'} ${txt}</li>`;
  el.innerHTML = `<div class="cp"><div><span>Customer pays, before GST</span><b>${inr(t.value - off)}</b></div><div><span>Discount</span><b>${inr(off)}</b></div><div><span>Margin left*</span><b>${E.marginAfter(pct)}%</b></div></div>
  <ul class="cp-c">${line(pct <= floor, `${pct <= floor ? 'Within' : 'Below'} this dealer's margin floor (max ${floor}%)`)}${line(pct <= E.MANAGER_LIMIT, pct <= E.MANAGER_LIMIT ? `Within Kavita's ${E.MANAGER_LIMIT}% limit` : `Above Kavita's ${E.MANAGER_LIMIT}% limit`)}${line(cr.ok, cr.ok ? 'Dealer credit is clear' : `Credit hold: ${esc(cr.why.join(', '))}`)}</ul>
  <p class="cp-w"><b>${esc(who)} decides.</b> Not decided by the end of tomorrow, it ${r.approver === 'Arjun' ? 'stays top of his queue' : 'moves to Arjun on its own'}. Your task waits; you don't chase.</p>
  <p class="cp-f">*At a typical FMCG gross margin of ${E.FMCG_GROSS_MARGIN}% (HUL FY25). Your own margins will differ.</p>`;
}
function payloads(ap, cust) {
  const g = E.gstEffect(ap.value, ap.capPct, ap.gst?.mode ?? 'invoice', ap.gst?.rate ?? 18, ap.decidedOn ?? w.today), half = Math.round(g.gst / 2 * 100) / 100;
  if ((ap.gst?.mode ?? 'invoice') === 'invoice') {
    const ass = ap.value - g.disc, tax = Math.round(ass * (ap.gst?.rate ?? 18)) / 100;
    const j = { SlNo: '1', PrdDesc: `${cust} order (${ap.id})`, IsServc: 'N', HsnCd: 'sample', Qty: 1, Unit: 'OTH', UnitPrice: ap.value, TotAmt: ap.value, Discount: g.disc, AssAmt: ass, GstRt: ap.gst?.rate ?? 18, CgstAmt: tax / 2, SgstAmt: tax / 2, TotItemVal: ass + tax };
    return { title: 'E-invoice item line', note: 'Field names from the NIC e-invoice schema (ItemList). The discount sits on the invoice, so GST is charged on AssAmt. Sample payload, not sent to the IRP.', body: JSON.stringify(j, null, 2) };
  }
  const gstcn = ap.gst.mode === 'gstcn', party = gstcn ? g.disc + g.gst : g.disc;
  const le = (n, pos, amt) => `      <ALLLEDGERENTRIES.LIST><LEDGERNAME>${n}</LEDGERNAME><ISDEEMEDPOSITIVE>${pos}</ISDEEMEDPOSITIVE><AMOUNT>${amt}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
  const xml = `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
<BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA><TALLYMESSAGE>
  <VOUCHER VCHTYPE="Credit Note" ACTION="Create">
    <DATE>${(ap.decidedOn ?? w.today).replaceAll('-', '')}</DATE><VOUCHERTYPENAME>Credit Note</VOUCHERTYPENAME>
    <PARTYLEDGERNAME>${cust}</PARTYLEDGERNAME>
    <NARRATION>${ap.capPct}% discount, ${ap.id}${ap.seal ? `, seal ${ap.seal.slice(0, 12)}` : ''}${gstcn ? ', s.34 GST credit note' : ', financial credit note (no GST change)'}</NARRATION>
${le('Trade Discount Allowed', 'Yes', -g.disc)}
${gstcn ? `${le('Output CGST', 'Yes', -half)}
${le('Output SGST', 'Yes', -half)}
` : ''}${le(cust, 'No', party)}
  </VOUCHER>
</TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
  return { title: `Tally credit note (${gstcn ? 'GST' : 'financial'})`, note: `Tally XML import format. Debits are negative in Tally; the entry balances to zero.${gstcn ? ` The buyer must reverse ${inr(g.gst)} of ITC (they accept the note in IMS).` : ''} Sample payload, not posted.`, body: xml };
}
const payloadBox = (ap, cust) => { const p = payloads(ap, cust); return `<details class="api"><summary>⇄ ${esc(p.title)} <span>integration preview</span></summary><p class="api-n">${esc(p.note)}</p><pre>${esc(p.body)}</pre><button class="btn" type="button" data-copy="${esc(p.body)}">Copy payload</button></details>`; };
const fmtY = d => { const [y, m, dd] = d.split('-').map(Number); return `${dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${y}`; };
const waText = s => `<div class="wa"><p class="wa-l">Message for the buyer · ready to send</p><p class="wa-t">${esc(s)}</p><button class="btn" type="button" data-copy="${esc(s)}">Copy for WhatsApp</button></div>`;
function panelAction(kind) {
  const t = w.tasks.find(x => x.id === panel.id); const v = s => $(s)?.value ?? '';
  panel.err = '';
  const ok = html => { panel.done = html; flashId = t.id; };
  if (kind === 'cure') act(() => E.cureGap(w, t.id, actor, v('#f-how'), v('#f-ref')), 'Gap cleared.', () => ok(`✓ Cleared. ${esc(t.rep)}'s incentive on this order is earned in full.`));
  if (kind === 'done') act(() => E.complete(w, t.id, actor, v('#f-out'), $('#f-moved')?.checked), 'Marked done.', out => ok(out.next ? `✓ Done. The deal moved to <b>${esc(out.next.stage)}</b>, so the next task was created: ${esc(out.next.title)} (due ${fmt(out.next.due)}).<div class="row"><button class="btn" data-open="${out.next.id}" type="button">Open the new task</button><button class="btn pri" data-close type="button">Back to Today</button></div>` : `✓ Done and logged.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'move') act(() => E.reschedule(w, t.id, actor, v('#f-date'), v('#f-block')), 'Rescheduled.', () => ok(`✓ Moved to ${fmt(v('#f-date'))}. It's in “Coming up” and still ages from ${fmt(t.due)}.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'hold') act(() => E.putOnHold(w, t.id, actor, v('#f-why'), v('#f-rev')), 'On hold.', () => ok(`✓ On hold until ${fmt(v('#f-rev'))}. It returns to Today by itself then.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'scheme') { const sc = w.schemes.find(x => x.id === $('[data-do="scheme"]').dataset.s); act(() => E.applyScheme(w, t.id, actor, sc.id), 'Scheme applied.', () => ok(`✓ ${sc.id} applied: ${sc.pct}% before GST = ${inr(E.rupeesOff(t.value, sc.pct))} off. Pre-approved, so no ask was needed.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`)); }
  if (kind === 'order') act(() => E.placeOrder(w, t.id, actor, Number(v('#f-val')), Number(v('#f-disc'))), 'Order placed.', out => ok(`✓ ${out.order.id} placed: ${inr(out.order.value)} at ${out.order.discountPct}% before GST (${inr(out.order.discountAmt)} off). Sealed as <code>${esc(out.order.seal.slice(0, 12))}</code>.${out.order.approvalId ? ` ${esc(out.order.approvalId)} is now used and can't cover another order.` : ''}<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>`));
  if (kind === 'lost') act(() => E.markLost(w, t.id, actor, v('#f-lost')), 'Marked lost.', () => ok('✓ Marked lost. It counts in the discount-effectiveness view.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>'));
  if (kind === 'resume') act(() => E.resume(w, t.id, actor), 'Back in Today.', () => ok('✓ Back in Today.'));
  if (kind === 'ask') act(() => E.askDiscount(w, t.id, actor, Number(v('#f-pct')), v('#f-reason')), 'Ask sent.', out => { const a = out.approvals.at(-1); ok(waText(`Hi ${t.customer} team, I've taken your ${a.askPct}% request to my manager. You'll have a confirmed price from me by tomorrow evening.`) + `✓ Sent ${a.id} to <b>${esc(E.label(a.approver))}</b>. This task is frozen until they decide, so it has left your Today.<div class="row"><button class="btn pri" data-actor="${a.approver}" type="button">Sign in as ${esc(a.approver)} →</button><button class="btn" data-close type="button">Back to Today</button></div>`); });
  if (kind === 'accept' || kind === 'decline') { const a = apvOf(t); act(() => E.respondCounter(w, a.id, actor, kind === 'accept'), kind === 'accept' ? 'Counter accepted.' : 'Counter declined.', () => ok(kind === 'accept' ? `✓ Accepted ${a.capPct}%. The task is back in Today: send the revised quote.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>` : '✓ Declined. The task is back in Today to negotiate without a discount.<div class="row"><button class="btn pri" data-close type="button">Back to Today</button></div>')); }
}
function decide(kind, id) {
  const card = $(`#ask-${CSS.escape(id)}`); const f = n => card.querySelector(`[data-f="${n}"]`).value;
  const a = w.approvals.find(x => x.id === id);
  const run = { approve: () => E.approve(w, id, actor, Number(f('cap')), f('exp'), f('why'), { mode: f('gst') || 'invoice', rate: Number(f('rate') || 18) }), counter: () => E.counter(w, id, actor, Number(f('cap')), f('exp'), f('why')), back: () => E.sendBack(w, id, actor, f('why')) }[kind];
  const text = { approve: `Approved ${f('cap')}% for ${a.customer}: ₹${Math.round(a.value * f('cap') / 100).toLocaleString('en-IN')} off a ₹${a.value.toLocaleString('en-IN')} order${Number(f('cap')) < a.askPct ? `, ₹${Math.round(a.value * (a.askPct - f('cap')) / 100).toLocaleString('en-IN')} less than asked` : ''}. Valid to ${fmt(f('exp'))}.`, counter: `Offered ${f('cap')}% to ${a.rep} for ${a.customer}.`, back: `Sent ${a.customer}'s ask back to ${a.rep}.` }[kind];
  const sub = { approve: `${a.rep}'s task is unfrozen and back in Today as “send the revised quote”. Use “Send to finance” under Decided so Every Rupee checks payments against this cap.`, counter: `${a.rep} must accept or decline. Their task stays frozen until then.`, back: `${a.rep}'s task is back in Today with your note, so they can fix it and ask again.` }[kind];
  try { w = run(); save(); toast(text); const sealed = w.approvals.find(x => x.id === id)?.seal; sealRes = null; result = { text: text + (kind === 'approve' && sealed ? ` Sealed as ${sealed.slice(0, 12)}.` : ''), sub, switchTo: a.rep }; flashId = a.taskId; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch (e) { let el = card.querySelector('.err'); if (!el) { el = document.createElement('div'); el.className = 'err'; el.setAttribute('role', 'alert'); card.prepend(el); } el.textContent = e.message; }
}

const RIP = () => Object.fromEntries([...document.querySelectorAll('[data-rip]')].map(el => [el.dataset.rip, el.textContent]));
function render() {
  const before = RIP();
  try { renderInner(); requestAnimationFrame(() => { const after = document.querySelectorAll('[data-rip]'); after.forEach(el => { if (el.dataset.rip in before && before[el.dataset.rip] !== el.textContent) { el.classList.remove('rip'); void el.offsetWidth; el.classList.add('rip'); } }); }); } catch (e) { console.error(e); try { localStorage.removeItem(KEY); } catch { } w = E.escalate(E.withHistory(E.sample(realToday))); actor = 'Rahul'; panel = null; result = { text: 'The saved session was from an older version, so a fresh sample was loaded.' }; renderInner(); }
}
function autoInspect() {
  if (!wide()) return;
  const d = $('#panel');
  if (!['today', 'approvals'].includes(tab)) { if (d.open && !panel?.pinned) { d.close(); } return; }
  if (panel) return;
  let id = null;
  if (isRep(actor)) id = E.today(w, actor).list[0]?.id ?? w.approvals.find(a => a.rep === actor)?.taskId;
  else id = E.decisionsFor(w, actor)[0]?.taskId ?? w.approvals.filter(a => a.status === 'approved').at(-1)?.taskId;
  if (id) openTask(id);
}
/* Sub-views inside a tab: one thing on screen at a time, nothing buried below. */
const SEGS = {
  approvals: [['wait', 'Waiting', '#asks, #c-myasks'], ['done', 'Decided', '#c-decided, #schemes'], ['cn', 'Credit notes', '#gst-cn'], ['rec', 'Record', '#seal, #q2c-wrap, #act']],
  pulse: [['week', 'This week', '#c-week'], ['cn', 'GST', '#gst-cn'], ['worth', "What it's worth", '#impact, main.wrap>.decisions'], ['team', 'Team', '#eff, #turn, #data']],
};
const segOn = {};
function segCount(t, k) {
  if (t === 'approvals' && k === 'wait') return isRep(actor) ? w.approvals.filter(a => a.rep === actor && ['pending', 'countered'].includes(a.status)).length : E.decisionsFor(w, actor).length;
  if (k === 'cn') { const g = E.gstAtRisk(w); return g.rejected + g.overdue; }
  if (t === 'approvals' && k === 'rec') return E.verifyChain(w).ok ? 0 : 1;
  return 0;
}
function applySegs() {
  document.querySelectorAll('.segoff').forEach(x => x.classList.remove('segoff'));
  const S = SEGS[tab], bar = $('#segbar'); if (!bar) return;
  if (!S) { bar.innerHTML = ''; bar.hidden = true; return; }
  const cur = segOn[tab] ?? S[0][0]; bar.hidden = false;
  bar.innerHTML = S.map(([k, l]) => { const n = segCount(tab, k); return `<button type="button" role="tab" data-seg="${k}" aria-selected="${k === cur}">${l}${n ? `<span class="sg-n">${n}</span>` : ''}</button>`; }).join('');
  for (const [k, , sel] of S) if (k !== cur) document.querySelectorAll(sel).forEach(x => x.classList.add('segoff'));
  for (const box of document.querySelectorAll('#desk .side, #desk .grid')) if (![...box.children].some(c => c.getClientRects().length)) box.classList.add('segoff');
}
function renderInner() {
  renderTabs(); intro(); renderActors(); setTimeout(autoInspect, 0); renderQ2CBridge(); $('#seal').hidden = false; renderSeal(); renderNext();
  $('#desk').innerHTML = isRep(actor) ? repDesk() : managerDesk();
  applySegs();
  if (panel && $('#panel').open) renderPanel();
  flashId = null;
  if (!isRep(actor)) moveFit();
  collapseForMobile();
}


/* ---------- sections: one fixed set of tabs for every role; content adapts to who is signed in ---------- */
const TABS = [['controls', '<span class="bn-w">Discount controls</span><span class="bn-m">Controls</span>', 'M9 12l2 2 4-4M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'], ['today', 'Today', 'M4 6h16M4 12h16M4 18h10'], ['team', 'Team & Cover', 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8'], ['approvals', 'Approvals', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5'], ['pulse', 'Pulse', 'M3 17l6-6 4 4 8-8M15 7h6v6']];
const ALIAS = { seal: 'approvals', asks: 'approvals', cover: 'team', proof: 'approvals', mis: 'pulse', record: 'approvals' };
let tab = 'today';
const scrollMem = {};
function tabFromHash() { const h = location.hash.slice(1); return TABS.some(t => t[0] === h) ? h : ALIAS[h] ?? null; }
function setTab(t, { push = true, keepScroll = true } = {}) {
  if (!TABS.some(x => x[0] === t)) t = 'today';
  if (t === tab) { if (push) window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollMem[tab] = window.scrollY; tab = t;
  if (push) { try { history.pushState(null, '', '#' + t); } catch { } }
  render(); window.scrollTo({ top: keepScroll ? (scrollMem[t] ?? 0) : 0, behavior: 'instant' });
  const m = document.querySelector('main'); m.classList.remove('sx-anim'); void m.offsetWidth; m.classList.add('sx-anim');
}
function badgeCount() {
  if (isRep(actor)) return w.approvals.filter(a => a.rep === actor && a.status === 'countered').length;
  return E.decisionsFor(w, actor).length;
}
function renderTabs() {
  document.body.dataset.tab = tab;
  const n = badgeCount();
  $('#bn').innerHTML = `<ul>${TABS.map(([id, label, d]) => `${id === 'today' ? '<li class="bn-sep" aria-hidden="true">Approval desk, underneath</li>' : ''}<li><a href="#${id}" data-tab="${id}" ${id === tab ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span class="bn-l">${label}</span>${id === 'approvals' && n ? `<span class="bn-b" data-rip="badge" aria-label="${n} waiting on you">${n}</span>` : ''}</a></li>`).join('')}</ul>`;
}
const UH = {
  team: {
    pm: ['Trade-off: cover moves the work, not the credit. The rep on leave keeps the commission, so nobody resists handing over.', 'Success metric: open deals with nobody on them = 0, every day.', 'Hand-back is one tap, so cover never quietly becomes a reassignment.'],
    fin: ['Orders booked by the cover carry credit to the rep on leave, so incentives and the sales register stay right.', 'Cover is capped at 30 days; longer is a reassignment, decided separately.', 'Approver leave is separate: a stand-in decides with the same limits, logged as acting for.'],
    ba: ['Rule: cover only by a rep who handles the same dealers (the same bucket rule as moving a task).', 'Tests: a non-manager cannot arrange cover; cover to the wrong bucket is refused; hand-back restores every task.', 'Responsible: cover rep · Accountable: manager · Informed: the rep on leave, through the task log.'],
  },
  today: {
    pm: ['Trade-off: Today shows 10, not everything. Reps lose the full view; they gain a list they can finish. The rest is counted, never hidden.', 'Kill metric: if on-time stays under 80% with the cap, the cap becomes a setting.', 'Next: shadow 3 field reps and 1 approver for a week before building more.'],
    fin: ['Deal value only breaks ties, so a big new deal never jumps an older overdue one.', 'Money-blocking stages (quote sent, negotiation) rank first, because that is where cash is stuck.', "Dealer credit (limit and credit days) is checked before any discount ask, like a distributor ERP."],
    ba: ['Rule → story → test: "Today shows at most 10" → "As a rep I see 10 ranked tasks" → test: Today is capped at 10 and the rest are counted, not hidden.', 'Edge cases covered: a pinned callback sits above the tiers; future tasks wait in the inbox; on-hold tasks return on their revisit date.', 'Moving a task outside its bucket needs a reason and a second manager.'],
  },
  approvals: {
    pm: ['Trade-off: auto-escalation can bypass a manager who was about to decide. Chosen because a lost deal costs more than a skipped manager.', 'Success metric: asks decided within 1 working day (target 100%), shown live in the MIS.', 'The rep never chases: the frozen task tells him the clock is on the approver.'],
    fin: ['Discounts are stated before GST. Kavita decides up to 10% and within the margin floor; anything more goes to the sales head.', 'A dealer over his credit limit or past credit days can only be approved with a written override.', 'One approval covers one order, with an expiry date. An order above the approved % is blocked.'],
    ba: ['Tests: "order must match the approval: cap, expiry and one order per approval"; "working days: Sunday and holidays do not count".', 'Delegation: when Kavita is on leave, asks go to her stand-in, logged as "acting for", and her limits still apply.', 'Responsible: rep asks · Accountable: manager or head decides · Informed: finance gets the sealed decision.'],
  },
  pulse: {
    pm: ['Why these 8: each one proves a control works. No vanity counts like "tasks created".', 'A KPI with nothing to measure says "No data yet", never Pass.', 'Download as CSV for the Monday review.'],
    fin: ['"Discount held back" = asked minus approved, in rupees before GST.', '"Orders above the approved discount" at 0 means no margin was given away unapproved.', 'On-time is measured against the original date, so rescheduling cannot fake it.'],
    ba: ['All 8 KPIs come from one pure function with a unit test, so the numbers are reproducible.', 'Each row states its target and what it proves: acceptance criteria you can read.', 'Built like the weekly MIS I ran at HDFC Bank (15+ KPIs across JIRA and ServiceNow).'],
  },
  record: {
    pm: ['Trade-off: tamper-evident, not blockchain. One company keeps the record, so a hash chain plus a daily anchor shared outside is enough.', "It's the model Microsoft's SQL Ledger uses.", 'Try the audit drill below: edit an old approval directly and watch the check catch it.'],
    fin: ["Supports the auditor's MCA Rule 11(g) check on the audit trail. It does not certify compliance.", 'Every Rupee checks a short payment against the exact sealed cap, so the excess goes back to the rep.', 'Any rewrite of history gets caught, even a full admin rebuild (the daily anchor no longer matches).'],
    ba: ['Tests: "SHA-256 is correct, and any edit, deletion or reorder is caught"; "a full admin rewrite passes the chain check but fails the anchor".', 'Every decision, order and scheme change is sealed with who, when and what.', '"Check what was really approved" answers a dispute in one click.'],
  },
};
function why1(t) {
  const last = E.explain(w, t).split(' · ').slice(-1)[0];
  if (/^P\d/.test(last)) { const d = E.daysBetween(t.target, w.today); return d > 0 ? `${d} day${d === 1 ? '' : 's'} late` : 'due today'; }
  return last.replace(/^customer /, 'they ');
}
/* Try to break it: three guided attempts against the real rules. Nothing is faked; each calls the same engine the screens use. */
let breakRes = null;
async function simulatePayment() {
  const o = w.orders.find(x => x.incentive?.state === 'hold');
  if (!o) { breakRes = { k: 'pay', code: 'Nothing to pay', t: 'Send a payment from Every Rupee', bad: '', good: 'Every order is already paid. Place an order from a quote first, then try again.', go: ['pulse', 'Open Pulse'] }; return render(); }
  const ap = o.approvalId ? w.approvals.find(a => a.id === o.approvalId) : null, gap = Math.min(1770, Math.round(E.netOf(o) * 0.02));
  const ev = { event: 'payment.matched', idempotency_key: `utr_DEMO${Date.now().toString().slice(-8)}_${o.id}`, order_id: o.id, rep: o.creditTo, billed_amount: E.netOf(o), approved_discount: o.discountAmt, actual_received: E.netOf(o) - gap, gst_mode: ap?.gst?.mode ?? 'invoice', gst_rate: ap?.gst?.rate ?? 18, matched_on: w.today, source: 'Every Rupee' };
  let api = null, via = 'Ten Today API';
  try { const rsp = await fetch('api/payment-matched', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ev) }); if (!rsp.ok) throw 0; api = await rsp.json(); } catch { via = 'browser (API unreachable here; same rules)'; }
  const out = E.paymentMatched(w, ev); w = out.w; save();
  const res = out.result;
  breakRes = { k: 'pay', code: `Payment matched · via ${via}`, t: `${o.customer} pays ${inr(ev.actual_received)} against ${inr(ev.billed_amount)}`, bad: '', good: `${res.say.replace(/\. Cure by .*/, '.')} A task to clear the gap is now #1 on ${o.creditTo}'s list, with the rupees it unlocks.`, go: ['today', `See ${o.creditTo}'s list`], req: JSON.stringify(ev, null, 2), rsp: JSON.stringify(api ?? { note: 'computed in the browser', ...res }, null, 2) };
  render();
}
function runBreak(kind) {
  if (kind === 'pay') { simulatePayment(); return; }
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  if (kind === 'cover') {
    let msg = ''; try { E.coverLeave(w, 'Kavita', 'Imran', 'Neha', w.today, E.addDays(w.today, 2)); } catch (e) { msg = e.message; }
    const mine = w.tasks.filter(t => t.coverFor === 'Imran' && t.status === 'open'), c = E.activeCover(w, 'Imran');
    breakRes = { k: 'cover', code: 'Blocked · BR-07 · same dealers only', t: "Hand Imran's deals to Neha while he's on leave", bad: msg, good: c ? `What holds instead: ${c.to} has Imran's ${mine.length} open deal${mine.length === 1 ? '' : 's'} (${inr(mine.reduce((s, t) => s + (t.value || 0), 0))} of pipeline), and every rupee he closes is still credited to Imran.` : 'Arrange cover on Team & Cover to see the hand-over.', go: ['team', 'Open Team & Cover'] };
  } else if (kind === 'self') {
    const a = w.approvals.find(x => x.status === 'pending'); let msg = '';
    if (a) try { E.approve(w, a.id, a.rep, a.askPct, E.addDays(w.today, 5), 'approving my own'); } catch (e) { msg = e.message; }
    breakRes = { k: 'self', code: 'Blocked · maker-checker', t: a ? `${a.rep} approves ${a.rep === 'Neha' ? 'her' : 'his'} own ${a.askPct}% for ${a.customer}` : 'Approve your own discount', bad: msg || 'No ask is waiting right now. Ask for a discount from any quote, then try again.', good: a ? `What holds instead: it waits for ${E.label(a.approver).split(' · ')[0]}. Undecided after a working day, it moves up on its own.` : '', go: ['approvals', 'Open Approvals'] };
  } else {
    const ap = [...w.chain].reverse().find(x => /^Approved \d/.test(x.text));
    if (!ap) { breakRes = { k: 'seal', t: 'Edit a signed approval', bad: 'No signed approval yet.', good: '', go: ['approvals', 'Open Approvals'] }; return render(); }
    const edited = ap.text.replace(/^Approved (\d+(?:\.\d+)?)%/, (m, p) => `Approved ${Number(p) + 4}%`);
    if (!w.tampered) drillBackup = JSON.parse(JSON.stringify(w.chain));
    w = E.tamperEntry(w, ap.n, edited); save(); sealRes = E.verifyAnchored ? E.verifyAnchored(w) : E.verifyChain(w);
    breakRes = { k: 'seal', code: 'Caught · SHA-256 seal broken', t: 'Edit a signed approval straight in the database', bad: ` Entry #${ap.n} was signed as “${ap.text.split(' for ')[0]}” and now reads “${edited.split(' for ')[0]}”. The seal no longer matches, so finance stops trusting it.`, good: 'Nothing else is lost: put it back and the seal is green again.', go: ['approvals', 'See the record'], undo: true };
  }
  render();
  const tgt = { cover: '#cover', self: '#asks, #c-myasks', seal: '#seal' }[kind]; const el = document.querySelector(tgt);
  if (el && el.offsetParent) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
}
function breakBar() {
  return `<div class="bk" role="group" aria-label="Test the rules"><span class="bk-l">Test the rules</span><button type="button" data-break="cover">Hand Imran's deals to the wrong rep</button><button type="button" data-break="self">Approve your own discount</button><button type="button" data-break="seal">Edit a signed approval</button></div>`;
}
function renderBanner() {
  let r = breakRes; const el = $('#bk-ban'); if (!el) return;
  if (r?.k === 'seal' && r.undo && !w.tampered) r = breakRes = { ...r, code: 'Restored', bad: '', good: 'Put back. Every fingerprint matches again, and the seal is green.', undo: false };
  el.hidden = !r; if (!r) return;
  el.className = `bk-ban ${r.bad ? 'no' : 'ok'}`;
  el.innerHTML = `<div class="bk-c">${esc(r.code ?? 'Blocked')}</div>${r.req ? `<details class="api" style="margin:8px 0 0"><summary>⇄ The API call <span>request and response</span></summary><pre>POST /api/payment-matched\n${esc(r.req)}</pre><pre>${esc(r.rsp)}</pre></details>` : ''}<p class="bk-t">${r.k === 'pay' ? 'Every Rupee' : 'You tried'}: ${esc(r.t)}</p>${r.bad ? `<p class="bk-x">${esc(r.bad)}</p>` : ''}${r.good ? `<p class="bk-ok">${esc(r.good)}</p>` : ''}<div class="bk-a">${r.undo && w.tampered ? '<button class="btn" type="button" data-seal="undo">Put it back</button>' : ''}<a class="btn link" href="#${r.go[0]}" data-tab="${r.go[0]}">${r.go[1]} →</a><button class="bk-x2" type="button" data-break="close" aria-label="Close">×</button></div>`;
}
/* Pulse: what the rules would mean at a real company, from public numbers. Inputs are editable; the math is shown. */
let model = { revenueCr: 500, tradePct: 8, abovePct: 5 };
function impactCard() {
  const m = E.impactModel(model), cr = n => `₹${(n / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  const src = (t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
  return `<section class="card imp" id="impact" data-in="pulse"><p class="k">Modelled on public numbers · not a measured result</p><h2>What these rules would be worth at a ${cr(model.revenueCr * 1e7)} FMCG company</h2>
  <div class="imp-in"><label>Annual revenue (₹ Cr)<input type="number" min="10" step="10" data-model="revenueCr" value="${model.revenueCr}"></label><label>Trade incentives, % of revenue<input type="number" min="1" max="20" step="0.5" data-model="tradePct" value="${model.tradePct}"><small>McKinsey: 8–11%</small></label><label>Share given above what was approved<input type="number" min="0" max="50" step="1" data-model="abovePct" value="${model.abovePct}"><small>Your estimate. No public figure exists.</small></label></div>
  <div class="imp-out">
    <div><b data-rip="imp-b">${cr(m.blocked)}</b><span>a year in discounts given above approval, now blocked at the order. Every rupee of it is gross profit.</span></div>
    <div><b data-rip="imp-p">+${m.opProfitGain}%</b><span>operating profit: ${m.priceGain}% better price realisation × ~8 (McKinsey: 1% price ≈ 8% operating profit).</span></div>
    <div><b>2+ days</b><span>faster per pricing exception: 47% of teams take 3+ days (Everstage 2026); here it is decided or escalated within 1 working day.</span></div>
  </div>
  <p class="imp-f">How it's worked out: ${cr(model.revenueCr * 1e7)} × ${model.tradePct}% trade incentives = ${cr(m.trade)}; × ${model.abovePct}% above approval = ${cr(m.blocked)}. ${m.withinBainCeiling ? '' : '⚠ This is above the 6% leakage Bain measured, so it is likely too high. '}Margin per order uses a typical FMCG gross margin of ${E.FMCG_GROSS_MARGIN}% (HUL FY25): 8% off leaves ${E.marginAfter(8)}%, 12% off leaves ${E.marginAfter(12)}%.<br>Sources: ${src('McKinsey, trade spend', 'https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/reimagining-trade-spend-from-cost-center-to-growth-catalyst')} · ${src('McKinsey, the power of pricing', 'https://www.mckinsey.com/featured-insights/business-functions/the-power-of-pricing')} · ${src('Everstage approval queue report', 'https://www.everstage.com/approval-queue-report')} · ${src('Bain, off-invoice discounts', 'https://www.bain.com/insights/off-invoice-discounts/')} · ${src('HUL FY25 income statement', 'https://stockanalysis.com/quote/nse/HINDUNILVR/financials/income-statement/')} · ${src('Conga', 'https://conga.com/resources/blog/how-shorten-your-sales-cycle-fix-handoffs-not-hustle')}</p></section>`;
}
function intro() {
  if (tab === 'controls') { $('#tabintro').innerHTML = ''; $('#notes').innerHTML = ''; return; }
  const m = E.mis(w), judged = m.filter(x => x.ok !== null && x.target !== 'Tracked'), slipped = judged.filter(x => x.ok === false);
  const rep = isRep(actor), me = E.person(actor), q = rep ? E.today(w, actor) : null, top = rep && q.list[0];
  const pend = E.decisionsFor(w, actor), mine = w.approvals.filter(a => a.rep === actor && ['pending', 'countered'].includes(a.status));
  const wl = E.workload(w), heavy = wl.filter(r => r.overCap).sort((a, b) => b.actionable - a.actionable)[0];
  const out = E.PEOPLE.filter(p => p.rep && E.activeCover(w, p.name)), ch = E.verifyChain(w);
  const coverMe = rep && (w.covers ?? []).find(c => c.to === actor && E.activeCover(w, c.rep));
  const coverN = coverMe ? q.list.filter(t => t.coverFor === coverMe.rep).length : 0;
  const hr = new Date().getHours(), hi = hr < 12 ? 'Morning' : hr < 17 ? 'Afternoon' : 'Evening';
  const oldest = pend.slice().sort((a, b) => (a.askedOn < b.askedOn ? -1 : 1))[0];
  const late = w.tasks.filter(t => t.status === 'open' && t.target < w.today).sort((a, b) => a.target < b.target ? -1 : 1)[0];
  const lateDays = late ? E.daysBetween(late.target, w.today) : 0;
  const doneToday = w.tasks.filter(t => t.status === 'done' && t.doneAt === w.today).length;
  const orphan = w.tasks.filter(t => t.status === 'open' && E.activeCover(w, t.rep)).length;
  const go = (id, label, pri = true) => `<a class="btn${pri ? ' pri' : ''}" href="#${id}" data-jump="${id}">${label}</a>`;
  const H = {
    today: rep && E.activeCover(w, actor)
      ? { h: `You're on leave till ${fmt(E.activeCover(w, actor).end)}.`, p: `${E.activeCover(w, actor).to} has your deals while you're away. Anything he closes is still credited to you.`, a: '' }
      : rep
      ? { h: `${hi}, ${actor}. ${q.list.length === 0 ? 'Nothing due today.' : `${q.list.length} thing${q.list.length === 1 ? '' : 's'} today.`}`, p: top ? `${esc(top.customer)} first: ${esc(why1(top))}.${coverN ? ` ${coverN === 1 ? `One is ${coverMe.rep}'s` : `${coverN} are ${coverMe.rep}'s`} while he's away.` : ''}` : 'All caught up. Check Pulse to see how the week is going.', a: top ? `<button class="btn pri" data-open="${top.id}" type="button">Open ${esc(top.customer)}</button>` : '' }
      : heavy ? { h: `${heavy.rep} has ${heavy.actionable} due and can finish ${E.CAP}.`, p: `${out.length ? `He's covering ${out.map(p => p.name).join(' and ')} this week. ` : ''}Share the load with someone who handles the same dealers.`, a: go('team', 'Share the load') }
      : { h: 'Everyone can finish today.', p: `No one has more than ${E.CAP} due.`, a: '' },
    team: out.length
      ? { h: `${out.map(p => p.name === actor ? 'You' : p.name).join(' and ')} ${out.length === 1 && out[0].name !== actor ? 'is' : 'are'} out till ${fmt(E.activeCover(w, out[0].name).end)}.`, p: `${orphan ? `${orphan} deal${orphan === 1 ? ' has' : 's have'} nobody on ${orphan === 1 ? 'it' : 'them'}.` : `Every open deal has an owner. ${E.activeCover(w, out[0].name).to === actor ? "You're" : `${E.activeCover(w, out[0].name).to} is`} covering, and the credit stays with ${out[0].name}.`}`, a: go('cover', rep ? 'See who covers whom' : 'Manage cover', !rep) }
      : { h: 'Everyone is in today.', p: 'When someone takes leave, hand their deals over in one tap. The credit stays theirs.', a: rep ? '' : go('cover', 'Plan cover') },
    approvals: rep
      ? (mine.length ? { h: `${E.label(mine[0].approver).split(' · ')[0]} has your ${esc(mine[0].customer)} ask.`, p: `Your task waits until it's decided. If nobody decides within a working day, it goes up on its own. You don't chase.`, a: go('c-myasks', 'See your asks', false) }
        : { h: 'Nothing waiting on anyone.', p: 'When a customer pushes for a better price, ask from the task. Your manager gets it with the margin and credit already checked.', a: '' })
      : (oldest ? { h: `${oldest.rep} is waiting on you.`, p: `${esc(oldest.customer)} wants ${oldest.askPct}%. ${me.senior ? "You're the last stop, so it waits for you." : 'Not decided by tomorrow, it goes to Arjun.'}`, a: go('asks', 'Decide now') }
        : { h: 'Nothing waiting on you.', p: `Every ask is decided${ch.ok ? ', and every decision is exactly as it was signed' : ''}.`, a: go('seal', 'See signed decisions', false) }),
    pulse: { h: slipped.length ? `${slipped.length === 1 ? 'One thing' : `${slipped.length} things`} slipped this week.` : 'Everything held this week.', p: slipped.length ? slipped.map(x => x.kpi).join('; ') + '.' : 'No deal stuck waiting for a decision, and no order above what was approved.', a: `<button class="btn pri" id="mis-dl" type="button">Download for Monday</button>` },
  }[tab];
  const cards = tab === 'pulse' ? `<div class="pc3">
    <div><b data-rip="p-done">${doneToday} done today</b><span>${q ? `${q.list.length} still on ${rep ? 'your' : 'the'} list` : 'across the team'}</span></div>
    <div><b>${late ? `${esc(late.customer)}, ${lateDays} day${lateDays === 1 ? '' : 's'} late` : 'Nothing late'}</b><span>${late ? `${esc(late.rep)} · ${esc(late.title)}` : 'Every task is on its date'}</span></div>
    ${(() => { const g = E.gstAtRisk(w); return `<div class="${g.count ? 'warn' : ''}"><b data-rip="p-gst">${g.count ? `${inr(g.gst)} GST relief to secure` : 'No GST credit notes open'}</b><span>${g.count ? `${g.count} discount${g.count === 1 ? '' : 's'} given as GST credit notes. Buyers must reverse the same ITC; declare by ${fmtY(g.deadline)} (${g.daysLeft} days left).` : 'Discounts given on the invoice need nothing later.'}</span></div>`; })()}
    <div><b data-rip="p-own">${orphan ? `${orphan} deal${orphan === 1 ? '' : 's'} with nobody` : 'Every deal has an owner'}</b><span>${out.length ? `including ${out.map(p => p.name).join(', ')}'s, covered while away` : 'Nobody on leave'}</span></div></div>` : '';
  const TL = {
    today: rep ? [['c-hold', 'Parked for later', 'Comes back on the date you set'], ['c-later', 'Not today', 'Future tasks wait off your list'], ['c-done', 'Done', 'On time means the first date, not a moved one']]
      : [['team', 'Who has room', 'Workload per rep, and what can move'], ...(pend.length ? [['asks', 'Waiting on you', `${pend.length} ask${pend.length === 1 ? '' : 's'} to decide`]] : [])],
    team: rep ? [] : [['cover', 'Someone on leave', 'Hand over their deals; credit stays theirs'], ['team', 'Move one task', 'Same dealers only, or a second manager signs'], ...(me.senior ? [] : [['leave', 'You on leave', 'A stand-in decides with your limits']])],
    approvals: rep ? [] : [['asks', 'Your limit', me.senior ? 'Anything above 10%, or a credit hold' : 'Up to 10%, inside the margin floor'], ['asks', 'Credit hold', 'Over-limit dealers need a written reason'], ['seal', 'Signed record', 'Nothing changes after signing, or it shows'], ['asks', 'GST, decided here', 'On the invoice, GST or financial credit note']],
    pulse: [['c-mis', 'The full week', 'Every check with its target'], ...(rep ? [] : [['eff', 'Do discounts win?', 'Deals won with and without one'], ['turn', 'How fast we decide', 'Days per approver']])],
  }[tab];
  const tiles = TL.length ? `<div class="tls">${TL.map(([to, t, d]) => to === 'team' && tab !== 'team' ? `<a class="tl" href="#team" data-tab="team"><b>${t}</b><span>${d}</span></a>` : `<a class="tl" href="#${to}" data-jump="${to}"><b>${t}</b><span>${d}</span></a>`).join('')}</div>` : '';
  const WHY = {
    today: ['22% of workers say unclear priorities make them miss deadlines (Asana, 10,624 workers).', 'Ten, not everything: a list you can finish beats a list you ignore.'],
    team: ['Leave is when deals go quiet: nobody owns them, and nobody wants to touch a colleague\'s commission.', 'Move the work, keep the credit. Cover only by someone who knows the accounts.'],
    approvals: ['45% of companies lost a deal to a slow quote approval in six months (Conga).', 'Silence escalates, so nobody chases. Every decision is sealed, so nobody argues later.'],
    pulse: ['At HDFC Bank my weekly MIS took 8 hours to prepare. I cut it to 3.', 'Only numbers that show whether the rules held, each with a target.'],
  }[tab];
  const u0 = UH[tab], u = tab === 'approvals' ? { pm: [...u0.pm, UH.record.pm[0]], fin: [...u0.fin, UH.record.fin[0]], ba: [...u0.ba, UH.record.ba[0]] } : u0;
  const sec = (h, arr) => `<div><h4>${h}</h4><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  const pay = E.payFor(w, rep ? actor : null), team = E.PEOPLE.filter(p => p.rep).map(p => E.payFor(w, p.name)), tsum = k => team.reduce((s, x) => s + x[k], 0);
  const payLine = rep && ['today', 'pulse'].includes(tab) ? `<p class="pay" data-rip="pay">Your pay, on money that arrived: <b>${inr(pay.earned)} earned</b>${pay.held ? ` · <span class="w">${inr(pay.held)} on hold</span> until a gap is cleared` : ''}${pay.awaiting ? ` · ${inr(pay.awaiting)} waiting for payment` : ''}${pay.notEarned ? ` · ${inr(pay.notEarned)} not earned (window closed)` : ''}.</p>`
    : !rep && tab === 'pulse' ? `<p class="pay" data-rip="pay">Team pay, earned only on cash that arrived: <b>${inr(tsum('earned'))} earned</b> · ${inr(tsum('held'))} on hold for gaps · ${inr(tsum('awaiting'))} waiting for payment. Nobody is paid on money that never came.</p>` : '';
  $('#tabintro').innerHTML = `<div class="hx"><div class="hx-t"><h2 class="hx-h">${H.h}</h2><p class="hx-c">${H.p}</p></div>${H.a ? `<div class="hx-a">${H.a}</div>` : ''}</div>${payLine}${cards}`;
  $('#notes').innerHTML = `<details class="uh"><summary>How I built this screen <span>the problem, my call, and notes for product, finance and BA readers · Rupak Ghanpathi</span></summary><p class="hx-w"><b>The problem:</b> ${esc(WHY[0])} <b>My call:</b> ${esc(WHY[1])}</p><div class="uh-g">${sec('Product', u.pm)}${sec('Finance ops', u.fin)}${sec('Business analysis', u.ba)}</div></details>`;
  renderBanner();
}

/* ---------- events ---------- */
document.addEventListener('change', e => {
  const card = e.target.closest?.('.ask'); if (!card || !['gst', 'rate', 'cap'].includes(e.target.dataset.f)) return;
  const id = card.id.slice(4), a = w.approvals.find(x => x.id === id); const g = k => card.querySelector(`[data-f="${k}"]`)?.value;
  card.querySelector('.gstc').innerHTML = gstLine(a, Number(g('cap')), g('gst'), Number(g('rate')));
});
document.addEventListener('input', e => {
  if (e.target.dataset?.rem) { cnRemark[e.target.dataset.rem] = e.target.value; return; }
  const k = e.target.dataset?.model; if (!k) return;
  const v = Number(e.target.value); if (!(v >= 0)) return;
  model = { ...model, [k]: v };
  const el = document.getElementById('impact'); const pos = e.target.selectionStart;
  const before = RIP(); el.outerHTML = impactCard();
  document.querySelectorAll('#impact [data-rip]').forEach(x => { if (before[x.dataset.rip] !== x.textContent) { x.classList.remove('rip'); void x.offsetWidth; x.classList.add('rip'); } });
  const inp = document.querySelector(`#impact [data-model="${k}"]`); inp.focus(); try { inp.setSelectionRange(pos, pos); } catch { }
});
document.addEventListener('click', e => {
  const sg = e.target.closest('[data-seg]'); if (sg) { segOn[tab] = sg.dataset.seg; applySegs(); return; }
  const ak = wide() && e.target.closest('#asks .ask'); if (ak && !e.target.closest('button,input,select,label')) { const a = w.approvals.find(x => `ask-${x.id}` === ak.id); if (a) { openTask(a.taskId); return; } }
  const cp = e.target.closest('[data-copy]'); if (cp) { const txt = cp.dataset.copy; (navigator.clipboard?.writeText(txt) ?? Promise.reject()).then(() => toast('Copied. Paste it in WhatsApp.'), () => toast('Select the text and copy it.')); return; }
  const nl = e.target.closest('a[href="#notes"]'); if (nl) { e.preventDefault(); $('#drawer').hidden = true; const d = document.querySelector('#notes details'); if (d) d.open = true; $('#notes').scrollIntoView({ behavior: 'smooth' }); return; }
  const jl = e.target.closest('a[data-jump]'); if (jl) { e.preventDefault(); const S = SEGS[tab]; const hit = S?.find(([, , sel]) => sel.split(', ').includes('#' + jl.dataset.jump)); if (hit) { segOn[tab] = hit[0]; applySegs(); } const el = document.getElementById(jl.dataset.jump); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (el?.tagName === 'DETAILS') el.open = true; el?.classList.remove('cl'); return; }
  const tl = e.target.closest('a[data-tab]'); if (tl) { e.preventDefault(); return setTab(tl.dataset.tab); }
  const hl = e.target.closest('a[href^="#"]'); if (hl && ALIAS[hl.getAttribute('href').slice(1)]) { e.preventDefault(); const id = hl.getAttribute('href').slice(1); setTab(ALIAS[id], { keepScroll: false }); document.getElementById(id)?.scrollIntoView({ block: 'start' }); return; }
  const b = e.target.closest('button,[data-open]'); if (!b) return;
  if (b.dataset.chk) { const d = E.sealedDecision(w, b.dataset.chk); result = d ? { text: `${b.dataset.chk} was sealed as: “${d.entry.text}” by ${E.label(d.entry.who)} at ${time(d.entry.at)}.`, sub: d.check.ok ? `✓ Unchanged since it was sealed${d.check.anchored ? ", and the record still ends at yesterday's anchor shared with finance" : ''}. A claim of any other figure is wrong.` : '✗ The record fails verification. Don\'t rely on any figure until it is restored.' } : { err: 'No sealed decision found for this approval.' }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (b.dataset.actor) return switchTo(b.dataset.actor);
  if (b.dataset.q2c) {
    if (b.dataset.q2c === 'sim-rec') {
      const tok = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, kind: 'recovery', invoiceId: 'INV-5031', customer: 'Krishna Marketing, Surat', short: 9440, rep: 'Rahul' })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const r = E.importRecovery(w, tok); w = r.w; actor = 'Rahul'; flashId = r.task.id; save();
      result = { text: `Finance (Every Rupee) sent task ${r.task.id} to Rahul: Krishna Marketing paid ₹9,440 short on bill INV-5031 with no discount approval.`, sub: `Look at Rahul's list below or click "Try asking for a discount as Rahul" above—he is now blocked from asking for new discounts until he resolves ${r.task.id}.` };
      toast('₹9,440 unapproved short-payment added to Rahul’s queue.');
      return render();
    }
    if (b.dataset.q2c === 'try-blocked-ask') {
      actor = 'Rahul'; save(); render();
      const targetTask = w.tasks.find(t => t.rep === 'Rahul' && t.status === 'open' && ['Quote sent', 'Negotiation'].includes(t.stage));
      if (targetTask) {
        openTask(targetTask.id, 'ask');
        try { E.askDiscount(w, targetTask.id, 'Rahul', 6, 'Customer wants 6% off'); }
        catch (err) { panel.err = err.message; renderPanel(); }
      }
      return;
    }
    if (b.dataset.q2c === 'clear-rec') {
      const rec = w.tasks.find(t => t.kind === 'recovery' && t.status === 'open');
      if (rec) {
        w = E.complete(w, rec.id, rec.rep, 'Collected ₹9,440 short payment / attached credit-note proof', false).w;
        save(); result = { text: `${rec.id} resolved by ${rec.rep}. The Finance hold is lifted.`, sub: `${rec.rep} can now ask for discounts on new orders again.` };
        toast('₹9,440 short-payment resolved. Rahul is unblocked.');
      }
      return render();
    }
    if (b.dataset.q2c === 'quick-apv') {
      const pend = w.approvals.find(a => a.status === 'pending' && a.approver === 'Kavita');
      if (pend) {
        w = E.approve(w, pend.id, 'Kavita', Math.min(pend.askPct, 8), E.addDays(w.today, 14));
        actor = 'Kavita'; save();
        result = { text: `Approved ${pend.id} (${pend.customer}) with a SHA-256 seal.`, sub: 'Click "Send to Every Rupee ↗" in the bridge bar above to pass the sealed approval to Finance.' };
        toast('Sample discount approved & sealed.');
      }
      return render();
    }
  }
  if (b.dataset.sug) { const [id, to] = b.dataset.sug.split('|'); try { w = E.rebalance(w, id, actor, to); save(); sealRes = null; const t = w.tasks.find(x => x.id === id); toast('Suggested move accepted.'); result = { text: `Moved ${t.customer} to ${E.label(to)}: same ${E.bucketOf(w, t.customer)} bucket, suggested by the rules.`, sub: 'Original target kept. Sealed in the record.' }; render(); } catch (err) { result = { err: err.message }; render(); } return; }
  if (b.dataset.open) return openTask(b.dataset.open, b.dataset.tab);
  if (b.hasAttribute('data-close')) { panel = null; $('#panel').close(); return; }
  if (b.dataset.tab && panel) { panel.tab = b.dataset.tab; panel.err = ''; return renderPanel(); }
  if (b.dataset.do) return panelAction(b.dataset.do);
  if (b.dataset.dec) return decide(b.dataset.dec, b.dataset.id);
  if (b.dataset.go) { document.querySelector(b.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (b.id === 'menu-go') { $('#drawer').hidden = false; return; }
  if (b.id === 'menu-x') { $('#drawer').hidden = true; return; }
  if (b.id === 'reset') { $('#drawer').hidden = true; w = E.withHistory(E.sample(realToday)); actor = 'Rahul'; result = null; panel = null; sealEdit = 0; sealRes = null; save(); render(); toast('Sample reset.'); return; }
  if (b.id === 'mv-ask') { const t = w.tasks.find(x => x.id === $('#mv-task').value); const to = $('#mv-to').value; const bk = E.bucketOf(w, t.customer); const fits = E.owns(to, bk);
    $('#mv-confirm').innerHTML = fits ? `<p class="hint" style="margin-bottom:6px">Move <b>${esc(t.customer)}</b> from ${esc(t.rep)} to ${esc(to)}, within the ${bk} bucket?</p><div class="row"><button type="button" class="btn pri" id="mv-yes" data-t="${t.id}" data-to="${to}">Yes, move it</button><button type="button" class="btn" id="mv-no">Cancel</button></div>`
      : `<div class="err" style="margin-bottom:6px">${esc(to)} handles ${esc(E.person(to).buckets.join(', '))}; <b>${esc(t.customer)}</b> is ${bk === "FMCG" ? "an" : "a"} ${bk} dealer. This is a wrong-bucket move, so it needs a reason and a second manager's approval. It stays with ${esc(t.rep)} until then.</div><div class="row"><input id="mv-why" placeholder="Why should it move? (required)" maxlength="140" style="flex:1"><button type="button" class="btn pri" id="mv-yes" data-t="${t.id}" data-to="${to}">Send for approval</button><button type="button" class="btn" id="mv-no">Cancel</button></div>`; return; }
  if (b.id === 'mv-no') { $('#mv-confirm').innerHTML = '<button type="button" class="btn" id="mv-ask">Move…</button>'; moveFit(); return; }
  if (b.dataset.ims) { const id = b.dataset.id, k = b.dataset.ims; act(() => E.recordIms(w, id, actor, k, cnRemark[id] ?? ''), `Recorded: buyer ${k} the credit note.`); return; }
  if (b.dataset.fin) { act(() => E.settleFinancial(w, b.dataset.fin, actor), 'Settled as a financial credit note.'); return; }
  if (b.id === 'gstr1-dl') { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(E.gstr1Cdnr(w), null, 2)], { type: 'application/json' })), download: `gstr1-9b-credit-notes-${w.today}.json` }); a.click(); return; }
  if (b.dataset.break && b.closest('#drawer')) { $('#drawer').hidden = true; }
  if (b.dataset.break) { if (b.dataset.break === 'close') { breakRes = null; render(); } else runBreak(b.dataset.break); return; }
  if (b.dataset.cover === 'end') { const rep = b.dataset.rep; act(() => E.endCover(w, actor, rep), `${rep} is back. Their deals are handed back.`); return; }
  if (b.dataset.cover === 'start') { const rep = $('#cv-rep').value, to = $('#cv-to').value; act(() => E.coverLeave(w, actor, rep, to, $('#cv-from').value, $('#cv-end').value), `${rep}'s open deals are with ${to}, still credited to ${rep}.`); return; }
  if (b.dataset.tool) { toolTab = b.dataset.tool; toolChosen = true; document.querySelectorAll('.ttabs button').forEach(x => { const on = x.dataset.tool === toolTab; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }); document.querySelectorAll('.tbody .tool').forEach(x => { x.hidden = x.id !== toolTab; }); if (!b.closest('.ttabs')) $('.tools')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (b.dataset.seal) {
    if (b.dataset.seal === 'verify') sealRes = E.verifyAnchored(w);
    if (b.dataset.seal === 'tamper') { const ap = [...w.chain].reverse().find(x => /^Approved/.test(x.text)) ?? w.chain.find(x => /%/.test(x.text)) ?? w.chain[0]; sealEdit = ap?.n ?? 0; sealRes = null; }
    if (b.dataset.seal === 'preset-inflate') {
      const ta = $('#db-text');
      if (ta) {
        ta.value = ta.value.replace(/(\d+(\.\d+)?)%/, (_, n) => `${Number(n) + 4}%`);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    if (b.dataset.seal === 'dbcancel') sealEdit = 0;
    if (b.dataset.seal === 'dbsave') {
      try {
        if (!w.tampered) drillBackup = JSON.parse(JSON.stringify(w.chain));
        w = E.tamperEntry(w, Number($('#db-n').value), $('#db-text').value);
        if ($('#db-rebuild')?.checked) w = E.rebuildChain(w);
        save(); sealEdit = 0; sealRes = E.verifyAnchored(w);
        toast('Raw DB row modified & SHA-256 chain verified: mismatch caught.');
      } catch (err) { $('#db-err').innerHTML = `<div class="err" style="margin-top:6px">${esc(err.message)}</div>`; return; }
    }
    if (b.dataset.seal === 'undo' && breakRes?.k === 'seal') breakRes = null;
    if (b.dataset.seal === 'undo') { if (drillBackup) { w = { ...w, chain: drillBackup }; delete w.tampered; drillBackup = null; } else w = E.undoTamper(w); save(); sealEdit = 0; sealRes = E.verifyAnchored(w); toast('Original database row restored & verified.'); }
    renderQ2CBridge();
    return renderSeal();
  }
  if (b.dataset.leave) { try { if (b.dataset.leave === 'end') { w = E.endDelegation(w, actor); result = { text: 'Hand-over ended. New asks come to you again.' }; } else { const r = E.delegate(w, actor, $('#l-to').value, $('#l-from').value, $('#l-end').value); w = r.w; result = { text: `Approvals handed to ${E.label($('#l-to').value)}.`, sub: r.moved ? `${r.moved} waiting ask moved to them now. Each decision is logged as acting for ${actor}.` : `New asks go to them during those dates, logged as acting for ${actor}.`, switchTo: $('#l-to').value }; } save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { $('#l-err').innerHTML = `<div class="err" style="margin-top:6px">${esc(err.message)}</div>`; } return; }
  if (b.id === 'mis-dl' || b.id === 'mis-dl2' || b.id === 'mis-dl3') { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([E.misCsv(w)], { type: 'text/csv' })), download: `tentoday-mis-${w.today}.csv` }); a.click(); return; }
    if (b.dataset.exp || b.dataset.tpl) { const txt = b.dataset.exp ? E.exportCsv(w, b.dataset.exp) : (b.dataset.tpl === 'dealers' ? E.DEALER_COLS.join(',') + '\nSample Traders,300000,50000,30,10,8' : E.TASK_COLS.join(',') + `\nRahul,Sample Traders,Quote sent,${w.today},150000\n,City Pharma,New lead,${w.today},40000`); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/csv' })), download: `tentoday-${b.dataset.exp || b.dataset.tpl + '-template'}.csv` }); document.body.append(a); a.click(); a.remove(); toast('CSV downloaded.'); return; }
  if (b.dataset.sch) { try { w = E.approveScheme(w, b.dataset.sch, actor); save(); toast('Scheme approved.'); result = { text: `${b.dataset.sch} is live.`, sub: 'Reps can now apply it to qualifying orders without asking.' }; render(); } catch (err) { result = { err: err.message }; render(); } window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (b.id === 's-go') { try { w = E.proposeScheme(w, actor, $('#s-name').value, Number($('#s-min').value), Number($('#s-pct').value)); save(); const sc = w.schemes.at(-1); toast('Scheme proposed.'); result = { text: `${sc.id} proposed: ${sc.name}.`, sub: 'It is not usable until a second person approves it.', switchTo: actor === 'Kavita' ? 'Arjun' : 'Kavita' }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { $('#s-err').innerHTML = `<div class="err" role="alert" style="margin-top:6px">${esc(err.message)}</div>`; } return; }
  if (b.id === 'mv-yes') { try { w = E.rebalance(w, b.dataset.t, actor, b.dataset.to, $('#mv-why')?.value); save(); sealRes = null; const t = w.tasks.find(x => x.id === b.dataset.t);
    if (w.lastTransfer) { const tr = w.transfers.find(x => x.id === w.lastTransfer); const by = E.PEOPLE.find(p => p.manager && p.name !== actor && p.senior)?.name ?? 'Arjun'; toast('Transfer request sent.'); result = { text: `${tr.id}: ${t.customer} → ${tr.to} sent for approval.`, sub: `Wrong bucket (${tr.bucket} dealer, ${tr.to} handles ${E.person(tr.to).buckets.join(', ')}). It stays with ${tr.from} until another manager approves. Sealed in the record.`, switchTo: actor === 'Arjun' ? 'Kavita' : by }; }
    else { toast('Task moved.'); result = { text: `Moved ${t.customer} to ${E.label(t.rep)}, same ${E.bucketOf(w, t.customer)} bucket.`, sub: 'The original target is kept, so it keeps its place in their ranking. Sealed in the record.', switchTo: t.rep }; }
    render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { $('#mv-confirm').insertAdjacentHTML('afterbegin', `<div class="err" role="alert" style="margin-bottom:6px">${esc(err.message)}</div>`); } return; }
  if (b.dataset.tr) { try { const ok = b.dataset.ok === '1'; w = E.decideTransfer(w, b.dataset.tr, actor, ok, $(`#tr-why-${CSS.escape(b.dataset.tr)}`)?.value); save(); sealRes = null; const tr = w.transfers.find(x => x.id === b.dataset.tr); toast(ok ? 'Transfer approved.' : 'Transfer rejected.'); result = { text: ok ? `${tr.id} approved: ${tr.customer} is now with ${E.label(tr.to)}.` : `${tr.id} rejected: ${tr.customer} stays with ${E.label(tr.from)}.`, sub: `Decided by ${actor}, not ${tr.by} who asked. Sealed in the record.`, switchTo: ok ? tr.to : tr.from }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { b.closest('div').insertAdjacentHTML('beforebegin', `<div class="err" role="alert">${esc(err.message)}</div>`); } return; }
});
document.addEventListener('input', e => {
  if (e.target.id === 'f-pct') routePreview();
  if (e.target.id === 'db-text' && sealEdit) {
    const blk = w.chain[sealEdit - 1];
    const el = $('#db-live-hash');
    if (blk && el) {
      const liveCalc = E.sha256(JSON.stringify({ n: blk.n, at: blk.at, who: blk.who, text: e.target.value.trim(), ref: blk.ref, prev: blk.prev }));
      const diff = liveCalc !== blk.hash;
      el.innerHTML = `live_recomputed_sha256: <code style="background:#292524;color:${diff ? '#FCA5A5' : '#86EFAC'};border-color:${diff ? '#DC2626' : '#3F3A36'}">${esc(liveCalc.slice(0, 32))}…</code> ${diff ? '<b style="color:#FCA5A5">≠ STORED SEAL (TAMPERED)</b>' : '<b style="color:#86EFAC">= MATCHES STORED SEAL</b>'}`;
    }
  }
});
document.addEventListener('change', e => { if (e.target.id === 'mv-task' || e.target.id === 'mv-to') { $('#mv-confirm').innerHTML = '<button type="button" class="btn" id="mv-ask">Move…</button>'; moveFit(); } if (e.target.id === 'db-n') { sealEdit = Number(e.target.value); renderSeal(); } });
document.addEventListener('change', async e => {
  if (!['imp-dealers', 'imp-tasks'].includes(e.target.id) || !e.target.files[0]) return;
  const text = await e.target.files[0].text(); const out = $('#imp-res');
  try { const r = e.target.id === 'imp-dealers' ? E.importDealers(w, text) : E.importTasks(w, text); w = r.w; save(); result = { text: `Imported ${r.count} ${e.target.id === 'imp-dealers' ? 'dealer(s)' : 'task(s)'}.`, sub: 'Credit checks and ranking now use your data.' }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch (err) { out.innerHTML = `<div class="err" role="alert" style="margin-top:8px">${esc(err.message)}</div>`; e.target.value = ''; }
});
$('#panel').addEventListener('close', () => { panel = null; document.body.classList.remove('insp'); document.querySelectorAll('.task.sel').forEach(x => x.classList.remove('sel')); });

load(); w = E.escalate(E.wakeHolds(w)); tab = tabFromHash() ?? 'controls';
window.addEventListener('popstate', () => { const t = tabFromHash() ?? 'controls'; if (t !== tab) { scrollMem[tab] = window.scrollY; tab = t; render(); window.scrollTo(0, scrollMem[t] ?? 0); } });
(() => {
  const tok = new URLSearchParams(location.search).get('task'); if (!tok) return;
  try { const r = E.importRecovery(w, tok); w = r.w; actor = r.task.rep; signedIn = true; save(); result = { text: r.fresh ? `New task from Every Rupee: ${r.task.title}.` : `Already in ${r.task.rep}'s list: ${r.task.title}.`, sub: `Finance handed this short payment to ${r.task.rep}. Recover it from ${r.task.customer}, or get it approved. Open it in Today.` }; setTimeout(() => openTask(r.task.id), 300); }
  catch (e) { result = { err: e.message }; }
  try { history.replaceState(null, '', location.pathname); } catch { }
})();
render();

/* ---------- 60-second guided tour: runs the real engine on a fresh sample ---------- */
const TOUR = [
  { who: 'Rahul', k: 'The rep', h: '100 open leads. 10 actions today.', p: 'Rahul has 17 open tasks: 12 are due now, and Today shows at most 10 of them, so the two over the cap are counted, not hidden. Ranked by rules he can read: days past target, money-blocking stage, then deal value as a tie-break.', run: () => { w = E.withHistory(E.sample(realToday)); }, at: () => $('#desk .card') },
  { who: 'Rahul', k: 'Scheme, no ask', h: 'A live scheme applies by itself', p: 'Aarav’s ₹4.8L order qualifies for the 3% volume slab. Pre-approved, so it applies at once: ₹14,400 off before GST, logged.', run: () => { w = E.applyScheme(w, 'T-101', 'Rahul', 'SCH-01'); }, open: 'T-101', at: () => $('#panel') },
  { who: 'Rahul', k: 'Discount ask', h: 'He asks for 9% more. The task freezes.', p: 'The ask goes to Kavita, who is allowed to decide up to 10% within the margin floor. Rahul’s task leaves Today; the clock is now on her.', run: () => { w = E.askDiscount(w, 'T-101', 'Rahul', 9, 'Rival quoted 9% lower'); }, at: () => document.querySelectorAll('#desk .side .card')[0] },
  { who: 'Kavita', k: 'The approver', h: 'Three numbers to decide', p: 'Kavita sees the ask in rupees before GST, the margin floor and the dealer’s credit. She can approve, counter or send back. She can’t decide her own asks.', at: () => [...document.querySelectorAll('.ask')].find(x => x.textContent.includes('Aarav')) },
  { who: 'Kavita', k: 'Decision', h: 'She approves 6%, not 9%, with an expiry', p: 'Rahul’s task comes back as “send the revised quote”. The decision is sealed in the record above. “Send to finance” passes it, fingerprint included, to Every Rupee, which checks the short payment against this exact cap.', run: () => { const a = w.approvals.find(x => x.taskId === 'T-101' && x.status === 'pending'); w = E.approve(w, a.id, 'Kavita', 6, E.addDays(w.today, 14)); }, at: () => document.querySelector('a[href*="every-rupee"]')?.closest('.card') },
  { who: 'Arjun', k: 'Controls', h: 'Nothing sits, nothing slips', p: 'An ask Kavita left for 2 days escalated to Arjun. A dealer past his credit days can only be approved with a written override, like a post-dated cheque.', at: () => $('#asks') },
  { who: 'Arjun', k: 'Sealed record', h: 'Someone quietly edits an old approval', p: 'We changed an old approval straight in the database, bypassing the app, the way an insider might. Then we verified. Its fingerprint no longer matches, so the record shows exactly which entry was altered. Rahul can’t claim 10% was approved when 6% was.', run: () => { w = E.simulateTamper(w); sealOpen = true; sealRes = null; }, after: () => { sealRes = E.verifyAnchored(w); renderSeal(); }, at: () => $('#seal') },
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
  let t = s.at?.(); const home = t?.closest?.('[data-in]')?.dataset.in; if (home && home !== tab && !s.open) { tab = home; render(); t = s.at?.(); }
  if (t) { t.classList.add('tour-hi'); if (!s.open) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  tourEl.innerHTML = `<p class="k">${i + 1} / ${TOUR.length} · ${s.k} · acting as ${esc(E.label(s.who))}</p><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p><div class="bar2"><i></i></div><div class="ctl"><button type="button" data-t="exit">Exit</button><button type="button" data-t="pause">${tPaused ? 'Play' : 'Pause'}</button><button type="button" class="go" data-t="next">${i === TOUR.length - 1 ? 'Finish' : 'Next →'}</button></div>`;
  tourEl.classList.add('on');
  const bar = tourEl.querySelector('.bar2 i');
  if (!tPaused) { requestAnimationFrame(() => { bar.style.transition = `width ${STEP_MS}ms linear`; bar.style.width = '100%'; }); tTimer = setTimeout(() => tourShow(i + 1), STEP_MS); }
}
function tourEnd(finished) {
  clearTimeout(tTimer); tStep = -1; tourEl.classList.remove('on'); document.querySelectorAll('.tour-hi').forEach(x => x.classList.remove('tour-hi'));
  try { $('#panel').open && $('#panel').close(); } catch { } panel = null;
  const im = E.impact(w);
  w = E.escalate(E.withHistory(E.sample(realToday))); actor = 'Rahul'; signedIn = true; sealRes = null; sealOpen = false; save();
  result = finished ? { text: `Outcome: ${inr(im.notGiven)} of discount asked was held back, every decision is sealed, and silent write-offs stay at ₹0.`, sub: "Your turn: the sample is fresh. Like what you see? Let's talk: rupakr2g@gmail.com" } : null;
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
