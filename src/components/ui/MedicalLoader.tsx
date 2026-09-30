'use client';

import React from 'react';
import { HeartPulse } from 'lucide-react';

interface MedicalLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  showMessage?: boolean;
}

const VISUAL_SIZE_CLASSES = {
  sm: 'w-14 h-14',
  md: 'w-20 h-20',
  lg: 'w-24 h-24',
};

export function MedicalLoader({ message, size = 'md', showMessage = true }: MedicalLoaderProps) {
  const displayMessage = message || 'Loading...';

  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-label={displayMessage}>
      <div className={`relative isolate grid place-items-center flex-none ${VISUAL_SIZE_CLASSES[size]}`} aria-hidden="true">
        <span
          className="absolute inset-0 rounded-full border border-blue-200 border-t-teal-500 animate-spin motion-reduce:animate-none"
          style={{ animationDuration: '4s' }}
        />
        <span
          className="absolute inset-[15%] rounded-full border border-dashed border-teal-300 animate-spin motion-reduce:animate-none"
          style={{ animationDuration: '8s', animationDirection: 'reverse' }}
        />
        <span className="grid w-3/5 h-3/5 place-items-center rounded-full border border-blue-100 bg-white shadow-md animate-pulse motion-reduce:animate-none" style={{ animationDuration: '2.4s' }}>
          <HeartPulse className="w-7 h-7 text-teal-700" strokeWidth={1.7} />
        </span>
        <span className="absolute top-[10%] right-[8%] grid w-4 h-4 place-items-center rounded-full border-2 border-white bg-blue-600 shadow-sm">
          <span className="absolute w-2 h-0.5 rounded-full bg-white" />
          <span className="absolute w-0.5 h-2 rounded-full bg-white" />
        </span>
      </div>

      {showMessage && (
        <p className="m-0 text-center text-sm font-medium leading-snug text-slate-500">{displayMessage}</p>
      )}
    </div>
  );
}

/** Full-page loading screen for route transitions and session checks. */
export function MedicalLoadingScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
      <div className="text-center">
        <MedicalLoader message={message} size="lg" />
        <p className="mt-3 text-[11px] text-[#94A3B8]">AR Management System</p>
      </div>
    </div>
  );
}

/** Compact loader for data-dependent sections. */
export function MedicalInlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <MedicalLoader message={message} size="md" />
    </div>
  );
}
