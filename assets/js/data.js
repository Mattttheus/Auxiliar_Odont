// Camada de acesso a dados (substitui as queries SQL do MySQL por Supabase/Postgres).
import { supabase } from "./supabase-init.js";

// ---------- PRODUTOS ----------
export async function listProdutos() {
    const { data, error } = await supabase.from("produtos").select("*").order("nome");
    if (error) throw error;
    return data;
}

export async function getProduto(id) {
    const { data, error } = await supabase.from("produtos").select("*").eq("id", id).single();
    if (error) return null;
    return data;
}

export async function getProdutoByCodigoBarras(codigo) {
    const { data, error } = await supabase.from("produtos").select("*").eq("codigo_barras", codigo).maybeSingle();
    if (error) throw error;
    return data;
}

export async function createProduto(data) {
    const { error } = await supabase.from("produtos").insert(data);
    if (error) throw error;
}

export async function updateProduto(id, data) {
    const { error } = await supabase
        .from("produtos")
        .update({ ...data, atualizado_em: new Date().toISOString() })
        .eq("id", id);
    if (error) throw error;
}

export async function deleteProduto(id) {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) throw error;
}

// ---------- ENTRADA / SAÍDA ----------
/** Erro de schema/função ausente: a migração v3 ainda não foi aplicada no Supabase. */
export function isMigracaoPendente(err) {
    const codigos = ["PGRST202", "PGRST204", "PGRST205", "42P01", "42703", "42883"];
    return !!err && (codigos.includes(err.code) || /schema cache|does not exist/i.test(err.message || ""));
}

export const MSG_MIGRACAO_V3 =
    "Esta função depende da migração v3 do banco. Execute legacy-php/database/supabase_migration_v3_relatorio_final.sql no SQL Editor do Supabase.";

/**
 * Registra uma entrada ou saída de forma transacional no banco (RPC), incluindo
 * lote/validade (entrada), baixa FEFO de lotes (saída) e histórico.
 * Se a migração v3 ainda não foi aplicada, cai no fluxo antigo feito pelo navegador.
 */
export async function registrarMovimentacao({ produto, tipo, quantidade, observacao = "", lote = null, validade = null, origem = "manual", user }) {
    const { data, error } = await supabase.rpc("registrar_movimentacao", {
        p_produto_id: produto.id,
        p_tipo: tipo,
        p_quantidade: Number(quantidade),
        p_observacao: observacao || "",
        p_lote: lote || null,
        p_validade: validade || null,
        p_origem: origem
    });
    if (!error) return data;
    if (!isMigracaoPendente(error)) throw error;
    return tipo === "entrada"
        ? registrarEntradaLegado(produto, quantidade, observacao, user)
        : registrarSaidaLegado(produto, quantidade, observacao, user);
}

export function registrarEntrada(produto, quantidade, observacao, user, extras = {}) {
    return registrarMovimentacao({ produto, tipo: "entrada", quantidade, observacao, user, ...extras });
}

export function registrarSaida(produto, quantidade, observacao, user, extras = {}) {
    return registrarMovimentacao({ produto, tipo: "saida", quantidade, observacao, user, ...extras });
}

/** Finaliza uma venda do PDV numa única transação (tudo ou nada). */
export async function registrarVenda(itens, produtosCache, user) {
    const { error } = await supabase.rpc("registrar_venda", {
        p_itens: itens.map(i => ({ produto_id: i.produtoId, quantidade: i.quantidade }))
    });
    if (!error) return;
    if (!isMigracaoPendente(error)) throw error;
    for (const item of itens) {
        const produto = produtosCache.find(p => String(p.id) === String(item.produtoId));
        await registrarSaidaLegado(produto, item.quantidade, "Venda via Caixa (PDV)", user);
    }
}

async function registrarEntradaLegado(produto, quantidade, observacao, user) {
    const novoEstoque = Number(produto.quantidade || 0) + Number(quantidade);
    await updateProduto(produto.id, { quantidade: novoEstoque });

    const { error: e1 } = await supabase.from("entradas_produtos").insert({
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: Number(quantidade),
        usuario_id: user.uid,
        usuario_nome: user.nome,
        observacao: observacao || ""
    });
    if (e1) throw e1;

    const { error: e2 } = await supabase.from("historico").insert({
        usuario_id: user.uid,
        usuario_nome: user.nome,
        produto_id: produto.id,
        produto_nome: produto.nome,
        acao: "Entrada",
        descricao: `Entrada de ${quantidade} unidade(s)`
    });
    if (e2) throw e2;
    return novoEstoque;
}

async function registrarSaidaLegado(produto, quantidade, observacao, user) {
    const qtd = Number(quantidade);
    if (qtd > Number(produto.quantidade || 0)) {
        throw new Error(`Estoque insuficiente! Disponível: ${produto.quantidade}`);
    }
    const novoEstoque = Number(produto.quantidade || 0) - qtd;
    await updateProduto(produto.id, { quantidade: novoEstoque });

    const { error: e1 } = await supabase.from("saidas_produtos").insert({
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: qtd,
        usuario_id: user.uid,
        usuario_nome: user.nome,
        observacao: observacao || ""
    });
    if (e1) throw e1;

    const { error: e2 } = await supabase.from("historico").insert({
        usuario_id: user.uid,
        usuario_nome: user.nome,
        produto_id: produto.id,
        produto_nome: produto.nome,
        acao: "Saída",
        descricao: `Saída de ${qtd} unidade(s)`
    });
    if (e2) throw e2;
    return novoEstoque;
}

// ---------- LOTES ----------
/** Lotes com saldo de um produto, do que vence primeiro ao último. Vazio se a migração v3 não rodou. */
export async function listLotes(produtoId) {
    const { data, error } = await supabase.from("lotes").select("*")
        .eq("produto_id", produtoId).gt("quantidade", 0)
        .order("validade", { ascending: true, nullsFirst: false });
    if (error) { if (isMigracaoPendente(error)) return []; throw error; }
    return data;
}

// ---------- MOVIMENTAÇÕES (análise) ----------
/** Entradas e saídas a partir de uma data, normalizadas num único formato. */
export async function listMovimentacoesDesde(dataInicio) {
    const iso = dataInicio.toISOString();
    const [ent, sai] = await Promise.all([
        supabase.from("entradas_produtos").select("produto_id, produto_nome, quantidade, data_entrada").gte("data_entrada", iso),
        supabase.from("saidas_produtos").select("produto_id, produto_nome, quantidade, data_saida").gte("data_saida", iso)
    ]);
    if (ent.error) throw ent.error;
    if (sai.error) throw sai.error;
    return [
        ...ent.data.map(e => ({ tipo: "entrada", produtoId: e.produto_id, produtoNome: e.produto_nome, quantidade: e.quantidade, data: e.data_entrada })),
        ...sai.data.map(s => ({ tipo: "saida", produtoId: s.produto_id, produtoNome: s.produto_nome, quantidade: s.quantidade, data: s.data_saida }))
    ];
}

// ---------- CONFIGURAÇÕES ----------
export const CONFIG_PADRAO = { dias_alerta_validade: 30, janela_consumo_dias: 90, dias_cobertura: 30, dias_reposicao: 7 };

/** Critérios de alerta/reposição. Usa os valores padrão se a migração v3 não rodou. */
export async function getConfiguracoes() {
    const { data, error } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();
    if (error) { if (isMigracaoPendente(error)) return { ...CONFIG_PADRAO }; throw error; }
    return { ...CONFIG_PADRAO, ...(data || {}) };
}

export async function updateConfiguracoes(valores) {
    const { error } = await supabase.from("configuracoes")
        .update({ ...valores, atualizado_em: new Date().toISOString() }).eq("id", 1);
    if (error) throw error;
}

// ---------- LISTA DE COMPRAS ----------
export async function sugerirListaCompras() {
    const { data, error } = await supabase.rpc("sugerir_lista_compras");
    if (error) throw error;
    return data;
}

export async function listListasCompra() {
    const { data, error } = await supabase.from("listas_compra")
        .select("*, itens:listas_compra_itens(*)")
        .order("criado_em", { ascending: false });
    if (error) throw error;
    return data;
}

export async function createListaCompra({ titulo, observacao, itens }, user) {
    const { data: lista, error } = await supabase.from("listas_compra")
        .insert({ titulo, observacao: observacao || null, criado_por: user.uid, criado_por_nome: user.nome })
        .select().single();
    if (error) throw error;
    const { error: e2 } = await supabase.from("listas_compra_itens").insert(itens.map(i => ({
        lista_id: lista.id,
        produto_id: i.produto_id,
        produto_nome: i.nome,
        unidade: i.unidade || null,
        quantidade_sugerida: i.quantidade_sugerida || 0,
        quantidade: i.quantidade,
        motivo: i.motivo || null
    })));
    if (e2) {
        await supabase.from("listas_compra").delete().eq("id", lista.id);
        throw e2;
    }
    return lista;
}

export async function updateStatusListaCompra(id, status) {
    const { error } = await supabase.from("listas_compra")
        .update({ status, atualizado_em: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
}

export async function receberListaCompra(id) {
    const { data, error } = await supabase.rpc("receber_lista_compra", { p_lista_id: id });
    if (error) throw error;
    return data;
}

// ---------- HISTÓRICO ----------
export async function listHistorico() {
    const { data, error } = await supabase.from("historico").select("*").order("data_acao", { ascending: false });
    if (error) throw error;
    return data.map(h => ({
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
    const { data, error } = await supabase.from("saidas_produtos").select("*").order("data_saida", { ascending: false });
    if (error) throw error;
    return data.map(s => ({
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
    const { data, error } = await supabase.from("usuarios").select("*").order("criado_em", { ascending: false });
    if (error) throw error;
    return data.map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        ativo: u.ativo,
        criadoEm: u.criado_em
    }));
}

export async function countUsuarios() {
    const { count, error } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
    if (error) throw error;
    return count || 0;
}

export async function createUsuarioProfile(uid, data) {
    const { error } = await supabase.from("usuarios").insert({ id: uid, ...data });
    if (error) throw error;
}

export async function updateUsuario(id, data) {
    const { error } = await supabase.from("usuarios").update(data).eq("id", id);
    if (error) throw error;
}

export async function deleteUsuarioProfile(id) {
    const { error } = await supabase.from("usuarios").delete().eq("id", id);
    if (error) throw error;
}
