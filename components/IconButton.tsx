import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { createContext, useContext } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { sfSymbolFor } from '@/constants/symbols';
import { colors, shadows, colorsFor, type ThemeColor } from '@/constants/theme';
import { GlassSurface, LIQUID_GLASS, LiquidGlass } from './GlassSurface';
import type { GlassColorScheme } from 'expo-glass-effect';
import { Text } from './Text';

/**
 * Set by `ScreenHeader`'s bar, so every button in it — its own back button
 * and whatever a screen passes as `right` — takes the header's tighter
 * shadow without each caller having to ask for it.
 */
export const InHeaderBar = createContext(false);

/**
 * Set when the button is an item in the iPhone's own navigation bar. The
 * system draws the item's background there (the glass capsule from iOS 26),
 * so the button is only its glyph — a white disc inside that would be a
 * button drawn inside a button.
 */
export const InNativeBar = createContext(false);

/** A bar item's tap target: the system's own 44pt minimum, less the bar's
 * built-in inset around its items. */
const NATIVE_ITEM = 36;

/** The round corner buttons on a tab root's title line — My Profile's QR and
 * Settings, the Challenges "+", Tasks' settings — and the photo viewer's
 * actions, all one size wherever they sit. */
export const cornerButtonSize = 46;
export const cornerIconSize = 22;

/** A round button standing in for a page header's own — over a full-screen
 * photo, where there's no bar to put it in (a story's close and like). On
 * the iPhone's glass that's the system bar item's 44pt circle with the
 * symbol at the bar's body size, so it matches the buttons in every native
 * header; elsewhere the drawn header's corner button. */
export const headerButtonSize = LIQUID_GLASS ? 44 : cornerButtonSize;
export const headerIconSize = LIQUID_GLASS ? 17 : cornerIconSize;

export interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: ThemeColor;
  /**
   * A flat fill instead of the lens — for the buttons that have to disappear
   * into the page rather than float over it.
   */
  background?: ThemeColor;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  shadow?: boolean;
  /** Can't be pressed right now — the glyph drops to `inkGhost`, the app's
   * "not available" grey, and the button stops taking taps. */
  disabled?: boolean;
  /** Drawn in place of the glyph — a story's reactions button, once a
   * reaction has been left, wears it. */
  emoji?: string;
  /**
   * The button floats over a photo or the camera rather than sitting in the
   * page. On iPhones with liquid glass it is then the system's own glass —
   * the picture bending through it, swelling under the finger — whatever
   * `background` says; `background` stays the look everywhere else.
   */
  overMedia?: boolean;
  /** The glass's tint, for a button that is switched on — the camera's
   * flash once it's lit. */
  glassTint?: ThemeColor;
  /** Pins the glass to one appearance — dark over the camera, which is dark
   * whatever the phone is set to. */
  glassScheme?: GlassColorScheme;
  /** Off, the button dissolves away on the iPhone's glass rather than
   * unmounting; elsewhere it is simply not drawn. */
  visible?: boolean;
}

/**
 * The circular button used for back / close / edit throughout the app. It is
 * liquid glass by default: these sit *over* the page rather than in it, so
 * they take the same lens as the reaction bubbles.
 */
export function IconButton({
  name,
  onPress,
  size = 52,
  iconSize,
  color = colors.ink,
  background,
  style,
  accessibilityLabel,
  shadow = true,
  disabled,
  emoji,
  overMedia,
  glassTint,
  glassScheme,
  visible = true,
}: IconButtonProps) {
  const inHeader = useContext(InHeaderBar);
  const inNativeBar = useContext(InNativeBar);
  const radius = size / 2;
  const box: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
  };

  const glyph = emoji ? (
    <Text variant="sectionHeading">{emoji}</Text>
  ) : (
    <Ionicons name={name} size={iconSize ?? size * 0.44} color={disabled ? colors.inkGhost : color} />
  );

  // The lens sizes itself to its content, so the dimensions live on the inner
  // view rather than on the surface.
  const symbol = inNativeBar && !emoji ? sfSymbolFor(name) : undefined;
  // On the system's glass the glyph is the system's too, where it has one.
  const glassSymbol = !emoji ? sfSymbolFor(name) : undefined;
  // The symbol view takes a plain colour: the bar's ink for the appearance on
  // show, unless a caller passed one of its own.
  const scheme = colorsFor(useColorScheme());
  const systemGlass = LIQUID_GLASS && !inNativeBar && (overMedia || !background);
  if (!visible && !systemGlass) return null;
  const body = inNativeBar ? (
    <View style={[styles.base, styles.nativeItem]}>
      {symbol ? (
        <SymbolView
          name={symbol}
          size={iconSize ?? size * 0.44}
          tintColor={disabled ? scheme.inkGhost : typeof color === 'string' ? color : scheme.ink}
          weight="medium"
        />
      ) : (
        glyph
      )}
    </View>
  ) : systemGlass ? (
    <LiquidGlass
      interactive={!!onPress && !disabled}
      visible={visible}
      tintColor={glassTint}
      colorScheme={glassScheme}
      style={[styles.base, box]}
    >
      {glassSymbol ? (
        <SymbolView
          name={glassSymbol}
          size={iconSize ?? size * 0.44}
          tintColor={disabled ? colors.inkGhost : color}
          weight="medium"
        />
      ) : (
        glyph
      )}
    </LiquidGlass>
  ) : background ? (
    <View
      style={[
        styles.base,
        box,
        { backgroundColor: background },
        shadow && (inHeader ? shadows.header : shadows.soft),
      ]}
    >
      {glyph}
    </View>
  ) : (
    <GlassSurface radius={radius} shadow={shadow}>
      <View style={[styles.base, box]}>{glyph}</View>
    </GlassSurface>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled || !visible}
      // Gone, it lets taps through to whatever lies under it — a story's
      // own tap-to-step sides.
      pointerEvents={visible ? 'auto' : 'none'}
      onPress={onPress}
      hitSlop={8}
      // The system's glass answers the press itself, swelling under the
      // finger, so it isn't dimmed and shrunk on top of that.
      style={({ pressed }) => [pressed && !systemGlass && styles.pressed, style]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeItem: {
    width: NATIVE_ITEM,
    height: NATIVE_ITEM,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});

export default IconButton;
