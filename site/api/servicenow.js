// POST /api/servicenow  { id: "D-102" }
// Sends one sample discount from Ten Today into the ServiceNow app "Ten Today Discount Approval"
// (table x_2315670_ten_to_0_discount_request), lets the approval flow route it, then reads the result back.
// Credentials live only in Vercel env vars: SN_INSTANCE, SN_USER, SN_PASSWORD. Never in the browser.
// The browser can only name a sample discount; the server builds the record, so visitors cannot write free text.
import { sampleDesk, discountOf } from '../controls.js';

const TABLE = 'x_2315670_ten_to_0_discount_request';
const COOLDOWN_MS = 30_000, TIMEOUT_MS = 6_000;
const recent = new Map(); // ip -> last send (resets on cold start; ServiceNow-side duplicate rule is the real guard)
const REASON = { price: 'Price cut', promo: 'Promotion', damage: 'Damage', early: 'Early payment' };

export function buildRecord(d) {
  const amount = discountOf(d);
  return {
    retailer: d.buyer,
    invoice_number: d.invoiceNo,
    invoice_date: d.invoiceDate,
    bill_value: d.value,
    usual_order: d.baseline,
    discount_pct: d.pct,
    discount_amount: amount,
    margin_pct: d.margin,
    reason: REASON[d.purpose] ?? 'Price cut',
    requested_by: 'Neha',
    short_description: `${d.pct}% discount for ${d.buyer} on ${d.invoiceNo} (sent from Ten Today)`,
    work_notes: `[Ten Today] Discount requested: Rs ${amount.toLocaleString('en-IN')} (${d.pct}%) for ${d.buyer} on ${d.invoiceNo}. Sample walkthrough.`,
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sn(path, init = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const auth = Buffer.from(`${process.env.SN_USER}:${process.env.SN_PASSWORD}`).toString('base64');
    const res = await fetch(`${process.env.SN_INSTANCE.replace(/\/$/, '')}${path}`, {
      ...init, signal: ctl.signal,
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return { asleep: true, status: res.status }; // a hibernating instance answers 200 with an HTML page
    return { status: res.status, body: await res.json() };
  } catch (e) {
    return { asleep: true, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST { id } to send a sample discount.' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  const d = sampleDesk().find(x => x.id === b.id);
  if (!d) return res.status(400).json({ error: 'Unknown sample discount.' });
  const record = buildRecord(d);
  const fallback = (why, extra = {}) => res.status(200).json({ live: false, why, request: { method: 'POST', endpoint: `/api/now/table/${TABLE}`, body: record }, ...extra });

  if (!process.env.SN_INSTANCE || !process.env.SN_USER || !process.env.SN_PASSWORD) return fallback('not_configured');

  const ip = String(req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim(), now = Date.now();
  if (now - (recent.get(ip) ?? 0) < COOLDOWN_MS) return res.status(429).json({ error: 'One send every 30 seconds, please.' });
  recent.set(ip, now);

  const made = await sn(`/api/now/table/${TABLE}?sysparm_fields=sys_id,number,approval`, { method: 'POST', body: JSON.stringify(record) });
  if (made.asleep) return fallback('asleep');
  if (made.status !== 201) return fallback('refused', { status: made.status, detail: made.body?.error?.message ?? null });
  const { sys_id, number } = made.body.result;

  // The flow runs a moment after the insert. Look up to three times before giving up.
  let approval = made.body.result.approval, reason = null, state = null;
  for (const wait of [1500, 1500, 2000]) {
    await sleep(wait);
    const a = await sn(`/api/now/table/sysapproval_approver?sysparm_query=sysapproval=${sys_id}&sysparm_fields=state,approval_reason&sysparm_limit=1`);
    const r = await sn(`/api/now/table/${TABLE}/${sys_id}?sysparm_fields=approval`);
    if (r.body?.result) approval = r.body.result.approval;
    if (a.body?.result?.[0]) { reason = a.body.result[0].approval_reason || null; state = a.body.result[0].state; break; }
  }
  return res.status(200).json({ live: true, number, approval, approval_state: state, reason, routed_to: d.pct <= 10 ? 'Sales Managers' : 'Sales Heads', request: { method: 'POST', endpoint: `/api/now/table/${TABLE}`, body: record } });
}
