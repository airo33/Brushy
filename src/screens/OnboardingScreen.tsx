import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ensurePermission } from '../notifications';
import { colors } from '../theme';

const STEPS = [
  {
    emoji: '🦷',
    title: 'Brushy',
    body: 'An alarm that only stops when you actually brush your teeth. Twice a day, no excuses.',
  },
  {
    emoji: '⏱️',
    title: 'Two minutes, verified',
    body: 'Prop your phone up and brush for the full time. The app takes a photo at the start and end as proof.',
  },
  {
    emoji: '🔔',
    title: 'Allow notifications',
    body: 'Reminders keep coming until you brush. We need notifications to do that.',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const next = async () => {
    if (!last) return setI(i + 1);
    await ensurePermission();
    onDone();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{step.emoji}</Text>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.body}>{step.body}</Text>
      <View style={styles.dots}>
        {STEPS.map((_, k) => (
          <View key={k} style={[styles.dot, k === i && styles.dotOn]} />
        ))}
      </View>
      <Pressable style={styles.button} onPress={next}>
        <Text style={styles.buttonText}>{last ? 'Allow and get started' : 'Next'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emoji: { fontSize: 80 },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', color: colors.text },
  body: { fontSize: 17, color: colors.muted, textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.primary, width: 20 },
  button: { backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 36, borderRadius: 14 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
