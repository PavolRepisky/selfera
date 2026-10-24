import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { absoluteFill, colors, layout } from '@/constants/theme';
import { clock24 } from '@/lib/format';
import { Text } from './Text';

/** The caption's drop: a short soft blur a point below the letters. */
const STAMP_SHADOW_RADIUS = 4;
const STAMP_SHADOW_OFFSET = { width: 0, height: 1 };

export interface ShotStampProps {
  /** When it was shot, as stored — shown on the 24-hour clock. */
  time?: string | null;
  /** The task the photo proves. */
  label?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * When a photo was shot over what it proves, across the middle of it the way
 * a short video titles itself — in white, on only a faint drop, no band
 * behind it, so the photo keeps its colour. Laid over the whole photo it
 * sits on; a post's photo slides and a story's frames both wear it, so the
 * same shot reads the same in either.
 */
export function ShotStamp({ time, label, style }: ShotStampProps) {
  if (!time && !label) return null;
  return (
    <View style={[styles.root, style]} pointerEvents="none">
      {time ? (
        <Text variant="shotTitle" color={colors.shotStamp} center style={styles.line}>
          {clock24(time.trim())}
        </Text>
      ) : null}
      {label ? (
        <Text variant="shotTitle" color={colors.shotStamp} numberOfLines={2} center style={styles.line}>
          {/* Lower case, as a caption typed over a short video reads —
              "walk 10k steps" — not a title. */}
          {label.toLowerCase()}
        </Text>
      ) : null}
    </View>
  );
}

export default ShotStamp;

const styles = StyleSheet.create({
  // Centred on the photo, held a card's inset off its sides so a long task
  // wraps before it reaches the edge; the two lines set tight, as one title.
  root: {
    ...absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.card,
  },
  // A faint drop, close in, so the white holds on a bright shot without
  // reading as a glow round the letters.
  line: {
    textShadowColor: colors.shotStampShadow,
    textShadowOffset: STAMP_SHADOW_OFFSET,
    textShadowRadius: STAMP_SHADOW_RADIUS,
  },
});
