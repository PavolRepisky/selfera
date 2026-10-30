-- Hardening after the security audit of 2026-10-30. Nothing here changes what
-- the app does for someone using it as meant; each part closes a way around a
-- rule by calling the API directly.
--
-- In order: the time zone can't move today; helpers aren't open to the
-- signed-out; comments and reactions take only the columns the app sends;
-- today's caption sits behind the Community lock like its photos; a task is
-- done only by a photo that was really uploaded; uploads have a ceiling; and
-- comments, friend requests and new eras have a pace.

-- ===========================================================================
-- The time zone can't move today
-- ===========================================================================

-- Which day it is comes from the zone on the profile, and the profile is the
-- account's to edit. Swapping to a zone across the date line would reopen
-- yesterday — a missed day photographed after the fact — or open tomorrow
-- early. So while a run is on, a new zone is only taken when the date there
-- is the date it already was: travel still syncs, just not across midnight.
create or replace function public.check_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone: %', new.timezone using errcode = '22023';
  end if;
  if tg_op = 'UPDATE'
     and (now() at time zone new.timezone)::date <> (now() at time zone old.timezone)::date
     and exists (select 1 from public.memberships where user_id = new.id and status = 'active') then
    raise exception 'a new time zone can''t move today while you''re in an era' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ===========================================================================
-- Helpers are for the signed-in
-- ===========================================================================

-- Functions are executable by everyone unless told otherwise, and these run
-- with the owner's rights: `round_standings` alone would hand anyone holding
-- the app's public key every member of a round. The policies that call them
-- only ever run for the signed-in, so that's who keeps them.
revoke execute on function
  public.local_today(uuid), public.member_day(uuid), public.my_membership_id(),
  public.owns_membership(uuid), public.day_posted(uuid, int), public.day_counting_down(uuid, int),
  public.round_standings(uuid), public.unlocked_today(), public.can_view_day(uuid, int),
  public.can_upload_task_photo(text), public.can_read_task_photo(text)
  from public, anon;
grant execute on function
  public.local_today(uuid), public.member_day(uuid), public.my_membership_id(),
  public.owns_membership(uuid), public.day_posted(uuid, int), public.day_counting_down(uuid, int),
  public.round_standings(uuid), public.unlocked_today(), public.can_view_day(uuid, int),
  public.can_upload_task_photo(text), public.can_read_task_photo(text)
  to authenticated, service_role;

-- ===========================================================================
-- Comments and reactions take what the app sends
-- ===========================================================================

-- Inserting every column let a comment pick its own `created_at` — sorting
-- itself anywhere in a thread, and slipping under the pace below.
revoke insert on public.comments, public.reactions from authenticated;
grant insert (membership_id, day, author_id, parent_id, body) on public.comments to authenticated;
grant insert (membership_id, day, user_id, emoji) on public.reactions to authenticated;

-- ===========================================================================
-- Today's caption sits behind the lock
-- ===========================================================================

-- The caption is part of the post, so it's read on the same terms as the
-- post's photos and comments: past days by anyone, today once you've proven
-- your own.
drop policy "captions are public" on public.day_captions;
create policy "captions on days you can see" on public.day_captions for select to authenticated
  using (public.can_view_day(membership_id, day));

-- As before, with the caption held back while the lock is shut. Everyone on
-- the tab is on their today, so the lock decides it for every row alike.
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
    case when public.unlocked_today() then dc.caption end,
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

-- ===========================================================================
-- A task is done by a photo that's really there
-- ===========================================================================

-- As before, plus: both photos have to be in storage. The paths were only
-- checked for the right folder, so a call naming files never uploaded ticked
-- the task with nothing behind it.
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
  if (select count(*) from storage.objects o
      where o.bucket_id = 'task-photos'
        and o.name in (complete_task.photo_path, complete_task.thumb_path))
     < (case when complete_task.photo_path = complete_task.thumb_path then 1 else 2 end) then
    raise exception 'upload the photo first' using errcode = '22023';
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

-- ===========================================================================
-- Uploads have a ceiling
-- ===========================================================================

-- Each file was capped at 5 MB but nothing capped how many, and an upload
-- that never reaches `complete_task` is never cleaned up — one account could
-- run up the storage bill on a loop. A day's folder holds a photo and a
-- thumbnail for each of up to twelve tasks, with room for retakes whose old
-- files didn't get removed; faces and covers are a handful each, since a
-- replaced one is deleted.
create function public.objects_under(bucket text, prefix text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects where bucket_id = bucket and name like prefix || '%'
$$;

revoke execute on function public.objects_under(text, text) from public, anon;
grant execute on function public.objects_under(text, text) to authenticated, service_role;

drop policy "upload today's task photos" on storage.objects;
create policy "upload today's task photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-photos'
    and public.can_upload_task_photo(name)
    and public.objects_under('task-photos', array_to_string((storage.foldername(name))[1:3], '/') || '/') < 60);

drop policy "upload your own face and covers" on storage.objects;
create policy "upload your own face and covers" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'challenge-photos')
    and public.in_own_folder(name)
    and public.objects_under(bucket_id, (select auth.uid())::text || '/') < 50);

-- ===========================================================================
-- A pace for comments, friend requests and new eras
-- ===========================================================================

-- Each of these lands in someone else's list — a notification, or an era on
-- everyone's Discover — so one account on a loop could flood it. The limits
-- sit far above anything a person does by hand.

-- Comments: ten a minute. A trigger rather than a policy, because a policy's
-- count can't see the rows going in with it, and one request can carry many.
create function public.pace_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.comments
      where author_id = new.author_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'too many comments — wait a minute' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger comments_pace before insert on public.comments
  for each row execute function public.pace_comments();

-- Friend requests: a declined or withdrawn request leaves no row, so asking
-- again was free and every ask was a fresh notification. Each ask is logged
-- here: thirty an hour in all, three a day to the same person.
create table public.friend_request_log (
  requester_id uuid not null references public.profiles on delete cascade,
  addressee_id uuid not null references public.profiles on delete cascade,
  sent_at timestamptz not null default now()
);

create index friend_request_log_idx on public.friend_request_log (requester_id, sent_at);

alter table public.friend_request_log enable row level security;
revoke all on public.friend_request_log from anon, authenticated;

create or replace function public.request_friend(target uuid) returns public.friendship_status
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

  -- Only a new ask counts against the pace; one already waiting is a no-op.
  if not exists (
    select 1 from public.friendships
    where least(requester_id, addressee_id) = least(uid, target)
      and greatest(requester_id, addressee_id) = greatest(uid, target)
  ) then
    if (select count(*) from public.friend_request_log
        where requester_id = uid and sent_at > now() - interval '1 hour') >= 30
       or (select count(*) from public.friend_request_log
        where requester_id = uid and addressee_id = target and sent_at > now() - interval '1 day') >= 3 then
      raise exception 'too many requests — try again later' using errcode = 'P0001';
    end if;
    insert into public.friend_request_log (requester_id, addressee_id) values (uid, target);
  end if;

  insert into public.friendships (requester_id, addressee_id) values (uid, target)
  on conflict do nothing;
  select status into result from public.friendships
  where least(requester_id, addressee_id) = least(uid, target)
    and greatest(requester_id, addressee_id) = greatest(uid, target);
  return result;
end $$;

-- New eras: five a day per account. As before otherwise.
create or replace function public.create_challenge(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  start date := (p ->> 'start_date')::date;
  cid uuid;
begin
  if (select count(*) from public.challenges
      where creator_id = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'that''s five new eras today — try again tomorrow' using errcode = 'P0001';
  end if;
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
