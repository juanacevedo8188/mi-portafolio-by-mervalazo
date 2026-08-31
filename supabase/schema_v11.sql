-- Corré esto en el SQL Editor de Supabase (después de schema_v10.sql).
-- Permite que un usuario haga público su portafolio personal para
-- compartirlo con un link (ver portafolio-publico.html). Por defecto todo
-- sigue siendo privado — esto no cambia nada para quien no lo activa.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_slug text unique not null default replace(gen_random_uuid()::text, '-', ''),
  display_name text,
  is_public boolean not null default false,
  show_amounts boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cualquiera puede resolver un slug público (para portafolio-publico.html);
-- el dueño además puede ver su propia fila aunque todavía no sea pública
-- (para poder generar y copiar el link antes de activarlo).
create policy "Perfiles públicos o el propio son visibles"
  on public.profiles for select
  using (is_public = true or auth.uid() = id);

create policy "Usuarios crean su propio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Usuarios editan su propio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Extiende (no reemplaza) las políticas de select ya existentes: además de
-- "el dueño ve las suyas", ahora "cualquiera ve las de un perfil público".
create policy "Cualquiera ve las posiciones de un portafolio público"
  on public.holdings for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = holdings.user_id and p.is_public = true
    )
  );

create policy "Cualquiera ve el historial de un portafolio público"
  on public.portfolio_snapshots for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = portfolio_snapshots.user_id and p.is_public = true
    )
  );
