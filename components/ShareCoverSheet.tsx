import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Switch, useWindowDimensions, View, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radii, shadows } from '@/constants/theme';
import { BottomSheet } from './BottomSheet';
import { DayCover, type DayCoverCell } from './DayCover';
import { Pill } from './Pill';
import { SheetHeader } from './SheetHeader';
import { Text } from './Text';

/** A story's own shape, height over width: the phone's full screen, so the
 * cover fills an Instagram story edge to edge with nothing added round it. */
const STORY_RATIO = 16 / 9;
/** The preview's widest, on a phone tall enough to give it room. */
const PREVIEW_WIDTH = 216;
/** Everything in the sheet that isn't the preview — its grabber and title,
 * the two switches, the buttons, its padding — plus room above it for the
 * page to still show. Whatever of the screen is left after this is the
 * preview's to take, so on a short phone the story shrinks rather than the
 * sheet running off it. */
const SHEET_CHROME = 380;
/** The smallest the preview goes, still big enough to read the day on. */
const PREVIEW_MIN_HEIGHT = 240;
/** How long a button's "done" word stays before its label comes back. */
const DONE_MS = 1600;
/** The saved image: a story's full size, so it isn't scaled up on the way
 * into Instagram. */
const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = Math.round(IMAGE_WIDTH * STORY_RATIO);

export interface ShareCoverSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** The day's photos, in its grid's order, each with its time and task. */
  cells: readonly DayCoverCell[];
  day: number;
  totalDays?: number;
  /** The era's name, over the day. */
  kicker: string;
}

/**
 * The day's cover made into a story, in a sheet risen from the bottom as
 * Share profile's is: a preview of it at a story's shape, a switch each for
 * the photos' times and their tasks in their middles, and two ways out side
 * by side — saved to the phone's photos, or handed straight to the phone's
 * share sheet.
 */
export function ShareCoverSheet({ visible, onDismiss, cells, day, totalDays, kicker }: ShareCoverSheetProps) {
  const cover = useRef<HostInstance>(null);
  const [times, setTimes] = useState(true);
  const [tasks, setTasks] = useState(true);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const previewHeight = Math.max(
    PREVIEW_MIN_HEIGHT,
    Math.min(PREVIEW_WIDTH * STORY_RATIO, screen.height - insets.top - insets.bottom - SHEET_CHROME),
  );

  // Opened fresh: nothing saved yet, nothing gone wrong.
  useEffect(() => {
    if (visible) {
      setSaved(false);
      setProblem(null);
    }
  }, [visible]);
  // A different image now, so it can be saved again.
  useEffect(() => setSaved(false), [times, tasks]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), DONE_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  /** The preview as a full-size story image, as a file on the phone. */
  const capture = () =>
    captureRef(cover, { format: 'png', width: IMAGE_WIDTH, height: IMAGE_HEIGHT, result: 'tmpfile' });

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      // Photos is the phone's; in the browser the library is only a stand-in
      // (metro.config.js), so say so rather than fail.
      if (Platform.OS === 'web') {
        setProblem('Saving to Photos works in the app on your phone.');
        return;
      }
      // Only to add the image — the app never reads the library from here.
      const access = await MediaLibrary.requestPermissionsAsync(true);
      if (!access.granted) {
        setProblem('Allow Selfera to add photos in Settings to save your day.');
        return;
      }
      await MediaLibrary.Asset.create(await capture());
      setSaved(true);
    } catch {
      setProblem('It didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // The image itself, not a link, so it lands in a story or a chat as the
  // picture it is.
  const share = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        setProblem('Sharing works in the app on your phone.');
        return;
      }
      await Sharing.shareAsync(await capture(), {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: `Day ${day}`,
      });
    } catch {
      setProblem('It didn’t share. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} handle>
      <View style={styles.root}>
        <SheetHeader title="Save your day" />

        {/* Lifted and rounded on the sheet, while what's captured inside is
            square-cornered — a story's corners are the phone's to round. */}
        <View style={[styles.preview, { width: previewHeight / STORY_RATIO, height: previewHeight }, shadows.hard]}>
          <View style={styles.previewClip}>
            <View ref={cover} collapsable={false} style={styles.story}>
              <DayCover
                cells={cells}
                day={day}
                totalDays={totalDays}
                kicker={kicker}
                ratio={STORY_RATIO}
                times={times}
                tasks={tasks}
              />
            </View>
          </View>
        </View>

        <View style={styles.toggles}>
          <View style={styles.toggle}>
            <Text variant="copy" style={styles.toggleLabel}>
              Time on each photo
            </Text>
            <Switch value={times} onValueChange={setTimes} accessibilityLabel="Time on each photo" />
          </View>
          <View style={styles.toggle}>
            <Text variant="copy" style={styles.toggleLabel}>
              Task on each photo
            </Text>
            <Switch value={tasks} onValueChange={setTasks} accessibilityLabel="Task on each photo" />
          </View>
        </View>

        {problem ? (
          <Text variant="meta" color={colors.destructive} center>
            {problem}
          </Text>
        ) : null}

        {/* Saving and sharing side by side in equal halves, as the posted
            day's own pair on Tasks sits. */}
        <View style={styles.actions}>
          <Pill
            tone="solid"
            size="lg"
            icon={saved ? 'checkmark' : 'download-outline'}
            label={saved ? 'Saved' : 'Save'}
            onPress={save}
            style={styles.action}
          />
          <Pill
            tone="outline"
            size="lg"
            icon="share-outline"
            label="Share"
            onPress={share}
            style={styles.action}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: layout.block,
  },
  // The story in miniature, lifted off the sheet like a print — rounded the
  // way a story sits on the phone's screen. Its size follows the screen.
  preview: {
    alignSelf: 'center',
    borderRadius: radii.md,
  },
  previewClip: {
    flex: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  story: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  toggles: {
    gap: layout.stack,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  toggleLabel: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: layout.stack,
  },
  action: {
    flex: 1,
    justifyContent: 'center',
  },
});

export default ShareCoverSheet;
