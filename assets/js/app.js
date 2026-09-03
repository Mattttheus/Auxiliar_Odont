const STORAGE_KEY = 'auxiliar-odont-static-v1';
const SESSION_KEY = 'auxiliar-odont-session';
const THEME_KEY = 'auxiliar-odont-theme';
const FLASH_KEY = 'auxiliar-odont-flash';

const body = document.body;
const ROOT = body.dataset.root || './';
const PAGE = body.dataset.page || 'login';

const routes = {
  login: 'pages/login.html',
  dashboard: 'pages/dashboard.html',
  products: 'pages/produtos.html',
  entry: 'pages/produtos/entrada_produto.html',
  exit: 'pages/produtos/saida_produto.html',
  history: 'pages/historico/historico_saidas.html',
  users: 'pages/usuarios/gerenciar_usuarios.html',
  userCreate: 'pages/usuarios/criar_usuario.html',
  userEdit: 'pages/usuarios/editar_usuario.html',
  logout: 'logout.html'
};

const seedState = {
  users: [
    {
      id: 1,
      nome: 'Administrador',
      email: 'admin@local.com',
      senha: '123456',
      role: 'admin',
      ativo: 1,
      criadoEm: '2026-01-15T09:00:00'
    },
    {
      id: 2,
      nome: 'Estoque Auxiliar',
      email: 'estoque@local.com',
      senha: '123456',
      role: 'user',
      ativo: 1,
      criadoEm: '2026-01-20T10:30:00'
    }
  ],
  products: [
    {
      id: 1,
      nome: 'Luvas Descartáveis',
      descricao: 'Caixa com 100 unidades tamanho M.',
      preco: 35.9,
      quantidade: 18,
      validade: '2026-09-12',
      criadoEm: '2026-08-01T08:30:00'
    },
    {
      id: 2,
      nome: 'Máscara Cirúrgica',
      descricao: 'Pacote tripla proteção.',
      preco: 22.5,
      quantidade: 6,
      validade: '2026-09-06',
      criadoEm: '2026-08-03T11:00:00'
    },
    {
      id: 3,
      nome: 'Resina Fotopolimerizável',
      descricao: 'Seringa A2 para restauração.',
      preco: 89.9,
      quantidade: 3,
      validade: '2026-09-02',
      criadoEm: '2026-08-10T14:00:00'
    },
    {
      id: 4,
      nome: 'Anestésico Lidocaína',
      descricao: 'Caixa com 50 tubetes.',
      preco: 149.0,
      quantidade: 11,
      validade: '2026-10-25',
      criadoEm: '2026-08-15T16:45:00'
    }
  ],
  entries: [
    { id: 1, produtoId: 1, quantidade: 8, usuarioId: 1, observacao: 'Reposição inicial', dataEntrada: '2026-08-25T09:15:00' }
  ],
  exits: [
    { id: 1, produtoId: 2, quantidade: 4, usuarioId: 2, observacao: 'Uso em atendimento', dataSaida: '2026-08-29T13:00:00' }
  ],
  history: [
    { id: 1, usuarioId: 1, produtoId: 1, acao: 'Criação', descricao: 'Produto cadastrado no catálogo inicial.', dataAcao: '2026-08-01T08:30:00' },
    { id: 2, usuarioId: 1, produtoId: 2, acao: 'Criação', descricao: 'Produto cadastrado no catálogo inicial.', dataAcao: '2026-08-03T11:00:00' },
    { id: 3, usuarioId: 1, produtoId: 3, acao: 'Criação', descricao: 'Produto cadastrado no catálogo inicial.', dataAcao: '2026-08-10T14:00:00' },
    { id: 4, usuarioId: 1, produtoId: 4, acao: 'Criação', descricao: 'Produto cadastrado no catálogo inicial.', dataAcao: '2026-08-15T16:45:00' },
    { id: 5, usuarioId: 1, produtoId: 1, acao: 'Entrada', descricao: 'Entrada de 8 unidade(s). Reposição inicial', dataAcao: '2026-08-25T09:15:00' },
    { id: 6, usuarioId: 2, produtoId: 2, acao: 'Saída', descricao: 'Saída de 4 unidade(s). Uso em atendimento', dataAcao: '2026-08-29T13:00:00' }
  ]
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const seeded = deepClone(seedState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(saved);
  } catch {
    const seeded = deepClone(seedState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nextId(list) {
  return list.length ? Math.max(...list.map(item => item.id)) + 1 : 1;
}

function setFlash(type, text) {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, text }));
}

function consumeFlash() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return '';
  sessionStorage.removeItem(FLASH_KEY);
  try {
    const flash = JSON.parse(raw);
    return `<div class="alert ${flash.type}">${flash.text}</div>`;
  } catch {
    return '';
  }
}

function route(path) {
  return `${ROOT}${path}`;
}

function redirect(path) {
  window.location.href = route(path);
}

function formatDate(value, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    ...(withTime ? { timeStyle: 'short' } : {})
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  const today = new Date(`${todayIso()}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function productStatus(product) {
  const days = daysUntil(product.validade);
  if (days < 0) return { label: 'Vencido', className: 'status-expired' };
  if (days <= 7) return { label: 'Próximo', className: 'status-near' };
  return { label: 'OK', className: 'status-ok' };
}

function getSessionUser() {
  const id = Number(sessionStorage.getItem(SESSION_KEY) || 0);
  if (!id) return null;
  const state = getState();
  return state.users.find(user => user.id === id && user.ativo === 1) || null;
}

function requireAuth({ admin = false } = {}) {
  const user = getSessionUser();
  if (!user) {
    redirect(routes.login);
    return null;
  }
  if (admin && user.role !== 'admin') {
    setFlash('error', 'Acesso restrito a administradores.');
    redirect(routes.dashboard);
    return null;
  }
  return user;
}

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'theme-light';
  body.classList.remove('theme-light', 'theme-dark');
  body.classList.add(theme);
}

function toggleTheme() {
  const next = body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  setFlash('info', 'Sessão encerrada com sucesso.');
  redirect(routes.login);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getProductById(id, state = getState()) {
  return state.products.find(product => product.id === Number(id));
}

function getUserById(id, state = getState()) {
  return state.users.find(user => user.id === Number(id));
}

function addHistory(state, payload) {
  state.history.push({
    id: nextId(state.history),
    usuarioId: payload.usuarioId ?? null,
    produtoId: payload.produtoId ?? null,
    acao: payload.acao,
    descricao: payload.descricao || '',
    dataAcao: payload.dataAcao || new Date().toISOString()
  });
}

function exportCsv(filename, headers, rows) {
  const csv = [headers.join(';')]
    .concat(rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')))
    .join('
');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function topProducts(products, selector, mapper) {
  const values = products.map(mapper);
  const max = Math.max(...values, 1);
  return products
    .slice()
    .sort((a, b) => mapper(b) - mapper(a))
    .slice(0, 5)
    .map(product => {
      const value = mapper(product);
      const width = Math.max((value / max) * 100, 6);
      return `
        <div class="chart-row">
          <div class="chart-meta"><strong>${escapeHtml(product.nome)}</strong><span>${selector(value)}</span></div>
          <div class="chart-bar"><span style="width:${width}%"></span></div>
        </div>
      `;
    })
    .join('');
}

function shellTemplate(user, active, title, subtitle, actions, content) {
  const nav = [
    { key: 'dashboard', label: 'Dashboard', href: routes.dashboard, icon: '🏠' },
    { key: 'products', label: 'Produtos', href: routes.products, icon: '📦' },
    { key: 'entry', label: 'Entrada', href: routes.entry, icon: '⬇️' },
    { key: 'exit', label: 'Saída', href: routes.exit, icon: '⬆️' },
    { key: 'history', label: 'Histórico', href: routes.history, icon: '🕘' },
    { key: 'users', label: 'Usuários', href: routes.users, icon: '👥', admin: true }
  ].filter(item => !item.admin || user.role === 'admin');

  return `
    <button class="menu-toggle" id="menuToggle" type="button">☰</button>
    <div class="app-shell">
      <aside class="sidebar" id="sidebarMenu">
        <div class="brand">
          <div class="brand-badge">🦷</div>
          <div>
            <h2>Auxiliar Odont</h2>
            <span>Controle de estoque estático</span>
          </div>
        </div>
        <nav class="nav-links">
          ${nav.map(item => `
            <a class="nav-link ${active === item.key ? 'active' : ''}" href="${route(item.href)}">
              <span>${item.icon}</span>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-actions">
          <button class="btn secondary" id="themeToggle" type="button">🌓 Alternar tema</button>
          <button class="btn secondary" id="voiceControlBtn" type="button">🎙️ Comando de voz</button>
          <a class="btn danger" href="${route(routes.logout)}" id="logoutLink">Sair</a>
        </div>
      </aside>
      <main class="main-area">
        <div class="topbar">
          <div>
            <h1 class="page-heading">${escapeHtml(title)}</h1>
            <div class="page-subtitle">${escapeHtml(subtitle)}</div>
          </div>
          <div class="topbar-user">${escapeHtml(user.nome)} · ${user.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
        </div>
        <div class="page-content">
          ${consumeFlash()}
          ${actions ? `<div class="page-header"><div></div><div class="btn-group">${actions}</div></div>` : ''}
          ${content}
          <div class="footer">© ${new Date().getFullYear()} - Auxiliar Odont em HTML, CSS e JavaScript para GitHub Pages.</div>
        </div>
      </main>
    </div>
  `;
}

function bindShellInteractions() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebarMenu');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', event => {
      event.preventDefault();
      logout();
    });
  }

  const voiceButton = document.getElementById('voiceControlBtn');
  if (!voiceButton) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    voiceButton.disabled = true;
    voiceButton.textContent = '🎙️ Voz indisponível';
    return;
  }

  const recognition = new SR();
  recognition.lang = 'pt-BR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = event => {
    const text = event.results[0][0].transcript.toLowerCase();
    if (text.includes('dashboard') || text.includes('painel')) redirect(routes.dashboard);
    else if (text.includes('produto')) redirect(routes.products);
    else if (text.includes('entrada')) redirect(routes.entry);
    else if (text.includes('saída') || text.includes('saida')) redirect(routes.exit);
    else if (text.includes('histórico') || text.includes('historico')) redirect(routes.history);
    else if (text.includes('usuário') || text.includes('usuario')) redirect(routes.users);
    else if (text.includes('sair')) logout();
    else window.alert(`Comando não reconhecido: ${text}`);
  };

  voiceButton.addEventListener('click', () => {
    try {
      recognition.start();
    } catch {
      recognition.stop();
      recognition.start();
    }
  });
}

function playBeep(type = 'default') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = type === 'danger' ? 520 : type === 'warning' ? 360 : 440;
    gain.gain.value = 0.001;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, 650);
  } catch {}
}

function renderLoginPage() {
  const user = getSessionUser();
  if (user) {
    redirect(routes.dashboard);
    return;
  }

  body.classList.add('app-login');
  body.innerHTML = `
    <div class="login-card">
      <div class="logo-mark">🦷</div>
      <h1>Bem-vindo</h1>
      <p>Faça login para usar a versão estática do projeto no GitHub Pages.</p>
      ${consumeFlash()}
      <form id="loginForm" class="grid" style="margin-top:20px; gap:16px;">
        <div class="field">
          <label for="email">Email</label>
          <input class="input" id="email" name="email" type="email" placeholder="Digite seu email" required>
        </div>
        <div class="field">
          <label for="senha">Senha</label>
          <input class="input" id="senha" name="senha" type="password" placeholder="Digite sua senha" required>
        </div>
        <button type="submit">Entrar</button>
      </form>
      <div class="demo-credentials">
        <strong>Acesso de demonstração:</strong><br>
        admin@local.com / 123456
      </div>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const senha = String(form.get('senha') || '').trim();
    const state = getState();
    const match = state.users.find(user => user.email.toLowerCase() === email && user.senha === senha && user.ativo === 1);
    if (!match) {
      setFlash('error', 'Credenciais inválidas ou usuário inativo.');
      renderLoginPage();
      return;
    }
    sessionStorage.setItem(SESSION_KEY, String(match.id));
    setFlash('success', `Bem-vindo, ${match.nome}.`);
    redirect(routes.dashboard);
  });
}

function renderDashboardPage() {
  const user = requireAuth();
  if (!user) return;
  const state = getState();
  const expired = state.products.filter(product => daysUntil(product.validade) < 0);
  const near = state.products.filter(product => {
    const days = daysUntil(product.validade);
    return days >= 0 && days <= 7;
  });
  const low = state.products.filter(product => product.quantidade <= 5);
  const totalItems = state.products.reduce((sum, product) => sum + Number(product.quantidade), 0);
  const totalValue = state.products.reduce((sum, product) => sum + Number(product.preco) * Number(product.quantidade), 0);
  const actions = `
    <a class="btn secondary" href="${route(routes.products)}">Produtos</a>
    <a class="btn" href="${route(routes.entry)}">Registrar entrada</a>
    <a class="btn danger" href="${route(routes.exit)}">Registrar saída</a>
  `;

  body.innerHTML = shellTemplate(
    user,
    'dashboard',
    'Dashboard',
    'Resumo do estoque e alertas operacionais.',
    actions,
    `
      <div class="stats-grid">
        <section class="stats-card"><small>Total de itens</small><div class="value">${totalItems}</div></section>
        <section class="stats-card"><small>Valor em estoque</small><div class="value">${formatCurrency(totalValue)}</div></section>
        <section class="stats-card"><small>Próximos do vencimento</small><div class="value">${near.length}</div></section>
        <section class="stats-card"><small>Estoque baixo</small><div class="value">${low.length}</div></section>
      </div>
      <div class="dual-grid" style="margin-bottom:20px;">
        <section class="alert-card ${expired.length ? 'danger' : ''}">
          <h3>Produtos vencidos</h3>
          <p class="muted">${expired.length ? `Existem ${expired.length} item(ns) vencidos.` : 'Nenhum produto vencido no momento.'}</p>
          ${expired.length ? `<button class="btn danger" id="beepDanger" type="button">Tocar alerta</button><ul class="alert-list">${expired.map(product => `<li>${escapeHtml(product.nome)} · ${formatDate(product.validade)}</li>`).join('')}</ul>` : ''}
        </section>
        <section class="alert-card">
          <h3>Produtos próximos do vencimento</h3>
          <p class="muted">${near.length ? `${near.length} produto(s) vencem nos próximos 7 dias.` : 'Nenhum produto próximo do vencimento.'}</p>
          ${near.length ? `<button class="btn warning" id="beepWarning" type="button">Tocar alerta</button><ul class="alert-list">${near.map(product => `<li>${escapeHtml(product.nome)} · ${formatDate(product.validade)}</li>`).join('')}</ul>` : ''}
        </section>
      </div>
      <div class="charts-grid">
        <section class="chart-card">
          <h3>Quantidade por produto</h3>
          <div class="chart-list">${topProducts(state.products, value => `${value} un.`, product => Number(product.quantidade))}</div>
        </section>
        <section class="chart-card">
          <h3>Valor por produto</h3>
          <div class="chart-list">${topProducts(state.products, value => formatCurrency(value), product => Number(product.quantidade) * Number(product.preco))}</div>
        </section>
        <section class="chart-card">
          <h3>Itens mais críticos</h3>
          <div class="chart-list">${(low.length ? low : state.products.slice().sort((a, b) => a.quantidade - b.quantidade).slice(0, 5)).map(product => `
            <div class="chart-row">
              <div class="chart-meta"><strong>${escapeHtml(product.nome)}</strong><span>${product.quantidade} un.</span></div>
              <div class="chart-bar"><span style="width:${Math.max((product.quantidade / Math.max(...state.products.map(item => item.quantidade), 1)) * 100, 6)}%"></span></div>
            </div>
          `).join('')}</div>
        </section>
      </div>
    `
  );

  bindShellInteractions();
  document.getElementById('beepDanger')?.addEventListener('click', () => playBeep('danger'));
  document.getElementById('beepWarning')?.addEventListener('click', () => playBeep('warning'));
}

function productFormHtml(product = null) {
  const editing = Boolean(product);
  return `
    <section class="form-card">
      <h3>${editing ? 'Editar produto' : 'Novo produto'}</h3>
      <form id="productForm" class="form-grid">
        <input type="hidden" name="id" value="${product?.id || ''}">
        <div class="field"><label>Nome</label><input class="input" name="nome" required value="${escapeHtml(product?.nome || '')}"></div>
        <div class="field"><label>Preço</label><input class="input" name="preco" type="number" step="0.01" min="0" required value="${product?.preco ?? ''}"></div>
        <div class="field"><label>Quantidade</label><input class="input" name="quantidade" type="number" min="0" required value="${product?.quantidade ?? ''}"></div>
        <div class="field"><label>Validade</label><input class="input" name="validade" type="date" required value="${product?.validade || ''}"></div>
        <div class="field full"><label>Descrição</label><textarea class="textarea" name="descricao" rows="4">${escapeHtml(product?.descricao || '')}</textarea></div>
        <div class="inline-actions">
          <button type="submit">${editing ? 'Salvar alterações' : 'Cadastrar produto'}</button>
          ${editing ? `<a class="btn secondary" href="${route(routes.products)}">Cancelar</a>` : `<button class="btn secondary" type="reset">Limpar</button>`}
        </div>
      </form>
    </section>
  `;
}

function renderProductsPage() {
  const user = requireAuth();
  if (!user) return;
  const state = getState();
  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter') || 'todos';
  const editId = params.get('id');
  const editingProduct = editId ? getProductById(editId, state) : null;

  const filteredProducts = state.products.filter(product => {
    if (filter === 'vencidos') return daysUntil(product.validade) < 0;
    if (filter === 'prestes') {
      const days = daysUntil(product.validade);
      return days >= 0 && days <= 7;
    }
    if (filter === 'baixo') return Number(product.quantidade) <= 5;
    return true;
  }).sort((a, b) => b.id - a.id);

  const actions = `
    <button class="btn secondary" id="exportProducts" type="button">Exportar CSV</button>
    <a class="btn" href="${route(routes.products)}">Novo produto</a>
  `;

  body.innerHTML = shellTemplate(
    user,
    'products',
    'Gestão de produtos',
    'Catálogo completo, filtros operacionais e cadastro.',
    actions,
    `
      <div class="stats-grid">
        <section class="stats-card"><small>Total de produtos</small><div class="value">${state.products.length}</div></section>
        <section class="stats-card"><small>Vencidos</small><div class="value">${state.products.filter(product => daysUntil(product.validade) < 0).length}</div></section>
        <section class="stats-card"><small>Próximos (7 dias)</small><div class="value">${state.products.filter(product => { const days = daysUntil(product.validade); return days >= 0 && days <= 7; }).length}</div></section>
        <section class="stats-card"><small>Estoque baixo</small><div class="value">${state.products.filter(product => Number(product.quantidade) <= 5).length}</div></section>
      </div>
      <div class="dual-grid">
        <section class="table-card">
          <h3>Produtos cadastrados</h3>
          <div class="table-tools">
            <div class="filter-group">
              <a class="btn secondary" href="${route(`${routes.products}?filter=todos`)}">Todos</a>
              <a class="btn secondary" href="${route(`${routes.products}?filter=vencidos`)}">Vencidos</a>
              <a class="btn secondary" href="${route(`${routes.products}?filter=prestes`)}">Próximos</a>
              <a class="btn secondary" href="${route(`${routes.products}?filter=baixo`)}">Baixo estoque</a>
            </div>
            <input class="input" id="productSearch" placeholder="Buscar produto..." style="max-width:280px;">
          </div>
          <div class="table-wrap">
            <table class="table" id="productsTable">
              <thead>
                <tr><th>ID</th><th>Produto</th><th>Preço</th><th>Qtd</th><th>Validade</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                ${filteredProducts.map(product => {
                  const status = productStatus(product);
                  return `
                    <tr>
                      <td>#${product.id}</td>
                      <td><strong>${escapeHtml(product.nome)}</strong><br><small class="muted">${escapeHtml(product.descricao || 'Sem descrição')}</small></td>
                      <td>${formatCurrency(product.preco)}</td>
                      <td class="${Number(product.quantidade) <= 5 ? 'low-stock' : ''}">${product.quantidade}</td>
                      <td>${formatDate(product.validade)}</td>
                      <td><span class="status-badge ${status.className}">${status.label}</span></td>
                      <td>
                        <div class="inline-actions">
                          <a class="btn warning" href="${route(`${routes.products}?id=${product.id}&filter=${filter}`)}">Editar</a>
                          ${user.role === 'admin' ? `<button class="btn danger delete-product" type="button" data-id="${product.id}">Excluir</button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="7"><div class="empty-state">Nenhum produto encontrado para esse filtro.</div></td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
        ${productFormHtml(editingProduct)}
      </div>
    `
  );

  bindShellInteractions();

  document.getElementById('exportProducts')?.addEventListener('click', () => {
    const exportRows = getState().products.map(product => [product.id, product.nome, product.descricao, product.preco, product.quantidade, product.validade]);
    exportCsv('produtos_export.csv', ['id', 'nome', 'descricao', 'preco', 'quantidade', 'validade'], exportRows);
  });

  document.getElementById('productSearch')?.addEventListener('input', event => {
    const term = String(event.target.value || '').toLowerCase();
    document.querySelectorAll('#productsTable tbody tr').forEach(row => {
      row.classList.toggle('hidden', !row.textContent.toLowerCase().includes(term));
    });
  });

  document.querySelectorAll('.delete-product').forEach(button => {
    button.addEventListener('click', () => {
      if (!window.confirm('Excluir produto?')) return;
      const state = getState();
      const id = Number(button.dataset.id);
      const product = getProductById(id, state);
      state.products = state.products.filter(item => item.id !== id);
      state.entries = state.entries.filter(item => item.produtoId !== id);
      state.exits = state.exits.filter(item => item.produtoId !== id);
      addHistory(state, {
        usuarioId: user.id,
        produtoId: id,
        acao: 'Exclusão',
        descricao: `Produto ${product?.nome || id} removido do catálogo.`
      });
      saveState(state);
      setFlash('success', 'Produto excluído com sucesso.');
      redirect(routes.products);
    });
  });

  document.getElementById('productForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = Number(form.get('id') || 0);
    const payload = {
      nome: String(form.get('nome') || '').trim(),
      descricao: String(form.get('descricao') || '').trim(),
      preco: Number(form.get('preco') || 0),
      quantidade: Number(form.get('quantidade') || 0),
      validade: String(form.get('validade') || '')
    };
    if (!payload.nome || !payload.validade) {
      setFlash('error', 'Preencha nome e validade do produto.');
      renderProductsPage();
      return;
    }
    const state = getState();
    if (id) {
      const target = getProductById(id, state);
      Object.assign(target, payload);
      addHistory(state, {
        usuarioId: user.id,
        produtoId: id,
        acao: 'Atualização',
        descricao: `Produto ${payload.nome} atualizado.`
      });
      saveState(state);
      setFlash('success', 'Produto atualizado com sucesso.');
    } else {
      const product = { id: nextId(state.products), criadoEm: new Date().toISOString(), ...payload };
      state.products.push(product);
      addHistory(state, {
        usuarioId: user.id,
        produtoId: product.id,
        acao: 'Criação',
        descricao: `Produto ${payload.nome} cadastrado.`
      });
      saveState(state);
      setFlash('success', 'Produto cadastrado com sucesso.');
    }
    redirect(routes.products);
  });
}

function renderMovementPage(kind) {
  const user = requireAuth();
  if (!user) return;
  const state = getState();
  const isEntry = kind === 'entry';
  const pageKey = isEntry ? 'entry' : 'exit';
  const title = isEntry ? 'Entrada de produtos' : 'Saída de produtos';
  const subtitle = isEntry ? 'Registre reposições no estoque.' : 'Registre retiradas do estoque com validação de saldo.';
  const actions = `<a class="btn secondary" href="${route(routes.products)}">Ver produtos</a>`;

  body.innerHTML = shellTemplate(
    user,
    pageKey,
    title,
    subtitle,
    actions,
    `
      <div class="stats-grid">
        <section class="stats-card"><small>Total de produtos</small><div class="value">${state.products.length}</div></section>
        <section class="stats-card"><small>${isEntry ? 'Itens disponíveis' : 'Saídas registradas'}</small><div class="value">${isEntry ? state.products.reduce((sum, product) => sum + product.quantidade, 0) : state.exits.length}</div></section>
      </div>
      <section class="form-card">
        <h3>${isEntry ? 'Registrar entrada' : 'Registrar saída'}</h3>
        <form id="movementForm" class="form-grid">
          <div class="field full">
            <label>Produto</label>
            <select class="select" name="produtoId" required>
              <option value="">Selecione...</option>
              ${state.products.sort((a, b) => a.nome.localeCompare(b.nome)).map(product => `<option value="${product.id}">${escapeHtml(product.nome)} (${product.quantidade} em estoque)</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Quantidade</label><input class="input" name="quantidade" type="number" min="1" required></div>
          <div class="field full"><label>Observação</label><textarea class="textarea" name="observacao" rows="4" placeholder="Opcional"></textarea></div>
          <div class="inline-actions">
            <button type="submit">${isEntry ? 'Registrar entrada' : 'Registrar saída'}</button>
            <button class="btn secondary" type="reset">Limpar</button>
          </div>
        </form>
      </section>
    `
  );

  bindShellInteractions();

  document.getElementById('movementForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const produtoId = Number(form.get('produtoId') || 0);
    const quantidade = Number(form.get('quantidade') || 0);
    const observacao = String(form.get('observacao') || '').trim();
    const state = getState();
    const product = getProductById(produtoId, state);
    if (!product || quantidade <= 0) {
      setFlash('error', 'Selecione um produto e informe uma quantidade válida.');
      redirect(isEntry ? routes.entry : routes.exit);
      return;
    }
    if (!isEntry && quantidade > Number(product.quantidade)) {
      setFlash('error', `Estoque insuficiente para ${product.nome}. Disponível: ${product.quantidade}.`);
      redirect(routes.exit);
      return;
    }

    product.quantidade = Number(product.quantidade) + (isEntry ? quantidade : -quantidade);
    const listKey = isEntry ? 'entries' : 'exits';
    const dateKey = isEntry ? 'dataEntrada' : 'dataSaida';
    state[listKey].push({
      id: nextId(state[listKey]),
      produtoId,
      quantidade,
      usuarioId: user.id,
      observacao,
      [dateKey]: new Date().toISOString()
    });
    addHistory(state, {
      usuarioId: user.id,
      produtoId,
      acao: isEntry ? 'Entrada' : 'Saída',
      descricao: `${isEntry ? 'Entrada' : 'Saída'} de ${quantidade} unidade(s). ${observacao}`.trim()
    });
    saveState(state);
    setFlash('success', `${isEntry ? 'Entrada' : 'Saída'} registrada com sucesso.`);
    redirect(isEntry ? routes.entry : routes.exit);
  });
}

function renderHistoryPage() {
  const user = requireAuth();
  if (!user) return;
  const state = getState();
  const generalRows = state.history.slice().sort((a, b) => new Date(b.dataAcao) - new Date(a.dataAcao));
  const exitRows = state.exits.slice().sort((a, b) => new Date(b.dataSaida) - new Date(a.dataSaida));
  const actions = `<button class="btn secondary" id="exportHistory" type="button">Exportar CSV</button>`;

  body.innerHTML = shellTemplate(
    user,
    'history',
    'Histórico do sistema',
    'Acompanhe movimentações e ações executadas na versão estática.',
    actions,
    `
      <div class="stats-grid">
        <section class="stats-card"><small>Total de ações</small><div class="value">${generalRows.length}</div></section>
        <section class="stats-card"><small>Total de saídas</small><div class="value">${exitRows.length}</div></section>
      </div>
      <div class="tabs">
        <button class="tab-button active" type="button" data-tab="general">Histórico geral</button>
        <button class="tab-button" type="button" data-tab="exits">Saídas</button>
      </div>
      <section class="table-card" data-panel="general">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ID</th><th>Usuário</th><th>Produto</th><th>Ação</th><th>Descrição</th><th>Data</th></tr></thead>
            <tbody>
              ${generalRows.map(row => {
                const product = getProductById(row.produtoId, state);
                const actionClass = row.acao.toLowerCase() === 'entrada' ? 'status-entry' : row.acao.toLowerCase() === 'saída' || row.acao.toLowerCase() === 'saida' ? 'status-exit' : 'status-ok';
                return `
                  <tr>
                    <td>${row.id}</td>
                    <td>${escapeHtml(getUserById(row.usuarioId, state)?.nome || 'Usuário removido')}</td>
                    <td>${escapeHtml(product?.nome || 'Produto removido')}</td>
                    <td><span class="status-badge ${actionClass}">${escapeHtml(row.acao)}</span></td>
                    <td>${escapeHtml(row.descricao || '-')}</td>
                    <td>${formatDate(row.dataAcao, true)}</td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="6"><div class="empty-state">Nenhum histórico encontrado.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
      <section class="table-card hidden" data-panel="exits">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ID</th><th>Produto</th><th>Quantidade</th><th>Usuário</th><th>Observação</th><th>Data</th></tr></thead>
            <tbody>
              ${exitRows.map(row => {
                const product = getProductById(row.produtoId, state);
                return `
                  <tr>
                    <td>${row.id}</td>
                    <td>${escapeHtml(product?.nome || 'Produto removido')}</td>
                    <td>${row.quantidade}</td>
                    <td>${escapeHtml(getUserById(row.usuarioId, state)?.nome || 'Usuário removido')}</td>
                    <td>${escapeHtml(row.observacao || '-')}</td>
                    <td>${formatDate(row.dataSaida, true)}</td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="6"><div class="empty-state">Nenhuma saída registrada.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `
  );

  bindShellInteractions();
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(tab => tab.classList.toggle('active', tab === button));
      document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.panel !== button.dataset.tab));
    });
  });
  document.getElementById('exportHistory')?.addEventListener('click', () => {
    const state = getState();
    const rows = state.history.map(row => [
      row.id,
      getUserById(row.usuarioId, state)?.nome || 'Usuário removido',
      getProductById(row.produtoId, state)?.nome || 'Produto removido',
      row.acao,
      row.descricao,
      row.dataAcao
    ]);
    exportCsv('historico.csv', ['id', 'usuario', 'produto', 'acao', 'descricao', 'data'], rows);
  });
}

function userFormHtml(user = null) {
  const editing = Boolean(user);
  return `
    <section class="form-card">
      <h3>${editing ? 'Editar usuário' : 'Criar usuário'}</h3>
      <form id="userForm" class="form-grid">
        <input type="hidden" name="id" value="${user?.id || ''}">
        <div class="field"><label>Nome</label><input class="input" name="nome" required value="${escapeHtml(user?.nome || '')}"></div>
        <div class="field"><label>Email</label><input class="input" name="email" type="email" required value="${escapeHtml(user?.email || '')}"></div>
        <div class="field"><label>Senha ${editing ? '(opcional)' : ''}</label><input class="input" name="senha" type="password" ${editing ? '' : 'required'}></div>
        <div class="field"><label>Perfil</label><select class="select" name="role"><option value="user" ${user?.role === 'user' ? 'selected' : ''}>Usuário</option><option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
        <div class="field"><label>Status</label><select class="select" name="ativo"><option value="1" ${String(user?.ativo ?? 1) === '1' ? 'selected' : ''}>Ativo</option><option value="0" ${String(user?.ativo ?? 1) === '0' ? 'selected' : ''}>Inativo</option></select></div>
        <div class="inline-actions">
          <button type="submit">${editing ? 'Salvar alterações' : 'Criar usuário'}</button>
          <a class="btn secondary" href="${route(routes.users)}">Voltar</a>
        </div>
      </form>
    </section>
  `;
}

function renderUsersPage() {
  const user = requireAuth({ admin: true });
  if (!user) return;
  const state = getState();
  const actions = `<a class="btn" href="${route(routes.userCreate)}">Criar usuário</a>`;

  body.innerHTML = shellTemplate(
    user,
    'users',
    'Gerenciar usuários',
    'Controle de acesso local para demonstrações no GitHub Pages.',
    actions,
    `
      <section class="table-card">
        <h3>Usuários cadastrados</h3>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ID</th><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
            <tbody>
              ${state.users.slice().sort((a, b) => b.id - a.id).map(entry => `
                <tr>
                  <td>${entry.id}</td>
                  <td><strong>${escapeHtml(entry.nome)}</strong></td>
                  <td>${escapeHtml(entry.email)}</td>
                  <td><span class="status-badge ${entry.role === 'admin' ? 'status-expired' : 'status-ok'}">${entry.role === 'admin' ? 'Admin' : 'User'}</span></td>
                  <td><span class="status-badge ${entry.ativo ? 'status-active' : 'status-inactive'}">${entry.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td>${formatDate(entry.criadoEm, true)}</td>
                  <td>
                    <div class="inline-actions">
                      <a class="btn warning" href="${route(`${routes.userEdit}?id=${entry.id}`)}">Editar</a>
                      ${entry.id !== user.id ? `<button class="btn danger delete-user" type="button" data-id="${entry.id}">Excluir</button>` : `<span class="tag primary">Seu usuário</span>`}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `
  );

  bindShellInteractions();
  document.querySelectorAll('.delete-user').forEach(button => {
    button.addEventListener('click', () => {
      if (!window.confirm('Deseja realmente excluir este usuário?')) return;
      const state = getState();
      const id = Number(button.dataset.id);
      const target = getUserById(id, state);
      state.users = state.users.filter(item => item.id !== id);
      addHistory(state, {
        usuarioId: user.id,
        produtoId: null,
        acao: 'Usuário',
        descricao: `Usuário ${target?.nome || id} removido.`
      });
      saveState(state);
      setFlash('success', 'Usuário excluído com sucesso.');
      redirect(routes.users);
    });
  });
}

function handleUserSave(editing = false) {
  const current = requireAuth({ admin: true });
  if (!current) return;
  document.getElementById('userForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = Number(form.get('id') || 0);
    const payload = {
      nome: String(form.get('nome') || '').trim(),
      email: String(form.get('email') || '').trim().toLowerCase(),
      senha: String(form.get('senha') || '').trim(),
      role: String(form.get('role') || 'user'),
      ativo: Number(form.get('ativo') || 1)
    };
    if (!payload.nome || !payload.email || (!editing && !payload.senha)) {
      setFlash('error', 'Preencha os campos obrigatórios.');
      redirect(editing ? `${routes.userEdit}?id=${id}` : routes.userCreate);
      return;
    }
    const state = getState();
    const duplicated = state.users.find(user => user.email === payload.email && user.id !== id);
    if (duplicated) {
      setFlash('error', 'Este email já está cadastrado.');
      redirect(editing ? `${routes.userEdit}?id=${id}` : routes.userCreate);
      return;
    }
    if (editing) {
      const target = getUserById(id, state);
      if (!target) {
        setFlash('error', 'Usuário não encontrado.');
        redirect(routes.users);
        return;
      }
      target.nome = payload.nome;
      target.email = payload.email;
      target.role = payload.role;
      target.ativo = payload.ativo;
      if (payload.senha) target.senha = payload.senha;
      addHistory(state, { usuarioId: current.id, acao: 'Usuário', descricao: `Usuário ${target.nome} atualizado.` });
      saveState(state);
      setFlash('success', 'Usuário atualizado com sucesso.');
    } else {
      const user = { id: nextId(state.users), criadoEm: new Date().toISOString(), ...payload };
      state.users.push(user);
      addHistory(state, { usuarioId: current.id, acao: 'Usuário', descricao: `Usuário ${user.nome} criado.` });
      saveState(state);
      setFlash('success', 'Usuário criado com sucesso.');
    }
    redirect(routes.users);
  });
}

function renderUserCreatePage() {
  const user = requireAuth({ admin: true });
  if (!user) return;
  body.innerHTML = shellTemplate(user, 'users', 'Criar usuário', 'Cadastre novos acessos locais para a demonstração.', '', userFormHtml());
  bindShellInteractions();
  handleUserSave(false);
}

function renderUserEditPage() {
  const user = requireAuth({ admin: true });
  if (!user) return;
  const params = new URLSearchParams(window.location.search);
  const state = getState();
  const target = getUserById(params.get('id'), state);
  if (!target) {
    setFlash('error', 'Usuário não encontrado.');
    redirect(routes.users);
    return;
  }
  body.innerHTML = shellTemplate(user, 'users', 'Editar usuário', 'Atualize perfil, status e senha do usuário.', '', userFormHtml(target));
  bindShellInteractions();
  handleUserSave(true);
}

function init() {
  applyTheme();
  switch (PAGE) {
    case 'login':
      renderLoginPage();
      break;
    case 'logout':
      logout();
      break;
    case 'dashboard':
      renderDashboardPage();
      break;
    case 'products':
      renderProductsPage();
      break;
    case 'entry':
      renderMovementPage('entry');
      break;
    case 'exit':
      renderMovementPage('exit');
      break;
    case 'history':
      renderHistoryPage();
      break;
    case 'users':
      renderUsersPage();
      break;
    case 'user-create':
      renderUserCreatePage();
      break;
    case 'user-edit':
      renderUserEditPage();
      break;
    default:
      renderLoginPage();
      break;
  }
}

init();
