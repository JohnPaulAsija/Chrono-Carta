-- Roles seed. Idempotent so re-running seed.sql against an existing
-- database does not break the unique constraint or shift IDs.
-- RLS policies look up roles by name, so the auto-assigned IDs are
-- intentionally not pinned here.

insert into public.roles (name) values
  ('admin'),
  ('curator'),
  ('player')
on conflict (name) do nothing;
