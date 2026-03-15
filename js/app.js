// ============================================================
// app.js — Lógica principal da aplicação BiblioA
// Estado global, CRUD, filtros, ordenação, categorias
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
  // Regista Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('[SW] Registado:', reg.scope);

      // Detecta update disponível
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            mostrarToast('Nova versão disponível! Recarregue para actualizar.', 'info', 8000);
          }
        });
      });
    } catch (e) {
      console.warn('[SW] Falha no registo:', e);
    }
  }

  // Inicializa ícones Lucide
  lucide.createIcons();

  // Estado online/offline
  window.addEventListener('online',  () => { APP.isOnline = true;  mostrarStatusSync('ok');      mostrarToast('Conexão restaurada.', 'success', 2500); });
  window.addEventListener('offline', () => { APP.isOnline = false; mostrarStatusSync('offline'); mostrarToast('Sem conexão. A usar dados locais.', 'warning'); });

  // Verifica configuração
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    // Primeira vez — vai para configurações
    setTimeout(() => {
      setTab('config');
      mostrarToast('Configure a URL do GAS para começar.', 'info', 7000);
    }, 500);
    return;
  }

  // Verifica hash da URL para deep linking
  const hash = window.location.hash.replace('#', '');
  const validTabs = ['cadastro', 'lista', 'recomendacoes', 'ananias', 'categorias', 'config'];

  // Carrega dados
  await inicializarDados();

  // Navega para aba correcta
  if (hash && validTabs.includes(hash)) setTab(hash);
  else setTab('cadastro');
});

// ============================================================
// INICIALIZAR DADOS (com fallback offline)
// ============================================================
async function inicializarDados() {
  mostrarLoading('Sincronizando biblioteca...');
  mostrarStatusSync('syncing');

  try {
    // Carrega categorias e livros em paralelo
    const [resCats, resLivros] = await Promise.all([
      apiGetCategorias(),
      apiGetLivros()
    ]);

    if (resCats.success)   APP.categorias = resCats.data;
    if (resLivros.success) {
      APP.livros          = resLivros.data;
      APP.livrosFiltrados = [...APP.livros];
      await cacheLivros(APP.livros); // Cache local para offline
      setLastSync(new Date().toISOString());
    }

    mostrarStatusSync('ok');
  } catch (e) {
    if (e.message === 'OFFLINE' || !APP.isOnline) {
      // Usa cache local
      APP.livros          = await getCachedLivros();
      APP.livrosFiltrados = [...APP.livros];
      mostrarStatusSync('offline');
      mostrarToast('Modo offline — a usar dados locais.', 'warning');
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
// CARREGAR / RECARREGAR LIVROS
// ============================================================
async function carregarLivros() {
  mostrarLoading('Actualizando lista...');
  mostrarStatusSync('syncing');

  try {
    const res = await apiGetLivros();
    if (res.success) {
      APP.livros          = res.data;
      APP.livrosFiltrados = [...APP.livros];
      await cacheLivros(APP.livros);
      setLastSync(new Date().toISOString());
      mostrarStatusSync('ok');
    } else {
      throw new Error(res.error);
    }
  } catch (e) {
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
  const termo = (document.getElementById('busca-input')?.value || '').toLowerCase().trim();
  const sortVal = document.getElementById('sort-select')?.value || 'dataCadastro-desc';
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
    if (col === 'dataCadastro') { av = new Date(av); bv = new Date(bv); }
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
  const mode = getViewMode();
  if (mode === 'grid') renderizarGrade(APP.livrosFiltrados);
  else                 renderizarTabela(APP.livrosFiltrados);

  // Sincroniza toggle
  document.getElementById('view-grid-btn')?.classList.toggle('active', mode === 'grid');
  document.getElementById('view-list-btn')?.classList.toggle('active', mode === 'list');
  document.getElementById('view-list').style.display = mode === 'list' ? 'block' : 'none';
  document.getElementById('view-grid').style.display = mode === 'grid' ? 'block' : 'none';
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
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1.5rem;font-style:italic;">Nenhum livro cadastrado ainda.</td></tr>`;
    return;
  }

  ultimos.forEach(livro => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-title">
        ${livro.capaURL
          ? `<img src="${esc(livro.capaURL)}" class="table-thumb" alt="" loading="lazy" onerror="this.style.display='none'">`
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
    tbody.appendChild(tr);
  });
  lucide.createIcons({ nodes: [tbody] });
}

// ============================================================
// CADASTRAR LIVRO
// ============================================================
async function cadastrarLivro() {
  const titulo    = document.getElementById('c-titulo')?.value.trim();
  const autor     = document.getElementById('c-autor')?.value.trim();
  const categoria = document.getElementById('c-categoria')?.value;

  if (!titulo || !autor) { mostrarToast('Título e Autor são obrigatórios.', 'error'); return; }
  if (!categoria)        { mostrarToast('Selecione uma Categoria.', 'error');          return; }

  const livro = {
    titulo, autor, categoria,
    editora:      document.getElementById('c-editora')?.value.trim()      || '',
    assunto:      document.getElementById('c-assunto')?.value.trim()      || '',
    anoPublicacao:document.getElementById('c-ano')?.value.trim()          || '',
    observacoes:  document.getElementById('c-observacoes')?.value.trim()  || '',
    capaURL:      document.getElementById('c-capa')?.value.trim()         || '',
  };

  mostrarLoading('Cadastrando livro...');
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
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch (e) {
    if (e.message === 'OFFLINE') mostrarToast('Sem conexão. Não é possível cadastrar offline.', 'error');
    else mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

function limparFormCadastro() {
  ['c-titulo','c-autor','c-assunto','c-editora','c-ano','c-capa','c-observacoes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('c-categoria');
  if (sel) sel.selectedIndex = 0;
}

// ============================================================
// BUSCAR CAPA AUTOMÁTICA
// ============================================================
async function buscarCapaAutomatica() {
  const titulo = document.getElementById('c-titulo')?.value.trim();
  const autor  = document.getElementById('c-autor')?.value.trim();
  if (!titulo) { mostrarToast('Insira o título primeiro.', 'info'); return; }

  mostrarLoading('Buscando capa...');
  try {
    const res = await apiBuscarCapa(titulo, autor);
    if (res.success && res.capaURL) {
      document.getElementById('c-capa').value = res.capaURL;
      mostrarToast('Capa encontrada!', 'success');
    } else {
      mostrarToast('Capa não encontrada. Insira a URL manualmente.', 'info');
    }
  } catch (e) {
    mostrarToast('Erro ao buscar capa.', 'error');
  } finally {
    ocultarLoading();
  }
}

// ============================================================
// MODAL DETALHE (clique no card da grade)
// ============================================================
APP.abrirDetalhe = function(id) {
  const livro = APP.livros.find(l => l.id === id);
  if (!livro) return;

  const [c1, c2] = getBookGradient(livro.titulo);

  document.getElementById('detalhe-titulo').textContent = livro.titulo;
  document.getElementById('detalhe-autor').textContent  = livro.autor;
  document.getElementById('detalhe-assunto').textContent = livro.assunto ? `📚 ${livro.assunto}` : '';
  document.getElementById('detalhe-obs').textContent     = livro.observacoes || '';

  const capaDiv = document.getElementById('detalhe-capa');
  if (livro.capaURL) {
    capaDiv.innerHTML = `<img src="${esc(livro.capaURL)}" class="detalhe-capa-img" alt="${esc(livro.titulo)}" onerror="this.style.display='none'">`;
  } else {
    capaDiv.innerHTML = `<div class="detalhe-capa-placeholder" style="background:linear-gradient(145deg,${c1},${c2});"><i data-lucide="book-open" style="width:40px;height:40px;color:rgba(255,255,255,0.5);"></i></div>`;
  }

  const metaDiv = document.getElementById('detalhe-meta');
  metaDiv.innerHTML = [
    livro.categoria && `<span class="badge badge-navy">${esc(livro.categoria)}</span>`,
    livro.editora   && `<span class="badge badge-navy">${esc(livro.editora)}</span>`,
    livro.anoPublicacao && `<span class="badge badge-navy">${esc(livro.anoPublicacao)}</span>`,
  ].filter(Boolean).join('');

  document.getElementById('detalhe-btn-editar').onclick  = () => { fecharModal('modal-detalhe'); APP.abrirModalEditar(id); };
  document.getElementById('detalhe-btn-deletar').onclick = () => { fecharModal('modal-detalhe'); APP.abrirModalDeletar(id); };

  abrirModal('modal-detalhe');
  lucide.createIcons({ nodes: [document.getElementById('modal-detalhe')] });
};

// ============================================================
// EDITAR LIVRO
// ============================================================
APP.abrirModalEditar = function(id) {
  const livro = APP.livros.find(l => l.id === id);
  if (!livro) return;
  APP.livroParaEditar = livro;

  let catOptions = APP.categorias.map(c =>
    `<option value="${esc(c)}" ${c === livro.categoria ? 'selected' : ''}>${esc(c)}</option>`
  ).join('');
  if (livro.categoria && !APP.categorias.includes(livro.categoria)) {
    catOptions = `<option value="${esc(livro.categoria)}" selected>${esc(livro.categoria)}</option>` + catOptions;
  }

  document.getElementById('edit-form-container').innerHTML = `
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
      <input type="number" id="e-ano" value="${esc(livro.anoPublicacao || '')}">
    </div>
    <div class="form-col-2">
      <label><i data-lucide="image"></i> URL da Capa</label>
      <input type="url" id="e-capa" value="${esc(livro.capaURL || '')}">
    </div>
    <div class="form-col-2">
      <label><i data-lucide="message-square"></i> Observações</label>
      <textarea id="e-observacoes" rows="3">${esc(livro.observacoes || '')}</textarea>
    </div>
  `;

  abrirModal('modal-editar');
  lucide.createIcons({ nodes: [document.getElementById('modal-editar')] });
};

async function salvarEdicao() {
  if (!APP.livroParaEditar) return;
  const titulo = document.getElementById('e-titulo')?.value.trim();
  const autor  = document.getElementById('e-autor')?.value.trim();
  if (!titulo || !autor) { mostrarToast('Título e Autor obrigatórios.', 'error'); return; }

  const dados = {
    titulo, autor,
    categoria:    document.getElementById('e-categoria')?.value   || '',
    editora:      document.getElementById('e-editora')?.value.trim()     || '',
    assunto:      document.getElementById('e-assunto')?.value.trim()     || '',
    anoPublicacao:document.getElementById('e-ano')?.value.trim()         || '',
    observacoes:  document.getElementById('e-observacoes')?.value.trim() || '',
    capaURL:      document.getElementById('e-capa')?.value.trim()        || '',
  };

  mostrarLoading('Actualizando livro...');
  try {
    const res = await apiActualizarLivro(APP.livroParaEditar.id, dados);
    if (res.success) {
      const idx = APP.livros.findIndex(l => l.id === APP.livroParaEditar.id);
      if (idx !== -1) APP.livros[idx] = res.data;
      APP.livrosFiltrados = [...APP.livros];
      await cacheLivros(APP.livros);
      actualizarContadores();
      renderizarListaCompleta();
      renderizarUltimos();
      popularSelectAnanias();
      fecharModal('modal-editar');
      mostrarToast(`"${titulo}" actualizado!`, 'success');
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch (e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ============================================================
// DELETAR LIVRO
// ============================================================
APP.abrirModalDeletar = function(id) {
  const livro = APP.livros.find(l => l.id === id);
  if (!livro) return;
  APP.livroParaDeletar = livro;
  document.getElementById('modal-deletar-titulo').textContent = `"${livro.titulo}"`;
  abrirModal('modal-deletar');
};

async function confirmarDelecao() {
  if (!APP.livroParaDeletar) return;
  mostrarLoading('Eliminando livro...');
  try {
    const res = await apiEliminarLivro(APP.livroParaDeletar.id);
    if (res.success) {
      const titulo   = APP.livroParaDeletar.titulo;
      APP.livros          = APP.livros.filter(l => l.id !== APP.livroParaDeletar.id);
      APP.livrosFiltrados = APP.livrosFiltrados.filter(l => l.id !== APP.livroParaDeletar.id);
      await cacheLivros(APP.livros);
      actualizarContadores();
      renderizarListaCompleta();
      renderizarUltimos();
      popularSelectAnanias();
      fecharModal('modal-deletar');
      mostrarToast(`"${titulo}" eliminado.`, 'info');
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch (e) {
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
  if (el) { el.style.display = 'flex'; el.classList.add('modal-open'); }
}

function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'none'; el.classList.remove('modal-open'); }
  if (id === 'modal-editar')  APP.livroParaEditar  = null;
  if (id === 'modal-deletar') APP.livroParaDeletar = null;
}

// Fechar modal ao clicar no backdrop
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.style.display = 'none';
  }
});

// ============================================================
// EXPORTAR CSV
// ============================================================
function exportarCSV() {
  if (APP.livros.length === 0) { mostrarToast('Sem livros para exportar.', 'info'); return; }

  const escapeCsv = v => {
    const s = String(v || '').trim();
    return (s.includes(';') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
  };

  const headers = ['ID','Título','Autor','Editora','Categoria','Assunto','Ano','Observações','CapaURL','DataCadastro'];
  const rows    = [headers.join(';')];
  APP.livros.forEach(l => rows.push([
    escapeCsv(l.id), escapeCsv(l.titulo), escapeCsv(l.autor),
    escapeCsv(l.editora), escapeCsv(l.categoria), escapeCsv(l.assunto),
    escapeCsv(l.anoPublicacao), escapeCsv(l.observacoes),
    escapeCsv(l.capaURL), escapeCsv(l.dataCadastro)
  ].join(';')));

  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `biblioa_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
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
    mostrarLoading('Importando livros...');
    try {
      const res = await apiImportarCSV(e.target.result);
      if (res.success) {
        mostrarToast(res.mensagem, 'success', 6000);
        await carregarLivros();
      } else {
        mostrarToast('Erro: ' + res.error, 'error', 7000);
      }
    } catch (err) {
      mostrarToast('Erro na importação: ' + err.message, 'error');
    } finally {
      ocultarLoading();
      event.target.value = null;
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ============================================================
// RECOMENDAÇÕES IA
// ============================================================
function popularTabRec() {
  const tbody = document.getElementById('rec-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  APP.livros.forEach(livro => {
    const sel = APP.selectedBookIds.includes(livro.id);
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;width:40px;">
        <button class="btn-icon" onclick="toggleSeleccao('${livro.id}')">
          <i data-lucide="${sel ? 'check-square' : 'square'}" style="color:${sel ? 'var(--green-600)' : '#94a3b8'};"></i>
        </button>
      </td>
      <td style="font-weight:${sel?'700':'400'}">${esc(livro.titulo)}</td>
      <td class="muted hide-sm">${esc(livro.autor)}</td>
      <td class="hide-md"><span class="badge badge-navy">${esc(livro.categoria)}</span></td>
    `;
    tbody.appendChild(tr);
  });

  const n   = APP.selectedBookIds.length;
  const btn = document.getElementById('btn-gerar-rec');
  if (btn) btn.disabled = n === 0;
  const cnt = document.getElementById('rec-count');
  if (cnt) cnt.textContent = `${n} livro${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;

  lucide.createIcons({ nodes: [tbody] });
}

function toggleSeleccao(id) {
  if (APP.selectedBookIds.includes(id)) APP.selectedBookIds = APP.selectedBookIds.filter(x => x !== id);
  else APP.selectedBookIds.push(id);
  popularTabRec();
  document.getElementById('rec-result').innerHTML = '';
  document.getElementById('rec-sources').style.display = 'none';
}

async function gerarRecomendacao() {
  if (APP.selectedBookIds.length === 0) return;
  const sel = APP.livros
    .filter(l => APP.selectedBookIds.includes(l.id))
    .map(l => ({ titulo: l.titulo, autor: l.autor, categoria: l.categoria, assunto: l.assunto }));

  mostrarLoading('A IA está a analisar a biblioteca...');
  document.getElementById('rec-result').innerHTML = '';

  try {
    const res = await apiGerarRecomendacao(sel);
    if (res.success) {
      document.getElementById('rec-result').innerHTML = renderMarkdown(res.text);
      renderizarFontes('rec-sources', res.sources);
    } else {
      document.getElementById('rec-result').innerHTML = `<p style="color:var(--red-600);">Erro: ${esc(res.error)}</p>`;
    }
  } catch (e) {
    const msg = e.message === 'OFFLINE' ? 'Sem conexão. A IA requer internet.' : e.message;
    document.getElementById('rec-result').innerHTML = `<p style="color:var(--red-600);">Erro: ${esc(msg)}</p>`;
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
  document.getElementById('ananias-result').innerHTML = '';
  document.getElementById('ananias-copy-btn').style.display = 'none';
  document.getElementById('ananias-sources').style.display  = 'none';

  try {
    const res = await apiGerarResumoAnanias({
      titulo:    livro.titulo,
      autor:     livro.autor,
      categoria: livro.categoria,
      assunto:   livro.assunto
    });

    if (res.success) {
      APP.summaryText = res.text;
      document.getElementById('ananias-result').innerHTML = renderMarkdown(res.text);
      renderizarFontes('ananias-sources', res.sources);
      document.getElementById('ananias-copy-btn').style.display = 'flex';
    } else {
      document.getElementById('ananias-result').innerHTML = `<p style="color:var(--red-600);">Erro: ${esc(res.error)}</p>`;
    }
  } catch (e) {
    const msg = e.message === 'OFFLINE' ? 'Sem conexão. A IA requer internet.' : e.message;
    document.getElementById('ananias-result').innerHTML = `<p style="color:var(--red-600);">${esc(msg)}</p>`;
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

  APP.categorias.forEach((cat, i) => {
    const li = document.createElement('li');
    li.className    = 'cat-item';
    li.draggable    = true;
    li.dataset.index = i;
    li.innerHTML = `
      <span class="drag-handle"><i data-lucide="grip-vertical"></i></span>
      <span class="cat-name">${esc(cat)}</span>
      <button class="btn-icon btn-icon-red" onclick="removerCategoria(${i})" title="Remover">
        <i data-lucide="trash-2" style="color:var(--red-600);width:14px;height:14px;"></i>
      </button>
    `;
    li.addEventListener('dragstart', e => {
      APP.dragSrcIndex = i;
      setTimeout(() => li.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend',  () => li.classList.remove('dragging','drag-over'));
    li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drag-over'); });
    li.addEventListener('dragleave',() => li.classList.remove('drag-over'));
    li.addEventListener('drop', e => {
      e.preventDefault();
      li.classList.remove('drag-over');
      if (APP.dragSrcIndex === null || APP.dragSrcIndex === i) return;
      const nova = [...APP.categorias];
      const [item] = nova.splice(APP.dragSrcIndex, 1);
      nova.splice(i, 0, item);
      APP.dragSrcIndex = null;
      salvarCategorias(nova);
    });
    ul.appendChild(li);
  });

  lucide.createIcons({ nodes: [ul] });
}

async function adicionarCategoria() {
  const input = document.getElementById('nova-cat-input');
  const nome  = input?.value.trim();
  if (!nome) { mostrarToast('Insira o nome da categoria.', 'info'); return; }
  if (APP.categorias.includes(nome)) { mostrarToast('Categoria já existe.', 'info'); return; }
  await salvarCategorias([...APP.categorias, nome]);
  if (input) input.value = '';
}

async function removerCategoria(index) {
  await salvarCategorias(APP.categorias.filter((_, i) => i !== index));
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
  } catch (e) {
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
}

function salvarConfig() {
  const gasUrl = document.getElementById('config-gas-url')?.value.trim();
  if (!gasUrl) { mostrarToast('A URL do GAS é obrigatória.', 'error'); return; }
  if (!gasUrl.startsWith('https://script.google.com')) {
    mostrarToast('URL inválida. Deve começar com https://script.google.com', 'error'); return;
  }
  setGasUrl(gasUrl);
  mostrarToast('Configurações guardadas!', 'success');

  // Se havia um erro de configuração, reinicializa
  if (APP.livros.length === 0) {
    setTimeout(() => { inicializarDados().then(() => setTab('cadastro')); }, 800);
  }
}

function limparCacheLocal() {
  if (!confirm('Limpar o cache local e recarregar dados do servidor?')) return;
  clearLivrosCache().then(() => {
    mostrarToast('Cache limpo. A recarregar...', 'info');
    carregarLivros();
  });
}
