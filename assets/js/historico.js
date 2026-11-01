// Histórico de ações e saídas de estoque (equivalente a pages/historico/*.php).
import { requirePermission } from "./permissions.js";
import { renderShell } from "./layout.js";
import { listHistorico, listSaidas } from "./data.js";
import { formatDateTimeBR, downloadCsv, escapeHtml, linkProduto } from "./utils.js";

const BADGE_ACAO = {
    "Entrada": "bg-success",
    "Saída": "bg-danger",
    "Cadastro": "bg-primary",
    "Edição": "bg-secondary",
    "Ajuste": "bg-warning text-dark",
    "Exclusão": "bg-dark"
};

const ORIGEM = {
    manual: "Manual",
    qr: "QR / código",
    pdv: "Caixa (PDV)",
    compra: "Lista de compras",
    importacao: "Planilha",
    cadastro: "Cadastro",
    ajuste: "Ajuste"
};

const user = await requirePermission("historico");
if (user) {
    renderShell("historico.html", user);

    let historicoCache = [];
    let saidasCache = [];

    async function init() {
        document.getElementById("btnExportCsv").addEventListener("click", exportarCsv);
        document.getElementById("btnExportHistorico").addEventListener("click", exportarHistoricoCsv);
        ["filtroAcao", "filtroPeriodo"].forEach(id => document.getElementById(id).addEventListener("change", renderHistorico));
        document.getElementById("filtroTexto").addEventListener("input", renderHistorico);
        // A tela de Produtos e a conferência de saldo abrem o histórico já filtrado em um item.
        document.getElementById("filtroTexto").value = new URLSearchParams(window.location.search).get("q") || "";
        try {
            [historicoCache, saidasCache] = await Promise.all([listHistorico(), listSaidas()]);
        } catch (err) {
            console.error(err);
            const msg = `<tr><td colspan="6" class="text-center text-danger py-4">Erro ao carregar: ${escapeHtml(err.message)}</td></tr>`;
            document.getElementById("historicoTableBody").innerHTML = msg;
            document.getElementById("saidasTableBody").innerHTML = msg;
            return;
        }
        renderHistorico();
        renderSaidas();
    }

    await init();

    function filtrarHistorico() {
        const acao = document.getElementById("filtroAcao").value;
        const dias = parseInt(document.getElementById("filtroPeriodo").value);
        const texto = document.getElementById("filtroTexto").value.trim().toLowerCase();
        let desde = null;
        if (dias) {
            desde = new Date();
            desde.setHours(0, 0, 0, 0);
            desde.setDate(desde.getDate() - (dias - 1));
        }
        return historicoCache.filter(h => {
            if (acao && h.acao !== acao) return false;
            if (desde && new Date(h.dataAcao) < desde) return false;
            if (texto && !`${h.produtoNome} ${h.usuarioNome}`.toLowerCase().includes(texto)) return false;
            return true;
        });
    }

    function renderHistorico() {
        const lista = filtrarHistorico();
        document.getElementById("statTotalHistorico").textContent = lista.length;
        document.getElementById("historicoTableBody").innerHTML = lista.map(h => `
    <tr>
      <td>${escapeHtml(h.usuarioNome || "Usuário removido")}</td>
      <td>${h.produtoId ? linkProduto({ nome: h.produtoNome }) : escapeHtml(h.produtoNome)}</td>
      <td><span class="badge ${BADGE_ACAO[h.acao] || "bg-secondary"}">${escapeHtml(h.acao)}</span></td>
      <td>${escapeHtml(h.descricao || "")}</td>
      <td><small class="text-muted">${escapeHtml(ORIGEM[h.origem] || h.origem || "-")}</small></td>
      <td>${formatDateTimeBR(h.dataAcao)}</td>
    </tr>`).join("") || `<tr><td colspan="6" class="text-center text-muted py-4">Nenhum registro.</td></tr>`;
    }

    function renderSaidas() {
        document.getElementById("statTotalSaidas").textContent = saidasCache.length;
        document.getElementById("saidasTableBody").innerHTML = saidasCache.map(s => `
    <tr>
      <td>${linkProduto({ nome: s.produtoNome })}</td>
      <td>${s.quantidade}</td>
      <td>${escapeHtml(s.usuarioNome || "Usuário removido")}</td>
      <td><small>${escapeHtml(s.lote || "-")}</small></td>
      <td>${escapeHtml(s.observacao || "")}</td>
      <td>${formatDateTimeBR(s.dataSaida)}</td>
    </tr>`).join("") || `<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma saída registrada.</td></tr>`;
    }

    function exportarCsv() {
        const rows = saidasCache.map(s => [s.id, s.produtoNome, s.quantidade, s.lote || "", ORIGEM[s.origem] || s.origem || "",
            formatDateTimeBR(s.dataSaida), s.usuarioNome || "", s.observacao || ""]);
        downloadCsv("historico_saidas.csv", ["id", "produto", "quantidade", "lotes", "origem", "data_saida", "usuario", "observacao"], rows);
    }

    function exportarHistoricoCsv() {
        const rows = filtrarHistorico().map(h => [h.id, formatDateTimeBR(h.dataAcao), h.usuarioNome, h.produtoNome, h.acao,
            h.quantidade ?? "", h.descricao || "", ORIGEM[h.origem] || h.origem || ""]);
        downloadCsv("historico_acoes.csv", ["id", "data", "usuario", "produto", "acao", "quantidade", "descricao", "origem"], rows);
    }
}
