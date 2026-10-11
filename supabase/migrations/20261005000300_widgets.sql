-- NHR
-- Author: Nahid Hasan Rayan

alter table public.member_features drop constraint member_features_feature_check;
alter table public.member_features add constraint member_features_feature_check check (
  feature in ('calendar', 'courses', 'study', 'career', 'goals', 'notes', 'analytics', 'messages', 'files', 'widgets')
);

alter table public.invitations drop constraint invitations_features_check;
alter table public.invitations add constraint invitations_features_check check (
  features <@ array['calendar', 'courses', 'study', 'career', 'goals', 'notes', 'analytics', 'messages', 'files', 'widgets']
);

create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  uploader_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  html text not null check (char_length(html) between 1 and 2000000),
  content_hash text not null default '',
  approved_hash text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'disabled')),
  permissions text[] not null default '{}' check (permissions <@ array['read:calendar']),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.widget_state (
  workspace_id uuid not null,
  widget_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 524288),
  updated_at timestamptz not null default now(),
  primary key (widget_id, user_id),
  foreign key (workspace_id, widget_id) references public.widgets (workspace_id, id) on delete cascade
);

create index widgets_workspace_idx on public.widgets (workspace_id, created_at desc);

create function public.widget_runnable(widget uuid) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.widgets w
    where w.id = widget
      and w.status = 'approved'
      and w.approved_hash = w.content_hash
      and public.can_access(w.workspace_id, 'widgets')
  );
$$;

create function public.widgets_guard() returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner_actor boolean := public.is_member(new.workspace_id, 'owner');
begin
  new.content_hash := encode(sha256(convert_to(new.html, 'UTF8')), 'hex');

  if tg_op = 'INSERT' then
    if not owner_actor then
      new.status := 'pending';
      new.permissions := '{}';
      new.approved_hash := null;
    elsif new.status = 'approved' then
      new.approved_hash := new.content_hash;
    end if;
    new.version := 1;
    return new;
  end if;

  if new.id <> old.id or new.workspace_id <> old.workspace_id or new.uploader_id <> old.uploader_id then
    raise exception 'immutable widget fields' using errcode = '42501';
  end if;

  new.updated_at := now();

  if new.html <> old.html then
    new.version := old.version + 1;
    if not owner_actor then
      new.status := 'pending';
      new.permissions := '{}';
      new.approved_hash := null;
    end if;
  end if;

  if not owner_actor then
    if new.status <> old.status or new.permissions <> old.permissions or new.approved_hash is distinct from old.approved_hash then
      if not (new.html <> old.html) then
        raise exception 'only the owner can change approval or permissions' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if new.status = 'approved' then
    new.approved_hash := new.content_hash;
  end if;
  return new;
end;
$$;

create trigger widgets_guard_insert before insert on public.widgets
  for each row execute function public.widgets_guard();
create trigger widgets_guard_update before update on public.widgets
  for each row execute function public.widgets_guard();

alter table public.widgets enable row level security;
alter table public.widget_state enable row level security;

create policy widgets_select on public.widgets for select
  using (
    public.can_access(workspace_id, 'widgets')
    and (
      (status = 'approved' and approved_hash = content_hash)
      or uploader_id = (select auth.uid())
      or public.is_member(workspace_id, 'owner')
    )
  );
create policy widgets_insert on public.widgets for insert
  with check (public.can_access(workspace_id, 'widgets', 'editor') and uploader_id = (select auth.uid()));
create policy widgets_update on public.widgets for update
  using (
    public.can_access(workspace_id, 'widgets', 'editor')
    and (uploader_id = (select auth.uid()) or public.is_member(workspace_id, 'owner'))
  )
  with check (
    public.can_access(workspace_id, 'widgets', 'editor')
    and (uploader_id = (select auth.uid()) or public.is_member(workspace_id, 'owner'))
  );
create policy widgets_delete on public.widgets for delete
  using (
    public.can_access(workspace_id, 'widgets', 'editor')
    and (uploader_id = (select auth.uid()) or public.is_member(workspace_id, 'owner'))
  );

create policy widget_state_select on public.widget_state for select
  using (user_id = (select auth.uid()) and public.widget_runnable(widget_id));
create policy widget_state_insert on public.widget_state for insert
  with check (user_id = (select auth.uid()) and public.widget_runnable(widget_id));
create policy widget_state_update on public.widget_state for update
  using (user_id = (select auth.uid()) and public.widget_runnable(widget_id))
  with check (user_id = (select auth.uid()) and public.widget_runnable(widget_id));
create policy widget_state_delete on public.widget_state for delete
  using (user_id = (select auth.uid()));

revoke all on public.widgets, public.widget_state from anon;
revoke execute on function public.widget_runnable(uuid) from public, anon;
revoke execute on function public.widgets_guard() from public, anon;
grant execute on function public.widget_runnable(uuid) to authenticated;
grant select, insert, update, delete on public.widgets to authenticated;
grant select, insert, update, delete on public.widget_state to authenticated;
