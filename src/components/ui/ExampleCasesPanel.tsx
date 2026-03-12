import { useState } from 'react';
import type { ExampleCase } from '../../types/analysis';

interface Props {
  title: string;
  subtitle?: string;
  cases: ExampleCase[];
  onClose: () => void;
}

// Confidence badge colour
function confColor(c: number): string {
  if (c >= 0.70) return '#52c7c7';
  if (c >= 0.50) return '#d8a34c';
  return '#dc6d7d';
}

export function ExampleCasesPanel({ title, subtitle, cases, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? cases : cases.slice(0, 5);

  return (
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,11,17,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2a2f3f] shrink-0">
          <div>
            <p className="text-sm font-semibold text-[#eceff7]">{title}</p>
            {subtitle && (
              <p className="text-xs text-[#a6aec4] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#a6aec4] hover:text-[#eceff7] text-lg leading-none ml-4 shrink-0 px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {cases.length === 0 ? (
            <p className="text-sm text-[#a6aec4] text-center py-10">
              No example cases available for this group.
            </p>
          ) : (
            <table className="w-full text-xs min-w-[800px]">
              <thead className="sticky top-0 bg-[#1d2030] border-b border-[#2a2f3f]">
                <tr>
                  {[
                    'Case No.',
                    'Booking',
                    'Issue',
                    'Subject',
                    'Date',
                    'Customer',
                    'Transporter',
                    'Load Ref',
                    'Container',
                    'Confidence',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-xs font-medium text-[#a6aec4] uppercase tracking-wide text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]"
                  >
                    {/* Case No. */}
                    <td className="px-3 py-2.5 font-mono text-[#7aa2ff] whitespace-nowrap">
                      {c.caseNumber ?? <span className="text-[#a6aec4]/40">—</span>}
                    </td>
                    {/* Booking */}
                    <td className="px-3 py-2.5 font-mono text-[#a6aec4] whitespace-nowrap">
                      {c.bookingRef ?? <span className="text-[#a6aec4]/40">—</span>}
                    </td>
                    {/* Issue */}
                    <td className="px-3 py-2.5 text-[#eceff7] whitespace-nowrap">
                      {c.issueLabel}
                    </td>
                    {/* Subject */}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span
                        className="block truncate text-[#a6aec4]"
                        title={c.subject ?? undefined}
                      >
                        {c.subject ?? <span className="text-[#a6aec4]/40">—</span>}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="px-3 py-2.5 text-[#a6aec4] whitespace-nowrap">
                      {c.date ?? <span className="text-[#a6aec4]/40">—</span>}
                    </td>
                    {/* Customer */}
                    <td className="px-3 py-2.5 max-w-[110px]">
                      <span
                        className="block truncate text-[#eceff7]"
                        title={c.customer ?? undefined}
                      >
                        {c.customer ?? <span className="text-[#a6aec4]/40">—</span>}
                      </span>
                    </td>
                    {/* Transporter */}
                    <td className="px-3 py-2.5 max-w-[110px]">
                      <span
                        className="block truncate text-[#a6aec4]"
                        title={c.transporter ?? undefined}
                      >
                        {c.transporter ?? <span className="text-[#a6aec4]/40">—</span>}
                      </span>
                    </td>
                    {/* Load Ref */}
                    <td className="px-3 py-2.5 font-mono text-[#a6aec4] whitespace-nowrap">
                      {c.loadRef ?? <span className="text-[#a6aec4]/40">—</span>}
                    </td>
                    {/* Container */}
                    <td className="px-3 py-2.5 font-mono text-[#a6aec4] whitespace-nowrap">
                      {c.containerNumber ?? <span className="text-[#a6aec4]/40">—</span>}
                    </td>
                    {/* Confidence */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="font-medium"
                        style={{ color: confColor(c.confidence) }}
                      >
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {cases.length > 0 && (
          <div className="px-5 py-3 border-t border-[#2a2f3f] shrink-0 flex items-center justify-between">
            <p className="text-xs text-[#a6aec4]">
              Showing <span className="text-[#eceff7] font-medium">{shown.length}</span> of{' '}
              <span className="text-[#eceff7] font-medium">{cases.length}</span> example case
              {cases.length !== 1 ? 's' : ''} — sorted by classification confidence
            </p>
            {cases.length > 5 && (
              <button
                onClick={() => setExpanded(x => !x)}
                className="text-xs text-[#7aa2ff] hover:text-[#8fb3ff] font-medium ml-4 shrink-0"
              >
                {expanded ? 'Show fewer' : `Show all ${cases.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
