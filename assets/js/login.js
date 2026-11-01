// Login com Supabase Authentication.
import { supabase } from "./supabase-init.js";
import { SITE_URL } from "./supabase-config.js";
import { garantirPerfil, motivoBloqueio, lerAviso } from "./auth.js";
import { normalizarEmail, validarEmail, traduzirErroAuth } from "./validacao.js";

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
const aviso = lerAviso();
if (aviso) {
    mostrarMensagem(aviso);
} else {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) window.location.href = "dashboard.html";
    });
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    const email = normalizarEmail(document.getElementById("email").value);
    const senha = document.getElementById("senha").value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;

        const perfil = await garantirPerfil(data.user);
        if (perfil.ativo === false) {
            await supabase.auth.signOut();
            mostrarMensagem(motivoBloqueio(perfil));
            return;
        }
        window.location.href = "dashboard.html";
    } catch (err) {
        console.error(err);
        mostrarMensagem(traduzirErroAuth(err));
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
    }
});

document.getElementById("linkEsqueci").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = normalizarEmail(document.getElementById("email").value);
    const erro = validarEmail(email);
    if (erro) {
        mostrarMensagem("Digite seu e-mail no campo acima e clique de novo em Esqueci minha senha.");
        document.getElementById("email").focus();
        return;
    }
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}nova-senha.html` });
        if (error) throw error;
        mostrarMensagem("Se este e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira também a caixa de spam.", true);
    } catch (err) {
        console.error(err);
        mostrarMensagem(traduzirErroAuth(err));
    }
});
