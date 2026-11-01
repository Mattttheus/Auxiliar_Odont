// Autenticação e perfil do usuário: a sessão fica no servidor (api/modulos/contas.php).
import { apiGet, apiPost, CHAVE_AVISO } from "./api.js";

let currentUser = null; // { uid, nome, email, role, ativo, perfilSolicitado }

/** Mensagem deixada para a tela de login. Com ela, o login não redireciona de volta. */
export function lerAviso() {
    const aviso = sessionStorage.getItem(CHAVE_AVISO);
    sessionStorage.removeItem(CHAVE_AVISO);
    return aviso;
}

function irParaLogin(aviso) {
    if (aviso) sessionStorage.setItem(CHAVE_AVISO, aviso);
    window.location.href = "index.html";
    return null;
}

/** Garante que existe um usuário ativo; senão redireciona para o login. */
export async function requireAuth() {
    try {
        const { usuario, aviso } = await apiGet("sessao");
        if (!usuario) return irParaLogin(aviso);
        currentUser = usuario;
        return usuario;
    } catch (err) {
        console.error(err);
        return irParaLogin(err.message);
    }
}

/** Garante que o usuário autenticado é admin; senão redireciona para o dashboard. */
export async function requireAdmin() {
    const user = await requireAuth();
    if (user && user.role !== "admin") {
        window.location.href = "dashboard.html";
        return null;
    }
    return user;
}

export function getCurrentUser() {
    return currentUser;
}

export async function logout() {
    try {
        await apiPost("sair");
    } finally {
        window.location.href = "index.html";
    }
}
