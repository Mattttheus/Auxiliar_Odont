// Login no sistema local.
import { apiGet, apiPost } from "./api.js";
import { lerAviso } from "./auth.js";
import { normalizarEmail } from "./validacao.js";

const form = document.getElementById("loginForm");
const errorAlert = document.getElementById("errorAlert");
const btnLogin = document.getElementById("btnLogin");

function mostrarMensagem(msg, sucesso = false) {
    errorAlert.textContent = msg;
    errorAlert.classList.toggle("ok", sucesso);
    errorAlert.classList.remove("d-none");
}

// Se já estiver logado, vai direto para o dashboard. Com aviso, o usuário acabou de ser
// barrado lá: voltar criaria um ciclo de redirecionamentos.
const avisoAnterior = lerAviso();
if (avisoAnterior) {
    mostrarMensagem(avisoAnterior);
} else {
    apiGet("sessao").then(({ usuario, aviso }) => {
        if (usuario) window.location.href = "dashboard.html";
        else if (aviso) mostrarMensagem(aviso);
    }).catch(err => mostrarMensagem(err.message));
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    try {
        await apiPost("entrar", {
            email: normalizarEmail(document.getElementById("email").value),
            senha: document.getElementById("senha").value
        });
        window.location.href = "dashboard.html";
    } catch (err) {
        console.error(err);
        mostrarMensagem(err.message);
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
    }
});

document.getElementById("linkEsqueci").addEventListener("click", (e) => {
    e.preventDefault();
    mostrarMensagem("Peça a um administrador para gerar uma senha temporária em Usuários. Depois de entrar, troque-a em Alterar senha.", true);
});
