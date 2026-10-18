-- NHR
-- Author: Nahid Hasan Rayan
--
-- Administrator monitoring: bug reports, app events (errors and timings), an overview for the
-- dashboard, and an audited view of conversations. Every administrator read of private messages
-- writes a row to admin_audit, so access is always on the record.

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null default '',
  page text not null default '' check (char_length(page) <= 200),
  summary text not null check (char_length(summary) between 3 and 120),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'wont_fix')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bug_reports_status_idx on public.bug_reports (status, created_at desc);
create index bug_reports_user_idx on public.bug_reports (user_id, created_at desc);

create table public.app_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind ~ '^[a-z][a-z0-9_.]{1,48}$'),
  severity text not null default 'info' check (severity in ('info', 'warn', 'error')),
  user_id uuid references auth.users (id) on delete set null,
  path text check (path is null or char_length(path) <= 200),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 600000),
  detail jsonb not null default '{}'::jsonb check (char_length(detail::text) <= 4096)
);

create index app_events_at_idx on public.app_events (at desc);
create index app_events_kind_idx on public.app_events (kind, at desc);
create index app_events_user_idx on public.app_events (user_id, at desc);

alter table public.bug_reports enable row level security;
alter table public.app_events enable row level security;
alter table public.app_events force row level security;

revoke all on public.bug_reports, public.app_events from anon, authenticated;
grant select, insert on public.bug_reports to authenticated;

create policy bug_reports_select_own on public.bug_reports for select
  using (user_id = (select auth.uid()) and public.is_aal2());
create policy bug_reports_insert_own on public.bug_reports for insert
  with check (
    user_id = (select auth.uid())
    and public.is_aal2()
    and public.is_approved()
  );

-- The reporter cannot choose the email, status or note, and files at most ten reports an hour.
create function public.bug_reports_prepare() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.bug_reports b
    where b.user_id = new.user_id and b.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'too many reports in the last hour' using errcode = '54000';
  end if;
  new.email := coalesce((select r.email from public.registrations r where r.user_id = new.user_id), '');
  new.status := 'open';
  new.admin_note := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger bug_reports_prepare_insert before insert on public.bug_reports
  for each row execute function public.bug_reports_prepare();

-- ---------------------------------------------------------------------------
-- App events: written only through this function, never directly
-- ---------------------------------------------------------------------------

create function public.log_app_event(
  kind text,
  severity text default 'info',
  path text default null,
  duration_ms integer default null,
  detail jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  uid uuid := (select auth.uid());
  safe jsonb := coalesce(detail, '{}'::jsonb);
begin
  if uid is null or not public.is_aal2() then
    return false;
  end if;
  if kind !~ '^[a-z][a-z0-9_.]{1,48}$' or severity not in ('info', 'warn', 'error') then
    return false;
  end if;
  if (select count(*) from public.app_events e where e.user_id = uid and e.at > now() - interval '1 minute') >= 120 then
    return false;
  end if;
  if char_length(safe::text) > 4096 then
    safe := jsonb_build_object('truncated', true);
  end if;

  insert into public.app_events (kind, severity, user_id, path, duration_ms, detail)
  values (kind, severity, uid, left(path, 200), least(greatest(duration_ms, 0), 600000), safe);
  return true;
end;
$$;

-- Keep 90 days of events. Schedule with pg_cron when the extension is enabled.
create function public.purge_old_app_events(keep_days integer default 90) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  removed bigint;
begin
  delete from public.app_events where at < now() - make_interval(days => greatest(keep_days, 7));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-app-events', '17 3 * * *', 'select public.purge_old_app_events(90)');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------

create function public.admin_list_bug_reports(status_filter text default null)
returns table (id uuid, created_at timestamptz, email text, page text, summary text, details text, status text, admin_note text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.require_platform_admin();
  return query
    select b.id, b.created_at, b.email, b.page, b.summary, b.details, b.status, b.admin_note
    from public.bug_reports b
    where status_filter is null or b.status = status_filter
    order by (b.status in ('open', 'in_progress')) desc, b.created_at desc
    limit 500;
end;
$$;

create function public.admin_update_bug_report(report uuid, new_status text, note text default null) returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
begin
  perform public.require_platform_admin();
  if new_status not in ('open', 'in_progress', 'resolved', 'wont_fix') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  update public.bug_reports
  set status = new_status, admin_note = left(note, 500), updated_at = now()
  where id = report;
  if not found then
    raise exception 'unknown report' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('bug.' || new_status, null, jsonb_build_object('report', report));
end;
$$;

create function public.admin_list_events(min_severity text default 'warn', max_rows integer default 100)
returns table (id bigint, at timestamptz, kind text, severity text, email text, path text, duration_ms integer, detail jsonb)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_variable
begin
  perform public.require_platform_admin();
  return query
    select e.id, e.at, e.kind, e.severity,
           (select r.email from public.registrations r where r.user_id = e.user_id),
           e.path, e.duration_ms, e.detail
    from public.app_events e
    where e.severity = any (case min_severity
            when 'info' then array['info', 'warn', 'error']
            when 'warn' then array['warn', 'error']
            else array['error'] end)
    order by e.at desc, e.id desc
    limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;

create function public.admin_overview() returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  perform public.require_platform_admin();
  select jsonb_build_object(
    'users', coalesce((select jsonb_object_agg(s.status, s.n)
                       from (select r.status, count(*) as n from public.registrations r group by r.status) s), '{}'::jsonb),
    'signups_14d', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day)
                             from (select g.day::date as day,
                                          (select count(*) from public.registrations r where r.requested_at::date = g.day::date) as n
                                   from generate_series(current_date - 13, current_date, interval '1 day') as g(day)) d), '[]'::jsonb),
    'active_users_7d', (select count(distinct u) from (
        select user_id as u from public.study_sessions where created_at > now() - interval '7 days'
        union select sender_id from public.messages where created_at > now() - interval '7 days'
        union select user_id from public.study_progress where done_at > now() - interval '7 days'
        union select user_id from public.app_events where at > now() - interval '7 days' and user_id is not null
      ) a),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'study_minutes_7d', coalesce((select sum(minutes) from public.study_sessions where created_at > now() - interval '7 days'), 0),
    'open_bugs', (select count(*) from public.bug_reports where status in ('open', 'in_progress')),
    'errors_24h', (select count(*) from public.app_events where severity = 'error' and at > now() - interval '1 day'),
    'errors_7d', (select count(*) from public.app_events where severity = 'error' and at > now() - interval '7 days'),
    'top_errors', coalesce((select jsonb_agg(jsonb_build_object('kind', t.kind, 'count', t.n) order by t.n desc)
                            from (select e.kind, count(*) as n from public.app_events e
                                  where e.severity = 'error' and e.at > now() - interval '7 days'
                                  group by e.kind order by count(*) desc limit 5) t), '[]'::jsonb),
    'timings', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'count', t.n, 'p50_ms', t.p50, 'p95_ms', t.p95) order by t.p95 desc)
                         from (select e.detail ->> 'name' as name, count(*) as n,
                                      round(percentile_cont(0.5) within group (order by e.duration_ms)::numeric) as p50,
                                      round(percentile_cont(0.95) within group (order by e.duration_ms)::numeric) as p95
                               from public.app_events e
                               where e.kind = 'action.timing' and e.duration_ms is not null
                                 and e.at > now() - interval '7 days' and e.detail ? 'name'
                               group by e.detail ->> 'name' order by 4 desc limit 20) t), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Conversations across every workspace. Listing is itself recorded.
create function public.admin_list_conversations(search text default null, max_rows integer default 100)
returns table (
  channel_id uuid, workspace_name text, kind text, name text, members text[],
  message_count bigint, last_message_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
begin
  perform public.require_platform_admin();
  perform public.log_admin_action('messages.list', null, jsonb_build_object('search', left(search, 80)));
  return query
    select c.id, w.name, c.kind, c.name,
           coalesce(array(select r.email from public.channel_members cm
                          join public.registrations r on r.user_id = cm.user_id
                          where cm.channel_id = c.id order by r.email), '{}'),
           (select count(*) from public.messages m where m.channel_id = c.id),
           (select max(m.created_at) from public.messages m where m.channel_id = c.id)
    from public.channels c
    join public.workspaces w on w.id = c.workspace_id
    where search is null or search = ''
       or c.name ilike '%' || search || '%'
       or exists (select 1 from public.channel_members cm
                  join public.registrations r on r.user_id = cm.user_id
                  where cm.channel_id = c.id and r.email ilike '%' || search || '%')
    order by (select max(m.created_at) from public.messages m where m.channel_id = c.id) desc nulls last
    limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;

-- Reading a conversation always writes an audit row naming the channel and how many messages were read.
create function public.admin_read_messages(channel uuid, max_rows integer default 200, before timestamptz default null)
returns table (id uuid, sender_email text, body text, created_at timestamptz, edited_at timestamptz, deleted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  shown integer;
  lim integer;
begin
  perform public.require_platform_admin();
  if not exists (select 1 from public.channels c where c.id = channel) then
    raise exception 'unknown conversation' using errcode = 'P0002';
  end if;

  lim := least(greatest(coalesce(max_rows, 200), 1), 500);

  select count(*) into shown from (
    select 1 from public.messages m
    where m.channel_id = channel and (before is null or m.created_at < before)
    limit lim
  ) counted;
  perform public.log_admin_action('messages.read', null, jsonb_build_object('channel', channel, 'messages', shown));

  return query
    select x.id, x.sender_email, x.body, x.created_at, x.edited_at, x.deleted_at
    from (
      select m.id, (select r.email from public.registrations r where r.user_id = m.sender_id) as sender_email,
             m.body, m.created_at, m.edited_at, m.deleted_at
      from public.messages m
      where m.channel_id = channel and (before is null or m.created_at < before)
      order by m.created_at desc
      limit lim
    ) x
    order by x.created_at asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.bug_reports_prepare(), public.log_app_event(text, text, text, integer, jsonb),
  public.purge_old_app_events(integer), public.admin_list_bug_reports(text),
  public.admin_update_bug_report(uuid, text, text), public.admin_list_events(text, integer),
  public.admin_overview(), public.admin_list_conversations(text, integer),
  public.admin_read_messages(uuid, integer, timestamptz)
  from public, anon, authenticated;

grant execute on function
  public.log_app_event(text, text, text, integer, jsonb), public.admin_list_bug_reports(text),
  public.admin_update_bug_report(uuid, text, text), public.admin_list_events(text, integer),
  public.admin_overview(), public.admin_list_conversations(text, integer),
  public.admin_read_messages(uuid, integer, timestamptz)
  to authenticated;
