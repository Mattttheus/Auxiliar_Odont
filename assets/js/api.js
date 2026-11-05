// Comunicação das telas com a API local (api/index.php), que acessa o MySQL.
export const CHAVE_AVISO = "auxiliarOdontAviso";

const SEM_SERVIDOR = "Não foi possível conectar ao sistema. Acesse pela rede local, em http://192.168.1.51/Auxiliar_Odont/, com o WAMP ligado.";

/**
 * Prévia de demonstração: no GitHub Pages não há servidor, então as telas leem dados
 * simulados (assets/js/previa.js). Na rede local, ?previa=1 abre a prévia nesta aba e
 * ?previa=0 volta ao sistema.
 */
export const MODO_PREVIA = (() => {
    const noPages = window.location.hostname.endsWith("github.io");
    try {
        const pedido = new URLSearchParams(window.location.search).get("previa");
        if (pedido === "1") sessionStorage.setItem("auxiliarOdontPrevia", "1");
        if (pedido === "0") sessionStorage.removeItem("auxiliarOdontPrevia");
        return noPages || sessionStorage.getItem("auxiliarOdontPrevia") === "1";
    } catch {
        return noPages;
    }
})();

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

export async function apiGet(acao, parametros = {}) {
    const validos = Object.entries(parametros).filter(([, v]) => v !== null && v !== undefined);
    if (MODO_PREVIA) return (await import("./previa.js")).previaGet(acao, Object.fromEntries(validos.map(([k, v]) => [k, String(v)])));
    const consulta = new URLSearchParams(validos).toString();
    return chamar(acao, consulta ? `&${consulta}` : "", {});
}

export async function apiPost(acao, dados = {}) {
    if (MODO_PREVIA) return (await import("./previa.js")).previaPost(acao, dados);
    return chamar(acao, "", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "auxiliar-odont" },
        body: JSON.stringify(dados)
    });
}
