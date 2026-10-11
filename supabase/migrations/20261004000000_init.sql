-- NHR
-- Author: Nahid Hasan Rayan

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kuala_Lumpur',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null check (
    type in (
      'goal', 'project', 'task', 'course', 'topic', 'assessment', 'habit', 'problem',
      'card', 'application', 'contact', 'note', 'decision', 'experiment', 'page'
    )
  ),
  title text not null check (char_length(title) between 1 and 500),
  status text,
  parent_id uuid,
  props jsonb not null default '{}'::jsonb,
  sort_key text,
  provenance jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, parent_id) references public.nodes (workspace_id, id)
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  src uuid not null,
  dst uuid not null,
  kind text not null check (kind in ('parent', 'depends_on', 'belongs_to', 'scheduled_for', 'relates_to')),
  created_at timestamptz not null default now(),
  unique (workspace_id, src, dst, kind),
  check (src <> dst),
  foreign key (workspace_id, src) references public.nodes (workspace_id, id) on delete cascade,
  foreign key (workspace_id, dst) references public.nodes (workspace_id, id) on delete cascade
);

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  node_id uuid,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  rrule text,
  location text,
  kind text,
  status text not null default 'confirmed' check (status in ('confirmed', 'template', 'projected')),
  source text,
  source_ref text,
  uid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at >= starts_at),
  foreign key (workspace_id, node_id) references public.nodes (workspace_id, id) on delete set null (node_id)
);

create table public.events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  node_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.review_state (
  item_id uuid primary key,
  workspace_id uuid not null,
  due_at timestamptz not null,
  stability real not null default 0,
  difficulty real not null default 0,
  state smallint not null default 0 check (state between 0 and 3),
  reps integer not null default 0,
  lapses integer not null default 0,
  last_review timestamptz,
  foreign key (workspace_id, item_id) references public.nodes (workspace_id, id) on delete cascade
);

create table public.review_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  item_id uuid not null,
  rating smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now(),
  elapsed_days real,
  scheduled_days real,
  state_before smallint,
  foreign key (workspace_id, item_id) references public.nodes (workspace_id, id) on delete cascade
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  course_id uuid not null,
  session_date date not null,
  kind text not null check (kind in ('lecture', 'lab')),
  status text not null check (status in ('present', 'absent', 'excused', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (course_id, session_date, kind),
  foreign key (workspace_id, course_id) references public.nodes (workspace_id, id) on delete cascade
);

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  assessment_id uuid not null,
  score numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0),
  recorded_at timestamptz not null default now(),
  check (score <= max_score),
  foreign key (workspace_id, assessment_id) references public.nodes (workspace_id, id) on delete cascade
);

create table public.sleep_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  night date not null,
  slept_at timestamptz,
  woke_at timestamptz,
  quality smallint check (quality between 1 and 5),
  unique (user_id, night)
);

create table public.habit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  habit_id uuid not null,
  day date not null,
  level text not null check (level in ('full', 'floor', 'skipped', 'paused')),
  note text,
  unique (habit_id, day),
  foreign key (workspace_id, habit_id) references public.nodes (workspace_id, id) on delete cascade
);

create table public.application_stage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  application_id uuid not null,
  stage text not null,
  at timestamptz not null default now(),
  note text,
  foreign key (workspace_id, application_id) references public.nodes (workspace_id, id) on delete cascade
);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null,
  value jsonb not null,
  source_url text,
  verified_on date,
  valid_until date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  filename text not null,
  content_hash text not null,
  status text not null default 'previewed' check (status in ('previewed', 'committed', 'rolled_back')),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index nodes_workspace_type_idx on public.nodes (workspace_id, type) where deleted_at is null;
create index nodes_parent_idx on public.nodes (workspace_id, parent_id);
create index links_src_idx on public.links (workspace_id, src);
create index links_dst_idx on public.links (workspace_id, dst);
create index schedule_items_window_idx on public.schedule_items (workspace_id, starts_at) where deleted_at is null;
create index events_workspace_time_idx on public.events (workspace_id, occurred_at);
create index events_type_idx on public.events (workspace_id, type, occurred_at);
create index review_state_due_idx on public.review_state (workspace_id, due_at);
create index review_log_item_idx on public.review_log (item_id, reviewed_at);
create index attendance_course_idx on public.attendance (workspace_id, course_id);
create index application_stage_idx on public.application_stage (application_id, at);

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger workspaces_updated before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger nodes_updated before update on public.nodes
  for each row execute function public.set_updated_at();
create trigger schedule_items_updated before update on public.schedule_items
  for each row execute function public.set_updated_at();
create trigger rules_updated before update on public.rules
  for each row execute function public.set_updated_at();

create function public.is_member(ws uuid, min_role text default 'viewer') returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
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

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (name, owner_id)
  values ('Personal', new.id)
  returning id into new_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.nodes enable row level security;
alter table public.links enable row level security;
alter table public.schedule_items enable row level security;
alter table public.events enable row level security;
alter table public.review_state enable row level security;
alter table public.review_log enable row level security;
alter table public.attendance enable row level security;
alter table public.marks enable row level security;
alter table public.sleep_log enable row level security;
alter table public.habit_log enable row level security;
alter table public.application_stage enable row level security;
alter table public.rules enable row level security;
alter table public.imports enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_select on public.workspaces for select
  using (public.is_member(id));
create policy workspaces_update on public.workspaces for update
  using (public.is_member(id, 'owner')) with check (public.is_member(id, 'owner'));
create policy workspaces_delete on public.workspaces for delete
  using (public.is_member(id, 'owner'));

create policy members_select on public.workspace_members for select
  using (public.is_member(workspace_id));
create policy members_insert on public.workspace_members for insert
  with check (public.is_member(workspace_id, 'owner'));
create policy members_update on public.workspace_members for update
  using (public.is_member(workspace_id, 'owner')) with check (public.is_member(workspace_id, 'owner'));
create policy members_delete on public.workspace_members for delete
  using (public.is_member(workspace_id, 'owner'));

create policy nodes_select on public.nodes for select using (public.is_member(workspace_id));
create policy nodes_insert on public.nodes for insert with check (public.is_member(workspace_id, 'editor'));
create policy nodes_update on public.nodes for update
  using (public.is_member(workspace_id, 'editor')) with check (public.is_member(workspace_id, 'editor'));
create policy nodes_delete on public.nodes for delete using (public.is_member(workspace_id, 'editor'));

create policy links_select on public.links for select using (public.is_member(workspace_id));
create policy links_insert on public.links for insert with check (public.is_member(workspace_id, 'editor'));
create policy links_delete on public.links for delete using (public.is_member(workspace_id, 'editor'));

create policy schedule_items_select on public.schedule_items for select using (public.is_member(workspace_id));
create policy schedule_items_insert on public.schedule_items for insert with check (public.is_member(workspace_id, 'editor'));
create policy schedule_items_update on public.schedule_items for update
  using (public.is_member(workspace_id, 'editor')) with check (public.is_member(workspace_id, 'editor'));
create policy schedule_items_delete on public.schedule_items for delete using (public.is_member(workspace_id, 'editor'));

create policy events_select on public.events for select using (public.is_member(workspace_id));
create policy events_insert on public.events for insert
  with check (public.is_member(workspace_id, 'editor') and user_id = (select auth.uid()));

create policy review_state_select on public.review_state for select using (public.is_member(workspace_id));
create policy review_state_insert on public.review_state for insert with check (public.is_member(workspace_id, 'editor'));
create policy review_state_update on public.review_state for update
  using (public.is_member(workspace_id, 'editor')) with check (public.is_member(workspace_id, 'editor'));
create policy review_state_delete on public.review_state for delete using (public.is_member(workspace_id, 'editor'));

create policy review_log_select on public.review_log for select using (public.is_member(workspace_id));
create policy review_log_insert on public.review_log for insert with check (public.is_member(workspace_id, 'editor'));

create policy attendance_select on public.attendance for select using (public.is_member(workspace_id));
create policy attendance_insert on public.attendance for insert with check (public.is_member(workspace_id, 'editor'));
create policy attendance_update on public.attendance for update
  using (public.is_member(workspace_id, 'editor')) with check (public.is_member(workspace_id, 'editor'));
create policy attendance_delete on public.attendance for delete using (public.is_member(workspace_id, 'editor'));

create policy marks_select on public.marks for select using (public.is_member(workspace_id));
create policy marks_insert on public.marks for insert with check (public.is_member(workspace_id, 'editor'));
create policy marks_update on public.marks for update
  using (public.is_member(workspace_id, 'editor')) with check (public.is_member(workspace_id, 'editor'));
create policy marks_delete on public.marks for delete using (public.is_member(workspace_id, 'editor'));

create policy sleep_log_select on public.sleep_log for select
  using (public.is_member(workspace_id) and user_id = (select auth.uid()));
create policy sleep_log_insert on public.sleep_log for insert
  with check (public.is_member(workspace_id, 'editor') and user_id = (select auth.uid()));
create policy sleep_log_update on public.sleep_log for update
  using (user_id = (select auth.uid()) and public.is_member(workspace_id, 'editor'))
  with check (user_id = (select auth.uid()) and public.is_member(workspace_id, 'editor'));
create policy sleep_log_delete on public.sleep_log for delete
  using (user_id = (select auth.uid()) and public.is_member(workspace_id, 'editor'));

create policy habit_log_select on public.habit_log for select using (public.is_member(workspace_id));
create policy habit_log_insert on public.habit_log for insert with check (public.is_member(workspace_id, 'editor'));
create policy habit_log_update on public.habit_log for update
  using (public.is_member(workspace_id, 'editor')) with check (public.is_member(workspace_id, 'editor'));
create policy habit_log_delete on public.habit_log for delete using (public.is_member(workspace_id, 'editor'));

create policy application_stage_select on public.application_stage for select using (public.is_member(workspace_id));
create policy application_stage_insert on public.application_stage for insert with check (public.is_member(workspace_id, 'editor'));

create policy rules_select on public.rules for select using (public.is_member(workspace_id));
create policy rules_insert on public.rules for insert with check (public.is_member(workspace_id, 'owner'));
create policy rules_update on public.rules for update
  using (public.is_member(workspace_id, 'owner')) with check (public.is_member(workspace_id, 'owner'));
create policy rules_delete on public.rules for delete using (public.is_member(workspace_id, 'owner'));

create policy imports_select on public.imports for select using (public.is_member(workspace_id));
create policy imports_insert on public.imports for insert with check (public.is_member(workspace_id, 'editor'));
create policy imports_update on public.imports for update
  using (public.is_member(workspace_id, 'editor')) with check (public.is_member(workspace_id, 'editor'));

create policy audit_log_select on public.audit_log for select using (public.is_member(workspace_id, 'owner'));
create policy audit_log_insert on public.audit_log for insert
  with check (public.is_member(workspace_id, 'editor') and user_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on function public.is_member(uuid, text) from public;
revoke execute on function public.handle_new_user() from public;
grant execute on function public.is_member(uuid, text) to authenticated;

grant select, update on public.profiles to authenticated;
grant select, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.nodes to authenticated;
grant select, insert, delete on public.links to authenticated;
grant select, insert, update, delete on public.schedule_items to authenticated;
grant select, insert on public.events to authenticated;
grant select, insert, update, delete on public.review_state to authenticated;
grant select, insert on public.review_log to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.marks to authenticated;
grant select, insert, update, delete on public.sleep_log to authenticated;
grant select, insert, update, delete on public.habit_log to authenticated;
grant select, insert on public.application_stage to authenticated;
grant select, insert, update, delete on public.rules to authenticated;
grant select, insert, update on public.imports to authenticated;
grant select, insert on public.audit_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;
