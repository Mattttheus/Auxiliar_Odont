// Gerenciamento de usuários (somente admin). Substitui pages/usuarios/*.php.
import { requireAdmin, getCurrentUser } from "./auth.js";
import { renderShell } from "./layout.js";
import { listUsuarios, updateUsuario, excluirUsuario, createUsuarioProfile } from "./data.js";
import { formatDateBR, escapeHtml } from "./utils.js";
import { supabase, criarClienteIsolado } from "./supabase-init.js";
import { SITE_URL } from "./supabase-config.js";
import { ROLES, roleLabel, roleBadgeClass } from "./permissions.js";
import {
    PERFIS_SOLICITAVEIS, normalizarNome, normalizarEmail, normalizarTelefone, formatarTelefone,
    validarNome, validarEmail, validarTelefone, validarSenha, validarConfirmacaoSenha,
    traduzirErroAuth, marcarCampo, ligarMascaraTelefone
} from "./validacao.js";

// Estas declarações precisam existir ANTES do bloco abaixo, que roda ainda durante o
// carregamento do módulo.
const CAMPOS_MODAL = ["usuarioNome", "usuarioEmail", "usuarioTelefone", "usuarioSenha", "usuarioSenhaConfirma"];
const estaPendente = (u) => u.ativo === false && !!u.perfilSolicitado;

let usuariosCache = [];

const user = await requireAdmin();
if (user) {
    renderShell("usuarios.html", user);
    // Os botões são registrados ANTES do carregamento da lista: se listUsuarios()
    // falhar (rede, RLS, schema desatualizado), a página não deve travar sem os
    // botões funcionarem — o erro real aparece em #msgContainer.
    document.getElementById("btnNovoUsuario").addEventListener("click", abrirModalNovoUsuario);
    document.getElementById("formUsuario").addEventListener("submit", salvarUsuario);
    document.getElementById("filtroBusca").addEventListener("input", renderTabela);
    document.getElementById("filtroPerfil").addEventListener("change", renderTabela);
    document.getElementById("filtroStatus").addEventListener("change", renderTabela);
    document.getElementById("filtroPerfil").innerHTML += Object.keys(ROLES)
        .map(r => `<option value="${r}">${roleLabel(r)}</option>`).join("");
    ligarMascaraTelefone("usuarioTelefone");
    try {
        await carregarUsuarios();
    } catch (err) {
        console.error(err);
        mensagem("Erro ao carregar usuários: " + escapeHtml(err.message), "danger");
    }
}

function mensagem(html, tipo = "success") {
    document.getElementById("msgContainer").innerHTML = html ? `<div class="alert alert-${tipo}">${html}</div>` : "";
}

async function carregarUsuarios() {
    usuariosCache = await listUsuarios();
    renderPendentes();
    renderTabela();
}

// ---------- CADASTROS AGUARDANDO APROVAÇÃO ----------
function renderPendentes() {
    const pendentes = usuariosCache.filter(estaPendente);
    document.getElementById("pendentesCard").classList.toggle("d-none", pendentes.length === 0);
    document.getElementById("qtdPendentes").textContent = pendentes.length;

    const tbody = document.getElementById("pendentesBody");
    tbody.innerHTML = pendentes.map(u => `
    <tr>
      <td>${escapeHtml(u.nome)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td class="text-nowrap">${escapeHtml(formatarTelefone(u.telefone)) || "-"}</td>
      <td>
        <select class="form-select form-select-sm sel-aprovar" data-id="${u.id}" aria-label="Perfil de ${escapeHtml(u.nome)}">
          ${PERFIS_SOLICITAVEIS.map(r => `<option value="${r}" ${r === u.perfilSolicitado ? "selected" : ""}>${roleLabel(r)}</option>`).join("")}
        </select>
      </td>
      <td>${formatDateBR(u.criadoEm)}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-success btn-aprovar" data-id="${u.id}"><i class="bi bi-check-lg"></i> Aprovar</button>
        <button class="btn btn-sm btn-outline-danger btn-recusar" data-id="${u.id}"><i class="bi bi-x-lg"></i> Recusar</button>
      </td>
    </tr>`).join("");

    tbody.querySelectorAll(".btn-aprovar").forEach(btn => btn.addEventListener("click", () => {
        aprovar(btn.dataset.id, tbody.querySelector(`.sel-aprovar[data-id="${btn.dataset.id}"]`).value);
    }));
    tbody.querySelectorAll(".btn-recusar").forEach(btn => btn.addEventListener("click", () => excluir(btn.dataset.id, "Recusar o cadastro de")));
}

async function aprovar(id, role) {
    const u = usuariosCache.find(x => x.id === id);
    try {
        await updateUsuario(id, { role, ativo: true, perfil_solicitado: null });
        mensagem(`Acesso de ${escapeHtml(u.nome)} aprovado como ${roleLabel(role)}.`);
        await carregarUsuarios();
    } catch (err) {
        console.error(err);
        mensagem("Erro ao aprovar: " + escapeHtml(err.message), "danger");
    }
}

// ---------- USUÁRIOS ----------
function usuariosFiltrados() {
    const busca = document.getElementById("filtroBusca").value.trim().toLowerCase();
    const buscaDigitos = busca.replace(/\D/g, "");
    const perfil = document.getElementById("filtroPerfil").value;
    const status = document.getElementById("filtroStatus").value;
    return usuariosCache.filter(u => {
        if (estaPendente(u)) return false;
        if (perfil && u.role !== perfil) return false;
        if (status === "ativo" && u.ativo === false) return false;
        if (status === "inativo" && u.ativo !== false) return false;
        return !busca
            || String(u.nome).toLowerCase().includes(busca)
            || String(u.email).toLowerCase().includes(busca)
            || (buscaDigitos && u.telefone.includes(buscaDigitos));
    });
}

function renderTabela() {
    const tbody = document.getElementById("usuariosTableBody");
    tbody.innerHTML = usuariosFiltrados().map(u => `
    <tr>
      <td>${escapeHtml(u.nome)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td class="text-nowrap">${escapeHtml(formatarTelefone(u.telefone)) || "-"}</td>
      <td><span class="badge ${roleBadgeClass(u.role)}">${roleLabel(u.role)}</span></td>
      <td>${u.ativo === false ? '<span class="badge bg-secondary">Inativo</span>' : '<span class="badge bg-success">Ativo</span>'}</td>
      <td>${formatDateBR(u.criadoEm)}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-primary btn-editar" data-id="${u.id}" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-secondary btn-reset" data-id="${u.id}" title="Enviar redefinição de senha"><i class="bi bi-key"></i></button>
        <button class="btn btn-sm btn-danger btn-excluir" data-id="${u.id}" title="Excluir" ${u.id === getCurrentUser()?.uid ? "disabled" : ""}><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join("") || `<tr><td colspan="7" class="text-center text-muted py-4">Nenhum usuário encontrado.</td></tr>`;

    tbody.querySelectorAll(".btn-editar").forEach(btn => btn.addEventListener("click", () => abrirModalEditar(btn.dataset.id)));
    tbody.querySelectorAll(".btn-excluir").forEach(btn => btn.addEventListener("click", () => excluir(btn.dataset.id, "Excluir")));
    tbody.querySelectorAll(".btn-reset").forEach(btn => btn.addEventListener("click", () => resetarSenha(btn.dataset.id)));
}

function prepararModal(titulo, { editando, proprio }) {
    document.getElementById("modalUsuarioTitle").textContent = titulo;
    document.getElementById("modalErro").classList.add("d-none");
    CAMPOS_MODAL.forEach(id => marcarCampo(id, null));
    document.getElementById("usuarioEmail").readOnly = editando;
    document.getElementById("emailFixo").classList.toggle("d-none", !editando);
    document.getElementById("senhaGroup").classList.toggle("d-none", editando);
    document.getElementById("usuarioRole").disabled = proprio;
    document.getElementById("usuarioAtivo").disabled = proprio;
    document.getElementById("avisoProprio").classList.toggle("d-none", !proprio);
    new bootstrap.Modal(document.getElementById("modalUsuario")).show();
}

function abrirModalNovoUsuario() {
    document.getElementById("formUsuario").reset();
    document.getElementById("usuarioId").value = "";
    prepararModal("Novo Usuário", { editando: false, proprio: false });
}

function abrirModalEditar(id) {
    const u = usuariosCache.find(x => x.id === id);
    if (!u) return;
    document.getElementById("formUsuario").reset();
    document.getElementById("usuarioId").value = u.id;
    document.getElementById("usuarioNome").value = u.nome || "";
    document.getElementById("usuarioEmail").value = u.email || "";
    document.getElementById("usuarioTelefone").value = formatarTelefone(u.telefone);
    document.getElementById("usuarioRole").value = u.role || "comum";
    document.getElementById("usuarioAtivo").checked = u.ativo !== false;
    prepararModal("Editar Usuário", { editando: true, proprio: u.id === getCurrentUser()?.uid });
}

/** Valida o modal. Em edição, um nome antigo sem sobrenome só é cobrado se for alterado. */
function modalValido(existente) {
    const nome = document.getElementById("usuarioNome").value;
    const email = document.getElementById("usuarioEmail").value;
    const senha = document.getElementById("usuarioSenha").value;
    const nomeMudou = !existente || normalizarNome(nome) !== existente.nome;
    const emailRepetido = !existente && usuariosCache.some(u => String(u.email).toLowerCase() === normalizarEmail(email));
    const resultados = [
        marcarCampo("usuarioNome", nomeMudou ? validarNome(nome) : null),
        marcarCampo("usuarioEmail", existente ? null : (validarEmail(email) || (emailRepetido ? "Este e-mail já está cadastrado." : null))),
        marcarCampo("usuarioTelefone", validarTelefone(document.getElementById("usuarioTelefone").value)),
        marcarCampo("usuarioSenha", existente ? null : validarSenha(senha)),
        marcarCampo("usuarioSenhaConfirma", existente ? null : validarConfirmacaoSenha(senha, document.getElementById("usuarioSenhaConfirma").value))
    ];
    return resultados.every(Boolean);
}

async function salvarUsuario(e) {
    e.preventDefault();
    const erroModal = document.getElementById("modalErro");
    erroModal.classList.add("d-none");

    const id = document.getElementById("usuarioId").value;
    const existente = usuariosCache.find(u => u.id === id);
    if (!modalValido(existente)) return;

    const dados = {
        nome: normalizarNome(document.getElementById("usuarioNome").value),
        telefone: normalizarTelefone(document.getElementById("usuarioTelefone").value) || null
    };
    if (id !== getCurrentUser()?.uid) {
        dados.role = document.getElementById("usuarioRole").value;
        dados.ativo = document.getElementById("usuarioAtivo").checked;
    }

    const btn = document.getElementById("btnSalvarUsuario");
    btn.disabled = true;
    try {
        if (existente) {
            await updateUsuario(id, dados);
        } else {
            await criarUsuarioSemDeslogarAdmin(normalizarEmail(document.getElementById("usuarioEmail").value), document.getElementById("usuarioSenha").value, dados);
        }
        bootstrap.Modal.getInstance(document.getElementById("modalUsuario")).hide();
        mensagem(`Usuário ${escapeHtml(dados.nome)} salvo.`);
        await carregarUsuarios();
    } catch (err) {
        console.error(err);
        erroModal.textContent = "Erro ao salvar usuário: " + traduzirErroAuth(err);
        erroModal.classList.remove("d-none");
    } finally {
        btn.disabled = false;
    }
}

/** Cria o novo usuário em um client isolado, para não substituir a sessão do admin logado. */
async function criarUsuarioSemDeslogarAdmin(email, senha, dados) {
    const { data, error } = await criarClienteIsolado().auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: SITE_URL, data: { nome: dados.nome } }
    });
    if (error) throw error;
    if (!data.user) throw new Error("Não foi possível criar o usuário (verifique a confirmação de email nas configurações do Supabase Auth).");
    // O Supabase não retorna erro para email já cadastrado (por segurança, evita
    // que alguém descubra emails existentes); ele responde com um usuário "fantasma"
    // sem identidades associadas. É assim que detectamos a duplicidade aqui.
    if (data.user.identities && data.user.identities.length === 0) {
        throw new Error("already registered");
    }
    await createUsuarioProfile(data.user.id, { ...dados, email });
}

async function excluir(id, acao) {
    const u = usuariosCache.find(x => x.id === id);
    if (!confirm(`${acao} "${u?.nome}"? A conta será excluída e a pessoa não conseguirá mais entrar. Para só bloquear o acesso, prefira desativar.`)) return;
    try {
        const contaExcluida = await excluirUsuario(id);
        mensagem(contaExcluida
            ? `Conta de ${escapeHtml(u.nome)} excluída.`
            : `Perfil de ${escapeHtml(u.nome)} removido. Para apagar também o login, execute a migração v4 ou remova em Supabase → Authentication → Users.`,
            contaExcluida ? "success" : "warning");
        await carregarUsuarios();
    } catch (err) {
        console.error(err);
        mensagem("Erro ao excluir: " + escapeHtml(err.message), "danger");
    }
}

async function resetarSenha(id) {
    const u = usuariosCache.find(x => x.id === id);
    if (!confirm(`Enviar um link de redefinição de senha para ${u.email}?`)) return;
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${SITE_URL}nova-senha.html` });
        if (error) throw error;
        mensagem(`Link de redefinição de senha enviado para ${escapeHtml(u.email)}.`);
    } catch (err) {
        console.error(err);
        mensagem("Erro ao enviar e-mail: " + escapeHtml(traduzirErroAuth(err)), "danger");
    }
}
