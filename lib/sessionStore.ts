import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the phone keeps the signed-in session: the Keychain on iOS and the
 * Keystore-encrypted store on Android, rather than AsyncStorage's plain file,
 * which a backup or a rooted phone gives up as-is. The refresh token in it is
 * as good as the password.
 *
 * The secure store takes values of about 2 KB at most and a session runs
 * past that, so each one is kept in pieces under `<key>.0`, `<key>.1`, …
 * with the count at `<key>.n`.
 *
 * Sessions saved before this lived in AsyncStorage; the first read moves one
 * across and wipes the old copy, so nobody is signed out by the change.
 */

const PIECE = 1800;

async function read(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(`${key}.n`));
  if (!count) return null;
  const pieces = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
  );
  return pieces.every((piece) => piece !== null) ? pieces.join('') : null;
}

async function write(key: string, value: string) {
  const pieces: string[] = [];
  for (let i = 0; i < value.length; i += PIECE) pieces.push(value.slice(i, i + PIECE));
  await Promise.all(pieces.map((piece, i) => SecureStore.setItemAsync(`${key}.${i}`, piece)));
  await SecureStore.setItemAsync(`${key}.n`, String(pieces.length));
}

async function remove(key: string) {
  const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
  await SecureStore.deleteItemAsync(`${key}.n`);
}

export const sessionStore = {
  async getItem(key: string): Promise<string | null> {
    const stored = await read(key);
    if (stored !== null) return stored;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy === null) return null;
    await write(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  },
  setItem: write,
  async removeItem(key: string) {
    await remove(key);
    await AsyncStorage.removeItem(key);
  },
};

export default sessionStore;
