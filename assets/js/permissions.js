// Definição dos níveis de acesso e permissões por perfil de usuário.
import { requireAuth } from "./auth.js";

export const ROLES = {
    admin: { label: "Administrador", badge: "bg-danger" },
    estoquista: { label: "Estoquista", badge: "bg-primary" },
    vendedor: { label: "Vendedor", badge: "bg-success" },
    dentista: { label: "Dentista (Dr./Dra.)", badge: "bg-info text-dark" }
};

// Matriz de permissões: cada ação liberada por perfil.
// compras: ver sugestões e listas de compra; compras_edit: salvar/receber listas;
// etiquetas: gerar e imprimir etiquetas QR; config: critérios de alerta e reposição.
const PERMISSIONS = {
    admin: { produtos_view: true, produtos_edit: true, entrada: true, saida: true, historico: true, usuarios: true, compras: true, compras_edit: true, etiquetas: true, config: true },
    estoquista: { produtos_view: true, produtos_edit: true, entrada: true, saida: true, historico: true, usuarios: false, compras: true, compras_edit: true, etiquetas: true, config: false },
    vendedor: { produtos_view: true, produtos_edit: false, entrada: false, saida: true, historico: true, usuarios: false, compras: false, compras_edit: false, etiquetas: false, config: false },
    dentista: { produtos_view: true, produtos_edit: false, entrada: false, saida: false, historico: true, usuarios: false, compras: true, compras_edit: false, etiquetas: false, config: false }
};

export function can(user, action) {
    if (!user) return false;
    if (action === "movimentar") return can(user, "entrada") || can(user, "saida");
    const perfil = PERMISSIONS[user.role];
    return !!(perfil && perfil[action]);
}

export function roleLabel(role) {
    return ROLES[role]?.label || role;
}

export function roleBadgeClass(role) {
    return ROLES[role]?.badge || "bg-secondary";
}

/** Garante autenticação e uma permissão específica; senão redireciona para o dashboard. */
export async function requirePermission(action) {
    const user = await requireAuth();
    if (user && !can(user, action)) {
        window.location.href = "dashboard.html";
        return null;
    }
    return user;
}
