// Sidebar, tema, comando de voz e beep sonoro (substitui includes/header.php e footer.php).
import { logout } from "./auth.js";
import { can, roleLabel, roleBadgeClass } from "./permissions.js";
import { getConfiguracoes, contarCadastrosPendentes, listProdutos, verificarEnvios } from "./data.js";
import { calcularAlertas } from "./alertas.js";
import { escapeHtml } from "./utils.js";
import { MODO_PREVIA } from "./api.js";

const MENU_ITEMS = [
    { href: "dashboard.html", icon: "bi-house-door", label: "Dashboard", perm: null },
    { grupo: "Gestão de estoque", href: "produtos.html", icon: "bi-box", label: "Produtos", perm: "produtos_view" },
    { grupo: "Gestão de estoque", href: "movimentar.html", icon: "bi-qr-code-scan", label: "Movimentar (QR)", perm: "movimentar" },
    { grupo: "Gestão de estoque", href: "caixa.html", icon: "bi-cash-stack", label: "Caixa (PDV)", perm: "saida" },
    { grupo: "Gestão de estoque", href: "etiquetas.html", icon: "bi-qr-code", label: "Etiquetas QR", perm: "etiquetas" },
    { grupo: "Gestão de estoque", href: "historico.html", icon: "bi-clock-history", label: "Histórico", perm: "historico" },
    { grupo: "Compras e planejamento", href: "planejamento.html", icon: "bi-graph-up-arrow", label: "Planejamento 30/60/90", perm: "compras" },
    { grupo: "Compras e planejamento", href: "compras.html", icon: "bi-cart-check", label: "Lista de Compras", perm: "compras" },
    { grupo: "Compras e planejamento", href: "cotacoes.html", icon: "bi-envelope-paper", label: "Cotações", perm: "financeiro" },
    { grupo: "Compras e planejamento", href: "fornecedores.html", icon: "bi-truck", label: "Fornecedores", perm: "compras" },
    { grupo: "Administração", href: "financeiro.html", icon: "bi-cash-coin", label: "Financeiro", perm: "financeiro" },
    { grupo: "Administração", href: "controle.html", icon: "bi-shield-check", label: "Controle e Curva ABC", perm: "controle" },
    { grupo: "Administração", href: "usuarios.html", icon: "bi-people", label: "Usuários", perm: "usuarios" },
    { grupo: "Sistema", href: "sobre.html", icon: "bi-info-circle", label: "Sobre o projeto", perm: null }
];

export function renderShell(activePage, user) {
    const shell = document.getElementById("app-shell");
    if (!shell) return;

    let grupoAtual = null;
    const links = MENU_ITEMS
        .filter(item => !item.perm || can(user, item.perm))
        .map(item => {
            const isActive = item.href.startsWith(activePage) ? " active" : "";
            const titulo = item.grupo && item.grupo !== grupoAtual ? `<div class="sidebar-grupo">${item.grupo}</div>` : "";
            grupoAtual = item.grupo || grupoAtual;
            return `${titulo}<a href="${item.href}" class="${isActive}"><i class="bi ${item.icon}"></i> ${item.label}</a>`;
        }).join("");

    const saudacao = user ? `
      <div class="sidebar-user">
        <div class="sidebar-user-avatar"><i class="bi bi-person-fill"></i></div>
        <div>
          <div class="sidebar-user-name">Olá, ${escapeHtml(user.nome)}</div>
          <span class="badge ${roleBadgeClass(user.role)}">${roleLabel(user.role)}</span>
        </div>
      </div>` : "";

    shell.innerHTML = `
    <button class="menu-toggle btn btn-primary" id="menuToggle" title="Abrir menu"><i class="bi bi-list"></i></button>
    <div class="sidebar" id="sidebarMenu">
      <h4><i class="bi bi-box-seam"></i> Auxiliar Odont</h4>
      ${saudacao}
      <div id="sidebarAlertas"></div>
      ${links}
      <hr />
      <div class="px-3 d-flex flex-column gap-2">
        <div class="d-flex justify-content-between align-items-center">
          <div class="voice-btn">
            <button id="voiceControlBtn" class="btn btn-outline-primary btn-sm" type="button" title="Ativar comando de voz">
              <i id="voiceIcon" class="bi bi-mic-fill"></i> <span id="voiceLabel">Ouvir</span>
            </button>
          </div>
          <div class="top-actions">
            <button id="themeToggle" class="btn btn-outline-secondary btn-sm" title="Alternar tema"><i id="themeIcon" class="bi bi-moon-fill"></i></button>
          </div>
        </div>
      </div>
      <hr />
      <a href="nova-senha.html" class="${activePage === "nova-senha.html" ? "active" : ""}"><i class="bi bi-key"></i> Alterar senha</a>
      <a href="#" id="logoutLink"><i class="bi bi-box-arrow-right"></i> Sair</a>
    </div>`;

    if (MODO_PREVIA) {
        document.querySelector(".main-content")?.insertAdjacentHTML("afterbegin", `
        <div class="faixa-previa no-print" role="note">
          <i class="bi bi-eye"></i> <strong>Prévia de demonstração</strong>: produtos e preços reais do catálogo, movimentações, fornecedores e cotações simulados.
          Navegue à vontade; nada é gravado. <a href="documentacao/">Resumo do projeto com prints</a>
        </div>`);
    }

    document.getElementById("menuToggle")?.addEventListener("click", () => {
        document.getElementById("sidebarMenu").classList.toggle("show");
    });

    document.getElementById("logoutLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
    });

    setupTheme();
    setupVoice();
    if (user) {
        carregarAlertasSidebar(user);
        dispararEnviosVencidos();
    }
}

/**
 * Os e-mails programados saem na primeira visita depois do horário: não há tarefa agendada
 * no Windows. Cada aba confere no máximo a cada 10 minutos, sem esperar a resposta.
 */
function dispararEnviosVencidos() {
    const CHAVE = "auxiliarOdontEnvios";
    try {
        const ultima = Number(sessionStorage.getItem(CHAVE) || 0);
        if (Date.now() - ultima < 10 * 60 * 1000) return;
        sessionStorage.setItem(CHAVE, String(Date.now()));
    } catch {
        // Sem sessionStorage, confere a cada página; o servidor evita envio em dobro.
    }
    verificarEnvios().catch(err => console.warn("Envios automáticos indisponíveis", err));
}

/** Resumo de alertas (vencidos, vencendo, abaixo do mínimo) visível em todas as páginas. */
async function carregarAlertasSidebar(user) {
    const box = document.getElementById("sidebarAlertas");
    if (!box) return;
    try {
        const [produtos, cfg, pendentes] = await Promise.all([
            listProdutos(),
            getConfiguracoes(),
            can(user, "usuarios") ? contarCadastrosPendentes() : 0
        ]);
        const a = calcularAlertas(produtos, cfg);
        if (a.total === 0 && pendentes === 0) {
            box.innerHTML = `<div class="sidebar-alertas ok"><i class="bi bi-check-circle"></i> Estoque sem alertas</div>`;
            return;
        }
        const destinoBaixo = can(user, "compras") ? "compras.html" : "produtos.html?filter=baixo";
        const chip = (href, cls, icon, n, label) => n > 0
            ? `<a href="${href}" class="alerta-chip ${cls}" title="${label}"><i class="bi ${icon}"></i> ${n} <span>${label}</span></a>` : "";
        box.innerHTML = `
        <div class="sidebar-alertas">
          <div class="sidebar-alertas-titulo"><i class="bi bi-bell-fill"></i> Alertas</div>
          ${chip("usuarios.html", "chip-warning", "bi-person-plus", pendentes, "cadastro(s) aguardando")}
          ${chip("produtos.html?filter=vencidos", "chip-danger", "bi-exclamation-octagon", a.vencidos.length, "vencido(s)")}
          ${chip("produtos.html?filter=prestes", "chip-warning", "bi-hourglass-split", a.vencendo.length, `vence(m) em ${cfg.dias_alerta_validade}d`)}
          ${chip(destinoBaixo, "chip-danger", "bi-exclamation-octagon", a.repor.length, "para repor")}
          ${chip(destinoBaixo, "chip-warning", "bi-exclamation-triangle", a.atencao.length, "em atenção")}
        </div>`;
    } catch (err) {
        console.warn("Alertas da sidebar indisponíveis", err);
    }
}

function setupTheme() {
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");
    function applyTheme(t) {
        document.body.classList.remove("theme-light", "theme-dark");
        document.body.classList.add(t);
        localStorage.setItem("siteTheme", t);
        if (themeIcon) themeIcon.className = t === "theme-dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
    }
    applyTheme(localStorage.getItem("siteTheme") || "theme-light");
    themeToggle?.addEventListener("click", () =>
        applyTheme(document.body.classList.contains("theme-dark") ? "theme-light" : "theme-dark")
    );
}

function setupVoice() {
    const voiceBtn = document.getElementById("voiceControlBtn");
    const voiceLabel = document.getElementById("voiceLabel");
    const voiceIcon = document.getElementById("voiceIcon");
    if (!voiceBtn) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SR) {
        recognition = new SR();
        recognition.lang = "pt-BR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            voiceLabel.textContent = "Ouvindo...";
            voiceIcon.className = "bi bi-mic";
            voiceBtn.classList.add("btn-danger");
        };
        recognition.onend = () => {
            voiceLabel.textContent = "Ouvir";
            voiceIcon.className = "bi bi-mic-fill";
            voiceBtn.classList.remove("btn-danger");
        };
        recognition.onerror = (e) => console.log("Voice error", e);
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript.toLowerCase().trim();
            handleVoiceCommand(text);
        };
    } else {
        voiceBtn.disabled = true;
        voiceLabel.textContent = "Sem voz";
    }

    voiceBtn.addEventListener("click", () => {
        if (!recognition) return alert("Web Speech API não disponível (use Chrome/Edge).");
        try { recognition.start(); } catch (e) { console.log(e); }
    });
}

function handleVoiceCommand(text) {
    const ir = (href) => { window.location.href = href; };
    if (text.includes("curva") || text.includes("abc") || text.includes("controle")) return ir("controle.html");
    if (text.includes("senha")) return ir("nova-senha.html");
    if (text.includes("planejamento") || text.includes("previsão") || text.includes("previsao") || text.includes("provisionamento") || text.includes("saúde") || text.includes("saude")) return ir("planejamento.html");
    if (text.includes("financeiro") || text.includes("gasto") || text.includes("custo") || text.includes("análise") || text.includes("analise")) return ir("financeiro.html");
    if (text.includes("cotação") || text.includes("cotacao") || text.includes("orçamento") || text.includes("orcamento")) return ir("cotacoes.html");
    if (text.includes("fornecedor")) return ir("fornecedores.html");
    if (text.includes("dashboard") || text.includes("painel") || text.includes("início") || text.includes("inicio")) return ir("dashboard.html");
    if (text.includes("compra") || text.includes("repor") || text.includes("reposição") || text.includes("reposicao")) return ir("compras.html");
    if (text.includes("etiqueta")) return ir("etiquetas.html");
    if (text.includes("escanear") || text.includes("scanner") || text.includes("qr") || text.includes("movimentar")) return ir("movimentar.html");
    if (text.includes("entrada")) return ir("movimentar.html?tipo=entrada");
    if (text.includes("saída") || text.includes("saida") || text.includes("retirar")) return ir("movimentar.html?tipo=saida");
    if (text.includes("caixa") || text.includes("venda")) return ir("caixa.html");
    if (text.includes("histórico") || text.includes("historico")) return ir("historico.html");
    if (text.includes("vencid")) return ir("produtos.html?filter=vencidos");
    if (text.includes("vencendo") || text.includes("vencimento") || text.includes("validade")) return ir("produtos.html?filter=prestes");
    if (text.includes("baixo") || text.includes("mínimo") || text.includes("minimo")) return ir("produtos.html?filter=baixo");
    if (text.includes("produto") || text.includes("estoque")) return ir("produtos.html");
    if (text.includes("usuário") || text.includes("usuario")) return ir("usuarios.html");
    if (text.includes("sobre") || text.includes("projeto")) return ir("sobre.html");
    if (text.includes("sair") || text.includes("fechar")) return logout();
    alert("Comando não reconhecido: " + text);
}

window.playBeep = function (type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        if (type === "red") o.frequency.value = 520;
        else if (type === "yellow") o.frequency.value = 360;
        else o.frequency.value = 440;
        g.gain.value = 0.001;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65);
        setTimeout(() => { o.stop(); ctx.close(); }, 750);
    } catch (e) { console.warn("playBeep falhou", e); }
};
