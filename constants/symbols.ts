import type { Ionicons } from '@expo/vector-icons';
import type { SFSymbol } from 'expo-symbols';

/**
 * The SF Symbol standing in for each Ionicon wherever the iPhone draws a
 * system control — a bar button, a native button, a settings row. In the
 * system's own controls its own symbols, at its own weight, sit right where
 * an Ionicon would read as a drawn-in stranger. A glyph missing here keeps
 * its Ionicon.
 */
const SYMBOLS: Partial<Record<keyof typeof Ionicons.glyphMap, SFSymbol>> = {
  'person-add-outline': 'person.badge.plus',
  'person-add': 'person.fill.badge.plus',
  search: 'magnifyingglass',
  add: 'plus',
  'settings-outline': 'gearshape',
  close: 'xmark',
  // The Camera app's own: the bolt for the flash, struck through while it's
  // off, and the two turning arrows for the other lens.
  flash: 'bolt.fill',
  'flash-outline': 'bolt.slash.fill',
  'camera-reverse-outline': 'arrow.triangle.2.circlepath',
  'happy-outline': 'face.smiling',
  'chevron-back': 'chevron.backward',
  'ellipsis-horizontal': 'ellipsis',
  'share-outline': 'square.and.arrow.up',
  'download-outline': 'square.and.arrow.down',
  checkmark: 'checkmark',
  'link-outline': 'link',
  'qr-code-outline': 'qrcode',
  'camera-outline': 'camera',
  camera: 'camera.fill',
  'sync-outline': 'arrow.2.circlepath',
  heart: 'heart.fill',
  'heart-outline': 'heart',
  'person-outline': 'person',
  'at-outline': 'at',
  'reorder-three-outline': 'text.alignleft',
  'notifications-outline': 'bell',
  'flag-outline': 'flag',
  'shield-outline': 'hand.raised',
  'document-outline': 'doc.text',
  'log-out-outline': 'rectangle.portrait.and.arrow.right',
  'trash-outline': 'trash',
  'eye-outline': 'eye',
  'person-circle-outline': 'person.crop.circle',
  'person-remove-outline': 'person.badge.minus',
  'close-circle-outline': 'xmark.circle',
  'calendar-outline': 'calendar',
  'cloud-offline-outline': 'icloud.slash',
  'images-outline': 'photo.on.rectangle',
  'lock-closed': 'lock.fill',
  'people-outline': 'person.2',
  'search-outline': 'magnifyingglass',
  'create-outline': 'pencil',
  'phone-portrait-outline': 'iphone',
  'sunny-outline': 'sun.max',
  'moon-outline': 'moon',
  'contrast-outline': 'circle.lefthalf.filled',
};

export const sfSymbolFor = (name: keyof typeof Ionicons.glyphMap) => SYMBOLS[name];
