import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { syncNotifications, ensurePermission } from '../notifications';
import {
  Alarm,
  dayKey,
  formatTime,
  loadAlarms,
  clearHistory,
  loadCompleted,
  saveAlarms,
  seedTestStreak,
} from '../schedule';
import { useAuth } from '../auth';
import { useSettings } from '../settings';
import { ShareStreakModal } from '../ShareStreak';
import { Proof, deleteProof, loadProofs } from '../proofs';
import { PhotoViewer } from './PhotoViewer';
import { bestStreak, currentStreak, dayCounts, recentHistory } from '../stats';
import { colors, radius, shadow } from '../theme';

function partOfDay(hour: number) {
  if (hour < 5) return 'Night';
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

// Warn about disabled notifications once per app launch, not every time the screen remounts.
let warnedAboutNotifications = false;

export function ScheduleScreen({
  onStartBrushing,
  onTestRing,
  onOpenSettings,
  onOpenFriends,
}: {
  onStartBrushing: () => void;
  onTestRing: () => void;
  onOpenSettings: () => void;
  onOpenFriends: () => void;
}) {
  const auth = useAuth();
  const { settings } = useSettings();
  const goal = settings.dailyGoal;
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, c] = await Promise.all([loadAlarms(), loadCompleted()]);
      setAlarms(a);
      setCompleted(c);
      setProofs(await loadProofs());
      setLoaded(true);
      if (!(await ensurePermission()) && !warnedAboutNotifications) {
        warnedAboutNotifications = true;
        Alert.alert('Notifications are off', 'Turn them on in Settings so the alarm can remind you.');
      }
      setScheduled(await syncNotifications(a));
    })();
  }, []);

  const update = useCallback(async (next: Alarm[]) => {
    setAlarms(next);
    await saveAlarms(next);
    setScheduled(await syncNotifications(next));
  }, []);

  const change = (id: string, patch: Partial<Alarm>) =>
    update(alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const add = () =>
    update([...alarms, { id: `a${Date.now()}`, hour: 13, minute: 0, enabled: true }]);

  const remove = (id: string) => update(alarms.filter((a) => a.id !== id));

  const today = dayKey(new Date());
  const enabled = alarms.filter((a) => a.enabled);
  const doneToday = enabled.filter((a) => completed.has(`${a.id}@${today}`)).length;

  const stats = useMemo(() => {
    const counts = dayCounts(completed);
    const now = new Date();
    return {
      streak: currentStreak(counts, now, goal),
      best: bestStreak(counts, goal),
      history: recentHistory(counts, now, 14, goal),
      total: counts.size === 0 ? 0 : [...counts.values()].reduce((a, b) => a + b, 0),
    };
  }, [completed, goal]);

  // sessions that have at least one saved photo
  const gallery = proofs.filter((p) => p.start || p.end);

  if (!loaded) return null;

  const allDone = enabled.length > 0 && doneToday >= enabled.length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Brushy</Text>
          <View style={styles.headerLinks}>
            {auth.configured && (
              <Pressable onPress={onOpenFriends} hitSlop={12}>
                <Text style={styles.gear}>👥 Friends</Text>
              </Pressable>
            )}
            <Pressable onPress={onOpenSettings} hitSlop={12}>
              <Text style={styles.gear}>⚙︎ Settings</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.headline}>
          {allDone ? 'All clean today 🎉' : `${doneToday} of ${enabled.length} brushed today`}
        </Text>
        <View style={styles.pills}>
          {enabled.map((a) => {
            const done = completed.has(`${a.id}@${today}`);
            return (
              <View key={a.id} style={[styles.pill, done && styles.pillDone]}>
                <Text style={[styles.pillText, done && styles.pillTextDone]}>
                  {done ? '✓ ' : ''}
                  {partOfDay(a.hour)}
                </Text>
              </View>
            );
          })}
        </View>
        <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={onStartBrushing}>
          <Text style={styles.ctaText}>Start brushing</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.streakRow}>
            <View style={styles.stat}>
              <Text style={styles.streakNum}>🔥 {stats.streak}</Text>
              <Text style={styles.statLabel}>day streak</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.best}</Text>
              <Text style={styles.statLabel}>best</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.total}</Text>
              <Text style={styles.statLabel}>brushes</Text>
            </View>
          </View>
          <View style={styles.history}>
            {stats.history.map((h) => (
              <View key={h.day} style={styles.dayCol}>
                <View
                  style={[
                    styles.dot,
                    h.met ? styles.dotMet : h.count > 0 ? styles.dotPartial : styles.dotNone,
                    h.isToday && styles.dotToday,
                  ]}
                />
                <Text style={styles.dayLabel}>{h.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.hintText}>Brush {goal}× a day to keep your streak · last 14 days</Text>
          {stats.streak > 0 && (
            <Pressable style={styles.shareButton} onPress={() => setSharing(true)}>
              <Text style={styles.shareText}>Share my streak</Text>
            </Pressable>
          )}
        </View>

        {gallery.length > 0 && (
          <>
            <Text style={styles.section}>Brush photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {gallery.slice(0, 20).map((p, i) => {
                const uri = p.end ?? p.start;
                const d = new Date(p.ts);
                return (
                  <Pressable key={p.id} style={styles.photoItem} onPress={() => setViewing(i)}>
                    <Image source={{ uri }} style={styles.photo} />
                    <Text style={styles.photoDate}>
                      {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                      {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <Text style={styles.section}>Alarms</Text>

        {alarms.map((a) => {
          const done = completed.has(`${a.id}@${today}`);
          return (
            <View key={a.id} style={[styles.card, !a.enabled && styles.cardOff]}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.alarmLabel}>
                    {partOfDay(a.hour)}
                    {done ? '  ✓ done today' : ''}
                  </Text>
                  <TimeField alarm={a} onChange={(hour, minute) => change(a.id, { hour, minute })} />
                </View>
                <View style={styles.right}>
                  <Switch
                    value={a.enabled}
                    onValueChange={(v) => change(a.id, { enabled: v })}
                    trackColor={{ true: colors.primary, false: colors.line }}
                  />
                  {alarms.length > 1 && (
                    <Pressable onPress={() => remove(a.id)} hitSlop={10}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} onPress={add}>
          <Text style={styles.addText}>+ Add alarm</Text>
        </Pressable>

        {__DEV__ && (
          <>
            <Pressable style={styles.devButton} onPress={onTestRing}>
              <Text style={styles.devText}>Test the ringing alarm (dev only)</Text>
            </Pressable>
            <Pressable style={styles.devButton} onPress={async () => setCompleted(await seedTestStreak(6))}>
              <Text style={styles.devText}>Add a fake 6-day streak (dev only)</Text>
            </Pressable>
            <Pressable style={styles.devButton} onPress={async () => setCompleted(await clearHistory())}>
              <Text style={styles.devText}>Clear brushing history (dev only)</Text>
            </Pressable>
          </>
        )}

        {scheduled !== null && (
          <Text style={styles.footer}>
            {scheduled} reminders scheduled for the next few days. Each alarm repeats until you brush.
          </Text>
        )}
      </View>
      {viewing !== null && (
        <PhotoViewer
          items={gallery}
          startIndex={Math.min(viewing, gallery.length - 1)}
          onClose={() => setViewing(null)}
          onDelete={async (id) => {
            await deleteProof(id);
            setProofs(await loadProofs());
          }}
        />
      )}
      <ShareStreakModal
        visible={sharing}
        streak={stats.streak}
        history={stats.history}
        onClose={() => setSharing(false)}
      />
    </ScrollView>
  );
}

function TimeField({ alarm, onChange }: { alarm: Alarm; onChange: (hour: number, minute: number) => void }) {
  const value = new Date();
  value.setHours(alarm.hour, alarm.minute, 0, 0);

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode="time"
        display="compact"
        themeVariant="light"
        accentColor={colors.primary}
        style={styles.picker}
        onChange={(_, d) => d && onChange(d.getHours(), d.getMinutes())}
      />
    );
  }
  return (
    <Pressable
      onPress={() =>
        DateTimePickerAndroid.open({
          value,
          mode: 'time',
          is24Hour: true,
          onChange: (_, d) => d && onChange(d.getHours(), d.getMinutes()),
        })
      }
    >
      <Text style={styles.digits}>{formatTime(alarm.hour, alarm.minute)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { paddingBottom: 40 },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 72,
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 12,
  },
  brand: { color: colors.primarySoft, fontSize: 15, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  headline: { color: '#fff', fontSize: 30, fontWeight: '800' },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill },
  pillDone: { backgroundColor: '#fff' },
  pillText: { color: '#fff', fontWeight: '600' },
  pillTextDone: { color: colors.primaryDark },
  cta: { backgroundColor: '#fff', paddingVertical: 16, borderRadius: radius.button, alignItems: 'center', marginTop: 8 },
  ctaText: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  body: { padding: 20, gap: 14 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 18, gap: 14, ...shadow },
  cardOff: { opacity: 0.5 },
  section: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8 },
  streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: 36, backgroundColor: colors.line },
  streakNum: { fontSize: 30, fontWeight: '800', color: colors.text },
  statNum: { fontSize: 30, fontWeight: '800', color: colors.muted },
  statLabel: { color: colors.muted, fontSize: 13 },
  history: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotMet: { backgroundColor: colors.success },
  dotPartial: { backgroundColor: colors.warn },
  dotNone: { backgroundColor: colors.line },
  dotToday: { borderWidth: 2, borderColor: colors.primary },
  dayLabel: { fontSize: 10, color: colors.muted },
  shareButton: { alignSelf: 'center', backgroundColor: colors.primarySoft, paddingVertical: 10, paddingHorizontal: 22, borderRadius: radius.pill },
  shareText: { color: colors.primaryDark, fontWeight: '700' },
  hintText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  photos: { gap: 12, paddingVertical: 2 },
  photoItem: { alignItems: 'center', gap: 6 },
  photo: { width: 110, height: 146, borderRadius: radius.button, backgroundColor: colors.line },
  photoDate: { fontSize: 11, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alarmLabel: { color: colors.muted, fontWeight: '600', marginBottom: 4 },
  picker: { alignSelf: 'flex-start', marginLeft: -10 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLinks: { flexDirection: 'row', gap: 16 },
  gear: { color: colors.primarySoft, fontSize: 15, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 14 },
  colon: { fontSize: 36, fontWeight: '800', color: colors.text },
  stepper: { alignItems: 'center' },
  arrow: { fontSize: 14, color: colors.primary, padding: 2 },
  digits: { fontSize: 40, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  remove: { color: colors.danger, fontSize: 13 },
  addButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.button,
    padding: 14,
    alignItems: 'center',
  },
  addText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  devButton: { alignItems: 'center', padding: 8 },
  devText: { color: colors.muted, textDecorationLine: 'underline' },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
