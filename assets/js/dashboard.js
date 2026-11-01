// Lógica do Dashboard: indicadores, alertas e análise de consumo (equivalente a pages/dashboard.php).
import { requireAuth } from "./auth.js";
import { renderShell } from "./layout.js";
import { can } from "./permissions.js";
import { listProdutos, listMovimentacoesDesde, getConfiguracoes } from "./data.js";
import { formatDateBR, daysUntil, escapeHtml, linkProduto } from "./utils.js";
import { calcularAlertas, statusEstoque, badgeEstoque, estoqueMinimo } from "./alertas.js";

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
    // Cada atalho aparece só para quem pode abrir a tela de destino.
    if (!can(user, "historico")) document.getElementById("linkSaidas").removeAttribute("href");
    document.getElementById("linkComprasReposicao").classList.toggle("d-none", !can(user, "compras"));
    document.getElementById("linkCurvaAbc").classList.toggle("d-none", !can(user, "controle"));
    document.getElementById("linkHistoricoMensal").classList.toggle("d-none", !can(user, "historico"));
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
    // O resumo mensal, como na planilha, precisa do ano inteiro.
    const inicioAno = new Date(new Date().getFullYear(), 0, 1);
    const [produtos, movs] = await Promise.all([listProdutos(), listMovimentacoesDesde(inicio < inicioAno ? inicio : inicioAno)]);

    const alertas = calcularAlertas(produtos, cfg);
    const limite30 = new Date();
    limite30.setHours(0, 0, 0, 0);
    limite30.setDate(limite30.getDate() - 29);
    const movs30 = movs.filter(m => new Date(m.data) >= limite30);
    const soma = (lista) => lista.reduce((t, m) => t + Number(m.quantidade || 0), 0);

    document.getElementById("statProdutos").textContent = produtos.length;
    document.getElementById("statItens").textContent =
        `${produtos.reduce((t, p) => t + (Number(p.quantidade) || 0), 0)} unidades, ${alertas.normal.length} itens normais`;
    document.getElementById("statBaixo").textContent = alertas.repor.length;
    document.getElementById("statZerados").textContent = `${alertas.atencao.length} em atenção, ${alertas.zerados.length} sem estoque`;
    document.getElementById("labelVencendo").textContent = `Vencem em ${cfg.dias_alerta_validade} dias`;
    document.getElementById("statVencendo").textContent = alertas.vencendo.length;
    document.getElementById("statVencidos").textContent = alertas.vencidos.length;
    document.getElementById("statSaidas30").textContent = soma(movs30.filter(m => m.tipo === "saida"));
    document.getElementById("statEntradas30").textContent = `${soma(movs30.filter(m => m.tipo === "entrada"))} unidades de entrada`;

    renderAlertas(alertas, cfg);
    renderVencimentos(produtos, cfg);
    renderReposicao(produtos);
    chartMovimentacoes(movs30, limite30);
    chartMensal(movs, inicioAno.getFullYear());
    chartConsumo(movs.filter(m => m.tipo === "saida"), cfg.janela_consumo_dias);
    chartCategorias(produtos);
}

/** Lista "Itens que precisam de reposição" da planilha: primeiro Repor, depois Atenção. */
function renderReposicao(produtos) {
    const itens = produtos
        .filter(p => statusEstoque(p).codigo !== "normal")
        .sort((a, b) => statusEstoque(b).codigo.localeCompare(statusEstoque(a).codigo)
            || String(a.codigo_barras).localeCompare(String(b.codigo_barras)));
    document.getElementById("qtdReposicao").textContent = itens.length;
    document.getElementById("reposicaoBody").innerHTML = itens.map(p => `
    <tr>
      <td><small class="text-muted">${escapeHtml(p.codigo_barras || "-")}</small></td>
      <td>${linkProduto(p)}</td>
      <td>${p.quantidade}</td>
      <td>${estoqueMinimo(p)}</td>
      <td>${badgeEstoque(p)}</td>
    </tr>`).join("") || `<tr><td colspan="5" class="text-muted text-center py-3">Nenhum item para reposição.</td></tr>`;
}

/** Entradas e saídas por mês do ano, como no resumo mensal da planilha. */
function chartMensal(movs, ano) {
    const c = COR();
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const totais = { entrada: Array(12).fill(0), saida: Array(12).fill(0) };
    for (const m of movs) {
        const d = new Date(m.data);
        if (d.getFullYear() === ano) totais[m.tipo][d.getMonth()] += Number(m.quantidade || 0);
    }
    const serie = (label, data, cor) => ({
        label, data, backgroundColor: cor, borderRadius: 4, maxBarThickness: 18
    });
    document.getElementById("subMensal").textContent = `Unidades por mês em ${ano}`;
    new Chart(document.getElementById("chartMensal"), {
        type: "bar",
        data: {
            labels: meses,
            datasets: [serie("Entradas", totais.entrada, c.entrada), serie("Saídas", totais.saida, c.saida)]
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top", align: "end", labels: { color: c.texto, boxWidth: 12 } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} un.` } }
            },
            scales: {
                x: { ticks: { color: c.texto }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: c.texto, precision: 0 }, grid: { color: c.grade } }
            }
        }
    });
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

function chartCategorias(produtos) {
    const c = COR();
    const grupos = {};
    for (const p of produtos) {
        const cat = p.categoria || "Sem categoria";
        grupos[cat] ||= { normal: 0, atencao: 0, repor: 0 };
        grupos[cat][statusEstoque(p).codigo]++;
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
                serie("Normal", "normal", c.ok),
                serie("Atenção", "atencao", c.baixo),
                serie("Repor", "repor", c.zerado)
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
        const dias = daysUntil(p.validade);
        const badge = dias < 0 ? `<span class="badge bg-danger">Vencido</span>`
            : dias <= cfg.dias_alerta_validade ? `<span class="badge bg-warning text-dark">${Math.ceil(dias)}d</span>` : "";
        return `<tr><td>${linkProduto(p)}</td><td>${formatDateBR(p.validade)} ${badge}</td><td>${p.quantidade}</td></tr>`;
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
        <p class="mb-0">${a.repor.length} produto(s) para repor e ${a.atencao.length} em atenção (${a.zerados.length} sem estoque).</p>
      </div>
      <a href="${destino}" class="btn btn-light">${can(user, "compras") ? "Abrir lista de compras" : "Ver produtos"}</a>
    </div>`;
    }

    container.innerHTML = html;
}
