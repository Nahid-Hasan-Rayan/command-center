-- NHR
-- Author: Nahid Hasan Rayan

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('channel', 'direct')),
  name text check (name is null or char_length(name) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check ((kind = 'channel' and name is not null) or (kind = 'direct' and name is null))
);

create table public.channel_members (
  channel_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (channel_id, user_id),
  foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  channel_id uuid not null,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade
);

create index channel_members_user_idx on public.channel_members (user_id);
create index messages_channel_time_idx on public.messages (channel_id, created_at desc);
create index messages_sender_time_idx on public.messages (sender_id, created_at desc);

create function public.is_channel_member(ch uuid) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_aal2() and exists (
    select 1
    from public.channel_members cm
    join public.channels c on c.id = cm.channel_id
    where cm.channel_id = ch
      and cm.user_id = (select auth.uid())
      and public.can_access(c.workspace_id, 'messages')
  );
$$;

create function public.messages_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (
      select count(*) from public.messages m
      where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute'
    ) >= 30 then
      raise exception 'message rate limit exceeded' using errcode = '54000';
    end if;
    return new;
  end if;

  if new.id <> old.id
    or new.workspace_id <> old.workspace_id
    or new.channel_id <> old.channel_id
    or new.sender_id <> old.sender_id
    or new.created_at <> old.created_at then
    raise exception 'immutable message fields' using errcode = '42501';
  end if;

  if old.deleted_at is not null then
    raise exception 'message already deleted' using errcode = '42501';
  end if;

  if new.deleted_at is not null then
    new.body := '[deleted]';
    new.edited_at := old.edited_at;
  elsif new.body <> old.body then
    if (select auth.uid()) is distinct from old.sender_id then
      raise exception 'only the sender can edit a message' using errcode = '42501';
    end if;
    new.edited_at := now();
  end if;

  return new;
end;
$$;

create trigger messages_guard_insert before insert on public.messages
  for each row execute function public.messages_guard();
create trigger messages_guard_update before update on public.messages
  for each row execute function public.messages_guard();

create function public.channels_add_creator() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'channel' then
    insert into public.channel_members (channel_id, workspace_id, user_id)
    values (new.id, new.workspace_id, new.created_by);
  end if;
  return new;
end;
$$;

create trigger channels_add_creator_after_insert after insert on public.channels
  for each row execute function public.channels_add_creator();

create function public.open_direct_channel(ws uuid, other uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  existing uuid;
  created uuid;
begin
  if not public.can_access(ws, 'messages') then
    raise exception 'messaging not available' using errcode = '42501';
  end if;
  if other is null or other = uid then
    raise exception 'invalid recipient' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = other
      and (m.role = 'owner' or exists (
        select 1 from public.member_features f
        where f.workspace_id = ws and f.user_id = other and f.feature = 'messages'))
  ) then
    raise exception 'recipient cannot receive messages' using errcode = '42501';
  end if;

  select c.id into existing
  from public.channels c
  where c.workspace_id = ws and c.kind = 'direct'
    and exists (select 1 from public.channel_members a where a.channel_id = c.id and a.user_id = uid)
    and exists (select 1 from public.channel_members b where b.channel_id = c.id and b.user_id = other)
    and (select count(*) from public.channel_members x where x.channel_id = c.id) = 2
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.channels (workspace_id, kind, created_by) values (ws, 'direct', uid)
  returning id into created;
  insert into public.channel_members (channel_id, workspace_id, user_id)
  values (created, ws, uid), (created, ws, other);
  return created;
end;
$$;

alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages enable row level security;

create policy channels_select on public.channels for select using (public.is_channel_member(id));
create policy channels_insert on public.channels for insert
  with check (
    kind = 'channel'
    and public.can_access(workspace_id, 'messages', 'owner')
    and created_by = (select auth.uid())
  );
create policy channels_update on public.channels for update
  using (kind = 'channel' and public.can_access(workspace_id, 'messages', 'owner'))
  with check (kind = 'channel' and public.can_access(workspace_id, 'messages', 'owner'));
create policy channels_delete on public.channels for delete
  using (kind = 'channel' and public.can_access(workspace_id, 'messages', 'owner'));

create policy channel_members_select on public.channel_members for select
  using (public.is_channel_member(channel_id));
create policy channel_members_insert on public.channel_members for insert
  with check (
    public.can_access(workspace_id, 'messages', 'owner')
    and exists (select 1 from public.channels c where c.id = channel_id and c.kind = 'channel')
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = channel_members.workspace_id
        and m.user_id = channel_members.user_id
        and (m.role = 'owner' or exists (
          select 1 from public.member_features f
          where f.workspace_id = m.workspace_id and f.user_id = m.user_id and f.feature = 'messages'))
    )
  );
create policy channel_members_update on public.channel_members for update
  using (user_id = (select auth.uid()) and public.is_channel_member(channel_id))
  with check (user_id = (select auth.uid()));
create policy channel_members_delete on public.channel_members for delete
  using (
    public.is_channel_member(channel_id)
    and (
      user_id = (select auth.uid())
      or (
        public.can_access(workspace_id, 'messages', 'owner')
        and exists (select 1 from public.channels c where c.id = channel_id and c.kind = 'channel')
      )
    )
  );

create policy messages_select on public.messages for select using (public.is_channel_member(channel_id));
create policy messages_insert on public.messages for insert
  with check (public.is_channel_member(channel_id) and sender_id = (select auth.uid()));
create policy messages_update on public.messages for update
  using (
    public.is_channel_member(channel_id)
    and (sender_id = (select auth.uid()) or public.can_access(workspace_id, 'messages', 'owner'))
  )
  with check (public.is_channel_member(channel_id));

revoke all on public.channels, public.channel_members, public.messages from anon;
revoke execute on function public.is_channel_member(uuid) from public, anon;
revoke execute on function public.open_direct_channel(uuid, uuid) from public, anon;
revoke execute on function public.messages_guard() from public, anon;
revoke execute on function public.channels_add_creator() from public, anon;
grant execute on function public.is_channel_member(uuid) to authenticated;
grant execute on function public.open_direct_channel(uuid, uuid) to authenticated;

grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, delete on public.channel_members to authenticated;
grant update (last_read_at) on public.channel_members to authenticated;
grant select, insert on public.messages to authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
