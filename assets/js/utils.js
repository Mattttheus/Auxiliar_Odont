// Utilidades compartilhadas: exportação CSV e formatação de datas.

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-01" é um dia do calendário: lido como meia-noite UTC, apareceria como o dia anterior no Brasil. */
function paraData(value) {
    if (typeof value === "string" && SO_DATA.test(value)) {
        const [ano, mes, dia] = value.split("-").map(Number);
        return new Date(ano, mes - 1, dia);
    }
    return new Date(value);
}

export function toDateInputValue(value) {
    if (!value) return "";
    if (typeof value === "string" && SO_DATA.test(value)) return value;
    const d = new Date(value);
    if (isNaN(d)) return "";
    return d.toISOString().slice(0, 10);
}

export function formatDateBR(value) {
    if (!value) return "-";
    const d = paraData(value);
    if (isNaN(d)) return "-";
    return d.toLocaleDateString("pt-BR");
}

export function formatDateTimeBR(value) {
    if (!value) return "-";
    const d = paraData(value);
    if (isNaN(d)) return "-";
    return d.toLocaleString("pt-BR");
}

export function formatMoneyBR(value) {
    return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function daysUntil(value) {
    if (!value) return Infinity;
    return (paraData(value).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000;
}

/** Gera e baixa um CSV a partir de um array de linhas (arrays de valores). */
export function downloadCsv(filename, headerRow, rows) {
    const escapeCell = (v) => {
        const s = String(v ?? "");
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headerRow, ...rows].map(row => row.map(escapeCell).join(","));
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    // innerHTML não escapa aspas: sem isso, o valor quebraria atributos HTML (ex.: value="...").
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
