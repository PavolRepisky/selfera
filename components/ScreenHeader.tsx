import { Ionicons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
} from 'react-native';

import { colors, colorsFor, layout, radii, type } from '@/constants/theme';
import {
  IconButton,
  InHeaderBar,
  InNativeBar,
  cornerButtonSize,
  cornerIconSize,
} from './IconButton';
import { sfSymbolFor } from '@/constants/symbols';
import type { MenuAction } from './LongPressMenu';
import { NATIVE_HEADER } from './Screen';
import { Text } from './Text';

type StackOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack.Screen>['options']>,
  (...args: never[]) => unknown
>;

/** The system bar's title, in the app's face rather than the system's. */
const BAR_TITLE = { fontFamily: type.itemTitle.fontFamily, fontSize: type.itemTitle.fontSize };

/**
 * What every stack in the app starts from. The bar is off until a screen's
 * `ScreenHeader` turns it on, so a page without one — a photo running to the
 * top edge — keeps the whole screen. When it is on it is the system bar as
 * iOS sets it, its title in the app's Quicksand at `itemTitle`'s size — the
 * bar's own San Francisco sat apart from every word under it — in ink. No hairline
 * under it —
 * the page's white runs straight into the bar's — and the back button is the
 * chevron alone, without the previous page's name beside it.
 */
export const stackScreenOptions: StackOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.backgroundPlain },
  animation: 'slide_from_right',
  headerShadowVisible: false,
  headerTintColor: colors.ink,
  headerTitleStyle: { ...BAR_TITLE, color: colors.ink },
  headerBackButtonDisplayMode: 'minimal',
};

/** A `HeaderAction` as the system bar's own item: its SF Symbol, and its
 * menu when it has one. */
function barItem(action: HeaderAction) {
  const symbol = action.icon ? sfSymbolFor(action.icon) : undefined;
  const icon = symbol ? { type: 'sfSymbol' as const, name: symbol } : undefined;
  if (action.menu) {
    return {
      type: 'menu' as const,
      label: action.label,
      icon,
      menu: {
        items: action.menu.map((item) => {
          const itemSymbol = item.icon ? sfSymbolFor(item.icon) : undefined;
          return {
            type: 'action' as const,
            label: item.label,
            icon: itemSymbol ? { type: 'sfSymbol' as const, name: itemSymbol } : undefined,
            destructive: item.destructive,
            onPress: item.onPress,
          };
        }),
      },
    };
  }
  return {
    type: 'button' as const,
    label: action.label,
    icon,
    variant: action.prominent ? ('done' as const) : undefined,
    disabled: action.disabled,
    // The system's own badge on the bar button (iOS 26 and up; before it,
    // the button goes without).
    badge: action.badge ? { value: badgeText(action.badge) } : undefined,
    onPress: action.onPress!,
  };
}

/** A badge's count, capped so it stays a small mark on the button. */
const BADGE_CAP = 9;
const badgeText = (n: number) => (n > BADGE_CAP ? `${BADGE_CAP}+` : String(n));

/** The drawn badge: a small ink disc riding the corner button's top edge,
 * wide enough for "9+". */
const BADGE_SIZE = 18;

/** Whether this iPhone draws liquid glass (iOS 26 and up), whose bars
 * blur what scrolls under them by themselves. */
const LIQUID_GLASS = NATIVE_HEADER && isLiquidGlassAvailable();

/** How much of the bar a `middle` — the step bar — spans. A custom title has
 * no width of its own in the system bar, and this leaves room either side
 * for the back button and the step count. */
const MIDDLE_SHARE = 0.5;

/** How far the bar's title is raised to sit optically centred on the corner
 * buttons — see `titleText`. */
const TITLE_LIFT = 1.5;

/**
 * One button at the end of the bar. On the iPhone it is a real bar button —
 * the system draws its symbol and groups the buttons in one capsule, the way
 * Mail and Photos do — and one with a `menu` opens the system's pull-down
 * menu instead of doing something itself. Elsewhere it is a round button.
 */
export type HeaderAction = {
  /** Left out for a word rather than a glyph — an edit page's Done. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Read out, and shown if the symbol can't be. */
  label: string;
  /** The bar's bold, confirming button — Done — as iOS sets it. */
  prominent?: boolean;
  /** Greyed and untappable — a form's Next until its step is filled in. */
  disabled?: boolean;
  /** A count of things waiting behind the button — Activity's new ones.
   * Nothing is shown at 0. */
  badge?: number;
} & ({ onPress: () => void; menu?: never } | { menu: readonly MenuAction[]; onPress?: never });

export interface ScreenHeaderProps {
  /** The screen's title, one line at page-title size. */
  plainTitle?: string;
  /**
   * A bar with no fill of its own, for a page whose photo runs to the top
   * edge: the system's buttons float on the photo and the page starts under
   * the bar rather than below it. iPhone only — elsewhere these pages draw
   * their own corner buttons.
   */
  overPhoto?: boolean;
  /** The system's search field under the title, on the iPhone. A screen that
   * passes it draws its own field only elsewhere. */
  search?: { placeholder: string; onChangeText: (text: string) => void };
  /** A tab root passes `false`, and its title sits on the gutter. */
  showBack?: boolean;
  /** An X instead of the chevron, for a flow whose first step is left
   * rather than stepped back from. */
  backIcon?: 'chevron-back' | 'close';
  /** Replaces leaving the screen — a multi-step form steps back through
   * itself first. */
  onBack?: () => void;
  /** Drawn in the title's place, for a bar that says where you are some
   * other way than a title: the create form's step bar. */
  middle?: React.ReactNode;
  /** The bar's buttons, at its end. */
  actions?: readonly HeaderAction[];
  /** Something other than a button at the bar's end — the create flow's
   * "1 of 3" — after any `actions`. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The row a `ScreenScroll`'s fixed `header` holds: exactly the round corner
 * buttons' height, no margin under it, the back button (the same white disc
 * every corner button is) then the title, left-aligned, then the actions.
 *
 * It reads left to right, the way the page under it does: the way back first,
 * where a thumb and the edge swipe both expect it, the title straight after it
 * on the gutter, and every action grouped at the end — one place to reach for
 * them however many a screen has.
 */
export function ScreenHeader({
  plainTitle,
  showBack = true,
  overPhoto,
  search,
  backIcon = 'chevron-back',
  onBack,
  middle,
  actions,
  right,
  style,
}: ScreenHeaderProps) {
  const router = useRouter();
  const scheme = colorsFor(useColorScheme());
  const { width } = useWindowDimensions();

  if (NATIVE_HEADER) {
    // The system's own back button wherever it does what it says; an X, or
    // a back that steps through a form instead of leaving it, is drawn.
    const ownBack = showBack && (backIcon === 'close' || !!onBack);
    return (
      <Stack.Screen
        options={{
          headerShown: true,
          // No fill of its own, the way iOS draws its bars now: the page runs
          // up under the bar, and the system softens whatever scrolls beneath
          // it — the scroll-edge blur from iOS 26, a material before that.
          // The scrollers inset themselves for it.
          headerTransparent: true,
          headerBlurEffect: overPhoto || LIQUID_GLASS ? undefined : 'systemChromeMaterial',
          // The bar's items — back, its buttons — in the system blue, its
          // title in ink, as plain colours for the appearance on show: the
          // system bar doesn't follow an adaptive one.
          headerTintColor: scheme.systemAccent,
          headerTitleStyle: { ...BAR_TITLE, color: scheme.ink },
          headerSearchBarOptions: search
            ? {
                placeholder: search.placeholder,
                hideWhenScrolling: false,
                tintColor: scheme.systemAccent,
                onChangeText: (e) => search.onChangeText(e.nativeEvent.text),
              }
            : undefined,
          title: plainTitle ?? '',
          // Always the small title in the bar, never a large one on the
          // page that folds into it as you scroll.
          headerLargeTitle: false,
          headerBackVisible: showBack && !ownBack,
          unstable_headerLeftItems: ownBack
            ? () => [
                {
                  type: 'button',
                  label: backIcon === 'close' ? 'Close' : 'Back',
                  icon: { type: 'sfSymbol', name: backIcon === 'close' ? 'xmark' : 'chevron.backward' },
                  onPress: onBack ?? (() => router.back()),
                },
              ]
            : undefined,
          headerTitle: middle
            ? () => <View style={{ width: width * MIDDLE_SHARE }}>{middle}</View>
            : undefined,
          unstable_headerRightItems:
            actions?.length || right
              ? () => [
                  ...(actions ?? []).map(barItem),
                  // Words rather than a button — no capsule round them.
                  ...(right
                    ? [
                        {
                          type: 'custom' as const,
                          element: (
                            <InNativeBar.Provider value>
                              <View style={styles.actions}>{right}</View>
                            </InNativeBar.Provider>
                          ),
                          hidesSharedBackground: true,
                        },
                      ]
                    : []),
                ]
              : undefined,
        }}
      />
    );
  }

  return (
    <InHeaderBar.Provider value>
      <View style={[styles.row, style]}>
        {showBack ? (
          <IconButton
            name={backIcon}
            size={cornerButtonSize}
            iconSize={cornerIconSize}
            background={colors.surface}
            onPress={onBack ?? (() => router.back())}
            accessibilityLabel={backIcon === 'close' ? 'Close' : 'Go back'}
          />
        ) : null}
        <View style={styles.title}>
          {middle ?? (plainTitle ? (
            <Text variant="pageTitle" numberOfLines={1} style={styles.titleText}>
              {plainTitle}
            </Text>
          ) : null)}
        </View>
        {actions?.length || right ? (
          <View style={styles.actions}>
            {(actions ?? []).map((action) =>
              action.onPress ? (
                <View key={action.label}>
                  <IconButton
                    name={action.icon ?? 'checkmark'}
                    size={cornerButtonSize}
                    iconSize={cornerIconSize}
                    background={colors.surface}
                    onPress={action.onPress}
                    accessibilityLabel={
                      action.badge ? `${action.label}, ${action.badge} new` : action.label
                    }
                  />
                  {action.badge ? (
                    <View style={styles.badge} pointerEvents="none">
                      <Text variant="badge" color={colors.inkInverse}>
                        {badgeText(action.badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null,
            )}
            {right}
          </View>
        ) : null}
      </View>
    </InHeaderBar.Provider>
  );
}

const styles = StyleSheet.create({
  // Exactly a corner button's height, so a screen with no buttons in its bar
  // still puts its title on the same line as one that has them.
  row: {
    minHeight: cornerButtonSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  title: {
    flex: 1,
  },
  // Centring the title's line box on the buttons still leaves the word low:
  // Quicksand hangs its capitals ~0.6pt under the middle of a 23/28 line, and
  // the lowercase and descenders under them pull the word's weight further
  // down. Measured off the screens, lifting it by this much puts the word's
  // middle on the corner buttons' centre. Android's extra font padding is
  // dropped so it lands in the same place there.
  titleText: {
    transform: [{ translateY: -TITLE_LIFT }],
    includeFontPadding: false,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.stack,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: layout.line,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
});

export default ScreenHeader;
