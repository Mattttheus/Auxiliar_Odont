// Lógica da página de Produtos: listagem, filtros, CRUD, entrada/saída, lotes e exportação CSV.
import { requireAuth, getCurrentUser } from "./auth.js";
import { renderShell } from "./layout.js";
import {
    listProdutos, createProduto, updateProduto, deleteProduto,
    registrarEntrada, registrarSaida, getProdutoByCodigoBarras,
    getConfiguracoes, listLotes, isMigracaoPendente, MSG_MIGRACAO_V3
} from "./data.js";
import { formatDateBR, formatMoneyBR, downloadCsv, escapeHtml, toDateInputValue } from "./utils.js";
import { can } from "./permissions.js";
import { abrirScanner } from "./scanner.js";
import { estoqueMinimo, statusProduto } from "./alertas.js";

const user = await requireAuth();
if (user) {
    renderShell("produtos.html", user);

    const podeEditar = can(user, "produtos_edit");
    const podeEntrada = can(user, "entrada");
    const podeSaida = can(user, "saida");

    document.getElementById("btnNovoProduto").classList.toggle("d-none", !podeEditar);

    let produtosCache = [];
    let cfg = { dias_alerta_validade: 30 };
    let filtroAtual = "todos";

    // O id vem do banco como número, mas de <select>/data-* como texto.
    const acharProduto = (id) => produtosCache.find(p => String(p.id) === String(id));

    async function init() {
        const params = new URLSearchParams(window.location.search);
        filtroAtual = params.get("filter") || "todos";
        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.filter === filtroAtual);
            btn.addEventListener("click", () => {
                filtroAtual = btn.dataset.filter;
                document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                renderTabela();
            });
        });
        document.getElementById("filtroBusca").value = params.get("q") || "";
        document.getElementById("filtroBusca").addEventListener("input", renderTabela);
        document.getElementById("filtroCategoria").addEventListener("change", renderTabela);

        // Botões registrados ANTES do carregamento: se listProdutos() falhar (rede,
        // RLS, schema desatualizado), a tela não deve travar sem nenhum botão responder.
        document.getElementById("btnNovoProduto").addEventListener("click", abrirModalNovoProduto);
        document.getElementById("formProduto").addEventListener("submit", salvarProduto);
        document.getElementById("formEntrada").addEventListener("submit", salvarEntrada);
        document.getElementById("formSaida").addEventListener("submit", salvarSaida);
        document.getElementById("btnExportCsv").addEventListener("click", exportarCsv);

        document.getElementById("modalEntrada").addEventListener("show.bs.modal", preencherSelects);
        document.getElementById("modalSaida").addEventListener("show.bs.modal", preencherSelects);

        document.getElementById("btnScanProduto")?.addEventListener("click", () => {
            abrirScanner(codigo => { document.getElementById("produtoCodigoBarras").value = codigo; });
        });
        document.getElementById("btnScanEntrada")?.addEventListener("click", () => escanearParaSelect("entradaProdutoId", "entradaQuantidade"));
        document.getElementById("btnScanSaida")?.addEventListener("click", () => escanearParaSelect("saidaProdutoId", "saidaQuantidade"));

        try {
            cfg = await getConfiguracoes();
            document.getElementById("labelPrestes").textContent = `Vencem em ${cfg.dias_alerta_validade} dias`;
            await carregarProdutos();
        } catch (err) {
            console.error(err);
            document.getElementById("produtosTableBody").innerHTML =
                `<tr><td colspan="10" class="text-center text-danger py-4">Erro ao carregar produtos: ${escapeHtml(err.message)}</td></tr>`;
            return;
        }

        const acao = params.get("acao");
        if (acao === "entrada" && podeEntrada) new bootstrap.Modal(document.getElementById("modalEntrada")).show();
        if (acao === "saida" && podeSaida) new bootstrap.Modal(document.getElementById("modalSaida")).show();
    }

    async function escanearParaSelect(selectId, focusId) {
        abrirScanner(async codigo => {
            try {
                const produto = await getProdutoByCodigoBarras(codigo);
                if (!produto) { alert("Nenhum produto encontrado com o código: " + codigo); return; }
                const select = document.getElementById(selectId);
                if (![...select.options].some(o => o.value === String(produto.id))) preencherSelects();
                select.value = produto.id;
                document.getElementById(focusId)?.focus();
            } catch (err) {
                alert("Erro ao buscar produto: " + err.message);
            }
        });
    }

    await init();


    async function carregarProdutos() {
        produtosCache = await listProdutos();
        preencherCategorias();
        renderStats();
        renderTabela();
    }

    function preencherCategorias() {
        const sel = document.getElementById("filtroCategoria");
        const atual = sel.value;
        const categorias = [...new Set(produtosCache.map(p => p.categoria).filter(Boolean))].sort();
        sel.innerHTML = `<option value="">Todas as categorias</option>` +
            categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
        sel.value = atual;
        document.getElementById("categoriasSugeridas")?.remove();
        const lista = document.createElement("datalist");
        lista.id = "categoriasSugeridas";
        lista.innerHTML = categorias.map(c => `<option value="${escapeHtml(c)}">`).join("");
        document.body.appendChild(lista);
        document.getElementById("produtoCategoria").setAttribute("list", "categoriasSugeridas");
    }

    function renderStats() {
        const status = produtosCache.map(p => statusProduto(p, cfg));
        document.getElementById("statTotal").textContent = produtosCache.length;
        document.getElementById("statVencidos").textContent = status.filter(s => s.vencido).length;
        document.getElementById("statPrestes").textContent = status.filter(s => s.vencendo).length;
        document.getElementById("statBaixo").textContent = status.filter(s => s.baixo).length;
    }

    function filtrarProdutos() {
        const busca = document.getElementById("filtroBusca").value.trim().toLowerCase();
        const categoria = document.getElementById("filtroCategoria").value;
        return produtosCache.filter(p => {
            const s = statusProduto(p, cfg);
            if (filtroAtual === "vencidos" && !s.vencido) return false;
            if (filtroAtual === "prestes" && !s.vencendo) return false;
            if (filtroAtual === "baixo" && !s.baixo) return false;
            if (categoria && p.categoria !== categoria) return false;
            if (busca) {
                const texto = [p.nome, p.descricao, p.codigo_barras, p.localizacao, p.categoria].join(" ").toLowerCase();
                if (!texto.includes(busca)) return false;
            }
            return true;
        });
    }

    function renderTabela() {
        const tbody = document.getElementById("produtosTableBody");
        const lista = filtrarProdutos();

        tbody.innerHTML = lista.map(p => {
            const s = statusProduto(p, cfg);
            let statusBadge = `<span class="badge bg-success">OK</span>`;
            if (s.vencido) statusBadge = `<span class="badge bg-danger">Vencido</span>`;
            else if (s.vencendo) statusBadge = `<span class="badge bg-warning text-dark">Vence em ${Math.ceil(s.dias)}d</span>`;
            if (s.zerado) statusBadge += ` <span class="badge bg-dark">Zerado</span>`;
            else if (s.baixo) statusBadge += ` <span class="badge bg-info text-dark">Baixo</span>`;

            return `
    <tr>
      <td><small class="text-muted">${escapeHtml(p.codigo_barras || "-")}</small></td>
      <td>${escapeHtml(p.nome)}${p.descricao ? `<br><small class="text-muted">${escapeHtml(p.descricao)}</small>` : ""}</td>
      <td>${escapeHtml(p.categoria || "-")}</td>
      <td>${escapeHtml(p.localizacao || "-")}</td>
      <td>R$ ${formatMoneyBR(p.preco)}</td>
      <td class="${s.baixo ? "low-stock" : ""}">${p.quantidade} <small class="text-muted">${escapeHtml(p.unidade || "")}</small></td>
      <td>${estoqueMinimo(p)}</td>
      <td>${formatDateBR(p.validade)}</td>
      <td>${statusBadge}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-secondary btn-lotes" data-id="${p.id}" title="Lotes e validades"><i class="bi bi-layers"></i></button>
        ${can(user, "etiquetas") ? `<a class="btn btn-sm btn-outline-dark" href="etiquetas.html?ids=${p.id}" title="Etiqueta QR"><i class="bi bi-qr-code"></i></a>` : ""}
        ${podeEditar ? `
        <button class="btn btn-sm btn-primary btn-editar" data-id="${p.id}" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger btn-deletar" data-id="${p.id}" title="Excluir"><i class="bi bi-trash"></i></button>` : ""}
      </td>
    </tr>`;
        }).join("") || `<tr><td colspan="10" class="text-center text-muted py-4">Nenhum produto encontrado.</td></tr>`;

        tbody.querySelectorAll(".btn-lotes").forEach(btn =>
            btn.addEventListener("click", () => abrirModalLotes(btn.dataset.id)));
        tbody.querySelectorAll(".btn-editar").forEach(btn =>
            btn.addEventListener("click", () => abrirModalEditarProduto(btn.dataset.id)));
        tbody.querySelectorAll(".btn-deletar").forEach(btn =>
            btn.addEventListener("click", () => excluirProduto(btn.dataset.id)));
    }

    async function abrirModalLotes(id) {
        const p = acharProduto(id);
        if (!p) return;
        document.getElementById("modalLotesTitulo").textContent = `Lotes — ${p.nome}`;
        const body = document.getElementById("modalLotesBody");
        body.innerHTML = `<div class="text-center text-muted py-3">Carregando...</div>`;
        new bootstrap.Modal(document.getElementById("modalLotes")).show();
        try {
            const lotes = await listLotes(p.id);
            const somaLotes = lotes.reduce((t, l) => t + l.quantidade, 0);
            const semLote = Math.max(0, Number(p.quantidade) - somaLotes);
            body.innerHTML = `
            <p class="mb-2"><strong>Localização:</strong> ${escapeHtml(p.localizacao || "não informada")}
              · <strong>Estoque:</strong> ${p.quantidade} ${escapeHtml(p.unidade || "")}</p>
            ${lotes.length ? `
            <table class="table table-sm align-middle">
              <thead><tr><th>Lote</th><th>Validade</th><th>Qtd</th><th></th></tr></thead>
              <tbody>${lotes.map((l, i) => {
                  const s = statusProduto({ ...l, validade: l.validade }, cfg);
                  const badge = s.vencido ? `<span class="badge bg-danger">Vencido</span>`
                      : s.vencendo ? `<span class="badge bg-warning text-dark">Vence em ${Math.ceil(s.dias)}d</span>` : "";
                  return `<tr><td>${escapeHtml(l.lote)}${i === 0 ? ` <span class="badge bg-secondary">sai primeiro</span>` : ""}</td>
                    <td>${formatDateBR(l.validade)}</td><td>${l.quantidade}</td><td>${badge}</td></tr>`;
              }).join("")}</tbody>
            </table>` : `<p class="text-muted">Nenhum lote registrado. Informe lote e validade ao dar entrada para acompanhar a validade por lote.</p>`}
            ${semLote > 0 && lotes.length ? `<p class="small text-muted mb-0">${semLote} unidade(s) sem lote identificado.</p>` : ""}
            <p class="small text-muted mb-0">As saídas consomem primeiro o lote que vence antes (FEFO).</p>`;
        } catch (err) {
            body.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
        }
    }

    function abrirModalNovoProduto() {
        document.getElementById("modalProdutoTitle").textContent = "Novo Produto";
        document.getElementById("formProduto").reset();
        document.getElementById("produtoId").value = "";
        new bootstrap.Modal(document.getElementById("modalProduto")).show();
    }

    function abrirModalEditarProduto(id) {
        const p = acharProduto(id);
        if (!p) return;
        document.getElementById("modalProdutoTitle").textContent = "Editar Produto";
        document.getElementById("produtoId").value = p.id;
        document.getElementById("produtoNome").value = p.nome || "";
        document.getElementById("produtoDescricao").value = p.descricao || "";
        document.getElementById("produtoCategoria").value = p.categoria || "";
        document.getElementById("produtoUnidade").value = p.unidade || "";
        document.getElementById("produtoPreco").value = p.preco || 0;
        document.getElementById("produtoLocalizacao").value = p.localizacao || "";
        document.getElementById("produtoQuantidade").value = p.quantidade || 0;
        document.getElementById("produtoEstoqueMinimo").value = estoqueMinimo(p);
        document.getElementById("produtoValidade").value = toDateInputValue(p.validade);
        document.getElementById("produtoCodigoBarras").value = p.codigo_barras || "";
        new bootstrap.Modal(document.getElementById("modalProduto")).show();
    }

    async function salvarProduto(e) {
        e.preventDefault();
        const id = document.getElementById("produtoId").value;
        const codigoBarras = document.getElementById("produtoCodigoBarras").value.trim();
        const data = {
            nome: document.getElementById("produtoNome").value.trim(),
            descricao: document.getElementById("produtoDescricao").value.trim(),
            categoria: document.getElementById("produtoCategoria").value.trim() || null,
            unidade: document.getElementById("produtoUnidade").value.trim() || null,
            preco: parseFloat(document.getElementById("produtoPreco").value) || 0,
            localizacao: document.getElementById("produtoLocalizacao").value.trim() || null,
            quantidade: parseInt(document.getElementById("produtoQuantidade").value) || 0,
            estoque_minimo: parseInt(document.getElementById("produtoEstoqueMinimo").value) || 0,
            validade: document.getElementById("produtoValidade").value || null,
            codigo_barras: codigoBarras || null
        };

        try {
            if (id) await updateProduto(id, data);
            else await createProduto(data);
            bootstrap.Modal.getInstance(document.getElementById("modalProduto")).hide();
            await carregarProdutos();
        } catch (err) {
            if (isMigracaoPendente(err)) return alert("Erro ao salvar produto: " + MSG_MIGRACAO_V3);
            alert("Erro ao salvar produto: " + (err.message.includes("duplicate") ? "Já existe um produto com esse código de barras." : err.message));
        }
    }

    async function excluirProduto(id) {
        const p = acharProduto(id);
        if (!confirm(`Excluir o produto "${p?.nome}"?`)) return;
        try {
            await deleteProduto(id);
            await carregarProdutos();
        } catch (err) {
            alert("Erro ao excluir produto: " + err.message);
        }
    }

    function preencherSelects() {
        const options = produtosCache
            .map(p => `<option value="${p.id}">${escapeHtml(p.nome)} (estoque: ${p.quantidade})</option>`)
            .join("");
        document.getElementById("entradaProdutoId").innerHTML = options;
        document.getElementById("saidaProdutoId").innerHTML = options;
    }

    async function salvarEntrada(e) {
        e.preventDefault();
        const produto = acharProduto(document.getElementById("entradaProdutoId").value);
        const quantidade = parseInt(document.getElementById("entradaQuantidade").value);
        const observacao = document.getElementById("entradaObservacao").value.trim();
        const lote = document.getElementById("entradaLote").value.trim();
        const validade = document.getElementById("entradaValidade").value;
        if (!produto) return alert("Selecione um produto.");

        try {
            await registrarEntrada(produto, quantidade, observacao, getCurrentUser(), { lote, validade });
            bootstrap.Modal.getInstance(document.getElementById("modalEntrada")).hide();
            document.getElementById("formEntrada").reset();
            await carregarProdutos();
        } catch (err) {
            alert(err.message);
        }
    }

    async function salvarSaida(e) {
        e.preventDefault();
        const produto = acharProduto(document.getElementById("saidaProdutoId").value);
        const quantidade = parseInt(document.getElementById("saidaQuantidade").value);
        const observacao = document.getElementById("saidaObservacao").value.trim();
        if (!produto) return alert("Selecione um produto.");

        try {
            await registrarSaida(produto, quantidade, observacao, getCurrentUser());
            bootstrap.Modal.getInstance(document.getElementById("modalSaida")).hide();
            document.getElementById("formSaida").reset();
            await carregarProdutos();
        } catch (err) {
            alert(err.message);
        }
    }

    function exportarCsv() {
        const rows = produtosCache.map(p => [
            p.id, p.codigo_barras || "", p.nome, p.descricao || "", p.categoria || "", p.localizacao || "", p.unidade || "",
            p.preco, p.quantidade, estoqueMinimo(p), toDateInputValue(p.validade)
        ]);
        downloadCsv("produtos_export.csv",
            ["id", "codigo_barras", "nome", "descricao", "categoria", "localizacao", "unidade", "preco", "quantidade", "estoque_minimo", "validade"],
            rows);
    }
}
