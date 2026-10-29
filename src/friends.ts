import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeStats } from './friendsStats';
import { supabase } from './supabase';
import { onLocalChange, onRemoteApplied } from './syncSignal';

export interface FriendRow {
  /** null for your own row. */
  friendshipId: string | null;
  status: 'me' | 'pending' | 'accepted';
  /** For pending rows: true if they asked you, false if you asked them. */
  incoming: boolean;
  name: string;
  currentStreak: number | null;
  bestStreak: number | null;
  weekCount: number | null;
  lastBrushDay: string | null;
  lastMetDay: string | null;
  isMe: boolean;
}

export interface MyProfile {
  name: string;
  code: string;
}

// Plain-English messages for what the server returns when sending a request.
export const REQUEST_RESULT: Record<string, string> = {
  sent: 'Request sent. They need to accept it before you can see each other.',
  accepted: 'You are now friends! They had already asked you.',
  already_friends: 'You are already friends.',
  already_pending: 'You already sent them a request.',
  not_found: 'No one has that code. Check it and try again.',
  self: "That's your own code.",
  you_blocked: 'You blocked this person. Unblock them first if you want to add them.',
  no_profile: 'Create your profile first.',
  not_signed_in: 'Sign in first.',
};

const DONE_KEY = 'completions.v1';
const SETTINGS_KEY = 'settings.v1';

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, friend_code')
    .eq('user_id', userId)
    .maybeSingle();
  fail(error);
  return data ? { name: data.display_name, code: data.friend_code } : null;
}

export async function createProfile(name: string): Promise<MyProfile> {
  if (!supabase) throw new Error('Accounts are not set up.');
  const trimmed = name.trim();
  const { data, error } = await supabase.rpc('create_profile', { p_name: trimmed });
  if (error) {
    if (/bad_name/.test(error.message)) throw new Error('Use a name with 2 to 20 characters.');
    if (/profile_exists/.test(error.message)) throw new Error('You already have a profile.');
    throw new Error(error.message);
  }
  return { name: trimmed, code: data as string };
}

export async function fetchFriends(): Promise<FriendRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_friends');
  fail(error);
  return ((data ?? []) as any[]).map((r) => ({
    friendshipId: r.friendship_id,
    status: r.status,
    incoming: r.incoming,
    name: r.display_name,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
    weekCount: r.week_count,
    lastBrushDay: r.last_brush_day,
    lastMetDay: r.last_met_day,
    isMe: r.is_me,
  }));
}

/** Returns the server's result code; see REQUEST_RESULT. */
export async function sendRequest(code: string): Promise<string> {
  if (!supabase) return 'not_signed_in';
  const { data, error } = await supabase.rpc('send_friend_request', { p_code: code });
  fail(error);
  return data as string;
}

export async function respondToRequest(id: string, accept: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('respond_friend_request', { p_id: id, p_accept: accept });
  fail(error);
}

export async function removeFriendship(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('remove_friendship', { p_id: id });
  fail(error);
}

export type ReportReason = 'inappropriate_name' | 'harassment' | 'spam' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'inappropriate_name', label: 'Inappropriate name' },
  { id: 'harassment', label: 'Harassment or unwanted requests' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Something else' },
];

/** Records a report for review. The reported person is not told. */
export async function reportUser(friendshipId: string, reason: ReportReason, details: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('report_user', {
    p_friendship_id: friendshipId,
    p_reason: reason,
    p_details: details.trim() || null,
  });
  if (error) {
    if (/too_many_reports/.test(error.message)) throw new Error('You have sent a lot of reports today. Try again tomorrow.');
    throw new Error(error.message);
  }
}

/** Blocks the other person and removes the friendship. They are not told. */
export async function blockUser(friendshipId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('block_user', { p_friendship_id: friendshipId });
  fail(error);
}

export interface BlockedPerson {
  userId: string;
  name: string;
}

export async function fetchBlocked(): Promise<BlockedPerson[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_blocked');
  fail(error);
  return ((data ?? []) as any[]).map((r) => ({ userId: r.user_id, name: r.display_name }));
}

export async function unblockUser(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('unblock_user', { p_user: userId });
  fail(error);
}

export async function deleteMyProfile(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('delete_my_profile');
  fail(error);
}

/** Send this phone's streak numbers to the profile. Does nothing if there is no profile yet. */
export async function pushMyStats(userId: string): Promise<void> {
  if (!supabase) return;
  const completed = new Set((await readJson<string[]>(DONE_KEY)) ?? []);
  const goal = (await readJson<{ dailyGoal?: number }>(SETTINGS_KEY))?.dailyGoal ?? 2;
  const s = computeStats(completed, goal, new Date());

  const { error } = await supabase
    .from('profiles')
    .update({
      current_streak: s.currentStreak,
      best_streak: s.bestStreak,
      week_count: s.weekCount,
      last_brush_day: s.lastBrushDay,
      last_met_day: s.lastMetDay,
      stats_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  fail(error);
}

/** While signed in, keep the shared numbers fresh a few seconds after brushing history changes. */
export function startStatsPush(userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const push = () => {
    pushMyStats(userId).catch(() => {}); // friends is optional; never let it disturb the rest of the app
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(push, 3000);
  };

  push();
  const offLocal = onLocalChange((kind) => {
    if (kind === 'completed' || kind === 'settings') schedule();
  });
  const offRemote = onRemoteApplied(schedule);

  return () => {
    clearTimeout(timer);
    offLocal();
    offRemote();
  };
}
