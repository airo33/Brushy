import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { LocalData, RemoteRow, mergeData } from './syncMerge';
import { ChangeKind, notifyRemoteApplied, onLocalChange } from './syncSignal';

// Same keys the rest of the app writes to.
const ALARMS_KEY = 'alarms.v1';
const SETTINGS_KEY = 'settings.v1';
const DONE_KEY = 'completions.v1';
const META_KEY = 'sync.meta.v1';

const PUSH_DELAY_MS = 2000;

interface Meta {
  alarmsAt: number;
  settingsAt: number;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const readMeta = async (): Promise<Meta> => ({
  alarmsAt: 0,
  settingsAt: 0,
  ...(await readJson<Partial<Meta>>(META_KEY)),
});

// Syncs run one at a time so a pull can't interleave with a push.
let chain: Promise<unknown> = Promise.resolve();

/** Merge this device with the account, then write the result to both. Safe to call any time. */
export function syncNow(userId: string): Promise<void> {
  const run = chain.then(() => doSync(userId));
  chain = run.catch(() => {});
  return run;
}

async function doSync(userId: string): Promise<void> {
  if (!supabase) return;

  const { data, error } = await supabase.from('user_data').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;

  const meta = await readMeta();
  const local: LocalData = {
    alarms: await readJson(ALARMS_KEY),
    alarmsAt: meta.alarmsAt,
    settings: await readJson(SETTINGS_KEY),
    settingsAt: meta.settingsAt,
    completed: (await readJson<string[]>(DONE_KEY)) ?? [],
  };

  const result = mergeData(local, (data as RemoteRow | null) ?? null);
  const m = result.merged;

  // Write what came from the account to this device.
  if (result.appliedAlarms) await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(m.alarms));
  if (result.appliedSettings) await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(m.settings));
  if (result.appliedCompleted) await AsyncStorage.setItem(DONE_KEY, JSON.stringify(m.completed));
  if (result.appliedAlarms || result.appliedSettings) {
    await AsyncStorage.setItem(META_KEY, JSON.stringify({ alarmsAt: m.alarmsAt, settingsAt: m.settingsAt }));
  }

  // Write the merged result to the account.
  const { error: pushError } = await supabase.from('user_data').upsert({
    user_id: userId,
    alarms: m.alarms,
    alarms_at: m.alarmsAt,
    settings: m.settings,
    settings_at: m.settingsAt,
    completed: m.completed,
    updated_at: new Date().toISOString(),
  });
  if (pushError) throw pushError;

  if (result.appliedAlarms || result.appliedSettings || result.appliedCompleted) notifyRemoteApplied();
}

let stop: (() => void) | null = null;

/** While signed in, push local edits to the account a moment after they happen. */
export function startSync(userId: string): void {
  stopSync();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const off = onLocalChange(async (kind: ChangeKind) => {
    if (kind !== 'completed') {
      const meta = await readMeta();
      const now = Date.now();
      await AsyncStorage.setItem(
        META_KEY,
        JSON.stringify(kind === 'alarms' ? { ...meta, alarmsAt: now } : { ...meta, settingsAt: now }),
      );
    }
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(userId).catch(() => {}), PUSH_DELAY_MS);
  });

  stop = () => {
    clearTimeout(timer);
    off();
  };
}

export function stopSync(): void {
  stop?.();
  stop = null;
}

/** After signing out, remove this account's data from the phone so the next person can't see or merge it. */
export async function clearLocalAccountData(): Promise<void> {
  await AsyncStorage.multiRemove([ALARMS_KEY, SETTINGS_KEY, DONE_KEY, META_KEY]);
  notifyRemoteApplied();
}
