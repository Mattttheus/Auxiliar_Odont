// Autenticação e perfil do usuário (substitui sessões PHP por Firebase Auth + Firestore).
import { auth, db, onAuthStateChanged, signOut, doc, getDoc } from "./firebase-init.js";

let currentUser = null; // { uid, nome, email, role, ativo }

function readCache() {
    try { return JSON.parse(sessionStorage.getItem("auxiliarOdontUser") || "null"); }
    catch { return null; }
}

function writeCache(user) {
    sessionStorage.setItem("auxiliarOdontUser", JSON.stringify(user));
}

/** Resolve quando o estado de autenticação do Firebase é conhecido. */
function waitForAuth() {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (fbUser) => {
            unsub();
            if (!fbUser) { currentUser = null; sessionStorage.removeItem("auxiliarOdontUser"); resolve(null); return; }

            const snap = await getDoc(doc(db, "usuarios", fbUser.uid));
            if (!snap.exists()) { currentUser = null; resolve(null); return; }

            currentUser = { uid: fbUser.uid, ...snap.data() };
            writeCache(currentUser);
            resolve(currentUser);
        });
    });
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
    await signOut(auth);
    sessionStorage.removeItem("auxiliarOdontUser");
    window.location.href = "index.html";
}
