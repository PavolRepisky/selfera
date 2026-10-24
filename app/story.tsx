import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayCover, POST_RATIO } from '@/components/DayCover';
import { LOCK_BLUR_RADIUS } from '@/components/FriendCard';
import { LiquidGlassGroup } from '@/components/GlassSurface';
import { IconButton, headerButtonSize, headerIconSize } from '@/components/IconButton';
import { Pill } from '@/components/Pill';
import { Placeholder } from '@/components/Placeholder';
import { PostHeader } from '@/components/PostHeader';
import { ShotStamp } from '@/components/ShotStamp';
import { Text } from '@/components/Text';
import { absoluteFill, colors, layout, radii, shadows, spacing } from '@/constants/theme';
import { LOVE } from '@/data/content';
import { useApp, useDayProgress, useEraLength } from '@/hooks/useAppState';
import { useSocial } from '@/hooks/useSocial';
import { postKey } from '@/lib/backend/social';
import { isPosted } from '@/lib/round';

/** How long a story holds before it moves on. */
const STORY_MS = 5000;
/** How long a press has to last to count as a hold rather than a tap —
 * about where Instagram stops treating it as a skip. */
const HOLD_MS = 200;
/** The queue's name for your own story; everyone else goes by their id. */
const ME = 'me';
/** The heart in the like button, a step over the close button's glyph
 * size: at the same number the heart read as the smaller of the two, so it
 * is drawn up to sit level with the cross beside it. */
const HEART_ICON = Math.round(headerIconSize * 1.15);
/** Where a like's burst of hearts sets off from, above the foot. */
const BURST_START = 44;
/** How many hearts rise on a like, how long each takes, and how far apart
 * they set off — a burst, not a single sticker. */
const BURST_COUNT = 8;
const BURST_MS = 1300;
const BURST_STAGGER = 70;
/** How far a heart can drift sideways on its way up. */
const BURST_SPREAD = 140;
/** Each rising heart — the size the emoji it replaced drew at. */
const BURST_HEART = 44;
/** A story's progress bars: a hairline track, cut apart by a sliver —
 * Instagram's own, which read as one strip at anything less. */
const BAR_HEIGHT = 3;
const BAR_GAP = 4;


/**
 * Full-bleed story viewer over a day's proof photos. One story per task with a
 * photo on it, in checklist order, counted out by the bars along the top the
 * way Instagram does it: a day with two photos is two stories and two bars,
 * and photographing a third adds one.
 *
 * Each story plays itself out — its bar fills over `STORY_MS` and hands over
 * to the next when it lands. Tapping the right half skips ahead, the left half
 * goes back, and holding either half pauses it until you let go.
 *
 * Opened from Community's "Still going today" row, it carries that row as
 * `queue`, so running past the end of one person's day plays the next
 * person's, and stepping back off the first story plays the one before —
 * the row watched through the way it reads. Without a queue, or past its
 * last person, running off the end closes.
 *
 * Yours and a friend's are the same viewer — opened with `day` for yours, or
 * `friend` from Community's "Still going today" row — so they look and play
 * alike: the face and name up top, the photos in checklist order.
 *
 * Once every task on the day is done and its countdown has run out, the day
 * is a post as well as a story, and the story ends on one more frame: the
 * day's cover, the way an Instagram story carries the post it came
 * from. Tapping it closes the story and lands on the post in the Community
 * feed — stories only last the day, the post stays there.
 */
export default function StoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, challenge, currentDay, feedLocked, membershipId, postsAt } = useApp();
  const social = useSocial();
  const params = useLocalSearchParams<{ day?: string; friend?: string; queue?: string }>();

  // Whose story is playing. Held here rather than read off the params, so
  // moving along the queue swaps the story in place instead of stacking a
  // new viewer per person.
  const [owner, setOwner] = useState<string>(params.friend ?? ME);
  const queue = useMemo(() => (params.queue ? params.queue.split(',') : []), [params.queue]);
  const place = queue.indexOf(owner);

  /** Whose story this is — someone else's when it isn't yours. Whoever the
   * row on Community showed is already loaded; anyone else is fetched. */
  const person = owner === ME ? undefined : social.person(owner);
  const { loadPage } = social;
  useEffect(() => {
    if (owner !== ME && !person) loadPage(owner);
  }, [owner, person, loadPage]);

  // Your ring is tapped from whatever day the scrubber is parked on, so your
  // story follows that rather than always showing today; a friend's is the
  // day they're on now.
  const viewing = person ? person.day : Number(params.day) || currentDay;
  const rows = useDayProgress(viewing);
  const eraLength = useEraLength();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  /** The hearts rising after a like — each with its own drift and timing. */
  const [bursts, setBursts] = useState<
    { id: string; drift: number; value: Animated.Value }[]
  >([]);

  /**
   * One story per task with a photo on it, in checklist order — read off your
   * progress or off their day. Not gated on the task being ticked: a photo is
   * taken *for* a task, often before it is marked off, and it should show up
   * the moment it is attached rather than when the circle is filled in.
   */
  const stories = useMemo(
    () =>
      person
        ? person.tasks
            .filter((task) => task.photo || task.photoSeed)
            .map((task) => ({
              key: task.completionId ?? task.label,
              label: task.label,
              photo: task.photo ?? null,
              seed: task.photoSeed ?? task.label,
              time: task.time ?? null,
            }))
        : rows
            .filter((row) => row.photo || row.photoSeed)
            .map((row) => ({
              key: row.task.id,
              label: row.task.label,
              photo: row.photo ?? null,
              seed: row.photoSeed ?? row.task.id,
              time: row.time ?? null,
            })),
    [person, rows],
  );

  // Community's lock reaches in here: until you've shot a task of your own
  // (while there's a today to shoot at all — see `feedLocked`),
  // someone else's story still plays — you can see who's going and how far —
  // but every photo is blurred under the same wash and pill as a locked post,
  // it doesn't count as watched, and it doesn't end on their post.
  const locked = Boolean(person) && feedLocked;

  /** Every task done and its countdown run out — the day has become a post,
   * so the story can point at it. */
  const finished = person
    ? person.tasks.length > 0 && person.tasks.every((task) => task.done) && isPosted(person.postsAt)
    : rows.length > 0 && rows.every((row) => row.done) && isPosted(postsAt[viewing]);

  // A day with nothing on it gets one empty frame rather than a blank screen,
  // so the viewer still opens and closes the way it always does. A finished
  // one ends on its post.
  const frames = stories.length
    ? [
        ...stories.map((story) => ({ ...story, summary: false })),
        ...(finished && !locked
          ? [{ key: 'post', label: '', photo: null, seed: '', time: null, summary: true }]
          : []),
      ]
    : [{ key: 'empty', label: '', photo: null, seed: 'story-empty', time: null, summary: false }];
  const current = frames[Math.min(index, frames.length - 1)];
  // The task pill and reactions button: not over a locked story, nor over
  // the post frame at the end, which carries its own way through.
  const footShown = !locked && !current.summary;

  // The day's whole checklist, for the ring and the task badge — every task,
  // not only the ones with a photo on them.
  const taskTotal = person ? person.tasks.length : rows.length;
  const taskDone = person
    ? person.tasks.filter((task) => task.done).length
    : rows.filter((row) => row.done).length;

  // The same post the feed shows for this day, so a reaction left on the
  // story is the one on the post.
  const postMembership = person ? person.membershipId : membershipId ?? undefined;
  const { ensureStats } = social;
  useEffect(() => {
    if (postMembership) ensureStats([{ membershipId: postMembership, day: viewing }]);
  }, [postMembership, viewing, ensureStats]);
  const myReaction = postMembership
    ? social.stats[postKey(postMembership, viewing)]?.mine ?? null
    : null;
  /**
   * The heart: a tap likes the day — the same like the post in the feed
   * shows — and a burst of hearts floats up the screen; a tap once it's
   * liked takes the like back, quietly.
   */
  const toggleLike = () => {
    if (!postMembership) return;
    if (myReaction) {
      social.react(postMembership, viewing, myReaction);
      return;
    }
    social.love(postMembership, viewing, LOVE);
    const batch = Date.now().toString();
    const particles = Array.from({ length: BURST_COUNT }, (_, i) => ({
      id: `${batch}-${i}`,
      drift: (Math.random() - 0.5) * BURST_SPREAD,
      value: new Animated.Value(0),
    }));
    setBursts((now) => [...now, ...particles]);
    Animated.stagger(
      BURST_STAGGER,
      particles.map((particle) =>
        Animated.timing(particle.value, {
          toValue: 1,
          duration: BURST_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start(() => setBursts((now) => now.filter((b) => !b.id.startsWith(`${batch}-`))));
  };

  // Each of someone else's photos counts as seen the moment it's up — their
  // view count, and the ring that opened it. The empty frame and the post at
  // the end aren't photos in the story, and your own aren't counted.
  const isPhoto = stories.length > 0 && !current.summary;
  const { markSeen } = social;
  useEffect(() => {
    if (person && isPhoto && !locked) markSeen(current.key);
  }, [person, isPhoto, locked, current.key, markSeen]);

  // Stories only last the day, so the post they link lands in the Community
  // feed, where it stays — back down the stack to the tabs rather than a new
  // screen on top, with the feed opening on the post. Your own story of an
  // earlier day has no place in today's feed, so it opens that day's post.
  const openPost = () => {
    if (!person && viewing !== currentDay) {
      router.replace({ pathname: '/day/[day]', params: { day: String(viewing) } });
      return;
    }
    router.dismissTo({
      pathname: '/(tabs)/community',
      params: { post: person ? person.id : `day-${viewing}` },
    });
  };

  /** Plays someone else's story from its start; false when there's no one. */
  const playOwner = (next: string | undefined) => {
    if (next === undefined) return false;
    setOwner(next);
    setIndex(0);
    return true;
  };

  const advance = (delta: number) => {
    const next = index + delta;
    if (next < 0) {
      if (place > 0) playOwner(queue[place - 1]);
      return;
    }
    if (next >= frames.length) {
      if (!(place >= 0 && playOwner(queue[place + 1]))) router.back();
      return;
    }
    setIndex(next);
  };

  // Drives the bar on the current story, and moves to the next one when it
  // fills. Time already shown is kept in `elapsed` rather than read back off
  // the animated value — with the native driver that value only reaches JS
  // after the fact, so a hold would resume from a stale point. A new story
  // (the next frame, or the next person's) starts it from zero; letting go of
  // a hold picks it up where it stopped, for only the time that's left. The
  // reset sits first so it runs after the old run's cleanup has counted up.
  //
  // Each story gets a value of its own. Shared, the next story's bar mounted
  // still holding where the last one stopped and was only emptied by the
  // effect a frame later — the bar jumped ahead, then snapped back to start.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fill = useMemo(() => new Animated.Value(0), [index, owner]);
  const elapsed = useRef(0);
  useEffect(() => {
    elapsed.current = 0;
  }, [index, owner]);
  useEffect(() => {
    if (paused) return;
    fill.setValue(Math.min(elapsed.current / STORY_MS, 1));
    const startedAt = Date.now();
    const run = Animated.timing(fill, {
      toValue: 1,
      duration: Math.max(STORY_MS - elapsed.current, 0),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    // `finished` is false when the cleanup below stops it — a tap moving on
    // early, a hold, or the screen going away — and only a bar that actually
    // ran out should advance.
    run.start(({ finished: ran }) => {
      if (ran) advance(1);
    });
    return () => {
      run.stop();
      elapsed.current += Date.now() - startedAt;
    };
    // `advance` is rebuilt every render; the run only has to restart when the
    // story it is timing changes or a hold lets go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, owner, frames.length, paused, fill]);

  // The face and the name lead to the profile, the way they do on a post:
  // a friend's opens in place of the story, yours drops back to your tab.
  const openProfile = () => {
    if (person) router.replace({ pathname: '/friend/[id]', params: { id: person.id } });
    else router.dismissTo('/(tabs)/profile');
  };
  // A friend's era, which needn't be yours.
  const openChallenge = () =>
    router.replace({ pathname: '/feed/[id]', params: { id: person?.challengeId ?? challenge.id } });

  return (
    <View style={styles.root}>
      {current.summary ? (
        // The day's cover, as the post opens in Community — only the tasks
        // that got a photo, cut edge to edge, under the day and its era.
        <View style={styles.summary} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Day ${viewing} post. Opens the post`}
            onPress={openPost}
            style={({ pressed }) => [styles.summaryGrid, pressed && styles.pressed]}
          >
            <DayCover
              cells={stories.map((story) => ({ ...story, time: story.time ?? undefined }))}
              day={viewing}
              totalDays={eraLength(person?.challengeId ?? challenge.id)}
              kicker={person?.challengeName ?? challenge.name}
              ratio={1 / POST_RATIO}
            />
          </Pressable>
          <Pill
            tone="floating"
            overMedia
            icon="albums-outline"
            trailingIcon="chevron-forward"
            label="View post"
            bold
            onPress={openPost}
          />
        </View>
      ) : current.photo ? (
        <Image
          source={current.photo}
          contentFit="cover"
          transition={160}
          style={absoluteFill}
          blurRadius={locked ? LOCK_BLUR_RADIUS : undefined}
        />
      ) : (
        <Placeholder seed={current.seed} radius={0} style={absoluteFill} />
      )}

      {/* When it was shot over what it proves, set as on the post's own
          photo slides. Not over a locked story or the post frame. */}
      {footShown ? <ShotStamp time={current.time} label={current.label} /> : null}

      {/* A locked post's own wash. Its pill sits above the tap zones,
          further down, so it can be pressed. */}
      {locked ? <View pointerEvents="none" style={[absoluteFill, styles.lockWash]} /> : null}

      <View style={[styles.chrome, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.bars}>
          {frames.map((frame, i) => (
            <View key={frame.key} style={styles.bar}>
              {/* Only the story actually playing is an animated view. Handing
                  a bar the playing `fill` and then swapping it for a plain
                  number leaves the native side still driving that view, so
                  the bar you just skipped past can empty instead of staying
                  full. Different
                  element types either side of this branch mean React mounts a
                  fresh view rather than re-using the bound one. */}
              {i === index ? (
                <Animated.View
                  style={[styles.barFill, { transform: [{ scaleX: fill }] }]}
                />
              ) : (
                <View
                  style={[
                    styles.barFill,
                    i < index ? styles.barSeen : styles.barUnseen,
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        {/* The post's own header — the one My days wears — set on the
            photo. */}
        <PostHeader
          avatar={person ? person.avatar : (profile.avatar ?? profile.avatarSeed)}
          name={person ? person.name : profile.name}
          day={viewing}
          challengeName={person?.challengeName ?? challenge.name}
          done={taskDone}
          total={taskTotal}
          onMedia
          onPressProfile={openProfile}
          onPressChallenge={openChallenge}
          accessory={
            // The round glass button every other header wears, so the way
            // out reads as the same control it is everywhere else.
            <IconButton
              name="close"
              size={headerButtonSize}
              iconSize={headerIconSize}
              background={colors.surface}
              overMedia
              onPress={() => router.back()}
              accessibilityLabel="Close"
              style={styles.close}
            />
          }
          style={styles.head}
        />
      </View>

      {/* Tap zones sit under the chrome so the close button still wins, and
          under the post frame's grid for the same reason — the page either
          side of it still steps back and forward. */}
      {/* Either half pauses the moment it's touched. A quick tap lets go
          straight away and steps; a hold turns into a long press, which
          swallows the tap, so letting go only resumes. */}
      <View style={styles.zones} pointerEvents="box-none">
        {([-1, 1] as const).map((delta) => (
          <Pressable
            key={delta}
            accessibilityLabel={delta < 0 ? 'Previous' : 'Next'}
            style={styles.zone}
            delayLongPress={HOLD_MS}
            onPressIn={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            onLongPress={() => {}}
            onPress={() => advance(delta)}
          />
        ))}
      </View>

      {/* The locked post's own pill, and what it does on a post: straight
          to Tasks, where the photo that opens it gets taken. Only the pill
          takes the tap — either side of it still steps through the story. */}
      {/* Kept mounted and shown or not, rather than mounted per story, so
          on the iPhone's glass it dissolves and condenses as the stories
          step between locked and open. */}
      <View pointerEvents="box-none" style={[absoluteFill, styles.lockLayer]}>
        <Pill
          tone="floating"
          overMedia
          icon="lock-closed"
          label="Complete a task to unlock"
          bold
          visible={locked}
          onPress={() => router.dismissTo('/(tabs)/tasks')}
          style={styles.lockPill}
        />
      </View>

      {/* A round white button for the like, in the bottom right. Not over a
          locked story, nor over the post frame at the end, which carries
          its own way through. */}
      {stories.length ? (
        // Kept mounted, so on the iPhone's glass it dissolves over a locked
        // story or the post frame and condenses again after it.
        <LiquidGlassGroup
          pointerEvents="box-none"
          style={[styles.foot, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <IconButton
            name={myReaction ? 'heart' : 'heart-outline'}
            // A page header's button size, as the close button is, so the
            // two round buttons over the story read as one set.
            size={headerButtonSize}
            iconSize={HEART_ICON}
            background={colors.surface}
            // Filled red once liked — liked at a glance, and still the way
            // to take it back.
            color={myReaction ? colors.liked : undefined}
            onPress={toggleLike}
            accessibilityLabel={myReaction ? 'Liked. Tap to take it back' : 'Like'}
            overMedia
            visible={footShown}
          />
        </LiquidGlassGroup>
      ) : null}

      {/* A like's hearts, rising from the foot and fading out on the way. */}
      {bursts.length ? (
        <View pointerEvents="none" style={[absoluteFill, styles.bursts]}>
          {bursts.map((burst) => (
            <Animated.View
              key={burst.id}
              style={[
                styles.burst,
                {
                  left: screenWidth / 2 + burst.drift - BURST_START / 2,
                  bottom: insets.bottom + BURST_START,
                  opacity: burst.value.interpolate({
                    inputRange: [0, 0.1, 0.7, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: burst.value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -screenHeight * 0.6],
                      }),
                    },
                    {
                      translateX: burst.value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, burst.drift / 2],
                      }),
                    },
                    {
                      scale: burst.value.interpolate({
                        inputRange: [0, 0.2, 1],
                        outputRange: [0.4, 1.1, 0.9],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons name="heart" size={BURST_HEART} color={colors.liked} />
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.mediaBackdrop,
  },
  chrome: {
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  bars: {
    flexDirection: 'row',
    gap: BAR_GAP,
  },
  bar: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.onMediaTrack,
  },
  /**
   * Squashed to nothing against its own left edge and grown back out, rather
   * than slid across under a clipping parent: scaling needs no measurement, so
   * the fill is there on the first frame instead of waiting on an `onLayout`
   * that has to land before anything at all is drawn, and the track no longer
   * needs `overflow: 'hidden'` — which on Android, over a pill radius on a
   * 3px-tall view, is a reliable way to lose the child entirely. Still a
   * transform, so it runs on the UI thread and keeps going while the JS thread
   * is busy decoding the next photo.
   */
  barFill: {
    ...absoluteFill,
    borderRadius: radii.pill,
    backgroundColor: colors.onMedia,
    transformOrigin: 'left',
  },
  /** Seen outright, or skipped past part-way: either way the bar reads full. */
  barSeen: {
    transform: [{ scaleX: 1 }],
  },
  barUnseen: {
    transform: [{ scaleX: 0 }],
  },
  head: {
    marginTop: spacing.md,
  },
  close: {
    marginLeft: layout.inline,
  },
  // The like button in the bottom right corner, clear
  // of the home indicator, over the tap zones so pressing them doesn't skip
  // the story.
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  bursts: {
    zIndex: 4,
  },
  // The red of a heart left, lifted off the story by the soft shadow.
  burst: {
    position: 'absolute',
    ...shadows.soft,
  },
  lockWash: {
    backgroundColor: colors.scrimLock,
  },
  // Over the tap zones, so the pill in it can be pressed.
  lockLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // `Pill` shrink-wraps to the start of its row; the lock sits dead centre.
  lockPill: {
    alignSelf: 'center',
  },
  zones: {
    ...absoluteFill,
    flexDirection: 'row',
    zIndex: 1,
  },
  // Above the tap zones, so tapping the grid opens the post rather than
  // skipping the story.
  summary: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing['2xl'],
    zIndex: 2,
  },
  // The post's own cover as Community shows it, upright at the post's 3:4,
  // held inside the frame's side padding and rounded as a card lifted off
  // the story rather than the post laid flat in a feed.
  summaryGrid: {
    alignSelf: 'stretch',
    aspectRatio: POST_RATIO,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  zone: {
    flex: 1,
  },
});
