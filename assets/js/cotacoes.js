// Cotações (administrador): cria a solicitação e a envia por e-mail aos fornecedores, registra
// os preços respondidos no quadro e conclui gerando uma lista de compra por vencedor.
import { requirePermission } from "./permissions.js";
import { renderShell } from "./layout.js";
import {
    listCotacoes, criarCotacao, reenviarCotacao, salvarPrecosCotacao, concluirCotacao, cancelarCotacao,
    listFornecedores, listProdutos, getPlanejamento
} from "./data.js";
import { formatDateBR, formatDateTimeBR, formatNumBR, reais, escapeHtml } from "./utils.js";

const STATUS = { aberta: ["Aguardando preços", "bg-warning text-dark"], concluida: ["Concluída", "bg-success"], cancelada: ["Cancelada", "bg-secondary"] };

let cotacoes = [];
let fornecedores = [];
let produtos = [];
let novaItens = [];
let aberta = null;

const user = await requirePermission("financeiro");
if (user) {
    renderShell("cotacoes.html", user);
    document.getElementById("btnNova").addEventListener("click", () => abrirNova());
    document.getElementById("btnFecharNova").addEventListener("click", () => document.getElementById("cardNova").classList.add("d-none"));
    document.getElementById("btnAddItem").addEventListener("click", incluirItem);
    document.getElementById("novaProduto").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); incluirItem(); } });
    document.getElementById("btnIndicativas").addEventListener("click", usarIndicativas);
    document.getElementById("formNova").addEventListener("submit", enviarNova);
    [fornecedores, produtos] = await Promise.all([listFornecedores(), listProdutos()]);
    document.getElementById("listaProdutos").innerHTML = produtos.map(p => `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.codigo_barras || "")}</option>`).join("");
    // O Planejamento abre esta tela com os itens de uma janela já escolhidos.
    if (new URLSearchParams(window.location.search).get("nova")) {
        try {
            const vindo = JSON.parse(sessionStorage.getItem("auxiliarOdontCotacao") || "null");
            sessionStorage.removeItem("auxiliarOdontCotacao");
            if (vindo) abrirNova(vindo.titulo, vindo.itens);
        } catch { /* sem itens vindos do planejamento */ }
    }
    await carregar();
}

function mensagem(html, tipo = "warning") {
    document.getElementById("msgContainer").innerHTML = html ? `<div class="alert alert-${tipo} alert-dismissible">${html}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button></div>` : "";
}

// ---------- NOVA COTAÇÃO ----------
function abrirNova(titulo = null, itens = []) {
    document.getElementById("cardNova").classList.remove("d-none");
    document.getElementById("novaTitulo").value = titulo || `Cotação ${new Date().toLocaleDateString("pt-BR")}`;
    const prazo = new Date();
    prazo.setDate(prazo.getDate() + 3);
    document.getElementById("novaPrazo").value = prazo.toISOString().slice(0, 10);
    novaItens = itens.map(i => ({ produto_id: i.produto_id, nome: i.nome, unidade: i.unidade, quantidade: i.quantidade }));
    const aptos = fornecedores.filter(f => Number(f.ativo) === 1);
    document.getElementById("novaFornecedores").innerHTML = aptos.map(f => `
      <div class="form-check">
        <input class="form-check-input sel-fornecedor" type="checkbox" value="${f.id}" id="nf${f.id}" ${f.email ? "checked" : "disabled"}>
        <label class="form-check-label" for="nf${f.id}">${escapeHtml(f.nome)} <small class="text-muted">${f.email ? escapeHtml(f.email) : "sem e-mail"}</small></label>
      </div>`).join("") || `<p class="text-muted small mb-0">Nenhum fornecedor ativo. <a href="fornecedores.html">Cadastre fornecedores</a>.</p>`;
    renderNovaItens();
    document.getElementById("cardNova").scrollIntoView({ behavior: "smooth" });
}

function renderNovaItens() {
    document.getElementById("novaItens").innerHTML = novaItens.map((i, k) => `
      <tr><td>${escapeHtml(i.nome)} <small class="text-muted">${escapeHtml(i.unidade || "")}</small></td>
      <td><input type="number" class="form-control form-control-sm inp-qtd" min="1" value="${i.quantidade}" data-k="${k}" aria-label="Quantidade de ${escapeHtml(i.nome)}"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger btn-tirar" data-k="${k}" title="Tirar"><i class="bi bi-x"></i></button></td></tr>`).join("")
        || `<tr><td colspan="3" class="text-muted small">Nenhum item. Inclua produtos ou use as compras de 30 dias do planejamento.</td></tr>`;
    document.querySelectorAll(".inp-qtd").forEach(inp => inp.addEventListener("change", () => { novaItens[inp.dataset.k].quantidade = Math.max(1, parseInt(inp.value) || 1); }));
    document.querySelectorAll(".btn-tirar").forEach(b => b.addEventListener("click", () => { novaItens.splice(Number(b.dataset.k), 1); renderNovaItens(); }));
}

function incluirItem() {
    const nome = document.getElementById("novaProduto").value.trim().toLowerCase();
    const p = produtos.find(x => x.nome.toLowerCase() === nome || String(x.codigo_barras || "").toLowerCase() === nome);
    if (!p) return alert("Escolha um produto da lista.");
    const quantidade = Math.max(1, parseInt(document.getElementById("novaQtd").value) || 1);
    const existente = novaItens.find(i => String(i.produto_id) === String(p.id));
    existente ? existente.quantidade += quantidade : novaItens.push({ produto_id: p.id, nome: p.nome, unidade: p.unidade, quantidade });
    document.getElementById("novaProduto").value = "";
    document.getElementById("novaQtd").value = 1;
    renderNovaItens();
}

async function usarIndicativas() {
    try {
        const plano = await getPlanejamento(180, 0);
        const itens = plano.produtos.filter(p => p.horizontes[0].compra > 0)
            .map(p => ({ produto_id: p.produto_id, nome: p.nome, unidade: p.unidade, quantidade: p.horizontes[0].compra }));
        if (!itens.length) return alert("O planejamento não tem compras para os próximos 30 dias.");
        novaItens = itens;
        renderNovaItens();
    } catch (err) {
        alert(err.message);
    }
}

async function enviarNova(e) {
    e.preventDefault();
    if (!novaItens.length) return alert("Inclua ao menos um item.");
    const selecionados = [...document.querySelectorAll(".sel-fornecedor:checked")].map(c => Number(c.value));
    if (!selecionados.length) return alert("Escolha ao menos um fornecedor com e-mail.");
    const btn = e.submitter;
    btn.disabled = true;
    try {
        const r = await criarCotacao({
            titulo: document.getElementById("novaTitulo").value.trim(),
            prazo_resposta: document.getElementById("novaPrazo").value || null,
            observacao: document.getElementById("novaObs").value.trim() || null,
            itens: novaItens.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
            fornecedores: selecionados
        });
        document.getElementById("cardNova").classList.add("d-none");
        mensagem(`Cotação #${r.id} criada e enviada para ${r.enviados} fornecedor(es)${r.falhas ? `; ${r.falhas} envio(s) falharam: confira o servidor de e-mail em <a class="alert-link" href="financeiro.html#envios">Financeiro → Envios</a> e reenvie` : ""}.`, r.falhas ? "warning" : "success");
        await carregar();
    } catch (err) {
        mensagem("Erro ao criar a cotação: " + escapeHtml(err.message), "danger");
    } finally {
        btn.disabled = false;
    }
}

// ---------- LISTA E QUADRO ----------
async function carregar() {
    try {
        cotacoes = await listCotacoes();
    } catch (err) {
        document.getElementById("cotacoesBody").innerHTML = `<tr><td colspan="8" class="text-danger text-center">Erro: ${escapeHtml(err.message)}</td></tr>`;
        return;
    }
    document.getElementById("cotacoesBody").innerHTML = cotacoes.map(c => {
        const [rotulo, badge] = STATUS[c.status];
        const enviados = c.fornecedores.filter(f => f.enviado_em).length;
        const responderam = c.fornecedores.filter(f => c.itens.some(i => i.precos[f.fornecedor_id] !== undefined)).length;
        const falhas = c.fornecedores.filter(f => f.erro_envio).length;
        return `
        <tr>
          <td>${c.id}</td>
          <td><strong>${escapeHtml(c.titulo)}</strong>${c.origem === "automatico" ? ` <span class="badge bg-info text-dark">automática</span>` : ""}${c.prazo_resposta ? `<br><small class="text-muted">responder até ${formatDateBR(c.prazo_resposta)}</small>` : ""}</td>
          <td>${formatDateTimeBR(c.criado_em)}<br><small class="text-muted">${escapeHtml(c.criado_por_nome || "")}</small></td>
          <td>${c.itens.length}</td>
          <td>${enviados}/${c.fornecedores.length} enviada(s)${falhas ? `<br><small class="text-danger">${falhas} falha(s)</small>` : ""}</td>
          <td>${responderam} de ${c.fornecedores.length}</td>
          <td><span class="badge ${badge}">${rotulo}</span>${c.listas.length ? `<br><small><a href="compras.html">${c.listas.length} lista(s) gerada(s)</a></small>` : ""}</td>
          <td class="no-print"><button class="btn btn-sm btn-outline-primary btn-quadro" data-id="${c.id}"><i class="bi bi-grid-3x3"></i> ${c.status === "aberta" ? "Registrar preços" : "Ver quadro"}</button></td>
        </tr>`;
    }).join("") || `<tr><td colspan="8" class="text-center text-muted py-4">Nenhuma cotação ainda. Clique em "Nova cotação" ou peça uma pelas compras indicativas do Planejamento.</td></tr>`;
    document.querySelectorAll(".btn-quadro").forEach(b => b.addEventListener("click", () => abrirQuadro(cotacoes.find(c => String(c.id) === b.dataset.id))));
}

/** Menor preço de cada item; no empate, o menor prazo de entrega. */
function vencedorDe(item, c) {
    const prazo = (id) => c.fornecedores.find(f => String(f.fornecedor_id) === String(id))?.prazo_entrega_dias ?? Infinity;
    const ids = Object.keys(item.precos);
    if (!ids.length) return null;
    return ids.sort((a, b) => item.precos[a] - item.precos[b] || prazo(a) - prazo(b))[0];
}

function abrirQuadro(c) {
    aberta = c;
    const editavel = c.status === "aberta";
    document.getElementById("quadroTitulo").textContent = `Cotação #${c.id} — ${c.titulo}`;
    document.getElementById("quadroInfo").textContent = editavel
        ? "Digite o preço unitário que cada fornecedor respondeu. O menor preço de cada item fica em verde e vence, a menos que você escolha outro na última coluna."
        : `Cotação ${STATUS[c.status][0].toLowerCase()}${c.concluida_em ? ` em ${formatDateTimeBR(c.concluida_em)}` : ""}.`;
    const fs = c.fornecedores;
    const cabecalho = `<thead><tr><th>Item</th><th>Qtd.</th>${fs.map(f => `
        <th>${escapeHtml(f.nome)}<br><small class="text-muted fw-normal">${f.enviado_em ? `enviada ${formatDateBR(f.enviado_em)}` : f.erro_envio ? `<span class="text-danger" title="${escapeHtml(f.erro_envio)}">falhou</span>` : "não enviada"}</small></th>`).join("")}<th>Vencedor</th></tr></thead>`;
    const linhas = c.itens.map(i => {
        const melhor = vencedorDe(i, c);
        const escolhido = i.fornecedor_escolhido_id ? String(i.fornecedor_escolhido_id) : "";
        return `<tr data-item="${i.id}">
          <td><strong>${escapeHtml(i.produto_nome)}</strong> <small class="text-muted">${escapeHtml(i.unidade || "")}</small></td>
          <td>${formatNumBR(i.quantidade)}</td>
          ${fs.map(f => {
            const preco = i.precos[f.fornecedor_id];
            return `<td class="${String(f.fornecedor_id) === (escolhido || melhor) ? "melhor-preco" : ""}">${editavel
                ? `<input type="number" class="form-control form-control-sm inp-preco" min="0" step="0.01" data-item="${i.id}" data-fornecedor="${f.fornecedor_id}" value="${preco ?? ""}" aria-label="Preço de ${escapeHtml(f.nome)} para ${escapeHtml(i.produto_nome)}">`
                : (preco === undefined ? "-" : reais(preco))}${preco !== undefined ? `<small class="text-muted d-block">total ${reais(preco * i.quantidade)}</small>` : ""}</td>`;
          }).join("")}
          <td>${editavel ? `<select class="form-select form-select-sm sel-escolha" data-item="${i.id}" aria-label="Vencedor de ${escapeHtml(i.produto_nome)}">
              <option value="">Menor preço</option>${fs.map(f => `<option value="${f.fornecedor_id}" ${escolhido === String(f.fornecedor_id) ? "selected" : ""}>${escapeHtml(f.nome)}</option>`).join("")}</select>`
              : escapeHtml(fs.find(f => String(f.fornecedor_id) === escolhido)?.nome || "-")}</td>
        </tr>`;
    }).join("");
    const totais = `<tfoot>
      <tr><th colspan="2">Prazo de entrega (dias)</th>${fs.map(f => `<td>${editavel ? `<input type="number" class="form-control form-control-sm inp-prazo" min="0" max="365" data-fornecedor="${f.fornecedor_id}" value="${f.prazo_entrega_dias ?? ""}" aria-label="Prazo de ${escapeHtml(f.nome)}">` : (f.prazo_entrega_dias ?? "-")}</td>`).join("")}<td></td></tr>
      <tr><th colspan="2">Total dos itens cotados</th>${fs.map(f => `<td>${reais(c.itens.reduce((t, i) => t + (i.precos[f.fornecedor_id] ?? 0) * i.quantidade, 0))}</td>`).join("")}<td></td></tr>
    </tfoot>`;
    document.getElementById("quadroTabela").innerHTML = cabecalho + `<tbody>${linhas}</tbody>` + totais;
    document.getElementById("quadroAcoes").innerHTML = editavel ? `
      <button class="btn btn-outline-danger me-auto" id="btnCancelarCot"><i class="bi bi-x-lg"></i> Cancelar cotação</button>
      <button class="btn btn-outline-secondary" id="btnReenviar"><i class="bi bi-arrow-repeat"></i> Reenviar e-mails</button>
      <button class="btn btn-primary" id="btnSalvarPrecos"><i class="bi bi-save"></i> Salvar preços</button>
      <button class="btn btn-success" id="btnConcluir"><i class="bi bi-check2-all"></i> Concluir e gerar listas</button>`
        : `<button class="btn btn-outline-secondary" data-bs-dismiss="modal">Fechar</button>`;
    if (editavel) {
        document.getElementById("btnSalvarPrecos").addEventListener("click", () => gravarQuadro(false));
        document.getElementById("btnConcluir").addEventListener("click", () => gravarQuadro(true));
        document.getElementById("btnReenviar").addEventListener("click", reenviar);
        document.getElementById("btnCancelarCot").addEventListener("click", cancelar);
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalQuadro")).show();
}

async function gravarQuadro(concluir) {
    const precos = [...document.querySelectorAll(".inp-preco")].map(i => ({ item_id: Number(i.dataset.item), fornecedor_id: Number(i.dataset.fornecedor), preco: i.value === "" ? null : Number(i.value) }));
    const prazos = [...document.querySelectorAll(".inp-prazo")].map(i => ({ fornecedor_id: Number(i.dataset.fornecedor), prazo_entrega_dias: i.value }));
    const escolhas = [...document.querySelectorAll(".sel-escolha")].map(s => ({ item_id: Number(s.dataset.item), fornecedor_id: s.value || null }));
    if (concluir && !confirm("Concluir a cotação? Cada fornecedor vencedor ganha uma lista de compra com o preço cotado. Itens sem preço ficam de fora.")) return;
    try {
        await salvarPrecosCotacao(aberta.id, precos, prazos, escolhas);
        if (concluir) {
            const r = await concluirCotacao(aberta.id);
            bootstrap.Modal.getInstance(document.getElementById("modalQuadro"))?.hide();
            mensagem(`Cotação concluída: ${r.listas.length} lista(s) de compra criada(s). <a class="alert-link" href="compras.html">Abrir a Lista de Compras</a>${r.sem_preco.length ? `. Sem preço, ficaram de fora: ${r.sem_preco.map(escapeHtml).join(", ")}` : ""}.`, "success");
        } else {
            mensagem("Preços salvos.", "success");
        }
        await carregar();
        if (!concluir) abrirQuadro(cotacoes.find(c => c.id === aberta.id));
    } catch (err) {
        alert(err.message);
    }
}

async function reenviar() {
    try {
        const r = await reenviarCotacao(aberta.id);
        mensagem(`Reenviada para ${r.enviados} fornecedor(es)${r.falhas ? `, ${r.falhas} falha(s)` : ""}.`, r.falhas ? "warning" : "success");
        await carregar();
        abrirQuadro(cotacoes.find(c => c.id === aberta.id));
    } catch (err) {
        alert(err.message);
    }
}

async function cancelar() {
    if (!confirm("Cancelar esta cotação? Os fornecedores não são avisados.")) return;
    try {
        await cancelarCotacao(aberta.id);
        bootstrap.Modal.getInstance(document.getElementById("modalQuadro"))?.hide();
        await carregar();
    } catch (err) {
        alert(err.message);
    }
}
