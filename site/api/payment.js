// /api/payment: Every Rupee's matched receipts for Ten Today's sample discounts, sent to ServiceNow.
// GET  -> the receipts Every Rupee can send (from the same sample ledger Ten Today uses, so the numbers agree).
// POST { id: "D-102" } -> calls the Scripted REST endpoint /api/x_2315670_ten_to_0/discount/payment,
//      which sets amount collected and date, works out the gap, sets C6 and writes an [Every Rupee] work note.
// The browser can only name a sample discount; the server builds the payment. Credentials stay in Vercel env vars.
import { sampleDesk, discountOf } from '../controls.js';
import { sn } from './servicenow.js';

const COOLDOWN_MS = 30_000;
const recent = new Map();

export function receipts() {
  return sampleDesk().flatMap(d => d.events.filter(e => e.what === 'payment').map(e => ({
    id: d.id, retailer: d.buyer, invoice_number: d.invoiceNo, bill_value: d.value, discount_amount: discountOf(d),
    expected: d.value - discountOf(d), amount_collected: e.data.amount, collection_date: e.on, reference: e.data.ref,
  })));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ receipts: receipts() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET the receipts, or POST { id } to send one.' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  const r = receipts().find(x => x.id === b.id);
  if (!r) return res.status(400).json({ error: 'No matched receipt for that sample discount.' });
  const body = { invoice_number: r.invoice_number, amount_collected: r.amount_collected, collection_date: r.collection_date, reference: r.reference, source: 'Every Rupee' };
  const request = { method: 'POST', endpoint: '/api/x_2315670_ten_to_0/discount/payment', body };
  if (!process.env.SN_INSTANCE || !process.env.SN_USER || !process.env.SN_PASSWORD) return res.status(200).json({ live: false, why: 'not_configured', request });

  const ip = String(req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim(), now = Date.now();
  if (now - (recent.get(ip) ?? 0) < COOLDOWN_MS) return res.status(429).json({ error: 'One send every 30 seconds, please.' });
  recent.set(ip, now);

  const out = await sn(request.endpoint, { method: 'POST', body: JSON.stringify(body) });
  if (out.asleep) return res.status(200).json({ live: false, why: 'asleep', request });
  if (out.status !== 200) return res.status(200).json({ live: false, why: 'refused', status: out.status, detail: out.body?.result?.error ?? out.body?.error?.message ?? null, request });
  return res.status(200).json({ live: true, ...out.body.result, expected: r.expected, received: r.amount_collected, request });
}
