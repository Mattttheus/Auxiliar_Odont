// Camada de acesso a dados: cada função chama uma ação da API local (api/index.php).
import { apiGet, apiPost } from "./api.js";

// ---------- PRODUTOS ----------
export const listProdutos = () => apiGet("produtos.listar");
export const getProduto = (id) => apiGet("produtos.obter", { id });
export const getProdutoByCodigoBarras = (codigo) => apiGet("produtos.por_codigo", { codigo });
export const createProduto = (data) => apiPost("produtos.criar", data);
export const updateProduto = (id, data) => apiPost("produtos.atualizar", { ...data, id });
export const deleteProduto = (id) => apiPost("produtos.excluir", { id });

/** Lógica da planilha: quantidade = estoque inicial + entradas - saídas (e ajustes). */
export const conferirSaldos = () => apiGet("produtos.conferencia");

// ---------- ENTRADA / SAÍDA ----------
/**
 * Registra uma entrada ou saída numa transação e devolve o novo estoque. Na entrada, o
 * fornecedor é opcional e o custo unitário só é aceito do administrador.
 */
export async function registrarMovimentacao({ produto, tipo, quantidade, observacao = "", lote = null, validade = null, origem = "manual", fornecedorId = null, custoUnitario = null }) {
    const { estoque } = await apiPost("movimentar", {
        produto_id: produto.id,
        tipo,
        quantidade: Number(quantidade),
        observacao,
        lote,
        validade: validade || null,
        origem,
        fornecedor_id: fornecedorId || null,
        custo_unitario: custoUnitario === "" ? null : custoUnitario
    });
    return estoque;
}

export function registrarEntrada(produto, quantidade, observacao, extras = {}) {
    return registrarMovimentacao({ produto, tipo: "entrada", quantidade, observacao, ...extras });
}

export function registrarSaida(produto, quantidade, observacao, extras = {}) {
    return registrarMovimentacao({ produto, tipo: "saida", quantidade, observacao, ...extras });
}

/** Finaliza uma venda do Caixa numa única transação: sai tudo, ou nada. */
export function registrarVenda(itens) {
    return apiPost("venda", { itens: itens.map(i => ({ produto_id: i.produtoId, quantidade: i.quantidade })) });
}

// ---------- LOTES ----------
/** Lotes com saldo de um produto, do que vence primeiro ao último. */
export const listLotes = (produtoId) => apiGet("lotes.listar", { produto_id: produtoId });

// ---------- MOVIMENTAÇÕES (análise) ----------
/** Entradas e saídas a partir de uma data, normalizadas num único formato. */
export async function listMovimentacoesDesde(dataInicio) {
    const { entradas, saidas } = await apiGet("movimentacoes.desde", { desde: dataInicio.toISOString() });
    return [
        ...entradas.map(e => ({ tipo: "entrada", produtoId: e.produto_id, produtoNome: e.produto_nome, quantidade: e.quantidade, data: e.data_entrada })),
        ...saidas.map(s => ({ tipo: "saida", produtoId: s.produto_id, produtoNome: s.produto_nome, quantidade: s.quantidade, data: s.data_saida }))
    ];
}

/** Saídas a partir de uma data (ou todas, se null), para a curva ABC. */
export const listSaidasConsumo = (dataInicio = null) => apiGet("saidas.consumo", { desde: dataInicio ? dataInicio.toISOString() : null });

// ---------- CONFIGURAÇÕES ----------
export const getConfiguracoes = () => apiGet("configuracoes.obter");
export const updateConfiguracoes = (valores) => apiPost("configuracoes.atualizar", valores);

// ---------- LISTA DE COMPRAS ----------
export const sugerirListaCompras = () => apiGet("compras.sugerir");
export const listListasCompra = () => apiGet("compras.listas");
export const updateStatusListaCompra = (id, status) => apiPost("compras.status", { id, status });
/** precos: { id do item: custo unitário } — só o administrador informa. */
export const receberListaCompra = async (id, precos = null) => (await apiPost("compras.receber", { id, precos })).itens;
export const definirFornecedorLista = (id, fornecedorId) => apiPost("compras.fornecedor", { id, fornecedor_id: fornecedorId || null });
export const enviarListaAoFornecedor = async (id) => (await apiPost("compras.enviar_fornecedor", { id })).email;

export function createListaCompra({ titulo, observacao, itens, fornecedorId = null }) {
    return apiPost("compras.criar", {
        titulo,
        observacao: observacao || null,
        fornecedor_id: fornecedorId || null,
        itens: itens.map(i => ({
            produto_id: i.produto_id,
            quantidade: i.quantidade,
            quantidade_sugerida: i.quantidade_sugerida || 0,
            motivo: i.motivo || null
        }))
    });
}

// ---------- PLANEJAMENTO E FINANCEIRO ----------
/** Previsão de consumo, compras programadas e demonstrativo de 30, 60 e 90 dias. */
export const getPlanejamento = (base, ajuste = 0) => apiGet("planejamento.projecao", { base, ajuste });
/** Realizado e previsto por período: semanal, mensal, bimestral, trimestral ou semestral. */
export const getAnaliseFinanceira = (granularidade, base) => apiGet("financeiro.analise", { granularidade, base });
/** itens: [{ produto_id, custo }] — custo vazio apaga. */
export const salvarCustos = async (itens) => (await apiPost("produtos.custos", { itens })).alterados;

// ---------- FORNECEDORES ----------
export const listFornecedores = () => apiGet("fornecedores.listar");
export const salvarFornecedor = (dados) => apiPost("fornecedores.salvar", dados);
export const excluirFornecedor = (id) => apiPost("fornecedores.excluir", { id });

// ---------- COTAÇÕES ----------
export const listCotacoes = () => apiGet("cotacoes.listar");
/** fornecedores vazio = todos os ativos com e-mail. */
export const criarCotacao = (dados) => apiPost("cotacoes.criar", dados);
export const reenviarCotacao = (id, fornecedorId = null) => apiPost("cotacoes.reenviar", { id, fornecedor_id: fornecedorId });
export const salvarPrecosCotacao = (id, precos, prazos, escolhas) => apiPost("cotacoes.precos", { id, precos, prazos, escolhas });
export const concluirCotacao = (id) => apiPost("cotacoes.concluir", { id });
export const cancelarCotacao = (id) => apiPost("cotacoes.cancelar", { id });

// ---------- E-MAILS ----------
export const getConfigEnvios = () => apiGet("envios.config");
export const getPreviaEnvio = (tipo, frequencia, incluirValores, cotarFornecedores) =>
    apiGet("envios.previa", { tipo, frequencia, incluir_valores: incluirValores ? 1 : 0, cotar_fornecedores: cotarFornecedores ? 1 : 0 });
export const salvarSmtp = (dados) => apiPost("envios.smtp_salvar", dados);
export const testarEmail = (email) => apiPost("envios.testar", { email });
export const salvarProgramacao = (dados) => apiPost("envios.programacao_salvar", dados);
export const excluirProgramacao = (id) => apiPost("envios.programacao_excluir", { id });
export const enviarProgramacaoAgora = (id) => apiPost("envios.enviar_agora", { id });
/** Dispara os envios vencidos; chamado pelo menu em todas as telas. */
export const verificarEnvios = () => apiPost("envios.verificar");

// ---------- HISTÓRICO ----------
export async function listHistorico() {
    const linhas = await apiGet("historico.listar");
    return linhas.map(h => ({
        id: h.id,
        usuarioNome: h.usuario_nome || "Usuário removido",
        produtoId: h.produto_id,
        produtoNome: h.produto_nome || "Produto removido",
        acao: h.acao,
        descricao: h.descricao,
        quantidade: h.quantidade ?? null,
        origem: h.origem || null,
        dataAcao: h.data_acao
    }));
}

export async function listSaidas() {
    const linhas = await apiGet("saidas.listar");
    return linhas.map(s => ({
        id: s.id,
        produtoNome: s.produto_nome,
        quantidade: s.quantidade,
        usuarioNome: s.usuario_nome || "Usuário removido",
        observacao: s.observacao,
        lote: s.lote || null,
        origem: s.origem || null,
        dataSaida: s.data_saida
    }));
}

// ---------- USUÁRIOS ----------
export async function listUsuarios() {
    const linhas = await apiGet("usuarios.listar");
    return linhas.map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone || "",
        role: u.role,
        ativo: u.ativo,
        perfilSolicitado: u.perfil_solicitado || null,
        criadoEm: u.criado_em
    }));
}

/** Cadastros públicos aguardando aprovação. */
export const contarCadastrosPendentes = async () => (await apiGet("usuarios.pendentes")).total;
export const createUsuario = (data) => apiPost("usuarios.criar", data);
export const updateUsuario = (id, data) => apiPost("usuarios.atualizar", { ...data, id });
export const excluirUsuario = (id) => apiPost("usuarios.excluir", { id });
/** Gera uma senha temporária para o admin entregar à pessoa: a rede local não envia e-mail. */
export const redefinirSenhaUsuario = async (id) => (await apiPost("usuarios.redefinir_senha", { id })).senha;
