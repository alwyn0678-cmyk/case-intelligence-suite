import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TAXONOMY_MAP } from '../lib/taxonomy';
import type { AnalysisResult } from '../types/analysis';

interface Props { analysis: AnalysisResult }

const PAGE_SIZE = 100;

export function ExplorerPage({ analysis }: Props) {
  const { records, sortedWeeks } = analysis;
  const [search, setSearch] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [page, setPage] = useState(0);

  const customers = useMemo(() => {
    const s = new Set(records.map(r => r.customer).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [records]);

  const issues = useMemo(() => {
    const s = new Set(records.flatMap(r => r.issues));
    return Array.from(s).sort();
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      if (q && !r.combinedText.toLowerCase().includes(q) && !(r.customer ?? '').toLowerCase().includes(q)) return false;
      if (issueFilter && !r.issues.includes(issueFilter)) return false;
      if (customerFilter && r.customer !== customerFilter) return false;
      if (weekFilter && r.weekKey !== weekFilter) return false;
      return true;
    });
  }, [records, search, issueFilter, customerFilter, weekFilter]);

  const paginated = filtered.slice(0, (page + 1) * PAGE_SIZE);

  const selClass = "bg-[#1d2030] border border-[#2a2f3f] text-[#eceff7] text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-[#8b7cff]";

  return (
    <div className="p-8 space-y-6">
      <SectionHeader
        title="Case Explorer"
        subtitle={`${filtered.length.toLocaleString()} of ${records.length.toLocaleString()} records`}
      />

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
      </div>

      {/* Table */}
      <div className="bg-[#171922] border border-[#2a2f3f] rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[750px]">
          <thead>
            <tr className="bg-[#1d2030] border-b border-[#2a2f3f]">
              {['Date','Customer','Subject','Primary Issue','Transporter','Area'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-medium text-[#a6aec4] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const tax = TAXONOMY_MAP[r.primaryIssue];
              return (
                <tr key={i} className="border-b border-[#2a2f3f]/40 hover:bg-[#1d2030]">
                  <td className="px-3 py-2 text-[#a6aec4] whitespace-nowrap text-xs">
                    {r.date ? new Date(r.date).toLocaleDateString('en-GB') : r.weekKey !== 'unknown' ? r.weekKey : '—'}
                  </td>
                  <td className="px-3 py-2 text-[#eceff7] max-w-[140px] truncate">{r.customer ?? '—'}</td>
                  <td className="px-3 py-2 text-[#eceff7] max-w-[260px]">
                    <span className="truncate block" title={r.subject}>{r.subject ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-1.5 py-0.5 rounded border" style={{ color: tax?.color, borderColor: tax?.color + '40', background: tax?.color + '15' }}>
                      {tax?.label ?? r.primaryIssue}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#a6aec4]">{r.transporter ?? '—'}</td>
                  <td className="px-3 py-2 text-[#a6aec4]">{r.resolvedArea ?? '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#a6aec4]">No records match your filters.</td></tr>
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
