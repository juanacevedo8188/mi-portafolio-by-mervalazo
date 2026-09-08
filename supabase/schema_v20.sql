-- Corré esto en el SQL Editor de Supabase (después de schema_v19.sql).
-- Guarda el precio del activo en el momento de agregarlo a "Mi lista de
-- seguimiento" (buscar.html), para poder mostrar la variación desde que
-- se agregó, además de la variación diaria que ya se mostraba. Los
-- activos que ya estaban en la lista de alguien antes de esta migración
-- quedan con precio_agregado null -- buscar.html lo maneja mostrando "—"
-- en vez de una variación inventada.

alter table public.watchlist
  add column if not exists precio_agregado numeric;
