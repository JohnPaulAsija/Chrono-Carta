-- Loosen users SELECT to self-or-admin.
--
-- The original users_select_own policy (Phase 2) was strict — every
-- authenticated user, including admin, saw only their own row. This
-- assumed all account management would happen in the Supabase
-- dashboard. Real admin UIs need cross-user reads (e.g. rendering a
-- curator's display_name next to a map list), so this policy is
-- relaxed to mirror the maps_*_own_or_admin shape.
--
-- INSERT/UPDATE/DELETE on users remain unpolicied — account
-- management still happens through the Supabase dashboard /
-- service-role client, never through the app.

drop policy if exists users_select_own on public.users;

create policy users_select_self_or_admin
  on public.users
  for select
  to authenticated
  using (id = auth.uid() or private.is_admin());
