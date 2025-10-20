/* utils.js — versão completa com exports usados pelo app */

// ======================= Persistência do DirectoryHandle (IndexedDB) =======================
const DB_NAME  = 'financeiro-fsa';
const STORE    = 'handles';
const ROOT_KEY = 'root-dir';

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const st = tx.objectStore(STORE);
    const r  = st.get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror   = () => reject(r.error);
  });
}

async function idbSet(key, val) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    const r  = st.put(val, key);
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}

export async function setStoredDirHandle(handle) {
  try { await idbSet(ROOT_KEY, handle); } catch {}
}
export async function getStoredDirHandle() {
  try { return await idbGet(ROOT_KEY); } catch { return null; }
}

export async function verifyPermission(handle, { mode = 'readwrite' } = {}) {
  if (!handle) return false;
  const opts = { mode };
  if (await handle.queryPermission?.(opts) === 'granted') return true;
  if (await handle.requestPermission?.(opts) === 'granted') return true;
  return false;
}

/**
 * Garante um DirectoryHandle. Se forceBd=true, sempre retorna a subpasta "bd/" dentro da pasta escolhida.
 * 1) tenta usar o handle salvo; 2) se não houver, abre o seletor de diretório.
 * Se não conseguir criar "bd", cai na raiz escolhida (fallback).
 */
export async function ensureDirHandle(forceBd = true) {
  let root = await getStoredDirHandle();
  if (!root) {
    if (!window.showDirectoryPicker) {
      throw new Error('File System Access API não suportada neste navegador.');
    }
    root = await window.showDirectoryPicker({ id: 'financeiro-data-root' });
    await setStoredDirHandle(root).catch(() => {});
  }

  await verifyPermission(root, { mode: 'readwrite' });

  if (!forceBd) return root;

  try {
    const bd = await root.getDirectoryHandle('bd', { create: true });
    await verifyPermission(bd, { mode: 'readwrite' });
    return bd;
  } catch (e) {
    console.warn('Falha ao abrir/criar subpasta "bd": usando a raiz escolhida.', e);
    return root;
  }
}

// ======================= Arquivos =======================
export async function fileExists(dirHandle, filename) {
  try {
    await dirHandle.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFileIfExists(dirHandle, filename) {
  try {
    const fh = await dirHandle.getFileHandle(filename);
    const f  = await fh.getFile();
    return await f.text();
  } catch {
    return null;
  }
}

export async function writeTextFile(dirHandle, filename, text) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const w  = await fh.createWritable();
  await w.write(text);
  await w.close();
}

// ======================= CSV (robusto com aspas) =======================
export function toCSV(rows) {
  const esc = (v) => {
    const s = (v === null || v === undefined) ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map(r => r.map(esc).join(',')).join('\n');
}

export function parseCSV(text) {
  // Parser simples que respeita aspas duplas e quebras de linha dentro de campos
  const out = [];
  let row = [];
  let i = 0, cur = '', inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') { cur += '"'; i += 2; continue; } // aspas escapada
        inQuotes = false; i++; continue;
      } else {
        cur += ch; i++; continue;
      }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; i++; continue; }
      cur += ch; i++; continue;
    }
  }
  // empurra último campo/linha
  row.push(cur);
  out.push(row);
  return out;
}

// ======================= Formatadores & utilitários =======================
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
export function moedaBR(v) {
  const n = Number(v || 0);
  return fmtBRL.format(n);
}

export function debounce(fn, wait = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

/* ======================= CPF ======================= */
// Remove tudo que não for dígito. Não formata.
export function normalizaCPF(cpf) {
  return String(cpf || '').replace(/\D+/g, '');
}

// Validação oficial do CPF (11 dígitos, não repetidos, dígitos verificadores corretos)
export function validarCPF(cpf) {
  const s = normalizaCPF(cpf);
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false; // todos iguais

  const nums = s.split('').map(n => parseInt(n, 10));

  // 1º DV
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += nums[i] * (10 - i);
  let resto = soma % 11;
  const dv1 = (resto < 2) ? 0 : 11 - resto;
  if (dv1 !== nums[9]) return false;

  // 2º DV
  soma = 0;
  for (let i = 0; i < 10; i++) soma += nums[i] * (11 - i);
  resto = soma % 11;
  const dv2 = (resto < 2) ? 0 : 11 - resto;
  if (dv2 !== nums[10]) return false;

  return true;
}

/* ======================= SHA-256 ======================= */
// Retorna o SHA-256 (hex minúsculo) da string informada
export async function sha256(text) {
  const enc = new TextEncoder().encode(String(text ?? ''));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const view = new Uint8Array(buf);
  let hex = '';
  for (const b of view) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/* ======================= Pasta de dados (definir/alterar) ======================= */
// Abre o seletor de pasta, salva o handle raiz, garante/retorna a subpasta "bd/"
export async function setNewDirHandle() {
  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API não suportada neste navegador.');
  }
  const root = await window.showDirectoryPicker({ id: 'financeiro-data-root' });
  await setStoredDirHandle(root).catch(() => {});
  await verifyPermission(root, { mode: 'readwrite' });

  try {
    const bd = await root.getDirectoryHandle('bd', { create: true });
    await verifyPermission(bd, { mode: 'readwrite' });
    return bd; // use este como pasta de leitura/gravação
  } catch (e) {
    console.warn('Não foi possível criar "bd/"; usando raiz escolhida.', e);
    return root;
  }
}
