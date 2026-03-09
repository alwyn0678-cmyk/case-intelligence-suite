import React from 'react';

type Variant = 'purple' | 'blue' | 'teal' | 'amber' | 'red' | 'muted';

const styles: Record<Variant, string> = {
  purple: 'bg-[#8b7cff]/15 text-[#8b7cff] border border-[#8b7cff]/30',
  blue:   'bg-[#7aa2ff]/15 text-[#7aa2ff] border border-[#7aa2ff]/30',
  teal:   'bg-[#52c7c7]/15 text-[#52c7c7] border border-[#52c7c7]/30',
  amber:  'bg-[#d8a34c]/15 text-[#d8a34c] border border-[#d8a34c]/30',
  red:    'bg-[#dc6d7d]/15 text-[#dc6d7d] border border-[#dc6d7d]/30',
  muted:  'bg-[#2a2f3f] text-[#a6aec4] border border-[#2a2f3f]',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = 'muted', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
