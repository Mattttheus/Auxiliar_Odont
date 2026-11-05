// Prévia de demonstração (GitHub Pages): não há PHP nem banco, então as consultas leem as
// respostas gravadas em previa/dados/ a partir de um banco com dados simulados, e nada é
// salvo. Gerado por banco/gerar_previa.php.
const DADOS = new URL("../../previa/dados/", import.meta.url);
const arquivos = new Map();

function arquivo(nome) {
    if (!arquivos.has(nome)) {
        arquivos.set(nome, fetch(new URL(`${nome}.json`, DADOS)).then(r => (r.ok ? r.json() : null)).catch(() => null));
    }
    return arquivos.get(nome);
}

// Consultas cuja resposta depende dos parâmetros: cada combinação gravada tem seu arquivo.
const VARIANTES = {
    "planejamento.projecao": ["base", "ajuste"],
    "financeiro.analise": ["granularidade", "base"],
    "envios.previa": ["tipo", "frequencia"]
};

async function variante(acao, parametros) {
    const chaves = VARIANTES[acao];
    if (!chaves) return null;
    return arquivo(`${acao}__${chaves.map(c => `${c}-${parametros[c] ?? ""}`).join("__")}`);
}

const aPartirDe = (parametros) => (parametros.desde ? new Date(parametros.desde) : new Date(0));

export async function previaGet(acao, parametros) {
    switch (acao) {
        case "produtos.obter":
            return (await arquivo("produtos.listar")).find(p => String(p.id) === String(parametros.id)) ?? null;
        case "produtos.por_codigo":
            return (await arquivo("produtos.listar")).find(p => p.codigo_barras === parametros.codigo) ?? null;
        case "lotes.listar":
            return (await arquivo("lotes"))[parametros.produto_id] ?? [];
        case "movimentacoes.desde": {
            const desde = aPartirDe(parametros);
            const { entradas, saidas } = await arquivo("movimentacoes.desde");
            return {
                entradas: entradas.filter(e => new Date(e.data_entrada) >= desde),
                saidas: saidas.filter(s => new Date(s.data_saida) >= desde)
            };
        }
        case "saidas.consumo": {
            const desde = aPartirDe(parametros);
            return (await arquivo("saidas.listar"))
                .filter(s => new Date(s.data_saida) >= desde)
                .map(s => ({ produto_id: s.produto_id, quantidade: s.quantidade }));
        }
    }
    const dados = (await variante(acao, parametros)) ?? (await arquivo(acao));
    if (dados === null) throw new Error("Esta consulta não faz parte da prévia de demonstração.");
    return dados;
}

export async function previaPost(acao) {
    if (acao === "entrar" || acao === "sair") return {};
    if (acao === "envios.verificar") return { enviados: 0 };
    throw new Error("Prévia de demonstração: nada é gravado aqui. Para registrar de verdade, use o sistema na rede local do consultório.");
}
