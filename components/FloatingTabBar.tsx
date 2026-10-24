import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type View as RNView,
  type HostInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadows, tabBar, tabBarBottom, type ThemeColor } from '@/constants/theme';
import { Text } from './Text';

export type TabIcon = 'discover' | 'community' | 'tasks' | 'profile';

function Glyph({
  icon,
  active,
  color = colors.ink,
}: {
  icon: TabIcon;
  active: boolean;
  color?: ThemeColor;
}) {
  const size = 27;

  switch (icon) {
    // Eras you have not joined yet: the tab is a bearing to take, not a
    // list to read.
    case 'discover':
      return (
        <Ionicons
          name={active ? 'compass' : 'compass-outline'}
          size={size + 2}
          color={color}
        />
      );
    case 'community':
      return (
        <Ionicons
          name={active ? 'people' : 'people-outline'}
          size={size + 2}
          color={color}
        />
      );
    case 'tasks':
      return (
        <Ionicons
          name={active ? 'camera' : 'camera-outline'}
          size={size + 2}
          color={color}
        />
      );
    case 'profile':
      return (
        <Ionicons
          name={active ? 'person' : 'person-outline'}
          size={size}
          color={color}
        />
      );
  }
}

export interface TabBarButtonProps extends PressableProps {
  icon: TabIcon;
  label: string;
  /** Injected by `TabTrigger asChild`. */
  isFocused?: boolean;
}

/**
 * One tab: its glyph with the label set under it in the regular-weight `tab`
 * cut, every tab alike — Tasks included, which used to stand apart as a
 * filled disc. The active tab sits inside a light pill and fills its glyph
 * in; labels stay ink-black in both states, which is what the reference does.
 */
export const TabBarButton = forwardRef<HostInstance, TabBarButtonProps>(
  function TabBarButton({ icon, label, isFocused, style, ...rest }, ref) {
    return (
      <Pressable
        ref={ref}
        accessibilityRole="tab"
        accessibilityState={{ selected: !!isFocused }}
        accessibilityLabel={label}
        {...rest}
        style={[styles.tab, isFocused && styles.tabActive]}
      >
        <Glyph icon={icon} active={!!isFocused} />
        <Text variant="tab" numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  },
);

/**
 * The pill that floats above the content near the bottom edge. A solid white
 * surface rather than a liquid-glass lens — content scrolls beneath it
 * unseen, and the floating shadow is what lifts it off the white page.
 */
export interface FloatingTabBarProps {
  children?: React.ReactNode;
}

export const FloatingTabBar = forwardRef<HostInstance, FloatingTabBarProps>(
  function FloatingTabBar({ children }, ref) {
    const insets = useSafeAreaInsets();

    return (
      <View ref={ref} style={[styles.bar, { bottom: tabBarBottom(insets.bottom) }]}>
        <View style={styles.row}>{children}</View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: tabBar.horizontalInset,
    right: tabBar.horizontalInset,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  row: {
    height: tabBar.height,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  // The palette's own fill grey, the one the cards and calendar cells use. The
  // older warm `divider` grey suited the glass, but on solid white it read
  // muddy and off-palette.
  tabActive: {
    backgroundColor: colors.surfaceSunken,
  },
});
