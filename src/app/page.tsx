'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // Always redirect to login; the login page itself will
    // check auth status and forward to dashboard if already logged in.
    window.location.replace('/login');
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
