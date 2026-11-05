// Cores dos gráficos de planejamento e financeiro: a mesma rampa azul da curva ABC
// (custom.css), em passos escolhidos para cada tema. Realizado é o passo forte; previsto,
// o passo mais claro (no escuro, o mais próximo do fundo), lido como "menos certo".
export const temaEscuro = () => document.body.classList.contains("theme-dark");

export function coresGrafico() {
    return temaEscuro()
        ? { realizado: "#5598e7", previsto: "#256abf", linha: "#cde2fb", faixa: "rgba(85,152,231,.16)", texto: "#cbd5e1", grade: "rgba(255,255,255,.08)", superficie: "#1e293b" }
        : { realizado: "#256abf", previsto: "#86b6ef", linha: "#104281", faixa: "rgba(37,106,191,.12)", texto: "#475569", grade: "rgba(0,0,0,.06)", superficie: "#ffffff" };
}

/** Eixos discretos e grade recessiva, iguais em todos os gráficos. */
export function eixos(c, formatoY) {
    return {
        x: { ticks: { color: c.texto, maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: c.texto, callback: formatoY }, grid: { color: c.grade }, border: { display: false } }
    };
}
