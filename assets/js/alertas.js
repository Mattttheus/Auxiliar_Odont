// Regras únicas de alerta (validade e reposição), usadas pelo menu, dashboard e produtos.
import { daysUntil } from "./utils.js";

export function estoqueMinimo(p) {
    return p.estoque_minimo === null || p.estoque_minimo === undefined ? 5 : Number(p.estoque_minimo);
}

export function statusProduto(p, cfg) {
    const dias = daysUntil(p.validade);
    const qtd = Number(p.quantidade) || 0;
    return {
        vencido: qtd > 0 && dias < 0,
        vencendo: qtd > 0 && dias >= 0 && dias <= cfg.dias_alerta_validade,
        zerado: qtd === 0,
        baixo: qtd <= estoqueMinimo(p),
        dias
    };
}

/** Agrupa os produtos por tipo de alerta segundo os critérios configurados. */
export function calcularAlertas(produtos, cfg) {
    const r = { vencidos: [], vencendo: [], baixo: [], zerados: [] };
    for (const p of produtos) {
        const s = statusProduto(p, cfg);
        if (s.vencido) r.vencidos.push(p);
        if (s.vencendo) r.vencendo.push(p);
        if (s.baixo) r.baixo.push(p);
        if (s.zerado) r.zerados.push(p);
    }
    r.vencendo.sort((a, b) => daysUntil(a.validade) - daysUntil(b.validade));
    r.total = r.vencidos.length + r.vencendo.length + r.baixo.length;
    return r;
}
