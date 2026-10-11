-- NHR
-- Author: Nahid Hasan Rayan

create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  uploader_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (
    char_length(name) between 1 and 200 and name !~ '[/\\]' and name !~ '[[:cntrl:]]'
  ),
  mime_type text not null check (
    mime_type in (
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
      'text/plain', 'text/markdown', 'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
  ),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'ready', 'rejected')),
  node_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, id),
  check (storage_path = workspace_id::text || '/' || id::text),
  foreign key (workspace_id, node_id) references public.nodes (workspace_id, id) on delete set null (node_id)
);

create index files_workspace_idx on public.files (workspace_id, created_at desc) where deleted_at is null;

create function public.files_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id
    or new.workspace_id <> old.workspace_id
    or new.uploader_id <> old.uploader_id
    or new.mime_type <> old.mime_type
    or new.size_bytes <> old.size_bytes
    or new.storage_path <> old.storage_path
    or new.created_at <> old.created_at then
    raise exception 'immutable file fields' using errcode = '42501';
  end if;
  if new.status <> old.status and old.status <> 'pending' then
    raise exception 'file status is final' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger files_guard_update before update on public.files
  for each row execute function public.files_guard();

alter table public.files enable row level security;

create policy files_select on public.files for select
  using (public.can_access(workspace_id, 'files') and (status = 'ready' or uploader_id = (select auth.uid())));
create policy files_insert on public.files for insert
  with check (
    public.can_access(workspace_id, 'files', 'editor')
    and uploader_id = (select auth.uid())
    and status = 'pending'
  );
create policy files_update on public.files for update
  using (
    public.can_access(workspace_id, 'files', 'editor')
    and (uploader_id = (select auth.uid()) or public.is_member(workspace_id, 'owner'))
  )
  with check (
    public.can_access(workspace_id, 'files', 'editor')
    and (uploader_id = (select auth.uid()) or public.is_member(workspace_id, 'owner'))
  );
create policy files_delete on public.files for delete
  using (
    public.can_access(workspace_id, 'files', 'editor')
    and (uploader_id = (select auth.uid()) or public.is_member(workspace_id, 'owner'))
  );

create function public.path_workspace(object_name text) returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-files', 'workspace-files', false, 10485760,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'text/plain', 'text/markdown', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy workspace_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'workspace-files'
    and public.can_access(public.path_workspace(objects.name), 'files')
    and exists (
      select 1 from public.files f
      where f.storage_path = objects.name
        and f.deleted_at is null
        and (f.status = 'ready' or f.uploader_id = (select auth.uid()))
    )
  );
create policy workspace_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'workspace-files'
    and public.can_access(public.path_workspace(objects.name), 'files', 'editor')
    and exists (
      select 1 from public.files f
      where f.storage_path = objects.name
        and f.uploader_id = (select auth.uid())
        and f.status = 'pending'
        and f.deleted_at is null
    )
  );
create policy workspace_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'workspace-files'
    and public.can_access(public.path_workspace(objects.name), 'files', 'editor')
    and exists (
      select 1 from public.files f
      where f.storage_path = objects.name
        and (f.uploader_id = (select auth.uid()) or public.is_member(f.workspace_id, 'owner'))
    )
  );

revoke all on public.files from anon;
revoke execute on function public.files_guard() from public, anon;
revoke execute on function public.path_workspace(text) from public, anon;
grant execute on function public.path_workspace(text) to authenticated;
grant select, insert, update, delete on public.files to authenticated;
