import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

export interface Proof {
  id: string;
  /** When the session finished (ms since epoch). */
  ts: number;
  start?: string;
  end?: string;
}

const KEY = 'proofs.v1';
const KEEP = 60;

/** Copy a camera photo out of the cache so the system can't delete it. */
export function persistPhoto(uri: string, name: string): string {
  const dest = new File(Paths.document, name);
  if (dest.exists) dest.delete();
  new File(uri).copy(dest);
  return dest.uri;
}

export function deletePhoto(uri?: string): void {
  try {
    if (uri) new File(uri).delete();
  } catch {}
}

export async function loadProofs(): Promise<Proof[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Proof[]) : [];
  } catch {
    return [];
  }
}

/** Remove one session's photos from the phone and from the list. */
export async function deleteProof(id: string): Promise<void> {
  const all = await loadProofs();
  const target = all.find((p) => p.id === id);
  if (target) {
    deletePhoto(target.start);
    deletePhoto(target.end);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((p) => p.id !== id)));
}

export async function saveProof(proof: Proof): Promise<void> {
  const all = [proof, ...(await loadProofs())];
  for (const old of all.slice(KEEP)) {
    deletePhoto(old.start);
    deletePhoto(old.end);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, KEEP)));
}
