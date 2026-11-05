// Fornecedores: cadastro (CNPJ conferido no servidor) e avaliação pelo histórico de compras.
import { requirePermission, can } from "./permissions.js";
import { renderShell } from "./layout.js";
import { listFornecedores, salvarFornecedor, excluirFornecedor } from "./data.js";
import { formatDateBR, formatNumBR, reais, downloadCsv, escapeHtml } from "./utils.js";

let fornecedores = [];

const user = await requirePermission("compras");
const podeEditar = can(user, "compras_edit");
const verCustos = can(user, "financeiro");
if (user) {
    renderShell("fornecedores.html", user);
    document.getElementById("btnNovo").classList.toggle("d-none", !podeEditar);
    document.getElementById("linkCotacoes").classList.toggle("d-none", !verCustos);
    document.querySelectorAll(".col-custo").forEach(el => el.classList.toggle("d-none", !verCustos));
    document.getElementById("btnNovo").addEventListener("click", () => abrir(null));
    document.getElementById("formFornecedor").addEventListener("submit", gravar);
    document.getElementById("busca").addEventListener("input", render);
    document.getElementById("mostrarInativos").addEventListener("change", render);
    document.getElementById("btnCsv").addEventListener("click", exportarCsv);
    document.getElementById("fCnpj").addEventListener("input", e => { e.target.value = mascaraCnpj(e.target.value); });
    document.getElementById("fTelefone").addEventListener("input", e => { e.target.value = mascaraTelefone(e.target.value); });
    await carregar();
}

function mensagem(html, tipo = "warning") {
    document.getElementById("msgContainer").innerHTML = html ? `<div class="alert alert-${tipo}">${html}</div>` : "";
}

function mascaraCnpj(v) {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

function mascaraTelefone(v) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

async function carregar() {
    try {
        fornecedores = await listFornecedores();
    } catch (err) {
        document.getElementById("fornecedoresBody").innerHTML = `<tr><td colspan="9" class="text-danger text-center py-3">Erro: ${escapeHtml(err.message)}</td></tr>`;
        return;
    }
    const ativos = fornecedores.filter(f => Number(f.ativo) === 1);
    const comEmail = ativos.filter(f => f.email);
    const tile = (icone, titulo, valor, detalhe) => `
      <div class="col-6 col-lg-3"><div class="card shadow border-0 rounded-4 p-3 h-100">
        <h6 class="text-muted"><i class="bi ${icone} text-primary"></i> ${titulo}</h6><h3 class="mb-0">${valor}</h3><small class="text-muted">${detalhe}</small></div></div>`;
    const prazos = ativos.filter(f => f.prazo_real_dias !== null).map(f => Number(f.prazo_real_dias));
    document.getElementById("indicadores").innerHTML = [
        tile("bi-truck", "Fornecedores ativos", ativos.length, `${fornecedores.length - ativos.length} inativo(s)`),
        tile("bi-envelope-check", "Recebem cotação", comEmail.length, "Ativos com e-mail: vão na cotação automática"),
        tile("bi-stopwatch", "Prazo real médio", prazos.length ? `${formatNumBR(prazos.reduce((a, b) => a + b, 0) / prazos.length, 1)} dias` : "—", "Da lista criada ao recebimento"),
        verCustos
            ? tile("bi-cash-stack", "Comprado em 12 meses", reais(fornecedores.reduce((t, f) => t + Number(f.comprado_12m || 0), 0)), "Entradas com custo e fornecedor")
            : tile("bi-receipt", "Listas recebidas", fornecedores.reduce((t, f) => t + Number(f.listas_recebidas), 0), "De todos os fornecedores")
    ].join("");
    render();
}

function render() {
    const busca = document.getElementById("busca").value.trim().toLowerCase();
    const inativos = document.getElementById("mostrarInativos").checked;
    const itens = fornecedores.filter(f => (inativos || Number(f.ativo) === 1)
        && (!busca || [f.nome, f.cnpj, f.email, f.contato].some(v => String(v || "").toLowerCase().includes(busca.replace(/[./-]/g, "")) || String(v || "").toLowerCase().includes(busca))));
    document.getElementById("qtdFornecedores").textContent = itens.length;
    document.getElementById("fornecedoresBody").innerHTML = itens.map(f => {
        const atraso = f.prazo_real_dias !== null && f.prazo_entrega_dias !== null && Number(f.prazo_real_dias) > Number(f.prazo_entrega_dias);
        return `
        <tr class="${Number(f.ativo) ? "" : "text-muted"}">
          <td><strong>${escapeHtml(f.nome)}</strong>${Number(f.ativo) ? "" : ` <span class="badge bg-secondary">inativo</span>`}<br><small class="text-muted">${f.cnpj ? mascaraCnpj(f.cnpj) : "sem CNPJ"}${f.condicao_pagamento ? ` · ${escapeHtml(f.condicao_pagamento)}` : ""}</small></td>
          <td><small>${escapeHtml(f.contato || "")}${f.contato ? "<br>" : ""}${f.email ? `<a href="mailto:${escapeHtml(f.email)}">${escapeHtml(f.email)}</a>` : `<span class="text-warning">sem e-mail</span>`}${f.telefone ? `<br>${mascaraTelefone(f.telefone)}` : ""}</small></td>
          <td>${f.prazo_entrega_dias === null ? "-" : `${f.prazo_entrega_dias} dia(s)`}</td>
          <td>${f.prazo_real_dias === null ? "-" : `<span class="${atraso ? "text-danger" : "text-success"}">${formatNumBR(f.prazo_real_dias, 1)} dia(s)</span>`}</td>
          <td>${f.listas_recebidas} recebida(s)${Number(f.listas_abertas) ? `<br><small class="text-muted">${f.listas_abertas} aberta(s)</small>` : ""}</td>
          <td>${f.cotacoes_respondidas}/${f.cotacoes_recebidas}${Number(f.itens_vencidos) ? ` <small class="text-muted">(${f.itens_vencidos} itens ganhos)</small>` : ""}</td>
          ${verCustos ? `<td>${reais(Number(f.comprado_12m))}</td>` : ""}
          <td>${f.ultima_compra ? formatDateBR(f.ultima_compra) : "-"}</td>
          <td class="text-nowrap no-print">${podeEditar ? `
            <button class="btn btn-sm btn-outline-secondary btn-editar" data-id="${f.id}" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-${Number(f.ativo) ? "warning" : "success"} btn-ativo" data-id="${f.id}" title="${Number(f.ativo) ? "Desativar" : "Reativar"}"><i class="bi bi-${Number(f.ativo) ? "pause" : "play"}-fill"></i></button>
            <button class="btn btn-sm btn-outline-danger btn-excluir" data-id="${f.id}" title="Excluir (só sem histórico)"><i class="bi bi-trash"></i></button>` : ""}
          </td>
        </tr>`;
    }).join("") || `<tr><td colspan="9" class="text-center text-muted py-4">Nenhum fornecedor${busca ? " com essa busca" : " cadastrado"}.${podeEditar && !busca ? ` Clique em "Novo fornecedor".` : ""}</td></tr>`;
    const achar = (id) => fornecedores.find(f => String(f.id) === String(id));
    document.querySelectorAll(".btn-editar").forEach(b => b.addEventListener("click", () => abrir(achar(b.dataset.id))));
    document.querySelectorAll(".btn-ativo").forEach(b => b.addEventListener("click", () => alternarAtivo(achar(b.dataset.id))));
    document.querySelectorAll(".btn-excluir").forEach(b => b.addEventListener("click", () => remover(achar(b.dataset.id))));
}

function abrir(f) {
    document.getElementById("modalTitulo").textContent = f ? `Editar ${f.nome}` : "Novo fornecedor";
    document.getElementById("fId").value = f?.id || "";
    document.getElementById("fNome").value = f?.nome || "";
    document.getElementById("fCnpj").value = f?.cnpj ? mascaraCnpj(f.cnpj) : "";
    document.getElementById("fContato").value = f?.contato || "";
    document.getElementById("fEmail").value = f?.email || "";
    document.getElementById("fTelefone").value = f?.telefone ? mascaraTelefone(f.telefone) : "";
    document.getElementById("fEndereco").value = f?.endereco || "";
    document.getElementById("fPrazo").value = f?.prazo_entrega_dias ?? "";
    document.getElementById("fPagamento").value = f?.condicao_pagamento || "";
    document.getElementById("fObs").value = f?.observacao || "";
    document.getElementById("fAtivo").checked = f ? Number(f.ativo) === 1 : true;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalFornecedor")).show();
}

function dadosDe(f) {
    return {
        id: f.id || null, nome: f.nome, cnpj: f.cnpj || "", contato: f.contato || "", email: f.email || "", telefone: f.telefone || "",
        endereco: f.endereco || "", prazo_entrega_dias: f.prazo_entrega_dias ?? "", condicao_pagamento: f.condicao_pagamento || "",
        observacao: f.observacao || "", ativo: Number(f.ativo) ? 1 : 0
    };
}

async function gravar(e) {
    e.preventDefault();
    try {
        await salvarFornecedor({
            id: document.getElementById("fId").value || null,
            nome: document.getElementById("fNome").value.trim(),
            cnpj: document.getElementById("fCnpj").value,
            contato: document.getElementById("fContato").value.trim(),
            email: document.getElementById("fEmail").value.trim(),
            telefone: document.getElementById("fTelefone").value,
            endereco: document.getElementById("fEndereco").value.trim(),
            prazo_entrega_dias: document.getElementById("fPrazo").value,
            condicao_pagamento: document.getElementById("fPagamento").value.trim(),
            observacao: document.getElementById("fObs").value.trim(),
            ativo: document.getElementById("fAtivo").checked ? 1 : 0
        });
        bootstrap.Modal.getInstance(document.getElementById("modalFornecedor"))?.hide();
        mensagem("Fornecedor salvo.", "success");
        await carregar();
    } catch (err) {
        alert(err.message);
    }
}

async function alternarAtivo(f) {
    try {
        await salvarFornecedor({ ...dadosDe(f), ativo: Number(f.ativo) ? 0 : 1 });
        await carregar();
    } catch (err) {
        mensagem(escapeHtml(err.message), "danger");
    }
}

async function remover(f) {
    if (!confirm(`Excluir "${f.nome}"? Só é possível se ele nunca teve compras ou cotações.`)) return;
    try {
        await excluirFornecedor(f.id);
        mensagem("Fornecedor excluído.", "success");
        await carregar();
    } catch (err) {
        mensagem(escapeHtml(err.message), "danger");
    }
}

function exportarCsv() {
    const cabecalho = ["nome", "cnpj", "contato", "email", "telefone", "prazo_informado", "prazo_real", "listas_recebidas", "cotacoes_respondidas", "cotacoes_recebidas", "ultima_compra", "ativo"];
    if (verCustos) cabecalho.push("comprado_12m");
    downloadCsv("fornecedores.csv", cabecalho, fornecedores.map(f => {
        const l = [f.nome, f.cnpj || "", f.contato || "", f.email || "", f.telefone || "", f.prazo_entrega_dias ?? "", f.prazo_real_dias ?? "", f.listas_recebidas, f.cotacoes_respondidas, f.cotacoes_recebidas, f.ultima_compra || "", f.ativo];
        if (verCustos) l.push(f.comprado_12m);
        return l;
    }));
}
