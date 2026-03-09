import * as XLSX from 'xlsx';
import type { AnalysisResult } from '../types/analysis';

function sheet(rows: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

export function exportToExcel(analysis: AnalysisResult): void {
  const wb = XLSX.utils.book_new();
  const { summary, issueBreakdown, customerBurden, transporterPerformance,
          customsCompliance: cc, loadRefIntelligence: lr, areaHotspots, forecast, actions } = analysis;

  // Sheet 1: Summary
  XLSX.utils.book_append_sheet(wb, sheet([
    ['Case Intelligence Suite — Executive Summary'],
    ['Generated', new Date().toLocaleDateString('en-GB')],
    [''],
    ['Period', summary.weekRange],
    ['Weeks Analysed', summary.weekCount],
    ['Total Cases', summary.totalCases],
    ['Total Hours Lost', summary.totalHoursLost.toFixed(1)],
    ['Preventable Workload %', `${summary.preventablePct.toFixed(1)}%`],
    ['Top Issue', `${summary.topIssue} (${summary.topIssueCount} cases)`],
    ['Top Customer', `${summary.topCustomer} (${summary.topCustomerCount} cases)`],
    ['Top Area', `${summary.topArea} (${summary.topAreaCount} cases)`],
    [''],
    ['Quick Win', summary.quickWin],
    [''],
    ['Narrative'],
    [summary.narrative],
  ]), 'Summary');

  // Sheet 2: Issue Breakdown
  XLSX.utils.book_append_sheet(wb, sheet([
    ['#', 'Category', 'Cases', '% of Total', 'Est. Hours Lost', 'Preventable', 'Trend'],
    ...issueBreakdown.map((i, n) => [n + 1, i.label, i.count, `${i.percent.toFixed(1)}%`, i.hoursLost.toFixed(1), i.preventable ? 'Yes' : 'No', i.trend]),
  ]), 'Issue Breakdown');

  // Sheet 3: Customer Burden
  XLSX.utils.book_append_sheet(wb, sheet([
    ['#', 'Customer', 'Cases', 'Hours Lost', 'Preventable %', 'Missing Load Ref', 'Missing Customs Docs', 'Amendments', 'Delays', 'Top Issue', 'Trend', 'Risk'],
    ...customerBurden.map((c, n) => [n + 1, c.name, c.count, c.hoursLost.toFixed(1), `${c.preventablePct.toFixed(1)}%`, c.missingLoadRef, c.missingCustomsDocs, c.amendments, c.delays, c.topIssue, c.trend, c.risk]),
  ]), 'Customer Burden');

  // Sheet 4: Transporter Performance
  XLSX.utils.book_append_sheet(wb, sheet([
    ['#', 'Transporter', 'Total Cases', 'Delays', 'Not On Time', 'Waiting Time', 'Punctuality Issue Rate', 'Trend', 'Risk'],
    ...transporterPerformance.map((t, n) => [n + 1, t.name, t.count, t.delays, t.notOnTime, t.waitingTime, `${t.punctualityScore.toFixed(1)}%`, t.trend, t.risk]),
  ]), 'Transporter Performance');

  // Sheet 5: Customs
  XLSX.utils.book_append_sheet(wb, sheet([
    ['Customs & Compliance Intelligence'],
    [''],
    ['Category', 'Cases'],
    ['Total Compliance Cases', cc.totalCases],
    ['Customs Documentation Issues', cc.customsDocs],
    ['Portbase Issues', cc.portbaseIssues],
    ['Bill of Lading Issues', cc.blIssues],
    ['T1 / Transit Issues', cc.t1Issues],
    [''],
    ['Top Compliance Offenders'],
    ['Customer', 'Cases'],
    ...cc.topOffenders.map(o => [o.name, o.count]),
  ]), 'Customs & Compliance');

  // Sheet 6: Load References
  XLSX.utils.book_append_sheet(wb, sheet([
    ['Load Reference Intelligence'],
    [''],
    ['Total Missing References', lr.totalMissing],
    ['Estimated Rework Hours', lr.estimatedRework.toFixed(1)],
    [''],
    ['Customer', 'Missing Refs'],
    ...lr.topOffenders.map(o => [o.name, o.count]),
  ]), 'Load References');

  // Sheet 7: Area Hotspots
  XLSX.utils.book_append_sheet(wb, sheet([
    ['#', 'Area', 'Cases', 'Hours Lost', 'Top Issue', 'Trend'],
    ...areaHotspots.map((a, n) => [n + 1, a.name, a.count, a.hoursLost.toFixed(1), a.topIssue, a.trend]),
  ]), 'Area Hotspots');

  // Sheet 8: Predictive Intelligence
  if (forecast.available) {
    XLSX.utils.book_append_sheet(wb, sheet([
      ['Predictive Intelligence — Next Week Forecast'],
      ['Confidence', forecast.confidence],
      ['Weeks Analysed', forecast.weeksAnalyzed],
      ['Forecast Volume', forecast.nextWeekVolume],
      ['Volume Trend', forecast.volumeTrend],
      [''],
      ['Top Predicted Issues'],
      ['Issue', 'Forecasted Cases', 'Trend'],
      ...forecast.topIssues.map(i => [i.label, i.forecasted, i.trend]),
      [''],
      ['Rising Risk Categories'],
      ...forecast.risingRisk.map(r => [r.label, r.forecasted]),
      [''],
      ['Pre-emptive Actions'],
      ...forecast.actions.map(a => [a]),
    ]), 'Predictive Intelligence');
  }

  // Sheet 9: Action Register
  XLSX.utils.book_append_sheet(wb, sheet([
    ['Type', 'Action', 'Priority', 'Target'],
    ...actions.quickWins.map(w           => ['Quick Win',              w,         'HIGH',   '']),
    ...actions.structuralFixes.map(f     => ['Structural Fix',         f,         'MEDIUM', '']),
    ...actions.customerInterventions.map(c => ['Customer Intervention', c.action, 'HIGH',   c.customer]),
    ...actions.transporterEscalations.map(t => ['Transporter Escalation', t.action, 'HIGH', t.transporter]),
    ...actions.automationOpportunities.map(o => ['Automation',          o,         'MEDIUM', '']),
    ...actions.complianceControls.map(c  => ['Compliance Control',     c,         'MEDIUM', '']),
  ]), 'Action Register');

  XLSX.writeFile(wb, `CaseIntelligence_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
