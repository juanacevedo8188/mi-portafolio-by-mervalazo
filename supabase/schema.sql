-- Corré esto una vez en el SQL Editor de tu proyecto de Supabase.
-- Crea la tabla de posiciones de cada usuario y las reglas de seguridad
-- para que cada uno solo pueda ver y editar las suyas.

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker text not null,
  tipo text not null check (tipo in ('accion', 'cedear')),
  cantidad numeric not null check (cantidad > 0),
  precio_compra numeric not null check (precio_compra > 0),
  created_at timestamptz not null default now()
);

create index if not exists holdings_user_id_idx on public.holdings (user_id);

alter table public.holdings enable row level security;

create policy "Usuarios ven sus propias posiciones"
  on public.holdings for select
  using (auth.uid() = user_id);

create policy "Usuarios crean sus propias posiciones"
  on public.holdings for insert
  with check (auth.uid() = user_id);

create policy "Usuarios editan sus propias posiciones"
  on public.holdings for update
  using (auth.uid() = user_id);

create policy "Usuarios borran sus propias posiciones"
  on public.holdings for delete
  using (auth.uid() = user_id);
