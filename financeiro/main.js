const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function sha256Hex(s){ return crypto.createHash('sha256').update(s,'utf8').digest('hex'); }

// Base folder: same folder as app's files (development).
// When packaged, __dirname points to app.asar; to keep it simple for dev, we use app.getAppPath().
function appBaseDir(){
  return app.getAppPath(); // same folder where main.js resides (dev mode)
}

function csvPathForUser(user){
  return path.join(appBaseDir(), `${user}.csv`);
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: login (load/create CSV in the same folder)
ipcMain.handle('login', async (event, {user, pass, createIfMissing}) => {
  const file = csvPathForUser(user);
  const hash = sha256Hex(pass);
  let csv = '';
  if(!fs.existsSync(file)){
    if(!createIfMissing){
      return { userOk: false, reason: 'user-not-found' };
    }
    // create new file
    const tpl = [
      `__META__,saldoInicial,0`,
      `__USERS__`,
      `__USER__,${user.replaceAll('"','""')},${hash}`,
      `id,tipo,dataISO,valor,descricao,categoria,status,recorrencia,parcelas,parcelaAtual`
    ].join('\n');
    fs.writeFileSync(file, tpl, 'utf8');
    csv = tpl;
    return { userOk: true, created: true, csv };
  }
  csv = fs.readFileSync(file, 'utf8');
  // verify user
  const lines = csv.split(/\r?\n/);
  let savedHash = null;
  for(const ln of lines){
    if(ln.startsWith('__USER__')){
      const parts = ln.split(',');
      const u = (parts[1]||'').replace(/^"+|"+$/g,'');
      const h = (parts[2]||'').trim();
      if(u===user){ savedHash = h; break; }
    }
  }
  if(!savedHash){
    if(createIfMissing){
      csv += `\n__USER__,${user.replaceAll('"','""')},${hash}`;
      fs.writeFileSync(file, csv, 'utf8');
      return { userOk: true, added: true, csv };
    }
    return { userOk: false, reason: 'user-not-found' };
  }
  return { userOk: savedHash === hash, csv };
});

// IPC: save CSV (overwrite file)
ipcMain.handle('save', async (event, {csv}) => {
  if(typeof csv !== 'string') return { ok:false, error:'missing csv' };
  const m = csv.match(/^__USER__,([^,\n]+),/m);
  const username = m ? m[1].replace(/^"+|"+$/g,'') : 'financas';
  const file = csvPathForUser(username);
  fs.writeFileSync(file, csv, 'utf8');
  return { ok:true, file };
});
