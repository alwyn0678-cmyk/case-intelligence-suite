import { SectionHeader } from '../components/ui/SectionHeader';
import { DonutChart } from '../components/ui/ChartWrapper';
import type { AnalysisResult } from '../types/analysis';

interface Props { analysis: AnalysisResult }

export function CustomsPage({ analysis }: Props) {
  const cc = analysis.customsCompliance;

  const donutData = [
    { name: 'Customs Docs',  value: cc.customsDocs,     color: '#d8a34c' },
    { name: 'Portbase',      value: cc.portbaseIssues,  color: '#7aa2ff' },
    { name: 'B/L Issues',    value: cc.blIssues,        color: '#52c7c7' },
    { name: 'T1 / Transit',  value: cc.t1Issues,        color: '#8b7cff' },
  ].filter(d => d.value > 0);

  return (
    <div className="p-8 space-y-8">
      <SectionHeader
        title="Customs & Compliance"
        subtitle="Documentation gaps, T1/transit issues, and B/L failures — overall tallies"
      />

      {cc.totalCases === 0 ? (
        <div className="bg-[#52c7c7]/8 border border-[#52c7c7]/20 rounded-lg p-5 text-sm text-[#a6aec4]">
          No customs or compliance issues detected in this dataset.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Compliance Cases', value: cc.totalCases,      accent: '#8b7cff' },
              { label: 'Customs Docs Missing',   value: cc.customsDocs,     accent: '#d8a34c' },
              { label: 'Portbase Issues',        value: cc.portbaseIssues,  accent: '#7aa2ff' },
              { label: 'B/L Issues',             value: cc.blIssues,        accent: '#52c7c7' },
            ].map(k => (
              <div key={k.label} className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-4">
                <p className="text-xs text-[#a6aec4] uppercase tracking-wider">{k.label}</p>
                <p className="text-2xl font-semibold mt-1" style={{ color: k.accent }}>{k.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {cc.t1Issues > 0 && (
            <div className="bg-[#8b7cff]/8 border border-[#8b7cff]/20 rounded-lg px-4 py-3">
              <p className="text-sm text-[#eceff7]">
                <span className="text-[#8b7cff] font-semibold">{cc.t1Issues}</span>{' '}
                T1 / transit document cases — review pre-departure transit declaration process.
              </p>
            </div>
          )}

          {/* Breakdown donut + issue split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
              <p className="text-sm font-medium text-[#eceff7] mb-4">Compliance Type Breakdown</p>
              {donutData.length > 0
                ? <DonutChart data={donutData} height={240} />
                : <p className="text-sm text-[#a6aec4] text-center pt-12">No compliance data</p>}
            </div>

            <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-5">
              <p className="text-sm font-medium text-[#eceff7] mb-4">Issue State Summary</p>
              <div className="space-y-3">
                {[
                  { label: 'Customs Missing / Pending',   value: cc.customsDocs,    color: '#d8a34c', note: 'Documents absent at time of case' },
                  { label: 'T1 / Transit Requested',      value: cc.t1Issues,       color: '#8b7cff', note: 'Transit declaration issues' },
                  { label: 'B/L Issues',                  value: cc.blIssues,       color: '#52c7c7', note: 'Bill of lading errors or missing docs' },
                  { label: 'Portbase / Port Notification', value: cc.portbaseIssues, color: '#7aa2ff', note: 'Pre-notification or port clearance issues' },
                ].filter(r => r.value > 0).map(r => (
                  <div key={r.label} className="flex items-center justify-between px-3 py-2 bg-[#1d2030] rounded">
                    <div>
                      <p className="text-sm font-medium" style={{ color: r.color }}>{r.label}</p>
                      <p className="text-xs text-[#a6aec4]">{r.note}</p>
                    </div>
                    <span className="text-lg font-semibold" style={{ color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
