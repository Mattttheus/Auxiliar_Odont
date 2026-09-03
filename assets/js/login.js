// Login com Firebase Authentication.
import { auth, db, signInWithEmailAndPassword, onAuthStateChanged, doc, getDoc } from "./firebase-init.js";

const form = document.getElementById("loginForm");
const errorAlert = document.getElementById("errorAlert");
const btnLogin = document.getElementById("btnLogin");

function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.classList.remove("d-none");
}

// Se já estiver logado, vai direto para o dashboard.
onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAlert.classList.add("d-none");
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    try {
        const cred = await signInWithEmailAndPassword(auth, email, senha);
        const snap = await getDoc(doc(db, "usuarios", cred.user.uid));
        if (!snap.exists()) {
            showError("Perfil de usuário não encontrado.");
            return;
        }
        if (snap.data().ativo === false) {
            showError("Usuário desativado. Contate um administrador.");
            return;
        }
        window.location.href = "dashboard.html";
    } catch (err) {
        console.error(err);
        if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
            showError("Email ou senha inválidos.");
        } else {
            showError("Erro ao entrar: " + err.message);
        }
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
    }
});
