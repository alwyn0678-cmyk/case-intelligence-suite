import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-[#eceff7]">{title}</h2>
        {subtitle && <p className="text-sm text-[#a6aec4] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
    </div>
  );
}
