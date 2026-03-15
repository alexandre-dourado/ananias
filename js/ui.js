// ============================================================
// ui.js — Componentes de UI reutilizáveis
// Loading, toasts, modais, tabela, grade, markdown
// ============================================================

// ============================================================
// UTILITÁRIO: ESCAPE HTML
// ============================================================
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// LOADING OVERLAY
// ============================================================
let _loadingCount = 0;

function mostrarLoading(msg) {
  _loadingCount++;
  const overlay = document.getElementById('loading-overlay');
  document.getElementById('loading-text').textContent = msg || 'Aguarde...';
  overlay.classList.add('visible');
}

function ocultarLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    document.getElementById('loading-overlay').classList.remove('visible');
  }
}

// ============================================================
// TOASTS
// ============================================================
function mostrarToast(mensagem, tipo = 'info', duracao = 4000) {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${tipo}`;

  const icons = { success: 'check-circle', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
  toast.innerHTML = `
    <i data-lucide="${icons[tipo] || 'info'}"></i>
    <span>${esc(mensagem)}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;padding:0;margin-left:auto;opacity:0.5;">
      <i data-lucide="x" style="width:14px;height:14px;"></i>
    </button>
  `;
  container.appendChild(toast);
  lucide.createIcons({ nodes: [toast] });

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duracao);
}

// ============================================================
// NAVEGAÇÃO POR ABAS
// ============================================================
function setTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => {
    t.style.display   = 'none';
    t.style.opacity   = '0';
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active', 'active-green', 'active-gold');
  });

  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) {
    tabEl.style.display = 'block';
    requestAnimationFrame(() => { tabEl.style.opacity = '1'; });
  }

  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) {
    if (tabName === 'recomendacoes') btn.classList.add('active-green');
    else if (tabName === 'ananias')  btn.classList.add('active-gold');
    else btn.classList.add('active');
  }

  // Acções especiais por aba
  if (tabName === 'lista')       renderizarListaCompleta();
  if (tabName === 'recomendacoes') popularTabRec();
  if (tabName === 'categorias')  renderizarCategorias();

  lucide.createIcons();

  // Guarda aba activa na URL (para deep linking)
  history.replaceState(null, '', `#${tabName}`);
}

// ============================================================
// RENDERIZAR TABELA PRINCIPAL (Lista)
// ============================================================
function renderizarTabela(dados, tbodyId) {
  const tbody = document.getElementById(tbodyId || 'lista-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (dados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:2rem; color:#94a3b8;">
          <div class="empty-inline">
            <i data-lucide="book-x" style="width:36px;height:36px;opacity:0.3;"></i>
            <p>Nenhum livro encontrado.</p>
          </div>
        </td>
      </tr>`;
    lucide.createIcons({ nodes: [tbody] });
    return;
  }

  dados.forEach(livro => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-title">
        ${livro.capaURL
          ? `<img src="${esc(livro.capaURL)}" class="table-thumb" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<span class="table-thumb-placeholder"></span>`
        }
        <span class="td-title-text">${esc(livro.titulo)}</span>
      </td>
      <td class="muted hide-sm">${esc(livro.autor)}</td>
      <td class="hide-md"><span class="badge badge-navy">${esc(livro.categoria) || '—'}</span></td>
      <td class="muted hide-md">${esc(livro.editora) || '—'}</td>
      <td class="muted hide-lg" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(livro.assunto) || '—'}</td>
      <td class="muted hide-xl center">${esc(livro.anoPublicacao) || '—'}</td>
      <td class="td-actions">
        <button class="btn-icon" onclick="APP.abrirModalEditar('${livro.id}')" title="Editar">
          <i data-lucide="pencil" style="color:var(--navy-600);"></i>
        </button>
        <button class="btn-icon btn-icon-red" onclick="APP.abrirModalDeletar('${livro.id}')" title="Deletar">
          <i data-lucide="trash-2" style="color:var(--red-600);"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons({ nodes: [tbody] });
}

// ============================================================
// RENDERIZAR GRADE (Galeria de Capas)
// ============================================================
const COVER_GRADIENTS = [
  ['#1e3a5f','#2857d4'], ['#1a2f96','#4d7de6'],
  ['#0f1f3d','#1e3db8'], ['#15803d','#16a34a'],
  ['#92400e','#d97706'], ['#7c3aed','#8b5cf6'],
  ['#be185d','#ec4899'], ['#0f766e','#14b8a6'],
];

function getBookGradient(titulo) {
  const idx = (titulo || '').charCodeAt(0) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[idx];
}

function renderizarGrade(dados, containerId) {
  const container = document.getElementById(containerId || 'grid-container');
  if (!container) return;
  container.innerHTML = '';

  if (dados.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="book-x"></i>
        <p>Nenhum livro encontrado.</p>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  dados.forEach(livro => {
    const [c1, c2] = getBookGradient(livro.titulo);
    const card = document.createElement('div');
    card.className = 'book-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.onclick = () => APP.abrirDetalhe(livro.id);
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') APP.abrirDetalhe(livro.id); };

    const coverInner = livro.capaURL
      ? `<img src="${esc(livro.capaURL)}" alt="${esc(livro.titulo)}" loading="lazy"
             class="book-cover-img"
             onerror="this.parentElement.innerHTML = buildPlaceholderHTML('${esc(livro.titulo).replace(/'/g,"\\'")}','${esc(livro.autor).replace(/'/g,"\\'")}','${c1}','${c2}')">`
      : buildPlaceholderHTML(livro.titulo, livro.autor, c1, c2);

    card.innerHTML = `
      <div class="book-cover" style="background:linear-gradient(145deg,${c1} 0%,${c2} 100%);">
        ${coverInner}
      </div>
      <div class="book-card-body">
        <div class="book-card-title">${esc(livro.titulo)}</div>
        <div class="book-card-author">${esc(livro.autor)}</div>
        <div class="book-card-cat">${esc(livro.categoria)}</div>
      </div>
      <div class="book-card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="APP.abrirModalEditar('${livro.id}')" title="Editar">
          <i data-lucide="pencil" style="width:13px;height:13px;color:var(--navy-600);"></i>
        </button>
        <button class="btn-icon btn-icon-red" onclick="APP.abrirModalDeletar('${livro.id}')" title="Deletar">
          <i data-lucide="trash-2" style="width:13px;height:13px;color:var(--red-600);"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  lucide.createIcons({ nodes: [container] });
}

function buildPlaceholderHTML(titulo, autor, c1, c2) {
  return `
    <div class="book-placeholder" style="background:linear-gradient(145deg,${c1} 0%,${c2} 100%);">
      <i data-lucide="book-open" style="width:26px;height:26px;color:rgba(255,255,255,0.25);"></i>
      <span class="placeholder-title">${esc(titulo)}</span>
      <span class="placeholder-author">${esc(autor)}</span>
    </div>`;
}

// ============================================================
// ALTERNADOR DE VISTA
// ============================================================
function setView(mode) {
  setViewMode(mode);
  document.getElementById('view-grid-btn').classList.toggle('active', mode === 'grid');
  document.getElementById('view-list-btn').classList.toggle('active', mode === 'list');
  document.getElementById('view-list').style.display = mode === 'list' ? 'block' : 'none';
  document.getElementById('view-grid').style.display = mode === 'grid' ? 'block' : 'none';

  if (mode === 'grid') renderizarGrade(APP.livrosFiltrados);
  else                 renderizarTabela(APP.livrosFiltrados);
}

// ============================================================
// DROPDOWN DE CATEGORIAS
// ============================================================
function popularDropdowns() {
  const selectIds = ['c-categoria'];
  selectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="" disabled>Selecione a Categoria</option>';
    APP.categorias.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      if (cat === prev) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function popularSelectAnanias() {
  const sel = document.getElementById('ananias-select');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="" disabled selected>Escolha um livro para resumir...</option>';
  [...APP.livros].sort((a,b) => a.titulo.localeCompare(b.titulo)).forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = `${l.titulo} — ${l.autor}`;
    if (l.id === prev) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ============================================================
// ACTUALIZAR CONTADORES / BADGES
// ============================================================
function actualizarContadores() {
  const total = APP.livros.length;
  const filtrados = APP.livrosFiltrados.length;

  const badge = document.getElementById('banner-badge');
  if (badge) badge.textContent = `${total} livro${total !== 1 ? 's' : ''}`;

  const tabLabel = document.getElementById('tab-lista-label');
  if (tabLabel) tabLabel.textContent = `Lista (${total})`;

  const listaCount = document.getElementById('lista-count');
  if (listaCount) listaCount.textContent = filtrados;
}

// ============================================================
// SINCRONIZAÇÃO STATUS
// ============================================================
function mostrarStatusSync(estado) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const configs = {
    syncing: { icon: 'loader-2', text: 'Sincronizando...', cls: 'sync-syncing', spin: true },
    ok:      { icon: 'cloud-check', text: 'Sincronizado',  cls: 'sync-ok',      spin: false },
    offline: { icon: 'cloud-off',   text: 'Offline',       cls: 'sync-offline', spin: false },
    error:   { icon: 'cloud-x',     text: 'Erro de sync',  cls: 'sync-error',   spin: false },
  };
  const cfg = configs[estado] || configs.offline;
  el.className = `sync-indicator ${cfg.cls}`;
  el.innerHTML = `<i data-lucide="${cfg.icon}" style="width:13px;height:13px;${cfg.spin?'animation:spin 1s linear infinite;':''}"></i><span>${cfg.text}</span>`;
  lucide.createIcons({ nodes: [el] });
}
