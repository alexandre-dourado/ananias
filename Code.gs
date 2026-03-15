// =============================================================================
// BIBLIOTECA DE ANANIAS — Code.gs (v3.0)
// API REST centralizada com CacheService, Google Drive e Gemini
//
// PROPRIEDADES DO SCRIPT (Ficheiro > Propriedades do projecto):
//   SHEET_ID         → ID da Google Sheet principal
//   GEMINI_API_KEY   → Chave da API Gemini
//   DRIVE_FOLDER_ID  → ID da pasta "BIBLIOAnanias" no Drive
//                      (ex: 1-ODTFfYrOxy5YVpx12aNdIPoYVRz-CqJ)
//
// DEPLOY: Implementar > Web App > Execute as: Me | Access: Anyone
// =============================================================================

// ─────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────
const SHEET_LIVROS      = 'Livros';
const SHEET_CATEGORIAS  = 'Categorias';
const SHEET_ESTANTES    = 'Estantes';
const SHEET_ITENS       = 'EstantesItens';

const CACHE_TTL         = 300;   // segundos
const CACHE_KEY_LIVROS  = 'cache_livros';
const CACHE_KEY_CATS    = 'cache_categorias';
const CACHE_KEY_ESTANTES= 'cache_estantes';
const CACHE_KEY_ITENS   = 'cache_itens';

const LIVROS_HEADERS = [
  'ID','Título','Autor','Editora','Categoria',
  'Assunto','Ano','Observações','CapaURL','DataCadastro'
];
const ESTANTES_HEADERS = [
  'ID','Nome','Descricao','Cor','Icone','Senha','DataCriacao'
];
const ITENS_HEADERS = [
  'ID','EstanteID','Tipo','Titulo','Conteudo',
  'URL','DriveFileID','DataCriacao'
];
const SHEET_METAS       = 'Metas';
const CACHE_KEY_METAS   = 'cache_metas';
const METAS_HEADERS     = ['ID','Texto','Concluida','DataCriacao','DataConclusao'];

const DEFAULT_CATEGORIAS = [
  'Clássico','Biografia','História','Religião',
  'Literatura Clássica','Literatura Brasileira','Negócios','Direito',
  'Filosofia','Ciência','Dicionários','Matemática',
  'Economia','Maçonaria','Regionalismo','Autoajuda',
  'Ficção','Não-Ficção','Infantil/Juvenil','Acadêmico'
];

// ─────────────────────────────────────────────
//  ROUTER — doGet / doPost
// ─────────────────────────────────────────────
function doGet() {
  return _json({ status: 'ok', version: '3.0', ts: new Date().toISOString() });
}

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = String(body.action || '');
    const result = _route(action, body);
    return _json(result);
  } catch(err) {
    Logger.log('[doPost] ' + err.stack);
    return _json({ success: false, error: err.message });
  }
}

function _route(action, body) {
  const routes = {
    // Livros
    'getLivros':           () => svcGetLivros(),
    'adicionarLivro':      () => svcAdicionarLivro(body.livro),
    'actualizarLivro':     () => svcActualizarLivro(body.id, body.dados),
    'eliminarLivro':       () => svcEliminarLivro(body.id),
    // Categorias
    'getCategorias':       () => svcGetCategorias(),
    'salvarCategorias':    () => svcSalvarCategorias(body.lista),
    // Estantes
    'getEstantes':         () => svcGetEstantes(),
    'criarEstante':        () => svcCriarEstante(body.estante),
    'actualizarEstante':   () => svcActualizarEstante(body.id, body.dados),
    'eliminarEstante':     () => svcEliminarEstante(body.id),
    // Itens de Estante
    'getItensEstante':     () => svcGetItens(body.estanteId),
    'adicionarItem':       () => svcAdicionarItem(body.item),
    'actualizarItem':      () => svcActualizarItem(body.id, body.dados),
    'eliminarItem':        () => svcEliminarItem(body.id),
    'moverItem':           () => svcMoverItem(body.itemId, body.novaEstanteId),
    // Drive
    'uploadCapa':          () => svcUploadCapa(body.nome, body.base64, body.mimeType),
    'uploadFicheiro':      () => svcUploadFicheiro(body.nome, body.base64, body.mimeType, body.estanteId),
    'listarDrive':         () => svcListarDrive(body.estanteId),
    'deletarDriveFicheiro':() => svcDeletarFicheiro(body.fileId),
    // Utilitários
    'importarCSV':         () => svcImportarCSV(body.csvContent),
    'buscarCapaLivro':     () => svcBuscarCapa(body.titulo, body.autor),
    // Metas
    'getMetas':            () => svcGetMetas(),
    'adicionarMeta':       () => svcAdicionarMeta(body.texto),
    'toggleMeta':          () => svcToggleMeta(body.id, body.concluida),
    'deletarMeta':         () => svcDeletarMeta(body.id),
    // IA
    'gerarRecomendacao':   () => svcGerarRecomendacao(body.livros),
    'gerarResumoAnanias':  () => svcGerarResumo(body.livro),
    'gerarFrase':          () => svcGerarFrase(body.livro),
    'gerarDesafio':        () => svcGerarDesafio(body.livro),
  };

  const handler = routes[action];
  if (!handler) return { success: false, error: `Acção desconhecida: ${action}` };
  return handler();
}

// ─────────────────────────────────────────────
//  UTILITÁRIO: RESPOSTA JSON
// ─────────────────────────────────────────────
function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
//  CAMADA DE CACHE (CacheService)
// ─────────────────────────────────────────────
function cacheGet(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function cacheSet(key, data, ttl) {
  try {
    const str = JSON.stringify(data);
    // CacheService tem limite de 100KB por entrada
    if (str.length < 95000) {
      CacheService.getScriptCache().put(key, str, ttl || CACHE_TTL);
    }
  } catch(e) { Logger.log('[cache] set error: ' + e); }
}

function cacheInvalidate(...keys) {
  try {
    CacheService.getScriptCache().removeAll(keys.length ? keys : [
      CACHE_KEY_LIVROS, CACHE_KEY_CATS, CACHE_KEY_ESTANTES, CACHE_KEY_ITENS
    ]);
  } catch(e) {}
}

// ─────────────────────────────────────────────
//  CAMADA DE ACESSO A DADOS (Sheets)
// ─────────────────────────────────────────────
function _ss() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID não configurado.');
  return SpreadsheetApp.openById(id);
}

function _sheet(name, headers, extraSetup) {
  const ss = _ss();
  let sh   = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length)
      .setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
    sh.setFrozenRows(1);
    if (extraSetup) extraSetup(sh);
  }
  return sh;
}

function _shLivros()    { return _sheet(SHEET_LIVROS,    LIVROS_HEADERS); }
function _shCats()      { return _sheet(SHEET_CATEGORIAS,['Categoria','Ordem']); }
function _shEstantes()  { return _sheet(SHEET_ESTANTES,  ESTANTES_HEADERS); }
function _shItens()     { return _sheet(SHEET_ITENS,     ITENS_HEADERS); }
function _shMetas()     { return _sheet(SHEET_METAS,     METAS_HEADERS); }

// Leitura em lote — retorna array de objectos, excluindo cabeçalho e linhas vazias
function _readAll(sheet, toObj) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .filter(r => r[0] !== '' && r[0] !== undefined && r[0] !== null)
    .map(toObj);
}

// Índice em memória por ID para busca O(1)
function _indexById(rows) {
  const map = {};
  rows.forEach((r, i) => { map[r.id] = i; });
  return map;
}

// Encontra linha (1-indexed, com header) por ID sem varrer — usa getValues() uma só vez
function _findRow(sheet, id) {
  const vals = sheet.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

// ─────────────────────────────────────────────
//  CONVERSORES DE LINHA
// ─────────────────────────────────────────────
function _livroFromRow(r) {
  return {
    id: String(r[0]||''), titulo: String(r[1]||''), autor: String(r[2]||''),
    editora: String(r[3]||''), categoria: String(r[4]||''),
    assunto: String(r[5]||''), anoPublicacao: String(r[6]||''),
    observacoes: String(r[7]||''), capaURL: String(r[8]||''),
    dataCadastro: r[9] ? String(r[9]) : ''
  };
}

function _livroToRow(l, id, dt) {
  return [
    id||l.id||'', l.titulo||'', l.autor||'', l.editora||'',
    l.categoria||'', l.assunto||'', l.anoPublicacao||'',
    l.observacoes||'', l.capaURL||'', dt||l.dataCadastro||new Date().toISOString()
  ];
}

function _estanteFromRow(r) {
  return {
    id: String(r[0]||''), nome: String(r[1]||''), descricao: String(r[2]||''),
    cor: String(r[3]||'#1e3a5f'), icone: String(r[4]||'library'),
    senha: String(r[5]||''),
    dataCriacao: r[6] ? String(r[6]) : ''
  };
}

function _estanteToRow(e, id, dt) {
  return [id||e.id||'', e.nome||'', e.descricao||'',
          e.cor||'#1e3a5f', e.icone||'library',
          e.senha||'',
          dt||new Date().toISOString()];
}

function _metaFromRow(r) {
  return {
    id:             String(r[0]||''),
    texto:          String(r[1]||''),
    concluida:      r[2] === true || r[2] === 'TRUE' || r[2] === true,
    dataCriacao:    r[3] ? String(r[3]) : '',
    dataConclusao:  r[4] ? String(r[4]) : '',
  };
}

function _metaToRow(meta, id, dt) {
  return [
    id||meta.id||'',
    meta.texto||'',
    meta.concluida ? true : false,
    dt||meta.dataCriacao||new Date().toISOString(),
    meta.dataConclusao||''
  ];
}

function _itemFromRow(r) {
  return {
    id: String(r[0]||''), estanteId: String(r[1]||''), tipo: String(r[2]||''),
    titulo: String(r[3]||''), conteudo: String(r[4]||''),
    url: String(r[5]||''), driveFileId: String(r[6]||''),
    dataCriacao: r[7] ? String(r[7]) : ''
  };
}

function _itemToRow(item, id, dt) {
  return [
    id||item.id||'', item.estanteId||'', item.tipo||'nota',
    item.titulo||'', item.conteudo||'', item.url||'',
    item.driveFileId||'', dt||new Date().toISOString()
  ];
}

// ─────────────────────────────────────────────
//  SERVIÇOS — LIVROS
// ─────────────────────────────────────────────
function svcGetLivros() {
  const cached = cacheGet(CACHE_KEY_LIVROS);
  if (cached) return { success: true, data: cached, fromCache: true };

  const livros = _readAll(_shLivros(), _livroFromRow);
  livros.sort((a,b) => new Date(b.dataCadastro||0) - new Date(a.dataCadastro||0));
  cacheSet(CACHE_KEY_LIVROS, livros);
  return { success: true, data: livros };
}

function svcAdicionarLivro(livro) {
  if (!livro?.titulo || !livro?.autor) {
    return { success: false, error: 'Título e Autor são obrigatórios.' };
  }
  const id  = Utilities.getUuid();
  const dt  = new Date().toISOString();
  const row = _livroToRow(livro, id, dt);
  _shLivros().appendRow(row);
  cacheInvalidate(CACHE_KEY_LIVROS);
  return { success: true, data: _livroFromRow(row) };
}

function svcActualizarLivro(id, dados) {
  const sh  = _shLivros();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Livro não encontrado.' };
  const orig = sh.getRange(row, 1, 1, LIVROS_HEADERS.length).getValues()[0];
  const newRow = _livroToRow(dados, id, orig[9]);
  sh.getRange(row, 1, 1, LIVROS_HEADERS.length).setValues([newRow]);
  cacheInvalidate(CACHE_KEY_LIVROS);
  return { success: true, data: _livroFromRow(newRow) };
}

function svcEliminarLivro(id) {
  const sh  = _shLivros();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Livro não encontrado.' };
  sh.deleteRow(row);
  cacheInvalidate(CACHE_KEY_LIVROS);
  return { success: true };
}

// ─────────────────────────────────────────────
//  SERVIÇOS — CATEGORIAS
// ─────────────────────────────────────────────
function svcGetCategorias() {
  const cached = cacheGet(CACHE_KEY_CATS);
  if (cached) return { success: true, data: cached, fromCache: true };

  const sh   = _shCats();
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) {
    cacheSet(CACHE_KEY_CATS, DEFAULT_CATEGORIAS);
    return { success: true, data: DEFAULT_CATEGORIAS };
  }
  const cats = data.slice(1)
    .filter(r => r[0] !== '')
    .map(r => ({ nome: String(r[0]), ordem: Number(r[1])||0 }))
    .sort((a,b) => a.ordem - b.ordem)
    .map(c => c.nome);
  cacheSet(CACHE_KEY_CATS, cats);
  return { success: true, data: cats };
}

function svcSalvarCategorias(lista) {
  const sh  = _shCats();
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last-1, 2).clearContent();
  if (lista?.length) {
    sh.getRange(2, 1, lista.length, 2).setValues(lista.map((c,i) => [c, i+1]));
  }
  cacheInvalidate(CACHE_KEY_CATS);
  return { success: true };
}

// ─────────────────────────────────────────────
//  SERVIÇOS — ESTANTES
// ─────────────────────────────────────────────
function svcGetEstantes() {
  const cached = cacheGet(CACHE_KEY_ESTANTES);
  if (cached) return { success: true, data: cached, fromCache: true };

  const estantes = _readAll(_shEstantes(), _estanteFromRow);
  estantes.sort((a,b) => new Date(a.dataCriacao||0) - new Date(b.dataCriacao||0));
  // Marca estantes protegidas SEM enviar a senha para o cliente
  const safe = estantes.map(e => ({ ...e, senha: e.senha ? '***' : '' }));
  cacheSet(CACHE_KEY_ESTANTES, safe);
  return { success: true, data: safe };
}

function svcCriarEstante(estante) {
  if (!estante?.nome) return { success: false, error: 'Nome da estante é obrigatório.' };

  const id  = Utilities.getUuid();
  const dt  = new Date().toISOString();
  const row = _estanteToRow(estante, id, dt);
  _shEstantes().appendRow(row);

  // Cria sub-pasta no Drive para esta estante
  let driveFolderId = '';
  try {
    const props   = PropertiesService.getScriptProperties();
    const rootId  = props.getProperty('DRIVE_FOLDER_ID');
    if (rootId) {
      const root    = DriveApp.getFolderById(rootId);
      const subFolder = root.createFolder(estante.nome);
      driveFolderId = subFolder.getId();
    }
  } catch(e) {
    Logger.log('[Drive] Erro ao criar subpasta: ' + e);
  }

  cacheInvalidate(CACHE_KEY_ESTANTES);
  return { success: true, data: { ..._estanteFromRow(row), driveFolderId } };
}

function svcActualizarEstante(id, dados) {
  const sh  = _shEstantes();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Estante não encontrada.' };
  const orig = sh.getRange(row, 1, 1, ESTANTES_HEADERS.length).getValues()[0];
  // Se a nova senha vier vazia E a original não for vazia, preserva a original
  if (!dados.senha && orig[5]) dados.senha = orig[5];
  const newRow = _estanteToRow(dados, id, orig[6]);
  sh.getRange(row, 1, 1, ESTANTES_HEADERS.length).setValues([newRow]);
  cacheInvalidate(CACHE_KEY_ESTANTES);
  const safe = _estanteFromRow(newRow);
  safe.senha = safe.senha ? '***' : '';
  return { success: true, data: safe };
}

function svcEliminarEstante(id) {
  const sh  = _shEstantes();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Estante não encontrada.' };
  sh.deleteRow(row);
  // Remove também todos os itens desta estante
  const shI  = _shItens();
  const data = shI.getDataRange().getValues();
  const toDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(id)) toDelete.push(i + 1);
  }
  toDelete.forEach(r => shI.deleteRow(r));
  cacheInvalidate(CACHE_KEY_ESTANTES, CACHE_KEY_ITENS);
  return { success: true };
}

// ─────────────────────────────────────────────
//  SERVIÇOS — ITENS DE ESTANTE
// ─────────────────────────────────────────────
function svcGetItens(estanteId) {
  const cacheKey = CACHE_KEY_ITENS + '_' + estanteId;
  const cached   = cacheGet(cacheKey);
  if (cached) return { success: true, data: cached, fromCache: true };

  const todos = _readAll(_shItens(), _itemFromRow);
  const itens = estanteId
    ? todos.filter(i => i.estanteId === String(estanteId))
    : todos;
  itens.sort((a,b) => new Date(b.dataCriacao||0) - new Date(a.dataCriacao||0));
  cacheSet(cacheKey, itens);
  return { success: true, data: itens };
}

function svcAdicionarItem(item) {
  if (!item?.estanteId) return { success: false, error: 'EstanteID é obrigatório.' };
  if (!item?.titulo)    return { success: false, error: 'Título é obrigatório.' };

  const id  = Utilities.getUuid();
  const dt  = new Date().toISOString();
  const row = _itemToRow(item, id, dt);
  _shItens().appendRow(row);
  cacheInvalidate(CACHE_KEY_ITENS + '_' + item.estanteId, CACHE_KEY_ITENS);
  return { success: true, data: _itemFromRow(row) };
}

function svcActualizarItem(id, dados) {
  const sh  = _shItens();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Item não encontrado.' };
  const orig   = sh.getRange(row, 1, 1, ITENS_HEADERS.length).getValues()[0];
  const newRow = _itemToRow(dados, id, orig[7]);
  sh.getRange(row, 1, 1, ITENS_HEADERS.length).setValues([newRow]);
  cacheInvalidate(CACHE_KEY_ITENS + '_' + dados.estanteId, CACHE_KEY_ITENS);
  return { success: true, data: _itemFromRow(newRow) };
}

function svcEliminarItem(id) {
  const sh  = _shItens();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Item não encontrado.' };
  const estanteId = sh.getRange(row, 2).getValue();
  sh.deleteRow(row);
  cacheInvalidate(CACHE_KEY_ITENS + '_' + estanteId, CACHE_KEY_ITENS);
  return { success: true };
}

function svcMoverItem(itemId, novaEstanteId) {
  const sh  = _shItens();
  const row = _findRow(sh, itemId);
  if (row === -1) return { success: false, error: 'Item não encontrado.' };
  const oldEstanteId = sh.getRange(row, 2).getValue();
  sh.getRange(row, 2).setValue(novaEstanteId);
  cacheInvalidate(
    CACHE_KEY_ITENS + '_' + oldEstanteId,
    CACHE_KEY_ITENS + '_' + novaEstanteId,
    CACHE_KEY_ITENS
  );
  return { success: true };
}

// ─────────────────────────────────────────────
//  SERVIÇOS — GOOGLE DRIVE
// ─────────────────────────────────────────────
function _getDriveFolder(estanteId) {
  const props    = PropertiesService.getScriptProperties();
  const rootId   = props.getProperty('DRIVE_FOLDER_ID');
  if (!rootId) throw new Error('DRIVE_FOLDER_ID não configurado.');

  const root = DriveApp.getFolderById(rootId);

  if (!estanteId) return root;

  // Tenta encontrar sub-pasta com o nome da estante
  // Estratégia: pasta com nome = ID da estante (para unicidade)
  const subs = root.getFoldersByName(estanteId);
  if (subs.hasNext()) return subs.next();

  // Fallback: cria
  return root.createFolder(estanteId);
}

function svcUploadCapa(nome, base64, mimeType) {
  try {
    const props  = PropertiesService.getScriptProperties();
    const rootId = props.getProperty('DRIVE_FOLDER_ID');
    if (!rootId) return { success: false, error: 'DRIVE_FOLDER_ID não configurado.' };

    const folder  = DriveApp.getFolderById(rootId);
    const capasIt = folder.getFoldersByName('_capas');
    const capas   = capasIt.hasNext() ? capasIt.next() : folder.createFolder('_capas');

    const bytes   = Utilities.base64Decode(base64);
    const blob    = Utilities.newBlob(bytes, mimeType || 'image/jpeg', nome);
    const file    = capas.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // URL directa para imagem via Google Drive
    const fileId  = file.getId();
    const url     = `https://lh3.googleusercontent.com/d/${fileId}`;

    return { success: true, fileId, url, nome: file.getName() };
  } catch(e) {
    Logger.log('[uploadCapa] ' + e);
    return { success: false, error: e.message };
  }
}

function svcUploadFicheiro(nome, base64, mimeType, estanteId) {
  try {
    const folder = _getDriveFolder(estanteId);
    const bytes  = Utilities.base64Decode(base64);
    const blob   = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', nome);
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success:   true,
      fileId:    file.getId(),
      nome:      file.getName(),
      mimeType:  file.getMimeType(),
      tamanho:   file.getSize(),
      url:       file.getUrl(),
      previewUrl:`https://drive.google.com/file/d/${file.getId()}/preview`
    };
  } catch(e) {
    Logger.log('[uploadFicheiro] ' + e);
    return { success: false, error: e.message };
  }
}

function svcListarDrive(estanteId) {
  try {
    const folder = _getDriveFolder(estanteId);
    const files  = [];
    const it     = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      files.push({
        fileId:    f.getId(),
        nome:      f.getName(),
        mimeType:  f.getMimeType(),
        tamanho:   f.getSize(),
        url:       f.getUrl(),
        previewUrl:`https://drive.google.com/file/d/${f.getId()}/preview`,
        dataCriacao: f.getDateCreated().toISOString()
      });
    }
    files.sort((a,b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
    return { success: true, data: files };
  } catch(e) {
    Logger.log('[listarDrive] ' + e);
    return { success: false, error: e.message, data: [] };
  }
}

function svcDeletarFicheiro(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────
//  SERVIÇOS — UTILITÁRIOS
// ─────────────────────────────────────────────
function svcBuscarCapa(titulo, autor) {
  try {
    const q    = encodeURIComponent(`${titulo} ${autor||''}`);
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

function svcImportarCSV(csvContent) {
  try {
    const lines = csvContent.split(/\r\n|\n|\r/).filter(l => l.trim());
    if (lines.length < 2) return { success: false, error: 'CSV vazio.' };

    const header = lines[0];
    const sep    = (header.match(/;/g)||[]).length >= (header.match(/,/g)||[]).length ? ';' : ',';
    const hdrs   = header.split(sep).map(h => h.replace(/^"|"$/g,'').trim().toLowerCase());
    const find   = keys => hdrs.findIndex(h => keys.some(k => h.includes(k)));
    const clean  = v => v ? String(v).replace(/^"|"$/g,'').replace(/""/g,'"').trim() : '';

    const iT  = find(['título','titulo','title']);
    const iA  = find(['autor','author']);
    if (iT===-1||iA===-1) return { success: false, error: 'Colunas Título/Autor não encontradas.' };

    const iE  = find(['editora','publisher']);
    const iC  = find(['categoria','category']);
    const iAn = find(['ano','year']);
    const iAs = find(['assunto','subject']);
    const iO  = find(['observações','observacoes','notes']);
    const iCp = find(['capa','cover','thumb']);

    const sh = _shLivros();
    let ok = 0, erros = 0;

    lines.slice(1).forEach(line => {
      const vals = line.split(sep);
      const titulo = clean(vals[iT]), autor = clean(vals[iA]);
      if (!titulo||!autor) { erros++; return; }
      const anoRaw = iAn!==-1 ? clean(vals[iAn]) : '';
      try {
        sh.appendRow(_livroToRow({
          titulo, autor,
          editora:      iE  !==-1 ? clean(vals[iE])  : '',
          categoria:    iC  !==-1 ? clean(vals[iC])  : 'Não-Ficção',
          assunto:      iAs !==-1 ? clean(vals[iAs]) : '',
          anoPublicacao:(anoRaw&&!isNaN(+anoRaw)) ? parseInt(anoRaw) : '',
          observacoes:  iO  !==-1 ? clean(vals[iO])  : '',
          capaURL:      iCp !==-1 ? clean(vals[iCp]) : '',
        }, Utilities.getUuid(), new Date().toISOString()));
        ok++;
      } catch(re) { erros++; }
    });

    cacheInvalidate(CACHE_KEY_LIVROS);
    return { success: true, importados: ok, erros, mensagem: `${ok} livro(s) importado(s), ${erros} erro(s).` };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────
//  SERVIÇOS — IA (GEMINI)
// ─────────────────────────────────────────────
function _gemini(systemPrompt, userQuery) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY não configurada.');

  const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: userQuery }] }],
      tools:    [{ google_search: {} }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    }),
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200)
    throw new Error(`Gemini HTTP ${resp.getResponseCode()}`);

  const result = JSON.parse(resp.getContentText());
  const cand   = result.candidates?.[0];
  if (!cand?.content?.parts?.[0]?.text) throw new Error('Resposta vazia da Gemini.');

  const text    = cand.content.parts[0].text;
  const gm      = cand.groundingMetadata;
  let   sources = [];
  if (gm?.groundingChunks) {
    sources = gm.groundingChunks.filter(c=>c.web).map(c=>({uri:c.web.uri,title:c.web.title}));
  } else if (gm?.groundingAttributions) {
    sources = gm.groundingAttributions.map(a=>({uri:a.web?.uri,title:a.web?.title})).filter(s=>s.uri);
  }
  return { text, sources };
}

function svcGerarRecomendacao(livros) {
  try {
    const lista = livros.map(b =>
      `- Título: ${b.titulo}, Autor: ${b.autor}, Categoria: ${b.categoria}, Assunto: ${b.assunto||'N/A'}`
    ).join('\n');
    const sys = 'Você é um bibliotecário especialista. Gere UMA recomendação nova e altamente relevante. Sem introduções. Formate em Markdown: # Título, Autor, Resumo breve, Justificativa.';
    return { success: true, ..._gemini(sys, `Recomende um livro com base nesta lista:\n${lista}`) };
  } catch(e) { return { success: false, error: e.message }; }
}

function svcGerarResumo(livro) {
  try {
    const sys = 'Você é A.N.A.N.I.A.S. Gere resumos profundos. Use Markdown, títulos em **MAIÚSCULAS NEGRITO**. Use Google Search.';
    const usr = `Gere resumo para: Título: ${livro.titulo}, Autor: ${livro.autor}, Categoria: ${livro.categoria||'N/A'}, Assunto: ${livro.assunto||'N/A'}\n\nEstrutura OBRIGATÓRIA:\n**CONTEXTUALIZAÇÃO DA OBRA**\n**DIRETO AO PONTO**\n**RESUMO** (bullets *)\n**PONTOS PRINCIPAIS**\n**CONTRAPONTOS**`;
    return { success: true, ..._gemini(sys, usr) };
  } catch(e) { return { success: false, error: e.message }; }
}

// ─────────────────────────────────────────────
//  SERVIÇOS — METAS
// ─────────────────────────────────────────────
function svcGetMetas() {
  const cached = cacheGet(CACHE_KEY_METAS);
  if (cached) return { success: true, data: cached, fromCache: true };

  const metas = _readAll(_shMetas(), _metaFromRow);
  metas.sort((a,b) => {
    // Pendentes primeiro, depois por data decrescente
    if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
    return new Date(b.dataCriacao||0) - new Date(a.dataCriacao||0);
  });
  cacheSet(CACHE_KEY_METAS, metas);
  return { success: true, data: metas };
}

function svcAdicionarMeta(texto) {
  if (!texto?.trim()) return { success: false, error: 'Texto da meta é obrigatório.' };
  const id  = Utilities.getUuid();
  const dt  = new Date().toISOString();
  const row = _metaToRow({ texto: texto.trim(), concluida: false }, id, dt);
  _shMetas().appendRow(row);
  cacheInvalidate(CACHE_KEY_METAS);
  return { success: true, data: _metaFromRow(row) };
}

function svcToggleMeta(id, concluida) {
  const sh  = _shMetas();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Meta não encontrada.' };

  const orig = sh.getRange(row, 1, 1, METAS_HEADERS.length).getValues()[0];
  sh.getRange(row, 3).setValue(concluida ? true : false);
  sh.getRange(row, 5).setValue(concluida ? new Date().toISOString() : '');
  cacheInvalidate(CACHE_KEY_METAS);
  return { success: true };
}

function svcDeletarMeta(id) {
  const sh  = _shMetas();
  const row = _findRow(sh, id);
  if (row === -1) return { success: false, error: 'Meta não encontrada.' };
  sh.deleteRow(row);
  cacheInvalidate(CACHE_KEY_METAS);
  return { success: true };
}

// ─────────────────────────────────────────────
//  SERVIÇOS — IA: FRASE CURIOSA
// ─────────────────────────────────────────────
function svcGerarFrase(livro) {
  try {
    const sys = 'Você é um crítico literário e contador de histórias. Gere UMA única frase curiosa, intrigante ou surpreendente sobre o livro indicado. A frase deve ser concisa (máximo 2 linhas), instigante, e fazer o leitor querer saber mais. Responda APENAS com a frase, sem introduções, sem aspas, sem o nome do livro no início.';
    const usr = `Livro: "${livro.titulo}" de ${livro.autor}${livro.categoria ? ` (${livro.categoria})` : ''}`;

    const result = _gemini(sys, usr);
    // Pega apenas a primeira frase/parágrafo limpo
    const frase = result.text.split('\n').filter(l => l.trim())[0].trim();
    return { success: true, frase };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────
//  SERVIÇOS — IA: DESAFIO DIÁRIO
// ─────────────────────────────────────────────
function svcGerarDesafio(livro) {
  try {
    const sys = `Você é um professor que cria quiz de literatura.
Gere UMA pergunta de múltipla escolha sobre o livro indicado.
Responda APENAS em JSON válido, sem texto adicional, sem markdown, sem blocos de código.
Formato exacto:
{"pergunta":"texto da pergunta","opcoes":["A","B","C","D"],"correta":0,"explicacao":"breve explicação da resposta correcta"}
Onde "correta" é o índice (0-3) da opção correcta.
A pergunta deve ser interessante, sobre o conteúdo, tema ou autor. As opções devem ser plausíveis.`;

    const usr = `Livro: "${livro.titulo}" de ${livro.autor}${livro.assunto ? `, assunto: ${livro.assunto}` : ''}`;

    const result = _gemini(sys, usr);

    // Parse JSON da resposta
    let raw = result.text.trim();
    // Remove possíveis backticks ou ```json
    raw = raw.replace(/^```(?:json)?/,'').replace(/```$/,'').trim();

    const parsed = JSON.parse(raw);

    if (!parsed.pergunta || !Array.isArray(parsed.opcoes) || parsed.opcoes.length < 2) {
      throw new Error('Formato de desafio inválido.');
    }

    return {
      success:    true,
      pergunta:   parsed.pergunta,
      opcoes:     parsed.opcoes,
      correta:    Number(parsed.correta) || 0,
      explicacao: parsed.explicacao || '',
    };
  } catch(e) {
    Logger.log('[svcGerarDesafio] ' + e);
    return { success: false, error: e.message };
  }
}
