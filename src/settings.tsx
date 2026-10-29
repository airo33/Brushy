import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyLocalChange, onRemoteApplied } from './syncSignal';

export type SoundId = 'beeps' | 'chime' | 'siren';

export interface Settings {
  /** Length of a brushing session. */
  brushMinutes: number;
  /** Brushes per day needed to keep the streak. */
  dailyGoal: number;
  sound: SoundId;
  /** How many times a week the alarm may be snoozed. 0 turns snooze off. */
  snoozesPerWeek: number;
}

export const DEFAULT_SETTINGS: Settings = { brushMinutes: 2, dailyGoal: 2, sound: 'beeps', snoozesPerWeek: 2 };

export const BRUSH_MINUTE_OPTIONS = [1, 2, 3];
export const DAILY_GOAL_OPTIONS = [1, 2, 3, 4];
export const SNOOZE_OPTIONS = [0, 1, 2, 3, 5];

export const SOUNDS: { id: SoundId; label: string; source: number }[] = [
  { id: 'beeps', label: 'Beeps', source: require('../assets/alarm.wav') },
  { id: 'chime', label: 'Chime', source: require('../assets/alarm-chime.wav') },
  { id: 'siren', label: 'Siren', source: require('../assets/alarm-siren.wav') },
];

export const soundSource = (id: SoundId) => (SOUNDS.find((s) => s.id === id) ?? SOUNDS[0]).source;

const KEY = 'settings.v1';

async function load(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, update: () => {} });

/** Renders nothing until saved settings are loaded, so screens never flash defaults. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    load().then(setSettings);
    // settings pulled from (or cleared after leaving) an account
    return onRemoteApplied(() => load().then(setSettings));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...(prev ?? DEFAULT_SETTINGS), ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next))
        .then(() => notifyLocalChange('settings'))
        .catch(() => {});
      return next;
    });
  }, []);

  if (!settings) return null;
  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
