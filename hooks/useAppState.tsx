import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  CHALLENGES,
  challengeById,
  type Challenge,
  type ChallengeCategory,
  type ChallengeTask,
} from '@/data/challenges';
import { useSession } from '@/hooks/useSession';
import * as api from '@/lib/backend/api';
import { fetchCatalog, type Listing } from '@/lib/backend/catalog';
import {
  publicUrl,
  removePhotos,
  SIGNED_URL_SECONDS,
  signedUrls,
  storedPath,
  taskPhotoSource,
  uploadPublicPhoto,
} from '@/lib/backend/photos';
import { isoDay, timeStamp } from '@/lib/format';
import { orderBySlot } from '@/lib/slots';
import type { ImageSourcePropType } from '@/lib/imageSource';
import { DAY_MS, isPosted, localDay, POST_COUNTDOWN_MS, startOfToday } from '@/lib/round';
import { tasksOn as dueOn, type Schedule } from '@/lib/schedule';
import { AppState as AppLifecycle } from 'react-native';

/**
 * All app state lives here. Signed in, it is loaded from the backend — the
 * account's profile, the challenge it's in and every day of it so far — and
 * the splash stays up until it has been, so nothing shows before it's yours.
 * The actions below are the app's whole write surface.
 */

export interface TaskProgress {
  done: boolean;
  /** Formatted completion stamp, e.g. "07:19". */
  time?: string;
  /** Seed for the proof photo, or null if none was attached. */
  photoSeed?: string | null;
  /**
   * A real photo the user took or picked. Bundled collection photos come
   * through as a `require`d module rather than a path, so this holds either.
   */
  photo?: TaskPhoto | null;
  /**
   * The same shot at grid size, for anywhere it's drawn small — a profile
   * tile, a calendar cell, a task row. Loaded photos have one; a shot just
   * taken doesn't need one, since the phone already holds it.
   */
  thumb?: TaskPhoto | null;
  /** The photo is still on its way to the server: shown already, saved not
   * yet. Cleared once it's in; if it doesn't make it, the tick comes back off. */
  pending?: boolean;
  /**
   * Which cell of the day's grid the photo was shot into, counted in the
   * grid's own order. Left out where nobody chose — seeded history — and the
   * task takes the first free cell instead; see `orderBySlot`.
   */
  slot?: number;
}

/** A camera / library shot by URI, or one of the bundled collection photos. */
export type TaskPhoto = ImageSourcePropType;

/** dayNumber -> taskId -> progress */
export type Progress = Record<number, Record<string, TaskProgress>>;

export interface Profile {
  name: string;
  handle: string;
  bio: string | null;
  avatarSeed: string | null;
  /** A photo taken or picked for the profile circle. Wins over the seed. */
  avatar: TaskPhoto | null;
}

/**
 * The signed-in account's own reply on a friend's post. `parentId` nests it
 * one level under a seeded or own top-level comment, the way Instagram's own
 * threads never go past a single level — a reply to a reply still hangs off
 * the top-level comment, not off the reply itself.
 */
/**
 * When the app nudges you, picked while joining, as minutes after midnight or
 * null for Never: a time for each task, by task id — a task with no entry
 * takes `DEFAULT_TASK_REMINDER` — and the last call, which only fires if a
 * task is still missing. Saved only for now — nothing schedules them yet.
 */
export interface Reminders {
  tasks: Record<string, number | null>;
  lastCall: number | null;
}

/** Eight in the morning: early enough to plan the day round. */
export const DEFAULT_TASK_REMINDER = 8 * 60;

/** Ten at night: two hours before midnight ends the day, time enough to
 * still take a photo. */
const DEFAULT_LAST_CALL = 22 * 60;

const DEFAULT_REMINDERS: Reminders = { tasks: {}, lastCall: DEFAULT_LAST_CALL };

interface AppState {
  profile: Profile;

  challenge: Challenge;
  /** Working copy of the task list — edited in the challenge detail screen. */
  tasks: ChallengeTask[];
  startDate: Date;
  totalDays: number;

  progress: Progress;
  /** What you wrote under each day's post, by challenge day — the caption
   * your own posts show. A day can go without one. */
  captions: Record<number, string>;
  /**
   * When each finished day goes up on Community, by challenge day, in epoch
   * ms. Set the moment a day's last photo is in; until then the day can
   * still be reshot, a photo taken out (which stops the countdown) and its
   * caption written. A finished day with no entry counts as up.
   */
  postsAt: Record<number, number>;
  /** Every challenge there is, each with the round that matters to you —
   * what Discover, search and a challenge's page show. */
  catalog: readonly Listing[];
  /** The challenges you've built yourself, oldest first — what Search's
   * Created by you lists, and what can still be edited until Day 1. */
  customChallenges: readonly Challenge[];

  /** The two nudges picked while joining a challenge. */
  reminders: Reminders;
  /** The weekdays picked while joining for each task that isn't daily, by
   * task id. Fixed once signed. */
  schedule: Schedule;
  /** The tasks due on a day of your round, in their own order — every
   * question about "the whole day" asks this, never `tasks`. Empty on a rest
   * day. */
  tasksOn: (day: number) => ChallengeTask[];
  /** `tasksOn(currentDay)`: what Tasks shows and today's ring counts. */
  todayTasks: ChallengeTask[];

  /** 1-indexed, clamped to the challenge length. */
  currentDay: number;

  /**
   * Whether the account is in a challenge at all. A new account isn't, and
   * then `challenge` and its tasks are only a stand-in for screens that need
   * one to draw: Tasks shows its empty state instead, and nothing treats the
   * stand-in as yours.
   */
  inChallenge: boolean;
  /** The server's id for your place in the challenge — what your own posts
   * are kept against, so a reaction or comment on them lands. */
  membershipId: string | null;
  /** Days until the round's Day 1, or 0 once it has started. Joining stays
   * open through Day 1, so one you've just joined may be waiting or on its
   * first day. */
  daysUntilStart: number;
  /** False until the signed-in account's data has loaded. */
  ready: boolean;
  /** The last load didn't reach the server; `reload` tries again. */
  loadFailed: boolean;
  /** Why the last task photo or undo didn't save, until it's been read —
   * shown on Tasks. */
  syncError: string | null;
  /** Why a new profile photo didn't save — shown on Settings, a screen of
   * its own, so the Tasks tab underneath doesn't raise it a second time. */
  avatarError: string | null;

  /** The allowance a challenge starts with, so a screen can show "2 of 3". */
  livesTotal: number;
  /** What is left of that allowance, floored at zero. */
  livesLeft: number;

  /**
   * True once *today* has a task finished with an actual photo attached —
   * not just ticked, not standing behind a seeded placeholder, and not an
   * older day's streak carrying today. Yesterday's photo doesn't stand in
   * for today's.
   */
  hasPhotographedTask: boolean;
  /**
   * The Community lock: other people's today stays blurred until you've
   * proven yours. Only while you have a today to prove — in no challenge,
   * or before Day 1, there's nothing to photograph, so nothing is locked.
   * The server's `unlocked_today` holds the same rule for the photos.
   */
  feedLocked: boolean;
}

/** What the create-challenge form hands over. A task keeps its `id` when
 * it's being edited, so anything keyed by it survives the edit. */
export interface ChallengeInput {
  name: string;
  description: string;
  category?: ChallengeCategory;
  photos: readonly TaskPhoto[];
  tasks: readonly { id?: string; label: string; note?: string; perWeek?: number }[];
  days: number;
  startDate: Date;
  lives: number;
}

interface AppActions {
  setName: (name: string) => void;
  setBio: (bio: string | null) => void;
  setHandle: (handle: string) => void;
  setAvatarSeed: (seed: string | null) => void;
  setAvatarPhoto: (photo: TaskPhoto | null) => void;

  /**
   * Signs the pledge: joins the round of challenge `id` that starts on
   * `startDate`, with the reminders and weekdays picked while joining, and
   * loads it as yours. Rejects with the server's reason — most likely that
   * the round has already started.
   */
  selectChallenge: (id: string, startDate?: Date, reminders?: Reminders, schedule?: Schedule) => Promise<void>;
  /** Settings' End challenge: leaves the round you're in. */
  leaveChallenge: () => Promise<void>;
  /** Loads everything from the server again. */
  reload: () => Promise<void>;
  /** Clears `syncError` once its message has been shown. */
  clearSyncError: () => void;
  clearAvatarError: () => void;
  /** Builds a new challenge from the create form — its photos uploaded, it
   * and its round saved — and hands back its key once everyone can see it. */
  addChallenge: (input: ChallengeInput) => Promise<string>;
  /** Rewrites a challenge you built from the same form. Only before Day 1 —
   * once it has started, people have joined on its terms. */
  updateChallenge: (id: string, input: ChallengeInput) => Promise<void>;
  /** Takes a challenge you built down, its photos with it. */
  deleteChallenge: (id: string) => Promise<void>;
  setReminders: (reminders: Reminders) => void;

  /**
   * A task is only ever ticked off by photographing it, so the shot and the
   * tick land together rather than through two calls that could be left half
   * applied. Retaking a photo on an already-done task keeps it done.
   */
  completeTaskWithPhoto: (taskId: string, photo: TaskPhoto, day?: number, slot?: number) => void;
  /** The other half of that bargain: the tick goes, and the proof goes with it. */
  undoTask: (taskId: string, day?: number) => void;
  /** What you write under a day's post — only while it counts down to going
   * up. Empty text takes it off. */
  setCaption: (day: number, caption: string) => void;
  /** Slide to post: today's post goes up now, with `caption` under it,
   * rather than when its countdown runs out. */
  postNow: (caption: string) => void;
  resetAll: () => void;
}

type AppContextValue = AppState & AppActions;

const AppContext = createContext<AppContextValue | null>(null);

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/**
 * Days you are allowed to miss before the challenge is lost. Three whatever
 * the challenge and however long it runs — a rule you can hold in your head
 * is the point of it, and one that moved with the length would have to be
 * explained on every screen that shows it. A challenge you build yourself can
 * set its own on the create form; this is where that form starts.
 */
export const LIVES_PER_CHALLENGE = 3;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * What screens draw a challenge from while the account is in none — never
 * shown as yours (`inChallenge` is false), only there so a screen that needs
 * a challenge to lay out has one.
 */
const STAND_IN: Challenge = CHALLENGES[0];

/** Who the app holds before an account has loaded, and after logging out. */
const NO_PROFILE: Profile = { name: '', handle: '', bio: null, avatarSeed: null, avatar: null };

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(NO_PROFILE);

  const [challenge, setChallenge] = useState<Challenge>(STAND_IN);
  const [tasks, setTasksState] = useState<ChallengeTask[]>(() => [...STAND_IN.tasks]);
  const [catalog, setCatalog] = useState<Listing[]>([]);
  const customChallenges = useMemo(
    () => catalog.filter((listing) => listing.createdByMe).map((listing) => listing.challenge),
    [catalog],
  );
  const [startDate, setStartDateState] = useState<Date>(startOfToday);
  const [totalDays, setTotalDays] = useState(STAND_IN.defaultDays);
  const [progress, setProgress] = useState<Progress>({});
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [postsAt, setPostsAt] = useState<Record<number, number>>({});
  const [reminders, setRemindersState] = useState<Reminders>(DEFAULT_REMINDERS);
  const [schedule, setSchedule] = useState<Schedule>({});

  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [inChallenge, setInChallenge] = useState(false);
  const [membershipIdState, setMembership] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const clearSyncError = useCallback(() => setSyncError(null), []);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const clearAvatarError = useCallback(() => setAvatarError(null), []);
  // The server's ids behind what the app keys things by: the membership the
  // days belong to, and each task's uuid by its app id (a preset's own key,
  // "h1", so its bundled photos and reminders keep lining up).
  const membershipId = useRef<string | null>(null);
  const taskUuids = useRef<Record<string, string>>({});
  // The profile photo's path in storage, so changing it can remove the old
  // file; and the profile as it is now, for putting a face back if a new one
  // fails to upload.
  const avatarPath = useRef<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  /** Puts a loaded account in place of whatever was showing. */
  const applyAccount = useCallback(
    async (
      profileRow: api.ProfileRow,
      mine: Awaited<ReturnType<typeof api.fetchMyChallenge>>,
    ) => {
      setProfile({
        name: profileRow.name || profileRow.handle,
        handle: `@${profileRow.handle}`,
        bio: profileRow.bio,
        avatarSeed: null,
        avatar: profileRow.avatar_path ? { uri: publicUrl('avatars', profileRow.avatar_path) } : null,
      });
      avatarPath.current = profileRow.avatar_path;

      if (!mine) {
        membershipId.current = null;
        taskUuids.current = {};
        setInChallenge(false);
        setMembership(null);
        // A stand-in for screens that need a challenge to draw, with no
        // history behind it.
        setChallenge(STAND_IN);
        setTasksState([...STAND_IN.tasks]);
        setTotalDays(STAND_IN.defaultDays);
        setStartDateState(startOfToday());
        setProgress({});
        setCaptions({});
        setPostsAt({});
        setRemindersState(DEFAULT_REMINDERS);
        setSchedule({});
        return;
      }

      const { membership, round, challenge: row, completions, captions: savedCaptions } = mine;
      const appTaskId = (t: api.TaskRow) => t.key ?? t.id;
      const tasksNow: ChallengeTask[] = mine.tasks.map((t) => ({
        id: appTaskId(t),
        label: t.label,
        ...(t.note ? { note: t.note } : {}),
        ...(t.per_week < 7 ? { perWeek: t.per_week } : {}),
      }));
      const preset = row.slug ? challengeById(row.slug) : null;
      const built: Challenge = {
        id: row.slug ?? row.id,
        name: row.name,
        stamp: row.stamp,
        description: row.description,
        category: row.category ?? undefined,
        joined: preset?.joined ?? 0,
        photoSeeds: preset?.photoSeeds ?? [],
        photos: row.photo_paths.length
          ? row.photo_paths.map((path) => ({ uri: publicUrl('challenge-photos', path) }))
          : preset?.photos,
        tasks: tasksNow,
        defaultDays: round.days,
        startDate: round.start_date,
        lives: row.lives,
      };

      // Every photo of the run so far, signed in one call. Your own are
      // always yours to see, so none come back missing.
      const byUuid = Object.fromEntries(mine.tasks.map((t) => [t.id, appTaskId(t)]));
      // The server keeps the picks by uuid; the app keys tasks its own way.
      const picks = membership.schedule as Record<string, number[]>;
      const scheduleNow: Schedule = Object.fromEntries(
        Object.entries(picks).flatMap(([uuid, days]) => (byUuid[uuid] ? [[byUuid[uuid], days]] : [])),
      );
      const urls = await signedUrls(completions.flatMap((c) => [c.photo_path, c.thumb_path]));
      const loaded: Progress = {};
      for (const c of completions) {
        const taskId = byUuid[c.task_id];
        if (!taskId) continue;
        loaded[c.day] = {
          ...loaded[c.day],
          [taskId]: {
            done: true,
            time: timeStamp(new Date(c.completed_at)),
            photo: taskPhotoSource(urls, c.photo_path) ?? null,
            thumb: taskPhotoSource(urls, c.thumb_path) ?? null,
            photoSeed: null,
            slot: c.slot ?? undefined,
          },
        };
      }

      membershipId.current = membership.id;
      setMembership(membership.id);
      taskUuids.current = Object.fromEntries(mine.tasks.map((t) => [appTaskId(t), t.id]));
      setInChallenge(true);
      setChallenge(built);
      setTasksState(tasksNow);
      setTotalDays(round.days);
      setStartDateState(localDay(round.start_date));
      setProgress(loaded);
      setCaptions(savedCaptions);
      setPostsAt(mine.postsAt);
      setRemindersState(membership.reminders as unknown as Reminders);
      setSchedule(scheduleNow);
    },
    [],
  );

  // When the account last loaded, so coming back to the app can tell whether
  // its photo links are about to run out.
  const loadedAt = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [profileRow, mine, listings] = await Promise.all([
        api.fetchProfile(userId),
        api.fetchMyChallenge(),
        fetchCatalog(),
      ]);
      await applyAccount(profileRow, mine);
      setCatalog(listings);
      setLoadFailed(false);
      loadedAt.current = Date.now();
    } catch {
      setLoadFailed(true);
    }
  }, [userId, applyAccount]);

  // A new session loads its account; the splash waits on `ready`. Signed
  // out there is nothing to load — the sign-in page doesn't read this state.
  useEffect(() => {
    if (!userId) {
      setReady(false);
      return;
    }
    let live = true;
    setReady(false);
    reload().finally(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, [userId, reload]);

  // The calendar day the app is on. A phone keeps the app alive in the
  // background for hours, so it can't be read once: it moves on at midnight
  // while the app is open, and when the app comes back to the front on a new
  // day. A new day loads the account again — the server may have settled
  // the run overnight — and so does coming back once the photo links have
  // all but run out.
  const [today, setToday] = useState(startOfToday);
  useEffect(() => {
    const check = () => {
      const now = startOfToday();
      if (now.getTime() !== today.getTime()) setToday(now);
      else if (Date.now() - loadedAt.current > SIGNED_URL_SECONDS * 1000 * 0.8) reload();
    };
    const sub = AppLifecycle.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    // A second past midnight, so the clock has certainly turned.
    const timer = setTimeout(check, today.getTime() + DAY_MS - Date.now() + 1000);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [today, reload]);

  const firstDay = useRef(today);
  useEffect(() => {
    if (today !== firstDay.current) reload();
  }, [today, reload]);

  // -- derived ---------------------------------------------------------------

  // Rounded, not floored: across the spring's clock change the two
  // midnights are an hour short of whole days apart.
  const currentDay = useMemo(() => {
    const elapsed = Math.round((today.getTime() - startDate.getTime()) / DAY_MS);
    return Math.min(Math.max(elapsed + 1, 1), totalDays);
  }, [today, startDate, totalDays]);

  const daysUntilStart = useMemo(
    () => Math.max(0, Math.round((startDate.getTime() - today.getTime()) / DAY_MS)),
    [today, startDate],
  );

  const tasksOn = useCallback(
    (day: number) => dueOn(tasks, schedule, startDate, day),
    [tasks, schedule, startDate],
  );
  const todayTasks = useMemo(() => tasksOn(currentDay), [tasksOn, currentDay]);

  /**
   * Only days that are fully behind you can be missed — today is still open
   * however little of it is ticked, which is why the walk stops short of
   * `currentDay` rather than including it. A rest day has nothing due, so
   * it never is.
   */
  const missedDays = useMemo(() => {
    let missed = 0;
    for (let day = 1; day < currentDay; day += 1) {
      const rows = progress[day];
      if (!tasksOn(day).every((t) => rows?.[t.id]?.done)) missed += 1;
    }
    return missed;
  }, [progress, currentDay, tasksOn]);

  // Floored rather than left negative: past the allowance the challenge is
  // lost, and how far past says nothing more than that.
  const livesTotal = challenge.lives ?? LIVES_PER_CHALLENGE;
  const livesLeft = Math.max(0, livesTotal - missedDays);

  // Today only, not the challenge's whole history — the gate this feeds
  // asks what today has proven, so an old streak can't stand in for a photo
  // that still hasn't been taken since.
  // A shot still uploading doesn't count yet: the server only signs anyone
  // else's today once yours is in, so opening the lock any sooner would show
  // Community's posts with nothing in them.
  const hasPhotographedTask = useMemo(
    () =>
      Object.values(progress[currentDay] ?? {}).some(
        (entry) => entry.done && entry.photo && !entry.pending,
      ),
    [progress, currentDay],
  );

  // A rest day has nothing to photograph, so nothing to prove.
  const feedLocked = inChallenge && daysUntilStart === 0 && todayTasks.length > 0 && !hasPhotographedTask;

  // -- actions ---------------------------------------------------------------

  const setName = useCallback((name: string) => {
    setProfile((p) => ({ ...p, name }));
  }, []);

  const setBio = useCallback((bio: string | null) => {
    setProfile((p) => ({ ...p, bio }));
  }, []);

  const setHandle = useCallback((handle: string) => {
    setProfile((p) => ({ ...p, handle }));
  }, []);

  const setAvatarSeed = useCallback((avatarSeed: string | null) => {
    setProfile((p) => ({ ...p, avatarSeed }));
  }, []);

  /**
   * A new face shows at once and uploads behind it; the old file is removed
   * once the new one is in. Removing the photo clears it on the account too.
   * If the upload fails, the previous face comes back and `syncError` says
   * why.
   */
  const setAvatarPhoto = useCallback(
    (avatar: TaskPhoto | null) => {
      const before = profileRef.current.avatar;
      setProfile((p) => ({ ...p, avatar }));
      if (!userId) return;

      const uri = avatar && typeof avatar === 'object' && 'uri' in avatar ? avatar.uri : undefined;
      const oldPath = avatarPath.current;
      (async () => {
        const nextPath = uri ? await uploadPublicPhoto('avatars', userId, { uri }) : null;
        try {
          await api.updateProfile({ avatar_path: nextPath });
        } catch (e) {
          // The account still points at the old face, so the new file stands
          // for nothing.
          if (nextPath) await removePhotos('avatars', [nextPath]).catch(() => {});
          throw e;
        }
        avatarPath.current = nextPath;
        if (oldPath) await removePhotos('avatars', [oldPath]);
      })().catch((e: unknown) => {
        setProfile((p) => (p.avatar === avatar ? { ...p, avatar: before } : p));
        setAvatarError(e instanceof Error ? e.message : 'Your photo didn’t save. Try again.');
      });
    },
    [userId],
  );

  const selectChallenge = useCallback(
    async (id: string, start?: Date, picked?: Reminders, days?: Schedule) => {
      // The round its page showed — the one the pledge was read against.
      const listing = catalog.find((l) => l.key === id);
      const day = start ? isoDay(start) : null;
      if (!listing || (day && listing.section.startDate !== day)) {
        throw new Error('That round isn’t open to join any more.');
      }
      await api.joinRound(listing.section.roundId, picked ?? reminders, days ?? {});
      await reload();
    },
    [catalog, reminders, reload],
  );

  const leaveChallenge = useCallback(async () => {
    await api.leaveRound();
    await reload();
  }, [reload]);

  // Kept on the membership too, so a reinstall or a new phone has them.
  const setReminders = useCallback((next: Reminders) => {
    setRemindersState(next);
    if (membershipId.current) api.setReminders(next).catch(() => {});
  }, []);

  /**
   * The form's cover photos as storage paths: ones already up (an edit's
   * own) are kept where they are, new picks are uploaded first.
   */
  const coverPaths = useCallback(
    async (photos: readonly TaskPhoto[]) => {
      if (!userId) throw new Error('Sign in first');
      return Promise.all(
        photos.map(async (photo) => {
          const uri = typeof photo === 'object' && photo && 'uri' in photo ? photo.uri : undefined;
          if (!uri) throw new Error('Pick your photos from your library.');
          const saved = storedPath('challenge-photos', uri);
          return saved ?? uploadPublicPhoto('challenge-photos', userId, { uri });
        }),
      );
    },
    [userId],
  );

  const formOf = (input: ChallengeInput, photoPaths: string[]): api.ChallengeForm => ({
    name: input.name,
    description: input.description,
    category: input.category,
    photoPaths,
    tasks: input.tasks,
    days: input.days,
    startDate: isoDay(input.startDate),
    lives: input.lives,
  });

  const addChallenge = useCallback(
    async (input: ChallengeInput) => {
      const photoPaths = await coverPaths(input.photos);
      try {
        const id = await api.addChallenge(formOf(input, photoPaths));
        await reload();
        return id;
      } catch (e) {
        // Not saved, so the photos just uploaded have nothing to stand for.
        await removePhotos('challenge-photos', photoPaths);
        throw e;
      }
    },
    [coverPaths, reload],
  );

  const updateChallenge = useCallback(
    async (id: string, input: ChallengeInput) => {
      const listing = catalog.find((l) => l.key === id);
      if (!listing) throw new Error('That era is gone.');
      const photoPaths = await coverPaths(input.photos);
      await api.updateChallenge(listing.challengeId, formOf(input, photoPaths));
      // Photos taken off the challenge aren't needed any more.
      await removePhotos('challenge-photos', listing.photoPaths.filter((p) => !photoPaths.includes(p)));
      await reload();
    },
    [catalog, coverPaths, reload],
  );

  const deleteChallenge = useCallback(
    async (id: string) => {
      const listing = catalog.find((l) => l.key === id);
      if (!listing) return;
      await api.deleteChallenge(listing.challengeId);
      await removePhotos('challenge-photos', [...listing.photoPaths]);
      await reload();
    },
    [catalog, reload],
  );

  /** Puts one task's entry for one day in place — `undefined` clears it. */
  const putEntry = useCallback((day: number, taskId: string, entry: TaskProgress | undefined) => {
    setProgress((prev) => {
      const dayMap = { ...prev[day] };
      if (entry) dayMap[taskId] = entry;
      else delete dayMap[taskId];
      return { ...prev, [day]: dayMap };
    });
  }, []);

  // Read inside the actions below, which run long after they were made: the
  // upload takes seconds, and the day's entries may have moved on meanwhile.
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const postsAtRef = useRef(postsAt);
  postsAtRef.current = postsAt;
  const captionsRef = useRef(captions);
  captionsRef.current = captions;

  /** Starts, moves or stops one day's countdown — `undefined` stops it. */
  const putPostsAt = useCallback((day: number, at: number | undefined) => {
    setPostsAt((prev) => {
      const next = { ...prev };
      if (at === undefined) delete next[day];
      else next[day] = at;
      return next;
    });
  }, []);

  /** A finished day whose countdown has run out can't change any more. */
  const dayIsUp = useCallback((day: number) => {
    const at = postsAtRef.current[day];
    return at !== undefined && isPosted(at);
  }, []);

  /**
   * The shot shows at once, ticked, and goes up behind it: the full photo
   * and its thumbnail into today's folder, then the tick against them. If
   * that fails — no signal, or midnight passed mid-upload — the task goes
   * back to how it was and `syncError` says why. The day's last photo
   * starts its countdown to going up; once that has run out, nothing
   * changes.
   */
  const completeTaskWithPhoto = useCallback(
    (taskId: string, photo: TaskPhoto, day?: number, slot?: number) => {
      const target = day ?? currentDay;
      if (dayIsUp(target)) {
        setSyncError('Today’s post is already up, so it can’t change now.');
        return;
      }
      const before = progressRef.current[target]?.[taskId];
      const uri = typeof photo === 'object' && photo && 'uri' in photo ? photo.uri : undefined;
      const mid = membershipId.current;
      const uuid = taskUuids.current[taskId];
      const saving = Boolean(mid && uuid && uri);

      putEntry(target, taskId, {
        ...before,
        done: true,
        // Retaking leaves the original stamp alone: the task was done when
        // it was first photographed, not when it was reshot.
        time: before?.done ? before.time : timeStamp(new Date()),
        photo,
        // The shot on the phone draws the small tiles too, rather than a
        // retake leaving the last shot's thumbnail behind.
        thumb: null,
        // A real photo replaces the seeded stand-in rather than sitting
        // behind it.
        photoSeed: null,
        // A retake without a cell of its own stays where it was.
        slot: slot ?? before?.slot,
        pending: saving,
      });

      // The shot that finishes the day starts its countdown here at once;
      // the server's own time takes over once the save lands.
      const finishes =
        postsAtRef.current[target] === undefined &&
        tasksOn(target).every((task) => task.id === taskId || progressRef.current[target]?.[task.id]?.done);
      if (finishes) putPostsAt(target, Date.now() + POST_COUNTDOWN_MS);
      if (!saving) return;

      api
        .completeTaskWithPhoto(mid!, target, uuid, { uri: uri! }, slot)
        .then(({ postsAt: at }) => {
          const now = progressRef.current[target]?.[taskId];
          // Only if it's still this shot showing — a quick retake or undo
          // meanwhile has its own save to settle it.
          if (now?.photo === photo) {
            putEntry(target, taskId, { ...now, pending: false });
            if (at !== null) putPostsAt(target, at);
          }
        })
        .catch((e: unknown) => {
          const now = progressRef.current[target]?.[taskId];
          if (now?.photo === photo) {
            putEntry(target, taskId, before);
            if (finishes) putPostsAt(target, undefined);
          }
          setSyncError(e instanceof Error ? e.message : 'Your photo didn’t save. Try again.');
        });
    },
    [currentDay, tasksOn, putEntry, putPostsAt, dayIsUp],
  );

  /** The other half of that bargain: the tick goes, and the proof goes with
   * it — on the server too, where only today's can be undone. Taking a
   * photo out of a finished day stops its countdown; once the day is up,
   * its photos stay. */
  const undoTask = useCallback(
    (taskId: string, day?: number) => {
      const target = day ?? currentDay;
      if (dayIsUp(target)) {
        setSyncError('Today’s post is already up, so it can’t change now.');
        return;
      }
      const before = progressRef.current[target]?.[taskId];
      const countdown = postsAtRef.current[target];
      putEntry(target, taskId, undefined);
      putPostsAt(target, undefined);

      const uuid = taskUuids.current[taskId];
      if (!membershipId.current || !uuid) return;
      api.undoTask(uuid).catch((e: unknown) => {
        // Still there on the server, so it comes back here too.
        if (!progressRef.current[target]?.[taskId]) {
          putEntry(target, taskId, before);
          if (countdown !== undefined) putPostsAt(target, countdown);
        }
        setSyncError(e instanceof Error ? e.message : 'That didn’t undo. Try again.');
      });
    },
    [currentDay, putEntry, putPostsAt, dayIsUp],
  );

  const setCaption = useCallback(
    (day: number, caption: string) => {
      if (dayIsUp(day)) {
        setSyncError('Today’s post is already up, so its caption can’t change now.');
        return;
      }
      const before = captionsRef.current[day];
      const text = caption.trim();
      setCaptions((prev) => {
        const next = { ...prev };
        if (text) next[day] = text;
        else delete next[day];
        return next;
      });

      const mid = membershipId.current;
      if (!mid) return;
      api.setCaption(mid, day, text).catch((e: unknown) => {
        // Only if nothing newer has been written over it meanwhile.
        if ((captionsRef.current[day] ?? '') === text) {
          setCaptions((prev) => {
            const next = { ...prev };
            if (before) next[day] = before;
            else delete next[day];
            return next;
          });
        }
        setSyncError(e instanceof Error ? e.message : 'Your caption didn’t save. Try again.');
      });
    },
    [dayIsUp],
  );

  const postNow = useCallback(
    (caption: string) => {
      const day = currentDay;
      const countdown = postsAtRef.current[day];
      if (countdown === undefined || dayIsUp(day)) return;
      const before = captionsRef.current[day];
      const text = caption.trim();
      const captionChanged = text !== (before ?? '');
      setCaptions((prev) => {
        const next = { ...prev };
        if (text) next[day] = text;
        else delete next[day];
        return next;
      });
      putPostsAt(day, Date.now());

      const mid = membershipId.current;
      if (!mid) return;
      // The caption first, while the countdown still lets it be written.
      (captionChanged ? api.setCaption(mid, day, text) : Promise.resolve())
        .then(() => api.postNow())
        .then((at) => {
          if (at !== null) putPostsAt(day, at);
        })
        .catch((e: unknown) => {
          // Not up after all: the countdown and the caption as they were.
          putPostsAt(day, countdown);
          setCaptions((prev) => {
            const next = { ...prev };
            if (before) next[day] = before;
            else delete next[day];
            return next;
          });
          setSyncError(e instanceof Error ? e.message : 'Your post didn’t go up. Try again.');
        });
    },
    [currentDay, dayIsUp, putPostsAt],
  );

  // Logging out: forget the account on this phone. The next sign-in loads
  // its own.
  const resetAll = useCallback(() => {
    setChallenge(STAND_IN);
    setTasksState([...STAND_IN.tasks]);
    setStartDateState(startOfToday());
    setTotalDays(STAND_IN.defaultDays);
    setProgress({});
    setCaptions({});
    setPostsAt({});
    setProfile(NO_PROFILE);
    // Only this phone's copy: a reset happens on logging out, and the
    // account keeps its reminders for the next sign-in.
    setRemindersState(DEFAULT_REMINDERS);
    setSchedule({});
    membershipId.current = null;
    taskUuids.current = {};
    avatarPath.current = null;
    setInChallenge(false);
    setMembership(null);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      challenge,
      tasks,
      startDate,
      totalDays,
      progress,
      captions,
      postsAt,
      catalog,
      customChallenges,
      reminders,
      schedule,
      tasksOn,
      todayTasks,
      currentDay,
      livesTotal,
      livesLeft,
      hasPhotographedTask,
      feedLocked,
      inChallenge,
      membershipId: membershipIdState,
      daysUntilStart,
      ready,
      loadFailed,
      syncError,
      clearSyncError,
      avatarError,
      clearAvatarError,

      setName,
      setBio,
      setHandle,
      setAvatarSeed,
      setAvatarPhoto,
      selectChallenge,
      leaveChallenge,
      reload,
      addChallenge,
      updateChallenge,
      deleteChallenge,
      setReminders,
      completeTaskWithPhoto,
      undoTask,
      setCaption,
      postNow,
      resetAll,
    }),
    [
      profile, challenge, tasks, startDate, totalDays,
      progress, captions, postsAt,
      catalog, customChallenges, reminders, schedule, tasksOn, todayTasks,
      currentDay, livesLeft, hasPhotographedTask, feedLocked, inChallenge, membershipIdState, daysUntilStart, ready,
      loadFailed, syncError, clearSyncError, avatarError, clearAvatarError,
      setName, setBio, setHandle, setAvatarSeed, setAvatarPhoto, selectChallenge, leaveChallenge,
      reload, setReminders, addChallenge,
      updateChallenge, deleteChallenge,
      completeTaskWithPhoto, undoTask, setCaption, postNow,
      resetAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Re-exported where the screens already reach for it. */
export { orderBySlot };

/** Progress for one day in its grid's order — only the tasks due that day —
 * defaulted so callers never deal with undefined. */
export function useDayProgress(day: number) {
  const { progress, tasksOn } = useApp();
  return useMemo(() => {
    const map = progress[day] ?? {};
    return orderBySlot(tasksOn(day), map).map((task) => ({
      task,
      ...(map[task.id] ?? { done: false, photoSeed: null }),
    }));
  }, [progress, day, tasksOn]);
}

/** Every day so far with at least one photographed task, most recent first —
 * the profile grid and the day pager both read this same order, so paging
 * through an opened post lands on exactly the next tile down the grid. */
export function usePostedDays(): number[] {
  const { currentDay, tasks, progress } = useApp();
  return useMemo(() => {
    const days: number[] = [];
    for (let day = currentDay; day >= 1; day -= 1) {
      const posted = tasks.some((task) => {
        const entry = progress[day]?.[task.id];
        return entry?.photo || entry?.photoSeed;
      });
      if (posted) days.push(day);
    }
    return days;
  }, [currentDay, tasks, progress]);
}

/**
 * How long an era runs, by its key, for a cover's "of 75": the catalog's
 * listing of it, or the preset it is. Undefined for one the app can't see.
 */
export function useEraLength(): (id: string | undefined) => number | undefined {
  const { catalog } = useApp();
  return useCallback(
    (id: string | undefined) =>
      catalog.find((listing) => listing.key === id)?.challenge.defaultDays ??
      CHALLENGES.find((preset) => preset.id === id)?.defaultDays,
    [catalog],
  );
}
