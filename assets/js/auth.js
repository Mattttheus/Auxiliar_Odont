// Autenticação e perfil do usuário (substitui sessões PHP por Supabase Auth + Postgres).
import { supabase } from "./supabase-init.js";
import { createUsuarioProfile, criarPerfilPendente, sistemaSemUsuarios } from "./data.js";
import { PERFIS_SOLICITAVEIS } from "./validacao.js";

let currentUser = null; // { uid, nome, email, role, ativo, perfilSolicitado }

const CHAVE_AVISO = "auxiliarOdontAviso";

function readCache() {
    try { return JSON.parse(sessionStorage.getItem("auxiliarOdontUser") || "null"); }
    catch { return null; }
}

function writeCache(user) {
    sessionStorage.setItem("auxiliarOdontUser", JSON.stringify(user));
}

async function loadProfile(authUser) {
    const { data, error } = await supabase.from("usuarios").select("*").eq("id", authUser.id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { uid: authUser.id, nome: data.nome, email: data.email, role: data.role, ativo: data.ativo, perfilSolicitado: data.perfil_solicitado || null };
}

/**
 * Perfil do usuário autenticado. Se ainda não existir (cadastro com "Confirm email" ligado,
 * em que não havia sessão para criá-lo), cria agora: o primeiro usuário do sistema vira
 * admin, e todos os outros ficam inativos até um admin aprovar.
 */
export async function garantirPerfil(authUser) {
    const perfil = await loadProfile(authUser);
    if (perfil) return perfil;

    const meta = authUser.user_metadata || {};
    const dados = {
        nome: meta.nome || authUser.email.split("@")[0],
        email: authUser.email,
        telefone: meta.telefone || null
    };
    if (await sistemaSemUsuarios()) {
        await createUsuarioProfile(authUser.id, { ...dados, role: "admin", ativo: true });
    } else {
        await criarPerfilPendente(authUser.id, {
            ...dados,
            perfil_solicitado: PERFIS_SOLICITAVEIS.includes(meta.perfil_solicitado) ? meta.perfil_solicitado : "comum"
        });
    }
    return loadProfile(authUser);
}

export function motivoBloqueio(perfil) {
    return perfil.perfilSolicitado
        ? "Seu cadastro foi recebido e está aguardando a aprovação de um administrador."
        : "Usuário desativado. Contate um administrador.";
}

/** Mensagem deixada para a tela de login. Com ela, o login não redireciona de volta. */
export function lerAviso() {
    const aviso = sessionStorage.getItem(CHAVE_AVISO);
    sessionStorage.removeItem(CHAVE_AVISO);
    return aviso;
}

async function encerrarAcesso(aviso) {
    sessionStorage.setItem(CHAVE_AVISO, aviso);
    sessionStorage.removeItem("auxiliarOdontUser");
    currentUser = null;
    await supabase.auth.signOut();
    return null;
}

/** Resolve quando o estado de autenticação do Supabase é conhecido. */
async function waitForAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { currentUser = null; sessionStorage.removeItem("auxiliarOdontUser"); return null; }

    let profile;
    try {
        profile = await garantirPerfil(session.user);
    } catch (err) {
        console.error(err);
        return encerrarAcesso("Não foi possível carregar seu perfil. Tente entrar novamente; se continuar, avise o administrador.");
    }
    // Conta desativada por um admin perde o acesso na próxima página, mesmo com a sessão aberta.
    if (profile.ativo === false) return encerrarAcesso(motivoBloqueio(profile));

    currentUser = profile;
    writeCache(profile);
    return profile;
}

/** Garante que existe um usuário autenticado; senão redireciona para o login. */
export async function requireAuth() {
    const cached = readCache();
    if (cached) currentUser = cached; // exibe UI imediatamente, sem "piscar"
    const user = await waitForAuth();
    if (!user) {
        window.location.href = "index.html";
        return null;
    }
    return user;
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
    return currentUser || readCache();
}

export async function logout() {
    await supabase.auth.signOut();
    window.location.href = "index.html";
}
