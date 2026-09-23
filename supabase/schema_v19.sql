-- Corré esto en el SQL Editor de Supabase (después de schema_v18.sql).
-- Cache de indicadores fundamentales (P/E, P/B, ROE, márgenes, crecimiento,
-- deuda, etc. y un score compuesto propio) para el mismo universo curado
-- que technical_indicators (ver schema_v14.sql). No es data por usuario --
-- es un cache público que una función programada de Netlify
-- (compute-fundamentals.mjs) recalcula 1 vez por día con la service-role
-- key (bypassea RLS) y que analisis-fundamental.html lee con la anon key.

create table if not exists public.fundamental_indicators (
  ticker text primary key,
  sector text,
  precio numeric,
  pe_trailing numeric,
  pe_forward numeric,
  price_to_book numeric,
  price_to_sales numeric,
  peg_ratio numeric,
  dividend_yield numeric,
  roe numeric,
  roa numeric,
  profit_margin numeric,
  operating_margin numeric,
  revenue_growth numeric,
  earnings_growth numeric,
  debt_to_equity numeric,
  current_ratio numeric,
  market_cap numeric,
  beta numeric,
  target_mean_price numeric,
  recommendation_key text,
  number_of_analysts integer,
  valuacion integer,
  calidad integer,
  crecimiento integer,
  salud_financiera integer,
  score integer,
  updated_at timestamptz not null default now()
);

alter table public.fundamental_indicators enable row level security;

create policy "Cualquiera puede ver los indicadores fundamentales"
  on public.fundamental_indicators for select
  using (true);
