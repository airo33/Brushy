import { ReactNode, useEffect, useRef, useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { advance, initialBrushState } from '../brushTimer';
import { useSettings } from '../settings';
import { colors } from '../theme';

const TICK_MS = 100;
const MAX_TICK_MS = 500;

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  /** Background, e.g. the camera preview. */
  background?: ReactNode;
  brushing: boolean;
  hint: string;
  debug?: string;
  onDone: () => void;
  onCancel?: () => void;
  /** Let the background (e.g. camera) show through. */
  transparent?: boolean;
  /** Show the dev-only 'hold to simulate' button. Default true. */
  showSimulate?: boolean;
  /** Called whenever the timer advances. */
  onElapsed?: (elapsedMs: number) => void;
}

/** Shared timer + UI. The detector (camera AI or motion) just feeds `brushing`. */
export function BrushSession({
  background,
  brushing,
  hint,
  debug,
  onDone,
  onCancel,
  transparent,
  showSimulate = true,
  onElapsed,
}: Props) {
  useKeepAwake(); // the phone is propped up, so the screen must not lock mid-brush
  const { settings } = useSettings();
  const targetMs = settings.brushMinutes * 60_000;
  const [state, setState] = useState(initialBrushState);
  const [simulate, setSimulate] = useState(false); // dev-only: hold button to fake brushing

  const active = simulate || brushing;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      // Real elapsed time, so a busy phone doesn't slow the timer. Long gaps (app
      // backgrounded) are capped so they can't be used to skip ahead.
      const now = Date.now();
      const dt = Math.min(now - last, MAX_TICK_MS);
      last = now;
      setState((s) => advance(s, dt, activeRef.current, targetMs));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    onElapsed?.(state.elapsedMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.elapsedMs]);

  const progress = state.elapsedMs / targetMs;

  return (
    <View style={[styles.container, transparent && styles.transparent]}>
      {background}
      {onCancel && !state.done && (
        <Pressable style={styles.close} onPress={onCancel} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      )}
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.timer}>{fmt(targetMs - state.elapsedMs)}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.hint, active && styles.hintOk]}>
          {state.done ? 'Done! Nice and clean 🦷' : hint}
        </Text>
        {__DEV__ && showSimulate && (
          <>
            {debug ? <Text style={styles.debug}>{debug}</Text> : null}
            <Pressable
              style={styles.simulate}
              onPressIn={() => setSimulate(true)}
              onPressOut={() => setSimulate(false)}
            >
              <Text style={styles.buttonText}>Hold to simulate brushing</Text>
            </Pressable>
          </>
        )}
        {state.done && (
          <Pressable style={styles.button} onPress={onDone}>
            <Text style={styles.buttonText}>Turn off alarm</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  transparent: { backgroundColor: 'transparent' },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 56,
    gap: 12,
  },
  close: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18 },
  timer: { fontSize: 64, fontWeight: '700', color: '#fff' },
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.success },
  hint: { fontSize: 20, color: '#fff', textAlign: 'center' },
  hintOk: { color: '#86efac' },
  debug: { fontSize: 12, color: '#fde68a', textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  simulate: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
