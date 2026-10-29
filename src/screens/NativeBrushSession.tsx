import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraPermission } from 'react-native-vision-camera';
import { useBrushDetector } from '../detector/useBrushDetector';
import { BrushSession } from './BrushSession';
import { colors } from '../theme';

/** Dev/production builds: front camera + on-device AI (face + toothbrush). */
type Props = { onDone: () => void; onCancel?: () => void };

export function NativeBrushSession({ onDone, onCancel }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.body}>
          The camera checks that you are really brushing. Video is never uploaded.
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }
  return <CameraSession onDone={onDone} onCancel={onCancel} />;
}

function CameraSession({ onDone, onCancel }: Props) {
  const d = useBrushDetector();

  let hint = 'Keep brushing!';
  if (d.modelState === 'loading') hint = 'Loading detector…';
  else if (d.modelState === 'error') hint = 'Detector failed to load';
  else if (!d.faceSeen) hint = 'Keep your face in view';
  else if (!d.toothbrushSeen) hint = 'Show your toothbrush';

  return (
    <BrushSession
      background={<Camera style={StyleSheet.absoluteFill} device="front" isActive outputs={d.outputs} />}
      brushing={d.faceSeen && d.toothbrushSeen}
      hint={hint}
      debug={`face ${d.faceSeen} · brush ${d.toothbrushSeen} · ${d.debug}${d.modelError ? ' · ' + d.modelError : ''}`}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, textAlign: 'center' },
  button: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
