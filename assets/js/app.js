const STORAGE_KEY = "auxiliar-odont-demo-state";
const SESSION_KEY = "auxiliar-odont-demo-session";
const THEME_KEY = "auxiliar-odont-theme";

const seedState = () => ({
  users: [
    {
      id: crypto.randomUUID(),
      nome: "Administrador",
      email: "admin@local.com",
      senha: "123456",
      role: "admin",
    },
    {
      id: crypto.randomUUID(),
      nome: "Equipe Clínica",
      email: "usuario@local.com",
      senha: "123456",
      role: "user",
    },
  ],
  products: [
    {
      id: crypto.randomUUID(),
      nome: "Luvas de Procedimento",
      descricao: "Caixa com 100 unidades.",
      categoria: "Descartáveis",
      quantidade: 35,
      preco: 42.9,
      validade: futureDate(18),
      createdAt: isoNow(),
    },
    {
      id: crypto.randomUUID(),
      nome: "Resina Fotopolimerizável",
      descricao: "Cor A2 para restaurações.",
      categoria: "Materiais restauradores",
      quantidade: 8,
      preco: 119.5,
      validade: futureDate(5),
      createdAt: isoNow(),
    },
    {
      id: crypto.randomUUID(),
      nome: "Anestésico Tópico",
      descricao: "Uso ambulatorial.",
      categoria: "Medicamentos",
      quantidade: 4,
      preco: 28.4,
      validade: pastDate(3),
      createdAt: isoNow(),
    },
    {
      id: crypto.randomUUID(),
      nome: "Máscara Cirúrgica",
      descricao: "Pacote com 50 unidades.",
      categoria: "EPIs",
      quantidade: 52,
      preco: 19.9,
      validade: futureDate(36),
      createdAt: isoNow(),
    },
  ],
  history: [],
});

const appState = {
  section: "dashboard",
  productFilter: "todos",
  productSearch: "",
  userSearch: "",
  historySearch: "",
  chartInstances: [],
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  ensureSeedState();
  bindEvents();
  applyTheme(localStorage.getItem(THEME_KEY) || "theme-light");
  updateSessionUI();
  renderApp();
});

function cacheElements() {
  [
    "authScreen",
    "appShell",
    "loginForm",
    "loginAlert",
    "loginEmail",
    "loginSenha",
    "loginUser",
    "appUserName",
    "appUserRole",
    "navButtons",
    "sections",
    "sidebar",
    "themeToggle",
    "themeIcon",
    "logoutBtn",
    "resetDemoBtn",
    "mobileSidebarToggle",
    "productSearch",
    "productFilter",
    "historySearch",
    "userSearch",
    "productsTableBody",
    "usersTableBody",
    "historyTableBody",
    "dashboardCards",
    "alertsList",
    "emptyProducts",
    "emptyUsers",
    "emptyHistory",
    "productsCountLabel",
    "usersCountLabel",
    "historyCountLabel",
    "exportProductsBtn",
    "exportHistoryBtn",
    "newProductBtn",
    "newUserBtn",
    "productForm",
    "userForm",
    "movementForm",
    "productModalTitle",
    "userModalTitle",
    "movementModalTitle",
    "movementProductId",
    "movementQuantity",
    "movementReason",
    "movementType",
    "productId",
    "productNome",
    "productDescricao",
    "productCategoria",
    "productQuantidade",
    "productPreco",
    "productValidade",
    "userId",
    "userNome",
    "userEmail",
    "userSenha",
    "userRole",
    "productSummary",
    "userSummary",
    "historySummary",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.navButtons = [...document.querySelectorAll("[data-section-target]")];
  elements.sections = [...document.querySelectorAll("[data-section]")];
  elements.productModal = new bootstrap.Modal(document.getElementById("productModal"));
  elements.userModal = new bootstrap.Modal(document.getElementById("userModal"));
  elements.movementModal = new bootstrap.Modal(document.getElementById("movementModal"));
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutBtn.addEventListener("click", logout);
  elements.resetDemoBtn.addEventListener("click", resetDemo);
  elements.mobileSidebarToggle.addEventListener("click", () => {
    elements.sidebar.classList.toggle("show");
  });
  elements.themeToggle.addEventListener("click", () => {
    applyTheme(document.body.classList.contains("theme-dark") ? "theme-light" : "theme-dark");
  });

  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      appState.section = button.dataset.sectionTarget;
      elements.sidebar.classList.remove("show");
      renderApp();
    });
  });

  elements.productSearch.addEventListener("input", (event) => {
    appState.productSearch = event.target.value.trim().toLowerCase();
    renderProducts();
  });

  elements.productFilter.addEventListener("change", (event) => {
    appState.productFilter = event.target.value;
    renderProducts();
  });

  elements.userSearch.addEventListener("input", (event) => {
    appState.userSearch = event.target.value.trim().toLowerCase();
    renderUsers();
  });

  elements.historySearch.addEventListener("input", (event) => {
    appState.historySearch = event.target.value.trim().toLowerCase();
    renderHistory();
  });

  elements.exportProductsBtn.addEventListener("click", () => {
    exportCsv("produtos-auxiliar-odont.csv", getFilteredProducts(), [
      ["Nome", "Categoria", "Quantidade", "Preço", "Validade", "Status"],
      ...getFilteredProducts().map((product) => [
        product.nome,
        product.categoria,
        product.quantidade,
        toCurrency(product.preco),
        toDate(product.validade),
        getProductStatus(product).label,
      ]),
    ]);
  });

  elements.exportHistoryBtn.addEventListener("click", () => {
    exportCsv("historico-auxiliar-odont.csv", getFilteredHistory(), [
      ["Data", "Tipo", "Item", "Quantidade", "Responsável", "Observação"],
      ...getFilteredHistory().map((entry) => [
        toDateTime(entry.createdAt),
        entry.tipo,
        entry.item,
        entry.quantidade,
        entry.usuario,
        entry.observacao || "",
      ]),
    ]);
  });

  elements.newProductBtn.addEventListener("click", () => openProductModal());
  elements.newUserBtn.addEventListener("click", () => openUserModal());
  elements.productForm.addEventListener("submit", saveProduct);
  elements.userForm.addEventListener("submit", saveUser);
  elements.movementForm.addEventListener("submit", saveMovement);
}

function ensureSeedState() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    const initial = seedState();
    initial.history = [
      makeHistoryEntry("entrada", "Luvas de Procedimento", 20, "Administrador", "Reposição inicial"),
      makeHistoryEntry("saida", "Resina Fotopolimerizável", 2, "Equipe Clínica", "Uso em atendimento"),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  }
}

function handleLogin(event) {
  event.preventDefault();
  const email = elements.loginEmail.value.trim().toLowerCase();
  const senha = elements.loginSenha.value;
  const state = loadState();
  const user = state.users.find((candidate) => candidate.email.toLowerCase() === email && candidate.senha === senha);

  if (!user) {
    elements.loginAlert.textContent = "Credenciais inválidas. Use o acesso de demonstração.";
    elements.loginAlert.classList.remove("hidden");
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
  elements.loginAlert.classList.add("hidden");
  elements.loginForm.reset();
  updateSessionUI();
  renderApp();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  updateSessionUI();
  renderApp();
}

function resetDemo() {
  if (!window.confirm("Deseja restaurar os dados de demonstração?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
  ensureSeedState();
  updateSessionUI();
  renderApp();
}

function updateSessionUI() {
  const session = getSessionUser();
  const loggedIn = Boolean(session);
  elements.authScreen.classList.toggle("hidden", loggedIn);
  elements.appShell.classList.toggle("hidden", !loggedIn);
  if (!loggedIn) return;
  elements.appUserName.textContent = session.nome;
  elements.appUserRole.textContent = session.role === "admin" ? "Administrador" : "Usuário";
}

function renderApp() {
  if (!getSessionUser()) return;
  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === appState.section);
  });
  elements.sections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.section !== appState.section);
  });
  populateMovementProducts();
  renderDashboard();
  renderProducts();
  renderUsers();
  renderHistory();
}

function renderDashboard() {
  const state = loadState();
  const products = state.products;
  const expired = products.filter((product) => getProductStatus(product).code === "expired");
  const expiring = products.filter((product) => getProductStatus(product).code === "soon");
  const totalItems = products.reduce((sum, product) => sum + Number(product.quantidade), 0);
  const totalValue = products.reduce((sum, product) => sum + Number(product.quantidade) * Number(product.preco), 0);

  elements.dashboardCards.innerHTML = `
    <article class="stat-card">
      <div class="stat-icon"><i class="bi bi-box-seam"></i></div>
      <h3>${totalItems}</h3>
      <span>Itens disponíveis no estoque demo</span>
    </article>
    <article class="stat-card">
      <div class="stat-icon"><i class="bi bi-cash-stack"></i></div>
      <h3>${toCurrency(totalValue)}</h3>
      <span>Valor estimado do estoque</span>
    </article>
    <article class="stat-card">
      <div class="stat-icon"><i class="bi bi-hourglass-split"></i></div>
      <h3>${expiring.length}</h3>
      <span>Produtos vencendo em até 7 dias</span>
    </article>
    <article class="stat-card">
      <div class="stat-icon"><i class="bi bi-exclamation-triangle"></i></div>
      <h3>${expired.length}</h3>
      <span>Produtos já vencidos</span>
    </article>
  `;

  const alertItems = [
    ...expired.map((product) => `<li><strong>${product.nome}</strong> vencido em ${toDate(product.validade)}</li>`),
    ...expiring.map((product) => `<li><strong>${product.nome}</strong> vence em ${toDate(product.validade)}</li>`),
  ];

  elements.alertsList.innerHTML = alertItems.length
    ? `<ul class="mb-0">${alertItems.join("")}</ul>`
    : `<div class="empty-state"><p class="mb-0">Nenhum alerta crítico no momento.</p></div>`;

  elements.productSummary.textContent = `${products.length} produto(s) cadastrados`;
  elements.userSummary.textContent = `${state.users.length} usuário(s) no acesso demo`;
  elements.historySummary.textContent = `${state.history.length} movimentação(ões) registradas`;

  renderCharts(products, state.history);
}

function renderProducts() {
  const products = getFilteredProducts();
  elements.productsCountLabel.textContent = `${products.length} resultado(s)`;
  elements.emptyProducts.classList.toggle("hidden", products.length > 0);
  elements.productsTableBody.innerHTML = products
    .map((product) => {
      const status = getProductStatus(product);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(product.nome)}</strong>
            <div class="small text-secondary">${escapeHtml(product.descricao || "Sem descrição")}</div>
          </td>
          <td>${escapeHtml(product.categoria || "Sem categoria")}</td>
          <td>${product.quantidade}</td>
          <td>${toCurrency(product.preco)}</td>
          <td>${toDate(product.validade)}</td>
          <td><span class="badge-soft badge-status-${status.code}">${status.label}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-outline-primary" data-action="edit-product" data-id="${product.id}">Editar</button>
              <button class="btn btn-sm btn-outline-success" data-action="entrada" data-id="${product.id}">Entrada</button>
              <button class="btn btn-sm btn-outline-warning" data-action="saida" data-id="${product.id}">Saída</button>
              <button class="btn btn-sm btn-outline-danger" data-action="delete-product" data-id="${product.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  elements.productsTableBody.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTableAction(button.dataset.action, button.dataset.id));
  });
}

function renderUsers() {
  const users = getFilteredUsers();
  elements.usersCountLabel.textContent = `${users.length} resultado(s)`;
  elements.emptyUsers.classList.toggle("hidden", users.length > 0);
  elements.usersTableBody.innerHTML = users
    .map((user) => `
      <tr>
        <td>${escapeHtml(user.nome)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td><span class="badge-soft ${user.role === "admin" ? "badge-role-admin" : "badge-role-user"}">${user.role === "admin" ? "Administrador" : "Usuário"}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-user" data-id="${user.id}">Editar</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-user" data-id="${user.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `)
    .join("");

  elements.usersTableBody.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTableAction(button.dataset.action, button.dataset.id));
  });
}

function renderHistory() {
  const history = getFilteredHistory();
  elements.historyCountLabel.textContent = `${history.length} resultado(s)`;
  elements.emptyHistory.classList.toggle("hidden", history.length > 0);
  elements.historyTableBody.innerHTML = history
    .map((entry) => `
      <tr>
        <td>${toDateTime(entry.createdAt)}</td>
        <td>${escapeHtml(entry.tipo)}</td>
        <td>${escapeHtml(entry.item)}</td>
        <td>${entry.quantidade}</td>
        <td>${escapeHtml(entry.usuario)}</td>
        <td>${escapeHtml(entry.observacao || "-")}</td>
      </tr>
    `)
    .join("");
}

function handleTableAction(action, id) {
  if (action === "edit-product") return openProductModal(id);
  if (action === "delete-product") return deleteProduct(id);
  if (action === "entrada") return openMovementModal("entrada", id);
  if (action === "saida") return openMovementModal("saida", id);
  if (action === "edit-user") return openUserModal(id);
  if (action === "delete-user") return deleteUser(id);
}

function openProductModal(id = "") {
  const product = loadState().products.find((item) => item.id === id);
  elements.productModalTitle.textContent = product ? "Editar produto" : "Novo produto";
  elements.productForm.reset();
  elements.productId.value = product?.id || "";
  elements.productNome.value = product?.nome || "";
  elements.productDescricao.value = product?.descricao || "";
  elements.productCategoria.value = product?.categoria || "";
  elements.productQuantidade.value = product?.quantidade ?? 0;
  elements.productPreco.value = product?.preco ?? "";
  elements.productValidade.value = product?.validade || "";
  elements.productModal.show();
}

function openUserModal(id = "") {
  const user = loadState().users.find((item) => item.id === id);
  elements.userModalTitle.textContent = user ? "Editar usuário" : "Novo usuário";
  elements.userForm.reset();
  elements.userId.value = user?.id || "";
  elements.userNome.value = user?.nome || "";
  elements.userEmail.value = user?.email || "";
  elements.userSenha.value = user?.senha || "";
  elements.userRole.value = user?.role || "user";
  elements.userModal.show();
}

function openMovementModal(type, productId = "") {
  elements.movementForm.reset();
  elements.movementType.value = type;
  elements.movementModalTitle.textContent = type === "entrada" ? "Registrar entrada" : "Registrar saída";
  populateMovementProducts(productId);
  elements.movementQuantity.value = 1;
  elements.movementModal.show();
}

function saveProduct(event) {
  event.preventDefault();
  const state = loadState();
  const currentUser = getSessionUser();
  const product = {
    id: elements.productId.value || crypto.randomUUID(),
    nome: elements.productNome.value.trim(),
    descricao: elements.productDescricao.value.trim(),
    categoria: elements.productCategoria.value.trim(),
    quantidade: Number(elements.productQuantidade.value),
    preco: Number(elements.productPreco.value),
    validade: elements.productValidade.value,
    createdAt: isoNow(),
  };

  if (product.quantidade < 0 || product.preco < 0) return;
  const index = state.products.findIndex((item) => item.id === product.id);
  const action = index >= 0 ? "atualização" : "cadastro";
  if (index >= 0) {
    product.createdAt = state.products[index].createdAt;
    state.products[index] = product;
  } else {
    state.products.unshift(product);
  }
  state.history.unshift(makeHistoryEntry(action, product.nome, product.quantidade, currentUser.nome, `Produto ${action} no GitHub Pages`));
  persistState(state);
  elements.productModal.hide();
  renderApp();
}

function saveUser(event) {
  event.preventDefault();
  const state = loadState();
  const currentUser = getSessionUser();
  const user = {
    id: elements.userId.value || crypto.randomUUID(),
    nome: elements.userNome.value.trim(),
    email: elements.userEmail.value.trim(),
    senha: elements.userSenha.value.trim(),
    role: elements.userRole.value,
  };

  const index = state.users.findIndex((item) => item.id === user.id);
  if (index >= 0) state.users[index] = user;
  else state.users.unshift(user);
  state.history.unshift(makeHistoryEntry("usuário", user.nome, 1, currentUser.nome, `Perfil ${index >= 0 ? "atualizado" : "criado"} na demonstração`));
  persistState(state);
  elements.userModal.hide();
  updateSessionUI();
  renderApp();
}

function saveMovement(event) {
  event.preventDefault();
  const state = loadState();
  const currentUser = getSessionUser();
  const type = elements.movementType.value;
  const quantity = Number(elements.movementQuantity.value);
  const product = state.products.find((item) => item.id === elements.movementProductId.value);
  if (!product || quantity <= 0) return;
  if (type === "saida" && quantity > product.quantidade) {
    window.alert("A saída não pode ser maior que o estoque disponível.");
    return;
  }

  product.quantidade = type === "entrada" ? product.quantidade + quantity : product.quantidade - quantity;
  state.history.unshift(makeHistoryEntry(type, product.nome, quantity, currentUser.nome, elements.movementReason.value.trim()));
  persistState(state);
  elements.movementModal.hide();
  renderApp();
}

function deleteProduct(id) {
  const state = loadState();
  const currentUser = getSessionUser();
  const product = state.products.find((item) => item.id === id);
  if (!product || !window.confirm(`Excluir ${product.nome}?`)) return;
  state.products = state.products.filter((item) => item.id !== id);
  state.history.unshift(makeHistoryEntry("exclusão", product.nome, product.quantidade, currentUser.nome, "Produto removido da demonstração"));
  persistState(state);
  renderApp();
}

function deleteUser(id) {
  const state = loadState();
  const currentUser = getSessionUser();
  const user = state.users.find((item) => item.id === id);
  if (!user) return;
  const adminCount = state.users.filter((candidate) => candidate.role === "admin").length;
  if (user.role === "admin" && adminCount === 1) {
    window.alert("Mantenha pelo menos um administrador.");
    return;
  }
  if (currentUser.id === id) {
    window.alert("Não é possível excluir o usuário logado.");
    return;
  }
  if (!window.confirm(`Excluir ${user.nome}?`)) return;
  state.users = state.users.filter((item) => item.id !== id);
  state.history.unshift(makeHistoryEntry("usuário", user.nome, 1, currentUser.nome, "Usuário removido da demonstração"));
  persistState(state);
  renderApp();
}

function populateMovementProducts(selectedId = "") {
  const products = loadState().products;
  elements.movementProductId.innerHTML = products
    .map((product) => `<option value="${product.id}" ${selectedId === product.id ? "selected" : ""}>${escapeHtml(product.nome)}</option>`)
    .join("");
  if (!selectedId && products[0]) elements.movementProductId.value = products[0].id;
}

function renderCharts(products, history) {
  appState.chartInstances.forEach((instance) => instance.destroy());
  appState.chartInstances = [];

  const quantityChart = new Chart(document.getElementById("stockChart"), {
    type: "bar",
    data: {
      labels: products.map((product) => product.nome),
      datasets: [{
        label: "Quantidade",
        data: products.map((product) => product.quantidade),
        backgroundColor: "#2563eb",
        borderRadius: 12,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  const valueChart = new Chart(document.getElementById("valueChart"), {
    type: "doughnut",
    data: {
      labels: products.map((product) => product.nome),
      datasets: [{
        label: "Valor em estoque",
        data: products.map((product) => Number(product.quantidade) * Number(product.preco)),
        backgroundColor: ["#2563eb", "#7c3aed", "#16a34a", "#f59e0b", "#dc2626", "#0ea5e9"],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  const movementMap = history.reduce((acc, entry) => {
    if (!["entrada", "saida"].includes(entry.tipo)) return acc;
    acc[entry.item] = acc[entry.item] || { entrada: 0, saida: 0 };
    acc[entry.item][entry.tipo] += Number(entry.quantidade);
    return acc;
  }, {});

  const labels = Object.keys(movementMap);
  const movementChart = new Chart(document.getElementById("movementChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Entradas",
          data: labels.map((label) => movementMap[label].entrada),
          backgroundColor: "#16a34a",
          borderRadius: 10,
        },
        {
          label: "Saídas",
          data: labels.map((label) => movementMap[label].saida),
          backgroundColor: "#f59e0b",
          borderRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  appState.chartInstances.push(quantityChart, valueChart, movementChart);
}

function getFilteredProducts() {
  return loadState().products.filter((product) => {
    const searchTarget = `${product.nome} ${product.descricao} ${product.categoria}`.toLowerCase();
    const matchesSearch = !appState.productSearch || searchTarget.includes(appState.productSearch);
    const status = getProductStatus(product).code;
    const matchesFilter =
      appState.productFilter === "todos" ||
      (appState.productFilter === "baixo" && product.quantidade <= 10) ||
      (appState.productFilter === "vencendo" && status === "soon") ||
      (appState.productFilter === "vencidos" && status === "expired");
    return matchesSearch && matchesFilter;
  });
}

function getFilteredUsers() {
  return loadState().users.filter((user) => {
    const searchTarget = `${user.nome} ${user.email} ${user.role}`.toLowerCase();
    return !appState.userSearch || searchTarget.includes(appState.userSearch);
  });
}

function getFilteredHistory() {
  return loadState().history.filter((entry) => {
    const searchTarget = `${entry.tipo} ${entry.item} ${entry.usuario} ${entry.observacao || ""}`.toLowerCase();
    return !appState.historySearch || searchTarget.includes(appState.historySearch);
  });
}

function getProductStatus(product) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${product.validade}T00:00:00`);
  const diff = Math.floor((expiry - today) / 86400000);
  if (Number.isNaN(diff)) return { code: "neutral", label: "Sem validade" };
  if (diff < 0) return { code: "expired", label: "Vencido" };
  if (diff <= 7) return { code: "soon", label: "Vence em breve" };
  return { code: "ok", label: "Em dia" };
}

function makeHistoryEntry(tipo, item, quantidade, usuario, observacao = "") {
  return {
    id: crypto.randomUUID(),
    createdAt: isoNow(),
    tipo,
    item,
    quantidade,
    usuario,
    observacao,
  };
}

function getSessionUser() {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  if (!session) return null;
  return loadState().users.find((user) => user.id === session.userId) || null;
}

function loadState() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}

function persistState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function exportCsv(filename, rowsSource, rows) {
  if (!rowsSource.length) {
    window.alert("Não há dados para exportar.");
    return;
  }
  const content = rows.map((row) => row.map(csvValue).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function applyTheme(theme) {
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(theme);
  localStorage.setItem(THEME_KEY, theme);
  elements.themeIcon.className = theme === "theme-dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}

function toCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function toDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T00:00:00`));
}

function toDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isoNow() {
  return new Date().toISOString();
}

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function pastDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
