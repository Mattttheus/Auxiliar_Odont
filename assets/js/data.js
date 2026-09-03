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
export async function registrarEntrada(produto, quantidade, observacao, user) {
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
}

export async function registrarSaida(produto, quantidade, observacao, user) {
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
