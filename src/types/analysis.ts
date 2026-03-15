import type { NormalisedRecord } from './index';
import type { ExtractedEntity } from '../lib/entityExtraction';
import type { IssueState } from '../lib/issueRules';
import type { RoutingAlignment } from '../config/zipAreaRules';

export type { IssueState, RoutingAlignment };

export interface EnrichedRecord extends NormalisedRecord {
  combinedText: string;
  issues: string[];              // matched taxonomy ids
  primaryIssue: string;          // first / highest-confidence id
  secondaryIssue: string | null;
  issueState: IssueState;
  weekKey: string;
  resolvedArea: string | null;
  routingHint: string | null;
  routingAlignment: RoutingAlignment;
  extractedZip: string | null;

  // ── Extracted reference values ─────────────────────────────────────
  bookingRefExtracted: string | null;
  loadRefExtracted: string | null;
  containerExtracted: string | null;
  mrnRefExtracted: string | null;

  // ── Resolved entity names ──────────────────────────────────────
  resolvedCustomer: string | null;
  resolvedTransporter: string | null;
  resolvedDepot: string | null;
  resolvedDeepseaTerminal: string | null;

  // ── Classification quality ─────────────────────────────────────
  confidence: number;           // 0–1
  reviewFlag: boolean;
  unresolvedReason: string | null;

  // ── Full entity extraction output ─────────────────────────────
  allEntities: ExtractedEntity[];
  unknownEntities: string[];

  // ── Evidence trail ────────────────────────────────────────────
  evidence: string[];
  sourceFieldsUsed: string[];

  // ── Classifier transparency (diagnostic) ──────────────────────
  /** Intent group detected (financial, operational, documentation, …) */
  detectedIntent: string;
  /** Human-readable object the classifier found (Invoice, Load Reference, …) */
  detectedObject: string;
  /** The exact phrase or signal that triggered the primary classification */
  triggerPhrase: string;
  /** Which field the trigger phrase came from (description, subject, …) */
  triggerSourceField: string;

  // ── Operational signals ────────────────────────────────────────
  rootCause: string | null;
  preventableIssue: boolean;
}

// ── Example case drilldown ────────────────────────────────────────
// One representative row from the source Excel, extracted during
// aggregation and retained so the UI can show real case evidence
// behind any chart metric without re-scanning records at render time.
export interface ExampleCase {
  caseNumber: string | null;      // case number / ticket ID from source
  bookingRef: string | null;      // booking reference from source or classifier
  primaryIssue: string;           // taxonomy id
  issueLabel: string;             // human-readable label
  issueState: string;             // intent/state: missing | provided | amended | delayed | escalated | informational | unknown
  subject: string | null;         // case subject (truncated to 120 chars)
  date: string | null;            // formatted date string (dd Mon yyyy)
  customer: string | null;        // resolvedCustomer
  transporter: string | null;     // resolvedTransporter
  loadRef: string | null;         // extracted from classifier evidence
  containerNumber: string | null; // extracted from classifier evidence
  mrnRef: string | null;          // extracted MRN / T1 transit reference from evidence
  confidence: number;             // 0–1 classification confidence
}

export interface IssueBreakdownItem {
  id: string;
  label: string;
  color: string;
  count: number;
  percent: number;
  hoursLost: number;
  preventable: boolean;
  trend: 'up' | 'down' | 'stable';
  /** Top 10 example cases for this issue, sorted by confidence desc */
  exampleCases: ExampleCase[];
}

export interface CustomerBurdenItem {
  name: string;
  count: number;
  hoursLost: number;
  preventablePct: number;
  missingLoadRef: number;
  refProvided: number;
  missingCustomsDocs: number;
  amendments: number;
  delays: number;
  topIssue: string;
  trend: 'up' | 'down' | 'stable';
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  weekCounts: Record<string, number>;
  /** Top 10 example cases for this customer, sorted by confidence desc */
  exampleCases: ExampleCase[];
}

export interface TransporterItem {
  name: string;
  count: number;
  delays: number;
  notOnTime: number;
  waitingTime: number;
  punctualityScore: number;
  trend: 'up' | 'down' | 'stable';
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  weekCounts: Record<string, number>;
  /** Top 10 example cases for this transporter, sorted by confidence desc */
  exampleCases: ExampleCase[];
}

export interface DepotItem {
  name: string;
  count: number;
  hoursLost: number;
  topIssue: string;
  trend: 'up' | 'down' | 'stable';
  weekCounts: Record<string, number>;
  exampleCases: ExampleCase[];
}

export interface DeepseaTerminalItem {
  name: string;
  count: number;
  hoursLost: number;
  topIssue: string;
  trend: 'up' | 'down' | 'stable';
  weekCounts: Record<string, number>;
  exampleCases: ExampleCase[];
}

export interface UnknownEntityItem {
  name: string;
  count: number;
  sourceField: string;
}

export interface CustomsCompliance {
  totalCases: number;
  customsDocs: number;
  portbaseIssues: number;
  blIssues: number;
  t1Issues: number;
  /** All records that touch any customs-family issue (union of the four categories) */
  exampleCases: ExampleCase[];
  /** Records whose primaryIssue === 'customs' */
  customsDocsExamples: ExampleCase[];
  /** Records whose primaryIssue === 'portbase' */
  portbaseExamples: ExampleCase[];
  /** Records whose primaryIssue === 'bl' */
  blExamples: ExampleCase[];
  /** Records whose primaryIssue === 't1' */
  t1Examples: ExampleCase[];
}

export interface LoadRefIntelligence {
  totalMissing: number;
  totalProvided: number;
  estimatedRework: number;
  /** Top customers generating missing load reference cases */
  topOffenders: Array<{ name: string; count: number }>;
  /** Top transporters associated with missing load reference cases */
  topTransporters: Array<{ name: string; count: number }>;
  /** Top depots associated with missing load reference cases */
  topDepots: Array<{ name: string; count: number }>;
  /** Per-week count of missing load reference cases (for trend sparkline) */
  weeklyMissing: Record<string, number>;
  /** Average confidence score across missing load ref cases (0–1) */
  avgConfidence: number;
  /** Representative example cases for the load reference intelligence panel */
  exampleCases: ExampleCase[];
}

export interface IsrVsExternal {
  totalIsr: number;
  totalExternal: number;
  isrPct: number;
  externalPct: number;
  /** Per-week breakdown: isr count, external count, isr percentage */
  weeklyBreakdown: Array<{
    week: string;
    isr: number;
    external: number;
    isrPct: number;
  }>;
}

export interface AreaHotspot {
  name: string;
  count: number;
  hoursLost: number;
  topIssue: string;
  trend: 'up' | 'down' | 'stable';
  weekCounts: Record<string, number>;
  exampleCases: ExampleCase[];
}

export interface WeeklySnapshot {
  total: number;
  issues: Record<string, number>;
  customers: Record<string, number>;
  transporters: Record<string, number>;
  areas: Record<string, number>;
}

export interface ForecastIssue {
  id: string;
  label: string;
  color: string;
  forecasted: number;
  trend: 'up' | 'down' | 'stable';
}

export interface Forecast {
  available: boolean;
  reason?: string;
  nextWeekVolume: number;
  volumeTrend: 'up' | 'down' | 'stable';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  weeksAnalyzed: number;
  topIssues: ForecastIssue[];
  risingRisk: ForecastIssue[];
  riskyCustomers: Array<{ name: string; recentCount: number; trend: string; risk: string }>;
  riskyTransporters: Array<{ name: string; delayRate: number; risk: string }>;
  hotspots: Array<{ name: string; forecasted: number; trend: string }>;
  actions: string[];
}

export interface Actions {
  quickWins: string[];
  structuralFixes: string[];
  customerInterventions: Array<{ customer: string; action: string }>;
  transporterEscalations: Array<{ transporter: string; action: string }>;
  automationOpportunities: string[];
  complianceControls: string[];
}

export interface AnalysisSummary {
  totalCases: number;
  totalHoursLost: number;
  preventablePct: number;
  topIssue: string;
  topIssueCount: number;
  topIssuePercent: number;
  topCustomer: string;
  topCustomerCount: number;
  topTransporter: string;
  topTransporterDelays: number;
  topArea: string;
  topAreaCount: number;
  weekRange: string;
  weekCount: number;
  quickWin: string;
  narrative: string;
  reviewFlagCount: number;
  unknownEntityCount: number;
  /** Cases where no customer could be resolved — shown in review panel, not in top-customer charts */
  unknownCustomerCount: number;
}

// ── Root-cause drilldown ──────────────────────────────────────────
export interface IssueDriverItem {
  name: string;
  count: number;
  pct: number;   // percent of this issue's total cases
}

export interface IssueDrilldown {
  issueId: string;
  issueLabel: string;
  color: string;
  totalCount: number;
  topCustomers: IssueDriverItem[];
  topTransporters: IssueDriverItem[];
  topAreas: IssueDriverItem[];
  externalCount: number;
  isrCount: number;
}

// ── Week-on-week change ──────────────────────────────────────────
export interface WowChange {
  label: string;
  current: number;
  prior: number;
  pctChange: number;
  direction: 'up' | 'down' | 'stable';
  isSpike: boolean;   // >=20% change AND current >= 3 (avoids noise on tiny numbers)
}

export interface WeekOnWeek {
  available: boolean;
  currentWeek: string;
  priorWeek: string;
  totalVolume: WowChange | null;
  issueChanges: WowChange[];
  customerChanges: WowChange[];
  transporterChanges: WowChange[];
  areaChanges: WowChange[];
  isrMovement: WowChange | null;
}

// ── Repeat offenders ──────────────────────────────────────────────
export interface RepeatOffenderItem {
  name: string;
  entityType: 'customer' | 'transporter' | 'area';
  topIssueId: string;
  topIssueLabel: string;
  repeatCount: number;   // count of their dominant issue
  totalCount: number;
  repeatPct: number;     // % of their cases that are this issue
}

// ── Operational action insights ──────────────────────────────────
export interface ActionInsight {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'customer' | 'transporter' | 'area' | 'isr' | 'issue' | 'trend';
  text: string;
}

export interface ClassificationHealth {
  status: string;
  alerts: string[];
  otherPct: number;
  below60Pct: number;
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
  avgConfidence: number;
}

// ── Control Tower types ───────────────────────────────────────────

export interface CtBottleneck {
  category: string;
  categoryLabel: string;
  week: string;
  caseCount: number;
  spikePercent: number;
  priorCount: number;
}

export interface CtTransporterRisk {
  name: string;
  totalCases: number;
  recentDelayRate: number;
  priorDelayRate: number;
  recentEquipmentRate: number;
  priorEquipmentRate: number;
  recentAmendmentRate: number;
  priorAmendmentRate: number;
  preventableRate: number;
  riskFlags: Array<{ metric: string; current: number; prior: number; changePct: number }>;
  riskLevel: 'HIGH' | 'MEDIUM' | 'NONE';
}

export interface CtPreventableOpportunity {
  categoryId: string;
  categoryLabel: string;
  preventableCount: number;
  totalCount: number;
  preventableRate: number;
  hoursLost: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CtRootCauseItem {
  cause: string;
  causeLabel: string;
  count: number;
  percent: number;
  trend: 'up' | 'down' | 'stable';
  trendPct: number;
  recentCount: number;
  priorCount: number;
}

export interface CtCategoryRow {
  id: string;
  label: string;
  color: string;
  count: number;
  percent: number;
  hoursLost: number;
  preventableRate: number;
  trend: 'up' | 'down' | 'stable';
  trendPct: number;
}

// Phase 28 — Alerts
export type CtAlertType = 'category_spike' | 'transporter_delay' | 'preventable_spike' | 'root_cause_surge';
export type CtSeverity  = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CtAlert {
  alertType: CtAlertType;
  subject: string;
  changePct: number;
  caseCount: number;
  weekDetected: string;
  severity: CtSeverity;
}

// Phase 30 — Forecast
export interface CtForecastItem {
  categoryId: string;
  categoryLabel: string;
  color: string;
  currentWeekCount: number;
  projectedCount: number;
  rolling4wAvg: number;
  trend: 'up' | 'down' | 'stable';
}

// Phase 31 — Risk summary
export interface CtRiskSummary {
  highestDelayTransporter: { name: string; delayRate: number; changePct: number } | null;
  largestPreventableCategory: { label: string; hoursLost: number; count: number } | null;
  fastestGrowingCategory: { label: string; trendPct: number; count: number } | null;
  mostFrequentRootCause: { label: string; count: number; percent: number } | null;
}

export interface ControlTowerData {
  // Phase 21 — Overview
  totalCases: number;
  preventableCases: number;
  preventableHoursLost: number;
  avgConfidence: number;
  lowConfidenceRate: number;
  categoryDistribution: Array<{ id: string; name: string; value: number; color: string; percent: number; trend: 'up' | 'down' | 'stable' }>;

  // Phase 22 — Category intelligence
  categoryRows: CtCategoryRow[];

  // Phase 23 — Bottlenecks
  bottlenecks: CtBottleneck[];

  // Phase 24 — Transporter risk
  transporterRisks: CtTransporterRisk[];

  // Phase 25 — Preventable opportunities
  preventableOpportunities: CtPreventableOpportunity[];

  // Phase 26 — Root causes
  rootCauses: CtRootCauseItem[];

  // Phase 27 — Validation
  validationPassed: boolean;
  validationNotes: string[];

  // Phase 28 — Alerts
  alerts: CtAlert[];

  // Phase 30 — Forecasts
  forecasts: CtForecastItem[];

  // Phase 31 — Risk summary
  riskSummary: CtRiskSummary;
}

export interface AnalysisResult {
  meta: {
    filename: string;
    rowCount: number;
    analyzedAt: Date;
    hasZipMap: boolean;
  };
  classificationHealth: ClassificationHealth | null;
  summary: AnalysisSummary;
  issueBreakdown: IssueBreakdownItem[];
  weeklyHistory: Record<string, WeeklySnapshot>;
  sortedWeeks: string[];
  /** Last ≤16 weeks — use for trend charts to avoid overcrowded axes */
  chartWeeks: string[];
  customerBurden: CustomerBurdenItem[];
  transporterPerformance: TransporterItem[];
  depotPerformance: DepotItem[];
  deepseaTerminalData: DeepseaTerminalItem[];
  unknownEntities: UnknownEntityItem[];
  customsCompliance: CustomsCompliance;
  loadRefIntelligence: LoadRefIntelligence;
  areaHotspots: AreaHotspot[];
  isrVsExternal: IsrVsExternal;
  /** Root-cause drilldown — top contributors per issue */
  issueDrilldowns: IssueDrilldown[];
  /** Week-on-week comparison, spikes, and movement */
  weekOnWeek: WeekOnWeek;
  /** Entities with a dominant recurring issue pattern */
  repeatOffenders: RepeatOffenderItem[];
  /** Generated operational insights for the action board */
  actionInsights: ActionInsight[];
  forecast: Forecast;
  actions: Actions;
  records: EnrichedRecord[];
  controlTower: ControlTowerData;
}
