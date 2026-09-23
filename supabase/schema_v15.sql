-- Corré esto en el SQL Editor de Supabase (después de schema_v14.sql).
-- Reemplaza el score plano de technical_indicators por uno de 5 categorías
-- (Tendencia, Fuerza RS, Contracción, Setup, Penalizaciones) — ver el
-- detalle de cada fórmula en netlify/functions/compute-indicators.mjs.
-- Se sacan rsi14/semana52_max/semana52_min/volumen_ratio porque ya no se
-- calculan ni se muestran (quedaron reemplazados por las categorías de
-- arriba) y se agrega sparkline (últimos 20 cierres, para el mini-gráfico
-- de "Evolución").

alter table public.technical_indicators
  drop column if exists rsi14,
  drop column if exists semana52_max,
  drop column if exists semana52_min,
  drop column if exists volumen_ratio,
  add column if not exists tendencia integer,
  add column if not exists fuerza_rs integer,
  add column if not exists contraccion integer,
  add column if not exists setup integer,
  add column if not exists penalizaciones integer,
  add column if not exists sparkline jsonb;
