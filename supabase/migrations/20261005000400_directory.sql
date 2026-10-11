-- NHR
-- Author: Nahid Hasan Rayan

create function public.workspace_people(ws uuid)
returns table (user_id uuid, display_name text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select m.user_id, coalesce(p.display_name, 'Member'), m.role
  from public.workspace_members m
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = ws
    and public.is_member(ws)
  order by m.role, 2;
$$;

revoke execute on function public.workspace_people(uuid) from public, anon;
grant execute on function public.workspace_people(uuid) to authenticated;
