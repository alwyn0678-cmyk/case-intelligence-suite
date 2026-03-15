/**
 * src/api.ts
 * Single module for all backend communication.
 * The backend performs all Excel parsing and analysis — the frontend
 * only uploads the file and renders the returned AnalysisResult.
 */

import type { AnalysisResult, CustomerBurdenItem, TransporterItem, AreaHotspot, EnrichedRecord, ExampleCase } from './types/analysis';

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
    forecast: {
      available: false,
      reason: 'Forecast not yet computed by backend',
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
