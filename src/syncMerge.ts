export interface LocalData {
  alarms: unknown | null;
  alarmsAt: number;
  settings: unknown | null;
  settingsAt: number;
  completed: string[];
}

export interface RemoteRow {
  alarms: unknown | null;
  alarms_at: number;
  settings: unknown | null;
  settings_at: number;
  completed: string[];
}

export interface MergeResult {
  /** What the device should hold afterwards. */
  merged: LocalData;
  /** What changed on the device because of the account's data. */
  appliedAlarms: boolean;
  appliedSettings: boolean;
  appliedCompleted: boolean;
}

const MAX_COMPLETED = 800;

/**
 * Alarms and settings: the most recently edited copy wins.
 * Brushing history: set union, so a brush recorded on either phone is never lost.
 */
export function mergeData(local: LocalData, remote: RemoteRow | null): MergeResult {
  if (!remote) {
    return { merged: local, appliedAlarms: false, appliedSettings: false, appliedCompleted: false };
  }

  const takeRemoteAlarms = remote.alarms != null && remote.alarms_at > local.alarmsAt;
  const takeRemoteSettings = remote.settings != null && remote.settings_at > local.settingsAt;

  const seen = new Set<string>();
  const union: string[] = [];
  for (const entry of [...remote.completed, ...local.completed]) {
    if (!seen.has(entry)) {
      seen.add(entry);
      union.push(entry);
    }
  }
  const completed = union.slice(-MAX_COMPLETED);
  const localSet = new Set(local.completed);

  return {
    merged: {
      alarms: takeRemoteAlarms ? remote.alarms : local.alarms,
      alarmsAt: takeRemoteAlarms ? remote.alarms_at : local.alarmsAt,
      settings: takeRemoteSettings ? remote.settings : local.settings,
      settingsAt: takeRemoteSettings ? remote.settings_at : local.settingsAt,
      completed,
    },
    appliedAlarms: takeRemoteAlarms,
    appliedSettings: takeRemoteSettings,
    appliedCompleted: completed.some((c) => !localSet.has(c)),
  };
}
