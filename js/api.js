// ============================================================
// api.js — Camada de comunicação com o GAS backend (v3.0)
// Todas as chamadas passam pelo gasRequest() centralizado.
// ============================================================

function getBaseUrl() {
  const url = getGasUrl();
  if (!url) throw new Error('URL do GAS não configurada. Configure na aba Config.');
  return url;
}

async function gasRequest(action, payload = {}) {
  const url  = getBaseUrl();
  const body = JSON.stringify({ action, ...payload });

  try {
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.offline) throw new Error('OFFLINE');
    return data;
  } catch(e) {
    if (
      e.message === 'OFFLINE' ||
      e.message.includes('Failed to fetch') ||
      e.message.includes('NetworkError') ||
      e.message.includes('net::')
    ) throw new Error('OFFLINE');
    throw e;
  }
}

// ── LIVROS ────────────────────────────────────────
async function apiGetLivros()              { return gasRequest('getLivros'); }
async function apiAdicionarLivro(livro)    { return gasRequest('adicionarLivro',  { livro }); }
async function apiActualizarLivro(id, dados){ return gasRequest('actualizarLivro', { id, dados }); }
async function apiEliminarLivro(id)        { return gasRequest('eliminarLivro',   { id }); }

// ── CATEGORIAS ────────────────────────────────────
async function apiGetCategorias()          { return gasRequest('getCategorias'); }
async function apiSalvarCategorias(lista)  { return gasRequest('salvarCategorias', { lista }); }

// ── ESTANTES ──────────────────────────────────────
async function apiGetEstantes()                    { return gasRequest('getEstantes'); }
async function apiCriarEstante(estante)            { return gasRequest('criarEstante',      { estante }); }
async function apiActualizarEstante(id, dados)     { return gasRequest('actualizarEstante', { id, dados }); }
async function apiEliminarEstante(id)              { return gasRequest('eliminarEstante',   { id }); }

// ── ITENS DE ESTANTE ──────────────────────────────
async function apiGetItens(estanteId)              { return gasRequest('getItensEstante', { estanteId }); }
async function apiAdicionarItem(item)              { return gasRequest('adicionarItem',   { item }); }
async function apiActualizarItem(id, dados)        { return gasRequest('actualizarItem',  { id, dados }); }
async function apiEliminarItem(id)                 { return gasRequest('eliminarItem',    { id }); }
async function apiMoverItem(itemId, novaEstanteId) { return gasRequest('moverItem',       { itemId, novaEstanteId }); }

// ── DRIVE ──────────────────────────────────────────
async function apiUploadCapa(nome, base64, mimeType) {
  return gasRequest('uploadCapa', { nome, base64, mimeType });
}
async function apiUploadFicheiro(nome, base64, mimeType, estanteId) {
  return gasRequest('uploadFicheiro', { nome, base64, mimeType, estanteId });
}
async function apiListarDrive(estanteId) {
  return gasRequest('listarDrive', { estanteId });
}
async function apiDeletarFicheiro(fileId) {
  return gasRequest('deletarDriveFicheiro', { fileId });
}

// ── IA ─────────────────────────────────────────────
async function apiGerarRecomendacao(livros) { return gasRequest('gerarRecomendacao',  { livros }); }
async function apiGerarResumoAnanias(livro) { return gasRequest('gerarResumoAnanias', { livro }); }

// ── UTILITÁRIOS ────────────────────────────────────
async function apiBuscarCapa(titulo, autor)   { return gasRequest('buscarCapaLivro', { titulo, autor }); }
async function apiImportarCSV(csvContent)     { return gasRequest('importarCSV',     { csvContent }); }

// ── UPLOAD LOCAL (base64 → GAS) ────────────────────
// Converte File do browser para base64 e envia ao GAS
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => {
      // Remove o prefixo "data:image/jpeg;base64,"
      const base64 = e.target.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── METAS ──────────────────────────────────────────────────
async function apiGetMetas()                   { return gasRequest('getMetas'); }
async function apiAdicionarMeta(texto)         { return gasRequest('adicionarMeta',  { texto }); }
async function apiToggleMeta(id, concluida)    { return gasRequest('toggleMeta',     { id, concluida }); }
async function apiDeletarMeta(id)              { return gasRequest('deletarMeta',    { id }); }

// ── IA: FRASE CURIOSA + DESAFIO ────────────────────────────
async function apiGerarFrase(livro)   { return gasRequest('gerarFrase',   { livro }); }
async function apiGerarDesafio(livro) { return gasRequest('gerarDesafio', { livro }); }
