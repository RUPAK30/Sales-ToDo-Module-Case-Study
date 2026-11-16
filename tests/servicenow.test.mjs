import { test } from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../site/api/servicenow.js');
const call = async (body, ip = String(Math.random())) => { let out; const res = { code: 200, status(c) { this.code = c; return this; }, json(j) { out = { code: this.code, ...j }; } }; await mod.default({ method: 'POST', body, headers: { 'x-forwarded-for': ip } }, res); return out; };
const env = () => Object.assign(process.env, { SN_INSTANCE: 'https://dev.example.com', SN_USER: 'svc', SN_PASSWORD: 'x' });
const json = (status, body) => ({ status, headers: { get: () => 'application/json' }, json: async () => body });

test('not configured: fallback with the exact request, no network call', async () => {
  delete process.env.SN_INSTANCE; globalThis.fetch = () => { throw new Error('should not call'); };
  const r = await call({ id: 'D-102' });
  assert.equal(r.live, false); assert.equal(r.why, 'not_configured'); assert.equal(r.request.body.retailer, 'Meera Trading'); assert.equal(r.request.body.discount_amount, 64000);
});
test('unknown discount id is refused (visitors cannot send free text)', async () => {
  assert.equal((await call({ id: 'DROP TABLE' })).code, 400);
});
test('hibernating instance (HTML page) -> fallback "asleep"', async () => {
  env(); globalThis.fetch = async () => ({ status: 200, headers: { get: () => 'text/html' } });
  const r = await call({ id: 'D-102' }); assert.equal(r.live, false); assert.equal(r.why, 'asleep');
});
test('timeout -> fallback "asleep"', async () => {
  env(); globalThis.fetch = async () => { const e = new Error('t'); e.name = 'AbortError'; throw e; };
  assert.equal((await call({ id: 'D-102' })).why, 'asleep');
});
test('refused by ServiceNow -> fallback "refused" with status', async () => {
  env(); globalThis.fetch = async () => json(403, { error: { message: 'ACL' } });
  const r = await call({ id: 'D-102' }); assert.equal(r.why, 'refused'); assert.equal(r.status, 403);
});
test('live: creates the record and reads back the routing reason', async () => {
  env(); let n = 0;
  globalThis.fetch = async (url, init) => { n++;
    if (init?.method === 'POST') { assert.match(init.headers.Authorization, /^Basic /); return json(201, { result: { sys_id: 'abc', number: 'TTD0001099', approval: 'not requested' } }); }
    if (url.includes('sysapproval_approver')) return json(200, { result: [{ state: 'requested', approval_reason: "Discount within the sales manager's 10% limit" }] });
    return json(200, { result: { approval: 'requested' } }); };
  const r = await call({ id: 'D-102' });
  assert.equal(r.live, true); assert.equal(r.number, 'TTD0001099'); assert.equal(r.routed_to, 'Sales Managers'); assert.match(r.reason, /10% limit/); assert.equal(r.approval, 'requested');
});
test('above 10% routes to Sales Heads', async () => {
  env(); globalThis.fetch = async (url, init) => init?.method === 'POST' ? json(201, { result: { sys_id: 'p', number: 'TTD1', approval: 'x' } }) : json(200, { result: url.includes('sysapproval') ? [{ state: 'requested', approval_reason: 'Above 10%' }] : { approval: 'requested' } });
  assert.equal((await call({ id: 'D-108' })).routed_to, 'Sales Heads');
});
test('one send per visitor every 30 seconds', async () => {
  env(); globalThis.fetch = async () => ({ status: 200, headers: { get: () => 'text/html' } });
  await call({ id: 'D-102' }, '9.9.9.9'); assert.equal((await call({ id: 'D-102' }, '9.9.9.9')).code, 429);
});
