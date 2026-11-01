// Painel do administrador: precedência de todo o estoque na curva ABC (dos produtos mais
// aos menos consumidos) e controle de acesso dos usuários.
import { requirePermission, can, ROLES, PERMISSOES, roleLabel, roleBadgeClass } from "./permissions.js";
import { renderShell } from "./layout.js";
import { listProdutos, listSaidasConsumo, listUsuarios, updateUsuario, conferirSaldos } from "./data.js";
import { downloadCsv, escapeHtml } from "./utils.js";
import { estoqueMinimo, statusEstoque, badgeEstoque } from "./alertas.js";
import { calcularCurvaAbc, LIMITE_A, LIMITE_B } from "./curva-abc.js";

// Estas declarações precisam existir ANTES do bloco abaixo, que roda ainda durante o
// carregamento do módulo. Cores das classes: mesma rampa azul ordenada do custom.css.
const isDark = () => document.body.classList.contains("theme-dark");
const COR = () => isDark()
    ? { A: "#cde2fb", B: "#5598e7", C: "#256abf", area: "rgba(85,152,231,.10)", texto: "#cbd5e1", grade: "rgba(255,255,255,.08)", superficie: "#1e293b" }
    : { A: "#104281", B: "#256abf", C: "#86b6ef", area: "rgba(37,106,191,.10)", texto: "#475569", grade: "rgba(0,0,0,.06)", superficie: "#ffffff" };

const pct = (valor) => `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

let curva = [];
let totalSaidas = 0;
let grafico = null;
let usuarios = [];
let conferencia = [];

const user = await requirePermission("controle");
if (user) {
    renderShell("controle.html", user);
    // Os controles são registrados antes do carregamento: se os dados falharem, o erro
    // aparece na tela e o restante da página continua funcionando.
    document.getElementById("filtroPeriodo").addEventListener("change", carregarCurva);
    document.getElementById("filtroClasse").addEventListener("change", renderTabela);
    document.getElementById("filtroCategoria").addEventListener("change", renderTabela);
    document.getElementById("filtroBusca").addEventListener("input", renderTabela);
    document.getElementById("btnCsv").addEventListener("click", exportarCsv);
    document.getElementById("btnImprimir").addEventListener("click", () => window.print());
    document.getElementById("themeToggle")?.addEventListener("click", renderGrafico);
    document.getElementById("linkCriticos").addEventListener("click", () => {
        document.getElementById("filtroClasse").value = "critico";
        renderTabela();
    });
    document.getElementById("legendaAbc").innerHTML = `
      <span><span class="abc-chave abc-a"></span> Classe A: até ${LIMITE_A}% do consumo</span>
      <span><span class="abc-chave abc-b"></span> Classe B: de ${LIMITE_A}% a ${LIMITE_B}%</span>
      <span><span class="abc-chave abc-c"></span> Classe C: restante, inclui produtos sem saídas</span>`;
    document.getElementById("conferenciaTodos").addEventListener("change", renderConferencia);
    renderMatriz();
    await Promise.all([carregarCurva(), carregarUsuarios(), carregarConferencia()]);
}

function mensagem(html, tipo = "warning") {
    document.getElementById("msgContainer").innerHTML = html ? `<div class="alert alert-${tipo}">${html}</div>` : "";
}

function precisaRepor(produto) {
    return statusEstoque(produto).codigo !== "normal";
}

// ---------- CURVA ABC ----------
async function carregarCurva() {
    const periodo = document.getElementById("filtroPeriodo");
    let inicio = null;
    if (periodo.value !== "todo") {
        inicio = new Date();
        inicio.setHours(0, 0, 0, 0);
        inicio.setDate(inicio.getDate() - (Number(periodo.value) - 1));
    }
    periodo.disabled = true;
    const conteudo = document.getElementById("conteudoAbc");
    try {
        const [produtos, saidas] = await Promise.all([listProdutos(), listSaidasConsumo(inicio)]);
        curva = calcularCurvaAbc(produtos, saidas);
        totalSaidas = saidas.length;
        mensagem("");
        conteudo.classList.remove("d-none");
        renderResumo();
        renderGrafico();
        preencherCategorias();
        renderTabela();
    } catch (err) {
        console.error(err);
        // Esconde o resultado anterior: ele seria lido como se fosse do período escolhido.
        conteudo.classList.add("d-none");
        mensagem("Erro ao calcular a curva ABC: " + escapeHtml(err.message), "danger");
    } finally {
        periodo.disabled = false;
    }
}

function renderResumo() {
    const totalConsumo = curva.reduce((t, i) => t + i.consumo, 0);
    const semConsumo = curva.filter(i => i.consumo === 0).length;
    document.getElementById("baseCurva").textContent =
        `Base do cálculo: ${totalSaidas} saída(s), ${totalConsumo} unidade(s) consumida(s), ${curva.length} produto(s) em estoque.`
        + (totalSaidas > 0 && totalSaidas < curva.length ? " Há menos saídas registradas do que produtos: trate a classificação como preliminar." : "");

    for (const classe of ["A", "B", "C"]) {
        const itens = curva.filter(i => i.classe === classe);
        const consumo = itens.reduce((t, i) => t + i.consumo, 0);
        const pctProdutos = curva.length ? itens.length / curva.length * 100 : 0;
        const pctDoConsumo = totalConsumo ? consumo / totalConsumo * 100 : 0;
        document.getElementById(`qtd${classe}`).textContent = itens.length;
        document.getElementById(`det${classe}`).textContent = `${pct(pctProdutos)} dos produtos, ${pct(pctDoConsumo)} do consumo`
            + (classe === "C" && semConsumo > 0 ? `. ${semConsumo} sem nenhuma saída` : "");
    }

    const criticos = curva.filter(i => i.classe === "A" && precisaRepor(i.produto));
    document.getElementById("qtdCriticos").textContent = criticos.length;
    document.getElementById("detCriticos").textContent =
        `${criticos.filter(i => Number(i.produto.quantidade) === 0).length} sem estoque. Clique para ver na tabela`;
}

function renderGrafico() {
    const temConsumo = curva.some(i => i.consumo > 0);
    document.getElementById("semConsumo").classList.toggle("d-none", temConsumo);
    document.getElementById("boxCurva").classList.toggle("d-none", !temConsumo);
    grafico?.destroy();
    grafico = null;

    const classeA = curva.filter(i => i.classe === "A");
    document.getElementById("subCurva").textContent = temConsumo
        ? `${classeA.length} de ${curva.length} produtos respondem por ${pct(classeA.at(-1).pctAcumulado)} do consumo no período`
        : "Sem consumo no período";
    if (!temConsumo) return;

    const c = COR();
    grafico = new Chart(document.getElementById("chartAbc"), {
        type: "line",
        data: {
            labels: curva.map(i => i.posicao),
            datasets: [{
                label: "% acumulado do consumo",
                data: curva.map(i => i.pctAcumulado),
                borderColor: c.A,
                borderWidth: 2,
                clip: false,
                segment: { borderColor: (ctx) => c[curva[ctx.p1DataIndex].classe] },
                fill: "origin",
                backgroundColor: c.area,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: (ctx) => c[curva[ctx.dataIndex].classe],
                pointHoverBorderColor: c.superficie,
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const i = curva[items[0].dataIndex];
                            return `${i.posicao}º ${i.produto.nome}`;
                        },
                        label: (ctx) => {
                            const i = curva[ctx.dataIndex];
                            return ` Classe ${i.classe}: ${i.consumo} un. consumidas, ${pct(i.pctAcumulado)} acumulado`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "Produtos em ordem de precedência", color: c.texto },
                    ticks: { color: c.texto, maxTicksLimit: 12, maxRotation: 0 },
                    grid: { display: false }
                },
                y: {
                    min: 0,
                    max: 100,
                    // As linhas de grade marcam os limites das classes.
                    afterBuildTicks: (axis) => { axis.ticks = [0, 20, 40, 60, LIMITE_A, LIMITE_B].map(value => ({ value })); },
                    ticks: { color: c.texto, autoSkip: false, callback: (v) => `${v}%` },
                    grid: { color: c.grade }
                }
            }
        }
    });
}

function preencherCategorias() {
    const select = document.getElementById("filtroCategoria");
    const atual = select.value;
    const categorias = [...new Set(curva.map(i => i.produto.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    select.innerHTML = `<option value="">Todas as categorias</option>`
        + categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    select.value = categorias.includes(atual) ? atual : "";
}

function itensFiltrados() {
    const classe = document.getElementById("filtroClasse").value;
    const categoria = document.getElementById("filtroCategoria").value;
    const busca = document.getElementById("filtroBusca").value.trim().toLowerCase();
    return curva.filter(i => {
        if (classe === "critico" && !(i.classe === "A" && precisaRepor(i.produto))) return false;
        if (classe === "sem" && i.consumo > 0) return false;
        if (["A", "B", "C"].includes(classe) && i.classe !== classe) return false;
        if (categoria && i.produto.categoria !== categoria) return false;
        return !busca || String(i.produto.nome).toLowerCase().includes(busca);
    });
}

function renderTabela() {
    const itens = itensFiltrados();
    document.getElementById("qtdTabela").textContent = itens.length;
    document.getElementById("abcBody").innerHTML = itens.map(i => {
        const p = i.produto;
        const detalhes = [p.categoria, p.localizacao].filter(Boolean).map(escapeHtml).join(" · ");
        return `
    <tr>
      <td>${i.posicao}º</td>
      <td><span class="abc-badge abc-${i.classe.toLowerCase()}">${i.classe}</span></td>
      <td><strong>${escapeHtml(p.nome)}</strong><br><small class="text-muted">${detalhes}</small></td>
      <td class="text-nowrap">${i.consumo > 0 ? `${i.consumo} <small class="text-muted">${escapeHtml(p.unidade || "")}</small>` : `<span class="text-muted">Sem saídas</span>`}</td>
      <td>${i.consumo > 0 ? pct(i.pctConsumo) : "-"}</td>
      <td>${i.consumo > 0 ? pct(i.pctAcumulado) : "-"}</td>
      <td>${p.quantidade}</td>
      <td>${estoqueMinimo(p)}</td>
      <td>${badgeEstoque(p)}</td>
    </tr>`;
    }).join("") || `<tr><td colspan="9" class="text-center text-muted py-4">Nenhum produto com esses filtros.</td></tr>`;
}

function exportarCsv() {
    downloadCsv(`curva_abc_${new Date().toISOString().slice(0, 10)}.csv`,
        ["posicao", "classe", "produto", "categoria", "localizacao", "unidade", "consumo", "pct_consumo", "pct_acumulado", "estoque", "minimo", "situacao"],
        itensFiltrados().map(i => [i.posicao, i.classe, i.produto.nome, i.produto.categoria || "", i.produto.localizacao || "", i.produto.unidade || "",
            i.consumo, i.pctConsumo.toFixed(2), i.pctAcumulado.toFixed(2), i.produto.quantidade, estoqueMinimo(i.produto), statusEstoque(i.produto).label]));
}

// ---------- CONFERÊNCIA DE SALDO ----------
async function carregarConferencia() {
    try {
        conferencia = await conferirSaldos();
        renderConferencia();
    } catch (err) {
        console.error(err);
        document.getElementById("conferenciaBody").innerHTML =
            `<tr><td colspan="9" class="text-center text-danger py-4">Erro ao conferir os saldos: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderConferencia() {
    const divergentes = conferencia.filter(p => p.diferenca !== 0);
    document.getElementById("resumoConferencia").innerHTML = divergentes.length
        ? `<span class="badge bg-danger">${divergentes.length} produto(s) com diferença</span> de ${conferencia.length} conferidos.`
        : `<span class="badge bg-success">Todos os ${conferencia.length} produtos conferem</span>`;
    const lista = document.getElementById("conferenciaTodos").checked ? conferencia : divergentes;
    document.getElementById("conferenciaBody").innerHTML = lista.map(p => `
    <tr class="${p.diferenca !== 0 ? "table-danger" : ""}">
      <td><small>${escapeHtml(p.codigo_barras || "-")}</small></td>
      <td>${escapeHtml(p.nome)}</td>
      <td>${p.estoque_inicial}</td>
      <td>${p.entradas}</td>
      <td>${p.saidas}</td>
      <td>${p.ajustes}</td>
      <td>${p.calculado}</td>
      <td><strong>${p.quantidade}</strong></td>
      <td>${p.diferenca}</td>
    </tr>`).join("") || `<tr><td colspan="9" class="text-center text-muted py-4">Nenhuma diferença encontrada.</td></tr>`;
}

// ---------- CONTROLE DE ACESSO ----------
function renderMatriz() {
    const perfis = Object.keys(ROLES);
    document.getElementById("matrizHead").innerHTML =
        `<tr><th>Permissão</th>${perfis.map(r => `<th class="text-center">${roleLabel(r)}</th>`).join("")}</tr>`;
    document.getElementById("matrizBody").innerHTML = PERMISSOES.map(([acao, label]) => `
    <tr>
      <td>${label}</td>
      ${perfis.map(role => can({ role }, acao)
        ? `<td class="text-center"><i class="bi bi-check-lg text-success" title="Permitido"></i><span class="visually-hidden">Permitido</span></td>`
        : `<td class="text-center"><i class="bi bi-dash text-muted" title="Bloqueado"></i><span class="visually-hidden">Bloqueado</span></td>`).join("")}
    </tr>`).join("");
}

async function carregarUsuarios() {
    try {
        usuarios = await listUsuarios();
        renderUsuarios();
    } catch (err) {
        console.error(err);
        document.getElementById("acessoBody").innerHTML =
            `<tr><td colspan="3" class="text-center text-danger py-4">Erro ao carregar usuários: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderUsuarios() {
    document.getElementById("resumoAcesso").innerHTML = Object.keys(ROLES).map(role => {
        const ativos = usuarios.filter(u => u.role === role && u.ativo !== false).length;
        return `<span class="badge ${roleBadgeClass(role)}">${roleLabel(role)}: ${ativos}</span>`;
    }).join(" ")
        + ` <span class="badge bg-secondary">Inativos: ${usuarios.filter(u => u.ativo === false && !u.perfilSolicitado).length}</span>`
        + ` <span class="badge bg-warning text-dark">Aguardando aprovação: ${usuarios.filter(u => u.ativo === false && u.perfilSolicitado).length}</span>`;

    const tbody = document.getElementById("acessoBody");
    tbody.innerHTML = usuarios.map(u => {
        const proprio = u.id === user.uid;
        return `
    <tr>
      <td>${escapeHtml(u.nome)}${proprio ? ` <span class="badge bg-secondary">Você</span>` : ""}${u.ativo === false && u.perfilSolicitado ? ` <a href="usuarios.html" class="badge bg-warning text-dark text-decoration-none">Aguardando aprovação</a>` : ""}<br><small class="text-muted">${escapeHtml(u.email)}</small></td>
      <td>
        <select class="form-select form-select-sm sel-perfil" data-id="${u.id}" aria-label="Perfil de ${escapeHtml(u.nome)}" ${proprio ? "disabled" : ""}>
          ${Object.keys(ROLES).map(r => `<option value="${r}" ${r === u.role ? "selected" : ""}>${roleLabel(r)}</option>`).join("")}
        </select>
      </td>
      <td>
        <div class="form-check form-switch mb-0">
          <input class="form-check-input sw-ativo" type="checkbox" role="switch" data-id="${u.id}" aria-label="Acesso de ${escapeHtml(u.nome)} ativo" ${u.ativo !== false ? "checked" : ""} ${proprio ? "disabled" : ""}>
        </div>
      </td>
    </tr>`;
    }).join("") || `<tr><td colspan="3" class="text-center text-muted py-4">Nenhum usuário cadastrado.</td></tr>`;

    const acharUsuario = (id) => usuarios.find(u => u.id === id);
    tbody.querySelectorAll(".sel-perfil").forEach(sel => sel.addEventListener("change", () => {
        const u = acharUsuario(sel.dataset.id);
        alterarAcesso(u, { role: sel.value }, `Alterar o perfil de "${u.nome}" para ${roleLabel(sel.value)}?`);
    }));
    tbody.querySelectorAll(".sw-ativo").forEach(sw => sw.addEventListener("change", () => {
        const u = acharUsuario(sw.dataset.id);
        alterarAcesso(u, { ativo: sw.checked }, sw.checked
            ? `Reativar o acesso de "${u.nome}"?`
            : `Desativar o acesso de "${u.nome}"? O usuário perde o acesso já na próxima página que abrir.`);
    }));
}

/** Na recusa ou em erro (ex.: trava do último administrador), a tela volta ao valor salvo. */
async function alterarAcesso(usuario, campos, pergunta) {
    if (!confirm(pergunta)) return renderUsuarios();
    try {
        await updateUsuario(usuario.id, campos);
        Object.assign(usuario, campos);
        mensagem(`Acesso de ${escapeHtml(usuario.nome)} atualizado.`, "success");
    } catch (err) {
        mensagem("Erro ao atualizar o acesso: " + escapeHtml(err.message), "danger");
    }
    renderUsuarios();
}
