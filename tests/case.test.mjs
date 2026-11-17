import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const mod = await import('../site/api/case.js');
const { sha256 } = await import('../site/engine.js');

test('canonical string: fixed order, TT1 prefix, pipe-joined, trimmed', () => {
  const s = mod.canonical({ number: 'TTD0001002', retailer: 'Meera Trading', invoice_number: 'INV-2603-208', invoice_date: '2026-03-20', bill_value: '800000', discount_pct: '8', discount_amount: '64000', approved_by_name: 'Vikram', approved_on: '2026-11-17' });
  assert.equal(s, 'TT1|TTD0001002|Meera Trading|INV-2603-208|2026-03-20|800000|8|64000|Vikram|2026-11-17');
});
test("the engine's SHA-256 matches Node's on the canonical string, including non-ASCII", () => {
  for (const s of ['TT1|TTD0001002|Meera Trading|INV-2603-208|2026-03-20|800000|8|64000|Vikram|2026-11-17', 'TT1|x|Shrī Gaṇesh ₹|y']) assert.equal(sha256(s), createHash('sha256').update(s, 'utf8').digest('hex'));
});
test('bad case IDs are refused before anything is read', async () => {
  const res = { code: 0, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await mod.default({ query: { number: "x' OR 1=1" } }, res);
  assert.equal(res.code, 400);
});
