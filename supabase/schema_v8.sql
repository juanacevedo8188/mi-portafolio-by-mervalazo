-- Corré esto en el SQL Editor de Supabase (después de schema_v7.sql).
-- Agrega un id de grupo opcional a option_trades para poder guardar
-- varias patas de una misma estrategia (spread, lanzamiento cubierto,
-- etc.) y despues mostrarlas juntas en "Mis operaciones guardadas".

alter table public.option_trades
  add column if not exists grupo_id text;

create index if not exists option_trades_grupo_id_idx on public.option_trades (grupo_id);
