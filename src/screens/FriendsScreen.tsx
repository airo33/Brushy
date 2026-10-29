import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth';
import {
  BlockedPerson,
  FriendRow,
  MyProfile,
  REPORT_REASONS,
  REQUEST_RESULT,
  ReportReason,
  blockUser,
  createProfile,
  deleteMyProfile,
  fetchBlocked,
  fetchFriends,
  fetchMyProfile,
  pushMyStats,
  removeFriendship,
  reportUser,
  respondToRequest,
  sendRequest,
  unblockUser,
} from '../friends';
import {
  LeaderboardEntry,
  computeStats,
  effectiveStreak,
  effectiveWeek,
  rankEntries,
} from '../friendsStats';
import { dayKey, loadCompleted } from '../schedule';
import { useSettings } from '../settings';
import { colors, radius, shadow } from '../theme';

export function FriendsScreen({ onBack, onOpenAuth }: { onBack: () => void; onOpenAuth: () => void }) {
  const auth = useAuth();
  const { settings } = useSettings();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [menuFor, setMenuFor] = useState<FriendRow | null>(null);
  const [reportFor, setReportFor] = useState<FriendRow | null>(null);

  const load = useCallback(async () => {
    if (!auth.userId) return setLoading(false);
    setError(null);
    try {
      const mine = await fetchMyProfile(auth.userId);
      setProfile(mine);
      setCompleted(await loadCompleted());
      if (mine) {
        await pushMyStats(auth.userId).catch(() => {}); // so friends see fresh numbers when you look
        setRows(await fetchFriends());
        setBlocked(await fetchBlocked());
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load friends.');
    } finally {
      setLoading(false);
    }
  }, [auth.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const today = useMemo(() => new Date(), [rows, completed]);

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const todayKey = dayKey(today);
    const mine = computeStats(completed, settings.dailyGoal, today);
    return rankEntries(
      rows
        .filter((r) => r.status === 'me' || r.status === 'accepted')
        .map((r) =>
          r.isMe
            ? {
                // your own row uses this phone's live numbers, not the last upload
                name: r.name,
                isMe: true,
                streak: mine.currentStreak,
                best: mine.bestStreak,
                week: mine.weekCount,
                brushedToday: mine.lastBrushDay === todayKey,
              }
            : {
                name: r.name,
                isMe: false,
                streak: effectiveStreak(r.currentStreak, r.lastMetDay, today),
                best: r.bestStreak ?? 0,
                week: effectiveWeek(r.weekCount, r.lastBrushDay, today),
                brushedToday: r.lastBrushDay === todayKey,
              },
        ),
    );
  }, [rows, completed, settings.dailyGoal, today]);

  const incoming = rows.filter((r) => r.status === 'pending' && r.incoming);
  const outgoing = rows.filter((r) => r.status === 'pending' && !r.incoming);
  const friendCount = rows.filter((r) => r.status === 'accepted').length;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? 'Try again.');
    }
  };

  const confirmRemove = (r: FriendRow) =>
    Alert.alert(`Remove ${r.name}?`, 'You will stop seeing each other. You can add each other again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => r.friendshipId && run(() => removeFriendship(r.friendshipId!)) },
    ]);

  const confirmBlock = (r: FriendRow) =>
    Alert.alert(
      `Block ${r.name}?`,
      'You will no longer see each other, and they cannot send you requests. They are not told. You can unblock them later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => r.friendshipId && run(() => blockUser(r.friendshipId!)) },
      ],
    );

  const confirmStopSharing = () =>
    Alert.alert(
      'Stop sharing?',
      'This deletes your friend profile and removes all your friends. Your streak on this phone is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop sharing', style: 'destructive', onPress: () => run(deleteMyProfile) },
      ],
    );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Friends</Text>
      </View>

      {!auth.signedIn ? (
        <Card>
          <Text style={styles.cardTitle}>Sign in to compete</Text>
          <Text style={styles.note}>Friends need an account so your streak can be shared with the people you choose.</Text>
          <Button label="Sign in or create account" onPress={onOpenAuth} />
        </Card>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : error ? (
        <Card>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.note}>
            If this says a function doesn't exist, the friends SQL hasn't been run in Supabase yet.
          </Text>
          <Button label="Try again" onPress={load} />
        </Card>
      ) : !profile ? (
        <CreateProfile
          onCreate={async (name) => {
            await createProfile(name);
            await load();
          }}
        />
      ) : (
        <>
          <Card>
            <Text style={styles.note}>Your friend code</Text>
            <Text style={styles.code}>{profile.code}</Text>
            <Button
              label="Share my code"
              onPress={() =>
                Share.share({ message: `Add me on Brushy and let's compete on brushing streaks! My friend code is ${profile.code}` })
              }
            />
          </Card>

          <Text style={styles.section}>Leaderboard</Text>
          <Card>
            {leaderboard.map((e, i) => (
              <View key={`${e.name}-${i}`} style={[styles.rowItem, e.isMe && styles.me]}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.name} numberOfLines={1}>
                    {e.name}
                    {e.isMe ? ' (you)' : ''}
                    {e.brushedToday ? '  ✓' : ''}
                  </Text>
                  <Text style={styles.sub}>
                    {e.week} brush{e.week === 1 ? '' : 'es'} this week · best {e.best}
                  </Text>
                </View>
                <Text style={styles.streak}>🔥 {e.streak}</Text>
              </View>
            ))}
            {friendCount === 0 && <Text style={styles.note}>Add a friend with their code to start competing.</Text>}
            <Text style={styles.hint}>✓ = brushed today. Pull down to refresh.</Text>
          </Card>

          {incoming.length > 0 && (
            <>
              <Text style={styles.section}>Requests</Text>
              <Card>
                {incoming.map((r) => (
                  <View key={r.friendshipId} style={styles.rowItem}>
                    <Text style={[styles.name, styles.rowMain]} numberOfLines={1}>
                      {r.name} wants to be friends
                    </Text>
                    <SmallButton label="Accept" onPress={() => run(() => respondToRequest(r.friendshipId!, true))} />
                    <SmallButton label="Decline" muted onPress={() => run(() => respondToRequest(r.friendshipId!, false))} />
                    <SmallButton label="⋯" muted onPress={() => setMenuFor(r)} />
                  </View>
                ))}
              </Card>
            </>
          )}

          <Text style={styles.section}>Add a friend</Text>
          <AddFriend onSend={sendRequest} onSent={load} />

          {(outgoing.length > 0 || friendCount > 0) && (
            <>
              <Text style={styles.section}>Manage</Text>
              <Card>
                {outgoing.map((r) => (
                  <View key={r.friendshipId} style={styles.rowItem}>
                    <Text style={[styles.name, styles.rowMain]} numberOfLines={1}>
                      {r.name} · waiting
                    </Text>
                    <SmallButton label="Cancel" muted onPress={() => run(() => removeFriendship(r.friendshipId!))} />
                  </View>
                ))}
                {rows
                  .filter((r) => r.status === 'accepted')
                  .map((r) => (
                    <View key={r.friendshipId} style={styles.rowItem}>
                      <Text style={[styles.name, styles.rowMain]} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <SmallButton label="⋯" muted onPress={() => setMenuFor(r)} />
                    </View>
                  ))}
              </Card>
            </>
          )}

          {blocked.length > 0 && (
            <>
              <Text style={styles.section}>Blocked</Text>
              <Card>
                {blocked.map((b) => (
                  <View key={b.userId} style={styles.rowItem}>
                    <Text style={[styles.name, styles.rowMain]} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <SmallButton label="Unblock" muted onPress={() => run(() => unblockUser(b.userId))} />
                  </View>
                ))}
              </Card>
            </>
          )}

          <Card>
            <Text style={styles.note}>
              Friends you accept can see your name, your streak numbers and how many times you brushed this week.
              They never see your photos or email.
            </Text>
            <Pressable onPress={confirmStopSharing} hitSlop={8}>
              <Text style={styles.danger}>Stop sharing and delete my friend profile</Text>
            </Pressable>
          </Card>
        </>
      )}
      <PersonMenu
        person={menuFor}
        onClose={() => setMenuFor(null)}
        onReport={(r) => {
          setMenuFor(null);
          setReportFor(r);
        }}
        onBlock={(r) => {
          setMenuFor(null);
          confirmBlock(r);
        }}
        onRemove={(r) => {
          setMenuFor(null);
          confirmRemove(r);
        }}
      />
      <ReportModal
        person={reportFor}
        onClose={() => setReportFor(null)}
        onSubmit={async (r, reason, details, alsoBlock) => {
          await reportUser(r.friendshipId!, reason, details);
          if (alsoBlock) await blockUser(r.friendshipId!);
          setReportFor(null);
          Alert.alert('Thanks for letting us know', alsoBlock ? 'We will review your report. They have been blocked.' : 'We will review your report.');
          await load();
        }}
      />
    </ScrollView>
  );
}

function PersonMenu({
  person,
  onClose,
  onReport,
  onBlock,
  onRemove,
}: {
  person: FriendRow | null;
  onClose: () => void;
  onReport: (r: FriendRow) => void;
  onBlock: (r: FriendRow) => void;
  onRemove: (r: FriendRow) => void;
}) {
  return (
    <Modal visible={person !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {person && (
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{person.name}</Text>
            <SheetButton label="Report…" onPress={() => onReport(person)} />
            <SheetButton label="Block" danger onPress={() => onBlock(person)} />
            {person.status === 'accepted' && <SheetButton label="Remove friend" onPress={() => onRemove(person)} />}
            <SheetButton label="Cancel" muted onPress={onClose} />
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

function SheetButton({ label, onPress, danger, muted }: { label: string; onPress: () => void; danger?: boolean; muted?: boolean }) {
  return (
    <Pressable style={styles.sheetButton} onPress={onPress}>
      <Text style={[styles.sheetButtonText, danger && styles.dangerText, muted && styles.mutedText]}>{label}</Text>
    </Pressable>
  );
}

function ReportModal({
  person,
  onClose,
  onSubmit,
}: {
  person: FriendRow | null;
  onClose: () => void;
  onSubmit: (r: FriendRow, reason: ReportReason, details: string, alsoBlock: boolean) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>('inappropriate_name');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // start fresh each time the modal opens
  useEffect(() => {
    if (person) {
      setReason('inappropriate_name');
      setDetails('');
      setAlsoBlock(true);
      setError(null);
    }
  }, [person]);

  const submit = async () => {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(person, reason, details, alsoBlock);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={person !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Report {person?.name}</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r.id} style={styles.reasonRow} onPress={() => setReason(r.id)}>
              <Text style={styles.radio}>{reason === r.id ? '◉' : '○'}</Text>
              <Text style={styles.reasonText}>{r.label}</Text>
            </Pressable>
          ))}
          <TextInput
            style={[styles.input, styles.detailsInput]}
            placeholder="Anything else we should know? (optional)"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            value={details}
            onChangeText={setDetails}
          />
          <View style={styles.rowItem}>
            <Text style={[styles.reasonText, styles.rowMain]}>Also block them</Text>
            <Switch value={alsoBlock} onValueChange={setAlsoBlock} trackColor={{ true: colors.primary, false: colors.line }} />
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button label="Send report" onPress={submit} busy={busy} />
          <SheetButton label="Cancel" muted onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function CreateProfile({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2 || name.trim().length > 20) return setError('Use a name with 2 to 20 characters.');
    setBusy(true);
    try {
      await onCreate(name);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create your profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text style={styles.cardTitle}>Compete with friends</Text>
      <Text style={styles.note}>
        Pick a name your friends will see. Once you accept a friend, they can see your name, your streak numbers and
        how many times you brushed this week. They never see your photos or email. Nothing is shared until you
        create this profile, and you can delete it any time.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor={colors.muted}
        maxLength={20}
        autoCorrect={false}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Button label="Create my profile" onPress={submit} busy={busy} />
    </Card>
  );
}

function AddFriend({ onSend, onSent }: { onSend: (code: string) => Promise<string>; onSent: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 8) return setMessage('Friend codes have 8 characters.');
    setBusy(true);
    try {
      const result = await onSend(clean);
      setMessage(REQUEST_RESULT[result] ?? 'Done.');
      if (result === 'sent' || result === 'accepted') {
        setCode('');
        onSent();
      }
    } catch (e: any) {
      setMessage(e?.message ?? 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <TextInput
        style={[styles.input, styles.codeInput]}
        placeholder="FRIEND CODE"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        value={code}
        onChangeText={setCode}
        onSubmitEditing={submit}
      />
      {message && <Text style={styles.note}>{message}</Text>}
      <Button label="Send request" onPress={submit} busy={busy} />
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Button({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable style={[styles.button, busy && styles.disabled]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

function SmallButton({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable style={[styles.small, muted && styles.smallMuted]} onPress={onPress}>
      <Text style={[styles.smallText, muted && styles.smallTextMuted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: 20, paddingTop: 64, gap: 14, paddingBottom: 48 },
  top: { gap: 8 },
  back: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: colors.text },
  loading: { marginTop: 40 },
  section: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 18, gap: 12, ...shadow },
  cardTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  note: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 14 },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 4, color: colors.primaryDark, textAlign: 'center' },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  codeInput: { textAlign: 'center', fontSize: 22, letterSpacing: 4, fontWeight: '700' },
  button: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.button, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  me: { backgroundColor: colors.primarySoft, borderRadius: radius.button, paddingHorizontal: 8, marginHorizontal: -8 },
  rank: { width: 22, fontSize: 16, fontWeight: '800', color: colors.muted, textAlign: 'center' },
  rowMain: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
  streak: { fontSize: 20, fontWeight: '800', color: colors.text },
  small: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill },
  smallMuted: { backgroundColor: colors.bg },
  smallText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  smallTextMuted: { color: colors.muted },
  danger: { color: colors.danger, textAlign: 'center', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 10 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sheetButton: { paddingVertical: 14, alignItems: 'center', borderRadius: radius.button, backgroundColor: colors.bg },
  sheetButtonText: { fontSize: 16, fontWeight: '700', color: colors.text },
  dangerText: { color: colors.danger },
  mutedText: { color: colors.muted },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  radio: { fontSize: 20, color: colors.primary },
  reasonText: { fontSize: 16, color: colors.text },
  detailsInput: { minHeight: 80, textAlignVertical: 'top' },
});
