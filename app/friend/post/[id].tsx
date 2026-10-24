import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { DaysFeed } from '@/components/DaysFeed';
import { FriendCard } from '@/components/FriendCard';
import { useSocial } from '@/hooks/useSocial';
import { pastRunAuthor, pastRunPosted } from '@/lib/profileDays';
import { isPosted } from '@/lib/round';

/**
 * One of a friend's or member's eras as a feed, opened from their profile —
 * `DaysFeed`, the same feed your own eras scroll through — titled with the
 * era's name and holding exactly its days as their grid has them, landing
 * on the day that was tapped. For the era they're in, that's every earlier
 * day with a photo and today only once it's finished. `run` names a past
 * era. Each day is the same `FriendCard` the Community feed posts with.
 */
export default function FriendPostScreen() {
  const { id, day: dayParam, run } = useLocalSearchParams<{ id: string; day?: string; run?: string }>();
  const userId = String(id);
  const social = useSocial();
  const { loadPage } = social;
  const page = social.page(userId);

  // Opened from their profile, the page is already loaded; from a link it
  // isn't yet.
  useEffect(() => {
    if (!page) loadPage(userId);
  }, [page, userId, loadPage]);

  const friend = page?.person;
  const past = run ? page?.pastRuns.find((r) => r.membershipId === run) : undefined;
  const openedDay = Number(dayParam) || friend?.day || 1;

  const records = useMemo(() => {
    if (!friend || !page) return [];
    if (past) return past.days.filter(({ day }) => pastRunPosted(past).includes(day));
    const taskCount = friend.tasks.length;
    return page.days
      .filter(
        ({ day, tasks }) =>
          tasks.some((task) => task.photo || task.photoSeed) &&
          (day < friend.day ||
            (tasks.filter((task) => task.done).length === taskCount && isPosted(friend.postsAt))),
      )
      .sort((a, b) => b.day - a.day);
  }, [friend, page, past]);

  // A day reached by a link rather than a tap on the grid has no neighbours
  // to scroll onto, so it shows just itself — your own feed's rule.
  const days = useMemo(() => {
    const all = records.map((record) => record.day);
    return all.includes(openedDay) ? all : [openedDay];
  }, [records, openedDay]);

  if (!friend) return null;
  const author = past ? pastRunAuthor(friend, past) : friend;

  return (
    <DaysFeed
      onRefresh={() => loadPage(userId)}
      title={past ? past.challenge.name : (friend.challengeName ?? '')}
      days={days}
      openedDay={openedDay}
      renderDay={(day) => {
        const record = records.find((r) => r.day === day);
        // No `onPress` — the avatar and name would only open the profile
        // this feed was already opened from.
        return (
          <FriendCard
            friend={author}
            daysFeed
            post={
              (!past && day === friend.day) || !record
                ? undefined
                : {
                    id: `${past ? past.membershipId : friend.id}-day${day}`,
                    day,
                    tasks: record.tasks,
                    caption: record.caption,
                  }
            }
          />
        );
      }}
    />
  );
}
