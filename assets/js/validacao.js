// Regras únicas das informações de usuário, usadas no cadastro público, na tela Usuários
// e na troca de senha. Cada validar* devolve a mensagem de erro, ou null se estiver certo.

export const SENHA_MINIMA = 8;
export const PERFIS_SOLICITAVEIS = ["dentista", "estoquista", "vendedor", "comum"];

export const normalizarNome = (nome) => String(nome ?? "").trim().replace(/\s+/g, " ");
export const normalizarEmail = (email) => String(email ?? "").trim().toLowerCase();

/** Só os dígitos do telefone, sem o código do país. */
export function normalizarTelefone(telefone) {
    const digitos = String(telefone ?? "").replace(/\D/g, "");
    return (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

/** (11) 91234-5678 ou (11) 3456-7890. Aceita número incompleto, para a máscara enquanto digita. */
export function formatarTelefone(telefone) {
    const d = normalizarTelefone(telefone).slice(0, 11);
    if (d.length <= 2) return d;
    const corte = d.length === 11 ? 7 : 6;
    if (d.length <= corte) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
}

export function validarNome(nome) {
    const n = normalizarNome(nome);
    if (!n) return "Informe o nome completo.";
    if (!/^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u.test(n)) return "O nome deve ter apenas letras.";
    if (n.split(" ").length < 2) return "Informe nome e sobrenome.";
    return null;
}

export function validarEmail(email) {
    const e = normalizarEmail(email);
    if (!e) return "Informe o e-mail.";
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(e)) return "Informe um e-mail válido, como nome@exemplo.com.";
    return null;
}

export function validarTelefone(telefone, { obrigatorio = false } = {}) {
    const d = normalizarTelefone(telefone);
    if (!d) return obrigatorio ? "Informe o telefone com DDD." : null;
    const valido = /^[1-9][1-9]/.test(d) && (d.length === 10 || (d.length === 11 && d[2] === "9"));
    return valido ? null : "Informe um telefone válido com DDD, como (11) 91234-5678.";
}

export function validarPerfilSolicitado(perfil) {
    return PERFIS_SOLICITAVEIS.includes(perfil) ? null : "Selecione o nível de usuário.";
}

export function validarSenha(senha) {
    if (!senha) return "Informe a senha.";
    if (senha.length < SENHA_MINIMA) return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`;
    if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return "A senha deve ter letras e números.";
    return null;
}

export function validarConfirmacaoSenha(senha, confirmacao) {
    return senha === confirmacao ? null : "As senhas não são iguais.";
}

/** Mensagem compreensível para os erros do Supabase Auth. */
export function traduzirErroAuth(err) {
    const msg = String(err?.message ?? err ?? "");
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        return "Não foi possível conectar ao servidor do sistema. Verifique sua internet e tente de novo; se continuar, avise o administrador.";
    }
    if (/invalid login credentials/i.test(msg)) return "E-mail ou senha inválidos.";
    if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    if (/already (been )?registered/i.test(msg)) return "Este e-mail já está cadastrado.";
    if (/rate limit|too many|only request this/i.test(msg)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    if (/different from the old/i.test(msg)) return "A nova senha deve ser diferente da atual.";
    if (/signups? not allowed|signup.*disabled/i.test(msg)) return "O cadastro de novos usuários está desativado no Supabase.";
    if (/password/i.test(msg)) return `A senha não foi aceita. Use pelo menos ${SENHA_MINIMA} caracteres, com letras e números.`;
    if (/invalid/i.test(msg) && /email/i.test(msg)) return "Este e-mail não foi aceito. Confira se está correto.";
    return msg;
}

// ---------- FORMULÁRIOS ----------
/** Marca um campo Bootstrap com o resultado da validação; o aviso fica em #<id>Erro. */
export function marcarCampo(id, erro) {
    document.getElementById(id).classList.toggle("is-invalid", !!erro);
    const aviso = document.getElementById(`${id}Erro`);
    if (aviso) aviso.textContent = erro || "";
    return !erro;
}

export function ligarMascaraTelefone(id) {
    const campo = document.getElementById(id);
    campo.addEventListener("input", () => { campo.value = formatarTelefone(campo.value); });
}
