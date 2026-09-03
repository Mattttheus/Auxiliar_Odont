-- Migração: reforça o controle de acesso no banco (Row Level Security por nível de acesso),
-- evitando que um usuário autenticado com perfil limitado (ex: vendedor, dentista) consiga
-- criar/editar/excluir produtos ou registrar entradas diretamente pela API, contornando a UI.
-- Execute no Supabase: SQL Editor > New query > Run.

create or replace function public.get_my_role()
returns text language sql security definer set search_path = public as $$
  select role from usuarios where id = auth.uid();
$$;

-- PRODUTOS: leitura liberada a todos autenticados; escrita só admin/estoquista.
drop policy if exists "produtos_all" on produtos;
create policy "produtos_select" on produtos for select to authenticated using (true);
create policy "produtos_insert" on produtos for insert to authenticated
  with check (public.get_my_role() in ('admin', 'estoquista'));
create policy "produtos_update" on produtos for update to authenticated
  using (public.get_my_role() in ('admin', 'estoquista'));
create policy "produtos_delete" on produtos for delete to authenticated
  using (public.get_my_role() in ('admin', 'estoquista'));

-- ENTRADAS: só quem pode dar entrada em estoque (admin/estoquista).
drop policy if exists "entradas_all" on entradas_produtos;
create policy "entradas_select" on entradas_produtos for select to authenticated using (true);
create policy "entradas_insert" on entradas_produtos for insert to authenticated
  with check (public.get_my_role() in ('admin', 'estoquista'));

-- SAÍDAS: admin/estoquista/vendedor podem registrar saída (inclusive via Caixa/PDV).
drop policy if exists "saidas_all" on saidas_produtos;
create policy "saidas_select" on saidas_produtos for select to authenticated using (true);
create policy "saidas_insert" on saidas_produtos for insert to authenticated
  with check (public.get_my_role() in ('admin', 'estoquista', 'vendedor'));

-- HISTÓRICO: leitura para todos autenticados; inserção sempre feita pelo próprio sistema.
drop policy if exists "historico_all" on historico;
create policy "historico_select" on historico for select to authenticated using (true);
create policy "historico_insert" on historico for insert to authenticated with check (true);
