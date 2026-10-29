import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { colors } from './src/theme';
import { AlarmScreen } from './src/screens/AlarmScreen';
import { BrushScreen } from './src/screens/BrushScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { AuthProvider, useAuth } from './src/auth';
import { onRemoteApplied } from './src/syncSignal';
import { loadSnooze, snoozedUntil } from './src/snooze';
import { SettingsProvider } from './src/settings';
import { syncNotifications } from './src/notifications';
import {
  Alarm,
  alarmForCompletion,
  loadAlarms,
  loadCompleted,
  markCompleted,
} from './src/schedule';

const ONBOARDED_KEY = 'onboarded.v1';
const AUTH_PROMPTED_KEY = 'authPrompted.v1';
// Stand-in alarm for the dev-only "test the ringing alarm" button.
const TEST_ALARM: Alarm = { id: 'test', hour: new Date().getHours(), minute: new Date().getMinutes(), enabled: true };

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const auth = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // offered once after onboarding, and again whenever Settings asks for it
  const [showAuth, setShowAuth] = useState(false);
  const [authIntro, setAuthIntro] = useState(false);
  const [brushing, setBrushing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  // The alarm that is ringing right now: it has gone off, and you haven't brushed for it yet.
  const [ringing, setRinging] = useState<{ alarm: Alarm; day: string } | null>(null);
  // bump to remount the schedule screen so it re-reads completions
  const [scheduleKey, setScheduleKey] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setOnboarded(v === '1'))
      .catch(() => setOnboarded(true));
  }, []);

  const checkRinging = useCallback(async () => {
    const [alarms, completed] = await Promise.all([loadAlarms(), loadCompleted()]);
    const now = new Date();
    let due = alarmForCompletion(alarms, now, completed) ?? null;
    // a snoozed alarm stays quiet until its snooze ends
    if (due && snoozedUntil(await loadSnooze(), `${due.alarm.id}@${due.day}`, now) > now.getTime()) due = null;
    // keep a dev test alarm ringing until it is finished
    setRinging((current) => (current?.alarm.id === 'test' ? current : due));
  }, []);

  // Re-check on launch, when returning to the app, and while it stays open.
  useEffect(() => {
    if (!onboarded) return;
    checkRinging();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkRinging());
    const id = setInterval(checkRinging, 15_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [onboarded, checkRinging]);

  // Tapping a reminder jumps straight to the brushing screen.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => setBrushing(true));
    if (Notifications.getLastNotificationResponse()) setBrushing(true);
    return () => sub.remove();
  }, []);

  const finish = async () => {
    const now = new Date();
    const [alarms, completed] = await Promise.all([loadAlarms(), loadCompleted()]);
    const due = alarmForCompletion(alarms, now, completed);
    if (due) {
      await markCompleted(due.alarm, due.day);
      // re-sync drops the remaining nags for this alarm today
      await syncNotifications(alarms);
    }
    setRinging(null);
    setScheduleKey((k) => k + 1);
    setBrushing(false);
  };

  // Data from the account landed on this phone (or was cleared on sign-out): refresh.
  useEffect(() => {
    return onRemoteApplied(async () => {
      await syncNotifications(await loadAlarms());
      setScheduleKey((k) => k + 1);
      checkRinging();
    });
  }, [checkRinging]);

  const closeAuth = async () => {
    await AsyncStorage.setItem(AUTH_PROMPTED_KEY, '1').catch(() => {});
    setShowAuth(false);
    setAuthIntro(false);
  };

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
    setOnboarded(true);
    // Offer an account once, but only if accounts are set up and nobody is signed in yet.
    const prompted = await AsyncStorage.getItem(AUTH_PROMPTED_KEY).catch(() => '1');
    if (auth.configured && !auth.signedIn && prompted !== '1') {
      setAuthIntro(true);
      setShowAuth(true);
    }
  };

  if (onboarded === null || auth.loading) return <View style={styles.container} />;

  let screen;
  if (!onboarded) {
    screen = <OnboardingScreen onDone={finishOnboarding} />;
  } else if (showAuth) {
    screen = <AuthScreen intro={authIntro} onClose={closeAuth} />;
  } else if (brushing) {
    screen = <BrushScreen onDone={finish} onCancel={() => setBrushing(false)} />;
  } else if (ringing) {
    screen = (
      <AlarmScreen
        alarm={ringing.alarm}
        alarmKey={`${ringing.alarm.id}@${ringing.day}`}
        onBrush={() => setBrushing(true)}
        onSnoozed={async () => {
          setRinging(null);
          await syncNotifications(await loadAlarms()); // moves the reminders past the snooze
        }}
        onDevDismiss={() => setRinging(null)}
      />
    );
  } else if (showFriends) {
    screen = <FriendsScreen onBack={() => setShowFriends(false)} onOpenAuth={() => setShowAuth(true)} />;
  } else if (showSettings) {
    screen = <SettingsScreen onBack={() => setShowSettings(false)} onOpenAuth={() => setShowAuth(true)} />;
  } else {
    screen = (
      <ScheduleScreen
        onOpenSettings={() => setShowSettings(true)}
        onOpenFriends={() => setShowFriends(true)}
        key={scheduleKey}
        onStartBrushing={() => setBrushing(true)}
        onTestRing={() =>
          setRinging({
            alarm: { ...TEST_ALARM, hour: new Date().getHours(), minute: new Date().getMinutes() },
            day: 'test',
          })
        }
      />
    );
  }

  return (
    <SettingsProvider>
    <View style={styles.container}>
      <StatusBar style={brushing || ringing ? 'light' : 'dark'} />
      {screen}
    </View>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
