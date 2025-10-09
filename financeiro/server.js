// Tiny backend to save in the same folder as index.html
// Usage: npm i && node server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5173;

// serve static files from current folder
app.use(express.static(__dirname));
app.use(express.json({limit:'5mb'}));

const csvPathForUser = (user) => path.join(__dirname, `${user}.csv`);
function sha256Hex(s){ return crypto.createHash('sha256').update(s,'utf8').digest('hex'); }

app.get('/api/ping', (_,res)=> res.send('ok'));

app.post('/api/login', (req,res)=>{
  try{
    const {user, pass, createIfMissing} = req.body || {};
    if(!user || !pass) return res.status(400).json({error:'missing creds'});
    const file = csvPathForUser(user);
    const hash = sha256Hex(pass);
    let csv = '';
    if(!fs.existsSync(file)){
      // create new file
      const tpl = [
        `__META__,saldoInicial,0`,
        `__USERS__`,
        `__USER__,${user.replaceAll('"','""')},${hash}`,
        `id,tipo,dataISO,valor,descricao,categoria,status,recorrencia,parcelas,parcelaAtual`
      ].join('\n');
      fs.writeFileSync(file, tpl, 'utf8');
      csv = tpl;
      return res.json({userOk:true, created:true, csv});
    }
    csv = fs.readFileSync(file, 'utf8');
    // find user hash
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
        return res.json({userOk:true, added:true, csv});
      }
      return res.json({userOk:false});
    }
    return res.json({userOk: savedHash===hash, csv});
  }catch(e){
    console.error(e);
    res.status(500).json({error:'server'});
  }
});

app.post('/api/save', (req,res)=>{
  try{
    const {csv} = req.body || {};
    if(typeof csv!=='string') return res.status(400).json({error:'missing csv'});
    // get username from __USERS__/__USER__ first entry
    const m = csv.match(/^__USER__,([^,\n]+),/m);
    const username = m ? m[1].replace(/^"+|"+$/g,'') : 'financas';
    fs.writeFileSync(csvPathForUser(username), csv, 'utf8');
    res.json({ok:true});
  }catch(e){
    console.error(e);
    res.status(500).json({error:'server'});
  }
});

app.listen(PORT, ()=>{
  console.log(`Servidor em http://localhost:${PORT}`);
});