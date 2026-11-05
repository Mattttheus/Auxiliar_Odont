// Planejamento 30/60/90: demonstrativo atual e futuro, saúde do estoque, compras indicativas
// por janela e a previsão aprendida de cada produto. Valores em reais só para o administrador.
import { requirePermission, can } from "./permissions.js";
import { renderShell } from "./layout.js";
import { getPlanejamento, createListaCompra, listFornecedores } from "./data.js";
import { formatDateBR, formatNumBR, reais, downloadCsv, escapeHtml, linkProduto } from "./utils.js";
import { coresGrafico, eixos } from "./graficos.js";

const METODOS = {
    holt: { label: "Holt", titulo: "Suavização exponencial com tendência amortecida" },
    croston: { label: "Croston", titulo: "Consumo intermitente: tamanho e intervalo aprendidos à parte" },
    media: { label: "Média", titulo: "Pouco histórico: média simples da base" },
    sem_historico: { label: "Sem histórico", titulo: "Nenhuma saída na base: a compra segue o estoque mínimo" }
};

// Saúde do estoque: cada produto fica na primeira situação que se aplica.
const SITUACOES = [
    { id: "zerado", label: "Sem estoque", icone: "bi-x-octagon-fill", cor: "danger", teste: p => p.quantidade === 0 },
    { id: "protecao", label: "Abaixo da proteção", icone: "bi-exclamation-octagon-fill", cor: "danger", teste: p => p.quantidade - p.vencido < p.protecao },
    { id: "risco", label: "Risco em 30 dias", icone: "bi-exclamation-triangle-fill", cor: "warning", teste: p => (p.dia_ruptura !== null && p.dia_ruptura <= 30) || p.vencido > 0 || p.horizontes[2].perdas > 0 },
    { id: "excesso", label: "Excesso (mais de 180 dias)", icone: "bi-box-seam", cor: "info", teste: p => cobertura(p) !== null && cobertura(p) > 180 },
    { id: "parado", label: "Sem consumo registrado", icone: "bi-pause-circle", cor: "secondary", teste: p => p.demanda_semanal === 0 },
    { id: "saudavel", label: "Saudável", icone: "bi-check-circle-fill", cor: "success", teste: () => true }
];

let plano = null;
let fornecedores = [];
let filtroSaude = null;
let graficoCompras = null;
let graficoProduto = null;
let produtoAberto = null;
const desmarcados = new Set();

const user = await requirePermission("compras");
const verCustos = can(user, "financeiro");
if (user) {
    renderShell("planejamento.html", user);
    document.getElementById("linkCotacoes").classList.toggle("d-none", !verCustos);
    document.querySelectorAll(".col-custo").forEach(el => el.classList.toggle("d-none", !verCustos));
    document.getElementById("btnRecalcular").addEventListener("click", carregar);
    document.getElementById("filtroBase").addEventListener("change", carregar);
    document.getElementById("btnCsv").addEventListener("click", exportarCsv);
    document.getElementById("btnImprimir").addEventListener("click", () => window.print());
    ["filtroBusca", "filtroClasse", "filtroSituacao"].forEach(id => document.getElementById(id).addEventListener("input", renderPrevisao));
    document.getElementById("saudeTodos").addEventListener("click", () => { filtroSaude = null; renderSaude(); });
    document.getElementById("themeToggle")?.addEventListener("click", () => { renderCurvaCompras(); if (produtoAberto) renderGraficoProduto(produtoAberto); });
    // Os e-mails e os links apontam para uma aba: planejamento.html#compras, #saude...
    const abrirAbaDoEndereco = () => {
        const aba = window.location.hash && document.querySelector(`[data-bs-target="${window.location.hash}"]`);
        if (aba) bootstrap.Tab.getOrCreateInstance(aba).show();
    };
    abrirAbaDoEndereco();
    window.addEventListener("hashchange", abrirAbaDoEndereco);
    if (can(user, "compras_edit")) listFornecedores().then(f => { fornecedores = f.filter(x => Number(x.ativo) === 1); if (plano) renderJanelas(); }).catch(() => {});
    await carregar();
}

function mensagem(html, tipo = "warning") {
    document.getElementById("msgContainer").innerHTML = html ? `<div class="alert alert-${tipo}">${html}</div>` : "";
}

// Funções declaradas (e não const): o carregamento acima, com await no topo do módulo,
// já as usa antes de o módulo terminar de ser lido.
function un(v, casas = 0) {
    return formatNumBR(v, casas);
}
function semanal(v) {
    return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 2 : 1 });
}
function qtdItens(n) {
    return `${n} ${n === 1 ? "item" : "itens"}`;
}
function cobertura(p) {
    return p.demanda_semanal > 0 ? (p.quantidade - p.vencido) / (p.demanda_semanal / 7) : null;
}
function situacao(p) {
    return SITUACOES.find(s => s.teste(p));
}
function badgeClasse(p) {
    return `<span class="abc-badge abc-${p.classe.toLowerCase()}" title="Nível de serviço ${p.nivel_servico}%">${p.classe}</span>`;
}
function badgeMetodo(p) {
    const m = METODOS[p.metodo];
    return `<span class="badge bg-light text-dark border" title="${m.titulo}">${m.label}</span>`;
}

async function carregar() {
    const base = document.getElementById("filtroBase").value;
    const ajuste = Math.max(-50, Math.min(200, parseInt(document.getElementById("filtroAjuste").value) || 0));
    document.getElementById("filtroAjuste").value = ajuste;
    document.body.classList.add("carregando");
    try {
        plano = await getPlanejamento(base, ajuste);
        mensagem("");
    } catch (err) {
        mensagem("Erro ao calcular o planejamento: " + escapeHtml(err.message), "danger");
        return;
    } finally {
        document.body.classList.remove("carregando");
    }
    const p = plano.parametros;
    document.getElementById("resumoParametros").textContent =
        `Prazo de entrega ${p.prazo_entrega} dia(s) · curva ABC por ${p.criterio_abc} · nível de serviço A ${p.niveis_servico.A}%, B ${p.niveis_servico.B}%, C ${p.niveis_servico.C}%`
        + (p.ajuste ? ` · cenário ${p.ajuste > 0 ? "+" : ""}${p.ajuste}%` : "");
    renderAviso();
    renderIndicadores();
    renderDemonstrativo();
    renderCurvaCompras();
    renderSaude();
    renderJanelas();
    renderPrevisao();
}

function renderAviso() {
    const a = plano.aprendizado;
    const m = a.metodos;
    let html;
    if (!a.semanas || a.produtos_com_consumo === 0) {
        html = `<div class="alert alert-warning"><i class="bi bi-mortarboard"></i> <strong>Ainda não há consumo para aprender.</strong>
          Sem saídas na base, a previsão é zero e as compras seguem só o estoque mínimo. Registre as saídas em Movimentar ou no Caixa para o sistema aprender.</div>`;
    } else {
        const pouco = m.holt + m.croston === 0;
        html = `<div class="alert ${pouco ? "alert-warning" : "alert-info"}"><i class="bi bi-mortarboard"></i>
          <strong>Base de aprendizado:</strong> ${a.saidas} saída(s) em ${a.semanas} semana(s), desde ${formatDateBR(a.inicio)}; última saída em ${formatDateBR(a.ultima_saida)}.
          ${a.produtos_com_consumo} produto(s) com consumo: ${m.holt} com tendência (Holt), ${m.croston} intermitente(s) (Croston), ${m.media} pela média.
          ${pouco ? "Com pouco histórico, a previsão é conservadora; ela melhora a cada saída registrada." : ""}</div>`;
    }
    if (verCustos && plano.demonstrativo.atual.itens_sem_custo > 0) {
        html += `<div class="alert alert-light border small"><i class="bi bi-currency-dollar"></i> ${plano.demonstrativo.atual.itens_sem_custo} de ${plano.demonstrativo.atual.itens} produto(s) ainda sem custo: ficam fora dos valores em reais.
          <a class="alert-link" href="financeiro.html#custos">Informar custos</a>.</div>`;
    }
    document.getElementById("avisoAprendizado").innerHTML = html;
}

function tile(icone, cor, titulo, valor, detalhe, href = null) {
    const corpo = `
      <div class="card shadow border-0 rounded-4 p-3 h-100">
        <h6 class="text-muted"><i class="bi ${icone} text-${cor}"></i> ${titulo}</h6>
        <h3 class="mb-0">${valor}</h3>
        <small class="text-muted">${detalhe}</small>
      </div>`;
    return `<div class="col-6 col-lg-3">${href ? `<a href="${href}" class="text-decoration-none text-reset">${corpo}</a>` : corpo}</div>`;
}

function renderIndicadores() {
    const [d30, , d90] = plano.demonstrativo.futuro;
    // Sem alerta: nem em falta, nem abaixo da proteção, nem em risco. Item parado ou em excesso
    // não pede ação de compra, então conta aqui (e aparece à parte na aba Saúde).
    const saudaveis = plano.produtos.filter(p => !["zerado", "protecao", "risco"].includes(situacao(p).id)).length;
    const comConsumo = plano.produtos.filter(p => p.demanda_semanal > 0).length;
    document.getElementById("indicadores").innerHTML = [
        tile("bi-cart-plus", "primary", "Comprar em 30 dias", qtdItens(d30.compra_itens),
            `${un(d30.compra_unidades)} un.${verCustos ? ` · ${reais(d30.gasto)}${d30.compras_sem_custo ? ` + ${d30.compras_sem_custo} sem custo` : ""}` : ""}`, "#compras"),
        verCustos
            ? tile("bi-cash-stack", "primary", "Gasto previsto em 90 dias", reais(d90.gasto_acumulado), `${un(d90.compra_acumulada)} un. em ${d90.compra_itens + plano.demonstrativo.futuro[0].compra_itens + plano.demonstrativo.futuro[1].compra_itens} compras programadas`, "financeiro.html")
            : tile("bi-box-arrow-in-down", "primary", "Unidades a comprar em 90 dias", un(d90.compra_acumulada), "Para manter a proteção até o fim do período", "#compras"),
        tile("bi-exclamation-octagon", "danger", "Falta sem comprar (30 dias)", qtdItens(d30.itens_ruptura), `${un(d30.falta, 1)} un. de consumo sem estoque`, "#saude"),
        tile("bi-heart-pulse", "success", "Itens sem alerta", `${Math.round(saudaveis / Math.max(1, plano.produtos.length) * 100)}%`,
            `${saudaveis} de ${plano.produtos.length} sem falta, risco ou abaixo da proteção · ${comConsumo} com consumo aprendido`, "#saude")
    ].join("");
    // Os indicadores levam para as abas desta página.
    document.querySelectorAll('#indicadores a[href^="#"]').forEach(a => a.addEventListener("click", e => {
        e.preventDefault();
        bootstrap.Tab.getOrCreateInstance(document.querySelector(`[data-bs-target="${a.getAttribute("href")}"]`)).show();
    }));
}

function renderDemonstrativo() {
    const { atual, futuro } = plano.demonstrativo;
    const linha = (rotulo, hoje, campo, fmt = un, dica = "") => `
      <tr><th class="fw-semibold" scope="row">${rotulo}${dica ? ` <i class="bi bi-question-circle text-muted" title="${dica}"></i>` : ""}</th>
      <td>${hoje}</td>${futuro.map(f => `<td>${typeof campo === "function" ? campo(f) : fmt(f[campo])}</td>`).join("")}</tr>`;
    const grupo = (titulo) => `<tr class="table-light"><td colspan="5" class="small text-uppercase text-muted fw-bold">${titulo}</td></tr>`;
    const linhas = [
        grupo("Estoque"),
        linha("Unidades em estoque, sem comprar", un(atual.unidades), "saldo", v => un(v)),
        verCustos ? linha("Valor do estoque, sem comprar", reais(atual.valor_estoque), "valor_saldo", reais) : "",
        linha("Itens abaixo da proteção", `${atual.abaixo_protecao}`, "itens_abaixo_protecao", v => `${v}`, "Proteção = maior valor entre o mínimo e o estoque de segurança"),
        linha("Itens em falta", `${atual.sem_estoque}`, "itens_ruptura", v => `${v}`),
        grupo("Consumo e perdas previstos (acumulados)"),
        linha("Consumo previsto (un.)", "—", "demanda", v => un(v, 1)),
        verCustos ? linha("Consumo previsto (R$)", "—", "valor_demanda", reais) : "",
        linha("Perdas por vencimento (un.)", atual.vencidos ? `${un(atual.vencidos)} vencidas` : "0", "perdas", v => un(v, 1)),
        verCustos ? linha("Perdas por vencimento (R$)", reais(atual.valor_vencidos), "valor_perdas", reais) : "",
        linha("Consumo sem estoque para atender (un.)", "—", "falta", v => un(v, 1)),
        grupo("Compras programadas"),
        linha("Pedidos na janela", atual.listas_abertas ? `${atual.listas_abertas} lista(s) aberta(s)` : "—", f => `${f.compra_itens} itens · ${un(f.compra_unidades)} un.`),
        verCustos ? linha("Gasto na janela", "—", f => `${reais(f.gasto)}${f.compras_sem_custo ? ` <small class="text-muted">+ ${f.compras_sem_custo} sem custo</small>` : ""}`) : "",
        verCustos ? linha("Gasto acumulado", "—", "gasto_acumulado", reais) : "",
        linha("Estoque com as compras (un.)", un(atual.unidades), "saldo_com_compras", v => un(v)),
        verCustos ? linha("Valor do estoque com as compras", reais(atual.valor_estoque), "valor_saldo_com_compras", reais) : ""
    ];
    document.getElementById("demonstrativoBody").innerHTML = linhas.join("");
}

function renderCurvaCompras() {
    const card = document.getElementById("cardCurvaCompras");
    card.classList.toggle("d-none", !verCustos || !plano?.curva_compras);
    if (!verCustos || !plano?.curva_compras) return;
    const meses = plano.curva_compras;
    const janelas = plano.demonstrativo.futuro;
    const nomeMes = (m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    const rotulos = [...meses.map(m => nomeMes(m.mes)), "0–30 d", "31–60 d", "61–90 d"];
    const realizado = [...meses.map(m => m.valor), null, null, null];
    const previsto = [...meses.map(() => null), ...janelas.map(j => j.gasto)];
    const temDados = realizado.some(v => v > 0) || previsto.some(v => v > 0);
    const semCusto = meses.reduce((t, m) => t + m.sem_custo, 0);
    document.getElementById("subCurvaCompras").textContent =
        `Realizado: entradas com custo nos últimos 6 meses${semCusto ? ` (${semCusto} entrada(s) sem custo ficaram de fora)` : ""}. Previsto: compras indicativas de cada janela de 30 dias, pelo mês do pedido.`;
    document.getElementById("boxCurvaCompras").classList.toggle("d-none", !temDados);
    const vazio = document.getElementById("semCurvaCompras");
    vazio.classList.toggle("d-none", temDados);
    vazio.textContent = "Ainda não há compras com custo nem custos para prever o gasto. Informe os custos em Financeiro → Custos ou o custo pago ao receber uma lista.";
    document.getElementById("tabelaCurvaCompras").innerHTML = `
      <thead><tr><th></th>${rotulos.map(r => `<th>${r}</th>`).join("")}</tr></thead>
      <tbody><tr><th scope="row">Realizado</th>${realizado.map(v => `<td>${v === null ? "" : reais(v)}</td>`).join("")}</tr>
      <tr><th scope="row">Previsto</th>${previsto.map(v => `<td>${v === null ? "" : reais(v)}</td>`).join("")}</tr></tbody>`;

    graficoCompras?.destroy();
    graficoCompras = null;
    if (!temDados) return;
    const c = coresGrafico();
    const barra = { maxBarThickness: 24, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", grouped: false };
    graficoCompras = new Chart(document.getElementById("chartCompras"), {
        type: "bar",
        data: {
            labels: rotulos,
            datasets: [
                { label: "Compras realizadas", data: realizado, backgroundColor: c.realizado, ...barra },
                { label: "Compras previstas", data: previsto, backgroundColor: c.previsto, ...barra }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: c.texto, boxWidth: 12, boxHeight: 12 } },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${reais(ctx.parsed.y)}` } }
            },
            scales: eixos(c, (v) => `R$ ${Number(v).toLocaleString("pt-BR", { notation: "compact" })}`)
        }
    });
}

function renderSaude() {
    if (!plano) return;
    const grupos = Object.fromEntries(SITUACOES.map(s => [s.id, []]));
    plano.produtos.forEach(p => grupos[situacao(p).id].push(p));
    document.getElementById("saudeCards").innerHTML = SITUACOES.map(s => `
      <div class="col-6 col-md-4 col-xl-2">
        <button class="card shadow border-0 rounded-4 p-3 h-100 w-100 text-start card-situacao ${filtroSaude === s.id ? "ativa" : ""}" data-situacao="${s.id}">
          <h6 class="text-muted mb-1"><i class="bi ${s.icone} text-${s.cor}"></i> ${s.label}</h6>
          <h3 class="mb-0">${grupos[s.id].length}</h3>
          <small class="text-muted">${Math.round(grupos[s.id].length / Math.max(1, plano.produtos.length) * 100)}% dos itens</small>
        </button>
      </div>`).join("");
    document.querySelectorAll(".card-situacao").forEach(b => b.addEventListener("click", () => { filtroSaude = b.dataset.situacao; renderSaude(); }));

    const comConsumo = plano.produtos.filter(p => p.demanda_semanal > 0);
    const coberturas = comConsumo.map(cobertura).filter(v => v !== null).sort((a, b) => a - b);
    const mediana = coberturas.length ? coberturas[Math.floor(coberturas.length / 2)] : null;
    const consumoAno = comConsumo.reduce((t, p) => t + p.demanda_semanal * 52, 0);
    const estoqueComConsumo = comConsumo.reduce((t, p) => t + p.quantidade, 0);
    const valorDe = (lista) => lista.reduce((t, p) => t + (p.custo_referencia ?? 0) * p.quantidade, 0);
    const indicadores = [
        ["bi-hourglass-split", "Cobertura mediana", mediana === null ? "—" : `${un(mediana)} dias`, "Quanto o estoque dura no consumo previsto, nos itens com consumo"],
        ["bi-arrow-repeat", "Giro previsto", estoqueComConsumo ? `${un(consumoAno / estoqueComConsumo, 1)}× ao ano` : "—", "Consumo de 12 meses ÷ estoque atual, nos itens com consumo"],
        ["bi-calendar-x", "Vencem antes do uso (90 dias)", `${un(plano.demonstrativo.futuro[2].perdas, 1)} un.`, `${plano.demonstrativo.futuro[2].itens_com_perda} item(ns)` + (verCustos ? ` · ${reais(plano.demonstrativo.futuro[2].valor_perdas)}` : "")],
        verCustos
            ? ["bi-safe", "Valor parado ou em excesso", reais(valorDe([...grupos.parado, ...grupos.excesso])), `${grupos.parado.length + grupos.excesso.length} item(ns) sem consumo ou com mais de 180 dias de estoque`]
            : ["bi-safe", "Itens parados ou em excesso", `${grupos.parado.length + grupos.excesso.length}`, "Sem consumo registrado ou com mais de 180 dias de estoque"]
    ];
    document.getElementById("saudeIndicadores").innerHTML = indicadores.map(([icone, titulo, valor, detalhe]) => tile(icone, "primary", titulo, valor, detalhe)).join("");

    const s = SITUACOES.find(x => x.id === filtroSaude);
    const itens = s ? grupos[s.id] : SITUACOES.flatMap(x => grupos[x.id]);
    document.getElementById("saudeTitulo").innerHTML = s ? `<i class="bi ${s.icone} text-${s.cor}"></i> ${s.label} <span class="badge bg-primary">${itens.length}</span>` : `Todos os itens, do mais grave ao mais leve <span class="badge bg-primary">${itens.length}</span>`;
    document.getElementById("saudeBody").innerHTML = itens.map(p => {
        const sit = situacao(p);
        const cob = cobertura(p);
        return `
        <tr>
          <td><strong>${linkProduto(p)}</strong><br><small class="text-muted">${escapeHtml(p.categoria || "")}</small></td>
          <td class="text-nowrap"><i class="bi ${sit.icone} text-${sit.cor}"></i> ${sit.label}</td>
          <td>${p.quantidade} <small class="text-muted">${escapeHtml(p.unidade || "")}</small></td>
          <td>${p.protecao}</td>
          <td>${p.demanda_semanal > 0 ? semanal(p.demanda_semanal) : "-"}</td>
          <td>${cob === null ? "-" : cob > 999 ? "> 999 dias" : `${un(cob)} dias`}</td>
          <td>${p.vencido > 0 ? `<span class="text-danger">${p.vencido} vencida(s)</span>` : p.validade_proxima ? formatDateBR(p.validade_proxima) : "-"}</td>
          <td><small>${escapeHtml(p.motivo || "")}</small></td>
        </tr>`;
    }).join("") || `<tr><td colspan="8" class="text-center text-muted py-4">Nenhum item nesta situação.</td></tr>`;
}

function itensDaJanela(k) {
    return plano.produtos
        .filter(p => p.horizontes[k].compra > 0)
        .map(p => ({ p, h: p.horizontes[k] }))
        .sort((a, b) => a.h.pedir_ate.localeCompare(b.h.pedir_ate) || a.p.nome.localeCompare(b.p.nome, "pt-BR"));
}

function renderJanelas() {
    if (!plano) return;
    const podeSalvar = can(user, "compras_edit");
    const nomes = ["Próximos 30 dias", "De 31 a 60 dias", "De 61 a 90 dias"];
    const opcoesFornecedor = `<option value="">Sem fornecedor</option>` + fornecedores.map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join("");
    document.getElementById("janelas").innerHTML = [0, 1, 2].map(k => {
        const itens = itensDaJanela(k);
        const f = plano.demonstrativo.futuro[k];
        return `
        <div class="table-container mb-4">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h5 class="mb-0"><i class="bi bi-calendar-range"></i> ${nomes[k]} <span class="badge bg-primary">${itens.length}</span></h5>
              <small class="text-muted">${un(f.compra_unidades)} un.${verCustos ? ` · ${reais(f.gasto)}${f.compras_sem_custo ? ` + ${f.compras_sem_custo} sem custo` : ""}` : ""}</small>
            </div>
            ${itens.length && podeSalvar ? `
            <div class="d-flex gap-2 flex-wrap no-print">
              <select class="form-select form-select-sm" style="width:auto" id="fornecedorJanela${k}" aria-label="Fornecedor da lista">${opcoesFornecedor}</select>
              <button class="btn btn-sm btn-success btn-gerar" data-k="${k}"><i class="bi bi-save"></i> Gerar lista de compra</button>
              ${verCustos ? `<button class="btn btn-sm btn-outline-primary btn-cotar" data-k="${k}"><i class="bi bi-envelope-paper"></i> Pedir cotação</button>` : ""}
            </div>` : ""}
          </div>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead><tr>${podeSalvar ? `<th class="no-print"></th>` : ""}<th>Produto</th><th>Curva</th><th>Pedir até</th><th>Quantidade</th>${verCustos ? "<th>Valor previsto</th>" : ""}<th>Motivo</th></tr></thead>
              <tbody>${itens.map(({ p, h }) => {
                const chave = `${k}-${p.produto_id}`;
                const hoje = h.pedir_ate <= plano.hoje;
                return `
                <tr class="${desmarcados.has(chave) ? "text-muted no-print" : ""}">
                  ${podeSalvar ? `<td class="no-print"><input class="form-check-input sel-janela" type="checkbox" data-chave="${chave}" ${desmarcados.has(chave) ? "" : "checked"} aria-label="Incluir ${escapeHtml(p.nome)}"></td>` : ""}
                  <td><strong>${linkProduto(p)}</strong><br><small class="text-muted">Estoque ${p.quantidade} · proteção ${p.protecao}</small></td>
                  <td>${badgeClasse(p)}</td>
                  <td class="text-nowrap">${hoje ? `<span class="badge bg-danger">Pedir hoje</span>` : formatDateBR(h.pedir_ate)}</td>
                  <td><strong>${un(h.compra)}</strong> <small class="text-muted">${escapeHtml(p.unidade || "")}</small></td>
                  ${verCustos ? `<td>${h.gasto === null ? `<small class="text-muted">sem custo</small>` : reais(h.gasto)}</td>` : ""}
                  <td><small>${escapeHtml(p.motivo || "Reposição prevista pelo consumo")}</small></td>
                </tr>`;
              }).join("") || `<tr><td colspan="7" class="text-center text-muted py-3"><i class="bi bi-check-circle text-success"></i> Nenhuma compra necessária nesta janela.</td></tr>`}</tbody>
            </table>
          </div>
        </div>`;
    }).join("");
    document.querySelectorAll(".sel-janela").forEach(cb => cb.addEventListener("change", () => {
        cb.checked ? desmarcados.delete(cb.dataset.chave) : desmarcados.add(cb.dataset.chave);
        cb.closest("tr").classList.toggle("text-muted", !cb.checked);
    }));
    document.querySelectorAll(".btn-gerar").forEach(b => b.addEventListener("click", () => gerarLista(Number(b.dataset.k))));
    document.querySelectorAll(".btn-cotar").forEach(b => b.addEventListener("click", () => pedirCotacao(Number(b.dataset.k))));
}

function selecionadosDaJanela(k) {
    return itensDaJanela(k).filter(({ p }) => !desmarcados.has(`${k}-${p.produto_id}`));
}

async function gerarLista(k) {
    const itens = selecionadosDaJanela(k);
    if (!itens.length) return alert("Selecione ao menos um item.");
    const faixa = ["0–30", "31–60", "61–90"][k];
    const titulo = `Planejamento ${faixa} dias — ${new Date().toLocaleDateString("pt-BR")}`;
    try {
        await createListaCompra({
            titulo,
            fornecedorId: document.getElementById(`fornecedorJanela${k}`)?.value || null,
            observacao: `Gerada pelo planejamento estatístico (base de ${plano.parametros.base_dias} dias${plano.parametros.ajuste ? `, cenário ${plano.parametros.ajuste}%` : ""}).`,
            itens: itens.map(({ p, h }) => ({
                produto_id: p.produto_id,
                quantidade: h.compra,
                quantidade_sugerida: h.compra,
                motivo: `Pedir até ${formatDateBR(h.pedir_ate)} · curva ${p.classe}${p.motivo ? ` · ${p.motivo}` : ""}`
            }))
        });
        mensagem(`Lista "${escapeHtml(titulo)}" criada com ${itens.length} item(ns). <a class="alert-link" href="compras.html">Abrir a Lista de Compras</a>. Ela já entra no planejamento como pedido em aberto.`, "success");
        await carregar();
    } catch (err) {
        mensagem("Erro ao gerar a lista: " + escapeHtml(err.message), "danger");
    }
}

/** Leva os itens da janela para a tela de Cotações, que abre o formulário já preenchido. */
function pedirCotacao(k) {
    const itens = selecionadosDaJanela(k);
    if (!itens.length) return alert("Selecione ao menos um item.");
    try {
        sessionStorage.setItem("auxiliarOdontCotacao", JSON.stringify({
            titulo: `Cotação ${["0–30", "31–60", "61–90"][k]} dias — ${new Date().toLocaleDateString("pt-BR")}`,
            itens: itens.map(({ p, h }) => ({ produto_id: p.produto_id, nome: p.nome, unidade: p.unidade, quantidade: h.compra }))
        }));
    } catch {
        return alert("Não foi possível levar os itens para a cotação neste navegador.");
    }
    window.location.href = "cotacoes.html?nova=1";
}

function itensPrevisaoFiltrados() {
    const busca = document.getElementById("filtroBusca").value.trim().toLowerCase();
    const classe = document.getElementById("filtroClasse").value;
    const sit = document.getElementById("filtroSituacao").value;
    return plano.produtos.filter(p => {
        if (classe && p.classe !== classe) return false;
        if (sit === "compra" && p.horizontes[2].compra_acumulada === 0) return false;
        if (sit === "consumo" && p.demanda_semanal === 0) return false;
        return !busca || p.nome.toLowerCase().includes(busca) || String(p.codigo_barras || "").toLowerCase().includes(busca);
    });
}

function textoTendencia(p) {
    if (p.tendencia_pct === null) return "-";
    if (Math.abs(p.tendencia_pct) < 10) return `<span class="text-muted" title="Variação da previsão sobre a média da base">→ estável</span>`;
    return p.tendencia_pct > 0
        ? `<span class="text-danger" title="Previsão acima da média da base">↑ ${un(p.tendencia_pct)}%</span>`
        : `<span class="text-success" title="Previsão abaixo da média da base">↓ ${un(Math.abs(p.tendencia_pct))}%</span>`;
}

function renderPrevisao() {
    if (!plano) return;
    const itens = itensPrevisaoFiltrados();
    document.getElementById("qtdPrevisao").textContent = itens.length;
    document.getElementById("previsaoBody").innerHTML = itens.map(p => {
        const [h30, h60, h90] = p.horizontes;
        const gasto90 = [h30, h60, h90].reduce((t, h) => h.gasto === null || t === null ? null : t + h.gasto, 0);
        return `
        <tr>
          <td><strong>${linkProduto(p)}</strong><br><small class="text-muted">${escapeHtml(p.codigo_barras || "")}</small></td>
          <td>${badgeClasse(p)}</td>
          <td>${badgeMetodo(p)}</td>
          <td>${p.demanda_semanal > 0 ? semanal(p.demanda_semanal) : "-"}</td>
          <td class="text-nowrap">${textoTendencia(p)}</td>
          <td>${p.quantidade}${p.pendente ? ` <small class="text-muted" title="Em listas abertas">+${p.pendente}</small>` : ""}</td>
          <td title="Mínimo ${p.estoque_minimo} · segurança ${p.estoque_seguranca}">${p.protecao}</td>
          <td>${p.ponto_pedido}</td>
          <td class="text-nowrap">${p.data_ruptura ? formatDateBR(p.data_ruptura) : `<span class="text-muted">após ${formatNumBR(390)} dias</span>`}</td>
          <td class="text-nowrap">${p.data_pedido ? (p.dia_pedido === 0 ? `<span class="badge bg-danger">Hoje</span>` : formatDateBR(p.data_pedido)) : "-"}</td>
          <td class="text-nowrap">${h30.compra} · ${h60.compra} · ${h90.compra}</td>
          ${verCustos ? `<td>${h90.compra_acumulada === 0 ? "-" : gasto90 === null ? `<small class="text-muted">sem custo</small>` : reais(gasto90)}</td>` : ""}
          <td class="no-print"><button class="btn btn-sm btn-outline-primary btn-detalhe" data-id="${p.produto_id}" title="Ver o comportamento aprendido"><i class="bi bi-graph-up"></i></button></td>
        </tr>`;
    }).join("") || `<tr><td colspan="13" class="text-center text-muted py-4">Nenhum produto com esses filtros.</td></tr>`;
    document.querySelectorAll(".btn-detalhe").forEach(b => b.addEventListener("click", () => abrirProduto(plano.produtos.find(p => String(p.produto_id) === b.dataset.id))));
}

function abrirProduto(p) {
    produtoAberto = p;
    const m = METODOS[p.metodo];
    document.getElementById("modalProdutoTitulo").innerHTML = `${badgeClasse(p)} ${escapeHtml(p.nome)}`;
    document.getElementById("modalProdutoSub").textContent = p.serie.length
        ? `${p.serie.length} semana(s) de histórico e 13 semanas de previsão. A faixa mostra a variação provável para o nível de serviço de ${p.nivel_servico}%.`
        : "Sem saídas na base: não há comportamento para mostrar.";
    const dado = (rotulo, valor) => `<div class="d-flex justify-content-between border-bottom py-1"><span class="text-muted">${rotulo}</span><strong class="text-end">${valor}</strong></div>`;
    document.getElementById("modalProdutoDados").innerHTML = [
        dado("Método", `${m.label} <small class="text-muted d-block fw-normal">${m.titulo}</small>`),
        dado("Consumo na base", `${un(p.consumo_base)} un.`),
        dado("Média semanal da base", semanal(p.media_semanal)),
        dado("Previsão da próxima semana", semanal(p.demanda_semanal)),
        dado("Tendência", textoTendencia(p)),
        dado("Desvio semanal", semanal(p.desvio_semanal)),
        dado("Estoque atual", `${p.quantidade}${p.pendente ? ` + ${p.pendente} a chegar` : ""}`),
        dado("Estoque mínimo", p.estoque_minimo),
        dado(`Estoque de segurança (${p.nivel_servico}%)`, p.estoque_seguranca),
        dado("Ponto de pedido", p.ponto_pedido),
        dado("Acaba em", p.data_ruptura ? formatDateBR(p.data_ruptura) : "após 390 dias"),
        verCustos ? dado("Custo de referência", reais(p.custo_referencia)) : ""
    ].join("");
    document.getElementById("modalProdutoJanelas").innerHTML = `
      <table class="table table-sm align-middle mb-0">
        <thead><tr><th>Janela</th><th>Consumo previsto</th><th>Perdas</th><th>Sem estoque</th><th>Saldo sem comprar</th><th>Comprar</th><th>Pedir até</th>${verCustos ? "<th>Valor</th>" : ""}</tr></thead>
        <tbody>${p.horizontes.map((h, i) => `
          <tr><td>${["0–30", "31–60", "61–90"][i]} dias</td><td>${un(h.demanda, 1)}</td><td>${un(h.perdas, 1)}</td><td>${un(h.falta, 1)}</td><td>${un(h.saldo, 1)}</td>
          <td><strong>${h.compra}</strong></td><td>${h.pedir_ate ? formatDateBR(h.pedir_ate) : "-"}</td>${verCustos ? `<td>${h.compra ? reais(h.gasto) : "-"}</td>` : ""}</tr>`).join("")}
        </tbody>
      </table>`;
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("modalProduto"));
    document.getElementById("modalProduto").addEventListener("shown.bs.modal", () => renderGraficoProduto(p), { once: true });
    document.getElementById("modalProduto").addEventListener("hidden.bs.modal", () => { produtoAberto = null; }, { once: true });
    modal.show();
}

function renderGraficoProduto(p) {
    graficoProduto?.destroy();
    graficoProduto = null;
    if (!p.serie.length) return;
    const c = coresGrafico();
    const inicio = new Date(`${plano.aprendizado.inicio}T00:00:00`);
    const semana = (i) => { const d = new Date(inicio); d.setDate(d.getDate() + i * 7); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
    const n = p.serie.length;
    const rotulos = Array.from({ length: n + p.previsao.length }, (_, i) => semana(i));
    const z = { A: 2.054, B: 1.645, C: 1.282 }[p.classe];
    const vazio = Array(n).fill(null);
    graficoProduto = new Chart(document.getElementById("chartProduto"), {
        data: {
            labels: rotulos,
            datasets: [
                { type: "bar", label: "Consumo realizado", data: [...p.serie, ...p.previsao.map(() => null)], backgroundColor: c.realizado, maxBarThickness: 24, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", order: 3 },
                { type: "line", label: "faixa-inferior", data: [...vazio, ...p.previsao.map(v => Math.max(0, v - z * p.desvio_semanal))], borderWidth: 0, pointRadius: 0, fill: false, order: 2 },
                { type: "line", label: "Faixa provável", data: [...vazio, ...p.previsao.map(v => v + z * p.desvio_semanal)], borderWidth: 0, pointRadius: 0, backgroundColor: c.faixa, fill: "-1", order: 2 },
                { type: "line", label: "Previsão", data: [...vazio, ...p.previsao], borderColor: c.linha, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c.linha, pointHoverBorderColor: c.superficie, pointHoverBorderWidth: 2, order: 1 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { labels: { color: c.texto, boxWidth: 12, boxHeight: 12, filter: (item) => item.text !== "faixa-inferior" } },
                tooltip: {
                    filter: (item) => item.dataset.label !== "faixa-inferior" && item.parsed.y !== null,
                    callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${semanal(ctx.parsed.y)} ${p.unidade || "un."}` }
                }
            },
            scales: eixos(c, (v) => formatNumBR(v, Number.isInteger(v) ? 0 : 1))
        }
    });
}

function exportarCsv() {
    if (!plano) return;
    const cabecalho = ["codigo", "produto", "curva", "nivel_servico", "metodo", "consumo_base", "consumo_semanal_previsto", "tendencia_pct", "estoque", "pendente", "minimo",
        "estoque_seguranca", "protecao", "ponto_pedido", "acaba_em", "pedir_ate", "comprar_30", "comprar_60", "comprar_90"];
    if (verCustos) cabecalho.push("custo_referencia", "gasto_90");
    downloadCsv(`planejamento_${plano.hoje}.csv`, cabecalho, itensPrevisaoFiltrados().map(p => {
        const linha = [p.codigo_barras || "", p.nome, p.classe, p.nivel_servico, METODOS[p.metodo].label, p.consumo_base, p.demanda_semanal, p.tendencia_pct ?? "",
            p.quantidade, p.pendente, p.estoque_minimo, p.estoque_seguranca, p.protecao, p.ponto_pedido, p.data_ruptura || "", p.data_pedido || "",
            ...p.horizontes.map(h => h.compra)];
        if (verCustos) linha.push(p.custo_referencia ?? "", p.horizontes.reduce((t, h) => t + (h.gasto ?? 0), 0));
        return linha;
    }));
}
