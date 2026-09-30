import { HeartPulse } from 'lucide-react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  surface?: 'sidebar' | 'light';
}

const sizeClasses = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-12 h-12 rounded-xl',
  lg: 'w-16 h-16 rounded-2xl',
};

const iconClasses = {
  sm: 'w-[18px] h-[18px]',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function BrandMark({ size = 'md', surface = 'sidebar' }: BrandMarkProps) {
  const isLight = surface === 'light';

  return (
    <span
      role="img"
      aria-label="AR Manager logo"
      className={`relative inline-grid flex-none place-items-center border shadow-sm ${sizeClasses[size]} ${
        isLight ? 'border-white bg-white text-[#0F2D52]' : 'border-white/15 bg-[#2563EB] text-white'
      }`}
    >
      <HeartPulse className={iconClasses[size]} strokeWidth={1.8} aria-hidden="true" />
      <span
        className={`absolute rounded-full border-2 border-white bg-teal-400 ${
          size === 'sm' ? '-right-0.5 -top-0.5 h-2 w-2' : '-right-1 -top-1 h-2.5 w-2.5'
        }`}
        aria-hidden="true"
      />
    </span>
  );
}