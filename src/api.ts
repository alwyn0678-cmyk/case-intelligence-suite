/**
 * src/api.ts
 * Single module for all backend communication.
 * The backend performs all Excel parsing and analysis — the frontend
 * only uploads the file and renders the returned AnalysisResult.
 */

import type { AnalysisResult, CustomerBurdenItem, TransporterItem, AreaHotspot, EnrichedRecord, ExampleCase, ControlTowerData, CtBottleneck, CtTransporterRisk, CtPreventableOpportunity, CtRootCauseItem, CtCategoryRow } from './types/analysis';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://case-intelligence-suite.onrender.com';

// ─── Raw shape returned by the Python backend ────────────────────
interface BackendResult {
  meta: { filename: string; rowCount: number; analyzedAt: string };
  summary: {
    totalCases: number;
    totalHoursLost: number;
    preventablePct: number;
    preventableCount: number;
    topIssue: string;
    topIssueCount: number;
    topIssuePercent: number;
    topCustomer: string;
    topCustomerCount: number;
    topTransporter: string;
    topArea: string;
    topAreaCount: number;
    weekRange: string;
    weekCount: number;
  };
  issueBreakdown: Array<{
    id: string;
    label: string;
    count: number;
    percent: number;
    hoursLost: number;
    preventable: boolean;
    color: string;
  }>;
  issue_counts: Record<string, number>;
  by_customer: Record<string, number>;
  by_transporter: Record<string, { count: number; punctuality_score: number }>;
  by_area: Record<string, number>;
  missing_load_ref_by_customer: Record<string, number>;
  wow_delta: Record<string, { current: number; prior: number; pct_change: number | null }>;
  hours_lost_estimate: number;
  total_cases: number;
  preventable_count: number;
  preventable_rate: number;
  cases: Record<string, unknown>[];
  health_check?: {
    status: string;
    alerts: string[];
    totalRows: number;
    otherCount: number;
    otherPct: number;
    below60Count: number;
    below60Pct: number;
    reviewFlagCount: number;
    reviewFlagPct: number;
    reviewFlagViolations: number;
    categoriesSeen: number;
    unknownStatePct: number;
    transporterCoverage: number;
    bookingRefCoverage: number;
    loadRefCoverage: number;
    containerCoverage: number;
    mrnCoverage: number;
    zipCoverage: number;
  };
  forecast?: {
    available: boolean;
    reason?: string;
    nextWeekVolume: number;
    volumeTrend: string;
    confidence: string;
    weeksAnalyzed: number;
    topIssues: Array<{ id: string; label: string; color: string; forecasted: number; trend: string }>;
    risingRisk: Array<{ id: string; label: string; color: string; forecasted: number; trend: string }>;
    riskyCustomers: Array<{ name: string; recentCount: number; trend: string; risk: string }>;
    riskyTransporters: Array<{ name: string; delayRate: number; risk: string }>;
    hotspots: Array<{ name: string; forecasted: number; trend: string }>;
    actions: string[];
  };
}

// ─── Map backend response → AnalysisResult ───────────────────────
function mapToAnalysisResult(b: BackendResult): AnalysisResult {
  const customerBurden: CustomerBurdenItem[] = Object.entries(b.by_customer)
    .sort(([, a], [, c]) => c - a)
    .map(([name, count]) => {
      const missingLoadRef = b.missing_load_ref_by_customer[name] ?? 0;
      const riskScore = count + missingLoadRef * 2;
      return {
        name,
        count,
        hoursLost: +(count * 1.0).toFixed(1),
        preventablePct: 0,
        missingLoadRef,
        refProvided: 0,
        missingCustomsDocs: 0,
        amendments: 0,
        delays: 0,
        topIssue: '',
        trend: 'stable' as const,
        risk: (riskScore >= 10 ? 'HIGH' : riskScore >= 5 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
        riskScore,
        weekCounts: {},
        exampleCases: [],
      };
    });

  const transporterPerformance: TransporterItem[] = Object.entries(b.by_transporter)
    .sort(([, a], [, c]) => c.count - a.count)
    .map(([name, v]) => ({
      name,
      count: v.count,
      delays: Math.round(v.count * (1 - v.punctuality_score / 100)),
      notOnTime: 0,
      waitingTime: 0,
      punctualityScore: v.punctuality_score,
      trend: 'stable' as const,
      risk: (v.punctuality_score < 70 ? 'HIGH' : v.punctuality_score < 85 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
      weekCounts: {},
      exampleCases: [],
    }));

  const areaHotspots: AreaHotspot[] = Object.entries(b.by_area)
    .sort(([, a], [, c]) => c - a)
    .map(([name, count]) => ({
      name,
      count,
      hoursLost: +(count * 1.0).toFixed(1),
      topIssue: '',
      trend: 'stable' as const,
      weekCounts: {},
      exampleCases: [],
    }));

  // Map cases to a partial EnrichedRecord shape
  const records = b.cases.map((c) => {
    const raw = c as Record<string, unknown>;
    return {
      subject: (raw.subject as string) ?? null,
      description: (raw.description as string) ?? null,
      isr_details: (raw.isr_details as string) ?? null,
      customer: (raw.customer as string) ?? null,
      transporter: (raw.transporter as string) ?? null,
      zip: (raw.zip as string) ?? (raw.ext_zip as string) ?? null,
      area: (raw.area as string) ?? null,
      date: raw.date ? new Date(raw.date as string) : null,
      case_number: (raw.case_number as string) ?? null,
      booking_ref: (raw.booking_ref as string) ?? (raw.ext_booking_ref as string) ?? null,
      combinedText: '',
      issues: [raw.primaryIssue as string].filter(Boolean),
      primaryIssue: (raw.primaryIssue as string) ?? 'other',
      secondaryIssue: (raw.secondaryIssue as string) ?? null,
      issueState: (raw.issueState as string) ?? 'unknown',
      weekKey: (raw.weekKey as string) ?? '',
      resolvedArea: (raw.resolvedArea as string) ?? null,
      routingHint: null,
      routingAlignment: 'no_zip' as const,
      extractedZip: null,
      resolvedCustomer: (raw.resolvedCustomer as string) ?? (raw.customer as string) ?? null,
      resolvedTransporter: (raw.resolvedTransporter as string) ?? (raw.ext_transporter as string) ?? (raw.transporter as string) ?? null,
      resolvedDepot: null,
      resolvedDeepseaTerminal: null,
      confidence: (raw.confidence as number) ?? 0.5,
      reviewFlag: (raw.reviewFlag as boolean) ?? false,
      unresolvedReason: null,
      allEntities: [],
      unknownEntities: [],
      evidence: (() => { try { return JSON.parse((raw.evidence as string) ?? '[]') as string[]; } catch { return []; } })(),
      sourceFieldsUsed: (() => { try { return JSON.parse((raw.sourceFieldsUsed as string) ?? '[]') as string[]; } catch { return []; } })(),
      detectedIntent: (raw.detectedIntent as string) ?? '',
      detectedObject: (raw.detectedObject as string) ?? '',
      triggerPhrase: (raw.triggerPhrase as string) ?? '',
      triggerSourceField: (raw.triggerSourceField as string) ?? '',
      bookingRefExtracted: (raw.booking_ref as string) ?? null,
      loadRefExtracted: null,
      containerExtracted: null,
      mrnRefExtracted: null,
      rootCause: (raw.rootCause as string) ?? null,
      preventableIssue: (raw.preventableIssue as boolean) ?? false,
      _raw: raw,
    } as unknown as EnrichedRecord;
  });

  const reviewFlagCount = records.filter(r => r.reviewFlag).length;

  // Build weeklyHistory from cases
  const weeklyHistory: Record<string, { total: number; issues: Record<string, number>; customers: Record<string, number>; transporters: Record<string, number>; areas: Record<string, number> }> = {};
  for (const r of records) {
    const wk = r.weekKey;
    if (!wk) continue;
    if (!weeklyHistory[wk]) weeklyHistory[wk] = { total: 0, issues: {}, customers: {}, transporters: {}, areas: {} };
    const snap = weeklyHistory[wk];
    snap.total++;
    snap.issues[r.primaryIssue] = (snap.issues[r.primaryIssue] ?? 0) + 1;
    if (r.resolvedCustomer) snap.customers[r.resolvedCustomer] = (snap.customers[r.resolvedCustomer] ?? 0) + 1;
    if (r.resolvedTransporter) snap.transporters[r.resolvedTransporter] = (snap.transporters[r.resolvedTransporter] ?? 0) + 1;
    if (r.resolvedArea) snap.areas[r.resolvedArea] = (snap.areas[r.resolvedArea] ?? 0) + 1;
  }
  const sortedWeeks = Object.keys(weeklyHistory).sort();
  const chartWeeks = sortedWeeks.slice(-16);

  // ── Build exampleCases from classified records ─────────────────
  // Converts an EnrichedRecord to the ExampleCase shape the modal expects.
  function toExampleCase(r: EnrichedRecord, label: string): ExampleCase {
    const fmt = (d: Date | null | undefined): string | null =>
      d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
    // Extract load ref from booking_ref or evidence
    const ev = r.evidence ?? [];
    const loadRef =
      (r._raw?.ext_load_ref as string | undefined) ??
      ev.find((e: string) => e.startsWith('ref[load_ref]='))?.slice('ref[load_ref]='.length) ??
      r.booking_ref ??
      null;
    const containerNumber =
      (r._raw?.ext_container as string | undefined) ??
      ev.find((e: string) => e.startsWith('ref[container]='))?.slice('ref[container]='.length) ??
      (r._raw?.container as string | undefined) ??
      null;
    const mrnRef =
      (r._raw?.ext_mrn as string | undefined) ??
      (r._raw?.ext_t1_ref as string | undefined) ??
      ev.find((e: string) => e.startsWith('ref[mrn]='))?.slice('ref[mrn]='.length) ??
      ev.find((e: string) => e.startsWith('ref[t1_mrn]='))?.slice('ref[t1_mrn]='.length) ??
      null;
    return {
      caseNumber:      r.case_number ?? null,
      bookingRef:      r.booking_ref ?? null,
      primaryIssue:    r.primaryIssue,
      issueLabel:      label,
      issueState:      r.issueState ?? 'unknown',
      subject:         r.subject ? r.subject.slice(0, 120) : null,
      date:            fmt(r.date),
      customer:        r.resolvedCustomer ?? r.customer ?? null,
      transporter:     r.resolvedTransporter ?? r.transporter ?? null,
      loadRef,
      containerNumber,
      mrnRef,
      confidence:      r.confidence,
    };
  }

  // Cap at 100 example cases per category, sorted by confidence desc
  const MAX_EXAMPLES = 100;
  const issueBreakdown = b.issueBreakdown.map((item) => {
    const categoryRecords = records
      .filter(r => r.primaryIssue === item.id)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_EXAMPLES)
      .map(r => toExampleCase(r, item.label));
    return {
      ...item,
      trend: 'stable' as const,
      exampleCases: categoryRecords,
    };
  });

  const topCustomer = customerBurden[0]?.name ?? '';
  const topTransporter = transporterPerformance[0]?.name ?? '';

  // ── Control Tower analytics (Phases 21–27) ────────────────────
  const HOURS_PER_PREVENTABLE = 1.5;
  const prevWeek = sortedWeeks[sortedWeeks.length - 2] ?? '';
  const currWeek = sortedWeeks[sortedWeeks.length - 1] ?? '';

  // Phase 21 — Overview metrics
  const preventableRecords = records.filter(r => r.preventableIssue);
  const avgConf = records.length > 0
    ? records.reduce((s, r) => s + r.confidence, 0) / records.length : 0;
  const lowConfRate = records.length > 0
    ? (records.filter(r => r.confidence < 0.70).length / records.length) * 100 : 0;

  const ISSUE_LABEL_MAP: Record<string, string> = {};
  const ISSUE_COLOR_MAP: Record<string, string> = {};
  for (const item of issueBreakdown) {
    ISSUE_LABEL_MAP[item.id] = item.label;
    ISSUE_COLOR_MAP[item.id] = item.color;
  }

  function weekTrend(id: string): 'up' | 'down' | 'stable' {
    const c = weeklyHistory[currWeek]?.issues[id] ?? 0;
    const p = weeklyHistory[prevWeek]?.issues[id] ?? 0;
    if (c > p * 1.1) return 'up';
    if (c < p * 0.9) return 'down';
    return 'stable';
  }

  const categoryDistribution = issueBreakdown.map(item => ({
    id: item.id,
    name: item.label,
    value: item.count,
    color: item.color,
    percent: item.percent,
    trend: weekTrend(item.id),
  }));

  // Phase 22 — Category rows with preventable rates and 4-week trend
  const recentFourWeeks = sortedWeeks.slice(-4);
  const priorFourWeeks  = sortedWeeks.slice(-8, -4);
  const recentSet = new Set(recentFourWeeks);
  const priorSet  = new Set(priorFourWeeks);
  const recentRecs = records.filter(r => recentSet.has(r.weekKey));
  const priorRecs  = records.filter(r => priorSet.has(r.weekKey));

  const categoryRows: CtCategoryRow[] = issueBreakdown.map(item => {
    const catRecs = records.filter(r => r.primaryIssue === item.id);
    const prevCount = catRecs.filter(r => r.preventableIssue).length;
    const prevRate  = catRecs.length > 0 ? +(prevCount / catRecs.length * 100).toFixed(1) : 0;
    const rec4 = recentRecs.filter(r => r.primaryIssue === item.id).length;
    const pri4 = priorRecs.filter(r => r.primaryIssue === item.id).length;
    const trendPct = pri4 > 0 ? Math.round((rec4 - pri4) / pri4 * 100) : 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (rec4 > pri4 * 1.1) trend = 'up';
    else if (rec4 < pri4 * 0.9) trend = 'down';
    return {
      id: item.id,
      label: item.label,
      color: item.color,
      count: item.count,
      percent: item.percent,
      hoursLost: item.hoursLost,
      preventableRate: prevRate,
      trend,
      trendPct,
    };
  });

  // Phase 23 — Bottleneck detection: WoW ≥40% and ≥30 cases
  const bottlenecks: CtBottleneck[] = [];
  for (let wi = 1; wi < sortedWeeks.length; wi++) {
    const wk  = sortedWeeks[wi];
    const pw  = sortedWeeks[wi - 1];
    const cur = weeklyHistory[wk];
    const pri = weeklyHistory[pw];
    if (!cur || !pri) continue;
    for (const [issueId, currCount] of Object.entries(cur.issues)) {
      const priorCount = pri.issues[issueId] ?? 0;
      if (currCount < 30 || priorCount === 0) continue;
      const spike = ((currCount - priorCount) / priorCount) * 100;
      if (spike >= 40) {
        bottlenecks.push({
          category: issueId,
          categoryLabel: ISSUE_LABEL_MAP[issueId] ?? issueId,
          week: wk,
          caseCount: currCount,
          spikePercent: Math.round(spike),
          priorCount,
        });
      }
    }
  }
  bottlenecks.sort((a, z) => z.week.localeCompare(a.week) || z.spikePercent - a.spikePercent);

  // Phase 24 — Transporter risk signals
  interface TpPeriod { total: number; delay: number; equipment: number; amendment: number; preventable: number }
  function accTp(recs: EnrichedRecord[]): Record<string, TpPeriod> {
    const acc: Record<string, TpPeriod> = {};
    for (const r of recs) {
      const n = r.resolvedTransporter; if (!n) continue;
      if (!acc[n]) acc[n] = { total: 0, delay: 0, equipment: 0, amendment: 0, preventable: 0 };
      acc[n].total++;
      if (r.primaryIssue === 'delay')     acc[n].delay++;
      if (r.primaryIssue === 'equipment') acc[n].equipment++;
      if (r.primaryIssue === 'amendment') acc[n].amendment++;
      if (r.preventableIssue)             acc[n].preventable++;
    }
    return acc;
  }
  const recentTp = accTp(recentRecs);
  const priorTp  = accTp(priorRecs);
  const rate = (n: number, d: number) => d > 0 ? +(n / d * 100).toFixed(1) : 0;
  const chg  = (c: number, p: number) => p > 0 ? Math.round((c - p) / p * 100) : 0;

  const transporterRisks: CtTransporterRisk[] = Object.entries(recentTp)
    .filter(([, v]) => v.total >= 5)
    .map(([name, rec]) => {
      const pri = priorTp[name] ?? { total: 0, delay: 0, equipment: 0, amendment: 0, preventable: 0 };
      const rDR = rate(rec.delay,     rec.total);
      const pDR = rate(pri.delay,     pri.total);
      const rER = rate(rec.equipment, rec.total);
      const pER = rate(pri.equipment, pri.total);
      const rAR = rate(rec.amendment, rec.total);
      const pAR = rate(pri.amendment, pri.total);
      const flags: CtTransporterRisk['riskFlags'] = [];
      if (pDR > 0 && chg(rDR, pDR) >= 30) flags.push({ metric: 'Delay rate',     current: rDR, prior: pDR, changePct: chg(rDR, pDR) });
      if (pER > 0 && chg(rER, pER) >= 30) flags.push({ metric: 'Equipment rate', current: rER, prior: pER, changePct: chg(rER, pER) });
      if (pAR > 0 && chg(rAR, pAR) >= 30) flags.push({ metric: 'Amendment rate', current: rAR, prior: pAR, changePct: chg(rAR, pAR) });
      const riskLevel: 'HIGH' | 'MEDIUM' | 'NONE' =
        flags.some(f => f.changePct >= 100) ? 'HIGH' : flags.length > 0 ? 'MEDIUM' : 'NONE';
      return { name, totalCases: rec.total, recentDelayRate: rDR, priorDelayRate: pDR,
        recentEquipmentRate: rER, priorEquipmentRate: pER, recentAmendmentRate: rAR,
        priorAmendmentRate: pAR, preventableRate: rate(rec.preventable, rec.total),
        riskFlags: flags, riskLevel };
    })
    .filter(t => t.riskLevel !== 'NONE')
    .sort((a, z) => ({ HIGH: 0, MEDIUM: 1, NONE: 2 }[a.riskLevel] - { HIGH: 0, MEDIUM: 1, NONE: 2 }[z.riskLevel] || z.totalCases - a.totalCases));

  // Phase 25 — Preventable opportunities by category
  const prevByCat: Record<string, { count: number; label: string; color: string }> = {};
  const totalByCat: Record<string, number> = {};
  for (const r of records) {
    totalByCat[r.primaryIssue] = (totalByCat[r.primaryIssue] ?? 0) + 1;
    if (r.preventableIssue) {
      if (!prevByCat[r.primaryIssue]) prevByCat[r.primaryIssue] = {
        count: 0,
        label: ISSUE_LABEL_MAP[r.primaryIssue] ?? r.primaryIssue,
        color: ISSUE_COLOR_MAP[r.primaryIssue] ?? '#8b7cff',
      };
      prevByCat[r.primaryIssue].count++;
    }
  }
  const preventableOpportunities: CtPreventableOpportunity[] = Object.entries(prevByCat)
    .map(([id, v]) => {
      const total = totalByCat[id] ?? 0;
      const rec4 = recentRecs.filter(r => r.primaryIssue === id && r.preventableIssue).length;
      const pri4 = priorRecs.filter(r => r.primaryIssue === id && r.preventableIssue).length;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (rec4 > pri4 * 1.1) trend = 'up';
      else if (rec4 < pri4 * 0.9) trend = 'down';
      return {
        categoryId: id, categoryLabel: v.label,
        preventableCount: v.count, totalCount: total,
        preventableRate: total > 0 ? +(v.count / total * 100).toFixed(1) : 0,
        hoursLost: +(v.count * HOURS_PER_PREVENTABLE).toFixed(1),
        trend,
      };
    })
    .sort((a, z) => z.hoursLost - a.hoursLost);

  // Phase 26 — Root cause distribution
  const CAUSE_LABELS: Record<string, string> = {
    weather_delay: 'Weather Delay', terminal_congestion: 'Terminal Congestion',
    customs_hold: 'Customs Hold', missed_cutoff: 'Missed Cutoff',
    equipment_unavailable: 'Equipment Unavailable', documentation_error: 'Documentation Error',
    late_booking: 'Late Booking', carrier_delay: 'Carrier Delay',
    haulier_delay: 'Haulier Delay', vessel_delay: 'Vessel Delay',
    extra_cost: 'Extra Cost', unknown: 'Unknown / Other',
  };
  const rcCount: Record<string, number> = {};
  const rcRecent: Record<string, number> = {};
  const rcPrior:  Record<string, number> = {};
  for (const r of records)     { const c = r.rootCause ?? 'unknown'; rcCount[c]  = (rcCount[c]  ?? 0) + 1; }
  for (const r of recentRecs)  { const c = r.rootCause ?? 'unknown'; rcRecent[c] = (rcRecent[c] ?? 0) + 1; }
  for (const r of priorRecs)   { const c = r.rootCause ?? 'unknown'; rcPrior[c]  = (rcPrior[c]  ?? 0) + 1; }
  const rcTotal = Object.values(rcCount).reduce((s, n) => s + n, 0);
  const rootCauses: CtRootCauseItem[] = Object.entries(rcCount)
    .sort(([, a], [, z]) => z - a)
    .map(([cause, count]) => {
      const rec = rcRecent[cause] ?? 0;
      const pri = rcPrior[cause] ?? 0;
      const trendPct = pri > 0 ? Math.round((rec - pri) / pri * 100) : 0;
      return {
        cause, causeLabel: CAUSE_LABELS[cause] ?? cause, count,
        percent: rcTotal > 0 ? +(count / rcTotal * 100).toFixed(1) : 0,
        trend: rec > pri * 1.1 ? 'up' : rec < pri * 0.9 ? 'down' : 'stable',
        trendPct, recentCount: rec, priorCount: pri,
      };
    });

  // Phase 27 — Dashboard validation
  const valNotes: string[] = [];
  if (records.length !== b.summary.totalCases) {
    valNotes.push(`WARN: records (${records.length}) ≠ summary.totalCases (${b.summary.totalCases})`);
  }
  for (const item of issueBreakdown) {
    const actual = records.filter(r => r.primaryIssue === item.id).length;
    if (Math.abs(actual - item.count) > 1) {
      valNotes.push(`WARN: ${item.label} count mismatch — breakdown: ${item.count}, records: ${actual}`);
    }
  }
  if (valNotes.length === 0) valNotes.push('All totals verified against backend truth source.');

  const controlTower: ControlTowerData = {
    totalCases: records.length,
    preventableCases: preventableRecords.length,
    preventableHoursLost: Math.round(preventableRecords.length * HOURS_PER_PREVENTABLE),
    avgConfidence: +((avgConf * 100).toFixed(1)),
    lowConfidenceRate: +lowConfRate.toFixed(1),
    categoryDistribution,
    categoryRows,
    bottlenecks: bottlenecks.slice(0, 20),
    transporterRisks: transporterRisks.slice(0, 30),
    preventableOpportunities,
    rootCauses,
    validationPassed: valNotes.every(n => !n.startsWith('WARN')),
    validationNotes: valNotes,
  };

  return {
    meta: {
      filename: b.meta.filename,
      rowCount: b.meta.rowCount,
      analyzedAt: new Date(b.meta.analyzedAt),
      hasZipMap: false,
    },
    classificationHealth: b.health_check ? {
      status:               b.health_check.status,
      alerts:               b.health_check.alerts,
      otherPct:             b.health_check.otherPct,
      below60Pct:           b.health_check.below60Pct,
      reviewFlagPct:        b.health_check.reviewFlagPct,
      reviewFlagViolations: b.health_check.reviewFlagViolations,
      categoriesSeen:       b.health_check.categoriesSeen,
      unknownStatePct:      b.health_check.unknownStatePct ?? 0,
      transporterCoverage:  b.health_check.transporterCoverage ?? 0,
      bookingRefCoverage:   b.health_check.bookingRefCoverage ?? 0,
      loadRefCoverage:      b.health_check.loadRefCoverage ?? 0,
      containerCoverage:    b.health_check.containerCoverage ?? 0,
      mrnCoverage:          b.health_check.mrnCoverage ?? 0,
      zipCoverage:          b.health_check.zipCoverage ?? 0,
    } : null,
    summary: {
      totalCases: b.summary.totalCases,
      totalHoursLost: b.summary.totalHoursLost,
      preventablePct: b.summary.preventablePct,
      topIssue: b.summary.topIssue,
      topIssueCount: b.summary.topIssueCount,
      topIssuePercent: b.summary.topIssuePercent,
      topCustomer,
      topCustomerCount: b.by_customer[topCustomer] ?? 0,
      topTransporter,
      topTransporterDelays: transporterPerformance[0]?.delays ?? 0,
      topArea: b.summary.topArea,
      topAreaCount: b.summary.topAreaCount,
      weekRange: b.summary.weekRange,
      weekCount: b.summary.weekCount,
      quickWin: '',
      narrative: '',
      reviewFlagCount,
      unknownEntityCount: 0,
      unknownCustomerCount: 0,
    },
    issueBreakdown,
    weeklyHistory,
    sortedWeeks,
    chartWeeks,
    customerBurden,
    transporterPerformance,
    depotPerformance: [],
    deepseaTerminalData: [],
    unknownEntities: [],
    customsCompliance: {
      totalCases: b.summary.totalCases,
      customsDocs: b.issue_counts['customs'] ?? 0,
      portbaseIssues: b.issue_counts['portbase'] ?? 0,
      blIssues: b.issue_counts['bl'] ?? 0,
      t1Issues: b.issue_counts['t1'] ?? 0,
      exampleCases: [],
      customsDocsExamples: [],
      portbaseExamples: [],
      blExamples: [],
      t1Examples: [],
    },
    loadRefIntelligence: {
      totalMissing: b.issue_counts['load_ref'] ?? 0,
      totalProvided: 0,
      estimatedRework: (b.issue_counts['load_ref'] ?? 0) * 0.5,
      topOffenders: Object.entries(b.missing_load_ref_by_customer)
        .sort(([, a], [, c]) => c - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      topTransporters: [],
      topDepots: [],
      weeklyMissing: {},
      avgConfidence: 0.7,
      exampleCases: [],
    },
    areaHotspots,
    isrVsExternal: {
      totalIsr: 0,
      totalExternal: b.summary.totalCases,
      isrPct: 0,
      externalPct: 100,
      weeklyBreakdown: [],
    },
    issueDrilldowns: [],
    weekOnWeek: {
      available: Object.keys(b.wow_delta).length > 0,
      currentWeek: sortedWeeks[sortedWeeks.length - 1] ?? '',
      priorWeek: sortedWeeks[sortedWeeks.length - 2] ?? '',
      totalVolume: null,
      issueChanges: Object.entries(b.wow_delta).map(([id, v]) => ({
        label: id,
        current: v.current,
        prior: v.prior,
        pctChange: v.pct_change ?? 0,
        direction: (v.current > v.prior ? 'up' : v.current < v.prior ? 'down' : 'stable') as 'up' | 'down' | 'stable',
        isSpike: Math.abs(v.pct_change ?? 0) >= 20 && v.current >= 3,
      })),
      customerChanges: [],
      transporterChanges: [],
      areaChanges: [],
      isrMovement: null,
    },
    repeatOffenders: [],
    actionInsights: [],
    forecast: b.forecast ? {
      available:          b.forecast.available,
      reason:             b.forecast.reason,
      nextWeekVolume:     b.forecast.nextWeekVolume,
      volumeTrend:        (b.forecast.volumeTrend as 'up' | 'down' | 'stable') ?? 'stable',
      confidence:         (b.forecast.confidence as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'LOW',
      weeksAnalyzed:      b.forecast.weeksAnalyzed,
      topIssues:          b.forecast.topIssues.map(i => ({ ...i, trend: i.trend as 'up' | 'down' | 'stable' })),
      risingRisk:         b.forecast.risingRisk.map(i => ({ ...i, trend: i.trend as 'up' | 'down' | 'stable' })),
      riskyCustomers:     b.forecast.riskyCustomers,
      riskyTransporters:  b.forecast.riskyTransporters,
      hotspots:           b.forecast.hotspots.map(h => ({ ...h, trend: h.trend as 'up' | 'down' | 'stable' })),
      actions:            b.forecast.actions,
    } : {
      available: false,
      reason: 'Forecast not computed by backend',
      nextWeekVolume: 0,
      volumeTrend: 'stable' as const,
      confidence: 'LOW' as const,
      weeksAnalyzed: sortedWeeks.length,
      topIssues: [],
      risingRisk: [],
      riskyCustomers: [],
      riskyTransporters: [],
      hotspots: [],
      actions: [],
    },
    actions: {
      quickWins: [],
      structuralFixes: [],
      customerInterventions: [],
      transporterEscalations: [],
      automationOpportunities: [],
      complianceControls: [],
    },
    records,
    controlTower,
  };
}

// ─── Public API ───────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<AnalysisResult> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let detail = `Server error ${res.status}`;
    try {
      const body = await res.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  const data = await res.json() as BackendResult;
  return mapToAnalysisResult(data);
}
