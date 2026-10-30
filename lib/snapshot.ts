import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The last state the app loaded, kept on the phone so a launch can draw it at
 * once and refresh from the server behind it, instead of holding the splash
 * on the network. Each copy names the account it belongs to, so it is only
 * ever read back for that account, and logging out wipes them all.
 *
 * Only what came off the server or the camera goes in: bundled photos are
 * `require()` ids, which a new build can renumber, so whoever saves strips
 * them and puts them back from the presets on the way out.
 */

type Name = 'account' | 'social';

/** Bumped whenever a saved shape changes, so an older copy is dropped rather
 * than read as the new one. */
const VERSION = 1;

const key = (name: Name) => `selfera.snapshot.${name}`;

interface Stored<T> {
  v: number;
  userId: string;
  data: T;
}

export async function readSnapshot<T>(name: Name, userId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key(name));
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored<T>;
    return stored.v === VERSION && stored.userId === userId ? stored.data : null;
  } catch {
    return null;
  }
}

export function writeSnapshot<T>(name: Name, userId: string, data: T) {
  const stored: Stored<T> = { v: VERSION, userId, data };
  AsyncStorage.setItem(key(name), JSON.stringify(stored)).catch(() => {});
}

export async function clearSnapshots() {
  await AsyncStorage.multiRemove([key('account'), key('social')]).catch(() => {});
}

/** A photo worth saving: one with an address, not a bundled `require()`. */
export function remotePhoto<S>(source: S): S | undefined {
  return source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string'
    ? source
    : undefined;
}
