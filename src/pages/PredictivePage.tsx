import { SectionHeader } from '../components/ui/SectionHeader';
import type { AnalysisResult } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const CONF_CLR = { HIGH: '#52c7c7', MEDIUM: '#d8a34c', LOW: '#a6aec4' };
const RISK_CLR: Record<string, string> = { HIGH: '#dc6d7d', MEDIUM: '#d8a34c', LOW: '#52c7c7' };
const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_CLR: Record<string, string>  = { up: '#dc6d7d', down: '#52c7c7', stable: '#a6aec4' };

export function PredictivePage({ analysis }: Props) {
  const f = analysis.forecast;

  if (!f.available) {
    return (
      <div className="p-8 space-y-6">
        <SectionHeader title="Predictive Intelligence" subtitle="Next-week forecast using weighted rolling trend model" />
        <div className="bg-[#2a2f3f]/40 border border-[#2a2f3f] rounded-lg p-6 text-center">
          <p className="text-sm text-[#a6aec4]">{f.reason}</p>
          <p className="text-xs text-[#a6aec4]/60 mt-2">Upload multiple weeks of dated case data to enable forecasting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Predictive Intelligence" subtitle={`Based on ${f.weeksAnalyzed} weeks of data — weighted rolling average model`} />

      {/* Headline forecast */}
      <div className="bg-[#8b7cff]/8 border border-[#8b7cff]/25 rounded-xl p-6">
        <p className="text-xs text-[#8b7cff] font-semibold uppercase tracking-wide mb-3">Next Week Forecast</p>
        <div className="flex items-end gap-4">
          <span className="text-5xl font-bold text-[#8b7cff]">{f.nextWeekVolume.toLocaleString()}</span>
          <div className="mb-1">
            <p className="text-sm text-[#eceff7]">expected cases</p>
            <p className="text-xs text-[#a6aec4]">
              Volume trend: <span style={{ color: TREND_CLR[f.volumeTrend] }}>{TREND_ICON[f.volumeTrend]} {f.volumeTrend}</span>
            </p>
          </div>
          <span className="ml-auto text-sm px-3 py-1.5 rounded-full border font-medium" style={{ color: CONF_CLR[f.confidence], borderColor: CONF_CLR[f.confidence] + '40', background: CONF_CLR[f.confidence] + '15' }}>
            {f.confidence} confidence
          </span>
        </div>
        <p className="text-xs text-[#a6aec4] mt-3">
          Forecast basis: weighted average of last {Math.min(f.weeksAnalyzed, 3)} weeks (50%/30%/20% recency weighting) · {f.weeksAnalyzed} total weeks analyzed
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Predicted issue ranking */}
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Predicted Issue Ranking</p>
          <div className="space-y-2">
            {f.topIssues.map((iss, i) => (
              <div key={iss.id} className="flex items-center gap-3">
                <span className="text-xs text-[#a6aec4] w-4">{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: iss.color }} />
                <span className="text-sm text-[#eceff7] flex-1 truncate">{iss.label}</span>
                <span className="text-sm text-[#a6aec4] font-medium">{iss.forecasted}</span>
                <span style={{ color: TREND_CLR[iss.trend] }} className="text-xs w-4 text-right">{TREND_ICON[iss.trend]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rising risks */}
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Rising Risk Categories</p>
          {f.risingRisk.length === 0 ? (
            <p className="text-sm text-[#a6aec4]">No categories rising significantly above trend.</p>
          ) : (
            <div className="space-y-2">
              {f.risingRisk.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2 bg-[#dc6d7d]/8 border border-[#dc6d7d]/20 rounded-lg">
                  <span className="text-[#dc6d7d] text-xs">↑</span>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="text-sm text-[#eceff7] flex-1">{r.label}</span>
                  <span className="text-sm text-[#dc6d7d] font-medium">{r.forecasted} cases</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account watchlist */}
        {f.riskyCustomers.length > 0 && (
          <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
            <p className="text-sm font-medium text-[#eceff7] mb-4">Account Risk Watchlist</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2f3f]">
                  <th className="text-left pb-2 text-xs text-[#a6aec4] font-medium">Customer</th>
                  <th className="text-right pb-2 text-xs text-[#a6aec4] font-medium">Last Week</th>
                  <th className="text-center pb-2 text-xs text-[#a6aec4] font-medium">Trend</th>
                  <th className="text-right pb-2 text-xs text-[#a6aec4] font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {f.riskyCustomers.map(c => (
                  <tr key={c.name} className="border-b border-[#2a2f3f]/40">
                    <td className="py-2 text-[#eceff7]">{c.name}</td>
                    <td className="py-2 text-right text-[#a6aec4]">{c.recentCount}</td>
                    <td className="py-2 text-center" style={{ color: TREND_CLR[c.trend] }}>{TREND_ICON[c.trend]}</td>
                    <td className="py-2 text-right">
                      <span className="text-xs font-medium" style={{ color: RISK_CLR[c.risk] }}>{c.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transporter risk */}
        {f.riskyTransporters.length > 0 && (
          <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
            <p className="text-sm font-medium text-[#eceff7] mb-4">Transporter Delay Risk</p>
            <div className="space-y-2">
              {f.riskyTransporters.map(t => (
                <div key={t.name} className="flex items-center justify-between px-3 py-2 bg-[#1d2030] rounded">
                  <span className="text-sm text-[#eceff7]">{t.name}</span>
                  <span className="text-xs text-[#a6aec4]">{t.delayRate.toFixed(0)}% issue rate</span>
                  <span className="text-xs font-medium ml-2" style={{ color: RISK_CLR[t.risk] }}>{t.risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Area hotspot forecast */}
      {f.hotspots.length > 0 && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-sm font-medium text-[#eceff7] mb-4">Area Hotspot Forecast</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {f.hotspots.map(h => (
              <div key={h.name} className="flex items-center justify-between px-3 py-2.5 bg-[#1d2030] rounded border border-[#2a2f3f]">
                <span className="text-sm text-[#eceff7] truncate mr-2">{h.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm text-[#a6aec4] font-medium">{h.forecasted}</span>
                  <span style={{ color: TREND_CLR[h.trend] }} className="text-xs">{TREND_ICON[h.trend]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-emptive actions */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
        <p className="text-sm font-medium text-[#eceff7] mb-4">Pre-emptive Recommended Actions</p>
        <ol className="space-y-2">
          {f.actions.map((a, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="text-[#8b7cff] font-medium w-5 shrink-0">{i + 1}.</span>
              <span className="text-[#eceff7]">{a}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
