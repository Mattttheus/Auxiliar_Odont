// Cadastro de usuário (primeiro usuário criado vira admin automaticamente).
import { auth, createUserWithEmailAndPassword } from "./firebase-init.js";
import { createUsuarioProfile, countUsuarios } from "./data.js";

const form = document.getElementById("registroForm");
const errorAlert = document.getElementById("errorAlert");
const btn = document.getElementById("btnRegistrar");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    btn.disabled = true;
    btn.textContent = "Cadastrando...";

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    try {
        const totalUsuarios = await countUsuarios();
        const role = totalUsuarios === 0 ? "admin" : "user";

        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await createUsuarioProfile(cred.user.uid, { nome, email, role, ativo: true });

        window.location.href = "index.html";
    } catch (err) {
        console.error(err);
        let msg = err.message;
        if (err.code === "auth/email-already-in-use") msg = "Este email já está cadastrado.";
        if (err.code === "auth/weak-password") msg = "A senha deve ter pelo menos 6 caracteres.";
        errorAlert.textContent = msg;
        errorAlert.classList.remove("d-none");
    } finally {
        btn.disabled = false;
        btn.textContent = "Cadastrar";
    }
});
