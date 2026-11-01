<?php
// Base da API local: conexão com o MySQL, sessão, respostas e permissões.
declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');

const NIVEIS = ['admin', 'dentista', 'estoquista', 'vendedor', 'comum'];
const NIVEIS_SOLICITAVEIS = ['dentista', 'estoquista', 'vendedor', 'comum'];

// Quem pode o quê. A regra vale aqui, no servidor; assets/js/permissions.js repete esta
// mesma matriz só para decidir o que mostrar na tela, então as duas precisam ficar iguais.
const PERMISSOES = [
    'admin' => ['produtos_view', 'produtos_edit', 'entrada', 'saida', 'historico', 'usuarios', 'compras', 'compras_edit', 'etiquetas', 'config', 'controle'],
    'estoquista' => ['produtos_view', 'produtos_edit', 'entrada', 'saida', 'historico', 'compras', 'compras_edit', 'etiquetas'],
    'vendedor' => ['produtos_view', 'saida', 'historico'],
    'dentista' => ['produtos_view', 'historico', 'compras'],
    'comum' => ['produtos_view'],
];

final class ErroApi extends RuntimeException
{
}

function falhar(string $mensagem, int $status = 400): void
{
    throw new ErroApi($mensagem, $status);
}

// ---------- BANCO ----------
function db(): mysqli
{
    static $conexao = null;
    if ($conexao) {
        return $conexao;
    }
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    try {
        $conexao = mysqli_init();
        $conexao->options(MYSQLI_OPT_INT_AND_FLOAT_NATIVE, 1);
        // MySQL do WAMP: root sem senha, acessível só deste computador.
        $conexao->real_connect('127.0.0.1', 'root', '', getenv('AUXILIAR_DB') ?: 'auxiliar_odont', 3306);
    } catch (mysqli_sql_exception $e) {
        $conexao = null;
        error_log('Auxiliar Odont: ' . $e->getMessage());
        falhar('O banco de dados não respondeu. Verifique se o WAMP está ligado neste computador.', 503);
    }
    $conexao->set_charset('utf8mb4');
    // Este MySQL vem sem modo estrito, o que cortaria textos e números sem avisar.
    $conexao->query("SET time_zone = '-03:00', sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
    return $conexao;
}

function executar(string $sql, array $parametros = []): mysqli_stmt
{
    $comando = db()->prepare($sql);
    if ($parametros) {
        $tipos = '';
        $valores = [];
        foreach ($parametros as $p) {
            $tipos .= is_int($p) || is_bool($p) ? 'i' : (is_float($p) ? 'd' : 's');
            $valores[] = is_bool($p) ? (int) $p : $p;
        }
        $comando->bind_param($tipos, ...$valores);
    }
    $comando->execute();
    return $comando;
}

function linhas(string $sql, array $parametros = []): array
{
    return executar($sql, $parametros)->get_result()->fetch_all(MYSQLI_ASSOC);
}

function linha(string $sql, array $parametros = []): ?array
{
    return linhas($sql, $parametros)[0] ?? null;
}

/** Tudo ou nada: se algo falhar no meio, nenhuma alteração fica gravada. */
function em_transacao(callable $operacao)
{
    db()->begin_transaction();
    try {
        $resultado = $operacao();
        db()->commit();
        return $resultado;
    } catch (Throwable $e) {
        db()->rollback();
        throw $e;
    }
}

/** Datas com hora no formato que o navegador lê como horário local. */
function datas_iso(array $linha, array $campos): array
{
    foreach ($campos as $campo) {
        if (!empty($linha[$campo])) {
            $linha[$campo] = str_replace(' ', 'T', (string) $linha[$campo]);
        }
    }
    return $linha;
}

function eh_duplicado(mysqli_sql_exception $e): bool
{
    return $e->getCode() === 1062;
}

// ---------- ENTRADA DE DADOS ----------
function texto(array $dados, string $campo, int $maximo = 0): string
{
    $valor = trim((string) ($dados[$campo] ?? ''));
    if ($maximo && mb_strlen($valor) > $maximo) {
        falhar("O campo $campo aceita no máximo $maximo caracteres.");
    }
    return $valor;
}

function texto_ou_nulo(array $dados, string $campo, int $maximo = 0): ?string
{
    $valor = texto($dados, $campo, $maximo);
    return $valor === '' ? null : $valor;
}

function inteiro(array $dados, string $campo): int
{
    $valor = $dados[$campo] ?? null;
    if (!is_numeric($valor) || (int) $valor != $valor) {
        falhar("O campo $campo precisa ser um número inteiro.");
    }
    return (int) $valor;
}

function data_ou_nula(array $dados, string $campo): ?string
{
    $valor = texto($dados, $campo);
    if ($valor === '') {
        return null;
    }
    $d = DateTime::createFromFormat('!Y-m-d', $valor);
    if (!$d || $d->format('Y-m-d') !== $valor) {
        falhar("Data inválida em $campo.");
    }
    return $valor;
}

// ---------- SESSÃO E PERMISSÕES ----------
function iniciar_sessao(): void
{
    // Pasta própria: a limpeza das sessões de outros projetos do WAMP não derruba este login.
    $pasta = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'auxiliar_odont_sessoes';
    if (!is_dir($pasta)) {
        mkdir($pasta, 0700, true);
    }
    session_save_path($pasta);
    session_name('AUXILIAR_ODONT');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', (string) (12 * 3600));
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

/** Lido do banco a cada chamada: conta desativada ou nível alterado valem na hora. */
function usuario_atual(): ?array
{
    static $usuario = false;
    if ($usuario === false) {
        $id = $_SESSION['usuario_id'] ?? null;
        $usuario = $id ? linha('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [(int) $id]) : null;
    }
    return $usuario;
}

function pode(?array $usuario, string $permissao): bool
{
    return $usuario && in_array($permissao, PERMISSOES[$usuario['role']] ?? [], true);
}

function exigir(string $permissao): void
{
    $usuario = usuario_atual();
    if (!$usuario) {
        falhar('Sua sessão terminou. Entre novamente.', 401);
    }
    if ($permissao !== 'login' && !pode($usuario, $permissao)) {
        falhar('Seu nível de acesso não permite esta ação.', 403);
    }
}

function registrar_historico(array $usuario, ?int $produtoId, string $produtoNome, string $acao, string $descricao, ?int $quantidade, string $origem): void
{
    executar(
        'INSERT INTO historico (usuario_id, usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [(int) $usuario['id'], $usuario['nome'], $produtoId, $produtoNome, $acao, $descricao, $quantidade, $origem]
    );
}
