import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { DaysFeed } from '@/components/DaysFeed';
import { FriendCard } from '@/components/FriendCard';
import { type Friend } from '@/data/content';
import { orderBySlot, useApp, usePostedDays } from '@/hooks/useAppState';
import { useSession } from '@/hooks/useSession';
import { useMyPastRuns, useSocial } from '@/hooks/useSocial';
import { pastRunAuthor, pastRunPosted } from '@/lib/profileDays';

/**
 * One of your eras as a feed — `DaysFeed`, the same feed anyone else's days
 * open in — titled with the era's name and holding only its days, in the
 * profile grid's order, landing on the day that was tapped (or the latest,
 * from the era's header row). `run` names a past era; without it the
 * feed is the era you're in.
 *
 * Each day is the same `FriendCard` the Community tab posts your day with, so
 * a post looks the same wherever you meet it: the carousel, the "Day N"
 * stamped across its photo grid, the like and the comment sheet. Keyed
 * `day-N`, the same id Community's own card for today reads off, so a like or
 * a comment left in either place shows in both.
 */
export default function DayPostScreen() {
  const { day: dayParam, run } = useLocalSearchParams<{ day: string; run?: string }>();
  const openedDay = Number(dayParam) || 1;
  const postedDays = usePostedDays();

  const { profile, tasksOn, progress, captions, currentDay, membershipId, challenge, reload } = useApp();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { loadPage } = useSocial();
  const pastRuns = useMyPastRuns();
  const past = run ? pastRuns.find((r) => r.membershipId === run) : undefined;

  // You, in the same `Friend` shape Community builds for your own card —
  // only the identity row reads off it; each day's photos come in through
  // `post` below. On a past era, you as you were on it.
  const me: Friend = useMemo(() => {
    const now: Friend = {
      id: `day-${currentDay}`,
      name: profile.name,
      handle: profile.handle,
      avatar: profile.avatar ?? profile.avatarSeed,
      day: currentDay,
      bio: profile.bio,
      tasks: [],
      // Your days are posts like anyone's: what's said and felt about them
      // is kept against your membership.
      membershipId: membershipId ?? undefined,
      challengeId: challenge.id,
      challengeName: challenge.name,
    };
    return past ? pastRunAuthor(now, past) : now;
  }, [profile, currentDay, membershipId, challenge, past]);

  // The era's days, as its grid on the profile has them: today only once
  // it's finished, since until then it's still a story in progress.
  const days = useMemo(() => {
    const all = past
      ? pastRunPosted(past)
      : postedDays.filter(
          (day) => day < currentDay || tasksOn(day).every((task) => progress[day]?.[task.id]?.done),
        );
    // A day reached by a link rather than a tap on the grid — nothing
    // photographed yet, say — has no neighbours in the feed to scroll onto,
    // so it shows just itself.
    return all.includes(openedDay) ? all : [openedDay];
  }, [past, postedDays, currentDay, tasksOn, progress, openedDay]);

  const tasksFor = (day: number): Friend['tasks'] =>
    orderBySlot(tasksOn(day), progress[day]).map((task) => {
      const entry = progress[day]?.[task.id];
      return {
        label: task.label,
        done: entry?.done ?? false,
        time: entry?.time,
        photo: entry?.photo ?? undefined,
        photoSeed: entry?.photoSeed ?? undefined,
      };
    });

  return (
    <DaysFeed
      title={past ? past.challenge.name : challenge.name}
      onRefresh={() => Promise.all([reload(), userId ? loadPage(userId) : null])}
      days={days}
      openedDay={openedDay}
      renderDay={(day) => {
        if (!past) {
          return (
            <FriendCard
              friend={me}
              post={{ id: `day-${day}`, day, tasks: tasksFor(day), caption: captions[day] }}
              daysFeed
            />
          );
        }
        const record = past.days.find((d) => d.day === day);
        return record ? (
          <FriendCard
            friend={me}
            post={{ id: `${past.membershipId}-day${day}`, day, tasks: record.tasks, caption: record.caption }}
            daysFeed
          />
        ) : null;
      }}
    />
  );
}
