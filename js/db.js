// ============================================================
// db.js — Camada de persistência local (localStorage + IndexedDB)
// Guarda: configurações (API keys, preferências) no localStorage
//         Cache offline de livros no IndexedDB (via idb-keyval pattern)
// ============================================================

const DB_NAME    = 'biblioa-db';
const DB_VERSION = 1;
const STORE_CACHE = 'livros-cache';

// ============================================================
// IndexedDB — Cache offline de livros
// ============================================================
let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        const store = db.createObjectStore(STORE_CACHE, { keyPath: 'id' });
        store.createIndex('titulo', 'titulo', { unique: false });
        store.createIndex('autor',  'autor',  { unique: false });
      }
    };
    req.onsuccess  = e => { _db = e.target.result; resolve(_db); };
    req.onerror    = e => reject(e.target.error);
  });
}

// Guarda array de livros no cache local
async function cacheLivros(livros) {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE_CACHE, 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    // Limpa e reescreve
    await new Promise((res, rej) => {
      const clearReq = store.clear();
      clearReq.onsuccess = res;
      clearReq.onerror   = rej;
    });
    livros.forEach(l => store.put(l));
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror    = rej;
    });
  } catch (e) {
    console.warn('[DB] Erro ao cachear livros:', e);
  }
}

// Lê livros do cache local (para uso offline)
async function getCachedLivros() {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE_CACHE, 'readonly');
    const store = tx.objectStore(STORE_CACHE);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[DB] Erro ao ler cache:', e);
    return [];
  }
}

// Limpa o cache local
async function clearLivrosCache() {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE_CACHE, 'readwrite');
    const store = tx.objectStore(STORE_CACHE);
    store.clear();
  } catch (e) {
    console.warn('[DB] Erro ao limpar cache:', e);
  }
}

// ============================================================
// localStorage — Configurações
// ============================================================
const CONFIG_KEY = 'biblioa_config';

function getConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function setConfig(obj) {
  try {
    const current = getConfig();
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...obj }));
  } catch (e) {
    console.warn('[DB] Erro ao guardar config:', e);
  }
}

function getGeminiKey()      { return getConfig().geminiKey || ''; }
function setGeminiKey(key)   { setConfig({ geminiKey: key }); }
function getGasUrl()         { return getConfig().gasUrl || ''; }
function setGasUrl(url)      { setConfig({ gasUrl: url }); }
function getViewMode()       { return getConfig().viewMode || 'list'; }
function setViewMode(mode)   { setConfig({ viewMode: mode }); }
function getLastSync()       { return getConfig().lastSync || null; }
function setLastSync(ts)     { setConfig({ lastSync: ts }); }
