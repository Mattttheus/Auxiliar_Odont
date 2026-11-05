<?php
// Cadastro de fornecedores e a avaliação de cada um pelo histórico de compras.
declare(strict_types=1);

function so_digitos(?string $valor): string
{
    return preg_replace('/\D/', '', (string) $valor);
}

/** CNPJ com os dois dígitos verificadores corretos. */
function cnpj_valido(string $cnpj): bool
{
    if (strlen($cnpj) !== 14 || preg_match('/^(\d)\1{13}$/', $cnpj)) {
        return false;
    }
    foreach ([12, 13] as $posicao) {
        $pesos = $posicao === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        $soma = 0;
        foreach ($pesos as $i => $peso) {
            $soma += (int) $cnpj[$i] * $peso;
        }
        $digito = $soma % 11 < 2 ? 0 : 11 - $soma % 11;
        if ((int) $cnpj[$posicao] !== $digito) {
            return false;
        }
    }
    return true;
}

function email_valido_ou_falha(?string $email, string $campo = 'e-mail'): ?string
{
    if ($email === null || $email === '') {
        return null;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        falhar("Informe um $campo válido.");
    }
    return $email;
}

/**
 * Lista com a avaliação: listas recebidas, prazo real (dias entre criar a lista e receber),
 * cotações respondidas e, só para quem vê custos, o total comprado em 12 meses.
 */
function acao_fornecedores_listar(array $dados): array
{
    $fornecedores = linhas(
        "SELECT f.*,
            (SELECT COUNT(*) FROM listas_compra l WHERE l.fornecedor_id = f.id AND l.status = 'recebida') listas_recebidas,
            (SELECT COUNT(*) FROM listas_compra l WHERE l.fornecedor_id = f.id AND l.status IN ('aberta', 'enviada')) listas_abertas,
            (SELECT ROUND(AVG(DATEDIFF(l.recebida_em, l.criado_em)), 1) FROM listas_compra l WHERE l.fornecedor_id = f.id AND l.status = 'recebida') prazo_real_dias,
            (SELECT MAX(e.data_entrada) FROM entradas_produtos e WHERE e.fornecedor_id = f.id) ultima_compra,
            (SELECT COUNT(*) FROM cotacao_fornecedores cf WHERE cf.fornecedor_id = f.id AND cf.enviado_em IS NOT NULL) cotacoes_recebidas,
            (SELECT COUNT(DISTINCT i.cotacao_id) FROM cotacao_precos cp JOIN cotacao_itens i ON i.id = cp.item_id WHERE cp.fornecedor_id = f.id) cotacoes_respondidas,
            (SELECT COUNT(*) FROM cotacao_itens i WHERE i.fornecedor_escolhido_id = f.id) itens_vencidos,
            (SELECT COALESCE(SUM(e.quantidade * e.custo_unitario), 0) FROM entradas_produtos e WHERE e.fornecedor_id = f.id AND e.data_entrada >= NOW() - INTERVAL 12 MONTH) comprado_12m
         FROM fornecedores f ORDER BY f.ativo DESC, f.nome"
    );
    return array_map(fn($f) => datas_iso($f, ['ultima_compra', 'criado_em', 'atualizado_em']), ocultar_custos($fornecedores, ['comprado_12m']));
}

function acao_fornecedores_salvar(array $dados): array
{
    $id = isset($dados['id']) && $dados['id'] !== '' && $dados['id'] !== null ? inteiro($dados, 'id') : null;
    $nome = texto($dados, 'nome', 150);
    if ($nome === '') {
        falhar('Informe o nome do fornecedor.');
    }
    $cnpj = so_digitos(texto($dados, 'cnpj')) ?: null;
    if ($cnpj !== null && !cnpj_valido($cnpj)) {
        falhar('CNPJ inválido: confira os 14 dígitos.');
    }
    $telefone = so_digitos(texto($dados, 'telefone')) ?: null;
    if ($telefone !== null && (strlen($telefone) < 10 || strlen($telefone) > 11)) {
        falhar('Informe o telefone com DDD (10 ou 11 dígitos).');
    }
    $prazo = ($dados['prazo_entrega_dias'] ?? '') === '' ? null : inteiro($dados, 'prazo_entrega_dias');
    if ($prazo !== null && ($prazo < 0 || $prazo > 365)) {
        falhar('O prazo de entrega deve ficar entre 0 e 365 dias.');
    }
    $campos = [
        'nome' => $nome,
        'cnpj' => $cnpj,
        'contato' => texto_ou_nulo($dados, 'contato', 100),
        'email' => email_valido_ou_falha(texto_ou_nulo($dados, 'email', 150)),
        'telefone' => $telefone,
        'endereco' => texto_ou_nulo($dados, 'endereco', 200),
        'prazo_entrega_dias' => $prazo,
        'condicao_pagamento' => texto_ou_nulo($dados, 'condicao_pagamento', 100),
        'observacao' => texto_ou_nulo($dados, 'observacao'),
        'ativo' => !array_key_exists('ativo', $dados) || !empty($dados['ativo']) ? 1 : 0,
    ];
    try {
        if ($id === null) {
            executar('INSERT INTO fornecedores (' . implode(', ', array_keys($campos)) . ') VALUES (' . implode(', ', array_fill(0, count($campos), '?')) . ')', array_values($campos));
            return ['id' => db()->insert_id];
        }
        if (!linha('SELECT id FROM fornecedores WHERE id = ?', [$id])) {
            falhar('Fornecedor não encontrado.', 404);
        }
        executar('UPDATE fornecedores SET ' . implode(', ', array_map(fn($c) => "$c = ?", array_keys($campos))) . ' WHERE id = ?', [...array_values($campos), $id]);
        return ['id' => $id];
    } catch (mysqli_sql_exception $e) {
        if (eh_duplicado($e)) {
            falhar('Já existe um fornecedor com esse CNPJ.', 409);
        }
        throw $e;
    }
}

/** Só exclui quem nunca foi usado; com histórico, o caminho é desativar, para manter o registro. */
function acao_fornecedores_excluir(array $dados): array
{
    $id = inteiro($dados, 'id');
    $uso = linha(
        'SELECT (SELECT COUNT(*) FROM entradas_produtos WHERE fornecedor_id = ?) + (SELECT COUNT(*) FROM listas_compra WHERE fornecedor_id = ?)
            + (SELECT COUNT(*) FROM cotacao_fornecedores WHERE fornecedor_id = ?) n',
        [$id, $id, $id]
    );
    if ((int) $uso['n'] > 0) {
        falhar('Este fornecedor já tem compras ou cotações registradas. Desative-o em vez de excluir.', 409);
    }
    executar('DELETE FROM fornecedores WHERE id = ?', [$id]);
    return [];
}

/** Fornecedor ativo para vincular a uma lista, cotação ou entrada; null quando não informado. */
function fornecedor_ativo(array $dados, string $campo = 'fornecedor_id'): ?array
{
    if (($dados[$campo] ?? '') === '' || $dados[$campo] === null) {
        return null;
    }
    $fornecedor = linha('SELECT id, nome, email FROM fornecedores WHERE id = ? AND ativo = 1', [inteiro($dados, $campo)]);
    if (!$fornecedor) {
        falhar('Fornecedor não encontrado ou desativado.', 404);
    }
    return $fornecedor;
}
