import { CheckCircle, XCircle } from 'lucide-react';
import type { ParsedFile } from '../../types';

const IMPORTANT_COLUMNS = ['subject', 'description', 'isr_details', 'customer', 'date'];
const ALL_COLUMNS = ['subject', 'description', 'isr_details', 'customer', 'transporter', 'zip', 'area', 'date', 'status', 'priority', 'category', 'hours'];

const LABELS: Record<string, string> = {
  subject:     'Subject',
  description: 'Description',
  isr_details: 'ISR Details',
  customer:    'Customer',
  transporter: 'Transporter',
  zip:         'ZIP / Postcode',
  area:        'Area / Region',
  date:        'Date',
  status:      'Status',
  priority:    'Priority',
  category:    'Category',
  hours:       'Hours Spent',
};

interface ColumnMapProps {
  file: ParsedFile;
}

export function ColumnMap({ file }: ColumnMapProps) {
  const mapped = file.columnMap as Record<string, string>;

  const foundCount  = ALL_COLUMNS.filter(k => mapped[k]).length;
  const critMissing = IMPORTANT_COLUMNS.filter(k => !mapped[k]);

  return (
    <div className="bg-[#171922] border border-[#2a2f3f] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-[#eceff7]">Column Detection</h3>
          <p className="text-xs text-[#a6aec4] mt-0.5">
            {foundCount} of {ALL_COLUMNS.length} standard columns detected
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-[#a6aec4]">from</span>
          <p className="text-xs text-[#eceff7] font-medium mt-0.5">{file.headers.length} columns in file</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ALL_COLUMNS.map(key => {
          const found = !!mapped[key];
          const isCrit = IMPORTANT_COLUMNS.includes(key);
          return (
            <div key={key} className="flex items-center gap-2.5 py-1">
              {found ? (
                <CheckCircle size={13} className="text-[#52c7c7] shrink-0" />
              ) : (
                <XCircle size={13} className={isCrit ? 'text-[#dc6d7d] shrink-0' : 'text-[#2a2f3f] shrink-0'} />
              )}
              <span className={`text-xs ${found ? 'text-[#eceff7]' : isCrit ? 'text-[#dc6d7d]/60' : 'text-[#a6aec4]/40'}`}>
                {LABELS[key]}
              </span>
              {found && (
                <span className="text-[10px] text-[#a6aec4]/60 ml-auto truncate max-w-[80px]" title={mapped[key]}>
                  ← {mapped[key]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {critMissing.length > 0 && (
        <div className="mt-4 px-3 py-2.5 bg-[#dc6d7d]/8 border border-[#dc6d7d]/20 rounded-lg">
          <p className="text-xs text-[#dc6d7d] font-medium">
            Missing critical columns: {critMissing.map(k => LABELS[k]).join(', ')}
          </p>
          <p className="text-[11px] text-[#a6aec4] mt-1">
            Analysis will still run, but these columns drive the deepest intelligence.
            Rename your columns to match the standard names above.
          </p>
        </div>
      )}
    </div>
  );
}
