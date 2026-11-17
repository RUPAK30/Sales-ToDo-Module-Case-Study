// POST /api/room { action, number } -> the Case Room. A visitor gets their own copy of the Meera File in ServiceNow,
// breaks one control at a time and repairs it. Only these named actions exist; the server never forwards free text.
import { sn } from './servicenow.js';

export const ACTIONS = ['start', 'self', 'fix_self', 'reject', 'fix_reject', 'tamper', 'fix_tamper', 'short', 'fix_short'];
const GAP_MS = 4000, STARTS_PER_HOUR = 6;
const last = new Map(), starts = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST { action, number }.' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  if (!ACTIONS.includes(b.action)) return res.status(400).json({ error: 'Unknown action.' });
  if (b.action !== 'start' && !/^TTD\d{7}$/.test(String(b.number ?? ''))) return res.status(400).json({ error: 'Start a Case Room copy first.' });
  if (!process.env.SN_INSTANCE || !process.env.SN_USER || !process.env.SN_PASSWORD) return res.status(200).json({ live: false, why: 'not_configured' });

  const ip = String(req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim(), now = Date.now();
  if (now - (last.get(ip) ?? 0) < GAP_MS) return res.status(429).json({ error: 'One action every few seconds, please.' });
  if (b.action === 'start') {
    const recent = (starts.get(ip) ?? []).filter(t => now - t < 3_600_000);
    if (recent.length >= STARTS_PER_HOUR) return res.status(429).json({ error: 'That is plenty of copies for one hour. Use the one you have.' });
    starts.set(ip, [...recent, now]);
  }
  last.set(ip, now);

  const out = await sn('/api/x_2315670_ten_to_0/discount/room', { method: 'POST', body: JSON.stringify({ action: b.action, number: b.number }) });
  if (out.asleep) return res.status(200).json({ live: false, why: 'asleep' });
  if (out.status !== 200) return res.status(200).json({ live: false, why: 'refused', detail: out.body?.result?.error ?? null });
  return res.status(200).json({ live: true, number: out.body.result.number });
}
