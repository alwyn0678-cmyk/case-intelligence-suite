import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, string> = {
  primary:   'bg-[#8b7cff] hover:bg-[#7b6cef] text-white border border-transparent',
  secondary: 'bg-[#1d2030] hover:bg-[#252840] text-[#eceff7] border border-[#2a2f3f]',
  ghost:     'bg-transparent hover:bg-[#1d2030] text-[#a6aec4] hover:text-[#eceff7] border border-transparent',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
