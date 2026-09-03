-- Migração: adiciona os novos níveis de acesso (admin, estoquista, vendedor, dentista).
-- Execute no Supabase: SQL Editor > New query > Run.
alter table usuarios drop constraint if exists usuarios_role_check;
alter table usuarios add constraint usuarios_role_check
  check (role in ('admin', 'estoquista', 'vendedor', 'dentista'));
alter table usuarios alter column role set default 'vendedor';
