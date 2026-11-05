<?php
// Critérios de reposição, sugestão automática e listas de compra.
declare(strict_types=1);

function configuracoes(): array
{
    return linha('SELECT dias_alerta_validade, janela_consumo_dias, dias_cobertura, dias_reposicao FROM configuracoes WHERE id = 1');
}

function acao_configuracoes_obter(array $dados): array
{
    return configuracoes();
}

function acao_configuracoes_atualizar(array $dados): array
{
    $faixas = ['dias_alerta_validade' => [1, 365], 'janela_consumo_dias' => [7, 730], 'dias_cobertura' => [1, 365], 'dias_reposicao' => [0, 120]];
    $valores = [];
    foreach ($faixas as $campo => [$minimo, $maximo]) {
        $valores[$campo] = inteiro($dados, $campo);
        if ($valores[$campo] < $minimo || $valores[$campo] > $maximo) {
            falhar("O valor de $campo deve ficar entre $minimo e $maximo.");
        }
    }
    executar('UPDATE configuracoes SET dias_alerta_validade = ?, janela_consumo_dias = ?, dias_cobertura = ?, dias_reposicao = ? WHERE id = 1', array_values($valores));
    return configuracoes();
}

/**
 * Para cada produto:
 *   consumo_diario = saídas na janela configurada / dias da janela
 *   qtd_vencendo   = unidades em lotes que vencem dentro do alerta de validade
 *   estoque_util   = quantidade - qtd_vencendo (o que vai vencer não conta)
 *   ponto_pedido   = estoque_minimo + consumo durante o prazo de entrega
 *   alvo           = estoque_minimo + maior valor entre (consumo na cobertura + entrega) e o mínimo
 *   sugerido       = alvo - estoque_util, quando estoque_util <= ponto_pedido
 * Sem histórico de consumo, o alvo é o dobro do estoque mínimo.
 */
function acao_compras_sugerir(array $dados): array
{
    $cfg = configuracoes();
    $janela = (int) $cfg['janela_consumo_dias'];
    $limite = date('Y-m-d', strtotime('+' . (int) $cfg['dias_alerta_validade'] . ' days'));

    $consumo = array_column(linhas(
        'SELECT produto_id, SUM(quantidade) total FROM saidas_produtos WHERE data_saida >= NOW() - INTERVAL ? DAY GROUP BY produto_id',
        [$janela]
    ), 'total', 'produto_id');

    $vencendo = [];
    foreach (linhas(
        'SELECT produto_id, MIN(validade) validade_proxima, COALESCE(SUM(CASE WHEN validade <= ? THEN quantidade ELSE 0 END), 0) qtd_vencendo
         FROM lotes WHERE quantidade > 0 AND validade IS NOT NULL GROUP BY produto_id',
        [$limite]
    ) as $l) {
        $vencendo[$l['produto_id']] = $l;
    }

    $sugestoes = [];
    foreach (linhas('SELECT * FROM produtos') as $p) {
        $id = (int) $p['id'];
        $quantidade = (int) $p['quantidade'];
        $minimo = (int) $p['estoque_minimo'];
        $periodo = (int) ($consumo[$id] ?? 0);
        $diario = round($periodo / $janela, 3);
        $lote = $vencendo[$id] ?? null;
        $validadeProxima = $lote['validade_proxima'] ?? $p['validade'];
        $qtdVencendo = $lote
            ? (int) $lote['qtd_vencendo']
            : ($p['validade'] !== null && $p['validade'] <= $limite ? $quantidade : 0);
        $qtdVencendo = min($quantidade, $qtdVencendo);
        $util = $quantidade - $qtdVencendo;
        $pontoPedido = $minimo + (int) ceil($diario * (int) $cfg['dias_reposicao']);
        $alvo = $minimo + max((int) ceil($diario * ((int) $cfg['dias_cobertura'] + (int) $cfg['dias_reposicao'])), $minimo);
        if ($util > $pontoPedido || $alvo - $util <= 0) {
            continue;
        }

        // Situação com os mesmos nomes da planilha: Repor abaixo do mínimo, Atenção no mínimo.
        $motivos = [];
        if ($quantidade === 0) {
            $motivos[] = 'Sem estoque';
        } elseif ($quantidade < $minimo) {
            $motivos[] = 'Repor: abaixo do mínimo';
        } elseif ($quantidade === $minimo) {
            $motivos[] = 'Atenção: no mínimo';
        }
        if ($qtdVencendo > 0) {
            $motivos[] = "$qtdVencendo un. vencem até " . date('d/m/Y', strtotime((string) $validadeProxima));
        }
        if ($periodo > 0) {
            $motivos[] = "Consumo: $periodo un. em $janela dias";
        }

        $sugestoes[] = [
            'produto_id' => $id,
            'nome' => $p['nome'],
            'codigo_barras' => $p['codigo_barras'],
            'categoria' => $p['categoria'],
            'unidade' => $p['unidade'],
            'localizacao' => $p['localizacao'],
            'quantidade' => $quantidade,
            'estoque_minimo' => $minimo,
            'consumo_periodo' => $periodo,
            'consumo_diario' => $diario,
            'validade_proxima' => $validadeProxima,
            'qtd_vencendo' => $qtdVencendo,
            'estoque_util' => $util,
            'quantidade_sugerida' => $alvo - $util,
            'motivo' => implode(' · ', $motivos),
            'prioridade' => $alvo > 0 ? $util / $alvo : INF,
        ];
    }

    // Primeiro os zerados, depois os mais distantes do nível alvo.
    usort($sugestoes, fn($a, $b) => [$b['quantidade'] === 0, $a['prioridade'], $a['nome']] <=> [$a['quantidade'] === 0, $b['prioridade'], $b['nome']]);
    return array_map(function ($s) {
        unset($s['prioridade']);
        return $s;
    }, $sugestoes);
}

function acao_compras_listas(array $dados): array
{
    $itens = [];
    foreach (ocultar_custos(linhas('SELECT * FROM listas_compra_itens ORDER BY id'), ['preco_unitario']) as $item) {
        $itens[$item['lista_id']][] = $item;
    }
    return array_map(function ($lista) use ($itens) {
        $lista = datas_iso($lista, ['criado_em', 'atualizado_em', 'recebida_em']);
        $lista['itens'] = $itens[$lista['id']] ?? [];
        return $lista;
    }, linhas('SELECT * FROM listas_compra ORDER BY criado_em DESC, id DESC'));
}

function acao_compras_criar(array $dados): array
{
    $titulo = texto($dados, 'titulo', 150);
    $itens = $dados['itens'] ?? null;
    if ($titulo === '') {
        falhar('Informe o título da lista.');
    }
    if (!is_array($itens) || !$itens) {
        falhar('Selecione ao menos um item.');
    }
    $fornecedor = fornecedor_ativo($dados);
    return em_transacao(fn() => ['id' => criar_lista_compra($titulo, texto_ou_nulo($dados, 'observacao'), $itens, $fornecedor, null)]);
}

/**
 * Grava a lista e seus itens. Precisa rodar dentro de em_transacao(). O preço do item só vem
 * de uma cotação concluída; ele vira o custo da entrada quando a lista é recebida.
 */
function criar_lista_compra(string $titulo, ?string $observacao, array $itens, ?array $fornecedor, ?int $cotacaoId): int
{
    $usuario = usuario_atual();
    executar(
        'INSERT INTO listas_compra (titulo, observacao, fornecedor_id, fornecedor_nome, cotacao_id, criado_por, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$titulo, $observacao, $fornecedor ? (int) $fornecedor['id'] : null, $fornecedor['nome'] ?? null, $cotacaoId, (int) $usuario['id'], $usuario['nome']]
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
            'INSERT INTO listas_compra_itens (lista_id, produto_id, produto_nome, unidade, quantidade_sugerida, quantidade, preco_unitario, motivo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, (int) $produto['id'], $produto['nome'], $produto['unidade'], (int) ($item['quantidade_sugerida'] ?? 0), $quantidade, $cotacaoId ? ($item['preco_unitario'] ?? null) : null, texto_ou_nulo($item, 'motivo')]
        );
    }
    return $id;
}

/** Trava a lista e confirma que ela ainda pode mudar: recebida e cancelada são definitivas. */
function lista_ativa(int $id): array
{
    $lista = linha('SELECT * FROM listas_compra WHERE id = ? FOR UPDATE', [$id]);
    if (!$lista) {
        falhar('Lista de compras não encontrada.', 404);
    }
    if ($lista['status'] === 'recebida' || $lista['status'] === 'cancelada') {
        falhar("Esta lista já está {$lista['status']}.", 409);
    }
    return $lista;
}

function acao_compras_status(array $dados): array
{
    $status = $dados['status'] ?? '';
    if ($status !== 'enviada' && $status !== 'cancelada') {
        falhar('Status inválido.');
    }
    return em_transacao(function () use ($dados, $status) {
        $lista = lista_ativa(inteiro($dados, 'id'));
        executar('UPDATE listas_compra SET status = ? WHERE id = ?', [$status, (int) $lista['id']]);
        return [];
    });
}

/**
 * Recebimento: dá entrada de todos os itens e marca a lista como recebida, tudo ou nada.
 * O custo de cada item é o que o administrador informar ({id do item: custo}) ou, sem isso,
 * o preço da cotação que gerou a lista. Ele entra no custo médio, a base do gasto previsto.
 * As entradas ficam com o fornecedor da lista, para a avaliação do fornecedor.
 */
function acao_compras_receber(array $dados): array
{
    $precos = pode(usuario_atual(), 'financeiro') && is_array($dados['precos'] ?? null) ? $dados['precos'] : [];
    return em_transacao(function () use ($dados, $precos) {
        $lista = lista_ativa(inteiro($dados, 'id'));
        $id = (int) $lista['id'];
        $fornecedor = $lista['fornecedor_id'] ? ['id' => (int) $lista['fornecedor_id'], 'nome' => $lista['fornecedor_nome']] : null;
        $itens = linhas('SELECT id, produto_id, quantidade, preco_unitario FROM listas_compra_itens WHERE lista_id = ? AND produto_id IS NOT NULL', [$id]);
        foreach ($itens as $item) {
            $informado = dinheiro_ou_nulo($precos, (string) $item['id']);
            $custo = $informado ?? ($item['preco_unitario'] === null ? null : (float) $item['preco_unitario']);
            if ($informado !== null) {
                executar('UPDATE listas_compra_itens SET preco_unitario = ? WHERE id = ?', [$informado, (int) $item['id']]);
            }
            registrar_movimentacao((int) $item['produto_id'], 'entrada', (int) $item['quantidade'], "Recebimento da lista de compras #$id", null, null, 'compra', $custo, $fornecedor);
        }
        executar("UPDATE listas_compra SET status = 'recebida', recebida_em = NOW() WHERE id = ?", [$id]);
        return ['itens' => count($itens)];
    });
}

/**
 * Envia a lista ao fornecedor por e-mail, só com produtos e quantidades (sem preços), e marca
 * o pedido como enviado. O fornecedor precisa ter e-mail no cadastro.
 */
function acao_compras_enviar_fornecedor(array $dados): array
{
    $id = inteiro($dados, 'id');
    $lista = linha('SELECT * FROM listas_compra WHERE id = ?', [$id]);
    if (!$lista) {
        falhar('Lista de compras não encontrada.', 404);
    }
    if ($lista['status'] !== 'aberta' && $lista['status'] !== 'enviada') {
        falhar("Esta lista já está {$lista['status']}.", 409);
    }
    $fornecedor = $lista['fornecedor_id'] ? linha('SELECT * FROM fornecedores WHERE id = ?', [(int) $lista['fornecedor_id']]) : null;
    if (!$fornecedor || !$fornecedor['email']) {
        falhar('Escolha um fornecedor com e-mail cadastrado para esta lista.');
    }
    $itens = linhas('SELECT produto_nome, unidade, quantidade FROM listas_compra_itens WHERE lista_id = ? ORDER BY produto_nome', [$id]);
    $assunto = "Pedido de compra #$id — " . nome_remetente();
    $html = email_pedido_fornecedor($lista, $fornecedor, $itens);
    enviar_registrando([$fornecedor['email']], $assunto, $html, 'fornecedor', 'pedido', null);
    executar("UPDATE listas_compra SET status = 'enviada' WHERE id = ? AND status = 'aberta'", [$id]);
    return ['email' => $fornecedor['email']];
}

/** Vincula ou troca o fornecedor de uma lista que ainda não foi recebida. */
function acao_compras_fornecedor(array $dados): array
{
    $fornecedor = fornecedor_ativo($dados);
    return em_transacao(function () use ($dados, $fornecedor) {
        $lista = lista_ativa(inteiro($dados, 'id'));
        executar('UPDATE listas_compra SET fornecedor_id = ?, fornecedor_nome = ? WHERE id = ?', [$fornecedor ? (int) $fornecedor['id'] : null, $fornecedor['nome'] ?? null, (int) $lista['id']]);
        return [];
    });
}
