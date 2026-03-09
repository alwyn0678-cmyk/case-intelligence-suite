import type { NormalisedRecord } from './index';

export interface EnrichedRecord extends NormalisedRecord {
  combinedText: string;
  issues: string[];       // matched taxonomy ids
  primaryIssue: string;  // first matched id
  weekKey: string;
  resolvedArea: string | null;
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

export interface CustomsCompliance {
  totalCases: number;
  customsDocs: number;
  portbaseIssues: number;
  blIssues: number;
  t1Issues: number;
  topOffenders: Array<{ name: string; count: number }>;
}

export interface LoadRefIntelligence {
  totalMissing: number;
  estimatedRework: number;
  topOffenders: Array<{ name: string; count: number }>;
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
  customerBurden: CustomerBurdenItem[];
  transporterPerformance: TransporterItem[];
  customsCompliance: CustomsCompliance;
  loadRefIntelligence: LoadRefIntelligence;
  areaHotspots: AreaHotspot[];
  forecast: Forecast;
  actions: Actions;
  records: EnrichedRecord[];
}
