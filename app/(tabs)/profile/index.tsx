import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProfileHeader, ProfileView, type ProfileDay } from '@/components/ProfileView';
import { ScreenScroll } from '@/components/Screen';
import { ShareProfileSheet } from '@/components/ShareProfileSheet';
import { orderBySlot, useApp, usePostedDays } from '@/hooks/useAppState';
import { useChallengeCards } from '@/hooks/useChallengeCards';
import { useSession } from '@/hooks/useSession';
import { useMyPastRuns, useSocial } from '@/hooks/useSocial';
import { profileRun } from '@/lib/profileDays';

/**
 * Your own profile. The page itself is `ProfileView`, the same one anyone
 * else's profile opens on — this screen only reads your days off the app's
 * state and puts Settings in the header, Edit profile and Share profile
 * under the bio, and your code and link in its own sheet.
 *
 * The era you're in comes from the app's own state, so a photo taken a
 * moment ago is already on it. Eras you were in before come from your page
 * on the server, the same one anyone opening your profile reads, and their
 * days stay on it for good.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const {
    profile, currentDay, totalDays, startDate, challenge, tasksOn, todayTasks, progress, inChallenge,
    daysUntilStart, membershipId, livesLeft, livesTotal, reload,
  } = useApp();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { page, loadPage } = useSocial();
  const [shareOpen, setShareOpen] = useState(false);

  // Loaded again whenever the era you're in changes — leaving one, or the
  // settle job ending it, is exactly when a run becomes a past one.
  useEffect(() => {
    if (userId) loadPage(userId);
  }, [userId, membershipId, loadPage]);

  const dayOf = useCallback(
    (day: number): ProfileDay => {
      const due = tasksOn(day);
      return {
        shots: orderBySlot(due, progress[day]).flatMap((task) => {
          const entry = progress[day]?.[task.id];
          return entry?.photo || entry?.photoSeed
            ? [{ key: task.id, photo: entry.thumb ?? entry.photo ?? null, seed: entry.photoSeed ?? null }]
            : [];
        }),
        done: due.filter((task) => progress[day]?.[task.id]?.done).length,
        total: due.length,
      };
    },
    [tasksOn, progress],
  );

  // Today is a story as soon as one task has its photo — until then there is
  // nothing to watch, and the photo is just a photo.
  const hasStoryToday = inChallenge && dayOf(currentDay).shots.length > 0;
  const dayFinished = (day: number) => {
    const record = dayOf(day);
    return record.total > 0 && record.done === record.total;
  };

  // Same order the day pager pages through — opening a tile and paging down
  // must land on the next tile in this exact sequence. Today only joins the
  // grid once it is finished: until then it is still a story in progress,
  // and the ring above already shows it.
  const postedDays = usePostedDays().filter((day) => day < currentDay || dayFinished(day));

  const openDay = useCallback(
    (day: number) => router.push({ pathname: '/day/[day]', params: { day: String(day) } }),
    [router],
  );
  const openPastDay = useCallback(
    (run: string, day: number) =>
      router.push({ pathname: '/day/[day]', params: { day: String(day), run } }),
    [router],
  );
  const myPage = userId ? page(userId) : undefined;
  // Between eras: the ones you could still join, the same set Discover
  // offers, friends' first — their photos fan on the card, and how many
  // friends are in one says why now.
  const cards = useChallengeCards();
  const nextEra = useMemo(() => {
    const open = cards
      .filter((card) => card.phase === 'upcoming' && !card.mine)
      .sort((a, b) => b.friendsIn.length - a.friendsIn.length || (b.members ?? 0) - (a.members ?? 0));
    const friends = new Set(open.flatMap((card) => card.friendsIn.map((friend) => friend.id))).size;
    const hint = friends
      ? `${friends} ${friends === 1 ? 'friend is' : 'friends are'} in one`
      : open.length
        ? `${open.length} ${open.length === 1 ? 'era starts' : 'eras start'} soon`
        : 'Start one and bring your friends';
    return {
      photos: open.flatMap((card) => card.photos.slice(0, 1)).slice(0, 3),
      hint,
      onFind: () => router.navigate('/discover'),
    };
  }, [cards, router]);

  const myPastRuns = useMyPastRuns();
  const pastRuns = useMemo(
    () => myPastRuns.map((run) => profileRun(run, openPastDay)),
    [myPastRuns, openPastDay],
  );

  const openShare = () => setShareOpen(true);

  return (
    <View style={styles.screenRoot}>
      {/* Every tab root's fixed title row: your username, and Settings at
          the end, in reach however far down the days go. Sharing is the
          Share profile button under the bio, not repeated up here. */}
      <ScreenScroll
        tabBar
        onRefresh={() => Promise.all([reload(), userId ? loadPage(userId) : null])}
        tone="plain"
        header={
          <ProfileHeader
            handle={profile.handle}
            showBack={false}
            actions={[
              { icon: 'settings-outline', label: 'Settings', onPress: () => router.push('/account/settings') },
            ]}
          />
        }
      >
        <ProfileView
          // The photo itself is changed on Edit profile, not from here — a
          // tap on it plays today's story.
          avatar={profile.avatar ?? profile.avatarSeed}
          name={profile.name}
          bio={profile.bio}
          challenge={inChallenge ? challenge : null}
          startDate={startDate}
          currentDay={daysUntilStart > 0 ? 0 : currentDay}
          totalDays={totalDays}
          taskCount={todayTasks.length}
          dayOf={dayOf}
          posted={postedDays}
          pastRuns={pastRuns}
          mine
          lives={{ left: livesLeft, total: livesTotal }}
          friendCount={myPage?.friendCount}
          onPlayStory={
            hasStoryToday
              ? () => router.push({ pathname: '/story', params: { day: String(currentDay) } })
              : undefined
          }
          onOpenDay={openDay}
          emptyHint="Finish a day's tasks to see it here."
          daysTitle="My Eras"
          nextEra={nextEra}
          // The same two buttons a friend's page has in this place, as they
          // apply to you.
          actions={[
            { label: 'Edit profile', onPress: () => router.push('/account/edit') },
            { label: 'Share profile', onPress: openShare },
          ]}
        />
      </ScreenScroll>

      {userId ? (
        <ShareProfileSheet
          visible={shareOpen}
          onDismiss={() => setShareOpen(false)}
          person={{ id: userId, name: profile.name, handle: profile.handle }}
          status={inChallenge && daysUntilStart === 0 ? `Day ${currentDay} of ${challenge.name}` : null}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
});
