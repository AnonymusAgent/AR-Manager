'use client';

import React, { useEffect, useState } from 'react';

const LOADING_MESSAGES = [
  'Loading your dashboard...',
  'Fetching claim data...',
  'Preparing AR records...',
  'Connecting to system...',
  'Loading medical records...',
  'Retrieving patient data...',
  'Processing billing information...',
];

interface MedicalLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  showMessage?: boolean;
}

export function MedicalLoader({ message, size = 'md', showMessage = true }: MedicalLoaderProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const sizeMap = { sm: 100, md: 160, lg: 220 };
  const videoSize = sizeMap[size];
  const displayMessage = message || LOADING_MESSAGES[msgIdx];

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Medical Case History Animation */}
      <div className="rounded-2xl overflow-hidden" style={{ width: videoSize, height: videoSize }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          src="/images/medical-loading.mp4"
        />
      </div>

      {showMessage && (
        <div className="text-center mt-1">
          <p className="text-sm font-medium text-[#64748B]">{displayMessage}</p>
          <div className="mt-2.5 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Full-page loading screen with the medical animation */
export function MedicalLoadingScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
      <div className="text-center">
        <MedicalLoader message={message} size="lg" />
        <p className="mt-4 text-[11px] text-[#94A3B8]">AR Management System</p>
      </div>
    </div>
  );
}

/** Inline loader for cards/sections */
export function MedicalInlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <MedicalLoader message={message} size="md" />
    </div>
  );
}
