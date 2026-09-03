// Lógica do Dashboard: métricas, alertas e gráficos (equivalente a pages/dashboard.php).
import { requireAuth } from "./auth.js";
import { renderShell } from "./layout.js";
import { listProdutos } from "./data.js";
import { formatDateBR, formatMoneyBR, daysUntil, escapeHtml } from "./utils.js";

const user = await requireAuth();
if (user) {
    renderShell("dashboard.html");
    document.getElementById("welcomeBadge").textContent = `Bem-vindo, ${user.nome}`;
    await carregarDashboard();
}

async function carregarDashboard() {
    const produtos = await listProdutos();

    const nomes = [];
    const quantidades = [];
    const valores = [];
    const nomesValidade = [];
    const qtdValidade = [];
    const vencidos = [];
    const prestes = [];

    for (const p of produtos) {
        nomes.push(p.nome);
        quantidades.push(Number(p.quantidade) || 0);
        valores.push((Number(p.preco) || 0) * (Number(p.quantidade) || 0));

        const dias = daysUntil(p.validade);
        if (dias < 0) vencidos.push(p);
        if (dias >= 0 && dias <= 7) {
            prestes.push(p);
            nomesValidade.push(p.nome);
            qtdValidade.push(Number(p.quantidade) || 0);
        }
    }

    document.getElementById("statTotalItens").textContent = quantidades.reduce((a, b) => a + b, 0);
    document.getElementById("statValorEstoque").textContent = "R$ " + formatMoneyBR(valores.reduce((a, b) => a + b, 0));
    document.getElementById("statVencendo").textContent = prestes.length;

    renderAlertas(vencidos, prestes);

    new Chart(document.getElementById("chart1"), {
        type: "bar",
        data: { labels: nomes, datasets: [{ label: "Quantidade", data: quantidades }] }
    });

    new Chart(document.getElementById("chart2"), {
        type: "pie",
        data: { labels: nomes, datasets: [{ label: "Valor", data: valores }] }
    });

    new Chart(document.getElementById("chart3"), {
        type: "bar",
        data: { labels: nomesValidade, datasets: [{ label: "Qtd vencendo", data: qtdValidade }] }
    });
}

function renderAlertas(vencidos, prestes) {
    const container = document.getElementById("alertsContainer");
    let html = "";

    if (vencidos.length > 0) {
        html += `
    <div class="alert alert-danger shadow-sm border-0 rounded-4 d-flex justify-content-between">
      <div>
        <h5><i class="bi bi-exclamation-triangle-fill"></i> Produtos vencidos</h5>
        <p>Existem <strong>${vencidos.length}</strong> produto(s) vencido(s).</p>
        <ul>${vencidos.map(p => `<li>${escapeHtml(p.nome)} — ${formatDateBR(p.validade)}</li>`).join("")}</ul>
      </div>
      <div class="text-end">
        <a href="produtos.html?filter=vencidos" class="btn btn-light mb-2">Ver detalhes</a>
        <button onclick="playBeep('red')" class="btn btn-danger">Tocar alerta</button>
      </div>
    </div>`;
    }

    if (prestes.length > 0) {
        html += `
    <div class="alert alert-warning shadow-sm border-0 rounded-4 d-flex justify-content-between">
      <div>
        <h5><i class="bi bi-hourglass-split"></i> Produtos próximos do vencimento</h5>
        <p>${prestes.length} produto(s) vencem nos próximos 7 dias.</p>
        <ul>${prestes.map(p => `<li>${escapeHtml(p.nome)} — ${formatDateBR(p.validade)}</li>`).join("")}</ul>
      </div>
      <div class="text-end">
        <a href="produtos.html?filter=prestes" class="btn btn-light mb-2">Ver detalhes</a>
        <button onclick="playBeep('yellow')" class="btn btn-warning">Tocar alerta</button>
      </div>
    </div>`;
    }

    container.innerHTML = html;
}
