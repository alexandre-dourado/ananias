// ============================================================
// ui.js — Componentes de UI reutilizáveis
// Versão corrigida: banner-count, lista-count, setTab, toasts
// ============================================================

// ============================================================
// ESCAPE HTML
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
  const text    = document.getElementById('loading-text');
  if (text)    text.textContent = msg || 'Aguarde...';
  if (overlay) overlay.classList.add('visible');
}

function ocultarLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('visible');
  }
}

// ============================================================
// TOASTS
// ============================================================
function mostrarToast(mensagem, tipo = 'info', duracao = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;

  const icons = {
    success:  'check-circle',
    error:    'alert-circle',
    info:     'info',
    warning:  'alert-triangle'
  };

  toast.innerHTML = `
    <i data-lucide="${icons[tipo] || 'info'}" style="width:15px;height:15px;flex-shrink:0;"></i>
    <span style="flex:1;">${esc(mensagem)}</span>
    <button onclick="this.parentElement.remove()"
      style="background:none;border:none;cursor:pointer;padding:0;opacity:0.5;line-height:1;">
      <i data-lucide="x" style="width:13px;height:13px;"></i>
    </button>
  `;
  container.appendChild(toast);
  lucide.createIcons({ nodes: [toast] });

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 320);
  }, duracao);
}

// ============================================================
// NAVEGAÇÃO POR ABAS
// ============================================================
function setTab(tabName) {
  // Oculta todos os conteúdos
  document.querySelectorAll('.tab-content').forEach(t => {
    t.style.display = 'none';
    t.style.opacity = '0';
  });

  // Remove activo de todos os botões
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active', 'active-green', 'active-gold');
  });

  // Mostra a aba seleccionada
  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) {
    tabEl.style.display = 'block';
    // Força reflow para a transição funcionar
    void tabEl.offsetHeight;
    tabEl.style.opacity = '1';
  }

  // Activa o botão correcto
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) {
    if      (tabName === 'recomendacoes') btn.classList.add('active-green');
    else if (tabName === 'ananias')       btn.classList.add('active-gold');
    else                                  btn.classList.add('active');
  }

  // Acções especiais ao entrar em cada aba
  if (tabName === 'lista')         renderizarListaCompleta();
  if (tabName === 'recomendacoes') popularTabRec();
  if (tabName === 'categorias')    renderizarCategorias();
  if (tabName === 'estantes')      inicializarEstantes();

  // Actualiza ícones Lucide nos novos elementos visíveis
  lucide.createIcons();

  // Deep linking via hash
  history.replaceState(null, '', `#${tabName}`);
}

// ============================================================
// CONTADORES / BADGES
// ============================================================
function actualizarContadores() {
  const total     = APP.livros.length;
  const filtrados = APP.livrosFiltrados.length;

  // Banner: span interno banner-count
  const bannerCount = document.getElementById('banner-count');
  if (bannerCount) {
    bannerCount.textContent = `${total} livro${total !== 1 ? 's' : ''}`;
  }

  // Label da aba lista
  const tabLabel = document.getElementById('tab-lista-label');
  if (tabLabel) tabLabel.textContent = `Lista (${total})`;

  // Contador de resultados na lista
  const listaCount = document.getElementById('lista-count');
  if (listaCount) listaCount.textContent = filtrados;
}

// ============================================================
// STATUS DE SINCRONIZAÇÃO
// ============================================================
function mostrarStatusSync(estado) {
  const el = document.getElementById('sync-status');
  if (!el) return;

  const configs = {
    syncing: { icon: 'loader-2',    text: 'A sincronizar...', cls: 'sync-syncing', spin: true  },
    ok:      { icon: 'cloud-check', text: 'Sincronizado',     cls: 'sync-ok',      spin: false },
    offline: { icon: 'cloud-off',   text: 'Offline',          cls: 'sync-offline', spin: false },
    error:   { icon: 'cloud-x',     text: 'Erro de sync',     cls: 'sync-error',   spin: false },
  };

  const cfg = configs[estado] || configs.offline;
  el.className = `sync-indicator ${cfg.cls}`;
  el.innerHTML = `
    <i data-lucide="${cfg.icon}"
       style="width:11px;height:11px;${cfg.spin ? 'animation:spin 1s linear infinite;' : ''}"></i>
    <span>${cfg.text}</span>
  `;
  lucide.createIcons({ nodes: [el] });
}

// ============================================================
// DROPDOWNS
// ============================================================
function popularDropdowns() {
  const sel = document.getElementById('c-categoria');
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = '<option value="" disabled>Selecione a Categoria</option>';
  APP.categorias.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat;
    opt.textContent = cat;
    if (cat === prev) opt.selected = true;
    sel.appendChild(opt);
  });
}

function popularSelectAnanias() {
  const sel = document.getElementById('ananias-select');
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = '<option value="" disabled selected>Escolha um livro para resumir...</option>';

  // Ordenado alfabeticamente pelo título
  [...APP.livros]
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
    .forEach(l => {
      const opt = document.createElement('option');
      opt.value       = l.id;
      opt.textContent = `${l.titulo} — ${l.autor}`;
      if (l.id === prev) opt.selected = true;
      sel.appendChild(opt);
    });
}

// ============================================================
// RENDERIZAR TABELA PRINCIPAL
// ============================================================
function renderizarTabela(dados, tbodyId) {
  const tbody = document.getElementById(tbodyId || 'lista-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (dados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:2.5rem 1rem;">
          <div class="empty-inline">
            <i data-lucide="book-x"></i>
            <p>Nenhum livro encontrado.</p>
          </div>
        </td>
      </tr>`;
    lucide.createIcons({ nodes: [tbody] });
    return;
  }

  const fragment = document.createDocumentFragment();

  dados.forEach(livro => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-title">
        ${livro.capaURL
          ? `<img src="${esc(livro.capaURL)}" class="table-thumb" alt="" loading="lazy"
                  onerror="this.style.display='none'">`
          : `<span class="table-thumb-placeholder"></span>`}
        <span class="td-title-text" title="${esc(livro.titulo)}">${esc(livro.titulo)}</span>
      </td>
      <td class="muted hide-sm">${esc(livro.autor)}</td>
      <td class="hide-md">
        <span class="badge badge-navy">${esc(livro.categoria) || '—'}</span>
      </td>
      <td class="muted hide-md">${esc(livro.editora) || '—'}</td>
      <td class="muted hide-lg"
          style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
          title="${esc(livro.assunto)}">
        ${esc(livro.assunto) || '—'}
      </td>
      <td class="muted hide-xl center">${esc(livro.anoPublicacao) || '—'}</td>
      <td class="td-actions">
        <button class="btn-icon" onclick="APP.abrirModalEditar('${livro.id}')" title="Editar livro">
          <i data-lucide="pencil" style="color:var(--navy-600);"></i>
        </button>
        <button class="btn-icon btn-icon-red" onclick="APP.abrirModalDeletar('${livro.id}')" title="Eliminar livro">
          <i data-lucide="trash-2" style="color:var(--red-600);"></i>
        </button>
      </td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  lucide.createIcons({ nodes: [tbody] });
}

// ============================================================
// GRADE (GALERIA DE CAPAS)
// ============================================================
const COVER_GRADIENTS = [
  ['#1e3a5f','#2857d4'], ['#1a2f96','#4d7de6'],
  ['#0f1f3d','#1e3db8'], ['#15803d','#16a34a'],
  ['#92400e','#d97706'], ['#7c3aed','#8b5cf6'],
  ['#be185d','#ec4899'], ['#0f766e','#14b8a6'],
];

function getBookGradient(titulo) {
  const idx = Math.abs((titulo || '').charCodeAt(0) || 0) % COVER_GRADIENTS.length;
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

  const fragment = document.createDocumentFragment();

  dados.forEach(livro => {
    const [c1, c2] = getBookGradient(livro.titulo);
    const card     = document.createElement('div');
    card.className = 'book-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Ver detalhes de ${livro.titulo}`);
    card.onclick   = () => APP.abrirDetalhe(livro.id);
    card.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        APP.abrirDetalhe(livro.id);
      }
    };

    const coverInner = livro.capaURL
      ? `<img src="${esc(livro.capaURL)}" alt="${esc(livro.titulo)}" loading="lazy"
             class="book-cover-img"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
         <div class="book-placeholder" style="display:none;background:linear-gradient(145deg,${c1} 0%,${c2} 100%);">
           <span class="placeholder-title">${esc(livro.titulo)}</span>
           <span class="placeholder-author">${esc(livro.autor)}</span>
         </div>`
      : `<div class="book-placeholder" style="background:linear-gradient(145deg,${c1} 0%,${c2} 100%);">
           <i data-lucide="book-open" style="width:26px;height:26px;color:rgba(255,255,255,0.25);"></i>
           <span class="placeholder-title">${esc(livro.titulo)}</span>
           <span class="placeholder-author">${esc(livro.autor)}</span>
         </div>`;

    card.innerHTML = `
      <div class="book-cover">${coverInner}</div>
      <div class="book-card-body">
        <div class="book-card-title">${esc(livro.titulo)}</div>
        <div class="book-card-author">${esc(livro.autor)}</div>
        <div class="book-card-cat">${esc(livro.categoria)}</div>
      </div>
      <div class="book-card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="APP.abrirModalEditar('${livro.id}')"
                title="Editar" style="padding:0.3rem;">
          <i data-lucide="pencil" style="width:13px;height:13px;color:var(--navy-600);"></i>
        </button>
        <button class="btn-icon btn-icon-red" onclick="APP.abrirModalDeletar('${livro.id}')"
                title="Deletar" style="padding:0.3rem;">
          <i data-lucide="trash-2" style="width:13px;height:13px;color:var(--red-600);"></i>
        </button>
      </div>
    `;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });
}

// ============================================================
// TOGGLE VISTA LISTA/GRADE
// ============================================================
function setView(mode) {
  setViewMode(mode);

  const btnGrid = document.getElementById('view-grid-btn');
  const btnList = document.getElementById('view-list-btn');
  const elList  = document.getElementById('view-list');
  const elGrid  = document.getElementById('view-grid');

  if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
  if (btnList) btnList.classList.toggle('active', mode === 'list');
  if (elList)  elList.style.display  = mode === 'list' ? 'block' : 'none';
  if (elGrid)  elGrid.style.display  = mode === 'grid' ? 'block' : 'none';

  if (mode === 'grid') renderizarGrade(APP.livrosFiltrados);
  else                 renderizarTabela(APP.livrosFiltrados);
}
