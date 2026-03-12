import { useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { VBarChart, HBarChart } from '../components/ui/ChartWrapper';
import { ExampleCasesPanel } from '../components/ui/ExampleCasesPanel';
import type { AnalysisResult, IssueBreakdownItem } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

export function IssuePage({ analysis }: Props) {
  const { issueBreakdown, weeklyHistory, chartWeeks, sortedWeeks } = analysis;

  const [selected, setSelected] = useState<IssueBreakdownItem | null>(null);

  const rising = issueBreakdown.filter(i => i.trend === 'up');

  // Stacked weekly chart — top 6 issues, capped at last 16 weeks
  const top6 = issueBreakdown.slice(0, 6);
  const weeklyChartData = chartWeeks.map(wk => {
    const row: Record<string, unknown> = { week: wk.replace(/^\d{4}-/, '') };
    for (const iss of top6) row[iss.id] = weeklyHistory[wk]?.issues[iss.id] ?? 0;
    return row;
  });

  const hoursData = issueBreakdown.slice(0, 10).map(i => ({ name: i.label.replace(' / ', '/'), hours: parseFloat(i.hoursLost.toFixed(1)) }));

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Issue Intelligence" subtitle="Full-text analysis of Subject, Description and ISR Details" />

      {/* Example cases modal */}
      {selected && (
        <ExampleCasesPanel
          title={`Example Cases — ${selected.label}`}
          subtitle={`${selected.count} case${selected.count !== 1 ? 's' : ''} · ${selected.percent.toFixed(1)}% of total · ${selected.hoursLost.toFixed(1)}h lost`}
          cases={selected.exampleCases}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Rising alerts */}
      {rising.length > 0 && (
        <div className="space-y-2">
          {rising.map(i => (
            <div key={i.id} className="bg-[#dc6d7d]/8 border border-[#dc6d7d]/20 rounded-lg px-4 py-2.5 flex items-center gap-3">
              <span className="text-[#dc6d7d]">↑</span>
              <span className="text-sm text-[#eceff7] flex-1">
                <span className="font-medium">{i.label}</span>
                <span className="text-[#a6aec4] ml-2">rising week-on-week — {i.count.toLocaleString()} total cases ({i.percent.toFixed(1)}%)</span>
              </span>
              {i.exampleCases.length > 0 && (
                <button
                  onClick={() => setSelected(i)}
                  className="text-xs text-[#dc6d7d] hover:text-[#e07d8b] font-medium shrink-0"
                >
                  View cases
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Issue table */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide w-8">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide">Category</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide">Cases</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide">% Total</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide">Hours Lost</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide">Preventable</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide">Trend</th>
              <th className="px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {issueBreakdown.map((iss, idx) => (
              <tr key={iss.id} className="border-b border-[#2a2f3f]/50 hover:bg-[#1d2030] transition-colors">
                <td className="px-4 py-3 text-[#a6aec4]">{idx + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: iss.color }} />
                    <span className="text-[#eceff7]">{iss.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-[#eceff7]">{iss.count.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-[#a6aec4]">{iss.percent.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right text-[#a6aec4]">{iss.hoursLost.toFixed(1)}h</td>
                <td className="px-4 py-3 text-center">
                  {iss.preventable
                    ? <span className="text-xs text-[#52c7c7]">Yes</span>
                    : <span className="text-xs text-[#a6aec4]/40">No</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span style={{ color: TREND_CLR[iss.trend] }} className="text-sm font-medium">
                    {TREND_ICON[iss.trend]}
                  </span>
                </td>
                {/* Examples button */}
                <td className="px-4 py-3 text-right">
                  {iss.exampleCases.length > 0 && (
                    <button
                      onClick={() => setSelected(iss)}
                      className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium whitespace-nowrap"
                    >
                      View {iss.exampleCases.length}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Weekly Trend by Issue (top 6)</p>
          {sortedWeeks.length >= 2
            ? <VBarChart data={weeklyChartData} bars={top6.map(i => ({ key: i.id, label: i.label, color: i.color }))} height={280} />
            : <p className="text-sm text-[#a6aec4] text-center pt-12">Need 2+ weeks of dated data</p>}
        </div>
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Hours Lost by Category</p>
          <HBarChart data={hoursData} dataKey="hours" nameKey="name" color="#d8a34c" height={280} />
        </div>
      </div>
    </div>
  );
}
