import { SectionHeader } from '../components/ui/SectionHeader';
import type { AnalysisResult, ActionInsight, RepeatOffenderItem } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const PRIORITY_CLR: Record<ActionInsight['priority'], string> = {
  HIGH:   '#dc6d7d',
  MEDIUM: '#d8a34c',
  LOW:    '#a6aec4',
};
const CATEGORY_LABEL: Record<ActionInsight['category'], string> = {
  customer:    'Customer',
  transporter: 'Transporter',
  area:        'Area',
  isr:         'ISR / Internal',
  issue:       'Issue Pattern',
  trend:       'Volume Trend',
};
const ENTITY_CLR: Record<RepeatOffenderItem['entityType'], string> = {
  customer:    '#7aa2ff',
  transporter: '#dc6d7d',
  area:        '#52c7c7',
};

export function ActionPage({ analysis }: Props) {
  const { actionInsights, repeatOffenders, actions } = analysis;
  const a = actions;

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Action Register" subtitle="Operational intelligence and data-driven recommendations" />

      {/* ── Operational Action Board ── */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2f3f] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#d8a34c]" />
          <p className="text-sm font-semibold text-[#eceff7]">Operational Actions This Week</p>
          <span className="ml-auto text-xs text-[#a6aec4] bg-[#1d2030] border border-[#2a2f3f] px-2 py-0.5 rounded">
            {actionInsights.length} insight{actionInsights.length !== 1 ? 's' : ''}
          </span>
        </div>
        {actionInsights.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[#a6aec4]">
            Upload data with dates, customers, and issue text to generate insights.
          </p>
        ) : (
          <div className="divide-y divide-[#2a2f3f]/50">
            {actionInsights.map((insight, i) => (
              <div key={i} className="flex gap-4 px-5 py-3.5">
                <div className="shrink-0 pt-0.5">
                  <span
                    className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ color: PRIORITY_CLR[insight.priority], background: PRIORITY_CLR[insight.priority] + '20' }}
                  >
                    {insight.priority}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#a6aec4] font-medium uppercase tracking-wide mb-1">
                    {CATEGORY_LABEL[insight.category]}
                  </p>
                  <p className="text-sm text-[#eceff7] leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Repeat Offenders ── */}
      {repeatOffenders.length > 0 && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2f3f]">
            <p className="text-sm font-semibold text-[#eceff7]">Top Repeat Offenders</p>
            <p className="text-xs text-[#a6aec4] mt-0.5">
              Entities where one issue dominates — chronic process failures requiring structural fixes
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
                {['Entity', 'Type', 'Dominant Issue', 'Repeat Cases', 'Total', '% Dominated'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-medium text-[#a6aec4] uppercase tracking-wide text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repeatOffenders.map(ro => (
                <tr key={`${ro.entityType}-${ro.name}`} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                  <td className="px-4 py-2.5 font-medium text-[#eceff7]">{ro.name}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded capitalize"
                      style={{ color: ENTITY_CLR[ro.entityType], background: ENTITY_CLR[ro.entityType] + '20' }}
                    >
                      {ro.entityType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#a6aec4]">{ro.topIssueLabel}</td>
                  <td className="px-4 py-2.5 font-medium text-[#dc6d7d]">{ro.repeatCount}</td>
                  <td className="px-4 py-2.5 text-[#a6aec4]">{ro.totalCount}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#2a2f3f] rounded-full h-1.5 w-16">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(ro.repeatPct, 100)}%`, background: '#d8a34c' }} />
                      </div>
                      <span className="text-xs text-[#d8a34c] font-medium">{ro.repeatPct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Quick wins & Structural fixes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-xs text-[#52c7c7] font-semibold uppercase tracking-wide mb-3">Quick Wins — High Impact, Low Effort</p>
          {a.quickWins.length === 0
            ? <p className="text-sm text-[#a6aec4]">No quick wins identified.</p>
            : <ul className="space-y-2">
                {a.quickWins.map((w, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2.5 bg-[#52c7c7]/5 border border-[#52c7c7]/15 rounded-lg">
                    <span className="text-[#52c7c7] text-sm shrink-0 mt-0.5">✓</span>
                    <span className="text-sm text-[#eceff7]">{w}</span>
                  </li>
                ))}
              </ul>
          }
        </div>
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
          <p className="text-xs text-[#d8a34c] font-semibold uppercase tracking-wide mb-3">Structural Fixes — Medium Term</p>
          {a.structuralFixes.length === 0
            ? <p className="text-sm text-[#a6aec4]">No structural fixes identified.</p>
            : <ul className="space-y-2">
                {a.structuralFixes.map((f, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2.5 bg-[#d8a34c]/5 border border-[#d8a34c]/15 rounded-lg">
                    <span className="text-[#d8a34c] text-sm shrink-0 mt-0.5">→</span>
                    <span className="text-sm text-[#eceff7]">{f}</span>
                  </li>
                ))}
              </ul>
          }
        </div>
      </div>

      {a.customerInterventions.length > 0 && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2f3f]">
            <p className="text-xs text-[#dc6d7d] font-semibold uppercase tracking-wide">Customer Interventions</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#a6aec4] uppercase w-40">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#a6aec4] uppercase">Recommended Action</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-[#a6aec4] uppercase w-20">Priority</th>
              </tr>
            </thead>
            <tbody>
              {a.customerInterventions.map(ci => (
                <tr key={ci.customer} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                  <td className="px-4 py-2.5 font-medium text-[#eceff7]">{ci.customer}</td>
                  <td className="px-4 py-2.5 text-[#a6aec4]">{ci.action}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-xs font-medium text-[#dc6d7d] bg-[#dc6d7d]/10 px-1.5 py-0.5 rounded">HIGH</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {a.transporterEscalations.length > 0 && (
        <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2f3f]">
            <p className="text-xs text-[#dc6d7d] font-semibold uppercase tracking-wide">Transporter Escalations</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#a6aec4] uppercase w-40">Transporter</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#a6aec4] uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {a.transporterEscalations.map(te => (
                <tr key={te.transporter} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                  <td className="px-4 py-2.5 font-medium text-[#eceff7]">{te.transporter}</td>
                  <td className="px-4 py-2.5 text-[#a6aec4]">{te.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {a.automationOpportunities.length > 0 && (
          <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
            <p className="text-xs text-[#7aa2ff] font-semibold uppercase tracking-wide mb-3">Automation Opportunities</p>
            <ul className="space-y-2">
              {a.automationOpportunities.map((o, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-[#7aa2ff] shrink-0">◎</span>
                  <span className="text-[#eceff7]">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.complianceControls.length > 0 && (
          <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
            <p className="text-xs text-[#8b7cff] font-semibold uppercase tracking-wide mb-3">Compliance Controls</p>
            <ul className="space-y-2">
              {a.complianceControls.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-[#8b7cff] shrink-0">⬡</span>
                  <span className="text-[#eceff7]">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
