// Comunicação das telas com a API local (api/index.php), que acessa o MySQL.
export const CHAVE_AVISO = "auxiliarOdontAviso";

const SEM_SERVIDOR = "Não foi possível conectar ao sistema. Acesse pela rede local, em http://192.168.1.51/Auxiliar_Odont/, com o WAMP ligado.";

async function chamar(acao, consulta, opcoes) {
    let resposta, corpo;
    try {
        resposta = await fetch(`api/index.php?acao=${encodeURIComponent(acao)}${consulta}`, { credentials: "same-origin", ...opcoes });
        corpo = await resposta.json();
    } catch {
        throw new Error(SEM_SERVIDOR);
    }
    if (corpo.ok) return corpo.dados;
    if (resposta.status === 401) {
        sessionStorage.setItem(CHAVE_AVISO, corpo.erro);
        window.location.href = "index.html";
    }
    const erro = new Error(corpo.erro || SEM_SERVIDOR);
    erro.status = resposta.status;
    throw erro;
}

export function apiGet(acao, parametros = {}) {
    const validos = Object.entries(parametros).filter(([, v]) => v !== null && v !== undefined);
    const consulta = new URLSearchParams(validos).toString();
    return chamar(acao, consulta ? `&${consulta}` : "", {});
}

export function apiPost(acao, dados = {}) {
    return chamar(acao, "", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "auxiliar-odont" },
        body: JSON.stringify(dados)
    });
}
