import type { ImageSourcePropType } from '@/lib/imageSource';

export interface ChallengeTask {
  id: string;
  label: string;
  /** One line on how to do it, so everyone's photo proves the same thing —
   * written on the create form; the presets go without. */
  note?: string;
}

/** The five topic filters on search, opened from Discover. */
export type ChallengeCategory = 'Fitness' | 'Health' | 'Mindset' | 'Lifestyle' | 'Study';

export interface Challenge {
  id: string;
  name: string;
  /** Bottom-left stamp on the sticker card. */
  stamp: string;
  /** One or two sentences: what the challenge is and who it's for. */
  description: string;
  /**
   * Which of the browse filters this challenge sits under. A custom
   * challenge carries the topic picked on the create form, or none.
   */
  category?: ChallengeCategory;
  joined: number;
  photoSeeds: readonly string[];
  /**
   * Real photos a user picked while creating their own challenge, standing in
   * for `photoSeeds` wherever a challenge's strip is drawn. The presets never
   * set this — they only ever have seeds.
   */
  photos?: readonly ImageSourcePropType[];
  tasks: readonly ChallengeTask[];
  defaultDays: number;
  /**
   * Day 1, ISO `YYYY-MM-DD`, picked on the create form so friends have until
   * then to join. Only a custom challenge carries one here — the presets'
   * rounds keep theirs on `DiscoverSection`.
   */
  startDate?: string;
  /** Days anyone in it may miss before their run ends, set on the create
   * form. Unset, the app-wide allowance holds. */
  lives?: number;
}

const task = (id: string, label: string, note?: string): ChallengeTask =>
  note ? { id, label, note } : { id, label };

export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'selfera',
    name: 'Get Fit for Summer',
    stamp: 'Selfera',
    description:
      'A friendlier 75-day reset: clean eating, daily movement, and no alcohol — built for getting summer-ready without burning out.',
    category: 'Fitness',
    joined: 248,
    photoSeeds: ['selfera-a', 'selfera-b', 'selfera-c', 'selfera-d'],
    defaultDays: 75,
    tasks: [
      task('h1', 'Eat clean', 'Whole foods, nothing fried or processed.'),
      task('h2', 'Drink only water', 'No soda, juice or alcohol — tea and coffee are fine.'),
      task('h3', 'Walk 10k steps', 'Photo your step count before bed.'),
      task('h4', 'Work out 45 min', 'Gym, class, run or ride — any sweat counts.'),
      task('h5', 'Read 10 pages', 'A real book, not a screen.'),
    ],
  },
  {
    id: 'hard',
    name: 'No Excuses Era',
    stamp: '75 Hard',
    description:
      '75 days, zero cheat days. Two workouts, a strict diet, and a daily progress photo — the original test of mental toughness.',
    category: 'Health',
    joined: 163,
    photoSeeds: ['hard-a', 'hard-b', 'hard-c', 'hard-d'],
    defaultDays: 75,
    tasks: [
      task('d1', 'Strict diet', 'Pick one and stick to it. No cheat meals.'),
      task('d2', 'Drink water', 'A full gallon, spread across the day.'),
      task('d3', 'Two workouts, one outside', '45 minutes each, whatever the weather.'),
      task('d4', 'Read 10 pages', 'Non-fiction, a real book.'),
      task('d5', 'Progress photo', 'Same spot, same light, every day.'),
    ],
  },
  {
    id: 'medium',
    name: 'Balanced Reset',
    stamp: '75 Medium',
    description:
      '75 days of steady, sustainable habits: one flexible meal a week, daily movement, and a nightly read.',
    category: 'Mindset',
    joined: 104,
    photoSeeds: ['med-a', 'med-b', 'med-c', 'med-d'],
    defaultDays: 75,
    tasks: [
      task('m1', 'Eat well', 'No junk food. One flexible meal a week.'),
      task('m2', 'Drink 3L water', 'Photo your bottle any time of day.'),
      task('m3', 'Work out 45 min', 'Any movement counts — a walk, a class, a run.'),
      task('m4', 'Read 10 pages', 'A real book, not a screen.'),
      task('m5', 'Progress photo', 'Same spot, same light, every day.'),
    ],
  },
  {
    id: 'soft',
    name: 'Fresh Start',
    stamp: '75 Soft',
    description:
      'A gentler 75 days: clean eating with a little room to breathe, daily walks, and time to unwind with a podcast.',
    category: 'Lifestyle',
    joined: 131,
    photoSeeds: ['soft-a', 'soft-b', 'soft-c', 'soft-d'],
    defaultDays: 75,
    tasks: [
      task('s1', 'Eat mostly clean', 'Good food most of the time, a treat now and then.'),
      task('s2', 'Drink water', 'Photo your bottle any time of day.'),
      task('s3', 'Walk 10k steps', 'Photo your step count before bed.'),
      task('s4', 'Listen to a podcast', 'Something that teaches you a thing or two.'),
    ],
  },
  {
    id: 'steps',
    name: '10k Steps a Day',
    stamp: '10k Steps',
    description:
      'Thirty days of getting your steps in — one walk a day, any route, any pace, as long as it adds up to ten thousand.',
    category: 'Fitness',
    joined: 212,
    photoSeeds: ['steps-a', 'steps-b', 'steps-c', 'steps-d'],
    defaultDays: 30,
    tasks: [task('w1', 'Walk 10k steps', 'Photo your step count before bed.')],
  },
  {
    id: 'pages',
    name: 'Morning Pages',
    stamp: 'Morning Pages',
    description:
      'Three weeks of starting slow: three handwritten pages before anything else, then a few pages of a book.',
    category: 'Mindset',
    joined: 48,
    photoSeeds: ['pages-a', 'pages-b', 'pages-c', 'pages-d'],
    defaultDays: 21,
    tasks: [
      task('p1', 'Write three pages', 'By hand, first thing, whatever comes out.'),
      task('p2', 'Read 10 pages', 'A real book, not a screen.'),
    ],
  },
  {
    id: 'rainbow',
    name: 'Eat the Rainbow',
    stamp: 'Eat the Rainbow',
    description:
      'A month of colourful plates: fruit or veg at every meal, a proper breakfast, and enough water to go with it.',
    category: 'Health',
    joined: 96,
    photoSeeds: ['rainbow-a', 'rainbow-b', 'rainbow-c', 'rainbow-d'],
    defaultDays: 30,
    tasks: [
      task('e1', 'Fruit or veg at every meal', 'The more colours on the plate, the better.'),
      task('e2', 'Eat a proper breakfast', 'Sat down, not grabbed on the way out.'),
      task('e3', 'Drink 2L water', 'Photo your bottle any time of day.'),
    ],
  },
  {
    id: 'study',
    name: 'Study Streak',
    stamp: 'Study Streak',
    description:
      'Thirty days of showing up to your desk: two focused hours, your notes reviewed, and a chapter read.',
    category: 'Study',
    joined: 74,
    photoSeeds: ['study-a', 'study-b', 'study-c', 'study-d'],
    defaultDays: 30,
    tasks: [
      task('t1', 'Two focus hours', 'Phone away, one subject at a time.'),
      task('t2', 'Review your notes', 'Go back over what you covered today.'),
      task('t3', 'Read a chapter', 'From a course book or anything you are studying.'),
    ],
  },
  {
    id: 'summer-glow',
    name: 'Summer Glow',
    stamp: 'Summer Glow',
    description:
      'A 30-day August reset: water before anything else, a walk in the evening light, and a proper wind-down before bed.',
    category: 'Health',
    joined: 132,
    photoSeeds: ['glow-a', 'glow-b', 'glow-c', 'glow-d'],
    defaultDays: 30,
    lives: 2,
    tasks: [
      task('g1', 'Drink 2L water', 'Photo your bottle any time of day.'),
      task('g2', 'Evening walk', 'Out after dinner, at least 20 minutes.'),
      task('g3', 'Stretch before bed', 'Ten minutes on the floor, phone out of reach.'),
    ],
  },
];

export function challengeById(id: string): Challenge {
  return CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0];
}
