// Tiny event bus so storage code and sync code don't import each other.

export type ChangeKind = 'alarms' | 'settings' | 'completed';

const localListeners = new Set<(kind: ChangeKind) => void>();
const remoteListeners = new Set<() => void>();

/** Call after writing alarms, settings or brushing history on this device. */
export const notifyLocalChange = (kind: ChangeKind) => localListeners.forEach((l) => l(kind));
export const onLocalChange = (l: (kind: ChangeKind) => void) => {
  localListeners.add(l);
  return () => {
    localListeners.delete(l);
  };
};

/** Fired after data from the account was written to this device, so screens can reload. */
export const notifyRemoteApplied = () => remoteListeners.forEach((l) => l());
export const onRemoteApplied = (l: () => void) => {
  remoteListeners.add(l);
  return () => {
    remoteListeners.delete(l);
  };
};
