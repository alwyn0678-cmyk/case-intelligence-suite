import { TAXONOMY_MAP } from './taxonomy';
import type { WeeklySnapshot, Forecast, ForecastIssue, CustomerBurdenItem, TransporterItem } from '../types/analysis';

function weightedAvg(values: number[]): number {
  if (values.length === 0) return 0;
  const weights3 = [0.2, 0.3, 0.5];
  const weights2 = [0.4, 0.6];
  const w = values.length >= 3 ? weights3 : values.length === 2 ? weights2 : [1.0];
  const slice = values.slice(-w.length);
  return slice.reduce((sum, v, i) => sum + v * w[i], 0);
}

function trend2(a: number, b: number): 'up' | 'down' | 'stable' {
  if (b > a * 1.2) return 'up';
  if (b < a * 0.8) return 'down';
  return 'stable';
}

export function buildForecast(
  weeklyHistory: Record<string, WeeklySnapshot>,
  sortedWeeks: string[],
  customerBurden: CustomerBurdenItem[],
  transporterPerformance: TransporterItem[],
): Forecast {
  const EMPTY: Forecast = {
    available: false,
    reason: 'Need at least 2 weeks of dated data to generate a forecast.',
    nextWeekVolume: 0,
    volumeTrend: 'stable',
    confidence: 'LOW',
    weeksAnalyzed: sortedWeeks.length,
    topIssues: [],
    risingRisk: [],
    riskyCustomers: [],
    riskyTransporters: [],
    hotspots: [],
    actions: [],
  };

  if (sortedWeeks.length < 2) return EMPTY;

  const recentWeeks = sortedWeeks.slice(-3);

  // ── Volume forecast ──
  const volumes = recentWeeks.map(w => weeklyHistory[w].total);
  const nextWeekVolume = Math.round(weightedAvg(volumes));
  const lastVol = volumes[volumes.length - 1];
  const prevVol = volumes[volumes.length - 2];
  const volumeTrend = trend2(prevVol, lastVol);

  // ── Confidence ──
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (sortedWeeks.length >= 4) {
    const vols = sortedWeeks.map(w => weeklyHistory[w].total);
    const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
    const cv = avg > 0 ? Math.sqrt(vols.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vols.length) / avg : 1;
    confidence = cv < 0.2 ? 'HIGH' : cv < 0.4 ? 'MEDIUM' : 'LOW';
  } else if (sortedWeeks.length >= 3) {
    confidence = 'MEDIUM';
  }

  // ── Issue forecast ──
  const issueData: Record<string, number[]> = {};
  for (const wk of recentWeeks) {
    const issues = weeklyHistory[wk].issues;
    for (const [id, count] of Object.entries(issues)) {
      if (!issueData[id]) issueData[id] = [];
      issueData[id].push(count);
    }
  }

  const topIssues: ForecastIssue[] = Object.entries(issueData)
    .map(([id, vals]) => {
      const forecasted = Math.round(weightedAvg(vals));
      const last = vals[vals.length - 1];
      const prev = vals.length >= 2 ? vals[vals.length - 2] : last;
      const trend = trend2(prev, last);
      const tax = TAXONOMY_MAP[id];
      return { id, label: tax?.label ?? id, color: tax?.color ?? '#a6aec4', forecasted, trend };
    })
    .sort((a, b) => b.forecasted - a.forecasted)
    .slice(0, 8);

  const risingRisk = topIssues.filter(i => i.trend === 'up').slice(0, 5);

  // ── Customer risk ──
  const riskyCustomers = customerBurden
    .filter(c => c.trend === 'up' || c.risk === 'HIGH')
    .slice(0, 6)
    .map(c => ({
      name: c.name,
      recentCount: c.weekCounts[sortedWeeks[sortedWeeks.length - 1]] ?? 0,
      trend: c.trend,
      risk: c.risk,
    }));

  // ── Transporter risk ──
  const riskyTransporters = transporterPerformance
    .filter(t => t.punctualityScore > 30 || t.risk === 'HIGH')
    .slice(0, 5)
    .map(t => ({ name: t.name, delayRate: t.punctualityScore, risk: t.risk }));

  // ── Area hotspots ──
  const areaData: Record<string, number[]> = {};
  for (const wk of recentWeeks) {
    const areas = weeklyHistory[wk].areas;
    for (const [area, count] of Object.entries(areas)) {
      if (!areaData[area]) areaData[area] = [];
      areaData[area].push(count);
    }
  }
  const hotspots = Object.entries(areaData)
    .map(([name, vals]) => {
      const forecasted = Math.round(weightedAvg(vals));
      const last = vals[vals.length - 1];
      const prev = vals.length >= 2 ? vals[vals.length - 2] : last;
      return { name, forecasted, trend: trend2(prev, last) };
    })
    .sort((a, b) => b.forecasted - a.forecasted)
    .slice(0, 6);

  // ── Pre-emptive actions ──
  const actions: string[] = [];
  if (risingRisk.some(r => r.id === 'load_ref')) actions.push('Send load reference reminder to top accounts before week start.');
  if (risingRisk.some(r => r.id === 'customs')) actions.push('Distribute customs document checklist proactively to at-risk accounts.');
  if (risingRisk.some(r => r.id === 'closing_time')) actions.push('Publish cutoff schedule at start of week — share with all active shippers.');
  if (risingRisk.some(r => r.id === 'delay')) actions.push('Confirm transporter ETAs before week start — flag schedule gaps early.');
  if (risingRisk.some(r => r.id === 't1')) actions.push('Verify T1 documents are in order for all transit shipments this week.');
  if (risingRisk.some(r => r.id === 'portbase')) actions.push('Check Portbase pre-notifications are complete for all port arrivals this week.');
  if (riskyTransporters.length > 0) actions.push(`Monitor ${riskyTransporters[0].name} closely — elevated delay pattern detected.`);
  if (riskyCustomers.length > 0) actions.push(`Proactively contact ${riskyCustomers[0].name} — high case volume trend continuing.`);
  if (actions.length === 0) actions.push('No specific pre-emptive actions required — pattern is stable.');

  return {
    available: true,
    nextWeekVolume,
    volumeTrend,
    confidence,
    weeksAnalyzed: sortedWeeks.length,
    topIssues,
    risingRisk,
    riskyCustomers,
    riskyTransporters,
    hotspots,
    actions,
  };
}
