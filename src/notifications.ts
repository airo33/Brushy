import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Alarm, MAX_PENDING, occurrences, loadCompleted } from './schedule';
import { loadSnooze, normalize } from './snooze';

const CHANNEL_ID = 'brush-alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// Syncs run one at a time: two overlapping runs could cancel each other's schedules.
let chain: Promise<unknown> = Promise.resolve();

/** Cancel everything and schedule the next few days from the current alarms. */
export function syncNotifications(alarms: Alarm[]): Promise<number> {
  const run = chain.then(() => doSync(alarms));
  chain = run.catch(() => {});
  return run;
}

async function doSync(alarms: Alarm[]): Promise<number> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Brush alarm',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await ensurePermission())) return 0;

  const completed = await loadCompleted();
  const now = new Date();
  const snoozes = normalize(await loadSnooze(), now).until;
  const list = occurrences(alarms, now, completed, undefined, snoozes).slice(0, MAX_PENDING);
  for (const o of list) {
    await Notifications.scheduleNotificationAsync({
      identifier: o.id,
      content: {
        title: o.nag === 0 ? 'Time to brush your teeth 🦷' : 'Still need to brush!',
        body: 'Open the app and brush your teeth to turn this alarm off.',
        sound: true,
        data: { alarmId: o.alarmId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: o.at,
        channelId: CHANNEL_ID,
      },
    });
  }
  return list.length;
}
