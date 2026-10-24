import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet, useColorScheme } from 'react-native';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { FloatingTabBar, TabBarButton } from '@/components/FloatingTabBar';
import { NATIVE_HEADER } from '@/components/Screen';
import { colors, colorsFor, fonts } from '@/constants/theme';

/** The system bar's glyphs: Apple's own symbols for the same four ideas,
 * outlined at rest and filled once the tab is on show. */
const TAB_SYMBOLS = {
  discover: ['safari', 'safari.fill'],
  community: ['person.2', 'person.2.fill'],
  tasks: ['camera', 'camera.fill'],
  profile: ['person', 'person.fill'],
} as const;

type TabName = keyof typeof TAB_SYMBOLS;

const TAB_LABELS = {
  discover: 'Discover',
  community: 'Community',
  tasks: 'Tasks',
  profile: 'Profile',
} as const;

/**
 * Headless tabs so the bar can be a floating pill drawn over the content
 * rather than a docked bar that shortens it.
 *
 * Bar order is Discover · Community · Tasks · Profile: the two social pages
 * lead, then the day itself, then your own page. The month grid of proof
 * photos used to be a Calendar tab of its own; it lives in Profile now, as
 * the Days section's Month view. Discover and Community were one screen
 * behind a switch until they earned a tab each. Tasks is the app's real home, so it is the initial
 * route; every tab, Tasks included, is drawn the same — a glyph with its
 * label under it.
 */
export default function TabsLayout() {
  return NATIVE_HEADER ? <SystemTabs /> : <DrawnTabs />;
}

/**
 * On the iPhone the bar is the system's own tab bar — the floating glass one
 * from iOS 26 — in the app's ink, with SF Symbols.
 * The system insets each tab's scroller for it, so pages don't pad for it.
 */
function SystemTabs() {
  const scheme = colorsFor(useColorScheme());
  return (
    <NativeTabs
      backBehavior="history"
      tintColor={scheme.ink}
      iconColor={{ default: scheme.inkMuted, selected: scheme.ink }}
      // The labels in the app's Quicksand, a cut up from the drawn bar's
      // Medium: at the system's small label size Medium thins out.
      labelStyle={{
        default: { color: scheme.inkMuted, fontFamily: fonts.bodySemi },
        selected: { color: scheme.ink, fontFamily: fonts.bodySemi },
      }}
    >
      {(Object.keys(TAB_SYMBOLS) as TabName[]).map((name) => (
        <NativeTabs.Trigger key={name} name={name}>
          <NativeTabs.Trigger.Icon
            sf={{ default: TAB_SYMBOLS[name][0], selected: TAB_SYMBOLS[name][1] }}
          />
          <NativeTabs.Trigger.Label>{TAB_LABELS[name]}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function DrawnTabs() {
  return (
    // `flex: 1` on both the root and the slot keeps each screen exactly one
    // viewport tall, so scroll views scroll internally and absolutely
    // positioned overlays land on the screen rather than at the end of the
    // content.
    <Tabs options={{ backBehavior: 'history' }} style={styles.root}>
      <TabSlot style={styles.slot} />

      <TabList asChild>
        <FloatingTabBar>
          <TabTrigger name="discover" href="/discover" asChild>
            <TabBarButton icon="discover" label="Discover" />
          </TabTrigger>

          <TabTrigger name="community" href="/community" asChild>
            <TabBarButton icon="community" label="Community" />
          </TabTrigger>

          <TabTrigger name="tasks" href="/tasks" asChild>
            <TabBarButton icon="tasks" label="Tasks" />
          </TabTrigger>

          <TabTrigger name="profile" href="/profile" asChild>
            <TabBarButton icon="profile" label="Profile" />
          </TabTrigger>
        </FloatingTabBar>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
});
