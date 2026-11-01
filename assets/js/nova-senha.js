// Define uma nova senha: pelo link de recuperação enviado por e-mail ou, já logado, em "Alterar senha".
import { supabase } from "./supabase-init.js";
import { validarSenha, validarConfirmacaoSenha, traduzirErroAuth, marcarCampo } from "./validacao.js";

const form = document.getElementById("senhaForm");
const errorAlert = document.getElementById("errorAlert");
const btn = document.getElementById("btnSalvar");

function mostrarErro(msg) {
    errorAlert.textContent = msg;
    errorAlert.classList.remove("d-none");
}

document.getElementById("mostrarSenha").addEventListener("change", (e) => {
    for (const id of ["senha", "confirmarSenha"]) document.getElementById(id).type = e.target.checked ? "text" : "password";
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    const senha = document.getElementById("senha").value;
    const resultados = [
        marcarCampo("senha", validarSenha(senha)),
        marcarCampo("confirmarSenha", validarConfirmacaoSenha(senha, document.getElementById("confirmarSenha").value))
    ];
    if (!resultados.every(Boolean)) return;

    btn.disabled = true;
    try {
        const { error } = await supabase.auth.updateUser({ password: senha });
        if (error) throw error;
        form.classList.add("d-none");
        document.getElementById("contaAtual").classList.add("d-none");
        document.getElementById("sucesso").classList.remove("d-none");
    } catch (err) {
        console.error(err);
        mostrarErro(traduzirErroAuth(err));
    } finally {
        btn.disabled = false;
    }
});

// O getSession só responde depois que o SDK processou o link recebido por e-mail.
const { data: { session } } = await supabase.auth.getSession();
if (session) {
    document.getElementById("contaAtual").textContent = `Conta: ${session.user.email}`;
    form.classList.remove("d-none");
} else {
    mostrarErro("Este link é inválido ou já expirou. Na tela de login, clique em Esqueci minha senha para receber outro.");
    document.getElementById("linkVoltar").textContent = "Ir para o login";
}
