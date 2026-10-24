import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useSession } from '@/hooks/useSession';
import * as social from '@/lib/backend/social';
import type { PastRun, Person, PersonPage, PostStats, Relations } from '@/lib/backend/social';
import type { CommentEntry } from '@/components/CommentsSheet';

/**
 * Everyone else, held once for every screen that shows them. Community fills
 * it; the story viewer, a profile and a post read the same people back, so
 * opening someone from the feed shows them at once rather than loading them
 * again. Everything you do to a post or a person — a reaction, a comment, a
 * request — shows here straight away and goes to the server behind it; if
 * the server says no, it's put back.
 */

interface SocialState {
  /** Today on the Friends and Members tabs. */
  friends: Person[];
  members: Person[];
  /** Everyone in your round, you included. */
  roundSize: number;
  /** False until today has loaded once; Community shows nothing before. */
  loaded: boolean;
  /** The last load didn't reach the server. */
  failed: boolean;
  relations: Relations;
  /** Reactions and comment counts, by `postKey`. */
  stats: Record<string, PostStats>;
  /** Photos already seen, by their completion id. */
  seen: ReadonlySet<string>;
  /** What's new on the Activity page: things not yet seen there, and every
   * friend request still waiting on an answer. */
  activityBadge: number;

  refreshToday: () => Promise<void>;
  /** Someone's page — from the cache at once if it's there, refreshed behind. */
  person: (userId: string) => Person | undefined;
  page: (userId: string) => PersonPage | undefined;
  loadPage: (userId: string) => Promise<PersonPage | undefined>;
  /** Makes sure these posts' reactions and comment counts are loaded. */
  ensureStats: (posts: readonly { membershipId: string; day: number }[]) => void;
  /** Tapping the emoji already left takes it back; another moves it. */
  react: (membershipId: string, day: number, emoji: string) => void;
  /** Leaves `emoji` only if it isn't already — a double tap never takes one back. */
  love: (membershipId: string, day: number, emoji: string) => void;
  thread: (membershipId: string, day: number) => Promise<CommentEntry[]>;
  comment: (membershipId: string, day: number, text: string, parentId: string | null) => Promise<CommentEntry[]>;
  markSeen: (completionId: string) => void;
  /** Add, or take a sent request back. */
  toggleRequest: (userId: string) => void;
  accept: (userId: string) => void;
  decline: (userId: string) => void;
  /** Ends a friendship — the same call that takes a request back. */
  unfriend: (userId: string) => void;
  /** Counts what's new on the Activity page again. */
  refreshActivity: () => Promise<void>;
  /** The Activity page has been looked at: everything on it is seen. */
  markActivityRead: () => void;
}

const EMPTY_RELATIONS: Relations = { friends: new Set(), outgoing: new Set(), incoming: [], friendList: [] };

const SocialContext = createContext<SocialState | null>(null);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const [friends, setFriends] = useState<Person[]>([]);
  const [members, setMembers] = useState<Person[]>([]);
  const [roundSize, setRoundSize] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [relations, setRelations] = useState<Relations>(EMPTY_RELATIONS);
  const [stats, setStats] = useState<Record<string, PostStats>>({});
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const [pages, setPages] = useState<Record<string, PersonPage>>({});
  const [unreadActivity, setUnreadActivity] = useState(0);

  // Read inside actions that settle long after they started.
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const relationsRef = useRef(relations);
  relationsRef.current = relations;

  // A new account starts from nothing; nothing of the last one carries over.
  useEffect(() => {
    setFriends([]);
    setMembers([]);
    setRoundSize(0);
    setLoaded(false);
    setFailed(false);
    setRelations(EMPTY_RELATIONS);
    setStats({});
    setSeen(new Set());
    setPages({});
    setUnreadActivity(0);
  }, [userId]);

  // Its own call, so a count that doesn't load never fails today's feed.
  const refreshActivity = useCallback(async () => {
    if (!userId) return;
    try {
      setUnreadActivity(await social.fetchUnreadActivity());
    } catch {
      // The badge just keeps its last count.
    }
  }, [userId]);

  const markActivityRead = useCallback(() => {
    setUnreadActivity(0);
    social.markActivityRead().catch(() => {});
  }, []);

  const refreshToday = useCallback(async () => {
    if (!userId) return;
    refreshActivity();
    try {
      const [f, m, size, rel] = await Promise.all([
        social.fetchToday('friends'),
        social.fetchToday('members'),
        social.fetchRoundSize(),
        social.fetchRelations(),
      ]);
      const photos = [...f.people, ...m.people].flatMap((p) => p.tasks.flatMap((t) => t.completionId ?? []));
      const seenNow = await social.fetchSeen(photos);
      setFriends(f.people);
      setMembers(m.people);
      setRoundSize(size);
      setRelations(rel);
      setStats((now) => ({ ...now, ...f.stats, ...m.stats }));
      setSeen((now) => new Set([...now, ...seenNow]));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [userId, refreshActivity]);

  const person = useCallback(
    (id: string) => pages[id]?.person ?? friends.find((p) => p.id === id) ?? members.find((p) => p.id === id),
    [pages, friends, members],
  );
  const page = useCallback((id: string) => pages[id], [pages]);

  const ensureStats = useCallback((posts: readonly { membershipId: string; day: number }[]) => {
    const missing = posts.filter((p) => !statsRef.current[social.postKey(p.membershipId, p.day)]);
    if (!missing.length) return;
    social
      .fetchStats(missing)
      .then((loadedStats) => setStats((now) => ({ ...loadedStats, ...now })))
      .catch(() => {});
  }, []);

  const loadPage = useCallback(
    async (id: string) => {
      try {
        const next = await social.fetchPerson(id);
        setPages((now) => ({ ...now, [id]: next }));
        if (next.person.membershipId) {
          ensureStats(next.days.map((d) => ({ membershipId: next.person.membershipId!, day: d.day })));
        }
        ensureStats(
          next.pastRuns.flatMap((run) => run.days.map((d) => ({ membershipId: run.membershipId, day: d.day }))),
        );
        return next;
      } catch (e) {
        if (__DEV__) console.warn('[social] loading a profile failed', e);
        return undefined;
      }
    },
    [ensureStats],
  );

  /** Puts a post's reaction where `emoji` says, on screen and on the server. */
  const setReaction = useCallback((membershipId: string, day: number, emoji: string | null) => {
    const key = social.postKey(membershipId, day);
    const before = statsRef.current[key] ?? { reactions: {}, mine: null, comments: 0 };
    const reactions = { ...before.reactions };
    if (before.mine) reactions[before.mine] = Math.max(0, (reactions[before.mine] ?? 1) - 1);
    if (emoji) reactions[emoji] = (reactions[emoji] ?? 0) + 1;
    setStats((now) => ({ ...now, [key]: { ...before, reactions, mine: emoji } }));
    social.setReaction(membershipId, day, emoji).catch(() => {
      setStats((now) => ({ ...now, [key]: before }));
    });
  }, []);

  const react = useCallback(
    (membershipId: string, day: number, emoji: string) => {
      const mine = statsRef.current[social.postKey(membershipId, day)]?.mine;
      setReaction(membershipId, day, mine === emoji ? null : emoji);
    },
    [setReaction],
  );

  const love = useCallback(
    (membershipId: string, day: number, emoji: string) => {
      if (statsRef.current[social.postKey(membershipId, day)]?.mine !== emoji) {
        setReaction(membershipId, day, emoji);
      }
    },
    [setReaction],
  );

  const thread = useCallback(
    (membershipId: string, day: number) => social.fetchThread(membershipId, day),
    [],
  );

  const comment = useCallback(
    async (membershipId: string, day: number, text: string, parentId: string | null) => {
      const key = social.postKey(membershipId, day);
      await social.addComment(membershipId, day, text, parentId);
      setStats((now) => {
        const before = now[key] ?? { reactions: {}, mine: null, comments: 0 };
        return { ...now, [key]: { ...before, comments: before.comments + 1 } };
      });
      return social.fetchThread(membershipId, day);
    },
    [],
  );

  const markSeen = useCallback((completionId: string) => {
    setSeen((now) => (now.has(completionId) ? now : new Set(now).add(completionId)));
    social.markSeen(completionId).catch(() => {});
  }, []);

  /** Moves someone between sets on screen, and back if the server refuses. */
  const changeRelation = useCallback(
    (change: (r: Relations) => Relations, call: () => Promise<unknown>) => {
      const before = relationsRef.current;
      setRelations(change(before));
      call().catch(() => setRelations(before));
    },
    [],
  );

  const accept = useCallback(
    (id: string) =>
      changeRelation(
        (r) => ({
          ...r,
          friends: new Set(r.friends).add(id),
          incoming: r.incoming.filter((p) => p.id !== id),
          friendList: [...r.friendList, ...r.incoming.filter((p) => p.id === id)],
        }),
        () => social.requestFriend(id),
      ),
    [changeRelation],
  );

  const toggleRequest = useCallback(
    (id: string) => {
      // Adding someone who has already asked you is accepting them — the
      // server makes you friends at once, so the screen shouldn't say
      // "Request sent".
      if (relationsRef.current.incoming.some((p) => p.id === id)) {
        accept(id);
        return;
      }
      const sent = relationsRef.current.outgoing.has(id);
      changeRelation(
        (r) => {
          const outgoing = new Set(r.outgoing);
          if (sent) outgoing.delete(id);
          else outgoing.add(id);
          return { ...r, outgoing };
        },
        () => (sent ? social.unfriend(id) : social.requestFriend(id)),
      );
    },
    [changeRelation, accept],
  );

  const decline = useCallback(
    (id: string) =>
      changeRelation(
        (r) => ({ ...r, incoming: r.incoming.filter((p) => p.id !== id) }),
        () => social.unfriend(id),
      ),
    [changeRelation],
  );

  const unfriend = useCallback(
    (id: string) =>
      changeRelation(
        (r) => {
          const friends = new Set(r.friends);
          friends.delete(id);
          return { ...r, friends, friendList: r.friendList.filter((p) => p.id !== id) };
        },
        () => social.unfriend(id),
      ),
    [changeRelation],
  );

  const activityBadge = unreadActivity + relations.incoming.length;

  const value = useMemo<SocialState>(
    () => ({
      friends, members, roundSize, loaded, failed, relations, stats, seen, activityBadge,
      refreshToday, person, page, loadPage, ensureStats, react, love, thread, comment, markSeen,
      toggleRequest, accept, decline, unfriend, refreshActivity, markActivityRead,
    }),
    [
      friends, members, roundSize, loaded, failed, relations, stats, seen, activityBadge,
      refreshToday, person, page, loadPage, ensureStats, react, love, thread, comment, markSeen,
      toggleRequest, accept, decline, unfriend, refreshActivity, markActivityRead,
    ],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialState {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>');
  return ctx;
}

/** One empty set for every reader outside the provider. */
const NONE_SEEN: ReadonlySet<string> = new Set();

/** Photos you've already seen, by completion id — what a ring fades. Empty
 * outside `SocialProvider` rather than throwing, so a ring drawn anywhere
 * can ask. */
export function useSeen(): ReadonlySet<string> {
  return useContext(SocialContext)?.seen ?? NONE_SEEN;
}

/** Where you stand with someone, read off the relations the store holds. */
export function useRelation(userId: string) {
  const { relations } = useSocial();
  return {
    isFriend: relations.friends.has(userId),
    requestSent: relations.outgoing.has(userId),
    requestReceived: relations.incoming.some((p) => p.id === userId),
  };
}

/** Your own past eras, most recent first, off your page as everyone else
 * reads it. */
export function useMyPastRuns(): PastRun[] {
  const { session } = useSession();
  const { page } = useSocial();
  const id = session?.user.id;
  const real = (id ? page(id)?.pastRuns : undefined) ?? NO_RUNS;
  return real;
}

const NO_RUNS: PastRun[] = [];
