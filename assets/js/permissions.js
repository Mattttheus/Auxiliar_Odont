// Definição dos níveis de acesso e permissões por perfil de usuário.
import { requireAuth } from "./auth.js";

// A chave é o valor gravado no banco: "vendedor" continua sendo o valor interno do nível
// Caixa, porque as políticas de segurança e as funções do banco usam esse nome.
export const ROLES = {
    admin: { label: "Administrador", badge: "bg-danger" },
    dentista: { label: "Cirurgião-dentista", badge: "bg-info text-dark" },
    estoquista: { label: "Estoquista", badge: "bg-primary" },
    vendedor: { label: "Caixa", badge: "bg-success" },
    comum: { label: "Usuário comum", badge: "bg-light text-dark border" }
};

// Matriz de permissões: cada ação liberada por perfil.
// compras: ver sugestões e listas de compra; compras_edit: salvar/receber listas;
// etiquetas: gerar e imprimir etiquetas QR; config: critérios de alerta e reposição;
// controle: painel do administrador (curva ABC e controle de acesso).
const PERMISSIONS = {
    admin: { produtos_view: true, produtos_edit: true, entrada: true, saida: true, historico: true, usuarios: true, compras: true, compras_edit: true, etiquetas: true, config: true, controle: true },
    estoquista: { produtos_view: true, produtos_edit: true, entrada: true, saida: true, historico: true, usuarios: false, compras: true, compras_edit: true, etiquetas: true, config: false, controle: false },
    vendedor: { produtos_view: true, produtos_edit: false, entrada: false, saida: true, historico: true, usuarios: false, compras: false, compras_edit: false, etiquetas: false, config: false, controle: false },
    dentista: { produtos_view: true, produtos_edit: false, entrada: false, saida: false, historico: true, usuarios: false, compras: true, compras_edit: false, etiquetas: false, config: false, controle: false },
    comum: { produtos_view: true, produtos_edit: false, entrada: false, saida: false, historico: false, usuarios: false, compras: false, compras_edit: false, etiquetas: false, config: false, controle: false }
};

// Descrição de cada permissão, na ordem exibida no controle de acesso.
export const PERMISSOES = [
    ["produtos_view", "Ver produtos"],
    ["produtos_edit", "Cadastrar e editar produtos"],
    ["entrada", "Registrar entradas"],
    ["saida", "Registrar saídas e vendas"],
    ["historico", "Ver histórico"],
    ["compras", "Ver lista de compras"],
    ["compras_edit", "Salvar e receber listas de compra"],
    ["etiquetas", "Gerar etiquetas QR"],
    ["config", "Alterar critérios de alerta e reposição"],
    ["usuarios", "Gerenciar usuários"],
    ["controle", "Curva ABC e controle de acesso"]
];

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
