-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

select plan(24);

create function pg_temp.login(uid text, aal text default 'aal2') returns text
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal)::text, true) $$;
grant execute on function pg_temp.login(text, text) to authenticated, anon;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@example.test');

create temp table ctx as select
  (select id from public.workspaces where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') as alice_ws,
  (select id from public.workspaces where owner_id = 'aaaaaaaa-0000-0000-0000-000000000002') as bob_ws;
grant select on ctx to authenticated, anon;

select is((select count(*)::int from public.workspace_members where role = 'owner'), 2, 'signup trigger creates an owner membership per user');
select is((select count(*)::int from public.profiles), 2, 'signup trigger creates a profile per user');

set local role authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select count(*)::int from public.workspaces), 0, 'an aal1 session sees no workspaces');
select is((select count(*)::int from public.profiles), 0, 'an aal1 session cannot read its profile');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
select is((select count(*)::int from public.workspaces), 1, 'an aal2 session sees only its own workspace');
select is((select count(*)::int from public.profiles), 1, 'an aal2 session reads its own profile');

insert into public.nodes (workspace_id, type, title) select alice_ws, 'task', 'alice task' from ctx;
select is((select count(*)::int from public.nodes), 1, 'owner can create and read a node');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select count(*)::int from public.nodes), 0, 'an aal1 session cannot read its own nodes');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');

select throws_ok($$insert into public.nodes (workspace_id, type, title) select bob_ws, 'task', 'intrusion' from ctx$$, '42501', null, 'cannot create a node in another workspace');
select throws_ok($$insert into public.nodes (workspace_id, type, title) select alice_ws, 'bogus', 'x' from ctx$$, '23514', null, 'node type constraint rejects unknown types');
select throws_ok($$insert into public.events (workspace_id, user_id, type) select bob_ws, 'aaaaaaaa-0000-0000-0000-000000000002', 'task.created' from ctx$$, '42501', null, 'cannot log events into another workspace');
select lives_ok($$insert into public.events (workspace_id, user_id, type, payload) select alice_ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'task.created', '{"v":1}' from ctx$$, 'can log an own event');
select throws_ok($$insert into public.events (workspace_id, user_id, type) select alice_ws, 'aaaaaaaa-0000-0000-0000-000000000002', 'task.created' from ctx$$, '42501', null, 'cannot attribute an event to another user');
select throws_ok($$update public.events set type = 'tampered'$$, '42501', null, 'events cannot be updated');
select throws_ok($$delete from public.events$$, '42501', null, 'events cannot be deleted');

reset role;
insert into public.nodes (workspace_id, type, title) select bob_ws, 'task', 'bob task' from ctx;
create temp table bob_node as select id from public.nodes where title = 'bob task';
grant select on bob_node to authenticated;
set local role authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
select is((select count(*)::int from public.nodes where title = 'bob task'), 0, 'cannot read another tenant node');
with changed as (update public.nodes set title = 'hijacked' where title = 'bob task' returning 1)
select is((select count(*)::int from changed), 0, 'cannot update another tenant node');
with removed as (delete from public.nodes where title = 'bob task' returning 1)
select is((select count(*)::int from removed), 0, 'cannot delete another tenant node');
select throws_ok($$insert into public.links (workspace_id, src, dst, kind) select alice_ws, (select id from public.nodes where title = 'alice task'), (select id from bob_node), 'relates_to' from ctx$$, '42501', null, 'cannot link to another tenant node');
select throws_ok($$insert into public.workspaces (name, owner_id) values ('rogue', 'aaaaaaaa-0000-0000-0000-000000000001')$$, '42501', null, 'workspaces cannot be created directly');

reset role;
set local role anon;
select throws_ok($$select 1 from public.nodes$$, '42501', null, 'anonymous role cannot read nodes');
select throws_ok($$select public.is_member(gen_random_uuid())$$, '42501', null, 'anonymous role cannot call the membership helper');
select throws_ok($$insert into public.profiles (id) values (gen_random_uuid())$$, '42501', null, 'anonymous role cannot write profiles');
reset role;

select is((select count(*)::int from pg_tables t where t.schemaname = 'public' and not exists (select 1 from pg_class c where c.oid = format('public.%I', t.tablename)::regclass and c.relrowsecurity)), 0, 'every public table has row level security enabled');

select * from finish();

rollback;
