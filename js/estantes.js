// ============================================================
// estantes.js — Módulo "Minhas Estantes"
// Estantes como pastas visuais + itens (notas, links, ficheiros)
// ============================================================

// ─── ESTADO LOCAL ───────────────────────────────────────────
const ESTANTES = {
  lista:           [],   // todas as estantes
  estanteActiva:   null, // objecto da estante seleccionada
  itens:           [],   // itens da estante activa
  itemParaEditar:  null,
  itemParaDeletar: null,
  driveFiles:      [],
};

const ICONES_ESTANTE = [
  { id:'library',      label:'Biblioteca' },
  { id:'book-open',    label:'Livros' },
  { id:'star',         label:'Favoritos' },
  { id:'bookmark',     label:'Marcados' },
  { id:'graduation-cap',label:'Estudos' },
  { id:'briefcase',    label:'Trabalho' },
  { id:'heart',        label:'Amados' },
  { id:'folder',       label:'Pasta' },
  { id:'archive',      label:'Arquivo' },
  { id:'clock',        label:'A ler' },
];

const CORES_ESTANTE = [
  '#1e3a5f','#1a2f96','#15803d','#92400e',
  '#7c3aed','#be185d','#0f766e','#374151',
  '#b45309','#0369a1',
];

// Tipos de item suportados
const TIPOS_ITEM = {
  nota:       { icon:'file-text',   label:'Nota de Texto'  },
  link:       { icon:'link',        label:'Link / URL'     },
  ficheiro:   { icon:'paperclip',   label:'Ficheiro'       },
  livro:      { icon:'book-open',   label:'Livro do Acervo'},
};

// ─── INICIALIZAÇÃO ──────────────────────────────────────────
async function inicializarEstantes() {
  mostrarLoading('A carregar estantes...');
  try {
    const res = await apiGetEstantes();
    if (res.success) {
      ESTANTES.lista = res.data;
      renderizarGaleriaEstantes();
    }
  } catch(e) {
    mostrarToast('Erro ao carregar estantes: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ─── RENDERIZAR GALERIA DE ESTANTES ─────────────────────────
function renderizarGaleriaEstantes() {
  const container = document.getElementById('estantes-galeria');
  if (!container) return;
  container.innerHTML = '';

  if (ESTANTES.lista.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1; padding:3rem 1rem;">
        <i data-lucide="library" style="width:48px;height:48px;opacity:0.2;"></i>
        <p>Ainda não tens estantes.</p>
        <button class="btn btn-primary" onclick="abrirModalCriarEstante()" style="margin-top:1rem;">
          <i data-lucide="plus"></i> Criar Primeira Estante
        </button>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const fragment = document.createDocumentFragment();
  ESTANTES.lista.forEach(estante => {
    const card = document.createElement('div');
    card.className = 'estante-card';
    card.style.setProperty('--estante-cor', estante.cor || '#1e3a5f');
    card.onclick = () => abrirEstante(estante.id);

    card.innerHTML = `
      <!-- Prateleira visual -->
      <div class="estante-shelf">
        <div class="estante-shelf-top"></div>
        <div class="estante-shelf-spines" id="spines-${estante.id}">
          <!-- Lombadas de livros renderizadas depois -->
          <div class="spine-placeholder"></div>
          <div class="spine-placeholder"></div>
          <div class="spine-placeholder"></div>
        </div>
        <div class="estante-shelf-bottom"></div>
        <div class="estante-shelf-leg left"></div>
        <div class="estante-shelf-leg right"></div>
      </div>
      <!-- Info -->
      <div class="estante-info">
        <div class="estante-icon-wrap">
          <i data-lucide="${esc(estante.icone || 'library')}"></i>
        </div>
        <div class="estante-text">
          <h3>${esc(estante.nome)}</h3>
          ${estante.descricao ? `<p>${esc(estante.descricao)}</p>` : ''}
        </div>
        <div class="estante-actions" onclick="event.stopPropagation()">
          <button class="btn-icon" onclick="abrirModalEditarEstante('${estante.id}')" title="Editar">
            <i data-lucide="pencil" style="width:13px;height:13px;color:var(--navy-600);"></i>
          </button>
          <button class="btn-icon btn-icon-red" onclick="confirmarDeletarEstante('${estante.id}')" title="Eliminar">
            <i data-lucide="trash-2" style="width:13px;height:13px;color:var(--red-600);"></i>
          </button>
        </div>
      </div>
    `;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });

  // Carrega contagem de itens para cada estante (assíncrono, não bloqueia)
  ESTANTES.lista.forEach(e => carregarSpinesEstante(e.id));
}

// Carrega lombadas (spines) da estante baseado nos livros que ela contém
async function carregarSpinesEstante(estanteId) {
  try {
    const res = await apiGetItens(estanteId);
    if (!res.success) return;

    const spinesEl = document.getElementById(`spines-${estanteId}`);
    if (!spinesEl) return;

    const livros = res.data.filter(i => i.tipo === 'livro');
    const total  = res.data.length;

    if (total === 0) {
      spinesEl.innerHTML = `
        <div class="spine-empty">
          <i data-lucide="plus" style="width:14px;height:14px;opacity:0.5;"></i>
        </div>`;
      lucide.createIcons({ nodes: [spinesEl] });
      return;
    }

    // Mostra até 8 lombadas coloridas
    const SPINE_COLORS = [
      '#c8453a','#e8a020','#2d6fa4','#3d9b3d',
      '#7b4fa6','#c05680','#4a8b8b','#8b6830',
    ];
    const shown = res.data.slice(0, 8);
    spinesEl.innerHTML = shown.map((item, i) => {
      const cor = SPINE_COLORS[i % SPINE_COLORS.length];
      const h   = 55 + (i % 3) * 12; // alturas variadas
      return `
        <div class="book-spine" style="background:${cor};height:${h}px;"
             title="${esc(item.titulo)}">
          <span>${esc((item.titulo||'').substring(0,2))}</span>
        </div>`;
    }).join('');

    if (total > 8) {
      spinesEl.innerHTML += `<div class="spine-more">+${total - 8}</div>`;
    }
  } catch(e) { /* silencioso */ }
}

// ─── ABRIR ESTANTE (Vista Interior) ─────────────────────────
async function abrirEstante(estanteId) {
  const estante = ESTANTES.lista.find(e => e.id === estanteId);
  if (!estante) return;
  ESTANTES.estanteActiva = estante;

  // Troca a vista de galeria pela vista interior
  document.getElementById('estantes-galeria-view').style.display = 'none';
  document.getElementById('estante-interior-view').style.display = 'block';

  // Breadcrumb
  document.getElementById('estante-breadcrumb-nome').textContent = estante.nome;

  // Header da estante
  const headerEl = document.getElementById('estante-interior-header');
  if (headerEl) {
    headerEl.style.setProperty('--estante-cor', estante.cor || '#1e3a5f');
    document.getElementById('estante-interior-title').textContent = estante.nome;
    document.getElementById('estante-interior-desc').textContent  = estante.descricao || '';
  }

  await carregarItensEstante(estanteId);
}

async function carregarItensEstante(estanteId) {
  mostrarLoading('A carregar itens...');
  try {
    const res = await apiGetItens(estanteId);
    if (res.success) {
      ESTANTES.itens = res.data;
      renderizarItens();
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ─── RENDERIZAR ITENS DA ESTANTE ────────────────────────────
function renderizarItens() {
  const container = document.getElementById('itens-container');
  if (!container) return;
  container.innerHTML = '';

  if (ESTANTES.itens.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="package-open"></i>
        <p>Esta estante está vazia.<br>Adicione uma nota, link ou ficheiro.</p>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const fragment = document.createDocumentFragment();
  ESTANTES.itens.forEach(item => {
    const el = document.createElement('div');
    el.className = `item-card item-card-${item.tipo}`;
    el.innerHTML = _buildItemCard(item);
    fragment.appendChild(el);
  });
  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });
}

function _buildItemCard(item) {
  const cfg = TIPOS_ITEM[item.tipo] || TIPOS_ITEM.nota;
  const dt  = item.dataCriacao
    ? new Date(item.dataCriacao).toLocaleDateString('pt-BR')
    : '';

  let body = '';
  if (item.tipo === 'nota') {
    body = `<div class="item-body-nota">${esc(item.conteudo).replace(/\n/g,'<br>')}</div>`;
  } else if (item.tipo === 'link') {
    body = `<a href="${esc(item.url)}" target="_blank" rel="noopener" class="item-link-url">
              <i data-lucide="external-link" style="width:12px;height:12px;"></i>
              ${esc(item.url)}
            </a>`;
  } else if (item.tipo === 'ficheiro') {
    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(item.titulo);
    body = isImg
      ? `<a href="${esc(item.url)}" target="_blank">
           <img src="${esc(item.url)}" class="item-img-preview" alt="${esc(item.titulo)}">
         </a>`
      : `<a href="${esc(item.url)}" target="_blank" rel="noopener" class="item-link-url">
           <i data-lucide="download" style="width:12px;height:12px;"></i>
           Abrir ficheiro
         </a>`;
  } else if (item.tipo === 'livro') {
    const livro = APP.livros.find(l => l.id === item.conteudo);
    body = livro
      ? `<div style="display:flex;gap:0.5rem;align-items:center;">
           ${livro.capaURL
             ? `<img src="${esc(livro.capaURL)}" style="width:32px;height:48px;object-fit:cover;border-radius:3px;">`
             : ''}
           <div>
             <p style="font-weight:600;font-size:0.85rem;">${esc(livro.titulo)}</p>
             <p style="font-size:0.78rem;color:var(--gray-500);">${esc(livro.autor)}</p>
           </div>
         </div>`
      : `<p style="color:var(--gray-400);font-style:italic;">Livro não encontrado no acervo.</p>`;
  }

  return `
    <div class="item-header">
      <i data-lucide="${cfg.icon}" class="item-type-icon"></i>
      <span class="item-titulo">${esc(item.titulo)}</span>
      <span class="item-date">${dt}</span>
      <div class="item-actions">
        <button class="btn-icon" onclick="abrirModalEditarItem('${item.id}')" title="Editar">
          <i data-lucide="pencil" style="width:12px;height:12px;color:var(--navy-600);"></i>
        </button>
        <button class="btn-icon btn-icon-red" onclick="confirmarDeletarItem('${item.id}')" title="Eliminar">
          <i data-lucide="trash-2" style="width:12px;height:12px;color:var(--red-600);"></i>
        </button>
      </div>
    </div>
    ${body ? `<div class="item-body">${body}</div>` : ''}
  `;
}

// ─── VOLTAR À GALERIA ────────────────────────────────────────
function voltarGaleriaEstantes() {
  ESTANTES.estanteActiva = null;
  document.getElementById('estantes-galeria-view').style.display = 'block';
  document.getElementById('estante-interior-view').style.display = 'none';
  renderizarGaleriaEstantes();
}

// ─── CRIAR / EDITAR ESTANTE ──────────────────────────────────
function abrirModalCriarEstante() {
  _preencherFormEstante(null);
  abrirModal('modal-estante');
}

function abrirModalEditarEstante(id) {
  const est = ESTANTES.lista.find(e => e.id === id);
  if (!est) return;
  _preencherFormEstante(est);
  abrirModal('modal-estante');
}

function _preencherFormEstante(est) {
  document.getElementById('estante-form-id').value       = est?.id       || '';
  document.getElementById('estante-form-nome').value     = est?.nome     || '';
  document.getElementById('estante-form-desc').value     = est?.descricao|| '';

  // Selector de cor
  const corContainer = document.getElementById('estante-cores');
  corContainer.innerHTML = CORES_ESTANTE.map(cor => `
    <button type="button"
      class="cor-btn ${(est?.cor || '#1e3a5f') === cor ? 'selected' : ''}"
      style="background:${cor};"
      data-cor="${cor}"
      onclick="seleccionarCorEstante('${cor}', this)">
    </button>
  `).join('');

  // Selector de ícone
  const iconeContainer = document.getElementById('estante-icones');
  iconeContainer.innerHTML = ICONES_ESTANTE.map(ic => `
    <button type="button"
      class="icone-btn ${(est?.icone || 'library') === ic.id ? 'selected' : ''}"
      data-icone="${ic.id}"
      title="${ic.label}"
      onclick="seleccionarIconeEstante('${ic.id}', this)">
      <i data-lucide="${ic.id}" style="width:18px;height:18px;"></i>
    </button>
  `).join('');

  const senhaEl = document.getElementById('estante-form-senha');
  if (senhaEl) senhaEl.value = ''; // nunca pré-preenche por segurança

  document.getElementById('modal-estante-title').textContent =
    est ? 'Editar Estante' : 'Nova Estante';

  lucide.createIcons({ nodes: [document.getElementById('modal-estante')] });
}

function seleccionarCorEstante(cor, btn) {
  document.querySelectorAll('.cor-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function seleccionarIconeEstante(icone, btn) {
  document.querySelectorAll('.icone-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function salvarEstante() {
  const id     = document.getElementById('estante-form-id').value;
  const nome   = document.getElementById('estante-form-nome').value.trim();
  const desc   = document.getElementById('estante-form-desc').value.trim();
  const corEl  = document.querySelector('.cor-btn.selected');
  const icEl   = document.querySelector('.icone-btn.selected');
  const cor    = corEl  ? corEl.dataset.cor   : '#1e3a5f';
  const icone  = icEl   ? icEl.dataset.icone  : 'library';
  const senha  = document.getElementById('estante-form-senha')?.value.trim() || '';

  if (!nome) { mostrarToast('O nome da estante é obrigatório.', 'error'); return; }

  mostrarLoading('A guardar estante...');
  try {
    let res;
    if (id) {
      res = await apiActualizarEstante(id, { nome, descricao: desc, cor, icone, senha });
      if (res.success) {
        const idx = ESTANTES.lista.findIndex(e => e.id === id);
        if (idx !== -1) ESTANTES.lista[idx] = res.data;
      }
    } else {
      res = await apiCriarEstante({ nome, descricao: desc, cor, icone, senha });
      if (res.success) ESTANTES.lista.push(res.data);
    }

    if (res.success) {
      fecharModal('modal-estante');
      renderizarGaleriaEstantes();
      mostrarToast(`Estante "${nome}" guardada!`, 'success');
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

async function confirmarDeletarEstante(id) {
  const est = ESTANTES.lista.find(e => e.id === id);
  if (!est) return;
  if (!confirm(`Eliminar a estante "${est.nome}" e todos os seus itens? Esta acção não pode ser desfeita.`)) return;

  mostrarLoading('A eliminar estante...');
  try {
    const res = await apiEliminarEstante(id);
    if (res.success) {
      ESTANTES.lista = ESTANTES.lista.filter(e => e.id !== id);
      renderizarGaleriaEstantes();
      mostrarToast(`Estante "${est.nome}" eliminada.`, 'info');
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ─── ADICIONAR ITEM ──────────────────────────────────────────
function abrirModalAdicionarItem() {
  if (!ESTANTES.estanteActiva) return;
  ESTANTES.itemParaEditar = null;

  document.getElementById('item-form-id').value        = '';
  document.getElementById('item-form-titulo').value    = '';
  document.getElementById('item-form-conteudo').value  = '';
  document.getElementById('item-form-url').value       = '';
  document.getElementById('item-form-tipo').value      = 'nota';
  _actualizarCamposItemPorTipo('nota');
  document.getElementById('modal-item-title').textContent = 'Adicionar Item';

  abrirModal('modal-item');
}

function abrirModalEditarItem(id) {
  const item = ESTANTES.itens.find(i => i.id === id);
  if (!item) return;
  ESTANTES.itemParaEditar = item;

  document.getElementById('item-form-id').value        = item.id;
  document.getElementById('item-form-titulo').value    = item.titulo    || '';
  document.getElementById('item-form-conteudo').value  = item.conteudo  || '';
  document.getElementById('item-form-url').value       = item.url       || '';
  document.getElementById('item-form-tipo').value      = item.tipo      || 'nota';
  _actualizarCamposItemPorTipo(item.tipo);
  document.getElementById('modal-item-title').textContent = 'Editar Item';

  abrirModal('modal-item');
}

function _actualizarCamposItemPorTipo(tipo) {
  const campoConteudo = document.getElementById('campo-conteudo');
  const campoUrl      = document.getElementById('campo-url');
  const campoFicheiro = document.getElementById('campo-ficheiro');
  const campoLivro    = document.getElementById('campo-livro');

  if (campoConteudo) campoConteudo.style.display = tipo === 'nota'     ? 'block' : 'none';
  if (campoUrl)      campoUrl.style.display      = tipo === 'link'     ? 'block' : 'none';
  if (campoFicheiro) campoFicheiro.style.display = tipo === 'ficheiro' ? 'block' : 'none';
  if (campoLivro)    campoLivro.style.display    = tipo === 'livro'    ? 'block' : 'none';

  // Popular select de livros
  if (tipo === 'livro') {
    const sel = document.getElementById('item-form-livro-sel');
    if (sel) {
      sel.innerHTML = '<option value="">Selecione um livro do acervo...</option>';
      [...APP.livros]
        .sort((a,b) => a.titulo.localeCompare(b.titulo,'pt-BR'))
        .forEach(l => {
          const opt = document.createElement('option');
          opt.value       = l.id;
          opt.textContent = `${l.titulo} — ${l.autor}`;
          sel.appendChild(opt);
        });
    }
  }
}

async function salvarItem() {
  const estanteId = ESTANTES.estanteActiva?.id;
  if (!estanteId) return;

  const id      = document.getElementById('item-form-id').value;
  const tipo    = document.getElementById('item-form-tipo').value;
  const titulo  = document.getElementById('item-form-titulo').value.trim();
  const conteudo= document.getElementById('item-form-conteudo').value.trim();
  const url     = document.getElementById('item-form-url').value.trim();

  if (!titulo) { mostrarToast('O título é obrigatório.', 'error'); return; }

  // Para tipo livro, conteúdo = ID do livro seleccionado
  let finalConteudo = conteudo;
  if (tipo === 'livro') {
    const sel = document.getElementById('item-form-livro-sel');
    finalConteudo = sel ? sel.value : '';
    if (!finalConteudo) { mostrarToast('Selecione um livro.', 'error'); return; }
  }

  // Para tipo ficheiro, trata o upload
  if (tipo === 'ficheiro') {
    const fileInput = document.getElementById('item-form-file');
    if (fileInput?.files[0] && !id) {
      await _uploadItemFicheiro(fileInput.files[0], titulo, estanteId);
      return;
    }
  }

  const itemData = { estanteId, tipo, titulo, conteudo: finalConteudo, url };

  mostrarLoading('A guardar item...');
  try {
    let res;
    if (id) {
      res = await apiActualizarItem(id, itemData);
      if (res.success) {
        const idx = ESTANTES.itens.findIndex(i => i.id === id);
        if (idx !== -1) ESTANTES.itens[idx] = res.data;
      }
    } else {
      res = await apiAdicionarItem(itemData);
      if (res.success) ESTANTES.itens.unshift(res.data);
    }

    if (res.success) {
      fecharModal('modal-item');
      renderizarItens();
      mostrarToast('Item guardado!', 'success');
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

async function _uploadItemFicheiro(file, titulo, estanteId) {
  mostrarLoading(`A enviar "${file.name}"...`);
  try {
    const base64   = await fileToBase64(file);
    const res      = await apiUploadFicheiro(file.name, base64, file.type, estanteId);
    if (!res.success) throw new Error(res.error);

    // Cria o item com a URL do Drive
    const itemData = {
      estanteId, tipo: 'ficheiro',
      titulo:    titulo || file.name,
      conteudo:  '',
      url:       res.url,
      driveFileId: res.fileId
    };
    const resItem = await apiAdicionarItem(itemData);
    if (resItem.success) {
      ESTANTES.itens.unshift(resItem.data);
      fecharModal('modal-item');
      renderizarItens();
      mostrarToast(`"${file.name}" enviado!`, 'success');
    }
  } catch(e) {
    mostrarToast('Erro no upload: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

async function confirmarDeletarItem(id) {
  const item = ESTANTES.itens.find(i => i.id === id);
  if (!item) return;

  mostrarLoading('A eliminar...');
  try {
    const res = await apiEliminarItem(id);
    if (res.success) {
      // Se tinha ficheiro no Drive, apaga também
      if (item.driveFileId) {
        apiDeletarFicheiro(item.driveFileId).catch(() => {});
      }
      ESTANTES.itens = ESTANTES.itens.filter(i => i.id !== id);
      renderizarItens();
      mostrarToast('Item eliminado.', 'info');
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

// ─── UPLOAD DE CAPA DE LIVRO ─────────────────────────────────
// Chamado quando o user faz upload de imagem no formulário de cadastro/edição
async function uploadCapaLivro(inputFileId, targetInputId) {
  const input = document.getElementById(inputFileId);
  const file  = input?.files?.[0];
  if (!file) return;

  // Valida tipo
  if (!file.type.startsWith('image/')) {
    mostrarToast('Apenas imagens são suportadas para capas.', 'error');
    return;
  }

  // Valida tamanho (max 2MB para base64 caber no GAS)
  if (file.size > 2 * 1024 * 1024) {
    mostrarToast('A imagem não deve ultrapassar 2MB.', 'error');
    return;
  }

  mostrarLoading(`A enviar capa "${file.name}"...`);
  try {
    const base64 = await fileToBase64(file);
    const res    = await apiUploadCapa(file.name, base64, file.type);
    if (res.success) {
      const target = document.getElementById(targetInputId);
      if (target) target.value = res.url;
      mostrarToast('Capa enviada!', 'success');
    } else {
      mostrarToast('Erro no upload: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
    if (input) input.value = '';
  }
}

// ─── TOGGLE VISIBILIDADE SENHA ───────────────────────────────
function _toggleSenhaVisivel() {
  const input   = document.getElementById('estante-form-senha');
  const icon    = document.getElementById('senha-eye-icon');
  if (!input) return;
  const isPass  = input.type === 'password';
  input.type    = isPass ? 'text' : 'password';
  if (icon) {
    icon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
    lucide.createIcons({ nodes: [icon.parentElement] });
  }
}
