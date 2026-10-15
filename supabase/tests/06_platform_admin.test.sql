-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

select plan(57);

create function pg_temp.login(uid text, aal text default 'aal2') returns text
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal)::text, true) $$;
grant execute on function pg_temp.login(text, text) to authenticated, anon;

-- root = nhrayan@gmail.com (administrator), alice..gina = ordinary sign-ups (approval mode is the default)
insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'nhrayan@gmail.com', '{"display_name":"Nahid"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'alice@example.test',
     '{"display_name":"Alice Tan","whatsapp":"+60 12-345 6789","matric_id":"a25mj0186","note":"Study group"}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'bob@example.test',
     '{"display_name":"Bob","whatsapp":"call me maybe","matric_id":"x"}'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'carol@example.test', '{"display_name":"Carol"}'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'dave@example.test', '{"display_name":"Dave"}'),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'erin@example.test', '{"display_name":"Erin"}'),
  ('bbbbbbbb-0000-0000-0000-000000000007', 'frank@example.test', '{"display_name":"Frank"}'),
  ('bbbbbbbb-0000-0000-0000-000000000008', 'gina@example.test', '{"display_name":"Gina"}');

create temp table ctx as select
  (select id from public.workspaces where owner_id = 'bbbbbbbb-0000-0000-0000-000000000001') as root_ws,
  (select id from public.workspaces where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002') as alice_ws;
grant select on ctx to authenticated, anon;

-- sign-up -------------------------------------------------------------------------------------
select is((select status from public.registrations where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'approved',
  'the administrator email is approved at sign-up');
select is((select status from public.registrations where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'pending',
  'an ordinary sign-up is pending');
select is((select whatsapp || '/' || matric_id || '/' || note from public.registrations where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '+60 12-345 6789/A25MJ0186/Study group', 'registration details are stored and the matric id is upper-cased');
select ok((select whatsapp is null and matric_id is null from public.registrations where user_id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  'malformed WhatsApp and matric values are dropped instead of failing sign-up');

-- a pending account sees nothing ----------------------------------------------------------------
set local role authenticated;
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');

select is(public.is_approved(), false, 'a pending account is not approved');
select is((select count(*) from public.workspace_members), 0::bigint, 'a pending account reads no workspace membership');
select is((select count(*) from public.registrations), 1::bigint, 'an account reads only its own registration');
select is((select status from public.my_account()), 'pending', 'my_account reports pending');
select throws_ok($$update public.registrations set status = 'approved'$$, '42501', null,
  'an account cannot approve itself');
select throws_ok($$select * from public.admin_list_users()$$, '42501', null, 'an ordinary account cannot list users');
select throws_ok($$select count(*) from public.platform_settings$$, '42501', null, 'settings are not readable by clients');
select throws_ok($$select count(*) from public.admin_audit$$, '42501', null, 'the admin audit is not readable directly');
select throws_ok($$select * from public.admin_audit_list()$$, '42501', null, 'an ordinary account cannot read the admin audit');

-- administrator session -----------------------------------------------------------------------
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001', 'aal1');
select throws_ok($$select * from public.admin_list_users()$$, '42501', null, 'the administrator needs a second-factor session');

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select ok((select is_admin and is_root from public.my_account()), 'my_account reports the primary administrator');
select is((select count(*) from public.admin_list_users()), 8::bigint, 'the administrator lists every registration');
select is((select user_id from public.admin_list_users() limit 1) is not null, true, 'the list is readable');

select throws_ok($$select public.admin_decide_registration('bbbbbbbb-0000-0000-0000-000000000002', 'approve', null, array['bogus'])$$,
  '22023', null, 'unknown features are refused');
select throws_ok($$select public.admin_decide_registration('bbbbbbbb-0000-0000-0000-000000000002', 'maybe', null, '{}')$$,
  '22023', null, 'unknown decisions are refused');
select lives_ok($$select public.admin_decide_registration('bbbbbbbb-0000-0000-0000-000000000002', 'approve', 'welcome', array['calendar','notes'])$$,
  'the administrator approves a registration with chosen features');
select throws_ok($$select public.admin_decide_registration('bbbbbbbb-0000-0000-0000-000000000002', 'approve', null, '{}')$$,
  '55000', null, 'an account that is not awaiting a decision cannot be decided again');

-- an approved account gets exactly the granted features --------------------------------------------
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is((select status from public.my_account()), 'approved', 'the approved account is approved');
select is((select features from public.my_account()), array['calendar', 'notes'], 'only the granted features are listed');
select ok(public.is_member((select alice_ws from ctx), 'owner'), 'the approved account owns its workspace');
select ok(public.can_access((select alice_ws from ctx), 'calendar'), 'a granted feature is accessible');
select ok(not public.can_access((select alice_ws from ctx), 'career'), 'a feature that was not granted is blocked even in the own workspace');

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$select public.admin_set_entitlements('bbbbbbbb-0000-0000-0000-000000000002', array['career'])$$,
  'the administrator changes the features');
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select ok(public.can_access((select alice_ws from ctx), 'career') and not public.can_access((select alice_ws from ctx), 'calendar'),
  'the new feature set replaces the old one');

-- rejection -----------------------------------------------------------------------------------
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$select public.admin_decide_registration('bbbbbbbb-0000-0000-0000-000000000003', 'reject', 'not a student', '{}')$$,
  'the administrator rejects a registration');
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000003');
select is((select status from public.my_account()), 'rejected', 'a rejected account is told so');
select is(public.is_approved(), false, 'a rejected account has no access');

-- suspension ------------------------------------------------------------------------------------
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$select public.admin_set_status('bbbbbbbb-0000-0000-0000-000000000002', 'suspended', 'review')$$, 'an account is suspended');
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select ok(not public.is_member((select alice_ws from ctx)), 'a suspended account reads nothing');
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$select public.admin_set_status('bbbbbbbb-0000-0000-0000-000000000002', 'approved', null)$$, 'an account is reinstated');
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select ok(public.is_member((select alice_ws from ctx)), 'a reinstated account has access again');

-- protections and administrator roles ------------------------------------------------------------
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select throws_ok($$select public.admin_remove_user('bbbbbbbb-0000-0000-0000-000000000001', 'suspend', null, null)$$,
  '42501', null, 'the administrator cannot remove their own account');
select lives_ok($$select public.admin_decide_registration('bbbbbbbb-0000-0000-0000-000000000004', 'approve', null, array['calendar'])$$,
  'a second person is approved');
select lives_ok($$select public.admin_set_platform_admin('bbbbbbbb-0000-0000-0000-000000000004', true)$$,
  'the primary administrator grants the administrator role');

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000004');
select is((select is_admin and not is_root from public.my_account()), true, 'the new administrator is not the primary one');
select throws_ok($$select public.admin_set_platform_admin('bbbbbbbb-0000-0000-0000-000000000005', true)$$,
  '42501', null, 'only the primary administrator assigns administrators');
select throws_ok($$select public.admin_set_status('bbbbbbbb-0000-0000-0000-000000000001', 'suspended', null)$$,
  '42501', null, 'nobody can change the primary administrator');
select lives_ok($$select public.admin_decide_registration('bbbbbbbb-0000-0000-0000-000000000005', 'approve', null, array['notes'])$$,
  'a second administrator can approve people');

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$select public.admin_set_platform_admin('bbbbbbbb-0000-0000-0000-000000000004', false)$$, 'the administrator role is revoked');
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000004');
select throws_ok($$select * from public.admin_list_users()$$, '42501', null, 'a former administrator loses the admin pages');

-- removal needs an explicit option --------------------------------------------------------------------
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select throws_ok($$select public.admin_remove_user('bbbbbbbb-0000-0000-0000-000000000006', 'maybe', null, null)$$,
  '22023', null, 'a removal without a valid option is refused');
select throws_ok($$select public.admin_remove_user('bbbbbbbb-0000-0000-0000-000000000006', 'delete', null, 'wrong@example.test')$$,
  '22023', null, 'permanent deletion needs the email typed again');
select lives_ok($$select public.admin_remove_user('bbbbbbbb-0000-0000-0000-000000000006', 'ban', 'abuse', null)$$, 'a ban is applied');
select lives_ok($$select public.admin_remove_user('bbbbbbbb-0000-0000-0000-000000000005', 'archive', 'left', null)$$, 'an account is archived');
select is((select status from public.admin_list_users() where email = 'dave@example.test'), 'removed', 'an archived account is marked removed');
select lives_ok($$select public.admin_remove_user('bbbbbbbb-0000-0000-0000-000000000008', 'delete', 'spam', 'gina@example.test')$$,
  'permanent deletion works with the matching email');
select is((select count(*) from public.admin_list_users() where email = 'gina@example.test'), 0::bigint, 'a deleted account is gone');

-- the audit trail ---------------------------------------------------------------------------------------
select ok(exists (select 1 from public.admin_audit_list(500) where action = 'registration.approve' and admin_email = 'nhrayan@gmail.com'),
  'approvals are audited with the administrator');
select ok(exists (select 1 from public.admin_audit_list(500) where action = 'user.delete' and target_email = 'gina@example.test'),
  'deletions are audited with the removed email');

-- bans and invitations (superuser setup) ---------------------------------------------------------------
reset role;
insert into auth.users (id, email) values ('bbbbbbbb-0000-0000-0000-000000000009', 'erin@example.test');
select is((select status from public.registrations where user_id = 'bbbbbbbb-0000-0000-0000-000000000009'), 'banned',
  'a banned email cannot register again');
select is((select count(*) from public.workspaces where owner_id = 'bbbbbbbb-0000-0000-0000-000000000008'), 0::bigint,
  'permanent deletion also removed the workspace');

insert into public.invitations (workspace_id, email, role, features, token_hash, expires_at, created_by) values
  ((select root_ws from ctx), 'frank@example.test', 'viewer', array['calendar'],
     encode(sha256(convert_to('admin-token', 'UTF8')), 'hex'), now() + interval '1 day', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ((select alice_ws from ctx), 'gina2@example.test', 'viewer', array['career'],
     encode(sha256(convert_to('user-token', 'UTF8')), 'hex'), now() + interval '1 day', 'bbbbbbbb-0000-0000-0000-000000000002');
insert into auth.users (id, email) values ('bbbbbbbb-0000-0000-0000-00000000000a', 'gina2@example.test');

set local role authenticated;
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000007');
select public.accept_invitation('admin-token');
select is((select status from public.my_account()), 'approved', 'an invitation from the administrator pre-approves the invitee');

select pg_temp.login('bbbbbbbb-0000-0000-0000-00000000000a');
select public.accept_invitation('user-token');
select is((select status from public.my_account()), 'pending', 'an invitation from an ordinary member does not bypass approval');

select * from finish();
rollback;
