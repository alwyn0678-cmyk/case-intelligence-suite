import { useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { DonutChart } from '../components/ui/ChartWrapper';
import { ExampleCasesPanel } from '../components/ui/ExampleCasesPanel';
import { exportCasesToXlsx } from '../lib/exportEvidence';
import type { AnalysisResult, ExampleCase } from '../types/analysis';

interface Props { analysis: AnalysisResult }

export function CustomsPage({ analysis }: Props) {
  const cc = analysis.customsCompliance;
  const [activeDrilldown, setActiveDrilldown] = useState<{ title: string; cases: ExampleCase[] } | null>(null);

  const donutData = [
    { name: 'Customs Docs',  value: cc.customsDocs,     color: '#d8a34c' },
    { name: 'Portbase',      value: cc.portbaseIssues,  color: '#7aa2ff' },
    { name: 'B/L Issues',    value: cc.blIssues,        color: '#52c7c7' },
    { name: 'T1 / Transit',  value: cc.t1Issues,        color: '#8b7cff' },
  ].filter(d => d.value > 0);

  // KPI cards — each carries its drilldown record set for view / export
  const kpiCards = [
    { label: 'Total Compliance Cases', value: cc.totalCases,     accent: '#8b7cff', cases: cc.exampleCases },
    { label: 'Customs Docs Missing',   value: cc.customsDocs,    accent: '#d8a34c', cases: cc.customsDocsExamples },
    { label: 'Portbase Issues',        value: cc.portbaseIssues, accent: '#7aa2ff', cases: cc.portbaseExamples },
    { label: 'B/L Issues',             value: cc.blIssues,       accent: '#52c7c7', cases: cc.blExamples },
  ];

  return (
    <div className="p-8 space-y-8">
      <SectionHeader
        title="Customs & Compliance"
        subtitle="Documentation gaps, T1/transit issues, and B/L failures — full evidence export available"
      />

      {cc.totalCases === 0 ? (
        <div className="bg-[#52c7c7]/8 border border-[#52c7c7]/20 rounded-lg p-5 text-sm text-[#a6aec4]">
          No customs or compliance issues detected in this dataset.
        </div>
      ) : (
        <>
          {/* KPI row — with view / export per metric */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpiCards.map(k => (
              <div key={k.label} className="bg-[#171922] border border-[#2a2f3f] rounded-lg p-4 flex flex-col gap-2">
                <p className="text-xs text-[#a6aec4] uppercase tracking-wider">{k.label}</p>
                <p className="text-2xl font-semibold" style={{ color: k.accent }}>{k.value.toLocaleString()}</p>
                {k.value > 0 && (
                  <div className="flex gap-3 mt-auto pt-1">
                    <button
                      onClick={() => setActiveDrilldown({ title: k.label, cases: k.cases })}
                      className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium"
                    >
                      View cases
                    </button>
                    <button
                      onClick={() => exportCasesToXlsx(k.label, k.cases)}
                      className="text-xs text-[#a6aec4] hover:text-[#eceff7]"
                    >
                      ↓ Export
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {cc.t1Issues > 0 && (
            <div className="bg-[#8b7cff]/8 border border-[#8b7cff]/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-sm text-[#eceff7]">
                <span className="text-[#8b7cff] font-semibold">{cc.t1Issues}</span>{' '}
                T1 / transit document cases — review pre-departure transit declaration process.
              </p>
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={() => setActiveDrilldown({ title: 'T1 / Transit Issues', cases: cc.t1Examples })}
                  className="text-xs text-[#8b7cff] hover:text-[#a08fff] font-medium whitespace-nowrap"
                >
                  View cases
                </button>
                <button
                  onClick={() => exportCasesToXlsx('T1 Transit Issues', cc.t1Examples)}
                  className="text-xs text-[#a6aec4] hover:text-[#eceff7]"
                >
                  ↓ Export
                </button>
              </div>
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
                  { label: 'Customs Missing / Pending',    value: cc.customsDocs,    color: '#d8a34c', note: 'Documents absent at time of case',          cases: cc.customsDocsExamples },
                  { label: 'T1 / Transit Requested',       value: cc.t1Issues,       color: '#8b7cff', note: 'Transit declaration issues',                 cases: cc.t1Examples },
                  { label: 'B/L Issues',                   value: cc.blIssues,       color: '#52c7c7', note: 'Bill of lading errors or missing docs',       cases: cc.blExamples },
                  { label: 'Portbase / Port Notification', value: cc.portbaseIssues, color: '#7aa2ff', note: 'Pre-notification or port clearance issues',   cases: cc.portbaseExamples },
                ].filter(r => r.value > 0).map(r => (
                  <div key={r.label} className="flex items-center justify-between px-3 py-2 bg-[#1d2030] rounded gap-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color: r.color }}>{r.label}</p>
                      <p className="text-xs text-[#a6aec4]">{r.note}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-lg font-semibold" style={{ color: r.color }}>{r.value}</span>
                      <button
                        onClick={() => setActiveDrilldown({ title: r.label, cases: r.cases })}
                        className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => exportCasesToXlsx(r.label, r.cases)}
                        className="text-xs text-[#a6aec4] hover:text-[#eceff7]"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
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
