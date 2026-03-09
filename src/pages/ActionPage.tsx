import { SectionHeader } from '../components/ui/SectionHeader';
import type { AnalysisResult } from '../types/analysis';

interface Props { analysis: AnalysisResult }

export function ActionPage({ analysis }: Props) {
  const a = analysis.actions;

  return (
    <div className="p-8 space-y-8">
      <SectionHeader title="Action Register" subtitle="Data-driven recommendations ranked by impact" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick wins */}
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

        {/* Structural fixes */}
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

      {/* Customer interventions */}
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

      {/* Transporter escalations */}
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
        {/* Automation */}
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

        {/* Compliance controls */}
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
