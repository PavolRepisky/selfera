/**
 * Where a challenge round stands today. Every round has one Day 1 that
 * everyone in it shares, so this is the same for whoever is looking — the
 * Discover page and a challenge's own preview both read it from here.
 */

export const DAY_MS = 86_400_000;

/**
 * How long a finished day waits before it goes up on Community — the
 * server's `post_countdown`. Until then its photos can be reshot or taken
 * out and its caption written; after, the post is fixed.
 */
export const POST_COUNTDOWN_MS = 90_000;

/**
 * Whether a finished day is up, given when its countdown ends. A finished
 * day with no countdown — one from before countdowns, or a made-up one —
 * counts as up.
 */
export function isPosted(postsAt: number | null | undefined, now = Date.now()): boolean {
  return postsAt == null || postsAt <= now;
}

/**
 * An ISO day read as local midnight. `new Date('2026-10-01')` is midnight in
 * UTC, which west of Greenwich is still the evening before — and a start date
 * a day early says the round has begun when it hasn't.
 */
export function localDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Midnight this morning, local time. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export type RoundState =
  | { kind: 'upcoming'; daysUntil: number }
  | { kind: 'running'; day: number }
  | { kind: 'ended' };

/**
 * Whether a round can still be joined: up to and including Day 1 itself,
 * shutting at its midnight, as `join_round` on the server has it. An era
 * made today can start today and still take its first members.
 */
export function joinOpen(start: Date): boolean {
  return startOfToday().getTime() <= start.getTime();
}

export function roundState(start: Date, totalDays: number): RoundState {
  const offset = Math.round((startOfToday().getTime() - start.getTime()) / DAY_MS);
  if (offset < 0) return { kind: 'upcoming', daysUntil: -offset };
  if (offset >= totalDays) return { kind: 'ended' };
  return { kind: 'running', day: offset + 1 };
}
