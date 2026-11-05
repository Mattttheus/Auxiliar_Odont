// Lista de compras: sugestão automática (rotina SQL sugerir_lista_compras), critérios
// configuráveis, listas salvas no banco com fornecedor, pedido por e-mail ao fornecedor e
// recebimento que dá entrada no estoque (com o custo pago, quando o administrador informa).
import { requirePermission, can } from "./permissions.js";
import { renderShell } from "./layout.js";
import {
    sugerirListaCompras, getConfiguracoes, updateConfiguracoes,
    listListasCompra, createListaCompra, updateStatusListaCompra, receberListaCompra,
    listFornecedores, definirFornecedorLista, enviarListaAoFornecedor
} from "./data.js";
import { formatDateBR, formatDateTimeBR, downloadCsv, escapeHtml, linkProduto, reais } from "./utils.js";

const STATUS = {
    aberta: { label: "Aberta", badge: "bg-primary" },
    enviada: { label: "Pedido enviado", badge: "bg-warning text-dark" },
    recebida: { label: "Recebida", badge: "bg-success" },
    cancelada: { label: "Cancelada", badge: "bg-secondary" }
};

let sugestoes = [];
let listas = [];
let fornecedores = [];
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

    try {
        fornecedores = await listFornecedores();
    } catch {
        fornecedores = [];
    }
    document.getElementById("fornecedorLista").innerHTML = opcoesFornecedor(null);

    await carregarCriterios();
    await carregarSugestoes();
    await carregarListas();
}

function opcoesFornecedor(selecionado) {
    return `<option value="">Sem fornecedor</option>` + fornecedores
        .filter(f => Number(f.ativo) === 1 || String(f.id) === String(selecionado))
        .map(f => `<option value="${f.id}" ${String(f.id) === String(selecionado) ? "selected" : ""}>${escapeHtml(f.nome)}${f.email ? "" : " (sem e-mail)"}</option>`).join("");
}

// Declarada (e não const): init(), chamado com await no topo do módulo, já a usa.
function fornecedorDe(lista) {
    return fornecedores.find(f => String(f.id) === String(lista.fornecedor_id));
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
        mensagem("Erro ao salvar critérios: " + escapeHtml(err.message), "danger");
    }
}

async function carregarSugestoes() {
    document.getElementById("sugestaoBody").innerHTML =
        `<tr><td colspan="9" class="text-center text-muted py-4">Calculando...</td></tr>`;
    try {
        sugestoes = await sugerirListaCompras();
    } catch (err) {
        document.getElementById("sugestaoBody").innerHTML =
            `<tr><td colspan="9" class="text-center text-danger py-4">Erro: ${escapeHtml(err.message)}</td></tr>`;
        return;
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
      <td><strong>${linkProduto(s)}</strong><br><small class="text-muted">${escapeHtml(s.categoria || "")}${s.localizacao ? ` · ${escapeHtml(s.localizacao)}` : ""}</small></td>
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
    const itens = itensSelecionados();
    if (itens.length === 0) return alert("Selecione ao menos um item.");
    const titulo = document.getElementById("tituloLista").value.trim() || `Compra ${new Date().toLocaleDateString("pt-BR")}`;
    try {
        await createListaCompra({
            titulo,
            fornecedorId: document.getElementById("fornecedorLista").value || null,
            itens: itens.map(s => ({ ...s, quantidade: s.pedir }))
        });
        mensagem(`Lista "${escapeHtml(titulo)}" salva com ${itens.length} item(ns).`, "success");
        await carregarListas();
    } catch (err) {
        mensagem("Erro ao salvar lista: " + escapeHtml(err.message), "danger");
    }
}

async function carregarListas() {
    const tbody = document.getElementById("listasBody");
    try {
        listas = await listListasCompra();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Erro: ${escapeHtml(err.message)}</td></tr>`;
        return;
    }
    const podeEditar = can(user, "compras_edit");
    tbody.innerHTML = listas.map(l => {
        const st = STATUS[l.status] || { label: l.status, badge: "bg-secondary" };
        const ativa = l.status === "aberta" || l.status === "enviada";
        return `
    <tr>
      <td>${l.id}</td>
      <td>${escapeHtml(l.titulo)}${l.cotacao_id ? `<br><small class="text-muted">da cotação #${l.cotacao_id}</small>` : ""}</td>
      <td>${l.fornecedor_nome ? escapeHtml(l.fornecedor_nome) : `<small class="text-muted">-</small>`}</td>
      <td>${escapeHtml(l.criado_por_nome || "-")}</td>
      <td>${formatDateTimeBR(l.criado_em)}</td>
      <td>${l.itens.length}</td>
      <td><span class="badge ${st.badge}">${st.label}</span>${l.recebida_em ? `<br><small class="text-muted">${formatDateBR(l.recebida_em)}</small>` : ""}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary btn-ver" data-id="${l.id}" title="Ver itens"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-secondary btn-csv" data-id="${l.id}" title="CSV"><i class="bi bi-download"></i></button>
        ${podeEditar && ativa && fornecedorDe(l)?.email ? `<button class="btn btn-sm btn-primary btn-email" data-id="${l.id}" title="Enviar o pedido por e-mail a ${escapeHtml(fornecedorDe(l).email)}"><i class="bi bi-envelope"></i></button>` : ""}
        ${podeEditar && l.status === "aberta" ? `<button class="btn btn-sm btn-warning btn-status" data-id="${l.id}" data-status="enviada" title="Marcar pedido como enviado"><i class="bi bi-send"></i></button>` : ""}
        ${podeEditar && ativa ? `<button class="btn btn-sm btn-success btn-receber" data-id="${l.id}" title="Receber: dá entrada no estoque"><i class="bi bi-box-arrow-in-down"></i></button>` : ""}
        ${podeEditar && ativa ? `<button class="btn btn-sm btn-outline-danger btn-status" data-id="${l.id}" data-status="cancelada" title="Cancelar"><i class="bi bi-x-lg"></i></button>` : ""}
      </td>
    </tr>`;
    }).join("") || `<tr><td colspan="8" class="text-center text-muted py-3">Nenhuma lista salva ainda.</td></tr>`;

    const acharLista = (id) => listas.find(l => String(l.id) === String(id));
    tbody.querySelectorAll(".btn-ver").forEach(b => b.addEventListener("click", () => verLista(acharLista(b.dataset.id))));
    tbody.querySelectorAll(".btn-csv").forEach(b => b.addEventListener("click", () => exportarListaCsv(acharLista(b.dataset.id))));
    tbody.querySelectorAll(".btn-status").forEach(b => b.addEventListener("click", () => mudarStatus(acharLista(b.dataset.id), b.dataset.status)));
    tbody.querySelectorAll(".btn-receber").forEach(b => b.addEventListener("click", () => receber(acharLista(b.dataset.id))));
    tbody.querySelectorAll(".btn-email").forEach(b => b.addEventListener("click", () => enviarEmail(acharLista(b.dataset.id), b)));
}

async function enviarEmail(lista, botao) {
    const f = fornecedorDe(lista);
    if (!confirm(`Enviar o pedido "${lista.titulo}" (${lista.itens.length} item(ns), sem preços) para ${f.nome} <${f.email}>?`)) return;
    botao.disabled = true;
    try {
        const email = await enviarListaAoFornecedor(lista.id);
        mensagem(`Pedido enviado para ${escapeHtml(email)} e marcado como enviado.`, "success");
        await carregarListas();
    } catch (err) {
        mensagem("O envio falhou: " + escapeHtml(err.message), "danger");
        botao.disabled = false;
    }
}

function verLista(lista) {
    const ativa = lista.status === "aberta" || lista.status === "enviada";
    const comPreco = can(user, "financeiro");
    document.getElementById("modalListaTitulo").textContent = `#${lista.id} — ${lista.titulo}`;
    document.getElementById("modalListaBody").innerHTML = `
    ${can(user, "compras_edit") && ativa ? `
    <div class="d-flex gap-2 align-items-end mb-3">
      <div><label class="form-label small mb-1" for="fornecedorModal">Fornecedor</label>
      <select class="form-select form-select-sm" id="fornecedorModal">${opcoesFornecedor(lista.fornecedor_id)}</select></div>
      <button class="btn btn-sm btn-outline-primary" id="btnFornecedorModal"><i class="bi bi-check2"></i> Salvar fornecedor</button>
    </div>` : `<p class="small text-muted">Fornecedor: ${escapeHtml(lista.fornecedor_nome || "não informado")}</p>`}
    <table class="table table-sm">
      <thead><tr><th>Produto</th><th>Unidade</th><th>Sugerido</th><th>Pedido</th>${comPreco ? "<th>Preço</th>" : ""}<th>Motivo</th></tr></thead>
      <tbody>${lista.itens.map(i => `
        <tr><td>${i.produto_id ? linkProduto({ nome: i.produto_nome }) : escapeHtml(i.produto_nome)}</td><td>${escapeHtml(i.unidade || "-")}</td>
        <td>${i.quantidade_sugerida}</td><td><strong>${i.quantidade}</strong></td>${comPreco ? `<td>${reais(i.preco_unitario === null ? null : Number(i.preco_unitario))}</td>` : ""}<td><small>${escapeHtml(i.motivo || "")}</small></td></tr>`).join("")}
      </tbody>
    </table>`;
    document.getElementById("modalListaRodape").classList.add("d-none");
    document.getElementById("btnFornecedorModal")?.addEventListener("click", async () => {
        try {
            await definirFornecedorLista(lista.id, document.getElementById("fornecedorModal").value);
            bootstrap.Modal.getInstance(document.getElementById("modalLista"))?.hide();
            await carregarListas();
        } catch (err) {
            alert(err.message);
        }
    });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalLista")).show();
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

/** O administrador informa o custo pago (vem preenchido com o preço da cotação); os demais só confirmam. */
async function receber(lista) {
    if (can(user, "financeiro")) return abrirRecebimento(lista);
    if (!confirm(`Receber a lista "${lista.titulo}"? Será registrada a entrada de ${lista.itens.length} item(ns) no estoque, com as quantidades pedidas.`)) return;
    await concluirRecebimento(lista, null);
}

function abrirRecebimento(lista) {
    document.getElementById("modalListaTitulo").textContent = `Receber #${lista.id} — ${lista.titulo}`;
    document.getElementById("modalListaBody").innerHTML = `
    <p class="small text-muted">Confira as quantidades e informe o custo unitário pago. Ele entra no custo médio do produto e é a base do gasto previsto. Em branco, a entrada fica sem custo${lista.cotacao_id ? " (os valores já vêm da cotação)" : ""}.</p>
    <table class="table table-sm align-middle">
      <thead><tr><th>Produto</th><th>Quantidade</th><th style="width:150px">Custo unitário (R$)</th></tr></thead>
      <tbody>${lista.itens.filter(i => i.produto_id).map(i => `
        <tr><td>${escapeHtml(i.produto_nome)}</td><td>${i.quantidade} ${escapeHtml(i.unidade || "")}</td>
        <td><input type="number" class="form-control form-control-sm inp-custo-receber" min="0" step="0.01" data-item="${i.id}" value="${i.preco_unitario ?? ""}" aria-label="Custo de ${escapeHtml(i.produto_nome)}"></td></tr>`).join("")}
      </tbody>
    </table>`;
    const rodape = document.getElementById("modalListaRodape");
    rodape.classList.remove("d-none");
    rodape.innerHTML = `<button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-success" id="btnConfirmarReceber"><i class="bi bi-box-arrow-in-down"></i> Dar entrada no estoque</button>`;
    document.getElementById("btnConfirmarReceber").addEventListener("click", async () => {
        const precos = {};
        document.querySelectorAll(".inp-custo-receber").forEach(inp => { if (inp.value !== "") precos[inp.dataset.item] = Number(inp.value); });
        bootstrap.Modal.getInstance(document.getElementById("modalLista"))?.hide();
        await concluirRecebimento(lista, precos);
    });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalLista")).show();
}

async function concluirRecebimento(lista, precos) {
    try {
        const n = await receberListaCompra(lista.id, precos);
        mensagem(`Lista recebida: entrada registrada para ${n} item(ns). <a class="alert-link" href="historico.html">Ver no Histórico</a>. Para controlar a validade, informe o lote nas próximas entradas em <a class="alert-link" href="movimentar.html?tipo=entrada">Movimentar (QR)</a>.`, "success");
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
