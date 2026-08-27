-- Corré esto en el SQL Editor de Supabase (después de schema_v8.sql).
-- Agrega el flujo de "borrador → confirmar": una operación (o estrategia
-- de varias patas) se puede ir armando de a poco, persistida como
-- borrador, y recién pasa al registro permanente cuando se confirma.
--
-- Los borradores sin confirmar cuya fecha de OPEX ya pasó se borran solos
-- (están abandonados, ya no tiene sentido conservarlos) — las operaciones
-- CONFIRMADAS nunca se borran automáticamente, son el registro histórico.

alter table public.option_trades
  add column if not exists status text not null default 'confirmed' check (status in ('draft', 'confirmed'));

alter table public.option_trades
  add column if not exists opex_date date;

create index if not exists option_trades_status_idx on public.option_trades (status);

-- Faltaba la política de UPDATE (antes solo se insertaba o borraba) —
-- se necesita para pasar un borrador a confirmado.
create policy "Usuarios actualizan sus propias operaciones"
  on public.option_trades for update
  using (auth.uid() = user_id);
