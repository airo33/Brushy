import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSettings } from '../settings';
import { deletePhoto, persistPhoto, saveProof } from '../proofs';
import { colors, radius } from '../theme';
import { BrushSession } from './BrushSession';

const COUNTDOWN_S = 5;
const END_WARNING_MS = 5000; // "smile" hint this long before the end
const END_PHOTO_MS = 2000; // take the end photo this long before the end

type Phase = 'intro' | 'countdown' | 'running';

/**
 * Hands-free brushing: prop the phone up, tap start, and the 2-minute timer runs on its own.
 * A selfie is taken at the start and near the end and saved as proof. Nothing checks the photos.
 */
export function ProofBrushSession({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { settings } = useSettings();
  const targetMs = settings.brushMinutes * 60_000;
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [count, setCount] = useState(COUNTDOWN_S);
  const [elapsed, setElapsed] = useState(0);
  const photos = useRef<{ start?: string; end?: string }>({});
  const takingEnd = useRef(false);
  const saved = useRef(false);
  const mounted = useRef(true);
  // Without camera access the alarm must still be stoppable, just without photos.
  const [skipCamera, setSkipCamera] = useState(false);

  // Photos from a brush that was cancelled would otherwise be left behind, never shown.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!saved.current) {
        deletePhoto(photos.current.start);
        deletePhoto(photos.current.end);
      }
    };
  }, []);

  const snap = async (name: string): Promise<string | undefined> => {
    try {
      const pic = await camera.current?.takePictureAsync({ quality: 0.5, skipProcessing: true });
      return pic ? persistPhoto(pic.uri, `${name}-${Date.now()}.jpg`) : undefined;
    } catch {
      return undefined; // a failed photo must never block the alarm
    }
  };

  // countdown -> start photo -> running
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      (async () => {
        const uri = await snap('start');
        if (!mounted.current) return deletePhoto(uri); // cancelled while the photo was being taken
        photos.current.start = uri;
        setPhase('running');
      })();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count]);

  const onElapsed = (ms: number) => {
    setElapsed(ms);
    if (ms >= targetMs - END_PHOTO_MS && !takingEnd.current) {
      takingEnd.current = true;
      snap('end').then((uri) => {
        photos.current.end = uri;
        if (!mounted.current && !saved.current) deletePhoto(uri); // cancelled while it was being taken
      });
    }
  };

  const finish = async () => {
    await saveProof({ id: String(Date.now()), ts: Date.now(), ...photos.current });
    saved.current = true;
    onDone();
  };

  if (!permission) return <View style={styles.center} />;
  const useCamera = permission.granted && !skipCamera;
  if (!useCamera && !skipCamera) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.body}>Brushy takes a photo at the start and end of each brush as proof. Photos are saved on your phone and never uploaded.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => setSkipCamera(true)}>
          <Text style={styles.link}>Brush without photos</Text>
        </Pressable>
        {onCancel && (
          <Pressable onPress={onCancel}>
            <Text style={styles.link}>Not now</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const nearEnd = elapsed >= targetMs - END_WARNING_MS;

  return (
    <View style={styles.container}>
      {useCamera && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="front"
          mirror
          onCameraReady={() => setReady(true)}
        />
      )}

      {phase !== 'running' && (
        <View style={styles.scrim}>
          {onCancel && (
            <Pressable style={styles.close} onPress={onCancel} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          )}
          {phase === 'intro' ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Prop your phone up</Text>
              <Text style={styles.panelBody}>
                Lean it on the mirror or the counter so your face is in view. The timer runs
                by itself. No need to hold anything.
              </Text>
              <Pressable
                style={[styles.button, !ready && useCamera && styles.disabled]}
                disabled={!ready && useCamera}
                onPress={() => {
                  setCount(COUNTDOWN_S);
                  setPhase('countdown');
                }}
              >
                <Text style={styles.buttonText}>{ready || !useCamera ? 'Start' : 'Starting camera…'}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.panel}>
              <Text style={styles.big}>{count}</Text>
              <Text style={styles.panelBody}>Get your toothbrush in. Photo at 0.</Text>
            </View>
          )}
        </View>
      )}

      {phase === 'running' && (
        <BrushSession
          transparent
          showSimulate={false}
          brushing
          hint={nearEnd ? 'Almost done. Smile 📸' : 'Keep brushing!'}
          onElapsed={onElapsed}
          onDone={finish}
          onCancel={onCancel}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.bg },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', padding: 24, paddingBottom: 56 },
  panel: { alignItems: 'center', gap: 14 },
  panelTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  panelBody: { color: '#e2e8f0', fontSize: 16, textAlign: 'center', lineHeight: 22 },
  big: { color: '#fff', fontSize: 120, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, textAlign: 'center', color: colors.muted },
  button: { backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 44, borderRadius: radius.button },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 16 },
  close: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18 },
});
