// Login com Supabase Authentication.
import { supabase } from "./supabase-init.js";
import { createUsuarioProfile, countUsuarios } from "./data.js";

const form = document.getElementById("loginForm");
const errorAlert = document.getElementById("errorAlert");
const btnLogin = document.getElementById("btnLogin");

function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.classList.remove("d-none");
}

// Se já estiver logado, vai direto para o dashboard.
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) window.location.href = "dashboard.html";
})();

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;

        let { data: perfil } = await supabase.from("usuarios").select("ativo").eq("id", data.user.id).single();

        // Se o cadastro foi feito com "Confirm email" ativo, o perfil ainda não existe
        // (não havia sessão para criá-lo antes). Cria agora, no primeiro login confirmado.
        if (!perfil) {
            const meta = data.user.user_metadata || {};
            const totalUsuarios = await countUsuarios();
            const role = meta.role || (totalUsuarios === 0 ? "admin" : "user");
            await createUsuarioProfile(data.user.id, {
                nome: meta.nome || email.split("@")[0],
                email,
                role,
                ativo: true
            });
            perfil = { ativo: true };
        }

        if (perfil.ativo === false) {
            await supabase.auth.signOut();
            showError("Usuário desativado. Contate um administrador.");
            return;
        }
        window.location.href = "dashboard.html";
    } catch (err) {
        console.error(err);
        if (err.message === "Invalid login credentials") {
            showError("Email ou senha inválidos.");
        } else {
            showError("Erro ao entrar: " + err.message);
        }
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
    }
});

