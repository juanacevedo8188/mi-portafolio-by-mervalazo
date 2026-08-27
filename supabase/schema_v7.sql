-- Corré esto en el SQL Editor de Supabase (después de schema_v6.sql).
-- Tabla para guardar operaciones de la Calculadora de Opciones. Es
-- opcional: la calculadora funciona igual para simular sin necesidad de
-- guardar nada — esto es solo para el que quiera dejar registradas varias
-- operaciones dentro de un mismo vencimiento (OPEX).

create table if not exists public.option_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subyacente text not null check (subyacente in ('GGAL', 'COME')),
  tipo text not null check (tipo in ('call', 'put')),
  posicion text not null check (posicion in ('long', 'short')),
  strike numeric not null check (strike > 0),
  prima numeric not null check (prima >= 0),
  cantidad numeric not null check (cantidad > 0),
  opex text,
  created_at timestamptz not null default now()
);

create index if not exists option_trades_user_id_idx on public.option_trades (user_id);

alter table public.option_trades enable row level security;

create policy "Usuarios ven sus propias operaciones"
  on public.option_trades for select
  using (auth.uid() = user_id);

create policy "Usuarios crean sus propias operaciones"
  on public.option_trades for insert
  with check (auth.uid() = user_id);

create policy "Usuarios borran sus propias operaciones"
  on public.option_trades for delete
  using (auth.uid() = user_id);
