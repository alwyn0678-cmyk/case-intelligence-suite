import { useState, useMemo } from 'react';
import { Search, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TAXONOMY_MAP } from '../lib/taxonomy';
import { exportEnrichedToXlsx } from '../lib/exportAllCases';
import type { AnalysisResult, EnrichedRecord } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const PAGE_SIZE = 100;

const STATE_LABEL: Record<string, string> = {
  missing:       'Missing',
  provided:      'Provided',
  amended:       'Amended',
  delayed:       'Delayed',
  escalated:     'Escalated',
  informational: 'Info',
  unknown:       '',
};

const STATE_COLOR: Record<string, string> = {
  missing:       '#dc6d7d',
  provided:      '#52c7c7',
  amended:       '#7aa2ff',
  delayed:       '#d8a34c',
  escalated:     '#dc6d7d',
  informational: '#a6aec4',
  unknown:       '#a6aec4',
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? '#52c7c7' : pct >= 50 ? '#d8a34c' : '#dc6d7d';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 bg-[#2a2f3f] rounded-full h-1">
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color }}>{pct}%</span>
    </div>
  );
}

function DebugPanel({ record }: { record: EnrichedRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-[#a6aec4] hover:text-[#8b7cff] mt-1 cursor-pointer"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {open ? 'Hide' : 'Show'} debug
      </button>
      {open && (
        <div className="mt-2 space-y-1 bg-[#1d2030] rounded p-2 text-xs text-[#a6aec4] max-w-[480px]">
          {record.resolvedCustomer && (
            <div><span className="text-[#7aa2ff]">Customer:</span> {record.resolvedCustomer}</div>
          )}
          {record.resolvedTransporter && (
            <div><span className="text-[#7aa2ff]">Transporter:</span> {record.resolvedTransporter}</div>
          )}
          {record.resolvedDepot && (
            <div><span className="text-[#7aa2ff]">Depot:</span> {record.resolvedDepot}</div>
          )}
          {record.resolvedDeepseaTerminal && (
            <div><span className="text-[#7aa2ff]">Terminal:</span> {record.resolvedDeepseaTerminal}</div>
          )}
          {record.extractedZip && (
            <div><span className="text-[#7aa2ff]">ZIP:</span> {record.extractedZip}
              {record.routingHint && <span className="ml-1 text-[#a6aec4]">({record.routingHint})</span>}
            </div>
          )}
          {record.issueState && record.issueState !== 'unknown' && (
            <div><span className="text-[#7aa2ff]">Intent:</span> {record.issueState}</div>
          )}
          {record.secondaryIssue && (
            <div><span className="text-[#7aa2ff]">Secondary:</span> {TAXONOMY_MAP[record.secondaryIssue]?.label ?? record.secondaryIssue}</div>
          )}
          {record.evidence && record.evidence.length > 0 && (
            <div><span className="text-[#7aa2ff]">Evidence:</span> {record.evidence.slice(0, 6).join(', ')}</div>
          )}
          {record.sourceFieldsUsed && (
            <div><span className="text-[#7aa2ff]">Fields:</span> {record.sourceFieldsUsed.join(', ')}</div>
          )}
          {record.unresolvedReason && (
            <div className="text-[#dc6d7d]"><span className="font-medium">Review reason:</span> {record.unresolvedReason}</div>
          )}
          {record.unknownEntities && record.unknownEntities.length > 0 && (
            <div className="text-[#d8a34c]"><span className="font-medium">Unknown entity:</span> {record.unknownEntities.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExplorerPage({ analysis }: Props) {
  const { records, sortedWeeks, unknownEntities } = analysis;
  const [search, setSearch] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [page, setPage] = useState(0);

  const customers = useMemo(() => {
    const s = new Set(records.map(r => r.resolvedCustomer ?? r.customer).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [records]);

  const issues = useMemo(() => {
    const s = new Set(records.flatMap(r => r.issues));
    return Array.from(s).sort();
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      if (q && !r.combinedText.toLowerCase().includes(q) && !(r.resolvedCustomer ?? r.customer ?? '').toLowerCase().includes(q)) return false;
      if (issueFilter && !r.issues.includes(issueFilter)) return false;
      if (customerFilter && (r.resolvedCustomer ?? r.customer) !== customerFilter) return false;
      if (weekFilter && r.weekKey !== weekFilter) return false;
      if (reviewOnly && !r.reviewFlag) return false;
      return true;
    });
  }, [records, search, issueFilter, customerFilter, weekFilter, reviewOnly]);

  const paginated = filtered.slice(0, (page + 1) * PAGE_SIZE);

  const selClass = "bg-[#1d2030] border border-[#2a2f3f] text-[#eceff7] text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-[#8b7cff]";

  return (
    <div className="p-8 space-y-6">
      <SectionHeader
        title="Case Explorer"
        subtitle={`${filtered.length.toLocaleString()} of ${records.length.toLocaleString()} records`}
      />

      {/* Unknown entity alert */}
      {unknownEntities.length > 0 && (
        <div className="bg-[#d8a34c]/8 border border-[#d8a34c]/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#d8a34c] mt-0.5 shrink-0" />
          <div className="text-sm text-[#eceff7]">
            <span className="font-medium text-[#d8a34c]">{unknownEntities.length} unknown entity name{unknownEntities.length > 1 ? 's' : ''} detected.</span>
            <span className="text-[#a6aec4] ml-1">
              These look like logistics companies but weren't matched to any known transporter, depot, or terminal:
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {unknownEntities.slice(0, 10).map(e => (
                <span key={e.name} className="text-xs px-1.5 py-0.5 rounded bg-[#d8a34c]/15 text-[#d8a34c] border border-[#d8a34c]/30">
                  {e.name} ×{e.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a6aec4]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search subject, description, customer…"
            className="w-full bg-[#1d2030] border border-[#2a2f3f] text-[#eceff7] text-sm rounded-md pl-9 pr-3 py-1.5 focus:outline-none focus:border-[#8b7cff]"
          />
        </div>
        <select value={issueFilter} onChange={e => { setIssueFilter(e.target.value); setPage(0); }} className={selClass}>
          <option value="">All Issues</option>
          {issues.map(i => <option key={i} value={i}>{TAXONOMY_MAP[i]?.label ?? i}</option>)}
        </select>
        <select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(0); }} className={selClass}>
          <option value="">All Customers</option>
          {customers.slice(0, 100).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={weekFilter} onChange={e => { setWeekFilter(e.target.value); setPage(0); }} className={selClass}>
          <option value="">All Weeks</option>
          {sortedWeeks.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#a6aec4] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={reviewOnly}
            onChange={e => { setReviewOnly(e.target.checked); setPage(0); }}
            className="accent-[#dc6d7d] cursor-pointer"
          />
          Review flags only
        </label>
        {filtered.length > 0 && (
          <button
            onClick={() => exportEnrichedToXlsx(
              reviewOnly ? 'Review Queue' : issueFilter ? `Cases — ${TAXONOMY_MAP[issueFilter]?.label ?? issueFilter}` : 'Case Explorer',
              filtered,
            )}
            className="text-xs font-medium text-[#a6aec4] hover:text-[#eceff7] border border-[#2a2f3f] hover:border-[#3a3f52] bg-[#171922] rounded-md px-3 py-1.5 whitespace-nowrap"
          >
            ↓ Export {filtered.length.toLocaleString()}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
              {['Date','Customer','Subject','Primary Issue','Intent','Confidence','Entity','Area'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-medium text-[#a6aec4] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const tax = TAXONOMY_MAP[r.primaryIssue];
              const entityName = r.resolvedDeepseaTerminal ?? r.resolvedDepot ?? r.resolvedTransporter ?? null;
              const stateLabel = r.issueState !== 'unknown' ? STATE_LABEL[r.issueState] : '';
              const stateColor = STATE_COLOR[r.issueState] ?? '#a6aec4';

              return (
                <tr key={i} className={`border-b border-[#2a2f3f]/40 hover:bg-[#1d2030] ${r.reviewFlag ? 'bg-[#dc6d7d]/3' : ''}`}>
                  <td className="px-3 py-2 text-[#a6aec4] whitespace-nowrap text-xs">
                    {r.date ? new Date(r.date).toLocaleDateString('en-GB') : r.weekKey !== 'unknown' ? r.weekKey : '—'}
                  </td>
                  <td className="px-3 py-2 text-[#eceff7] max-w-[130px]">
                    <div className="truncate">{r.resolvedCustomer ?? r.customer ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-[#eceff7] max-w-[220px]">
                    <div className="truncate" title={r.subject}>{r.subject ?? '—'}</div>
                    <DebugPanel record={r} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {r.reviewFlag && <AlertTriangle size={10} className="text-[#dc6d7d] shrink-0" />}
                      <span className="text-xs px-1.5 py-0.5 rounded border" style={{ color: tax?.color, borderColor: (tax?.color ?? '#a6aec4') + '40', background: (tax?.color ?? '#a6aec4') + '15' }}>
                        {tax?.label ?? r.primaryIssue}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {stateLabel && (
                      <span className="text-xs px-1 py-0.5 rounded" style={{ color: stateColor, background: stateColor + '15' }}>
                        {stateLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ConfidenceBar value={r.confidence} />
                  </td>
                  <td className="px-3 py-2 text-[#a6aec4] text-xs max-w-[120px]">
                    {entityName ? (
                      <span className="truncate block" title={entityName}>{entityName}</span>
                    ) : (
                      <span className="text-[#2a2f3f]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#a6aec4] text-xs max-w-[120px]">
                    <span className="truncate block" title={r.resolvedArea ?? ''}>{r.resolvedArea ?? '—'}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-[#a6aec4]">No records match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {paginated.length < filtered.length && (
        <div className="text-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm text-[#a6aec4] hover:text-[#eceff7] border border-[#2a2f3f] rounded-md hover:bg-[#1d2030] transition-colors cursor-pointer"
          >
            Load more ({filtered.length - paginated.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
