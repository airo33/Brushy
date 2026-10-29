import { dayKey } from './schedule';
import { bestStreak, currentStreak, dayCounts } from './stats';

export interface MyStats {
  currentStreak: number;
  bestStreak: number;
  /** Brushes in the last 7 days, today included. */
  weekCount: number;
  /** Most recent day with any brush, yyyy-mm-dd. */
  lastBrushDay: string | null;
  /** Most recent day the daily goal was met, yyyy-mm-dd. */
  lastMetDay: string | null;
}

const daysAgo = (today: Date, n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);

/** The numbers shared with friends, computed from this phone's brushing history. */
export function computeStats(completed: Set<string>, goal: number, today: Date): MyStats {
  const counts = dayCounts(completed);

  let weekCount = 0;
  for (let i = 0; i < 7; i++) weekCount += counts.get(dayKey(daysAgo(today, i))) ?? 0;

  const todayKey = dayKey(today);
  let lastBrushDay: string | null = null;
  let lastMetDay: string | null = null;
  for (const [day, count] of counts) {
    if (day > todayKey) continue; // ignore anything dated in the future
    if (count > 0 && (!lastBrushDay || day > lastBrushDay)) lastBrushDay = day;
    if (count >= goal && (!lastMetDay || day > lastMetDay)) lastMetDay = day;
  }

  return {
    currentStreak: Math.min(3650, currentStreak(counts, today, goal)),
    bestStreak: Math.min(3650, bestStreak(counts, goal)),
    weekCount: Math.min(28, weekCount),
    lastBrushDay,
    lastMetDay,
  };
}

/**
 * A stored streak only counts while it is alive: the goal was met today or yesterday.
 * Otherwise a friend who stopped brushing would keep their old number forever.
 */
export function effectiveStreak(currentStreakValue: number | null, lastMetDay: string | null, today: Date): number {
  if (!currentStreakValue || !lastMetDay) return 0;
  return lastMetDay >= dayKey(daysAgo(today, 1)) ? currentStreakValue : 0;
}

/** The 7-day count only holds if the friend brushed within the last 7 days. */
export function effectiveWeek(weekCount: number | null, lastBrushDay: string | null, today: Date): number {
  if (!weekCount || !lastBrushDay) return 0;
  return lastBrushDay >= dayKey(daysAgo(today, 6)) ? weekCount : 0;
}

export interface LeaderboardEntry {
  name: string;
  isMe: boolean;
  streak: number;
  best: number;
  week: number;
  brushedToday: boolean;
}

/** Longest streak first; ties go to whoever brushed more this week, then alphabetical. */
export function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(
    (a, b) => b.streak - a.streak || b.week - a.week || a.name.localeCompare(b.name),
  );
}
