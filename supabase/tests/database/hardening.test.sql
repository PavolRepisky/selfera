-- The ways around the rules the 2026-10-30 audit found, each tried as the
-- person who'd try it, and each turned away. Runs with `npx supabase test db`;
-- everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------------------------------------------------------------------------
-- Cast, written as the database owner: Alice and Bob are on Day 2 of a
-- one-task era. Alice finished Day 1 and today, captioned both; Bob hasn't
-- photographed anything today, so his lock is shut. Carol is in no era.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.dev'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.dev'),
  ('cccccccc-0000-4000-8000-000000000003', 'carol@test.dev');

insert into public.challenges (id, creator_id, name, default_days, lives) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Walks', 10, 3);
insert into public.challenge_tasks (id, challenge_id, position, label) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 0, 'Walk');
insert into public.rounds (id, challenge_id, start_date, days) values
  ('33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', current_date - 1, 10);
insert into public.memberships (id, round_id, user_id) values
  ('44444444-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('44444444-0000-4000-8000-00000000000b', '33333333-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002');
insert into public.task_completions (membership_id, task_id, day, photo_path, thumb_path) values
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000001', 1, 'x', 'x'),
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000001', 2, 'x', 'x');
insert into public.day_captions (membership_id, day, caption) values
  ('44444444-0000-4000-8000-00000000000a', 1, 'Yesterday'),
  ('44444444-0000-4000-8000-00000000000a', 2, 'Today!');

-- A zone whose date isn't UTC's right now — Kiritimati is a day ahead of
-- UTC for most of it, Pago Pago a day behind for the rest.
create function pg_temp.other_date_zone() returns text language sql as $$
  select case when (now() at time zone 'Pacific/Kiritimati')::date <> (now() at time zone 'UTC')::date
    then 'Pacific/Kiritimati' else 'Pacific/Pago_Pago' end
$$;
grant execute on function pg_temp.other_date_zone() to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- The time zone can't move today
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select throws_ok(
  format($$update public.profiles set timezone = %L where id = auth.uid()$$, pg_temp.other_date_zone()),
  'P0001', null, 'in an era, a zone that moves today''s date is refused');
select lives_ok(
  $$update public.profiles set timezone = 'Etc/GMT' where id = auth.uid()$$,
  'a zone on the same date still syncs');

select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select lives_ok(
  format($$update public.profiles set timezone = %L where id = auth.uid()$$, pg_temp.other_date_zone()),
  'in no era, any zone goes');

-- ---------------------------------------------------------------------------
-- Helpers are for the signed-in
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$select * from public.round_standings('33333333-0000-4000-8000-000000000001')$$,
  '42501', null, 'signed out, a round''s standings aren''t yours to read');
select throws_ok($$select public.local_today('aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null, 'nor anyone''s date');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Bob, locked: today's caption is held back with its photos
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);

select is((select count(*)::int from public.day_captions
    where membership_id = '44444444-0000-4000-8000-00000000000a' and day = 2), 0,
  'locked, someone else''s caption for today can''t be read');
select is((select count(*)::int from public.day_captions
    where membership_id = '44444444-0000-4000-8000-00000000000a' and day = 1), 1,
  'their past days'' captions can');
select is((select count(*)::int from public.community_today('members')
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and caption is null), 1,
  'and the Community tab sends today''s without its caption');

-- ---------------------------------------------------------------------------
-- A task is done by a photo that's really there
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.complete_task('22222222-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/walk.jpg',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/walk_thumb.jpg')$$,
  '22023', null, 'naming photos that were never uploaded completes nothing');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('task-photos', 'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/walk.jpg'),
    ('task-photos', 'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/walk_thumb.jpg')$$,
  'Bob uploads into today''s folder');
select lives_ok(
  $$select public.complete_task('22222222-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/walk.jpg',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/walk_thumb.jpg')$$,
  'and those photos complete the task');

select is((select count(*)::int from public.day_captions
    where membership_id = '44444444-0000-4000-8000-00000000000a' and day = 2), 1,
  'unlocked, today''s caption reads');
select is((select caption from public.community_today('members')
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'Today!',
  'on the Community tab too');

-- ---------------------------------------------------------------------------
-- Comments and reactions take what the app sends
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.comments (membership_id, day, author_id, body, created_at)
    values ('44444444-0000-4000-8000-00000000000a', 1, 'bbbbbbbb-0000-4000-8000-000000000002', 'Old', '2000-01-01')$$,
  '42501', null, 'a comment can''t pick its own time');
select throws_ok(
  $$insert into public.reactions (membership_id, day, user_id, emoji, created_at)
    values ('44444444-0000-4000-8000-00000000000a', 1, 'bbbbbbbb-0000-4000-8000-000000000002', '🔥', '2000-01-01')$$,
  '42501', null, 'nor can a reaction');

-- ---------------------------------------------------------------------------
-- A pace for comments, friend requests and new eras
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.comments (membership_id, day, author_id, body)
    select '44444444-0000-4000-8000-00000000000a', 1, 'bbbbbbbb-0000-4000-8000-000000000002', 'Hi ' || i
    from generate_series(1, 11) i$$,
  'P0001', null, 'eleven comments in one request are turned away');
select lives_ok(
  $$insert into public.comments (membership_id, day, author_id, body)
    select '44444444-0000-4000-8000-00000000000a', 1, 'bbbbbbbb-0000-4000-8000-000000000002', 'Hi ' || i
    from generate_series(1, 10) i$$,
  'ten a minute go through');
select throws_ok(
  $$insert into public.comments (membership_id, day, author_id, body)
    values ('44444444-0000-4000-8000-00000000000a', 1, 'bbbbbbbb-0000-4000-8000-000000000002', 'One more')$$,
  'P0001', null, 'the eleventh waits');

select public.request_friend('cccccccc-0000-4000-8000-000000000003');
select public.unfriend('cccccccc-0000-4000-8000-000000000003');
select public.request_friend('cccccccc-0000-4000-8000-000000000003');
select public.unfriend('cccccccc-0000-4000-8000-000000000003');
select public.request_friend('cccccccc-0000-4000-8000-000000000003');
select public.unfriend('cccccccc-0000-4000-8000-000000000003');
select throws_ok($$select public.request_friend('cccccccc-0000-4000-8000-000000000003')$$,
  'P0001', null, 'asking the same person a fourth time in a day is turned away');

select lives_ok(
  $$select public.create_challenge(jsonb_build_object('name', 'Era ' || i, 'days', 7,
      'start_date', current_date + 1, 'tasks', jsonb_build_array(jsonb_build_object('label', 'x'))))
    from generate_series(1, 5) i$$,
  'five new eras in a day go through');
select throws_ok(
  $$select public.create_challenge(jsonb_build_object('name', 'Sixth', 'days', 7,
      'start_date', current_date + 1, 'tasks', jsonb_build_array(jsonb_build_object('label', 'x'))))$$,
  'P0001', null, 'the sixth waits for tomorrow');

-- ---------------------------------------------------------------------------
-- Uploads have a ceiling
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-0000-4000-8000-000000000002/face.jpg')$$,
  'a face uploads');

-- Filled to the brim as the owner: today's folder to sixty, faces to fifty.
reset role;
insert into storage.objects (bucket_id, name)
select 'task-photos', 'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/fill-' || i || '.jpg'
from generate_series(1, 58) i;
insert into storage.objects (bucket_id, name)
select 'avatars', 'bbbbbbbb-0000-4000-8000-000000000002/fill-' || i || '.jpg'
from generate_series(1, 49) i;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('task-photos', 'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/2/more.jpg')$$,
  '42501', null, 'a full day''s folder takes no more uploads');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-0000-4000-8000-000000000002/more.jpg')$$,
  '42501', null, 'nor does a full faces folder');

select * from finish();
rollback;
