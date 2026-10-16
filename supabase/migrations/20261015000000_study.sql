-- NHR
-- Author: Nahid Hasan Rayan
--
-- Study planner: courses with exam dates and a unit list (shared inside a workspace), and
-- each person's own progress, focus sessions, past-paper scores and planning settings.
-- Every policy goes through can_access(), so approval and per-person features apply here too.

create table public.study_courses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 20),
  title text not null check (char_length(title) between 1 and 120),
  color text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  exam_date date,
  weight numeric(4, 2) not null default 1 check (weight > 0 and weight <= 10),
  catalog_id text check (catalog_id is null or char_length(catalog_id) <= 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, code),
  unique (workspace_id, id)
);

create table public.study_units (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  course_id uuid not null,
  unit_key text not null check (char_length(unit_key) between 1 and 80),
  topic text not null check (char_length(topic) between 1 and 160),
  title text not null check (char_length(title) between 1 and 200),
  position integer not null check (position >= 0),
  unique (course_id, unit_key),
  unique (workspace_id, id),
  foreign key (workspace_id, course_id) references public.study_courses (workspace_id, id) on delete cascade
);

create index study_units_course_idx on public.study_units (course_id, position);

create table public.study_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null,
  unit_id uuid not null,
  done_at timestamptz not null default now(),
  primary key (user_id, unit_id),
  foreign key (workspace_id, unit_id) references public.study_units (workspace_id, id) on delete cascade
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null,
  course_id uuid,
  session_date date not null,
  minutes integer not null check (minutes between 1 and 600),
  source text not null default 'manual' check (source in ('timer', 'manual')),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, course_id) references public.study_courses (workspace_id, id) on delete set null (course_id)
);

create index study_sessions_user_date_idx on public.study_sessions (user_id, session_date desc);

create table public.study_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null,
  course_id uuid not null,
  taken_on date not null,
  score_pct numeric(5, 2) not null check (score_pct between 0 and 100),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, course_id) references public.study_courses (workspace_id, id) on delete cascade
);

create index study_papers_user_idx on public.study_papers (user_id, course_id, taken_on desc);

create table public.study_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  daily_goal_min integer not null default 90 check (daily_goal_min between 10 and 720),
  unit_minutes integer not null default 30 check (unit_minutes between 5 and 240),
  -- ISO weekdays with no study planned: 1 = Monday ... 7 = Sunday
  rest_days integer[] not null default '{}' check (rest_days <@ array[1, 2, 3, 4, 5, 6, 7]),
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

alter table public.study_courses enable row level security;
alter table public.study_units enable row level security;
alter table public.study_progress enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_papers enable row level security;
alter table public.study_settings enable row level security;

-- Shared inside the workspace: viewers read, editors and owners change.
create policy study_courses_select on public.study_courses for select
  using (public.can_access(workspace_id, 'study'));
create policy study_courses_insert on public.study_courses for insert
  with check (public.can_access(workspace_id, 'study', 'editor') and created_by = (select auth.uid()));
create policy study_courses_update on public.study_courses for update
  using (public.can_access(workspace_id, 'study', 'editor'))
  with check (public.can_access(workspace_id, 'study', 'editor'));
create policy study_courses_delete on public.study_courses for delete
  using (public.can_access(workspace_id, 'study', 'editor'));

create policy study_units_select on public.study_units for select
  using (public.can_access(workspace_id, 'study'));
create policy study_units_insert on public.study_units for insert
  with check (public.can_access(workspace_id, 'study', 'editor'));
create policy study_units_update on public.study_units for update
  using (public.can_access(workspace_id, 'study', 'editor'))
  with check (public.can_access(workspace_id, 'study', 'editor'));
create policy study_units_delete on public.study_units for delete
  using (public.can_access(workspace_id, 'study', 'editor'));

-- Private to the person: nobody else in the workspace reads or writes these rows.
create policy study_progress_all on public.study_progress for all
  using (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'))
  with check (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'));
create policy study_sessions_all on public.study_sessions for all
  using (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'))
  with check (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'));
create policy study_papers_all on public.study_papers for all
  using (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'))
  with check (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'));
create policy study_settings_all on public.study_settings for all
  using (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'))
  with check (user_id = (select auth.uid()) and public.can_access(workspace_id, 'study'));

grant select, insert, update, delete on
  public.study_courses, public.study_units, public.study_progress,
  public.study_sessions, public.study_papers, public.study_settings
  to authenticated;
