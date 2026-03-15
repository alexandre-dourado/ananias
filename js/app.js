// ============================================================
// app.js — Lógica principal BiblioA
// Estado global, inicialização, CRUD, filtros, IA, categorias
// ============================================================

// ============================================================
// ESTADO GLOBAL
// ============================================================
const APP = {
  livros:           [],
  livrosFiltrados:  [],
  categorias:       [],
  selectedBookIds:  [],
  livroParaDeletar: null,
  livroParaEditar:  null,
  summaryText:      '',
  dragSrcIndex:     null,
  isOnline:         navigator.onLine,
};

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

  // Registar Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            mostrarToast('Nova versão disponível. Recarregue para actualizar.', 'info', 9000);
          }
        });
      });
    } catch(e) { console.warn('[SW] Falha:', e); }
  }

  // Inicializar ícones
  lucide.createIcons();

  // Online/offline
  window.addEventListener('online',  () => {
    APP.isOnline = true;
    mostrarStatusSync('ok');
    mostrarToast('Conexão restaurada.', 'success', 2500);
  });
  window.addEventListener('offline', () => {
    APP.isOnline = false;
    mostrarStatusSync('offline');
    mostrarToast('Sem conexão — a usar dados locais.', 'warning');
  });

  // Fechar modais ao clicar no backdrop
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) {
        el.style.display = 'none';
        APP.livroParaEditar  = null;
        APP.livroParaDeletar = null;
      }
    });
  });

  // Verifica URL inicial (GAS configurado?)
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    setTimeout(() => {
      setTab('config');
      carregarConfig();
      mostrarToast('Configure a URL do GAS para começar.', 'info', 8000);
    }, 400);
    return;
  }

  // Deep linking via hash
  const hash      = window.location.hash.replace('#', '');
  const validTabs = ['cadastro','lista','recomendacoes','ananias','categorias','estantes','config'];

  // Carrega dados e navega
  await inicializarDados();

  if (hash && validTabs.includes(hash)) setTab(hash);
  else                                   setTab('cadastro');
});

// ============================================================
// INICIALIZAR DADOS
// ============================================================
async function inicializarDados() {
  mostrarLoading('A sincronizar biblioteca...');
  mostrarStatusSync('syncing');

  try {
    const [resCats, resLivros] = await Promise.all([
      apiGetCategorias(),
      apiGetLivros()
    ]);

    if (resCats.success)   APP.categorias  = resCats.data;
    if (resLivros.success) {
      APP.livros          = resLivros.data;
      APP.livrosFiltrados = [...APP.livros];
      await cacheLivros(APP.livros);
      setLastSync(new Date().toISOString());
      mostrarStatusSync('ok');
      mostrarToast(`${APP.livros.length} livro(s) carregado(s).`, 'success', 2500);
    }
  } catch(e) {
    if (e.message === 'OFFLINE' || !APP.isOnline) {
      APP.livros          = await getCachedLivros();
      APP.livrosFiltrados = [...APP.livros];
      mostrarStatusSync('offline');
      mostrarToast('Modo offline — dados locais.', 'warning');
    } else {
      mostrarStatusSync('error');
      mostrarToast('Erro ao carregar: ' + e.message, 'error');
    }
  } finally {
    ocultarLoading();
    actualizarContadores();
    popularDropdowns();
    popularSelectAnanias();
    renderizarUltimos();
  }
}

// ============================================================
// RECARREGAR LIVROS
// ============================================================
async function carregarLivros() {
  mostrarLoading('A actualizar lista...');
  mostrarStatusSync('syncing');

  try {
    const res = await apiGetLivros();
    if (res.success) {
      APP.livros          = res.data;
      APP.livrosFiltrados = [...APP.livros];
      await cacheLivros(APP.livros);
      setLastSync(new Date().toISOString());
      mostrarStatusSync('ok');
      mostrarToast(`${APP.livros.length} livro(s) sincronizado(s).`, 'success', 2500);
    } else {
      throw new Error(res.error);
    }
  } catch(e) {
    if (e.message === 'OFFLINE') {
      APP.livros          = await getCachedLivros();
      APP.livrosFiltrados = [...APP.livros];
      mostrarStatusSync('offline');
    } else {
      mostrarStatusSync('error');
      mostrarToast('Erro: ' + e.message, 'error');
    }
  } finally {
    ocultarLoading();
    actualizarContadores();
    renderizarListaCompleta();
    renderizarUltimos();
    popularSelectAnanias();
  }
}

// ============================================================
// FILTRAR E ORDENAR
// ============================================================
function filtrarLivros() {
  const buscaEl = document.getElementById('busca-input');
  const sortEl  = document.getElementById('sort-select');
  const termo   = (buscaEl ? buscaEl.value : '').toLowerCase().trim();
  const sortVal = sortEl ? sortEl.value : 'dataCadastro-desc';
  const [col, dir] = sortVal.split('-');

  let lista = APP.livros.filter(l => {
    if (!termo) return true;
    return (
      (l.titulo        || '').toLowerCase().includes(termo) ||
      (l.autor         || '').toLowerCase().includes(termo) ||
      (l.editora       || '').toLowerCase().includes(termo) ||
      (l.categoria     || '').toLowerCase().includes(termo) ||
      (l.assunto       || '').toLowerCase().includes(termo) ||
      String(l.anoPublicacao || '').includes(termo)
    );
  });

  lista.sort((a, b) => {
    let av = a[col] ?? '', bv = b[col] ?? '';
    if      (col === 'dataCadastro')  { av = new Date(av); bv = new Date(bv); }
    else if (col === 'anoPublicacao') { av = Number(av) || 0; bv = Number(bv) || 0; }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ?  1 : -1;
    return 0;
  });

  APP.livrosFiltrados = lista;
  actualizarContadores();
  renderizarListaCompleta();
}

// ============================================================
// RENDERIZAR LISTA COMPLETA (tabela ou grade)
// ============================================================
function renderizarListaCompleta() {
  const mode  = getViewMode();
  const elList = document.getElementById('view-list');
  const elGrid = document.getElementById('view-grid');
  const btnList = document.getElementById('view-list-btn');
  const btnGrid = document.getElementById('view-grid-btn');

  if (elList)  elList.style.display  = mode === 'list' ? 'block' : 'none';
  if (elGrid)  elGrid.style.display  = mode === 'grid' ? 'block' : 'none';
  if (btnList) btnList.classList.toggle('active', mode === 'list');
  if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');

  if (mode === 'grid') renderizarGrade(APP.livrosFiltrados);
  else                 renderizarTabela(APP.livrosFiltrados);
}

// ============================================================
// ÚLTIMOS 10 CADASTRADOS (aba Cadastro)
// ============================================================
function renderizarUltimos() {
  const tbody = document.getElementById('ultimos-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const ultimos = APP.livros.slice(0, 10);

  if (ultimos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:var(--gray-400);padding:1.5rem;font-style:italic;">
          Nenhum livro cadastrado ainda.
        </td>
      </tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  ultimos.forEach(livro => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-title">
        ${livro.capaURL
          ? `<img src="${esc(livro.capaURL)}" class="table-thumb" alt="" loading="lazy"
                  onerror="this.style.display='none'">`
          : `<span class="table-thumb-placeholder"></span>`}
        <span class="td-title-text">${esc(livro.titulo)}</span>
      </td>
      <td class="muted hide-sm">${esc(livro.autor)}</td>
      <td class="hide-md"><span class="badge badge-navy">${esc(livro.categoria) || '—'}</span></td>
      <td class="td-actions">
        <button class="btn-icon" onclick="APP.abrirModalEditar('${livro.id}')" title="Editar">
          <i data-lucide="pencil" style="color:var(--navy-600);"></i>
        </button>
        <button class="btn-icon btn-icon-red" onclick="APP.abrirModalDeletar('${livro.id}')" title="Deletar">
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
// CADASTRAR LIVRO
// ============================================================
async function cadastrarLivro() {
  const titulo    = document.getElementById('c-titulo')?.value.trim();
  const autor     = document.getElementById('c-autor')?.value.trim();
  const categoria = document.getElementById('c-categoria')?.value;

  if (!titulo)    { mostrarToast('O Título é obrigatório.', 'error');    return; }
  if (!autor)     { mostrarToast('O Autor é obrigatório.', 'error');     return; }
  if (!categoria) { mostrarToast('Selecione uma Categoria.', 'error');   return; }

  const livro = {
    titulo, autor, categoria,
    editora:       document.getElementById('c-editora')?.value.trim()     || '',
    assunto:       document.getElementById('c-assunto')?.value.trim()     || '',
    anoPublicacao: document.getElementById('c-ano')?.value.trim()         || '',
    observacoes:   document.getElementById('c-observacoes')?.value.trim() || '',
    capaURL:       document.getElementById('c-capa')?.value.trim()        || '',
  };

  mostrarLoading('A cadastrar livro...');
  try {
    const res = await apiAdicionarLivro(livro);
    if (res.success) {
      APP.livros.unshift(res.data);
      APP.livrosFiltrados = [...APP.livros];
      await cacheLivros(APP.livros);
      actualizarContadores();
      renderizarUltimos();
      popularSelectAnanias();
      limparFormCadastro();
      mostrarToast(`"${titulo}" cadastrado com sucesso!`, 'success');
      setTab('lista');
    } else {
      mostrarToast('Erro ao cadastrar: ' + res.error, 'error');
    }
  } catch(e) {
    const msg = e.message === 'OFFLINE'
      ? 'Sem conexão. Não é possível cadastrar offline.'
      : e.message;
    mostrarToast('Erro: ' + msg, 'error');
  } finally {
    ocultarLoading();
  }
}

function limparFormCadastro() {
  ['c-titulo','c-autor','c-assunto','c-editora','c-ano','c-capa','c-observacoes']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const sel = document.getElementById('c-categoria');
  if (sel) sel.selectedIndex = 0;
}

// ============================================================
// BUSCA DE CAPA AUTOMÁTICA
// ============================================================
async function buscarCapaAutomatica() {
  const titulo = document.getElementById('c-titulo')?.value.trim();
  const autor  = document.getElementById('c-autor')?.value.trim();
  if (!titulo) { mostrarToast('Insira o título primeiro.', 'info'); return; }

  mostrarLoading('A buscar capa...');
  try {
    const res = await apiBuscarCapa(titulo, autor || '');
    if (res.success && res.capaURL) {
      const input = document.getElementById('c-capa');
      if (input) input.value = res.capaURL;
      mostrarToast('Capa encontrada!', 'success');
    } else {
      mostrarToast('Nenhuma capa encontrada. Insira a URL manualmente.', 'info');
    }
  } catch(e) {
    mostrarToast('Erro ao buscar capa: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ============================================================
// MODAL DETALHE DO LIVRO (clique na grade)
// ============================================================
APP.abrirDetalhe = function(id) {
  const livro = APP.livros.find(l => l.id === id);
  if (!livro) return;

  const [c1, c2] = getBookGradient(livro.titulo);

  // Capa
  const capaDiv = document.getElementById('detalhe-capa');
  if (capaDiv) {
    if (livro.capaURL) {
      capaDiv.innerHTML = `
        <img src="${esc(livro.capaURL)}" class="detalhe-capa-img" alt="${esc(livro.titulo)}"
             onerror="this.parentElement.innerHTML = '<div class=\\'detalhe-capa-placeholder\\' style=\\'background:linear-gradient(145deg,${c1},${c2});\\'></div>'">`;
    } else {
      capaDiv.innerHTML = `
        <div class="detalhe-capa-placeholder"
             style="background:linear-gradient(145deg,${c1} 0%,${c2} 100%);">
          <i data-lucide="book-open"
             style="width:40px;height:40px;color:rgba(255,255,255,0.4);"></i>
        </div>`;
    }
  }

  // Textos
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  };
  setEl('detalhe-titulo',  livro.titulo);
  setEl('detalhe-autor',   livro.autor);
  setEl('detalhe-assunto', livro.assunto ? `Assunto: ${livro.assunto}` : '');
  setEl('detalhe-obs',     livro.observacoes || '');

  // Badges de meta
  const metaDiv = document.getElementById('detalhe-meta');
  if (metaDiv) {
    metaDiv.innerHTML = [
      livro.categoria    && `<span class="badge badge-navy">${esc(livro.categoria)}</span>`,
      livro.editora      && `<span class="badge badge-navy">${esc(livro.editora)}</span>`,
      livro.anoPublicacao && `<span class="badge badge-navy">${esc(livro.anoPublicacao)}</span>`,
    ].filter(Boolean).join('');
  }

  // Botões de acção dentro do modal
  const btnEditar  = document.getElementById('detalhe-btn-editar');
  const btnDeletar = document.getElementById('detalhe-btn-deletar');
  if (btnEditar)  btnEditar.onclick  = () => { fecharModal('modal-detalhe'); APP.abrirModalEditar(id); };
  if (btnDeletar) btnDeletar.onclick = () => { fecharModal('modal-detalhe'); APP.abrirModalDeletar(id); };

  abrirModal('modal-detalhe');
  lucide.createIcons({ nodes: [document.getElementById('modal-detalhe')] });
};

// ============================================================
// MODAL EDITAR LIVRO
// ============================================================
APP.abrirModalEditar = function(id) {
  const livro = APP.livros.find(l => l.id === id);
  if (!livro) return;
  APP.livroParaEditar = livro;

  // Constrói opções do select, incluindo categoria legada se necessário
  let catOptions = APP.categorias.map(c =>
    `<option value="${esc(c)}" ${c === livro.categoria ? 'selected' : ''}>${esc(c)}</option>`
  ).join('');

  if (livro.categoria && !APP.categorias.includes(livro.categoria)) {
    catOptions = `<option value="${esc(livro.categoria)}" selected>${esc(livro.categoria)} ★</option>` + catOptions;
  }

  const container = document.getElementById('edit-form-container');
  if (!container) return;

  container.innerHTML = `
    <div class="form-col-2">
      <label><i data-lucide="type"></i> Título</label>
      <input type="text" id="e-titulo" value="${esc(livro.titulo)}" required>
    </div>
    <div>
      <label><i data-lucide="user"></i> Autor</label>
      <input type="text" id="e-autor" value="${esc(livro.autor)}" required>
    </div>
    <div>
      <label><i data-lucide="layers"></i> Categoria</label>
      <select id="e-categoria">${catOptions}</select>
    </div>
    <div>
      <label><i data-lucide="briefcase"></i> Assunto</label>
      <input type="text" id="e-assunto" value="${esc(livro.assunto || '')}">
    </div>
    <div>
      <label><i data-lucide="building-2"></i> Editora</label>
      <input type="text" id="e-editora" value="${esc(livro.editora || '')}">
    </div>
    <div>
      <label><i data-lucide="calendar"></i> Ano</label>
      <input type="number" id="e-ano" value="${esc(livro.anoPublicacao || '')}" min="1000" max="2030">
    </div>
    <div class="form-col-2">
      <label><i data-lucide="image"></i> URL da Capa</label>
      <input type="url" id="e-capa" value="${esc(livro.capaURL || '')}"
             placeholder="https://...">
    </div>
    <div class="form-col-2">
      <label><i data-lucide="message-square"></i> Observações</label>
      <textarea id="e-observacoes" rows="3">${esc(livro.observacoes || '')}</textarea>
    </div>
  `;

  abrirModal('modal-editar');
  lucide.createIcons({ nodes: [container] });
};

async function salvarEdicao() {
  if (!APP.livroParaEditar) return;

  const titulo    = document.getElementById('e-titulo')?.value.trim();
  const autor     = document.getElementById('e-autor')?.value.trim();
  const categoria = document.getElementById('e-categoria')?.value;

  if (!titulo) { mostrarToast('O Título é obrigatório.', 'error');  return; }
  if (!autor)  { mostrarToast('O Autor é obrigatório.', 'error');   return; }

  const dados = {
    titulo, autor, categoria,
    editora:       document.getElementById('e-editora')?.value.trim()     || '',
    assunto:       document.getElementById('e-assunto')?.value.trim()     || '',
    anoPublicacao: document.getElementById('e-ano')?.value.trim()         || '',
    observacoes:   document.getElementById('e-observacoes')?.value.trim() || '',
    capaURL:       document.getElementById('e-capa')?.value.trim()        || '',
  };

  mostrarLoading('A actualizar livro...');
  try {
    const res = await apiActualizarLivro(APP.livroParaEditar.id, dados);
    if (res.success) {
      const idx = APP.livros.findIndex(l => l.id === APP.livroParaEditar.id);
      if (idx !== -1) APP.livros[idx] = res.data;
      APP.livrosFiltrados = APP.livrosFiltrados.map(l =>
        l.id === res.data.id ? res.data : l
      );
      await cacheLivros(APP.livros);
      actualizarContadores();
      renderizarListaCompleta();
      renderizarUltimos();
      popularSelectAnanias();
      fecharModal('modal-editar');
      mostrarToast(`"${titulo}" actualizado!`, 'success');
    } else {
      mostrarToast('Erro ao actualizar: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ============================================================
// MODAL DELETAR LIVRO
// ============================================================
APP.abrirModalDeletar = function(id) {
  const livro = APP.livros.find(l => l.id === id);
  if (!livro) return;
  APP.livroParaDeletar = livro;
  const el = document.getElementById('modal-deletar-titulo');
  if (el) el.textContent = `"${livro.titulo}"`;
  abrirModal('modal-deletar');
};

async function confirmarDelecao() {
  if (!APP.livroParaDeletar) return;
  mostrarLoading('A eliminar livro...');
  try {
    const res = await apiEliminarLivro(APP.livroParaDeletar.id);
    if (res.success) {
      const titulo        = APP.livroParaDeletar.titulo;
      const idRemovido    = APP.livroParaDeletar.id;
      APP.livros          = APP.livros.filter(l => l.id !== idRemovido);
      APP.livrosFiltrados = APP.livrosFiltrados.filter(l => l.id !== idRemovido);
      await cacheLivros(APP.livros);
      actualizarContadores();
      renderizarListaCompleta();
      renderizarUltimos();
      popularSelectAnanias();
      fecharModal('modal-deletar');
      mostrarToast(`"${titulo}" eliminado.`, 'info');
    } else {
      mostrarToast('Erro ao eliminar: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ============================================================
// UTILITÁRIOS DE MODAL
// ============================================================
function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
  if (id === 'modal-editar')  APP.livroParaEditar  = null;
  if (id === 'modal-deletar') APP.livroParaDeletar = null;
}

// ============================================================
// EXPORTAR CSV
// ============================================================
function exportarCSV() {
  if (APP.livros.length === 0) {
    mostrarToast('Sem livros para exportar.', 'info'); return;
  }

  const escapeCsv = v => {
    const s = String(v || '').trim();
    return (s.includes(';') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = ['ID','Título','Autor','Editora','Categoria','Assunto',
                   'Ano','Observações','CapaURL','DataCadastro'];
  const rows = [headers.join(';')];

  APP.livros.forEach(l => rows.push([
    escapeCsv(l.id),    escapeCsv(l.titulo),       escapeCsv(l.autor),
    escapeCsv(l.editora), escapeCsv(l.categoria),  escapeCsv(l.assunto),
    escapeCsv(l.anoPublicacao), escapeCsv(l.observacoes),
    escapeCsv(l.capaURL), escapeCsv(l.dataCadastro)
  ].join(';')));

  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `biblioa_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToast(`${APP.livros.length} livro(s) exportado(s).`, 'success');
}

// ============================================================
// IMPORTAR CSV
// ============================================================
function importarCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async e => {
    mostrarLoading('A importar livros...');
    try {
      const res = await apiImportarCSV(e.target.result);
      if (res.success) {
        mostrarToast(res.mensagem, 'success', 6000);
        await carregarLivros();
      } else {
        mostrarToast('Erro na importação: ' + res.error, 'error', 7000);
      }
    } catch(err) {
      mostrarToast('Erro: ' + err.message, 'error');
    } finally {
      ocultarLoading();
      event.target.value = null;
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ============================================================
// ABA RECOMENDAÇÕES
// ============================================================
function popularTabRec() {
  const tbody = document.getElementById('rec-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (APP.livros.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" style="text-align:center; color:var(--gray-400); padding:1.5rem; font-style:italic;">
        Nenhum livro cadastrado. Adicione livros primeiro.
      </td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  APP.livros.forEach(livro => {
    const sel = APP.selectedBookIds.includes(livro.id);
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center; width:40px;">
        <button class="btn-icon" onclick="toggleSeleccao('${livro.id}')"
                title="${sel ? 'Remover' : 'Seleccionar'}">
          <i data-lucide="${sel ? 'check-square' : 'square'}"
             style="color:${sel ? 'var(--green-600)' : 'var(--gray-400)'};"></i>
        </button>
      </td>
      <td style="font-weight:${sel ? '700' : '400'}; color:${sel ? 'var(--navy-800)' : 'inherit'};">
        ${esc(livro.titulo)}
      </td>
      <td class="muted hide-sm">${esc(livro.autor)}</td>
      <td class="hide-md"><span class="badge badge-navy">${esc(livro.categoria)}</span></td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  _actualizarContadorRec();
  lucide.createIcons({ nodes: [tbody] });
}

function toggleSeleccao(id) {
  if (APP.selectedBookIds.includes(id)) {
    APP.selectedBookIds = APP.selectedBookIds.filter(x => x !== id);
  } else {
    APP.selectedBookIds.push(id);
  }
  popularTabRec();
  // Limpa resultado anterior
  const res = document.getElementById('rec-result');
  if (res) res.innerHTML = '<p style="color:var(--gray-400);font-style:italic;">Clique em "Gerar Recomendação".</p>';
  const src = document.getElementById('rec-sources');
  if (src) src.style.display = 'none';
}

function _actualizarContadorRec() {
  const n   = APP.selectedBookIds.length;
  const cnt = document.getElementById('rec-count');
  const btn = document.getElementById('btn-gerar-rec');
  if (cnt) cnt.textContent = `${n} livro${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;
  if (btn) btn.disabled = n === 0;
}

async function gerarRecomendacao() {
  if (APP.selectedBookIds.length === 0) return;

  const seleccionados = APP.livros
    .filter(l => APP.selectedBookIds.includes(l.id))
    .map(l => ({ titulo: l.titulo, autor: l.autor, categoria: l.categoria, assunto: l.assunto }));

  mostrarLoading('A IA está a analisar a biblioteca...');
  const resultEl = document.getElementById('rec-result');
  if (resultEl) resultEl.innerHTML = '';

  try {
    const res = await apiGerarRecomendacao(seleccionados);
    if (res.success) {
      if (resultEl) resultEl.innerHTML = renderMarkdown(res.text);
      renderizarFontes('rec-sources', res.sources);
    } else {
      if (resultEl) resultEl.innerHTML = `<p style="color:var(--red-600);">Erro: ${esc(res.error)}</p>`;
      mostrarToast('Erro da IA: ' + res.error, 'error');
    }
  } catch(e) {
    const msg = e.message === 'OFFLINE' ? 'A IA requer conexão à internet.' : e.message;
    if (resultEl) resultEl.innerHTML = `<p style="color:var(--red-600);">${esc(msg)}</p>`;
    mostrarToast(msg, 'error');
  } finally {
    ocultarLoading();
    lucide.createIcons();
  }
}

// ============================================================
// A.N.A.N.I.A.S.
// ============================================================
async function gerarResumoAnanias() {
  const bookId = document.getElementById('ananias-select')?.value;
  if (!bookId) { mostrarToast('Selecione um livro.', 'info'); return; }

  const livro = APP.livros.find(l => l.id === bookId);
  if (!livro) return;

  mostrarLoading('A.N.A.N.I.A.S. está a pensar...');
  APP.summaryText = '';

  const resultEl  = document.getElementById('ananias-result');
  const sourcesEl = document.getElementById('ananias-sources');
  const copyDiv   = document.getElementById('ananias-copy-btn');

  if (resultEl)  resultEl.innerHTML  = '';
  if (sourcesEl) sourcesEl.style.display = 'none';
  if (copyDiv)   copyDiv.style.display   = 'none';

  try {
    const res = await apiGerarResumoAnanias({
      titulo:    livro.titulo,
      autor:     livro.autor,
      categoria: livro.categoria,
      assunto:   livro.assunto
    });

    if (res.success) {
      APP.summaryText = res.text;
      if (resultEl)  resultEl.innerHTML = renderMarkdown(res.text);
      renderizarFontes('ananias-sources', res.sources);
      if (copyDiv) copyDiv.style.display = 'flex';
    } else {
      if (resultEl) resultEl.innerHTML = `<p style="color:var(--red-600);">Erro: ${esc(res.error)}</p>`;
      mostrarToast('Erro da IA: ' + res.error, 'error');
    }
  } catch(e) {
    const msg = e.message === 'OFFLINE' ? 'A IA requer conexão à internet.' : e.message;
    if (resultEl) resultEl.innerHTML = `<p style="color:var(--red-600);">${esc(msg)}</p>`;
    mostrarToast(msg, 'error');
  } finally {
    ocultarLoading();
    lucide.createIcons();
  }
}

// ============================================================
// CATEGORIAS
// ============================================================
function renderizarCategorias() {
  const ul = document.getElementById('cat-list');
  if (!ul) return;
  ul.innerHTML = '';

  if (APP.categorias.length === 0) {
    ul.innerHTML = `<li style="padding:1rem; color:var(--gray-400); font-style:italic; text-align:center;">Nenhuma categoria definida.</li>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  APP.categorias.forEach((cat, i) => {
    const li = document.createElement('li');
    li.className      = 'cat-item';
    li.draggable      = true;
    li.dataset.index  = i;
    li.innerHTML = `
      <span class="drag-handle"><i data-lucide="grip-vertical"></i></span>
      <span class="cat-name">${esc(cat)}</span>
      <button class="btn-icon btn-icon-red" onclick="removerCategoria(${i})" title="Remover categoria">
        <i data-lucide="trash-2" style="color:var(--red-600);width:14px;height:14px;"></i>
      </button>
    `;

    li.addEventListener('dragstart', e => {
      APP.dragSrcIndex = i;
      setTimeout(() => li.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend',   () => li.classList.remove('dragging', 'drag-over'));
    li.addEventListener('dragover',  e => { e.preventDefault(); li.classList.add('drag-over'); });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', async e => {
      e.preventDefault();
      li.classList.remove('drag-over');
      if (APP.dragSrcIndex === null || APP.dragSrcIndex === i) return;
      const nova = [...APP.categorias];
      const [item] = nova.splice(APP.dragSrcIndex, 1);
      nova.splice(i, 0, item);
      APP.dragSrcIndex = null;
      await salvarCategorias(nova);
    });

    fragment.appendChild(li);
  });

  ul.appendChild(fragment);
  lucide.createIcons({ nodes: [ul] });
}

async function adicionarCategoria() {
  const input = document.getElementById('nova-cat-input');
  const nome  = input?.value.trim();
  if (!nome)                          { mostrarToast('Insira o nome da categoria.', 'info'); return; }
  if (APP.categorias.includes(nome))  { mostrarToast('Essa categoria já existe.', 'info');  return; }
  await salvarCategorias([...APP.categorias, nome]);
  if (input) input.value = '';
}

async function removerCategoria(index) {
  const cat  = APP.categorias[index];
  const nova = APP.categorias.filter((_, i) => i !== index);
  await salvarCategorias(nova);
  mostrarToast(`Categoria "${cat}" removida.`, 'info');
}

async function salvarCategorias(novaLista) {
  mostrarLoading('A guardar categorias...');
  try {
    const res = await apiSalvarCategorias(novaLista);
    if (res.success) {
      APP.categorias = novaLista;
      renderizarCategorias();
      popularDropdowns();
      mostrarToast('Categorias guardadas.', 'success');
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
function carregarConfig() {
  const gasEl = document.getElementById('config-gas-url');
  if (gasEl) gasEl.value = getGasUrl();

  const lastSync = getLastSync();
  const syncEl   = document.getElementById('config-last-sync');
  if (syncEl) syncEl.textContent = lastSync
    ? new Date(lastSync).toLocaleString('pt-BR')
    : 'Nunca';

  getCachedLivros().then(lista => {
    const el = document.getElementById('config-cache-count');
    if (el) el.textContent = `${lista.length} livro(s)`;
  });
}

function salvarConfig() {
  const gasUrl = document.getElementById('config-gas-url')?.value.trim();
  if (!gasUrl) {
    mostrarToast('A URL do GAS é obrigatória.', 'error'); return;
  }
  if (!gasUrl.startsWith('https://script.google.com')) {
    mostrarToast('URL inválida. Deve começar com https://script.google.com', 'error'); return;
  }

  const isNew = !getGasUrl();
  setGasUrl(gasUrl);
  mostrarToast('Configurações guardadas!', 'success');

  // Se era a primeira configuração, inicializa os dados
  if (isNew || APP.livros.length === 0) {
    setTimeout(async () => {
      await inicializarDados();
      setTab('cadastro');
    }, 600);
  }
}

async function testarConexao() {
  const url = document.getElementById('config-gas-url')?.value.trim();
  if (!url) { mostrarToast('Insira a URL primeiro.', 'info'); return; }

  const btn = document.getElementById('btn-testar');
  if (btn) {
    btn.disabled   = true;
    btn.innerHTML  = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;width:14px;height:14px;"></i> A testar...';
    lucide.createIcons({ nodes: [btn] });
  }

  try {
    const oldUrl = getGasUrl();
    setGasUrl(url);
    const res = await apiGetCategorias();
    setGasUrl(oldUrl); // Restaura URL anterior se não for guardada

    if (res.success) {
      mostrarToast(`Conexão OK! ${res.data.length} categorias encontradas.`, 'success');
    } else {
      mostrarToast('GAS respondeu com erro: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Falha na conexão: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = '<i data-lucide="wifi"></i> Testar Conexão';
      lucide.createIcons({ nodes: [btn] });
    }
  }
}

function limparCacheLocal() {
  if (!confirm('Limpar o cache local e recarregar do servidor?')) return;
  clearLivrosCache().then(() => {
    mostrarToast('Cache limpo. A recarregar...', 'info');
    carregarLivros();
  });
}
