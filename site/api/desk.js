// GET /api/desk -> the ten sample discounts as ServiceNow holds them now (checks, money, incidents open and resolved),
// joined with each credit note's real deadline from Ten Today's engine (s.34(2): 30 Nov after the FY,
// or 30 days to report where e-invoicing applies). Read-only.
import { sampleDesk, desk, SETTINGS, HISTORY, OPENED, todayIso } from '../controls.js';
import { sn } from './servicenow.js';

export function deadlines(today = todayIso()) {
  const k = desk(sampleDesk(), { today, settings: SETTINGS, history: HISTORY, opened: OPENED });
  return Object.fromEntries(k.rows.map(({ d, r }) => [d.invoiceNo, { date: r.deadline.date, why: r.deadline.why, daysLeft: r.daysLeft, gst: r.gst, safe: r.controls.find(c => c.id === 'C5').status === 'pass' }]));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.SN_INSTANCE || !process.env.SN_USER || !process.env.SN_PASSWORD) return res.status(200).json({ live: false, why: 'not_configured' });
  const got = await sn('/api/x_2315670_ten_to_0/discount/desk');
  if (got.asleep) return res.status(200).json({ live: false, why: 'asleep' });
  if (got.status !== 200) return res.status(200).json({ live: false, why: 'refused' });
  const dl = deadlines();
  return res.status(200).json({ live: true, rows: got.body.result.rows.map(r => ({ ...r, deadline: r.settled && dl[r.invoice] ? { ...dl[r.invoice], gst: 0, safe: true, settled: `${r.settled}: Rs ${r.settled_amount} given up, nothing left to expire` } : dl[r.invoice] ?? null })) });
}
