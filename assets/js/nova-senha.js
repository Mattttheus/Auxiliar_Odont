// Alterar a própria senha: pede a senha atual para confirmar quem está no computador.
import { apiPost } from "./api.js";
import { requireAuth } from "./auth.js";
import { validarSenha, validarConfirmacaoSenha, marcarCampo } from "./validacao.js";

const form = document.getElementById("senhaForm");
const errorAlert = document.getElementById("errorAlert");
const btn = document.getElementById("btnSalvar");

document.getElementById("mostrarSenha").addEventListener("change", (e) => {
    for (const id of ["senhaAtual", "senha", "confirmarSenha"]) document.getElementById(id).type = e.target.checked ? "text" : "password";
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    const atual = document.getElementById("senhaAtual").value;
    const senha = document.getElementById("senha").value;
    const resultados = [
        marcarCampo("senhaAtual", atual ? null : "Informe a senha atual."),
        marcarCampo("senha", validarSenha(senha)),
        marcarCampo("confirmarSenha", validarConfirmacaoSenha(senha, document.getElementById("confirmarSenha").value))
    ];
    if (!resultados.every(Boolean)) return;

    btn.disabled = true;
    try {
        await apiPost("alterar_senha", { senha_atual: atual, senha_nova: senha });
        form.classList.add("d-none");
        document.getElementById("contaAtual").classList.add("d-none");
        document.getElementById("sucesso").classList.remove("d-none");
    } catch (err) {
        console.error(err);
        errorAlert.textContent = err.message;
        errorAlert.classList.remove("d-none");
    } finally {
        btn.disabled = false;
    }
});

const user = await requireAuth();
if (user) {
    document.getElementById("contaAtual").textContent = `Conta: ${user.email}`;
    form.classList.remove("d-none");
}
