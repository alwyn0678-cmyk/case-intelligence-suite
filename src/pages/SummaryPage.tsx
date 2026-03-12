import { SectionHeader } from '../components/ui/SectionHeader';
import { KpiCard } from '../components/ui/Card';
import { DonutChart, TrendLine } from '../components/ui/ChartWrapper';
import type { AnalysisResult } from '../types/analysis';

function trendArrow(a: number, b: number) {
  if (b > a * 1.1) return { icon: '↑', color: '#dc6d7d' };
  if (b < a * 0.9) return { icon: '↓', color: '#52c7c7' };
  return { icon: '→', color: '#a6aec4' };
}

interface Props { analysis: AnalysisResult }

export function SummaryPage({ analysis }: Props) {
  const { summary, issueBreakdown, weeklyHistory, sortedWeeks, isrVsExternal } = analysis;

  const donutData = issueBreakdown.slice(0, 8).map(i => ({
    name: i.label, value: i.count, color: i.color,
  }));

  const weekLineData = sortedWeeks.map(wk => ({
    week: wk.replace(/^\d{4}-/, ''),
    Cases: weeklyHistory[wk]?.total ?? 0,
  }));

  return (
    <div className="p-8 space-y-8">
      <SectionHeader
        title="Executive Summary"
        subtitle={`${summary.weekRange} · ${summary.weekCount} week${summary.weekCount !== 1 ? 's' : ''} · ${summary.totalCases.toLocaleString()} cases`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Cases"    value={summary.totalCases.toLocaleString()} accent="#8b7cff" />
        <KpiCard label="Hours Lost"     value={`${summary.totalHoursLost.toFixed(0)}h`} accent="#dc6d7d" />
        <KpiCard label="Preventable"    value={`${summary.preventablePct.toFixed(1)}%`} accent="#d8a34c" sub="of workload" />
        <KpiCard label="Top Issue"      value={summary.topIssueCount.toLocaleString()} sub={summary.topIssue} accent="#7aa2ff" />
        <KpiCard label="Top Customer"   value={summary.topCustomerCount.toLocaleString()} sub={summary.topCustomer} accent="#52c7c7" />
        <KpiCard label="Top Transporter" value={summary.topTransporterDelays > 0 ? `${summary.topTransporterDelays} delays` : '—'} sub={summary.topTransporter} accent="#dc6d7d" />
      </div>

      {/* Narrative */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
        <p className="text-xs text-[#a6aec4] uppercase tracking-wider font-medium mb-2">Intelligence Narrative</p>
        <p className="text-sm text-[#eceff7] leading-relaxed">{summary.narrative}</p>
      </div>

      {/* Quick win */}
      <div className="bg-[#d8a34c]/8 border border-[#d8a34c]/25 rounded-lg p-4 flex gap-3">
        <span className="text-[#d8a34c] text-lg mt-0.5">⚡</span>
        <div>
          <p className="text-xs text-[#d8a34c] font-semibold uppercase tracking-wide mb-1">Biggest Quick Win</p>
          <p className="text-sm text-[#eceff7]">{summary.quickWin}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Issue Distribution</p>
          <DonutChart data={donutData} height={240} />
        </div>
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Weekly Case Volume</p>
          {weekLineData.length >= 2
            ? <TrendLine data={weekLineData} lines={[{ key: 'Cases', label: 'Cases', color: '#8b7cff' }]} height={240} />
            : <p className="text-sm text-[#a6aec4] text-center pt-16">Insufficient weekly data — need 2+ weeks with dates</p>
          }
        </div>
      </div>

      {/* ISR vs External */}
      {(isrVsExternal.totalIsr > 0 || isrVsExternal.totalExternal > 0) && (() => {
        const wkData = isrVsExternal.weeklyBreakdown.map(w => ({
          week: w.week.replace(/^\d{4}-/, ''),
          External: w.external,
          ISR: w.isr,
        }));
        const lastTwo = isrVsExternal.weeklyBreakdown.slice(-2);
        const isrTrend = lastTwo.length === 2 ? trendArrow(lastTwo[0].isrPct, lastTwo[1].isrPct) : null;
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#eceff7]">ISR vs External Case Split</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-4">
                <p className="text-xs text-[#a6aec4] uppercase tracking-wider">External Cases</p>
                <p className="text-2xl font-semibold text-[#52c7c7] mt-1">{isrVsExternal.totalExternal.toLocaleString()}</p>
                <p className="text-xs text-[#a6aec4] mt-1">{isrVsExternal.externalPct.toFixed(1)}% of total</p>
              </div>
              <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-4">
                <p className="text-xs text-[#a6aec4] uppercase tracking-wider">ISR Internal Cases</p>
                <p className="text-2xl font-semibold text-[#8b7cff] mt-1">{isrVsExternal.totalIsr.toLocaleString()}</p>
                <p className="text-xs text-[#a6aec4] mt-1">{isrVsExternal.isrPct.toFixed(1)}% of total</p>
              </div>
              {isrTrend && (
                <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-4">
                  <p className="text-xs text-[#a6aec4] uppercase tracking-wider">ISR % — WoW</p>
                  <p className="text-2xl font-semibold mt-1" style={{ color: isrTrend.color }}>
                    {isrTrend.icon} {lastTwo[1].isrPct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-[#a6aec4] mt-1">vs {lastTwo[0].isrPct.toFixed(1)}% prior week</p>
                </div>
              )}
            </div>
            {wkData.length >= 2 && (
              <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
                <p className="text-xs text-[#a6aec4] uppercase tracking-wider font-medium mb-4">Weekly External vs ISR Volume</p>
                <TrendLine
                  data={wkData}
                  lines={[
                    { key: 'External', label: 'External', color: '#52c7c7' },
                    { key: 'ISR',      label: 'ISR Internal', color: '#8b7cff' },
                  ]}
                  height={200}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Data quality */}
      {(summary.reviewFlagCount > 0 || summary.unknownEntityCount > 0 || (summary.unknownCustomerCount ?? 0) > 0) && (
        <div className="grid grid-cols-3 gap-4">
          {summary.reviewFlagCount > 0 && (
            <div className="bg-[#dc6d7d]/6 border border-[#dc6d7d]/20 rounded-lg p-4">
              <p className="text-xs text-[#dc6d7d] font-semibold uppercase tracking-wide mb-1">Review Flags</p>
              <p className="text-2xl font-semibold text-[#dc6d7d]">{summary.reviewFlagCount.toLocaleString()}</p>
              <p className="text-xs text-[#a6aec4] mt-1">Low-confidence classifications — check Case Explorer</p>
            </div>
          )}
          {summary.unknownEntityCount > 0 && (
            <div className="bg-[#d8a34c]/6 border border-[#d8a34c]/20 rounded-lg p-4">
              <p className="text-xs text-[#d8a34c] font-semibold uppercase tracking-wide mb-1">Unknown Entities</p>
              <p className="text-2xl font-semibold text-[#d8a34c]">{summary.unknownEntityCount.toLocaleString()}</p>
              <p className="text-xs text-[#a6aec4] mt-1">Logistics names not in reference dictionary</p>
            </div>
          )}
          {(summary.unknownCustomerCount ?? 0) > 0 && (
            <div className="bg-[#d8a34c]/6 border border-[#d8a34c]/20 rounded-lg p-4">
              <p className="text-xs text-[#d8a34c] font-semibold uppercase tracking-wide mb-1">Unresolved Customers</p>
              <p className="text-2xl font-semibold text-[#d8a34c]">{(summary.unknownCustomerCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-[#a6aec4] mt-1">Cases with no identifiable customer — see Customer page</p>
            </div>
          )}
        </div>
      )}

      {/* Forecast headline */}
      {analysis.forecast.available && (
        <div className="bg-[#8b7cff]/8 border border-[#8b7cff]/25 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8b7cff] font-semibold uppercase tracking-wide mb-1">Next Week Forecast</p>
            <p className="text-sm text-[#eceff7]">
              Estimated <span className="text-[#8b7cff] font-semibold">{analysis.forecast.nextWeekVolume.toLocaleString()}</span> cases —
              top predicted issue: <span className="text-[#eceff7] font-medium">{analysis.forecast.topIssues[0]?.label ?? '—'}</span>
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded border font-medium ${
            analysis.forecast.confidence === 'HIGH'   ? 'text-[#52c7c7] bg-[#52c7c7]/10 border-[#52c7c7]/30' :
            analysis.forecast.confidence === 'MEDIUM' ? 'text-[#d8a34c] bg-[#d8a34c]/10 border-[#d8a34c]/30' :
                                                        'text-[#a6aec4] bg-[#a6aec4]/10 border-[#a6aec4]/30'
          }`}>{analysis.forecast.confidence} confidence</span>
        </div>
      )}
    </div>
  );
}
