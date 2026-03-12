import { useState, useMemo } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { HBarChart } from '../components/ui/ChartWrapper';
import { ExampleCasesPanel } from '../components/ui/ExampleCasesPanel';
import { isBlockedFromCustomerRole, isPositiveCustomerCandidate } from '../config/referenceData';
import { exportEnrichedToXlsx } from '../lib/exportAllCases';
import type { AnalysisResult, CustomerBurdenItem } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const RISK_CLR = { HIGH: '#dc6d7d', MEDIUM: '#d8a34c', LOW: '#52c7c7' };
const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

export function CustomerPage({ analysis }: Props) {
  const { customerBurden: rawCustomerBurden, loadRefIntelligence, summary } = analysis;

  // Final pre-render safety filter: even if something slipped through analyzeData.ts,
  // block it here before it can reach any chart or table.
  // Excluded entries are counted toward the unresolved display.
  const { customerBurden, renderFilteredOut } = useMemo(() => {
    const passed: CustomerBurdenItem[] = [];
    let filtered = 0;
    for (const c of rawCustomerBurden) {
      if (!isBlockedFromCustomerRole(c.name) && isPositiveCustomerCandidate(c.name)) {
        passed.push(c);
      } else {
        filtered++;
      }
    }
    return { customerBurden: passed, renderFilteredOut: filtered };
  }, [rawCustomerBurden]);

  const top15 = customerBurden.slice(0, 15);

  const [selected, setSelected] = useState<CustomerBurdenItem | null>(null);

  const chartData = top15.map(c => ({ name: c.name, count: c.count }));

  const top3Pct = summary.totalCases > 0
    ? (customerBurden.slice(0, 3).reduce((s, c) => s + c.count, 0) / summary.totalCases * 100).toFixed(1)
    : '0';

  const resolvedCount = customerBurden.reduce((s, c) => s + c.count, 0);
  const unresolvedCount = (summary.unknownCustomerCount ?? 0) + renderFilteredOut;

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Customer Burden" subtitle="Workload, preventable cases, and risk score per account" />

      {/* Example cases modal */}
      {selected && (
        <ExampleCasesPanel
          title={`Example Cases — ${selected.name}`}
          subtitle={`${selected.count} case${selected.count !== 1 ? 's' : ''} · Top issue: ${selected.topIssue} · Risk: ${selected.risk}`}
          cases={selected.exampleCases}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Unresolved customer alert */}
      {unresolvedCount > 0 && (
        <div className="bg-[#d8a34c]/8 border border-[#d8a34c]/25 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-[#d8a34c] text-lg mt-0.5 shrink-0">&#9888;</span>
          <div>
            <p className="text-sm font-semibold text-[#d8a34c] mb-1">
              {unresolvedCount.toLocaleString()} case{unresolvedCount !== 1 ? 's' : ''} with no resolved customer
            </p>
            <p className="text-xs text-[#a6aec4]">
              These cases could not be linked to a specific customer and are excluded from the charts below.
              The customer column may contain a transporter, depot, or terminal name, or may be empty.
              Review in <span className="text-[#7aa2ff]">Case Explorer &rarr; Review Flags</span> to investigate.
            </p>
          </div>
        </div>
      )}

      {/* Summary banner */}
      {customerBurden.length > 0 && (
        <div className="bg-[#7aa2ff]/8 border border-[#7aa2ff]/20 rounded-lg px-4 py-3">
          <p className="text-sm text-[#eceff7]">
            <span className="text-[#7aa2ff] font-semibold">{customerBurden.length}</span> resolved customer{customerBurden.length !== 1 ? 's' : ''} &middot;{' '}
            top 3 account for <span className="text-[#7aa2ff] font-semibold">{top3Pct}%</span> of all cases.
            {customerBurden[0] && <> Highest burden: <span className="font-medium">{customerBurden[0].name}</span> with {customerBurden[0].count.toLocaleString()} cases ({customerBurden[0].hoursLost.toFixed(1)}h).</>}
          </p>
        </div>
      )}

      {customerBurden.length === 0 && unresolvedCount === 0 && (
        <div className="bg-[#7aa2ff]/8 border border-[#7aa2ff]/20 rounded-lg p-5 text-sm text-[#a6aec4]">
          No customer data found. Ensure the uploaded file has a <span className="text-[#7aa2ff] font-medium">Customer</span> or <span className="text-[#7aa2ff] font-medium">Account</span> column.
        </div>
      )}

      {customerBurden.length > 0 && (
        <>
          {/* Bar chart */}
          <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
            <p className="text-sm font-medium text-[#eceff7] mb-1">Top {top15.length} Customers by Case Volume</p>
            <p className="text-xs text-[#a6aec4] mb-4">Transporters, depots, and terminals are excluded. Only real customer accounts shown.</p>
            <HBarChart data={chartData} dataKey="count" nameKey="name" color="#7aa2ff" height={top15.length * 26 + 40} />
          </div>

          {/* Customer table */}
          <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
                  {['#','Customer','Cases','Hours','Prev %','Load Refs','Customs','Top Issue','Trend','Risk',''].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide text-left first:text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customerBurden.slice(0, 30).map((c, i) => (
                  <tr key={c.name} className="border-b border-[#2a2f3f]/50 hover:bg-[#1d2030]">
                    <td className="px-3 py-2.5 text-center text-[#a6aec4]">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-[#eceff7]">{c.name}</td>
                    <td className="px-3 py-2.5 text-[#eceff7]">{c.count.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-[#a6aec4]">{c.hoursLost.toFixed(1)}h</td>
                    <td className="px-3 py-2.5 text-[#a6aec4]">{c.preventablePct.toFixed(0)}%</td>
                    <td className="px-3 py-2.5">
                      {c.missingLoadRef > 0
                        ? <span className="text-[#dc6d7d] font-medium">{c.missingLoadRef}</span>
                        : <span className="text-[#a6aec4]/40">&#8212;</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.missingCustomsDocs > 0
                        ? <span className="text-[#d8a34c] font-medium">{c.missingCustomsDocs}</span>
                        : <span className="text-[#a6aec4]/40">&#8212;</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[#a6aec4] max-w-[140px] truncate" title={c.topIssue}>{c.topIssue}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span style={{ color: TREND_CLR[c.trend] }}>{TREND_ICON[c.trend]}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ color: RISK_CLR[c.risk], background: RISK_CLR[c.risk] + '20' }}>{c.risk}</span>
                    </td>
                    {/* Examples + export buttons */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        {c.exampleCases.length > 0 && (
                          <button
                            onClick={() => setSelected(c)}
                            className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium whitespace-nowrap"
                          >
                            View {c.exampleCases.length}
                          </button>
                        )}
                        {c.count > 0 && (
                          <button
                            onClick={() => exportEnrichedToXlsx(
                              `Customer — ${c.name}`,
                              analysis.records.filter(r => r.resolvedCustomer === c.name),
                            )}
                            className="text-xs text-[#a6aec4] hover:text-[#eceff7] whitespace-nowrap"
                            title={`Export all ${c.count} classified cases for ${c.name}`}
                          >
                            ↓ Export
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Load ref offenders */}
      {loadRefIntelligence.topOffenders.length > 0 && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-1">Load Reference Offenders</p>
          <p className="text-xs text-[#a6aec4] mb-4">{loadRefIntelligence.totalMissing} cases with missing load reference &middot; ~{loadRefIntelligence.estimatedRework.toFixed(0)}h rework</p>
          <div className="grid grid-cols-2 gap-2">
            {loadRefIntelligence.topOffenders.slice(0, 10).map(o => (
              <div key={o.name} className="flex justify-between items-center px-3 py-2 bg-[#1d2030] rounded">
                <span className="text-sm text-[#eceff7] truncate mr-2">{o.name}</span>
                <span className="text-sm text-[#dc6d7d] font-medium shrink-0">{o.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution coverage */}
      {(resolvedCount > 0 || unresolvedCount > 0) && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Customer Resolution Coverage</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#52c7c7]/8 border border-[#52c7c7]/20 rounded-lg p-4">
              <p className="text-xs text-[#52c7c7] font-semibold uppercase tracking-wide mb-1">Resolved</p>
              <p className="text-2xl font-semibold text-[#52c7c7]">{resolvedCount.toLocaleString()}</p>
              <p className="text-xs text-[#a6aec4] mt-1">Cases linked to a specific customer</p>
            </div>
            <div className="bg-[#d8a34c]/8 border border-[#d8a34c]/20 rounded-lg p-4">
              <p className="text-xs text-[#d8a34c] font-semibold uppercase tracking-wide mb-1">Unresolved</p>
              <p className="text-2xl font-semibold text-[#d8a34c]">{unresolvedCount.toLocaleString()}</p>
              <p className="text-xs text-[#a6aec4] mt-1">No customer identified &mdash; excluded from charts</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
