import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, spacing } from '@/constants/theme';
import type { ImageSourcePropType } from '@/lib/imageSource';
import { Text } from './Text';

/** The white disc holding an inviting slot's `+` — big enough to read as
 * the thing to tap, small enough to leave the tile a tile. */
const ADD_DISC = 44;
const ADD_GLYPH = 24;

export interface PhotoSlotProps {
  /** The photo; left empty, the slot is a `+` asking for one. */
  photo?: ImageSourcePropType | null;
  width?: number;
  height?: number;
  radius?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Turns the empty tile from a flat grey block into an invitation: the `+`
   * on a white disc, with this caption under it.
   */
  emptyLabel?: string;
  /** Degrees off straight. A shade of tilt reads as a photo laid on the page
   * rather than a thumbnail placed in a grid. */
  tilt?: number;
  /** Overrides the read-out label. */
  accessibilityLabel?: string;
}

/**
 * A photo, or the rounded tile waiting for one — the new-challenge screen's
 * cover prints and the slot that adds another.
 */
export function PhotoSlot({
  photo,
  width = 88,
  height = 118,
  radius = radii.lg,
  onPress,
  style,
  emptyLabel,
  tilt,
  accessibilityLabel,
}: PhotoSlotProps) {
  const box: ViewStyle = { width, height, borderRadius: radius };

  const inner = photo ? (
    <View style={[box, styles.clip]}>
      <Image source={photo} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
    </View>
  ) : (
    <View style={[styles.empty, box, emptyLabel ? styles.emptyPadded : null]}>
      {emptyLabel ? (
        <>
          <View style={styles.addDisc}>
            <Ionicons name="add" size={ADD_GLYPH} color={colors.ink} />
          </View>
          <Text variant="meta" color={colors.inkMuted} center style={styles.emptyLabel}>
            {emptyLabel}
          </Text>
        </>
      ) : (
        <Ionicons name="add" size={28} color={colors.field} />
      )}
    </View>
  );

  const wrapper = [tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null, style];

  if (!onPress) return <View style={wrapper}>{inner}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (photo ? 'View photo' : 'Add photo')}
      onPress={onPress}
      style={({ pressed }) => [wrapper, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  empty: {
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The white disc and its ink `+` are what separate "nothing here yet" from
   * "nothing goes here": a bare tile of the grey reads as a disabled
   * thumbnail. A dashed outline did this job once and was dropped — it
   * shouted over the photos beside it.
   */
  addDisc: {
    width: ADD_DISC,
    height: ADD_DISC,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  /** Air either side, so a long caption wraps short of the tile's edge. */
  emptyPadded: {
    paddingHorizontal: spacing.sm,
  },
  emptyLabel: {
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default PhotoSlot;
