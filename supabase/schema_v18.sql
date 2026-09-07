-- Corré esto en el SQL Editor de Supabase (después de schema_v17.sql).
-- Efectivo sin invertir (liquidez), en Mi Portafolio -- suma al patrimonio
-- total pero no participa del costo/resultado (el efectivo no tiene una
-- "compra" de la que medir ganancia).

alter table public.profiles
  add column if not exists cash_ars numeric not null default 0,
  add column if not exists cash_usd numeric not null default 0;
