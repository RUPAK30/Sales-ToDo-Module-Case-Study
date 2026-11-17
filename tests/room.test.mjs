import { test } from 'node:test';
import assert from 'node:assert/strict';
const mod = await import('../site/api/room.js');
const call = async (body, ip = '1.1.1.1') => { const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; await mod.default({ method: 'POST', body, headers: { 'x-forwarded-for': ip } }, res); return res; };
test('only named actions are accepted', async () => { assert.equal((await call({ action: 'delete_everything' })).code, 400); });
test('actions other than start need a case number', async () => { assert.equal((await call({ action: 'tamper', number: "x' or 1=1" })).code, 400); });
test('live: forwards only the action and number, and rate-limits', async () => {
  process.env.SN_INSTANCE = 'https://x.service-now.com'; process.env.SN_USER = 'u'; process.env.SN_PASSWORD = 'p';
  let sent; globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return { status: 200, headers: { get: () => 'application/json' }, json: async () => ({ result: { number: 'TTD0001030' } }) }; };
  const r = await call({ action: 'tamper', number: 'TTD0001030', extra: 'ignored' }, '2.2.2.2');
  assert.equal(r.body.live, true); assert.deepEqual(sent, { action: 'tamper', number: 'TTD0001030' });
  assert.equal((await call({ action: 'fix_tamper', number: 'TTD0001030' }, '2.2.2.2')).code, 429);
});
