import type { CommentEntry } from '@/components/CommentsSheet';
import type { Friend } from '@/data/content';
import { orderBySlot } from '@/hooks/useAppState';
import type { Database } from '@/lib/database.types';
import { publicUrl, signedUrls } from '@/lib/backend/photos';
import { supabase } from '@/lib/supabase';
import { timeStamp } from '@/lib/format';
import { DAY_MS, localDay, startOfToday } from '@/lib/round';

/**
 * Everyone else: the people on the Community tab, a friend's profile and
 * days, what's said and felt about a post, and who's friends with whom —
 * read from the server and handed back in the `Friend` shape the screens
 * already draw, so a post looks the same whoever's it is.
 *
 * A post is one member's day: `membershipId` and `day`. Photos come back as
 * short-lived signed links, and only for days the reader may see — someone's
 * today stays without photos until the Community lock is open.
 */

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
type CommunityRow = Database['public']['Functions']['community_today']['Returns'][number];

/** A person as the screens draw them, with what the server knows on top. */
export type Person = Friend;

/** One of a person's days, with its photos in the squares they were shot into. */
export interface DayRecord {
  day: number;
  caption?: string;
  tasks: Friend['tasks'];
}

/** What's been felt and said about one post. */
export interface PostStats {
  /** Reactions by emoji. */
  reactions: Record<string, number>;
  /** The reader's own reaction, if they've left one. */
  mine: string | null;
  comments: number;
}

export const postKey = (membershipId: string, day: number) => `${membershipId}:${day}`;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

/** The call's data, or its error thrown. */
function must<R extends Result>(result: R): NonNullable<R['data']> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<R['data']>;
}

/** The same for a `maybeSingle()` read, where no row is a real answer. */
function maybe<R extends Result>(result: R): R['data'] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

const face = (path: string | null) => (path ? { uri: publicUrl('avatars', path) } : null);

/**
 * A day's checklist from its completions: every task in the order its grid
 * draws them, done ones with their time and photo. Thumbnails stand in for
 * `photo` only where a screen asks for them by key; the post itself wants
 * the full shot.
 */
function dayTasks(
  tasks: readonly Row<'challenge_tasks'>[],
  completions: readonly Row<'task_completions'>[],
  urls: Record<string, string>,
): Friend['tasks'] {
  const byTask = new Map(completions.map((c) => [c.task_id, c]));
  const progress = Object.fromEntries(
    completions.map((c) => [c.task_id, { done: true, slot: c.slot ?? undefined }]),
  );
  return orderBySlot(tasks, progress).map((task) => {
    const c = byTask.get(task.id);
    if (!c) return { label: task.label, done: false };
    return {
      label: task.label,
      done: true,
      time: timeStamp(new Date(c.completed_at)),
      photo: urls[c.photo_path] ? { uri: urls[c.photo_path] } : undefined,
      thumb: urls[c.thumb_path] ? { uri: urls[c.thumb_path] } : undefined,
      completionId: c.id,
    };
  });
}

// ---------------------------------------------------------------------------
// Today, on the Community tab
// ---------------------------------------------------------------------------

/**
 * Everyone the tab shows for `scope` — your friends in any challenge, or
 * everyone else in your round — each on today, with today's photos where the
 * lock lets them through. Ordered furthest along first.
 */
export async function fetchToday(scope: 'friends' | 'members'): Promise<{
  people: Person[];
  stats: Record<string, PostStats>;
}> {
  const rows = must(await supabase.rpc('community_today', { scope })) as CommunityRow[];
  if (!rows.length) return { people: [], stats: {} };

  const mids = rows.map((r) => r.membership_id);
  const challengeIds = [...new Set(rows.map((r) => r.challenge_id))];
  const days = [...new Set(rows.map((r) => r.day))];
  const [challenges, tasks, completions, reactions, mutuals] = await Promise.all([
    supabase.from('challenges').select('id, slug, name').in('id', challengeIds),
    supabase.from('challenge_tasks').select('*').in('challenge_id', challengeIds).order('position'),
    supabase.from('task_completions').select('*').in('membership_id', mids).in('day', days),
    supabase.from('reactions').select('membership_id, day, emoji').in('membership_id', mids).in('day', days),
    // Only members are strangers; a friend's mutuals aren't what the tab says.
    scope === 'members' ? mutualCounts(rows.map((r) => r.user_id)) : Promise.resolve(new Map<string, number>()),
  ]);

  const todayOf = new Map(rows.map((r) => [r.membership_id, r.day]));
  const shots = must(completions).filter((c) => todayOf.get(c.membership_id) === c.day);
  const urls = await signedUrls(shots.flatMap((c) => [c.photo_path, c.thumb_path]));
  const challengeById = new Map(must(challenges).map((c) => [c.id, c]));
  const allTasks = must(tasks);

  const counts: Record<string, Record<string, number>> = {};
  for (const r of must(reactions)) {
    if (todayOf.get(r.membership_id) !== r.day) continue;
    const key = postKey(r.membership_id, r.day);
    counts[key] = { ...counts[key], [r.emoji]: (counts[key]?.[r.emoji] ?? 0) + 1 };
  }

  const stats: Record<string, PostStats> = {};
  const people = rows.map((r): Person => {
    const challenge = challengeById.get(r.challenge_id);
    const key = postKey(r.membership_id, r.day);
    stats[key] = { reactions: counts[key] ?? {}, mine: r.my_reaction, comments: r.comments };
    return {
      id: r.user_id,
      name: r.name || r.handle,
      handle: `@${r.handle}`,
      avatar: face(r.avatar_path),
      day: r.day,
      bio: null,
      caption: r.caption ?? undefined,
      postsAt: r.posts_at ? Date.parse(r.posts_at) : undefined,
      membershipId: r.membership_id,
      challengeId: challenge?.slug ?? challenge?.id,
      challengeName: challenge?.name,
      isFriend: r.is_friend,
      requestSent: r.request_sent,
      mutualCount: scope === 'members' ? (mutuals.get(r.user_id) ?? 0) : undefined,
      tasks: dayTasks(
        allTasks.filter((t) => t.challenge_id === r.challenge_id),
        shots.filter((c) => c.membership_id === r.membership_id),
        urls,
      ),
    };
  });
  return { people, stats };
}

/**
 * How many of your friends each of `userIds` is friends with. Read straight
 * off the `friends` view — who's friends with whom is as public as profiles
 * are — so it needs no function of its own on the server.
 */
async function mutualCounts(userIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!userIds.length) return counts;
  const mine = must(
    await supabase.from('friends').select('friend_id').eq('user_id', await myId()),
  ).flatMap((r) => r.friend_id ?? []);
  if (!mine.length) return counts;
  const shared = must(
    await supabase.from('friends').select('user_id').in('user_id', userIds).in('friend_id', mine),
  );
  // A view's columns come back typed as nullable, though these never are.
  for (const { user_id: id } of shared) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** How many are in your round, you included — the Members tab's count. */
export async function fetchRoundSize(): Promise<number> {
  const id = await myId();
  const mine = maybe(
    await supabase.from('memberships').select('round_id').eq('user_id', id).eq('status', 'active').maybeSingle(),
  );
  if (!mine) return 0;
  const stats = maybe(
    await supabase.from('round_stats').select('members').eq('round_id', mine.round_id).maybeSingle(),
  );
  return stats?.members ?? 0;
}

// ---------------------------------------------------------------------------
// One person's page
// ---------------------------------------------------------------------------

/**
 * An era someone is no longer in — finished, lost or left — with every day
 * they got a photo on. It stays on their profile: a run that ended is still
 * what they did.
 */
export interface PastRun {
  membershipId: string;
  challenge: { id: string; name: string };
  status: 'finished' | 'lost' | 'left';
  startDate: Date;
  totalDays: number;
  taskCount: number;
  /** The day the run ended on: its length if finished, otherwise the day it
   * was left or its lives ran out. */
  lastDay: number;
  /** Today, counted on this run's calendar and past its end — what a post
   * reads its "3 days ago" off. */
  dayToday: number;
  /** Days with at least one completion, most recent first. */
  days: DayRecord[];
}

/** Which day of a round starting `start` the date `on` falls on. Rounded,
 * so a daylight-saving shift between the two doesn't lose a day. */
const dayOfRound = (start: Date, on: Date) => Math.round((on.getTime() - start.getTime()) / DAY_MS) + 1;

/** Every era `userId` was in before the current one, most recent first —
 * three reads, however many there were. Runs with no photo at all are left
 * out: there is nothing of them to show. */
export async function fetchPastRuns(userId: string): Promise<PastRun[]> {
  const rows = must(
    await supabase
      .from('memberships')
      .select('*, round:rounds(*, challenge:challenges(*, tasks:challenge_tasks(*)))')
      .eq('user_id', userId)
      .neq('status', 'active'),
  ).filter((m) => m.round?.challenge);
  if (!rows.length) return [];

  const ids = rows.map((m) => m.id);
  const [completions, captions] = await Promise.all([
    supabase.from('task_completions').select('*').in('membership_id', ids),
    supabase.from('day_captions').select('*').in('membership_id', ids),
  ]);
  const all = must(completions);
  const allCaptions = must(captions);
  const urls = await signedUrls(all.flatMap((c) => [c.photo_path, c.thumb_path]));
  const today = startOfToday();

  return rows
    .map((m): PastRun => {
      const round = m.round!;
      const challenge = round.challenge!;
      const tasks = [...(challenge.tasks ?? [])].sort((a, b) => a.position - b.position);
      const startDate = localDay(round.start_date);
      const ended = m.ended_at ? new Date(m.ended_at) : today;
      ended.setHours(0, 0, 0, 0);
      const mine = all.filter((c) => c.membership_id === m.id);
      const captionOf = new Map(
        allCaptions.filter((c) => c.membership_id === m.id).map((c) => [c.day, c.caption]),
      );
      const dayNumbers = [...new Set(mine.map((c) => c.day))].sort((a, b) => b - a);
      return {
        membershipId: m.id,
        challenge: { id: challenge.slug ?? challenge.id, name: challenge.name },
        status: m.status as PastRun['status'],
        startDate,
        totalDays: round.days,
        taskCount: tasks.length,
        lastDay:
          m.status === 'finished'
            ? round.days
            : Math.min(Math.max(dayOfRound(startDate, ended), 1), round.days),
        dayToday: dayOfRound(startDate, today),
        days: dayNumbers.map((day) => ({
          day,
          caption: captionOf.get(day),
          tasks: dayTasks(tasks, mine.filter((c) => c.day === day), urls),
        })),
      };
    })
    .filter((run) => run.days.length > 0)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

export interface PersonPage {
  person: Person;
  /** Every day they've got anything on, today included. */
  days: DayRecord[];
  /** The eras they were in before this one, most recent first. */
  pastRuns: PastRun[];
  /** Their challenge, or null when they're in none. */
  challenge: { id: string; name: string; joined: number } | null;
  startDate: Date;
  totalDays: number;
  friendCount: number;
  /** Lives left of the era's allowance, or null when they're in none. */
  lives: { left: number; total: number } | null;
}

/** Someone's profile and their whole run, as far as you may see it. */
export async function fetchPerson(userId: string): Promise<PersonPage> {
  const me = await myId();
  const [profile, friendRows, membership, relation, pastRuns] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('friends').select('friend_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('memberships')
      .select('*, round:rounds(*, challenge:challenges(*, tasks:challenge_tasks(*)))')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${me},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${me})`)
      .maybeSingle(),
    fetchPastRuns(userId),
  ]);
  const p = must(profile);
  const m = maybe(membership);
  const link = maybe(relation);

  const person: Person = {
    id: p.id,
    name: p.name || p.handle,
    handle: `@${p.handle}`,
    avatar: face(p.avatar_path),
    day: 0,
    bio: p.bio,
    isFriend: link?.status === 'accepted',
    requestSent: link?.status === 'pending' && link.requester_id === me,
    requestReceived: link?.status === 'pending' && link.addressee_id === me,
    tasks: [],
  };
  const friendCount = friendRows.count ?? 0;
  if (!m?.round?.challenge) {
    return { person, days: [], pastRuns, challenge: null, startDate: new Date(), totalDays: 0, friendCount, lives: null };
  }

  const round = m.round;
  const challenge = round.challenge!;
  const tasks = [...(challenge.tasks ?? [])].sort((a, b) => a.position - b.position);
  const [progress, completions, captions] = await Promise.all([
    supabase.from('membership_progress').select('current_day, lives, lives_left').eq('membership_id', m.id).single(),
    supabase.from('task_completions').select('*').eq('membership_id', m.id),
    supabase.from('day_captions').select('*').eq('membership_id', m.id),
  ]);
  const all = must(completions);
  const urls = await signedUrls(all.flatMap((c) => [c.photo_path, c.thumb_path]));
  const captionOf = new Map(must(captions).map((c) => [c.day, c.caption]));
  const dayOn = must(progress).current_day ?? 1;
  const today = Math.min(Math.max(dayOn, 1), round.days);
  // Today has a page even with nothing on it yet — but only once the round
  // has begun: before Day 1 there's no day to show, only an empty post.
  const started = dayOn >= 1;

  const dayNumbers = [...new Set([...all.map((c) => c.day), ...(started ? [today] : [])])].sort(
    (a, b) => b - a,
  );
  const days = dayNumbers.map((day) => ({
    day,
    caption: captionOf.get(day),
    tasks: dayTasks(tasks, all.filter((c) => c.day === day), urls),
  }));

  person.day = today;
  person.membershipId = m.id;
  person.challengeId = challenge.slug ?? challenge.id;
  person.challengeName = challenge.name;
  person.tasks = days.find((d) => d.day === today)?.tasks ?? [];
  person.caption = captionOf.get(today);

  return {
    person,
    days,
    pastRuns,
    challenge: { id: challenge.slug ?? challenge.id, name: challenge.name, joined: 0 },
    startDate: localDay(round.start_date),
    totalDays: round.days,
    friendCount,
    lives: { left: must(progress).lives_left ?? 0, total: must(progress).lives ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Reactions, comments, views
// ---------------------------------------------------------------------------

/** Reactions and comment counts for any posts, in two reads. */
export async function fetchStats(
  posts: readonly { membershipId: string; day: number }[],
): Promise<Record<string, PostStats>> {
  if (!posts.length) return {};
  const me = await myId();
  const mids = [...new Set(posts.map((p) => p.membershipId))];
  const wanted = new Set(posts.map((p) => postKey(p.membershipId, p.day)));
  const [reactions, comments] = await Promise.all([
    supabase.from('reactions').select('membership_id, day, emoji, user_id').in('membership_id', mids),
    supabase.from('comments').select('membership_id, day').in('membership_id', mids),
  ]);
  const stats: Record<string, PostStats> = {};
  for (const key of wanted) stats[key] = { reactions: {}, mine: null, comments: 0 };
  for (const r of must(reactions)) {
    const s = stats[postKey(r.membership_id, r.day)];
    if (!s) continue;
    s.reactions[r.emoji] = (s.reactions[r.emoji] ?? 0) + 1;
    if (r.user_id === me) s.mine = r.emoji;
  }
  // Comments on a day you can't see yet don't come back, so they don't count.
  for (const c of must(comments)) {
    const s = stats[postKey(c.membership_id, c.day)];
    if (s) s.comments += 1;
  }
  return stats;
}

/** Leaves `emoji` on a post, moves yours to it, or — with null — takes it back. */
export async function setReaction(membershipId: string, day: number, emoji: string | null) {
  const me = await myId();
  if (emoji === null) {
    must(
      await supabase.from('reactions').delete()
        .eq('membership_id', membershipId).eq('day', day).eq('user_id', me),
    );
    return;
  }
  // Moving a reaction changes only its emoji — all the server lets anyone
  // change on one — so it's an update when there is one, and a new row when
  // there isn't, rather than an upsert that would ask to rewrite every column.
  const moved = must(
    await supabase
      .from('reactions')
      .update({ emoji })
      .eq('membership_id', membershipId)
      .eq('day', day)
      .eq('user_id', me)
      .select('emoji'),
  );
  if (moved.length) return;
  must(await supabase.from('reactions').insert({ membership_id: membershipId, day, user_id: me, emoji }));
}

/** A post's comments as the sheet draws them: each reply under the comment
 * it answered, oldest first at every level. */
export async function fetchThread(membershipId: string, day: number): Promise<CommentEntry[]> {
  const rows = must(
    await supabase
      .from('comments')
      .select('id, parent_id, body, created_at, author:profiles(name, handle, avatar_path)')
      .eq('membership_id', membershipId)
      .eq('day', day)
      .order('created_at'),
  );
  type Node = CommentEntry & { replies: Node[] };
  const nodes = new Map<string, Node>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      author: r.author?.name || r.author?.handle || 'Someone',
      avatar: face(r.author?.avatar_path ?? null),
      text: r.body,
      replies: [],
    });
  }
  const roots: Node[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parent_id ? nodes.get(r.parent_id) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function addComment(membershipId: string, day: number, text: string, parentId: string | null) {
  const body = text.trim();
  if (!body) return;
  const me = await myId();
  must(
    await supabase
      .from('comments')
      .insert({ membership_id: membershipId, day, author_id: me, body, parent_id: parentId }),
  );
}

/** Which of these photos you've already seen. */
export async function fetchSeen(completionIds: readonly string[]): Promise<Set<string>> {
  if (!completionIds.length) return new Set();
  const me = await myId();
  const rows = must(
    await supabase.from('photo_views').select('completion_id').eq('viewer_id', me).in('completion_id', [...completionIds]),
  );
  return new Set(rows.map((r) => r.completion_id));
}

/** Marks a photo seen; seeing it again is a no-op. */
export async function markSeen(completionId: string) {
  const me = await myId();
  must(
    await supabase
      .from('photo_views')
      .upsert({ completion_id: completionId, viewer_id: me }, { onConflict: 'completion_id,viewer_id', ignoreDuplicates: true }),
  );
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export interface Relations {
  friends: Set<string>;
  /** Requests you've sent and they haven't answered. */
  outgoing: Set<string>;
  /** People who've asked you, newest first. */
  incoming: Person[];
  /** Your friends themselves — names and faces, for lists of them. */
  friendList: Person[];
}

export async function fetchRelations(): Promise<Relations> {
  const me = await myId();
  const rows = must(
    await supabase.from('friendships').select('*').or(`requester_id.eq.${me},addressee_id.eq.${me}`),
  );
  const friends = new Set<string>();
  const outgoing = new Set<string>();
  const incomingIds: string[] = [];
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const other = r.requester_id === me ? r.addressee_id : r.requester_id;
    if (r.status === 'accepted') friends.add(other);
    else if (r.requester_id === me) outgoing.add(other);
    else incomingIds.push(other);
  }
  const [incoming, friendList] = await Promise.all([
    fetchProfiles(incomingIds),
    fetchProfiles([...friends]),
  ]);
  return { friends, outgoing, incoming, friendList };
}

/** People by id, as rows for a list — face, name, handle. */
export async function fetchProfiles(ids: readonly string[]): Promise<Person[]> {
  if (!ids.length) return [];
  const rows = must(await supabase.from('profiles').select('*').in('id', [...ids]));
  const byId = new Map(rows.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    return p
      ? [{ id: p.id, name: p.name || p.handle, handle: `@${p.handle}`, avatar: face(p.avatar_path), day: 0, bio: p.bio, tasks: [] }]
      : [];
  });
}

/** By name or username. Only letters (accented ones too), digits, dots,
 * underscores and spaces make it into the query, so nothing typed can change
 * its meaning. */
export async function searchPeople(query: string): Promise<Person[]> {
  const me = await myId();
  const term = query.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_. À-ɏ]/g, '');
  if (!term) return [];
  const rows = must(
    await supabase
      .from('profiles')
      .select('*')
      .or(`name.ilike.*${term}*,handle.ilike.*${term}*`)
      .neq('id', me)
      .limit(25),
  );
  return rows.map((p) => ({
    id: p.id,
    name: p.name || p.handle,
    handle: `@${p.handle}`,
    avatar: face(p.avatar_path),
    day: 0,
    bio: p.bio,
    tasks: [],
  }));
}

export interface Suggestion {
  person: Person;
  /** Friends you share, up to two by face, and how many in all. */
  mutuals: Person[];
  mutualCount: number;
}

/** Friends of your friends, most shared first. */
export async function fetchSuggestions(): Promise<Suggestion[]> {
  const rows = must(await supabase.rpc('friend_suggestions', { max_rows: 20 }));
  if (!rows.length) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.user_id, ...(r.mutual_ids ?? [])]))];
  const people = new Map((await fetchProfiles(ids)).map((p) => [p.id, p]));
  return rows.flatMap((r) => {
    const person = people.get(r.user_id);
    if (!person) return [];
    return [{
      person,
      mutuals: (r.mutual_ids ?? []).flatMap((id) => people.get(id) ?? []),
      mutualCount: r.mutual_count,
    }];
  });
}

/** Add — or accept, if they'd already asked you. */
export async function requestFriend(userId: string) {
  return must(await supabase.rpc('request_friend', { target: userId }));
}

/** Takes back a request, declines one, or ends a friendship. */
export async function unfriend(userId: string) {
  must(await supabase.rpc('unfriend', { target: userId }));
}
