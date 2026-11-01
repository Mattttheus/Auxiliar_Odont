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
/** Registra uma entrada ou saída numa transação e devolve o novo estoque. */
export async function registrarMovimentacao({ produto, tipo, quantidade, observacao = "", lote = null, validade = null, origem = "manual" }) {
    const { estoque } = await apiPost("movimentar", {
        produto_id: produto.id,
        tipo,
        quantidade: Number(quantidade),
        observacao,
        lote,
        validade: validade || null,
        origem
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
export const receberListaCompra = async (id) => (await apiPost("compras.receber", { id })).itens;

export function createListaCompra({ titulo, observacao, itens }) {
    return apiPost("compras.criar", {
        titulo,
        observacao: observacao || null,
        itens: itens.map(i => ({
            produto_id: i.produto_id,
            quantidade: i.quantidade,
            quantidade_sugerida: i.quantidade_sugerida || 0,
            motivo: i.motivo || null
        }))
    });
}

// ---------- HISTÓRICO ----------
export async function listHistorico() {
    const linhas = await apiGet("historico.listar");
    return linhas.map(h => ({
        id: h.id,
        usuarioNome: h.usuario_nome || "Usuário removido",
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
