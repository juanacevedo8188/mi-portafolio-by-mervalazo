-- Corré esto en el SQL Editor de Supabase (después de schema_v16.sql).
-- Tabla de una sola fila con el "Régimen de Mercado": un score aparte
-- 0-100 que resume el estado general del mercado (no de un ticker en
-- particular), para darle contexto a los scores individuales de
-- technical_indicators. Se recalcula junto con ellos, misma función
-- programada (compute-indicators.mjs).

create table if not exists public.market_regime (
  id smallint primary key default 1,
  score integer,
  indices_score integer,
  amplitud_score integer,
  sentimiento_score integer,
  spy_price numeric,
  spy_pct_change numeric,
  qqq_price numeric,
  qqq_pct_change numeric,
  vix numeric,
  pct_bullish numeric,
  updated_at timestamptz not null default now(),
  constraint market_regime_single_row check (id = 1)
);

alter table public.market_regime enable row level security;

create policy "Cualquiera puede ver el régimen de mercado"
  on public.market_regime for select
  using (true);
