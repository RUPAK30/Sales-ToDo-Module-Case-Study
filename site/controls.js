/**
 * TenToday · 7-Control Post-Sale Discount & GST IMS Engine
 * Implements C1–C7, Rule 67B tax snap-back, Circular 251 Financial CN fallback,
 * Deemed Acceptance, ServiceNow/JIRA exception tickets, Weekly MIS, and Auditor Sampling.
 */

export const STATUTORY_CAP_DATE = '2026-11-30';

/**
 * Returns the effective statutory deadline: min(2026-11-30, gstr9FilingDate)
 */
export function effectiveDeadline(gstr9FilingDate) {
  if (!gstr9FilingDate) return STATUTORY_CAP_DATE;
  return gstr9FilingDate < STATUTORY_CAP_DATE ? gstr9FilingDate : STATUTORY_CAP_DATE;
}

export function daysUntil(targetIso, todayIso = '2026-11-13') {
  const ms = new Date(targetIso).getTime() - new Date(todayIso).getTime();
  return Math.ceil(ms / 86400000);
}

/**
 * Evaluates a single post-sale discount against all 7 controls (C1–C7).
 */
export function evaluateDiscountControls(d, opts = {}) {
  const todayIso = opts.todayIso || '2026-11-13';
  const deadline = effectiveDeadline(d.gstr9FilingDate);
  const daysLeft = daysUntil(deadline, todayIso);
  const pastDeadline = daysLeft < 0;

  const gstRate = d.gstRate ?? 0.18;
  const gstAmount = Math.round(d.discountAmount * gstRate);

  // C1: Economics — Break-even volume check
  const marginPct = d.marginPct ?? 51.15;
  const discountPct = d.discountPct ?? 6;
  const breakEvenVolPct = Number(((discountPct / Math.max(1, marginPct - discountPct)) * 100).toFixed(1));
  const extraVolumePct = d.extraVolumePct ?? 0;
  const c1Pass = extraVolumePct >= breakEvenVolPct;

  // C2: Authority — Within approver limit, maker-checker (no self-approval)
  const c2Pass = Boolean(d.approvedBy && d.approvedBy !== d.requestedBy && discountPct <= (d.approverCapPct ?? 10));

  // C3: Classification — Price cut vs. promotion/co-branding service (flagged, never auto-decided)
  const c3Pass = !d.isPromotionService;

  // C4: Tax Route — GST CN vs. Financial CN (Circular 251).
  // If past statutory deadline, GST CN is illegal -> must fall back to Financial CN.
  let effectiveTaxRoute = d.taxRoute || 'UNSET';
  let deadlineFallbackTriggered = false;
  if (pastDeadline && effectiveTaxRoute === 'GST_CN') {
    effectiveTaxRoute = 'FINANCIAL_CN';
    deadlineFallbackTriggered = true;
  }
  const c4Pass = effectiveTaxRoute === 'GST_CN' || effectiveTaxRoute === 'FINANCIAL_CN';

  // C5: Recovery & IMS — Accepted or Pending past 1 tax period (Deemed Accepted).
  // Rejected = Rule 67B tax liability snaps back onto supplier.
  let imsEffective = d.imsStatus || 'PENDING';
  if (imsEffective === 'PENDING_PAST_PERIOD') {
    imsEffective = 'DEEMED_ACCEPTED';
  }
  const c5Pass =
    effectiveTaxRoute === 'FINANCIAL_CN' ||
    imsEffective === 'ACCEPTED' ||
    imsEffective === 'DEEMED_ACCEPTED';

  const gstAtRisk =
    effectiveTaxRoute === 'GST_CN' && !c5Pass
      ? gstAmount
      : deadlineFallbackTriggered
        ? gstAmount
        : 0;

  // C6: Cash — Payment matched to approved net amount
  const c6Pass = Boolean(d.cashMatched);

  // C7: Evidence — Audit pack complete + unbroken SHA-256 chain
  const c7Pass = Boolean(d.auditPackComplete && d.sha256Intact !== false);

  const controls = [
    {
      id: 'C1',
      name: 'Economics',
      passed: c1Pass,
      summary: c1Pass
        ? `Break-even met (+${extraVolumePct}% vol ≥ +${breakEvenVolPct}% needed at ${marginPct}% margin)`
        : `${discountPct}% discount needs +${breakEvenVolPct}% vol at ${marginPct}% margin; got +${extraVolumePct}%`,
      consequenceRupees: c1Pass ? 0 : Math.round(d.discountAmount * 0.35),
      owner: 'Kavita (Sales Mgr)',
      slaHours: 24,
    },
    {
      id: 'C2',
      name: 'Authority',
      passed: c2Pass,
      summary: c2Pass
        ? `Approved by ${d.approvedBy} within cap`
        : 'Blocked: self-approval or exceeds approver limit',
      consequenceRupees: c2Pass ? 0 : d.discountAmount,
      owner: 'Vikram (Finance Controller)',
      slaHours: 24,
    },
    {
      id: 'C3',
      name: 'Classification',
      passed: c3Pass,
      summary: c3Pass
        ? 'Confirmed pure price cut (trade discount)'
        : 'Flagged for Tax Review: Promotion/co-branding service requires separate GST invoice',
      consequenceRupees: c3Pass ? 0 : gstAmount,
      owner: 'Tax Review Desk',
      slaHours: 48,
    },
    {
      id: 'C4',
      name: 'Tax Route',
      passed: c4Pass && !deadlineFallbackTriggered,
      summary: deadlineFallbackTriggered
        ? `Deadline missed (${deadline}): auto-switched to Financial CN (Circular 251 · ₹${gstAmount.toLocaleString('en-IN')} GST absorbed)`
        : effectiveTaxRoute === 'GST_CN'
          ? 'GST Credit Note (requires buyer ITC reversal)'
          : effectiveTaxRoute === 'FINANCIAL_CN'
            ? 'Financial Credit Note (Circular 251 · GST unchanged)'
            : 'Tax route unset — blocked',
      consequenceRupees: deadlineFallbackTriggered ? gstAmount : 0,
      owner: 'Asha (AR Ops)',
      slaHours: 24,
    },
    {
      id: 'C5',
      name: 'Recovery (IMS)',
      passed: c5Pass,
      summary:
        imsEffective === 'ACCEPTED'
          ? 'Accepted by buyer in IMS'
          : imsEffective === 'DEEMED_ACCEPTED'
            ? 'Deemed Accepted (pending past 1 tax period)'
            : imsEffective === 'REJECTED'
              ? `Rejected in IMS: ₹${gstAmount.toLocaleString('en-IN')} GST owed back (Rule 67B)`
              : `Pending in IMS (${Math.max(0, daysLeft)}d to ${deadline})`,
      consequenceRupees: gstAtRisk,
      owner: 'Asha (AR Ops)',
      slaHours: 48,
    },
    {
      id: 'C6',
      name: 'Cash Match',
      passed: c6Pass,
      summary: c6Pass
        ? 'Bank UTR matched to approved net amount'
        : 'Short-payment gap: rep incentive held (15-day cure window)',
      consequenceRupees: c6Pass ? 0 : d.discountAmount,
      owner: 'Rahul (Sales Rep)',
      slaHours: 72,
    },
    {
      id: 'C7',
      name: 'Evidence',
      passed: c7Pass,
      summary: c7Pass
        ? 'Audit pack complete · SHA-256 chain unbroken'
        : 'Incomplete audit pack or broken SHA-256 chain',
      consequenceRupees: 0,
      owner: 'Asha (AR Ops)',
      slaHours: 24,
    },
  ];

  const tickets = controls
    .filter(c => !c.passed)
    .map(c => ({
      ticketId: `INC-${d.id.replace(/\D/g, '')}-${c.id}`,
      discountId: d.id,
      dealer: d.dealer,
      controlId: c.id,
      title: `${c.id} ${c.name} Failed · ${d.dealer}`,
      owner: c.owner,
      slaHours: c.slaHours,
      tatBreached: Boolean(d.tatBreached),
      rupeesAtRisk: c.consequenceRupees,
      status: 'OPEN',
    }));

  return {
    controls,
    tickets,
    allPassed: controls.every(c => c.passed),
    gstAtRisk,
    deadline,
    daysLeft,
    effectiveTaxRoute,
  };
}

export function buildIntegrationPayload(ticket, target = 'servicenow') {
  if (target === 'jira') {
    return {
      _note: 'Sample payload, not sent',
      endpoint: 'POST /rest/api/3/issue',
      fields: {
        project: { key: 'FINCTRL' },
        issuetype: { name: 'Control Exception' },
        summary: `[${ticket.ticketId}] ${ticket.title}`,
        assignee: { displayName: ticket.owner },
        priority: { name: ticket.rupeesAtRisk > 10000 ? 'High' : 'Medium' },
        customfield_rupees_at_risk: ticket.rupeesAtRisk,
        customfield_sla_hours: ticket.slaHours,
      },
    };
  }
  return {
    _note: 'Sample payload, not sent',
    endpoint: 'POST /api/now/table/incident',
    body: {
      number: ticket.ticketId,
      short_description: ticket.title,
      assignment_group: 'AR & Tax Controls',
      assigned_to: ticket.owner,
      urgency: ticket.rupeesAtRisk > 10000 ? 1 : 2,
      u_control_id: ticket.controlId,
      u_rupees_at_risk: ticket.rupeesAtRisk,
      u_sla_hours: ticket.slaHours,
    },
  };
}

export function computeWeeklyMis(records, opts = {}) {
  const evals = records.map(r => ({ r, res: evaluateDiscountControls(r, opts) }));
  const totalSpent = records.reduce((s, r) => s + r.discountAmount, 0);
  const totalExtraMargin = records.reduce((s, r) => s + (r.extraMarginEarned || 0), 0);
  const totalGstAtRisk = evals.reduce((s, e) => s + e.res.gstAtRisk, 0);
  const passedAll = evals.filter(e => e.res.allPassed).length;
  const openTickets = evals.flatMap(e => e.res.tickets);
  const tatBreaches = openTickets.filter(t => t.tatBreached).length;

  return {
    totalDiscounts: records.length,
    totalSpent,
    totalExtraMargin,
    totalGstAtRisk,
    passRatePct: records.length ? Math.round((passedAll / records.length) * 100) : 100,
    openTicketsCount: openTickets.length,
    tatBreaches,
    evals,
  };
}

export function sampleAuditPacks(records, count = 5) {
  const copy = [...records];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length)).map(r => ({
    id: r.id,
    dealer: r.dealer,
    amount: r.discountAmount,
    eval: evaluateDiscountControls(r),
  }));
}

export const SAMPLE_DISCOUNTS = [
  {
    id: 'DSC-101',
    dealer: 'Krishna Marketing, Surat',
    discountAmount: 100000,
    extraMarginEarned: 245000,
    marginPct: 51.15,
    discountPct: 6,
    extraVolumePct: 14.2,
    requestedBy: 'Rahul',
    approvedBy: 'Kavita',
    approverCapPct: 10,
    isPromotionService: false,
    taxRoute: 'GST_CN',
    imsStatus: 'ACCEPTED',
    cashMatched: true,
    auditPackComplete: true,
    sha256Intact: true,
  },
  {
    id: 'DSC-102',
    dealer: 'Meera Trading, Pune',
    discountAmount: 100000,
    extraMarginEarned: 60000,
    marginPct: 51.15,
    discountPct: 8,
    extraVolumePct: 9.0,
    requestedBy: 'Rahul',
    approvedBy: null,
    approverCapPct: 10,
    isPromotionService: true,
    taxRoute: 'GST_CN',
    imsStatus: 'REJECTED',
    cashMatched: false,
    auditPackComplete: false,
    sha256Intact: true,
  },
  {
    id: 'DSC-103',
    dealer: 'Aarav Distributors, Ahmedabad',
    discountAmount: 50000,
    extraMarginEarned: 130000,
    marginPct: 51.15,
    discountPct: 5,
    extraVolumePct: 12.0,
    requestedBy: 'Rahul',
    approvedBy: 'Kavita',
    approverCapPct: 10,
    isPromotionService: false,
    taxRoute: 'GST_CN',
    imsStatus: 'PENDING_PAST_PERIOD',
    cashMatched: true,
    auditPackComplete: true,
    sha256Intact: true,
  },
];
