// Regras únicas de alerta (validade e reposição), usadas pelo menu, dashboard e produtos.
import { daysUntil } from "./utils.js";

export function estoqueMinimo(p) {
    return p.estoque_minimo === null || p.estoque_minimo === undefined ? 5 : Number(p.estoque_minimo);
}

/** Regra da planilha: abaixo do mínimo é Repor, igual ao mínimo é Atenção, acima é Normal. */
export function statusEstoque(p) {
    const qtd = Number(p.quantidade) || 0;
    const minimo = estoqueMinimo(p);
    if (qtd < minimo) return { codigo: "repor", label: "Repor", badge: "bg-danger", icone: "bi-exclamation-octagon-fill" };
    if (qtd === minimo) return { codigo: "atencao", label: "Atenção", badge: "bg-warning text-dark", icone: "bi-exclamation-triangle-fill" };
    return { codigo: "normal", label: "Normal", badge: "bg-success", icone: "bi-check-circle-fill" };
}

export function badgeEstoque(p) {
    const s = statusEstoque(p);
    return `<span class="badge ${s.badge}"><i class="bi ${s.icone}"></i> ${s.label}</span>`;
}

export function statusProduto(p, cfg) {
    const dias = daysUntil(p.validade);
    const qtd = Number(p.quantidade) || 0;
    const estoque = statusEstoque(p).codigo;
    return {
        vencido: qtd > 0 && dias < 0,
        vencendo: qtd > 0 && dias >= 0 && dias <= cfg.dias_alerta_validade,
        zerado: qtd === 0,
        repor: estoque === "repor",
        atencao: estoque === "atencao",
        // Repor e Atenção juntos: é a lista "Itens que precisam de reposição" da planilha.
        baixo: estoque !== "normal",
        dias
    };
}

/** Agrupa os produtos por tipo de alerta segundo os critérios configurados. */
export function calcularAlertas(produtos, cfg) {
    const r = { vencidos: [], vencendo: [], baixo: [], repor: [], atencao: [], normal: [], zerados: [] };
    for (const p of produtos) {
        const s = statusProduto(p, cfg);
        if (s.vencido) r.vencidos.push(p);
        if (s.vencendo) r.vencendo.push(p);
        if (s.baixo) r.baixo.push(p);
        if (s.zerado) r.zerados.push(p);
        r[statusEstoque(p).codigo].push(p);
    }
    r.vencendo.sort((a, b) => daysUntil(a.validade) - daysUntil(b.validade));
    r.total = r.vencidos.length + r.vencendo.length + r.baixo.length;
    return r;
}
