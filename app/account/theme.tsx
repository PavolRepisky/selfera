import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';

import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { appearancePreview, colors, layout, radii } from '@/constants/theme';
import {
  APPEARANCE_CHOICES,
  setAppearance,
  useAppearance,
  type AppearanceChoice,
} from '@/lib/appearance';

/** The little phone's drawing, in its own units: a phone's proportions,
 * scaled to whatever width its column gives it. */
const PHONE_W = 100;
const PHONE_H = 198;
const PHONE_CORNER = 18;
/** The phone takes this much of its column, leaving air between the three. */
const PHONE_SHARE = 0.8;
/** The choice's round button, the size of the system's own. */
const RADIO = 24;
const RADIO_CHECK = 15;
const RADIO_RING = 1.5;

/**
 * Light, dark, or automatic, opened from Settings' Theme row: the three side
 * by side as little phones in one card, each with a round button under it,
 * the way the iPhone's own Display settings offer the choice. One tap on a
 * phone, its name or its button changes it, and the whole app follows
 * straight away.
 */
export default function ThemeScreen() {
  const choice = useAppearance();
  return (
    <ScreenScroll tone="alt" tabBar header={<ScreenHeader plainTitle="Theme" />}>
      <View style={styles.card}>
        {APPEARANCE_CHOICES.map((c) => {
          const selected = c.key === choice;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="radio"
              accessibilityLabel={c.label}
              accessibilityState={{ selected }}
              onPress={() => setAppearance(c.key)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.phone}>
                <PhonePreview look={c.key} />
              </View>
              <Text variant="copy" center>
                {c.label}
              </Text>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <Ionicons name="checkmark" size={RADIO_CHECK} color={colors.onAccent} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScreenScroll>
  );
}

/**
 * One look as a little phone: a bar at the top, a big block, two small ones
 * and a line — a page reduced to its shapes. Automatic is the light phone
 * with the dark one laid over it from corner to corner, half and half.
 */
function PhonePreview({ look }: { look: AppearanceChoice }) {
  const screen = (tone: 'light' | 'dark') => {
    const c = appearancePreview[tone];
    return (
      <>
        <Rect x={0} y={0} width={PHONE_W} height={PHONE_H} fill={c.page} />
        <Rect x={26} y={18} width={48} height={6} rx={3} fill={c.bar} />
        <Rect x={10} y={32} width={80} height={66} rx={10} fill={c.block} />
        <Rect x={10} y={106} width={37} height={40} rx={8} fill={c.block} />
        <Rect x={53} y={106} width={37} height={40} rx={8} fill={c.block} />
        <Rect x={10} y={153} width={58} height={6} rx={3} fill={c.line} />
      </>
    );
  };
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${PHONE_W} ${PHONE_H}`}>
      {/* Ids carry the look: on the web they share one page, and three
          phones' clips under one name would all take the first one's. */}
      <Defs>
        <ClipPath id={`phone-${look}`}>
          <Rect x={0} y={0} width={PHONE_W} height={PHONE_H} rx={PHONE_CORNER} />
        </ClipPath>
        <ClipPath id={`night-${look}`}>
          <Polygon points={`${PHONE_W},0 ${PHONE_W},${PHONE_H} 0,${PHONE_H}`} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#phone-${look})`}>
        {screen(look === 'dark' ? 'dark' : 'light')}
        {look === 'system' ? <G clipPath={`url(#night-${look})`}>{screen('dark')}</G> : null}
      </G>
      <Rect
        x={0.5}
        y={0.5}
        width={PHONE_W - 1}
        height={PHONE_H - 1}
        rx={PHONE_CORNER}
        fill="none"
        stroke={appearancePreview.edge}
        strokeWidth={1}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // The three side by side in one white card, as a settings group is.
  card: {
    flexDirection: 'row',
    paddingVertical: layout.card,
    paddingHorizontal: layout.stack,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: layout.heading,
  },
  phone: {
    width: `${PHONE_SHARE * 100}%`,
    aspectRatio: PHONE_W / PHONE_H,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: RADIO_RING,
    borderColor: colors.inkGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The system blue on the iPhone, where the choice stands in for a system
  // control; ink elsewhere, since the drawn look has no accent of its own.
  radioSelected: {
    borderColor: NATIVE_HEADER ? colors.systemAccent : colors.ink,
    backgroundColor: NATIVE_HEADER ? colors.systemAccent : colors.ink,
  },
  pressed: {
    opacity: 0.7,
  },
});
