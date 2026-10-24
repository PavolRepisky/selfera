import type { Reminders } from '@/hooks/useAppState';
import type { ChallengeCategory } from '@/data/challenges';
import type { Database } from '@/lib/database.types';
import { removePhotos, uploadTaskPhoto } from '@/lib/backend/photos';
import { supabase } from '@/lib/supabase';

/**
 * Everything about your own account the app reads and writes, one function
 * per thing it does — named after the actions `useAppState` already has.
 * Everyone else (Community, friends, comments, reactions) is in
 * `lib/backend/social`.
 *
 * Reads go straight at the tables, which row rules keep honest. Writes that
 * carry a rule — today only, Day 1 not passed, only the creator — go
 * through the database's own functions, which check it.
 */

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];
export type ProfileRow = Tables['profiles']['Row'];
export type ChallengeRow = Tables['challenges']['Row'];
export type TaskRow = Tables['challenge_tasks']['Row'];
export type RoundRow = Tables['rounds']['Row'];
export type MembershipRow = Tables['memberships']['Row'];
export type CompletionRow = Tables['task_completions']['Row'];
export type NotificationRow = Tables['notifications']['Row'];
export type MembershipProgress = Views['membership_progress']['Row'];

interface Result {
  data: unknown;
  error: { message: string } | null;
}

/** Throws the error a Supabase call came back with, or hands back its data.
 * The client types data as nullable even on success; a call that succeeded
 * without an error always has it. */
function must<R extends Result>(result: R): NonNullable<R['data']> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<R['data']>;
}

/** The same, for a `maybeSingle()` read, where no row is a real answer. */
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

// ---------------------------------------------------------------------------
// You
// ---------------------------------------------------------------------------

export async function fetchProfile(userId?: string): Promise<ProfileRow> {
  const id = userId ?? (await myId());
  return must(await supabase.from('profiles').select('*').eq('id', id).single());
}

/** Name, handle, bio or a new face — whichever are given. A taken handle
 * comes back as an error saying so. */
export async function updateProfile(
  patch: Partial<Pick<ProfileRow, 'name' | 'handle' | 'bio' | 'avatar_path'>>,
) {
  const id = await myId();
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error?.code === '23505') throw new Error('That username is taken');
  if (error) throw new Error(error.message);
}

/**
 * The account's current challenge in full: the membership, its round,
 * challenge and tasks, where it stands today, and every day's completions
 * and captions — what the Tasks tab, the profile grid and the calendar all
 * draw from. Null when you aren't in one.
 */
export async function fetchMyChallenge() {
  const id = await myId();
  const membership = maybe(
    await supabase
      .from('memberships')
      .select('*, round:rounds(*, challenge:challenges(*, tasks:challenge_tasks(*)))')
      .eq('user_id', id)
      .eq('status', 'active')
      .maybeSingle(),
  );
  if (!membership) return null;

  const [progress, completions, captions, posts] = await Promise.all([
    supabase.from('membership_progress').select('*').eq('membership_id', membership.id).single(),
    supabase.from('task_completions').select('*').eq('membership_id', membership.id).order('day'),
    supabase.from('day_captions').select('*').eq('membership_id', membership.id),
    supabase.from('day_posts').select('*').eq('membership_id', membership.id),
  ]);

  const tasks = [...(membership.round?.challenge?.tasks ?? [])].sort((a, b) => a.position - b.position);
  return {
    membership,
    round: membership.round!,
    challenge: membership.round!.challenge!,
    tasks,
    progress: must(progress),
    completions: must(completions),
    captions: Object.fromEntries(must(captions).map((c) => [c.day, c.caption])) as Record<number, string>,
    /** When each finished day goes up, by day, in epoch ms. */
    postsAt: Object.fromEntries(must(posts).map((p) => [p.day, Date.parse(p.posts_at)])) as Record<number, number>,
  };
}

// ---------------------------------------------------------------------------
// Today's tasks
// ---------------------------------------------------------------------------

/**
 * Why a photo or an undo didn't save, as a sentence for the person holding
 * the phone — not the database's own words.
 */
function explainSave(e: unknown): Error {
  const message = e instanceof Error ? e.message : String(e);
  if (/network|fetch|timed? ?out|offline/i.test(message)) {
    return new Error('No connection. Take it again once you’re back online.');
  }
  // Storage and `complete_task` both refuse a photo filed under a day that
  // isn't today where you live — which is what happens when midnight passes
  // while the page is open.
  if (/post is already up/i.test(message)) {
    return new Error('Today’s post is already up, so it can’t change now.');
  }
  if (/row-level security|today's folder|today’s folder/i.test(message)) {
    return new Error('Your day moved on while this page was open. Reopen Tasks and take it again.');
  }
  return new Error(message || 'Something went wrong. Try again.');
}

/**
 * A task is only ever ticked off by photographing it: the photo goes up
 * into today's folder, then the tick is recorded against it. A retake's
 * old photo is removed once the new one is in. Hands back the completion
 * and when the day goes up — set once the day's last photo is in, null
 * before.
 */
export async function completeTaskWithPhoto(
  membershipId: string,
  day: number,
  taskId: string,
  photo: { uri: string },
  slot?: number,
): Promise<{ completion: CompletionRow; postsAt: number | null }> {
  const userId = await myId();
  let uploaded: { photoPath: string; thumbPath: string };
  try {
    uploaded = await uploadTaskPhoto(userId, membershipId, day, photo);
  } catch (e) {
    throw explainSave(e);
  }
  const { photoPath, thumbPath } = uploaded;
  const { data, error } = await supabase.rpc('complete_task', {
    task: taskId,
    photo_path: photoPath,
    thumb_path: thumbPath,
    slot,
  });
  if (error) {
    // The tick didn't land, so the photo has nothing to prove.
    await removePhotos('task-photos', [photoPath, thumbPath]);
    throw explainSave(error);
  }
  const result = data as { completion: CompletionRow; replaced: string[]; posts_at: string | null };
  await removePhotos('task-photos', result.replaced);
  return { completion: result.completion, postsAt: result.posts_at ? Date.parse(result.posts_at) : null };
}

/** The tick goes, and the proof goes with it. Today only. */
export async function undoTask(taskId: string) {
  const { data, error } = await supabase.rpc('undo_task', { task: taskId });
  if (error) throw explainSave(error);
  await removePhotos('task-photos', (data as string[]) ?? []);
}

/** Slide to post: today's countdown ends now. Hands back when the day went
 * up, or null if it wasn't counting down. */
export async function postNow(): Promise<number | null> {
  const { data, error } = await supabase.rpc('post_now');
  if (error) throw explainSave(error);
  return data ? Date.parse(data) : null;
}

/** What you wrote under a day's post; empty text takes it off. Only while
 * the day counts down to going up — the server refuses it otherwise. */
export async function setCaption(membershipId: string, day: number, caption: string) {
  const text = caption.trim();
  try {
    if (!text) {
      must(await supabase.from('day_captions').delete().eq('membership_id', membershipId).eq('day', day));
      return;
    }
    must(
      await supabase
        .from('day_captions')
        .upsert({ membership_id: membershipId, day, caption: text, updated_at: new Date().toISOString() }),
    );
  } catch (e) {
    // The countdown ran out on the server before the words reached it.
    const message = e instanceof Error ? e.message : String(e);
    if (/row-level security/i.test(message)) {
      throw new Error('Today’s post is already up, so its caption can’t change now.');
    }
    throw explainSave(e);
  }
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

/** Every round, with its challenge, tasks and headline numbers — the
 * Discover sorts these into featured and trending; search into starting soon, under way and finished. */
export async function fetchRounds() {
  const [rounds, stats] = await Promise.all([
    supabase.from('rounds').select('*, challenge:challenges(*, tasks:challenge_tasks(*))').order('start_date'),
    supabase.from('round_stats').select('*'),
  ]);
  const byRound = new Map(must(stats).map((s) => [s.round_id, s]));
  return must(rounds).map((round) => ({ ...round, stats: byRound.get(round.id) ?? null }));
}

/** A finished round's standings by longest streak, best first. */
export async function fetchStandings(roundId: string) {
  return must(await supabase.rpc('round_standings', { rid: roundId }));
}

/** Signing the pledge. Ends whichever challenge you were on. */
export async function joinRound(roundId: string, reminders: Reminders): Promise<string> {
  return must(await supabase.rpc('join_round', { rid: roundId, reminders: { ...reminders } }));
}

export async function setReminders(reminders: Reminders) {
  must(await supabase.rpc('set_reminders', { reminders: { ...reminders } }));
}

/** Settings' End challenge. */
export async function leaveRound() {
  must(await supabase.rpc('leave_round'));
}

/** The create form, once its photos are uploaded (`uploadPublicPhoto` into
 * `challenge-photos`). A task keeps its `id` when it's being edited. */
export interface ChallengeForm {
  name: string;
  description: string;
  category?: ChallengeCategory;
  photoPaths: readonly string[];
  tasks: readonly { id?: string; label: string; note?: string }[];
  days: number;
  /** ISO `YYYY-MM-DD`, Day 1. */
  startDate: string;
  lives: number;
}

const formPayload = (form: ChallengeForm) => ({
  name: form.name,
  description: form.description,
  category: form.category ?? null,
  photo_paths: [...form.photoPaths],
  tasks: form.tasks.map((t) => ({ id: t.id ?? null, label: t.label, note: t.note ?? null })),
  days: form.days,
  start_date: form.startDate,
  lives: form.lives,
});

export async function addChallenge(form: ChallengeForm): Promise<string> {
  return must(await supabase.rpc('create_challenge', { p: formPayload(form) }));
}

export async function updateChallenge(challengeId: string, form: ChallengeForm) {
  must(await supabase.rpc('update_challenge', { cid: challengeId, p: formPayload(form) }));
}

export async function deleteChallenge(challengeId: string) {
  must(await supabase.rpc('delete_challenge', { cid: challengeId }));
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function fetchNotifications() {
  return must(
    await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, name, handle, avatar_path)')
      .order('created_at', { ascending: false })
      .limit(100),
  );
}

export async function markNotificationsRead(ids: readonly string[]) {
  if (ids.length === 0) return;
  must(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', [...ids]));
}
