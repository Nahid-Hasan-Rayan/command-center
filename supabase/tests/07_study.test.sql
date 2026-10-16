-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

update public.platform_settings set value = 'open' where key = 'registration_mode';
update public.platform_settings set value = array_to_string(public.platform_features(), ',') where key = 'default_features';

select plan(30);

create function pg_temp.login(uid text, aal text default 'aal2') returns text
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal)::text, true) $$;
grant execute on function pg_temp.login(text, text) to authenticated, anon;

-- alice owns a workspace; bob is a viewer there with study access; carol is a stranger; dave lost the study feature
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'alice@example.test'),
  ('cccccccc-0000-0000-0000-000000000002', 'bob@example.test'),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@example.test'),
  ('cccccccc-0000-0000-0000-000000000004', 'dave@example.test');

create temp table ctx as select
  (select id from public.workspaces where owner_id = 'cccccccc-0000-0000-0000-000000000001') as alice_ws,
  (select id from public.workspaces where owner_id = 'cccccccc-0000-0000-0000-000000000003') as carol_ws,
  (select id from public.workspaces where owner_id = 'cccccccc-0000-0000-0000-000000000004') as dave_ws;
grant select on ctx to authenticated, anon;

insert into public.workspace_members (workspace_id, user_id, role)
  values ((select alice_ws from ctx), 'cccccccc-0000-0000-0000-000000000002', 'viewer');
insert into public.member_features (workspace_id, user_id, feature)
  values ((select alice_ws from ctx), 'cccccccc-0000-0000-0000-000000000002', 'study');
delete from public.user_entitlements where user_id = 'cccccccc-0000-0000-0000-000000000004' and feature = 'study';

-- carol has a course of her own, used to test cross-workspace isolation
insert into public.study_courses (id, workspace_id, code, title, created_by)
  values ('dddddddd-0000-0000-0000-000000000003', (select carol_ws from ctx), 'XYZ', 'Carol course', 'cccccccc-0000-0000-0000-000000000003');
insert into public.study_units (id, workspace_id, course_id, unit_key, topic, title, position)
  values ('eeeeeeee-0000-0000-0000-000000000003', (select carol_ws from ctx), 'dddddddd-0000-0000-0000-000000000003', 'u1', 'T', 'Carol unit', 0);

set local role authenticated;
select pg_temp.login('cccccccc-0000-0000-0000-000000000001');

select lives_ok($$insert into public.study_courses (id, workspace_id, code, title, exam_date, weight, created_by)
  values ('dddddddd-0000-0000-0000-000000000001', (select alice_ws from ctx), 'DSA', 'Data Structures', '2026-12-01', 1.5, 'cccccccc-0000-0000-0000-000000000001')$$,
  'an owner creates a course');
select throws_ok($$insert into public.study_courses (workspace_id, code, title, created_by)
  values ((select alice_ws from ctx), 'DSA', 'Duplicate', 'cccccccc-0000-0000-0000-000000000001')$$,
  '23505', null, 'course codes are unique inside a workspace');
select throws_ok($$insert into public.study_courses (workspace_id, code, title, color, created_by)
  values ((select alice_ws from ctx), 'BAD', 'Bad colour', 'red', 'cccccccc-0000-0000-0000-000000000001')$$,
  '23514', null, 'a colour must be a hex value');
select throws_ok($$insert into public.study_courses (workspace_id, code, title, weight, created_by)
  values ((select alice_ws from ctx), 'W', 'Zero weight', 0, 'cccccccc-0000-0000-0000-000000000001')$$,
  '23514', null, 'a course weight must be positive');
select throws_ok($$insert into public.study_courses (workspace_id, code, title, created_by)
  values ((select alice_ws from ctx), 'FAKE', 'Forged author', 'cccccccc-0000-0000-0000-000000000002')$$,
  '42501', null, 'a course cannot be created in someone else''s name');

select lives_ok($$insert into public.study_units (id, workspace_id, course_id, unit_key, topic, title, position) values
  ('eeeeeeee-0000-0000-0000-000000000001', (select alice_ws from ctx), 'dddddddd-0000-0000-0000-000000000001', 'intro-def', 'Intro', 'Definitions', 0),
  ('eeeeeeee-0000-0000-0000-000000000002', (select alice_ws from ctx), 'dddddddd-0000-0000-0000-000000000001', 'intro-algo', 'Intro', 'Algorithms', 1)$$,
  'units are added to a course');
select throws_ok($$insert into public.study_units (workspace_id, course_id, unit_key, topic, title, position)
  values ((select carol_ws from ctx), 'dddddddd-0000-0000-0000-000000000001', 'x', 'T', 'Cross', 0)$$,
  '42501', null, 'a unit cannot be filed under a course in another workspace');

select lives_ok($$insert into public.study_progress (user_id, workspace_id, unit_id)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), 'eeeeeeee-0000-0000-0000-000000000001')$$,
  'a person marks a unit done');
select throws_ok($$insert into public.study_progress (user_id, workspace_id, unit_id)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), 'eeeeeeee-0000-0000-0000-000000000003')$$,
  '23503', null, 'progress cannot point at a unit from another workspace');

select lives_ok($$insert into public.study_sessions (user_id, workspace_id, course_id, session_date, minutes, source)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), 'dddddddd-0000-0000-0000-000000000001', '2026-10-15', 45, 'timer')$$,
  'a focus session is logged');
select throws_ok($$insert into public.study_sessions (user_id, workspace_id, session_date, minutes)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), '2026-10-15', 0)$$,
  '23514', null, 'a session needs at least one minute');
select throws_ok($$insert into public.study_sessions (user_id, workspace_id, session_date, minutes)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), '2026-10-15', 601)$$,
  '23514', null, 'a session cannot exceed ten hours');
select throws_ok($$insert into public.study_sessions (user_id, workspace_id, session_date, minutes, source)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), '2026-10-15', 20, 'bot')$$,
  '23514', null, 'a session source must be timer or manual');

select lives_ok($$insert into public.study_papers (user_id, workspace_id, course_id, taken_on, score_pct, note)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), 'dddddddd-0000-0000-0000-000000000001', '2026-10-14', 72.5, 'sorting units')$$,
  'a past paper score is logged');
select throws_ok($$insert into public.study_papers (user_id, workspace_id, course_id, taken_on, score_pct)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), 'dddddddd-0000-0000-0000-000000000001', '2026-10-14', 101)$$,
  '23514', null, 'a score cannot exceed 100');

select lives_ok($$insert into public.study_settings (user_id, workspace_id, daily_goal_min, unit_minutes, rest_days)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), 120, 40, array[7])$$, 'planning settings are saved');
select throws_ok($$update public.study_settings set rest_days = array[0, 8]$$, '23514', null, 'rest days must be ISO weekdays 1 to 7');
select throws_ok($$update public.study_settings set daily_goal_min = 5$$, '23514', null, 'the daily goal has a sensible minimum');

-- a viewer reads the shared course, but changes nothing in it and keeps their own private rows ---------------
select pg_temp.login('cccccccc-0000-0000-0000-000000000002');
select is((select count(*) from public.study_courses), 1::bigint, 'a viewer with the study feature reads the shared course');
select is((select count(*) from public.study_units), 2::bigint, 'and its units');
select throws_ok($$insert into public.study_courses (workspace_id, code, title, created_by)
  values ((select alice_ws from ctx), 'NEW', 'Viewer course', 'cccccccc-0000-0000-0000-000000000002')$$,
  '42501', null, 'a viewer cannot create a course');
select is((select count(*) from public.study_progress), 0::bigint, 'a viewer cannot see another person''s progress');
select is((select count(*) from public.study_sessions) + (select count(*) from public.study_papers), 0::bigint,
  'nor their sessions or paper scores');
select lives_ok($$insert into public.study_progress (user_id, workspace_id, unit_id)
  values ('cccccccc-0000-0000-0000-000000000002', (select alice_ws from ctx), 'eeeeeeee-0000-0000-0000-000000000002')$$,
  'a viewer records their own progress');
select throws_ok($$insert into public.study_progress (user_id, workspace_id, unit_id)
  values ('cccccccc-0000-0000-0000-000000000001', (select alice_ws from ctx), 'eeeeeeee-0000-0000-0000-000000000002')$$,
  '42501', null, 'a viewer cannot write progress for someone else');

-- strangers and people without the feature -------------------------------------------------------------------
select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select is((select count(*) from public.study_courses where workspace_id = (select alice_ws from ctx)), 0::bigint,
  'a stranger reads nothing from another workspace');
select pg_temp.login('cccccccc-0000-0000-0000-000000000004');
select throws_ok($$insert into public.study_courses (workspace_id, code, title, created_by)
  values ((select dave_ws from ctx), 'NOFEAT', 'No feature', 'cccccccc-0000-0000-0000-000000000004')$$,
  '42501', null, 'a person whose study feature was withdrawn cannot use it even in their own workspace');

-- deleting a course removes everything under it ----------------------------------------------------------------
select pg_temp.login('cccccccc-0000-0000-0000-000000000001');
select lives_ok($$delete from public.study_courses where id = 'dddddddd-0000-0000-0000-000000000001'$$, 'a course is deleted');
reset role;
select is((select count(*) from public.study_units where course_id = 'dddddddd-0000-0000-0000-000000000001')
        + (select count(*) from public.study_progress where workspace_id = (select alice_ws from ctx))
        + (select count(*) from public.study_papers where workspace_id = (select alice_ws from ctx)), 0::bigint,
  'its units, progress and papers go with it');
select is((select course_id from public.study_sessions where user_id = 'cccccccc-0000-0000-0000-000000000001'), null::uuid,
  'logged study time is kept when its course is deleted');

select * from finish();
rollback;
