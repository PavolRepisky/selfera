import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
  type ScrollViewInstance,
} from 'react-native';

import { Avatar, type AvatarSource } from '@/components/Avatar';
import { PrimaryButton } from '@/components/Buttons';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FriendCard } from '@/components/FriendCard';
import { cornerButtonSize, cornerIconSize } from '@/components/IconButton';
import { Pill } from '@/components/Pill';
import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TaskRing } from '@/components/TaskRing';
import { Text } from '@/components/Text';
import { colors, colorsFor, layout, radii } from '@/constants/theme';
import { type Friend } from '@/data/content';
import { orderBySlot, useApp } from '@/hooks/useAppState';
import { useSocial } from '@/hooks/useSocial';
import { isPosted } from '@/lib/round';

type Tab = 'friends' | 'members';

/** A heading's link: the system blue on the iPhone, where links are tinted;
 * the reading grey on the drawn design, which has no accent — Discover's own
 * rule for its See all. */
const LINK = NATIVE_HEADER ? colors.systemAccent : colors.inkMuted;

/** A face in the "Still going today" row — the canvas's 72, a step up from
 * the old 64 so the row reads as stories rather than a strip of avatars;
 * four and a bit sit across a phone, the cut-off face saying it scrolls. */
const STORY_RING = 72;
/** The round badges leading the lock card and the empty "Finished today"
 * card — the size of the corner button, so the two read as the same kind of
 * mark. */
const CARD_DISC = cornerButtonSize;
const CARD_DISC_ICON = cornerIconSize;
/** The friends stacked beside "going today" in the lock card. */
const MINI_AVATAR = 26;
/** How far each stacked face tucks under the one before it. */
const MINI_OVERLAP = 9;
const MINI_RING = 2;
/** A face on a progress row — a step under a post's own avatar, since the
 * row is a line of detail, not a post. */
const ROW_AVATAR = 28;
/** A face in its ring on a member card — the canvas's 60, a step under the
 * Friends row's, since the card around it already gives it weight. */
const MEMBER_RING = 60;
/** The canvas's card: two and most of a third across a phone, so the row
 * says it scrolls. */
const MEMBER_CARD = 132;
/** Wide enough for a first name, so every row's bar starts on one line. */
const ROW_NAME = 56;
/** The ring's own stroke — the bars are the ring laid straight, the way the
 * profile's challenge bar is. */
const BAR_HEIGHT = 6;
/** The cut between one task's segment and the next on a progress row. */
const BAR_SEGMENT_GAP = 3;

const doneCount = (person: Friend) => person.tasks.filter((task) => task.done).length;
/** Every task shot and the countdown to going up run out — a post. Until
 * then a finished day is still going, a full ring in the row. */
const finished = (person: Friend, now = Date.now()) =>
  person.tasks.length > 0 && doneCount(person) === person.tasks.length && isPosted(person.postsAt, now);

/**
 * The people you're doing it with, split the way the redesign settled it.
 *
 * Friends: everyone still working through today sits in a row of split rings
 * — one segment per task, the profile's own gauge — and a day only becomes a
 * post in "Finished today" once every task is done. Until someone finishes,
 * that section says so and shows how far along everyone is instead.
 *
 * Members: the finishers' posts from your challenge as a whole, each with
 * an Add so a stranger doing the same thing can become a friend.
 *
 * Both sit behind the lock until the account has proven today with one
 * photographed task of its own: the card at the top says what to do, and
 * every post's photos stay blurred under a pill saying when they open.
 *
 * Everyone here is a real account, loaded fresh each time the tab comes
 * into view — with nobody to show yet, each tab says how to change that.
 */
export default function CommunityScreen() {
  const router = useRouter();
  // The lock card's face rings take a plain colour: on the iPhone an
  // adaptive border came back black once the card was drawn again after a
  // tab switch.
  const plainColors = colorsFor(useColorScheme());
  const {
    feedLocked,
    inChallenge,
    daysUntilStart,
    profile,
    challenge,
    tasks,
    progress,
    captions,
    currentDay,
    membershipId,
    postsAt,
  } = useApp();
  const {
    friends,
    members,
    roundSize,
    loaded,
    relations,
    refreshToday,
    toggleRequest: toggleAdded,
  } = useSocial();
  const added = relations.outgoing;
  const [tab, setTab] = useState<Tab>('friends');

  // The tab is drawn again the moment the next countdown — yours or
  // anyone's — runs out, so that day moves from the row to its post, and
  // fetched again, since a photo or caption may have changed in the
  // countdown.
  const [now, setNow] = useState(Date.now);
  const myPostsAt = postsAt[currentDay];
  useEffect(() => {
    const next = [myPostsAt, ...friends.map((f) => f.postsAt), ...members.map((m) => m.postsAt)]
      .filter((at): at is number => at !== undefined && at > now)
      .reduce((soonest, at) => Math.min(soonest, at), Infinity);
    if (next === Infinity) return;
    const id = setTimeout(() => {
      setNow(Date.now());
      refreshToday();
    }, next - Date.now() + 50);
    return () => clearTimeout(id);
  }, [myPostsAt, friends, members, now, refreshToday]);

  // Today moves on while the app is open — people finish, photos come in —
  // so the tab loads afresh every time it's opened rather than once.
  useFocusEffect(
    useCallback(() => {
      refreshToday();
    }, [refreshToday]),
  );

  // The lock opening is the moment the server starts signing today's
  // photos, so what was loaded behind it has none — load again.
  const wasLocked = useRef(feedLocked);
  useEffect(() => {
    if (wasLocked.current && !feedLocked) refreshToday();
    wasLocked.current = feedLocked;
  }, [feedLocked, refreshToday]);

  // A story's last frame links the post it became: `post` names it, and the
  // feed opens on the tab it's in and scrolls it up under the title. Stories
  // only last the day, so the link lands here in the feed, where the post
  // stays. Positions are measured as the posts lay out — each post's offset
  // inside its tab's list, plus that list's offset in the scroll — and the
  // param is cleared once used, so coming back to the tab doesn't jump again.
  const { post: focusPost } = useLocalSearchParams<{ post?: string }>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const listY = useRef<Partial<Record<Tab, number>>>({});
  const postY = useRef<Record<string, number>>({});
  const focusTab: Tab | null = focusPost
    ? members.some((person) => person.id === focusPost)
      ? 'members'
      : 'friends'
    : null;

  useEffect(() => {
    if (focusTab) setTab(focusTab);
  }, [focusPost, focusTab]);

  const scrollToFocus = () => {
    if (!focusPost || !focusTab || tab !== focusTab) return;
    const list = listY.current[focusTab];
    const item = postY.current[focusPost];
    if (list === undefined || item === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, list + item - layout.section), animated: true });
    router.setParams({ post: undefined });
  };

  const onListLayout = (which: Tab) => (y: number) => {
    listY.current[which] = y;
    scrollToFocus();
  };
  const onPostLayout = (id: string) => (y: number) => {
    postY.current[id] = y;
    scrollToFocus();
  };

  // Only while there is a today of your own to prove — see `feedLocked`.
  const locked = feedLocked;

  const openProfile = (id: string) =>
    router.push({ pathname: '/friend/[id]', params: { id } });
  const openTasks = () => router.push('/(tabs)/tasks');

  const myAvatar: AvatarSource = profile.avatar ?? profile.avatarSeed;
  // Whether you have a today of your own: in a challenge that has started.
  // Without one there's no face of yours in the rows, no progress of yours
  // to race and no post of yours — only everyone else's.
  const myDayRunning = inChallenge && daysUntilStart === 0;
  const myDone = myDayRunning
    ? tasks.filter((task) => progress[currentDay]?.[task.id]?.done).length
    : 0;
  const myFinished =
    myDayRunning && tasks.length > 0 && myDone === tasks.length && isPosted(myPostsAt, now);
  const hasStoryToday = tasks.some((task) => {
    const entry = progress[currentDay]?.[task.id];
    return Boolean(entry?.photo || entry?.photoSeed);
  });

  // Your own day, in the same `Friend` shape a card already knows how to
  // draw — a post only once it's finished, like everyone else's. The key is
  // the one Profile's own grid tile hashes its counts from, so the numbers
  // don't drift between the two. The name reads "You": that alone marks it.
  const myPost: Friend | null = useMemo(() => {
    if (!myFinished) return null;
    return {
      id: `day-${currentDay}`,
      name: 'You',
      handle: profile.handle,
      avatar: myAvatar,
      day: currentDay,
      bio: profile.bio,
      caption: captions[currentDay],
      membershipId: membershipId ?? undefined,
      challengeId: challenge.id,
      challengeName: challenge.name,
      // In the squares they were shot into on the Tasks tab, so the post
      // goes up the way it was laid out there.
      tasks: orderBySlot(tasks, progress[currentDay]).map((task) => {
        const entry = progress[currentDay]?.[task.id];
        return {
          label: task.label,
          done: entry?.done ?? false,
          time: entry?.time,
          photo: entry?.photo ?? undefined,
          photoSeed: entry?.photoSeed ?? undefined,
        };
      }),
    };
  }, [myFinished, myAvatar, profile, tasks, progress, captions, currentDay, membershipId, challenge]);

  const friendsGoing = friends.filter((friend) => !finished(friend, now));

  // The "Still going today" row as the story viewer plays it through: you,
  // then everyone after you, skipping faces with no photo yet — there's no
  // story there to land on. `me` is the viewer's name for yours.
  const storyQueue = [
    ...(myDayRunning && !myFinished && hasStoryToday ? ['me'] : []),
    ...friendsGoing
      .filter((friend) => friend.tasks.some((task) => task.photo || task.photoSeed))
      .map((friend) => friend.id),
  ].join(',');
  const friendsFinished = friends.filter((friend) => finished(friend, now));
  // The Friends headings count your friends alone — "2 of 6 friends" — so
  // the two add up to the same whole; your own face and post sit outside it.
  const friendsOf = `${friends.length} friend${friends.length === 1 ? '' : 's'}`;
  const membersFinished = members.filter((person) => finished(person, now));

  // Everyone's day at a glance for the empty "Finished today" card, furthest
  // along first — you included, since your day is racing theirs.
  const progressRows = [
    ...(myDayRunning
      ? [{ id: 'you', name: 'You', avatar: myAvatar, done: myDone, total: tasks.length }]
      : []),
    ...friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      avatar: friend.avatar,
      done: doneCount(friend),
      total: friend.tasks.length,
    })),
  ].sort((a, b) => b.done / Math.max(b.total, 1) - a.done / Math.max(a.total, 1));

  // Members' "Finished today" counts out of the whole round, you included,
  // as your post is in the feed under it — never fewer than the tab lists.
  const roundTotal = Math.max(roundSize, members.length + (myDayRunning ? 1 : 0));
  const roundOf = `${roundTotal.toLocaleString('en-US')} member${roundTotal === 1 ? '' : 's'}`;

  // The lock card, on Friends: who of yours is still going.
  const lockFaces = friendsGoing;
  const lockCount = lockFaces.length;
  const lockGoing = `${lockCount.toLocaleString('en-US')} friend${lockCount === 1 ? '' : 's'} still going`;
  const lockHint = "Finish any of today's tasks to see how your friends are doing.";

  const renderPost = (person: Friend, accessory?: React.ReactNode) => (
    <View key={person.id} onLayout={(e) => onPostLayout(person.id)(e.nativeEvent.layout.y)}>
      <FriendCard
        friend={person}
        onPress={() => openProfile(person.id)}
        locked={locked}
        accessory={accessory}
      />
    </View>
  );

  return (
    // Challenges' own fixed title row: the title on the gutter, Find friends
    // at the end, staying put while the feed scrolls under it.
    <View style={styles.screenRoot}>
      <ScreenScroll
        tabBar
        ref={scrollRef}
        onRefresh={refreshToday}
        header={
          <ScreenHeader
            plainTitle="Community"
            showBack={false}
            actions={[
              { icon: 'person-add-outline', label: 'Find friends', onPress: () => router.push('/add-friends') },
            ]}
          />
        }
      >

        <SegmentedTabs
          options={[
            { key: 'friends', label: 'Friends' },
            { key: 'members', label: 'Members' },
          ]}
          value={tab}
          onChange={setTab}
          style={styles.tabs}
        />


        {/* Friends only: on Members each post's own blur and pill already
            say what's held back, and a card over strangers asked too much. */}
        {locked && tab === 'friends' ? (
          <Card flat radius={radii.lg} style={styles.sunkenCard}>
            <View style={styles.cardBody}>
              <View style={styles.lockRow}>
                <View style={[styles.disc, styles.discInk]}>
                  <Ionicons name="lock-closed" size={CARD_DISC_ICON} color={colors.inkInverse} />
                </View>
                <View style={styles.lockText}>
                  <Text variant="itemTitle">Complete a task to unlock</Text>
                  <Text variant="meta" color={colors.inkMuted}>
                    {lockHint}
                  </Text>
                </View>
              </View>
              <View style={styles.lockFooter}>
                <View style={styles.lockGoing}>
                  <View style={styles.miniStack}>
                    {lockFaces.slice(0, 3).map((person, i) => (
                      <Avatar
                        key={person.id}
                        source={person.avatar}
                        size={MINI_AVATAR}
                        style={[
                          styles.miniAvatar,
                          { borderColor: plainColors.surface },
                          i > 0 && styles.miniTucked,
                        ]}
                      />
                    ))}
                  </View>
                  <Text variant="meta" color={colors.inkMuted} numberOfLines={2} style={styles.flex}>
                    {lockGoing}
                  </Text>
                </View>
                {/* Small like the member cards' Add, but filled: it's the one
                    thing the locked tab asks of you. */}
                <Pill
                  tone="solid"
                  size="sm"
                  icon="camera"
                  label="Shoot a task"
                  bold
                  onPress={openTasks}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {tab === 'friends' ? (
          <>
            {/* Stories are what the lock holds back, so the row only shows
                once it's open. */}
            {!locked && (friendsGoing.length > 0 || (myDayRunning && !myFinished)) ? (
              <View style={styles.section}>
                <SectionHeading
                  title="Still going"
                  meta={friends.length ? `${friendsGoing.length} of ${friendsOf}` : undefined}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.storyBleed}
                  contentContainerStyle={styles.storyRow}
                >
                  {myFinished || !myDayRunning ? null : (
                    <StoryFace
                      name="You"
                      avatar={myAvatar}
                      done={myDone}
                      total={tasks.length}
                      mine
                      onPress={() =>
                        hasStoryToday
                          ? router.push({
                              pathname: '/story',
                              params: { day: String(currentDay), queue: storyQueue },
                            })
                          : openTasks()
                      }
                    />
                  )}
                  {friendsGoing.map((friend) => (
                    <StoryFace
                      key={friend.id}
                      name={friend.name}
                      avatar={friend.avatar}
                      done={doneCount(friend)}
                      total={friend.tasks.length}
                      photos={friend.tasks.map((task) => task.completionId)}
                      // The same story viewer yours opens in.
                      onPress={() =>
                        router.push({
                          pathname: '/story',
                          params: { friend: friend.id, queue: storyQueue },
                        })
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Held even with no friends yet, so both tabs read the same
                way down: the heading, then what's under it or why not. */}
            <SectionHeading
              title="Finished today"
              meta={friends.length ? `${friendsFinished.length} of ${friendsOf}` : undefined}
            />

            {loaded && !friends.length ? (
              <>
                {myPost ? (
                  <View style={styles.posts}>
                    <FriendCard friend={myPost} locked={false} />
                  </View>
                ) : null}
                <EmptyState
                  icon="people-outline"
                  title="No friends here yet"
                  hint="Add people and their days show up here as they go."
                  action={{ label: 'Find friends', onPress: () => router.push('/add-friends') }}
                />
              </>
            ) : myPost || friendsFinished.length ? (
              <View
                style={styles.posts}
                onLayout={(e) => onListLayout('friends')(e.nativeEvent.layout.y)}
              >
                {myPost ? (
                  <View onLayout={(e) => onPostLayout(myPost.id)(e.nativeEvent.layout.y)}>
                    <FriendCard friend={myPost} locked={false} />
                  </View>
                ) : null}
                {friendsFinished.map((friend) => renderPost(friend))}
              </View>
            ) : (
              <Card flat radius={radii.lg} style={styles.sunkenCard}>
                <View style={[styles.cardBody, styles.emptyBody]}>
                  <View style={styles.emptyIntro}>
                    <View style={[styles.disc, styles.discWhite]}>
                      <Ionicons name="flag-outline" size={CARD_DISC_ICON} color={colors.ink} />
                    </View>
                    <Text variant="itemTitle" center>
                      No one has finished today yet
                    </Text>
                    <Text variant="meta" color={colors.inkMuted} center>
                      {`Finish all ${tasks.length} and your day lands here first.`}
                    </Text>
                  </View>
                  <View style={styles.progressRows}>
                    {progressRows.map((row) => (
                      <ProgressRow key={row.id} {...row} />
                    ))}
                  </View>
                  {locked ? null : (
                    <PrimaryButton
                      label="Shoot your next task"
                      icon="camera-outline"
                      onPress={openTasks}
                    />
                  )}
                </View>
              </Card>
            )}
          </>
        ) : (
          <>
            {/* Everyone else on the challenge, finished today or not, as
                faces to add — the feed below only shows who's done. Shares
                the posts' requests, so adding here flips their Add too. */}
            {members.length ? (
              <View style={styles.section}>
                {/* The era's page lists everyone in it, so See all lands
                    there rather than on a list of its own. */}
                <SectionHeading
                  title="In it with you"
                  action={{
                    label: 'See all',
                    onPress: () =>
                      router.push({ pathname: '/feed/[id]', params: { id: challenge.id } }),
                  }}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.storyBleed}
                  contentContainerStyle={styles.memberRow}
                >
                  {members.map((person) => (
                    <MemberCard
                      key={person.id}
                      person={person}
                      added={added.has(person.id)}
                      onPress={() => openProfile(person.id)}
                      onToggleAdd={() => toggleAdded(person.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Yours leads here too: you're one of the members, and your day
                is in the round's feed like everyone else's. */}
            <SectionHeading
              title="Finished today"
              meta={
                inChallenge
                  ? `${(membersFinished.length + (myPost ? 1 : 0)).toLocaleString('en-US')} of ${roundOf}`
                  : undefined
              }
            />

            {loaded && !inChallenge ? (
              <EmptyState
                icon="flag-outline"
                title="Join an era first"
                hint="Members are the people doing your era with you."
                action={{ label: 'Find an era', onPress: () => router.navigate('/discover') }}
              />
            ) : loaded && !members.length ? (
              <>
                {myPost ? (
                  <View style={styles.posts}>
                    <FriendCard friend={myPost} locked={false} />
                  </View>
                ) : null}
                <EmptyState
                  icon="people-outline"
                  title="No one else in it yet"
                  hint="Bring a friend along — they'll show up here once their Day 1 comes."
                  action={{ label: 'Invite a friend', onPress: () => router.push('/add-friends') }}
                />
              </>
            ) : myPost || membersFinished.length ? (
              <View
                style={styles.posts}
                onLayout={(e) => onListLayout('members')(e.nativeEvent.layout.y)}
              >
                {myPost ? <FriendCard friend={myPost} locked={false} /> : null}
                {membersFinished.map((person) => {
                  const isAdded = added.has(person.id);
                  return renderPost(
                    person,
                    <Pill
                      tone={isAdded ? 'muted' : 'solid'}
                      size="sm"
                      bold
                      // Just the words once sent: the request is waiting on
                      // them, and a check would say it's done.
                      icon={isAdded ? undefined : 'person-add'}
                      label={isAdded ? 'Request sent' : 'Add'}
                      onPress={() => toggleAdded(person.id)}
                    />,
                  );
                })}
              </View>
            ) : (
              <EmptyState
                icon="flag-outline"
                title="No one has finished today yet"
                hint="Finished days land here, newest first."
              />
            )}
          </>
        )}
      </ScreenScroll>
    </View>
  );
}

/** A section's title with its quiet count at the far end — the way My
 * Profile sets "Days" against its switch. */
function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  /** A link in the count's place — "See all", as Discover's Trending has. */
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text variant="sectionHeading">{title}</Text>
      {action ? (
        <Text variant="metaBold" color={LINK} accessibilityRole="link" onPress={action.onPress}>
          {action.label}
        </Text>
      ) : meta ? (
        <Text variant="metaBold" color={colors.inkAside}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

function StoryFace({
  name,
  avatar,
  done,
  total,
  photos,
  mine,
  onPress,
}: {
  name: string;
  avatar: AvatarSource;
  done: number;
  total: number;
  photos?: readonly (string | undefined)[];
  mine?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.storyFace}>
      <TaskRing
        avatar={avatar}
        done={done}
        total={total}
        photos={photos}
        mine={mine}
        size={STORY_RING}
        badge={false}
        onPress={onPress}
        accessibilityLabel={`${name}, ${done} of ${total} done`}
      />
      {/* The count under the name rather than a badge on the ring, so the
          ring stays whole and the number reads as a line of text. */}
      <View style={styles.storyText}>
        <Text variant="copyBold" numberOfLines={1} center>
          {name}
        </Text>
        <Text variant="badge" color={colors.inkMuted} numberOfLines={1} center>
          {`${done} of ${total}`}
        </Text>
      </View>
    </View>
  );
}

/** A stranger on the challenge as a card to add: face, name, how their
 * today is going, and the same Add the Members posts carry. Not their day —
 * everyone here is on the challenge's same day, so it would read the same on
 * every card. */
function MemberCard({
  person,
  added,
  onPress,
  onToggleAdd,
}: {
  person: Friend;
  added: boolean;
  onPress: () => void;
  onToggleAdd: () => void;
}) {
  return (
    <View style={styles.memberCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${person.name}'s profile`}
        onPress={onPress}
        style={({ pressed }) => [styles.memberWho, pressed && styles.pressed]}
      >
        {/* Their day's ring, as the Friends row draws it — the count is the
            line under the name, so the ring carries no badge. */}
        <TaskRing
          avatar={person.avatar}
          done={doneCount(person)}
          total={person.tasks.length}
          size={MEMBER_RING}
          badge={false}
        />
        <View style={styles.memberText}>
          <Text variant="copyBold" numberOfLines={1} center>
            {person.name}
          </Text>
          {/* Friends you share say who a stranger is — the ring already
              says how their day is going. Said even when it's none, so
              every card in the row stands the same height. */}
          <Text variant="badge" color={colors.inkMuted} numberOfLines={1} center>
            {person.mutualCount
              ? `${person.mutualCount} mutual friend${person.mutualCount === 1 ? '' : 's'}`
              : 'No mutual friends'}
          </Text>
        </View>
      </Pressable>
      {/* The quiet capsule, sized to its word: on the iPhone the system's
          soft blue, elsewhere white on the card's grey. Sent, the words go
          grey — the request is waiting on them. */}
      <Pill
        tone="floating"
        size="sm"
        bold
        icon={added ? undefined : 'person-add'}
        label={added ? 'Request sent' : 'Add'}
        labelColor={added ? colors.inkMuted : undefined}
        onPress={onToggleAdd}
        style={styles.memberAdd}
      />
    </View>
  );
}

/** One person's day as a line: face, name, a bar cut into their own tasks,
 * and the count. */
function ProgressRow({
  name,
  avatar,
  done,
  total,
}: {
  name: string;
  avatar: AvatarSource;
  done: number;
  total: number;
}) {
  return (
    <View style={styles.progressRow} accessibilityLabel={`${name}, ${done} of ${total} done`}>
      <Avatar source={avatar} size={ROW_AVATAR} />
      <Text variant="metaBold" numberOfLines={1} style={styles.rowName}>
        {name}
      </Text>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < done && styles.segmentDone]} />
        ))}
      </View>
      <Text variant="metaBold" color={colors.inkMuted}>
        {`${done}/${total}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  tabs: {
    marginBottom: layout.section,
  },
  // My Profile's challenge card: the fill grey, the `md` corner, no shadow.
  sunkenCard: {
    marginBottom: layout.section,
    backgroundColor: colors.surfaceSunken,
  },
  cardBody: {
    padding: layout.card,
    gap: layout.block,
  },
  disc: {
    width: CARD_DISC,
    height: CARD_DISC,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discInk: {
    backgroundColor: colors.ink,
  },
  discWhite: {
    backgroundColor: colors.surface,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.inline,
  },
  lockText: {
    flex: 1,
    gap: layout.line,
  },
  lockFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  lockGoing: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.stack,
  },
  miniStack: {
    flexDirection: 'row',
  },
  // Ringed in white (set where it's drawn), so each face stands off the
  // card's grey and reads as tucked behind the next rather than merged into
  // it.
  miniAvatar: {
    borderWidth: MINI_RING,
    borderRadius: radii.pill,
  },
  miniTucked: {
    marginLeft: -MINI_OVERLAP,
  },
  section: {
    marginBottom: layout.section,
  },
  // The row runs to the screen's edges, so faces scroll in from under the
  // edge rather than stopping short at the gutter.
  storyBleed: {
    marginHorizontal: -layout.gutter,
  },
  storyRow: {
    paddingHorizontal: layout.gutter,
    gap: layout.inline,
  },
  storyFace: {
    width: STORY_RING,
    alignItems: 'center',
    gap: layout.stack,
  },
  storyText: {
    alignSelf: 'stretch',
  },
  memberRow: {
    paddingHorizontal: layout.gutter,
    gap: layout.stack,
  },
  // The fill grey the page's other cards sit in, everything centred down
  // it; held close at the sides so a name has the card's width to fit in.
  memberCard: {
    width: MEMBER_CARD,
    paddingVertical: layout.heading,
    paddingHorizontal: layout.stack,
    gap: layout.stack,
    alignItems: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
  },
  memberWho: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: layout.stack,
  },
  memberText: {
    alignSelf: 'stretch',
  },
  memberAdd: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.heading,
  },
  posts: {
    gap: layout.section,
  },
  emptyBody: {
    gap: layout.section,
  },
  emptyIntro: {
    alignItems: 'center',
    gap: layout.line,
  },
  progressRows: {
    gap: layout.stack,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  rowName: {
    width: ROW_NAME,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: BAR_SEGMENT_GAP,
  },
  // White on the card's grey, the way the profile's challenge bar keeps its
  // track: a divider grey sits within a shade of the fill and vanishes.
  segment: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  segmentDone: {
    backgroundColor: colors.ink,
  },
});
