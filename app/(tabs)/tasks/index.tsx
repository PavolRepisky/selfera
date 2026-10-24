import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AlertDialog } from '@/components/AlertDialog';
import { Avatar } from '@/components/Avatar';
import { CameraSheet } from '@/components/CameraSheet';
import { CheckCircle } from '@/components/CheckCircle';
import { EmptyState } from '@/components/EmptyState';
import { DayCover, POST_RATIO, shotClock } from '@/components/DayCover';
import { PhotoCollage, type CollageCell } from '@/components/PhotoCollage';
import { PhotoViewer } from '@/components/PhotoViewer';
import { Placeholder } from '@/components/Placeholder';
import { Pill } from '@/components/Pill';
import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ShareCoverSheet } from '@/components/ShareCoverSheet';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { Text } from '@/components/Text';
import { absoluteFill, colors, colorsFor, gradients, layout, radii, type } from '@/constants/theme';
import {
  DEFAULT_TASK_REMINDER,
  useApp,
  useDayProgress,
} from '@/hooks/useAppState';
import { clockLeftToday, clockTime, timeStamp } from '@/lib/format';
import { isPosted, POST_COUNTDOWN_MS } from '@/lib/round';

/**
 * Today's post being filled in, at the shape it goes up in: the post edge to
 * edge under the bar, a cell for every task — a photo once it's in, a
 * grey cell naming the task and how to shoot it until then — with the
 * day's clock floating at its top. Under it, while some are still to shoot, the day's tasks as a list: each one's
 * name and how to shoot it, its reminder, and a tick once its photo is in.
 *
 * Tapping a slot opens the camera on that slot's task, and the shot goes
 * straight into it; there is nothing else to press. Tasks have no order and
 * nothing is "next". A piece that's in opens full size, with a retake and a
 * remove under it. Once the last one is in, the post wears its cover, the
 * way it goes up on Community, and the clock becomes the post's own
 * countdown: until then a shot can still be retaken or removed — removing
 * one stops the countdown — and a caption written under it. Once it's up,
 * the post and its caption are fixed.
 *
 * On the iPhone the camera is the phone's own Camera screen, risen as a
 * sheet, and a shot's choices are its action sheet. When each task nudges
 * you is set in Settings, off My Profile, so the page is only the doing.
 *
 * Joined but before Day 1 — where joining almost always leaves you, since it
 * shuts once a round starts — the post waits with every slot named and
 * nothing to press, and the clock says when Day 1 is. Not in an era at all,
 * the page points to Discover instead.
 */

/**
 * The iPhone's own Camera screen in place of the app's camera card. It's the
 * real camera — tap to focus, drag the sun to set the exposure, its lenses
 * and flash — which the card can't be: expo-camera has no exposure control,
 * and a camera library that does needs a build Expo Go can't run. Off, the
 * card comes back, as it does on Android and the web either way.
 */
const SYSTEM_CAMERA = true;

/** How long typing has to pause before a caption is saved — about a breath,
 * so a sentence goes up as one write rather than one per letter. */
const CAPTION_SAVE_MS = 800;
/** The longest caption the server keeps. */
const CAPTION_MAX = 500;
/** The countdown's ring — a size that heads the status row without
 * crowding its two lines. */
const RING = 56;
/** The ring's stroke — the profile's challenge bar's. */
const RING_STROKE = 6;
/** The tick heading the status row once the post is up — the size of the
 * row's title line pair rather than the ring's, since there's nothing left
 * to count down and a big tick only shouted. */
const STATUS_MARK = 28;
/** Your face at the head of the caption, a comment composer's. */
const COMPOSER_AVATAR = 32;
/** A caption field tall enough for three lines before it grows. */
const CAPTION_MIN_HEIGHT = 72;
/** A task row's square at its head — its photo once it's in, the camera
 * until then — about two lines of the row's type tall. */
const TASK_THUMB = 48;
/** The camera in an open task's square. */
const TASK_CAMERA = 22;
/** The tick at a task row's end, a step under the thumbnail. */
const TASK_MARK = 24;
/** The alarm glyph beside a reminder's time, at the time's cap height. */
const TASK_ALARM = 13;

/** "1:05" — the minutes and seconds left of a post's countdown. */
const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function TasksScreen() {
  const {
    currentDay,
    totalDays,
    challenge,
    tasks,
    undoTask,
    completeTaskWithPhoto,
    inChallenge,
    daysUntilStart,
    loadFailed,
    reload,
    syncError,
    clearSyncError,
    postsAt,
    captions,
    setCaption,
    postNow,
    profile,
    reminders,
  } = useApp();
  const router = useRouter();
  const waiting = daysUntilStart > 0;
  // In the post's own order, piece by piece.
  const rows = useDayProgress(currentDay);
  const done = rows.filter((row) => row.done).length;
  const allDone = rows.length > 0 && done === rows.length;

  const [now, setNow] = useState(() => new Date());
  // A finished day counts down to going up; once it has, it's fixed.
  const goesUpAt = postsAt[currentDay];
  const countingDown = allDone && goesUpAt !== undefined && !isPosted(goesUpAt, now.getTime());
  const isUp = allDone && !countingDown;
  // The clock over the post ticks by the second; once the post is up, or
  // before Day 1, nothing on the page needs more than the minute.
  const ticking = !isUp && !waiting;
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ticking ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [ticking]);

  // The caption as it's being typed, saved once typing pauses — and at
  // once if the field is left — so the last words in before the countdown
  // runs out are the ones that go up.
  const savedCaption = captions[currentDay] ?? '';
  const [draft, setDraft] = useState(savedCaption);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const typing = useRef(false);
  // A new day, or the saved caption changing under the field — put back
  // after a failed save — shows in it; never while it's being typed in,
  // where it would trim the space just typed.
  useEffect(() => {
    if (!typing.current) setDraft(savedCaption);
  }, [savedCaption]);
  useEffect(() => setDraft(captions[currentDay] ?? ''), [currentDay]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveCaption = () => {
    if (draftRef.current.trim() !== savedCaption) setCaption(currentDay, draftRef.current);
  };
  useEffect(() => {
    if (!countingDown || draft.trim() === savedCaption) return;
    const id = setTimeout(() => setCaption(currentDay, draft), CAPTION_SAVE_MS);
    return () => clearTimeout(id);
  }, [draft, countingDown, savedCaption, currentDay, setCaption]);

  /** The piece the camera card is filling and its task — or, on a retake,
   * the task already in it; null while the card is down. */
  const [shooting, setShooting] = useState<{
    slot: number;
    taskId: string;
    retake?: boolean;
  } | null>(null);
  useEffect(() => setShooting(null), [currentDay]);

  /** The shot opened full size from its piece. */
  const [viewing, setViewing] = useState<{ taskId: string; slot: number } | null>(null);
  /** The finished day open to share as a story. */
  const [sharing, setSharing] = useState(false);
  /** The shot waiting on its remove to be confirmed. */
  const [removing, setRemoving] = useState<{ taskId: string; slot: number } | null>(null);
  /** What the viewer's button asked for, run once the viewer has finished
   * fading — presenting the camera or a dialog on top of a modal that is
   * still dismissing loses it on iOS. */
  const afterViewer = useRef<(() => void) | null>(null);
  // A new day closes whatever was open over the last one: its viewer, its
  // remove dialog and its story sheet all point at the day that's gone.
  useEffect(() => {
    setViewing(null);
    setRemoving(null);
    setSharing(false);
  }, [currentDay]);

  if (!inChallenge) {
    return (
      <ScreenScroll
        tabBar
        onRefresh={reload}
        header={<ScreenHeader plainTitle="Tasks" showBack={false} />}
      >
        {loadFailed ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load your era"
            hint="Check your connection and try again."
            action={{ label: 'Try again', onPress: () => reload() }}
          />
        ) : (
          <EmptyState
            icon="sparkles-outline"
            title="Your next era starts here"
            hint="Small things, every day, add up to someone new. Pick an era and watch it happen, one photo at a time."
            action={{ label: 'Join an era', onPress: () => router.navigate('/discover') }}
          />
        )}
      </ScreenScroll>
    );
  }

  /**
   * The phone's own Camera screen: its shutter, flash, lenses, zoom and
   * exposure, then Retake or Use Photo. The whole shot is kept, and its
   * piece crops it to fill like every photo in the post. It goes straight
   * into the piece it was taken for.
   */
  const shootWithSystemCamera = async (shot: { taskId: string; slot: number }) => {
    const access = await ImagePicker.requestCameraPermissionsAsync();
    if (!access.granted) {
      Alert.alert(
        'Camera access',
        'Turn on camera access in Settings to take your photos.',
        access.canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        // Rises as a sheet over Tasks, the page still showing at its top
        // edge, the way the app's own camera card did, rather than taking
        // the whole screen.
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
      });
      const uri = result.canceled ? undefined : result.assets[0]?.uri;
      if (uri) completeTaskWithPhoto(shot.taskId, { uri }, undefined, shot.slot);
    } catch {
      // The camera couldn't open (the simulator has none); the slot stays open.
    }
  };

  /** An open slot tapped: the camera on its task — the system camera on the
   * iPhone, the app's camera card elsewhere. A retake is the same, on the
   * task already in the piece. */
  const shoot = (shot: { taskId: string; slot: number }, retake = false) => {
    if (NATIVE_HEADER && SYSTEM_CAMERA) void shootWithSystemCamera(shot);
    else setShooting({ ...shot, retake });
  };

  // Piece by piece in the post's own order: a shot in its piece with its
  // task and time, an open one naming its task. Before Day 1 nothing answers
  // a tap yet.
  const cells: CollageCell[] = rows.map((row, slot) => ({
    key: row.task.id,
    label: row.task.label,
    note: row.done ? undefined : row.task.note,
    photo: row.done ? row.photo : null,
    seed: row.done ? row.photoSeed : null,
    time: row.done && row.time ? shotClock(row.time) : undefined,
    // Mid-upload a piece waits for its save to land, so an undo can never
    // reach the server ahead of the photo it would remove.
    onPress:
      waiting || row.pending
        ? undefined
        : row.done
          ? () => setViewing({ taskId: row.task.id, slot })
          : () => shoot({ taskId: row.task.id, slot }),
  }));
  const shootingTask = shooting ? tasks.find((task) => task.id === shooting.taskId) : undefined;
  const viewedRow = viewing ? rows[viewing.slot] : undefined;
  const removingTask = removing ? tasks.find((task) => task.id === removing.taskId) : undefined;

  /** Closes the viewer, then runs `next` once it has gone. */
  const leaveViewer = (next: () => void) => {
    setViewing(null);
    if (Platform.OS === 'ios') afterViewer.current = next;
    else next();
  };
  const remove = () => {
    if (removing) undoTask(removing.taskId, currentDay);
    setRemoving(null);
  };

  const lastDay = currentDay >= totalDays;

  // The clock over the post: what's left of today while there's shooting to
  // do, the post's own minute and a half once every photo is in, and before
  // Day 1 how long until it. Gone once the post is up.
  const badge = waiting
    ? daysUntilStart === 1
      ? 'Day 1 is tomorrow'
      : `Day 1 in ${daysUntilStart} days`
    : countingDown
      ? `${clock(goesUpAt - now.getTime())} to post`
      : isUp
        ? null
        : `${clockLeftToday(now)} left`;

  return (
    <>
      <ScreenScroll
        tabBar
        onRefresh={reload}
        header={
          <ScreenHeader
            plainTitle="Tasks"
            showBack={false}
          />
        }
      >
        {/* The post itself, edge to edge and square-cornered the way a post
            fills the screen on Community, at the 3:4 it goes up in. Once the
            last photo is in, the day's cover lies over it — the same face the
            post wears on Community. The clock floats at its top. */}
        <PhotoCollage cells={cells} ratio={POST_RATIO} radius={0} style={styles.post}>
          {allDone ? (
            <DayCover
              cells={cells}
              day={currentDay}
              totalDays={totalDays}
              kicker={challenge.name}
              ratio={1 / POST_RATIO}
            />
          ) : null}
          {badge ? (
            <View style={styles.badge} pointerEvents="none">
              <Pill
                tone="floating"
                overMedia
                icon="time"
                label={badge}
                tabular={!waiting}
                bold
                style={styles.badgePill}
              />
            </View>
          ) : null}
        </PhotoCollage>

        {/* The day's tasks, while some are still to shoot: each one's name
            and how to shoot it, when it nudges you while it's open, and its
            photo and a tick once it's in. A row does what its piece does.
            Before Day 1
            they're the tasks every day will hold, not today's. Once every
            photo is in, composing the post takes this place. */}
        {allDone ? null : (
          <View style={styles.tasks}>
            <Text variant="sectionHeading">{waiting ? 'Daily tasks' : 'Today'}</Text>
            {rows.map((row, slot) => {
              const remindAt = reminders.tasks[row.task.id] === undefined
                ? DEFAULT_TASK_REMINDER
                : reminders.tasks[row.task.id];
              return (
                <TaskRow
                  key={row.task.id}
                  label={row.task.label}
                  note={row.task.note}
                  done={row.done}
                  photo={row.photo}
                  seed={row.photoSeed}
                  time={row.done && row.time ? shotClock(row.time) : undefined}
                  remindAt={remindAt === null ? undefined : clockTime(remindAt)}
                  onPress={cells[slot].onPress}
                />
              );
            })}
          </View>
        )}

        {/* Every photo in: composing the post — the caption with your face
            at its head, then one window with the time left in a ring draining
            in the accent and a slide to post it now, last, where the thumb
            is. Once it's up: a small tick saying so, then saving the day as a
            story and seeing it on Community, side by side. */}
        {allDone ? (
          countingDown ? (
            <View style={styles.finish}>
              <View style={styles.composer}>
                <Avatar source={profile.avatar ?? profile.avatarSeed} size={COMPOSER_AVATAR} />
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => {
                    typing.current = true;
                  }}
                  onBlur={() => {
                    typing.current = false;
                    saveCaption();
                  }}
                  placeholder="Write a caption…"
                  placeholderTextColor={colors.inkMuted}
                  maxLength={CAPTION_MAX}
                  multiline
                  style={styles.captionInput}
                  accessibilityLabel="Caption"
                  accessibilityHint="Can be changed until the post goes up"
                />
              </View>

              {/* The post's last minute and a half in one window: the time
                  left, and the slide that skips the rest of it. */}
              <View style={styles.window}>
                <View style={styles.windowHead} accessible accessibilityLiveRegion="polite">
                  <CountdownRing
                    left={(goesUpAt - now.getTime()) / POST_COUNTDOWN_MS}
                    label={clock(goesUpAt - now.getTime())}
                  />
                  <View style={styles.statusText}>
                    <Text variant="itemTitle">Almost posted</Text>
                    <Text variant="meta" color={colors.inkMuted}>
                      Day {currentDay} goes up when the ring runs out. Tap a photo to retake or remove it.
                    </Text>
                  </View>
                </View>
                <SlideToConfirm
                  label="Slide to post"
                  onConfirm={() => {
                    postNow(draftRef.current);
                    setNow(new Date());
                  }}
                  style={styles.windowSlide}
                />
              </View>
            </View>
          ) : (
            <View style={styles.finish}>
              <View style={styles.status}>
                <CheckCircle size={STATUS_MARK} />
                <View style={styles.statusText}>
                  <Text variant="itemTitle">{lastDay ? 'Era done' : 'Posted'}</Text>
                  <Text variant="meta" color={colors.inkMuted}>
                    {lastDay
                      ? `All ${totalDays} days, done. Day ${currentDay} is up on Community.`
                      : goesUpAt !== undefined
                        ? `Day ${currentDay} went up on Community at ${shotClock(timeStamp(new Date(goesUpAt)))}.`
                        : `Day ${currentDay} is up on Community.`}
                  </Text>
                </View>
              </View>

              <View style={styles.postedActions}>
                <Pill
                  tone="solid"
                  size="lg"
                  icon="download-outline"
                  label="Save"
                  onPress={() => setSharing(true)}
                  style={styles.postedAction}
                />
                <Pill
                  tone="outline"
                  size="lg"
                  icon="people-outline"
                  label="View post"
                  onPress={() => router.navigate('/community')}
                  style={styles.postedAction}
                />
              </View>
            </View>
          )
        ) : null}
      </ScreenScroll>

      {/* The app's camera card, off the iPhone: on the tapped slot's task
          alone, since each piece of the post is its own task's. */}
      <CameraSheet
        visible={shooting !== null}
        tasks={
          shootingTask
            ? [{ id: shootingTask.id, label: shootingTask.label, note: shootingTask.note }]
            : []
        }
        taskId={shooting?.taskId ?? null}
        swipeTasks={false}
        onChangeTask={(taskId) => setShooting((open) => (open ? { ...open, taskId } : open))}
        onCapture={(taskId, photo) => {
          completeTaskWithPhoto(taskId, photo, undefined, shooting?.slot);
          setShooting(null);
        }}
        onClose={() => setShooting(null)}
      />

      {/* A photo or an undo that didn't reach the server: the task is already
          back how it was, so this only has to say so. Comes seconds after
          the camera card has gone, so it never stacks on it. */}
      <AlertDialog
        visible={syncError !== null}
        title="Not saved"
        message={syncError ?? ''}
        onDismiss={clearSyncError}
        actions={[{ label: 'OK', primary: true, onPress: clearSyncError }]}
      />

      {/* A shot, opened full size from its piece, with what can be done to
          it along the bottom: shoot it again, or take it out of the post.
          Once the post is up, it's only looked at. */}
      <PhotoViewer
        photos={viewedRow ? [viewedRow.photo ?? viewedRow.photoSeed ?? viewedRow.task.id] : []}
        index={viewing && viewedRow ? 0 : null}
        onDismiss={() => setViewing(null)}
        onDismissed={() => {
          const next = afterViewer.current;
          afterViewer.current = null;
          next?.();
        }}
        actions={isUp ? [] : [
          {
            key: 'retake',
            label: 'Retake',
            icon: 'sync-outline',
            onPress: () => {
              const shot = viewing;
              if (shot) leaveViewer(() => shoot(shot, true));
            },
          },
          {
            key: 'remove',
            label: 'Remove',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => {
              const shot = viewing;
              if (shot) leaveViewer(() => setRemoving(shot));
            },
          },
        ]}
      />

      <ShareCoverSheet
        visible={sharing && isUp}
        onDismiss={() => setSharing(false)}
        cells={cells}
        day={currentDay}
        totalDays={totalDays}
        kicker={challenge.name}
      />

      {/* Removing asks first, saying what it takes with it. */}
      <AlertDialog
        visible={removing !== null}
        title="Remove this photo?"
        message={`It comes out of your Day ${currentDay} post and ${removingTask?.label ?? 'the task'} is open again.`}
        onDismiss={() => setRemoving(null)}
        actions={[
          { label: 'Cancel', onPress: () => setRemoving(null) },
          { label: 'Remove', destructive: true, onPress: remove },
        ]}
      />
    </>
  );
}

/**
 * One of the day's tasks as a row: a square at its head — the photo once
 * it's in, the camera until then — the task's name over how to shoot it,
 * kept once it's done, and at its end the reminder's time while it's open and
 * the tick that fills once it's done. Flat on the page, like a to-do list.
 */
function TaskRow({
  label,
  note,
  done,
  photo,
  seed,
  time,
  remindAt,
  onPress,
}: {
  label: string;
  note?: string;
  done: boolean;
  photo?: CollageCell['photo'];
  seed?: string | null;
  time?: string;
  remindAt?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? `${label}, done${time ? ` at ${time}` : ''}` : `Take the ${label} photo`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.taskRow, pressed && styles.pressed]}
    >
      <View style={styles.taskThumb}>
        {done && photo ? (
          <Image source={photo} style={absoluteFill} contentFit="cover" />
        ) : done ? (
          <Placeholder seed={seed ?? label} radius={0} style={absoluteFill} />
        ) : (
          <Ionicons name="camera-outline" size={TASK_CAMERA} color={colors.ink} />
        )}
      </View>
      <View style={styles.taskText}>
        <Text variant="copy" numberOfLines={1}>
          {label}
        </Text>
        {note ? (
          <Text variant="meta" color={colors.inkMuted} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
      {!done && remindAt ? (
        <View style={styles.taskReminder}>
          <Ionicons name="alarm-outline" size={TASK_ALARM} color={colors.inkMuted} />
          <Text variant="meta" color={colors.inkMuted}>
            {remindAt}
          </Text>
        </View>
      ) : null}
      <CheckCircle size={TASK_MARK} empty={!done} />
    </Pressable>
  );
}

/**
 * The time left before the post goes up, as a ring draining anticlockwise
 * from twelve o'clock in the accent — the colour of progress — over the
 * page's white, with the minutes and seconds in its middle.
 */
function CountdownRing({ left, label }: { left: number; label: string }) {
  const svg = colorsFor(useColorScheme());
  const r = (RING - RING_STROKE) / 2;
  const around = 2 * Math.PI * r;
  const share = Math.max(0, Math.min(1, left));
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="countdownAccent" x1="0" y1="0" x2="1" y2="1">
            {gradients.accent.map((stop, i) => (
              <Stop key={stop} offset={i / (gradients.accent.length - 1)} stopColor={stop} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={svg.surface} strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke="url(#countdownAccent)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${around * share} ${around}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text variant="metaBold" style={styles.ringClock}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Out past the page's gutter on both sides, so the post is the screen's
  // full width.
  post: {
    marginHorizontal: -layout.gutter,
  },
  // The clock floats at the post's top, centred, a block in from its edge —
  // BeReal's clock over the camera.
  badge: {
    position: 'absolute',
    top: layout.block,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // A pill sits at its row's start by default, which would override the
  // wrapper's centring.
  badgePill: {
    alignSelf: 'center',
  },
  // What stands under the post once every photo is in.
  finish: {
    marginTop: layout.section,
    gap: layout.block,
  },
  // Where the post stands, as one row on the fill grey: the ring or the
  // tick, then a title over a line of detail.
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.block,
    padding: layout.block,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
  },
  statusText: {
    flex: 1,
    gap: layout.line,
  },
  // The countdown's window: the ring and its words over the slide, on the
  // same grey, the slide's track set into it in the page's white.
  window: {
    gap: layout.block,
    padding: layout.block,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
  },
  windowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.block,
  },
  windowSlide: {
    backgroundColor: colors.surface,
  },
  // Figures that hold their width, so the clock doesn't shuffle sideways
  // as it ticks.
  ringClock: {
    fontVariant: ['tabular-nums'],
  },
  // The caption's field with your face at its head, the way a comment's
  // composer opens on its author — on the same grey, rounded to a card
  // since it runs to a few lines.
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.inline,
    padding: layout.block,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
  },
  // `body`, the size and cut a post's caption reads in once it's up; its
  // first line level with the middle of the face beside it.
  captionInput: {
    flex: 1,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    letterSpacing: type.body.letterSpacing,
    color: colors.ink,
    padding: 0,
    paddingTop: (COMPOSER_AVATAR - type.body.lineHeight) / 2,
    minHeight: CAPTION_MIN_HEIGHT,
    textAlignVertical: 'top',
  },
  // The two ways on from a posted day, side by side in equal halves.
  postedActions: {
    flexDirection: 'row',
    gap: layout.stack,
  },
  postedAction: {
    flex: 1,
    justifyContent: 'center',
  },
  ring: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The heading's own gap down to the first row comes from the list's gap,
  // a step wider than a heading's, which suits rows this tall.
  tasks: {
    marginTop: layout.section,
    gap: layout.block,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  // Rounded as a list row's photo is, on the fill grey while it's open.
  taskThumb: {
    width: TASK_THUMB,
    height: TASK_THUMB,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskText: {
    flex: 1,
    gap: layout.line / 2,
  },
  taskReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.line,
  },
  pressed: {
    opacity: 0.85,
  },
});
