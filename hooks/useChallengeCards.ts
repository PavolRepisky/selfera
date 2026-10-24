import { useEffect, useMemo, useRef, useState } from 'react';

import type { PhotoSource } from '@/components/PhotoStrip';
import { CHALLENGES, type Challenge, type ChallengeCategory } from '@/data/challenges';
import { challengeStrip, type DiscoverSection } from '@/data/content';
import { useApp } from '@/hooks/useAppState';
import { fetchResults, type Listing } from '@/lib/backend/catalog';
import { localDay, roundState } from '@/lib/round';

/**
 * Where a round stands, because what someone is looking for depends on it: a
 * round they can still join, one under way, or one that's over. Starting soon
 * comes first — it's the only kind anyone can join.
 */
export type Phase = 'upcoming' | 'active' | 'finished';

export const PHASES: readonly { key: Phase; label: string }[] = [
  { key: 'upcoming', label: 'Starting soon' },
  { key: 'active', label: 'Under way' },
  { key: 'finished', label: 'Finished' },
];

/** Every category, in the order Browse lays its tiles out. */
export const CATEGORIES: readonly ChallengeCategory[] = [
  'Fitness',
  'Health',
  'Mindset',
  'Lifestyle',
  'Study',
];

/** A topic's one line under its name on the topic page — what kind of days
 * a challenge filed there asks for, so the photo isn't left to explain it. */
export const CATEGORY_BLURBS: Record<ChallengeCategory, string> = {
  Fitness: 'Workouts, steps and moving every day',
  Health: 'Eating well, water and sleep',
  Mindset: 'Journaling, reading and quiet time',
  Lifestyle: 'Routines, rest and small daily habits',
  Study: 'Reading, revision and focus time',
};

/**
 * The lengths people choose between, as the search page offers them:
 * nobody weighs 28 days against 30, only a few weeks against a month
 * against the full 75.
 */
export type LengthBucket = 'weeks' | 'month' | 'long';

export const LENGTHS: readonly { key: LengthBucket; label: string }[] = [
  { key: 'weeks', label: '1–3 weeks' },
  { key: 'month', label: '30 days' },
  { key: 'long', label: '75 days' },
];

export function lengthBucket(days: number): LengthBucket {
  return days <= 21 ? 'weeks' : days <= 45 ? 'month' : 'long';
}

/** One challenge as the browse screens show it — the one you're on and every
 * listed round in the same shape, so nothing marks yours out as a different
 * kind of thing. */
export interface ChallengeCard {
  id: string;
  title: string;
  photos: readonly PhotoSource[];
  category?: ChallengeCategory;
  tasksCount: number;
  /** The daily tasks' labels, so a search for "walk" finds the challenge
   * that has you walking even when its name doesn't say so. */
  tasks: readonly string[];
  /** The challenge you're on — shown as yours rather than as one to join. */
  mine: boolean;
  /** One you built yourself — editable until its Day 1. */
  createdByMe: boolean;
  /** Undefined for a custom challenge with no listing of its own — the
   * members count drops out rather than showing a number nothing backs. */
  members?: number;
  /** Of `members`, how many are still in the running — only once it's under
   * way, and only where the listing counts it. */
  stillGoing?: number;
  /** How many days the challenge runs. */
  days: number;
  /** Your friends in its round — the faces and names on a cover. */
  friendsIn: DiscoverSection['friendsIn'];
  /** Day 1 of the round; undefined for a custom challenge, which has no
   * shared round to count from. */
  start?: Date;
  /** "Starts in 4 days", "Day 25 of 75", "Finished" — or "N days left" on a
   * custom challenge of your own. */
  statusLabel: string;
  /** The shortest form of the same, for the end of a list row. */
  shortStatus: string;
  phase: Phase;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function roundStatus(
  start: Date,
  days: number,
): Pick<ChallengeCard, 'phase' | 'statusLabel' | 'shortStatus'> {
  const state = roundState(start, days);
  if (state.kind === 'upcoming') {
    return {
      phase: 'upcoming',
      statusLabel:
        state.daysUntil === 1 ? 'Starts tomorrow' : `Starts in ${state.daysUntil} days`,
      shortStatus: `${MONTHS[start.getMonth()]} ${start.getDate()}`,
    };
  }
  // Day 1 is still open to join, so it sits with the ones starting soon —
  // the browse lists and Discover offer it until midnight.
  if (state.kind === 'running' && state.day === 1) {
    return { phase: 'upcoming', statusLabel: 'Started today', shortStatus: 'Today' };
  }
  if (state.kind === 'running') {
    return {
      phase: 'active',
      statusLabel: `Day ${state.day} of ${days}`,
      shortStatus: `Day ${state.day}`,
    };
  }
  return { phase: 'finished', statusLabel: 'Finished', shortStatus: 'Finished' };
}

/** One listing as a card. */
function toCard(listing: Listing, mine: boolean): ChallengeCard {
  const { challenge, section } = listing;
  const start = localDay(section.startDate);
  const days = challenge.defaultDays;
  return {
    id: listing.key,
    title: challenge.name,
    photos: section.photos,
    category: challenge.category,
    tasksCount: challenge.tasks.length,
    tasks: challenge.tasks.map((t) => t.label),
    mine,
    createdByMe: listing.createdByMe,
    members: section.members,
    stillGoing: section.stillGoing,
    days,
    start,
    friendsIn: section.friendsIn,
    ...roundStatus(start, days),
  };
}

/**
 * Every challenge the browse screens list, each by the round that matters to
 * you: the one you're on marked yours, everyone else's to join or watch.
 * Ones you built are listed like any other — under their topic, and among
 * the rounds starting soon, since you join your own the way anyone does —
 * as well as under Search's Created by you.
 */
export function useChallengeCards(): readonly ChallengeCard[] {
  const { catalog, challenge, inChallenge } = useApp();
  return useMemo<ChallengeCard[]>(() => {
    const isMine = (l: Listing) => inChallenge && l.key === challenge.id;
    const mine = catalog.filter(isMine).map((l) => toCard(l, true));
    const listed = catalog.filter((l) => !isMine(l)).map((l) => toCard(l, false));
    return [...mine, ...listed];
  }, [catalog, challenge.id, inChallenge]);
}

/**
 * The challenges you've built yourself, newest first, each told by its own
 * round — what Search's Created by you lists, and what can still be edited
 * until Day 1.
 */
export function useCreatedChallengeCards(): readonly ChallengeCard[] {
  const { catalog, challenge, inChallenge } = useApp();
  return useMemo<ChallengeCard[]>(
    () =>
      catalog
        .filter((l) => l.createdByMe)
        .reverse()
        .map((l) => toCard(l, inChallenge && l.key === challenge.id)),
    [catalog, challenge.id, inChallenge],
  );
}

/** What a challenge page shows before the catalog has it — a link to one
 * that's gone, say. Never mistaken for anything you're in. */
const NOWHERE: DiscoverSection = {
  id: CHALLENGES[0].id,
  roundId: '',
  title: CHALLENGES[0].name,
  photos: challengeStrip(CHALLENGES[0].id),
  members: 0,
  startDate: '1970-01-01',
  creator: null,
  friendsIn: [],
  faces: [],
};

/**
 * A challenge's page by its key: the round that matters to you, told in the
 * shape the challenge page and Join draw. `createdByMe` is what puts Edit and
 * Delete on it.
 */
export function useChallengeListing(id: string): {
  section: DiscoverSection;
  challenge: Challenge;
  createdByMe: boolean;
} {
  const { catalog } = useApp();
  // The last version seen under this key: deleting one pops its page, and
  // for the length of that slide it should still be the challenge you
  // deleted, not whatever an unknown key falls back to.
  const last = useRef<Listing | undefined>(undefined);
  return useMemo(() => {
    const found = catalog.find((l) => l.key === id) ?? (last.current?.key === id ? last.current : undefined);
    last.current = found;
    if (!found) return { section: NOWHERE, challenge: CHALLENGES[0], createdByMe: false };
    return { section: found.section, challenge: found.challenge, createdByMe: found.createdByMe };
  }, [id, catalog]);
}

/** How a finished round ended, loaded when its page opens. */
export function useRoundResults(roundId: string): DiscoverSection['results'] {
  const [results, setResults] = useState<DiscoverSection['results']>(undefined);
  useEffect(() => {
    if (!roundId) return;
    let live = true;
    fetchResults(roundId)
      .then((r) => live && setResults(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [roundId]);
  return results;
}

const terms = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** Each word of the query has to appear somewhere in the name, the topic or
 * one of the tasks, in any order — "excuses no" still finds "No Excuses
 * Challenge", and "walk" finds every challenge with a walk in its day. */
export function matchesQuery(card: ChallengeCard, query: string): boolean {
  const haystack = [card.title, card.category ?? '', ...card.tasks].join(' ').toLowerCase();
  return terms(query).every((term) => haystack.includes(term));
}

/**
 * The task a search found a challenge by, when its name alone wouldn't have
 * — shown under the row, so a result for "walk" called "Fresh Start" says
 * why it's there.
 */
export function matchedTask(card: ChallengeCard, query: string): string | undefined {
  const words = terms(query);
  if (words.length === 0) return undefined;
  const title = card.title.toLowerCase();
  if (words.every((term) => title.includes(term))) return undefined;
  return card.tasks.find((task) => words.some((term) => task.toLowerCase().includes(term)));
}
