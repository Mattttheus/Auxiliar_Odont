// Movimentação por QR/código: lê a etiqueta, mostra o item e sua localização para
// conferência e registra entrada (com lote/validade) ou saída no banco.
import { requirePermission, can } from "./permissions.js";
import { renderShell } from "./layout.js";
import { listProdutos, getProduto, getProdutoByCodigoBarras, listLotes, registrarMovimentacao, listFornecedores } from "./data.js";
import { formatDateBR, escapeHtml, linkProduto } from "./utils.js";
import { estoqueMinimo } from "./alertas.js";
import { iniciarLeitorContinuo, DICA_LEITURA } from "./scanner.js";

let produtosCache = [];
let produtoAtual = null;
let pararLeitor = null;
let tipo = "saida";
let lendo = false; // evita tratar uma nova leitura enquanto a anterior ainda é registrada
const sessao = [];

const user = await requirePermission("movimentar");
if (user) {
    renderShell("movimentar.html", user);
    await init();
}

async function init() {
    const podeEntrada = can(user, "entrada");
    const podeSaida = can(user, "saida");
    document.getElementById("tipoEntrada").disabled = !podeEntrada;
    document.getElementById("tipoSaida").disabled = !podeSaida;

    const pedido = new URLSearchParams(window.location.search).get("tipo");
    tipo = (pedido === "entrada" && podeEntrada) || !podeSaida ? "entrada" : "saida";
    document.getElementById(tipo === "entrada" ? "tipoEntrada" : "tipoSaida").checked = true;
    document.querySelectorAll("input[name=tipoMov]").forEach(r => r.addEventListener("change", () => {
        tipo = r.value;
        aplicarTipo();
    }));
    aplicarTipo();

    document.getElementById("dicaLeitura").textContent = DICA_LEITURA;
    document.getElementById("btnCamera").addEventListener("click", alternarCamera);
    document.getElementById("btnBuscarCodigo").addEventListener("click", buscarCodigoManual);
    document.getElementById("codigoManual").addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); buscarCodigoManual(); }
    });
    document.getElementById("buscaNome").addEventListener("change", buscarPorNome);
    document.getElementById("formMov").addEventListener("submit", e => { e.preventDefault(); confirmar(); });
    document.getElementById("btnCancelar").addEventListener("click", limparProduto);
    window.addEventListener("pagehide", () => pararLeitor?.());

    try {
        produtosCache = await listProdutos();
        document.getElementById("listaProdutos").innerHTML = produtosCache
            .map(p => `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.codigo_barras || "")} ${escapeHtml(p.localizacao || "")}</option>`)
            .join("");
    } catch (err) {
        mostrarStatus("Erro ao carregar produtos: " + err.message);
    }
    // Fornecedor na entrada alimenta a avaliação de fornecedores; o custo, só o administrador informa.
    if (can(user, "compras")) {
        listFornecedores().then(lista => {
            document.getElementById("movFornecedor").innerHTML = `<option value="">Não informado</option>`
                + lista.filter(f => Number(f.ativo) === 1).map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join("");
        }).catch(() => {});
    }
    document.getElementById("codigoManual").focus();
}

function aplicarTipo() {
    const entrada = tipo === "entrada";
    document.querySelectorAll(".campo-entrada").forEach(el => el.classList.toggle("d-none", !entrada));
    document.querySelectorAll(".campo-custo").forEach(el => el.classList.toggle("d-none", !entrada || !can(user, "financeiro")));
    const btn = document.getElementById("btnConfirmar");
    btn.className = `btn btn-lg flex-grow-1 ${entrada ? "btn-success" : "btn-danger"}`;
    btn.innerHTML = entrada
        ? `<i class="bi bi-box-arrow-in-down"></i> Confirmar entrada`
        : `<i class="bi bi-box-arrow-up"></i> Confirmar saída`;
    document.getElementById("modoRapido").disabled = entrada;
}

function mostrarStatus(msg, tipoAlerta = "warning", link = null) {
    const el = document.getElementById("leitorStatus");
    el.className = `alert alert-${tipoAlerta} small mb-2`;
    el.textContent = msg;
    if (link) {
        const a = document.createElement("a");
        a.href = link.href;
        a.className = "alert-link ms-1";
        a.textContent = link.texto;
        el.append(a);
    }
}

async function alternarCamera() {
    const btn = document.getElementById("btnCamera");
    if (pararLeitor) {
        await pararLeitor();
        pararLeitor = null;
        btn.innerHTML = `<i class="bi bi-camera-video"></i> Iniciar câmera`;
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        return mostrarStatus("Este navegador não permite acesso à câmera aqui (é preciso HTTPS). Use o código manual.");
    }
    try {
        btn.disabled = true;
        pararLeitor = await iniciarLeitorContinuo("leitorQr", aoLerCodigo);
        btn.innerHTML = `<i class="bi bi-stop-circle"></i> Parar câmera`;
        document.getElementById("leitorStatus").classList.add("d-none");
    } catch (err) {
        pararLeitor = null;
        mostrarStatus("Não foi possível acessar a câmera (" + (err.message || err) + "). Use o código manual.");
    } finally {
        btn.disabled = false;
    }
}

async function aoLerCodigo(codigo) {
    if (lendo) return;
    lendo = true;
    try {
        const produto = await localizarPorCodigo(codigo);
        if (!produto) return;
        await mostrarProduto(produto);
        if (tipo === "saida" && document.getElementById("modoRapido").checked) {
            document.getElementById("movQtd").value = 1;
            await confirmar();
        }
    } finally {
        lendo = false;
    }
}

async function localizarPorCodigo(codigo) {
    codigo = codigo.trim();
    if (!codigo) return null;
    try {
        const produto = await getProdutoByCodigoBarras(codigo);
        if (!produto) {
            window.playBeep?.("red");
            mostrarStatus(`Nenhum produto com o código "${codigo}". Confira a etiqueta ou cadastre o código em Produtos.`);
            return null;
        }
        window.playBeep?.("ok");
        document.getElementById("leitorStatus").classList.add("d-none");
        return produto;
    } catch (err) {
        mostrarStatus("Erro ao buscar produto: " + err.message);
        return null;
    }
}

async function buscarCodigoManual() {
    const input = document.getElementById("codigoManual");
    const produto = await localizarPorCodigo(input.value);
    if (produto) {
        input.value = "";
        await mostrarProduto(produto);
    }
}

async function buscarPorNome(e) {
    const nome = e.target.value.trim().toLowerCase();
    const produto = produtosCache.find(p => p.nome.toLowerCase() === nome);
    if (produto) {
        e.target.value = "";
        await mostrarProduto(produto);
    }
}

async function mostrarProduto(produto) {
    produtoAtual = produto;
    document.getElementById("cardVazio").classList.add("d-none");
    document.getElementById("cardProduto").classList.remove("d-none");
    document.getElementById("pCodigo").textContent = produto.codigo_barras ? `Código ${produto.codigo_barras}` : "Sem código cadastrado";
    document.getElementById("pNome").innerHTML = linkProduto(produto);
    document.getElementById("pLocal").textContent = produto.localizacao || "Localização não informada";
    document.getElementById("pEstoque").textContent = `${produto.quantidade} ${produto.unidade || ""}`;
    document.getElementById("pMinimo").textContent = `Mínimo: ${estoqueMinimo(produto)}`;
    document.getElementById("movQtd").value = 1;
    document.getElementById("movLote").value = "";
    document.getElementById("movValidade").value = "";
    document.getElementById("movCusto").value = "";
    document.getElementById("movObs").value = "";
    document.getElementById("movQtd").focus();
    document.getElementById("movQtd").select();

    const lotesEl = document.getElementById("pLotes");
    lotesEl.innerHTML = "";
    const lotes = await listLotes(produto.id);
    if (lotes.length) {
        lotesEl.innerHTML = `<i class="bi bi-layers"></i> Lotes: ` + lotes.map((l, i) =>
            `<span class="badge ${i === 0 ? "bg-secondary" : "bg-light text-dark"} me-1">${escapeHtml(l.lote)} · ${formatDateBR(l.validade)} · ${l.quantidade} un.</span>`
        ).join("") + ` <span class="text-muted">(a saída consome primeiro o que vence antes)</span>`;
    }
}

function limparProduto() {
    produtoAtual = null;
    document.getElementById("cardProduto").classList.add("d-none");
    document.getElementById("cardVazio").classList.remove("d-none");
    document.getElementById("codigoManual").focus();
}

async function confirmar() {
    if (!produtoAtual) return;
    const quantidade = parseInt(document.getElementById("movQtd").value);
    if (!quantidade || quantidade <= 0) return alert("Informe uma quantidade válida.");
    const btn = document.getElementById("btnConfirmar");
    btn.disabled = true;
    try {
        const novoEstoque = await registrarMovimentacao({
            produto: produtoAtual,
            tipo,
            quantidade,
            observacao: document.getElementById("movObs").value.trim() || (tipo === "entrada" ? "Entrada via QR" : "Saída via QR"),
            lote: tipo === "entrada" ? document.getElementById("movLote").value.trim() : null,
            validade: tipo === "entrada" ? document.getElementById("movValidade").value : null,
            fornecedorId: tipo === "entrada" ? document.getElementById("movFornecedor").value : null,
            custoUnitario: tipo === "entrada" && can(user, "financeiro") ? document.getElementById("movCusto").value : null,
            origem: "qr"
        });
        sessao.unshift({ hora: new Date(), tipo, nome: produtoAtual.nome, quantidade, estoque: novoEstoque });
        renderSessao();
        const atualizado = await getProduto(produtoAtual.id);
        if (atualizado) {
            const i = produtosCache.findIndex(p => String(p.id) === String(atualizado.id));
            if (i >= 0) produtosCache[i] = atualizado;
            if (atualizado.quantidade <= estoqueMinimo(atualizado)) {
                mostrarStatus(`"${atualizado.nome}" ficou com ${atualizado.quantidade} un., no mínimo ou abaixo.`, "info",
                    can(user, "compras") ? { href: "compras.html", texto: "Abrir a Lista de Compras" } : null);
            }
        }
        limparProduto();
    } catch (err) {
        window.playBeep?.("red");
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
}

function renderSessao() {
    document.getElementById("sessaoBody").innerHTML = sessao.map(s => `
    <tr>
      <td>${s.hora.toLocaleTimeString("pt-BR")}</td>
      <td><span class="badge ${s.tipo === "entrada" ? "bg-success" : "bg-danger"}">${s.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
      <td>${escapeHtml(s.nome)}</td>
      <td>${s.quantidade}</td>
      <td>${s.estoque ?? "-"}</td>
    </tr>`).join("");
}
