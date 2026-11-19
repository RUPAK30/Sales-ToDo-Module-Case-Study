// The Meera File: a case read live from ServiceNow, with one fingerprint checked in three places.
import { sha256 } from './engine.js';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rs = n => '₹' + Math.round(+n || 0).toLocaleString('en-IN');
const CHECKS = [
  ['c1_worth_it', 'C1', 'Worth it?', 'UAT-01, 09, 10'], ['c2_right_person', 'C2', 'Right person?', 'UAT-02, 03'],
  ['c3_really_price_cut', 'C3', 'Really a price cut?', 'UAT-04'], ['c4_paperwork_on_time', 'C4', 'Paperwork on time?', 'UAT-05, 06, 07'],
  ['c5_retailer_accepted', 'C5', 'Retailer accepted?', 'automated tests'], ['c6_right_money', 'C6', 'Right money?', 'automated tests'], ['c7_record_untouched', 'C7', 'Record untouched?', 'UAT-08'],
];
const LABEL = { yes: 'Yes', no: 'No', waiting: 'Waiting', not_yet: 'Not yet' };
const STAGE = { requested: 'Requested', routed: 'Routed', approved: 'Approved', rejected: 'Rejected', credit_note_pending: 'Credit note pending', paid_no_gap: 'Paid, no gap', paid_gap: 'Paid, gap detected', ims_rejected: 'IMS rejected', escalated: 'Escalated', resolved: 'Resolved', closed: 'Closed' };
const WHY = { not_configured: 'The live connection is not switched on.', asleep: 'The ServiceNow demo instance is asleep (free developer instances pause when idle). Try again in a minute.' };

async function browserHash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const canonical = r => ['TT1', 'number', 'retailer', 'invoice_number', 'invoice_date', 'bill_value', 'discount_pct', 'discount_amount', 'approved_by_name', 'approved_on'].map((f, i) => i ? String(r[f] ?? '').trim() : f).join('|');
const src = t => t.startsWith('[ServiceNow]') ? 'sn' : t.startsWith('[Ten Today]') ? 'tt' : t.startsWith('[Every Rupee]') ? 'er' : '';

// Snapshot first, live second: the page answers in under a second even while the free ServiceNow instance wakes up.
let SNAP = null;
async function load(number) {
  $('#status').textContent = `Reading ${number} from ServiceNow…`; $('#out').innerHTML = ''; $('#vbox').innerHTML = '';
  let liveDone = false;
  if (number === 'TTD0001048') fetch('meera-snapshot.json').then(r => r.json()).then(s => { SNAP = s; if (!liveDone) render(s, 'snap'); }).catch(() => {});
  let j; try { const r = await fetch(`/api/case?number=${encodeURIComponent(number)}`); j = await r.json(); if (!r.ok) throw new Error(j.error); }
  catch (e) { j = { live: false, why: 'net', err: e.message }; }
  if (!j.live) { if (SNAP && number === 'TTD0001048') { render(SNAP, 'snap', WHY[j.why] ?? j.err ?? 'ServiceNow did not answer'); return; } $('#status').textContent = j.err || WHY[j.why] || 'ServiceNow did not answer.'; return; }
  liveDone = true; render(j, 'live');
}
async function render(j, how, why) {
  const r = j.record, canon = canonical(r), mine = await browserHash(canon), engine = sha256(canon), stored = (r.approval_seal || '').toLowerCase();
  const sealed = Boolean(stored), match = sealed && stored === mine && mine === engine && j.engine_hash === engine && canon === j.canonical;
  $('#title').textContent = `The ${r.retailer.split(' ')[0]} File · ${r.number}`;
  $('#status').textContent = how === 'live' ? `Read live from ServiceNow at ${new Date().toLocaleString('en-IN')}. Last changed there ${r.sys_updated_on} UTC.` : `Saved snapshot of the live record, read ${j.read_on}. ${why ? 'Live read failed (' + why + '), so this is the snapshot; the fingerprints are still checked in your browser now.' : 'Reading it live from ServiceNow…'}`;
  const disc = +r.discount_amount, gst = +r.gst_at_stake, gap = +r.gap_amount;
  const hrow = (who, h, how) => `<div><b>${who}</b><code>${esc(h || '(no seal yet)')}</code><span class="${h && h === stored ? 'ok' : 'bad'}">${h && h === stored ? '✓' : '✗'}</span><small class="note" style="grid-column:2/4">${how}</small></div>`;
  const parts = `
  <section class="bs"><p class="k">Verify it yourself</p><h2>Is the approved deal exactly what was approved?</h2>
    <p class="verdict ${match ? 'ok' : 'bad'}" style="margin-top:0">${!sealed ? 'Not sealed yet: a discount is sealed when it is approved.' : match ? `✓ All three fingerprints match. The approved terms are exactly what was approved${(j.activity ?? []).some(a => a.text.includes('C7 repaired')) ? ' again: an earlier change was reversed by a correcting entry, and the log below keeps both' : ''}.` : '✗ The fingerprints do not match. Something in the approved terms changed after approval: check 7 fails.'}</p><details><summary class="note" style="cursor:pointer">See the three fingerprints</summary><code class="canon">${esc(canon)}</code>
    <div class="hashes">${hrow('ServiceNow seal', stored, `GlideDigest SHA-256, stored at approval${r.sealed_on ? ' on ' + esc(r.sealed_on) : ''}`)}${hrow('Ten Today engine', engine, "Ten Today's own SHA-256 code, run on the record just read")}${hrow('Your browser', mine, 'Web Crypto, run on this page just now')}</div></details></section>
  @@SPLIT@@<section class="bs"><p class="k">The money</p><h2>${esc(r.retailer)} · ${esc(r.invoice_number)} · ${STAGE[r.lifecycle_stage] ?? esc(r.lifecycle_stage)}</h2>
    <div class="money"><div><small>Bill</small><b>${rs(r.bill_value)}</b></div><div><small>Given back (${esc(r.discount_pct)}%)</small><b>${rs(disc)}</b></div><div><small>GST at stake (18%)</small><b>${rs(gst)}</b></div><div><small>Money at risk</small><b class="${+r.money_at_risk ? 'bad' : 'ok'}">${rs(r.money_at_risk)}</b></div><div><small>Received${r.collection_date ? ' on ' + esc(r.collection_date) : ''}</small><b>${r.amount_collected ? rs(r.amount_collected) : '—'}</b></div><div><small>Gap</small><b class="${gap ? 'bad' : 'ok'}">${r.amount_collected ? rs(gap) : '—'}</b></div></div>
    <p class="note">The arithmetic: given back = ${rs(r.bill_value)} × ${esc(r.discount_pct)}% = ${rs(disc)}. GST at stake = ${rs(disc)} × 18% = ${rs(gst)}. Break-even = discount ÷ (margin − discount) = ${esc(r.discount_pct)} ÷ (${esc(r.margin_pct)} − ${esc(r.discount_pct)}) = ${esc(r.break_even_pct)}% more buying needed; the retailer bought ${esc(r.uplift_pct)}% more. Gap = bill − discount − received. Money at risk = the discount if it didn't pay for itself, plus the GST if the retailer rejected the credit note, plus any amount paid short. The 51.15% margin is a stated stand-in, not a fact about any retailer.</p></section>
  <section class="bs"><p class="k">Two things ServiceNow records, not this page</p><h2>Was it worth it, and what did we give up?</h2>
    <ul class="checks"><li><b>C1</b><span>Forecast at approval${r.c1_forecast_on ? ' · ' + esc(r.c1_forecast_on) : ''}<small class="note" style="display:block">${esc(r.c1_forecast || 'Set when the discount is approved.')}</small></span><span class="pill waiting">forecast</span></li>
    <li><b>C1</b><span>Verdict at period close${r.c1_confirmed_on ? ' · ' + esc(r.c1_confirmed_on) : ''}<small class="note" style="display:block">${r.c1_confirmed_on ? `The retailer bought ${esc(r.uplift_pct)}% more against ${esc(r.break_even_pct)}% needed.` : 'Not known until the period closes.'}</small></span><span class="pill ${r.c1_worth_it}">${LABEL[r.c1_worth_it] ?? esc(r.c1_worth_it)}</span></li>
    <li><b>₹</b><span>Settlement${r.settled_on ? ' · ' + esc(r.settled_on) : ''}<small class="note" style="display:block">${r.settlement_type ? `${esc(r.settlement_type)}: ${rs(r.settlement_amount)}, approved by ${esc(r.settled_by)}. Stored as fields on the case, so it totals across every retailer.` : 'Nothing settled yet.'}</small></span><span class="pill ${r.settlement_type ? 'no' : 'waiting'}">${r.settlement_type ? rs(r.settlement_amount) + ' given up' : 'none'}</span></li></ul>
    <p class="note">C1 is checked twice on purpose: at approval nobody knows yet whether the retailer will buy more, so it is a forecast; the verdict comes at period close, and only then can it fail and open an incident.</p></section>
  <section class="bs"><p class="k">Seven questions</p><h2>Where each check stands in ServiceNow</h2>
    <ul class="checks">${CHECKS.map(([f, id, name, uat]) => `<li><b>${id}</b><span>${name}<small class="note" style="display:block">Covered by ${uat}${uat.startsWith('UAT') ? ' in the <a href="ba.html#uat">BA pack</a>' : ''}</small></span><span class="pill ${r[f]}">${LABEL[r[f]] ?? esc(r[f])}</span></li>`).join('')}</ul></section>
  <section class="bs"><p class="k">Who is fixing it</p><h2>${j.incidents.length ? `${j.incidents.length} incident${j.incidents.length > 1 ? 's' : ''}, each with a named owner and a 48-hour SLA` : 'No incidents: nothing failed'}</h2>
    ${j.incidents.length ? `<div style="overflow-x:auto"><table><thead><tr><th>Incident</th><th>What failed</th><th>Owner</th><th>State</th><th>Opened (UTC)</th><th>SLA (ServiceNow)</th></tr></thead><tbody>${j.incidents.map(i => `<tr><td><b>${esc(i.number)}</b></td><td>${esc(i.title)}</td><td>${esc(i.owner)} · ${esc(i.group)}</td><td>${esc(i.state)}</td><td>${esc(i.opened)}</td><td>${i.sla ? esc(i.sla.breached ? 'Breached · due ' + i.sla.due : i.sla.stage === 'completed' ? 'Met · fixed before ' + i.sla.due : 'Due ' + i.sla.due) : '—'}${i.close_notes ? `<small class="note" style="display:block">${esc(i.close_notes)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}</section>
  <section class="bs"><p class="k">The record, in order</p><h2>Every line written by one of three systems</h2>
    ${j.activity ? `<ol class="tl">${j.activity.map(a => `<li class="${src(a.text)}">${esc(a.text)}<small>${esc(a.on)} UTC</small></li>`).join('')}</ol>` : '<p class="note">The activity log is visible inside ServiceNow; this read-only connection is not allowed to read it.</p>'}
    <p class="note">Brown: ServiceNow. Amber: Ten Today. Teal: Every Rupee. Entries are timestamped when they happened and marked "Sample walkthrough"; nothing is back-dated.</p></section>
  <section class="bs"><p class="k">What would change my mind</p><h2>Where this case file could be wrong</h2>
    <ul><li>The 51.15% margin is a stand-in. With the brand's real margin, the break-even and check 1 could change.</li><li>"Bought nothing extra" compares this bill with the usual order in the sample. A seasonal dip would make the usual order the wrong yardstick.</li><li>The retailer's IMS response is recorded by finance from the GST portal. Ten Today and ServiceNow never connect to the portal, so they can't see a response finance hasn't recorded.</li><li>The seal proves the approved terms didn't change. It can't prove the approval was a good decision.</li></ul></section>`;
  const aud = j.audit ?? [];
  const audit = `<section class="bs"><p class="k">Field history · sys_audit</p><h2>${aud.length ? `${aud.length} recorded change${aud.length > 1 ? 's' : ''} to the key fields` : 'No recorded changes to the key fields'}</h2>
    ${aud.length ? `<div style="overflow-x:auto"><table><thead><tr><th>When (UTC)</th><th>Field</th><th>From</th><th>To</th><th>By</th></tr></thead><tbody>${aud.map(a => `<tr><td>${esc(a.on)}</td><td>${esc(a.field)}</td><td>${esc(a.from)}</td><td>${esc(a.to)}</td><td>${esc(a.by)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="note">This is ServiceNow's own audit table, separate from the seal. A UI policy stops edits in the form; anything that bypasses the form still lands here, and C7 fails. Auditing was switched on for this table on 19 Nov 2026, so earlier changes are in the work notes only. Break the amount in the Case Room to see a row appear.</p></section>`;
  const [v, rest] = parts.split('@@SPLIT@@'); $('#vbox').innerHTML = v; $('#out').innerHTML = rest + audit;
}
$('#go').addEventListener('click', () => load($('#n').value.trim().toUpperCase()));
$('#n').addEventListener('keydown', e => e.key === 'Enter' && $('#go').click());
$('#print').addEventListener('click', () => print());
const RCM = [
  [0, 'A discount that buys no extra sales', 'Vikram · Finance', r => r.discount, 'UAT-01, 09, 10'],
  [1, 'Approved by the requester, or above the 8% limit', 'Vikram · Finance', r => r.discount, 'UAT-02, 03 · ATF-01, 02'],
  [2, 'A service, ad or return booked as a discount', 'Farah · Tax Desk', r => r.discount, 'UAT-04'],
  [3, 'A late or wrong-rule credit note loses the GST cut', 'Farah · Tax Desk', r => r.gst, 'UAT-05, 06, 07'],
  [4, 'The retailer rejects the note on the GST portal', 'Asha · Receivables', r => r.gst, 'ATF-03'],
  [5, 'The wrong money arrives', 'Asha · Receivables', r => Math.max(0, r.gap || 0), 'ATF-06'],
  [6, 'The approved terms change after approval', 'Vikram · Finance', r => r.discount, 'UAT-08 · ATF-04, 05'],
];
async function deskView() {
  let j; try { j = await (await fetch('/api/desk')).json(); } catch { j = {}; }
  if (!j.live) { $('#desk-out').innerHTML = `<p class="note">${WHY[j.why] ?? 'ServiceNow did not answer.'}</p>`; return; }
  const R = j.rows, sum = f => R.reduce((s, r) => s + f(r), 0), clean = R.filter(r => r.checks.every(c => c === 'yes')).length;
  const sym = { yes: '✓', no: '✗', waiting: '…', not_yet: '·' };
  const open = R.filter(r => r.deadline && !r.deadline.safe && r.gst).sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);
  const max = Math.max(...open.map(r => r.deadline.daysLeft), 1);
  $('#desk-out').innerHTML = `<div class="money"><div><small>All seven checks pass</small><b class="ok">${clean} of ${R.length}</b></div><div><small>Incidents open, with an owner</small><b class="bad">${sum(r => r.open)}</b></div><div><small>Incidents recovered</small><b class="ok">${sum(r => r.resolved)}</b></div><div><small>Money at risk</small><b class="bad">${rs(sum(r => r.at_risk))}</b></div></div>
    <div style="overflow-x:auto;margin-top:12px"><table class="mx"><thead><tr><th>Case</th><th>Retailer</th>${CHECKS.map(c => `<th title="${c[2]}">${c[1]}</th>`).join('')}<th>At risk</th><th>Open</th></tr></thead><tbody>${R.map(r => `<tr><td><a href="?case=${r.number}">${r.number}</a></td><td>${esc(r.retailer)}</td>${r.checks.map(c => `<td class="c"><span class="${c}">${sym[c] ?? esc(c)}</span></td>`).join('')}<td>${r.at_risk ? rs(r.at_risk) : '—'}</td><td>${r.open || '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">✓ yes · ✗ no, routed to its owner with a 48-hour SLA · … waiting on a named person. Click a case to open its file.</p>
    <h2 style="margin-top:16px">Risk and control matrix</h2>
    <p class="note">One row per control: the risk it covers, who owns a failure, where the ten discounts stand, and the rupees behind the failures. Counted live from the records above.</p>
    <div style="overflow-x:auto"><table><thead><tr><th>Control</th><th>Risk it covers</th><th>Owner</th><th>Pass</th><th>Waiting</th><th>Fail</th><th>₹ behind failures</th><th>Tested by</th></tr></thead><tbody>${RCM.map(([i, risk, owner, money, tests]) => { const st = R.map(r => r.checks[i]); const failed = R.filter(r => r.checks[i] === 'no'); return `<tr><td><b>${CHECKS[i][1]}</b> ${CHECKS[i][2]}</td><td>${risk}</td><td>${owner}</td><td class="ok">${st.filter(x => x === 'yes').length}</td><td class="wait">${st.filter(x => x === 'waiting' || x === 'not_yet').length}</td><td class="${failed.length ? 'bad' : ''}">${failed.length}</td><td>${failed.length ? rs(failed.reduce((s, r) => s + money(r), 0)) : '—'}</td><td class="note">${tests}</td></tr>`; }).join('')}</tbody></table></div>
    <h2 style="margin-top:16px">The deadline window: tax savings that expire</h2>
    <p class="note">Each bar is a credit note whose GST is not yet safe, sorted by the clock. The deadline is the real one from Ten Today's rules (30 Nov after the financial year, under s.34(2) of the GST Act). Per day left is the GST at stake divided by the days remaining: what each day of waiting puts on the line.</p>
    <div class="dw">${open.map(r => `<div class="${r.deadline.daysLeft < 0 ? 'past' : ''}"><span><b>${esc(r.retailer)}</b><small class="note" style="display:block">${r.deadline.date} · ${r.deadline.daysLeft < 0 ? 'passed' : r.deadline.daysLeft + ' days left'}</small></span><i style="width:${Math.max(6, 100 - r.deadline.daysLeft / max * 94)}%"></i><span>${rs(r.deadline.gst)} GST<small class="note" style="display:block">${r.deadline.daysLeft > 0 ? rs(r.deadline.gst / r.deadline.daysLeft) + ' per day left' : 'deadline passed'}</small></span></div>`).join('') || '<p class="note">No GST waiting: every credit note is safe.</p>'}</div>`;
}
deskView();
let mine = null, seen = new Set(), lastBreak = null;
const FIX = { self: 'fix_self', reject: 'fix_reject', tamper: 'fix_tamper', short: 'fix_short' };
const say = (t, busy) => { $('#r-status').innerHTML = (busy ? '<span class="spin"></span>' : '') + esc(t); };
const step = n => ['#st1', '#st2', '#st3', '#st4'].forEach((s, i) => { $(s).className = i < n - 1 ? 'done' : i === n - 1 ? 'on' : ''; });
const lane = t => t.startsWith('[Every Rupee]') ? '#l-er' : t.startsWith('[Ten Today]') ? '#l-tt' : '#l-sn';
const clean = t => esc(t.replace(/^\[[^\]]+\]\s*/, '').replace(/ Sample walkthrough\.?$/, ''));
function sla(i) { // ServiceNow's own task_sla record: due time and breach flag come from the platform
  const s = i.sla; if (!s) return 'no SLA';
  if (s.breached) return 'SLA breached';
  if (s.stage === 'completed') return 'fixed inside SLA';
  const left = new Date(s.due.replace(' ', 'T') + 'Z').getTime() - Date.now();
  return left <= 0 ? 'SLA breached' : `${Math.floor(left / 3600e3)}h ${Math.floor(left % 3600e3 / 60e3)}m left (SLA due ${s.due} UTC)`;
}
async function watch(rounds, done) {
  for (let k = 0; k < rounds; k++) {
    let j; try { j = await (await fetch(`/api/case?number=${mine}`)).json(); } catch { j = {}; }
    if (j.live) {
      const r = j.record;
      $('#chips').innerHTML = CHECKS.map(([f, id]) => `<span class="${r[f]}" title="${id}">${id} ${({ yes: '✓', no: '✗', waiting: '…' })[r[f]] ?? '·'}</span>`).join('');
      $('#r-risk').textContent = rs(+r.money_at_risk);
      const open = j.incidents.filter(i => !/resolved|closed/i.test(i.state)), last = j.incidents.at(-1);
      $('#r-inc').innerHTML = last ? `<small>Incident ${esc(last.number)}</small><b>${esc(last.owner)} · ${open.length ? sla(last) : 'resolved ✓'}</b>` : '<small>Incident</small><b>none</b>';
      document.querySelectorAll('.lane li.new').forEach(li => li.classList.remove('new'));
      for (const a of j.activity ?? []) {
        const key = a.on + a.text; if (seen.has(key)) continue; seen.add(key);
        $(lane(a.text)).insertAdjacentHTML('beforeend', `<li class="new">${clean(a.text)}<small>${esc(a.on.slice(11))} UTC</small></li>`);
      }
      if (j.incidents.length) for (const i of j.incidents) { const key = 'inc' + i.number + i.state; if (seen.has(key)) continue; seen.add(key); $('#l-sn').insertAdjacentHTML('beforeend', `<li class="new">Incident <b>${esc(i.number)}</b> · ${esc(i.title)} · ${esc(i.owner)} · <b>${esc(i.state)}</b></li>`); }
    }
      if (done && done(j)) return;
    await new Promise(t => setTimeout(t, 2000));
  }
}
async function act(action) {
  document.querySelectorAll('#room button').forEach(b => b.disabled = true);
  const WAIT = { start: 'Getting your copy from ServiceNow. Usually seconds; up to a minute or two if the free instance is waking.', self: 'ServiceNow is checking who is approving…', reject: 'Recording the rejection; ServiceNow is opening an incident for Asha…', tamper: 'Changing the amount; ServiceNow is re-checking the seal…', short: 'Every Rupee is matching the payment…', fix_self: 'Restoring the valid approval…', fix_reject: 'Settling it as a financial credit note…', fix_tamper: 'Reversing the change with a correcting entry…', fix_short: 'Every Rupee is matching the balance…' };
  say(WAIT[action] ?? 'Working…', true);
  try {
    const r = await fetch('/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, number: mine }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    if (!j.live) throw new Error(WHY[j.why] ?? (j.detail || 'ServiceNow refused it.'));
    if (action === 'start') {
      mine = j.number; $('#r-start-box').hidden = true; $('#r-live').hidden = false; $('#r-pick').hidden = false; step(2);
      await watch(2); say(`Your copy is ${mine}. Now pick what goes wrong.`);
    } else if (FIX[action]) {
      lastBreak = action; $('#r-pick').hidden = true; step(3);
      const F = { self: 'c2_right_person', reject: 'c5_retailer_accepted', tamper: 'c7_record_untouched', short: 'c6_right_money' }[action];
      await watch(60, j => j.live && j.record[F] === 'no' && (action !== 'reject' || j.incidents.length)); step(4); $('#r-fix').hidden = false; say('Caught. Now fix it.');
    } else {
      $('#r-fix').hidden = true; const G = { fix_self: 'c2_right_person', fix_reject: 'c5_retailer_accepted', fix_tamper: 'c7_record_untouched', fix_short: 'c6_right_money' }[action];
      await watch(60, j => j.live && j.record[G] === 'yes');
      ['#st1', '#st2', '#st3', '#st4'].forEach(s => $(s).className = 'done'); $('#r-again').hidden = false;
      say(action === 'fix_reject' ? 'Recovered, at a cost: the ₹11,520 GST cut is given up on the record.' : 'Recovered. The failure stays in the record, next to the fix.');
    }
  } catch (e) { say(e.message || 'Could not reach the server.'); }
  finally { document.querySelectorAll('#room button').forEach(b => b.disabled = false); }
}
$('#r-start').addEventListener('click', () => act('start'));
$('#r-pick').addEventListener('click', e => { const a = e.target.closest('[data-r]')?.dataset.r; if (a) act(a); });
$('#r-fix').addEventListener('click', () => act(FIX[lastBreak]));
$('#r-again').addEventListener('click', () => { $('#r-again').hidden = true; $('#r-pick').hidden = false; step(2); say('Pick another.'); });
load(new URLSearchParams(location.search).get('case')?.toUpperCase() || 'TTD0001048');
