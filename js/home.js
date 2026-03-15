// ============================================================
// home.js — Módulo Home (dashboard principal)
// Cards: Estantes, Últimos Livros, Metas, Frase Curiosa
// Desafio Diário como overlay ao abrir o app
// ============================================================

// ─── ESTADO ─────────────────────────────────────────────────
const HOME = {
  metas:          [],
  fraseCuriosa:   null,
  desafioHoje:    null,
  desafioResposta:null,
  isGeneratingFrase:   false,
  isGeneratingDesafio: false,
};

// localStorage keys
const LS_FRASE   = 'biblioa_frase_dia';
const LS_DESAFIO = 'biblioa_desafio_dia';
const LS_DESAFIO_VISTO = 'biblioa_desafio_visto';

// ─── INICIALIZAR HOME ────────────────────────────────────────
async function inicializarHome() {
  renderizarHomeStats();
  renderizarUltimosLivrosHome();
  renderizarEstantesHome();
  await carregarMetasHome();
  await inicializarFraseCuriosa();
}

// ─── STATS RÁPIDAS ──────────────────────────────────────────
function renderizarHomeStats() {
  const totalEl    = document.getElementById('home-stat-livros');
  const estantesEl = document.getElementById('home-stat-estantes');
  const metasEl    = document.getElementById('home-stat-metas');

  if (totalEl)    totalEl.textContent    = APP.livros.length;
  if (estantesEl) estantesEl.textContent = ESTANTES?.lista?.length ?? 0;
  if (metasEl)    metasEl.textContent    = HOME.metas.filter(m => !m.concluida).length;
}

// ─── ÚLTIMOS LIVROS NA HOME ──────────────────────────────────
function renderizarUltimosLivrosHome() {
  const container = document.getElementById('home-ultimos-livros');
  if (!container) return;
  container.innerHTML = '';

  const ultimos = APP.livros.slice(0, 6);

  if (ultimos.length === 0) {
    container.innerHTML = `
      <div class="home-empty-hint">
        <i data-lucide="book-plus"></i>
        <p>Ainda sem livros. <a onclick="setTab('cadastro')" style="cursor:pointer;color:var(--navy-600);text-decoration:underline;">Adicionar primeiro livro →</a></p>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const fragment = document.createDocumentFragment();
  ultimos.forEach(livro => {
    const [c1, c2] = getBookGradient(livro.titulo);
    const card = document.createElement('div');
    card.className = 'home-book-card';
    card.onclick   = () => APP.abrirDetalhe(livro.id);

    card.innerHTML = `
      <div class="home-book-cover" style="background:linear-gradient(145deg,${c1},${c2});">
        ${livro.capaURL
          ? `<img src="${esc(livro.capaURL)}" alt="${esc(livro.titulo)}" loading="lazy"
                  onerror="this.style.display='none'">`
          : `<i data-lucide="book-open" style="width:22px;height:22px;color:rgba(255,255,255,0.3);"></i>`}
      </div>
      <div class="home-book-info">
        <p class="home-book-title">${esc(livro.titulo)}</p>
        <p class="home-book-author">${esc(livro.autor)}</p>
      </div>
    `;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });
}

// ─── ESTANTES NA HOME (mini-preview) ────────────────────────
function renderizarEstantesHome() {
  const container = document.getElementById('home-estantes-preview');
  if (!container) return;
  container.innerHTML = '';

  const lista = ESTANTES?.lista ?? [];

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="home-empty-hint">
        <i data-lucide="library"></i>
        <p>Sem estantes. <a onclick="setTab('estantes')" style="cursor:pointer;color:var(--navy-600);text-decoration:underline;">Criar estante →</a></p>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const fragment = document.createDocumentFragment();
  lista.slice(0, 4).forEach(estante => {
    const pill = document.createElement('div');
    pill.className = 'home-estante-pill';
    pill.style.setProperty('--cor', estante.cor || '#1e3a5f');
    pill.onclick   = () => { setTab('estantes'); setTimeout(() => abrirEstante(estante.id), 300); };
    pill.innerHTML = `
      <i data-lucide="${esc(estante.icone || 'library')}" style="width:14px;height:14px;"></i>
      <span>${esc(estante.nome)}</span>
    `;
    fragment.appendChild(pill);
  });

  if (lista.length > 4) {
    const more = document.createElement('div');
    more.className = 'home-estante-pill home-estante-more';
    more.onclick   = () => setTab('estantes');
    more.innerHTML = `<span>+${lista.length - 4} mais</span>`;
    fragment.appendChild(more);
  }

  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });
}

// ─── METAS (TASK SYSTEM) ─────────────────────────────────────
async function carregarMetasHome() {
  mostrarLoading('A carregar metas...');
  try {
    const res = await apiGetMetas();
    if (res.success) {
      HOME.metas = res.data;
      renderizarMetas();
      renderizarHomeStats();
    }
  } catch(e) {
    // Offline fallback — tenta localStorage
    try {
      HOME.metas = JSON.parse(localStorage.getItem('biblioa_metas_cache') || '[]');
      renderizarMetas();
    } catch(_) {}
  } finally {
    ocultarLoading();
  }
}

function renderizarMetas() {
  const lista    = document.getElementById('metas-lista');
  const countEl  = document.getElementById('metas-count');
  if (!lista) return;

  const pendentes   = HOME.metas.filter(m => !m.concluida);
  const concluidas  = HOME.metas.filter(m => m.concluida);

  if (countEl) countEl.textContent = `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`;

  lista.innerHTML = '';
  const fragment  = document.createDocumentFragment();

  // Pendentes primeiro
  [...pendentes, ...concluidas].forEach(meta => {
    const li = document.createElement('li');
    li.className = `meta-item ${meta.concluida ? 'meta-concluida' : ''}`;
    li.innerHTML = `
      <button class="meta-check" onclick="toggleMeta('${meta.id}')" title="${meta.concluida ? 'Reabrir' : 'Concluir'}">
        <i data-lucide="${meta.concluida ? 'check-circle-2' : 'circle'}"
           style="color:${meta.concluida ? 'var(--green-600)' : 'var(--gray-400)'};width:18px;height:18px;"></i>
      </button>
      <span class="meta-texto">${esc(meta.texto)}</span>
      <button class="btn-icon btn-icon-red meta-del" onclick="deletarMeta('${meta.id}')" title="Remover">
        <i data-lucide="x" style="width:12px;height:12px;color:var(--gray-400);"></i>
      </button>
    `;
    fragment.appendChild(li);
  });

  if (HOME.metas.length === 0) {
    lista.innerHTML = `<li class="meta-empty">
      <i data-lucide="check-circle-2" style="width:20px;height:20px;opacity:0.2;"></i>
      <span>Nenhuma meta. Adicione uma abaixo.</span>
    </li>`;
    lucide.createIcons({ nodes: [lista] });
    return;
  }

  lista.appendChild(fragment);
  lucide.createIcons({ nodes: [lista] });
}

async function adicionarMeta() {
  const input = document.getElementById('meta-input');
  const texto = input?.value.trim();
  if (!texto) { mostrarToast('Escreve a meta primeiro.', 'info'); return; }

  mostrarLoading('A adicionar meta...');
  try {
    const res = await apiAdicionarMeta(texto);
    if (res.success) {
      HOME.metas.unshift(res.data);
      _cacheMetas();
      renderizarMetas();
      renderizarHomeStats();
      if (input) input.value = '';
    } else {
      mostrarToast('Erro: ' + res.error, 'error');
    }
  } catch(e) {
    mostrarToast('Erro: ' + e.message, 'error');
  } finally {
    ocultarLoading();
  }
}

async function toggleMeta(id) {
  const meta = HOME.metas.find(m => m.id === id);
  if (!meta) return;

  const novaConcluida = !meta.concluida;
  // Optimistic UI
  meta.concluida = novaConcluida;
  renderizarMetas();
  renderizarHomeStats();

  try {
    await apiToggleMeta(id, novaConcluida);
    _cacheMetas();
  } catch(e) {
    // Reverte se falhar
    meta.concluida = !novaConcluida;
    renderizarMetas();
    mostrarToast('Erro ao actualizar meta.', 'error');
  }
}

async function deletarMeta(id) {
  HOME.metas = HOME.metas.filter(m => m.id !== id);
  renderizarMetas();
  renderizarHomeStats();
  _cacheMetas();
  try {
    await apiDeletarMeta(id);
  } catch(e) { /* silencioso */ }
}

function _cacheMetas() {
  try {
    localStorage.setItem('biblioa_metas_cache', JSON.stringify(HOME.metas));
  } catch(_) {}
}

// ─── FRASE CURIOSA (IA, 1×/dia) ─────────────────────────────
async function inicializarFraseCuriosa() {
  // Verifica toggle
  const cfg = getConfig();
  if (cfg.fraseDesativada) {
    document.getElementById('home-frase-card')?.style?.setProperty('display','none');
    return;
  }

  // Verifica se já tem frase do dia em cache
  const hoje    = new Date().toDateString();
  const cached  = _getFraseCached();

  if (cached && cached.data === hoje && cached.frase) {
    HOME.fraseCuriosa = cached;
    renderizarFraseCuriosa(cached.frase, cached.livroTitulo);
    return;
  }

  // Gera nova frase se há livros
  if (APP.livros.length === 0) {
    renderizarFraseCuriosa('Adicione livros para ver frases curiosas sobre eles.', '');
    return;
  }

  // Escolhe livro aleatório
  const livro = APP.livros[Math.floor(Math.random() * APP.livros.length)];
  await gerarFraseCuriosa(livro);
}

async function gerarFraseCuriosa(livro) {
  if (HOME.isGeneratingFrase) return;
  HOME.isGeneratingFrase = true;

  const card = document.getElementById('home-frase-card');
  const el   = document.getElementById('home-frase-texto');
  if (el) el.innerHTML = `<span class="frase-loading">A pensar numa curiosidade...</span>`;

  try {
    const res = await apiGerarFrase(livro);
    if (res.success) {
      const dados = {
        data:        new Date().toDateString(),
        frase:       res.frase,
        livroId:     livro.id,
        livroTitulo: livro.titulo
      };
      HOME.fraseCuriosa = dados;
      localStorage.setItem(LS_FRASE, JSON.stringify(dados));
      renderizarFraseCuriosa(res.frase, livro.titulo);
    }
  } catch(e) {
    if (el) el.innerHTML = `<span style="color:var(--gray-400);font-style:italic;">Sem conexão para gerar frase.</span>`;
  } finally {
    HOME.isGeneratingFrase = false;
  }
}

function renderizarFraseCuriosa(frase, livroTitulo) {
  const el      = document.getElementById('home-frase-texto');
  const livroEl = document.getElementById('home-frase-livro');
  if (el)      el.textContent      = frase;
  if (livroEl) livroEl.textContent = livroTitulo ? `— sobre "${livroTitulo}"` : '';
}

function _getFraseCached() {
  try { return JSON.parse(localStorage.getItem(LS_FRASE)); } catch(_) { return null; }
}

async function refreshFrase() {
  if (APP.livros.length === 0) return;
  const livro = APP.livros[Math.floor(Math.random() * APP.livros.length)];
  // Remove cache para forçar nova geração
  localStorage.removeItem(LS_FRASE);
  await gerarFraseCuriosa(livro);
}

// ─── DESAFIO DIÁRIO (overlay ao abrir) ──────────────────────
async function verificarDesafioDiario() {
  const cfg = getConfig();
  if (cfg.desafioDesativado) return;
  if (APP.livros.length === 0) return;

  const hoje        = new Date().toDateString();
  const vistoHoje   = localStorage.getItem(LS_DESAFIO_VISTO) === hoje;
  if (vistoHoje) return;

  // Verifica se já tem desafio do dia em cache
  const cached = _getDesafioCached();
  if (cached && cached.data === hoje) {
    HOME.desafioHoje = cached;
    mostrarOverlayDesafio();
    return;
  }

  // Gera novo desafio
  const livro = APP.livros[Math.floor(Math.random() * APP.livros.length)];
  await gerarDesafioDiario(livro);
}

async function gerarDesafioDiario(livro) {
  if (HOME.isGeneratingDesafio) return;
  HOME.isGeneratingDesafio = true;

  try {
    const res = await apiGerarDesafio(livro);
    if (res.success) {
      const dados = {
        data:        new Date().toDateString(),
        pergunta:    res.pergunta,
        opcoes:      res.opcoes,     // array de 4 strings
        correta:     res.correta,    // índice 0-3
        explicacao:  res.explicacao,
        livroId:     livro.id,
        livroTitulo: livro.titulo,
        livroAutor:  livro.autor,
      };
      HOME.desafioHoje = dados;
      localStorage.setItem(LS_DESAFIO, JSON.stringify(dados));
      mostrarOverlayDesafio();
    }
  } catch(e) { /* silencioso — não bloqueia o app */ }
  finally { HOME.isGeneratingDesafio = false; }
}

function mostrarOverlayDesafio() {
  const d = HOME.desafioHoje;
  if (!d) return;

  const overlay = document.getElementById('desafio-overlay');
  if (!overlay) return;

  document.getElementById('desafio-livro-titulo').textContent  = d.livroTitulo;
  document.getElementById('desafio-livro-autor').textContent   = d.livroAutor;
  document.getElementById('desafio-pergunta').textContent      = d.pergunta;
  document.getElementById('desafio-explicacao').textContent    = d.explicacao || '';
  document.getElementById('desafio-explicacao-wrap').style.display = 'none';

  // Render opções
  const opcoesEl = document.getElementById('desafio-opcoes');
  opcoesEl.innerHTML = '';
  HOME.desafioResposta = null;

  if (d.opcoes && d.opcoes.length) {
    d.opcoes.forEach((opcao, i) => {
      const btn = document.createElement('button');
      btn.className   = 'desafio-opcao';
      btn.textContent = opcao;
      btn.onclick     = () => responderDesafio(i);
      opcoesEl.appendChild(btn);
    });
  }

  overlay.classList.add('visible');
  lucide.createIcons({ nodes: [overlay] });
}

function responderDesafio(indice) {
  const d = HOME.desafioHoje;
  if (!d || HOME.desafioResposta !== null) return;
  HOME.desafioResposta = indice;

  const opcoes   = document.querySelectorAll('.desafio-opcao');
  const correta  = Number(d.correta);
  const acertou  = indice === correta;

  opcoes.forEach((btn, i) => {
    if (i === correta)         btn.classList.add('desafio-opcao-correta');
    else if (i === indice)     btn.classList.add('desafio-opcao-errada');
    btn.disabled = true;
  });

  const resultEl = document.getElementById('desafio-resultado');
  if (resultEl) {
    resultEl.textContent = acertou ? '✓ Correcto! Muito bem.' : '✗ Não foi desta vez.';
    resultEl.className   = `desafio-resultado ${acertou ? 'correcto' : 'errado'}`;
  }

  document.getElementById('desafio-explicacao-wrap').style.display = 'block';
  lucide.createIcons();
}

function fecharDesafio() {
  const overlay = document.getElementById('desafio-overlay');
  if (overlay) overlay.classList.remove('visible');
  localStorage.setItem(LS_DESAFIO_VISTO, new Date().toDateString());
}

function _getDesafioCached() {
  try { return JSON.parse(localStorage.getItem(LS_DESAFIO)); } catch(_) { return null; }
}

// Mostrar desafio manualmente (botão na home)
async function abrirDesafioManual() {
  if (APP.livros.length === 0) {
    mostrarToast('Adicione livros primeiro.', 'info'); return;
  }
  // Ignora o cache — gera novo
  localStorage.removeItem(LS_DESAFIO);
  localStorage.removeItem(LS_DESAFIO_VISTO);
  HOME.desafioHoje = null;
  HOME.desafioResposta = null;
  const livro = APP.livros[Math.floor(Math.random() * APP.livros.length)];
  mostrarLoading('A gerar desafio...');
  await gerarDesafioDiario(livro);
  ocultarLoading();
}
