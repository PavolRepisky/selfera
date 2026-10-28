-- Tasks done a few times a week, on weekdays each member picks: what's due
-- when, what counts as a full day, and the rest days in between. Runs with
-- `npx supabase test db`; everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ---------------------------------------------------------------------------
-- Cast, written as the database owner. "Gym era" asks for a walk every day
-- and a lift three times a week; today is its Day 5. Alice lifts today, two
-- days ago and four days ago (Days 5, 3 and 1); Bob on the other days, so
-- not today. Carol is in an era of one weekly task that isn't due today.
-- Weekdays are worked out from today's, so the test holds whatever day it
-- runs on.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.dev'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.dev'),
  ('cccccccc-0000-4000-8000-000000000003', 'carol@test.dev'),
  ('dddddddd-0000-4000-8000-000000000004', 'dave@test.dev');

create function pg_temp.dow(back int) returns int language sql as $$
  select extract(dow from current_date - back)::int
$$;

insert into public.challenges (id, creator_id, name, default_days, lives) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Gym era', 10, 3),
  ('11111111-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000003', 'Weekly', 10, 3);
insert into public.challenge_tasks (id, challenge_id, position, label, per_week) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 0, 'Walk', 7),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 1, 'Lift', 3),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', 0, 'Long run', 1);
insert into public.rounds (id, challenge_id, start_date, days) values
  ('33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', current_date - 4, 10),
  ('33333333-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', current_date + 2, 10),
  ('33333333-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', current_date - 1, 10);
insert into public.memberships (id, round_id, user_id, schedule) values
  ('44444444-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
    jsonb_build_object('22222222-0000-4000-8000-000000000002', jsonb_build_array(pg_temp.dow(0), pg_temp.dow(2), pg_temp.dow(4)))),
  ('44444444-0000-4000-8000-00000000000b', '33333333-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
    jsonb_build_object('22222222-0000-4000-8000-000000000002', jsonb_build_array(pg_temp.dow(1), pg_temp.dow(3), pg_temp.dow(5)))),
  ('44444444-0000-4000-8000-00000000000c', '33333333-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000003',
    jsonb_build_object('22222222-0000-4000-8000-000000000003', jsonb_build_array(pg_temp.dow(1))));

-- Alice walked Days 1–4 and lifted on Day 1, but not on Day 3.
insert into public.task_completions (membership_id, task_id, day, photo_path, thumb_path) values
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000001', 1, 'x', 'x'),
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000002', 1, 'x', 'x'),
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000001', 2, 'x', 'x'),
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000001', 3, 'x', 'x'),
  ('44444444-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000001', 4, 'x', 'x');

-- ---------------------------------------------------------------------------
-- Which days a task falls on
-- ---------------------------------------------------------------------------

select is(public.default_weekdays(3), array[1, 3, 5], 'three a week, unpicked, is Monday, Wednesday, Friday');
select is(public.default_weekdays(6), array[1, 2, 3, 4, 5, 6], 'six is every day but Sunday');
select is(public.task_weekdays('{}', '22222222-0000-4000-8000-000000000002', 7), array[0, 1, 2, 3, 4, 5, 6],
  'a daily task needs no picks');
select is(
  public.task_weekdays('{"22222222-0000-4000-8000-000000000002": [0, 6]}', '22222222-0000-4000-8000-000000000002', 3),
  array[1, 3, 5], 'picks that no longer match how often fall back to the spread');
select throws_ok(
  $$update public.memberships set schedule = '{"x": [7]}' where id = '44444444-0000-4000-8000-00000000000a'$$,
  '23514', null, 'a weekday past Saturday is refused');

-- ---------------------------------------------------------------------------
-- Alice, on Day 5
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select is((select missed_days from public.membership_progress where membership_id = '44444444-0000-4000-8000-00000000000a'),
  1, 'only the day a lift was due and skipped is missed — the walk-only days are full');
select is((select task_count from public.membership_progress where membership_id = '44444444-0000-4000-8000-00000000000a'),
  2, 'today she has both due');
select is((select longest_streak from public.round_standings('33333333-0000-4000-8000-000000000001')
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  2, 'her best streak is Days 1–2, cut by Day 3');

-- ---------------------------------------------------------------------------
-- Bob, whose lift isn't today
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);

select is((select task_count from public.membership_progress where membership_id = '44444444-0000-4000-8000-00000000000b'),
  1, 'today Bob only has the walk');
select throws_ok(
  $$select public.complete_task('22222222-0000-4000-8000-000000000002',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/5/lift.jpg',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/5/lift_thumb.jpg')$$,
  'P0001', null, 'a task can''t be photographed on a day it isn''t due');
select ok(public.complete_task('22222222-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/5/walk.jpg',
    'bbbbbbbb-0000-4000-8000-000000000002/44444444-0000-4000-8000-00000000000b/5/walk_thumb.jpg')
  ->> 'posts_at' is not null,
  'and the walk alone finishes his day');

-- ---------------------------------------------------------------------------
-- Carol, on a rest day
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "cccccccc-0000-4000-8000-000000000003", "role": "authenticated"}', true);

select is((select task_count from public.membership_progress where membership_id = '44444444-0000-4000-8000-00000000000c'),
  0, 'nothing is due on a rest day');
select ok(public.unlocked_today(), 'so the Community lock is open without a photo');

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select is((select count(*)::int from public.community_today('members')
    where user_id = 'cccccccc-0000-4000-8000-000000000003'), 0,
  'and someone on a rest day has no day on Community');

-- ---------------------------------------------------------------------------
-- Dave, joining and building
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "dddddddd-0000-4000-8000-000000000004", "role": "authenticated"}', true);

select throws_ok(
  $$select public.join_round('33333333-0000-4000-8000-000000000002', null,
    '{"22222222-0000-4000-8000-000000000002": [1, 3]}')$$,
  '22023', null, 'joining with too few days picked is refused');
select lives_ok(
  $$select public.join_round('33333333-0000-4000-8000-000000000002', null,
    '{"22222222-0000-4000-8000-000000000002": [2, 4, 6]}')$$,
  'picking exactly as many as the task asks for joins');
select is((select schedule from public.memberships where user_id = 'dddddddd-0000-4000-8000-000000000004'),
  '{"22222222-0000-4000-8000-000000000002": [2, 4, 6]}'::jsonb, 'and the picks are kept');

select set_config('test.challenge', public.create_challenge(
  jsonb_build_object('name', 'Dave''s', 'days', 7, 'start_date', current_date + 1,
    'tasks', jsonb_build_array(jsonb_build_object('label', 'Swim', 'per_week', 2))))::text, true);
select is((select per_week from public.challenge_tasks where challenge_id = current_setting('test.challenge')::uuid),
  2, 'the create form sets how many times a week');

select * from finish();
rollback;
