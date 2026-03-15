import { useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ExampleCasesPanel } from '../components/ui/ExampleCasesPanel';
import { exportCasesToXlsx } from '../lib/exportEvidence';
import type { AnalysisResult, IssueDrilldown, IssueDriverItem, ExampleCase } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

function DriverList({ items, accent }: { items: IssueDriverItem[]; accent: string }) {
  if (items.length === 0) return <p className="text-xs text-[#a6aec4]/60 italic">No data</p>;
  return (
    <ul className="space-y-1.5">
      {items.map(item => (
        <li key={item.name} className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#eceff7] truncate max-w-[160px]" title={item.name}>{item.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-16 bg-[#2a2f3f] rounded-full h-1">
              <div className="h-1 rounded-full" style={{ width: `${Math.min(item.pct, 100)}%`, background: accent }} />
            </div>
            <span className="text-xs text-[#a6aec4] w-8 text-right">{item.count}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DrillCard({ drill, onView }: { drill: IssueDrilldown; onView: (title: string, cases: ExampleCase[]) => void }) {
  const isrPct = drill.totalCount > 0 ? (drill.isrCount / drill.totalCount * 100).toFixed(1) : '0';
  const extPct = drill.totalCount > 0 ? (drill.externalCount / drill.totalCount * 100).toFixed(1) : '0';

  return (
    <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2a2f3f]">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: drill.color }} />
        <div>
          <p className="text-sm font-semibold text-[#eceff7]">{drill.issueLabel}</p>
          <p className="text-xs text-[#a6aec4]">{drill.totalCount.toLocaleString()} cases total</p>
        </div>
        {/* Source split pills */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#52c7c7]/10 border border-[#52c7c7]/20 text-[#52c7c7]">
            Ext {extPct}%
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#8b7cff]/10 border border-[#8b7cff]/20 text-[#8b7cff]">
            ISR {isrPct}%
          </span>
          {drill.exampleCases.length > 0 && (
            <>
              <button
                onClick={() => onView(drill.issueLabel, drill.exampleCases)}
                className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium whitespace-nowrap"
              >
                View {drill.totalCount.toLocaleString()}
              </button>
              <button
                onClick={() => exportCasesToXlsx(drill.issueLabel, drill.exampleCases)}
                className="text-xs text-[#a6aec4] hover:text-[#eceff7]"
              >
                ↓ Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* Drilldown grid */}
      <div className="grid grid-cols-3 divide-x divide-[#2a2f3f]">
        <div className="px-4 py-4">
          <p className="text-[10px] text-[#7aa2ff] font-semibold uppercase tracking-wide mb-3">Top Customers</p>
          <DriverList items={drill.topCustomers} accent="#7aa2ff" />
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] text-[#dc6d7d] font-semibold uppercase tracking-wide mb-3">Top Transporters</p>
          <DriverList items={drill.topTransporters} accent="#dc6d7d" />
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] text-[#52c7c7] font-semibold uppercase tracking-wide mb-3">Top Areas</p>
          <DriverList items={drill.topAreas} accent="#52c7c7" />
        </div>
      </div>
    </div>
  );
}

export function DrilldownPage({ analysis }: Props) {
  const { issueDrilldowns, weekOnWeek, issueBreakdown } = analysis;
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeDrilldown, setActiveDrilldown] = useState<{ title: string; cases: ExampleCase[] } | null>(null);

  const displayed = activeFilter === 'all'
    ? issueDrilldowns
    : issueDrilldowns.filter(d => d.issueId === activeFilter);

  // Spikes from WoW — shown as badges
  const spikeIds = new Set(
    weekOnWeek.issueChanges.filter(c => c.isSpike && c.direction === 'up').map(c =>
      issueBreakdown.find(i => i.label === c.label)?.id
    ).filter(Boolean)
  );

  return (
    <div className="p-8 space-y-8">
      <SectionHeader
        title="Root-Cause Drilldown"
        subtitle="Who and where each issue is coming from — customers · transporters · areas · source split"
      />

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            activeFilter === 'all'
              ? 'bg-[#8b7cff]/20 border-[#8b7cff]/50 text-[#8b7cff]'
              : 'border-[#2a2f3f] text-[#a6aec4] hover:border-[#8b7cff]/30 hover:text-[#eceff7]'
          }`}
        >
          All Issues
        </button>
        {issueDrilldowns.map(d => (
          <button
            key={d.issueId}
            onClick={() => setActiveFilter(d.issueId)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
              activeFilter === d.issueId
                ? 'bg-[#1d2030] border-[#2a2f3f] text-[#eceff7]'
                : 'border-[#2a2f3f] text-[#a6aec4] hover:border-[#2a2f3f] hover:text-[#eceff7]'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.issueLabel}
            {spikeIds.has(d.issueId) && (
              <span className="text-[#dc6d7d] text-[9px] font-bold leading-none">↑</span>
            )}
          </button>
        ))}
      </div>

      {/* WoW spikes banner */}
      {weekOnWeek.available && weekOnWeek.issueChanges.filter(c => c.isSpike).length > 0 && (
        <div className="space-y-1.5">
          {weekOnWeek.issueChanges.filter(c => c.isSpike).map(c => (
            <div
              key={c.label}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${
                c.direction === 'up'
                  ? 'bg-[#dc6d7d]/6 border-[#dc6d7d]/20'
                  : 'bg-[#52c7c7]/6 border-[#52c7c7]/20'
              }`}
            >
              <span style={{ color: TREND_CLR[c.direction] }}>{TREND_ICON[c.direction]}</span>
              <span className="font-medium text-[#eceff7]">{c.label}</span>
              <span className="text-[#a6aec4]">
                {c.direction === 'up' ? 'up' : 'down'} {Math.abs(c.pctChange).toFixed(0)}% week-on-week
                ({c.prior} → {c.current} cases)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drilldown cards */}
      {displayed.length === 0 ? (
        <div className="bg-[#7aa2ff]/8 border border-[#7aa2ff]/20 rounded-lg p-5 text-sm text-[#a6aec4]">
          No drilldown data available for the selected filter.
        </div>
      ) : (
        <div className="space-y-5">
          {displayed.map(d => (
            <DrillCard
              key={d.issueId}
              drill={d}
              onView={(title, cases) => setActiveDrilldown({ title, cases })}
            />
          ))}
        </div>
      )}

      {/* Week-on-week movement table */}
      {weekOnWeek.available && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2f3f]">
            <p className="text-sm font-semibold text-[#eceff7]">Week-on-Week Movement</p>
            <p className="text-xs text-[#a6aec4] mt-0.5">
              {weekOnWeek.priorWeek.replace('-W', ' W')} → {weekOnWeek.currentWeek.replace('-W', ' W')}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#2a2f3f]">
            {/* Issue changes */}
            <div className="p-5">
              <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide font-medium mb-3">Issue Changes</p>
              <table className="w-full text-sm">
                <tbody>
                  {weekOnWeek.issueChanges.map(c => (
                    <tr key={c.label} className="border-b border-[#2a2f3f]/30 last:border-0">
                      <td className="py-2 text-[#eceff7]">{c.label}</td>
                      <td className="py-2 text-right text-[#a6aec4]">{c.prior} → {c.current}</td>
                      <td className="py-2 text-right w-20">
                        <span style={{ color: TREND_CLR[c.direction] }} className="text-xs font-medium">
                          {c.direction !== 'stable' ? (c.direction === 'up' ? '+' : '') : ''}
                          {c.pctChange.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Area + customer changes */}
            <div className="p-5 space-y-5">
              {weekOnWeek.customerChanges.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide font-medium mb-3">Customer Movement</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {weekOnWeek.customerChanges.map(c => (
                        <tr key={c.label} className="border-b border-[#2a2f3f]/30 last:border-0">
                          <td className="py-2 text-[#eceff7] truncate max-w-[160px]">{c.label}</td>
                          <td className="py-2 text-right text-[#a6aec4]">{c.prior} → {c.current}</td>
                          <td className="py-2 text-right w-20">
                            <span style={{ color: TREND_CLR[c.direction] }} className="text-xs font-medium">
                              {c.direction !== 'stable' ? (c.direction === 'up' ? '+' : '') : ''}
                              {c.pctChange.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {weekOnWeek.areaChanges.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#a6aec4] uppercase tracking-wide font-medium mb-3">Area Movement</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {weekOnWeek.areaChanges.map(c => (
                        <tr key={c.label} className="border-b border-[#2a2f3f]/30 last:border-0">
                          <td className="py-2 text-[#eceff7]">{c.label}</td>
                          <td className="py-2 text-right text-[#a6aec4]">{c.prior} → {c.current}</td>
                          <td className="py-2 text-right w-20">
                            <span style={{ color: TREND_CLR[c.direction] }} className="text-xs font-medium">
                              {c.direction !== 'stable' ? (c.direction === 'up' ? '+' : '') : ''}
                              {c.pctChange.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeDrilldown && (
        <ExampleCasesPanel
          title={activeDrilldown.title}
          subtitle={`${activeDrilldown.cases.length} case${activeDrilldown.cases.length !== 1 ? 's' : ''} — sorted by confidence`}
          cases={activeDrilldown.cases}
          onClose={() => setActiveDrilldown(null)}
        />
      )}
    </div>
  );
}
