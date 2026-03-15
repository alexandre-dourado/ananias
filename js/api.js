// ============================================================
// api.js — Camada de comunicação com o GAS backend
// Todas as chamadas passam por aqui. O GAS é o único ponto
// de acesso ao Google Sheets e à chave Gemini (no servidor).
// ============================================================

// ============================================================
// UTILITÁRIOS
// ============================================================

function getBaseUrl() {
  const url = getGasUrl();
  if (!url) throw new Error('URL do GAS não configurada. Configure na aba Configurações.');
  return url;
}

async function gasRequest(action, payload = {}) {
  const baseUrl = getBaseUrl();
  const body    = JSON.stringify({ action, ...payload });

  try {
    const response = await fetch(baseUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.offline) {
      throw new Error('OFFLINE');
    }

    return data;
  } catch (e) {
    if (e.message === 'OFFLINE' || e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      throw new Error('OFFLINE');
    }
    throw e;
  }
}

// ============================================================
// LIVROS
// ============================================================

async function apiGetLivros() {
  return gasRequest('getLivros');
}

async function apiAdicionarLivro(livro) {
  return gasRequest('adicionarLivro', { livro });
}

async function apiActualizarLivro(id, dados) {
  return gasRequest('actualizarLivro', { id, dados });
}

async function apiEliminarLivro(id) {
  return gasRequest('eliminarLivro', { id });
}

// ============================================================
// CATEGORIAS
// ============================================================

async function apiGetCategorias() {
  return gasRequest('getCategorias');
}

async function apiSalvarCategorias(lista) {
  return gasRequest('salvarCategorias', { lista });
}

// ============================================================
// IMPORTAÇÃO CSV (envia conteúdo para o GAS processar)
// ============================================================

async function apiImportarCSV(csvContent) {
  return gasRequest('importarCSV', { csvContent });
}

// ============================================================
// BUSCA DE CAPA (via GAS → Google Books API)
// ============================================================

async function apiBuscarCapa(titulo, autor) {
  return gasRequest('buscarCapaLivro', { titulo, autor });
}

// ============================================================
// IA — Recomendações e Resumos (via GAS → Gemini)
// A chave Gemini fica segura no servidor GAS.
// ============================================================

async function apiGerarRecomendacao(livrosSelecionados) {
  return gasRequest('gerarRecomendacao', { livros: livrosSelecionados });
}

async function apiGerarResumoAnanias(livro) {
  return gasRequest('gerarResumoAnanias', { livro });
}
