import { SectionHeader } from '../components/ui/SectionHeader';
import { HBarChart } from '../components/ui/ChartWrapper';
import type { AnalysisResult } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const RISK_CLR = { HIGH: '#dc6d7d', MEDIUM: '#d8a34c', LOW: '#52c7c7' };
const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

export function CustomerPage({ analysis }: Props) {
  const { customerBurden, loadRefIntelligence, summary } = analysis;
  const top15 = customerBurden.slice(0, 15);

  const chartData = top15.map(c => ({ name: c.name, count: c.count }));

  const top3Pct = summary.totalCases > 0
    ? (customerBurden.slice(0, 3).reduce((s, c) => s + c.count, 0) / summary.totalCases * 100).toFixed(1)
    : '0';

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Customer Burden" subtitle="Workload, preventable cases, and risk score per account" />

      <div className="bg-[#7aa2ff]/8 border border-[#7aa2ff]/20 rounded-lg px-4 py-3">
        <p className="text-sm text-[#eceff7]">
          Top 3 customers account for <span className="text-[#7aa2ff] font-semibold">{top3Pct}%</span> of all cases.
          {customerBurden[0] && <> Highest burden: <span className="font-medium">{customerBurden[0].name}</span> with {customerBurden[0].count.toLocaleString()} cases ({customerBurden[0].hoursLost.toFixed(1)}h).</>}
        </p>
      </div>

      {/* Bar chart */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
        <p className="text-sm font-medium text-[#eceff7] mb-4">Top {top15.length} Customers by Case Volume</p>
        <HBarChart data={chartData} dataKey="count" nameKey="name" color="#7aa2ff" height={top15.length * 26 + 40} />
      </div>

      {/* Customer table */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
              {['#','Customer','Cases','Hours','Prev %','Load Refs','Customs','Top Issue','Trend','Risk'].map(h => (
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
                    : <span className="text-[#a6aec4]/40">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {c.missingCustomsDocs > 0
                    ? <span className="text-[#d8a34c] font-medium">{c.missingCustomsDocs}</span>
                    : <span className="text-[#a6aec4]/40">—</span>}
                </td>
                <td className="px-3 py-2.5 text-[#a6aec4] max-w-[140px] truncate" title={c.topIssue}>{c.topIssue}</td>
                <td className="px-3 py-2.5 text-center">
                  <span style={{ color: TREND_CLR[c.trend] }}>{TREND_ICON[c.trend]}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ color: RISK_CLR[c.risk], background: RISK_CLR[c.risk] + '20' }}>{c.risk}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load ref offenders */}
      {loadRefIntelligence.topOffenders.length > 0 && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-1">Load Reference Offenders</p>
          <p className="text-xs text-[#a6aec4] mb-4">{loadRefIntelligence.totalMissing} cases with missing load reference · ~{loadRefIntelligence.estimatedRework.toFixed(0)}h rework</p>
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
    </div>
  );
}
