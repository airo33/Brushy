import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey } from './schedule';

// A short snooze while testing, so you don't wait ten minutes to see the alarm come back.
export const SNOOZE_MINUTES = __DEV__ ? 1 : 10;

export interface SnoozeState {
  /** Monday of the week the counter belongs to, yyyy-mm-dd. */
  week: string;
  /** Snoozes used so far this week. */
  used: number;
  /** When each snoozed alarm rings again, keyed by `${alarmId}@${yyyy-mm-dd}`. */
  until: Record<string, number>;
}

const KEY = 'snooze.v1';

/** The Monday that starts the week containing `d`. Weeks run Monday to Sunday. */
export function weekKey(d: Date): string {
  const sinceMonday = (d.getDay() + 6) % 7;
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday));
}

/** Starts a fresh count on a new week and drops snoozes that ended more than a day ago. */
export function normalize(state: SnoozeState | null, now: Date): SnoozeState {
  const week = weekKey(now);
  const recent = Object.fromEntries(
    Object.entries(state?.until ?? {}).filter(([, t]) => t > now.getTime() - 86_400_000),
  );
  if (!state || state.week !== week) return { week, used: 0, until: recent };
  return { ...state, until: recent };
}

export function snoozesLeft(state: SnoozeState | null, limit: number, now: Date): number {
  return Math.max(0, limit - normalize(state, now).used);
}

/** When this alarm rings again after a snooze, or 0 if it isn't snoozed. */
export function snoozedUntil(state: SnoozeState | null, key: string, now: Date): number {
  return normalize(state, now).until[key] ?? 0;
}

/** Uses one snooze. Returns null when none are left, and the state is unchanged. */
export function applySnooze(state: SnoozeState | null, key: string, limit: number, now: Date): SnoozeState | null {
  const s = normalize(state, now);
  if (s.used >= limit) return null;
  return {
    ...s,
    used: s.used + 1,
    until: { ...s.until, [key]: now.getTime() + SNOOZE_MINUTES * 60_000 },
  };
}

export async function loadSnooze(): Promise<SnoozeState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SnoozeState) : null;
  } catch {
    return null;
  }
}

export async function saveSnooze(state: SnoozeState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
