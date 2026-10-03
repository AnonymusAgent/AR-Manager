export const SESSION_INACTIVITY_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 2, label: '2 minutes' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
] as const;

export const SESSION_INACTIVITY_VALUES: number[] = SESSION_INACTIVITY_OPTIONS.map(
  (option) => option.value
);

export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 5;
export const DEFAULT_LOGOUT_ON_CLOSE = true;
export const DEFAULT_WARN_BEFORE_LOCK_SECONDS = 60;

export const MIN_WARN_BEFORE_LOCK_SECONDS = 15;
export const MAX_WARN_BEFORE_LOCK_SECONDS = 300;

export const WARN_BEFORE_LOCK_OPTIONS = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
] as const;

export const SESSION_SECURITY_STORAGE_KEY = 'ar_session_security';

export interface SessionSecuritySettings {
  inactivityTimeoutMinutes: number;
  logoutOnClose: boolean;
  warnBeforeLockSeconds: number;
}

export const DEFAULT_SESSION_SECURITY: SessionSecuritySettings = {
  inactivityTimeoutMinutes: DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  logoutOnClose: DEFAULT_LOGOUT_ON_CLOSE,
  warnBeforeLockSeconds: DEFAULT_WARN_BEFORE_LOCK_SECONDS,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function resolveInactivityTimeout(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  return SESSION_INACTIVITY_VALUES.includes(parsed)
    ? parsed
    : DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
}

export function resolveWarnBeforeLock(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_WARN_BEFORE_LOCK_SECONDS;
  return clamp(Math.round(parsed), MIN_WARN_BEFORE_LOCK_SECONDS, MAX_WARN_BEFORE_LOCK_SECONDS);
}

export function resolveSessionSecurity(raw: unknown): SessionSecuritySettings {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    inactivityTimeoutMinutes: resolveInactivityTimeout(
      source.inactivityTimeoutMinutes ?? DEFAULT_INACTIVITY_TIMEOUT_MINUTES
    ),
    logoutOnClose:
      typeof source.logoutOnClose === 'boolean'
        ? source.logoutOnClose
        : DEFAULT_LOGOUT_ON_CLOSE,
    warnBeforeLockSeconds: resolveWarnBeforeLock(
      source.warnBeforeLockSeconds ?? DEFAULT_WARN_BEFORE_LOCK_SECONDS
    ),
  };
}

export function describeInactivityTimeout(minutes: number): string {
  const option = SESSION_INACTIVITY_OPTIONS.find((item) => item.value === minutes);
  return option?.label ?? `${minutes} minutes`;
}

export function readStoredSessionSecurity(): SessionSecuritySettings {
  if (typeof window === 'undefined') return DEFAULT_SESSION_SECURITY;
  try {
    const raw = window.localStorage.getItem(SESSION_SECURITY_STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION_SECURITY;
    return resolveSessionSecurity(JSON.parse(raw));
  } catch {
    return DEFAULT_SESSION_SECURITY;
  }
}

export function writeStoredSessionSecurity(settings: SessionSecuritySettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_SECURITY_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode / quota) - guard still works in-memory
  }
}

export function clearStoredSessionSecurity() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_SECURITY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
