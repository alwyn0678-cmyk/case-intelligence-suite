import { SectionHeader } from '../components/ui/SectionHeader';
import { HBarChart } from '../components/ui/ChartWrapper';
import type { AnalysisResult } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

export function AreaPage({ analysis }: Props) {
  const { areaHotspots, meta } = analysis;

  if (areaHotspots.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <SectionHeader title="Area Hotspots" subtitle="Operational routing split — Mainz/Germersheim · Duisburg/Rhine-Ruhr · deepsea ports" />
        <div className="bg-[#7aa2ff]/8 border border-[#7aa2ff]/20 rounded-lg p-5 text-sm text-[#a6aec4]">
          No area data found. Add an <span className="text-[#7aa2ff] font-medium">Area</span> or <span className="text-[#7aa2ff] font-medium">Postcode</span> column, or upload a ZIP mapping file on the Upload page.
        </div>
      </div>
    );
  }

  const chartData = areaHotspots.slice(0, 15).map(a => ({ name: a.name, count: a.count }));

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Area Hotspots" subtitle="Operational routing split — Mainz/Germersheim · Duisburg/Rhine-Ruhr · deepsea ports" />

      {meta.hasZipMap && (
        <div className="bg-[#52c7c7]/8 border border-[#52c7c7]/20 rounded-lg px-4 py-3">
          <p className="text-sm text-[#a6aec4]">ZIP mapping active · {areaHotspots.length} distinct areas found</p>
        </div>
      )}

      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
        <p className="text-sm font-medium text-[#eceff7] mb-4">Top {chartData.length} Areas by Case Volume</p>
        <HBarChart data={chartData} dataKey="count" nameKey="name" color="#52c7c7" height={chartData.length * 28 + 40} />
      </div>

      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
              {['#','Area','Cases','Hours Lost','Top Issue','Trend'].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide text-left first:text-center">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areaHotspots.map((a, i) => (
              <tr key={a.name} className="border-b border-[#2a2f3f]/50 hover:bg-[#1d2030]">
                <td className="px-4 py-2.5 text-center text-[#a6aec4]">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-[#eceff7]">{a.name}</td>
                <td className="px-4 py-2.5 text-[#eceff7]">{a.count.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-[#a6aec4]">{a.hoursLost.toFixed(1)}h</td>
                <td className="px-4 py-2.5 text-[#a6aec4]">{a.topIssue}</td>
                <td className="px-4 py-2.5">
                  <span style={{ color: TREND_CLR[a.trend] }}>{TREND_ICON[a.trend]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
