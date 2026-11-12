// POST /api/payment-matched: Every Rupee tells Ten Today a payment was matched; Ten Today answers with the incentive effect.
// Stateless and deterministic: same input, same answer. Idempotency is enforced where the ledger lives (the app), keyed on idempotency_key.
import { realise, PLAN } from '../engine.js';
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST a payment.matched event.' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    if (b.event !== 'payment.matched') return res.status(400).json({ error: 'event must be "payment.matched".' });
    if (!b.idempotency_key) return res.status(400).json({ error: 'idempotency_key is required.' });
    const out = realise({ billed: Number(b.billed_amount), received: Number(b.actual_received), ratePct: Number(b.rate_pct ?? PLAN.ratePct), cureDays: Number(b.cure_days ?? PLAN.cureDays), today: b.matched_on ?? new Date().toISOString().slice(0, 10), gstMode: b.gst_mode, gstRate: Number(b.gst_rate ?? 18), discount: Number(b.approved_discount ?? 0) });
    return res.status(200).json({ idempotency_key: b.idempotency_key, order_id: b.order_id ?? null, rep: b.rep ?? null, incentive: { earned: out.earned, on_hold: out.held, gap: out.gap, cure_by: out.cureBy }, gst_not_recovered: out.gstNotRecovered, message: out.say, computed_by: 'rules (no AI)' });
  } catch (e) { return res.status(400).json({ error: e.message }); }
}
