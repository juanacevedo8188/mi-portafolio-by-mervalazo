-- Corré esto en el SQL Editor de Supabase (después de schema_v15.sql).
-- Agrega los campos que necesita la Ficha del ticker: estadio (1-4, según
-- posición/pendiente de la EMA200 -- estilo "Stan Weinstein"), retorno de
-- 6 meses crudo (además del percentil que ya usa Fuerza RS) y volumen
-- relativo al promedio de 20 ruedas.

alter table public.technical_indicators
  add column if not exists estadio smallint,
  add column if not exists retorno_6m numeric,
  add column if not exists vol_ratio numeric;
