// Cadastro de usuário (primeiro usuário criado vira admin automaticamente).
import { supabase } from "./supabase-init.js";
import { createUsuarioProfile, countUsuarios } from "./data.js";

const form = document.getElementById("registroForm");
const errorAlert = document.getElementById("errorAlert");
const btn = document.getElementById("btnRegistrar");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    errorAlert.classList.remove("alert-success");
    errorAlert.classList.add("alert-danger");
    btn.disabled = true;
    btn.textContent = "Cadastrando...";

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    try {
        const totalUsuarios = await countUsuarios();
        const role = totalUsuarios === 0 ? "admin" : "vendedor";

        // Guarda nome/perfil nos metadados do Auth: se "Confirm email" estiver ativo,
        // o perfil na tabela usuarios só pode ser criado depois (sem sessão agora, o insert
        // seria bloqueado pela política de segurança). O login.js cria o perfil nesse caso.
        const { data, error } = await supabase.auth.signUp({
            email,
            password: senha,
            options: { data: { nome, role } }
        });
        if (error) throw error;

        if (data.session) {
            await createUsuarioProfile(data.user.id, { nome, email, role, ativo: true });
            window.location.href = "index.html";
        } else {
            errorAlert.classList.remove("alert-danger", "d-none");
            errorAlert.classList.add("alert-success");
            errorAlert.textContent = "Cadastro realizado! Verifique seu email para confirmar a conta antes de entrar.";
        }
    } catch (err) {
        console.error(err);
        let msg = err.message;
        if (msg.includes("already registered")) msg = "Este email já está cadastrado.";
        if (msg.includes("Password")) msg = "A senha deve ter pelo menos 6 caracteres.";
        errorAlert.textContent = msg;
        errorAlert.classList.remove("d-none");
    } finally {
        btn.disabled = false;
        btn.textContent = "Cadastrar";
    }
});

