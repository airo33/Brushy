import { dayKey } from './schedule';

// Brushing sessions per day that make a day count toward the streak.
export const DAILY_GOAL = 2;

/** Sessions per day from completed alarm-days (`${alarmId}@${yyyy-mm-dd}`). */
export function dayCounts(completed: Set<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of completed) {
    const day = entry.slice(entry.lastIndexOf('@') + 1);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

function daysAgo(today: Date, n: number): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
}

/**
 * Consecutive goal-met days. Today is still in progress, so if it isn't met yet
 * the streak runs through yesterday instead of dropping to zero.
 */
export function currentStreak(counts: Map<string, number>, today: Date, goal: number = DAILY_GOAL): number {
  let i = (counts.get(dayKey(today)) ?? 0) >= goal ? 0 : 1;
  let streak = 0;
  while ((counts.get(dayKey(daysAgo(today, i))) ?? 0) >= goal) {
    streak++;
    i++;
  }
  return streak;
}

export function bestStreak(counts: Map<string, number>, goal: number = DAILY_GOAL): number {
  const days = [...counts.entries()]
    .filter(([, c]) => c >= goal)
    .map(([d]) => d)
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | undefined;
  for (const d of days) {
    const [y, m, dd] = d.split('-').map(Number);
    const cur = new Date(y, m - 1, dd);
    const isNext = prev && cur.getTime() === new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1).getTime();
    run = isNext ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export interface HistoryDay {
  day: string;
  label: string;
  count: number;
  met: boolean;
  isToday: boolean;
}

/** Last `n` days, oldest first. */
export function recentHistory(counts: Map<string, number>, today: Date, n: number = 14, goal: number = DAILY_GOAL): HistoryDay[] {
  const out: HistoryDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = daysAgo(today, i);
    const key = dayKey(d);
    const count = counts.get(key) ?? 0;
    out.push({ day: key, label: 'SMTWTFS'[d.getDay()], count, met: count >= goal, isToday: i === 0 });
  }
  return out;
}
