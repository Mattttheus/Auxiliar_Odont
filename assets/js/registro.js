// Cadastro público: o primeiro usuário vira admin; os demais aguardam a aprovação de um admin.
import { supabase } from "./supabase-init.js";
import { SITE_URL } from "./supabase-config.js";
import { garantirPerfil } from "./auth.js";
import {
    normalizarNome, normalizarEmail, normalizarTelefone,
    validarNome, validarEmail, validarTelefone, validarPerfilSolicitado, validarSenha, validarConfirmacaoSenha,
    traduzirErroAuth, marcarCampo, ligarMascaraTelefone
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

    const email = normalizarEmail(valor("email"));
    try {
        // A role só é decidida depois que o Supabase autentica o usuário (garantirPerfil).
        // Os dados ficam nos metadados: com "Confirm email" ligado ainda não há sessão
        // para criar o perfil, e ele é criado no primeiro login.
        const { data, error } = await supabase.auth.signUp({
            email,
            password: valor("senha"),
            options: {
                emailRedirectTo: SITE_URL,
                data: {
                    nome: normalizarNome(valor("nome")),
                    telefone: normalizarTelefone(valor("telefone")),
                    perfil_solicitado: valor("perfilSolicitado")
                }
            }
        });
        if (error) throw error;
        // Com "Confirm email" ligado, o Supabase não acusa e-mail repetido (para não revelar
        // quem tem conta): responde com um usuário sem identidades.
        if (data.user?.identities?.length === 0) throw new Error("already registered");

        if (!data.session) {
            concluir("Confirme o seu e-mail", `Enviamos um link para ${email}. Depois de confirmar, entre no sistema: o acesso é liberado após a aprovação de um administrador.`);
            return;
        }
        const perfil = await garantirPerfil(data.user);
        if (perfil.ativo) {
            window.location.href = "dashboard.html";
            return;
        }
        await supabase.auth.signOut();
        concluir("Cadastro enviado", "Um administrador vai conferir os seus dados e liberar o acesso. Depois disso, é só entrar com o seu e-mail e senha.");
    } catch (err) {
        console.error(err);
        errorAlert.textContent = traduzirErroAuth(err);
        errorAlert.classList.remove("d-none");
    } finally {
        btn.disabled = false;
        btn.textContent = "Cadastrar";
    }
});
