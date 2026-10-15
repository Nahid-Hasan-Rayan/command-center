-- NHR
-- Author: Nahid Hasan Rayan

begin;

create extension if not exists pgtap;

-- Existing behaviour is tested with open registration; approval is covered in 06_platform_admin.
update public.platform_settings set value = 'open' where key = 'registration_mode';
update public.platform_settings set value = array_to_string(public.platform_features(), ',') where key = 'default_features';

select plan(25);

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
select ws, u, r from ctx,
  (values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'viewer'),
          ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'editor'),
          ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'viewer')) as v(u, r);
insert into public.member_features (workspace_id, user_id, feature)
select ws, u, f from ctx,
  (values ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'files'),
          ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'files'),
          ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'calendar')) as v(u, f);

set local role authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000001', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'notes.pdf', 'application/pdf', 1024,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000001' from ctx$$,
  'the owner can register a file'
);
select throws_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000009', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'x.pdf', 'application/pdf', 10,
           ws::text || '/cccccccc-0000-0000-0000-000000000009' from ctx$$,
  '23514', null, 'the storage path must match the workspace and file id'
);
select throws_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000009', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'x.html', 'text/html', 10,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000009' from ctx$$,
  '23514', null, 'HTML files are not accepted as shared files'
);
select throws_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000009', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'x.svg', 'image/svg+xml', 10,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000009' from ctx$$,
  '23514', null, 'SVG files are not accepted'
);
select throws_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000009', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'x.pdf', 'application/pdf', 10485761,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000009' from ctx$$,
  '23514', null, 'files over ten megabytes are rejected'
);
select throws_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000009', ws, 'aaaaaaaa-0000-0000-0000-000000000001', '../x.pdf', 'application/pdf', 10,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000009' from ctx$$,
  '23514', null, 'file names cannot contain path separators'
);
select throws_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path, status)
    select 'bbbbbbbb-0000-0000-0000-000000000009', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'x.pdf', 'application/pdf', 10,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000009', 'ready' from ctx$$,
  '42501', null, 'a file cannot be registered as already verified'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000008', ws, 'aaaaaaaa-0000-0000-0000-000000000002', 'v.pdf', 'application/pdf', 10,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000008' from ctx$$,
  '42501', null, 'a viewer cannot upload'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
select lives_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000002', ws, 'aaaaaaaa-0000-0000-0000-000000000003', 'plan.png', 'image/png', 2048,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000002' from ctx$$,
  'an editor with the files feature can upload'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.files), 0, 'pending files are hidden from other members');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
update public.files set status = 'ready' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from public.files), 1, 'verified files are visible to members with the feature');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$update public.files set status = 'rejected' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  '42501', null, 'a verified status is final'
);
select throws_ok(
  $$update public.files set size_bytes = 5 where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  '42501', null, 'file size and type cannot be changed after upload'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select is((select count(*)::int from public.files), 0, 'an outsider sees no files');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000005');
select is((select count(*)::int from public.files), 0, 'a member without the files feature sees no files');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
with changed as (update public.files set name = 'renamed.pdf' where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1)
select is((select count(*)::int from changed), 0, 'an editor cannot modify files uploaded by someone else');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$insert into public.files (id, workspace_id, uploader_id, name, mime_type, size_bytes, storage_path)
    select 'bbbbbbbb-0000-0000-0000-000000000003', ws, 'aaaaaaaa-0000-0000-0000-000000000001', 'draft.txt', 'text/plain', 12,
           ws::text || '/bbbbbbbb-0000-0000-0000-000000000003' from ctx$$,
  'the owner registers a second file'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    select 'workspace-files', ws::text || '/bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001' from ctx$$,
  'an object can be stored once its metadata exists'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    select 'workspace-files', ws::text || '/dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001' from ctx$$,
  '42501', null, 'an object without metadata is rejected'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    select 'workspace-files', ws::text || '/bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002' from ctx$$,
  '42501', null, 'a viewer cannot store objects'
);

reset role;
insert into storage.objects (bucket_id, name, owner)
select 'workspace-files', ws::text || '/bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001' from ctx;
set local role authenticated;

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from storage.objects), 1, 'a member reads only verified objects');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select is((select count(*)::int from storage.objects), 0, 'an outsider reads no objects');

select is(public.path_workspace('not-a-path'), null, 'a malformed storage path maps to no workspace');
select is(
  (select public.path_workspace(ws::text || '/bbbbbbbb-0000-0000-0000-000000000001') = ws from ctx),
  true, 'a valid storage path maps to its workspace'
);

reset role;
select is(
  (select public::text || '/' || file_size_limit::text from storage.buckets where id = 'workspace-files'),
  'false/10485760', 'the bucket is private with a ten megabyte limit'
);

select * from finish();

rollback;
