<?php
// Solicitação de cotação: os itens vão por e-mail para cada fornecedor escolhido (por padrão,
// todos os ativos com e-mail); os preços respondidos entram no quadro, o menor preço vence e a
// conclusão gera uma lista de compra por fornecedor vencedor, com o preço cotado.
declare(strict_types=1);

function cotacao_aberta(int $id): array
{
    $cotacao = linha('SELECT * FROM cotacoes WHERE id = ? FOR UPDATE', [$id]);
    if (!$cotacao) {
        falhar('Cotação não encontrada.', 404);
    }
    if ($cotacao['status'] !== 'aberta') {
        falhar("Esta cotação já está {$cotacao['status']}.", 409);
    }
    return $cotacao;
}

function acao_cotacoes_listar(array $dados): array
{
    $itens = [];
    foreach (linhas('SELECT * FROM cotacao_itens ORDER BY produto_nome') as $i) {
        $itens[$i['cotacao_id']][] = $i;
    }
    $precos = [];
    foreach (linhas('SELECT p.* FROM cotacao_precos p JOIN cotacao_itens i ON i.id = p.item_id') as $p) {
        $precos[$p['item_id']][$p['fornecedor_id']] = (float) $p['preco_unitario'];
    }
    $fornecedores = [];
    foreach (linhas('SELECT cf.*, f.nome, f.email, f.ativo FROM cotacao_fornecedores cf JOIN fornecedores f ON f.id = cf.fornecedor_id ORDER BY f.nome') as $f) {
        $fornecedores[$f['cotacao_id']][] = datas_iso($f, ['enviado_em']);
    }
    $listas = [];
    foreach (linhas('SELECT id, cotacao_id, fornecedor_nome, status FROM listas_compra WHERE cotacao_id IS NOT NULL') as $l) {
        $listas[$l['cotacao_id']][] = $l;
    }
    return array_map(function ($c) use ($itens, $precos, $fornecedores, $listas) {
        $c = datas_iso($c, ['criado_em', 'atualizado_em', 'concluida_em']);
        $c['itens'] = array_map(fn($i) => $i + ['precos' => (object) ($precos[$i['id']] ?? [])], $itens[$c['id']] ?? []);
        $c['fornecedores'] = $fornecedores[$c['id']] ?? [];
        $c['listas'] = $listas[$c['id']] ?? [];
        return $c;
    }, linhas('SELECT * FROM cotacoes ORDER BY criado_em DESC, id DESC'));
}

/**
 * Cria a cotação e a envia a cada fornecedor. Sem lista de fornecedores, usa todos os ativos
 * com e-mail. Uma falha de envio fica registrada no fornecedor e não desfaz a cotação.
 */
function criar_cotacao(string $titulo, ?string $observacao, ?string $prazoResposta, array $itens, ?array $fornecedorIds, string $origem): array
{
    if (!$itens) {
        falhar('Inclua ao menos um item na cotação.');
    }
    $fornecedores = $fornecedorIds === null
        ? linhas("SELECT * FROM fornecedores WHERE ativo = 1 AND email IS NOT NULL AND email <> '' ORDER BY nome")
        : array_map(function ($id) {
            $f = linha('SELECT * FROM fornecedores WHERE id = ? AND ativo = 1', [(int) $id]);
            if (!$f) {
                falhar('Fornecedor não encontrado ou desativado.', 404);
            }
            return $f;
        }, array_values(array_unique(array_map('intval', $fornecedorIds))));
    if (!$fornecedores) {
        falhar('Cadastre ao menos um fornecedor ativo com e-mail para pedir cotação.');
    }

    $id = em_transacao(function () use ($titulo, $observacao, $prazoResposta, $itens, $fornecedores, $origem) {
        $usuario = usuario_atual();
        executar(
            'INSERT INTO cotacoes (titulo, observacao, prazo_resposta, origem, criado_por, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)',
            [$titulo, $observacao, $prazoResposta, $origem, $usuario ? (int) $usuario['id'] : null, $usuario['nome'] ?? 'Envio automático']
        );
        $id = db()->insert_id;
        foreach ($itens as $item) {
            $quantidade = inteiro($item, 'quantidade');
            if ($quantidade <= 0) {
                falhar('A quantidade de cada item deve ser maior que zero.');
            }
            $produto = linha('SELECT id, nome, unidade FROM produtos WHERE id = ?', [inteiro($item, 'produto_id')]);
            if (!$produto) {
                falhar('Produto não encontrado.', 404);
            }
            executar(
                'INSERT INTO cotacao_itens (cotacao_id, produto_id, produto_nome, unidade, quantidade) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)',
                [$id, (int) $produto['id'], $produto['nome'], $produto['unidade'], $quantidade]
            );
        }
        foreach ($fornecedores as $f) {
            executar('INSERT INTO cotacao_fornecedores (cotacao_id, fornecedor_id) VALUES (?, ?)', [$id, (int) $f['id']]);
        }
        return $id;
    });
    return ['id' => $id] + enviar_cotacao($id, null);
}

/** Envia (ou reenvia) a cotação aos fornecedores com e-mail; com $fornecedorId, só a ele. */
function enviar_cotacao(int $id, ?int $fornecedorId): array
{
    $cotacao = linha('SELECT * FROM cotacoes WHERE id = ?', [$id]);
    $itens = linhas('SELECT produto_nome, unidade, quantidade FROM cotacao_itens WHERE cotacao_id = ? ORDER BY produto_nome', [$id]);
    $alvos = linhas(
        'SELECT f.* FROM cotacao_fornecedores cf JOIN fornecedores f ON f.id = cf.fornecedor_id WHERE cf.cotacao_id = ?' . ($fornecedorId ? ' AND f.id = ?' : ''),
        $fornecedorId ? [$id, $fornecedorId] : [$id]
    );
    $enviados = $falhas = 0;
    foreach ($alvos as $f) {
        try {
            if (!$f['email']) {
                falhar('Fornecedor sem e-mail no cadastro.');
            }
            enviar_registrando([$f['email']], "Solicitação de cotação #$id — " . nome_remetente(), email_cotacao($cotacao, $f, $itens), 'cotacao', 'cotacao', null);
            executar('UPDATE cotacao_fornecedores SET enviado_em = NOW(), erro_envio = NULL WHERE cotacao_id = ? AND fornecedor_id = ?', [$id, (int) $f['id']]);
            $enviados++;
        } catch (ErroApi $e) {
            executar('UPDATE cotacao_fornecedores SET erro_envio = ? WHERE cotacao_id = ? AND fornecedor_id = ?', [$e->getMessage(), $id, (int) $f['id']]);
            $falhas++;
        }
    }
    return ['enviados' => $enviados, 'falhas' => $falhas];
}

function acao_cotacoes_criar(array $dados): array
{
    session_write_close();
    $titulo = texto($dados, 'titulo', 150);
    if ($titulo === '') {
        falhar('Informe o título da cotação.');
    }
    $itens = is_array($dados['itens'] ?? null) ? $dados['itens'] : [];
    $fornecedores = is_array($dados['fornecedores'] ?? null) && $dados['fornecedores'] ? $dados['fornecedores'] : null;
    return criar_cotacao($titulo, texto_ou_nulo($dados, 'observacao'), data_ou_nula($dados, 'prazo_resposta'), $itens, $fornecedores, 'manual');
}

function acao_cotacoes_reenviar(array $dados): array
{
    session_write_close();
    $id = inteiro($dados, 'id');
    em_transacao(fn() => cotacao_aberta($id));
    return enviar_cotacao($id, ($dados['fornecedor_id'] ?? '') === '' ? null : inteiro($dados, 'fornecedor_id'));
}

/** Grava o quadro de preços: [{item_id, fornecedor_id, preco}] (preço vazio apaga) e os prazos. */
function acao_cotacoes_precos(array $dados): array
{
    return em_transacao(function () use ($dados) {
        $cotacao = cotacao_aberta(inteiro($dados, 'id'));
        $id = (int) $cotacao['id'];
        $participantes = array_map('intval', array_column(linhas('SELECT fornecedor_id FROM cotacao_fornecedores WHERE cotacao_id = ?', [$id]), 'fornecedor_id'));
        $itensDaCotacao = array_map('intval', array_column(linhas('SELECT id FROM cotacao_itens WHERE cotacao_id = ?', [$id]), 'id'));
        foreach ((array) ($dados['precos'] ?? []) as $p) {
            $item = inteiro($p, 'item_id');
            $fornecedor = inteiro($p, 'fornecedor_id');
            if (!in_array($item, $itensDaCotacao, true) || !in_array($fornecedor, $participantes, true)) {
                falhar('Preço de item ou fornecedor que não está nesta cotação.');
            }
            $preco = dinheiro_ou_nulo($p, 'preco');
            $preco === null
                ? executar('DELETE FROM cotacao_precos WHERE item_id = ? AND fornecedor_id = ?', [$item, $fornecedor])
                : executar('INSERT INTO cotacao_precos (item_id, fornecedor_id, preco_unitario) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE preco_unitario = VALUES(preco_unitario)', [$item, $fornecedor, $preco]);
        }
        foreach ((array) ($dados['prazos'] ?? []) as $p) {
            $prazo = ($p['prazo_entrega_dias'] ?? '') === '' ? null : inteiro($p, 'prazo_entrega_dias');
            executar('UPDATE cotacao_fornecedores SET prazo_entrega_dias = ? WHERE cotacao_id = ? AND fornecedor_id = ?', [$prazo, $id, inteiro($p, 'fornecedor_id')]);
        }
        foreach ((array) ($dados['escolhas'] ?? []) as $e) {
            $item = inteiro($e, 'item_id');
            $fornecedor = ($e['fornecedor_id'] ?? '') === '' ? null : inteiro($e, 'fornecedor_id');
            if (!in_array($item, $itensDaCotacao, true) || ($fornecedor !== null && !in_array($fornecedor, $participantes, true))) {
                falhar('Escolha de fornecedor inválida.');
            }
            executar('UPDATE cotacao_itens SET fornecedor_escolhido_id = ? WHERE id = ?', [$fornecedor, $item]);
        }
        return [];
    });
}

/**
 * Conclui: cada item fica com o fornecedor escolhido ou, sem escolha, com o menor preço (no
 * empate, o menor prazo de entrega). Gera uma lista de compra por fornecedor vencedor, com o
 * preço cotado, que vira o custo da entrada no recebimento. Item sem preço fica de fora.
 */
function acao_cotacoes_concluir(array $dados): array
{
    return em_transacao(function () use ($dados) {
        $cotacao = cotacao_aberta(inteiro($dados, 'id'));
        $id = (int) $cotacao['id'];
        $prazos = array_column(linhas('SELECT fornecedor_id, prazo_entrega_dias FROM cotacao_fornecedores WHERE cotacao_id = ?', [$id]), 'prazo_entrega_dias', 'fornecedor_id');
        $porFornecedor = [];
        $semPreco = [];
        foreach (linhas('SELECT * FROM cotacao_itens WHERE cotacao_id = ?', [$id]) as $item) {
            $precos = array_column(linhas('SELECT fornecedor_id, preco_unitario FROM cotacao_precos WHERE item_id = ?', [(int) $item['id']]), 'preco_unitario', 'fornecedor_id');
            if (!$precos) {
                $semPreco[] = $item['produto_nome'];
                continue;
            }
            $vencedor = $item['fornecedor_escolhido_id'] !== null && isset($precos[$item['fornecedor_escolhido_id']]) ? (int) $item['fornecedor_escolhido_id'] : null;
            if ($vencedor === null) {
                $candidatos = array_keys($precos);
                usort($candidatos, fn($a, $b) => [(float) $precos[$a], $prazos[$a] ?? PHP_INT_MAX] <=> [(float) $precos[$b], $prazos[$b] ?? PHP_INT_MAX]);
                $vencedor = (int) $candidatos[0];
            }
            executar('UPDATE cotacao_itens SET fornecedor_escolhido_id = ? WHERE id = ?', [$vencedor, (int) $item['id']]);
            $porFornecedor[$vencedor][] = [
                'produto_id' => $item['produto_id'],
                'quantidade' => (int) $item['quantidade'],
                'quantidade_sugerida' => (int) $item['quantidade'],
                'preco_unitario' => (float) $precos[$vencedor],
                'motivo' => "Cotação #$id",
            ];
        }
        if (!$porFornecedor) {
            falhar('Registre ao menos um preço antes de concluir a cotação.');
        }
        $listas = [];
        foreach ($porFornecedor as $fornecedorId => $itens) {
            $fornecedor = linha('SELECT id, nome FROM fornecedores WHERE id = ?', [$fornecedorId]);
            $itens = array_values(array_filter($itens, fn($i) => $i['produto_id'] !== null));
            if ($itens) {
                $listas[] = criar_lista_compra("{$cotacao['titulo']} — {$fornecedor['nome']}", "Gerada pela cotação #$id.", $itens, $fornecedor, $id);
            }
        }
        executar("UPDATE cotacoes SET status = 'concluida', concluida_em = NOW() WHERE id = ?", [$id]);
        return ['listas' => $listas, 'sem_preco' => $semPreco];
    });
}

function acao_cotacoes_cancelar(array $dados): array
{
    return em_transacao(function () use ($dados) {
        $cotacao = cotacao_aberta(inteiro($dados, 'id'));
        executar("UPDATE cotacoes SET status = 'cancelada' WHERE id = ?", [(int) $cotacao['id']]);
        return [];
    });
}
