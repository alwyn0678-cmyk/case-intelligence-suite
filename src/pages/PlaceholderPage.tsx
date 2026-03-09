import { Construction } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  comingSoon?: string[];
}

export function PlaceholderPage({ title, subtitle, comingSoon = [] }: PlaceholderPageProps) {
  return (
    <div className="p-8">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="mt-4 border border-dashed border-[#2a2f3f] rounded-xl px-10 py-16 flex flex-col items-center justify-center text-center">
        <div className="w-11 h-11 rounded-xl bg-[#1d2030] border border-[#2a2f3f] flex items-center justify-center mb-4">
          <Construction size={20} className="text-[#a6aec4]" />
        </div>
        <p className="text-sm text-[#a6aec4] font-medium">Analysis engine not yet connected</p>
        <p className="text-xs text-[#a6aec4]/60 mt-1 max-w-xs">
          This view will populate once the intelligence layer is implemented.
        </p>
        {comingSoon.length > 0 && (
          <div className="mt-6 text-left">
            <p className="text-xs font-medium text-[#a6aec4] mb-3 text-center">This view will include:</p>
            <ul className="space-y-1.5">
              {comingSoon.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[#a6aec4]/70">
                  <span className="text-[#8b7cff] mt-0.5">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
