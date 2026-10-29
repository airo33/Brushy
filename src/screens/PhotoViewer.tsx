import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Proof } from '../proofs';
import { colors, radius } from '../theme';

function formatWhen(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

/** Full-screen viewer: swipe between brushing sessions, see the start and end photos, delete a session. */
export function PhotoViewer({
  items,
  startIndex,
  onClose,
  onDelete,
}: {
  items: Proof[];
  startIndex: number;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const { width, height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [index, setIndex] = useState(startIndex);
  const [deleting, setDeleting] = useState(false);

  // jump to the tapped photo when the viewer opens
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollTo({ x: startIndex * width, animated: false }), 0);
    return () => clearTimeout(id);
  }, [startIndex, width]);

  // keep the page number valid after a delete
  const current = Math.min(index, items.length - 1);
  const proof = items[current];

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const confirmDelete = () => {
    if (!proof) return;
    Alert.alert('Delete these photos?', 'They are removed from this phone. Your streak is not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete(proof.id);
            if (items.length <= 1) onClose();
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (!proof) return null;

  const imageHeight = (height - 220) / 2; // two photos stacked, room for header and footer

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.when}>{formatWhen(proof.ts)}</Text>
            <Text style={styles.count}>
              {current + 1} of {items.length}
            </Text>
          </View>
          <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={styles.pager}
        >
          {items.map((p) => (
            <View key={p.id} style={[styles.page, { width }]}>
              {[
                ['Start', p.start],
                ['End', p.end],
              ].map(([label, uri]) =>
                uri ? (
                  <View key={label} style={styles.shot}>
                    <Image source={{ uri }} style={[styles.image, { height: imageHeight }]} resizeMode="contain" />
                    <Text style={styles.label}>{label}</Text>
                  </View>
                ) : null,
              )}
            </View>
          ))}
        </ScrollView>

        <Pressable style={[styles.delete, deleting && styles.disabled]} onPress={confirmDelete} disabled={deleting}>
          <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete these photos'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 56, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  headerText: { gap: 2 },
  when: { color: '#fff', fontSize: 16, fontWeight: '700' },
  count: { color: '#94a3b8', fontSize: 13 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 18 },
  pager: { flex: 1 },
  page: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  shot: { width: '100%', alignItems: 'center', gap: 4 },
  image: { width: '100%', borderRadius: radius.button, backgroundColor: '#111' },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  delete: { marginHorizontal: 20, marginTop: 8, paddingVertical: 14, borderRadius: radius.button, alignItems: 'center', backgroundColor: 'rgba(220,38,38,0.15)' },
  disabled: { opacity: 0.5 },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
});
