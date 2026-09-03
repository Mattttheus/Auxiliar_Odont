// Camada de acesso a dados (substitui as queries SQL do MySQL por Firestore).
import {
    db, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp
} from "./firebase-init.js";

const produtosCol = collection(db, "produtos");
const usuariosCol = collection(db, "usuarios");
const entradasCol = collection(db, "entradas_produtos");
const saidasCol = collection(db, "saidas_produtos");
const historicoCol = collection(db, "historico");

function toArray(snap) {
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---------- PRODUTOS ----------
export async function listProdutos() {
    const snap = await getDocs(query(produtosCol, orderBy("nome")));
    return toArray(snap);
}

export async function getProduto(id) {
    const snap = await getDoc(doc(db, "produtos", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createProduto(data) {
    return addDoc(produtosCol, {
        ...data,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
    });
}

export async function updateProduto(id, data) {
    return updateDoc(doc(db, "produtos", id), { ...data, atualizadoEm: serverTimestamp() });
}

export async function deleteProduto(id) {
    return deleteDoc(doc(db, "produtos", id));
}

// ---------- ENTRADA / SAÍDA ----------
export async function registrarEntrada(produto, quantidade, observacao, user) {
    const novoEstoque = Number(produto.quantidade || 0) + Number(quantidade);
    await updateProduto(produto.id, { quantidade: novoEstoque });
    await addDoc(entradasCol, {
        produtoId: produto.id,
        produtoNome: produto.nome,
        quantidade: Number(quantidade),
        usuarioId: user.uid,
        usuarioNome: user.nome,
        observacao: observacao || "",
        dataEntrada: serverTimestamp()
    });
    await addDoc(historicoCol, {
        usuarioId: user.uid,
        usuarioNome: user.nome,
        produtoId: produto.id,
        produtoNome: produto.nome,
        acao: "Entrada",
        descricao: `Entrada de ${quantidade} unidade(s)`,
        dataAcao: serverTimestamp()
    });
}

export async function registrarSaida(produto, quantidade, observacao, user) {
    const qtd = Number(quantidade);
    if (qtd > Number(produto.quantidade || 0)) {
        throw new Error(`Estoque insuficiente! Disponível: ${produto.quantidade}`);
    }
    const novoEstoque = Number(produto.quantidade || 0) - qtd;
    await updateProduto(produto.id, { quantidade: novoEstoque });
    await addDoc(saidasCol, {
        produtoId: produto.id,
        produtoNome: produto.nome,
        quantidade: qtd,
        usuarioId: user.uid,
        usuarioNome: user.nome,
        observacao: observacao || "",
        dataSaida: serverTimestamp()
    });
    await addDoc(historicoCol, {
        usuarioId: user.uid,
        usuarioNome: user.nome,
        produtoId: produto.id,
        produtoNome: produto.nome,
        acao: "Saída",
        descricao: `Saída de ${qtd} unidade(s)`,
        dataAcao: serverTimestamp()
    });
}

// ---------- HISTÓRICO ----------
export async function listHistorico() {
    const snap = await getDocs(query(historicoCol, orderBy("dataAcao", "desc")));
    return toArray(snap);
}

export async function listSaidas() {
    const snap = await getDocs(query(saidasCol, orderBy("dataSaida", "desc")));
    return toArray(snap);
}

// ---------- USUÁRIOS ----------
export async function listUsuarios() {
    const snap = await getDocs(query(usuariosCol, orderBy("criadoEm", "desc")));
    return toArray(snap);
}

export async function countUsuarios() {
    const snap = await getDocs(usuariosCol);
    return snap.size;
}

export async function createUsuarioProfile(uid, data) {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    return setDoc(doc(db, "usuarios", uid), { ...data, criadoEm: serverTimestamp() });
}

export async function updateUsuario(id, data) {
    return updateDoc(doc(db, "usuarios", id), data);
}

export async function deleteUsuarioProfile(id) {
    return deleteDoc(doc(db, "usuarios", id));
}
