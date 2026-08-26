-- Corré esto en el SQL Editor de Supabase (después de schema_v3.sql).
-- Agrega categorías opcionales a la lista de seguimiento (ej: "MERVAL",
-- "Salud", "China"), para poder agrupar los activos como en TradingView.

alter table public.watchlist
  add column if not exists grupo text;

create policy "Usuarios editan su propia lista de seguimiento"
  on public.watchlist for update
  using (auth.uid() = user_id);
