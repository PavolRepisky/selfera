import type { AvatarSource } from '@/components/Avatar';
import type { Challenge, ChallengeCategory } from '@/data/challenges';
import { challengeStrip, type DiscoverSection, type StreakGroup } from '@/data/content';
import type { Database } from '@/lib/database.types';
import { publicUrl } from '@/lib/backend/photos';
import { supabase } from '@/lib/supabase';
import { joinOpen, localDay, roundState } from '@/lib/round';

/**
 * Every challenge there is, as Discover, search, the topic pages
 * and a challenge's own page show it — read from the server, so a new round
 * shows up without the app changing.
 *
 * A challenge can run many rounds; each listing shows one, the one that
 * matters to you: the round you're in, else the next one you could still
 * join, else the one under way, else the last one finished. Its route key is
 * the challenge's own — a preset's short name ("selfera"), or a built one's id.
 */

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

export interface Listing {
  /** The route key: a preset's slug, or a built challenge's id. */
  key: string;
  /** The challenge's id on the server, whatever its key. */
  challengeId: string;
  challenge: Challenge;
  section: DiscoverSection;
  createdByMe: boolean;
  /** Where its own cover photos are kept, for editing and deleting. */
  photoPaths: readonly string[];
}

interface Result {
  data: unknown;
  error: { message: string } | null;
}
function must<R extends Result>(result: R): NonNullable<R['data']> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<R['data']>;
}
function maybe<R extends Result>(result: R): R['data'] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const face = (path: string | null | undefined): AvatarSource => (path ? { uri: publicUrl('avatars', path) } : null);

/** How many faces the page's "who's in" stack can use. */
const FACES = 4;

type RoundWithChallenge = Row<'rounds'> & {
  challenge: (Row<'challenges'> & { tasks: Row<'challenge_tasks'>[] }) | null;
};

/** The round a listing shows, by the rule above. */
function pick(rounds: readonly RoundWithChallenge[], mine: string | null): RoundWithChallenge {
  const own = rounds.find((r) => r.id === mine);
  if (own) return own;
  const state = (r: RoundWithChallenge) => roundState(localDay(r.start_date), r.days).kind;
  const byStart = [...rounds].sort((a, b) => a.start_date.localeCompare(b.start_date));
  return (
    byStart.find((r) => joinOpen(localDay(r.start_date))) ??
    [...byStart].reverse().find((r) => state(r) === 'running') ??
    byStart[byStart.length - 1]
  );
}

/** A challenge row as the app's own `Challenge`: a preset's tasks keep their
 * short keys ("h1"), so bundled photos and saved reminders still line up. */
export function toChallenge(row: Row<'challenges'>, tasks: readonly Row<'challenge_tasks'>[], round: Row<'rounds'>): Challenge {
  const key = row.slug ?? row.id;
  return {
    id: key,
    name: row.name,
    stamp: row.stamp,
    description: row.description,
    category: (row.category ?? undefined) as ChallengeCategory | undefined,
    joined: 0,
    photoSeeds: [],
    photos: row.photo_paths.length
      ? row.photo_paths.map((path) => ({ uri: publicUrl('challenge-photos', path) }))
      : undefined,
    tasks: [...tasks]
      .sort((a, b) => a.position - b.position)
      .map((t) => (t.note ? { id: t.key ?? t.id, label: t.label, note: t.note } : { id: t.key ?? t.id, label: t.label })),
    defaultDays: round.days,
    startDate: round.start_date,
    lives: row.lives,
  };
}

export async function fetchCatalog(): Promise<Listing[]> {
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  if (!me) return [];

  const [rounds, stats, mine, friendRows] = await Promise.all([
    supabase.from('rounds').select('*, challenge:challenges(*, tasks:challenge_tasks(*))').order('start_date'),
    supabase.from('round_stats').select('*'),
    supabase.from('memberships').select('round_id').eq('user_id', me).eq('status', 'active').maybeSingle(),
    supabase.from('friends').select('friend_id').eq('user_id', me),
  ]);
  const myRound = maybe(mine)?.round_id ?? null;
  const friendIds = new Set(must(friendRows).map((f) => f.friend_id));
  const statsByRound = new Map(must(stats).map((s) => [s.round_id, s]));

  const byChallenge = new Map<string, RoundWithChallenge[]>();
  for (const round of must(rounds) as RoundWithChallenge[]) {
    if (!round.challenge) continue;
    byChallenge.set(round.challenge_id, [...(byChallenge.get(round.challenge_id) ?? []), round]);
  }
  const shown = [...byChallenge.values()].map((list) => pick(list, myRound));
  if (!shown.length) return [];

  // Who's in each shown round: enough for its friends and a few faces.
  const memberRows = must(
    await supabase
      .from('memberships')
      .select('round_id, user_id')
      .in('round_id', shown.map((r) => r.id))
      .neq('status', 'left')
      .limit(2000),
  );
  const facesWanted = new Set<string>();
  const inRound = new Map<string, string[]>();
  for (const m of memberRows) {
    const list = inRound.get(m.round_id) ?? [];
    list.push(m.user_id);
    inRound.set(m.round_id, list);
  }
  for (const [, users] of inRound) {
    users.filter((u) => friendIds.has(u)).forEach((u) => facesWanted.add(u));
    users.slice(0, FACES).forEach((u) => facesWanted.add(u));
  }
  for (const r of shown) if (r.challenge?.creator_id) facesWanted.add(r.challenge.creator_id);
  const profiles = facesWanted.size
    ? must(await supabase.from('profiles').select('id, name, handle, avatar_path').in('id', [...facesWanted]))
    : [];
  const profileOf = new Map(profiles.map((p) => [p.id, p]));

  return shown.map((round): Listing => {
    const row = round.challenge!;
    const challenge = toChallenge(row, row.tasks ?? [], round);
    const roundStats = statsByRound.get(round.id);
    const running = roundState(localDay(round.start_date), round.days).kind === 'running';
    const users = inRound.get(round.id) ?? [];
    const creator = row.creator_id ? profileOf.get(row.creator_id) : undefined;
    const section: DiscoverSection = {
      id: challenge.id,
      roundId: round.id,
      title: row.name,
      photos: challenge.photos ?? challengeStrip(challenge.id),
      members: roundStats?.members ?? 0,
      startDate: round.start_date,
      stillGoing: running ? roundStats?.still_going ?? undefined : undefined,
      creator: creator
        ? { id: creator.id, name: creator.name || creator.handle, handle: `@${creator.handle}`, avatar: face(creator.avatar_path) }
        : null,
      friendsIn: users
        .filter((u) => friendIds.has(u))
        .flatMap((u) => {
          const p = profileOf.get(u);
          return p ? [{ id: p.id, name: p.name || p.handle, avatar: face(p.avatar_path) }] : [];
        }),
      faces: users.slice(0, FACES).map((u) => ({ id: u, avatar: face(profileOf.get(u)?.avatar_path) })),
    };
    return {
      key: challenge.id,
      challengeId: row.id,
      challenge,
      section,
      createdByMe: row.creator_id === me && !row.slug,
      photoPaths: row.photo_paths,
    };
  });
}

/**
 * How a round that's over ended: how many reached the last day, and everyone
 * by their longest run of full days, best first — finishers ahead of those
 * who ran out of lives, and people on the same run sharing a place.
 */
export async function fetchResults(roundId: string): Promise<NonNullable<DiscoverSection['results']>> {
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  const rows = must(await supabase.rpc('round_standings', { rid: roundId }));
  const profiles = rows.length
    ? must(await supabase.from('profiles').select('id, name, handle, avatar_path').in('id', rows.map((r) => r.user_id)))
    : [];
  const profileOf = new Map(profiles.map((p) => [p.id, p]));

  const groups = new Map<string, StreakGroup & { named: NonNullable<StreakGroup['named']>[number][] }>();
  for (const r of rows) {
    const finished = r.status === 'finished';
    const key = `${finished ? 1 : 0}:${r.longest_streak}`;
    const p = profileOf.get(r.user_id);
    const group = groups.get(key) ?? { days: r.longest_streak, count: 0, finished, named: [] };
    group.count += 1;
    group.named.push({
      name: r.user_id === me ? 'You' : p?.name || p?.handle || 'Someone',
      personId: r.user_id,
      avatar: face(p?.avatar_path),
      isMe: r.user_id === me,
    });
    groups.set(key, group);
  }
  const ordered = [...groups.values()].sort(
    (a, b) => Number(b.finished) - Number(a.finished) || b.days - a.days,
  );
  return { finished: rows.filter((r) => r.status === 'finished').length, groups: ordered };
}

/** Asks a friend into a round — it lands in their activity. */
export async function inviteToRound(userId: string, roundId: string) {
  must(await supabase.rpc('invite_to_round', { target: userId, rid: roundId }));
}
