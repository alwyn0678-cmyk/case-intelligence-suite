import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  accent?: string; // left-border color
}

export function Card({ children, className = '', accent }: CardProps) {
  return (
    <div
      className={`bg-[#171922] border border-[#2a2f3f] rounded-lg p-5 ${className}`}
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      {children}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

export function KpiCard({ label, value, sub, accent = '#8b7cff' }: KpiCardProps) {
  return (
    <Card className="flex flex-col gap-1 min-w-[140px]">
      <span className="text-xs font-medium text-[#a6aec4] uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-semibold text-[#eceff7]" style={{ color: accent }}>{value}</span>
      {sub && <span className="text-xs text-[#a6aec4]">{sub}</span>}
    </Card>
  );
}
