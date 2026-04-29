-- ChronoCarta v1 RLS policies.
-- Mirrors architecture §Row-Level Security.
--
-- Boundary recap (architecture §Application Architecture):
--   getGameClient()    — service role, bypasses RLS, used by gameplay only.
--   getCuratorClient() — user JWT, RLS-enforced, used by admin panel.
-- These policies govern the curator-client path. The service-role
-- client never hits them.

-- Admin lookup helper. SECURITY DEFINER lets it read users/roles
-- without re-triggering the users RLS policy. search_path is pinned to
-- prevent privilege-escalation via search-path injection per the
-- Postgres SECURITY DEFINER hardening guidance.
create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'admin'
  );
$$;

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.maps  enable row level security;

-- roles: no policies. Anon and authenticated callers get nothing;
-- only the service role (which bypasses RLS) can read it.

-- users: a signed-in user may read their own row. No INSERT or UPDATE
-- policies — account management happens through the Supabase
-- dashboard / service role only.
create policy users_select_own
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- maps: curators own their rows; admins own everything. No DELETE
-- policy — deactivation happens via active = false instead.
create policy maps_select_own_or_admin
  on public.maps
  for select
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

create policy maps_insert_own_or_admin
  on public.maps
  for insert
  to authenticated
  with check (created_by = auth.uid() or public.is_admin());

create policy maps_update_own_or_admin
  on public.maps
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
