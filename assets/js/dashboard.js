// Lógica do Dashboard: indicadores, alertas e análise de consumo (equivalente a pages/dashboard.php).
import { requireAuth } from "./auth.js";
import { renderShell } from "./layout.js";
import { can } from "./permissions.js";
import { listProdutos, listMovimentacoesDesde, getConfiguracoes } from "./data.js";
import { formatDateBR, daysUntil, escapeHtml } from "./utils.js";
import { calcularAlertas, statusProduto } from "./alertas.js";

// Estas constantes precisam existir ANTES de carregarDashboard() ser chamada
// (ela roda no bloco abaixo, ainda durante o carregamento do módulo).
// Cores: paleta categórica validada (azul/laranja) e cores de status reservadas.
const isDark = () => document.body.classList.contains("theme-dark");
const COR = () => isDark()
    ? { entrada: "#3987e5", saida: "#d95926", ok: "#0ca30c", baixo: "#fab219", zerado: "#d03b3b", texto: "#cbd5e1", grade: "rgba(255,255,255,.08)", superficie: "#1e293b" }
    : { entrada: "#2a78d6", saida: "#eb6834", ok: "#0ca30c", baixo: "#fab219", zerado: "#d03b3b", texto: "#475569", grade: "rgba(0,0,0,.06)", superficie: "#ffffff" };

Chart.defaults.font.family = "'Segoe UI', sans-serif";

const user = await requireAuth();
if (user) {
    renderShell("dashboard.html", user);
    document.getElementById("welcomeBadge").textContent = `Bem-vindo, ${user.nome}`;
    if (!can(user, "compras")) document.getElementById("linkBaixo").href = "produtos.html?filter=baixo";
    try {
        await carregarDashboard();
    } catch (err) {
        console.error(err);
        document.getElementById("alertsContainer").innerHTML =
            `<div class="alert alert-danger">Erro ao carregar o dashboard: ${escapeHtml(err.message)}</div>`;
    }
}

async function carregarDashboard() {
    const cfg = await getConfiguracoes();
    const janela = Math.max(30, cfg.janela_consumo_dias);
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - (janela - 1));
    const [produtos, movs] = await Promise.all([listProdutos(), listMovimentacoesDesde(inicio)]);

    const alertas = calcularAlertas(produtos, cfg);
    const limite30 = new Date();
    limite30.setHours(0, 0, 0, 0);
    limite30.setDate(limite30.getDate() - 29);
    const movs30 = movs.filter(m => new Date(m.data) >= limite30);
    const soma = (lista) => lista.reduce((t, m) => t + Number(m.quantidade || 0), 0);

    document.getElementById("statProdutos").textContent = produtos.length;
    document.getElementById("statItens").textContent =
        `${produtos.reduce((t, p) => t + (Number(p.quantidade) || 0), 0)} unidades em estoque`;
    document.getElementById("statBaixo").textContent = alertas.baixo.length;
    document.getElementById("statZerados").textContent = `${alertas.zerados.length} sem estoque`;
    document.getElementById("labelVencendo").textContent = `Vencem em ${cfg.dias_alerta_validade} dias`;
    document.getElementById("statVencendo").textContent = alertas.vencendo.length;
    document.getElementById("statVencidos").textContent = alertas.vencidos.length;
    document.getElementById("statSaidas30").textContent = soma(movs30.filter(m => m.tipo === "saida"));
    document.getElementById("statEntradas30").textContent = `${soma(movs30.filter(m => m.tipo === "entrada"))} unidades de entrada`;

    renderAlertas(alertas, cfg);
    renderVencimentos(produtos, cfg);
    chartMovimentacoes(movs30, limite30);
    chartConsumo(movs.filter(m => m.tipo === "saida"), cfg.janela_consumo_dias);
    chartCategorias(produtos, cfg);
}

function chartMovimentacoes(movs, inicio) {
    const c = COR();
    const dias = [];
    for (let i = 0; i < 30; i++) {
        const d = new Date(inicio);
        d.setDate(d.getDate() + i);
        dias.push(d);
    }
    const chave = (d) => d.toISOString().slice(0, 10);
    const porDia = { entrada: {}, saida: {} };
    for (const m of movs) {
        const k = chave(new Date(new Date(m.data).setHours(0, 0, 0, 0)));
        porDia[m.tipo][k] = (porDia[m.tipo][k] || 0) + Number(m.quantidade || 0);
    }
    const serie = (tipo) => dias.map(d => porDia[tipo][chave(d)] || 0);
    const linha = (label, data, cor) => ({
        label, data, borderColor: cor, backgroundColor: cor, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 5, pointHoverBorderColor: c.superficie, pointHoverBorderWidth: 2, tension: 0.25
    });

    new Chart(document.getElementById("chartMov"), {
        type: "line",
        data: {
            labels: dias.map(d => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })),
            datasets: [linha("Entradas", serie("entrada"), c.entrada), linha("Saídas", serie("saida"), c.saida)]
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top", align: "end", labels: { color: c.texto, boxWidth: 12, boxHeight: 2 } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} un.` } }
            },
            scales: {
                x: { ticks: { color: c.texto, maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: c.texto, precision: 0 }, grid: { color: c.grade } }
            }
        }
    });
}

function chartConsumo(saidas, janelaDias) {
    const c = COR();
    const limite = new Date();
    limite.setDate(limite.getDate() - janelaDias);
    const totais = {};
    for (const s of saidas) {
        if (new Date(s.data) < limite) continue;
        totais[s.produtoNome] = (totais[s.produtoNome] || 0) + Number(s.quantidade || 0);
    }
    const top = Object.entries(totais).sort((a, b) => b[1] - a[1]).slice(0, 10);
    document.getElementById("subConsumo").textContent = `Unidades que saíram nos últimos ${janelaDias} dias (top 10)`;

    if (top.length === 0) {
        document.getElementById("chartConsumo").parentElement.innerHTML =
            `<p class="text-muted text-center py-5">Sem saídas registradas no período.</p>`;
        return;
    }
    new Chart(document.getElementById("chartConsumo"), {
        type: "bar",
        data: {
            labels: top.map(([nome]) => nome.length > 28 ? nome.slice(0, 27) + "…" : nome),
            datasets: [{ label: "Unidades consumidas", data: top.map(([, q]) => q), backgroundColor: c.entrada, borderRadius: 4, maxBarThickness: 22 }]
        },
        options: {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { title: (items) => top[items[0].dataIndex][0], label: (ctx) => ` ${ctx.parsed.x} un.` } }
            },
            scales: {
                x: { beginAtZero: true, ticks: { color: c.texto, precision: 0 }, grid: { color: c.grade } },
                y: { ticks: { color: c.texto }, grid: { display: false } }
            }
        }
    });
}

function chartCategorias(produtos, cfg) {
    const c = COR();
    const grupos = {};
    for (const p of produtos) {
        const cat = p.categoria || "Sem categoria";
        grupos[cat] ||= { ok: 0, baixo: 0, zerado: 0 };
        const s = statusProduto(p, cfg);
        if (s.zerado) grupos[cat].zerado++;
        else if (s.baixo) grupos[cat].baixo++;
        else grupos[cat].ok++;
    }
    const categorias = Object.keys(grupos).sort();
    const serie = (label, campo, cor) => ({
        label, data: categorias.map(k => grupos[k][campo]), backgroundColor: cor,
        borderColor: c.superficie, borderWidth: 2, borderSkipped: false, maxBarThickness: 26
    });

    new Chart(document.getElementById("chartCategorias"), {
        type: "bar",
        data: {
            labels: categorias,
            datasets: [
                serie("Em ordem", "ok", c.ok),
                serie("Abaixo do mínimo", "baixo", c.baixo),
                serie("Sem estoque", "zerado", c.zerado)
            ]
        },
        options: {
            indexAxis: "y",
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top", align: "end", labels: { color: c.texto, boxWidth: 12 } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x} produto(s)` } }
            },
            scales: {
                x: { stacked: true, beginAtZero: true, ticks: { color: c.texto, precision: 0 }, grid: { color: c.grade } },
                y: { stacked: true, ticks: { color: c.texto }, grid: { display: false } }
            }
        }
    });
}

function renderVencimentos(produtos, cfg) {
    const proximos = produtos
        .filter(p => p.validade && Number(p.quantidade) > 0)
        .sort((a, b) => daysUntil(a.validade) - daysUntil(b.validade))
        .slice(0, 12);
    document.getElementById("vencimentosBody").innerHTML = proximos.map(p => {
        const s = statusProduto(p, cfg);
        const badge = s.vencido ? `<span class="badge bg-danger">Vencido</span>`
            : s.vencendo ? `<span class="badge bg-warning text-dark">${Math.ceil(s.dias)}d</span>` : "";
        return `<tr><td>${escapeHtml(p.nome)}</td><td>${formatDateBR(p.validade)} ${badge}</td><td>${p.quantidade}</td></tr>`;
    }).join("") || `<tr><td colspan="3" class="text-muted text-center py-3">Nenhum produto com validade cadastrada.</td></tr>`;
}

function renderAlertas(a, cfg) {
    const container = document.getElementById("alertsContainer");
    const lista = (itens) => itens.slice(0, 6).map(p => `<li>${escapeHtml(p.nome)} — ${formatDateBR(p.validade)}</li>`).join("")
        + (itens.length > 6 ? `<li>e mais ${itens.length - 6}...</li>` : "");
    let html = "";

    if (a.vencidos.length > 0) {
        html += `
    <div class="alert alert-danger shadow-sm border-0 rounded-4 d-flex justify-content-between flex-wrap gap-2">
      <div>
        <h5><i class="bi bi-exclamation-triangle-fill"></i> Produtos vencidos</h5>
        <p class="mb-1">Existem <strong>${a.vencidos.length}</strong> produto(s) vencido(s) com saldo em estoque.</p>
        <ul class="mb-0">${lista(a.vencidos)}</ul>
      </div>
      <div class="text-end">
        <a href="produtos.html?filter=vencidos" class="btn btn-light mb-2">Ver detalhes</a>
        <button onclick="playBeep('red')" class="btn btn-danger">Tocar alerta</button>
      </div>
    </div>`;
    }

    if (a.vencendo.length > 0) {
        html += `
    <div class="alert alert-warning shadow-sm border-0 rounded-4 d-flex justify-content-between flex-wrap gap-2">
      <div>
        <h5><i class="bi bi-hourglass-split"></i> Produtos próximos do vencimento</h5>
        <p class="mb-1">${a.vencendo.length} produto(s) vencem nos próximos ${cfg.dias_alerta_validade} dias.</p>
        <ul class="mb-0">${lista(a.vencendo)}</ul>
      </div>
      <div class="text-end">
        <a href="produtos.html?filter=prestes" class="btn btn-light mb-2">Ver detalhes</a>
        <button onclick="playBeep('yellow')" class="btn btn-warning">Tocar alerta</button>
      </div>
    </div>`;
    }

    if (a.baixo.length > 0) {
        const destino = can(user, "compras") ? "compras.html" : "produtos.html?filter=baixo";
        html += `
    <div class="alert alert-info shadow-sm border-0 rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <h5 class="mb-1"><i class="bi bi-cart-plus"></i> Reposição necessária</h5>
        <p class="mb-0">${a.baixo.length} produto(s) estão no estoque mínimo ou abaixo (${a.zerados.length} zerado(s)).</p>
      </div>
      <a href="${destino}" class="btn btn-light">${can(user, "compras") ? "Abrir lista de compras" : "Ver produtos"}</a>
    </div>`;
    }

    container.innerHTML = html;
}
