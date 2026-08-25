-- Corré esto en el SQL Editor de Supabase (después de schema.sql).
-- Agrega sector a las posiciones personales y las tablas de historial
-- para poder graficar la evolución de la cartera modelo y de cada usuario.

alter table public.holdings
  add column if not exists sector text;

-- Historial de la Cartera Mervalazo (cartera modelo, pública, un valor por día).
create table if not exists public.community_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  total_value numeric not null,
  total_cost numeric not null,
  created_at timestamptz not null default now()
);

alter table public.community_snapshots enable row level security;

create policy "Cualquiera puede leer el historial de la cartera modelo"
  on public.community_snapshots for select
  using (true);

-- Historial de cada portafolio personal (un valor por usuario por día).
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_value numeric not null,
  total_cost numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists portfolio_snapshots_user_id_idx on public.portfolio_snapshots (user_id);

alter table public.portfolio_snapshots enable row level security;

create policy "Usuarios ven su propio historial"
  on public.portfolio_snapshots for select
  using (auth.uid() = user_id);

-- No hay políticas de insert/update para estas dos tablas: las escribe
-- únicamente la función programada de Netlify usando la service_role key,
-- que ignora RLS. Nadie puede insertar o alterar el historial desde el navegador.
