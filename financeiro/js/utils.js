// utils.js (v2)
const DB_NAME = 'finance_csv_app_db_v2';
const STORE = 'handles';
function idbOpen() { return new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});}
async function idbSet(key, value) { const db = await idbOpen(); return new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, key);
  tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error);
});}
async function idbGet(key) { const db = await idbOpen(); return new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).get(key);
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});}
const FS_KEY = 'dataDirHandle';

// 3) FS API helper (não quebra em browsers sem suporte)
export async function ensureDirHandle(promptIfMissing = true) {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('Seu navegador não suporta File System Access API. Use Chrome ou Edge no desktop.');
  }
  let handle = await idbGet(FS_KEY);
  if (!handle && promptIfMissing) {
    handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await idbSet(FS_KEY, handle);
  }
  if (handle) {
    const ok = await verifyPermission(handle, true);
    if (!ok) return null;
  }
  return handle || null;
}

export async function setNewDirHandle() { const handle = await window.showDirectoryPicker({ mode: 'readwrite' }); await idbSet(FS_KEY, handle); return handle; }
async function verifyPermission(fileHandle, withWrite) {
  const opts = {}; if (withWrite) opts.mode = 'readwrite';
  if ((await fileHandle.queryPermission(opts)) === 'granted') return true;
  if ((await fileHandle.requestPermission(opts)) === 'granted') return true;
  return false;
}
export async function writeTextFile(dirHandle, filename, text) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable(); await writable.write(text); await writable.close();
}
export async function readTextFileIfExists(dirHandle, filename) {
  try { const fileHandle = await dirHandle.getFileHandle(filename, { create: false });
    const file = await fileHandle.getFile(); return await file.text(); } catch (e) { return null; }
}
export async function fileExists(dirHandle, filename) { try { await dirHandle.getFileHandle(filename, { create: false }); return true; } catch { return false; } }
export function toCSV(rows){ return rows.map(r => r.map(v => { if (v == null) return ''; const s = String(v); if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'; return s; }).join(',')).join('\n'); }

// 1) parseCSV: tratar \r (Windows)
export function parseCSV(text){
  const rows = []; let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field=''; }
      else if (c === '\n') { row.push(field); rows.push(row); row=[]; field=''; }
      else if (c !== '\r') { field += c; } // <- ignora \r
    }
    i++;
  }
  row.push(field); rows.push(row);
  return rows;
}

export async function sha256(text) { const enc = new TextEncoder().encode(text); const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join(''); }
export function moedaBR(v){ return (v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
export function normalizaCPF(cpf){ return cpf.replace(/[^0-9.\-]/g, ''); }
export function debounce(fn, wait=600){ let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }

// 2) validar CPF simples (sem dependências)
export function validarCPF(cpf){
  if (!cpf) return false;
  const nums = cpf.replace(/\D/g,'');
  if (nums.length !== 11 || /^(\d)\1{10}$/.test(nums)) return false;
  const calc = (base) => {
    let sum = 0;
    for (let i=0;i<base;i++) sum += parseInt(nums[i],10)*(base+1-i);
    const rest = (sum*10) % 11;
    return (rest === 10 ? 0 : rest);
  };
  return calc(9) === parseInt(nums[9],10) && calc(10) === parseInt(nums[10],10);
}