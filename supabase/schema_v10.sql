-- Corré esto en el SQL Editor de Supabase (después de schema_v9.sql).
-- Tabla de alertas de usuario: de precio ("avisame cuando tal ticker
-- llegue a tal valor") o de vencimiento ("avisame N dias antes de que
-- venza tal instrumento"). Una funcion programada de Netlify
-- (check-alerts.mjs) las evalua periodicamente con la service-role key
-- (bypassea RLS) y marca "disparada" la que corresponda; el usuario la ve
-- en alertas.html y en la campanita del header.
--
-- La alerta se dispara una sola vez — no se re-evalua despues de pasar a
-- 'disparada', para no generar notificaciones en loop mientras el precio
-- se queda del lado que la disparo. El usuario la borra o la reactiva a
-- mano.

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria text not null check (categoria in ('precio', 'vencimiento')),
  instrumento_tipo text not null check (instrumento_tipo in ('accion_cedear', 'futuro_dolar', 'letra')),
  ticker text not null,
  direccion text check (direccion in ('sube_a', 'baja_a')),
  precio_objetivo numeric check (precio_objetivo > 0),
  dias_anticipacion integer check (dias_anticipacion > 0),
  estado text not null default 'activa' check (estado in ('activa', 'disparada')),
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (categoria = 'precio' and direccion is not null and precio_objetivo is not null and dias_anticipacion is null)
    or
    (categoria = 'vencimiento' and dias_anticipacion is not null and direccion is null and precio_objetivo is null)
  )
);

create index if not exists alerts_user_id_idx on public.alerts (user_id);
create index if not exists alerts_estado_idx on public.alerts (estado);

alter table public.alerts enable row level security;

create policy "Usuarios ven sus propias alertas"
  on public.alerts for select
  using (auth.uid() = user_id);

create policy "Usuarios crean sus propias alertas"
  on public.alerts for insert
  with check (auth.uid() = user_id);

create policy "Usuarios actualizan sus propias alertas"
  on public.alerts for update
  using (auth.uid() = user_id);

create policy "Usuarios borran sus propias alertas"
  on public.alerts for delete
  using (auth.uid() = user_id);
