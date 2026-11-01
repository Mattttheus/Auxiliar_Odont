<?php
// Entradas e saídas (com lotes e FEFO), vendas do Caixa, histórico e consultas de consumo.
declare(strict_types=1);

const ORIGENS_MOVIMENTO = ['manual', 'qr', 'pdv'];

/**
 * Registra uma entrada ou saída: trava a linha do produto, confere permissão e estoque,
 * atualiza os lotes e a validade mais próxima e grava o histórico. Evita saldo errado quando
 * duas pessoas movimentam o mesmo item. Precisa rodar dentro de em_transacao().
 */
function registrar_movimentacao(int $produtoId, string $tipo, int $quantidade, string $observacao, ?string $lote, ?string $validade, string $origem): int
{
    $usuario = usuario_atual();
    if ($tipo !== 'entrada' && $tipo !== 'saida') {
        falhar('Tipo de movimentação inválido.');
    }
    if ($quantidade <= 0) {
        falhar('A quantidade deve ser maior que zero.');
    }
    if (!pode($usuario, $tipo)) {
        falhar($tipo === 'entrada' ? 'Seu nível de acesso não permite registrar entradas.' : 'Seu nível de acesso não permite registrar saídas.', 403);
    }
    $produto = linha('SELECT * FROM produtos WHERE id = ? FOR UPDATE', [$produtoId]);
    if (!$produto) {
        falhar('Produto não encontrado.', 404);
    }
    $atual = (int) $produto['quantidade'];
    $idUsuario = (int) $usuario['id'];

    if ($tipo === 'entrada') {
        $novo = $atual + $quantidade;
        $lote = $lote === null || trim($lote) === '' ? null : mb_substr(trim($lote), 0, 60);
        if ($lote !== null || $validade !== null) {
            $lote = $lote ?? 'S/L';
            $existente = linha('SELECT id FROM lotes WHERE produto_id = ? AND lote = ? AND validade <=> ? FOR UPDATE', [$produtoId, $lote, $validade]);
            if ($existente) {
                executar('UPDATE lotes SET quantidade = quantidade + ? WHERE id = ?', [$quantidade, (int) $existente['id']]);
            } else {
                executar('INSERT INTO lotes (produto_id, lote, validade, quantidade) VALUES (?, ?, ?, ?)', [$produtoId, $lote, $validade, $quantidade]);
            }
        }
        executar(
            'INSERT INTO entradas_produtos (produto_id, produto_nome, quantidade, usuario_id, usuario_nome, observacao, lote, validade, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$produtoId, $produto['nome'], $quantidade, $idUsuario, $usuario['nome'], $observacao, $lote, $validade, $origem]
        );
        $descricao = "Entrada de $quantidade unidade(s)"
            . ($lote !== null ? " — lote $lote" : '')
            . ($validade !== null ? ' — validade ' . date('d/m/Y', strtotime($validade)) : '');
    } else {
        if ($quantidade > $atual) {
            falhar("Estoque insuficiente para \"{$produto['nome']}\". Disponível: $atual", 409);
        }
        $novo = $atual - $quantidade;

        // FEFO: consome primeiro os lotes que vencem antes.
        $restante = $quantidade;
        $usados = [];
        $lotes = linhas('SELECT id, lote, quantidade FROM lotes WHERE produto_id = ? AND quantidade > 0 ORDER BY validade IS NULL, validade, id FOR UPDATE', [$produtoId]);
        foreach ($lotes as $l) {
            if ($restante === 0) {
                break;
            }
            $tira = min($restante, (int) $l['quantidade']);
            executar('UPDATE lotes SET quantidade = quantidade - ? WHERE id = ?', [$tira, (int) $l['id']]);
            $restante -= $tira;
            $usados[] = "{$l['lote']} ($tira)";
        }
        $lotesUsados = $usados ? implode(', ', $usados) : null;
        executar(
            'INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_id, usuario_nome, observacao, lote, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$produtoId, $produto['nome'], $quantidade, $idUsuario, $usuario['nome'], $observacao, $lotesUsados, $origem]
        );
        $descricao = "Saída de $quantidade unidade(s)" . ($lotesUsados ? " — lote(s) $lotesUsados" : '');
    }

    // A validade exibida no produto passa a ser a do lote ativo que vence primeiro.
    $temLotes = (int) linha('SELECT COUNT(*) n FROM lotes WHERE produto_id = ?', [$produtoId])['n'] > 0;
    $novaValidade = $temLotes
        ? linha('SELECT MIN(validade) v FROM lotes WHERE produto_id = ? AND quantidade > 0', [$produtoId])['v']
        : $produto['validade'];
    executar('UPDATE produtos SET quantidade = ?, validade = ? WHERE id = ?', [$novo, $novaValidade, $produtoId]);

    registrar_historico($usuario, $produtoId, $produto['nome'], $tipo === 'entrada' ? 'Entrada' : 'Saída', $descricao, $tipo === 'entrada' ? $quantidade : -$quantidade, $origem);
    return $novo;
}

function acao_movimentar(array $dados): array
{
    $origem = in_array($dados['origem'] ?? '', ORIGENS_MOVIMENTO, true) ? $dados['origem'] : 'manual';
    $novo = em_transacao(fn() => registrar_movimentacao(
        inteiro($dados, 'produto_id'),
        (string) ($dados['tipo'] ?? ''),
        inteiro($dados, 'quantidade'),
        texto($dados, 'observacao'),
        texto_ou_nulo($dados, 'lote'),
        data_ou_nula($dados, 'validade'),
        $origem
    ));
    return ['estoque' => $novo];
}

/** Venda do Caixa: todos os itens numa única transação. Ou sai tudo, ou nada. */
function acao_venda(array $dados): array
{
    $itens = $dados['itens'] ?? null;
    if (!is_array($itens) || !$itens) {
        falhar('O carrinho está vazio.');
    }
    return em_transacao(function () use ($itens) {
        foreach ($itens as $item) {
            registrar_movimentacao(inteiro($item, 'produto_id'), 'saida', inteiro($item, 'quantidade'), 'Venda via Caixa (PDV)', null, null, 'pdv');
        }
        return ['itens' => count($itens)];
    });
}

/** Converte a data enviada pelo navegador para o horário do servidor. */
function data_inicio(array $dados): ?string
{
    $desde = texto($dados, 'desde');
    if ($desde === '') {
        return null;
    }
    $instante = strtotime($desde);
    if ($instante === false) {
        falhar('Data inicial inválida.');
    }
    return date('Y-m-d H:i:s', $instante);
}

function acao_movimentacoes_desde(array $dados): array
{
    $desde = data_inicio($dados) ?? '1970-01-01 00:00:00';
    $entradas = linhas('SELECT produto_id, produto_nome, quantidade, data_entrada FROM entradas_produtos WHERE data_entrada >= ?', [$desde]);
    $saidas = linhas('SELECT produto_id, produto_nome, quantidade, data_saida FROM saidas_produtos WHERE data_saida >= ?', [$desde]);
    return [
        'entradas' => array_map(fn($l) => datas_iso($l, ['data_entrada']), $entradas),
        'saidas' => array_map(fn($l) => datas_iso($l, ['data_saida']), $saidas),
    ];
}

function acao_saidas_consumo(array $dados): array
{
    $desde = data_inicio($dados);
    return $desde
        ? linhas('SELECT produto_id, quantidade FROM saidas_produtos WHERE data_saida >= ?', [$desde])
        : linhas('SELECT produto_id, quantidade FROM saidas_produtos');
}

function acao_saidas_listar(array $dados): array
{
    return array_map(fn($l) => datas_iso($l, ['data_saida']), linhas('SELECT * FROM saidas_produtos ORDER BY data_saida DESC, id DESC'));
}

function acao_historico_listar(array $dados): array
{
    return array_map(fn($l) => datas_iso($l, ['data_acao']), linhas('SELECT * FROM historico ORDER BY data_acao DESC, id DESC'));
}
