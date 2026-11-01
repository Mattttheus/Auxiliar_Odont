// Curva ABC do estoque: ordena os produtos pelo consumo (saídas) e classifica cada um
// pela participação acumulada no consumo total.

export const LIMITE_A = 80; // classe A: produtos que somam até 80% do consumo
export const LIMITE_B = 95; // classe B: os seguintes, até 95%; o restante é classe C

/**
 * Devolve todos os produtos em ordem de precedência, com posição, classe e percentuais.
 * O produto que cruza um limite ainda entra na classe (o mais consumido é sempre A, mesmo
 * que sozinho passe de 80%) e produtos com o mesmo consumo ficam sempre na mesma classe.
 * Produto sem nenhuma saída é classe C.
 */
export function calcularCurvaAbc(produtos, saidas) {
    const consumoPorProduto = new Map();
    for (const s of saidas) {
        const id = String(s.produto_id);
        consumoPorProduto.set(id, (consumoPorProduto.get(id) || 0) + (Number(s.quantidade) || 0));
    }

    const ordenados = produtos
        .map(produto => ({ produto, consumo: consumoPorProduto.get(String(produto.id)) || 0 }))
        .sort((a, b) => b.consumo - a.consumo || String(a.produto.nome).localeCompare(String(b.produto.nome), "pt-BR"));
    const total = ordenados.reduce((t, i) => t + i.consumo, 0);

    let acumulado = 0;
    let anterior = null;
    return ordenados.map((item, i) => {
        let classe = "C";
        if (item.consumo > 0) {
            if (anterior && anterior.consumo === item.consumo) classe = anterior.classe;
            else if (acumulado * 100 < LIMITE_A * total) classe = "A";
            else if (acumulado * 100 < LIMITE_B * total) classe = "B";
        }
        acumulado += item.consumo;
        anterior = {
            ...item,
            posicao: i + 1,
            classe,
            pctConsumo: total ? item.consumo / total * 100 : 0,
            pctAcumulado: total ? acumulado / total * 100 : 0
        };
        return anterior;
    });
}
