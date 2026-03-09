import React from 'react';
import {
  Upload, LayoutDashboard, AlertTriangle, Users, Truck,
  FileCheck, MapPin, TrendingUp, CheckSquare, Search,
  FileSpreadsheet, FileText,
} from 'lucide-react';
import type { ViewId } from '../../types';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ReactNode;
  requiresData: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'upload',       label: 'Upload Data',            icon: <Upload size={15} />,         requiresData: false },
  { id: 'summary',      label: 'Executive Summary',      icon: <LayoutDashboard size={15} />, requiresData: true  },
  { id: 'issues',       label: 'Issue Intelligence',     icon: <AlertTriangle size={15} />,   requiresData: true  },
  { id: 'customers',    label: 'Customer Burden',        icon: <Users size={15} />,           requiresData: true  },
  { id: 'transporters', label: 'Transporter Performance',icon: <Truck size={15} />,           requiresData: true  },
  { id: 'customs',      label: 'Customs & Compliance',   icon: <FileCheck size={15} />,       requiresData: true  },
  { id: 'areas',        label: 'Area Hotspots',          icon: <MapPin size={15} />,          requiresData: true  },
  { id: 'predictive',   label: 'Predictive Intelligence',icon: <TrendingUp size={15} />,      requiresData: true  },
  { id: 'actions',      label: 'Action Register',        icon: <CheckSquare size={15} />,     requiresData: true  },
  { id: 'explorer',     label: 'Case Explorer',          icon: <Search size={15} />,          requiresData: true  },
];

interface SidebarProps {
  current: ViewId;
  onChange: (id: ViewId) => void;
  hasData: boolean;
  onExcelExport?: () => void;
  onPdfExport?: () => void;
}

export function Sidebar({ current, onChange, hasData, onExcelExport, onPdfExport }: SidebarProps) {
  return (
    <aside className="fixed top-0 left-0 h-full w-[220px] bg-[#171922] border-r border-[#2a2f3f] flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2a2f3f]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#8b7cff]/20 border border-[#8b7cff]/40 flex items-center justify-center">
            <span className="text-[#8b7cff] text-xs font-bold">CIS</span>
          </div>
          <div>
            <div className="text-[#eceff7] text-sm font-semibold leading-tight">Case Intelligence</div>
            <div className="text-[#a6aec4] text-[10px]">Suite</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const disabled = item.requiresData && !hasData;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !disabled && onChange(item.id)}
              disabled={disabled}
              className={[
                'w-full flex items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors',
                active
                  ? 'text-[#8b7cff] bg-[#8b7cff]/8 border-l-2 border-[#8b7cff]'
                  : disabled
                    ? 'text-[#a6aec4]/30 cursor-not-allowed'
                    : 'text-[#a6aec4] hover:text-[#eceff7] hover:bg-[#1d2030] cursor-pointer',
              ].join(' ')}
            >
              <span className={active ? 'text-[#8b7cff]' : ''}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Export buttons */}
      {hasData && (
        <div className="px-4 py-4 border-t border-[#2a2f3f] flex flex-col gap-2">
          <button
            onClick={onExcelExport}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-[#a6aec4] hover:text-[#52c7c7] hover:bg-[#1d2030] border border-[#2a2f3f] transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={13} />
            Export Excel
          </button>
          <button
            onClick={onPdfExport}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-[#a6aec4] hover:text-[#dc6d7d] hover:bg-[#1d2030] border border-[#2a2f3f] transition-colors cursor-pointer"
          >
            <FileText size={13} />
            Export PDF
          </button>
        </div>
      )}
    </aside>
  );
}
