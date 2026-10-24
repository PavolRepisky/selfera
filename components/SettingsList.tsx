import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Form,
  HStack,
  Host,
  Image as SystemImage,
  Label,
  RNHostView,
  Section,
  Spacer,
  Text as SystemText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  foregroundStyle,
  frame,
  lineLimit,
  listRowBackground,
  multilineTextAlignment,
  onTapGesture,
  padding,
  scrollContentBackground,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { sfSymbolFor } from '@/constants/symbols';
import { colors, colorsFor, layout, radii, spacing } from '@/constants/theme';
import { quicksand } from '@/lib/swiftUI';
import { NATIVE_HEADER, Screen, ScreenScroll } from './Screen';
import { Text } from './Text';

/** The drawn row's chevron. */
const ROW_CHEVRON = 18;

/** A row's value stops here and ellipsises, so a long bio can't push the
 * label onto a second line. */
const ROW_VALUE_MAX = 150;

/** The accessory's square when a row doesn't say — a row-height thumbnail. */
const DEFAULT_ACCESSORY = 30;

/** The row chevron in the system list, at the size iOS draws its own. */
const SYSTEM_CHEVRON = 13;
/** The tick on the chosen row, a touch heavier than the chevron, as iOS
 * draws its own. */
const SYSTEM_CHECK = 15;

/** The drawn row's glyph, on its grey square — the square is what lines
 * the labels up down the page, not the glyphs' own uneven widths. */
const ROW_ICON_TILE = 32;
const ROW_ICON = 17;

/** The profile card's photo — the Apple Account row's size. */
const PROFILE_AVATAR = 60;

/**
 * The card that opens Settings, the way your Apple Account opens the
 * Settings app: your photo, big, with your name and a line under it, and a
 * chevron at the end — tapping it opens Edit profile.
 */
export function SettingsProfileCard({
  avatar,
  name,
  handle,
  onPress,
}: {
  /** The photo, drawn at `PROFILE_AVATAR`. */
  avatar: (size: number) => React.ReactNode;
  name: string;
  /** The line under the name — the username and where the card leads. */
  handle: string;
  onPress: () => void;
}) {
  if (NATIVE_HEADER) {
    return (
      // A tap on the row itself rather than a SwiftUI button, which would
      // repaint the username in the list's ink instead of its grey.
      <HStack
        spacing={layout.block}
        modifiers={[
          padding({ vertical: layout.line }),
          frame({ maxWidth: Number.MAX_SAFE_INTEGER, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
          onTapGesture(onPress),
        ]}
      >
        <HStack modifiers={[frame({ width: PROFILE_AVATAR, height: PROFILE_AVATAR })]}>
          <RNHostView>
            <View style={styles.profileAvatar}>{avatar(PROFILE_AVATAR)}</View>
          </RNHostView>
        </HStack>
        <VStack alignment="leading" spacing={layout.line / 2}>
          <SystemText modifiers={[quicksand('headline', 'bold'), lineLimit(1)]}>
            {name}
          </SystemText>
          <SystemText
            modifiers={[quicksand('body'), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}
          >
            {handle}
          </SystemText>
        </VStack>
        <Spacer />
        <SystemImage
          systemName="chevron.forward"
          size={SYSTEM_CHEVRON}
          modifiers={[foregroundStyle({ type: 'hierarchical', style: 'tertiary' })]}
        />
      </HStack>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edit profile"
      onPress={onPress}
      style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
    >
      <View style={styles.profileAvatar}>{avatar(PROFILE_AVATAR)}</View>
      <View style={styles.rowLabel}>
        <Text variant="itemTitle" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="copy" color={colors.inkMuted} numberOfLines={1}>
          {handle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={ROW_CHEVRON} color={colors.inkGhost} />
    </Pressable>
  );
}

/**
 * The page the groups sit on. On the iPhone it is the system's own grouped
 * list — the Settings app's inset cards on its grey; elsewhere the drawn
 * cards on the alt tone.
 */
export function SettingsList({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  if (NATIVE_HEADER) {
    return (
      <Screen tone="alt" padded={false} header={header} style={styles.systemPage}>
        <Host style={styles.systemPage}>
          {/* No tint on the list: its rows set their own colours, and its
              switches keep the system's green, as in the Settings app. Its
              type is the app's Quicksand, which every row inherits. Its own
              grey is hidden for the app's `alt` grey behind it, so these
              pages sit on the same grey as Theme, drawn on that tone. */}
          <Form modifiers={[quicksand(), scrollContentBackground('hidden')]}>
            {children}
          </Form>
        </Host>
      </Screen>
    );
  }
  return (
    <ScreenScroll tone="alt" tabBar header={header}>
      {children}
    </ScreenScroll>
  );
}

export function SettingsGroup({
  title,
  titleInk,
  footer,
  footerCentered,
  children,
}: {
  title?: string;
  /** Sets the title in ink rather than the list's grey — where it names a
   * field to fill in, as a form's labels do, not a group to read. */
  titleInk?: boolean;
  /** The small print under the group — what a field is for, or why it
   * didn't save. */
  footer?: string;
  /** Centres the small print — the version line under the last group. */
  footerCentered?: boolean;
  children: React.ReactNode;
}) {
  const scheme = colorsFor(useColorScheme());
  if (NATIVE_HEADER) {
    return (
      <Section
        title={titleInk ? undefined : title}
        header={
          titleInk && title ? (
            <SystemText modifiers={[quicksand('subheadline'), foregroundStyle(scheme.ink)]}>
              {title}
            </SystemText>
          ) : undefined
        }
        // White rows, cards on the `alt` grey the list shows through.
        modifiers={[listRowBackground(scheme.surface)]}
        footer={
          footer ? (
            <SystemText
              modifiers={[
                // Small print at the footnote size the Settings app sets its
                // own in — the list's Quicksand otherwise sets it at body
                // size, as big as the rows it explains.
                quicksand('footnote'),
                ...(footerCentered
                  ? [multilineTextAlignment('center'), frame({ maxWidth: Number.MAX_SAFE_INTEGER })]
                  : []),
              ]}
            >
              {footer}
            </SystemText>
          ) : undefined
        }
      >
        {children}
      </Section>
    );
  }
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="metaBold" color={titleInk ? colors.ink : colors.inkMuted} style={styles.groupTitle}>
          {title}
        </Text>
      ) : null}
      <View style={styles.groupCard}>{children}</View>
      {footer ? (
        <Text
          variant="meta"
          color={colors.inkMuted}
          center={footerCentered}
          style={styles.groupFooter}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  accessory,
  accessorySize = DEFAULT_ACCESSORY,
  onPress,
  destructive,
  icon,
  checked,
  navigates,
  external,
  last,
}: {
  label: string;
  value?: string;
  /**
   * Makes the row one of a few choices: a tick on the one in force, nothing
   * on the others, and no chevron — choosing happens right here rather than
   * somewhere it opens.
   */
  checked?: boolean;
  /** Opens a page of its own — the chevron says so, as it does in the
   * Settings app. A row that acts on the spot (a confirmation, a photo
   * viewer) has none. */
  navigates?: boolean;
  /** Opens a website outside the app — a small ↗ instead of a chevron. */
  external?: boolean;
  /** Drawn where the value text would sit — the photo row's thumbnail. */
  accessory?: React.ReactNode;
  /** The accessory's square, in points. The system row sizes it to exactly
   * this, so it sits at the row's own height rather than stretching it. */
  accessorySize?: number;
  onPress?: () => void;
  destructive?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  last?: boolean;
}) {
  const ink = destructive ? colors.destructive : colors.ink;
  const scheme = colorsFor(useColorScheme());

  // A system list row: the symbol and label, the value in the secondary grey,
  // and the chevron on the rows that open something — not on the ones that
  // act, the way the Settings app draws them.
  if (NATIVE_HEADER) {
    // Left to the list, an ordinary row draws the way the Settings app's do:
    // its glyph in the accent, its words in the primary ink, light or dark.
    // A row that can't be undone takes the app's red for both.
    const tone = destructive ? [foregroundStyle(scheme.destructive)] : [];
    return (
      <Button
        role={destructive ? 'destructive' : undefined}
        onPress={onPress}
        modifiers={[
          // A plain button takes no accent — the default one paints its
          // label in the app's accent, iOS blue.
          buttonStyle('plain'),
          ...tone,
        ]}
      >
        {/* A plain button only takes taps on what it draws — the words and
            the glyphs — so the row is stretched to the list's full width and
            given a solid shape, and a tap anywhere along it counts, the gap
            between label and value included. */}
        <HStack
          spacing={layout.inline}
          modifiers={[
            frame({ maxWidth: Number.MAX_SAFE_INTEGER, alignment: 'leading' }),
            contentShape(shapes.rectangle()),
          ]}
        >
          {/* The system's own Label: the glyph in the list's accent, the
              words beside it, lined up down the group the way the Settings
              app draws its rows. */}
          <Label title={label} systemImage={sfSymbolFor(icon)} modifiers={tone} />
          <Spacer />
          {value ? (
            <SystemText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>
              {value}
            </SystemText>
          ) : null}
          {/* An app view in the system row: given a fixed square, both in
              SwiftUI and inside it, since a hosted view left to size itself
              stretched to fill the row — pushing the label out and the row
              tall. */}
          {accessory ? (
            <HStack modifiers={[frame({ width: accessorySize, height: accessorySize })]}>
              <RNHostView>
                <View style={{ width: accessorySize, height: accessorySize }}>{accessory}</View>
              </RNHostView>
            </HStack>
          ) : null}
          {checked !== undefined ? (
            checked ? (
              <SystemImage
                systemName="checkmark"
                size={SYSTEM_CHECK}
                modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
              />
            ) : null
          ) : navigates || external ? (
            <SystemImage
              systemName={external ? 'arrow.up.right' : 'chevron.forward'}
              size={SYSTEM_CHEVRON}
              modifiers={[foregroundStyle({ type: 'hierarchical', style: 'tertiary' })]}
            />
          ) : null}
        </HStack>
      </Button>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowDivider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={ROW_ICON} color={ink} />
      </View>

      <Text variant="copy" color={ink} style={styles.rowLabel}>
        {label}
      </Text>

      {value ? (
        <Text
          variant="copy"
          color={colors.inkMuted}
          numberOfLines={1}
          style={styles.rowValue}
        >
          {value}
        </Text>
      ) : null}

      {accessory}

      {checked !== undefined ? (
        checked ? <Ionicons name="checkmark" size={ROW_CHEVRON} color={colors.ink} /> : null
      ) : navigates || external ? (
        // Faint: the whole row is the button; the chevron only says there's
        // more behind it.
        <Ionicons
          name={external ? 'arrow-up-outline' : 'chevron-forward'}
          size={ROW_CHEVRON}
          color={colors.inkGhost}
          style={external && styles.externalGlyph}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The system list brings its own insets and scrolls itself, edge to edge.
  systemPage: {
    flex: 1,
    paddingTop: 0,
  },
  group: {
    marginBottom: layout.section,
  },
  // Nudged in off the card's corner, so the title sits over the card rather
  // than hanging off its rounded edge.
  groupTitle: {
    marginBottom: layout.stack,
    marginLeft: spacing.xs,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
    paddingVertical: layout.inline,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    // The palette's fill grey rather than the warmer `divider`, so the
    // screen keeps to My Profile's colours.
    borderBottomColor: colors.surfaceSunken,
  },
  rowIcon: {
    width: ROW_ICON_TILE,
    height: ROW_ICON_TILE,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: PROFILE_AVATAR,
    height: PROFILE_AVATAR,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.block,
    padding: layout.card,
  },
  rowLabel: {
    flex: 1,
  },
  rowValue: {
    maxWidth: ROW_VALUE_MAX,
  },
  groupFooter: {
    marginTop: layout.stack,
    marginHorizontal: spacing.xs,
  },
  // The plain ↑ turned to point out of the app, the way ↗ does.
  externalGlyph: {
    transform: [{ rotate: '45deg' }],
  },
  pressed: {
    opacity: 0.7,
  },
});

export default SettingsList;
