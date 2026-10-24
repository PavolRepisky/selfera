-- Selfera's database from scratch: one migration for everything up to the
-- wipe of 2026-10-25, which folded the fourteen before it into this. Later
-- changes are new migrations after it, never edits to it.
--
-- In order: accounts; challenges, rounds and memberships; a day's work and
-- the post countdown; friends, comments, reactions, notifications and the
-- Community feed; where photos live; the job that settles runs; and the
-- preset challenges every environment ships with.

-- ===========================================================================
-- Accounts
-- ===========================================================================

-- Accounts. A profile is created for every sign-up by the trigger at the
-- bottom, so the app never has to insert one itself — it only ever edits its
-- own. Profiles are public to anyone signed in: the app shows anyone's page.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  -- Stored without the leading "@", which is only how the app prints it.
  -- Lowercase only, so "Julia_575" and "julia_575" can't both exist.
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  name text not null default '' check (char_length(name) <= 50),
  bio text check (char_length(bio) <= 150),
  -- Path in the public `avatars` bucket.
  avatar_path text,
  -- The IANA zone the phone reports. A challenge day runs midnight to
  -- midnight where its member lives, so every "which day is it" question the
  -- server answers is asked in this zone.
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are public"
  on public.profiles for select to authenticated
  using (true);

create policy "edit your own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Only these columns are the account's to change; the id and creation stamp
-- are not, whatever the row policy says.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (handle, name, bio, avatar_path, timezone) on public.profiles to authenticated;

-- A zone Postgres doesn't know would make every day calculation for this
-- account throw, so it's refused at the door instead. A trigger rather than a
-- CHECK because the list of zones isn't immutable.
create function public.check_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;

create trigger profiles_check_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.check_timezone();

-- Today's date where this account lives.
create function public.local_today(uid uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = uid), 'UTC'))::date
$$;

-- Every new auth user gets a profile. Apple and Google hand over a full name
-- (Apple only on the very first sign-in, so it's caught here or never); the
-- handle starts from the first name plus four digits and can be changed in
-- Settings.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  display text := btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''));
  base text;
  candidate text;
begin
  base := lower(regexp_replace(
    coalesce(nullif(split_part(display, ' ', 1), ''), split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'));
  base := left(base, 20);
  if char_length(base) < 3 then
    base := 'selfera';
  end if;

  loop
    candidate := base || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where handle = candidate);
  end loop;

  insert into public.profiles (id, handle, name) values (new.id, candidate, left(display, 50));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Challenges, rounds, memberships
-- ===========================================================================

-- Challenges, the rounds they run in, and who is in them.
--
-- A challenge is the recipe: a name, its tasks, how many days, how many lives.
-- A round is one run of it with a Day 1 everyone in it shares — joining shuts
-- once that day has passed. A membership is one person signed up to a round.
--
-- Nothing here is written to directly from the app. Every write goes through
-- one of the functions at the bottom, which check the rules a row policy
-- can't express (Day 1 not yet passed, only the creator, one round at a
-- time) and keep multi-row changes whole.

create type public.challenge_category as enum ('Fitness', 'Health', 'Mindset', 'Lifestyle', 'Study');

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  -- Set on the presets only: the key the app files their bundled photos
  -- under ("selfera", "hard", …). A challenge without one was built by a user.
  slug text unique,
  -- Who started it — shown as "Created by". Kept when that account is
  -- deleted would mean a dangling face, so it falls back to nobody instead,
  -- and the challenge stays for everyone already in it.
  creator_id uuid references public.profiles on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  stamp text not null default 'Custom' check (char_length(stamp) <= 40),
  description text not null default '' check (char_length(description) <= 500),
  category public.challenge_category,
  default_days int not null check (default_days between 1 and 365),
  -- Days anyone in it may miss before their run ends.
  lives int not null default 3 check (lives between 0 and 10),
  -- Paths in the public `challenge-photos` bucket, for a challenge built in
  -- the app. The presets use the photos bundled with the app instead.
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index challenges_creator_idx on public.challenges (creator_id);

create table public.challenge_tasks (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  -- The preset's own task key ("h1"), which the app's bundled photos
  -- are filed under. Null for tasks written on the create form.
  key text,
  position int not null check (position >= 0),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  -- One line on how to do it, so everyone's photo proves the same thing.
  note text check (char_length(note) <= 140),
  -- Deferred so an edit can reorder tasks in one statement without two
  -- briefly sharing a position.
  constraint challenge_tasks_position_key unique (challenge_id, position) deferrable initially deferred
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  -- Day 1, a calendar date: each member's Day 1 starts at midnight where
  -- they live, so a round in Sydney and one in New York begin on the same
  -- date, not the same instant.
  start_date date not null,
  days int not null check (days between 1 and 365),
  created_at timestamptz not null default now()
);

create index rounds_challenge_idx on public.rounds (challenge_id);
create index rounds_start_idx on public.rounds (start_date);

create type public.membership_status as enum (
  -- Signed up and still in it — including before Day 1.
  'active',
  -- Missed more days than the challenge's lives allow.
  'lost',
  -- Reached the end with lives to spare.
  'finished',
  -- Ended it from Settings, or swapped to another challenge.
  'left'
);

-- The two nudges picked while joining: a time for each task by task id, and
-- the last call, as minutes after midnight, or null for Never. The phone
-- schedules them itself; the server only keeps them so they survive a
-- reinstall or a new phone.
create function public.valid_reminders(r jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(r) = 'object'
    and jsonb_typeof(r -> 'tasks') = 'object'
    and jsonb_typeof(r -> 'lastCall') in ('null', 'number')
    and (jsonb_typeof(r -> 'lastCall') = 'null' or (r ->> 'lastCall')::numeric between 0 and 1439)
    and not exists (
      select 1 from jsonb_each(r -> 'tasks') e
      where not (
        jsonb_typeof(e.value) = 'null'
        or (jsonb_typeof(e.value) = 'number' and (e.value #>> '{}')::numeric between 0 and 1439)
      )
    ),
    false)
$$;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  status public.membership_status not null default 'active',
  -- Signing the pledge is what joins.
  signed_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Ten at night by default: two hours before midnight ends the day.
  reminders jsonb not null default '{"tasks": {}, "lastCall": 1320}'
    check (public.valid_reminders(reminders)),
  unique (round_id, user_id)
);

-- One challenge at a time, the way the app's Tasks tab only ever shows one.
create unique index memberships_one_active on public.memberships (user_id) where status = 'active';
create index memberships_round_idx on public.memberships (round_id, status);

alter table public.challenges enable row level security;
alter table public.challenge_tasks enable row level security;
alter table public.rounds enable row level security;
alter table public.memberships enable row level security;

create policy "challenges are public" on public.challenges for select to authenticated using (true);
create policy "tasks are public" on public.challenge_tasks for select to authenticated using (true);
create policy "rounds are public" on public.rounds for select to authenticated using (true);
-- Who's in a round is public: the challenge page shows its members, and
-- profiles are public.
create policy "memberships are public" on public.memberships for select to authenticated using (true);

revoke insert, update, delete on public.challenges, public.challenge_tasks, public.rounds, public.memberships
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return uid;
end $$;

-- Which day of its round a membership is on, in its member's own zone. Zero
-- or less before Day 1, past `days` once the round is over — callers clamp
-- to what they need.
create function public.member_day(mid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select public.local_today(m.user_id) - r.start_date + 1
  from public.memberships m
  join public.rounds r on r.id = m.round_id
  where m.id = mid
$$;

-- The account's current challenge, if it has one.
create function public.my_membership_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.memberships where user_id = auth.uid() and status = 'active'
$$;

-- Writes the form's task list onto a challenge: tasks handed back with an id
-- are kept (so photos and reminders keyed by it survive an edit), new ones
-- are added, and any left out are removed. Order is the list's own.
create function public.write_challenge_tasks(cid uuid, tasks jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  kept uuid[];
begin
  if jsonb_typeof(tasks) is distinct from 'array' or jsonb_array_length(tasks) not between 1 and 12 then
    raise exception 'a challenge needs between 1 and 12 tasks' using errcode = '22023';
  end if;

  kept := array(
    select (t ->> 'id')::uuid from jsonb_array_elements(tasks) t
    where nullif(t ->> 'id', '') is not null);

  if exists (
    select 1 from unnest(kept) k
    where not exists (select 1 from public.challenge_tasks ct where ct.id = k and ct.challenge_id = cid)
  ) then
    raise exception 'unknown task id' using errcode = '22023';
  end if;

  delete from public.challenge_tasks where challenge_id = cid and id <> all (kept);

  insert into public.challenge_tasks (id, challenge_id, position, label, note)
  select coalesce(nullif(t ->> 'id', '')::uuid, gen_random_uuid()), cid, (ord - 1)::int,
         btrim(t ->> 'label'), nullif(btrim(coalesce(t ->> 'note', '')), '')
  from jsonb_array_elements(tasks) with ordinality as x(t, ord)
  on conflict (id) do update
    set position = excluded.position, label = excluded.label, note = excluded.note;
end $$;

-- Challenge photos must be the creator's own uploads.
create function public.check_own_paths(uid uuid, paths jsonb) returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  result text[] := array(select jsonb_array_elements_text(coalesce(paths, '[]'::jsonb)));
begin
  if exists (select 1 from unnest(result) p where p not like uid::text || '/%') then
    raise exception 'photos must be uploaded to your own folder' using errcode = '42501';
  end if;
  if cardinality(result) > 6 then
    raise exception 'at most 6 photos' using errcode = '22023';
  end if;
  return result;
end $$;

revoke execute on function public.write_challenge_tasks(uuid, jsonb), public.check_own_paths(uuid, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the app calls
-- ---------------------------------------------------------------------------

-- The create form: { name, description, category?, photo_paths[], tasks:
-- [{ label, note? }], days, start_date, lives }. Builds the challenge and its
-- one round, and hands back the challenge id. It doesn't join you — signing
-- the pledge does that.
create function public.create_challenge(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  start date := (p ->> 'start_date')::date;
  cid uuid;
begin
  if start is null or start < public.local_today(uid) then
    raise exception 'Day 1 can''t be in the past' using errcode = '22023';
  end if;

  insert into public.challenges (creator_id, name, description, category, default_days, lives, photo_paths)
  values (
    uid,
    btrim(p ->> 'name'),
    coalesce(p ->> 'description', ''),
    nullif(p ->> 'category', '')::public.challenge_category,
    (p ->> 'days')::int,
    coalesce((p ->> 'lives')::int, 3),
    public.check_own_paths(uid, p -> 'photo_paths'))
  returning id into cid;

  perform public.write_challenge_tasks(cid, p -> 'tasks');
  insert into public.rounds (challenge_id, start_date, days) values (cid, start, (p ->> 'days')::int);
  return cid;
end $$;

-- Rewrites a challenge you built from the same form. Only before Day 1 —
-- once it has started, people have joined on its terms.
create function public.update_challenge(cid uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  c public.challenges;
  r public.rounds;
  start date := (p ->> 'start_date')::date;
begin
  select * into c from public.challenges where id = cid for update;
  if not found or c.creator_id is distinct from uid or c.slug is not null then
    raise exception 'only its creator can edit this challenge' using errcode = '42501';
  end if;

  select * into r from public.rounds where challenge_id = cid order by start_date limit 1 for update;
  if public.local_today(uid) >= r.start_date then
    raise exception 'this challenge has already started' using errcode = 'P0001';
  end if;
  if start is null or start < public.local_today(uid) then
    raise exception 'Day 1 can''t be in the past' using errcode = '22023';
  end if;

  update public.challenges set
    name = btrim(p ->> 'name'),
    description = coalesce(p ->> 'description', ''),
    category = nullif(p ->> 'category', '')::public.challenge_category,
    default_days = (p ->> 'days')::int,
    lives = coalesce((p ->> 'lives')::int, lives),
    photo_paths = public.check_own_paths(uid, p -> 'photo_paths')
  where id = cid;

  perform public.write_challenge_tasks(cid, p -> 'tasks');
  update public.rounds set start_date = start, days = (p ->> 'days')::int where id = r.id;
end $$;

-- Takes a challenge you built down, with everyone's place in it.
create function public.delete_challenge(cid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
begin
  delete from public.challenges where id = cid and creator_id = uid and slug is null;
  if not found then
    raise exception 'only its creator can delete this challenge' using errcode = '42501';
  end if;
end $$;

-- Signing the pledge. Joining shuts once Day 1 has passed where you live.
-- Being in one challenge at a time, joining a new one ends the one you were
-- on, the way picking a challenge in the app always has.
create function public.join_round(rid uuid, reminders jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  r public.rounds;
  mid uuid;
begin
  select * into r from public.rounds where id = rid;
  if not found then
    raise exception 'no such round' using errcode = 'P0002';
  end if;
  if public.local_today(uid) > r.start_date then
    raise exception 'joining closed when this round started' using errcode = 'P0001';
  end if;

  update public.memberships set status = 'left', ended_at = now()
  where user_id = uid and status = 'active' and round_id <> rid;

  insert into public.memberships (round_id, user_id, reminders)
  values (rid, uid, coalesce(reminders, '{"tasks": {}, "lastCall": 1320}'))
  on conflict (round_id, user_id) do update
    set status = 'active', ended_at = null, signed_at = now(),
        reminders = coalesce(join_round.reminders, public.memberships.reminders)
  returning id into mid;
  return mid;
end $$;

-- Settings' Reminders sheet.
create function public.set_reminders(reminders jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
begin
  update public.memberships set reminders = set_reminders.reminders
  where user_id = uid and status = 'active';
  if not found then
    raise exception 'you are not in a challenge' using errcode = 'P0002';
  end if;
end $$;

-- Settings' End challenge.
create function public.leave_round() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
begin
  update public.memberships set status = 'left', ended_at = now()
  where user_id = uid and status = 'active';
end $$;

revoke execute on function
  public.create_challenge(jsonb), public.update_challenge(uuid, jsonb), public.delete_challenge(uuid),
  public.join_round(uuid, jsonb), public.set_reminders(jsonb), public.leave_round()
  from public, anon;
grant execute on function
  public.create_challenge(jsonb), public.update_challenge(uuid, jsonb), public.delete_challenge(uuid),
  public.join_round(uuid, jsonb), public.set_reminders(jsonb), public.leave_round()
  to authenticated;

-- ===========================================================================
-- A day's work
-- ===========================================================================

-- A day's work: each task ticked off by photographing it, and the caption
-- written under the day's post.
--
-- A task can only ever be done *today* — today where its member lives. The
-- app used to let any day be written; the server doesn't, so a missed day
-- stays missed and lives mean something.

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships on delete cascade,
  task_id uuid not null references public.challenge_tasks on delete cascade,
  day int not null check (day >= 1),
  -- The proof, full size and as a grid thumbnail, in the private
  -- `task-photos` bucket under `<user>/<membership>/<day>/`. Both sizes are
  -- made on the phone: the storage's own resizing bills per source image,
  -- and every completion is a new one.
  photo_path text not null,
  thumb_path text not null,
  -- Which cell of the day's grid it was shot into, in the grid's own order.
  -- Null lets the task take the first free cell.
  slot int check (slot between 0 and 11),
  -- When the task was first done. A retake replaces the photo but not this:
  -- the task was done when it was first photographed.
  completed_at timestamptz not null default now(),
  photo_updated_at timestamptz not null default now(),
  unique (membership_id, task_id, day)
);

create index task_completions_day_idx on public.task_completions (membership_id, day);

create table public.day_captions (
  membership_id uuid not null references public.memberships on delete cascade,
  day int not null check (day >= 1),
  caption text not null check (char_length(btrim(caption)) between 1 and 500),
  updated_at timestamptz not null default now(),
  primary key (membership_id, day)
);

alter table public.task_completions enable row level security;
alter table public.day_captions enable row level security;

-- Who did what and when is public, like the profile it shows on. The photos
-- themselves are guarded separately, by the storage policies — that's where
-- the Community lock lives.
create policy "completions are public" on public.task_completions for select to authenticated using (true);
create policy "captions are public" on public.day_captions for select to authenticated using (true);

revoke insert, update, delete on public.task_completions from anon, authenticated;

-- Whether a membership is the signed-in account's own.
create function public.owns_membership(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships where id = mid and user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- The post countdown
-- ---------------------------------------------------------------------------

-- A finished day doesn't go up the moment its last photo lands. A short
-- countdown starts first, and until it runs out the day can still be
-- reshot, a photo taken back out, or its caption written — a last look
-- before friends see it. Once it runs out the post is up and fixed.
-- Taking a photo back out stops the countdown; the day's last photo going
-- in again starts it over from the top.
--
-- A minute and a half: long enough to look the post over and write a line
-- under it, short enough that a friend refreshing Community isn't kept
-- waiting on it.

create table public.day_posts (
  membership_id uuid not null references public.memberships on delete cascade,
  day int not null check (day >= 1),
  -- When the day goes up on Community, and stops taking changes.
  posts_at timestamptz not null,
  primary key (membership_id, day)
);

alter table public.day_posts enable row level security;

-- When someone's post goes up is no more private than the post itself.
create policy "post times are public" on public.day_posts for select to authenticated using (true);
revoke insert, update, delete on public.day_posts from anon, authenticated;

create function public.post_countdown() returns interval
language sql immutable as $$ select interval '90 seconds' $$;

-- Whether a member's day is up and so can't be changed any more. A day
-- whose countdown never started — not finished, or finished before
-- countdowns existed — isn't.
create function public.day_posted(mid uuid, d int) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.day_posts
    where membership_id = mid and day = d and posts_at <= now()
  )
$$;

-- Whether a member's day is in its countdown — the only time its caption
-- can be written.
create function public.day_counting_down(mid uuid, d int) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.day_posts
    where membership_id = mid and day = d and posts_at > now()
  )
$$;

-- Captions: written in the countdown, fixed once the day is up.
create policy "write your own caption in the countdown" on public.day_captions for insert to authenticated
  with check (public.owns_membership(membership_id) and public.day_counting_down(membership_id, day));
create policy "edit your own caption in the countdown" on public.day_captions for update to authenticated
  using (public.owns_membership(membership_id) and public.day_counting_down(membership_id, day))
  with check (public.owns_membership(membership_id) and public.day_counting_down(membership_id, day));
create policy "clear your own caption in the countdown" on public.day_captions for delete to authenticated
  using (public.owns_membership(membership_id) and public.day_counting_down(membership_id, day));

revoke insert, update, delete on public.day_captions from anon;

-- ---------------------------------------------------------------------------
-- Completing and undoing
-- ---------------------------------------------------------------------------

-- The shot and the tick land together. The photo is uploaded first, into
-- today's folder; this then records it. Retaking a done task keeps it done
-- and keeps its grid cell unless a new one is given. A day that's up takes
-- no more photos, and the photo that finishes the day starts its countdown.
-- Hands back the completion, when the day goes up (`posts_at`, null while
-- it's unfinished) and the photo paths a retake replaced, for the app to
-- delete from storage.
create function public.complete_task(task uuid, photo_path text, thumb_path text, slot int default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  m public.memberships;
  r public.rounds;
  today int;
  folder text;
  previous public.task_completions;
  saved public.task_completions;
  goes_up timestamptz;
begin
  select * into m from public.memberships where user_id = uid and status = 'active';
  if not found then
    raise exception 'you are not in a challenge' using errcode = 'P0002';
  end if;
  select * into r from public.rounds where id = m.round_id;

  if not exists (select 1 from public.challenge_tasks where id = task and challenge_id = r.challenge_id) then
    raise exception 'that task isn''t part of your challenge' using errcode = '22023';
  end if;

  today := public.member_day(m.id);
  if today < 1 then
    raise exception 'your challenge hasn''t started yet' using errcode = 'P0001';
  end if;
  if today > r.days then
    raise exception 'your challenge is over' using errcode = 'P0001';
  end if;
  if public.day_posted(m.id, today) then
    raise exception 'today''s post is already up' using errcode = 'P0001';
  end if;

  folder := uid::text || '/' || m.id::text || '/' || today::text || '/';
  if complete_task.photo_path not like folder || '%' or complete_task.thumb_path not like folder || '%' then
    raise exception 'photos must be uploaded to today''s folder (%)', folder using errcode = '42501';
  end if;

  select * into previous from public.task_completions
  where membership_id = m.id and task_id = task and day = today;

  insert into public.task_completions as tc (membership_id, task_id, day, photo_path, thumb_path, slot)
  values (m.id, task, today, complete_task.photo_path, complete_task.thumb_path, complete_task.slot)
  on conflict (membership_id, task_id, day) do update
    set photo_path = excluded.photo_path,
        thumb_path = excluded.thumb_path,
        slot = coalesce(excluded.slot, tc.slot),
        photo_updated_at = now()
  returning * into saved;

  -- The day's last photo starts the countdown; a retake during it leaves
  -- the countdown where it is.
  if (select count(*) from public.task_completions where membership_id = m.id and day = today)
     >= (select count(*) from public.challenge_tasks where challenge_id = r.challenge_id) then
    insert into public.day_posts (membership_id, day, posts_at)
    values (m.id, today, now() + public.post_countdown())
    on conflict (membership_id, day) do nothing;
  end if;
  select posts_at into goes_up from public.day_posts where membership_id = m.id and day = today;

  return jsonb_build_object(
    'completion', to_jsonb(saved),
    'posts_at', goes_up,
    'replaced', case
      when previous.id is null or previous.photo_path = saved.photo_path then '[]'::jsonb
      else jsonb_build_array(previous.photo_path, previous.thumb_path)
    end);
end $$;

-- The other half of that bargain: the tick goes, and the proof goes with it.
-- Today only, and only while the day isn't up; taking a photo out of a day
-- in its countdown stops the countdown. Hands back the photo paths for the
-- app to delete.
create function public.undo_task(task uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  mid uuid;
  today int;
  removed public.task_completions;
begin
  select id into mid from public.memberships where user_id = uid and status = 'active';
  today := public.member_day(mid);
  if public.day_posted(mid, today) then
    raise exception 'today''s post is already up' using errcode = 'P0001';
  end if;

  delete from public.task_completions
  where membership_id = mid and task_id = task and day = today
  returning * into removed;

  if removed.id is null then
    return '[]'::jsonb;
  end if;
  delete from public.day_posts where membership_id = mid and day = today;
  return jsonb_build_array(removed.photo_path, removed.thumb_path);
end $$;

-- Slide to post: ends today's countdown now rather than waiting it out.
-- Hands back when the day went up, or null if it wasn't counting down.
create function public.post_now() returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  mid uuid;
  went_up timestamptz;
begin
  select id into mid from public.memberships where user_id = uid and status = 'active';
  update public.day_posts set posts_at = now()
  where membership_id = mid and day = public.member_day(mid) and posts_at > now()
  returning posts_at into went_up;
  return went_up;
end $$;

revoke execute on function public.complete_task(uuid, text, text, int), public.undo_task(uuid), public.post_now()
  from public, anon;
grant execute on function public.complete_task(uuid, text, text, int), public.undo_task(uuid), public.post_now()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Where everyone stands
-- ---------------------------------------------------------------------------

-- One row per membership: what day it's on, how much of today is done, and
-- the days missed — a day fully behind you without every task done. Today
-- is still open however little of it is ticked, so it never counts. Lives
-- are floored at zero: past the allowance the run is lost, and how far past
-- says nothing more.
create view public.membership_progress with (security_invoker = true) as
select
  m.id as membership_id,
  m.user_id,
  m.round_id,
  r.challenge_id,
  m.status,
  r.start_date,
  r.days,
  c.lives,
  t.task_count,
  d.current_day,
  coalesce(today.done, 0) as done_today,
  d.closed_days - coalesce(full_days.n, 0) as missed_days,
  greatest(c.lives - (d.closed_days - coalesce(full_days.n, 0)), 0) as lives_left
from public.memberships m
join public.rounds r on r.id = m.round_id
join public.challenges c on c.id = r.challenge_id
cross join lateral (
  select count(*)::int as task_count from public.challenge_tasks ct where ct.challenge_id = r.challenge_id
) t
cross join lateral (
  select
    public.local_today(m.user_id) - r.start_date + 1 as current_day,
    greatest(least(public.local_today(m.user_id) - r.start_date, r.days), 0) as closed_days
) d
left join lateral (
  select count(*)::int as done from public.task_completions tc
  where tc.membership_id = m.id and tc.day = d.current_day
) today on true
left join lateral (
  select count(*)::int as n from (
    select tc.day from public.task_completions tc
    where tc.membership_id = m.id and tc.day < d.current_day and tc.day <= r.days
    group by tc.day
    having count(*) >= t.task_count
  ) f
) full_days on true;

-- Longest run of fully done days for everyone who was in a round, best
-- first — a finished round's standings. Ties share a place, so the app
-- groups by `longest_streak` rather than trusting row order.
create function public.round_standings(rid uuid)
returns table (user_id uuid, longest_streak int, status public.membership_status)
language sql stable security definer set search_path = '' as $$
  with tasks as (
    select count(*) as n from public.challenge_tasks ct
    join public.rounds r on r.challenge_id = ct.challenge_id where r.id = rid
  ),
  full_days as (
    select tc.membership_id, tc.day
    from public.task_completions tc
    join public.memberships m on m.id = tc.membership_id and m.round_id = rid
    group by tc.membership_id, tc.day
    having count(*) >= (select n from tasks)
  ),
  islands as (
    select membership_id, day - row_number() over (partition by membership_id order by day) as island
    from full_days
  ),
  streaks as (
    select membership_id, max(len)::int as longest
    from (select membership_id, count(*) as len from islands group by membership_id, island) s
    group by membership_id
  )
  select m.user_id, coalesce(s.longest, 0), m.status
  from public.memberships m
  left join streaks s on s.membership_id = m.id
  where m.round_id = rid and m.status <> 'left'
  order by 2 desc
$$;

-- A round's headline numbers: who's in, who's still going, who finished.
create view public.round_stats with (security_invoker = true) as
select
  r.id as round_id,
  count(p.membership_id) filter (where p.status <> 'left')::int as members,
  count(p.membership_id) filter (where p.status = 'active' and p.missed_days <= p.lives)::int as still_going,
  count(p.membership_id) filter (where p.status = 'finished')::int as finished
from public.rounds r
left join public.membership_progress p on p.round_id = r.id
group by r.id;

-- ===========================================================================
-- Friends and talk
-- ===========================================================================

-- Friends, and everything said about a day: comments, reactions, views.
--
-- A "post" has no table of its own. It is one member's day — a membership
-- and a day number — drawn from that day's completions and caption, so
-- everything that hangs off a post is keyed by (membership_id, day).

-- ---------------------------------------------------------------------------
-- Who can see a day
-- ---------------------------------------------------------------------------

-- The Community lock: true once the signed-in account has photographed a
-- task today — today in its own challenge, where it lives. Yesterday's photo
-- doesn't stand in for today's. It only holds while there's a today to
-- prove: with no challenge, or before your round's Day 1, there's nothing
-- you could photograph, so the lock is open. The app's `feedLocked` reads
-- the same rule, so what it shows and what storage will sign never disagree.
create function public.unlocked_today() returns boolean
language sql stable security definer set search_path = '' as $$
  select
    -- No run of yours is under way today…
    not exists (
      select 1
      from public.memberships m
      join public.rounds r on r.id = m.round_id
      where m.user_id = auth.uid()
        and m.status = 'active'
        and public.member_day(m.id) between 1 and r.days
    )
    -- …or there is, and today already has a photo in it.
    or exists (
      select 1
      from public.memberships m
      join public.task_completions tc on tc.membership_id = m.id
      where m.user_id = auth.uid()
        and m.status = 'active'
        and tc.day = public.member_day(m.id)
    )
$$;

-- Whether the signed-in account may see one member's day. Your own, always.
-- Anyone's past days, always: profiles are public, and a day that is over
-- has nothing left to race. Someone's *today* only once you've proven your
-- own — a day nobody has photographed yet has no post of its own to read
-- anyone else's against.
create function public.can_view_day(mid uuid, d int) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then false
    when public.owns_membership(mid) then true
    when d < public.member_day(mid) then true
    else public.unlocked_today()
  end
$$;

-- ---------------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------------

create type public.friendship_status as enum ('pending', 'accepted');

-- One row per pair, whoever asked first.
create table public.friendships (
  requester_id uuid not null references public.profiles on delete cascade,
  addressee_id uuid not null references public.profiles on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create unique index friendships_pair_idx on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

-- Who's friends with whom is as public as the profiles are; a request is
-- only for the two people in it.
create policy "friendships are public, requests are private" on public.friendships
  for select to authenticated
  using (status = 'accepted' or requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

revoke insert, update, delete on public.friendships from anon, authenticated;

-- Both directions of every friendship, for joining against.
create view public.friends with (security_invoker = true) as
select requester_id as user_id, addressee_id as friend_id, accepted_at from public.friendships where status = 'accepted'
union all
select addressee_id, requester_id, accepted_at from public.friendships where status = 'accepted';

-- Add. If they had already asked you, this accepts instead of asking back.
create function public.request_friend(target uuid) returns public.friendship_status
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  result public.friendship_status;
begin
  if target = uid then
    raise exception 'you can''t add yourself' using errcode = '22023';
  end if;

  update public.friendships set status = 'accepted', accepted_at = now()
  where requester_id = target and addressee_id = uid and status = 'pending'
  returning status into result;
  if found then
    return result;
  end if;

  insert into public.friendships (requester_id, addressee_id) values (uid, target)
  on conflict do nothing;
  select status into result from public.friendships
  where least(requester_id, addressee_id) = least(uid, target)
    and greatest(requester_id, addressee_id) = greatest(uid, target);
  return result;
end $$;

-- Takes back a request, declines one, or ends a friendship — whichever the
-- two of you have.
create function public.unfriend(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
begin
  delete from public.friendships
  where (requester_id = uid and addressee_id = target) or (requester_id = target and addressee_id = uid);
end $$;

-- People you might know: friends of your friends you aren't connected to
-- yet, most mutual friends first, with up to two of those friends named.
create function public.friend_suggestions(max_rows int default 20)
returns table (user_id uuid, mutual_count int, mutual_ids uuid[])
language sql stable security definer set search_path = '' as $$
  with mine as (select friend_id from public.friends where user_id = auth.uid())
  select f.friend_id, count(*)::int, (array_agg(f.user_id order by f.accepted_at))[1:2]
  from public.friends f
  where f.user_id in (select friend_id from mine)
    and f.friend_id <> auth.uid()
    and not exists (
      select 1 from public.friendships x
      where least(x.requester_id, x.addressee_id) = least(auth.uid(), f.friend_id)
        and greatest(x.requester_id, x.addressee_id) = greatest(auth.uid(), f.friend_id))
  group by f.friend_id
  order by count(*) desc
  limit max_rows
$$;

-- ---------------------------------------------------------------------------
-- Comments, reactions, views
-- ---------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships on delete cascade,
  day int not null check (day >= 1),
  author_id uuid not null references public.profiles on delete cascade,
  -- A reply hangs under the exact comment it answered, at any depth.
  parent_id uuid references public.comments on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (membership_id, day, created_at);
create index comments_parent_idx on public.comments (parent_id);

-- A reply has to be on the same post as what it answers.
create function public.check_comment_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments p
    where p.id = new.parent_id and p.membership_id = new.membership_id and p.day = new.day
  ) then
    raise exception 'a reply must be on the same post' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger comments_check_parent before insert on public.comments
  for each row execute function public.check_comment_parent();

-- One emoji per person per post; tapping the one already on it takes it off.
create table public.reactions (
  membership_id uuid not null references public.memberships on delete cascade,
  day int not null check (day >= 1),
  user_id uuid not null references public.profiles on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '👏', '😂')),
  created_at timestamptz not null default now(),
  primary key (membership_id, day, user_id)
);

-- One row the first time someone sees a photo — the story ring's "seen",
-- and the view count on a post.
create table public.photo_views (
  completion_id uuid not null references public.task_completions on delete cascade,
  viewer_id uuid not null references public.profiles on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (completion_id, viewer_id)
);

create index photo_views_viewer_idx on public.photo_views (viewer_id);

alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.photo_views enable row level security;

create policy "read comments on days you can see" on public.comments for select to authenticated
  using (public.can_view_day(membership_id, day));
create policy "comment as yourself on days you can see" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_view_day(membership_id, day));
-- Your own comments, and anything said under your own post.
create policy "delete your comments or ones on your post" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.owns_membership(membership_id));

create policy "reactions are public" on public.reactions for select to authenticated using (true);
create policy "react as yourself on days you can see" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_day(membership_id, day));
create policy "change your reaction" on public.reactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_view_day(membership_id, day));
create policy "take your reaction back" on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Who saw what is between the viewer and the photo's owner.
create policy "your views, and views of your photos" on public.photo_views for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (
      select 1 from public.task_completions tc
      where tc.id = completion_id and public.owns_membership(tc.membership_id)));
create policy "record your own views of photos you can see" on public.photo_views for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (
      select 1 from public.task_completions tc
      where tc.id = completion_id and public.can_view_day(tc.membership_id, tc.day)));

revoke update on public.comments, public.photo_views from anon, authenticated;
revoke insert, update, delete on public.comments, public.reactions, public.photo_views from anon;
revoke update on public.reactions from authenticated;
grant update (emoji) on public.reactions to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- Something someone else did that concerns you. Written by the triggers
-- below, read by the app's activity list — and, once the app ships as a real
-- build, the rows remote push is sent from.
create type public.notification_kind as enum ('friend_request', 'friend_accepted', 'comment', 'reply', 'reaction', 'invite');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles on delete cascade,
  actor_id uuid not null references public.profiles on delete cascade,
  kind public.notification_kind not null,
  membership_id uuid references public.memberships on delete cascade,
  day int,
  comment_id uuid references public.comments on delete cascade,
  emoji text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- The round an invite is into, so it can open straight onto it.
  round_id uuid references public.rounds on delete cascade
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

create policy "your notifications" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "mark your notifications read" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "clear your notifications" on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

create function public.notify_friendship() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (recipient_id, actor_id, kind)
    values (new.addressee_id, new.requester_id, 'friend_request');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (recipient_id, actor_id, kind)
    values (new.requester_id, new.addressee_id, 'friend_accepted');
    -- The request has been answered; it no longer needs answering.
    delete from public.notifications
    where recipient_id = new.addressee_id and actor_id = new.requester_id and kind = 'friend_request';
  end if;
  return new;
end $$;

-- A request taken back shouldn't linger in the other person's list.
create function public.unnotify_friendship() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' then
    delete from public.notifications
    where recipient_id = old.addressee_id and actor_id = old.requester_id and kind = 'friend_request';
  end if;
  return old;
end $$;

create trigger friendships_notify after insert or update on public.friendships
  for each row execute function public.notify_friendship();
create trigger friendships_unnotify after delete on public.friendships
  for each row execute function public.unnotify_friendship();

-- A comment tells the post's owner; a reply also tells whoever it answered.
-- Nobody hears about their own words.
create function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := (select user_id from public.memberships where id = new.membership_id);
  answered uuid := (select author_id from public.comments where id = new.parent_id);
begin
  if answered is not null and answered <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, kind, membership_id, day, comment_id)
    values (answered, new.author_id, 'reply', new.membership_id, new.day, new.id);
  end if;
  if owner <> new.author_id and owner is distinct from answered then
    insert into public.notifications (recipient_id, actor_id, kind, membership_id, day, comment_id)
    values (owner, new.author_id, 'comment', new.membership_id, new.day, new.id);
  end if;
  return new;
end $$;

create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- A reaction tells the post's owner — once, changed in place if the emoji
-- changes, and gone if it's taken back.
create function public.notify_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.notifications
    where kind = 'reaction' and actor_id = old.user_id and membership_id = old.membership_id and day = old.day;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    owner := (select user_id from public.memberships where id = new.membership_id);
    if owner <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, kind, membership_id, day, emoji)
      values (owner, new.user_id, 'reaction', new.membership_id, new.day, new.emoji);
    end if;
    return new;
  end if;
  return old;
end $$;

create trigger reactions_notify after insert or update or delete on public.reactions
  for each row execute function public.notify_reaction();

-- ---------------------------------------------------------------------------
-- The Community tab
-- ---------------------------------------------------------------------------

-- Today, for everyone the tab shows: `friends` is your friends in any
-- challenge, `members` everyone else in your own round. One row per person
-- with how far through today they are and what's been said about it, so the
-- tab is one call. The photos themselves come from `task_completions`, and
-- are only served once the lock is open — `unlocked` says whether it is.
-- `posts_at` is when each finished day goes up: it only shows as a post
-- once that has passed.
create function public.community_today(scope text)
returns table (
  membership_id uuid,
  user_id uuid,
  name text,
  handle text,
  avatar_path text,
  challenge_id uuid,
  day int,
  done int,
  task_count int,
  lives_left int,
  caption text,
  last_completed_at timestamptz,
  views int,
  reactions int,
  my_reaction text,
  comments int,
  is_friend boolean,
  request_sent boolean,
  unlocked boolean,
  posts_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  my_round as (
    select round_id from public.memberships where user_id = (select id from me) and status = 'active'
  ),
  people as (
    select p.*
    from public.membership_progress p
    where p.status = 'active'
      and p.current_day between 1 and p.days
      and p.user_id <> (select id from me)
      and case scope
        when 'friends' then p.user_id in (select friend_id from public.friends where user_id = (select id from me))
        when 'members' then p.round_id in (select round_id from my_round)
          and p.user_id not in (select friend_id from public.friends where user_id = (select id from me))
        else false
      end
  )
  select
    p.membership_id,
    p.user_id,
    pr.name,
    pr.handle,
    pr.avatar_path,
    p.challenge_id,
    p.current_day,
    p.done_today,
    p.task_count,
    p.lives_left,
    dc.caption,
    (select max(tc.completed_at) from public.task_completions tc
      where tc.membership_id = p.membership_id and tc.day = p.current_day),
    (select count(distinct v.viewer_id)::int from public.photo_views v
      join public.task_completions tc on tc.id = v.completion_id
      where tc.membership_id = p.membership_id and tc.day = p.current_day),
    (select count(*)::int from public.reactions r
      where r.membership_id = p.membership_id and r.day = p.current_day),
    (select r.emoji from public.reactions r
      where r.membership_id = p.membership_id and r.day = p.current_day and r.user_id = (select id from me)),
    (select count(*)::int from public.comments c
      where c.membership_id = p.membership_id and c.day = p.current_day),
    exists (select 1 from public.friends f where f.user_id = (select id from me) and f.friend_id = p.user_id),
    exists (select 1 from public.friendships f
      where f.requester_id = (select id from me) and f.addressee_id = p.user_id and f.status = 'pending'),
    public.unlocked_today(),
    dp.posts_at
  from people p
  join public.profiles pr on pr.id = p.user_id
  left join public.day_captions dc on dc.membership_id = p.membership_id and dc.day = p.current_day
  left join public.day_posts dp on dp.membership_id = p.membership_id and dp.day = p.current_day
  order by p.done_today desc, 12 desc nulls last
$$;

revoke execute on function
  public.request_friend(uuid), public.unfriend(uuid), public.friend_suggestions(int), public.community_today(text)
  from public, anon;
grant execute on function
  public.request_friend(uuid), public.unfriend(uuid), public.friend_suggestions(int), public.community_today(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------

-- Asking a friend into a round. The create form's "Invite" sends one; it
-- lands in the friend's activity like a request or a comment does.
-- Only a friend, and only into a round they could still join. Asking again
-- replaces the earlier invite rather than stacking a second one.
create function public.invite_to_round(target uuid, rid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
begin
  if not exists (select 1 from public.friends where user_id = uid and friend_id = target) then
    raise exception 'you can only invite your friends' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.rounds r where r.id = rid and public.local_today(target) <= r.start_date
  ) then
    raise exception 'joining has closed for that round' using errcode = 'P0001';
  end if;

  delete from public.notifications
  where recipient_id = target and actor_id = uid and kind = 'invite' and round_id = rid;
  insert into public.notifications (recipient_id, actor_id, kind, round_id)
  values (target, uid, 'invite', rid);
end $$;

revoke execute on function public.invite_to_round(uuid, uuid) from public, anon;
grant execute on function public.invite_to_round(uuid, uuid) to authenticated;

-- ===========================================================================
-- Photos
-- ===========================================================================

-- Where the photos live.
--
-- Everyone uploads into a folder named after their own user id, and only
-- there. Faces and challenge covers are public — profiles and challenges
-- are. Task photos are private: the app asks for a short-lived signed link,
-- and storage only signs one for someone `can_view_day` lets in. That is
-- what makes the Community lock real rather than a blur over a photo the
-- phone already downloaded.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('challenge-photos', 'challenge-photos', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  -- Task photos: `<user>/<membership>/<day>/<name>.jpg`, plus a `_thumb`
  -- beside each. Made on the phone, so the limit only has to catch mistakes.
  ('task-photos', 'task-photos', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']);

-- Whether an object path sits in the signed-in account's own folder.
create function public.in_own_folder(object_name text) returns boolean
language sql stable set search_path = '' as $$
  select (storage.foldername(object_name))[1] = auth.uid()::text
$$;

-- A task photo may be uploaded only into today's folder of your current
-- challenge — the same rule `complete_task` checks when it records it.
create function public.can_upload_task_photo(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := storage.foldername(object_name);
begin
  if parts[1] is distinct from auth.uid()::text
     or parts[2] !~ '^[0-9a-f-]{36}$' or parts[3] !~ '^[0-9]{1,3}$' then
    return false;
  end if;
  return exists (
    select 1 from public.memberships m
    where m.id = parts[2]::uuid and m.user_id = auth.uid() and m.status = 'active'
      and public.member_day(m.id) = parts[3]::int);
end $$;

-- A task photo may be read by whoever may see its day.
create function public.can_read_task_photo(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := storage.foldername(object_name);
begin
  if parts[1] = auth.uid()::text then
    return true;
  end if;
  if parts[2] !~ '^[0-9a-f-]{36}$' or parts[3] !~ '^[0-9]{1,3}$' then
    return false;
  end if;
  return exists (
    select 1 from public.memberships m
    where m.id = parts[2]::uuid and m.user_id::text = parts[1]
      and public.can_view_day(m.id, parts[3]::int));
end $$;

create policy "upload your own face and covers" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'challenge-photos') and public.in_own_folder(name));
create policy "replace your own face and covers" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'challenge-photos') and public.in_own_folder(name));
create policy "remove your own face and covers" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'challenge-photos') and public.in_own_folder(name));

create policy "upload today's task photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and public.can_upload_task_photo(name));
create policy "read task photos of days you can see" on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and public.can_read_task_photo(name));
-- Removing is for retakes and undos, which only ever touch your own.
create policy "remove your own task photos" on storage.objects for delete to authenticated
  using (bucket_id = 'task-photos' and public.in_own_folder(name));

-- Faces and covers are public — anyone with a link already sees them — and
-- storage only removes what the remover may also read, so without this a
-- replaced face or a deleted challenge's covers would quietly stay behind.
create policy "faces and covers are public" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'challenge-photos'));

-- ===========================================================================
-- Settling runs
-- ===========================================================================

-- Closing the books on runs. Every membership's standing is computed live by
-- `membership_progress`, but "lost" and "finished" have to be written down
-- at some point: a finished membership is what a round's results count, and
-- a lost one stops taking photos. This does that, every quarter hour, so it lands within
-- minutes of midnight in every time zone.

create function public.settle_memberships() returns int
language plpgsql security definer set search_path = '' as $$
declare
  settled int;
begin
  update public.memberships m
  set status = case when p.missed_days > p.lives then 'lost' else 'finished' end::public.membership_status,
      ended_at = now()
  from public.membership_progress p
  where p.membership_id = m.id
    and m.status = 'active'
    and (p.missed_days > p.lives or p.current_day > p.days);
  get diagnostics settled = row_count;
  return settled;
end $$;

revoke execute on function public.settle_memberships() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule('settle-memberships', '*/15 * * * *', 'select public.settle_memberships()');

-- ===========================================================================
-- Presets
-- ===========================================================================

-- The preset challenges the app ships with — the nine in
-- `data/challenges.ts` — and their scheduled rounds. Content rather than
-- schema, but every environment needs it, production included, so it lives
-- in a migration. Nobody is set as their creator. New rounds of a preset go
-- in through later migrations or the dashboard.

insert into public.challenges (slug, creator_id, name, stamp, description, category, default_days, lives) values
  ('selfera', null, 'Get Fit for Summer', 'Selfera',
   'A friendlier 75-day reset: clean eating, daily movement, and no alcohol — built for getting summer-ready without burning out.',
   'Fitness', 75, 3),
  ('hard', null, 'No Excuses Era', '75 Hard',
   '75 days, zero cheat days. Two workouts, a strict diet, and a daily progress photo — the original test of mental toughness.',
   'Health', 75, 3),
  ('medium', null, 'Balanced Reset', '75 Medium',
   '75 days of steady, sustainable habits: one flexible meal a week, daily movement, and a nightly read.',
   'Mindset', 75, 3),
  ('soft', null, 'Fresh Start', '75 Soft',
   'A gentler 75 days: clean eating with a little room to breathe, daily walks, and time to unwind with a podcast.',
   'Lifestyle', 75, 3),
  ('steps', null, '10k Steps a Day', '10k Steps',
   'Thirty days of getting your steps in — one walk a day, any route, any pace, as long as it adds up to ten thousand.',
   'Fitness', 30, 3),
  ('pages', null, 'Morning Pages', 'Morning Pages',
   'Three weeks of starting slow: three handwritten pages before anything else, then a few pages of a book.',
   'Mindset', 21, 3),
  ('rainbow', null, 'Eat the Rainbow', 'Eat the Rainbow',
   'A month of colourful plates: fruit or veg at every meal, a proper breakfast, and enough water to go with it.',
   'Health', 30, 3),
  ('study', null, 'Study Streak', 'Study Streak',
   'Thirty days of showing up to your desk: two focused hours, your notes reviewed, and a chapter read.',
   'Study', 30, 3),
  ('summer-glow', null, 'Summer Glow', 'Summer Glow',
   'A 30-day August reset: water before anything else, a walk in the evening light, and a proper wind-down before bed.',
   'Health', 30, 2);

insert into public.challenge_tasks (challenge_id, key, position, label, note)
select c.id, t.key, t.position, t.label, t.note
from (values
  ('selfera', 'h1', 0, 'Eat clean', 'Whole foods, nothing fried or processed.'),
  ('selfera', 'h2', 1, 'Drink only water', 'No soda, juice or alcohol — tea and coffee are fine.'),
  ('selfera', 'h3', 2, 'Walk 10k steps', 'Photo your step count before bed.'),
  ('selfera', 'h4', 3, 'Work out 45 min', 'Gym, class, run or ride — any sweat counts.'),
  ('selfera', 'h5', 4, 'Read 10 pages', 'A real book, not a screen.'),
  ('hard', 'd1', 0, 'Strict diet', 'Pick one and stick to it. No cheat meals.'),
  ('hard', 'd2', 1, 'Drink water', 'A full gallon, spread across the day.'),
  ('hard', 'd3', 2, 'Two workouts, one outside', '45 minutes each, whatever the weather.'),
  ('hard', 'd4', 3, 'Read 10 pages', 'Non-fiction, a real book.'),
  ('hard', 'd5', 4, 'Progress photo', 'Same spot, same light, every day.'),
  ('medium', 'm1', 0, 'Eat well', 'No junk food. One flexible meal a week.'),
  ('medium', 'm2', 1, 'Drink 3L water', 'Photo your bottle any time of day.'),
  ('medium', 'm3', 2, 'Work out 45 min', 'Any movement counts — a walk, a class, a run.'),
  ('medium', 'm4', 3, 'Read 10 pages', 'A real book, not a screen.'),
  ('medium', 'm5', 4, 'Progress photo', 'Same spot, same light, every day.'),
  ('soft', 's1', 0, 'Eat mostly clean', 'Good food most of the time, a treat now and then.'),
  ('soft', 's2', 1, 'Drink water', 'Photo your bottle any time of day.'),
  ('soft', 's3', 2, 'Walk 10k steps', 'Photo your step count before bed.'),
  ('soft', 's4', 3, 'Listen to a podcast', 'Something that teaches you a thing or two.'),
  ('steps', 'w1', 0, 'Walk 10k steps', 'Photo your step count before bed.'),
  ('pages', 'p1', 0, 'Write three pages', 'By hand, first thing, whatever comes out.'),
  ('pages', 'p2', 1, 'Read 10 pages', 'A real book, not a screen.'),
  ('rainbow', 'e1', 0, 'Fruit or veg at every meal', 'The more colours on the plate, the better.'),
  ('rainbow', 'e2', 1, 'Eat a proper breakfast', 'Sat down, not grabbed on the way out.'),
  ('rainbow', 'e3', 2, 'Drink 2L water', 'Photo your bottle any time of day.'),
  ('study', 't1', 0, 'Two focus hours', 'Phone away, one subject at a time.'),
  ('study', 't2', 1, 'Review your notes', 'Go back over what you covered today.'),
  ('study', 't3', 2, 'Read a chapter', 'From a course book or anything you are studying.'),
  ('summer-glow', 'g1', 0, 'Drink 2L water', 'Photo your bottle any time of day.'),
  ('summer-glow', 'g2', 1, 'Evening walk', 'Out after dinner, at least 20 minutes.'),
  ('summer-glow', 'g3', 2, 'Stretch before bed', 'Ten minutes on the floor, phone out of reach.')
) as t(slug, key, position, label, note)
join public.challenges c on c.slug = t.slug;

-- Their rounds, on the dates `DISCOVER` lists — the one Get Fit for Summer
-- ran in June among them, finished.
insert into public.rounds (challenge_id, start_date, days)
select c.id, r.start_date, c.default_days
from (values
  ('selfera', date '2026-06-01'),
  ('hard', date '2026-09-03'),
  ('medium', date '2026-10-01'),
  ('soft', date '2026-10-12'),
  ('steps', date '2026-10-17'),
  ('pages', date '2026-10-19'),
  ('rainbow', date '2026-10-22'),
  ('study', date '2026-11-02'),
  ('summer-glow', date '2026-08-01')
) as r(slug, start_date)
join public.challenges c on c.slug = r.slug;
