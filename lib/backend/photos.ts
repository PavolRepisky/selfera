import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';

import { supabase } from '@/lib/supabase';

/**
 * Getting photos up and back down.
 *
 * Every photo is uploaded twice, made on the phone: a full one for the
 * viewer and a small one for grids. Storage could resize on request, but it
 * bills per source photo and every task photo is a new one, so the phone
 * does it for free instead.
 */

/** Long edge of the full photo — sharp on any phone screen, a few hundred
 * KB as a JPEG. */
const FULL_EDGE = 1600;
/** Long edge of a grid thumbnail: a third of a screen at 3×. */
const THUMB_EDGE = 480;
/** JPEG quality. Below about 0.7 skin and skies start to band. */
const QUALITY = 0.8;
/** How long a signed link to a task photo works — a session's scrolling. */
export const SIGNED_URL_SECONDS = 60 * 60;

export type Bucket = 'avatars' | 'challenge-photos' | 'task-photos';

interface Prepared {
  full: Uint8Array;
  thumb: Uint8Array;
}

/** Resizes by the long edge, whichever way the shot was held — and never
 * up: a small photo stays its own size. */
async function jpeg(original: ImageRef, edge: number): Promise<Uint8Array> {
  const { width, height } = original;
  const size = width >= height ? { width: Math.min(edge, width) } : { height: Math.min(edge, height) };
  const image = await ImageManipulator.manipulate(original).resize(size).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  return decodeBase64(saved.base64!);
}

/**
 * A photo picked from the iPhone's library comes as `ph://<id>`, an address
 * in the Photos app rather than a file; the library hands back the file it
 * stands for. Everything else — the camera's shots, Android's library — is a
 * file already.
 */
async function readableUri(uri: string): Promise<string> {
  if (!uri.startsWith('ph://')) return uri;
  const info = await MediaLibrary.getAssetInfoAsync(uri.slice('ph://'.length));
  return info.localUri ?? uri;
}

/** Decodes the shot once — which is also what tells its size, so the
 * camera and library needn't — and makes both sizes from it. */
async function prepare(uri: string): Promise<Prepared> {
  const original = await ImageManipulator.manipulate(await readableUri(uri)).renderAsync();
  const [full, thumb] = await Promise.all([jpeg(original, FULL_EDGE), jpeg(original, THUMB_EDGE)]);
  return { full, thumb };
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A name nobody else's upload will share, so a retake never overwrites the
 * photo a friend's phone may still have cached. */
function freshName(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function put(bucket: Bucket, path: string, bytes: Uint8Array) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
}

export interface UploadedTaskPhoto {
  photoPath: string;
  thumbPath: string;
}

/**
 * Uploads a task photo into today's folder — the only folder storage lets
 * you write to, and the one `complete_task` checks the paths against.
 */
export async function uploadTaskPhoto(
  userId: string,
  membershipId: string,
  day: number,
  photo: { uri: string },
): Promise<UploadedTaskPhoto> {
  const { full, thumb } = await prepare(photo.uri);
  const base = `${userId}/${membershipId}/${day}/${freshName()}`;
  const photoPath = `${base}.jpg`;
  const thumbPath = `${base}_thumb.jpg`;
  await Promise.all([put('task-photos', photoPath, full), put('task-photos', thumbPath, thumb)]);
  return { photoPath, thumbPath };
}

/** A new profile photo, or a challenge's cover. Public, so the link never
 * expires. */
export async function uploadPublicPhoto(
  bucket: Exclude<Bucket, 'task-photos'>,
  userId: string,
  photo: { uri: string },
): Promise<string> {
  const { full } = await prepare(photo.uri);
  const path = `${userId}/${freshName()}.jpg`;
  await put(bucket, path, full);
  return path;
}

export function publicUrl(bucket: Exclude<Bucket, 'task-photos'>, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** The storage path behind one of `publicUrl`'s links, or null for any other
 * address — how an edit tells a photo that's already up from a new pick. */
export function storedPath(bucket: Exclude<Bucket, 'task-photos'>, uri: string): string | null {
  const prefix = publicUrl(bucket, '');
  return uri.startsWith(prefix) ? decodeURIComponent(uri.slice(prefix.length)) : null;
}

/**
 * Signed links for task photos, by path. A photo behind the Community lock
 * comes back without one — storage refuses to sign it — which is the app's
 * cue to draw it blurred.
 */
export async function signedUrls(paths: readonly string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from('task-photos')
    .createSignedUrls([...paths], SIGNED_URL_SECONDS);
  if (error) throw error;
  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}

/**
 * A task photo to draw, cached under its storage path rather than its link.
 * Every reload signs a fresh link, which expo-image would take for a new
 * picture and fetch again; the path never changes, since a retake uploads
 * under a new name (`freshName`). Undefined while storage won't sign it.
 */
export function taskPhotoSource(
  urls: Record<string, string>,
  path: string,
): { uri: string; cacheKey: string } | undefined {
  const uri = urls[path];
  return uri ? { uri, cacheKey: path } : undefined;
}

/** Removes photos a retake or an undo left behind. Best effort: an orphaned
 * file costs a few hundred KB, not a broken screen. */
export async function removePhotos(bucket: Bucket, paths: readonly string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(bucket).remove([...paths]);
}
