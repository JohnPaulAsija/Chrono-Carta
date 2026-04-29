-- Security hardening per Supabase database advisor.
--
-- 1. is_admin() lives in `public`, which PostgREST auto-exposes as
--    /rest/v1/rpc/is_admin. The function is only meant to be called
--    from inside RLS policy expressions; nothing external should
--    reach it. PostgREST only exposes `public` (and any schema in
--    db.schemas), so moving it to `private` removes the surface.
--
-- 2. set_updated_at() is missing an explicit search_path, which means
--    a malicious schema on the search_path could shadow now() or
--    similar. Pin search_path = public, pg_temp.

create schema if not exists private;

-- New home for is_admin. Keep the original signature and semantics.
create function private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'admin'
  );
$$;

-- Restrict execute. authenticated still needs it for RLS evaluation.
revoke execute on function private.is_admin() from public;
grant   execute on function private.is_admin() to authenticated;

-- Repoint policies before dropping the old function.
drop policy if exists maps_select_own_or_admin on public.maps;
drop policy if exists maps_insert_own_or_admin on public.maps;
drop policy if exists maps_update_own_or_admin on public.maps;

create policy maps_select_own_or_admin
  on public.maps
  for select
  to authenticated
  using (created_by = auth.uid() or private.is_admin());

create policy maps_insert_own_or_admin
  on public.maps
  for insert
  to authenticated
  with check (created_by = auth.uid() or private.is_admin());

create policy maps_update_own_or_admin
  on public.maps
  for update
  to authenticated
  using (created_by = auth.uid() or private.is_admin())
  with check (created_by = auth.uid() or private.is_admin());

drop function public.is_admin();

-- Pin search_path on the updated_at trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
