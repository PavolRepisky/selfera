import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type HostInstance } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { colors, colorsFor, layout, radii, shadows } from '@/constants/theme';
import { shareProfile } from '@/lib/shareProfile';
import { BottomSheet } from './BottomSheet';
import { SheetHeader } from './SheetHeader';
import { IconButton } from './IconButton';
import { Text } from './Text';

/** The card the code sits on: a little narrower than a phone's content
 * width, so it reads as a card held up rather than a block of the sheet. */
const CARD_WIDTH = 300;
/** The code itself — big enough for a camera across a table. */
const CODE_SIZE = 200;
/** The round buttons under the card, the size of a contact card's own. */
const ACTION_DISC = 56;
const ACTION_GLYPH = 22;
/** How long a button's "done" word stays before its label comes back. */
const DONE_MS = 1600;

export interface ShareProfileSheetProps {
  visible: boolean;
  onDismiss: () => void;
  person: { id: string; name: string; handle: string };
  /** Where they are today — "Day 12 of Get Fit for Summer" — under the
   * name; left out between eras. */
  status?: string | null;
  /** Someone else's profile, passed on from their page: the hint under the
   * card names them rather than speaking as you. */
  theirs?: boolean;
}

/**
 * Your profile to hand on: a card with a code a friend scans to add you,
 * your name, handle and where you are today, and
 * three ways to send it: the link copied, the card saved to Photos, or the
 * phone's share sheet.
 */
export function ShareProfileSheet({ visible, onDismiss, person, status, theirs = false }: ShareProfileSheetProps) {
  const card = useRef<HostInstance>(null);
  const [done, setDone] = useState<'copied' | 'saved' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const url = Linking.createURL(`friend/${person.id}`);
  // Dark on light whatever the phone's appearance: an inverted code is one
  // not every camera will read, so the card stays white in dark mode too.
  const light = colorsFor('light');

  // Opened fresh: nothing copied or saved yet, nothing gone wrong.
  useEffect(() => {
    if (visible) {
      setDone(null);
      setProblem(null);
    }
  }, [visible]);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), DONE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  const copy = async () => {
    setProblem(null);
    try {
      await Clipboard.setStringAsync(url);
      setDone('copied');
    } catch {
      setProblem('It didn’t copy. Try again.');
    }
  };

  const save = async () => {
    setProblem(null);
    // Photos is the phone's; in the browser the library is only a stand-in.
    if (Platform.OS === 'web') {
      setProblem('Saving to Photos works in the app on your phone.');
      return;
    }
    try {
      // Only to add the image — the app never reads the library from here.
      const access = await MediaLibrary.requestPermissionsAsync(true);
      if (!access.granted) {
        setProblem('Allow Selfera to add photos in Settings to save your code.');
        return;
      }
      await MediaLibrary.Asset.create(await captureRef(card, { format: 'png', result: 'tmpfile' }));
      setDone('saved');
    } catch {
      setProblem('It didn’t save. Try again.');
    }
  };

  const actions = [
    { key: 'copy', icon: 'link-outline', label: done === 'copied' ? 'Copied' : 'Copy Link', onPress: copy },
    { key: 'save', icon: 'download-outline', label: done === 'saved' ? 'Saved' : 'Save', onPress: save },
    { key: 'share', icon: 'share-outline', label: 'Share', onPress: () => shareProfile(person) },
  ] as const;

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} handle>
      <View style={styles.root}>
        <SheetHeader title="Share Profile" />

        {/* What gets saved to Photos: the card alone, white, as it is drawn
            here. */}
        <View ref={card} collapsable={false} style={[styles.card, shadows.card, { backgroundColor: light.surface }]}>
          <QRCode value={url} size={CODE_SIZE} color={light.ink} backgroundColor={light.surface} />
          <View style={styles.who}>
            <Text variant="itemTitle" color={light.ink} center numberOfLines={1}>
              {person.name}
            </Text>
            <Text variant="meta" color={light.inkMuted} center numberOfLines={1}>
              {person.handle}
            </Text>
          </View>
          {status ? (
            <View style={[styles.status, { backgroundColor: light.surfaceSunken }]}>
              <Text variant="badge" color={light.ink} numberOfLines={1}>
                {status}
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="note" color={problem ? colors.destructive : colors.inkMuted} center>
          {problem ?? (theirs ? `Scan it to add ${person.name}` : 'Friends scan it to add you')}
        </Text>

        {/* Three round buttons, each its word under it — the row a
            contact card opens with on the iPhone: an ink glyph on a grey
            disc, the word under it. */}
        <View style={styles.actions}>
          {actions.map((action) => (
            <View key={action.key} style={styles.action}>
              <IconButton
                name={action.icon}
                size={ACTION_DISC}
                iconSize={ACTION_GLYPH}
                color={colors.ink}
                background={colors.surfaceSunken}
                shadow={false}
                accessibilityLabel={action.label}
                onPress={action.onPress}
              />
              <Text variant="meta" center>
                {action.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

export default ShareProfileSheet;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: layout.block,
  },
  // The native list's card corner, so the card sits like one of the
  // system's own.
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    gap: layout.heading,
    paddingVertical: layout.section,
    borderRadius: radii.lg,
  },
  // The handle straight under the name, on the lines' own leading.
  who: {
    alignItems: 'center',
    paddingHorizontal: layout.card,
  },
  status: {
    paddingVertical: layout.line + layout.line / 2,
    paddingHorizontal: layout.inline,
    borderRadius: radii.pill,
  },
  // Spread evenly under the card, a section's gap between the discs.
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: layout.section,
  },
  action: {
    width: ACTION_DISC + layout.block,
    alignItems: 'center',
    gap: layout.stack,
  },
});
