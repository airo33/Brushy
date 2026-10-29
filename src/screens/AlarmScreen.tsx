import { useEffect, useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Alarm, formatTime } from '../schedule';
import { soundSource, useSettings } from '../settings';
import { SNOOZE_MINUTES, applySnooze, loadSnooze, saveSnooze, snoozesLeft } from '../snooze';
import { colors } from '../theme';

/** Full-screen ringing alarm. The only way out is to brush (or the dev-only dismiss). */
export function AlarmScreen({
  alarm,
  alarmKey,
  onBrush,
  onSnoozed,
  onDevDismiss,
}: {
  alarm: Pick<Alarm, 'hour' | 'minute'>;
  /** `${alarmId}@${day}`, identifies this ring for snoozing. */
  alarmKey: string;
  onBrush: () => void;
  onSnoozed: () => void;
  onDevDismiss: () => void;
}) {
  useKeepAwake();
  const { settings } = useSettings();
  const player = useAudioPlayer(soundSource(settings.sound));
  const [left, setLeft] = useState<number | null>(null);
  const limit = settings.snoozesPerWeek;

  useEffect(() => {
    loadSnooze().then((s) => setLeft(snoozesLeft(s, limit, new Date())));
  }, [limit]);

  const snooze = async () => {
    const next = applySnooze(await loadSnooze(), alarmKey, limit, new Date());
    if (!next) return setLeft(0);
    await saveSnooze(next);
    onSnoozed();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (cancelled) return;
        player.loop = true;
        player.volume = 1;
        player.play();
      } catch {
        // sound is best-effort; haptics and the screen still work
      }
    })();
    const buzz = setInterval(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 1200);
    return () => {
      cancelled = true;
      clearInterval(buzz);
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🪥</Text>
      <Text style={styles.time}>{formatTime(alarm.hour, alarm.minute)}</Text>
      <Text style={styles.title}>Time to brush!</Text>
      <Text style={styles.body}>The alarm stops when you finish brushing.</Text>
      <Pressable style={styles.button} onPress={onBrush}>
        <Text style={styles.buttonText}>Start brushing</Text>
      </Pressable>
      {limit > 0 && left !== null && (
        <Pressable style={styles.snooze} onPress={snooze} disabled={left === 0}>
          <Text style={[styles.snoozeText, left === 0 && styles.snoozeOff]}>
            {left > 0
              ? `Snooze ${SNOOZE_MINUTES} min · ${left} left this week`
              : 'No snoozes left this week'}
          </Text>
        </Pressable>
      )}
      {__DEV__ && (
        <Pressable onPress={onDevDismiss}>
          <Text style={styles.dev}>Dismiss (dev only)</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.alarm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  emoji: { fontSize: 72 },
  time: { fontSize: 72, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  body: { fontSize: 16, color: '#fecaca', textAlign: 'center' },
  button: {
    marginTop: 16,
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
  },
  buttonText: { color: colors.alarm, fontSize: 20, fontWeight: '800' },
  snooze: { marginTop: 4, paddingVertical: 12, paddingHorizontal: 24 },
  snoozeText: { color: '#fff', fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
  snoozeOff: { color: '#fecaca', textDecorationLine: 'none', fontWeight: '500' },
  dev: { color: '#fecaca', marginTop: 24, textDecorationLine: 'underline' },
});
