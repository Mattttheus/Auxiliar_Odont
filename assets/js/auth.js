// Autenticação e perfil do usuário (substitui sessões PHP por Supabase Auth + Postgres).
import { supabase } from "./supabase-init.js";

let currentUser = null; // { uid, nome, email, role, ativo }

function readCache() {
    try { return JSON.parse(sessionStorage.getItem("auxiliarOdontUser") || "null"); }
    catch { return null; }
}

function writeCache(user) {
    sessionStorage.setItem("auxiliarOdontUser", JSON.stringify(user));
}

async function loadProfile(authUser) {
    const { data, error } = await supabase.from("usuarios").select("*").eq("id", authUser.id).single();
    if (error || !data) return null;
    return { uid: authUser.id, nome: data.nome, email: data.email, role: data.role, ativo: data.ativo };
}

/** Resolve quando o estado de autenticação do Supabase é conhecido. */
async function waitForAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { currentUser = null; sessionStorage.removeItem("auxiliarOdontUser"); return null; }

    const profile = await loadProfile(session.user);
    currentUser = profile;
    if (profile) writeCache(profile);
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
