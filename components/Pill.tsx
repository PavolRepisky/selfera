import { Ionicons } from '@expo/vector-icons';
import { Button, Host, Label } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import {
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { quicksand, tint } from '@/lib/swiftUI';
import { sfSymbolFor } from '@/constants/symbols';
import { colors, colorsFor, radii, shadows, spacing, type ThemeColor } from '@/constants/theme';
import { LIQUID_GLASS, LiquidGlass } from './GlassSurface';
import { NATIVE_HEADER } from './Screen';
import { Text, type TextProps } from './Text';

export interface PillProps {
  label: string;
  /**
   * `floating` is the white overlay pill ("+10,000 joined", "Day 5").
   * `outline` is an ink ring on the page's white: an action repeated down a
   * list, like Invite, where a row of solid pills would stack into a wall
   * of black. `onInk` is the quieter of two buttons on an `ink` card: a
   * lighter patch of the card with a white label.
   */
  tone?: 'floating' | 'solid' | 'muted' | 'outline' | 'onInk';
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Leading glyph. An icon rather than a character in the label because
   * Quicksand has no check-mark glyph.
   */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Glyph after the label — a chevron on a pill that opens somewhere. Held
   * to the muted grey whatever the tone, so it reads as a hint about the tap
   * rather than a second word competing with the label.
   */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  /**
   * Sets the label in the heaviest cut Quicksand has. For the badges that have
   * to hold their own over a photograph rather than over the page.
   */
  bold?: boolean;
  /**
   * The label's type, when the pill's size and tone don't pick the right one
   * on their own — Discover's cards' photo badges set theirs a size up
   * from the small bold default, to read at a glance over the photo.
   */
  labelVariant?: TextProps['variant'];
  /**
   * The label's and leading icon's colour, when the word stands for an
   * absence rather than a value — a reminder set to Never reads in the
   * muted grey beside the times that are set.
   */
  labelColor?: ThemeColor;
  /**
   * Figures that hold their width, for a label that ticks — Tasks' clock
   * over the post — so it doesn't shuffle sideways every second.
   */
  tabular?: boolean;
  /**
   * A range's far end, so the pill reads "label → to" — a finished round's
   * "Finished · Jun 1 → Aug 14". The arrow is an icon because Quicksand has
   * no glyph for it.
   */
  to?: string;
  /**
   * Off, the pill goes rather than unmounting at once: on the iPhone a
   * floating one dissolves back into the photo the way it came; elsewhere
   * it is simply not drawn.
   */
  visible?: boolean;
  /**
   * The pill floats over a photo — a cover, a story, a hero. On iPhones with
   * liquid glass it is then the system's own glass; glass is for what floats
   * over the content, so a pill on the page or on a card stays the system's
   * ordinary capsule button there.
   */
  overMedia?: boolean;
  /**
   * Drawn on the iPhone too rather than as the system's blue capsule: for a
   * pair of everyday buttons on a page — a profile's Edit and Share — where
   * blue would make them read as the page's one call to act. The caller
   * gives it the fill grey.
   */
  grey?: boolean;
}

/**
 * The rounded label that shows up everywhere: joined-counts overlapping photo
 * strips, the Day N badge under the avatar, the readout above the ruler
 * sliders.
 */
export function Pill(props: PillProps) {
  // A pill you can press is a button, and on the iPhone it is the system's
  // own; a pill that only says something — a count on a photo, a date —
  // stays drawn.
  // The floating one over a photo is the exception: it is the system's glass
  // itself, which materialises and dissolves and answers the finger the way
  // the system's own glass buttons do — a SwiftUI button can't come and go
  // like that.
  const floatingGlass =
    LIQUID_GLASS && !!props.overMedia && (props.tone ?? 'floating') === 'floating';
  if (props.visible === false && !floatingGlass) return null;
  // A `grey` one stays drawn too: the system capsule only takes a wash of a
  // tint, which never lands on the palette's fill grey.
  const button =
    NATIVE_HEADER && !floatingGlass && props.onPress && !props.to && !props.trailingIcon && !props.grey;
  return button ? <SystemPill {...props} /> : <DrawnPill {...props} />;
}

/** The air added round a system pill's label, on top of what its control
 * size gives — the regular capsule sat tight on its words. */
const PILL_LIFT = spacing.xs;
const PILL_WIDEN = spacing.xs;

/** Each size as the system's control sizes. */
const CONTROL_SIZES = { sm: 'small', md: 'regular', lg: 'large' } as const;

/**
 * On the iPhone, a pressable pill as SwiftUI's own capsule button: the solid
 * one filled (prominent) in the system blue, the quieter tones bordered — a
 * soft fill of the blue — and a floating one over a photo in the system's
 * glass. The
 * system sets its label, its press and its size; the glyph is an SF Symbol.
 */
function SystemPill({
  label,
  tone = 'floating',
  size = 'md',
  onPress,
  style,
  icon,
  labelColor,
}: PillProps) {
  // SwiftUI takes plain colours, picked for the appearance on show.
  const scheme = colorsFor(useColorScheme());
  const symbol = icon ? sfSymbolFor(icon) : undefined;
  const words =
    typeof labelColor === 'string'
      ? labelColor
      : labelColor === colors.inkMuted
        ? scheme.inkMuted
        : undefined;

  // In the system blue, as the iPhone's own apps tint theirs: the solid pill
  // filled with white type, the quieter ones a soft blue capsule with blue
  // type; the one on an ink card stays white. A floating pill over a photo
  // never lands here — it is the system's glass, drawn in `DrawnPill` — so a
  // floating one here sits on the page or a card and is the plain capsule.
  const labelInk =
    words ??
    (tone === 'solid'
      ? scheme.onMedia
      : tone === 'onInk'
        ? scheme.inkInverse
        : scheme.systemAccent);
  const look =
    tone === 'solid'
      ? [buttonStyle('borderedProminent'), tint(scheme.systemAccent)]
      : tone === 'onInk'
        ? [buttonStyle('bordered'), tint(scheme.inkInverse)]
        : [buttonStyle('bordered'), tint(scheme.systemAccent)];

  // A pill its row stretches — one of a pair of equal buttons — fills the
  // width it's given; any other sizes to its label.
  const flat = StyleSheet.flatten(style) ?? {};
  const fills = flat.alignSelf === 'stretch' || flat.flex !== undefined || flat.width !== undefined;
  // Only where it sits carries over: a fill or a corner meant for the drawn
  // pill would paint a box behind the system's capsule.
  const {
    backgroundColor: _fill,
    borderRadius: _corner,
    borderWidth: _rule,
    borderColor: _ruleColor,
    ...placement
  } = flat;

  return (
    // Horizontal matching is turned off outright for a filling pill, as
    // `PrimaryButton` does: left unset, the host still hugged the label and
    // the pair sat narrow in the middle of their halves.
    <Host matchContents={fills ? { vertical: true, horizontal: false } : true} style={placement}>
      {/* The label is a view of its own so it can carry a little more air
          above and below than the control gives it; a nested view doesn't
          take the button's colour (it fell back to the system's blue), so
          its colour and type are set on it directly. */}
      <Button
        onPress={onPress}
        modifiers={[
          ...look,
          buttonBorderShape('capsule'),
          controlSize(CONTROL_SIZES[size]),
          ...(fills ? [frame({ maxWidth: Number.MAX_SAFE_INTEGER })] : []),
        ]}
      >
        <Label
          title={label}
          systemImage={symbol}
          modifiers={[
            // `PrimaryButton`'s label — Quicksand SemiBold at body size — so
            // a pill and a button read as the same kind of thing; a small
            // pill keeps the weight at the smaller size its control sets.
            quicksand(size === 'sm' ? 'subheadline' : 'body', 'semibold'),
            foregroundStyle(labelInk),
            padding({ vertical: PILL_LIFT, horizontal: PILL_WIDEN }),
            // The capsule is drawn round the label, so a filling pill's label
            // has to reach across too — a frame on the button alone widened
            // the space it sat in but left the capsule hugging the words.
            ...(fills ? [frame({ maxWidth: Number.MAX_SAFE_INTEGER })] : []),
          ]}
        />
      </Button>
    </Host>
  );
}

function DrawnPill({
  label,
  tone = 'floating',
  size = 'md',
  onPress,
  style,
  icon,
  trailingIcon,
  bold,
  labelVariant,
  labelColor,
  tabular,
  to,
  visible = true,
  overMedia,
}: PillProps) {
  const ink =
    labelColor ?? (tone === 'solid' || tone === 'onInk' ? colors.inkInverse : colors.ink);
  const variant: NonNullable<TextProps['variant']> =
    labelVariant ??
    (bold
      ? size === 'sm'
        ? // `solid` and `floating` size=sm bold pills are, today, the
          // my-challenge card's two photo badges — they earn the
          // heaviest small cut Quicksand has, the same one the profile
          // grid's own photo-badge counts use, so the pair reads as
          // one weight rather than two.
          tone === 'solid' || tone === 'floating'
          ? 'microBold'
          : 'labelBold'
        : 'bodyBold'
      : size === 'sm'
        ? 'label'
        : size === 'lg'
          ? 'button'
          : 'bodyStrong');
  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={size === 'sm' ? 13 : 16}
          color={ink}
          style={styles.icon}
        />
      ) : null}
      <Text variant={variant} color={ink} style={tabular ? styles.tabular : undefined}>
        {label}
      </Text>
      {to ? (
        <>
          <Ionicons
            name="arrow-forward"
            size={size === 'sm' ? 12 : 14}
            color={ink}
            style={styles.rangeArrow}
          />
          <Text variant={variant} color={ink}>
            {to}
          </Text>
        </>
      ) : null}
      {trailingIcon ? (
        <Ionicons
          name={trailingIcon}
          size={size === 'sm' ? 12 : 14}
          color={colors.inkMuted}
          style={styles.trailingIcon}
        />
      ) : null}
    </>
  );

  // On the iPhone with liquid glass, the floating pill is the system's own
  // glass capsule — the photo under it bends through — rather than a white
  // one with a drawn shadow.
  const glassy = LIQUID_GLASS && !!overMedia && tone === 'floating';
  const body = glassy ? (
    <LiquidGlass
      interactive={!!onPress}
      visible={visible}
      style={[styles.base, SIZES[size], style]}
    >
      {content}
    </LiquidGlass>
  ) : (
    <View
      style={[
        styles.base,
        SIZES[size],
        TONES[tone],
        tone === 'floating' && shadows.soft,
        style,
      ]}
    >
      {content}
    </View>
  );

  if (!onPress) return body;

  // A pill its row stretches — one of a pair of equal buttons — needs the
  // stretch on the pressable round it too, or that hugs the label and the
  // pill inside it can't grow.
  const { flex, alignSelf, width } = StyleSheet.flatten(style) ?? {};

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!visible}
      // Gone, it lets taps through to whatever lies under it — a story's
      // own tap-to-step sides.
      pointerEvents={visible ? 'auto' : 'none'}
      // The glass answers the press itself — it swells under the finger — so
      // dimming it as well would be a second press drawn over the first.
      style={({ pressed }) => [{ flex, alignSelf, width }, pressed && !glassy && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/**
 * Outer height of each size. Exported because a caller that laps a pill over
 * something else — the joined badge straddling a photo strip — has to know how
 * tall it is to work out the overhang.
 */
export const pillHeights = { sm: 28, md: 38, lg: 48 } as const;

/** The `outline` ring: heavier than a hairline so it reads as a button, not
 * a box drawn round a word. */
const OUTLINE_RULE = 1.5;

const SIZES = StyleSheet.create({
  sm: { paddingHorizontal: spacing.md, height: pillHeights.sm },
  md: { paddingHorizontal: spacing.lg, height: pillHeights.md },
  lg: { paddingHorizontal: spacing['2xl'], height: pillHeights.lg },
});

const TONES = StyleSheet.create({
  floating: { backgroundColor: colors.surface },
  solid: { backgroundColor: colors.ink },
  muted: { backgroundColor: colors.surfaceMuted },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: OUTLINE_RULE,
    borderColor: colors.ink,
  },
  onInk: { backgroundColor: colors.onInkFill },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 5,
  },
  trailingIcon: {
    marginLeft: spacing.xs,
  },
  rangeArrow: {
    marginHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});

export default Pill;
