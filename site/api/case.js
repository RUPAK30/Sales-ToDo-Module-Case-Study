// GET /api/case?number=TTD0001048 -> the live ServiceNow record behind a case, read-only, for the public
// "Verify this case" page and the Case Room. The server also recomputes the fingerprint with Ten Today's own
// engine SHA-256 (no crypto library), so the page can show three hashes side by side:
// ServiceNow's stored seal (GlideDigest), Ten Today's engine, and the visitor's browser (Web Crypto).
import { sha256 } from '../engine.js';
import { sn, TABLE } from './servicenow.js';

export const SEAL_FIELDS = ['number', 'retailer', 'invoice_number', 'invoice_date', 'bill_value', 'discount_pct', 'discount_amount', 'approved_by_name', 'approved_on'];
export const canonical = r => ['TT1', ...SEAL_FIELDS.map(f => String(r[f] ?? '').trim())].join('|');
const CHECKS = ['c1_worth_it', 'c2_right_person', 'c3_really_price_cut', 'c4_paperwork_on_time', 'c5_retailer_accepted', 'c6_right_money', 'c7_record_untouched'];
const FIELDS = [...SEAL_FIELDS, 'sys_id', 'approval', 'lifecycle_stage', 'ims_status', 'margin_pct', 'break_even_pct', 'uplift_pct', 'usual_order', 'requested_by', 'gst_at_stake', 'money_at_risk', 'amount_collected', 'collection_date', 'gap_amount', 'approval_seal', 'seal_string', 'sealed_on', 'check_failed', 'sys_updated_on', 'c1_forecast', 'c1_forecast_on', 'c1_confirmed_on', 'settlement_type', 'settlement_amount', 'settled_by', 'settled_on', ...CHECKS];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const number = String(req.query?.number ?? '').toUpperCase();
  if (!/^TTD\d{7}$/.test(number)) return res.status(400).json({ error: 'Case IDs look like TTD0001048.' });
  if (!process.env.SN_INSTANCE || !process.env.SN_USER || !process.env.SN_PASSWORD) return res.status(200).json({ live: false, why: 'not_configured' });
  const got = await sn(`/api/now/table/${TABLE}?sysparm_query=number=${number}&sysparm_fields=${FIELDS.join(',')}&sysparm_limit=1`);
  if (got.asleep) return res.status(200).json({ live: false, why: 'asleep' });
  const rec = got.body?.result?.[0];
  if (!rec) return res.status(404).json({ error: `No case ${number}.` });
  const act = await sn(`/api/x_2315670_ten_to_0/discount/activity?number=${number}`);
  const canon = canonical(rec);
  return res.status(200).json({
    live: true, record: rec, canonical: canon,
    engine_hash: sha256(canon),
    incidents: act.body?.result?.incidents ?? [],
    activity: act.body?.result?.activity ?? null,
  });
}
