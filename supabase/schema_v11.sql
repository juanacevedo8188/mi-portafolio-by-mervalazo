-- Corré esto en el SQL Editor de Supabase (después de schema_v10.sql).
-- Permite que un usuario haga público su portafolio personal para
-- compartirlo con un link (ver portafolio-publico.html). Por defecto todo
-- sigue siendo privado — esto no cambia nada para quien no lo activa.
--
-- A diferencia de una primera versión de esto: NO se agrega ninguna
-- política pública sobre holdings/portfolio_snapshots. RLS solo puede
-- decidir qué filas se ven, no qué columnas — no hay forma de que una
-- política diga "esta fila se puede leer pero sin la cantidad/precio de
-- compra" según el flag show_amounts de cada usuario. La vista pública
-- (netlify/functions/public-portfolio.mjs) resuelve todo del lado del
-- servidor con la service-role key, y esa función es la que decide qué
-- campos mandar según show_amounts — así la cantidad y el precio de
-- compra exactos nunca salen de Netlify cuando show_amounts es false, en
-- vez de solo estar ocultos en la pantalla.

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
-- (para poder generar y copiar el link antes de activarlo). El perfil en
-- sí no tiene nada sensible (nombre a mostrar y dos flags), así que no
-- hace falta pasarlo por la función serverless como a holdings/snapshots.
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
