import type { ProfileDay, ProfileRun } from '@/components/ProfileView';
import type { Friend } from '@/data/content';
import type { DayRecord, PastRun } from '@/lib/backend/social';

/**
 * Someone's days as a profile draws them: each day's photos and how many of
 * its tasks got done. Tiles on the grid and calendar are small, so they take
 * thumbnails where there are any.
 */
export function profileDays(records: readonly DayRecord[]): Map<number, ProfileDay> {
  return new Map(
    records.map(({ day, tasks }) => [
      day,
      {
        shots: tasks.flatMap((task) =>
          task.photo || task.photoSeed
            ? [
                {
                  key: task.label,
                  photo: task.thumb ?? task.photo ?? null,
                  seed: task.photoSeed ?? null,
                  completionId: task.completionId,
                },
              ]
            : [],
        ),
        done: tasks.filter((task) => task.done).length,
      },
    ]),
  );
}

/** A past era's days that go in the grid, most recent first: every one with
 * a photo — the run is over, so none of them is still in progress. */
export function pastRunPosted(run: PastRun): number[] {
  return run.days
    .filter(({ tasks }) => tasks.some((task) => task.photo || task.photoSeed))
    .map(({ day }) => day);
}

/** A past era as `ProfileView` takes it, each of its days opening through
 * `onOpenDay`. */
export function profileRun(
  run: PastRun,
  onOpenDay: (membershipId: string, day: number) => void,
): ProfileRun {
  const days = profileDays(run.days);
  return {
    key: run.membershipId,
    name: run.challenge.name,
    startDate: run.startDate,
    totalDays: run.totalDays,
    status: run.status,
    lastDay: run.lastDay,
    taskCount: run.taskCount,
    dayOf: (day) => days.get(day) ?? null,
    posted: pastRunPosted(run),
    onOpenDay: (day) => onOpenDay(run.membershipId, day),
  };
}

/** Who a past era's posts are by: the person as they were on it — its name
 * stamped across the photos, and what was said and felt about each day kept
 * against that run, not the one they're on now. */
export function pastRunAuthor(person: Friend, run: PastRun): Friend {
  return {
    ...person,
    day: run.dayToday,
    tasks: [],
    caption: undefined,
    membershipId: run.membershipId,
    challengeId: run.challenge.id,
    challengeName: run.challenge.name,
  };
}
