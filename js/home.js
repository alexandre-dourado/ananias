// ============================================================
// home.js — Home dashboard (v2)
// Prioridade: Estantes recentes > Últimos docs > Livros > Metas
// Frase curiosa (card) + Desafio diário (overlay)
// ============================================================

const HOME = {
  metas:              [],
  fraseCuriosa:       null,
  desafioHoje:        null,
  desafioResposta:    null,
  isGeneratingFrase:  false,
  isGeneratingDesafio:false,
};

const LS_FRASE          = 'biblioa_frase_dia';
const LS_DESAFIO        = 'biblioa_desafio_dia';
const LS_DESAFIO_VISTO  = 'biblioa_desafio_visto';

// ─── INICIALIZAR ────────────────────────────────────────────
async function inicializarHome() {
  renderizarHomeStats();
  renderizarEstantesRecentesHome();   // ← prioridade 1
  renderizarUltimosDocsHome();        // ← prioridade 2
  renderizarUltimosLivrosHome();      // ← prioridade 3
  await carregarMetasHome();
  await inicializarFraseCuriosa();
}

// ─── STATS ──────────────────────────────────────────────────
function renderizarHomeStats() {
  const s = {
    'home-stat-livros':   APP.livros.length,
    'home-stat-estantes': ESTANTES?.lista?.length ?? 0,
    'home-stat-metas':    HOME.metas.filter(m => !m.concluida).length,
  };
  Object.entries(s).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

// ─── ESTANTES RECENTES (destaque principal) ──────────────────
function renderizarEstantesRecentesHome() {
  const container = document.getElementById('home-estantes-destaque');
  if (!container) return;
  container.innerHTML = '';

  const lista = [...(ESTANTES?.lista ?? [])].slice(0, 6);

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="home-empty-hint">
        <i data-lucide="library"></i>
        <span>Ainda sem estantes.
          <a onclick="setTab('estantes')" class="home-link">Criar a primeira →</a>
        </span>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const fragment = document.createDocumentFragment();
  lista.forEach(estante => {
    const card = document.createElement('div');
    card.className = 'home-estante-card';
    card.style.setProperty('--cor', estante.cor || '#1e3a5f');

    // Lombadas decorativas (3 de alturas variadas)
    const spines = [62, 50, 70].map((h, i) => {
      const hues = ['#c8453a','#e8a020','#2d6fa4','#3d9b3d','#7b4fa6'];
      return `<div class="home-spine" style="height:${h}px;background:${hues[(lista.indexOf(estante)+i)%hues.length]};"></div>`;
    }).join('');

    card.innerHTML = `
      <div class="home-estante-shelf">
        <div class="home-estante-shelf-top"></div>
        <div class="home-shelf-spines">${spines}</div>
        <div class="home-estante-shelf-bottom"></div>
      </div>
      <div class="home-estante-card-footer">
        <i data-lucide="${esc(estante.icone||'library')}" class="home-estante-card-icon"></i>
        <div class="home-estante-card-text">
          <span class="home-estante-card-nome">${esc(estante.nome)}</span>
          ${estante.descricao ? `<span class="home-estante-card-desc">${esc(estante.descricao)}</span>` : ''}
        </div>
        ${estante.senha ? '<i data-lucide="lock" style="width:12px;height:12px;color:rgba(255,255,255,0.5);flex-shrink:0;"></i>' : ''}
      </div>
    `;

    card.onclick = () => {
      if (estante.senha) {
        _pedirSenhaEstante(estante);
      } else {
        setTab('estantes');
        setTimeout(() => abrirEstante(estante.id), 300);
      }
    };

    fragment.appendChild(card);
  });

  // Botão "Ver todas"
  if ((ESTANTES?.lista?.length ?? 0) > 6) {
    const mais = document.createElement('div');
    mais.className = 'home-estante-card home-estante-mais';
    mais.onclick   = () => setTab('estantes');
    mais.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:0.4rem;color:var(--gray-400);">
        <i data-lucide="grid-2x2-plus" style="width:24px;height:24px;"></i>
        <span style="font-family:'Inter',sans-serif;font-size:0.7rem;font-weight:600;">Ver todas</span>
      </div>`;
    fragment.appendChild(mais);
  }

  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });
}

// ─── ÚLTIMOS DOCUMENTOS ENVIADOS ────────────────────────────
function renderizarUltimosDocsHome() {
  const container = document.getElementById('home-ultimos-docs');
  if (!container) return;
  container.innerHTML = '';

  // Recolhe itens do tipo ficheiro de todas as estantes em memória
  const todosItens = ESTANTES?.lista
    ?.flatMap(e => (e._itensCache || []))
    ?.filter(i => i.tipo === 'ficheiro')
    ?.sort((a,b) => new Date(b.dataCriacao||0) - new Date(a.dataCriacao||0))
    ?.slice(0, 5) ?? [];

  if (todosItens.length === 0) {
    container.innerHTML = `
      <div class="home-empty-hint">
        <i data-lucide="file-plus"></i>
        <span>Sem documentos ainda. Adicione ficheiros numa estante.</span>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const fragment = document.createDocumentFragment();
  todosItens.forEach(item => {
    const isImg = /\.(jpg|jpeg|png|gif|webp)/i.test(item.titulo);
    const el    = document.createElement('div');
    el.className = 'home-doc-item';
    el.innerHTML = `
      <div class="home-doc-icon">
        <i data-lucide="${isImg ? 'image' : 'file-text'}" style="width:18px;height:18px;"></i>
      </div>
      <div class="home-doc-info">
        <span class="home-doc-nome">${esc(item.titulo)}</span>
        <span class="home-doc-data">${item.dataCriacao ? new Date(item.dataCriacao).toLocaleDateString('pt-BR') : ''}</span>
      </div>
      ${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener" class="home-doc-link" onclick="event.stopPropagation()">
        <i data-lucide="external-link" style="width:13px;height:13px;"></i>
      </a>` : ''}
    `;
    fragment.appendChild(el);
  });
  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });
}

// ─── ÚLTIMOS LIVROS ──────────────────────────────────────────
function renderizarUltimosLivrosHome() {
  const container = document.getElementById('home-ultimos-livros');
  if (!container) return;
  container.innerHTML = '';

  const ultimos = APP.livros.slice(0, 8);
  if (ultimos.length === 0) {
    container.innerHTML = `
      <div class="home-empty-hint">
        <i data-lucide="book-plus"></i>
        <span>Sem livros. <a onclick="setTab('cadastro')" class="home-link">Adicionar →</a></span>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const fragment = document.createDocumentFragment();
  ultimos.forEach(livro => {
    const [c1, c2] = getBookGradient(livro.titulo);
    const card     = document.createElement('div');
    card.className = 'home-book-card';
    card.onclick   = () => APP.abrirDetalhe(livro.id);
    card.innerHTML = `
      <div class="home-book-cover" style="background:linear-gradient(145deg,${c1},${c2});">
        ${livro.capaURL
          ? `<img src="${esc(livro.capaURL)}" alt="${esc(livro.titulo)}" loading="lazy" onerror="this.style.display='none'">`
          : `<i data-lucide="book-open" style="width:22px;height:22px;color:rgba(255,255,255,0.3);"></i>`}
      </div>
      <p class="home-book-title">${esc(livro.titulo)}</p>
      <p class="home-book-author">${esc(livro.autor)}</p>
    `;
    fragment.appendChild(card);
  });
  container.appendChild(fragment);
  lucide.createIcons({ nodes: [container] });
}

// ─── SENHA DE ESTANTE ────────────────────────────────────────
function _pedirSenhaEstante(estante) {
  const overlay = document.getElementById('senha-overlay');
  const input   = document.getElementById('senha-input');
  const erro    = document.getElementById('senha-erro');
  const titulo  = document.getElementById('senha-estante-nome');

  if (!overlay) return;
  if (titulo)  titulo.textContent = estante.nome;
  if (input)   input.value = '';
  if (erro)    erro.style.display = 'none';

  overlay.classList.add('visible');
  setTimeout(() => input?.focus(), 200);

  // Handler de confirmação
  window._senhaConfirmar = () => {
    const val = input?.value || '';
    if (val === estante.senha) {
      overlay.classList.remove('visible');
      setTab('estantes');
      setTimeout(() => abrirEstante(estante.id), 300);
    } else {
      if (erro) { erro.textContent = 'Senha incorrecta.'; erro.style.display = 'block'; }
      input?.select();
    }
  };

  // Enter para confirmar
  if (input) {
    input.onkeydown = e => { if (e.key === 'Enter') window._senhaConfirmar(); };
  }
}

function fecharSenhaOverlay() {
  document.getElementById('senha-overlay')?.classList.remove('visible');
}

// ─── METAS ───────────────────────────────────────────────────
async function carregarMetasHome() {
  try {
    const res = await apiGetMetas();
    if (res.success) {
      HOME.metas = res.data;
      _cacheMetas();
    }
  } catch {
    HOME.metas = JSON.parse(localStorage.getItem('biblioa_metas_cache') || '[]');
  }
  renderizarMetas();
  renderizarHomeStats();
}

function renderizarMetas() {
  const lista   = document.getElementById('metas-lista');
  const countEl = document.getElementById('metas-count');
  if (!lista) return;

  const pendentes  = HOME.metas.filter(m => !m.concluida);
  const concluidas = HOME.metas.filter(m =>  m.concluida);
  if (countEl) countEl.textContent = `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`;

  lista.innerHTML = '';
  if (HOME.metas.length === 0) {
    lista.innerHTML = `<li class="meta-empty"><i data-lucide="check-circle-2"></i><span>Nenhuma meta ainda.</span></li>`;
    lucide.createIcons({ nodes: [lista] });
    return;
  }

  const fragment = document.createDocumentFragment();
  [...pendentes, ...concluidas].forEach(meta => {
    const li = document.createElement('li');
    li.className = `meta-item${meta.concluida ? ' meta-concluida' : ''}`;
    li.innerHTML = `
      <button class="meta-check" onclick="toggleMeta('${meta.id}')">
        <i data-lucide="${meta.concluida ? 'check-circle-2' : 'circle'}"
           style="color:${meta.concluida ? 'var(--green-600)' : 'var(--gray-300)'};width:18px;height:18px;"></i>
      </button>
      <span class="meta-texto">${esc(meta.texto)}</span>
      <button class="btn-icon btn-icon-red meta-del" onclick="deletarMeta('${meta.id}')">
        <i data-lucide="x" style="width:12px;height:12px;"></i>
      </button>
    `;
    fragment.appendChild(li);
  });
  lista.appendChild(fragment);
  lucide.createIcons({ nodes: [lista] });
}

async function adicionarMeta() {
  const input = document.getElementById('meta-input');
  const texto = input?.value.trim();
  if (!texto) { mostrarToast('Escreve a meta primeiro.', 'info'); return; }

  const temp = { id: 'tmp-' + Date.now(), texto, concluida: false, dataCriacao: new Date().toISOString() };
  HOME.metas.unshift(temp);
  renderizarMetas();
  renderizarHomeStats();
  if (input) input.value = '';

  try {
    const res = await apiAdicionarMeta(texto);
    if (res.success) {
      HOME.metas = HOME.metas.map(m => m.id === temp.id ? res.data : m);
      _cacheMetas();
    }
  } catch(e) {
    mostrarToast('Erro ao guardar meta: ' + e.message, 'error');
  }
}

async function toggleMeta(id) {
  const meta = HOME.metas.find(m => m.id === id);
  if (!meta) return;
  meta.concluida = !meta.concluida;
  renderizarMetas();
  renderizarHomeStats();
  _cacheMetas();
  try { await apiToggleMeta(id, meta.concluida); } catch {}
}

async function deletarMeta(id) {
  HOME.metas = HOME.metas.filter(m => m.id !== id);
  renderizarMetas();
  renderizarHomeStats();
  _cacheMetas();
  try { await apiDeletarMeta(id); } catch {}
}

function _cacheMetas() {
  try { localStorage.setItem('biblioa_metas_cache', JSON.stringify(HOME.metas)); } catch {}
}

// ─── FRASE CURIOSA ───────────────────────────────────────────
async function inicializarFraseCuriosa() {
  const cfg = getConfig();
  const card = document.getElementById('home-frase-card');
  if (cfg.fraseDesativada) { if (card) card.style.display = 'none'; return; }
  if (card) card.style.display = '';

  const hoje   = new Date().toDateString();
  const cached = _getFraseCached();
  if (cached?.data === hoje && cached?.frase) {
    renderizarFraseCuriosa(cached.frase, cached.livroTitulo);
    return;
  }

  if (APP.livros.length === 0) {
    renderizarFraseCuriosa('Adicione livros para ver curiosidades literárias aqui.', '');
    return;
  }

  const livro = APP.livros[Math.floor(Math.random() * APP.livros.length)];
  await gerarFraseCuriosa(livro);
}

async function gerarFraseCuriosa(livro) {
  if (HOME.isGeneratingFrase) return;
  HOME.isGeneratingFrase = true;
  const el = document.getElementById('home-frase-texto');
  if (el) el.innerHTML = '<span class="frase-loading">A pensar numa curiosidade...</span>';

  try {
    const res = await apiGerarFrase(livro);
    if (res.success) {
      const dados = { data: new Date().toDateString(), frase: res.frase, livroTitulo: livro.titulo };
      HOME.fraseCuriosa = dados;
      localStorage.setItem(LS_FRASE, JSON.stringify(dados));
      renderizarFraseCuriosa(res.frase, livro.titulo);
    }
  } catch {
    if (el) el.innerHTML = '<span style="color:rgba(255,255,255,0.3);font-style:italic;">Sem conexão para gerar frase.</span>';
  } finally {
    HOME.isGeneratingFrase = false;
  }
}

function renderizarFraseCuriosa(frase, titulo) {
  const el = document.getElementById('home-frase-texto');
  const lt = document.getElementById('home-frase-livro');
  if (el) el.textContent = frase;
  if (lt) lt.textContent = titulo ? `— sobre "${titulo}"` : '';
}

async function refreshFrase() {
  if (APP.livros.length === 0) return;
  localStorage.removeItem(LS_FRASE);
  const livro = APP.livros[Math.floor(Math.random() * APP.livros.length)];
  await gerarFraseCuriosa(livro);
}

function _getFraseCached() {
  try { return JSON.parse(localStorage.getItem(LS_FRASE)); } catch { return null; }
}

// ─── DESAFIO DIÁRIO ──────────────────────────────────────────
async function verificarDesafioDiario() {
  const cfg = getConfig();
  if (cfg.desafioDesativado || APP.livros.length === 0) return;

  const hoje      = new Date().toDateString();
  const vistoHoje = localStorage.getItem(LS_DESAFIO_VISTO) === hoje;
  if (vistoHoje) return;

  const cached = _getDesafioCached();
  if (cached?.data === hoje) {
    HOME.desafioHoje = cached;
    mostrarOverlayDesafio();
    return;
  }

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
        data: new Date().toDateString(),
        pergunta: res.pergunta, opcoes: res.opcoes,
        correta: res.correta,  explicacao: res.explicacao,
        livroId: livro.id, livroTitulo: livro.titulo, livroAutor: livro.autor,
      };
      HOME.desafioHoje = dados;
      localStorage.setItem(LS_DESAFIO, JSON.stringify(dados));
      mostrarOverlayDesafio();
    }
  } catch { /* silencioso */ }
  finally { HOME.isGeneratingDesafio = false; }
}

function mostrarOverlayDesafio() {
  const d = HOME.desafioHoje;
  if (!d) return;
  const overlay = document.getElementById('desafio-overlay');
  if (!overlay) return;

  document.getElementById('desafio-livro-titulo').textContent = d.livroTitulo;
  document.getElementById('desafio-livro-autor').textContent  = d.livroAutor;
  document.getElementById('desafio-pergunta').textContent     = d.pergunta;
  document.getElementById('desafio-explicacao').textContent   = d.explicacao || '';

  const resultEl = document.getElementById('desafio-resultado');
  if (resultEl) { resultEl.textContent = ''; resultEl.className = 'desafio-resultado'; }
  document.getElementById('desafio-explicacao-wrap').style.display = 'none';

  const opcoesEl = document.getElementById('desafio-opcoes');
  opcoesEl.innerHTML = '';
  HOME.desafioResposta = null;

  (d.opcoes || []).forEach((opcao, i) => {
    const btn       = document.createElement('button');
    btn.className   = 'desafio-opcao';
    btn.textContent = opcao;
    btn.onclick     = () => responderDesafio(i);
    opcoesEl.appendChild(btn);
  });

  overlay.classList.add('visible');
}

function responderDesafio(indice) {
  const d = HOME.desafioHoje;
  if (!d || HOME.desafioResposta !== null) return;
  HOME.desafioResposta = indice;

  const opcoes  = document.querySelectorAll('.desafio-opcao');
  const correta = Number(d.correta);
  const acertou = indice === correta;

  opcoes.forEach((btn, i) => {
    if (i === correta)     btn.classList.add('desafio-opcao-correta');
    else if (i === indice) btn.classList.add('desafio-opcao-errada');
    btn.disabled = true;
  });

  const resultEl = document.getElementById('desafio-resultado');
  if (resultEl) {
    resultEl.textContent = acertou ? '✓ Correcto! Muito bem.' : '✗ Não foi desta vez.';
    resultEl.className   = `desafio-resultado ${acertou ? 'correcto' : 'errado'}`;
    resultEl.style.display = 'block';
  }
  document.getElementById('desafio-explicacao-wrap').style.display = 'block';
}

function fecharDesafio() {
  document.getElementById('desafio-overlay')?.classList.remove('visible');
  localStorage.setItem(LS_DESAFIO_VISTO, new Date().toDateString());
}

function _getDesafioCached() {
  try { return JSON.parse(localStorage.getItem(LS_DESAFIO)); } catch { return null; }
}

async function abrirDesafioManual() {
  if (APP.livros.length === 0) { mostrarToast('Adicione livros primeiro.', 'info'); return; }
  localStorage.removeItem(LS_DESAFIO);
  localStorage.removeItem(LS_DESAFIO_VISTO);
  HOME.desafioHoje      = null;
  HOME.desafioResposta  = null;
  const livro = APP.livros[Math.floor(Math.random() * APP.livros.length)];
  mostrarLoading('A gerar desafio...');
  await gerarDesafioDiario(livro);
  ocultarLoading();
}
