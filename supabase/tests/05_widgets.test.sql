-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

select plan(22);

create function pg_temp.login(uid text, aal text default 'aal2') returns text
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal)::text, true) $$;
grant execute on function pg_temp.login(text, text) to authenticated, anon;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'carol@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'dave@example.test');

create temp table ctx as select
  (select id from public.workspaces where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') as ws;
grant select on ctx to authenticated, anon;

insert into public.workspace_members (workspace_id, user_id, role)
select ws, u, r from ctx,
  (values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'editor'),
          ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'viewer')) as v(u, r);
insert into public.member_features (workspace_id, user_id, feature)
select ws, u, 'widgets' from ctx,
  (values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid), ('aaaaaaaa-0000-0000-0000-000000000003'::uuid)) as v(u);

set local role authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$insert into public.widgets (id, workspace_id, uploader_id, name, html, status)
    select 'cccccccc-0000-0000-0000-000000000001', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'Owner tool',
           '<html><head></head><body>owner</body></html>', 'approved' from ctx$$,
  'the owner can upload an approved widget'
);
select is(
  (select approved_hash = content_hash from public.widgets where id = 'cccccccc-0000-0000-0000-000000000001'),
  true, 'approval is bound to the content hash'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select lives_ok(
  $$insert into public.widgets (id, workspace_id, uploader_id, name, html, status, permissions)
    select 'cccccccc-0000-0000-0000-000000000002', ws, 'aaaaaaaa-0000-0000-0000-000000000002', 'Editor tool',
           '<html><head></head><body>editor</body></html>', 'approved', array['read:calendar'] from ctx$$,
  'an editor can upload a widget'
);
select is(
  (select status || '/' || coalesce(array_to_string(permissions, ','), '') from public.widgets where id = 'cccccccc-0000-0000-0000-000000000002'),
  'pending/', 'an editor upload is forced to pending with no permissions'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok(
  $$insert into public.widgets (workspace_id, uploader_id, name, html)
    select ws, 'aaaaaaaa-0000-0000-0000-000000000003', 'Viewer tool', '<p>x</p>' from ctx$$,
  '42501', null, 'a viewer cannot upload widgets'
);
select is((select count(*)::int from public.widgets), 1, 'a viewer sees only approved widgets');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.widgets), 2, 'an uploader sees their pending widget and approved ones');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select lives_ok(
  $$insert into public.widget_state (workspace_id, widget_id, user_id, data)
    select ws, 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', '{"theme":"dark"}' from ctx$$,
  'a member can store state for an approved widget'
);
select throws_ok(
  $$insert into public.widget_state (workspace_id, widget_id, user_id, data)
    select ws, 'cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', '{}' from ctx$$,
  '42501', null, 'state cannot be stored for a pending widget'
);
select throws_ok(
  $$update public.widget_state set data = jsonb_build_object('k', repeat('x', 600000))$$,
  '23514', null, 'widget state is limited to 512 KB'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.widget_state), 0, 'widget state is private to its user');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
update public.widgets set html = '<html><head></head><body>editor v2</body></html>' where id = 'cccccccc-0000-0000-0000-000000000002';
select is((select version from public.widgets where id = 'cccccccc-0000-0000-0000-000000000002'), 2, 'editing widget content bumps the version');
select throws_ok(
  $$update public.widgets set status = 'approved' where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  '42501', null, 'an editor cannot approve their own widget'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
update public.widgets set status = 'approved', permissions = array['read:calendar'] where id = 'cccccccc-0000-0000-0000-000000000002';
select is(
  (select status || '/' || array_to_string(permissions, ',') || '/' || (approved_hash = content_hash)::text
   from public.widgets where id = 'cccccccc-0000-0000-0000-000000000002'),
  'approved/read:calendar/true', 'the owner approves a widget and grants permissions'
);
select throws_ok(
  $$update public.widgets set permissions = array['read:everything'] where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  '23514', null, 'unknown permissions are rejected'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
update public.widgets set html = '<html><head></head><body>swapped</body></html>' where id = 'cccccccc-0000-0000-0000-000000000002';
select is(
  (select status || '/' || coalesce(array_to_string(permissions, ','), '') || '/' || coalesce(approved_hash, 'none')
   from public.widgets where id = 'cccccccc-0000-0000-0000-000000000002'),
  'pending//none', 'changing approved content resets approval and permissions'
);
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select is((select count(*)::int from public.widgets), 1, 'a re-edited widget disappears for other members until re-approved');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select is((select count(*)::int from public.widgets), 0, 'an outsider sees no widgets');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select count(*)::int from public.widgets), 0, 'an aal1 session sees no widgets');

reset role;
delete from public.member_features where user_id = 'aaaaaaaa-0000-0000-0000-000000000003';
set local role authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select is(public.widget_runnable('cccccccc-0000-0000-0000-000000000001'), false, 'revoking the feature stops widgets running');

reset role;
set local role anon;
select throws_ok($$select 1 from public.widgets$$, '42501', null, 'the anonymous role cannot read widgets');

reset role;
delete from public.widgets where id = 'cccccccc-0000-0000-0000-000000000001';
select is((select count(*)::int from public.widget_state), 0, 'deleting a widget removes its stored state');

select * from finish();

rollback;
