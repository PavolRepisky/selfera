import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
  type HostInstance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radii, shadows } from '@/constants/theme';
import { BottomSheet } from './BottomSheet';
import { CoverMark, DayCover, POST_RATIO, type DayCoverCell } from './DayCover';
import { Pill } from './Pill';
import { Placeholder } from './Placeholder';
import { SegmentedTabs } from './SegmentedTabs';
import { SheetHeader } from './SheetHeader';
import { ShotStamp } from './ShotStamp';
import { Text } from './Text';

/** A story's own shape, height over width: the phone's full screen, so the
 * cover fills an Instagram story edge to edge with nothing added round it —
 * and a TikTok photo post's, which fills the same screen. */
const STORY_RATIO = 16 / 9;
/** An Instagram carousel's tallest, height over width: the post's own 3:4,
 * which the feed shows uncropped. */
const CAROUSEL_RATIO = 1 / POST_RATIO;
/** The preview's widest, on a phone tall enough to give it room. */
const PREVIEW_WIDTH = 216;
/** Everything in the sheet that isn't the preview — its grabber and title,
 * the format switch, the dots, the two switches, the buttons and the line
 * under them, its padding — plus room above it for the page to still show.
 * Whatever of the screen is left after this is the preview's to take, so on
 * a short phone the story shrinks rather than the sheet running off it. */
const SHEET_CHROME = 470;
/** The smallest the preview goes, still big enough to read the day on. */
const PREVIEW_MIN_HEIGHT = 220;
/** How long a button's "done" word stays before its label comes back. */
const DONE_MS = 1600;
/** Every slide is laid out at a phone's width, the one a post's photo
 * slides are set at on Community, so the stamp and the wordmark keep the
 * size they have there; the preview scales it down whole, the saved image
 * is taken at full size. */
const SLIDE_WIDTH = 390;
/** The saved images: a story's full width, so nothing is scaled up on the
 * way into Instagram or TikTok. */
const IMAGE_WIDTH = 1080;
/** A page dot under the preview, as small as the post's own. */
const DOT = 6;
/** Time for a slide put on the stage to draw its photos before it's taken —
 * they're already fetched, so this only waits out a frame or two. */
const STAGE_SETTLE_MS = 120;

type Format = 'story' | 'tiktok' | 'instagram';

const FORMATS = [
  { key: 'story', label: 'Story' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
] as const satisfies readonly { key: Format; label: string }[];

/** One image of what's saved: the day's cover, or one of its photos. */
type Slide = { key: string; kind: 'cover' } | { key: string; kind: 'photo'; cell: DayCoverCell };

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
 * The finished day made into something to post, in a sheet risen from the
 * bottom as Share profile's is. Three shapes, by where it's going: a
 * Story — the cover alone at a story's shape, saved or handed to the share
 * sheet — or the whole post as a slideshow, cover first then each photo,
 * for TikTok at the full screen or Instagram at 3:4. A switch each for the
 * photos' times and tasks.
 *
 * A slideshow can't be handed over whole — Expo Go's share sheet takes one
 * file, and posting into TikTok or Instagram directly takes their own SDKs
 * in a build of the app — so it's saved to Photos and the app is opened
 * on it. The slides go in last first, so the phone's recents list them in
 * order: picked left to right, they post in order.
 */
export function ShareCoverSheet({ visible, onDismiss, cells, day, totalDays, kicker }: ShareCoverSheetProps) {
  const stage = useRef<HostInstance>(null);
  const [format, setFormat] = useState<Format>('story');
  const [times, setTimes] = useState(true);
  const [tasks, setTasks] = useState(true);
  const [staged, setStaged] = useState<Slide | null>(null);
  const [page, setPage] = useState(0);
  /** The slideshow as it went into Photos, cover first — kept so opening the
   * app after saving doesn't save it all again. */
  const [savedIds, setSavedIds] = useState<string[] | null>(null);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const slideshow = format !== 'story';
  const ratio = format === 'instagram' ? CAROUSEL_RATIO : STORY_RATIO;
  const app = format === 'instagram' ? 'Instagram' : 'TikTok';
  // The same height whichever shape is on show, so switching doesn't make
  // the sheet jump; the carousel's shorter frame grows wider instead.
  const previewHeight = Math.max(
    PREVIEW_MIN_HEIGHT,
    Math.min(PREVIEW_WIDTH * STORY_RATIO, screen.height - insets.top - insets.bottom - SHEET_CHROME),
  );
  const previewWidth = Math.round(previewHeight / ratio);

  const shots = cells.filter((cell) => cell.photo || cell.seed);
  // As the post itself runs on Community: the cover, then each photo — and a
  // single photo, which has no grid that isn't itself, goes up alone.
  const slides: Slide[] = !slideshow
    ? [{ key: 'cover', kind: 'cover' }]
    : [
        ...(shots.length > 1 ? [{ key: 'cover', kind: 'cover' } as const] : []),
        ...shots.map((cell) => ({ key: cell.key, kind: 'photo' as const, cell })),
      ];

  // Opened fresh: nothing saved yet, nothing gone wrong.
  useEffect(() => {
    if (visible) {
      setDone(false);
      setProblem(null);
      setSavedIds(null);
    }
  }, [visible]);
  // Different images now, so they can be saved again.
  useEffect(() => {
    setDone(false);
    setSavedIds(null);
    setProblem(null);
  }, [times, tasks, format]);
  useEffect(() => setPage(0), [format]);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), DONE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  /** One slide at full size, as a file on the phone: put on the hidden
   * stage, given a moment to draw, and taken. */
  const capture = async (slide: Slide) => {
    setStaged(slide);
    await new Promise((resolve) => setTimeout(resolve, STAGE_SETTLE_MS));
    // Taken at its own size, at the screen's density, and only then scaled
    // to the image's width: handed a size, view-shot on the iPhone reads it
    // in points and draws the layers at their own size in its corner, the
    // rest of the frame left black.
    const shot = await captureRef(stage, {
      format: 'png',
      // Drawn as the screen would draw it, not from its layers: drawn from
      // its layers the cover's own scaling is lost, and it lands at its
      // layout size in the middle of a frame of its background.
      result: 'tmpfile',
    });
    const image = await ImageManipulator.manipulate(shot)
      .resize({ width: IMAGE_WIDTH, height: Math.round(IMAGE_WIDTH * ratio) })
      .renderAsync();
    return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 })).uri;
  };

  /** Fetched before anything goes on the stage, so no slide is taken with a
   * photo still on its way. */
  const prefetch = () => {
    const uris = shots.flatMap((cell) =>
      cell.photo && typeof cell.photo === 'object' && 'uri' in cell.photo && cell.photo.uri ? [cell.photo.uri] : [],
    );
    return uris.length ? Image.prefetch(uris, 'memory-disk') : Promise.resolve(true);
  };

  /** Photos is the phone's; in the browser the library is only a stand-in
   * (metro.config.js), so say so rather than fail. Only ever to add — the
   * app never reads the library from here. */
  const mayAdd = async () => {
    if (Platform.OS === 'web') {
      setProblem('Saving to Photos works in the app on your phone.');
      return false;
    }
    const access = await MediaLibrary.requestPermissionsAsync(true);
    if (!access.granted) {
      setProblem('Allow Selfera to add photos in Settings to save your day.');
      return false;
    }
    return true;
  };

  /** Every slide into Photos; the ids, cover first, or null if it didn't. */
  const saveSlides = async (): Promise<string[] | null> => {
    if (savedIds) return savedIds;
    if (!(await mayAdd())) return null;
    await prefetch();
    const files: string[] = [];
    for (const [i, slide] of slides.entries()) {
      setProgress(`${i + 1}/${slides.length}`);
      files.push(await capture(slide));
    }
    // Last first, so the newest in the phone's recents is the cover and the
    // rest follow it in the post's order.
    const ids: string[] = [];
    for (const file of [...files].reverse()) ids.unshift((await MediaLibrary.Asset.create(file)).id);
    setSavedIds(ids);
    return ids;
  };

  /** Runs one of the buttons, one at a time, saying if it went wrong. */
  const run = async (action: () => Promise<void>, failed: string) => {
    if (progress) return;
    setProgress('');
    setProblem(null);
    try {
      await action();
    } catch {
      setProblem(failed);
    } finally {
      setProgress(null);
      setStaged(null);
    }
  };

  const save = () =>
    run(async () => {
      if (slideshow) {
        if (await saveSlides()) setDone(true);
        return;
      }
      if (!(await mayAdd())) return;
      await prefetch();
      await MediaLibrary.Asset.create(await capture(slides[0]));
      setDone(true);
    }, 'It didn’t save. Try again.');

  // The image itself, not a link, so it lands in a story or a chat as the
  // picture it is.
  const share = () =>
    run(async () => {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        setProblem('Sharing works in the app on your phone.');
        return;
      }
      await prefetch();
      await Sharing.shareAsync(await capture(slides[0]), {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: `Day ${day}`,
      });
    }, 'It didn’t share. Try again.');

  // Saved first if it isn't yet, then the app opened where a post begins.
  // Instagram on the iPhone can open its composer on the cover itself; the
  // rest are a tap away in its recents.
  const open = () =>
    run(async () => {
      const ids = await saveSlides();
      if (!ids) return;
      const cover = ids[0]?.replace(/^ph:\/\//, '') ?? '';
      const links =
        format === 'tiktok'
          ? ['tiktok://', 'snssdk1233://']
          : Platform.OS === 'ios'
            ? [`instagram://library?LocalIdentifier=${encodeURIComponent(cover)}`, 'instagram://app']
            : ['instagram://camera', 'instagram://app'];
      for (const link of links) {
        try {
          await Linking.openURL(link);
          return;
        } catch {
          // Not this one — the next.
        }
      }
      setProblem(`Saved to Photos — ${app} isn’t on this phone to open.`);
    }, 'It didn’t save. Try again.');

  const onPage = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / previewWidth));

  const slideProps = { cells: shots, day, totalDays, kicker, ratio, times, tasks };
  const busy = progress !== null;

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} handle>
      <View style={styles.root}>
        <SheetHeader title="Save your day" />

        <SegmentedTabs options={FORMATS} value={format} onChange={setFormat} size="sm" />

        {/* Lifted and rounded on the sheet, while what's saved inside is
            square-cornered — the corners are the phone's to round. A
            slideshow pages through here as it will once it's posted. */}
        <View style={[styles.preview, { width: previewWidth, height: previewHeight }, shadows.hard]}>
          <View style={styles.previewClip}>
            <ScrollView
              key={format}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={slides.length > 1}
              onMomentumScrollEnd={onPage}
            >
              {slides.map((slide) => (
                <View key={slide.key} style={{ width: previewWidth, height: previewHeight }}>
                  <View style={[styles.scaled, { transform: [{ scale: previewWidth / SLIDE_WIDTH }] }]}>
                    <SlideImage slide={slide} {...slideProps} />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {slideshow ? (
          <View style={styles.dots}>
            {slides.map((slide, i) => (
              <View key={slide.key} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        ) : null}

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

        {/* Saving and sending on side by side in equal halves, as the
            posted day's own pair on Tasks sits. Saving a slideshow counts
            its slides off as it goes, since it takes a moment. */}
        <View style={styles.actions}>
          <Pill
            tone="solid"
            size="lg"
            icon={done ? 'checkmark' : 'download-outline'}
            label={
              done ? 'Saved' : busy && progress ? `Saving ${progress}` : slideshow ? `Save ${slides.length}` : 'Save'
            }
            onPress={save}
            style={styles.action}
          />
          <Pill
            tone="outline"
            size="lg"
            icon={slideshow ? 'open-outline' : 'share-outline'}
            label={slideshow ? `Open ${app}` : 'Share'}
            onPress={slideshow ? open : share}
            style={styles.action}
          />
        </View>

        {slideshow ? (
          <Text variant="meta" color={colors.inkMuted} center>
            {`Saved cover first in your recents — pick them left to right in ${app} and they post in order.`}
          </Text>
        ) : null}

        {/* The stage the saved images are taken from: a slide at its full
            layout size, held off the screen's edge so it never shows. */}
        <View style={[styles.stageHold, { left: -2 * SLIDE_WIDTH }]} pointerEvents="none">
          {staged ? (
            <View
              ref={stage}
              collapsable={false}
              style={{ width: SLIDE_WIDTH, height: Math.round(SLIDE_WIDTH * ratio) }}
            >
              <SlideImage slide={staged} {...slideProps} />
            </View>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

interface SlideImageProps {
  slide: Slide;
  cells: readonly DayCoverCell[];
  day: number;
  totalDays?: number;
  kicker: string;
  ratio: number;
  times: boolean;
  tasks: boolean;
}

/** One slide at its layout width: the cover, or a photo with its time over
 * its task across the middle and the wordmark at its foot, as a post's photo
 * slides wear them on Community. */
function SlideImage({ slide, cells, day, totalDays, kicker, ratio, times, tasks }: SlideImageProps) {
  const size = { width: SLIDE_WIDTH, height: Math.round(SLIDE_WIDTH * ratio) };
  if (slide.kind === 'cover') {
    return (
      <View style={[size, styles.slide]}>
        <DayCover cells={cells} day={day} totalDays={totalDays} kicker={kicker} ratio={ratio} times={times} tasks={tasks} mark />
      </View>
    );
  }
  const { cell } = slide;
  return (
    <View style={[size, styles.slide]}>
      {cell.photo ? (
        <Image source={cell.photo} style={size} contentFit="cover" />
      ) : (
        <Placeholder seed={cell.seed ?? cell.key} radius={0} style={size} />
      )}
      <ShotStamp time={times ? cell.time : null} label={tasks ? cell.label : null} />
      <CoverMark width={SLIDE_WIDTH} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: layout.block,
  },
  // The slideshow in miniature, lifted off the sheet like a print — rounded
  // the way it sits on the phone's screen. Its size follows the screen.
  preview: {
    alignSelf: 'center',
    borderRadius: radii.md,
  },
  previewClip: {
    flex: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  // A slide scaled down from its layout width into the preview, from its
  // corner so it lands in the page rather than round its own middle.
  scaled: {
    transformOrigin: 'top left',
  },
  slide: {
    backgroundColor: colors.surfaceSunken,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: layout.grid,
    marginTop: -layout.stack,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
    backgroundColor: colors.inkGhost,
  },
  dotActive: {
    backgroundColor: colors.ink,
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
  // Out past the screen's left edge, unclipped, so the stage keeps its full
  // size and draws whole while nothing of it shows.
  stageHold: {
    position: 'absolute',
    top: 0,
  },
});

export default ShareCoverSheet;
