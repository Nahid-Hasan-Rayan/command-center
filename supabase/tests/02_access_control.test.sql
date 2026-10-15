-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

-- Existing behaviour is tested with open registration; approval is covered in 06_platform_admin.
update public.platform_settings set value = 'open' where key = 'registration_mode';
update public.platform_settings set value = array_to_string(public.platform_features(), ',') where key = 'default_features';

select plan(29);

create function pg_temp.login(uid text, aal text default 'aal2') returns text
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal)::text, true) $$;
grant execute on function pg_temp.login(text, text) to authenticated, anon;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'carol@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'dave@example.test');
update auth.users set email_confirmed_at = now()
 where id in ('aaaaaaaa-0000-0000-0000-000000000001',
              'aaaaaaaa-0000-0000-0000-000000000002',
              'aaaaaaaa-0000-0000-0000-000000000003');
update auth.users set email_confirmed_at = null
 where id = 'aaaaaaaa-0000-0000-0000-000000000004';

create temp table ctx as select
  (select id from public.workspaces where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') as alice_ws;
grant select on ctx to authenticated, anon;

create temp table tokens as
select raw, encode(sha256(convert_to(raw, 'UTF8')), 'hex') as hashed
from (values ('raw-token-one'), ('raw-token-two'), ('raw-token-three')) as t(raw);
grant select on tokens to authenticated;

insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by)
select alice_ws, 'carol@example.test', 'viewer', '{}', (select hashed from tokens where raw = 'raw-token-two'),
       now() - interval '1 day', 'aaaaaaaa-0000-0000-0000-000000000001' from ctx;
insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by)
select alice_ws, 'dave@example.test', 'viewer', '{}', (select hashed from tokens where raw = 'raw-token-three'),
       now() + interval '1 day', 'aaaaaaaa-0000-0000-0000-000000000001' from ctx;

set local role authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by)
    select alice_ws, 'bob@example.test', 'viewer', array['calendar', 'notes'],
           (select hashed from tokens where raw = 'raw-token-one'), now() + interval '7 days',
           'aaaaaaaa-0000-0000-0000-000000000001' from ctx$$,
  'owner can create an invitation'
);
select throws_ok(
  $$insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by)
    select alice_ws, 'x@example.test', 'viewer', array['calendar'], repeat('a', 64), now() + interval '31 days',
           'aaaaaaaa-0000-0000-0000-000000000001' from ctx$$,
  '42501', null, 'invitations cannot outlive thirty days'
);
select throws_ok(
  $$insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by)
    select alice_ws, 'x@example.test', 'owner', array['calendar'], repeat('b', 64), now() + interval '1 day',
           'aaaaaaaa-0000-0000-0000-000000000001' from ctx$$,
  '23514', null, 'invitations cannot grant the owner role'
);
select throws_ok(
  $$insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by)
    select alice_ws, 'x@example.test', 'viewer', array['everything'], repeat('c', 64), now() + interval '1 day',
           'aaaaaaaa-0000-0000-0000-000000000001' from ctx$$,
  '23514', null, 'invitations reject unknown features'
);

insert into public.nodes (workspace_id, type, title) select alice_ws, 'task', 'shared task' from ctx;
insert into public.nodes (workspace_id, type, title) select alice_ws, 'course', 'private course' from ctx;
insert into public.events (workspace_id, user_id, type) select alice_ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'task.created' from ctx;
insert into public.rules (workspace_id, key, value) select alice_ws, 'sg.ep', '{"min": 6000}' from ctx;

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok(
  $$insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by)
    select alice_ws, 'x@example.test', 'viewer', array['calendar'], repeat('d', 64), now() + interval '1 day',
           'aaaaaaaa-0000-0000-0000-000000000002' from ctx$$,
  '42501', null, 'a non-member cannot create invitations'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok(
  $$select public.accept_invitation('raw-token-one')$$,
  '42501', null, 'an invitation cannot be accepted by a different email'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002', 'aal1');
select throws_ok(
  $$select public.accept_invitation('raw-token-one')$$,
  '28000', null, 'an aal1 session cannot accept an invitation'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is(
  public.accept_invitation('raw-token-one'),
  (select alice_ws from ctx),
  'the invited account accepts and receives the workspace id'
);
select throws_ok(
  $$select public.accept_invitation('raw-token-one')$$,
  'P0002', null, 'an accepted invitation cannot be reused'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok(
  $$select public.accept_invitation('raw-token-two')$$,
  'P0002', null, 'an expired invitation cannot be accepted'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok(
  $$select public.accept_invitation('raw-token-three')$$,
  '42501', null, 'an unconfirmed email cannot accept an invitation'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is(
  (select role from public.workspace_members m join ctx on m.workspace_id = ctx.alice_ws
   where m.user_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'viewer', 'the invited member has the invited role'
);
select is(
  (select count(*)::int from public.member_features where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  2, 'the invited member has exactly the invited features'
);
select is((select count(*)::int from public.nodes where title = 'shared task'), 1, 'a granted feature exposes its data');
select is((select count(*)::int from public.nodes where title = 'private course'), 0, 'an ungranted feature hides its data');

select is(
  (select count(*)::int from public.workspace_people((select alice_ws from ctx))),
  2, 'members can list the people in their workspace'
);
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select is(
  (select count(*)::int from public.workspace_people((select alice_ws from ctx))),
  0, 'outsiders cannot list the people in a workspace'
);
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.member_features (workspace_id, user_id, feature)
select alice_ws, 'aaaaaaaa-0000-0000-0000-000000000002', 'courses' from ctx;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.nodes where title = 'private course'), 1, 'granting a feature takes effect immediately');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
delete from public.member_features where user_id = 'aaaaaaaa-0000-0000-0000-000000000002' and feature = 'courses';
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.nodes where title = 'private course'), 0, 'revoking a feature takes effect immediately');

select throws_ok(
  $$insert into public.nodes (workspace_id, type, title) select alice_ws, 'note', 'viewer write' from ctx$$,
  '42501', null, 'a viewer cannot write even in a granted feature'
);
select throws_ok(
  $$insert into public.member_features (workspace_id, user_id, feature)
    select alice_ws, 'aaaaaaaa-0000-0000-0000-000000000002', 'career' from ctx$$,
  '42501', null, 'a member cannot grant themselves features'
);
with changed as (update public.workspace_members set role = 'editor'
                 where user_id = 'aaaaaaaa-0000-0000-0000-000000000002' and workspace_id = (select alice_ws from ctx) returning 1)
select is((select count(*)::int from changed), 0, 'a member cannot change their own role');
select is((select count(*)::int from public.invitations), 0, 'invitations are hidden from non-owners');
select is((select count(*)::int from public.events), 0, 'a member cannot read the owner event log');
select is((select count(*)::int from public.rules), 0, 'rules require the career feature');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.events), 1, 'the owner reads the workspace event log');
with changed as (delete from public.workspace_members
                 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and workspace_id = (select alice_ws from ctx) returning 1)
select is((select count(*)::int from changed), 0, 'the owner membership cannot be removed');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
with changed as (delete from public.workspace_members
                 where user_id = 'aaaaaaaa-0000-0000-0000-000000000002' and workspace_id = (select alice_ws from ctx) returning 1)
select is((select count(*)::int from changed), 1, 'a member can leave a workspace');
select is((select count(*)::int from public.nodes where title = 'shared task'), 0, 'leaving removes all access');

select * from finish();

rollback;
