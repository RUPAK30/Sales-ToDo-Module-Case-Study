import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUTORY_CAP_DATE,
  effectiveDeadline,
  daysUntil,
  evaluateDiscountControls,
  buildIntegrationPayload,
  computeWeeklyMis,
  sampleAuditPacks,
  SAMPLE_DISCOUNTS,
} from '../site/controls.js';

test('effectiveDeadline uses min(30 Nov 2026, GSTR-9 filing date)', () => {
  assert.equal(STATUTORY_CAP_DATE, '2026-11-30');
  assert.equal(effectiveDeadline(), '2026-11-30');
  assert.equal(effectiveDeadline('2026-12-15'), '2026-11-30');
  assert.equal(effectiveDeadline('2026-11-20'), '2026-11-20');
});

test('daysUntil computes positive, zero, and negative day deltas', () => {
  assert.equal(daysUntil('2026-11-30', '2026-11-13'), 17);
  assert.equal(daysUntil('2026-11-13', '2026-11-13'), 0);
  assert.equal(daysUntil('2026-11-10', '2026-11-13'), -3);
});

test('evaluateDiscountControls passes clean record with complete audit pack', () => {
  const clean = SAMPLE_DISCOUNTS[0];
  const res = evaluateDiscountControls(clean, { todayIso: '2026-11-13' });
  assert.equal(res.allPassed, true);
  assert.equal(res.tickets.length, 0);
  assert.equal(res.gstAtRisk, 0);
  assert.equal(res.controls.length, 7);
});

test('evaluateDiscountControls handles Rule 67B REJECTED and PENDING_PAST_PERIOD', () => {
  const rejected = { ...SAMPLE_DISCOUNTS[0], imsStatus: 'REJECTED' };
  const resRej = evaluateDiscountControls(rejected, { todayIso: '2026-11-13' });
  assert.equal(resRej.allPassed, false);
  assert.equal(resRej.gstAtRisk, 18000);
  assert.ok(resRej.tickets.some((t) => t.controlId === 'C5'));

  const deemed = { ...SAMPLE_DISCOUNTS[0], imsStatus: 'PENDING_PAST_PERIOD' };
  const resDeemed = evaluateDiscountControls(deemed, { todayIso: '2026-11-13' });
  assert.equal(resDeemed.allPassed, true);
  const c5 = resDeemed.controls.find((c) => c.id === 'C5');
  assert.match(c5.summary, /Deemed Accepted/i);
});

test('evaluateDiscountControls triggers Circular 251 Financial CN fallback past deadline', () => {
  const past = { ...SAMPLE_DISCOUNTS[0], taxRoute: 'GST_CN', gstr9FilingDate: '2026-11-10' };
  const res = evaluateDiscountControls(past, { todayIso: '2026-11-13' });
  assert.equal(res.effectiveTaxRoute, 'FINANCIAL_CN');
  const c4 = res.controls.find((c) => c.id === 'C4');
  assert.equal(c4.passed, false);
  assert.match(c4.summary, /Circular 251/i);
});

test('evaluateDiscountControls flags C3 promotion service for tax review', () => {
  const promo = { ...SAMPLE_DISCOUNTS[0], isPromotionService: true, taxReviewDone: false };
  const res = evaluateDiscountControls(promo, { todayIso: '2026-11-13' });
  const c3 = res.controls.find((c) => c.id === 'C3');
  assert.equal(c3.passed, false);
  assert.ok(res.tickets.some((t) => t.controlId === 'C3'));
});

test('buildIntegrationPayload formats ServiceNow and JIRA sample payloads', () => {
  const res = evaluateDiscountControls(SAMPLE_DISCOUNTS[1], { todayIso: '2026-11-13' });
  assert.ok(res.tickets.length > 0);
  const sn = buildIntegrationPayload(res.tickets[0], 'servicenow');
  assert.equal(sn._note, 'Sample payload, not sent');
  assert.equal(sn.endpoint, 'POST /api/now/table/incident');

  const jira = buildIntegrationPayload(res.tickets[0], 'jira');
  assert.equal(jira._note, 'Sample payload, not sent');
  assert.equal(jira.endpoint, 'POST /rest/api/3/issue');
});

test('computeWeeklyMis and sampleAuditPacks aggregate and sample correctly', () => {
  const mis = computeWeeklyMis(SAMPLE_DISCOUNTS, { todayIso: '2026-11-13' });
  assert.equal(mis.totalDiscounts, SAMPLE_DISCOUNTS.length);
  assert.ok(mis.totalSpent > 0);
  assert.ok(mis.openTicketsCount > 0);

  const packs = sampleAuditPacks(SAMPLE_DISCOUNTS, 2);
  assert.equal(packs.length, 2);
  assert.ok(packs[0].eval.controls.length === 7);
});
