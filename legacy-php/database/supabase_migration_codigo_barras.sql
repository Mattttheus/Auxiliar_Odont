-- Migração: adiciona código de barras aos produtos (para uso com scanner/PDV).
-- Execute no Supabase: SQL Editor > New query > Run.
alter table produtos add column if not exists codigo_barras text unique;
