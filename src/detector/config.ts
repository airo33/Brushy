// EfficientDet-Lite0 (COCO) object detector from Google's MediaPipe, bundled in the app so it
// works offline and nothing is downloaded at runtime.
// Source: https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/latest/efficientdet_lite0.tflite
// sha256: 40338edf5ec70d43e318b0a716a84d4564cd1802759a7a07170c7e43796dbf58 (13,836,895 bytes)
export const MODEL_ASSET = require('../../assets/models/efficientdet_lite0.tflite');

// Class index of "toothbrush" in the model's output. Read from the label file embedded in the
// model itself (labels.txt: index 0 = person ... index 88 = hair drier, index 89 = toothbrush).
export const TOOTHBRUSH_CLASS_ID = 89;

export const MIN_SCORE = 0.3;

// Run inference at most this often.
export const INFERENCE_INTERVAL_MS = 250;
