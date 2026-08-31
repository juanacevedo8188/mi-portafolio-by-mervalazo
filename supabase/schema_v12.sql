-- Corré esto en el SQL Editor de Supabase (después de schema_v11.sql).
-- Separa "disparada" (necesita accion: descartar o reactivar) de "vista"
-- (el usuario ya la vio en alertas.html). Sin esto, la campanita del
-- header solo bajaba cuando se descartaba/reactivaba la alerta a mano —
-- entrar a alertas.html y mirarla no la sacaba del contador.

alter table public.alerts
  add column if not exists seen_at timestamptz;
