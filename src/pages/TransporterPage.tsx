import { useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { HBarChart } from '../components/ui/ChartWrapper';
import { ExampleCasesPanel } from '../components/ui/ExampleCasesPanel';
import { exportEnrichedToXlsx } from '../lib/exportAllCases';
import type { AnalysisResult, TransporterItem } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const RISK_CLR = { HIGH: '#dc6d7d', MEDIUM: '#d8a34c', LOW: '#52c7c7' };
const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

export function TransporterPage({ analysis }: Props) {
  const { transporterPerformance } = analysis;

  const [selected, setSelected] = useState<TransporterItem | null>(null);

  if (transporterPerformance.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <SectionHeader title="Transporter Performance" subtitle="Delay, punctuality, and waiting time analysis" />
        <div className="bg-[#7aa2ff]/8 border border-[#7aa2ff]/20 rounded-lg p-5 text-sm text-[#a6aec4]">
          No transporter data found. Add a <span className="text-[#7aa2ff] font-medium">Transporter</span> or <span className="text-[#7aa2ff] font-medium">Haulier</span> column to your data for full analysis.
        </div>
      </div>
    );
  }

  const totalDelays = transporterPerformance.reduce((s, t) => s + t.delays, 0);
  const highRisk = transporterPerformance.filter(t => t.risk === 'HIGH');
  const avgScore = transporterPerformance.length > 0
    ? (transporterPerformance.reduce((s, t) => s + t.punctualityScore, 0) / transporterPerformance.length).toFixed(1)
    : '0';

  const chartData = transporterPerformance.slice(0, 10).map(t => ({ name: t.name, delays: t.delays }));

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Transporter Performance" subtitle="Delay, punctuality, and waiting time per haulier" />

      {/* Example cases modal */}
      {selected && (
        <ExampleCasesPanel
          title={`Example Cases — ${selected.name}`}
          subtitle={`${selected.count} case${selected.count !== 1 ? 's' : ''} · ${selected.delays} delay${selected.delays !== 1 ? 's' : ''} · Punctuality issue rate ${selected.punctualityScore.toFixed(0)}% · Risk: ${selected.risk}`}
          cases={selected.exampleCases}
          onClose={() => setSelected(null)}
        />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Transporters', value: transporterPerformance.length, accent: '#8b7cff' },
          { label: 'Total Delay Cases', value: totalDelays.toLocaleString(), accent: '#dc6d7d' },
          { label: 'Avg Punctuality Issue Rate', value: `${avgScore}%`, accent: '#d8a34c' },
        ].map(k => (
          <div key={k.label} className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-4">
            <p className="text-xs text-[#a6aec4] uppercase tracking-wider">{k.label}</p>
            <p className="text-2xl font-semibold mt-1" style={{ color: k.accent }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
        <p className="text-sm font-medium text-[#eceff7] mb-4">Top 10 Transporters by Delay Count</p>
        <HBarChart data={chartData} dataKey="delays" nameKey="name" color="#dc6d7d" height={chartData.length * 30 + 40} />
      </div>

      {/* Table */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
              {['#','Transporter','Total Cases','Delays','Not On Time','Waiting Time','Punctuality Score','Trend','Risk',''].map(h => (
                <th key={h} className="px-3 py-3 text-xs font-medium text-[#a6aec4] uppercase tracking-wide text-left first:text-center">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transporterPerformance.map((t, i) => (
              <tr key={t.name} className="border-b border-[#2a2f3f]/50 hover:bg-[#1d2030]">
                <td className="px-3 py-2.5 text-center text-[#a6aec4]">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-[#eceff7]">{t.name}</td>
                <td className="px-3 py-2.5 text-[#eceff7]">{t.count.toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <span className={t.delays > 0 ? 'text-[#dc6d7d] font-medium' : 'text-[#a6aec4]/40'}>{t.delays || '—'}</span>
                </td>
                <td className="px-3 py-2.5 text-[#a6aec4]">{t.notOnTime || '—'}</td>
                <td className="px-3 py-2.5 text-[#a6aec4]">{t.waitingTime || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#2a2f3f] rounded-full h-1.5 w-16">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(t.punctualityScore, 100)}%`, background: RISK_CLR[t.risk] }} />
                    </div>
                    <span className="text-xs text-[#a6aec4]">{t.punctualityScore.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span style={{ color: TREND_CLR[t.trend] }}>{TREND_ICON[t.trend]}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ color: RISK_CLR[t.risk], background: RISK_CLR[t.risk] + '20' }}>{t.risk}</span>
                </td>
                {/* Examples + export buttons */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    {t.exampleCases.length > 0 && (
                      <button
                        onClick={() => setSelected(t)}
                        className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium whitespace-nowrap"
                      >
                        View {t.exampleCases.length}
                      </button>
                    )}
                    {t.count > 0 && (
                      <button
                        onClick={() => exportEnrichedToXlsx(
                          `Transporter — ${t.name}`,
                          analysis.records.filter(r => r.resolvedTransporter === t.name),
                        )}
                        className="text-xs text-[#a6aec4] hover:text-[#eceff7] whitespace-nowrap"
                        title={`Export all ${t.count} classified cases for ${t.name}`}
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

      {/* Escalations */}
      {highRisk.length > 0 && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Escalation Watchlist</p>
          <div className="space-y-2">
            {highRisk.map(t => (
              <div key={t.name} className="flex items-center gap-3 px-3 py-2.5 bg-[#dc6d7d]/8 border border-[#dc6d7d]/20 rounded-lg">
                <span className="text-[#dc6d7d] font-medium text-sm w-32 shrink-0">{t.name}</span>
                <span className="text-sm text-[#a6aec4] flex-1">
                  {t.delays} delays · {t.notOnTime} late · punctuality issue rate {t.punctualityScore.toFixed(0)}% — SLA review required
                </span>
                {t.exampleCases.length > 0 && (
                  <button
                    onClick={() => setSelected(t)}
                    className="text-xs text-[#dc6d7d] hover:text-[#e07d8b] font-medium shrink-0"
                  >
                    View cases
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
