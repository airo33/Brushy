import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { HistoryDay } from './stats';
import { colors, radius } from './theme';

/** Preview of the streak card with a button that shares it as an image. */
export function ShareStreakModal({
  visible,
  streak,
  history,
  onClose,
}: {
  visible: boolean;
  streak: number;
  history: HistoryDay[];
  onClose: () => void;
}) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing is not available on this device.');
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your streak' });
    } catch {
      Alert.alert('Could not share', 'Something went wrong creating the image. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* collapsable={false} keeps the view real on Android so it can be captured */}
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <Text style={styles.brand}>BRUSHY</Text>
          <Text style={styles.emoji}>🦷</Text>
          <Text style={styles.number}>🔥 {streak}</Text>
          <Text style={styles.label}>day brushing streak</Text>
          <View style={styles.dots}>
            {history.map((h) => (
              <View key={h.day} style={[styles.dot, h.met ? styles.dotMet : h.count > 0 ? styles.dotPartial : styles.dotNone]} />
            ))}
          </View>
          <Text style={styles.tag}>Brushed twice a day. Can you?</Text>
        </View>

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={share} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? 'Preparing…' : 'Share'}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  card: {
    width: 300,
    height: 375, // 4:5, a good shape for stories and posts
    backgroundColor: colors.primary,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 6,
  },
  brand: { color: colors.primarySoft, fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  emoji: { fontSize: 56, marginTop: 8 },
  number: { color: '#fff', fontSize: 72, fontWeight: '900' },
  label: { color: '#fff', fontSize: 18, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 5, marginTop: 18 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotMet: { backgroundColor: '#fff' },
  dotPartial: { backgroundColor: 'rgba(255,255,255,0.55)' },
  dotNone: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tag: { color: colors.primarySoft, fontSize: 14, marginTop: 18 },
  button: { backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 56, borderRadius: radius.button },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  close: { color: '#fff', fontSize: 16 },
});
