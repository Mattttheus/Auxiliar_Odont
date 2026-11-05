// Financeiro (administrador): análise por período (anteriores, atual e futuros), custos de
// referência dos produtos e envios automáticos por e-mail.
import { requirePermission } from "./permissions.js";
import { renderShell } from "./layout.js";
import {
    getAnaliseFinanceira, getPlanejamento, salvarCustos, getConfigEnvios, getPreviaEnvio,
    salvarSmtp, testarEmail, salvarProgramacao, excluirProgramacao, enviarProgramacaoAgora
} from "./data.js";
import { formatDateBR, formatDateTimeBR, formatNumBR, reais, downloadCsv, escapeHtml, linkProduto } from "./utils.js";
import { coresGrafico, eixos } from "./graficos.js";

const TIPOS = { compras: "Compras a fazer", estoque: "Aviso de estoque", analise: "Análise financeira e preditiva" };
const FREQUENCIAS = { diaria: "Diária", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral", semestral: "Semestral" };
const DIAS_SEMANA = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const ORIGENS = { automatico: "Automático", manual: "Manual", fornecedor: "Pedido ao fornecedor", cotacao: "Cotação" };

let analise = null;
let custos = [];
let config = null;
let grafico = null;

const user = await requirePermission("financeiro");
if (user) {
    renderShell("financeiro.html", user);
    document.getElementById("filtroGranularidade").addEventListener("change", carregarAnalise);
    document.getElementById("filtroBase").addEventListener("change", () => { carregarAnalise(); carregarCustos(); });
    document.getElementById("btnImprimir").addEventListener("click", () => window.print());
    document.getElementById("btnCsv").addEventListener("click", exportarCsv);
    document.getElementById("themeToggle")?.addEventListener("click", renderGrafico);
    document.getElementById("buscaCusto").addEventListener("input", renderCustos);
    document.getElementById("soSemCusto").addEventListener("change", renderCustos);
    document.getElementById("btnSalvarCustos").addEventListener("click", gravarCustos);
    document.getElementById("formSmtp").addEventListener("submit", gravarSmtp);
    document.getElementById("btnTeste").addEventListener("click", enviarTeste);
    document.getElementById("btnNovoEnvio").addEventListener("click", () => abrirEnvio(null));
    document.getElementById("formEnvio").addEventListener("submit", gravarEnvio);
    document.getElementById("btnPreviaModal").addEventListener("click", () => mostrarPrevia(lerFormEnvio()));
    ["envioTipo", "envioFrequencia", "envioDiaSemana", "envioDiaMes", "envioHora"].forEach(id => document.getElementById(id).addEventListener("input", ajustarFormEnvio));
    const abrirAbaDoEndereco = () => {
        const aba = window.location.hash && document.querySelector(`[data-bs-target="${window.location.hash}"]`);
        if (aba) bootstrap.Tab.getOrCreateInstance(aba).show();
    };
    abrirAbaDoEndereco();
    window.addEventListener("hashchange", abrirAbaDoEndereco);
    await Promise.all([carregarAnalise(), carregarCustos(), carregarEnvios()]);
}

function mensagem(html, tipo = "warning") {
    document.getElementById("msgContainer").innerHTML = html ? `<div class="alert alert-${tipo} alert-dismissible">${html}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button></div>` : "";
}

// ---------- ANÁLISE POR PERÍODO ----------
// Funções declaradas (e não const): o carregamento acima, com await no topo do módulo,
// já as usa antes de o módulo terminar de ser lido.
function totalCompras(p) {
    return p.compras_valor + p.compras_previstas_valor;
}
function totalConsumoValor(p) {
    return p.consumo_valor + p.consumo_previsto_valor;
}
function totalConsumoUn(p) {
    return p.consumo_un + p.consumo_previsto_un;
}

async function carregarAnalise() {
    const g = document.getElementById("filtroGranularidade").value;
    document.body.classList.add("carregando");
    try {
        analise = await getAnaliseFinanceira(g, document.getElementById("filtroBase").value);
    } catch (err) {
        mensagem("Erro ao calcular a análise: " + escapeHtml(err.message), "danger");
        return;
    } finally {
        document.body.classList.remove("carregando");
    }
    const a = analise.aprendizado;
    document.getElementById("resumoAnalise").textContent = `Previsão aprendida com ${a.saidas} saída(s) em ${a.semanas} semana(s) · prazo de entrega ${analise.parametros.prazo_entrega} dia(s)`;
    document.getElementById("avisoCustos").innerHTML = analise.itens_sem_custo
        ? `<div class="alert alert-warning small"><i class="bi bi-currency-dollar"></i> ${analise.itens_sem_custo} de ${analise.itens} produto(s) sem custo ficam fora dos valores em reais (as quantidades continuam completas).
           <a class="alert-link" href="#custos" id="irCustos">Informar custos</a>.</div>` : "";
    document.getElementById("irCustos")?.addEventListener("click", (e) => { e.preventDefault(); bootstrap.Tab.getOrCreateInstance(document.querySelector('[data-bs-target="#custos"]')).show(); });
    renderIndicadores();
    renderGrafico();
    renderTabela();
}

function renderIndicadores() {
    const periodos = analise.periodos;
    const i = periodos.findIndex(p => p.tipo === "atual");
    const atual = periodos[i];
    const anterior = periodos[i - 1];
    const proximo = periodos[i + 1];
    const variacao = (agora, antes) => antes > 0 ? `${agora >= antes ? "+" : ""}${formatNumBR((agora - antes) / antes * 100)}% sobre ${anterior.rotulo}` : `sem compras em ${anterior?.rotulo || "período anterior"}`;
    const tile = (icone, titulo, valor, detalhe, extra = "") => `
      <div class="col-6 col-lg-3"><div class="card shadow border-0 rounded-4 p-3 h-100">
        <h6 class="text-muted"><i class="bi ${icone} text-primary"></i> ${titulo}</h6>
        <h3 class="mb-0">${valor}</h3><small class="text-muted">${detalhe}</small>${extra}
      </div></div>`;
    document.getElementById("indicadoresAnalise").innerHTML = [
        tile("bi-hourglass-split", `Progresso: ${escapeHtml(atual.rotulo)}`, `${Math.round(atual.progresso * 100)}%`,
            `${formatDateBR(atual.inicio)} a ${formatDateBR(atual.fim)}`,
            `<div class="progresso-periodo mt-2" role="progressbar" aria-valuenow="${Math.round(atual.progresso * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${atual.progresso * 100}%"></div></div>`),
        tile("bi-cart-check", "Compras no período", reais(totalCompras(atual)),
            `${reais(atual.compras_valor)} realizadas + ${reais(atual.compras_previstas_valor)} previstas · ${anterior ? variacao(totalCompras(atual), totalCompras(anterior)) : ""}`),
        tile("bi-box-arrow-up", "Consumo no período", reais(totalConsumoValor(atual)),
            `${formatNumBR(atual.consumo_un)} un. até hoje + ${formatNumBR(atual.consumo_previsto_un)} previstas`),
        tile("bi-graph-up-arrow", `Previsto para ${escapeHtml(proximo?.rotulo || "o próximo período")}`, reais(proximo ? totalCompras(proximo) : null),
            proximo ? `em compras · consumo de ${reais(totalConsumoValor(proximo))}${proximo.compras_previstas_sem_custo ? ` · ${proximo.compras_previstas_sem_custo} compra(s) sem custo` : ""}` : "")
    ].join("");
}

function renderGrafico() {
    if (!analise) return;
    const periodos = analise.periodos;
    const temValores = periodos.some(p => totalCompras(p) > 0 || totalConsumoValor(p) > 0);
    document.getElementById("boxAnalise").classList.toggle("d-none", !temValores);
    document.getElementById("semAnalise").classList.toggle("d-none", temValores);
    grafico?.destroy();
    grafico = null;
    if (!temValores) return;
    const c = coresGrafico();
    const barra = { maxBarThickness: 24, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", stack: "compras" };
    const iAtual = periodos.findIndex(p => p.tipo === "atual");
    grafico = new Chart(document.getElementById("chartAnalise"), {
        data: {
            labels: periodos.map(p => p.rotulo),
            datasets: [
                { type: "bar", label: "Compras realizadas", data: periodos.map(p => p.tipo === "futuro" ? null : p.compras_valor), backgroundColor: c.realizado, ...barra, order: 2 },
                { type: "bar", label: "Compras previstas", data: periodos.map(p => p.tipo === "anterior" ? null : p.compras_previstas_valor), backgroundColor: c.previsto, ...barra, order: 2 },
                {
                    type: "line", label: "Consumo (realizado + previsto)", data: periodos.map(totalConsumoValor), borderColor: c.linha, borderWidth: 2,
                    pointRadius: 4, pointBackgroundColor: c.linha, pointBorderColor: c.superficie, pointBorderWidth: 2, tension: 0,
                    segment: { borderDash: (ctx) => ctx.p1DataIndex > iAtual ? [6, 4] : undefined }, order: 1
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { labels: { color: c.texto, boxWidth: 12, boxHeight: 12 } },
                tooltip: {
                    filter: (item) => item.parsed.y !== null,
                    callbacks: {
                        title: (items) => { const p = periodos[items[0].dataIndex]; return `${p.rotulo} (${p.tipo === "atual" ? `atual, ${Math.round(p.progresso * 100)}% decorrido` : p.tipo === "futuro" ? "previsão" : "realizado"})`; },
                        label: (ctx) => ` ${ctx.dataset.label}: ${reais(ctx.parsed.y)}`
                    }
                }
            },
            scales: { ...eixos(c, (v) => `R$ ${Number(v).toLocaleString("pt-BR", { notation: "compact" })}`), x: { stacked: true, ticks: { color: c.texto, maxRotation: 0, autoSkip: true }, grid: { display: false } } }
        }
    });
}

function renderTabela() {
    const periodos = analise.periodos;
    document.getElementById("analiseBody").innerHTML = periodos.map((p, i) => {
        const anterior = periodos[i - 1];
        const total = totalCompras(p);
        const variacao = anterior && totalCompras(anterior) > 0 ? (total - totalCompras(anterior)) / totalCompras(anterior) * 100 : null;
        const situacao = p.tipo === "anterior" ? `<span class="badge bg-secondary">Realizado</span>`
            : p.tipo === "atual" ? `<span class="badge bg-primary">Atual · ${Math.round(p.progresso * 100)}%</span>`
            : `<span class="badge bg-light text-dark border">Previsto${p.longo_prazo ? " · longo prazo" : ""}</span>`;
        const compras = p.tipo === "anterior" ? reais(p.compras_valor)
            : p.tipo === "atual" ? `${reais(total)}<br><small class="text-muted">${reais(p.compras_valor)} + ${reais(p.compras_previstas_valor)} previstas</small>`
            : `${reais(p.compras_previstas_valor)}<br><small class="text-muted">${p.compras_previstas_itens} compra(s) programada(s)${p.compras_previstas_sem_custo ? `, ${p.compras_previstas_sem_custo} sem custo` : ""}</small>`;
        let comparacao = `<small class="text-muted">-</small>`;
        if (p.previsto_registrado && p.tipo !== "futuro") {
            const r = p.previsto_registrado;
            const realizado = p.tipo === "anterior" ? p.consumo_un : totalConsumoUn(p);
            const erro = r.consumo_un > 0 ? (realizado - r.consumo_un) / r.consumo_un * 100 : null;
            comparacao = `${formatNumBR(r.consumo_un)} un. previstas em ${formatDateBR(r.gerado_em)}`
                + (p.tipo === "anterior" && erro !== null ? `<br><small class="${Math.abs(erro) <= 20 ? "text-success" : "text-danger"}">erro de ${formatNumBR(erro)}%</small>` : `<br><small class="text-muted">confere no fim do mês</small>`);
        }
        return `
        <tr class="${p.tipo === "atual" ? "table-active" : ""}">
          <td class="fw-semibold text-nowrap">${escapeHtml(p.rotulo)}</td>
          <td>${situacao}</td>
          <td class="text-nowrap">${compras}${p.entradas_sem_custo ? `<br><small class="text-warning">${p.entradas_sem_custo} entrada(s) sem custo</small>` : ""}</td>
          <td>${variacao === null ? "-" : `<span class="${variacao > 0 ? "text-danger" : "text-success"}">${variacao > 0 ? "↑" : "↓"} ${formatNumBR(Math.abs(variacao))}%</span>`}</td>
          <td>${formatNumBR(totalConsumoUn(p))}${p.tipo === "atual" ? `<br><small class="text-muted">${formatNumBR(p.consumo_un)} até hoje</small>` : ""}</td>
          <td class="text-nowrap">${reais(totalConsumoValor(p))}</td>
          <td class="text-nowrap">${p.estoque_fim_valor === null ? `<small class="text-muted">previsão</small>` : `${reais(p.estoque_fim_valor)}<br><small class="text-muted">${formatNumBR(p.estoque_fim_un)} un.${p.tipo === "atual" ? " hoje" : ""}</small>`}</td>
          <td>${comparacao}</td>
          <td><small>${p.fornecedores.length ? p.fornecedores.slice(0, 3).map(f => `<span class="text-nowrap" title="${escapeHtml(f.fornecedor)}">${escapeHtml(nomeCurto(f.fornecedor))}: ${valorCompacto(f.valor)}</span>`).join("<br>") : "-"}</small></td>
        </tr>`;
    }).join("");
}

/** "Suprimentos Modelo Ltda" vira "Suprimentos Modelo": a coluna fica estreita; o nome inteiro vai no title. */
function nomeCurto(nome) {
    const semSufixo = nome.replace(/\s+(ltda|me|eireli|s\.?a\.?|epp)\.?$/i, "");
    return semSufixo.length > 18 ? semSufixo.slice(0, 17) + "…" : semSufixo;
}

/** R$ 6,2 mil: cabe na coluna de fornecedores sem quebrar a linha. */
function valorCompacto(v) {
    return `R$ ${Number(v).toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}`;
}

function exportarCsv() {
    if (!analise) return;
    downloadCsv(`analise_${analise.granularidade}_${analise.hoje}.csv`,
        ["periodo", "inicio", "fim", "situacao", "progresso", "compras_realizadas", "compras_previstas", "consumo_un_realizado", "consumo_un_previsto", "consumo_valor", "estoque_fim_valor", "entradas_sem_custo"],
        analise.periodos.map(p => [p.rotulo, p.inicio, p.fim, p.tipo, p.progresso, p.compras_valor, p.compras_previstas_valor, p.consumo_un, p.consumo_previsto_un,
            totalConsumoValor(p), p.estoque_fim_valor ?? "", p.entradas_sem_custo]));
}

// ---------- CUSTOS ----------
async function carregarCustos() {
    try {
        custos = (await getPlanejamento(document.getElementById("filtroBase").value, 0)).produtos;
        renderCustos();
    } catch (err) {
        document.getElementById("custosBody").innerHTML = `<tr><td colspan="6" class="text-danger text-center py-3">Erro: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderCustos() {
    const busca = document.getElementById("buscaCusto").value.trim().toLowerCase();
    const soSem = document.getElementById("soSemCusto").checked;
    const itens = custos
        .filter(p => (!soSem || p.custo_referencia === null) && (!busca || p.nome.toLowerCase().includes(busca) || String(p.codigo_barras || "").toLowerCase().includes(busca)))
        .sort((a, b) => (a.custo_referencia === null) === (b.custo_referencia === null) ? a.nome.localeCompare(b.nome, "pt-BR") : a.custo_referencia === null ? -1 : 1);
    document.getElementById("qtdCustos").textContent = `${custos.filter(p => p.custo_referencia === null).length} sem custo`;
    document.getElementById("custosBody").innerHTML = itens.map(p => `
      <tr>
        <td><strong>${linkProduto(p)}</strong><br><small class="text-muted">${escapeHtml(p.codigo_barras || "")} · ${escapeHtml(p.unidade || "")}</small></td>
        <td>${p.quantidade}</td>
        <td>${p.custo_medio === null ? `<span class="badge bg-warning text-dark">sem custo</span>` : reais(p.custo_medio)}</td>
        <td>${reais(p.ultimo_custo)}</td>
        <td><input type="number" class="form-control form-control-sm inp-custo" min="0" step="0.01" data-id="${p.produto_id}" data-atual="${p.custo_medio ?? ""}" value="${p.custo_medio ?? ""}" aria-label="Custo de ${escapeHtml(p.nome)}"></td>
        <td>${p.custo_referencia === null ? "-" : reais(p.custo_referencia * p.quantidade)}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="text-center text-muted py-3">Nenhum produto com esses filtros.</td></tr>`;
}

async function gravarCustos() {
    const alterados = [...document.querySelectorAll(".inp-custo")]
        .filter(i => i.value !== i.dataset.atual && !(i.value !== "" && i.dataset.atual !== "" && Number(i.value) === Number(i.dataset.atual)))
        .map(i => ({ produto_id: Number(i.dataset.id), custo: i.value === "" ? null : Number(i.value) }));
    if (!alterados.length) return mensagem("Nenhum custo foi alterado.", "info");
    if (alterados.some(a => a.custo !== null && (isNaN(a.custo) || a.custo < 0))) return mensagem("Informe custos maiores ou iguais a zero.", "danger");
    try {
        const n = await salvarCustos(alterados);
        mensagem(`${n} custo(s) salvo(s). A análise e o planejamento já usam os novos valores.`, "success");
        await Promise.all([carregarCustos(), carregarAnalise()]);
    } catch (err) {
        mensagem("Erro ao salvar custos: " + escapeHtml(err.message), "danger");
    }
}

// ---------- ENVIOS ----------
async function carregarEnvios() {
    try {
        config = await getConfigEnvios();
    } catch (err) {
        document.getElementById("programacoesBody").innerHTML = `<tr><td colspan="6" class="text-danger">Erro: ${escapeHtml(err.message)}</td></tr>`;
        return;
    }
    const s = config.smtp;
    document.getElementById("smtpHost").value = s.smtp_host || "";
    document.getElementById("smtpPorta").value = s.smtp_porta || 587;
    document.getElementById("smtpSeguranca").value = s.smtp_seguranca || "tls";
    document.getElementById("smtpUsuario").value = s.smtp_usuario || "";
    document.getElementById("smtpSenha").value = "";
    document.getElementById("smtpSenha").placeholder = s.tem_senha ? "Senha salva (deixe em branco para manter)" : "Senha de app";
    document.getElementById("smtpRemetente").value = s.remetente_email || "";
    document.getElementById("smtpNome").value = s.remetente_nome || "Auxiliar Odont";
    document.getElementById("statusSmtp").innerHTML = s.smtp_host && s.remetente_email
        ? `<i class="bi bi-check-circle text-success"></i> Configurado${s.certificados ? "" : " · <span class='text-danger'>sem certificados raiz para TLS</span>"}`
        : `<i class="bi bi-exclamation-circle text-warning"></i> Não configurado: os envios ficam parados`;

    document.getElementById("programacoesBody").innerHTML = config.programacoes.map(p => `
      <tr class="${Number(p.ativo) ? "" : "text-muted"}">
        <td><strong>${TIPOS[p.tipo]}</strong><br><small class="text-muted">${Number(p.incluir_valores) ? "com valores" : "sem valores"}${Number(p.cotar_fornecedores) ? " · pede cotação" : ""}${Number(p.ativo) ? "" : " · desativado"}</small></td>
        <td>${quando(p)}</td>
        <td><small>${escapeHtml(p.destinatarios)}</small></td>
        <td>${p.proximo_envio ? formatDateTimeBR(p.proximo_envio) : "-"}</td>
        <td>${p.ultimo_envio ? formatDateTimeBR(p.ultimo_envio) : "-"}${p.ultimo_erro ? `<br><small class="text-danger">${escapeHtml(p.ultimo_erro)}</small>` : ""}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-secondary btn-previa" data-id="${p.id}" title="Prévia"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary btn-agora" data-id="${p.id}" title="Enviar agora"><i class="bi bi-send"></i></button>
          <button class="btn btn-sm btn-outline-secondary btn-editar" data-id="${p.id}" title="Editar"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-excluir" data-id="${p.id}" title="Excluir"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join("") || `<tr><td colspan="6" class="text-center text-muted py-3">Nenhum envio programado. Crie um em "Novo envio".</td></tr>`;
    const achar = (id) => config.programacoes.find(p => String(p.id) === String(id));
    document.querySelectorAll(".btn-previa").forEach(b => b.addEventListener("click", () => mostrarPrevia(achar(b.dataset.id))));
    document.querySelectorAll(".btn-agora").forEach(b => b.addEventListener("click", () => enviarAgora(achar(b.dataset.id), b)));
    document.querySelectorAll(".btn-editar").forEach(b => b.addEventListener("click", () => abrirEnvio(achar(b.dataset.id))));
    document.querySelectorAll(".btn-excluir").forEach(b => b.addEventListener("click", () => removerEnvio(achar(b.dataset.id))));

    document.getElementById("registroBody").innerHTML = config.envios.map(e => `
      <tr>
        <td class="text-nowrap">${formatDateTimeBR(e.enviado_em)}</td>
        <td>${ORIGENS[e.origem] || e.origem}</td>
        <td>${escapeHtml(e.assunto || "-")}</td>
        <td><small>${escapeHtml(e.destinatarios || "")}</small></td>
        <td>${Number(e.ok) ? `<span class="badge bg-success">Enviado</span>` : `<span class="badge bg-danger">Falhou</span><br><small class="text-danger">${escapeHtml(e.erro || "")}</small>`}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum envio ainda.</td></tr>`;
}

function quando(p) {
    const hora = `${String(p.hora).padStart(2, "0")}h`;
    if (p.frequencia === "diaria") return `Todo dia, ${hora}`;
    if (p.frequencia === "semanal") return `Toda ${DIAS_SEMANA[p.dia_semana]}, ${hora}`;
    if (p.frequencia === "quinzenal") return `A cada 2 semanas, ${DIAS_SEMANA[p.dia_semana]}, ${hora}`;
    const meses = { mensal: "todo mês", bimestral: "jan, mar, mai, jul, set, nov", trimestral: "jan, abr, jul, out", semestral: "jan e jul" };
    return `${FREQUENCIAS[p.frequencia]}: dia ${p.dia_mes} (${meses[p.frequencia]}), ${hora}`;
}

function dadosSmtp() {
    return {
        smtp_host: document.getElementById("smtpHost").value.trim(),
        smtp_porta: parseInt(document.getElementById("smtpPorta").value) || 587,
        smtp_seguranca: document.getElementById("smtpSeguranca").value,
        smtp_usuario: document.getElementById("smtpUsuario").value.trim(),
        smtp_senha: document.getElementById("smtpSenha").value,
        remetente_email: document.getElementById("smtpRemetente").value.trim(),
        remetente_nome: document.getElementById("smtpNome").value.trim()
    };
}

async function gravarSmtp(e) {
    e.preventDefault();
    try {
        await salvarSmtp(dadosSmtp());
        mensagem("Servidor de e-mail salvo. Use o teste para conferir.", "success");
        await carregarEnvios();
    } catch (err) {
        mensagem("Erro ao salvar o servidor de e-mail: " + escapeHtml(err.message), "danger");
    }
}

async function enviarTeste() {
    const email = document.getElementById("emailTeste").value.trim();
    if (!email) return mensagem("Informe o e-mail que vai receber o teste.");
    const btn = document.getElementById("btnTeste");
    btn.disabled = true;
    try {
        // O teste usa o que está na tela: quem preencheu e não clicou em Salvar testaria a configuração antiga.
        if (document.getElementById("smtpHost").value.trim()) await salvarSmtp(dadosSmtp());
        await testarEmail(email);
        mensagem(`E-mail de teste enviado para ${escapeHtml(email)}. Confira a caixa de entrada e o spam.`, "success");
    } catch (err) {
        mensagem("O teste falhou: " + escapeHtml(err.message), "danger");
    } finally {
        btn.disabled = false;
        carregarEnvios();
    }
}

function ajustarFormEnvio() {
    const f = lerFormEnvio();
    const semanal = f.frequencia === "semanal" || f.frequencia === "quinzenal";
    document.querySelectorAll(".campo-semana").forEach(el => el.classList.toggle("d-none", !semanal));
    document.querySelectorAll(".campo-mes").forEach(el => el.classList.toggle("d-none", semanal || f.frequencia === "diaria"));
    document.querySelectorAll(".campo-cotacao").forEach(el => el.classList.toggle("d-none", f.tipo !== "compras"));
    const horizonte = { diaria: 1, semanal: 7, quinzenal: 14, mensal: 30, bimestral: 60, trimestral: 90, semestral: 180 }[f.frequencia];
    document.getElementById("envioExplicacao").textContent = `${quando(f)}. ` + (f.tipo === "compras"
        ? `Lista os pedidos que precisam sair nos próximos ${horizonte} dia(s).`
        : f.tipo === "estoque" ? `Avisa faltas, mínimos e validades dos próximos ${Math.max(7, horizonte)} dias.`
        : `Compara o período anterior, o atual e o próximo (${["diaria", "semanal", "quinzenal"].includes(f.frequencia) ? "semanal" : FREQUENCIAS[f.frequencia].toLowerCase()}).`);
}

function lerFormEnvio() {
    return {
        id: document.getElementById("envioId").value || null,
        tipo: document.getElementById("envioTipo").value,
        frequencia: document.getElementById("envioFrequencia").value,
        dia_semana: parseInt(document.getElementById("envioDiaSemana").value),
        dia_mes: parseInt(document.getElementById("envioDiaMes").value) || 1,
        hora: parseInt(document.getElementById("envioHora").value) || 0,
        destinatarios: document.getElementById("envioDestinatarios").value,
        incluir_valores: document.getElementById("envioValores").checked ? 1 : 0,
        cotar_fornecedores: document.getElementById("envioCotar").checked ? 1 : 0,
        ativo: document.getElementById("envioAtivo").checked ? 1 : 0
    };
}

function abrirEnvio(p) {
    document.getElementById("modalEnvioTitulo").textContent = p ? "Editar envio programado" : "Novo envio programado";
    document.getElementById("envioId").value = p?.id || "";
    document.getElementById("envioTipo").value = p?.tipo || "compras";
    document.getElementById("envioFrequencia").value = p?.frequencia || "semanal";
    document.getElementById("envioDiaSemana").value = p?.dia_semana || 1;
    document.getElementById("envioDiaMes").value = p?.dia_mes || 1;
    document.getElementById("envioHora").value = p?.hora ?? 8;
    document.getElementById("envioDestinatarios").value = p?.destinatarios || user.email || "";
    document.getElementById("envioValores").checked = p ? !!Number(p.incluir_valores) : false;
    document.getElementById("envioCotar").checked = p ? !!Number(p.cotar_fornecedores) : false;
    document.getElementById("envioAtivo").checked = p ? !!Number(p.ativo) : true;
    ajustarFormEnvio();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEnvio")).show();
}

async function gravarEnvio(e) {
    e.preventDefault();
    try {
        const r = await salvarProgramacao(lerFormEnvio());
        bootstrap.Modal.getInstance(document.getElementById("modalEnvio"))?.hide();
        mensagem(`Envio salvo.${r.proximo_envio ? ` Próximo: ${formatDateTimeBR(r.proximo_envio)}.` : ""}${config?.smtp?.smtp_host ? "" : " Configure o servidor de e-mail para ele sair."}`, "success");
        await carregarEnvios();
    } catch (err) {
        alert(err.message);
    }
}

async function mostrarPrevia(p) {
    try {
        const previa = await getPreviaEnvio(p.tipo, p.frequencia, Number(p.incluir_valores), Number(p.cotar_fornecedores));
        document.getElementById("modalPreviaTitulo").textContent = `Prévia: ${previa.assunto}`;
        document.getElementById("previaFrame").srcdoc = previa.html;
        bootstrap.Modal.getOrCreateInstance(document.getElementById("modalPrevia")).show();
    } catch (err) {
        mensagem("Erro na prévia: " + escapeHtml(err.message), "danger");
    }
}

async function enviarAgora(p, botao) {
    if (!confirm(`Enviar agora "${TIPOS[p.tipo]}" para ${p.destinatarios}?` + (Number(p.cotar_fornecedores) ? "\n\nIsso também envia uma solicitação de cotação aos fornecedores cadastrados." : ""))) return;
    botao.disabled = true;
    try {
        await enviarProgramacaoAgora(p.id);
        mensagem("Enviado.", "success");
    } catch (err) {
        mensagem("O envio falhou: " + escapeHtml(err.message), "danger");
    } finally {
        botao.disabled = false;
        carregarEnvios();
    }
}

async function removerEnvio(p) {
    if (!confirm(`Excluir o envio "${TIPOS[p.tipo]}" (${quando(p)})?`)) return;
    try {
        await excluirProgramacao(p.id);
        await carregarEnvios();
    } catch (err) {
        mensagem("Erro ao excluir: " + escapeHtml(err.message), "danger");
    }
}
