-- Corré esto en el SQL Editor de Supabase (después de schema_v4.sql).
-- Permite cargar "cripto" como tipo de activo en holdings y watchlist,
-- ademas de accion/cedear. Busca el nombre real de la restriccion en vez
-- de asumirlo, por si Supabase le puso otro nombre al crearla.

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.holdings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%tipo%';
  if con_name is not null then
    execute format('alter table public.holdings drop constraint %I', con_name);
  end if;
end $$;

alter table public.holdings
  add constraint holdings_tipo_check check (tipo in ('accion', 'cedear', 'cripto'));

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.watchlist'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%tipo%';
  if con_name is not null then
    execute format('alter table public.watchlist drop constraint %I', con_name);
  end if;
end $$;

alter table public.watchlist
  add constraint watchlist_tipo_check check (tipo in ('accion', 'cedear', 'cripto'));
