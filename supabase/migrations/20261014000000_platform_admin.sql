-- NHR
-- Author: Nahid Hasan Rayan
--
-- Platform administration: registration requests, approval, per-person feature
-- entitlements, suspension / ban / removal, and an append-only admin audit trail.
--
-- Enforcement lives in the database. is_member() and can_access() now also require an
-- approved registration (and, for features, an entitlement), so a pending, suspended,
-- banned or removed account reads nothing from any table even if the app has a bug.

create function public.platform_features() returns text[]
language sql
immutable
set search_path = public
as $$
  select array['calendar', 'courses', 'study', 'career', 'goals', 'notes', 'analytics', 'messages', 'files', 'widgets'];
$$;

create table public.platform_settings (
  key text primary key,
  value text not null check (char_length(value) <= 500)
);

insert into public.platform_settings (key, value) values
  ('admin_email', 'nhrayan@gmail.com'),
  ('registration_mode', 'approval'),
  ('default_features', 'calendar,courses,study,goals,notes,files,messages');

create table public.registrations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 1 and 80),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ()-]{7,20}$'),
  matric_id text check (matric_id is null or matric_id ~ '^[A-Z0-9-]{4,20}$'),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended', 'banned', 'removed')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500)
);

create index registrations_status_idx on public.registrations (status, requested_at desc);

create table public.user_entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature = any (public.platform_features())),
  granted_at timestamptz not null default now(),
  primary key (user_id, feature)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create table public.blocked_emails (
  email text primary key check (email = lower(email)),
  reason text check (reason is null or char_length(reason) <= 500),
  blocked_by uuid references auth.users (id) on delete set null,
  blocked_at timestamptz not null default now()
);

create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_user uuid,
  target_email text,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index admin_audit_at_idx on public.admin_audit (at desc);

alter table public.platform_settings enable row level security;
alter table public.registrations enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.platform_admins enable row level security;
alter table public.blocked_emails enable row level security;
alter table public.admin_audit enable row level security;
alter table public.admin_audit force row level security;

revoke all on public.platform_settings, public.registrations, public.user_entitlements,
  public.platform_admins, public.blocked_emails, public.admin_audit from anon, authenticated;
grant select on public.registrations, public.user_entitlements, public.platform_admins to authenticated;

create policy registrations_select_own on public.registrations for select
  using (user_id = (select auth.uid()) and public.is_aal2());
create policy user_entitlements_select_own on public.user_entitlements for select
  using (user_id = (select auth.uid()) and public.is_aal2());
create policy platform_admins_select_own on public.platform_admins for select
  using (user_id = (select auth.uid()) and public.is_aal2());

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------

create function public.user_is_root(uid uuid) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = uid
      and u.email_confirmed_at is not null
      and lower(u.email) = lower((select s.value from public.platform_settings s where s.key = 'admin_email'))
  );
$$;

create function public.user_is_platform_admin(uid uuid) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.user_is_root(uid)
    or exists (select 1 from public.platform_admins a where a.user_id = uid);
$$;

create function public.is_root_admin() returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_aal2() and public.user_is_root((select auth.uid()));
$$;

create function public.is_platform_admin() returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_aal2() and public.user_is_platform_admin((select auth.uid()));
$$;

create function public.is_approved() returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.user_is_root((select auth.uid()))
    or exists (
      select 1 from public.registrations r
      where r.user_id = (select auth.uid()) and r.status = 'approved'
    );
$$;

create function public.has_entitlement(feature_id text) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.user_is_platform_admin((select auth.uid()))
    or exists (
      select 1 from public.user_entitlements e
      where e.user_id = (select auth.uid()) and e.feature = feature_id
    );
$$;

-- Membership and feature checks now require an approved account.
create or replace function public.is_member(ws uuid, min_role text default 'viewer') returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_aal2() and public.is_approved() and exists (
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

create or replace function public.can_access(ws uuid, feature_id text, min_role text default 'viewer') returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_aal2() and public.is_approved() and public.has_entitlement(feature_id) and exists (
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

-- ---------------------------------------------------------------------------
-- Sign-up creates a registration request
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  address text := lower(coalesce(new.email, ''));
  display text := left(coalesce(nullif(btrim(meta ->> 'display_name'), ''), nullif(split_part(address, '@', 1), ''), 'Member'), 80);
  mode text := coalesce((select value from public.platform_settings where key = 'registration_mode'), 'approval');
  whatsapp_raw text := nullif(btrim(meta ->> 'whatsapp'), '');
  matric_raw text := upper(nullif(btrim(meta ->> 'matric_id'), ''));
  note_raw text := left(nullif(btrim(meta ->> 'note'), ''), 500);
  initial text;
begin
  insert into public.profiles (id, display_name)
  values (new.id, display);

  insert into public.workspaces (name, owner_id)
  values ('Personal', new.id)
  returning id into new_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace, new.id, 'owner');

  if exists (select 1 from public.blocked_emails b where b.email = address) then
    initial := 'banned';
  elsif address = lower((select value from public.platform_settings where key = 'admin_email')) then
    initial := 'approved';
  elsif mode = 'open' then
    initial := 'approved';
  else
    initial := 'pending';
  end if;

  insert into public.registrations (user_id, email, full_name, whatsapp, matric_id, note, status, decided_at)
  values (
    new.id,
    address,
    display,
    case when whatsapp_raw ~ '^\+?[0-9 ()-]{7,20}$' then whatsapp_raw end,
    case when matric_raw ~ '^[A-Z0-9-]{4,20}$' then matric_raw end,
    note_raw,
    initial,
    case when initial = 'approved' then now() end
  );

  if initial = 'approved' and mode = 'open' then
    insert into public.user_entitlements (user_id, feature)
    select new.id, f
    from unnest(string_to_array(
      coalesce((select value from public.platform_settings where key = 'default_features'), ''), ','
    )) as f
    where f = any (public.platform_features())
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- Everyone who already has an account keeps full access.
insert into public.registrations (user_id, email, full_name, status, decided_at)
select u.id, lower(coalesce(u.email, '')), left(coalesce(p.display_name, 'Member'), 80), 'approved', now()
from auth.users u
left join public.profiles p on p.id = u.id
on conflict do nothing;

insert into public.user_entitlements (user_id, feature)
select u.id, f
from auth.users u, unnest(public.platform_features()) as f
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Invitations from an administrator pre-approve the invitee
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation(invite_token text) returns uuid
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

  if public.user_is_platform_admin(invite.created_by) then
    update public.registrations
    set status = 'approved', decided_at = now(), decided_by = invite.created_by,
        decision_note = 'Invited by the administrator'
    where user_id = uid and status = 'pending';

    insert into public.user_entitlements (user_id, feature)
    select uid, f from unnest(invite.features) as f
    where f = any (public.platform_features())
    on conflict do nothing;
  end if;

  update public.invitations set accepted_at = now(), accepted_by = uid where id = invite.id;

  insert into public.audit_log (workspace_id, user_id, action, target, detail)
  values (invite.workspace_id, uid, 'invitation.accepted', invite.id::text, jsonb_build_object('role', invite.role));

  return invite.workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Self-service
-- ---------------------------------------------------------------------------

create function public.my_account()
returns table (status text, is_admin boolean, is_root boolean, full_name text, features text[])
language sql
security definer
set search_path = public
stable
as $$
  select
    case when public.user_is_root(r.user_id) then 'approved' else r.status end,
    public.user_is_platform_admin(r.user_id),
    public.user_is_root(r.user_id),
    r.full_name,
    case
      when public.user_is_platform_admin(r.user_id) then public.platform_features()
      else coalesce(array(select e.feature from public.user_entitlements e where e.user_id = r.user_id order by e.feature), '{}')
    end
  from public.registrations r
  where r.user_id = (select auth.uid()) and public.is_aal2();
$$;

-- ---------------------------------------------------------------------------
-- Administration (every function checks the caller itself)
-- ---------------------------------------------------------------------------

create function public.require_platform_admin() returns void
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
end;
$$;

create function public.log_admin_action(action_name text, target uuid, detail_json jsonb default '{}'::jsonb) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit (admin_id, action, target_user, target_email, detail)
  values (
    (select auth.uid()),
    action_name,
    target,
    (select r.email from public.registrations r where r.user_id = target),
    coalesce(detail_json, '{}'::jsonb)
  );
end;
$$;

create function public.assert_manageable(target uuid) returns void
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if target = (select auth.uid()) then
    raise exception 'you cannot do this to your own account' using errcode = '42501';
  end if;
  if public.user_is_root(target) then
    raise exception 'the primary administrator cannot be changed' using errcode = '42501';
  end if;
  if public.user_is_platform_admin(target) and not public.is_root_admin() then
    raise exception 'only the primary administrator can change another administrator' using errcode = '42501';
  end if;
  if not exists (select 1 from public.registrations r where r.user_id = target) then
    raise exception 'unknown account' using errcode = 'P0002';
  end if;
end;
$$;

create function public.admin_list_users()
returns table (
  user_id uuid, email text, full_name text, whatsapp text, matric_id text, note text,
  status text, requested_at timestamptz, decided_at timestamptz, decision_note text,
  is_admin boolean, features text[]
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.require_platform_admin();
  return query
    select r.user_id, r.email, r.full_name, r.whatsapp, r.matric_id, r.note,
           case when public.user_is_root(r.user_id) then 'approved' else r.status end,
           r.requested_at, r.decided_at, r.decision_note,
           public.user_is_platform_admin(r.user_id),
           coalesce(array(select e.feature from public.user_entitlements e where e.user_id = r.user_id order by e.feature), '{}')
    from public.registrations r
    order by (r.status = 'pending') desc, r.requested_at desc;
end;
$$;

create function public.admin_decide_registration(target uuid, decision text, note text default null, features text[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  current_status text;
  cleaned text[] := coalesce(features, '{}');
begin
  perform public.require_platform_admin();
  perform public.assert_manageable(target);
  if decision not in ('approve', 'reject') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  if not (cleaned <@ public.platform_features()) then
    raise exception 'unknown feature' using errcode = '22023';
  end if;

  select r.status into current_status from public.registrations r where r.user_id = target for update;
  if current_status not in ('pending', 'rejected') then
    raise exception 'this account is not awaiting a decision' using errcode = '55000';
  end if;

  if decision = 'approve' then
    update public.registrations
    set status = 'approved', decided_at = now(), decided_by = (select auth.uid()), decision_note = left(note, 500)
    where user_id = target;
    delete from public.user_entitlements where user_id = target;
    insert into public.user_entitlements (user_id, feature) select target, f from unnest(cleaned) as f;
  else
    update public.registrations
    set status = 'rejected', decided_at = now(), decided_by = (select auth.uid()), decision_note = left(note, 500)
    where user_id = target;
  end if;

  perform public.log_admin_action('registration.' || decision, target, jsonb_build_object('features', cleaned, 'note', left(note, 500)));
end;
$$;

create function public.admin_set_entitlements(target uuid, features text[]) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text[] := coalesce(features, '{}');
begin
  perform public.require_platform_admin();
  perform public.assert_manageable(target);
  if not (cleaned <@ public.platform_features()) then
    raise exception 'unknown feature' using errcode = '22023';
  end if;

  delete from public.user_entitlements where user_id = target and not (feature = any (cleaned));
  insert into public.user_entitlements (user_id, feature) select target, f from unnest(cleaned) as f
  on conflict do nothing;

  perform public.log_admin_action('entitlements.set', target, jsonb_build_object('features', cleaned));
end;
$$;

create function public.admin_set_status(target uuid, new_status text, note text default null) returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  current_status text;
begin
  perform public.require_platform_admin();
  perform public.assert_manageable(target);
  if new_status not in ('approved', 'suspended') then
    raise exception 'unknown status' using errcode = '22023';
  end if;

  select r.status into current_status from public.registrations r where r.user_id = target for update;
  if new_status = 'suspended' and current_status <> 'approved' then
    raise exception 'only approved accounts can be suspended' using errcode = '55000';
  end if;
  if new_status = 'approved' and current_status not in ('suspended', 'removed') then
    raise exception 'only suspended or archived accounts can be reinstated' using errcode = '55000';
  end if;

  update public.registrations
  set status = new_status, decided_at = now(), decided_by = (select auth.uid()), decision_note = left(note, 500)
  where user_id = target;

  perform public.log_admin_action('account.' || case when new_status = 'approved' then 'reinstated' else 'suspended' end,
                                  target, jsonb_build_object('note', left(note, 500)));
end;
$$;

-- Removal always takes an explicit option:
--   suspend  block sign-in access, keep everything, reversible
--   ban      block access and refuse any future sign-up with this email
--   archive  deactivate the account, keep its data, reversible
--   delete   permanently erase the account and all of its data (needs the email typed again)
create function public.admin_remove_user(target uuid, option text, note text default null, confirm_email text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  address text;
begin
  perform public.require_platform_admin();
  perform public.assert_manageable(target);
  if option not in ('suspend', 'ban', 'archive', 'delete') then
    raise exception 'choose a removal option' using errcode = '22023';
  end if;

  select r.email into address from public.registrations r where r.user_id = target for update;

  if option = 'delete' and lower(coalesce(confirm_email, '')) <> address then
    raise exception 'the confirmation email does not match' using errcode = '22023';
  end if;

  perform public.log_admin_action('user.' || option, target, jsonb_build_object('note', left(note, 500)));

  if option = 'delete' then
    delete from auth.users where id = target;
    return;
  end if;

  if option = 'ban' then
    insert into public.blocked_emails (email, reason, blocked_by)
    values (address, left(note, 500), (select auth.uid()))
    on conflict (email) do nothing;
  end if;

  update public.registrations
  set status = case option when 'suspend' then 'suspended' when 'ban' then 'banned' else 'removed' end,
      decided_at = now(), decided_by = (select auth.uid()), decision_note = left(note, 500)
  where user_id = target;
end;
$$;

create function public.admin_set_platform_admin(target uuid, make_admin boolean) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_platform_admin();
  if not public.is_root_admin() then
    raise exception 'only the primary administrator can assign administrators' using errcode = '42501';
  end if;
  if target = (select auth.uid()) or public.user_is_root(target) then
    raise exception 'the primary administrator cannot be changed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.registrations r where r.user_id = target and r.status = 'approved') then
    raise exception 'only approved accounts can become administrators' using errcode = '55000';
  end if;

  if make_admin then
    insert into public.platform_admins (user_id, granted_by) values (target, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.platform_admins where user_id = target;
  end if;

  perform public.log_admin_action(case when make_admin then 'admin.granted' else 'admin.revoked' end, target);
end;
$$;

create function public.admin_audit_list(max_rows integer default 100)
returns table (id bigint, at timestamptz, admin_email text, action text, target_email text, detail jsonb)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.require_platform_admin();
  return query
    select a.id, a.at,
           (select r.email from public.registrations r where r.user_id = a.admin_id),
           a.action, a.target_email, a.detail
    from public.admin_audit a
    order by a.at desc, a.id desc
    limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.platform_features(), public.user_is_root(uuid), public.user_is_platform_admin(uuid),
  public.is_root_admin(), public.is_platform_admin(), public.is_approved(), public.has_entitlement(text),
  public.my_account(), public.require_platform_admin(), public.log_admin_action(text, uuid, jsonb),
  public.assert_manageable(uuid), public.admin_list_users(),
  public.admin_decide_registration(uuid, text, text, text[]), public.admin_set_entitlements(uuid, text[]),
  public.admin_set_status(uuid, text, text), public.admin_remove_user(uuid, text, text, text),
  public.admin_set_platform_admin(uuid, boolean), public.admin_audit_list(integer),
  public.accept_invitation(text), public.is_member(uuid, text), public.can_access(uuid, text, text)
  from public, anon;

grant execute on function
  public.platform_features(), public.is_root_admin(), public.is_platform_admin(), public.is_approved(),
  public.has_entitlement(text), public.my_account(), public.admin_list_users(),
  public.admin_decide_registration(uuid, text, text, text[]), public.admin_set_entitlements(uuid, text[]),
  public.admin_set_status(uuid, text, text), public.admin_remove_user(uuid, text, text, text),
  public.admin_set_platform_admin(uuid, boolean), public.admin_audit_list(integer),
  public.accept_invitation(text), public.is_member(uuid, text), public.can_access(uuid, text, text)
  to authenticated;
