import { ISSUE_TAXONOMY, TAXONOMY_MAP } from './taxonomy';
import type { NormalisedRecord } from '../types';
import type {
  AnalysisResult, EnrichedRecord, IssueBreakdownItem,
  CustomerBurdenItem, TransporterItem, CustomsCompliance,
  LoadRefIntelligence, AreaHotspot, WeeklySnapshot, Actions,
} from '../types/analysis';
import { buildForecast } from './forecast';

const KNOWN_TRANSPORTERS = [
  'DHL','UPS','FedEx','DB Schenker','Schenker','Rhenus','Dachser','DSV',
  'Geodis','Ceva','XPO','Bollore','TNT','HGK','CTD','ECT','Gefco',
  'Samskip','Broekman','Nedcargo','Kuehne Nagel','Kühne Nagel','Fiege',
  'Raben','PostNL','Van Dieren','Kloosterboer',
];

function classifyText(text: string): string[] {
  const t = text.toLowerCase();
  const matches: string[] = [];
  for (const tax of ISSUE_TAXONOMY) {
    if (tax.id === 'other') continue;
    if (tax.keywords.some(kw => t.includes(kw))) matches.push(tax.id);
  }
  return matches.length > 0 ? matches : ['other'];
}

function extractTransporterFromText(text: string): string | null {
  const t = text.toLowerCase();
  for (const name of KNOWN_TRANSPORTERS) {
    if (t.includes(name.toLowerCase())) return name;
  }
  return null;
}

function trend2(a: number, b: number): 'up' | 'down' | 'stable' {
  if (b > a * 1.2) return 'up';
  if (b < a * 0.8) return 'down';
  return 'stable';
}

function riskLabel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 20) return 'HIGH';
  if (score >= 10) return 'MEDIUM';
  return 'LOW';
}

function getWeekTrend(weekCounts: Record<string, number>, sortedWeeks: string[]): 'up' | 'down' | 'stable' {
  const relevantWeeks = sortedWeeks.filter(w => weekCounts[w] !== undefined);
  if (relevantWeeks.length < 2) return 'stable';
  const last = weekCounts[relevantWeeks[relevantWeeks.length - 1]] ?? 0;
  const prev = weekCounts[relevantWeeks[relevantWeeks.length - 2]] ?? 0;
  return trend2(prev, last);
}

function quickWin(issueBreakdown: IssueBreakdownItem[], customerBurden: CustomerBurdenItem[]): string {
  const preventable = issueBreakdown.filter(i => i.preventable && i.id !== 'other').sort((a, b) => b.count - a.count);
  const top = preventable[0];
  if (!top) return 'Review and standardise submission process across all accounts.';

  if (top.id === 'load_ref') {
    return `Mandate load reference on booking portal — eliminates ~${top.count} cases (${top.hoursLost.toFixed(0)}h saved).`;
  }
  if (top.id === 'customs') {
    return `Implement pre-shipment customs document checklist — prevents ~${top.count} cases (${top.hoursLost.toFixed(0)}h saved).`;
  }
  if (top.id === 'closing_time') {
    return `Publish cutoff schedule weekly in advance — removes ~${top.count} closing-time queries.`;
  }
  if (top.id === 'tracking') {
    return `Enable automated shipment status push notifications — eliminates ~${top.count} tracking queries.`;
  }
  if (top.id === 'amendment') {
    return `Enforce data validation at booking stage — reduces ~${top.count} amendment cases.`;
  }
  const topCust = customerBurden[0];
  return topCust
    ? `Focus ${top.label} process fix on ${topCust.name} first — highest combined burden.`
    : `Standardise ${top.label} process to eliminate ~${top.count} preventable cases.`;
}

function generateActions(
  issueBreakdown: IssueBreakdownItem[],
  customerBurden: CustomerBurdenItem[],
  transporterPerformance: TransporterItem[],
): Actions {
  const quickWins: string[] = [];
  const structuralFixes: string[] = [];
  const automationOpportunities: string[] = [];
  const complianceControls: string[] = [];

  const preventableTop = issueBreakdown.filter(i => i.preventable && i.id !== 'other').slice(0, 3);
  for (const iss of preventableTop) {
    if (iss.id === 'load_ref') quickWins.push(`Enforce mandatory load reference at booking entry — eliminates ~${iss.count} cases.`);
    if (iss.id === 'customs')  quickWins.push(`Distribute pre-shipment customs checklist to top ${Math.min(5, customerBurden.length)} accounts.`);
    if (iss.id === 'closing_time') quickWins.push(`Publish weekly cutoff schedule every Monday AM — removes closing-time queries.`);
    if (iss.id === 'tracking') quickWins.push(`Activate automated track & trace email/SMS — eliminates tracking queries.`);
    if (iss.id === 'amendment') quickWins.push(`Add validation rules to booking portal to prevent common amendment triggers.`);
    if (iss.id === 't1') quickWins.push(`Create T1 document pre-check process before handover to haulier.`);
    if (iss.id === 'portbase') quickWins.push(`Implement Portbase pre-notification SLA with all port partners.`);
  }

  const top3Iss = issueBreakdown.slice(0, 3);
  for (const iss of top3Iss) {
    if (iss.id === 'delay') structuralFixes.push('Implement transporter SLA dashboard with weekly punctuality reporting to management.');
    if (iss.id === 'damage') structuralFixes.push('Introduce cargo condition checklist at collection and delivery — enable faster claims.');
    if (iss.id === 'waiting_time') structuralFixes.push('Negotiate revised free-time clauses with top 3 carriers to reduce detention exposure.');
    if (iss.id === 'rate') structuralFixes.push('Publish tariff updates proactively — reduce invoice dispute rate.');
    if (iss.id === 'bl') structuralFixes.push('Standardise B/L checklist and introduce pre-submission review step.');
  }

  if (issueBreakdown.some(i => i.id === 'tracking' && i.preventable)) {
    automationOpportunities.push('Automate shipment status updates via API integration with carrier systems.');
  }
  if (issueBreakdown.some(i => i.id === 'amendment')) {
    automationOpportunities.push('Add field-level validation at booking creation to prevent amendment-triggering errors.');
  }
  if (issueBreakdown.some(i => i.id === 'load_ref')) {
    automationOpportunities.push('Auto-reject bookings without load reference — route to exception queue.');
  }

  if (issueBreakdown.some(i => ['customs','bl','t1','portbase'].includes(i.id))) {
    complianceControls.push('Establish compliance checklist sign-off for all cross-border shipments before departure.');
    complianceControls.push('Assign a customs lead per key account to reduce recurring documentation failures.');
  }

  const customerInterventions = customerBurden
    .filter(c => c.risk === 'HIGH')
    .slice(0, 5)
    .map(c => ({
      customer: c.name,
      action: c.missingLoadRef > 2
        ? `Mandatory load reference enforcement — ${c.missingLoadRef} cases caused by missing refs.`
        : c.missingCustomsDocs > 2
          ? `Customs document review session required — ${c.missingCustomsDocs} doc failures.`
          : `Account review meeting — ${c.count} cases, ${c.hoursLost.toFixed(1)}h workload.`,
    }));

  const transporterEscalations = transporterPerformance
    .filter(t => t.risk === 'HIGH')
    .slice(0, 5)
    .map(t => ({
      transporter: t.name,
      action: `SLA review required — ${t.delays} delays, ${t.notOnTime} late deliveries, punctuality score ${t.punctualityScore.toFixed(0)}%.`,
    }));

  return { quickWins, structuralFixes, customerInterventions, transporterEscalations, automationOpportunities, complianceControls };
}

function buildNarrative(
  totalCases: number,
  weekCount: number,
  weekRange: string,
  topIssue: IssueBreakdownItem | undefined,
  topCustomer: CustomerBurdenItem | undefined,
  preventablePct: number,
  totalHoursLost: number,
): string {
  const parts: string[] = [];
  parts.push(`In the period ${weekRange} (${weekCount} week${weekCount !== 1 ? 's' : ''}), ${totalCases.toLocaleString()} cases were processed.`);
  if (topIssue) {
    parts.push(`The dominant issue category was ${topIssue.label}, accounting for ${topIssue.count.toLocaleString()} cases (${topIssue.percent.toFixed(1)}% of total).`);
  }
  if (topCustomer) {
    parts.push(`${topCustomer.name} generated the highest customer burden at ${topCustomer.count.toLocaleString()} cases.`);
  }
  parts.push(`An estimated ${preventablePct.toFixed(1)}% of workload is preventable, representing ${totalHoursLost.toFixed(0)} hours of avoidable effort.`);
  return parts.join(' ');
}

export function runAnalysis(
  rawRecords: NormalisedRecord[],
  zipMap: Record<string, string>,
): AnalysisResult {
  // ─── 1. Enrich ──────────────────────────────────────────────
  const records: EnrichedRecord[] = rawRecords.map(r => {
    const combinedText = [r.subject, r.description, r.isr_details, r.category]
      .filter(Boolean).join(' ');
    const issues = classifyText(combinedText);
    const primaryIssue = issues[0];

    const resolvedArea: string | null =
      r.area
        ? r.area
        : r.zip && zipMap[r.zip]
          ? zipMap[r.zip]
          : r.zip
            ? `ZIP ${r.zip}`
            : null;

    // Infer week from date; fall back to 'unknown'
    let weekKey = 'unknown';
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yr = new Date(d.getFullYear(), 0, 1);
        const wn = Math.ceil((((d.getTime() - yr.getTime()) / 86400000) + 1) / 7);
        weekKey = `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
      }
    }

    return { ...r, combinedText, issues, primaryIssue, weekKey, resolvedArea };
  });

  // ─── 2. Weekly history ───────────────────────────────────────
  const weeklyHistory: Record<string, WeeklySnapshot> = {};
  for (const r of records) {
    if (r.weekKey === 'unknown') continue;
    if (!weeklyHistory[r.weekKey]) {
      weeklyHistory[r.weekKey] = { total: 0, issues: {}, customers: {}, transporters: {}, areas: {} };
    }
    const wk = weeklyHistory[r.weekKey];
    wk.total++;
    for (const iss of r.issues) wk.issues[iss] = (wk.issues[iss] ?? 0) + 1;
    if (r.customer) wk.customers[r.customer] = (wk.customers[r.customer] ?? 0) + 1;
    const trans = r.transporter ?? extractTransporterFromText(r.combinedText);
    if (trans) wk.transporters[trans] = (wk.transporters[trans] ?? 0) + 1;
    if (r.resolvedArea) wk.areas[r.resolvedArea] = (wk.areas[r.resolvedArea] ?? 0) + 1;
  }
  const sortedWeeks = Object.keys(weeklyHistory).sort();

  // ─── 3. Issue breakdown ──────────────────────────────────────
  const issueCounts: Record<string, number> = {};
  const issueHours: Record<string, number> = {};
  for (const r of records) {
    for (const iss of r.issues) {
      issueCounts[iss] = (issueCounts[iss] ?? 0) + 1;
      const tax = TAXONOMY_MAP[iss];
      issueHours[iss] = (issueHours[iss] ?? 0) + (tax?.hours ?? 0.5);
    }
  }
  const totalCases = records.length;

  const issueBreakdown: IssueBreakdownItem[] = ISSUE_TAXONOMY
    .map(tax => {
      const count = issueCounts[tax.id] ?? 0;
      const hoursLost = issueHours[tax.id] ?? 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (sortedWeeks.length >= 2) {
        const last = weeklyHistory[sortedWeeks[sortedWeeks.length - 1]]?.issues[tax.id] ?? 0;
        const prev = weeklyHistory[sortedWeeks[sortedWeeks.length - 2]]?.issues[tax.id] ?? 0;
        trend = trend2(prev, last);
      }
      return { id: tax.id, label: tax.label, color: tax.color, count, percent: totalCases ? (count / totalCases) * 100 : 0, hoursLost, preventable: tax.preventable, trend };
    })
    .filter(i => i.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalHoursLost = issueBreakdown.reduce((s, i) => s + i.hoursLost, 0);
  const preventableHours = issueBreakdown.filter(i => i.preventable).reduce((s, i) => s + i.hoursLost, 0);
  const preventablePct = totalHoursLost > 0 ? (preventableHours / totalHoursLost) * 100 : 0;

  // ─── 4. Customer burden ──────────────────────────────────────
  const custMap: Record<string, CustomerBurdenItem> = {};
  for (const r of records) {
    const name = r.customer ?? 'Unknown';
    if (!custMap[name]) {
      custMap[name] = { name, count: 0, hoursLost: 0, preventablePct: 0, missingLoadRef: 0, missingCustomsDocs: 0, amendments: 0, delays: 0, topIssue: '', trend: 'stable', risk: 'LOW', riskScore: 0, weekCounts: {} };
    }
    const c = custMap[name];
    c.count++;
    c.weekCounts[r.weekKey] = (c.weekCounts[r.weekKey] ?? 0) + 1;
    let preventableCount = 0;
    for (const iss of r.issues) {
      const tax = TAXONOMY_MAP[iss];
      c.hoursLost += tax?.hours ?? 0.5;
      if (tax?.preventable) preventableCount++;
      if (iss === 'load_ref')                              c.missingLoadRef++;
      if (['customs','portbase','bl','t1'].includes(iss)) c.missingCustomsDocs++;
      if (iss === 'amendment')                             c.amendments++;
      if (iss === 'delay')                                 c.delays++;
    }
    c.preventablePct += preventableCount / r.issues.length;
  }

  const customerBurden: CustomerBurdenItem[] = Object.values(custMap)
    .map(c => {
      const issueSummary: Record<string, number> = {};
      // Re-count issues per customer
      records.filter(r => (r.customer ?? 'Unknown') === c.name).forEach(r => {
        r.issues.forEach(iss => { issueSummary[iss] = (issueSummary[iss] ?? 0) + 1; });
      });
      const topIssueId = Object.entries(issueSummary).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
      const topIssue = TAXONOMY_MAP[topIssueId]?.label ?? 'Other';
      const trend = getWeekTrend(c.weekCounts, sortedWeeks);
      const riskScore = c.count * 0.4 + c.missingLoadRef * 2 + c.missingCustomsDocs * 1.5 + c.delays * 1.5 + (trend === 'up' ? 10 : 0);
      const preventablePctFinal = c.count > 0 ? (c.preventablePct / c.count) * 100 : 0;
      return { ...c, topIssue, trend, riskScore, risk: riskLabel(riskScore), preventablePct: preventablePctFinal };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 5. Transporter performance ──────────────────────────────
  const transMap: Record<string, TransporterItem> = {};
  for (const r of records) {
    const name = r.transporter ?? (r.issues.includes('delay') ? extractTransporterFromText(r.combinedText) : null);
    if (!name) continue;
    if (!transMap[name]) {
      transMap[name] = { name, count: 0, delays: 0, notOnTime: 0, waitingTime: 0, punctualityScore: 0, trend: 'stable', risk: 'LOW', weekCounts: {} };
    }
    const t = transMap[name];
    t.count++;
    t.weekCounts[r.weekKey] = (t.weekCounts[r.weekKey] ?? 0) + 1;
    if (r.issues.includes('delay')) t.delays++;
    const txt = r.combinedText.toLowerCase();
    if (txt.includes('not on time') || txt.includes('not on-time') || txt.includes('late')) t.notOnTime++;
    if (r.issues.includes('waiting_time')) t.waitingTime++;
  }

  const transporterPerformance: TransporterItem[] = Object.values(transMap)
    .map(t => {
      const punctualityIssues = t.delays + t.notOnTime + t.waitingTime;
      const punctualityScore = t.count > 0 ? (punctualityIssues / t.count) * 100 : 0;
      const trend = getWeekTrend(t.weekCounts, sortedWeeks);
      const riskScore = punctualityScore + (trend === 'up' ? 20 : 0);
      return { ...t, punctualityScore, trend, risk: riskLabel(riskScore) };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 6. Customs compliance ───────────────────────────────────
  const customsRecords = records.filter(r => r.issues.some(i => ['customs','portbase','bl','t1'].includes(i)));
  const customsOffenders: Record<string, number> = {};
  for (const r of customsRecords) {
    const name = r.customer ?? 'Unknown';
    customsOffenders[name] = (customsOffenders[name] ?? 0) + 1;
  }
  const customsCompliance: CustomsCompliance = {
    totalCases: customsRecords.length,
    customsDocs: records.filter(r => r.issues.includes('customs')).length,
    portbaseIssues: records.filter(r => r.issues.includes('portbase')).length,
    blIssues: records.filter(r => r.issues.includes('bl')).length,
    t1Issues: records.filter(r => r.issues.includes('t1')).length,
    topOffenders: Object.entries(customsOffenders).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
  };

  // ─── 7. Load reference intelligence ─────────────────────────
  const loadRefRecords = records.filter(r => r.issues.includes('load_ref'));
  const loadRefByCustomer: Record<string, number> = {};
  for (const r of loadRefRecords) {
    const name = r.customer ?? 'Unknown';
    loadRefByCustomer[name] = (loadRefByCustomer[name] ?? 0) + 1;
  }
  const loadRefIntelligence: LoadRefIntelligence = {
    totalMissing: loadRefRecords.length,
    estimatedRework: loadRefRecords.length * 0.5,
    topOffenders: Object.entries(loadRefByCustomer).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
  };

  // ─── 8. Area hotspots ────────────────────────────────────────
  const areaMap: Record<string, AreaHotspot> = {};
  for (const r of records) {
    const area = r.resolvedArea;
    if (!area) continue;
    if (!areaMap[area]) areaMap[area] = { name: area, count: 0, hoursLost: 0, topIssue: '', trend: 'stable', weekCounts: {} };
    const a = areaMap[area];
    a.count++;
    a.weekCounts[r.weekKey] = (a.weekCounts[r.weekKey] ?? 0) + 1;
    for (const iss of r.issues) {
      const tax = TAXONOMY_MAP[iss];
      a.hoursLost += tax?.hours ?? 0.5;
    }
  }
  const areaHotspots: AreaHotspot[] = Object.values(areaMap)
    .map(a => {
      const issueSummary: Record<string, number> = {};
      records.filter(r => r.resolvedArea === a.name).forEach(r => r.issues.forEach(iss => { issueSummary[iss] = (issueSummary[iss] ?? 0) + 1; }));
      const topIssueId = Object.entries(issueSummary).sort((a2, b) => b[1] - a2[1])[0]?.[0] ?? 'other';
      const topIssue = TAXONOMY_MAP[topIssueId]?.label ?? 'Other';
      const trend = getWeekTrend(a.weekCounts, sortedWeeks);
      return { ...a, topIssue, trend };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 9. Summary ──────────────────────────────────────────────
  const topIssue = issueBreakdown[0];
  const topCustomer = customerBurden[0];
  const topTransporter = [...transporterPerformance].sort((a, b) => b.delays - a.delays)[0];
  const topArea = areaHotspots[0];
  const weekRange = sortedWeeks.length > 0
    ? `${sortedWeeks[0].replace('-W', ' W')} – ${sortedWeeks[sortedWeeks.length - 1].replace('-W', ' W')}`
    : 'All records';

  const qw = quickWin(issueBreakdown, customerBurden);

  const summary = {
    totalCases,
    totalHoursLost,
    preventablePct,
    topIssue: topIssue?.label ?? 'N/A',
    topIssueCount: topIssue?.count ?? 0,
    topIssuePercent: topIssue?.percent ?? 0,
    topCustomer: topCustomer?.name ?? 'N/A',
    topCustomerCount: topCustomer?.count ?? 0,
    topTransporter: topTransporter?.name ?? 'N/A',
    topTransporterDelays: topTransporter?.delays ?? 0,
    topArea: topArea?.name ?? 'N/A',
    topAreaCount: topArea?.count ?? 0,
    weekRange,
    weekCount: sortedWeeks.length,
    quickWin: qw,
    narrative: buildNarrative(totalCases, sortedWeeks.length, weekRange, topIssue, topCustomer, preventablePct, totalHoursLost),
  };

  // ─── 10. Forecast & actions ───────────────────────────────────
  const forecast = buildForecast(weeklyHistory, sortedWeeks, customerBurden, transporterPerformance);
  const actions = generateActions(issueBreakdown, customerBurden, transporterPerformance);

  return {
    meta: { filename: '', rowCount: rawRecords.length, analyzedAt: new Date(), hasZipMap: Object.keys(zipMap).length > 0 },
    summary,
    issueBreakdown,
    weeklyHistory,
    sortedWeeks,
    customerBurden,
    transporterPerformance,
    customsCompliance,
    loadRefIntelligence,
    areaHotspots,
    forecast,
    actions,
    records,
  };
}
