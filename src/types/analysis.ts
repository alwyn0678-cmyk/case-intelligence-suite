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
}

export interface DepotItem {
  name: string;
  count: number;
  hoursLost: number;
  topIssue: string;
  trend: 'up' | 'down' | 'stable';
  weekCounts: Record<string, number>;
}

export interface DeepseaTerminalItem {
  name: string;
  count: number;
  hoursLost: number;
  topIssue: string;
  trend: 'up' | 'down' | 'stable';
  weekCounts: Record<string, number>;
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
}

export interface LoadRefIntelligence {
  totalMissing: number;
  totalProvided: number;
  estimatedRework: number;
  topOffenders: Array<{ name: string; count: number }>;
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

export interface AnalysisResult {
  meta: {
    filename: string;
    rowCount: number;
    analyzedAt: Date;
    hasZipMap: boolean;
  };
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
}
