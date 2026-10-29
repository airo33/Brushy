import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth';
import { useAudioPlayer } from 'expo-audio';
import {
  BRUSH_MINUTE_OPTIONS,
  DAILY_GOAL_OPTIONS,
  SNOOZE_OPTIONS,
  SOUNDS,
  SoundId,
  useSettings,
} from '../settings';
import { SNOOZE_MINUTES } from '../snooze';
import { colors, radius, shadow } from '../theme';

export function SettingsScreen({ onBack, onOpenAuth }: { onBack: () => void; onOpenAuth: () => void }) {
  const { settings, update } = useSettings();
  const auth = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);

  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      'Your streak and settings stay safe in your account. This phone will start fresh until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          onPress: async () => {
            const res = await auth.signOut();
            if (!res.error) return;
            // The backup failed. Let the user choose between waiting and losing recent changes.
            Alert.alert('Could not back up', `${res.error}\n\nIf you sign out anyway, changes since your last backup are lost.`, [
              { text: 'Stay signed in', style: 'cancel' },
              { text: 'Sign out anyway', style: 'destructive', onPress: () => auth.signOut(true) },
            ]);
          },
        },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and the backup of your streak, alarms and settings. Data on this phone stays. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            const res = await auth.deleteAccount();
            if (res.error) Alert.alert('Could not delete the account', res.error);
          },
        },
      ],
    );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.top}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      {auth.configured && (
        <Section
          title="Account"
          note={auth.signedIn ? `Signed in as ${auth.email}` : 'Back up your streak, alarms and settings, and get them on a new phone.'}
        >
          {auth.signedIn ? (
            <>
              {auth.syncError && <Text style={styles.error}>Sync problem: {auth.syncError}</Text>}
              <Pressable style={styles.accountButton} onPress={() => auth.syncNow()}>
                <Text style={styles.accountText}>Sync now</Text>
              </Pressable>
              {changingPassword ? (
                <ChangePasswordForm
                  onCancel={() => setChangingPassword(false)}
                  onDone={() => {
                    setChangingPassword(false);
                    Alert.alert('Password changed', 'Use your new password next time you sign in.');
                  }}
                />
              ) : (
                <Pressable style={styles.accountButton} onPress={() => setChangingPassword(true)}>
                  <Text style={styles.accountText}>Change password</Text>
                </Pressable>
              )}
              <Pressable style={styles.accountButton} onPress={confirmSignOut}>
                <Text style={styles.accountText}>Sign out</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} hitSlop={8}>
                <Text style={styles.deleteText}>Delete my account</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.accountButton} onPress={onOpenAuth}>
              <Text style={styles.accountText}>Sign in or create account</Text>
            </Pressable>
          )}
        </Section>
      )}

      <Section title="Brushing time" note="How long the timer runs each session.">
        <Choice
          options={BRUSH_MINUTE_OPTIONS.map((m) => ({ value: m, label: `${m} min` }))}
          selected={settings.brushMinutes}
          onSelect={(v) => update({ brushMinutes: v })}
        />
      </Section>

      <Section title="Daily goal" note="Brushes per day needed to keep your streak. Add alarms on the home screen to match.">
        <Choice
          options={DAILY_GOAL_OPTIONS.map((m) => ({ value: m, label: `${m}×` }))}
          selected={settings.dailyGoal}
          onSelect={(v) => update({ dailyGoal: v })}
        />
      </Section>

      <Section
        title="Snooze limit"
        note={`How many times a week you can snooze the alarm. Each snooze pauses it for ${SNOOZE_MINUTES} minute${SNOOZE_MINUTES === 1 ? '' : 's'}. The count starts again every Monday.`}
      >
        <Choice
          options={SNOOZE_OPTIONS.map((m) => ({ value: m, label: m === 0 ? 'Off' : `${m}×` }))}
          selected={settings.snoozesPerWeek}
          onSelect={(v) => update({ snoozesPerWeek: v })}
        />
      </Section>

      <Section title="Alarm sound" note="Tap to preview. Plays even with the silent switch on.">
        {SOUNDS.map((s) => (
          <SoundRow
            key={s.id}
            id={s.id}
            label={s.label}
            source={s.source}
            selected={settings.sound === s.id}
            onSelect={() => update({ sound: s.id })}
          />
        ))}
      </Section>
    </ScrollView>
  );
}

function ChangePasswordForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('Use a new password with at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('Choose a password different from your current one.');
    setBusy(true);
    const res = await changePassword(current, next);
    setBusy(false);
    if (res.error) return setError(res.error);
    onDone();
  };

  const input = (placeholder: string, value: string, set: (v: string) => void, kind: 'password' | 'newPassword') => (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      textContentType={kind}
      value={value}
      onChangeText={set}
    />
  );

  return (
    <View style={styles.form}>
      {input('Current password', current, setCurrent, 'password')}
      {input('New password (8+ characters)', next, setNext, 'newPassword')}
      {input('Confirm new password', confirm, setConfirm, 'newPassword')}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.saveButton, busy && styles.disabled]} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save new password</Text>}
      </Pressable>
      <Pressable onPress={onCancel} hitSlop={8}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
      {children}
    </View>
  );
}

function Choice({
  options,
  selected,
  onSelect,
}: {
  options: { value: number; label: string }[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={[styles.choice, o.value === selected && styles.choiceOn]}
          onPress={() => onSelect(o.value)}
        >
          <Text style={[styles.choiceText, o.value === selected && styles.choiceTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SoundRow({
  label,
  source,
  selected,
  onSelect,
}: {
  id: SoundId;
  label: string;
  source: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const player = useAudioPlayer(source);
  const preview = () => {
    onSelect();
    try {
      player.seekTo(0);
      player.play();
      setTimeout(() => {
        try {
          player.pause();
        } catch {}
      }, 2400);
    } catch {}
  };
  return (
    <Pressable style={[styles.soundRow, selected && styles.soundRowOn]} onPress={preview}>
      <Text style={styles.soundLabel}>{label}</Text>
      <Text style={styles.soundCheck}>{selected ? '✓' : '▶︎'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: 20, paddingTop: 64, gap: 16, paddingBottom: 40 },
  top: { gap: 8 },
  back: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 18, gap: 10, ...shadow },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  note: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  accountButton: { backgroundColor: colors.primarySoft, paddingVertical: 12, borderRadius: radius.button, alignItems: 'center' },
  accountText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  form: { gap: 10 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  saveButton: { backgroundColor: colors.primary, paddingVertical: 13, borderRadius: radius.button, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  cancelText: { color: colors.muted, textAlign: 'center' },
  deleteText: { color: colors.danger, textAlign: 'center', marginTop: 4 },
  choices: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  choiceOn: { backgroundColor: colors.primary },
  choiceText: { fontSize: 16, fontWeight: '700', color: colors.text },
  choiceTextOn: { color: '#fff' },
  soundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    backgroundColor: colors.bg,
  },
  soundRowOn: { backgroundColor: colors.primarySoft },
  soundLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  soundCheck: { fontSize: 16, color: colors.primaryDark, fontWeight: '800' },
});
