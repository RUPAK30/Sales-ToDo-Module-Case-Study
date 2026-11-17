import { test } from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../site/api/payment.js');
const call = async (req) => { const res = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } }; await mod.default({ headers: {}, ...req }, res); return res; };

test('lists the matched receipts from the shared sample ledger, Meera included', async () => {
  const r = await call({ method: 'GET' });
  const meera = r.body.receipts.find(x => x.id === 'D-102');
  assert.equal(meera.amount_collected, 736000);
  assert.equal(meera.expected, 736000);
  const royal = r.body.receipts.find(x => x.id === 'D-106');
  assert.equal(royal.expected - royal.amount_collected, 63000);
});

test('unknown discount is refused before anything is sent', async () => {
  const r = await call({ method: 'POST', body: { id: 'D-104' } });
  assert.equal(r.code, 400);
});

test('without credentials it shows the exact request instead', async () => {
  delete process.env.SN_INSTANCE;
  const r = await call({ method: 'POST', body: { id: 'D-102' } });
  assert.equal(r.body.live, false);
  assert.equal(r.body.request.body.invoice_number, 'INV-2603-208');
});

test('live: passes ServiceNow result through', async () => {
  process.env.SN_INSTANCE = 'https://x.service-now.com'; process.env.SN_USER = 'u'; process.env.SN_PASSWORD = 'p';
  globalThis.fetch = async () => ({ status: 200, headers: { get: () => 'application/json' }, json: async () => ({ result: { number: 'TTD0001002', gap: 0, c6: 'pass', lifecycle_stage: 'escalated' } }) });
  const r = await call({ method: 'POST', body: { id: 'D-102' }, headers: { 'x-forwarded-for': '7.7.7.7' } });
  assert.equal(r.body.live, true);
  assert.equal(r.body.c6, 'pass');
});
