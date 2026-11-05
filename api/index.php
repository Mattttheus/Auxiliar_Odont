<?php
// API local do sistema: a única porta entre as telas e o MySQL.
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/nucleo.php';
require __DIR__ . '/modulos/contas.php';
require __DIR__ . '/modulos/produtos.php';
require __DIR__ . '/modulos/movimentacoes.php';
require __DIR__ . '/modulos/compras.php';
require __DIR__ . '/modulos/planejamento.php';
require __DIR__ . '/modulos/fornecedores.php';
require __DIR__ . '/modulos/cotacoes.php';
require __DIR__ . '/modulos/emails.php';
require __DIR__ . '/modulos/financeiro.php';

// ação => [método, permissão, função]. null é público; 'login' é qualquer usuário ativo.
const ROTAS = [
    'sessao' => ['GET', null, 'acao_sessao'],
    'entrar' => ['POST', null, 'acao_entrar'],
    'sair' => ['POST', null, 'acao_sair'],
    'cadastrar' => ['POST', null, 'acao_cadastrar'],
    'alterar_senha' => ['POST', 'login', 'acao_alterar_senha'],

    'usuarios.listar' => ['GET', 'usuarios', 'acao_usuarios_listar'],
    'usuarios.pendentes' => ['GET', 'usuarios', 'acao_usuarios_pendentes'],
    'usuarios.criar' => ['POST', 'usuarios', 'acao_usuarios_criar'],
    'usuarios.atualizar' => ['POST', 'usuarios', 'acao_usuarios_atualizar'],
    'usuarios.excluir' => ['POST', 'usuarios', 'acao_usuarios_excluir'],
    'usuarios.redefinir_senha' => ['POST', 'usuarios', 'acao_usuarios_redefinir_senha'],

    'produtos.listar' => ['GET', 'produtos_view', 'acao_produtos_listar'],
    'produtos.obter' => ['GET', 'produtos_view', 'acao_produtos_obter'],
    'produtos.por_codigo' => ['GET', 'produtos_view', 'acao_produtos_por_codigo'],
    'produtos.criar' => ['POST', 'produtos_edit', 'acao_produtos_criar'],
    'produtos.atualizar' => ['POST', 'produtos_edit', 'acao_produtos_atualizar'],
    'produtos.excluir' => ['POST', 'produtos_edit', 'acao_produtos_excluir'],
    'produtos.conferencia' => ['GET', 'controle', 'acao_produtos_conferencia'],
    'produtos.custos' => ['POST', 'financeiro', 'acao_produtos_custos'],
    'lotes.listar' => ['GET', 'produtos_view', 'acao_lotes_listar'],

    // A permissão de entrada ou saída é conferida lá dentro, conforme o tipo.
    'movimentar' => ['POST', 'login', 'acao_movimentar'],
    'venda' => ['POST', 'saida', 'acao_venda'],
    'movimentacoes.desde' => ['GET', 'login', 'acao_movimentacoes_desde'],
    'saidas.consumo' => ['GET', 'controle', 'acao_saidas_consumo'],
    'saidas.listar' => ['GET', 'historico', 'acao_saidas_listar'],
    'historico.listar' => ['GET', 'historico', 'acao_historico_listar'],

    'configuracoes.obter' => ['GET', 'login', 'acao_configuracoes_obter'],
    'configuracoes.atualizar' => ['POST', 'config', 'acao_configuracoes_atualizar'],
    'compras.sugerir' => ['GET', 'compras', 'acao_compras_sugerir'],
    'compras.listas' => ['GET', 'compras', 'acao_compras_listas'],
    'compras.criar' => ['POST', 'compras_edit', 'acao_compras_criar'],
    'compras.status' => ['POST', 'compras_edit', 'acao_compras_status'],
    'compras.receber' => ['POST', 'compras_edit', 'acao_compras_receber'],
    'compras.fornecedor' => ['POST', 'compras_edit', 'acao_compras_fornecedor'],
    'compras.enviar_fornecedor' => ['POST', 'compras_edit', 'acao_compras_enviar_fornecedor'],
    // Quantidades para quem vê compras; custos e gastos só voltam para quem tem 'financeiro'.
    'planejamento.projecao' => ['GET', 'compras', 'acao_planejamento_projecao'],

    'fornecedores.listar' => ['GET', 'compras', 'acao_fornecedores_listar'],
    'fornecedores.salvar' => ['POST', 'compras_edit', 'acao_fornecedores_salvar'],
    'fornecedores.excluir' => ['POST', 'compras_edit', 'acao_fornecedores_excluir'],

    // Cotação mostra preços de compra: só quem vê custos.
    'cotacoes.listar' => ['GET', 'financeiro', 'acao_cotacoes_listar'],
    'cotacoes.criar' => ['POST', 'financeiro', 'acao_cotacoes_criar'],
    'cotacoes.reenviar' => ['POST', 'financeiro', 'acao_cotacoes_reenviar'],
    'cotacoes.precos' => ['POST', 'financeiro', 'acao_cotacoes_precos'],
    'cotacoes.concluir' => ['POST', 'financeiro', 'acao_cotacoes_concluir'],
    'cotacoes.cancelar' => ['POST', 'financeiro', 'acao_cotacoes_cancelar'],

    'financeiro.analise' => ['GET', 'financeiro', 'acao_financeiro_analise'],
    'envios.config' => ['GET', 'financeiro', 'acao_envios_config'],
    'envios.previa' => ['GET', 'financeiro', 'acao_envios_previa'],
    'envios.smtp_salvar' => ['POST', 'financeiro', 'acao_envios_smtp_salvar'],
    'envios.testar' => ['POST', 'financeiro', 'acao_envios_testar'],
    'envios.programacao_salvar' => ['POST', 'financeiro', 'acao_envios_programacao_salvar'],
    'envios.programacao_excluir' => ['POST', 'financeiro', 'acao_envios_programacao_excluir'],
    'envios.enviar_agora' => ['POST', 'financeiro', 'acao_envios_enviar_agora'],
    // Qualquer tela dispara os envios vencidos; a resposta não traz o conteúdo.
    'envios.verificar' => ['POST', 'login', 'acao_envios_verificar'],
];

function responder(array $corpo, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE);
}

try {
    $rota = ROTAS[$_GET['acao'] ?? ''] ?? null;
    if (!$rota) {
        falhar('Ação desconhecida.', 404);
    }
    [$metodo, $permissao, $funcao] = $rota;
    if ($_SERVER['REQUEST_METHOD'] !== $metodo) {
        falhar('Método não permitido.', 405);
    }

    iniciar_sessao();
    $dados = $_GET;
    if ($metodo === 'POST') {
        // Outro site não consegue enviar este cabeçalho, o que barra pedidos forjados.
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'auxiliar-odont') {
            falhar('Requisição recusada.', 403);
        }
        $dados = json_decode(file_get_contents('php://input') ?: '{}', true);
        if (!is_array($dados)) {
            falhar('Dados inválidos.');
        }
    }
    if ($permissao !== null) {
        exigir($permissao);
        if ($metodo === 'GET') {
            session_write_close();
        }
    }
    responder(['ok' => true, 'dados' => $funcao($dados)]);
} catch (ErroApi $e) {
    responder(['ok' => false, 'erro' => $e->getMessage()], $e->getCode() ?: 400);
} catch (Throwable $e) {
    error_log('Auxiliar Odont: ' . $e);
    responder(['ok' => false, 'erro' => 'Erro interno no servidor. Tente de novo; se continuar, avise o administrador.'], 500);
}
