// Sidebar, tema, comando de voz e beep sonoro (substitui includes/header.php e footer.php).
import { logout } from "./auth.js";
import { can, roleLabel, roleBadgeClass } from "./permissions.js";

const MENU_ITEMS = [
    { href: "dashboard.html", icon: "bi-house-door", label: "Dashboard", perm: null },
    { href: "produtos.html", icon: "bi-box", label: "Produtos", perm: "produtos_view" },
    { href: "usuarios.html", icon: "bi-people", label: "Usuários", perm: "usuarios" },
    { href: "historico.html", icon: "bi-clock-history", label: "Histórico", perm: "historico" },
    { href: "produtos.html?acao=entrada", icon: "bi-box-arrow-in-down", label: "Entrada", perm: "entrada" },
    { href: "produtos.html?acao=saida", icon: "bi-box-arrow-up", label: "Saída", perm: "saida" }
];

export function renderShell(activePage, user) {
    const shell = document.getElementById("app-shell");
    if (!shell) return;

    const links = MENU_ITEMS
        .filter(item => !item.perm || can(user, item.perm))
        .map(item => {
            const isActive = item.href.startsWith(activePage) ? " active" : "";
            return `<a href="${item.href}" class="${isActive}"><i class="bi ${item.icon}"></i> ${item.label}</a>`;
        }).join("");

    const saudacao = user ? `
      <div class="sidebar-user">
        <div class="sidebar-user-avatar"><i class="bi bi-person-fill"></i></div>
        <div>
          <div class="sidebar-user-name">Olá, ${user.nome}</div>
          <span class="badge ${roleBadgeClass(user.role)}">${roleLabel(user.role)}</span>
        </div>
      </div>` : "";

    shell.innerHTML = `
    <button class="menu-toggle btn btn-primary" id="menuToggle" title="Abrir menu"><i class="bi bi-list"></i></button>
    <div class="sidebar" id="sidebarMenu">
      <h4><i class="bi bi-box-seam"></i> Auxiliar Odont</h4>
      ${saudacao}
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
      <a href="#" id="logoutLink"><i class="bi bi-box-arrow-right"></i> Sair</a>
    </div>`;

    document.getElementById("menuToggle")?.addEventListener("click", () => {
        document.getElementById("sidebarMenu").classList.toggle("show");
    });

    document.getElementById("logoutLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
    });

    setupTheme();
    setupVoice();
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
    if (text.includes("dashboard") || text.includes("painel")) {
        window.location.href = "dashboard.html";
        return;
    }
    if (text.includes("produto")) {
        if (text.includes("vencid") || text.includes("vencimento")) {
            window.location.href = "produtos.html?filter=vencidos";
        } else if (text.includes("próximo") || text.includes("proximo") || text.includes("perto")) {
            window.location.href = "produtos.html?filter=prestes";
        } else {
            window.location.href = "produtos.html";
        }
        return;
    }
    if (text.includes("usuário") || text.includes("usuario")) {
        window.location.href = "usuarios.html";
        return;
    }
    if (text.includes("sair") || text.includes("fechar")) {
        logout();
        return;
    }
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
