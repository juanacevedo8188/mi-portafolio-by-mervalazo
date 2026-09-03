-- Corré esto en el SQL Editor de Supabase (después de schema_v13.sql).
-- Cache de indicadores técnicos (SMA50, EMA200, RSI14, 52 semanas, volumen
-- y un score compuesto propio) para un universo curado de tickers líquidos
-- (grandes CEDEARs de EEUU + ADRs argentinos). No es data por usuario --
-- es un cache público que una función programada de Netlify
-- (compute-indicators.mjs) recalcula 1 vez por día con la service-role key
-- (bypassea RLS) y que analisis-tecnico.html lee con la anon key.

create table if not exists public.technical_indicators (
  ticker text primary key,
  nombre text,
  sector text,
  precio numeric,
  pct_change numeric,
  sma50 numeric,
  ema200 numeric,
  rsi14 numeric,
  semana52_max numeric,
  semana52_min numeric,
  volumen_ratio numeric,
  score integer,
  updated_at timestamptz not null default now()
);

alter table public.technical_indicators enable row level security;

create policy "Cualquiera puede ver los indicadores técnicos"
  on public.technical_indicators for select
  using (true);
