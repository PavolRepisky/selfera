import { useId, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, G, Mask } from 'react-native-svg';

import { colors, gradients, layout, radii, shadows, colorsFor } from '@/constants/theme';
import { Avatar, type AvatarSource } from './Avatar';
import { Text } from './Text';

/** The band's stroke: heavy enough to read as a gauge at the Community row's
 * 64pt, light enough not to crowd the face at My Profile's size. */
const ringWidth = 3.5;
/** Clear air between the ring and the photo, so it reads as a gauge around
 * the face rather than a coloured border on it — My Profile's own rule. */
const RING_GAP = 3;
/** The visible gap between two segments, measured along the ring. */
const SEGMENT_GAP = 5;
/** The count badge, sized to sit across the ring's bottom edge the way the
 * profile's own badge sits across its bigger ring. */
const BADGE_HEIGHT = 20;
const BADGE_BORDER = 2;
/** A watched segment keeps its accent, washed out — still the ring's own
 * colour, so it reads as seen rather than as a different kind of mark, and
 * clearly quieter than what's new beside it. */
const WATCHED_OPACITY = 0.35;
/**
 * Room the SVG gets past the ring on every side. The band's outer edge sits
 * exactly on `size`, so with no margin its anti-aliased rim fell outside the
 * canvas and got clipped — worst at a fractional size like a post's 37.9,
 * where the right edge snapped to the pixel short of it.
 */
const SVG_BLEED = 1;

/**
 * My Profile's ring, as fractions of the photo inside it: its 120pt face
 * wears a 6pt band 5pt clear of the photo, with 7pt between segments. The
 * `profile` look keeps exactly those proportions at any size.
 */
const PROFILE_STROKE = 6 / 120;
const PROFILE_GAP = 5 / 120;
const PROFILE_SEGMENT_GAP = 7 / 120;
/** The profile ring's sweep: thin flat-coloured arcs standing in for the
 * conic gradient SVG doesn't have, each overlapping the next a touch so no
 * seam of background shows between them. */
const SWEEP_SLICES = 90;
const SWEEP_OVERLAP = 0.6;

/** The outer size of a `profile` ring around a `face`-sized photo, its band
 * `strokeScale` times My Profile's. */
export const profileRingSize = (face: number, strokeScale = 1) =>
  Math.round(face * (1 + 2 * (PROFILE_STROKE * strokeScale + PROFILE_GAP)));

/** Blends two `#RRGGBB` colours, `t` of the way from `a` to `b`. */
function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** The accent at `t` of the way along it, spread evenly over its stops —
 * how a ring reads its colour off where a segment sits on the circle. */
export function accentAt(t: number): string {
  const stops = gradients.accent;
  const scaled = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  return mixHex(stops[i], stops[i + 1], scaled - i);
}

export interface TaskRingProps {
  avatar: AvatarSource;
  done: number;
  total: number;
  /** How many of the done segments you've already watched as stories —
   * they're drawn in a faded accent. */
  watched?: number;
  /** Outer diameter, ring included. */
  size: number;
  /** The "3/5" across the ring's bottom. Off where the ring is too small to
   * carry it — a post's face beside the poster's name. */
  badge?: boolean;
  /**
   * `story` is the story row's ring: a heavier band, each done segment one
   * flat accent. `profile` is My Profile's own ring at this size — its
   * proportions, the accent sweeping continuously round the circle behind
   * the done segments, and the photo lifted on its hard shadow.
   */
  look?: 'story' | 'profile';
  /** The `profile` look's band as a multiple of My Profile's — over 1 where
   * the ring is drawn small and its true-to-scale band would read as a
   * hairline. Use `profileRingSize` to size the ring around the same face. */
  strokeScale?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Drawn in the face's place, at its size — the Tasks shutter, whose ring
   * is the day's own. `avatar` is then ignored. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A face in the app's split ring: one segment per task, filled clockwise from
 * 12 o'clock as they get done, each done segment wearing the accent where it
 * sits on the circle — My Profile's ring at the size of a story row, with the
 * same "3/5" badge clipped across its bottom. It only means anything while a
 * day is under way, so it is what stands for someone still going.
 *
 * Where it leads to a story, the done segments you've already watched fade
 * from the start of the ring, so only what's new wears the accent at full
 * strength.
 */
export function TaskRing({
  avatar,
  done,
  total,
  watched = 0,
  size,
  badge = true,
  look = 'story',
  strokeScale = 1,
  onPress,
  accessibilityLabel,
  children,
  style,
}: TaskRingProps) {
  // Drawn in SVG, which takes plain colours rather than ones that follow the
  // phone's appearance, so the ring picks its greys for the one on show.
  const svgColors = colorsFor(useColorScheme());
  // Unique per ring, so two profile rings on one screen don't share a mask.
  const maskId = `ringDone${useId().replace(/[^A-Za-z0-9]/g, '')}`;

  if (look === 'profile') {
    const band = PROFILE_STROKE * strokeScale;
    const face = size / (1 + 2 * (band + PROFILE_GAP));
    const stroke = face * band;
    const inset = face * (band + PROFILE_GAP);
    const r = (size - stroke) / 2;
    const around = 2 * Math.PI * r;
    const count = Math.max(total, 1);
    const segGap = face * PROFILE_SEGMENT_GAP;
    const canvas = size + SVG_BLEED * 2;
    const centre = canvas / 2;
    const segment = (i: number, colour: string) => (
      <Circle
        key={i}
        cx={centre}
        cy={centre}
        r={r}
        stroke={colour}
        strokeWidth={stroke}
        strokeLinecap={count > 1 ? 'round' : 'butt'}
        fill="none"
        strokeDasharray={`${count > 1 ? Math.max(0.01, around / count - segGap - stroke) : around} ${around}`}
        transform={`rotate(${-90 + (i * 360) / count + (count > 1 ? ((segGap + stroke) / 2 / around) * 360 : 0)} ${centre} ${centre})`}
      />
    );

    return (
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel ?? `${done} of ${total} tasks done`}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed, style]}
      >
        <Svg width={canvas} height={canvas} style={styles.ring}>
          <Defs>
            <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={canvas} height={canvas}>
              {Array.from({ length: Math.min(done, count) }, (_, i) =>
                segment(i, svgColors.onMedia),
              )}
            </Mask>
          </Defs>
          {Array.from({ length: count }, (_, i) => (i < done ? null : segment(i, svgColors.inkGhost)))}
          <G mask={`url(#${maskId})`}>
            {Array.from({ length: SWEEP_SLICES }, (_, i) => (
              <Circle
                key={i}
                cx={centre}
                cy={centre}
                r={r}
                stroke={accentAt((i + 0.5) / SWEEP_SLICES)}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${around / SWEEP_SLICES + SWEEP_OVERLAP} ${around}`}
                transform={`rotate(${-90 + (i * 360) / SWEEP_SLICES} ${centre} ${centre})`}
              />
            ))}
          </G>
        </Svg>
        <View
          style={[
            styles.photo,
            styles.profileDisc,
            shadows.hard,
            { top: inset, left: inset, width: face, height: face, borderRadius: face / 2 },
          ]}
        >
          {children ?? <Avatar source={avatar} size={face} />}
        </View>
      </Pressable>
    );
  }

  const radius = (size - ringWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const count = Math.max(total, 1);
  const slot = circumference / count;
  // Round caps grow each arc by half a stroke at either end, so the drawn
  // length gives that back to keep the gaps the size they say.
  const length = count === 1 ? circumference : Math.max(0.01, slot - SEGMENT_GAP - ringWidth);
  const inset = count === 1 ? 0 : (((SEGMENT_GAP + ringWidth) / 2) / circumference) * 360;
  const avatarSize = size - (ringWidth + RING_GAP) * 2;
  const canvas = size + SVG_BLEED * 2;
  const centre = canvas / 2;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? `${done} of ${total} tasks done`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed, style]}
    >
      <Svg width={canvas} height={canvas} style={styles.ring}>
        {Array.from({ length: count }, (_, i) => (
          <Circle
            key={i}
            cx={centre}
            cy={centre}
            r={radius}
            stroke={i < done ? accentAt((i + 0.5) / count) : svgColors.inkGhost}
            strokeOpacity={i < Math.min(watched, done) ? WATCHED_OPACITY : 1}
            strokeWidth={ringWidth}
            strokeLinecap={count > 1 ? 'round' : 'butt'}
            fill="none"
            strokeDasharray={`${length} ${circumference}`}
            transform={`rotate(${-90 + (i * 360) / count + inset} ${centre} ${centre})`}
          />
        ))}
      </Svg>
      <View style={[styles.photo, { top: ringWidth + RING_GAP, left: ringWidth + RING_GAP }]}>
        {children ?? <Avatar source={avatar} size={avatarSize} />}
      </View>
      {badge ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.badge}
        >
          <Text variant="badge" color={colors.inkInverse}>
            {`${done}/${total}`}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Pulled back by its bleed, so the ring itself still lands on the box.
  ring: {
    position: 'absolute',
    top: -SVG_BLEED,
    left: -SVG_BLEED,
  },
  photo: {
    position: 'absolute',
  },
  // The avatar's own shape behind the photo, so the hard shadow has
  // something solid to cast from — My Profile's disc.
  profileDisc: {
    backgroundColor: colors.backgroundPlain,
  },
  // Centred on the ring's bottom stroke, ringed in the page's white so it
  // reads as sitting on the gauge rather than merging into it.
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -(BADGE_HEIGHT - ringWidth) / 2,
    height: BADGE_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: layout.pill,
    borderRadius: radii.pill,
    borderWidth: BADGE_BORDER,
    borderColor: colors.backgroundPlain,
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default TaskRing;
