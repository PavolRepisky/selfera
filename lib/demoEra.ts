import type { ImageSourcePropType } from '@/lib/imageSource';

import type { CommentEntry } from '@/components/CommentsSheet';
import type { Progress } from '@/hooks/useAppState';
import { challengeById, type Challenge } from '@/data/challenges';
import { LOVE } from '@/data/content';
import type { DayRecord, Person, PersonPage, PostStats } from '@/lib/backend/social';
import { postKey } from '@/lib/backend/social';
import { addDays, timeStamp } from '@/lib/format';
import { startOfToday } from '@/lib/round';

/**
 * For seeing the app full of people: you're on Day 12 of a made-up run of
 * "Get Fit for Summer", with six friends and eight other members on the
 * same day — some finished, some still going — every one with photos,
 * hearts and a few comments. Held on the phone only: none of it is sent to
 * the server, and what you do to it (a shot, a heart, a comment) stays
 * here until the app reloads. Development builds only; turn it off to see
 * your real account again.
 */
export const DEMO_ERA = __DEV__ && true;

/** Which day of the made-up run today is. */
const DEMO_DAY = 12;
/** The day you missed, so the run has spent one of its lives. */
const MISSED_DAY = 6;

/** Every made-up id starts like the fake past eras' do, so `isFakeRun`
 * keeps hearts and comments on them off the server. */
const FAKE = 'fake-demo-';
export const isDemoId = (id: string) => id.startsWith(FAKE);

/** The made-up run's era: the first preset. */
export const demoChallenge = (): Challenge => challengeById('selfera');
export const demoStartDate = () => addDays(startOfToday(), -(DEMO_DAY - 1));
export const DEMO_MEMBERSHIP = `${FAKE}me`;

/** Bundled shots by the preset's task, so a day reads as what it says —
 * the meal under Eat clean, a book under Read. */
const SHOTS: Record<string, ImageSourcePropType[]> = {
  h1: [
    require('../assets/challenges/selfera/grocery-cart.jpg'),
    require('../assets/wall/eat/berry-watermelon-plate.jpg'),
    require('../assets/wall/eat/spinach-eggs-avocado-toast.jpg'),
    require('../assets/recipes/apricot-salad.jpg'),
    require('../assets/recipes/avo-toast.jpg'),
    require('../assets/recipes/fig-oatmeal.jpg'),
    require('../assets/challenges/hard/grocery-basket.jpg'),
    require('../assets/tasks/patio-sandwiches-iced-coffee.jpg'),
    require('../assets/challenges/selfera/sunset-table.jpg'),
  ],
  h2: [
    require('../assets/challenges/medium/infused-water.jpg'),
    require('../assets/feed/posts/post-workout-smoothie.jpg'),
    require('../assets/tasks/timed-water-bottle-walk.jpg'),
    require('../assets/challenges/medium/guasha-ice-bowl.jpg'),
  ],
  h3: [
    require('../assets/feed/posts/canal-dog-walk.jpg'),
    require('../assets/feed/posts/mountain-hike.jpg'),
    require('../assets/challenges/soft/sunset-walk.jpg'),
    require('../assets/challenges/medium/outdoor-run.jpg'),
    require('../assets/challenges/selfera/terrace-treadmill.jpg'),
  ],
  h4: [
    require('../assets/challenges/selfera/gym-floor-selfie.jpg'),
    require('../assets/challenges/hard/mirror-selfie.jpg'),
    require('../assets/challenges/hard/dumbbells-overhead.jpg'),
    require('../assets/wall/workouts/treadmill-incline-walk.jpg'),
    require('../assets/challenges/soft/poolside-stretch.jpg'),
  ],
  h5: [
    require('../assets/challenges/medium/book-in-bed.jpg'),
    require('../assets/challenges/soft/evening-reading.jpg'),
    require('../assets/feed/posts/park-bench-reading.jpg'),
    require('../assets/feed/posts/studying-in-bed.jpg'),
    require('../assets/challenges/hard/study-desk.jpg'),
  ],
};

/** A shot for task `taskId`, dealt so neighbouring days and people differ. */
const shot = (taskId: string, n: number) => {
  const pool = SHOTS[taskId] ?? SHOTS.h1;
  return pool[n % pool.length];
};

/** "07:40" on today's clock — the form a real completion's stamp takes. */
const at = (hour: number, minute: number) => {
  const date = startOfToday();
  date.setHours(hour, minute);
  return timeStamp(date);
};

const CAPTIONS = [
  'Legs are toast but the sunset was worth it',
  'Meal prep Sunday paid off all week',
  'Raining, walked anyway. Proud of me',
  'Finished the book I started on day 1!!',
  'Gym at 6am is a personality now',
  'Water tastes better with lemon, change my mind',
  'Hardest day so far. Still did it.',
  'Slow morning, strong evening',
];

/** One person's tasks for a day: the first `done` of them shot. */
function dayTasks(done: number, seed: number, idPrefix: string): Person['tasks'] {
  return demoChallenge().tasks.map((task, i) =>
    i < done
      ? {
          label: task.label,
          done: true,
          time: at(7 + ((i * 3 + seed) % 13), (seed * 7 + i * 11) % 60),
          photo: shot(task.id, seed + i * 2),
          completionId: `${idPrefix}-${i}`,
        }
      : { label: task.label, done: false },
  );
}

// -- you --------------------------------------------------------------------

/** Your own run: every earlier day shot but one, today two tasks in — so
 * Community is open and your day is still in progress. */
export function demoProgress(): Progress {
  const progress: Progress = {};
  const tasks = demoChallenge().tasks;
  for (let day = 1; day <= DEMO_DAY; day += 1) {
    if (day === MISSED_DAY) continue;
    const done = day === DEMO_DAY ? 2 : tasks.length;
    progress[day] = Object.fromEntries(
      tasks.slice(0, done).map((task, i) => [
        task.id,
        {
          done: true,
          time: at(7 + i * 3, (day * 13) % 60),
          photo: shot(task.id, day + i),
          photoSeed: null,
        },
      ]),
    );
  }
  return progress;
}

export function demoCaptions(): Record<number, string> {
  const captions: Record<number, string> = {};
  for (let day = 1; day < DEMO_DAY; day += 2) captions[day] = CAPTIONS[day % CAPTIONS.length];
  return captions;
}

// -- everyone else ----------------------------------------------------------

interface Cast {
  name: string;
  handle: string;
  /** Tasks done today, out of the era's five. */
  done: number;
  bio: string;
  avatar?: ImageSourcePropType;
}

const FRIENDS: Cast[] = [
  { name: 'Mia', handle: 'mia.moves', done: 5, bio: 'Pilates girl, coffee first', avatar: require('../assets/challenges/selfera/gym-floor-selfie.jpg') },
  { name: 'Sofia', handle: 'sofiaruns', done: 5, bio: 'Half marathon in May' },
  { name: 'Lena', handle: 'lena.reads', done: 5, bio: 'Books > people' },
  { name: 'Ava', handle: 'avaeats', done: 3, bio: 'Cooking my way through summer' },
  { name: 'Nora', handle: 'nora.k', done: 1, bio: 'Day by day' },
  { name: 'Zoe', handle: 'zoe_lifts', done: 4, bio: 'Heavy things, soft heart', avatar: require('../assets/challenges/hard/mirror-selfie.jpg') },
];

const MEMBERS: Cast[] = [
  { name: 'Chloe', handle: 'chloe.daily', done: 5, bio: 'Second era, first finish?' },
  { name: 'Isla', handle: 'isla.outside', done: 5, bio: 'Hikes and smoothies' },
  { name: 'Hana', handle: 'hana.h', done: 5, bio: 'Morning person in training' },
  { name: 'Maya', handle: 'mayawalks', done: 5, bio: '10k steps, every day' },
  { name: 'Ella', handle: 'ella.green', done: 5, bio: 'Plants and plates' },
  { name: 'Ruby', handle: 'ruby.r', done: 2, bio: 'Back on it' },
  { name: 'Lily', handle: 'lilystudies', done: 3, bio: 'Med school + this, send help' },
  { name: 'Grace', handle: 'grace.moves', done: 0, bio: 'Starting slow' },
];

/** One of the cast as a person on today's round. */
function person(cast: Cast, n: number, isFriend: boolean): Person {
  const id = `${FAKE}${cast.handle}`;
  const tasks = dayTasks(cast.done, n * 3 + 1, id);
  return {
    id,
    name: cast.name,
    handle: `@${cast.handle}`,
    avatar: cast.avatar ?? `demo-${cast.handle}`,
    day: DEMO_DAY,
    bio: cast.bio,
    friendCount: 12 + n * 7,
    livesLeft: 3 - (n % 2),
    tasks,
    membershipId: `${id}-run`,
    challengeId: demoChallenge().id,
    challengeName: demoChallenge().name,
    isFriend,
    // A spread of shared friends across the members, none for some, so the
    // card's both lines get seen.
    mutualCount: isFriend ? undefined : n % 4,
    caption: cast.done === tasks.length ? CAPTIONS[n % CAPTIONS.length] : undefined,
  };
}

export const demoFriends = (): Person[] => FRIENDS.map((cast, n) => person(cast, n, true));
export const demoMembers = (): Person[] => MEMBERS.map((cast, n) => person(cast, n + FRIENDS.length, false));

/** Everyone on the round, you included. */
export const DEMO_ROUND_SIZE = 1 + FRIENDS.length + MEMBERS.length + 234;

/** Someone's whole page: every earlier day shot in full, today as it is. */
export function demoPage(who: Person): PersonPage {
  const n = who.id.length;
  const days: DayRecord[] = [{ day: DEMO_DAY, caption: who.caption, tasks: who.tasks }];
  for (let day = DEMO_DAY - 1; day >= 1; day -= 1) {
    days.push({
      day,
      caption: day % 3 === 0 ? CAPTIONS[(day + n) % CAPTIONS.length] : undefined,
      tasks: dayTasks(5, day + n, `${who.id}-d${day}`),
    });
  }
  const challenge = demoChallenge();
  return {
    person: who,
    days,
    pastRuns: [],
    challenge: { id: challenge.id, name: challenge.name, joined: challenge.joined },
    startDate: demoStartDate(),
    totalDays: challenge.defaultDays,
    friendCount: who.friendCount ?? 0,
    lives: { left: who.livesLeft ?? 3, total: 3 },
  };
}

/** Hearts and comment counts for every post the cast has, so the feed
 * isn't a page of zeros. */
export function demoStats(people: readonly Person[]): Record<string, PostStats> {
  const stats: Record<string, PostStats> = {};
  people.forEach((who, n) => {
    for (let day = 1; day <= DEMO_DAY; day += 1) {
      stats[postKey(who.membershipId!, day)] = {
        reactions: { [LOVE]: 3 + ((n * 5 + day * 3) % 40) },
        mine: (n + day) % 4 === 0 ? LOVE : null,
        comments: threadSize(DEMO_THREAD),
      };
    }
  });
  for (let day = 1; day <= DEMO_DAY; day += 1) {
    stats[postKey(DEMO_MEMBERSHIP, day)] = {
      reactions: { [LOVE]: 8 + day },
      mine: null,
      comments: threadSize(DEMO_THREAD),
    };
  }
  return stats;
}

/** Every comment in that thread, replies included — what a post's count
 * reads. */
const threadSize = (thread: readonly CommentEntry[]): number =>
  thread.reduce((sum, c) => sum + 1 + threadSize(c.replies ?? []), 0);

/** The thread every made-up post opens on. */
export const DEMO_THREAD: CommentEntry[] = [
  {
    id: `${FAKE}c1`,
    author: 'sofiaruns',
    avatar: 'demo-sofiaruns',
    text: 'Obsessed with this 😍',
    replies: [{ id: `${FAKE}c2`, author: 'mia.moves', avatar: 'demo-mia.moves', text: 'Same!!' }],
  },
  { id: `${FAKE}c3`, author: 'lena.reads', avatar: 'demo-lena.reads', text: 'Day 12 already, let’s gooo' },
];
