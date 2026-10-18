-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

update public.platform_settings set value = 'open' where key = 'registration_mode';
update public.platform_settings set value = array_to_string(public.platform_features(), ',') where key = 'default_features';

select plan(51);

create function pg_temp.login(uid text, aal text default 'aal2') returns text
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal)::text, true) $$;
grant execute on function pg_temp.login(text, text) to authenticated, anon;

-- root = administrator, alice and bob share a workspace, carol is separate
insert into auth.users (id, email) values
  ('ffffffff-0000-0000-0000-000000000001', 'nhrayan@gmail.com'),
  ('ffffffff-0000-0000-0000-000000000002', 'alice@example.test'),
  ('ffffffff-0000-0000-0000-000000000003', 'bob@example.test'),
  ('ffffffff-0000-0000-0000-000000000004', 'carol@example.test');

create temp table ctx as select
  (select id from public.workspaces where owner_id = 'ffffffff-0000-0000-0000-000000000002') as alice_ws;
grant select on ctx to authenticated, anon;

insert into public.workspace_members (workspace_id, user_id, role)
  values ((select alice_ws from ctx), 'ffffffff-0000-0000-0000-000000000003', 'editor');
insert into public.channels (id, workspace_id, kind, name, created_by)
  values ('aaaaaaaa-1111-0000-0000-000000000001', (select alice_ws from ctx), 'channel', 'general', 'ffffffff-0000-0000-0000-000000000002');
insert into public.channel_members (channel_id, workspace_id, user_id) values
  ('aaaaaaaa-1111-0000-0000-000000000001', (select alice_ws from ctx), 'ffffffff-0000-0000-0000-000000000002'),
  ('aaaaaaaa-1111-0000-0000-000000000001', (select alice_ws from ctx), 'ffffffff-0000-0000-0000-000000000003')
  on conflict do nothing;
insert into public.messages (id, workspace_id, channel_id, sender_id, body, created_at) values
  ('bbbbbbbb-1111-0000-0000-000000000001', (select alice_ws from ctx), 'aaaaaaaa-1111-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'hello bob', now() - interval '3 minutes'),
  ('bbbbbbbb-1111-0000-0000-000000000002', (select alice_ws from ctx), 'aaaaaaaa-1111-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000003', 'hi alice', now() - interval '2 minutes'),
  ('bbbbbbbb-1111-0000-0000-000000000003', (select alice_ws from ctx), 'aaaaaaaa-1111-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000003', 'oops wrong chat', now() - interval '1 minute');
update public.messages set deleted_at = now() where id = 'bbbbbbbb-1111-0000-0000-000000000003';

set local role authenticated;

-- bug reports ---------------------------------------------------------------------------------------------------
select pg_temp.login('ffffffff-0000-0000-0000-000000000002');
select lives_ok($$insert into public.bug_reports (user_id, page, summary, details, status, admin_note, email)
  values ('ffffffff-0000-0000-0000-000000000002', '/study', 'Timer froze', 'It stopped at 12:00', 'resolved', 'I fixed it myself', 'forged@example.test')$$,
  'a person files a bug report');
select is((select status || '/' || coalesce(admin_note, 'none') || '/' || email from public.bug_reports limit 1),
  'open/none/alice@example.test', 'the reporter cannot choose the status, note or email');
select throws_ok($$insert into public.bug_reports (user_id, summary) values ('ffffffff-0000-0000-0000-000000000002', 'x')$$,
  '23514', null, 'a report needs a real summary');
select throws_ok($$insert into public.bug_reports (user_id, summary) values ('ffffffff-0000-0000-0000-000000000003', 'Filed as someone else')$$,
  '42501', null, 'a report cannot be filed in another person''s name');
select lives_ok($test$do $block$ begin
    for i in 1..9 loop
      insert into public.bug_reports (user_id, summary) values ('ffffffff-0000-0000-0000-000000000002', 'Report number ' || i);
    end loop;
  end $block$ $test$, 'reports are accepted up to the hourly limit');
select throws_ok($$insert into public.bug_reports (user_id, summary) values ('ffffffff-0000-0000-0000-000000000002', 'One too many')$$,
  '54000', null, 'more than ten reports in an hour is refused');
select throws_ok($$update public.bug_reports set status = 'resolved'$$, '42501', null, 'a reporter cannot change a report');

select pg_temp.login('ffffffff-0000-0000-0000-000000000003');
select is((select count(*) from public.bug_reports), 0::bigint, 'nobody reads another person''s reports');
select throws_ok($$select * from public.admin_list_bug_reports()$$, '42501', null, 'an ordinary account cannot list reports');

-- app events --------------------------------------------------------------------------------------------------------
select pg_temp.login('ffffffff-0000-0000-0000-000000000002');
select is(public.log_app_event('action.error', 'error', '/study', 120, '{"action":"study.add_paper","code":"23514"}'), true, 'an event is recorded');
select is(public.log_app_event('Bad Kind!', 'info'), false, 'a malformed kind is refused');
select is(public.log_app_event('page.view', 'fatal'), false, 'an unknown severity is refused');
select is(public.log_app_event('big.detail', 'warn', null, null, jsonb_build_object('blob', repeat('x', 6000))), true, 'an oversize detail is accepted but truncated');
select throws_ok($$insert into public.app_events (kind) values ('direct.write')$$, '42501', null, 'events cannot be written directly');
select throws_ok($$select count(*) from public.app_events$$, '42501', null, 'events cannot be read directly');
select is(public.log_app_event('action.timing', 'info', '/study', 100, '{"name":"study.log"}'), true, 'a timing is recorded');
select is(public.log_app_event('action.timing', 'info', '/study', 200, '{"name":"study.log"}'), true, 'a second timing is recorded');
select is(public.log_app_event('action.timing', 'info', '/study', 300, '{"name":"study.log"}'), true, 'a third timing is recorded');

select pg_temp.login('ffffffff-0000-0000-0000-000000000003');
select is((select count(*) filter (where public.log_app_event('spam.flood', 'info')) from generate_series(1, 130)), 120::bigint,
  'a flood of events is cut off at 120 a minute');
select throws_ok($$select * from public.admin_list_events()$$, '42501', null, 'an ordinary account cannot read events');
select throws_ok($$select public.admin_overview()$$, '42501', null, 'an ordinary account cannot read the overview');
select throws_ok($$select public.purge_old_app_events(90)$$, '42501', null, 'an ordinary account cannot purge events');

-- the administrator ------------------------------------------------------------------------------------------------------
select pg_temp.login('ffffffff-0000-0000-0000-000000000001');
select ok((select count(*) from public.admin_list_bug_reports()) >= 10, 'the administrator lists every report');
select lives_ok($$select public.admin_update_bug_report((select id from public.admin_list_bug_reports() where summary = 'Timer froze'), 'resolved', 'fixed in v2')$$,
  'the administrator resolves a report');
select throws_ok($$select public.admin_update_bug_report((select id from public.admin_list_bug_reports() limit 1), 'maybe', null)$$,
  '22023', null, 'an unknown report status is refused');
select throws_ok($$select public.admin_update_bug_report('00000000-0000-0000-0000-000000000000', 'resolved', null)$$,
  'P0002', null, 'an unknown report is refused');
select ok(exists (select 1 from public.admin_audit_list(500) where action = 'bug.resolved'), 'resolving a report is audited');

select is((select detail ->> 'truncated' from public.admin_list_events('info', 500) where kind = 'big.detail'), 'true',
  'an oversize detail was truncated');
select is((select count(*) from public.admin_list_events('error', 100)), 1::bigint, 'the error filter lists only errors');

select is((public.admin_overview() -> 'users' ->> 'approved')::int, 4, 'the overview counts approved people');
select is(jsonb_array_length(public.admin_overview() -> 'signups_14d'), 14, 'the overview gives fourteen days of sign-ups');
select is((public.admin_overview() -> 'signups_14d' -> 13 ->> 'count')::int, 4, 'all four sign-ups landed today');
select is((public.admin_overview() ->> 'open_bugs')::int, 9, 'resolved reports are not counted as open');
select is((public.admin_overview() ->> 'errors_24h')::int, 1, 'the overview counts recent errors');
select is(public.admin_overview() -> 'top_errors' -> 0 ->> 'kind', 'action.error', 'the overview names the top error');
select is((public.admin_overview() -> 'timings' -> 0 ->> 'p50_ms') || '/' || (public.admin_overview() -> 'timings' -> 0 ->> 'p95_ms'),
  '200/290', 'timings report the median and the 95th percentile');
select is((public.admin_overview() ->> 'messages_7d')::int, 3, 'the overview counts messages');
select is((public.admin_overview() ->> 'active_users_7d')::int, 2, 'the overview counts active people');

-- private messages: audited oversight ---------------------------------------------------------------------------------------
select pg_temp.login('ffffffff-0000-0000-0000-000000000002');
select throws_ok($$select * from public.admin_list_conversations()$$, '42501', null, 'a member cannot list all conversations');
select throws_ok($$select * from public.admin_read_messages('aaaaaaaa-1111-0000-0000-000000000001')$$, '42501', null, 'a member cannot use the oversight reader');

select pg_temp.login('ffffffff-0000-0000-0000-000000000001');
select is((select message_count from public.admin_list_conversations() where name = 'general'), 3::bigint,
  'the administrator lists a conversation they are not part of');
select is((select count(*) from public.admin_list_conversations('bob@example.test')), 1::bigint, 'conversations can be searched by member');
select is((select count(*) from public.admin_list_conversations('nobody-here')), 0::bigint, 'a search with no match is empty');
select is((select array_length(members, 1) from public.admin_list_conversations() where name = 'general'), 2, 'members are listed');
select is((select string_agg(body, ' | ' order by created_at) from public.admin_read_messages('aaaaaaaa-1111-0000-0000-000000000001')),
  'hello bob | hi alice | [deleted]', 'messages read oldest first; deleted ones show as deleted');
select is((select count(*) from public.admin_read_messages('aaaaaaaa-1111-0000-0000-000000000001', 2)), 2::bigint, 'the reader honours a row limit');
select ok(exists (select 1 from public.admin_audit_list(500) where action = 'messages.read' and detail ->> 'messages' = '3'),
  'every read is audited with the number of messages');
select ok(exists (select 1 from public.admin_audit_list(500) where action = 'messages.list'), 'listing conversations is audited too');
select throws_ok($$select * from public.admin_read_messages('00000000-0000-0000-0000-000000000000')$$, 'P0002', null, 'an unknown conversation is refused');

-- retention -------------------------------------------------------------------------------------------------------------------
reset role;
insert into public.app_events (at, kind) values (now() - interval '100 days', 'ancient.event');
select ok(public.purge_old_app_events(90) >= 1, 'events older than 90 days are purged');
select ok(not exists (select 1 from public.app_events where kind = 'ancient.event')
          and exists (select 1 from public.app_events where kind = 'action.error'),
  'recent events are kept');

select * from finish();
rollback;
