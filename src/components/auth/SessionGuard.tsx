'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Timer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  SESSION_SECURITY_STORAGE_KEY,
  SessionSecuritySettings,
  DEFAULT_SESSION_SECURITY,
  DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  describeInactivityTimeout,
  resolveSessionSecurity,
  readStoredSessionSecurity,
  writeStoredSessionSecurity,
  clearStoredSessionSecurity,
} from '@/lib/session-security';

type GuardPhase = 'idle' | 'warning' | 'locked';

type LogoutReason = 'inactivity' | 'closed';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'wheel',
] as const;

const TICK_INTERVAL_MS = 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const LOCKED_REDIRECT_DELAY_MS = 700;

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface SessionGuardProps {
  enabled?: boolean;
}

export default function SessionGuard({ enabled = true }: SessionGuardProps) {
  const [settings, setSettings] = useState<SessionSecuritySettings>(DEFAULT_SESSION_SECURITY);
  const [phase, setPhase] = useState<GuardPhase>('idle');
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_INACTIVITY_TIMEOUT_MINUTES * 60);

  const settingsRef = useRef<SessionSecuritySettings>(DEFAULT_SESSION_SECURITY);
  const phaseRef = useRef<GuardPhase>('idle');
  const deadlineRef = useRef<number>(0);
  const activeTimeoutRef = useRef<number>(0);
  const loggingOutRef = useRef(false);

  const applySettings = useCallback((next: SessionSecuritySettings) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const applyPhase = useCallback((next: GuardPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const restartCountdown = useCallback(() => {
    if (loggingOutRef.current) return;
    const timeoutMs = settingsRef.current.inactivityTimeoutMinutes * 60 * 1000;
    activeTimeoutRef.current = timeoutMs;
    deadlineRef.current = Date.now() + timeoutMs;
    setSecondsLeft(Math.round(timeoutMs / 1000));
    applyPhase('idle');
  }, [applyPhase]);

  const endSession = useCallback(
    (reason: LogoutReason, delayMs = 0) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;

      clearStoredSessionSecurity();

      const payload = JSON.stringify({ reason });

      if (reason === 'inactivity') {
        applyPhase('locked');
      }

      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/auth/logout',
            new Blob([payload], { type: 'application/json' })
          );
        }
      } catch {
        // ignore - best effort during teardown
      }

      try {
        void fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(() => undefined);
      } catch {
        // ignore
      }

      if (reason === 'closed') return;

      window.setTimeout(() => {
        window.location.replace(`/login?reason=${reason}`);
      }, delayMs);
    },
    [applyPhase]
  );

  // Load the signed-in user's saved settings (cached value is the offline fallback).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const cached = readStoredSessionSecurity();
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (!res.ok) throw new Error('profile request failed');
        const data = await res.json();
        const resolved = resolveSessionSecurity(data?.user?.preferences?.sessionSecurity);
        if (cancelled) return;
        applySettings(resolved);
        writeStoredSessionSecurity(resolved);
      } catch {
        if (!cancelled) applySettings(cached);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, applySettings]);

  // Stay in sync when preferences are changed in another tab.
  useEffect(() => {
    if (!enabled) return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_SECURITY_STORAGE_KEY) return;
      let next = DEFAULT_SESSION_SECURITY;
      try {
        next = resolveSessionSecurity(event.newValue ? JSON.parse(event.newValue) : null);
      } catch {
        next = DEFAULT_SESSION_SECURITY;
      }
      applySettings(next);
      restartCountdown();
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [enabled, applySettings, restartCountdown]);

  // Countdown loop. Also (re)arms the deadline whenever the timeout preference changes.
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (loggingOutRef.current) return;

      const timeoutMs = settingsRef.current.inactivityTimeoutMinutes * 60 * 1000;
      if (deadlineRef.current === 0 || activeTimeoutRef.current !== timeoutMs) {
        activeTimeoutRef.current = timeoutMs;
        deadlineRef.current = Date.now() + timeoutMs;
      }

      const remainingMs = deadlineRef.current - Date.now();
      if (remainingMs <= 0) {
        endSession('inactivity', LOCKED_REDIRECT_DELAY_MS);
        return;
      }

      const remaining = Math.ceil(remainingMs / 1000);
      setSecondsLeft(remaining);

      const warnSeconds = Math.min(settingsRef.current.warnBeforeLockSeconds, timeoutMs / 1000);
      if (remaining <= warnSeconds && phaseRef.current === 'idle') {
        applyPhase('warning');
      }
    };

    const interval = window.setInterval(tick, TICK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, endSession, applyPhase]);

  // Mouse / keyboard / touch activity pushes the deadline back.
  useEffect(() => {
    if (!enabled) return;

    let lastReset = 0;
    const onActivity = () => {
      if (loggingOutRef.current || phaseRef.current === 'locked') return;
      const now = Date.now();
      if (now - lastReset < ACTIVITY_THROTTLE_MS) return;
      lastReset = now;
      restartCountdown();
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, onActivity, { passive: true })
    );
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [enabled, restartCountdown]);

  // End the session when the tab or browser actually closes.
  // NOTE: visibilitychange is intentionally NOT used - it also fires when the
  // user merely switches to another tab, which must not end the session.
  useEffect(() => {
    if (!enabled) return;

    const onPageHide = (event: PageTransitionEvent) => {
      if (loggingOutRef.current) return;
      if (!settingsRef.current.logoutOnClose) return;
      // persisted === true means the page entered the back/forward cache.
      if ('persisted' in event && event.persisted) return;
      endSession('closed');
    };

    const onBeforeUnload = () => {
      if (loggingOutRef.current) return;
      if (!settingsRef.current.logoutOnClose) return;
      endSession('closed');
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [enabled, endSession]);

  if (!enabled) return null;

  const totalSeconds = settings.inactivityTimeoutMinutes * 60;
  const progress =
    totalSeconds > 0 ? Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100)) : 0;

  return (
    <>
      {phase === 'warning' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Session Expiring Soon</h3>
                <p className="text-xs text-slate-600">
                  Auto lockout is set to {describeInactivityTimeout(settings.inactivityTimeoutMinutes)} of
                  inactivity.
                </p>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="flex items-end justify-between mb-2">
                <span className="text-sm text-slate-600">Signing out in</span>
                <span className="text-3xl font-bold text-amber-600 tabular-nums">
                  {formatCountdown(secondsLeft)}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-4">
                You will be signed out automatically to protect billing and patient data. Unsaved work on this
                screen will be lost.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <Button className="flex-1" onClick={restartCountdown}>
                Stay Signed In
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  clearStoredSessionSecurity();
                  window.location.replace('/login?reason=manual');
                }}
              >
                Sign Out Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'locked' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900 p-4">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/10 text-white flex items-center justify-center mb-5">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Session Locked</h3>
            <p className="text-sm text-slate-300 mb-6">Returning you to the sign in screen...</p>
            <div className="w-8 h-8 mx-auto border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        </div>
      )}
    </>
  );
}