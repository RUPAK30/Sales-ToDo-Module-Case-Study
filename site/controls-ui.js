import {
  SAMPLE_DISCOUNTS,
  evaluateDiscountControls,
  buildIntegrationPayload,
  computeWeeklyMis,
  sampleAuditPacks,
} from './controls.js';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

let records = structuredClone(SAMPLE_DISCOUNTS);
let selectedId = records[0].id;
let payloadTarget = 'servicenow';

function render() {
  const root = document.getElementById('ctrl-room');
  if (!root) return;

  const mis = computeWeeklyMis(records, { todayIso: '2026-11-13' });
  const active = records.find((r) => r.id === selectedId) || records[0];
  const activeEval = evaluateDiscountControls(active, { todayIso: '2026-11-13' });
  const netGain = mis.totalExtraMargin - mis.totalSpent - mis.totalGstAtRisk;

  root.querySelector('#cr-spent').textContent = fmt(mis.totalSpent);
  root.querySelector('#cr-margin').textContent = fmt(mis.totalExtraMargin);
  root.querySelector('#cr-gst').textContent = `${fmt(mis.totalGstAtRisk)} (${activeEval.daysLeft}d left)`;
  root.querySelector('#cr-pass').textContent = `${mis.passRatePct}%`;

  root.querySelector('#cr-waterfall').innerHTML = `
    <span><b>1. Spent:</b> ${fmt(mis.totalSpent)}</span> →
    <span><b>2. Extra Margin:</b> +${fmt(mis.totalExtraMargin)}</span> →
    <span><b>3. GST at Risk:</b> -${fmt(mis.totalGstAtRisk)}</span> →
    <span><b>4. Net Impact:</b> <b style="color:${netGain >= 0 ? '#0F766E' : '#B91C1C'}">${netGain >= 0 ? '+' : ''}${fmt(netGain)}</b></span>
  `;

  const sel = root.querySelector('#cr-record');
  sel.innerHTML = records
    .map((r) => `<option value="${r.id}" ${r.id === active.id ? 'selected' : ''}>${r.id} · ${r.dealer} (${fmt(r.discountAmount)})</option>`)
    .join('');

  root.querySelector('#cr-matrix').innerHTML = activeEval.controls
    .map(
      (c) => `
      <tr>
        <td><b>${c.id}</b> · ${c.name}</td>
        <td><span class="badge ${c.passed ? 'ok' : 'no'}">${c.passed ? 'PASS' : 'FAIL'}</span></td>
        <td>${c.summary}</td>
        <td>${c.owner}</td>
        <td>${c.slaHours}h</td>
      </tr>`
    )
    .join('');

  const tickets = activeEval.tickets;
  const exBox = root.querySelector('#cr-exceptions');
  if (!tickets.length) {
    exBox.innerHTML = `<p class="sm" style="color:#0F766E;font-weight:600">✓ All 7 controls passed for ${active.id}. Zero open exception tickets.</p>`;
  } else {
    const t = tickets[0];
    const payload = buildIntegrationPayload(t, payloadTarget);
    exBox.innerHTML = `
      <p class="sm" style="color:#B91C1C;font-weight:600">⚠ ${tickets.length} Exception Ticket(s) Auto-Spawned · Owner: ${t.owner} · SLA: ${t.slaHours}h</p>
      <div class="row" style="margin:6px 0">
        <button class="btn small ${payloadTarget === 'servicenow' ? 'primary' : ''}" data-pt="servicenow">ServiceNow Preview</button>
        <button class="btn small ${payloadTarget === 'jira' ? 'primary' : ''}" data-pt="jira">JIRA Preview</button>
      </div>
      <pre style="background:#0F172A;color:#E2E8F0;padding:10px;border-radius:8px;font-size:.72rem;overflow:auto;margin:0">${JSON.stringify(payload, null, 2)}</pre>
    `;
    exBox.querySelectorAll('[data-pt]').forEach((btn) => {
      btn.onclick = () => {
        payloadTarget = btn.dataset.pt;
        render();
      };
    });
  }
}

function wire() {
  const root = document.getElementById('ctrl-room');
  if (!root) return;

  root.querySelector('#cr-record').onchange = (e) => {
    selectedId = e.target.value;
    render();
  };

  root.querySelector('#sim-ims').onclick = () => {
    const r = records.find((x) => x.id === selectedId);
    if (r) r.imsStatus = 'REJECTED';
    render();
  };

  root.querySelector('#sim-251').onclick = () => {
    const r = records.find((x) => x.id === selectedId);
    if (r) {
      r.taxRoute = 'GST_CN';
      r.gstr9FilingDate = '2026-11-10';
    }
    render();
  };

  root.querySelector('#sim-c3').onclick = () => {
    const r = records.find((x) => x.id === selectedId);
    if (r) {
      r.isPromotionService = true;
      r.taxReviewDone = false;
    }
    render();
  };

  root.querySelector('#sim-reset').onclick = () => {
    records = structuredClone(SAMPLE_DISCOUNTS);
    selectedId = records[0].id;
    render();
  };

  root.querySelector('#cr-csv').onclick = () => {
    const mis = computeWeeklyMis(records, { todayIso: '2026-11-13' });
    const rows = [
      ['ID', 'Dealer', 'Spent', 'ExtraMargin', 'GstAtRisk', 'AllPassed', 'OpenTickets'],
      ...mis.evals.map(({ r, res }) => [
        r.id,
        r.dealer,
        r.discountAmount,
        r.extraMarginEarned || 0,
        res.gstAtRisk,
        res.allPassed,
        res.tickets.length,
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tentoday-weekly-control-mis.csv';
    a.click();
  };

  root.querySelector('#cr-audit').onclick = () => {
    const packs = sampleAuditPacks(records, 5);
    const out = root.querySelector('#cr-audit-out');
    out.hidden = false;
    out.innerHTML = `<p class="sm"><b>SOX Audit Sample (${packs.length} pack(s)):</b> ${packs
      .map((p) => `${p.id} (${p.dealer} · ${p.eval.allPassed ? 'PASS' : 'FAIL'})`)
      .join(' · ')}</p>`;
  };

  render();
}

document.addEventListener('DOMContentLoaded', wire);
