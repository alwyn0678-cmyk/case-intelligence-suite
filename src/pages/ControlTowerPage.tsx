import { useState, useMemo } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { KpiCard } from '../components/ui/Card';
import { DonutChart, TrendLine } from '../components/ui/ChartWrapper';
import type { AnalysisResult, EnrichedRecord, CtSeverity } from '../types/analysis';

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };
const SEV_CLR: Record<CtSeverity, string> = { HIGH: '#dc6d7d', MEDIUM: '#d8a34c', LOW: '#7aa2ff' };

type Panel = 'overview' | 'categories' | 'bottlenecks' | 'transporters' | 'preventable' | 'rootcauses' | 'alerts' | 'investigation' | 'forecast';

const PANELS: Array<{ id: Panel; label: string }> = [
  { id: 'overview',       label: 'Overview' },
  { id: 'categories',     label: 'Category Intelligence' },
  { id: 'bottlenecks',    label: 'Bottleneck Monitor' },
  { id: 'transporters',   label: 'Transporter Performance' },
  { id: 'preventable',    label: 'Preventable Opportunities' },
  { id: 'rootcauses',     label: 'Root Cause Analysis' },
  { id: 'alerts',         label: 'Operational Alerts' },
  { id: 'investigation',  label: 'Case Investigation' },
  { id: 'forecast',       label: 'Trend Forecast' },
];

interface Props { analysis: AnalysisResult }

// ── Phase 29: Case investigation panel ───────────────────────────
interface InvestigationProps {
  records: EnrichedRecord[];
  categories: string[];
  transporters: string[];
  rootCauses: string[];
  weeks: string[];
}

function InvestigationPanel({ records, categories, transporters, rootCauses, weeks }: InvestigationProps) {
  const [filterCategory,    setFilterCategory]    = useState('');
  const [filterTransporter, setFilterTransporter] = useState('');
  const [filterRootCause,   setFilterRootCause]   = useState('');
  const [filterPreventable, setFilterPreventable] = useState<'all' | 'yes' | 'no'>('all');
  const [filterWeekFrom,    setFilterWeekFrom]    = useState('');
  const [filterWeekTo,      setFilterWeekTo]      = useState('');
  const [sortBy,            setSortBy]            = useState<'date' | 'confidence' | 'transporter'>('date');
  const [expanded,          setExpanded]          = useState(false);

  const filtered = useMemo(() => {
    let recs = records;
    if (filterCategory)    recs = recs.filter(r => r.primaryIssue === filterCategory);
    if (filterTransporter) recs = recs.filter(r => (r.resolvedTransporter ?? '') === filterTransporter);
    if (filterRootCause)   recs = recs.filter(r => (r.rootCause ?? '') === filterRootCause);
    if (filterPreventable === 'yes') recs = recs.filter(r => r.preventableIssue);
    if (filterPreventable === 'no')  recs = recs.filter(r => !r.preventableIssue);
    if (filterWeekFrom)    recs = recs.filter(r => r.weekKey >= filterWeekFrom);
    if (filterWeekTo)      recs = recs.filter(r => r.weekKey <= filterWeekTo);
    const sorted = [...recs];
    if (sortBy === 'date')        sorted.sort((a, z) => (z.date instanceof Date ? z.date.getTime() : 0) - (a.date instanceof Date ? a.date.getTime() : 0));
    if (sortBy === 'confidence')  sorted.sort((a, z) => z.confidence - a.confidence);
    if (sortBy === 'transporter') sorted.sort((a, z) => (a.resolvedTransporter ?? '').localeCompare(z.resolvedTransporter ?? ''));
    return sorted;
  }, [records, filterCategory, filterTransporter, filterRootCause, filterPreventable, filterWeekFrom, filterWeekTo, sortBy]);

  const preventableCount = filtered.filter(r => r.preventableIssue).length;
  const avgConf = filtered.length > 0 ? filtered.reduce((s, r) => s + r.confidence, 0) / filtered.length : 0;
  const shown = expanded ? filtered : filtered.slice(0, 20);

  const selClass = 'bg-[#1d2030] border border-[#2a2f3f] rounded-md text-xs text-[#eceff7] px-2.5 py-1.5 focus:outline-none focus:border-[#8b7cff]/50';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-4">
        <p className="text-xs text-[#a6aec4] uppercase tracking-wide font-medium mb-3">Filters</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selClass}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterTransporter} onChange={e => setFilterTransporter(e.target.value)} className={selClass}>
            <option value="">All Transporters</option>
            {transporters.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterRootCause} onChange={e => setFilterRootCause(e.target.value)} className={selClass}>
            <option value="">All Root Causes</option>
            {rootCauses.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterPreventable} onChange={e => setFilterPreventable(e.target.value as 'all' | 'yes' | 'no')} className={selClass}>
            <option value="all">Preventable: All</option>
            <option value="yes">Preventable: Yes</option>
            <option value="no">Preventable: No</option>
          </select>
          <select value={filterWeekFrom} onChange={e => setFilterWeekFrom(e.target.value)} className={selClass}>
            <option value="">Week From</option>
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={filterWeekTo} onChange={e => setFilterWeekTo(e.target.value)} className={selClass}>
            <option value="">Week To</option>
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg px-4 py-3">
          <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide mb-1">Cases Matching</p>
          <p className="text-2xl font-bold text-[#eceff7]">{filtered.length.toLocaleString()}</p>
        </div>
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg px-4 py-3">
          <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide mb-1">Preventable Rate</p>
          <p className="text-2xl font-bold text-[#d8a34c]">
            {filtered.length > 0 ? ((preventableCount / filtered.length) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg px-4 py-3">
          <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide mb-1">Avg Confidence</p>
          <p className="text-2xl font-bold text-[#52c7c7]">{(avgConf * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Sort + count row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#a6aec4]">
          Showing <span className="text-[#eceff7] font-medium">{shown.length}</span> of{' '}
          <span className="text-[#eceff7] font-medium">{filtered.length}</span> cases
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#a6aec4]">Sort:</span>
          {(['date', 'confidence', 'transporter'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${sortBy === s ? 'bg-[#8b7cff]/15 border-[#8b7cff]/40 text-[#8b7cff]' : 'border-[#2a2f3f] text-[#a6aec4] hover:text-[#eceff7]'}`}>
              {s === 'date' ? 'Newest' : s === 'confidence' ? 'Confidence' : 'Transporter'}
            </button>
          ))}
        </div>
      </div>

      {/* Case table */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[960px]">
            <thead className="bg-[#1d2030] border-b border-[#2a2f3f]">
              <tr>
                {['Case No.', 'Subject', 'Customer', 'Transporter', 'Category', 'Root Cause', 'Preventable', 'Week', 'Confidence'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-medium text-[#a6aec4] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-[#a6aec4] text-sm">No cases match the current filters.</td></tr>
              ) : shown.map((r, i) => (
                <tr key={i} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                  <td className="px-3 py-2.5 font-mono text-[#7aa2ff] whitespace-nowrap">{r.case_number ?? '—'}</td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <span className="block truncate text-[#a6aec4]" title={r.subject ?? undefined}>{r.subject ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[110px]">
                    <span className="block truncate text-[#eceff7]" title={r.resolvedCustomer ?? r.customer ?? undefined}>{r.resolvedCustomer ?? r.customer ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[110px]">
                    <span className="block truncate text-[#a6aec4]" title={r.resolvedTransporter ?? r.transporter ?? undefined}>{r.resolvedTransporter ?? r.transporter ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[#eceff7] whitespace-nowrap">{r.primaryIssue}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#d8a34c]">{r.rootCause ?? '—'}</td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {r.preventableIssue
                      ? <span className="text-[#52c7c7] font-medium">Yes</span>
                      : <span className="text-[#a6aec4]/40">No</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[#a6aec4] whitespace-nowrap font-mono text-[10px]">{r.weekKey}</td>
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
        {filtered.length > 20 && (
          <div className="px-4 py-3 border-t border-[#2a2f3f] flex justify-center">
            <button onClick={() => setExpanded(x => !x)} className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium">
              {expanded ? 'Show fewer' : `Show all ${filtered.length.toLocaleString()} cases`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline category drilldown modal ──────────────────────────────
function CaseDrilldown({ title, records, onClose }: { title: string; records: EnrichedRecord[]; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? records : records.slice(0, 15);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,11,17,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
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
                  <td className="px-3 py-2.5 max-w-[220px]"><span className="block truncate text-[#a6aec4]" title={r.subject ?? undefined}>{r.subject ?? '—'}</span></td>
                  <td className="px-3 py-2.5 max-w-[120px]"><span className="block truncate text-[#eceff7]">{r.resolvedCustomer ?? r.customer ?? '—'}</span></td>
                  <td className="px-3 py-2.5 max-w-[120px]"><span className="block truncate text-[#a6aec4]">{r.resolvedTransporter ?? r.transporter ?? '—'}</span></td>
                  <td className="px-3 py-2.5 text-[#eceff7] whitespace-nowrap">{r.primaryIssue}</td>
                  <td className="px-3 py-2.5 text-[#d8a34c] whitespace-nowrap">{r.rootCause ?? '—'}</td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">{r.preventableIssue ? <span className="text-[#52c7c7] font-medium">Yes</span> : <span className="text-[#a6aec4]/40">No</span>}</td>
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
          <p className="text-xs text-[#a6aec4]">Showing <span className="text-[#eceff7] font-medium">{shown.length}</span> of <span className="text-[#eceff7] font-medium">{records.length}</span> cases</p>
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
  const [panel, setPanel] = useState<Panel>('overview');
  const [drill, setDrill] = useState<{ title: string; records: EnrichedRecord[] } | null>(null);
  const { controlTower, records, weeklyHistory, chartWeeks, sortedWeeks } = analysis;
  const ct = controlTower;

  // Pre-compute filter options for investigation panel
  const invCategories = useMemo(() =>
    [...new Set(records.map(r => r.primaryIssue).filter(Boolean))].sort(), [records]);
  const invTransporters = useMemo(() =>
    [...new Set(records.map(r => r.resolvedTransporter ?? '').filter(Boolean))].sort(), [records]);
  const invRootCauses = useMemo(() =>
    [...new Set(records.map(r => r.rootCause ?? '').filter(Boolean))].sort(), [records]);

  const weekLineData = chartWeeks.map(wk => ({
    week: wk.replace(/^\d{4}-/, ''),
    Cases: weeklyHistory[wk]?.total ?? 0,
  }));

  const donutData = ct.categoryDistribution
    .filter(c => c.value > 0).slice(0, 8)
    .map(c => ({ name: c.name, value: c.value, color: c.color }));

  function openCategoryDrilldown(issueId: string, label: string) {
    const recs = records.filter(r => r.primaryIssue === issueId)
      .sort((a, b) => b.confidence - a.confidence).slice(0, 300);
    setDrill({ title: `${label} — Case Drilldown`, records: recs });
  }

  const alertCount = ct.alerts.length;
  const highAlerts = ct.alerts.filter(a => a.severity === 'HIGH').length;

  return (
    <div className="p-8 space-y-6">
      <SectionHeader
        title="Operations Control Tower"
        subtitle={`${analysis.summary.weekRange || 'No date range'} · ${ct.totalCases.toLocaleString()} cases · ${analysis.summary.weekCount} week${analysis.summary.weekCount !== 1 ? 's' : ''}`}
      />

      {/* Phase 27 — Validation banner */}
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-medium ${
        ct.validationPassed ? 'bg-[#52c7c7]/6 border-[#52c7c7]/20 text-[#52c7c7]' : 'bg-[#d8a34c]/6 border-[#d8a34c]/20 text-[#d8a34c]'
      }`}>
        <span>{ct.validationPassed ? '✓' : '⚠'}</span>
        <span>{ct.validationNotes[0]}</span>
      </div>

      {/* Phase 31 — Risk summary cards (always visible) */}
      {(ct.riskSummary.highestDelayTransporter || ct.riskSummary.largestPreventableCategory ||
        ct.riskSummary.fastestGrowingCategory || ct.riskSummary.mostFrequentRootCause) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ct.riskSummary.highestDelayTransporter && (
            <div className="bg-[#dc6d7d]/6 border border-[#dc6d7d]/20 rounded-lg p-4">
              <p className="text-[10px] text-[#dc6d7d] uppercase tracking-wide font-semibold mb-2">Highest Delay Risk</p>
              <p className="text-sm font-bold text-[#eceff7] leading-tight mb-1">{ct.riskSummary.highestDelayTransporter.name}</p>
              <p className="text-xs text-[#a6aec4]">
                {ct.riskSummary.highestDelayTransporter.delayRate}% delay rate
                {ct.riskSummary.highestDelayTransporter.changePct > 0 && (
                  <span className="text-[#dc6d7d] ml-1">↑ +{ct.riskSummary.highestDelayTransporter.changePct}%</span>
                )}
              </p>
            </div>
          )}
          {ct.riskSummary.largestPreventableCategory && (
            <div className="bg-[#d8a34c]/6 border border-[#d8a34c]/20 rounded-lg p-4">
              <p className="text-[10px] text-[#d8a34c] uppercase tracking-wide font-semibold mb-2">Largest Preventable Loss</p>
              <p className="text-sm font-bold text-[#eceff7] leading-tight mb-1">{ct.riskSummary.largestPreventableCategory.label}</p>
              <p className="text-xs text-[#a6aec4]">
                {ct.riskSummary.largestPreventableCategory.hoursLost}h lost ·{' '}
                {ct.riskSummary.largestPreventableCategory.count} cases
              </p>
            </div>
          )}
          {ct.riskSummary.fastestGrowingCategory && (
            <div className="bg-[#dc6d7d]/6 border border-[#dc6d7d]/20 rounded-lg p-4">
              <p className="text-[10px] text-[#dc6d7d] uppercase tracking-wide font-semibold mb-2">Fastest Growing Category</p>
              <p className="text-sm font-bold text-[#eceff7] leading-tight mb-1">{ct.riskSummary.fastestGrowingCategory.label}</p>
              <p className="text-xs text-[#a6aec4]">
                <span className="text-[#dc6d7d]">↑ +{ct.riskSummary.fastestGrowingCategory.trendPct}%</span>
                {' '}4-week trend · {ct.riskSummary.fastestGrowingCategory.count} cases
              </p>
            </div>
          )}
          {ct.riskSummary.mostFrequentRootCause && (
            <div className="bg-[#8b7cff]/6 border border-[#8b7cff]/20 rounded-lg p-4">
              <p className="text-[10px] text-[#8b7cff] uppercase tracking-wide font-semibold mb-2">Top Root Cause</p>
              <p className="text-sm font-bold text-[#eceff7] leading-tight mb-1">{ct.riskSummary.mostFrequentRootCause.label}</p>
              <p className="text-xs text-[#a6aec4]">
                {ct.riskSummary.mostFrequentRootCause.count.toLocaleString()} cases ·{' '}
                {ct.riskSummary.mostFrequentRootCause.percent}% of total
              </p>
            </div>
          )}
        </div>
      )}

      {/* Panel tabs */}
      <div className="flex gap-1 bg-[#171922] border border-[#2a2f3f] rounded-lg p-1 overflow-x-auto">
        {PANELS.map(p => (
          <button key={p.id} onClick={() => setPanel(p.id)}
            className={[
              'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              panel === p.id ? 'bg-[#8b7cff] text-white' : 'text-[#a6aec4] hover:text-[#eceff7] hover:bg-[#1d2030]',
            ].join(' ')}>
            {p.label}
            {p.id === 'alerts' && alertCount > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                highAlerts > 0 ? 'bg-[#dc6d7d]/30 text-[#dc6d7d]' : 'bg-[#d8a34c]/30 text-[#d8a34c]'
              }`}>{alertCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── PANEL: Overview ── */}
      {panel === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Total Cases"       value={ct.totalCases.toLocaleString()} accent="#8b7cff" />
            <KpiCard label="Preventable Cases" value={ct.preventableCases.toLocaleString()} accent="#dc6d7d" sub={`${analysis.summary.preventablePct.toFixed(1)}% of workload`} />
            <KpiCard label="Preventable Hours" value={`${ct.preventableHoursLost.toLocaleString()}h`} accent="#d8a34c" sub="est. hours lost" />
            <KpiCard label="Avg Confidence"    value={`${ct.avgConfidence.toFixed(1)}%`} accent="#52c7c7" />
            <KpiCard label="Low Confidence"    value={`${ct.lowConfidenceRate.toFixed(1)}%`} accent="#7aa2ff" sub="below 70%" />
          </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
              <p className="text-sm font-medium text-[#eceff7] mb-4">Category Distribution</p>
              {donutData.length > 0 ? <DonutChart data={donutData} height={240} /> : <p className="text-sm text-[#a6aec4] text-center pt-16">No category data</p>}
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

      {/* ── PANEL: Category Intelligence ── */}
      {panel === 'categories' && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
          <div className="bg-[#1d2030] border-b border-[#2a2f3f] px-5 py-3">
            <p className="text-sm font-semibold text-[#eceff7]">Category Intelligence</p>
            <p className="text-xs text-[#a6aec4] mt-0.5">Per-category metrics with 4-week trend.</p>
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
                        {TREND_ICON[row.trend]}{row.trendPct !== 0 && ` ${row.trendPct > 0 ? '+' : ''}${row.trendPct}%`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openCategoryDrilldown(row.id, row.label)}
                        className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] hover:underline whitespace-nowrap">
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

      {/* ── PANEL: Bottleneck Monitor ── */}
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
                <div key={i} className={`bg-[#171922] border rounded-lg p-5 ${b.spikePercent >= 100 ? 'border-[#dc6d7d]/40' : 'border-[#d8a34c]/30'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm font-semibold text-[#eceff7]">{b.categoryLabel}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${b.spikePercent >= 100 ? 'bg-[#dc6d7d]/15 text-[#dc6d7d]' : 'bg-[#d8a34c]/15 text-[#d8a34c]'}`}>+{b.spikePercent}%</span>
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

      {/* ── PANEL: Transporter Performance ── */}
      {panel === 'transporters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#eceff7]">Transporter Risk Signals</p>
            <p className="text-xs text-[#a6aec4]">Recent 4 weeks vs prior 4 weeks · ≥30% increase flagged</p>
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
                    <tr key={i} className={`border-b border-[#2a2f3f]/40 hover:bg-[#1d2030] ${t.riskLevel === 'HIGH' ? 'bg-[#dc6d7d]/3' : ''}`}>
                      <td className="px-4 py-3 font-medium text-[#eceff7]">{t.name}</td>
                      <td className="px-4 py-3 text-[#a6aec4]">{t.totalCases}</td>
                      <td className="px-4 py-3"><span className={t.recentDelayRate > t.priorDelayRate * 1.3 ? 'text-[#dc6d7d] font-semibold' : 'text-[#a6aec4]'}>{t.priorDelayRate > 0 ? `${t.priorDelayRate}% → ` : ''}{t.recentDelayRate}%</span></td>
                      <td className="px-4 py-3"><span className={t.recentEquipmentRate > t.priorEquipmentRate * 1.3 ? 'text-[#dc6d7d] font-semibold' : 'text-[#a6aec4]'}>{t.priorEquipmentRate > 0 ? `${t.priorEquipmentRate}% → ` : ''}{t.recentEquipmentRate}%</span></td>
                      <td className="px-4 py-3"><span className={t.recentAmendmentRate > t.priorAmendmentRate * 1.3 ? 'text-[#dc6d7d] font-semibold' : 'text-[#a6aec4]'}>{t.priorAmendmentRate > 0 ? `${t.priorAmendmentRate}% → ` : ''}{t.recentAmendmentRate}%</span></td>
                      <td className="px-4 py-3 text-[#a6aec4]">{t.preventableRate}%</td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {t.riskFlags.map((f, fi) => <div key={fi} className="text-[#d8a34c] whitespace-nowrap">{f.metric} +{f.changePct}%</div>)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.riskLevel === 'HIGH' ? 'bg-[#dc6d7d]/15 text-[#dc6d7d]' : 'bg-[#d8a34c]/15 text-[#d8a34c]'}`}>{t.riskLevel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PANEL: Preventable Opportunities ── */}
      {panel === 'preventable' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#eceff7]">Preventable Opportunities</p>
              <p className="text-xs text-[#a6aec4] mt-0.5">{ct.preventableCases.toLocaleString()} preventable cases · {ct.preventableHoursLost.toLocaleString()}h estimated hours lost</p>
            </div>
          </div>
          <div className="bg-[#d8a34c]/8 border border-[#d8a34c]/25 rounded-lg px-5 py-4 flex items-center gap-4">
            <span className="text-[#d8a34c] text-2xl">⚡</span>
            <div>
              <p className="text-sm font-semibold text-[#eceff7]">{ct.preventableHoursLost.toLocaleString()} estimated hours lost to preventable issues</p>
              <p className="text-xs text-[#a6aec4] mt-0.5">Resolving these patterns could recover significant operational capacity.</p>
            </div>
          </div>
          {ct.preventableOpportunities.length === 0 ? (
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-10 text-center">
              <p className="text-[#52c7c7] font-medium">No preventable cases detected.</p>
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
                    <div className="flex justify-between"><span>Preventable cases</span><span className="text-[#eceff7] font-medium">{op.preventableCount.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Total cases</span><span className="text-[#eceff7]">{op.totalCount.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Preventable rate</span>
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

      {/* ── PANEL: Root Cause Analysis ── */}
      {panel === 'rootcauses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#eceff7]">Root Cause Analysis</p>
            <p className="text-xs text-[#a6aec4]">Dominant operational causes · recent vs prior 4-week comparison</p>
          </div>
          {ct.rootCauses.length === 0 ? (
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-10 text-center">
              <p className="text-[#a6aec4]">No root cause data available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
                <p className="text-xs text-[#a6aec4] uppercase tracking-wide font-medium mb-4">Root Cause Distribution</p>
                <DonutChart
                  data={ct.rootCauses.slice(0, 8).map((rc, i) => ({
                    name: rc.causeLabel, value: rc.count,
                    color: ['#8b7cff','#dc6d7d','#52c7c7','#d8a34c','#7aa2ff','#e07b45','#c46be8','#a6aec4'][i % 8],
                  }))}
                  height={280}
                />
              </div>
              <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
                <div className="bg-[#1d2030] border-b border-[#2a2f3f] px-4 py-3">
                  <p className="text-xs text-[#a6aec4] uppercase tracking-wide font-medium">Cause Breakdown</p>
                </div>
                <table className="w-full text-xs">
                  <thead className="border-b border-[#2a2f3f]">
                    <tr>
                      {['Cause', 'Count', '%', '4-Wk Trend'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] text-[#a6aec4] uppercase tracking-wide">{h}</th>
                      ))}
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
                            {TREND_ICON[rc.trend]}{rc.trendPct !== 0 && ` ${rc.trendPct > 0 ? '+' : ''}${rc.trendPct}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PANEL: Operational Alerts (Phase 28) ── */}
      {panel === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#eceff7]">Operational Alerts</p>
              <p className="text-xs text-[#a6aec4] mt-0.5">Automatically generated from backend data — sorted by severity</p>
            </div>
            {alertCount > 0 && (
              <div className="flex items-center gap-2">
                {highAlerts > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#dc6d7d]/15 text-[#dc6d7d]">{highAlerts} HIGH</span>}
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#1d2030] border border-[#2a2f3f] text-[#a6aec4]">{alertCount} total</span>
              </div>
            )}
          </div>
          {ct.alerts.length === 0 ? (
            <div className="bg-[#52c7c7]/6 border border-[#52c7c7]/20 rounded-lg p-10 text-center">
              <p className="text-[#52c7c7] font-medium mb-1">No active alerts</p>
              <p className="text-xs text-[#a6aec4]">All monitored metrics are within normal thresholds.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ct.alerts.map((alert, i) => {
                const typeLabel: Record<string, string> = {
                  category_spike:    'Category Spike',
                  transporter_delay: 'Transporter Delay',
                  preventable_spike: 'Preventable Spike',
                  root_cause_surge:  'Root Cause Surge',
                };
                const typeIcon: Record<string, string> = {
                  category_spike:    '📈',
                  transporter_delay: '🚛',
                  preventable_spike: '⚠',
                  root_cause_surge:  '🔍',
                };
                return (
                  <div key={i} className={`bg-[#171922] border rounded-lg p-4 flex items-start gap-4 ${
                    alert.severity === 'HIGH'   ? 'border-[#dc6d7d]/35' :
                    alert.severity === 'MEDIUM' ? 'border-[#d8a34c]/30' :
                                                  'border-[#2a2f3f]'
                  }`}>
                    <span className="text-xl shrink-0 mt-0.5">{typeIcon[alert.alertType]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
                          alert.severity === 'HIGH'   ? 'bg-[#dc6d7d]/15 text-[#dc6d7d]' :
                          alert.severity === 'MEDIUM' ? 'bg-[#d8a34c]/15 text-[#d8a34c]' :
                                                        'bg-[#7aa2ff]/15 text-[#7aa2ff]'
                        }`}>{alert.severity}</span>
                        <span className="text-xs text-[#a6aec4]">{typeLabel[alert.alertType]}</span>
                        <span className="text-xs text-[#a6aec4]">·</span>
                        <span className="text-xs text-[#a6aec4] font-mono">{alert.weekDetected.replace('-W', ' W')}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#eceff7]">{alert.subject}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#a6aec4]">
                        <span style={{ color: SEV_CLR[alert.severity] }} className="font-bold">↑ +{alert.changePct}%</span>
                        <span>·</span>
                        <span>{alert.caseCount.toLocaleString()} cases</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PANEL: Case Investigation (Phase 29) ── */}
      {panel === 'investigation' && (
        <InvestigationPanel
          records={records}
          categories={invCategories}
          transporters={invTransporters}
          rootCauses={invRootCauses}
          weeks={sortedWeeks}
        />
      )}

      {/* ── PANEL: Trend Forecast (Phase 30) ── */}
      {panel === 'forecast' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#eceff7]">Trend Forecast</p>
              <p className="text-xs text-[#a6aec4] mt-0.5">Rolling 4-week average projection · dampened extrapolation</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ct.forecasts.map((f, i) => (
              <div key={i} className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5 hover:border-[#3a3f52] transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: f.color }} />
                  <p className="text-sm font-semibold text-[#eceff7]">{f.categoryLabel}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide mb-1">Current Week</p>
                    <p className="text-xl font-bold text-[#eceff7]">{f.currentWeekCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide mb-1">Projected Next</p>
                    <p className="text-xl font-bold" style={{ color: TREND_CLR[f.trend] }}>
                      {f.projectedCount.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#a6aec4]">4-wk avg: <span className="text-[#eceff7]">{f.rolling4wAvg}</span></span>
                  <span className="font-bold text-sm" style={{ color: TREND_CLR[f.trend] }}>
                    {TREND_ICON[f.trend]}{' '}
                    {f.trend !== 'stable' && f.currentWeekCount > 0 && f.projectedCount > 0
                      ? `${f.trend === 'up' ? '+' : ''}${Math.round(((f.projectedCount - f.currentWeekCount) / f.currentWeekCount) * 100)}%`
                      : 'Stable'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Trend line chart for top 3 categories */}
          {chartWeeks.length >= 2 && ct.forecasts.length > 0 && (() => {
            const topThree = ct.forecasts.slice(0, 3);
            const lineData = chartWeeks.map(wk => {
              const row: Record<string, unknown> = { week: wk.replace(/^\d{4}-/, '') };
              for (const f of topThree) row[f.categoryId] = weeklyHistory[wk]?.issues[f.categoryId] ?? 0;
              return row;
            });
            return (
              <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
                <p className="text-sm font-medium text-[#eceff7] mb-4">Top Category Volume — Historical Trend</p>
                <TrendLine
                  data={lineData}
                  lines={topThree.map(f => ({ key: f.categoryId, label: f.categoryLabel, color: f.color }))}
                  height={240}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Category drilldown modal ── */}
      {drill && (
        <CaseDrilldown title={drill.title} records={drill.records} onClose={() => setDrill(null)} />
      )}
    </div>
  );
}
