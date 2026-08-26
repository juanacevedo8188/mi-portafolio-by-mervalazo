-- Corré esto en el SQL Editor de Supabase (después de schema.sql y schema_v2.sql).
-- Agrega la lista de seguimiento personal (activos que el usuario quiere
-- monitorear sin necesariamente tenerlos en su cartera).

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker text not null,
  tipo text not null check (tipo in ('accion', 'cedear')),
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create index if not exists watchlist_user_id_idx on public.watchlist (user_id);

alter table public.watchlist enable row level security;

create policy "Usuarios ven su propia lista de seguimiento"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "Usuarios agregan a su lista de seguimiento"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "Usuarios borran de su lista de seguimiento"
  on public.watchlist for delete
  using (auth.uid() = user_id);
