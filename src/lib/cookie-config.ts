import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export function getSessionCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,   // Required for cross-origin iframe (e2b sandbox)
    maxAge: 7 * 24 * 60 * 60,    // 7 days
    path: '/',
  };
}
