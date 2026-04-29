-- ChronoCarta v1 schema: roles, users, maps.
-- Mirrors architecture §Data Model.

create table public.roles (
  id   integer generated always as identity primary key,
  name text    not null unique
);

create table public.users (
  id           uuid        primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  url          text,
  role_id      integer     not null references public.roles (id),
  created_at   timestamptz not null default now()
);

create table public.maps (
  id                uuid             primary key default gen_random_uuid(),
  title             text             not null,
  geojson_data      jsonb            not null,
  correct_year      integer          not null,
  precision         text             not null check (precision in ('century', 'decade', 'year')),
  wrong_answers     jsonb            not null,
  formatted_correct text             not null,
  formatted_wrong   jsonb            not null,
  center_lat        double precision not null,
  center_lng        double precision not null,
  zoom_level        double precision not null,
  reveal_text       text             not null,
  difficulty        text             not null check (difficulty in ('easy', 'medium', 'hard')),
  tags              jsonb            not null default '[]'::jsonb,
  created_at        timestamptz      not null default now(),
  updated_at        timestamptz      not null default now(),
  created_by        uuid             not null references public.users (id),
  active            boolean          not null default true
);

-- Auto-bump updated_at on every row update. Defined generically so
-- future tables can reuse it without a second function.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger maps_set_updated_at
  before update on public.maps
  for each row
  execute function public.set_updated_at();
