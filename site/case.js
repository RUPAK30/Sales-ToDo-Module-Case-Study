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

async function load(number) {
  $('#status').textContent = `Reading ${number} from ServiceNow…`; $('#out').innerHTML = '';
  let j; try { const r = await fetch(`/api/case?number=${encodeURIComponent(number)}`); j = await r.json(); if (!r.ok) throw new Error(j.error); }
  catch (e) { $('#status').textContent = e.message || 'Could not reach the server.'; return; }
  if (!j.live) { $('#status').textContent = WHY[j.why] ?? 'ServiceNow did not answer.'; return; }
  const r = j.record, canon = canonical(r), mine = await browserHash(canon), engine = sha256(canon), stored = (r.approval_seal || '').toLowerCase();
  const sealed = Boolean(stored), match = sealed && stored === mine && mine === engine && j.engine_hash === engine && canon === j.canonical;
  $('#title').textContent = `The ${r.retailer.split(' ')[0]} File · ${r.number}`;
  $('#status').textContent = `Read live from ServiceNow at ${new Date().toLocaleString('en-IN')}. Last changed there ${r.sys_updated_on} UTC.`;
  const disc = +r.discount_amount, gst = +r.gst_at_stake, gap = +r.gap_amount;
  const hrow = (who, h, how) => `<div><b>${who}</b><code>${esc(h || '(no seal yet)')}</code><span class="${h && h === stored ? 'ok' : 'bad'}">${h && h === stored ? '✓' : '✗'}</span><small class="note" style="grid-column:2/4">${how}</small></div>`;
  $('#out').innerHTML = `
  <section class="bs"><p class="k">1 · Verify</p><h2>Is the approved deal exactly what was approved?</h2>
    <code class="canon">${esc(canon)}</code>
    <div class="hashes">${hrow('ServiceNow seal', stored, `GlideDigest SHA-256, stored at approval${r.sealed_on ? ' on ' + esc(r.sealed_on) : ''}`)}${hrow('Ten Today engine', engine, "Ten Today's own SHA-256 code, run on the record just read")}${hrow('Your browser', mine, 'Web Crypto, run on this page just now')}</div>
    <p class="verdict ${match ? 'ok' : 'bad'}">${!sealed ? 'Not sealed yet: a discount is sealed when it is approved.' : match ? '✓ All three fingerprints match. The approved terms have not changed since approval.' : '✗ The fingerprints do not match. Something in the approved terms changed after approval: check 7 fails.'}</p></section>
  <section class="bs"><p class="k">2 · The money</p><h2>${esc(r.retailer)} · ${esc(r.invoice_number)} · ${STAGE[r.lifecycle_stage] ?? esc(r.lifecycle_stage)}</h2>
    <div class="money"><div><small>Bill</small><b>${rs(r.bill_value)}</b></div><div><small>Given back (${esc(r.discount_pct)}%)</small><b>${rs(disc)}</b></div><div><small>GST at stake (18%)</small><b>${rs(gst)}</b></div><div><small>Money at risk</small><b class="${+r.money_at_risk ? 'bad' : 'ok'}">${rs(r.money_at_risk)}</b></div><div><small>Received${r.collection_date ? ' on ' + esc(r.collection_date) : ''}</small><b>${r.amount_collected ? rs(r.amount_collected) : '—'}</b></div><div><small>Gap</small><b class="${gap ? 'bad' : 'ok'}">${r.amount_collected ? rs(gap) : '—'}</b></div></div>
    <p class="note">The arithmetic: given back = ${rs(r.bill_value)} × ${esc(r.discount_pct)}% = ${rs(disc)}. GST at stake = ${rs(disc)} × 18% = ${rs(gst)}. Break-even = discount ÷ (margin − discount) = ${esc(r.discount_pct)} ÷ (${esc(r.margin_pct)} − ${esc(r.discount_pct)}) = ${esc(r.break_even_pct)}% more buying needed; the retailer bought ${esc(r.uplift_pct)}% more. Gap = bill − discount − received. Money at risk = the discount if it didn't pay for itself, plus the GST if the retailer rejected the credit note. The 51.15% margin is a stated stand-in, not a fact about any retailer.</p></section>
  <section class="bs"><p class="k">3 · Seven questions</p><h2>Where each check stands in ServiceNow</h2>
    <ul class="checks">${CHECKS.map(([f, id, name, uat]) => `<li><b>${id}</b><span>${name}<small class="note" style="display:block">Covered by ${uat}${uat.startsWith('UAT') ? ' in the <a href="ba.html#uat">BA pack</a>' : ''}</small></span><span class="pill ${r[f]}">${LABEL[r[f]] ?? esc(r[f])}</span></li>`).join('')}</ul></section>
  <section class="bs"><p class="k">4 · Who is fixing it</p><h2>${j.incidents.length ? `${j.incidents.length} incident${j.incidents.length > 1 ? 's' : ''}, each with a named owner and a 48-hour SLA` : 'No incidents: nothing failed'}</h2>
    ${j.incidents.length ? `<div style="overflow-x:auto"><table><thead><tr><th>Incident</th><th>What failed</th><th>Owner</th><th>State</th><th>Opened (UTC)</th></tr></thead><tbody>${j.incidents.map(i => `<tr><td><b>${esc(i.number)}</b></td><td>${esc(i.title)}</td><td>${esc(i.owner)} · ${esc(i.group)}</td><td>${esc(i.state)}</td><td>${esc(i.opened)}</td></tr>`).join('')}</tbody></table></div>` : ''}</section>
  <section class="bs"><p class="k">5 · The record, in order</p><h2>Every line written by one of three systems</h2>
    ${j.activity ? `<ol class="tl">${j.activity.map(a => `<li class="${src(a.text)}">${esc(a.text)}<small>${esc(a.on)} UTC</small></li>`).join('')}</ol>` : '<p class="note">The activity log is visible inside ServiceNow; this read-only connection is not allowed to read it.</p>'}
    <p class="note">Brown: ServiceNow. Amber: Ten Today. Teal: Every Rupee. Entries are timestamped when they happened and marked "Sample walkthrough"; nothing is back-dated.</p></section>
  <section class="bs"><p class="k">6 · What would change my mind</p><h2>Where this case file could be wrong</h2>
    <ul><li>The 51.15% margin is a stand-in. With the brand's real margin, the break-even and check 1 could change.</li><li>"Bought nothing extra" compares this bill with the usual order in the sample. A seasonal dip would make the usual order the wrong yardstick.</li><li>The retailer's IMS response is recorded by finance from the GST portal. Ten Today and ServiceNow never connect to the portal, so they can't see a response finance hasn't recorded.</li><li>The seal proves the approved terms didn't change. It can't prove the approval was a good decision.</li></ul></section>`;
}
$('#go').addEventListener('click', () => load($('#n').value.trim().toUpperCase()));
$('#n').addEventListener('keydown', e => e.key === 'Enter' && $('#go').click());
$('#print').addEventListener('click', () => print());
let mine = null;
const say = t => { $('#r-status').textContent = t; };
async function room(action) {
  const btns = document.querySelectorAll('#room button'); btns.forEach(b => b.disabled = true);
  say(action === 'start' ? 'Creating your copy in ServiceNow…' : 'ServiceNow is working…');
  try {
    const r = await fetch('/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, number: mine }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    if (!j.live) throw new Error(WHY[j.why] ?? (j.detail || 'ServiceNow refused it.'));
    mine = j.number; $('#n').value = mine; $('#r-acts').hidden = false;
    await new Promise(t => setTimeout(t, action === 'reject' ? 3500 : 1200)); // the flow that opens the C5 incident runs a moment later
    await load(mine);
    say(`Your copy is ${mine}. Read it above.`);
    document.querySelector('#out').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { say(e.message || 'Could not reach the server.'); }
  finally { btns.forEach(b => b.disabled = false); }
}
$('#r-start').addEventListener('click', () => room('start'));
$('#r-acts').addEventListener('click', e => { const a = e.target.closest('[data-r]')?.dataset.r; if (a) room(a); });
load(new URLSearchParams(location.search).get('case')?.toUpperCase() || 'TTD0001002');
