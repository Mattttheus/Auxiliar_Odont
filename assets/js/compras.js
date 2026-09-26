// Lista de compras: sugestão automática (rotina SQL sugerir_lista_compras), critérios
// configuráveis, listas salvas no banco e recebimento que dá entrada no estoque.
import { requirePermission, can } from "./permissions.js";
import { getCurrentUser } from "./auth.js";
import { renderShell } from "./layout.js";
import {
    sugerirListaCompras, getConfiguracoes, updateConfiguracoes, listProdutos,
    listListasCompra, createListaCompra, updateStatusListaCompra, receberListaCompra,
    isMigracaoPendente, MSG_MIGRACAO_V3
} from "./data.js";
import { formatDateBR, formatDateTimeBR, downloadCsv, escapeHtml } from "./utils.js";
import { estoqueMinimo } from "./alertas.js";

const STATUS = {
    aberta: { label: "Aberta", badge: "bg-primary" },
    enviada: { label: "Pedido enviado", badge: "bg-warning text-dark" },
    recebida: { label: "Recebida", badge: "bg-success" },
    cancelada: { label: "Cancelada", badge: "bg-secondary" }
};

let sugestoes = [];
let listas = [];
let migracaoOk = true;
const desmarcados = new Set();

const user = await requirePermission("compras");
if (user) {
    renderShell("compras.html", user);
    await init();
}

async function init() {
    const podeEditar = can(user, "compras_edit");
    document.getElementById("acoesSalvar").classList.toggle("d-none", !podeEditar);
    document.getElementById("tituloLista").value = `Compra ${new Date().toLocaleDateString("pt-BR")}`;

    document.getElementById("btnRecalcular").addEventListener("click", carregarSugestoes);
    document.getElementById("btnCsv").addEventListener("click", exportarCsv);
    document.getElementById("btnImprimir").addEventListener("click", () => window.print());
    document.getElementById("btnSalvarLista").addEventListener("click", salvarLista);
    document.getElementById("formCriterios").addEventListener("submit", salvarCriterios);
    document.getElementById("selTodos").addEventListener("change", e => {
        sugestoes.forEach(s => e.target.checked ? desmarcados.delete(String(s.produto_id)) : desmarcados.add(String(s.produto_id)));
        renderSugestoes();
    });

    await carregarCriterios();
    await carregarSugestoes();
    await carregarListas();
}

function mensagem(html, tipo = "warning") {
    document.getElementById("msgContainer").innerHTML = html ? `<div class="alert alert-${tipo}">${html}</div>` : "";
}

async function carregarCriterios() {
    const cfg = await getConfiguracoes();
    document.getElementById("cfgAlerta").value = cfg.dias_alerta_validade;
    document.getElementById("cfgJanela").value = cfg.janela_consumo_dias;
    document.getElementById("cfgCobertura").value = cfg.dias_cobertura;
    document.getElementById("cfgReposicao").value = cfg.dias_reposicao;
    document.getElementById("resumoCriterios").textContent =
        `validade ${cfg.dias_alerta_validade}d · consumo ${cfg.janela_consumo_dias}d · cobertura ${cfg.dias_cobertura}d · entrega ${cfg.dias_reposicao}d`;

    const podeConfigurar = can(user, "config");
    document.querySelectorAll("#formCriterios input").forEach(i => { i.disabled = !podeConfigurar; });
    document.getElementById("btnSalvarCriterios").classList.toggle("d-none", !podeConfigurar);
    document.getElementById("avisoCriterios").textContent = podeConfigurar ? "" : "Somente administradores alteram os critérios.";
}

async function salvarCriterios(e) {
    e.preventDefault();
    try {
        await updateConfiguracoes({
            dias_alerta_validade: parseInt(document.getElementById("cfgAlerta").value),
            janela_consumo_dias: parseInt(document.getElementById("cfgJanela").value),
            dias_cobertura: parseInt(document.getElementById("cfgCobertura").value),
            dias_reposicao: parseInt(document.getElementById("cfgReposicao").value)
        });
        await carregarCriterios();
        await carregarSugestoes();
        mensagem("Critérios salvos. A sugestão foi recalculada.", "success");
    } catch (err) {
        mensagem(isMigracaoPendente(err) ? MSG_MIGRACAO_V3 : "Erro ao salvar critérios: " + escapeHtml(err.message), "danger");
    }
}

/** Sem a migração v3: sugestão simples só pelo estoque mínimo (repor até o dobro do mínimo). */
async function sugestaoLocal() {
    const produtos = await listProdutos();
    return produtos
        .filter(p => Number(p.quantidade) <= estoqueMinimo(p) && estoqueMinimo(p) > 0)
        .map(p => ({
            produto_id: p.id, nome: p.nome, categoria: p.categoria, unidade: p.unidade, localizacao: p.localizacao,
            quantidade: p.quantidade, estoque_minimo: estoqueMinimo(p), consumo_diario: null, qtd_vencendo: 0,
            quantidade_sugerida: estoqueMinimo(p) * 2 - Number(p.quantidade),
            motivo: Number(p.quantidade) === 0 ? "Sem estoque" : "Abaixo do mínimo"
        }));
}

async function carregarSugestoes() {
    document.getElementById("sugestaoBody").innerHTML =
        `<tr><td colspan="9" class="text-center text-muted py-4">Calculando...</td></tr>`;
    try {
        sugestoes = await sugerirListaCompras();
        migracaoOk = true;
    } catch (err) {
        if (!isMigracaoPendente(err)) {
            document.getElementById("sugestaoBody").innerHTML =
                `<tr><td colspan="9" class="text-center text-danger py-4">Erro: ${escapeHtml(err.message)}</td></tr>`;
            return;
        }
        migracaoOk = false;
        mensagem(`${MSG_MIGRACAO_V3} Enquanto isso, a sugestão abaixo considera apenas o estoque mínimo.`);
        sugestoes = await sugestaoLocal();
    }
    sugestoes.forEach(s => { s.pedir = s.quantidade_sugerida; });
    renderSugestoes();
}

function renderSugestoes() {
    document.getElementById("qtdSugestoes").textContent = sugestoes.length;
    const tbody = document.getElementById("sugestaoBody");
    tbody.innerHTML = sugestoes.map((s, i) => {
        const marcado = !desmarcados.has(String(s.produto_id));
        return `
    <tr class="${marcado ? "" : "no-print text-muted"}">
      <td class="no-print"><input class="form-check-input sel-item" type="checkbox" data-id="${s.produto_id}" ${marcado ? "checked" : ""}></td>
      <td><strong>${escapeHtml(s.nome)}</strong><br><small class="text-muted">${escapeHtml(s.categoria || "")}${s.localizacao ? ` · ${escapeHtml(s.localizacao)}` : ""}</small></td>
      <td class="${Number(s.quantidade) === 0 ? "text-danger fw-bold" : ""}">${s.quantidade} <small class="text-muted">${escapeHtml(s.unidade || "")}</small></td>
      <td>${s.estoque_minimo}</td>
      <td>${s.consumo_diario === null || s.consumo_diario === undefined ? "-" : Number(s.consumo_diario).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
      <td>${s.qtd_vencendo > 0 ? `<span class="badge bg-warning text-dark">${s.qtd_vencendo} até ${formatDateBR(s.validade_proxima)}</span>` : "-"}</td>
      <td>${s.quantidade_sugerida}</td>
      <td><input type="number" min="1" class="form-control form-control-sm inp-pedir" data-idx="${i}" value="${s.pedir}"></td>
      <td><small>${escapeHtml(s.motivo || "")}</small></td>
    </tr>`;
    }).join("") || `<tr><td colspan="9" class="text-center text-muted py-4"><i class="bi bi-check-circle text-success"></i> Nenhuma reposição necessária pelos critérios atuais.</td></tr>`;

    tbody.querySelectorAll(".sel-item").forEach(cb => cb.addEventListener("change", () => {
        cb.checked ? desmarcados.delete(cb.dataset.id) : desmarcados.add(cb.dataset.id);
        renderSugestoes();
    }));
    tbody.querySelectorAll(".inp-pedir").forEach(inp => inp.addEventListener("change", () => {
        sugestoes[Number(inp.dataset.idx)].pedir = Math.max(1, parseInt(inp.value) || 1);
    }));
}

function itensSelecionados() {
    return sugestoes.filter(s => !desmarcados.has(String(s.produto_id)));
}

async function salvarLista() {
    if (!migracaoOk) return mensagem(MSG_MIGRACAO_V3, "danger");
    const itens = itensSelecionados();
    if (itens.length === 0) return alert("Selecione ao menos um item.");
    const titulo = document.getElementById("tituloLista").value.trim() || `Compra ${new Date().toLocaleDateString("pt-BR")}`;
    try {
        await createListaCompra({
            titulo,
            itens: itens.map(s => ({ ...s, quantidade: s.pedir }))
        }, getCurrentUser());
        mensagem(`Lista "${escapeHtml(titulo)}" salva com ${itens.length} item(ns).`, "success");
        await carregarListas();
    } catch (err) {
        mensagem("Erro ao salvar lista: " + escapeHtml(err.message), "danger");
    }
}

async function carregarListas() {
    const tbody = document.getElementById("listasBody");
    if (!migracaoOk) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Disponível após a migração v3.</td></tr>`;
        return;
    }
    try {
        listas = await listListasCompra();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Erro: ${escapeHtml(err.message)}</td></tr>`;
        return;
    }
    const podeEditar = can(user, "compras_edit");
    tbody.innerHTML = listas.map(l => {
        const st = STATUS[l.status] || { label: l.status, badge: "bg-secondary" };
        const ativa = l.status === "aberta" || l.status === "enviada";
        return `
    <tr>
      <td>${l.id}</td>
      <td>${escapeHtml(l.titulo)}</td>
      <td>${escapeHtml(l.criado_por_nome || "-")}</td>
      <td>${formatDateTimeBR(l.criado_em)}</td>
      <td>${l.itens.length}</td>
      <td><span class="badge ${st.badge}">${st.label}</span>${l.recebida_em ? `<br><small class="text-muted">${formatDateBR(l.recebida_em)}</small>` : ""}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary btn-ver" data-id="${l.id}" title="Ver itens"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-secondary btn-csv" data-id="${l.id}" title="CSV"><i class="bi bi-download"></i></button>
        ${podeEditar && l.status === "aberta" ? `<button class="btn btn-sm btn-warning btn-status" data-id="${l.id}" data-status="enviada" title="Marcar pedido como enviado"><i class="bi bi-send"></i></button>` : ""}
        ${podeEditar && ativa ? `<button class="btn btn-sm btn-success btn-receber" data-id="${l.id}" title="Receber: dá entrada no estoque"><i class="bi bi-box-arrow-in-down"></i></button>` : ""}
        ${podeEditar && ativa ? `<button class="btn btn-sm btn-outline-danger btn-status" data-id="${l.id}" data-status="cancelada" title="Cancelar"><i class="bi bi-x-lg"></i></button>` : ""}
      </td>
    </tr>`;
    }).join("") || `<tr><td colspan="7" class="text-center text-muted py-3">Nenhuma lista salva ainda.</td></tr>`;

    const acharLista = (id) => listas.find(l => String(l.id) === String(id));
    tbody.querySelectorAll(".btn-ver").forEach(b => b.addEventListener("click", () => verLista(acharLista(b.dataset.id))));
    tbody.querySelectorAll(".btn-csv").forEach(b => b.addEventListener("click", () => exportarListaCsv(acharLista(b.dataset.id))));
    tbody.querySelectorAll(".btn-status").forEach(b => b.addEventListener("click", () => mudarStatus(acharLista(b.dataset.id), b.dataset.status)));
    tbody.querySelectorAll(".btn-receber").forEach(b => b.addEventListener("click", () => receber(acharLista(b.dataset.id))));
}

function verLista(lista) {
    document.getElementById("modalListaTitulo").textContent = `#${lista.id} — ${lista.titulo}`;
    document.getElementById("modalListaBody").innerHTML = `
    <table class="table table-sm">
      <thead><tr><th>Produto</th><th>Unidade</th><th>Sugerido</th><th>Pedido</th><th>Motivo</th></tr></thead>
      <tbody>${lista.itens.map(i => `
        <tr><td>${escapeHtml(i.produto_nome)}</td><td>${escapeHtml(i.unidade || "-")}</td>
        <td>${i.quantidade_sugerida}</td><td><strong>${i.quantidade}</strong></td><td><small>${escapeHtml(i.motivo || "")}</small></td></tr>`).join("")}
      </tbody>
    </table>`;
    new bootstrap.Modal(document.getElementById("modalLista")).show();
}

async function mudarStatus(lista, status) {
    if (status === "cancelada" && !confirm(`Cancelar a lista "${lista.titulo}"?`)) return;
    try {
        await updateStatusListaCompra(lista.id, status);
        await carregarListas();
    } catch (err) {
        mensagem("Erro ao atualizar lista: " + escapeHtml(err.message), "danger");
    }
}

async function receber(lista) {
    if (!confirm(`Receber a lista "${lista.titulo}"? Será registrada a entrada de ${lista.itens.length} item(ns) no estoque, com as quantidades pedidas.`)) return;
    try {
        const n = await receberListaCompra(lista.id);
        mensagem(`Lista recebida: entrada registrada para ${n} item(ns). Para controlar a validade, informe o lote em Movimentar (QR) nas próximas entradas.`, "success");
        await Promise.all([carregarListas(), carregarSugestoes()]);
    } catch (err) {
        mensagem("Erro ao receber lista: " + escapeHtml(err.message), "danger");
    }
}

function exportarCsv() {
    downloadCsv(`sugestao_compras_${new Date().toISOString().slice(0, 10)}.csv`,
        ["produto", "categoria", "localizacao", "unidade", "estoque", "minimo", "consumo_diario", "vencendo", "sugerido", "pedir", "motivo"],
        itensSelecionados().map(s => [s.nome, s.categoria || "", s.localizacao || "", s.unidade || "", s.quantidade, s.estoque_minimo,
            s.consumo_diario ?? "", s.qtd_vencendo || 0, s.quantidade_sugerida, s.pedir, s.motivo || ""]));
}

function exportarListaCsv(lista) {
    downloadCsv(`lista_compras_${lista.id}.csv`,
        ["produto", "unidade", "sugerido", "pedido", "motivo"],
        lista.itens.map(i => [i.produto_nome, i.unidade || "", i.quantidade_sugerida, i.quantidade, i.motivo || ""]));
}
