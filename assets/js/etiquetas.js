// Gerador de etiquetas QR a partir do cadastro (código, nome, localização) para as prateleiras.
import { requirePermission, can } from "./permissions.js";
import { renderShell } from "./layout.js";
import { listProdutos, updateProduto } from "./data.js";
import { escapeHtml } from "./utils.js";
import { estoqueMinimo } from "./alertas.js";

let produtosCache = [];
const desmarcados = new Set();
let somenteIds = null;

const user = await requirePermission("etiquetas");
if (user) {
    renderShell("etiquetas.html", user);
    await init();
}

async function init() {
    const ids = new URLSearchParams(window.location.search).get("ids");
    if (ids) somenteIds = new Set(ids.split(","));

    ["fCategoria", "fSituacao", "fTamanho"].forEach(id => document.getElementById(id).addEventListener("change", render));
    document.getElementById("fBusca").addEventListener("input", render);
    document.getElementById("fTodos").addEventListener("change", e => {
        filtrar().forEach(p => e.target.checked ? desmarcados.delete(String(p.id)) : desmarcados.add(String(p.id)));
        render();
    });
    document.getElementById("btnImprimir").addEventListener("click", () => window.print());
    const btnGerar = document.getElementById("btnGerarCodigos");
    btnGerar.classList.toggle("d-none", !can(user, "produtos_edit"));
    btnGerar.addEventListener("click", gerarCodigosFaltantes);

    try {
        await carregar();
    } catch (err) {
        document.getElementById("grid").innerHTML = `<div class="alert alert-danger">Erro ao carregar produtos: ${escapeHtml(err.message)}</div>`;
    }
}

async function carregar() {
    produtosCache = await listProdutos();
    const categorias = [...new Set(produtosCache.map(p => p.categoria).filter(Boolean))].sort();
    const sel = document.getElementById("fCategoria");
    const atual = sel.value;
    sel.innerHTML = `<option value="">Todas as categorias</option>` +
        categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    sel.value = atual;
    render();
}

function filtrar() {
    const categoria = document.getElementById("fCategoria").value;
    const situacao = document.getElementById("fSituacao").value;
    const busca = document.getElementById("fBusca").value.trim().toLowerCase();
    return produtosCache.filter(p => {
        if (somenteIds && !somenteIds.has(String(p.id))) return false;
        if (categoria && p.categoria !== categoria) return false;
        if (situacao === "baixo" && Number(p.quantidade) > estoqueMinimo(p)) return false;
        if (situacao === "semlocal" && p.localizacao) return false;
        if (busca && ![p.nome, p.codigo_barras, p.localizacao].join(" ").toLowerCase().includes(busca)) return false;
        return true;
    });
}

function qrSvg(texto, tamanho) {
    const qr = window.qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
        .replace("<svg ", `<svg style="width:${tamanho}px;height:${tamanho}px" role="img" aria-label="QR ${escapeHtml(texto)}" `);
}

function render() {
    const tamanho = Number(document.getElementById("fTamanho").value);
    const lista = filtrar();
    const comCodigo = lista.filter(p => p.codigo_barras);
    const semCodigo = lista.length - comCodigo.length;

    const aviso = document.getElementById("avisoSemCodigo");
    aviso.classList.toggle("d-none", semCodigo === 0);
    aviso.innerHTML = `${semCodigo} produto(s) sem código não aparecem aqui. ` +
        (can(user, "produtos_edit") ? `Use <strong>Gerar códigos faltantes</strong> ou cadastre o código em Produtos.` : `Peça a um estoquista para cadastrar os códigos.`);

    if (!window.qrcode) {
        document.getElementById("grid").innerHTML = `<div class="alert alert-danger">Não foi possível carregar o gerador de QR Code. Verifique a conexão.</div>`;
        return;
    }

    document.getElementById("grid").innerHTML = comCodigo.map(p => {
        const marcado = !desmarcados.has(String(p.id));
        return `
        <div class="etiqueta ${marcado ? "" : "no-print opacity-50"}">
          <div class="form-check text-start no-print">
            <input class="form-check-input sel-etiqueta" type="checkbox" data-id="${p.id}" ${marcado ? "checked" : ""}>
          </div>
          ${qrSvg(p.codigo_barras, tamanho)}
          <div class="etiqueta-nome">${escapeHtml(p.nome)}</div>
          <div class="etiqueta-info">${escapeHtml(p.codigo_barras)}${p.localizacao ? ` · ${escapeHtml(p.localizacao)}` : ""}</div>
          <div class="etiqueta-info">${escapeHtml(p.categoria || "")}${p.unidade ? ` · ${escapeHtml(p.unidade)}` : ""}</div>
        </div>`;
    }).join("") || `<p class="text-muted">Nenhuma etiqueta para os filtros escolhidos.</p>`;

    document.querySelectorAll(".sel-etiqueta").forEach(cb => cb.addEventListener("change", () => {
        cb.checked ? desmarcados.delete(cb.dataset.id) : desmarcados.add(cb.dataset.id);
        render();
    }));
    const selecionadas = comCodigo.filter(p => !desmarcados.has(String(p.id))).length;
    document.getElementById("contador").textContent = `${selecionadas} de ${comCodigo.length} etiqueta(s) selecionada(s)`;
}

async function gerarCodigosFaltantes() {
    const sem = produtosCache.filter(p => !p.codigo_barras);
    if (sem.length === 0) return alert("Todos os produtos já têm código.");
    if (!confirm(`Gerar código para ${sem.length} produto(s) sem código? Ex.: AO-000123 (baseado no ID).`)) return;
    try {
        for (const p of sem) {
            await updateProduto(p.id, { codigo_barras: `AO-${String(p.id).padStart(6, "0")}` });
        }
        await carregar();
    } catch (err) {
        alert("Erro ao gerar códigos: " + err.message);
    }
}
