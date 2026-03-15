import { useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { KpiCard } from '../components/ui/Card';
import { DonutChart, TrendLine } from '../components/ui/ChartWrapper';
import type { AnalysisResult, EnrichedRecord } from '../types/analysis';

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

type Panel = 'overview' | 'categories' | 'bottlenecks' | 'transporters' | 'preventable' | 'rootcauses';

const PANELS: Array<{ id: Panel; label: string }> = [
  { id: 'overview',     label: 'Overview' },
  { id: 'categories',   label: 'Category Intelligence' },
  { id: 'bottlenecks',  label: 'Bottleneck Monitor' },
  { id: 'transporters', label: 'Transporter Performance' },
  { id: 'preventable',  label: 'Preventable Opportunities' },
  { id: 'rootcauses',   label: 'Root Cause Analysis' },
];

interface Props { analysis: AnalysisResult }

// ── Inline case drilldown modal ───────────────────────────────────
interface DrilldownProps {
  title: string;
  records: EnrichedRecord[];
  onClose: () => void;
}

function CaseDrilldown({ title, records, onClose }: DrilldownProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? records : records.slice(0, 15);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,11,17,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-xl shadow-2xl w-full max-w-6xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2f3f] shrink-0">
          <p className="text-sm font-semibold text-[#eceff7]">{title}</p>
          <button onClick={onClose} className="text-[#a6aec4] hover:text-[#eceff7] text-lg px-1">✕</button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs min-w-[960px]">
            <thead className="sticky top-0 bg-[#1d2030] border-b border-[#2a2f3f]">
              <tr>
                {['Case No.', 'Subject', 'Customer', 'Transporter', 'Category', 'Root Cause', 'Preventable', 'Confidence'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-xs font-medium text-[#a6aec4] uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                  <td className="px-3 py-2.5 font-mono text-[#7aa2ff] whitespace-nowrap">{r.case_number ?? '—'}</td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <span className="block truncate text-[#a6aec4]" title={r.subject ?? undefined}>{r.subject ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[120px]">
                    <span className="block truncate text-[#eceff7]" title={r.resolvedCustomer ?? r.customer ?? undefined}>{r.resolvedCustomer ?? r.customer ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[120px]">
                    <span className="block truncate text-[#a6aec4]" title={r.resolvedTransporter ?? r.transporter ?? undefined}>{r.resolvedTransporter ?? r.transporter ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[#eceff7] whitespace-nowrap">{r.primaryIssue}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[#d8a34c]">{r.rootCause ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-center">
                    {r.preventableIssue
                      ? <span className="text-[#52c7c7] font-medium">Yes</span>
                      : <span className="text-[#a6aec4]/50">No</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span style={{ color: r.confidence >= 0.70 ? '#52c7c7' : r.confidence >= 0.50 ? '#d8a34c' : '#dc6d7d' }} className="font-medium">
                      {(r.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#2a2f3f] shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-[#a6aec4]">
            Showing <span className="text-[#eceff7] font-medium">{shown.length}</span> of{' '}
            <span className="text-[#eceff7] font-medium">{records.length}</span> cases
          </p>
          {records.length > 15 && (
            <button onClick={() => setExpanded(x => !x)} className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium">
              {expanded ? 'Show fewer' : `Show all ${records.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export function ControlTowerPage({ analysis }: Props) {
  const [panel, setPanel]   = useState<Panel>('overview');
  const [drill, setDrill]   = useState<{ title: string; records: EnrichedRecord[] } | null>(null);
  const { controlTower, issueBreakdown, records, weeklyHistory, chartWeeks } = analysis;
  const ct = controlTower;

  // Weekly case volume for overview trend
  const weekLineData = chartWeeks.map(wk => ({
    week: wk.replace(/^\d{4}-/, ''),
    Cases: weeklyHistory[wk]?.total ?? 0,
  }));

  const donutData = ct.categoryDistribution
    .filter(c => c.value > 0)
    .slice(0, 8)
    .map(c => ({ name: c.name, value: c.value, color: c.color }));

  function openCategoryDrilldown(issueId: string, label: string) {
    const recs = records
      .filter(r => r.primaryIssue === issueId)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 200);
    setDrill({ title: `${label} — Case Drilldown`, records: recs });
  }

  return (
    <div className="p-8 space-y-6">
      <SectionHeader
        title="Operations Control Tower"
        subtitle={`${analysis.summary.weekRange} · ${ct.totalCases.toLocaleString()} cases · ${analysis.summary.weekCount} weeks`}
      />

      {/* Phase 27 — Validation banner */}
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-medium ${
        ct.validationPassed
          ? 'bg-[#52c7c7]/6 border-[#52c7c7]/20 text-[#52c7c7]'
          : 'bg-[#d8a34c]/6 border-[#d8a34c]/20 text-[#d8a34c]'
      }`}>
        <span>{ct.validationPassed ? '✓' : '⚠'}</span>
        <span>{ct.validationNotes[0]}</span>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1 bg-[#171922] border border-[#2a2f3f] rounded-lg p-1 overflow-x-auto">
        {PANELS.map(p => (
          <button
            key={p.id}
            onClick={() => setPanel(p.id)}
            className={[
              'shrink-0 px-4 py-2 rounded-md text-xs font-medium transition-colors',
              panel === p.id
                ? 'bg-[#8b7cff] text-white'
                : 'text-[#a6aec4] hover:text-[#eceff7] hover:bg-[#1d2030]',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── PANEL: Overview (Phase 21) ── */}
      {panel === 'overview' && (
        <div className="space-y-6">
          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Total Cases"          value={ct.totalCases.toLocaleString()} accent="#8b7cff" />
            <KpiCard label="Preventable Cases"    value={ct.preventableCases.toLocaleString()} accent="#dc6d7d" sub={`${analysis.summary.preventablePct.toFixed(1)}% of workload`} />
            <KpiCard label="Preventable Hours"    value={`${ct.preventableHoursLost.toLocaleString()}h`} accent="#d8a34c" sub="est. hours lost" />
            <KpiCard label="Avg Confidence"       value={`${ct.avgConfidence.toFixed(1)}%`} accent="#52c7c7" />
            <KpiCard label="Low Confidence"       value={`${ct.lowConfidenceRate.toFixed(1)}%`} accent="#7aa2ff" sub="below 70%" />
          </div>

          {/* Category trend indicators */}
          <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
            <p className="text-sm font-medium text-[#eceff7] mb-4">Category Weekly Trend</p>
            <div className="flex flex-wrap gap-2">
              {ct.categoryDistribution.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1d2030] rounded-full border border-[#2a2f3f]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-xs text-[#eceff7]">{c.name}</span>
                  <span className="text-xs font-semibold" style={{ color: TREND_CLR[c.trend] }}>{TREND_ICON[c.trend]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
              <p className="text-sm font-medium text-[#eceff7] mb-4">Category Distribution</p>
              {donutData.length > 0
                ? <DonutChart data={donutData} height={240} />
                : <p className="text-sm text-[#a6aec4] text-center pt-16">No category data</p>}
            </div>
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
              <p className="text-sm font-medium text-[#eceff7] mb-4">Weekly Case Volume</p>
              {weekLineData.length >= 2
                ? <TrendLine data={weekLineData} lines={[{ key: 'Cases', label: 'Cases', color: '#8b7cff' }]} height={240} />
                : <p className="text-sm text-[#a6aec4] text-center pt-16">Insufficient weekly data</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL: Category Intelligence (Phase 22) ── */}
      {panel === 'categories' && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
          <div className="bg-[#1d2030] border-b border-[#2a2f3f] px-5 py-3">
            <p className="text-sm font-semibold text-[#eceff7]">Category Intelligence</p>
            <p className="text-xs text-[#a6aec4] mt-0.5">Per-category metrics with 4-week trend. Click View Cases to inspect individual records.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[#2a2f3f]">
                <tr>
                  {['Category', 'Cases', '% Total', 'Hours Lost', 'Preventable Rate', '4-Wk Trend', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-[#a6aec4] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ct.categoryRows.map(row => (
                  <tr key={row.id} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: row.color }} />
                        <span className="text-[#eceff7] font-medium">{row.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#eceff7] font-semibold">{row.count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#a6aec4]">{row.percent.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-[#d8a34c]">{row.hoursLost.toFixed(0)}h</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${row.preventableRate >= 50 ? 'text-[#dc6d7d]' : row.preventableRate >= 20 ? 'text-[#d8a34c]' : 'text-[#a6aec4]'}`}>
                        {row.preventableRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold" style={{ color: TREND_CLR[row.trend] }}>
                        {TREND_ICON[row.trend]}
                        {row.trendPct !== 0 && ` ${row.trendPct > 0 ? '+' : ''}${row.trendPct}%`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openCategoryDrilldown(row.id, row.label)}
                        className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] hover:underline whitespace-nowrap"
                      >
                        View Cases →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PANEL: Bottleneck Monitor (Phase 23) ── */}
      {panel === 'bottlenecks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#eceff7]">Bottleneck Monitor</p>
            <p className="text-xs text-[#a6aec4]">Week-over-week spikes ≥40% with ≥30 cases</p>
          </div>
          {ct.bottlenecks.length === 0 ? (
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-10 text-center">
              <p className="text-[#52c7c7] font-medium mb-1">No bottlenecks detected</p>
              <p className="text-xs text-[#a6aec4]">No category exceeded the +40% WoW / 30-case threshold.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ct.bottlenecks.map((b, i) => (
                <div key={i} className={`bg-[#171922] border rounded-lg p-5 ${
                  b.spikePercent >= 100 ? 'border-[#dc6d7d]/40' : 'border-[#d8a34c]/30'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm font-semibold text-[#eceff7]">{b.categoryLabel}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      b.spikePercent >= 100 ? 'bg-[#dc6d7d]/15 text-[#dc6d7d]' : 'bg-[#d8a34c]/15 text-[#d8a34c]'
                    }`}>
                      +{b.spikePercent}%
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#eceff7] mb-1">{b.caseCount.toLocaleString()}</p>
                  <p className="text-xs text-[#a6aec4] mb-3">cases in {b.week.replace('-W', ' W')}</p>
                  <div className="flex items-center gap-2 text-xs text-[#a6aec4]">
                    <span className="text-[#dc6d7d] font-medium">↑ spike detected</span>
                    <span>·</span>
                    <span>prior week: {b.priorCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PANEL: Transporter Performance (Phase 24) ── */}
      {panel === 'transporters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#eceff7]">Transporter Risk Signals</p>
            <p className="text-xs text-[#a6aec4]">Comparing recent 4 weeks vs prior 4 weeks · ≥30% increase flagged</p>
          </div>
          {ct.transporterRisks.length === 0 ? (
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-10 text-center">
              <p className="text-[#52c7c7] font-medium mb-1">No transporter risk signals</p>
              <p className="text-xs text-[#a6aec4]">No transporter shows a ≥30% increase in delay, equipment, or amendment rate.</p>
            </div>
          ) : (
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#1d2030] border-b border-[#2a2f3f]">
                  <tr>
                    {['Transporter', 'Cases', 'Delay Rate', 'Equip Rate', 'Amend Rate', 'Preventable', 'Risk Flags', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-[#a6aec4] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ct.transporterRisks.map((t, i) => (
                    <tr key={i} className={`border-b border-[#2a2f3f]/40 hover:bg-[#1d2030] ${
                      t.riskLevel === 'HIGH' ? 'bg-[#dc6d7d]/3' : ''
                    }`}>
                      <td className="px-4 py-3 font-medium text-[#eceff7]">{t.name}</td>
                      <td className="px-4 py-3 text-[#a6aec4]">{t.totalCases}</td>
                      <td className="px-4 py-3">
                        <span className={t.recentDelayRate > t.priorDelayRate * 1.3 ? 'text-[#dc6d7d] font-semibold' : 'text-[#a6aec4]'}>
                          {t.priorDelayRate > 0 ? `${t.priorDelayRate}% → ` : ''}{t.recentDelayRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={t.recentEquipmentRate > t.priorEquipmentRate * 1.3 ? 'text-[#dc6d7d] font-semibold' : 'text-[#a6aec4]'}>
                          {t.priorEquipmentRate > 0 ? `${t.priorEquipmentRate}% → ` : ''}{t.recentEquipmentRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={t.recentAmendmentRate > t.priorAmendmentRate * 1.3 ? 'text-[#dc6d7d] font-semibold' : 'text-[#a6aec4]'}>
                          {t.priorAmendmentRate > 0 ? `${t.priorAmendmentRate}% → ` : ''}{t.recentAmendmentRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#a6aec4]">{t.preventableRate}%</td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {t.riskFlags.map((f, fi) => (
                          <div key={fi} className="text-[#d8a34c] whitespace-nowrap">
                            {f.metric} +{f.changePct}%
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          t.riskLevel === 'HIGH'   ? 'bg-[#dc6d7d]/15 text-[#dc6d7d]' :
                          t.riskLevel === 'MEDIUM' ? 'bg-[#d8a34c]/15 text-[#d8a34c]' :
                                                     'bg-[#52c7c7]/15 text-[#52c7c7]'
                        }`}>{t.riskLevel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PANEL: Preventable Opportunities (Phase 25) ── */}
      {panel === 'preventable' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#eceff7]">Preventable Opportunities</p>
              <p className="text-xs text-[#a6aec4] mt-0.5">
                {ct.preventableCases.toLocaleString()} preventable cases ·{' '}
                {ct.preventableHoursLost.toLocaleString()}h estimated hours lost
              </p>
            </div>
          </div>

          {/* Summary banner */}
          <div className="bg-[#d8a34c]/8 border border-[#d8a34c]/25 rounded-lg px-5 py-4 flex items-center gap-4">
            <span className="text-[#d8a34c] text-2xl">⚡</span>
            <div>
              <p className="text-sm font-semibold text-[#eceff7]">
                {ct.preventableHoursLost.toLocaleString()} estimated hours lost to preventable issues
              </p>
              <p className="text-xs text-[#a6aec4] mt-0.5">
                Resolving these patterns could recover significant operational capacity.
              </p>
            </div>
          </div>

          {/* Opportunity cards */}
          {ct.preventableOpportunities.length === 0 ? (
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-10 text-center">
              <p className="text-[#52c7c7] font-medium">No preventable cases detected in current dataset.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ct.preventableOpportunities.map((op, i) => (
                <div key={i} className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5 hover:border-[#3a3f52] transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#eceff7]">{op.categoryLabel}</p>
                    <span style={{ color: TREND_CLR[op.trend] }} className="text-xs font-bold">{TREND_ICON[op.trend]}</span>
                  </div>
                  <p className="text-2xl font-bold text-[#d8a34c] mb-1">{op.hoursLost.toFixed(0)}h</p>
                  <p className="text-xs text-[#a6aec4] mb-3">estimated hours lost</p>
                  <div className="space-y-1 text-xs text-[#a6aec4]">
                    <div className="flex justify-between">
                      <span>Preventable cases</span>
                      <span className="text-[#eceff7] font-medium">{op.preventableCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total cases</span>
                      <span className="text-[#eceff7]">{op.totalCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Preventable rate</span>
                      <span className={`font-medium ${op.preventableRate >= 80 ? 'text-[#dc6d7d]' : op.preventableRate >= 40 ? 'text-[#d8a34c]' : 'text-[#52c7c7]'}`}>
                        {op.preventableRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PANEL: Root Cause Analysis (Phase 26) ── */}
      {panel === 'rootcauses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#eceff7]">Root Cause Analysis</p>
            <p className="text-xs text-[#a6aec4]">Dominant operational causes · comparing recent vs prior 4-week periods</p>
          </div>

          {ct.rootCauses.length === 0 ? (
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-10 text-center">
              <p className="text-[#a6aec4]">No root cause data available in current dataset.</p>
            </div>
          ) : (
            <>
              {/* Distribution donut */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
                  <p className="text-xs text-[#a6aec4] uppercase tracking-wide font-medium mb-4">Root Cause Distribution</p>
                  <DonutChart
                    data={ct.rootCauses.slice(0, 8).map((rc, i) => ({
                      name: rc.causeLabel,
                      value: rc.count,
                      color: ['#8b7cff', '#dc6d7d', '#52c7c7', '#d8a34c', '#7aa2ff', '#e07b45', '#c46be8', '#a6aec4'][i % 8],
                    }))}
                    height={280}
                  />
                </div>

                {/* Top causes table */}
                <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
                  <div className="bg-[#1d2030] border-b border-[#2a2f3f] px-4 py-3">
                    <p className="text-xs text-[#a6aec4] uppercase tracking-wide font-medium">Cause Breakdown</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="border-b border-[#2a2f3f]">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[10px] text-[#a6aec4] uppercase tracking-wide">Cause</th>
                        <th className="px-4 py-2.5 text-left text-[10px] text-[#a6aec4] uppercase tracking-wide">Count</th>
                        <th className="px-4 py-2.5 text-left text-[10px] text-[#a6aec4] uppercase tracking-wide">%</th>
                        <th className="px-4 py-2.5 text-left text-[10px] text-[#a6aec4] uppercase tracking-wide">4-Wk Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ct.rootCauses.map((rc, i) => (
                        <tr key={i} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                          <td className="px-4 py-2.5 text-[#eceff7] font-medium">{rc.causeLabel}</td>
                          <td className="px-4 py-2.5 text-[#eceff7]">{rc.count.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-[#a6aec4]">{rc.percent.toFixed(1)}%</td>
                          <td className="px-4 py-2.5">
                            <span style={{ color: TREND_CLR[rc.trend] }} className="font-semibold">
                              {TREND_ICON[rc.trend]}
                              {rc.trendPct !== 0 && ` ${rc.trendPct > 0 ? '+' : ''}${rc.trendPct}%`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Case drilldown modal ── */}
      {drill && (
        <CaseDrilldown
          title={drill.title}
          records={drill.records}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
