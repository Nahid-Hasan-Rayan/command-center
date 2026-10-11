-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

select plan(29);

create function pg_temp.login(uid text, aal text default 'aal2') returns text
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal)::text, true) $$;
grant execute on function pg_temp.login(text, text) to authenticated, anon;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'carol@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'dave@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'eve@example.test');

create temp table ctx as select
  (select id from public.workspaces where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') as ws;
grant select on ctx to authenticated, anon;

insert into public.workspace_members (workspace_id, user_id, role)
select ws, u, 'viewer' from ctx,
  (values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid), ('aaaaaaaa-0000-0000-0000-000000000003'::uuid),
          ('aaaaaaaa-0000-0000-0000-000000000005'::uuid)) as v(u);
insert into public.member_features (workspace_id, user_id, feature)
select ws, u, f from ctx,
  (values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'messages'),
          ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'calendar'),
          ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'messages')) as v(u, f);

set local role authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$insert into public.channels (workspace_id, kind, name, created_by)
    select ws, 'channel', 'general', 'aaaaaaaa-0000-0000-0000-000000000001' from ctx$$,
  'the owner can create a channel'
);
reset role;
create temp table chan as select id from public.channels where name = 'general';
grant select on chan to authenticated;
set local role authenticated;

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok(
  $$insert into public.channels (workspace_id, kind, name, created_by)
    select ws, 'channel', 'rogue', 'aaaaaaaa-0000-0000-0000-000000000002' from ctx$$,
  '42501', null, 'a member cannot create channels'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$insert into public.channel_members (channel_id, workspace_id, user_id)
    select (select id from chan), ws, u from ctx,
      (values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid)) as v(u)$$,
  'the owner can add members to a channel'
);
select throws_ok(
  $$insert into public.channel_members (channel_id, workspace_id, user_id)
    select (select id from chan), ws, 'aaaaaaaa-0000-0000-0000-000000000003' from ctx$$,
  '42501', null, 'a member without the messages feature cannot be added'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.channels), 1, 'a channel member sees the channel');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select is((select count(*)::int from public.channels), 0, 'a non-member sees no channels');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select is((select count(*)::int from public.channels), 0, 'an outsider sees no channels');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select lives_ok(
  $$insert into public.messages (workspace_id, channel_id, sender_id, body)
    select ws, (select id from chan), 'aaaaaaaa-0000-0000-0000-000000000002', 'hello team' from ctx$$,
  'a viewer with the messages feature can send a message'
);
select throws_ok(
  $$insert into public.messages (workspace_id, channel_id, sender_id, body)
    select ws, (select id from chan), 'aaaaaaaa-0000-0000-0000-000000000001', 'spoofed' from ctx$$,
  '42501', null, 'a sender cannot impersonate another user'
);
select throws_ok(
  $$insert into public.messages (workspace_id, channel_id, sender_id, body)
    select ws, (select id from chan), 'aaaaaaaa-0000-0000-0000-000000000002', repeat('x', 4001) from ctx$$,
  '23514', null, 'message length is capped'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok(
  $$insert into public.messages (workspace_id, channel_id, sender_id, body)
    select ws, (select id from chan), 'aaaaaaaa-0000-0000-0000-000000000003', 'let me in' from ctx$$,
  '42501', null, 'a non-member cannot post'
);
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select is((select count(*)::int from public.messages), 0, 'an outsider cannot read messages');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.messages), 1, 'the owner reads channel messages');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
update public.messages set body = 'hello again' where sender_id = 'aaaaaaaa-0000-0000-0000-000000000002';
select isnt((select edited_at from public.messages limit 1), null, 'editing a message records the edit time');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$update public.messages set body = 'tampered'$$,
  '42501', null, 'the owner cannot rewrite another user message'
);
update public.messages set deleted_at = now();
select is((select body from public.messages limit 1), '[deleted]', 'the owner can moderate and the body is blanked');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok(
  $$update public.messages set deleted_at = null, body = 'restored'$$,
  '42501', null, 'a deleted message cannot be restored'
);
select throws_ok(
  $$update public.messages set sender_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null, 'sender cannot be changed'
);
select throws_ok(
  $sql$do $body$
    begin
      for i in 1..40 loop
        insert into public.messages (workspace_id, channel_id, sender_id, body)
        values ((select ws from ctx), (select id from chan), 'aaaaaaaa-0000-0000-0000-000000000002', 'spam ' || i);
      end loop;
    end
  $body$$sql$,
  '54000', null, 'message sending is rate limited'
);

select is(
  public.open_direct_channel((select ws from ctx), 'aaaaaaaa-0000-0000-0000-000000000001'),
  public.open_direct_channel((select ws from ctx), 'aaaaaaaa-0000-0000-0000-000000000001'),
  'opening a direct channel twice returns the same channel'
);
select throws_ok(
  $$select public.open_direct_channel((select ws from ctx), 'aaaaaaaa-0000-0000-0000-000000000003')$$,
  '42501', null, 'a direct channel needs a recipient with the messages feature'
);
select throws_ok(
  $$select public.open_direct_channel((select ws from ctx), 'aaaaaaaa-0000-0000-0000-000000000002')$$,
  '22023', null, 'a direct channel cannot be opened with yourself'
);

create temp table dm as select public.open_direct_channel((select ws from ctx), 'aaaaaaaa-0000-0000-0000-000000000005') as id;
grant select on dm to authenticated;
insert into public.messages (workspace_id, channel_id, sender_id, body)
select (select ws from ctx), id, 'aaaaaaaa-0000-0000-0000-000000000002', 'private note' from dm;

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.messages where channel_id = (select id from dm)),
  0, 'the owner cannot read a direct message between two other members'
);
with changed as (update public.channel_members set last_read_at = now()
                 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
select is((select count(*)::int from changed), 2, 'a member can update their own read markers');
with changed as (update public.channel_members set last_read_at = now()
                 where user_id = 'aaaaaaaa-0000-0000-0000-000000000002' returning 1)
select is((select count(*)::int from changed), 0, 'a member cannot update another read marker');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
delete from public.member_features where user_id = 'aaaaaaaa-0000-0000-0000-000000000002' and feature = 'messages';
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.channels), 0, 'revoking the messages feature hides all channels');
select throws_ok(
  $$insert into public.messages (workspace_id, channel_id, sender_id, body)
    select ws, (select id from chan), 'aaaaaaaa-0000-0000-0000-000000000002', 'still here' from ctx$$,
  '42501', null, 'revoking the messages feature stops posting'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select count(*)::int from public.channels), 0, 'an aal1 session sees no channels');

reset role;
set local role anon;
select throws_ok($$select 1 from public.messages$$, '42501', null, 'the anonymous role cannot read messages');

select * from finish();

rollback;
