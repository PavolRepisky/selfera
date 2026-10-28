-- Tasks that aren't every day. A challenge's creator says how many times a
-- week each task is done ("Work out" three times), and everyone joining picks
-- which weekdays they'll do it on, alongside its reminder. Those days are
-- part of the pledge: fixed once signed.
--
-- A day is then full when every task *due that day* has its photo, not every
-- task the challenge has. A day with nothing due is a rest day: it can't be
-- missed, it carries a streak, it has no post, and it leaves the Community
-- lock open — there is nothing to photograph, so nothing to prove.
--
-- Weekdays are counted 0 Sunday to 6 Saturday, as both `extract(dow)` and
-- JavaScript's `getDay()` count them, and read off the calendar date of the
-- day in the member's own zone.

-- ---------------------------------------------------------------------------
-- How often, and on which days
-- ---------------------------------------------------------------------------

-- Seven is every day, which is what every task was before.
alter table public.challenge_tasks
  add column per_week int not null default 7 check (per_week between 1 and 7);

-- The weekdays picked while joining, by task id: `{ "<task>": [1, 3, 5] }`.
-- A task done every day needs no entry. Only the shape is checked here;
-- `join_round` checks the picks against the tasks.
create function public.valid_schedule(s jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(s) = 'object'
    and not exists (
      select 1 from jsonb_each(s) e
      where not (
        jsonb_typeof(e.value) = 'array'
        and jsonb_array_length(e.value) between 1 and 7
        and not exists (
          select 1 from jsonb_array_elements(e.value) d
          where jsonb_typeof(d) <> 'number' or (d #>> '{}') !~ '^[0-6]$')
        and (select count(distinct d) from jsonb_array_elements(e.value) d) = jsonb_array_length(e.value)
      )
    ),
    false)
$$;

alter table public.memberships
  add column schedule jsonb not null default '{}' check (public.valid_schedule(schedule));

-- Where a task's days fall when nobody picked them — a membership from before
-- this, or one whose task the creator changed before Day 1 — spread over the
-- week from Monday: three is Monday, Wednesday, Friday. The app's
-- `defaultWeekdays` spreads them the same way.
create function public.default_weekdays(per_week int) returns int[]
language sql immutable set search_path = '' as $$
  select array(
    select ((1 + floor(i * 7.0 / per_week))::int % 7)
    from generate_series(0, per_week - 1) i)
$$;

-- The weekdays one member does one task on: every day for a daily task, the
-- picked days while they still match how often it's done, the spread
-- otherwise.
create function public.task_weekdays(schedule jsonb, task uuid, per_week int) returns int[]
language sql immutable set search_path = '' as $$
  select case
    when per_week >= 7 then array[0, 1, 2, 3, 4, 5, 6]
    when jsonb_array_length(schedule -> task::text) = per_week
      then array(select jsonb_array_elements_text(schedule -> task::text)::int)
    else public.default_weekdays(per_week)
  end
$$;

-- Whether a task is due on a calendar date for the member with `schedule`.
create function public.task_due(schedule jsonb, task uuid, per_week int, on_date date) returns boolean
language sql immutable set search_path = '' as $$
  select extract(dow from on_date)::int = any (public.task_weekdays(schedule, task, per_week))
$$;

-- The tasks a membership has due on day `d` of its round.
create function public.due_tasks(mid uuid, d int) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select ct.id
  from public.memberships m
  join public.rounds r on r.id = m.round_id
  join public.challenge_tasks ct on ct.challenge_id = r.challenge_id
  where m.id = mid
    and public.task_due(m.schedule, ct.id, ct.per_week, r.start_date + d - 1)
$$;

-- ---------------------------------------------------------------------------
-- Building and joining
-- ---------------------------------------------------------------------------

-- The form's tasks now carry `per_week` too, seven when left out.
create or replace function public.write_challenge_tasks(cid uuid, tasks jsonb) returns void
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

  insert into public.challenge_tasks (id, challenge_id, position, label, note, per_week)
  select coalesce(nullif(t ->> 'id', '')::uuid, gen_random_uuid()), cid, (ord - 1)::int,
         btrim(t ->> 'label'), nullif(btrim(coalesce(t ->> 'note', '')), ''),
         coalesce((t ->> 'per_week')::int, 7)
  from jsonb_array_elements(tasks) with ordinality as x(t, ord)
  on conflict (id) do update
    set position = excluded.position, label = excluded.label, note = excluded.note,
        per_week = excluded.per_week;
end $$;

-- Signing the pledge, now with the days picked for each task that isn't
-- daily: exactly as many as the task asks for, no more and no fewer. Signing
-- again before Day 1 may pick again; leaving them out keeps what was picked.
drop function public.join_round(uuid, jsonb);

create function public.join_round(rid uuid, reminders jsonb default null, schedule jsonb default null)
returns uuid
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

  if schedule is not null then
    if not public.valid_schedule(schedule) then
      raise exception 'those days don''t read as weekdays' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(schedule) k
      where not exists (
        select 1 from public.challenge_tasks ct where ct.id::text = k and ct.challenge_id = r.challenge_id)
    ) then
      raise exception 'that task isn''t part of this challenge' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.challenge_tasks ct
      where ct.challenge_id = r.challenge_id
        and ct.per_week < 7
        and coalesce(jsonb_array_length(schedule -> ct.id::text), 0) <> ct.per_week
    ) then
      raise exception 'pick as many days for each task as it asks for' using errcode = '22023';
    end if;
  end if;

  update public.memberships set status = 'left', ended_at = now()
  where user_id = uid and status = 'active' and round_id <> rid;

  insert into public.memberships (round_id, user_id, reminders, schedule)
  values (rid, uid, coalesce(reminders, '{"tasks": {}, "lastCall": 1320}'), coalesce(schedule, '{}'))
  on conflict (round_id, user_id) do update
    set status = 'active', ended_at = null, signed_at = now(),
        reminders = coalesce(join_round.reminders, public.memberships.reminders),
        schedule = coalesce(join_round.schedule, public.memberships.schedule)
  returning id into mid;
  return mid;
end $$;

revoke execute on function public.join_round(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.join_round(uuid, jsonb, jsonb) to authenticated;

revoke execute on function public.due_tasks(uuid, int) from public, anon;
grant execute on function public.due_tasks(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- A day's work
-- ---------------------------------------------------------------------------

-- As before, plus: only a task due today can be photographed, and the day is
-- finished — its countdown starts — once every task due today is in.
create or replace function public.complete_task(task uuid, photo_path text, thumb_path text, slot int default null)
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
  if not exists (select 1 from public.due_tasks(m.id, today) d where d = task) then
    raise exception 'that task isn''t on today' using errcode = 'P0001';
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

  -- The last photo due today starts the countdown; a retake during it
  -- leaves the countdown where it is.
  if not exists (
    select 1 from public.due_tasks(m.id, today) d
    where not exists (
      select 1 from public.task_completions tc
      where tc.membership_id = m.id and tc.task_id = d and tc.day = today)
  ) then
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

-- ---------------------------------------------------------------------------
-- Where everyone stands
-- ---------------------------------------------------------------------------

-- The same columns as before. `task_count` is now what's due today, and a
-- missed day is a day behind you with something due left undone — a rest
-- day never is.
create or replace view public.membership_progress with (security_invoker = true) as
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
  select
    public.local_today(m.user_id) - r.start_date + 1 as current_day,
    greatest(least(public.local_today(m.user_id) - r.start_date, r.days), 0) as closed_days
) d
cross join lateral (
  select count(*)::int as task_count from public.challenge_tasks ct
  where ct.challenge_id = r.challenge_id
    and public.task_due(m.schedule, ct.id, ct.per_week, r.start_date + d.current_day - 1)
) t
left join lateral (
  select count(*)::int as done from public.task_completions tc
  where tc.membership_id = m.id and tc.day = d.current_day
) today on true
left join lateral (
  select count(*)::int as n
  from generate_series(1, d.closed_days) as g(day)
  where not exists (
    select 1 from public.challenge_tasks ct
    where ct.challenge_id = r.challenge_id
      and public.task_due(m.schedule, ct.id, ct.per_week, r.start_date + g.day - 1)
      and not exists (
        select 1 from public.task_completions tc
        where tc.membership_id = m.id and tc.task_id = ct.id and tc.day = g.day)
  )
) full_days on true;

-- Longest run of full days, rest days carrying it. Only days that were the
-- member's to do count: those behind them while the run lasted, and today
-- once everything due today is in — a rest day still ahead of its midnight
-- hasn't been earned yet.
create or replace function public.round_standings(rid uuid)
returns table (user_id uuid, longest_streak int, status public.membership_status)
language sql stable security definer set search_path = '' as $$
  with members as (
    select m.id, m.user_id, m.status, m.schedule, r.challenge_id, r.start_date, r.days,
      coalesce((m.ended_at at time zone p.timezone)::date, public.local_today(m.user_id)) - r.start_date
        as closed
    from public.memberships m
    join public.rounds r on r.id = m.round_id
    join public.profiles p on p.id = m.user_id
    where m.round_id = rid and m.status <> 'left'
  ),
  full_days as (
    select mb.id as membership_id, g.day
    from members mb
    cross join lateral generate_series(1, least(mb.days, mb.closed + 1)) as g(day)
    where not exists (
      select 1 from public.challenge_tasks ct
      where ct.challenge_id = mb.challenge_id
        and public.task_due(mb.schedule, ct.id, ct.per_week, mb.start_date + g.day - 1)
        and not exists (
          select 1 from public.task_completions tc
          where tc.membership_id = mb.id and tc.task_id = ct.id and tc.day = g.day)
    )
    and (
      g.day <= mb.closed
      or exists (
        select 1 from public.challenge_tasks ct
        where ct.challenge_id = mb.challenge_id
          and public.task_due(mb.schedule, ct.id, ct.per_week, mb.start_date + g.day - 1))
    )
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
  select mb.user_id, coalesce(s.longest, 0), mb.status
  from members mb
  left join streaks s on s.membership_id = mb.id
  order by 2 desc
$$;

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------

-- The lock now also stays open on a rest day: with nothing due there is
-- nothing you could photograph to open it.
create or replace function public.unlocked_today() returns boolean
language sql stable security definer set search_path = '' as $$
  select
    -- No run of yours has anything due today…
    not exists (
      select 1
      from public.memberships m
      join public.rounds r on r.id = m.round_id
      where m.user_id = auth.uid()
        and m.status = 'active'
        and public.member_day(m.id) between 1 and r.days
        and exists (select 1 from public.due_tasks(m.id, public.member_day(m.id)))
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

-- As before, without anyone on a rest day: they have no day to show.
create or replace function public.community_today(scope text)
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
      and p.task_count > 0
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
