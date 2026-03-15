// =============================================================================
// BIBLIOTECA DE ANANIAS — Code.gs
// Backend Google Apps Script — serve como API REST para a PWA
//
// CONFIGURAÇÃO (Propriedades do Script):
//   SHEET_ID        → ID da Google Sheet (da URL entre /d/ e /edit)
//   GEMINI_API_KEY  → Chave da API do Google Gemini
//
// DEPLOY:
//   Implementar → Nova implementação → Web App
//   Execute as: Me | Access: Anyone
// =============================================================================

const SHEET_LIVROS     = 'Livros';
const SHEET_CATEGORIAS = 'Categorias';
const SHEET_CONFIG     = 'Config';

const LIVROS_HEADERS = [
  'ID','Título','Autor','Editora','Categoria',
  'Assunto','Ano','Observações','CapaURL','DataCadastro'
];

const DEFAULT_CATEGORIAS = [
  'Clássico','Biografia','História','Religião',
  'Literatura Clássica','Literatura Brasileira','Negócios','Direito',
  'Filosofia','Ciência','Dicionários','Matemática',
  'Economia','Maçonaria','Regionalismo','Autoajuda',
  'Ficção','Não-Ficção','Infantil/Juvenil','Acadêmico'
];

// =============================================================================
// CORS HEADERS (necessário para chamadas da PWA no GitHub Pages)
// =============================================================================
function _corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function _jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// PONTO DE ENTRADA — GET (serve a página, não usado pela PWA)
// =============================================================================
function doGet(e) {
  // Permite chamadas GET simples para teste de saúde
  return _jsonResponse({ status: 'ok', message: 'BiblioA GAS API activa.' });
}

// =============================================================================
// PONTO DE ENTRADA — POST (todas as chamadas da PWA passam aqui)
// =============================================================================
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'getLivros':          return _jsonResponse(getLivros());
      case 'adicionarLivro':     return _jsonResponse(adicionarLivro(body.livro));
      case 'actualizarLivro':    return _jsonResponse(actualizarLivro(body.id, body.dados));
      case 'eliminarLivro':      return _jsonResponse(eliminarLivro(body.id));
      case 'getCategorias':      return _jsonResponse(getCategorias());
      case 'salvarCategorias':   return _jsonResponse(salvarCategorias(body.lista));
      case 'importarCSV':        return _jsonResponse(importarCSV(body.csvContent));
      case 'buscarCapaLivro':    return _jsonResponse(buscarCapaLivro(body.titulo, body.autor));
      case 'gerarRecomendacao':  return _jsonResponse(gerarRecomendacao(body.livros));
      case 'gerarResumoAnanias': return _jsonResponse(gerarResumoAnanias(body.livro));
      default:
        return _jsonResponse({ success: false, error: 'Acção desconhecida: ' + action });
    }
  } catch (err) {
    Logger.log('Erro em doPost: ' + err.toString());
    return _jsonResponse({ success: false, error: err.message });
  }
}

// =============================================================================
// INICIALIZAÇÃO DA SHEET
// =============================================================================
function _getOrCreateSpreadsheet() {
  const props   = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID não configurado nas Propriedades do Script.');
  return SpreadsheetApp.openById(sheetId);
}

function _getOrCreateSheet(ss, name, setupFn) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    setupFn(sheet);
  }
  return sheet;
}

function _getLivrosSheet() {
  const ss = _getOrCreateSpreadsheet();
  return _getOrCreateSheet(ss, SHEET_LIVROS, sheet => {
    sheet.appendRow(LIVROS_HEADERS);
    sheet.getRange(1,1,1,LIVROS_HEADERS.length)
      .setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 240); // ID
    sheet.setColumnWidth(2, 280); // Título
  });
}

function _getCategoriasSheet() {
  const ss = _getOrCreateSpreadsheet();
  return _getOrCreateSheet(ss, SHEET_CATEGORIAS, sheet => {
    sheet.appendRow(['Categoria','Ordem']);
    sheet.getRange(1,1,1,2).setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
    DEFAULT_CATEGORIAS.forEach((c,i) => sheet.appendRow([c, i+1]));
  });
}

// =============================================================================
// UTILITÁRIOS
// =============================================================================
function _rowToObject(row) {
  return {
    id:           String(row[0] || ''),
    titulo:       String(row[1] || ''),
    autor:        String(row[2] || ''),
    editora:      String(row[3] || ''),
    categoria:    String(row[4] || ''),
    assunto:      String(row[5] || ''),
    anoPublicacao:String(row[6] || ''),
    observacoes:  String(row[7] || ''),
    capaURL:      String(row[8] || ''),
    dataCadastro: row[9] ? String(row[9]) : '',
  };
}

function _objectToRow(livro, id, dataCadastro) {
  return [
    id || livro.id || '',
    livro.titulo || '',
    livro.autor || '',
    livro.editora || '',
    livro.categoria || '',
    livro.assunto || '',
    livro.anoPublicacao || '',
    livro.observacoes || '',
    livro.capaURL || '',
    dataCadastro || livro.dataCadastro || new Date().toISOString(),
  ];
}

function _findRowByID(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

// =============================================================================
// LIVROS — CRUD
// =============================================================================
function getLivros() {
  try {
    const sheet = _getLivrosSheet();
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };

    const livros = data.slice(1)
      .filter(r => r[0] !== '' && r[0] !== undefined)
      .map(r => _rowToObject(r));

    livros.sort((a,b) => new Date(b.dataCadastro||0) - new Date(a.dataCadastro||0));
    return { success: true, data: livros };
  } catch(e) {
    Logger.log('getLivros: ' + e);
    return { success: false, error: e.message };
  }
}

function adicionarLivro(livroData) {
  try {
    const sheet        = _getLivrosSheet();
    const id           = Utilities.getUuid();
    const dataCadastro = new Date().toISOString();
    const row          = _objectToRow(livroData, id, dataCadastro);
    sheet.appendRow(row);
    return { success: true, data: _rowToObject(row) };
  } catch(e) {
    Logger.log('adicionarLivro: ' + e);
    return { success: false, error: e.message };
  }
}

function actualizarLivro(id, dados) {
  try {
    const sheet  = _getLivrosSheet();
    const rowNum = _findRowByID(sheet, id);
    if (rowNum === -1) return { success: false, error: 'Livro não encontrado.' };

    const original     = sheet.getRange(rowNum,1,1,LIVROS_HEADERS.length).getValues()[0];
    const dataCadastro = original[9];
    const newRow       = _objectToRow(dados, id, dataCadastro);
    sheet.getRange(rowNum,1,1,LIVROS_HEADERS.length).setValues([newRow]);
    return { success: true, data: _rowToObject(newRow) };
  } catch(e) {
    Logger.log('actualizarLivro: ' + e);
    return { success: false, error: e.message };
  }
}

function eliminarLivro(id) {
  try {
    const sheet  = _getLivrosSheet();
    const rowNum = _findRowByID(sheet, id);
    if (rowNum === -1) return { success: false, error: 'Livro não encontrado.' };
    sheet.deleteRow(rowNum);
    return { success: true };
  } catch(e) {
    Logger.log('eliminarLivro: ' + e);
    return { success: false, error: e.message };
  }
}

// =============================================================================
// CATEGORIAS
// =============================================================================
function getCategorias() {
  try {
    const sheet = _getCategoriasSheet();
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: DEFAULT_CATEGORIAS };

    const cats = data.slice(1)
      .filter(r => r[0] !== '')
      .map(r => ({ nome: String(r[0]), ordem: Number(r[1]) || 0 }))
      .sort((a,b) => a.ordem - b.ordem)
      .map(c => c.nome);

    return { success: true, data: cats };
  } catch(e) {
    return { success: false, error: e.message, data: DEFAULT_CATEGORIAS };
  }
}

function salvarCategorias(lista) {
  try {
    const sheet   = _getCategoriasSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2,1,lastRow-1,2).clearContent();
    if (lista && lista.length > 0) {
      sheet.getRange(2,1,lista.length,2).setValues(lista.map((c,i) => [c, i+1]));
    }
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// =============================================================================
// IMPORTAÇÃO CSV
// =============================================================================
function importarCSV(csvContent) {
  try {
    const lines = csvContent.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
    if (lines.length < 2) return { success: false, error: 'CSV vazio ou sem cabeçalho.' };

    const header     = lines[0];
    const sep        = (header.match(/;/g)||[]).length >= (header.match(/,/g)||[]).length ? ';' : ',';
    const headers    = header.split(sep).map(h => h.replace(/^"|"$/g,'').trim().toLowerCase());
    const find       = keys => headers.findIndex(h => keys.some(k => h.includes(k)));
    const clean      = v  => v ? String(v).replace(/^"|"$/g,'').replace(/""/g,'"').trim() : '';

    const iT = find(['título','titulo','title']);
    const iA = find(['autor','author']);
    const iE = find(['editora','publisher']);
    const iC = find(['categoria','category','genre']);
    const iAn= find(['ano','year','publicação']);
    const iAs= find(['assunto','subject']);
    const iO = find(['observações','observacoes','notes']);
    const iCp= find(['capa','cover','thumb','url']);

    if (iT === -1 || iA === -1) return { success: false, error: `Colunas Título/Autor não encontradas. Sep: '${sep}'` };

    const sheet = _getLivrosSheet();
    let ok = 0, erros = 0;

    lines.slice(1).forEach(line => {
      const vals  = line.split(sep);
      const titulo = clean(vals[iT]);
      const autor  = clean(vals[iA]);
      if (!titulo || !autor) { erros++; return; }

      const anoRaw = iAn !== -1 ? clean(vals[iAn]) : '';
      const livro  = {
        titulo, autor,
        editora:      iE  !== -1 ? clean(vals[iE])  : '',
        categoria:    iC  !== -1 ? clean(vals[iC])  : 'Não-Ficção',
        assunto:      iAs !== -1 ? clean(vals[iAs]) : '',
        anoPublicacao:(anoRaw && !isNaN(Number(anoRaw))) ? parseInt(anoRaw) : '',
        observacoes:  iO  !== -1 ? clean(vals[iO])  : '',
        capaURL:      iCp !== -1 ? clean(vals[iCp]) : '',
      };
      try {
        sheet.appendRow(_objectToRow(livro, Utilities.getUuid(), new Date().toISOString()));
        ok++;
      } catch(re) { erros++; }
    });

    return { success: true, importados: ok, erros, mensagem: `${ok} livro(s) importado(s), ${erros} erro(s).` };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// =============================================================================
// BUSCA DE CAPA (Google Books API)
// =============================================================================
function buscarCapaLivro(titulo, autor) {
  try {
    const q    = encodeURIComponent(`${titulo} ${autor}`);
    const url  = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&fields=items(volumeInfo(imageLinks))`;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return { success: false, capaURL: '' };

    const data  = JSON.parse(resp.getContentText());
    const thumb = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
    if (thumb) {
      return { success: true, capaURL: thumb.replace('http://','https://').replace('zoom=1','zoom=2') };
    }
    return { success: false, capaURL: '' };
  } catch(e) {
    return { success: false, capaURL: '', error: e.message };
  }
}

// =============================================================================
// IA — GEMINI
// =============================================================================
function _callGemini(systemPrompt, userQuery) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    tools:    [{ google_search: {} }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200)
    throw new Error(`Gemini API status ${resp.getResponseCode()}`);

  const result    = JSON.parse(resp.getContentText());
  const candidate = result.candidates?.[0];
  if (!candidate?.content?.parts?.[0]?.text) throw new Error('Resposta vazia da Gemini.');

  const text = candidate.content.parts[0].text;
  let sources = [];
  const gm = candidate.groundingMetadata;
  if (gm?.groundingChunks) {
    sources = gm.groundingChunks.filter(c=>c.web).map(c=>({ uri:c.web.uri, title:c.web.title }));
  } else if (gm?.groundingAttributions) {
    sources = gm.groundingAttributions.map(a=>({ uri:a.web?.uri, title:a.web?.title })).filter(s=>s.uri);
  }

  return { text, sources };
}

function gerarRecomendacao(livrosSelecionados) {
  try {
    const lista = livrosSelecionados.map(b =>
      `- Título: ${b.titulo}, Autor: ${b.autor}, Categoria: ${b.categoria}, Assunto: ${b.assunto||'N/A'}`
    ).join('\n');

    const sys = 'Você é um bibliotecário especialista em literatura. Analise a lista de livros e gere UMA recomendação nova e altamente relevante. Sem introduções. Formate em Markdown: # Título, depois Autor, Resumo e Justificativa.';
    const usr = `Recomende um livro com base nesta lista:\n${lista}`;

    return { success: true, ..._callGemini(sys, usr) };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function gerarResumoAnanias(livro) {
  try {
    const sys = 'Você é A.N.A.N.I.A.S. (Aprendizado Neural para Análise e Integração de Síntese). Gere resumos profundos e estruturados. Use Markdown, títulos em **MAIÚSCULAS NEGRITO**. Use Google Search para contexto real.';
    const usr = `
Gere resumo estruturado para:
- Título: ${livro.titulo}
- Autor: ${livro.autor}
- Categoria/Assunto: ${livro.categoria||'N/A'} / ${livro.assunto||'N/A'}

Estrutura OBRIGATÓRIA:
**CONTEXTUALIZAÇÃO DA OBRA** — Biografia do autor + contexto histórico/académico
**DIRETO AO PONTO** — Resumo em 2-3 frases do núcleo central
**RESUMO** — Tópicos Markdown (bullets *)
**PONTOS PRINCIPAIS** — Principais argumentos do autor
**CONTRAPONTOS** — Críticas, limitações e cuidados ao ler
`;
    return { success: true, ..._callGemini(sys, usr) };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
