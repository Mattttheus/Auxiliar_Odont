-- MIGRAÇÃO COMPLETA PENDENTE — execute este arquivo INTEIRO de uma vez no
-- Supabase: SQL Editor > New query > cole tudo > Run.
-- (Substitui a necessidade de rodar os 3 arquivos separados anteriores.)

-- 1) NÍVEIS DE ACESSO: permite os perfis admin/estoquista/vendedor/dentista.
alter table usuarios drop constraint if exists usuarios_role_check;
alter table usuarios add constraint usuarios_role_check
  check (role in ('admin', 'estoquista', 'vendedor', 'dentista'));
alter table usuarios alter column role set default 'vendedor';

-- 2) CÓDIGO DE BARRAS: usado pelo scanner e pelo Caixa/PDV.
alter table produtos add column if not exists codigo_barras text unique;

-- 3) SEGURANÇA (RLS) POR NÍVEL DE ACESSO: impede que perfis limitados
--    escrevam em produtos/entradas diretamente pela API.
create or replace function public.get_my_role()
returns text language sql security definer set search_path = public as $$
  select role from usuarios where id = auth.uid();
$$;

drop policy if exists "produtos_all" on produtos;
drop policy if exists "produtos_select" on produtos;
drop policy if exists "produtos_insert" on produtos;
drop policy if exists "produtos_update" on produtos;
drop policy if exists "produtos_delete" on produtos;
create policy "produtos_select" on produtos for select to authenticated using (true);
create policy "produtos_insert" on produtos for insert to authenticated
  with check (public.get_my_role() in ('admin', 'estoquista'));
create policy "produtos_update" on produtos for update to authenticated
  using (public.get_my_role() in ('admin', 'estoquista'));
create policy "produtos_delete" on produtos for delete to authenticated
  using (public.get_my_role() in ('admin', 'estoquista'));

drop policy if exists "entradas_all" on entradas_produtos;
drop policy if exists "entradas_select" on entradas_produtos;
drop policy if exists "entradas_insert" on entradas_produtos;
create policy "entradas_select" on entradas_produtos for select to authenticated using (true);
create policy "entradas_insert" on entradas_produtos for insert to authenticated
  with check (public.get_my_role() in ('admin', 'estoquista'));

drop policy if exists "saidas_all" on saidas_produtos;
drop policy if exists "saidas_select" on saidas_produtos;
drop policy if exists "saidas_insert" on saidas_produtos;
create policy "saidas_select" on saidas_produtos for select to authenticated using (true);
create policy "saidas_insert" on saidas_produtos for insert to authenticated
  with check (public.get_my_role() in ('admin', 'estoquista', 'vendedor'));

drop policy if exists "historico_all" on historico;
drop policy if exists "historico_select" on historico;
drop policy if exists "historico_insert" on historico;
create policy "historico_select" on historico for select to authenticated using (true);
create policy "historico_insert" on historico for insert to authenticated with check (true);
