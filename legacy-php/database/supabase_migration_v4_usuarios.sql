-- MIGRAÇÃO v4 — cadastro e gestão de usuários.
-- Execute este arquivo INTEIRO de uma vez no Supabase:
-- SQL Editor > New query > cole tudo > Run.
--
-- Pré-requisito: supabase_schema.sql, v2 e v3. Publique o site ANTES de rodar este
-- script: a versão antiga da tela de cadastro é recusada pelas regras novas.
-- Idempotente: pode ser reexecutado sem erro. Roda numa única transação: se algo
-- falhar, nada é alterado.
--
-- O site é público, então qualquer pessoa pode criar uma conta. Esta migração garante
-- no próprio banco (e não só na tela) que:
--   1) Telefone e função solicitada ficam registrados no perfil.
--   2) Cadastro público nasce inativo e só entra depois da aprovação de um admin.
--   3) Conta inativa ou sem perfil não lê nem altera nenhum dado pela API.
--   4) Nome, e-mail e telefone são padronizados, e o e-mail do perfil é sempre o do login.
--   5) Excluir um usuário remove também o login (excluir_usuario), e não só o perfil.
--   6) Cinco níveis de usuário: Administrador (admin), Cirurgião-dentista (dentista),
--      Estoquista (estoquista), Caixa (vendedor, valor interno mantido) e o novo
--      Usuário comum (comum), que só consulta.

begin;

do $$
begin
  if to_regclass('public.lotes') is null then
    raise exception 'Execute antes a migração v3 (supabase_migration_v3_relatorio_final.sql).';
  end if;
end $$;

-- ============================================================
-- 1) NÍVEIS E PERFIL: Usuário comum, telefone e nível solicitado no cadastro
-- ============================================================
-- As permissões continuam em listas explícitas de níveis nas políticas e funções:
-- 'comum' fica fora de todas elas e, portanto, não escreve em nenhuma tabela.
alter table usuarios drop constraint if exists usuarios_role_check;
alter table usuarios add constraint usuarios_role_check
  check (role in ('admin', 'dentista', 'estoquista', 'vendedor', 'comum'));
alter table usuarios alter column role set default 'comum';

-- perfil_solicitado preenchido + ativo = false significa "aguardando aprovação".
alter table usuarios add column if not exists telefone text;
alter table usuarios add column if not exists perfil_solicitado text;
alter table usuarios drop constraint if exists usuarios_perfil_solicitado_check;
alter table usuarios add constraint usuarios_perfil_solicitado_check
  check (perfil_solicitado is null or perfil_solicitado in ('dentista', 'estoquista', 'vendedor', 'comum'));

-- ============================================================
-- 2) SÓ USUÁRIO ATIVO TEM PODER
-- ============================================================
-- SECURITY DEFINER: consultam a tabela sem passar pela RLS dela. Por isso também é
-- seguro usá-las dentro das políticas da própria tabela usuarios.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from usuarios where id = auth.uid() and role = 'admin' and ativo);
$$;

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from usuarios where id = auth.uid() and ativo;
$$;

create or replace function public.usuario_ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from usuarios where id = auth.uid() and ativo);
$$;

-- O primeiro usuário do sistema vira administrador. Precisa ignorar a RLS: quem ainda
-- não tem perfil não enxerga a tabela e sempre veria "nenhum usuário".
create or replace function public.sistema_sem_usuarios()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists(select 1 from usuarios);
$$;

revoke all on function public.usuario_ativo() from public, anon;
revoke all on function public.sistema_sem_usuarios() from public, anon;
grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.sistema_sem_usuarios() to authenticated;

-- ============================================================
-- 3) PADRONIZAÇÃO DAS INFORMAÇÕES
-- ============================================================
drop trigger if exists trg_normalizar_usuario on usuarios;

-- O login é a fonte do e-mail: corrige perfis que tenham sido editados à parte.
update usuarios u set email = lower(a.email)
from auth.users a
where a.id = u.id and a.email is not null and u.email is distinct from lower(a.email);

update usuarios set nome = btrim(regexp_replace(nome, '\s+', ' ', 'g'))
where nome is distinct from btrim(regexp_replace(nome, '\s+', ' ', 'g'));

create or replace function public.normalizar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  new.nome := btrim(regexp_replace(coalesce(new.nome, ''), '\s+', ' ', 'g'));
  if length(new.nome) < 2 then
    raise exception 'Informe o nome do usuário.';
  end if;

  if TG_OP = 'INSERT' then
    select lower(email) into v_email from auth.users where id = new.id;
    new.email := coalesce(v_email, lower(btrim(new.email)));
  else
    new.email := old.email;
  end if;

  new.telefone := nullif(regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g'), '');
  if new.telefone is not null and length(new.telefone) not in (10, 11) then
    raise exception 'Telefone inválido: informe DDD e número.';
  end if;

  -- Conta ativa não tem mais solicitação pendente.
  if new.ativo then
    new.perfil_solicitado := null;
  end if;
  return new;
end;
$$;

create trigger trg_normalizar_usuario
  before insert or update on usuarios
  for each row execute function public.normalizar_usuario();

-- ============================================================
-- 4) RLS: CADASTRO PÚBLICO E LEITURA DOS DADOS
-- ============================================================
drop policy if exists "usuarios_insert_self" on usuarios;
create policy "usuarios_insert_self" on usuarios for insert to authenticated
  with check (
    auth.uid() = id
    and (
      (role = 'admin' and ativo and public.sistema_sem_usuarios())
      or (role = 'comum' and not ativo)
    )
  );

drop policy if exists "usuarios_select" on usuarios;
create policy "usuarios_select" on usuarios for select to authenticated
  using (id = auth.uid() or public.usuario_ativo());

drop policy if exists "usuarios_update" on usuarios;
create policy "usuarios_update" on usuarios for update to authenticated
  using ((auth.uid() = id and public.usuario_ativo()) or public.is_admin())
  with check ((auth.uid() = id and public.usuario_ativo()) or public.is_admin());

drop policy if exists "produtos_select" on produtos;
create policy "produtos_select" on produtos for select to authenticated
  using (public.usuario_ativo());

drop policy if exists "entradas_select" on entradas_produtos;
create policy "entradas_select" on entradas_produtos for select to authenticated
  using (public.usuario_ativo());

drop policy if exists "saidas_select" on saidas_produtos;
create policy "saidas_select" on saidas_produtos for select to authenticated
  using (public.usuario_ativo());

drop policy if exists "historico_select" on historico;
create policy "historico_select" on historico for select to authenticated
  using (public.get_my_role() in ('admin', 'dentista', 'estoquista', 'vendedor'));

drop policy if exists "historico_insert" on historico;
create policy "historico_insert" on historico for insert to authenticated
  with check (public.usuario_ativo());

drop policy if exists "lotes_select" on lotes;
create policy "lotes_select" on lotes for select to authenticated
  using (public.usuario_ativo());

drop policy if exists "configuracoes_select" on configuracoes;
create policy "configuracoes_select" on configuracoes for select to authenticated
  using (public.usuario_ativo());

-- ============================================================
-- 5) EXCLUSÃO COMPLETA DE USUÁRIO
-- ============================================================
-- Apaga o login; o perfil sai junto (usuarios.id referencia auth.users com cascade).
-- A trava do último administrador (v2) continua valendo, pois dispara nesse cascade.
create or replace function public.excluir_usuario(p_usuario_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir usuários.';
  end if;
  if p_usuario_id = auth.uid() then
    raise exception 'Você não pode excluir a própria conta.';
  end if;
  delete from auth.users where id = p_usuario_id;
end;
$$;

revoke all on function public.excluir_usuario(uuid) from public, anon;
grant execute on function public.excluir_usuario(uuid) to authenticated;

-- Recarrega o cache de schema da API para expor as funções/colunas novas.
notify pgrst, 'reload schema';

commit;
