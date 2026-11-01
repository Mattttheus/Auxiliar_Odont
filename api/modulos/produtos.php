<?php
// Cadastro de produtos, lotes e conferência de saldo.
declare(strict_types=1);

// Aba Listas da planilha: o prefixo do código identifica a categoria do item (01-001, 02-001...).
const PREFIXOS_CATEGORIA = [
    'Dentística' => '01', 'Cirurgia' => '02', 'Periodontia' => '03', 'Endodontia' => '04',
    'Consumíveis' => '05', 'Prótese' => '06', 'Instrumental' => '07',
];

function acao_produtos_listar(array $dados): array
{
    return linhas('SELECT * FROM produtos ORDER BY nome');
}

function acao_produtos_obter(array $dados): ?array
{
    return linha('SELECT * FROM produtos WHERE id = ?', [inteiro($dados, 'id')]);
}

function acao_produtos_por_codigo(array $dados): ?array
{
    return linha('SELECT * FROM produtos WHERE codigo_barras = ?', [texto($dados, 'codigo')]);
}

function acao_lotes_listar(array $dados): array
{
    return linhas(
        'SELECT * FROM lotes WHERE produto_id = ? AND quantidade > 0 ORDER BY validade IS NULL, validade, id',
        [inteiro($dados, 'produto_id')]
    );
}

/** Próximo código da categoria, como na planilha. Sem categoria conhecida, fica sem código. */
function proximo_codigo(?string $categoria): ?string
{
    $prefixo = PREFIXOS_CATEGORIA[$categoria] ?? null;
    if (!$prefixo) {
        return null;
    }
    $ultimo = linha(
        "SELECT MAX(CAST(SUBSTRING(codigo_barras, 4) AS UNSIGNED)) n FROM produtos WHERE codigo_barras REGEXP ? FOR UPDATE",
        ['^' . $prefixo . '-[0-9]+$']
    );
    return sprintf('%s-%03d', $prefixo, (int) $ultimo['n'] + 1);
}

/** Lê só os campos enviados: as etiquetas, por exemplo, atualizam apenas o código. */
function campos_produto(array $dados): array
{
    $campos = [];
    if (array_key_exists('nome', $dados)) {
        $campos['nome'] = texto($dados, 'nome', 100);
        if ($campos['nome'] === '') {
            falhar('Informe o nome do produto.');
        }
    }
    if (array_key_exists('descricao', $dados)) {
        $campos['descricao'] = texto_ou_nulo($dados, 'descricao');
    }
    foreach (['categoria' => 60, 'unidade' => 30, 'localizacao' => 100, 'codigo_barras' => 100] as $campo => $maximo) {
        if (array_key_exists($campo, $dados)) {
            $campos[$campo] = texto_ou_nulo($dados, $campo, $maximo);
        }
    }
    if (array_key_exists('preco', $dados)) {
        if (!is_numeric($dados['preco']) || $dados['preco'] < 0) {
            falhar('Informe um preço válido.');
        }
        $campos['preco'] = (float) $dados['preco'];
    }
    foreach (['quantidade', 'estoque_minimo'] as $campo) {
        if (array_key_exists($campo, $dados)) {
            $campos[$campo] = inteiro($dados, $campo);
            if ($campos[$campo] < 0) {
                falhar('A quantidade e o estoque mínimo não podem ser negativos.');
            }
        }
    }
    if (array_key_exists('validade', $dados)) {
        $campos['validade'] = data_ou_nula($dados, 'validade');
    }
    return $campos;
}

function codigo_repetido(mysqli_sql_exception $e): void
{
    if (eh_duplicado($e)) {
        falhar('Já existe um produto com esse código.', 409);
    }
    throw $e;
}

function acao_produtos_criar(array $dados): array
{
    $campos = campos_produto($dados);
    if (!isset($campos['nome'])) {
        falhar('Informe o nome do produto.');
    }
    try {
        return em_transacao(function () use ($campos) {
            if (empty($campos['codigo_barras'])) {
                $campos['codigo_barras'] = proximo_codigo($campos['categoria'] ?? null);
            }
            $campos['estoque_inicial'] = $campos['quantidade'] ?? 0;
            $nomes = implode(', ', array_keys($campos));
            $marcas = implode(', ', array_fill(0, count($campos), '?'));
            executar("INSERT INTO produtos ($nomes) VALUES ($marcas)", array_values($campos));
            $id = db()->insert_id;
            registrar_historico(usuario_atual(), $id, $campos['nome'], 'Cadastro', "Produto cadastrado com {$campos['estoque_inicial']} unidade(s)", $campos['estoque_inicial'], 'cadastro');
            return ['id' => $id, 'codigo_barras' => $campos['codigo_barras']];
        });
    } catch (mysqli_sql_exception $e) {
        codigo_repetido($e);
    }
}

function acao_produtos_atualizar(array $dados): array
{
    $id = inteiro($dados, 'id');
    $campos = campos_produto($dados);
    if (!$campos) {
        falhar('Nada para atualizar.');
    }
    try {
        return em_transacao(function () use ($id, $campos) {
            $antes = linha('SELECT * FROM produtos WHERE id = ? FOR UPDATE', [$id]);
            if (!$antes) {
                falhar('Produto não encontrado.', 404);
            }
            $sets = implode(', ', array_map(fn($c) => "$c = ?", array_keys($campos)));
            executar("UPDATE produtos SET $sets WHERE id = ?", [...array_values($campos), $id]);

            // Alterar a quantidade por aqui é um ajuste: fica registrado e entra na conferência de saldo.
            $nome = $campos['nome'] ?? $antes['nome'];
            $mudou = false;
            foreach ($campos as $campo => $valor) {
                if ($campo !== 'quantidade' && (string) $antes[$campo] !== (string) $valor && !($campo === 'preco' && (float) $antes[$campo] === (float) $valor)) {
                    $mudou = true;
                }
            }
            if (isset($campos['quantidade']) && (int) $campos['quantidade'] !== (int) $antes['quantidade']) {
                registrar_historico(usuario_atual(), $id, $nome, 'Ajuste', "Ajuste manual de estoque: {$antes['quantidade']} → {$campos['quantidade']}", $campos['quantidade'] - (int) $antes['quantidade'], 'ajuste');
            } elseif ($mudou) {
                registrar_historico(usuario_atual(), $id, $nome, 'Edição', 'Dados do produto atualizados', null, 'cadastro');
            }
            return [];
        });
    } catch (mysqli_sql_exception $e) {
        codigo_repetido($e);
    }
}

function acao_produtos_excluir(array $dados): array
{
    return em_transacao(function () use ($dados) {
        $id = inteiro($dados, 'id');
        $produto = linha('SELECT * FROM produtos WHERE id = ? FOR UPDATE', [$id]);
        if (!$produto) {
            falhar('Produto não encontrado.', 404);
        }
        registrar_historico(usuario_atual(), null, $produto['nome'], 'Exclusão', "Produto excluído (tinha {$produto['quantidade']} unidade(s))", -(int) $produto['quantidade'], 'cadastro');
        executar('DELETE FROM produtos WHERE id = ?', [$id]);
        return [];
    });
}

/** Lógica da planilha: quantidade = estoque inicial + entradas - saídas (e ajustes manuais). */
function acao_produtos_conferencia(array $dados): array
{
    return array_map(function ($p) {
        foreach (['estoque_inicial', 'entradas', 'saidas', 'ajustes', 'quantidade'] as $campo) {
            $p[$campo] = (int) $p[$campo];
        }
        $p['calculado'] = $p['estoque_inicial'] + $p['entradas'] - $p['saidas'] + $p['ajustes'];
        $p['diferenca'] = $p['quantidade'] - $p['calculado'];
        return $p;
    }, linhas(
        "SELECT p.id, p.codigo_barras, p.nome, p.unidade, p.estoque_inicial, p.quantidade,
            COALESCE((SELECT SUM(e.quantidade) FROM entradas_produtos e WHERE e.produto_id = p.id), 0) entradas,
            COALESCE((SELECT SUM(s.quantidade) FROM saidas_produtos s WHERE s.produto_id = p.id), 0) saidas,
            COALESCE((SELECT SUM(h.quantidade) FROM historico h WHERE h.produto_id = p.id AND h.acao = 'Ajuste'), 0) ajustes
         FROM produtos p ORDER BY p.nome"
    ));
}
