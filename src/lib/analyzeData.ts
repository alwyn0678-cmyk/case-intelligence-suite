import { ISSUE_TAXONOMY, TAXONOMY_MAP } from './taxonomy';
import { classifyCase } from './classifyCase';
import type { NormalisedRecord } from '../types';
import type {
  AnalysisResult, EnrichedRecord, IssueBreakdownItem, ExampleCase,
  CustomerBurdenItem, TransporterItem, DepotItem, DeepseaTerminalItem,
  CustomsCompliance, LoadRefIntelligence, AreaHotspot,
  WeeklySnapshot, Actions, UnknownEntityItem, IsrVsExternal,
  IssueDrilldown, WeekOnWeek, WowChange, RepeatOffenderItem, ActionInsight,
} from '../types/analysis';
import { buildForecast } from './forecast';
import { isKnownOperationalEntity, isApprovedTransporter, isBlockedFromCustomerRole, isInternalISRLabel, isAllowedAreaLabel, validateOutputGuards, isPositiveCustomerCandidate } from '../config/referenceData';
import {} from './textNormalization';

const MAX_CHART_WEEKS = 16;

// ─────────────────────────────────────────────────────────────────
// Non-operational area labels to suppress from Area Hotspots.
// These come from the NL/BE ZIP rules and are too granular or
// geographically generic for this inland logistics dashboard.
// The operational split (Mainz/Germersheim + Duisburg/Rhine-Ruhr)
// already covers German ZIPs. Rotterdam and Antwerp (deepsea hubs)
// are retained for terminal visibility.
// ─────────────────────────────────────────────────────────────────
const EXCLUDED_AREA_LABELS = new Set<string>([
  'Brussels', 'Tilburg / Breda', 'Eindhoven', 'Namur / Wallonia',
  'Charleroi / Belgium South', 'Bruges / West Flanders',
  'Ghent / East Flanders', 'Leuven / Belgium East', 'Liège / Belgium',
  'Utrecht / NL Central', 'Amsterdam', 'Venlo / Limburg NL',
]);

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
    if (iss.id === 'load_ref')      quickWins.push(`Enforce mandatory load reference at booking entry — eliminates ~${iss.count} cases.`);
    if (iss.id === 'customs')       quickWins.push(`Distribute pre-shipment customs checklist to top ${Math.min(5, customerBurden.length)} accounts.`);
    if (iss.id === 'closing_time')  quickWins.push(`Publish weekly cutoff schedule every Monday AM — removes closing-time queries.`);
    if (iss.id === 'tracking')      quickWins.push(`Activate automated track & trace email/SMS — eliminates tracking queries.`);
    if (iss.id === 'amendment')     quickWins.push(`Add validation rules to booking portal to prevent common amendment triggers.`);
    if (iss.id === 't1')            quickWins.push(`Create T1 document pre-check process before handover to haulier.`);
    if (iss.id === 'portbase')      quickWins.push(`Implement Portbase pre-notification SLA with all port partners.`);
    if (iss.id === 'scheduling')    quickWins.push(`Implement online slot-booking system for depots and terminals to reduce scheduling queries.`);
    if (iss.id === 'equipment_release') quickWins.push(`Automate PIN/release-order distribution via email on ETA minus 24h.`);
  }

  const top3Iss = issueBreakdown.slice(0, 3);
  for (const iss of top3Iss) {
    if (iss.id === 'delay')         structuralFixes.push('Implement transporter SLA dashboard with weekly punctuality reporting to management.');
    if (iss.id === 'damage')        structuralFixes.push('Introduce cargo condition checklist at collection and delivery — enable faster claims.');
    if (iss.id === 'waiting_time')  structuralFixes.push('Negotiate revised free-time clauses with top 3 carriers to reduce detention exposure.');
    if (iss.id === 'rate')          structuralFixes.push('Publish tariff updates proactively — reduce invoice dispute rate.');
    if (iss.id === 'bl')            structuralFixes.push('Standardise B/L checklist and introduce pre-submission review step.');
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
  if (issueBreakdown.some(i => i.id === 'equipment_release')) {
    automationOpportunities.push('Automate release PIN distribution: trigger on terminal gate-in confirmation.');
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
  reviewFlagCount: number,
  unknownEntityCount: number,
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
  if (reviewFlagCount > 0) {
    parts.push(`${reviewFlagCount} case${reviewFlagCount !== 1 ? 's were' : ' was'} flagged for manual review due to low classification confidence.`);
  }
  if (unknownEntityCount > 0) {
    parts.push(`${unknownEntityCount} entity name${unknownEntityCount !== 1 ? 's were' : ' was'} not recognised — review in the Case Explorer.`);
  }
  return parts.join(' ');
}

// ── Week key helper ───────────────────────────────────────────────
function toWeekKey(date: Date | null | undefined): string {
  if (!date) return 'unknown';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'unknown';
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yr = new Date(d.getFullYear(), 0, 1);
  const wn = Math.ceil((((d.getTime() - yr.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

// ── Aggregation helpers ───────────────────────────────────────────
function topIssueForGroup(records: EnrichedRecord[]): string {
  const counts: Record<string, number> = {};
  for (const r of records) for (const iss of r.issues) counts[iss] = (counts[iss] ?? 0) + 1;
  const id = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
  return TAXONOMY_MAP[id]?.label ?? 'Other';
}

// ── Evidence drilldown helper ─────────────────────────────────────
// Builds the top-10 ExampleCase array from a set of matching records.
// Records are sorted by confidence descending so the strongest
// classifications appear first. The caller is responsible for passing
// only the records that already match the group's filter criteria —
// this function never re-filters, ensuring strict matching consistency.
function buildExampleCases(matchingRecords: EnrichedRecord[]): ExampleCase[] {
  return matchingRecords
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map(r => {
      const loadRef        = r.evidence.find(e => e.startsWith('ref[load_ref]='))?.slice('ref[load_ref]='.length) ?? null;
      const containerNumber = r.evidence.find(e => e.startsWith('ref[container]='))?.slice('ref[container]='.length) ?? null;
      const bookingEvidence = r.evidence.find(e => e.startsWith('ref[booking]='))?.slice('ref[booking]='.length) ?? null;

      const dateStr = r.date instanceof Date && !isNaN(r.date.getTime())
        ? r.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;

      return {
        caseNumber:      r.case_number ?? null,
        bookingRef:      r.booking_ref ?? bookingEvidence ?? null,
        primaryIssue:    r.primaryIssue,
        issueLabel:      TAXONOMY_MAP[r.primaryIssue]?.label ?? r.primaryIssue,
        subject:         r.subject ? r.subject.slice(0, 120) : null,
        date:            dateStr,
        customer:        r.resolvedCustomer,
        transporter:     r.resolvedTransporter,
        loadRef,
        containerNumber,
        confidence:      r.confidence,
      };
    });
}

export function runAnalysis(
  rawRecords: NormalisedRecord[],
  zipMap: Record<string, string>,  // external ZIP map (takes precedence over built-in rules)
): AnalysisResult {

  // ─── 1. Enrich each record ─────────────────────────────────────
  const records: EnrichedRecord[] = rawRecords.map(r => {
    const cls = classifyCase(r);

    const combinedText = [r.subject, r.description, r.isr_details, r.category]
      .filter(Boolean).join(' ');

    // External ZIP map overrides built-in rules
    let resolvedArea = cls.resolvedArea;
    if (r.zip && zipMap[r.zip]) resolvedArea = zipMap[r.zip];
    if (r.area) resolvedArea = r.area;

    const weekKey = toWeekKey(r.date);

    return {
      ...r,
      combinedText,
      issues:               cls.issues,
      primaryIssue:         cls.primaryIssue,
      secondaryIssue:       cls.secondaryIssue,
      issueState:           cls.issueState,
      weekKey,
      resolvedArea,
      routingHint:          cls.routingHint,
      routingAlignment:     cls.routingAlignment,
      extractedZip:         cls.extractedZip,
      resolvedCustomer:     cls.resolvedCustomer,
      resolvedTransporter:  cls.resolvedTransporter,
      resolvedDepot:        cls.resolvedDepot,
      resolvedDeepseaTerminal: cls.resolvedDeepseaTerminal,
      confidence:           cls.confidence,
      reviewFlag:           cls.reviewFlag,
      unresolvedReason:     cls.unresolvedReason,
      allEntities:          cls.allEntities,
      unknownEntities:      cls.unknownEntities,
      evidence:             cls.evidence,
      sourceFieldsUsed:     cls.sourceFieldsUsed,
      // Strict resolved-only model: only use the canonical name produced by
      // the classification engine. If resolution failed (null), the row is
      // unresolved — never fall back to raw r.customer, as that may hold
      // carriers, internal ISR labels, junk placeholders, or partial names
      // that would corrupt Customer Burden reporting.
      transporter: cls.resolvedTransporter ?? r.transporter,
      customer: cls.resolvedCustomer ?? undefined,
    };
  });

  // ─── 2. Weekly history ─────────────────────────────────────────
  const weeklyHistory: Record<string, WeeklySnapshot> = {};
  for (const r of records) {
    if (r.weekKey === 'unknown') continue;
    if (!weeklyHistory[r.weekKey]) {
      weeklyHistory[r.weekKey] = { total: 0, issues: {}, customers: {}, transporters: {}, areas: {} };
    }
    const wk = weeklyHistory[r.weekKey];
    wk.total++;
    for (const iss of r.issues) wk.issues[iss] = (wk.issues[iss] ?? 0) + 1;
    // Only add RESOLVED, non-operational customers to weekly history.
    // 'Unknown' / null is excluded — it skews trend lines without adding insight.
    const custName = r.resolvedCustomer;
    if (custName && !isBlockedFromCustomerRole(custName)) {
      wk.customers[custName] = (wk.customers[custName] ?? 0) + 1;
    }
    if (r.resolvedTransporter) wk.transporters[r.resolvedTransporter] = (wk.transporters[r.resolvedTransporter] ?? 0) + 1;
    if (r.resolvedArea) wk.areas[r.resolvedArea] = (wk.areas[r.resolvedArea] ?? 0) + 1;
  }
  const sortedWeeks = Object.keys(weeklyHistory).sort();

  // ─── 3. Issue breakdown ────────────────────────────────────────
  const issueCounts: Record<string, number> = {};
  const issueHours:  Record<string, number> = {};
  // Collect matching records per issue id for evidence drilldown
  const issueRecordsMap: Record<string, EnrichedRecord[]> = {};
  for (const r of records) {
    for (const iss of r.issues) {
      issueCounts[iss] = (issueCounts[iss] ?? 0) + 1;
      const tax = TAXONOMY_MAP[iss];
      issueHours[iss] = (issueHours[iss] ?? 0) + (tax?.hours ?? 0.5);
      if (!issueRecordsMap[iss]) issueRecordsMap[iss] = [];
      issueRecordsMap[iss].push(r);
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
      return {
        id: tax.id, label: tax.label, color: tax.color, count,
        percent: totalCases ? (count / totalCases) * 100 : 0,
        hoursLost, preventable: tax.preventable, trend,
        exampleCases: buildExampleCases(issueRecordsMap[tax.id] ?? []),
      };
    })
    .filter(i => i.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalHoursLost = issueBreakdown.reduce((s, i) => s + i.hoursLost, 0);
  const preventableHours = issueBreakdown.filter(i => i.preventable).reduce((s, i) => s + i.hoursLost, 0);
  const preventablePct = totalHoursLost > 0 ? (preventableHours / totalHoursLost) * 100 : 0;

  // ─── 4. Customer burden ────────────────────────────────────────
  // Guard: 'Unknown' (unresolved customer) is EXCLUDED from the main
  // customer burden list. These cases are counted separately and shown
  // in a dedicated review panel in CustomerPage.
  // This prevents 'Unknown' from dominating the top customer chart.

  // ── 4a. Dataset frequency pre-scan ──────────────────────────────
  // Count how many records each candidate customer name appears in.
  // Used to apply a minimum confidence threshold: names that appear only
  // once AND have low issue confidence AND don't look like a proper
  // company structure are likely noise from bad data — route to unresolved.
  //
  // Rules:
  //   - count >= 2: always include (repeated occurrence = probably real)
  //   - count == 1 AND confidence >= 0.70: include (strong issue match)
  //   - count == 1 AND confidence < 0.70 AND !hasCompanyNameStructure: unresolved
  //
  // Note: confidence here is the ISSUE classification confidence from the
  // classifier, used as a proxy for overall record quality.
  const customerFrequency: Record<string, number> = {};
  for (const r of records) {
    const name = r.resolvedCustomer;
    if (name && !isBlockedFromCustomerRole(name)) {
      customerFrequency[name] = (customerFrequency[name] ?? 0) + 1;
    }
  }

  const custMap: Record<string, CustomerBurdenItem> = {};
  // Collect matching records per customer for evidence drilldown
  const custRecordsMap: Record<string, EnrichedRecord[]> = {};
  let unknownCustomerCaseCount = 0;

  for (const r of records) {
    // Hard guard: use only resolvedCustomer (never raw r.customer).
    // resolvedCustomer is null when the customer column held a depot/transporter.
    const name = r.resolvedCustomer;

    // Hard guard: operational entities, internal ISR labels, and junk placeholders
    // must never appear in customer reporting.
    if (name && isBlockedFromCustomerRole(name)) continue;

    // No resolved customer → count as unresolved, exclude from main chart.
    if (!name) {
      unknownCustomerCaseCount++;
      continue;
    }

    // Positive acceptance gate:
    // "Not blocked" alone is not sufficient to reach Customer Burden.
    // A name must also LOOK LIKE a real company/business account.
    //
    // Acceptance tiers:
    //   - isPositiveCustomerCandidate: passes company-name structure check → accepted
    //   - freq >= 3: seen 3+ times in dataset → trusted on recurrence alone
    //   - freq >= 2 AND confidence >= 0.70: twice-seen with strong issue classification
    //
    // Names failing all three tiers are routed to unresolved tracking.
    const freq = customerFrequency[name] ?? 0;
    const meetsPositiveGate =
      isPositiveCustomerCandidate(name) ||
      freq >= 3 ||
      (freq >= 2 && r.confidence >= 0.70);

    if (!meetsPositiveGate) {
      unknownCustomerCaseCount++;
      continue;
    }

    if (!custMap[name]) {
      custMap[name] = { name, count: 0, hoursLost: 0, preventablePct: 0, missingLoadRef: 0, refProvided: 0, missingCustomsDocs: 0, amendments: 0, delays: 0, topIssue: '', trend: 'stable', risk: 'LOW', riskScore: 0, weekCounts: {}, exampleCases: [] };
    }
    if (!custRecordsMap[name]) custRecordsMap[name] = [];
    custRecordsMap[name].push(r);
    const c = custMap[name];
    c.count++;
    c.weekCounts[r.weekKey] = (c.weekCounts[r.weekKey] ?? 0) + 1;
    let preventableCount = 0;
    for (const iss of r.issues) {
      const tax = TAXONOMY_MAP[iss];
      c.hoursLost += tax?.hours ?? 0.5;
      if (tax?.preventable) preventableCount++;
      if (iss === 'load_ref')                              c.missingLoadRef++;
      if (iss === 'ref_provided')                          c.refProvided++;
      if (['customs','portbase','bl','t1'].includes(iss)) c.missingCustomsDocs++;
      if (iss === 'amendment')                             c.amendments++;
      if (iss === 'delay')                                 c.delays++;
    }
    c.preventablePct += preventableCount / r.issues.length;
  }

  // Both gates applied inline at build time so ALL downstream uses
  // (summary, repeatOffenders, actionInsights, forecast, UI) see clean data.
  //   Negative gate: isBlockedFromCustomerRole — blocks operational/carrier/ISR/junk
  //   Positive gate: isPositiveCustomerCandidate — requires real company-name substance
  const customerBurden: CustomerBurdenItem[] = Object.values(custMap)
    .filter(c => !isBlockedFromCustomerRole(c.name) && isPositiveCustomerCandidate(c.name))
    .map(c => {
      const recs = custRecordsMap[c.name] ?? [];
      const topIssue = topIssueForGroup(recs);
      const trend = getWeekTrend(c.weekCounts, sortedWeeks);
      const riskScore = c.count * 0.4 + c.missingLoadRef * 2 + c.missingCustomsDocs * 1.5 + c.delays * 1.5 + (trend === 'up' ? 10 : 0);
      const preventablePctFinal = c.count > 0 ? (c.preventablePct / c.count) * 100 : 0;
      return { ...c, topIssue, trend, riskScore, risk: riskLabel(riskScore), preventablePct: preventablePctFinal, exampleCases: buildExampleCases(recs) };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 5. Transporter performance ────────────────────────────────
  const transMap: Record<string, TransporterItem> = {};
  // Collect matching records per transporter for evidence drilldown
  const transRecordsMap: Record<string, EnrichedRecord[]> = {};
  for (const r of records) {
    const name = r.resolvedTransporter;
    if (!name) continue;
    // Hard guard: only approved transporters may appear in Transporter Performance.
    if (!isApprovedTransporter(name)) continue;
    if (!transMap[name]) {
      transMap[name] = { name, count: 0, delays: 0, notOnTime: 0, waitingTime: 0, punctualityScore: 0, trend: 'stable', risk: 'LOW', weekCounts: {}, exampleCases: [] };
    }
    if (!transRecordsMap[name]) transRecordsMap[name] = [];
    transRecordsMap[name].push(r);
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
      const punctualityScore  = t.count > 0 ? (punctualityIssues / t.count) * 100 : 0;
      const trend             = getWeekTrend(t.weekCounts, sortedWeeks);
      const riskScore         = punctualityScore + (trend === 'up' ? 20 : 0);
      return { ...t, punctualityScore, trend, risk: riskLabel(riskScore), exampleCases: buildExampleCases(transRecordsMap[t.name] ?? []) };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 6. Depot performance ──────────────────────────────────────
  const depotMap: Record<string, DepotItem> = {};
  for (const r of records) {
    const name = r.resolvedDepot;
    if (!name) continue;
    if (!depotMap[name]) depotMap[name] = { name, count: 0, hoursLost: 0, topIssue: '', trend: 'stable', weekCounts: {} };
    const d = depotMap[name];
    d.count++;
    d.weekCounts[r.weekKey] = (d.weekCounts[r.weekKey] ?? 0) + 1;
    for (const iss of r.issues) d.hoursLost += TAXONOMY_MAP[iss]?.hours ?? 0.5;
  }

  const depotPerformance: DepotItem[] = Object.values(depotMap)
    .map(d => {
      const recs = records.filter(r => r.resolvedDepot === d.name);
      const topIssue = topIssueForGroup(recs);
      const trend    = getWeekTrend(d.weekCounts, sortedWeeks);
      return { ...d, topIssue, trend };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 7. Deepsea terminal data ──────────────────────────────────
  const terminalMap: Record<string, DeepseaTerminalItem> = {};
  for (const r of records) {
    const name = r.resolvedDeepseaTerminal;
    if (!name) continue;
    if (!terminalMap[name]) terminalMap[name] = { name, count: 0, hoursLost: 0, topIssue: '', trend: 'stable', weekCounts: {} };
    const t = terminalMap[name];
    t.count++;
    t.weekCounts[r.weekKey] = (t.weekCounts[r.weekKey] ?? 0) + 1;
    for (const iss of r.issues) t.hoursLost += TAXONOMY_MAP[iss]?.hours ?? 0.5;
  }

  const deepseaTerminalData: DeepseaTerminalItem[] = Object.values(terminalMap)
    .map(t => {
      const recs = records.filter(r => r.resolvedDeepseaTerminal === t.name);
      const topIssue = topIssueForGroup(recs);
      const trend    = getWeekTrend(t.weekCounts, sortedWeeks);
      return { ...t, topIssue, trend };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 8. Unknown entities ──────────────────────────────────────
  const unknownEntityMap: Record<string, UnknownEntityItem> = {};
  for (const r of records) {
    for (const name of r.unknownEntities ?? []) {
      if (!unknownEntityMap[name]) {
        unknownEntityMap[name] = { name, count: 0, sourceField: 'customer_col' };
      }
      unknownEntityMap[name].count++;
    }
  }
  const unknownEntities: UnknownEntityItem[] = Object.values(unknownEntityMap)
    .sort((a, b) => b.count - a.count);

  // ─── 9. Customs compliance (overall tally only) ────────────────
  const customsRecords = records.filter(r => r.issues.some(i => ['customs','portbase','bl','t1'].includes(i)));

  const customsCompliance: CustomsCompliance = {
    totalCases:     customsRecords.length,
    customsDocs:    records.filter(r => r.issues.includes('customs')).length,
    portbaseIssues: records.filter(r => r.issues.includes('portbase')).length,
    blIssues:       records.filter(r => r.issues.includes('bl')).length,
    t1Issues:       records.filter(r => r.issues.includes('t1')).length,
  };

  // ─── 10. Load reference intelligence ──────────────────────────
  const loadRefRecords     = records.filter(r => r.issues.includes('load_ref'));
  const refProvidedRecords = records.filter(r => r.issues.includes('ref_provided'));
  const loadRefByCustomer: Record<string, number> = {};
  for (const r of loadRefRecords) {
    const name = r.resolvedCustomer;
    if (!name) continue;
    if (isKnownOperationalEntity(name)) continue;
    loadRefByCustomer[name] = (loadRefByCustomer[name] ?? 0) + 1;
  }
  const loadRefIntelligence: LoadRefIntelligence = {
    totalMissing:    loadRefRecords.length,
    totalProvided:   refProvidedRecords.length,
    estimatedRework: loadRefRecords.length * 0.5,
    topOffenders:    Object.entries(loadRefByCustomer).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
  };

  // ─── 11. Area hotspots ────────────────────────────────────────
  const areaMap: Record<string, AreaHotspot> = {};
  for (const r of records) {
    const area = r.resolvedArea;
    if (!area) continue;
    if (!areaMap[area]) areaMap[area] = { name: area, count: 0, hoursLost: 0, topIssue: '', trend: 'stable', weekCounts: {} };
    const a = areaMap[area];
    a.count++;
    a.weekCounts[r.weekKey] = (a.weekCounts[r.weekKey] ?? 0) + 1;
    for (const iss of r.issues) a.hoursLost += TAXONOMY_MAP[iss]?.hours ?? 0.5;
  }

  const areaHotspots: AreaHotspot[] = Object.values(areaMap)
    // Two-pass filter:
    // 1. EXCLUDED_AREA_LABELS — explicit NL/BE non-operational areas
    // 2. isAllowedAreaLabel   — blocks raw ZIP codes + generic DE geography labels
    .filter(a => !EXCLUDED_AREA_LABELS.has(a.name) && isAllowedAreaLabel(a.name))
    .map(a => {
      const recs = records.filter(r => r.resolvedArea === a.name);
      const topIssue = topIssueForGroup(recs);
      const trend    = getWeekTrend(a.weekCounts, sortedWeeks);
      return { ...a, topIssue, trend };
    })
    .sort((a, b) => b.count - a.count);

  // ─── 12. ISR vs External ──────────────────────────────────────
  // Primary signal: isr_details field being populated (content > 5 chars)
  // indicates the case was handled via the ISR internal workflow.
  // Fallback: customer column matches a known Maersk internal address-book label.
  // isIsrRecord: checks isr_details content AND raw account columns.
  // resolvedCustomer may already be null for ISR rows (blocked by isInternalISRLabel
  // during classification), so we must also scan the raw field values directly.
  const ISR_RAW_ACCOUNT_KEYS = new Set([
    'account name', 'account', 'customer', 'customer name', 'klant', 'debtor', 'client',
  ]);
  const isIsrRecord = (r: EnrichedRecord): boolean => {
    if ((r.isr_details?.trim().length ?? 0) > 5) return true;
    if (isInternalISRLabel(r.customer ?? '')) return true;
    // Scan raw fields for ISR labels (catches rows where resolvedCustomer was already nulled)
    for (const [k, v] of Object.entries(r._raw)) {
      if (v && typeof v === 'string' && ISR_RAW_ACCOUNT_KEYS.has(k.toLowerCase().trim())) {
        if (isInternalISRLabel(v)) return true;
      }
    }
    return false;
  };

  const isrRecords     = records.filter(isIsrRecord);
  const externalCount  = records.length - isrRecords.length;

  const isrVsExternal: IsrVsExternal = {
    totalIsr:      isrRecords.length,
    totalExternal: externalCount,
    isrPct:        totalCases > 0 ? (isrRecords.length / totalCases) * 100 : 0,
    externalPct:   totalCases > 0 ? (externalCount / totalCases) * 100 : 0,
    weeklyBreakdown: sortedWeeks.map(wk => {
      const weekRecs = records.filter(r => r.weekKey === wk);
      const weekIsr  = weekRecs.filter(isIsrRecord).length;
      return {
        week: wk,
        isr: weekIsr,
        external: weekRecs.length - weekIsr,
        isrPct: weekRecs.length > 0 ? (weekIsr / weekRecs.length) * 100 : 0,
      };
    }),
  };

  // ─── 13. Issue drilldowns ─────────────────────────────────────
  const issueDrilldowns: IssueDrilldown[] = issueBreakdown.slice(0, 8).map(iss => {
    const issRecs = records.filter(r => r.issues.includes(iss.id));

    const topN = <T extends string>(counts: Record<T, number>, total: number): Array<{ name: T; count: number; pct: number }> =>
      (Object.entries(counts) as Array<[T, number]>)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([name, count]) => ({ name, count, pct: total > 0 ? (count / total) * 100 : 0 }));

    const custCounts: Record<string, number> = {};
    for (const r of issRecs) {
      const name = r.resolvedCustomer;
      if (name && !isBlockedFromCustomerRole(name)) custCounts[name] = (custCounts[name] ?? 0) + 1;
    }

    const transCounts: Record<string, number> = {};
    for (const r of issRecs) {
      const name = r.resolvedTransporter;
      if (name && isApprovedTransporter(name)) transCounts[name] = (transCounts[name] ?? 0) + 1;
    }

    const areaCounts: Record<string, number> = {};
    for (const r of issRecs) {
      const area = r.resolvedArea;
      if (area && !EXCLUDED_AREA_LABELS.has(area)) areaCounts[area] = (areaCounts[area] ?? 0) + 1;
    }

    const isrCount = issRecs.filter(isIsrRecord).length;

    return {
      issueId:         iss.id,
      issueLabel:      iss.label,
      color:           iss.color,
      totalCount:      iss.count,
      topCustomers:    topN(custCounts,  iss.count),
      topTransporters: topN(transCounts, iss.count),
      topAreas:        topN(areaCounts,  iss.count),
      externalCount:   issRecs.length - isrCount,
      isrCount,
    };
  });

  // ─── 14. Week-on-week comparison ──────────────────────────────
  const makeWowChange = (label: string, current: number, prior: number): WowChange => {
    const pctChange = prior > 0 ? ((current - prior) / prior) * 100 : current > 0 ? 100 : 0;
    const direction: 'up' | 'down' | 'stable' = pctChange > 10 ? 'up' : pctChange < -10 ? 'down' : 'stable';
    return { label, current, prior, pctChange, direction, isSpike: Math.abs(pctChange) >= 20 && current >= 3 };
  };

  let weekOnWeek: WeekOnWeek;
  if (sortedWeeks.length >= 2) {
    const curWk  = sortedWeeks[sortedWeeks.length - 1];
    const prvWk  = sortedWeeks[sortedWeeks.length - 2];
    const curSnap = weeklyHistory[curWk];
    const prvSnap = weeklyHistory[prvWk];

    const allIssueIds     = new Set([...Object.keys(curSnap.issues),      ...Object.keys(prvSnap.issues)]);
    const allCustNames    = new Set([...Object.keys(curSnap.customers),    ...Object.keys(prvSnap.customers)]);
    const allTransNames   = new Set([...Object.keys(curSnap.transporters), ...Object.keys(prvSnap.transporters)]);
    const allAreaNames    = new Set([...Object.keys(curSnap.areas),        ...Object.keys(prvSnap.areas)]);

    const issueChanges = Array.from(allIssueIds)
      .map(id => makeWowChange(TAXONOMY_MAP[id]?.label ?? id, curSnap.issues[id] ?? 0, prvSnap.issues[id] ?? 0))
      .filter(c => c.current >= 2 || c.prior >= 2)
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)).slice(0, 8);

    const customerChanges = Array.from(allCustNames)
      .map(name => makeWowChange(name, curSnap.customers[name] ?? 0, prvSnap.customers[name] ?? 0))
      .filter(c => c.current >= 2 || c.prior >= 2)
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)).slice(0, 5);

    const transporterChanges = Array.from(allTransNames)
      .map(name => makeWowChange(name, curSnap.transporters[name] ?? 0, prvSnap.transporters[name] ?? 0))
      .filter(c => c.current >= 2 || c.prior >= 2)
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)).slice(0, 5);

    const areaChanges = Array.from(allAreaNames)
      .map(name => makeWowChange(name, curSnap.areas[name] ?? 0, prvSnap.areas[name] ?? 0))
      .filter(c => c.current >= 2 || c.prior >= 2)
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)).slice(0, 5);

    const curIsrCount = records.filter(r => r.weekKey === curWk && isIsrRecord(r)).length;
    const prvIsrCount = records.filter(r => r.weekKey === prvWk && isIsrRecord(r)).length;

    weekOnWeek = {
      available: true,
      currentWeek: curWk,
      priorWeek:   prvWk,
      totalVolume: makeWowChange('Total Cases', curSnap.total, prvSnap.total),
      issueChanges,
      customerChanges,
      transporterChanges,
      areaChanges,
      isrMovement: makeWowChange('ISR Internal Cases', curIsrCount, prvIsrCount),
    };
  } else {
    weekOnWeek = {
      available:   false,
      currentWeek: sortedWeeks[sortedWeeks.length - 1] ?? '',
      priorWeek:   '',
      totalVolume: null,
      issueChanges: [], customerChanges: [], transporterChanges: [], areaChanges: [],
      isrMovement: null,
    };
  }

  // ─── 15. Repeat offenders ─────────────────────────────────────
  const repeatOffenders: RepeatOffenderItem[] = [];

  const buildRepeatOffenders = (
    items: Array<{ name: string; count: number }>,
    entityType: RepeatOffenderItem['entityType'],
    filterFn: (r: EnrichedRecord, name: string) => boolean,
  ) => {
    for (const item of items) {
      if (item.count < 4) continue;
      const recs = records.filter(r => filterFn(r, item.name));
      const ic: Record<string, number> = {};
      for (const r of recs) for (const iss of r.issues) ic[iss] = (ic[iss] ?? 0) + 1;
      const top = Object.entries(ic).sort((a, b) => b[1] - a[1])[0];
      if (!top) continue;
      const [topId, topCount] = top;
      if (topCount >= 3 && (topCount / item.count) >= 0.35) {
        repeatOffenders.push({
          name: item.name, entityType,
          topIssueId: topId, topIssueLabel: TAXONOMY_MAP[topId]?.label ?? topId,
          repeatCount: topCount, totalCount: item.count,
          repeatPct: (topCount / item.count) * 100,
        });
      }
    }
  };

  buildRepeatOffenders(customerBurden,          'customer',    (r, n) => r.resolvedCustomer    === n);
  buildRepeatOffenders(transporterPerformance,   'transporter', (r, n) => r.resolvedTransporter === n);
  buildRepeatOffenders(areaHotspots,             'area',        (r, n) => r.resolvedArea        === n);
  repeatOffenders.sort((a, b) => b.repeatCount - a.repeatCount);

  // ─── 16. Operational action insights ─────────────────────────
  const PRIORITY_ORDER: Record<ActionInsight['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const actionInsights: ActionInsight[] = [];

  const addInsight = (priority: ActionInsight['priority'], category: ActionInsight['category'], text: string) =>
    actionInsights.push({ priority, category, text });

  // Total volume spike
  if (weekOnWeek.totalVolume?.isSpike && weekOnWeek.totalVolume.direction === 'up') {
    const v = weekOnWeek.totalVolume;
    addInsight('HIGH', 'trend', `Total case volume rose ${v.pctChange.toFixed(0)}% week-on-week (${v.prior} → ${v.current} cases). Investigate root cause before management escalation.`);
  }

  // Issue spikes
  for (const c of weekOnWeek.issueChanges.filter(x => x.isSpike && x.direction === 'up').slice(0, 2)) {
    addInsight('HIGH', 'issue', `${c.label} cases rose ${c.pctChange.toFixed(0)}% this week (${c.prior} → ${c.current}). Review contributing accounts and areas.`);
  }

  // Top customer by load ref
  const topLoadRefCust = customerBurden.filter(c => c.missingLoadRef >= 3).sort((a, b) => b.missingLoadRef - a.missingLoadRef)[0];
  if (topLoadRefCust) {
    addInsight('HIGH', 'customer', `${topLoadRefCust.name} generated the most missing load reference cases — ${topLoadRefCust.missingLoadRef} cases. Mandatory reference enforcement recommended.`);
  }

  // Top customer overall
  if (customerBurden[0]?.count >= 5) {
    const c = customerBurden[0];
    addInsight(c.risk === 'HIGH' ? 'HIGH' : 'MEDIUM', 'customer', `${c.name} is the highest-burden account — ${c.count} cases, ${c.hoursLost.toFixed(1)} hours. Risk level: ${c.risk}.`);
  }

  // ISR movement or high ISR share
  if (weekOnWeek.isrMovement && weekOnWeek.isrMovement.direction !== 'stable') {
    const m = weekOnWeek.isrMovement;
    const dir = m.direction === 'up' ? 'increased' : 'decreased';
    addInsight('MEDIUM', 'isr', `Internal ISR case volume ${dir} ${Math.abs(m.pctChange).toFixed(0)}% week-on-week (${m.prior} → ${m.current}). Review ISR workflow throughput.`);
  } else if (isrVsExternal.isrPct > 30) {
    addInsight('MEDIUM', 'isr', `Internal ISR cases represent ${isrVsExternal.isrPct.toFixed(1)}% of total caseload — elevated internal workflow volume. Confirm routing logic is correct.`);
  }

  // Top transporter by delays
  const topDelayTrans = [...transporterPerformance].sort((a, b) => b.delays - a.delays)[0];
  if (topDelayTrans?.delays >= 3) {
    addInsight(topDelayTrans.risk === 'HIGH' ? 'HIGH' : 'MEDIUM', 'transporter',
      `${topDelayTrans.name} recorded the most delay cases — ${topDelayTrans.delays} delays, punctuality issue rate ${topDelayTrans.punctualityScore.toFixed(0)}%. SLA review recommended.`);
  }

  // Transporter spike
  for (const c of weekOnWeek.transporterChanges.filter(x => x.isSpike && x.direction === 'up').slice(0, 1)) {
    addInsight('MEDIUM', 'transporter', `${c.label} saw a sharp increase in cases this week (${c.prior} → ${c.current}, +${c.pctChange.toFixed(0)}%). Investigate delay or documentation pattern.`);
  }

  // Top area hotspot
  if (areaHotspots[0]?.count >= 5) {
    const a = areaHotspots[0];
    addInsight('MEDIUM', 'area', `${a.name} is the dominant operational area with ${a.count} cases. Top issue: ${a.topIssue}.`);
  }

  // Area spike
  for (const c of weekOnWeek.areaChanges.filter(x => x.isSpike && x.direction === 'up').slice(0, 1)) {
    addInsight('MEDIUM', 'area', `${c.label} saw a sharp increase in cases this week (+${c.pctChange.toFixed(0)}%). Review operational capacity in this zone.`);
  }

  // Customs area pressure
  if (customsCompliance.totalCases >= 5) {
    const topCustomsArea = areaHotspots.find(a => {
      const n = records.filter(r => r.resolvedArea === a.name && r.issues.some(i => ['customs','portbase','bl','t1'].includes(i))).length;
      return n >= 3;
    });
    if (topCustomsArea) {
      addInsight('MEDIUM', 'area', `${topCustomsArea.name} has elevated customs and documentation pressure. Pre-shipment document checks recommended for this zone.`);
    }
  }

  // Amendment spike
  const amendChange = weekOnWeek.issueChanges.find(c => c.label.toLowerCase().includes('amendment') && c.direction === 'up');
  if (amendChange) {
    addInsight('MEDIUM', 'issue', `Amendment and correction cases are rising this week (${amendChange.prior} → ${amendChange.current}). Review booking quality controls to reduce rework.`);
  }

  // Top repeat offender
  if (repeatOffenders[0]) {
    const ro = repeatOffenders[0];
    const cat: ActionInsight['category'] = ro.entityType === 'customer' ? 'customer' : ro.entityType === 'transporter' ? 'transporter' : 'area';
    addInsight('MEDIUM', cat, `${ro.name} is a repeat friction source — ${ro.repeatPct.toFixed(0)}% of their cases are ${ro.topIssueLabel} (${ro.repeatCount} of ${ro.totalCount}). Structural fix needed.`);
  }

  actionInsights.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const finalActionInsights = actionInsights.slice(0, 10);

  // ─── 17. Chart display window ─────────────────────────────────
  const chartWeeks = sortedWeeks.length > MAX_CHART_WEEKS
    ? sortedWeeks.slice(sortedWeeks.length - MAX_CHART_WEEKS)
    : sortedWeeks;

  // ─── 18. Summary ─────────────────────────────────────────────
  const topIssue      = issueBreakdown.find(i => i.id !== 'other');
  const topCustomer   = customerBurden[0];
  const topTransporter= [...transporterPerformance].sort((a, b) => b.delays - a.delays)[0];
  const topArea       = areaHotspots[0];
  const reviewFlagCount    = records.filter(r => r.reviewFlag).length;
  const unknownEntityCount = unknownEntities.reduce((s, e) => s + e.count, 0);
  const unknownCustomerCount = unknownCustomerCaseCount;

  const weekRange = sortedWeeks.length > 0
    ? `${sortedWeeks[0].replace('-W', ' W')} – ${sortedWeeks[sortedWeeks.length - 1].replace('-W', ' W')}`
    : 'All records';

  const qw = quickWin(issueBreakdown, customerBurden);

  const summary = {
    totalCases,
    totalHoursLost,
    preventablePct,
    topIssue:           topIssue?.label ?? 'N/A',
    topIssueCount:      topIssue?.count ?? 0,
    topIssuePercent:    topIssue?.percent ?? 0,
    topCustomer:        topCustomer?.name ?? 'N/A',
    topCustomerCount:   topCustomer?.count ?? 0,
    topTransporter:     topTransporter?.name ?? 'N/A',
    topTransporterDelays: topTransporter?.delays ?? 0,
    topArea:            topArea?.name ?? 'N/A',
    topAreaCount:       topArea?.count ?? 0,
    weekRange,
    weekCount:          sortedWeeks.length,
    quickWin:           qw,
    narrative: buildNarrative(totalCases, sortedWeeks.length, weekRange, topIssue, topCustomer, preventablePct, totalHoursLost, reviewFlagCount, unknownEntityCount),
    reviewFlagCount,
    unknownEntityCount,
    unknownCustomerCount,
  };

  // ─── 19. Forecast & actions ───────────────────────────────────
  const forecast = buildForecast(weeklyHistory, sortedWeeks, customerBurden, transporterPerformance);
  const actions  = generateActions(issueBreakdown, customerBurden, transporterPerformance);

  // ─── 20. Output validation ────────────────────────────────────
  // customerBurden was already built with both gates applied inline (section 4).
  // This block runs post-aggregation validation to surface any rule violations,
  // splitting ERROR (data integrity failures) from WARN (quality issues).
  // Does not throw — violations are logged for investigation without crashing.
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    const casesWithNumbers = records.filter(r => r.case_number).length;
    if (casesWithNumbers === 0 && records.length > 0) {
      console.warn(
        '[CIS validation] No Case Number values found — evidence drilldown will lack Case No. links.',
        'Add a "Case Number" or "Case No." column to the Excel.',
      );
    }
    const violations = validateOutputGuards(
      customerBurden,
      transporterPerformance,
      areaHotspots,
      { totalRecords: records.length, recordsWithCaseNumber: casesWithNumbers },
    );
    const errors = violations.filter(v => v.severity === 'ERROR');
    const warns  = violations.filter(v => v.severity === 'WARN');
    if (errors.length > 0) console.error('[CIS validation] ERRORS (data integrity):', errors);
    if (warns.length  > 0) console.warn( '[CIS validation] WARNINGS (quality):',     warns);
  }

  return {
    meta: { filename: '', rowCount: rawRecords.length, analyzedAt: new Date(), hasZipMap: Object.keys(zipMap).length > 0 },
    summary,
    issueBreakdown,
    weeklyHistory,
    sortedWeeks,
    chartWeeks,
    customerBurden,
    transporterPerformance,
    depotPerformance,
    deepseaTerminalData,
    unknownEntities,
    customsCompliance,
    loadRefIntelligence,
    areaHotspots,
    isrVsExternal,
    issueDrilldowns,
    weekOnWeek,
    repeatOffenders,
    actionInsights: finalActionInsights,
    forecast,
    actions,
    records,
  };
}
