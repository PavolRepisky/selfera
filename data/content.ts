import type { ImageSourcePropType } from '@/lib/imageSource';

import type { AvatarSource } from '@/components/Avatar';
import type { CommentEntry } from '@/components/CommentsSheet';
import type { PhotoSource } from '@/components/PhotoStrip';

// ---------------------------------------------------------------------------
// People, posts and challenge listings — the shapes the screens draw. The
// people and listings themselves come from the server (lib/backend).
// ---------------------------------------------------------------------------

export interface Friend {
  id: string;
  name: string;
  /** Shown under their name on their profile, the way `profile.handle` is
   * shown under yours. */
  handle: string;
  /** Bundled profile photo, or a seed for the drawn stand-in. */
  avatar: AvatarSource;
  day: number;
  bio: string | null;
  /**
   * How long ago today's post went up — same static-string convention as
   * `DiscoverSection.metaTime`, since there is no backend clock to read one
   * from.
   */
  postedAgo?: string;
  friendCount?: number;
  livesLeft?: number;
  tasks: readonly {
    label: string;
    done: boolean;
    time?: string;
    /** Proof photo for a done task. */
    photo?: ImageSourcePropType;
    /** The same shot at grid size, where a screen draws it small. */
    thumb?: ImageSourcePropType;
    /** Stand-in seed, used whenever a done task has no bundled photo yet. */
    photoSeed?: string;
    /** The photo's own record on the server — what "seen" is kept against. */
    completionId?: string;
  }[];
  /**
   * Set for a real account: the membership their days belong to (a post is
   * one membership's day), and the challenge it's in — named on their posts
   * and opened from their profile.
   */
  membershipId?: string;
  challengeId?: string;
  challengeName?: string;
  /** Where you stand with them. */
  isFriend?: boolean;
  requestSent?: boolean;
  requestReceived?: boolean;
  /** How many of your friends are friends of theirs — set for the Members
   * tab, where they're a stranger and that's what says who they are. */
  mutualCount?: number;
  /**
   * Other people already talking under this post — everyone here is someone
   * else in `PEOPLE`, the same closed roster the feed itself draws from,
   * rather than a stranger with no profile to open. `useAppState`'s own
   * `friendComments` appends the signed-in account's replies after these
   * rather than replacing them.
   */
  comments?: readonly CommentEntry[];
  /** What they wrote under today's post, in their own words — the post's
   * caption. A day can go without one. */
  caption?: string;
  /** When today's finished day goes up as a post, in epoch ms — until then
   * it's still counting down and they show as still going. None: up as
   * soon as it's finished. */
  postsAt?: number;
  /**
   * Earlier days, shown as extra tiles in their profile grid so it always
   * has more than one post to browse — `day`/`tasks` above stay what the
   * Community feed's own single card reads off. Not seeded with comments of
   * their own: whatever's said on one is only ever what gets added live.
   */
  pastPosts?: readonly {
    day: number;
    /** That day's caption, as `caption` is today's. */
    caption?: string;
    tasks: readonly {
      label: string;
      done: boolean;
      time?: string;
      photo?: ImageSourcePropType;
      photoSeed?: string;
    }[];
  }[];
}

/** One person in a finished round's standings. */
export interface Standing {
  name: string;
  /** Their account, so a row opens their profile. */
  personId?: string;
  avatar?: AvatarSource;
  /** You — told apart so your own row leads and reads "You". */
  isMe?: boolean;
}

/**
 * Everyone who ended a round on the same longest streak — the days in a
 * row they kept up. They share a place: a tie is one spot on the podium and
 * one rank in the list, not an order someone had to pick.
 */
export interface StreakGroup {
  days: number;
  /** How many share it; more than are named once it runs long. */
  count: number;
  /** Whether they made it to the last day, a life or two spent or not. */
  finished: boolean;
  named: readonly Standing[];
}

export interface DiscoverSection {
  id: string;
  title: string;
  /** The four tiles standing for the challenge wherever it appears. */
  photos: readonly PhotoSource[];
  members: number;
  /**
   * Day 1 of this round, ISO `YYYY-MM-DD`. Everyone in a round starts on it
   * together and joining closes once it has passed, so it is what splits the
   * preview into "starts in N days" and "already running". The end date is
   * this plus the matching `Challenge.defaultDays` — never stored twice.
   */
  startDate: string;
  /**
   * How many of `members` are still in the running — no day missed past
   * what the rules allow. Only means anything once the round has started,
   * so it is left off a round that hasn't.
   */
  stillGoing?: number;
  /** The server's round this listing shows — what joining signs up to. */
  roundId: string;
  /** Who built the challenge, opened from the page's "by" line. Null for the
   * presets the app ships with. */
  creator: { id: string; name: string; handle: string; avatar: AvatarSource } | null;
  /** Your friends in this round, named on its cover and page. */
  friendsIn: readonly { id: string; name: string; avatar: AvatarSource }[];
  /** A few faces of whoever's in it, for the page's "who's in" stack. */
  faces: readonly { id: string; avatar: AvatarSource }[];
  /**
   * How a round that is over ended: how many of `members` reached the last
   * day, and the standings by longest streak, best first. Only a finished
   * round has them.
   */
  results?: {
    finished: number;
    groups: readonly StreakGroup[];
  };
}

/**
 * The photos each preset challenge ships with, by its key — the four tiles
 * standing for it wherever it appears. Everything else about a round —
 * its dates, who's in it, who started it, how it ended — comes from the
 * server.
 */
export const PRESET_PHOTOS: Readonly<Record<string, readonly PhotoSource[]>> = {
  'selfera': [
    require('../assets/challenges/selfera/gym-floor-selfie.jpg'),
    require('../assets/challenges/selfera/grocery-cart.jpg'),
    require('../assets/challenges/selfera/terrace-treadmill.jpg'),
    require('../assets/challenges/selfera/sunset-table.jpg'),
  ],
  hard: [
    require('../assets/challenges/hard/mirror-selfie.jpg'),
    require('../assets/challenges/hard/dumbbells-overhead.jpg'),
    require('../assets/challenges/hard/grocery-basket.jpg'),
    require('../assets/challenges/hard/study-desk.jpg'),
  ],
  medium: [
    require('../assets/challenges/medium/outdoor-run.jpg'),
    require('../assets/challenges/medium/infused-water.jpg'),
    require('../assets/challenges/medium/guasha-ice-bowl.jpg'),
    require('../assets/challenges/medium/book-in-bed.jpg'),
  ],
  soft: [
    require('../assets/challenges/soft/early-alarm.jpg'),
    require('../assets/challenges/soft/sunset-walk.jpg'),
    require('../assets/challenges/soft/poolside-stretch.jpg'),
    require('../assets/challenges/soft/evening-reading.jpg'),
  ],
  steps: [
    require('../assets/feed/posts/canal-dog-walk.jpg'),
    require('../assets/feed/posts/mountain-hike.jpg'),
    require('../assets/tasks/timed-water-bottle-walk.jpg'),
    require('../assets/wall/workouts/treadmill-incline-walk.jpg'),
  ],
  pages: [
    require('../assets/feed/posts/park-bench-reading.jpg'),
    require('../assets/tasks/patio-sandwiches-iced-coffee.jpg'),
    require('../assets/recipes/fig-oatmeal.jpg'),
    require('../assets/wall/skincare/skincare-shelf.jpg'),
  ],
  rainbow: [
    require('../assets/wall/eat/berry-watermelon-plate.jpg'),
    require('../assets/wall/eat/spinach-eggs-avocado-toast.jpg'),
    require('../assets/recipes/apricot-salad.jpg'),
    require('../assets/feed/posts/post-workout-smoothie.jpg'),
  ],
  study: [
    require('../assets/feed/posts/studying-in-bed.jpg'),
    require('../assets/challenges/hard/study-desk.jpg'),
    require('../assets/recipes/avo-toast.jpg'),
    require('../assets/challenges/soft/evening-reading.jpg'),
  ],
  'summer-glow': [
    require('../assets/challenges/soft/sunset-walk.jpg'),
    require('../assets/challenges/medium/infused-water.jpg'),
    require('../assets/challenges/soft/poolside-stretch.jpg'),
    require('../assets/challenges/soft/evening-reading.jpg'),
  ],
};

/**
 * Anything without photos of its own — a challenge someone built before
 * picking any — takes the opening shot from each of the four original
 * presets. Four sets, four tiles, and the row reads as every challenge at
 * once.
 */
const CUSTOM_PHOTOS: readonly PhotoSource[] = ['selfera', 'hard', 'medium', 'soft'].map(
  (key) => PRESET_PHOTOS[key][0],
);

/**
 * The four tiles that stand for a challenge anywhere it is shown — the picker,
 * and its own screen once it has been chosen. Anything without a set of its
 * own falls back to the custom row, which is every challenge at once.
 */
export function challengeStrip(id: string): readonly PhotoSource[] {
  return PRESET_PHOTOS[id] ?? CUSTOM_PHOTOS;
}

/** The one reaction a post or a story takes: a heart. */
export const LOVE = '❤️';
