-- Corré esto en el SQL Editor de Supabase (después de schema_v12.sql).
-- Guarda si el usuario ya vio la mini guía de bienvenida (aparece una
-- sola vez, la primera vez que se loguea) — al vivir en profiles en vez
-- de localStorage, no le vuelve a aparecer aunque entre desde otro
-- dispositivo o navegador.

alter table public.profiles
  add column if not exists has_seen_welcome boolean not null default false;
