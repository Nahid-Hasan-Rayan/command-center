-- NHR
-- Author: Nahid Hasan Rayan

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

create function public.is_aal2() returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

create or replace function public.is_member(ws uuid, min_role text default 'viewer') returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_aal2() and exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and (
        min_role = 'viewer'
        or (min_role = 'editor' and m.role in ('editor', 'owner'))
        or (min_role = 'owner' and m.role = 'owner')
      )
  );
$$;

create table public.member_features (
  workspace_id uuid not null,
  user_id uuid not null,
  feature text not null check (
    feature in ('calendar', 'courses', 'study', 'career', 'goals', 'notes', 'analytics', 'messages', 'files')
  ),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id, feature),
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);

create function public.can_access(ws uuid, feature_id text, min_role text default 'viewer') returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_aal2() and exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and (
        min_role = 'viewer'
        or (min_role = 'editor' and m.role in ('editor', 'owner'))
        or (min_role = 'owner' and m.role = 'owner')
      )
      and (
        m.role = 'owner'
        or exists (
          select 1
          from public.member_features f
          where f.workspace_id = m.workspace_id
            and f.user_id = m.user_id
            and f.feature = feature_id
        )
      )
  );
$$;

create function public.node_feature(node_type text) returns text
language sql
immutable
set search_path = public
as $$
  select case node_type
    when 'task' then 'calendar'
    when 'course' then 'courses'
    when 'assessment' then 'courses'
    when 'topic' then 'courses'
    when 'habit' then 'study'
    when 'problem' then 'study'
    when 'card' then 'study'
    when 'application' then 'career'
    when 'contact' then 'career'
    when 'goal' then 'goals'
    when 'project' then 'goals'
    when 'decision' then 'goals'
    when 'experiment' then 'goals'
    else 'notes'
  end;
$$;

create function public.can_access_node(node uuid, min_role text default 'viewer') returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.can_access(n.workspace_id, public.node_feature(n.type), min_role)
     from public.nodes n
     where n.id = node),
    false
  );
$$;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null check (role in ('editor', 'viewer')),
  features text[] not null default '{}'
    check (features <@ array['calendar', 'courses', 'study', 'career', 'goals', 'notes', 'analytics', 'messages', 'files']),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index invitations_workspace_idx on public.invitations (workspace_id, created_at desc);

alter table public.member_features enable row level security;
alter table public.invitations enable row level security;

drop policy profiles_select on public.profiles;
drop policy profiles_update on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) and public.is_aal2());
create policy profiles_update on public.profiles for update
  using (id = (select auth.uid()) and public.is_aal2())
  with check (id = (select auth.uid()) and public.is_aal2());

drop policy members_insert on public.workspace_members;
drop policy members_update on public.workspace_members;
drop policy members_delete on public.workspace_members;
create policy members_update on public.workspace_members for update
  using (public.is_member(workspace_id, 'owner') and role <> 'owner')
  with check (public.is_member(workspace_id, 'owner') and role in ('editor', 'viewer'));
create policy members_delete on public.workspace_members for delete
  using (
    role <> 'owner'
    and public.is_member(workspace_id)
    and (user_id = (select auth.uid()) or public.is_member(workspace_id, 'owner'))
  );
revoke insert on public.workspace_members from authenticated;

create policy member_features_select on public.member_features for select
  using (public.is_aal2() and (user_id = (select auth.uid()) or public.is_member(workspace_id, 'owner')));
create policy member_features_insert on public.member_features for insert
  with check (
    public.is_member(workspace_id, 'owner')
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = member_features.workspace_id
        and m.user_id = member_features.user_id
        and m.role <> 'owner'
    )
  );
create policy member_features_delete on public.member_features for delete
  using (public.is_member(workspace_id, 'owner'));

create policy invitations_select on public.invitations for select
  using (public.is_member(workspace_id, 'owner'));
create policy invitations_insert on public.invitations for insert
  with check (
    public.is_member(workspace_id, 'owner')
    and created_by = (select auth.uid())
    and accepted_at is null
    and expires_at > now()
    and expires_at <= now() + interval '30 days'
  );
create policy invitations_delete on public.invitations for delete
  using (public.is_member(workspace_id, 'owner') and accepted_at is null);

drop policy nodes_select on public.nodes;
drop policy nodes_insert on public.nodes;
drop policy nodes_update on public.nodes;
drop policy nodes_delete on public.nodes;
create policy nodes_select on public.nodes for select
  using (public.can_access(workspace_id, public.node_feature(type)));
create policy nodes_insert on public.nodes for insert
  with check (public.can_access(workspace_id, public.node_feature(type), 'editor'));
create policy nodes_update on public.nodes for update
  using (public.can_access(workspace_id, public.node_feature(type), 'editor'))
  with check (public.can_access(workspace_id, public.node_feature(type), 'editor'));
create policy nodes_delete on public.nodes for delete
  using (public.can_access(workspace_id, public.node_feature(type), 'editor'));

drop policy links_select on public.links;
drop policy links_insert on public.links;
drop policy links_delete on public.links;
create policy links_select on public.links for select
  using (public.can_access_node(src) and public.can_access_node(dst));
create policy links_insert on public.links for insert
  with check (public.can_access_node(src, 'editor') and public.can_access_node(dst, 'editor'));
create policy links_delete on public.links for delete
  using (public.can_access_node(src, 'editor') and public.can_access_node(dst, 'editor'));

drop policy schedule_items_select on public.schedule_items;
drop policy schedule_items_insert on public.schedule_items;
drop policy schedule_items_update on public.schedule_items;
drop policy schedule_items_delete on public.schedule_items;
create policy schedule_items_select on public.schedule_items for select
  using (public.can_access(workspace_id, 'calendar'));
create policy schedule_items_insert on public.schedule_items for insert
  with check (public.can_access(workspace_id, 'calendar', 'editor'));
create policy schedule_items_update on public.schedule_items for update
  using (public.can_access(workspace_id, 'calendar', 'editor'))
  with check (public.can_access(workspace_id, 'calendar', 'editor'));
create policy schedule_items_delete on public.schedule_items for delete
  using (public.can_access(workspace_id, 'calendar', 'editor'));

drop policy events_select on public.events;
create policy events_select on public.events for select
  using (public.is_aal2() and (user_id = (select auth.uid()) or public.is_member(workspace_id, 'owner')));

drop policy review_state_select on public.review_state;
drop policy review_state_insert on public.review_state;
drop policy review_state_update on public.review_state;
drop policy review_state_delete on public.review_state;
create policy review_state_select on public.review_state for select
  using (public.can_access(workspace_id, 'study'));
create policy review_state_insert on public.review_state for insert
  with check (public.can_access(workspace_id, 'study', 'editor'));
create policy review_state_update on public.review_state for update
  using (public.can_access(workspace_id, 'study', 'editor'))
  with check (public.can_access(workspace_id, 'study', 'editor'));
create policy review_state_delete on public.review_state for delete
  using (public.can_access(workspace_id, 'study', 'editor'));

drop policy review_log_select on public.review_log;
drop policy review_log_insert on public.review_log;
create policy review_log_select on public.review_log for select
  using (public.can_access(workspace_id, 'study'));
create policy review_log_insert on public.review_log for insert
  with check (public.can_access(workspace_id, 'study', 'editor'));

drop policy attendance_select on public.attendance;
drop policy attendance_insert on public.attendance;
drop policy attendance_update on public.attendance;
drop policy attendance_delete on public.attendance;
create policy attendance_select on public.attendance for select
  using (public.can_access(workspace_id, 'courses'));
create policy attendance_insert on public.attendance for insert
  with check (public.can_access(workspace_id, 'courses', 'editor'));
create policy attendance_update on public.attendance for update
  using (public.can_access(workspace_id, 'courses', 'editor'))
  with check (public.can_access(workspace_id, 'courses', 'editor'));
create policy attendance_delete on public.attendance for delete
  using (public.can_access(workspace_id, 'courses', 'editor'));

drop policy marks_select on public.marks;
drop policy marks_insert on public.marks;
drop policy marks_update on public.marks;
drop policy marks_delete on public.marks;
create policy marks_select on public.marks for select
  using (public.can_access(workspace_id, 'courses'));
create policy marks_insert on public.marks for insert
  with check (public.can_access(workspace_id, 'courses', 'editor'));
create policy marks_update on public.marks for update
  using (public.can_access(workspace_id, 'courses', 'editor'))
  with check (public.can_access(workspace_id, 'courses', 'editor'));
create policy marks_delete on public.marks for delete
  using (public.can_access(workspace_id, 'courses', 'editor'));

drop policy habit_log_select on public.habit_log;
drop policy habit_log_insert on public.habit_log;
drop policy habit_log_update on public.habit_log;
drop policy habit_log_delete on public.habit_log;
create policy habit_log_select on public.habit_log for select
  using (public.can_access(workspace_id, 'study'));
create policy habit_log_insert on public.habit_log for insert
  with check (public.can_access(workspace_id, 'study', 'editor'));
create policy habit_log_update on public.habit_log for update
  using (public.can_access(workspace_id, 'study', 'editor'))
  with check (public.can_access(workspace_id, 'study', 'editor'));
create policy habit_log_delete on public.habit_log for delete
  using (public.can_access(workspace_id, 'study', 'editor'));

drop policy application_stage_select on public.application_stage;
drop policy application_stage_insert on public.application_stage;
create policy application_stage_select on public.application_stage for select
  using (public.can_access(workspace_id, 'career'));
create policy application_stage_insert on public.application_stage for insert
  with check (public.can_access(workspace_id, 'career', 'editor'));

drop policy rules_select on public.rules;
create policy rules_select on public.rules for select
  using (public.can_access(workspace_id, 'career'));

drop policy imports_select on public.imports;
drop policy imports_insert on public.imports;
drop policy imports_update on public.imports;
create policy imports_select on public.imports for select using (public.is_member(workspace_id, 'owner'));
create policy imports_insert on public.imports for insert with check (public.is_member(workspace_id, 'owner'));
create policy imports_update on public.imports for update
  using (public.is_member(workspace_id, 'owner')) with check (public.is_member(workspace_id, 'owner'));

create function public.accept_invitation(invite_token text) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  account record;
  invite public.invitations;
  hashed text := encode(sha256(convert_to(invite_token, 'UTF8')), 'hex');
  granted text;
begin
  if uid is null or not public.is_aal2() then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select u.email, u.email_confirmed_at into account from auth.users u where u.id = uid;
  if account.email_confirmed_at is null then
    raise exception 'email not confirmed' using errcode = '42501';
  end if;

  select * into invite
  from public.invitations
  where token_hash = hashed and accepted_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid or expired invitation' using errcode = 'P0002';
  end if;

  if lower(account.email) <> invite.email then
    raise exception 'invitation belongs to another account' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invite.workspace_id, uid, invite.role)
  on conflict (workspace_id, user_id) do nothing;

  foreach granted in array invite.features loop
    insert into public.member_features (workspace_id, user_id, feature)
    values (invite.workspace_id, uid, granted)
    on conflict do nothing;
  end loop;

  update public.invitations set accepted_at = now(), accepted_by = uid where id = invite.id;

  insert into public.audit_log (workspace_id, user_id, action, target, detail)
  values (invite.workspace_id, uid, 'invitation.accepted', invite.id::text, jsonb_build_object('role', invite.role));

  return invite.workspace_id;
end;
$$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on function public.is_aal2() from public, anon;
revoke execute on function public.can_access(uuid, text, text) from public, anon;
revoke execute on function public.node_feature(text) from public, anon;
revoke execute on function public.can_access_node(uuid, text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.is_aal2() to authenticated;
grant execute on function public.can_access(uuid, text, text) to authenticated;
grant execute on function public.node_feature(text) to authenticated;
grant execute on function public.can_access_node(uuid, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

grant select, insert, delete on public.member_features to authenticated;
grant select, insert, delete on public.invitations to authenticated;
grant select, update, delete on public.workspace_members to authenticated;
