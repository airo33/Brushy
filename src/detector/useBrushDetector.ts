import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFrameOutput, useObjectOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { useTensorflowModel } from 'react-native-fast-tflite';
import {
  INFERENCE_INTERVAL_MS,
  MIN_SCORE,
  MODEL_ASSET,
  TOOTHBRUSH_CLASS_ID,
} from './config';

const FACE_TYPES = ['face' as const];
const MODEL_SOURCE = MODEL_ASSET;
const DETECTION_TTL_MS = 1500;

export interface BrushDetection {
  /** Camera outputs to pass to <Camera outputs={...} /> */
  outputs: ReturnType<typeof useFrameOutput>[] | any[];
  modelState: 'loading' | 'loaded' | 'error';
  modelError?: string;
  faceSeen: boolean;
  toothbrushSeen: boolean;
  /** Best detection of any class, for calibrating TOOTHBRUSH_CLASS_ID. */
  debug: string;
}

/**
 * Combines face detection (iOS native face scanner) and toothbrush detection
 * (COCO object detector running on camera frames). `toothbrushSeen` / `faceSeen`
 * stay true for a short TTL after the last positive detection.
 */
export function useBrushDetector(): BrushDetection {
  const plugin = useTensorflowModel(MODEL_SOURCE, []);
  const model = plugin.state === 'loaded' ? plugin.model : undefined;

  const [now, setNow] = useState(Date.now());
  const lastFace = useRef(0);
  const lastBrush = useRef(0);
  const [debug, setDebug] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const onFaces = useCallback((objects: unknown[]) => {
    if (objects.length > 0) lastFace.current = Date.now();
  }, []);
  const objectOutput = useObjectOutput({
    types: FACE_TYPES,
    onObjectsScanned: onFaces,
  });

  const onResult = useCallback((hit: boolean, text: string) => {
    if (hit) lastBrush.current = Date.now();
    setDebug(text);
  }, []);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    targetResolution: { width: 320, height: 320 },
    enablePreviewSizedOutputBuffers: true,
    onFrame(frame) {
      'worklet';
      try {
        if (model == null) return;
        // timestamp unit is not guaranteed, so throttle on a worklet-local counter instead
        const g = globalThis as any;
        g.__brushFrame = (g.__brushFrame ?? 0) + 1;
        const everyN = Math.max(1, Math.round(INFERENCE_INTERVAL_MS / 33));
        if (g.__brushFrame % everyN !== 0) return;

        const input = model.inputs[0];
        const size = input.shape[1]; // [1, h, w, 3]
        const src = new Uint8Array(frame.getPixelBuffer());
        const stride = frame.bytesPerRow;
        const px = Math.max(3, Math.round(stride / frame.width));
        const bgr = frame.pixelFormat === 'rgb-bgra-8-bit';
        const useFloat = input.dataType === 'float32';
        const out: Uint8Array | Float32Array = useFloat
          ? new Float32Array(size * size * 3)
          : new Uint8Array(size * size * 3);

        for (let y = 0; y < size; y++) {
          const sy = Math.floor((y * frame.height) / size);
          for (let x = 0; x < size; x++) {
            const sx = Math.floor((x * frame.width) / size);
            const i = sy * stride + sx * px;
            const o = (y * size + x) * 3;
            const r = bgr ? src[i + 2] : src[i];
            const gch = src[i + 1];
            const b = bgr ? src[i] : src[i + 2];
            if (useFloat) {
              out[o] = (r - 127.5) / 127.5;
              out[o + 1] = (gch - 127.5) / 127.5;
              out[o + 2] = (b - 127.5) / 127.5;
            } else {
              out[o] = r;
              out[o + 1] = gch;
              out[o + 2] = b;
            }
          }
        }

        const results = model.runSync([out.buffer as ArrayBuffer]);

        // Standard TFLite detection post-process order: boxes, classes, scores, count.
        // Prefer matching by tensor name when the model provides it.
        const find = (needle: string, fallbackIdx: number) => {
          const idx = model.outputs.findIndex((o: any) =>
            String(o.name).toLowerCase().includes(needle),
          );
          return new Float32Array(results[idx >= 0 ? idx : fallbackIdx]);
        };
        const classes = find('class', 1);
        const scores = find('score', 2);

        let hit = false;
        let best = -1;
        let bestScore = 0;
        for (let k = 0; k < scores.length; k++) {
          if (scores[k] > bestScore) {
            bestScore = scores[k];
            best = classes[k];
          }
          if (scores[k] >= MIN_SCORE && Math.round(classes[k]) === TOOTHBRUSH_CLASS_ID) {
            hit = true;
          }
        }
        scheduleOnRN(
          onResult,
          hit,
          `top: class ${best} @ ${bestScore.toFixed(2)}`,
        );
      } catch (e) {
        scheduleOnRN(onResult, false, `detector error: ${String(e)}`);
      } finally {
        frame.dispose();
      }
    },
  });

  const faceSeen =
    Platform.OS !== 'ios' ? true : now - lastFace.current < DETECTION_TTL_MS;
  const toothbrushSeen = now - lastBrush.current < DETECTION_TTL_MS;

  const outputs = useMemo(
    () => (Platform.OS === 'ios' ? [frameOutput, objectOutput] : [frameOutput]),
    [frameOutput, objectOutput],
  );

  return {
    outputs,
    modelState: plugin.state,
    modelError: plugin.state === 'error' ? plugin.error.message : undefined,
    faceSeen,
    toothbrushSeen,
    debug,
  };
}
