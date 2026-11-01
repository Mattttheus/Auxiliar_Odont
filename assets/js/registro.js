// Cadastro: o primeiro usuário do sistema vira admin; os demais aguardam a aprovação de um admin.
import { apiPost } from "./api.js";
import {
    normalizarNome, normalizarEmail, normalizarTelefone,
    validarNome, validarEmail, validarTelefone, validarPerfilSolicitado, validarSenha, validarConfirmacaoSenha,
    marcarCampo, ligarMascaraTelefone
} from "./validacao.js";

const form = document.getElementById("registroForm");
const errorAlert = document.getElementById("errorAlert");
const btn = document.getElementById("btnRegistrar");
const valor = (id) => document.getElementById(id).value;

ligarMascaraTelefone("telefone");
document.getElementById("mostrarSenha").addEventListener("change", (e) => {
    for (const id of ["senha", "confirmarSenha"]) document.getElementById(id).type = e.target.checked ? "text" : "password";
});

function formularioValido() {
    // Valida todos os campos antes de responder, para marcar de uma vez tudo o que falta.
    const resultados = [
        marcarCampo("nome", validarNome(valor("nome"))),
        marcarCampo("email", validarEmail(valor("email"))),
        marcarCampo("telefone", validarTelefone(valor("telefone"), { obrigatorio: true })),
        marcarCampo("perfilSolicitado", validarPerfilSolicitado(valor("perfilSolicitado"))),
        marcarCampo("senha", validarSenha(valor("senha"))),
        marcarCampo("confirmarSenha", validarConfirmacaoSenha(valor("senha"), valor("confirmarSenha")))
    ];
    form.querySelector(".is-invalid")?.focus();
    return resultados.every(Boolean);
}

function concluir(titulo, texto) {
    form.classList.add("d-none");
    document.getElementById("subtitulo").classList.add("d-none");
    document.getElementById("sucessoTitulo").textContent = titulo;
    document.getElementById("sucessoTexto").textContent = texto;
    document.getElementById("sucesso").classList.remove("d-none");
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    if (!formularioValido()) return;

    btn.disabled = true;
    btn.textContent = "Cadastrando...";

    try {
        const { usuario } = await apiPost("cadastrar", {
            nome: normalizarNome(valor("nome")),
            email: normalizarEmail(valor("email")),
            telefone: normalizarTelefone(valor("telefone")),
            perfil_solicitado: valor("perfilSolicitado"),
            senha: valor("senha")
        });
        if (usuario) {
            window.location.href = "dashboard.html";
            return;
        }
        concluir("Cadastro enviado", "Um administrador vai conferir os seus dados e liberar o acesso. Depois disso, é só entrar com o seu e-mail e senha.");
    } catch (err) {
        console.error(err);
        errorAlert.textContent = err.message;
        errorAlert.classList.remove("d-none");
    } finally {
        btn.disabled = false;
        btn.textContent = "Cadastrar";
    }
});
