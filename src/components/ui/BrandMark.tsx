import Image from 'next/image';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  surface?: 'sidebar' | 'light';
}

const px = { sm: 32, md: 48, lg: 64 };

/** Official AR Manager logo mark (navy hexagon, pulse rising into an arrow). */
export function BrandMark({ size = 'md' }: BrandMarkProps) {
  const s = px[size];
  return (
    <Image src="/logo-mark.svg" alt="AR Manager logo" width={s} height={s} priority={size === 'lg'}
      className="flex-none drop-shadow-sm" style={{ width: s, height: s }} />
  );
}
