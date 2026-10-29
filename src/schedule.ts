import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyLocalChange } from './syncSignal';

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

const ALARMS_KEY = 'alarms.v1';
const DONE_KEY = 'completions.v1';

export const DEFAULT_ALARMS: Alarm[] = [
  { id: 'morning', hour: 8, minute: 0, enabled: true },
  { id: 'evening', hour: 21, minute: 0, enabled: true },
];

// After the alarm time, nag again at these offsets (minutes) until brushing is done.
export const NAG_OFFSETS_MIN = [0, 5, 10, 20];
// iOS keeps at most 64 pending local notifications; stay under that.
export const MAX_PENDING = 60;
export const MAX_HORIZON_DAYS = 14;

/** How many days ahead fit under the pending-notification limit for this many enabled alarms. */
export function horizonDays(enabledAlarms: number): number {
  const perDay = Math.max(1, enabledAlarms) * NAG_OFFSETS_MIN.length;
  return Math.max(1, Math.min(MAX_HORIZON_DAYS, Math.floor(MAX_PENDING / perDay)));
}
// A brushing session counts toward an alarm if it finishes within this window after it.
export const COMPLETION_WINDOW_MIN = 120;

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function alarmDate(alarm: Alarm, day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), alarm.hour, alarm.minute, 0, 0);
}

export interface Occurrence {
  /** Stable id: alarm + day + nag index. */
  id: string;
  alarmId: string;
  day: string;
  nag: number;
  at: Date;
}

/** All notification times for enabled alarms over the horizon, after `now`, skipping completed alarm-days. */
export function occurrences(
  alarms: Alarm[],
  now: Date,
  completed: Set<string>,
  days: number = horizonDays(alarms.filter((a) => a.enabled).length),
  /** Snoozed alarms: `${alarmId}@${day}` -> when they ring again (ms). */
  snoozes: Record<string, number> = {},
): Occurrence[] {
  const out: Occurrence[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const key = dayKey(day);
    for (const alarm of alarms) {
      if (!alarm.enabled || completed.has(`${alarm.id}@${key}`)) continue;
      const base = alarmDate(alarm, day).getTime();
      NAG_OFFSETS_MIN.forEach((off, nag) => {
        const at = new Date(base + off * 60_000);
        const snoozedUntil = snoozes[`${alarm.id}@${key}`] ?? 0;
        if (at.getTime() > now.getTime() && at.getTime() >= snoozedUntil) {
          out.push({ id: `${alarm.id}|${key}|${nag}`, alarmId: alarm.id, day: key, nag, at });
        }
      });
      // the snooze is over: ring again
      const until = snoozes[`${alarm.id}@${key}`] ?? 0;
      if (until > now.getTime()) {
        out.push({ id: `${alarm.id}|${key}|snooze`, alarmId: alarm.id, day: key, nag: 0, at: new Date(until) });
      }
    }
  }
  return out;
}

export interface DueAlarm {
  alarm: Alarm;
  /** The day the alarm rang (yesterday, for an alarm just before midnight). */
  day: string;
}

/**
 * The alarm a just-finished session counts for: the latest alarm that already rang within the
 * window and isn't done yet. Looks at yesterday too, so a 23:30 alarm can still be completed at 00:10.
 */
export function alarmForCompletion(alarms: Alarm[], now: Date, completed: Set<string>): DueAlarm | undefined {
  const due: { alarm: Alarm; day: string; t: number }[] = [];
  for (const offset of [0, 1]) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const day = dayKey(date);
    for (const alarm of alarms) {
      if (!alarm.enabled || completed.has(`${alarm.id}@${day}`)) continue;
      const t = alarmDate(alarm, date).getTime();
      if (t <= now.getTime() && now.getTime() - t <= COMPLETION_WINDOW_MIN * 60_000) due.push({ alarm, day, t });
    }
  }
  due.sort((x, y) => y.t - x.t);
  return due[0] && { alarm: due[0].alarm, day: due[0].day };
}

export async function loadAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(ALARMS_KEY);
    return raw ? (JSON.parse(raw) as Alarm[]) : DEFAULT_ALARMS;
  } catch {
    return DEFAULT_ALARMS;
  }
}

export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
  notifyLocalChange('alarms');
}

/** Completed alarm-days, stored as `${alarmId}@${yyyy-mm-dd}`. */
export async function loadCompleted(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(DONE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function markCompleted(alarm: Alarm, day: string): Promise<Set<string>> {
  const set = await loadCompleted();
  set.add(`${alarm.id}@${day}`);
  // keep roughly the last year
  const keep = [...set].slice(-800);
  await AsyncStorage.setItem(DONE_KEY, JSON.stringify(keep));
  notifyLocalChange('completed');
  return new Set(keep);
}

/** Dev only: pretend the last `days` days (not today) were fully brushed. */
export async function seedTestStreak(days: number, now: Date = new Date()): Promise<Set<string>> {
  const set = await loadCompleted();
  for (let i = 1; i <= days; i++) {
    const key = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    set.add(`morning@${key}`);
    set.add(`evening@${key}`);
  }
  await AsyncStorage.setItem(DONE_KEY, JSON.stringify([...set]));
  return set;
}

/** Dev only: wipe brushing history. */
export async function clearHistory(): Promise<Set<string>> {
  await AsyncStorage.removeItem(DONE_KEY);
  return new Set();
}
