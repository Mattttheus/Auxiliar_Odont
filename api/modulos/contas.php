<?php
// Login, cadastro e gestão de usuários.
declare(strict_types=1);

// Mantém o mesmo tempo de resposta quando o e-mail não existe: não revela quem tem conta.
const HASH_FICTICIO = '$2y$10$CNe.fxYuzLm/jMN/56KJq.o56ZIXPl0rv4ijXMLXBTRfp0SMpZdmG';

function usuario_publico(array $u): array
{
    return [
        'uid' => (string) $u['id'],
        'nome' => $u['nome'],
        'email' => $u['email'],
        'role' => $u['role'],
        'ativo' => (bool) $u['ativo'],
        'perfilSolicitado' => $u['perfil_solicitado'],
    ];
}

function motivo_bloqueio(array $u): string
{
    return $u['perfil_solicitado']
        ? 'Seu cadastro foi recebido e está aguardando a aprovação de um administrador.'
        : 'Usuário desativado. Contate um administrador.';
}

// ---------- VALIDAÇÃO (mesmas regras de assets/js/validacao.js) ----------
function nome_limpo(string $nome, bool $exigirSobrenome = true): string
{
    $nome = preg_replace('/\s+/u', ' ', trim($nome));
    if ($nome === '') {
        falhar('Informe o nome completo.');
    }
    if (mb_strlen($nome) > 100 || !preg_match("/^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u", $nome)) {
        falhar('O nome deve ter apenas letras, com até 100 caracteres.');
    }
    if ($exigirSobrenome && count(explode(' ', $nome)) < 2) {
        falhar('Informe nome e sobrenome.');
    }
    return $nome;
}

function email_limpo(string $email): string
{
    $email = mb_strtolower(trim($email));
    if (mb_strlen($email) > 100 || !preg_match('/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/', $email)) {
        falhar('Informe um e-mail válido, como nome@exemplo.com.');
    }
    return $email;
}

function telefone_limpo(?string $telefone, bool $obrigatorio = false): ?string
{
    $digitos = preg_replace('/\D/', '', (string) $telefone);
    if ((strlen($digitos) === 12 || strlen($digitos) === 13) && strpos($digitos, '55') === 0) {
        $digitos = substr($digitos, 2);
    }
    if ($digitos === '') {
        if ($obrigatorio) {
            falhar('Informe o telefone com DDD.');
        }
        return null;
    }
    if (!preg_match('/^[1-9][1-9](\d{8}|9\d{8})$/', $digitos)) {
        falhar('Informe um telefone válido com DDD, como (11) 91234-5678.');
    }
    return $digitos;
}

function senha_valida(string $senha): string
{
    if (mb_strlen($senha) < 8) {
        falhar('A senha deve ter pelo menos 8 caracteres.');
    }
    if (!preg_match('/\p{L}/u', $senha) || !preg_match('/\d/', $senha)) {
        falhar('A senha deve ter letras e números.');
    }
    return $senha;
}

// ---------- SESSÃO ----------
function acao_sessao(array $dados): array
{
    $usuario = usuario_atual();
    if ($usuario) {
        return ['usuario' => usuario_publico($usuario), 'aviso' => null];
    }
    $aviso = null;
    if (isset($_SESSION['usuario_id'])) {
        $conta = linha('SELECT * FROM usuarios WHERE id = ?', [(int) $_SESSION['usuario_id']]);
        $aviso = $conta ? motivo_bloqueio($conta) : 'Sua conta foi removida. Contate um administrador.';
        unset($_SESSION['usuario_id']);
    }
    return ['usuario' => null, 'aviso' => $aviso];
}

function acao_entrar(array $dados): array
{
    $senha = (string) ($dados['senha'] ?? '');
    $conta = linha('SELECT * FROM usuarios WHERE email = ?', [mb_strtolower(trim((string) ($dados['email'] ?? '')))]);
    if (!password_verify($senha, $conta['senha'] ?? HASH_FICTICIO) || !$conta) {
        falhar('E-mail ou senha inválidos.');
    }
    if (!$conta['ativo']) {
        falhar(motivo_bloqueio($conta), 403);
    }
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = (int) $conta['id'];
    return ['usuario' => usuario_publico($conta)];
}

function acao_sair(array $dados): array
{
    $_SESSION = [];
    session_destroy();
    return [];
}

function acao_cadastrar(array $dados): array
{
    $nome = nome_limpo((string) ($dados['nome'] ?? ''));
    $email = email_limpo((string) ($dados['email'] ?? ''));
    $telefone = telefone_limpo((string) ($dados['telefone'] ?? ''), true);
    $senha = password_hash(senha_valida((string) ($dados['senha'] ?? '')), PASSWORD_DEFAULT);
    $solicitado = $dados['perfil_solicitado'] ?? '';
    if (!in_array($solicitado, NIVEIS_SOLICITAVEIS, true)) {
        falhar('Selecione o nível de usuário.');
    }

    try {
        $id = em_transacao(function () use ($nome, $email, $telefone, $senha, $solicitado) {
            // O primeiro usuário do sistema vira administrador; os demais aguardam aprovação.
            $primeiro = (int) linha('SELECT COUNT(*) n FROM usuarios FOR UPDATE')['n'] === 0;
            executar(
                'INSERT INTO usuarios (nome, email, senha, telefone, role, ativo, perfil_solicitado) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$nome, $email, $senha, $telefone, $primeiro ? 'admin' : 'comum', $primeiro, $primeiro ? null : $solicitado]
            );
            return $primeiro ? db()->insert_id : null;
        });
    } catch (mysqli_sql_exception $e) {
        if (eh_duplicado($e)) {
            falhar('Este e-mail já está cadastrado.', 409);
        }
        throw $e;
    }

    if (!$id) {
        return ['usuario' => null];
    }
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = $id;
    return ['usuario' => usuario_publico(linha('SELECT * FROM usuarios WHERE id = ?', [$id]))];
}

function acao_alterar_senha(array $dados): array
{
    $usuario = usuario_atual();
    if (!password_verify((string) ($dados['senha_atual'] ?? ''), $usuario['senha'])) {
        falhar('A senha atual está incorreta.');
    }
    $nova = senha_valida((string) ($dados['senha_nova'] ?? ''));
    if ($nova === ($dados['senha_atual'] ?? '')) {
        falhar('A nova senha deve ser diferente da atual.');
    }
    executar('UPDATE usuarios SET senha = ? WHERE id = ?', [password_hash($nova, PASSWORD_DEFAULT), (int) $usuario['id']]);
    return [];
}

// ---------- GESTÃO DE USUÁRIOS ----------
function usuario_da_lista(array $u): array
{
    $u = datas_iso($u, ['criado_em']);
    $u['id'] = (string) $u['id'];
    $u['ativo'] = (bool) $u['ativo'];
    return $u;
}

function acao_usuarios_listar(array $dados): array
{
    return array_map('usuario_da_lista', linhas(
        'SELECT id, nome, email, telefone, role, ativo, perfil_solicitado, criado_em FROM usuarios ORDER BY criado_em DESC, id DESC'
    ));
}

function acao_usuarios_pendentes(array $dados): array
{
    return ['total' => (int) linha('SELECT COUNT(*) n FROM usuarios WHERE ativo = 0 AND perfil_solicitado IS NOT NULL')['n']];
}

function nivel_valido($role): string
{
    if (!in_array($role, NIVEIS, true)) {
        falhar('Nível de usuário inválido.');
    }
    return $role;
}

function acao_usuarios_criar(array $dados): array
{
    $valores = [
        nome_limpo((string) ($dados['nome'] ?? '')),
        email_limpo((string) ($dados['email'] ?? '')),
        password_hash(senha_valida((string) ($dados['senha'] ?? '')), PASSWORD_DEFAULT),
        telefone_limpo($dados['telefone'] ?? null),
        nivel_valido($dados['role'] ?? ''),
        !empty($dados['ativo']),
    ];
    try {
        executar('INSERT INTO usuarios (nome, email, senha, telefone, role, ativo) VALUES (?, ?, ?, ?, ?, ?)', $valores);
    } catch (mysqli_sql_exception $e) {
        if (eh_duplicado($e)) {
            falhar('Este e-mail já está cadastrado.', 409);
        }
        throw $e;
    }
    return ['id' => (string) db()->insert_id];
}

function conta_alvo(array $dados): array
{
    $alvo = linha('SELECT * FROM usuarios WHERE id = ?', [inteiro($dados, 'id')]);
    if (!$alvo) {
        falhar('Usuário não encontrado.', 404);
    }
    return $alvo;
}

/** O sistema nunca pode ficar sem um administrador ativo. */
function garantir_outro_admin(array $alvo): void
{
    if ($alvo['role'] !== 'admin' || !$alvo['ativo']) {
        return;
    }
    $outros = linha("SELECT COUNT(*) n FROM usuarios WHERE role = 'admin' AND ativo = 1 AND id <> ?", [(int) $alvo['id']]);
    if ((int) $outros['n'] === 0) {
        falhar('Não é possível remover, desativar ou rebaixar o último administrador do sistema.', 409);
    }
}

function acao_usuarios_atualizar(array $dados): array
{
    return em_transacao(function () use ($dados) {
        $alvo = conta_alvo($dados);
        $proprio = (int) $alvo['id'] === (int) usuario_atual()['id'];

        $nome = array_key_exists('nome', $dados) ? nome_limpo((string) $dados['nome'], false) : $alvo['nome'];
        $email = array_key_exists('email', $dados) ? email_limpo((string) $dados['email']) : $alvo['email'];
        $telefone = array_key_exists('telefone', $dados) ? telefone_limpo($dados['telefone']) : $alvo['telefone'];
        $role = array_key_exists('role', $dados) ? nivel_valido($dados['role']) : $alvo['role'];
        $ativo = array_key_exists('ativo', $dados) ? !empty($dados['ativo']) : (bool) $alvo['ativo'];

        if ($proprio && ($role !== $alvo['role'] || $ativo !== (bool) $alvo['ativo'])) {
            falhar('Você não pode alterar o seu próprio nível ou status. Outro administrador pode fazer isso.', 403);
        }
        if ($role !== 'admin' || !$ativo) {
            garantir_outro_admin($alvo);
        }

        // Conta ativa não tem mais solicitação pendente.
        $solicitado = $ativo ? null : $alvo['perfil_solicitado'];
        try {
            executar(
                'UPDATE usuarios SET nome = ?, email = ?, telefone = ?, role = ?, ativo = ?, perfil_solicitado = ? WHERE id = ?',
                [$nome, $email, $telefone, $role, $ativo, $solicitado, (int) $alvo['id']]
            );
        } catch (mysqli_sql_exception $e) {
            if (eh_duplicado($e)) {
                falhar('Este e-mail já está cadastrado.', 409);
            }
            throw $e;
        }
        return [];
    });
}

function acao_usuarios_excluir(array $dados): array
{
    return em_transacao(function () use ($dados) {
        $alvo = conta_alvo($dados);
        if ((int) $alvo['id'] === (int) usuario_atual()['id']) {
            falhar('Você não pode excluir a própria conta.', 403);
        }
        garantir_outro_admin($alvo);
        executar('DELETE FROM usuarios WHERE id = ?', [(int) $alvo['id']]);
        return [];
    });
}

/** Sem servidor de e-mail na rede local: o admin gera uma senha temporária e entrega à pessoa. */
function acao_usuarios_redefinir_senha(array $dados): array
{
    $alvo = conta_alvo($dados);
    $senha = 'Odont' . bin2hex(random_bytes(4));
    executar('UPDATE usuarios SET senha = ? WHERE id = ?', [password_hash($senha, PASSWORD_DEFAULT), (int) $alvo['id']]);
    return ['senha' => $senha];
}
