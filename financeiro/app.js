;(()=>{
  const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const fmtMes = new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit'});

  const state = {
    saldoInicial: 0,
    transacoes: [],
    editingId: null,
    charts: { fluxo:null, pizza:null },
    users: new Map(),
    loggedUser: null,
    fileHandle: null
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const uid = ()=> Math.random().toString(36).slice(2)+Date.now().toString(36);
  const parseDateISO = v => v? new Date(v+'T00:00:00') : null;
  const monthKey = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');

  async function sha256Hex(str){
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // ---- CSV helpers ----
  function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s)? '"' + s.replace(/"/g,'""') + '"' : s; }
  function parseCSVLine(line){
    const out=[]; let cur=''; let inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(inQ){ if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else { inQ=false; } } else { cur+=ch; } }
      else { if(ch==='"'){ inQ=true; } else if(ch===','){ out.push(cur); cur=''; } else { cur+=ch; } }
    }
    out.push(cur); return out;
  }
  function toCSV(){
    const header = 'id,tipo,dataISO,valor,descricao,categoria,status,recorrencia,parcelas,parcelaAtual';
    const meta = `__META__,saldoInicial,${state.saldoInicial}`;
    const users = ['__USERS__', ...[...state.users.entries()].map(([u,h])=>`__USER__,${csvEscape(u)},${h}`)];
    const rows = state.transacoes.map(t=>[
      t.id,t.tipo,t.dataISO,t.valor,
      t.descricao||'',t.categoria||'',
      t.status||'pendente',t.recorrencia||'nenhuma',
      t.parcelas||1,t.parcelaAtual||1
    ].map(csvEscape).join(','));
    return [meta, ...users, header, ...rows].join('\n');
  }
  function importCSVText(text){
    state.users.clear(); state.saldoInicial=0; state.transacoes=[];
    const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
    let mode='meta'; let headerRead=false;
    for(const line of lines){
      if(line.startsWith('__META__')){ const p=parseCSVLine(line); const v=Number(p[2]||0); if(!Number.isNaN(v)) state.saldoInicial=v; continue; }
      if(line==='__USERS__'){ mode='users'; continue; }
      if(mode==='users' && line.startsWith('__USER__')){ const p=parseCSVLine(line); const u=(p[1]||'').trim(); const h=(p[2]||'').trim(); if(u&&h) state.users.set(u,h); continue; }
      if(!headerRead){ if(line==='id,tipo,dataISO,valor,descricao,categoria,status,recorrencia,parcelas,parcelaAtual'){ headerRead=true; } continue; }
      const cols = parseCSVLine(line); if(cols.length<10) continue;
      const [id,tipo,dataISO,valor,descricao,categoria,status,recorrencia,parcelas,parcelaAtual] = cols;
      const t={ id: id||uid(), tipo, dataISO, valor:Number(valor||0), descricao, categoria, status:status||'pendente', recorrencia:recorrencia||'nenhuma', parcelas:Number(parcelas||1), parcelaAtual:Number(parcelaAtual||1) };
      if(t.dataISO) state.transacoes.push(t);
    }
  }

  // ---- File System Access ----
  async function ensureFileHandle(user){
    if(state.fileHandle) return state.fileHandle;
    if(!window.showSaveFilePicker) throw new Error('Seu navegador não suporta File System Access. Use Chrome/Edge (desktop).');
    state.fileHandle = await window.showSaveFilePicker({
      suggestedName: `${user}.csv`,
      types:[{description:'CSV', accept:{'text/csv':['.csv']}}]
    });
    return state.fileHandle;
  }
  async function fsLoadOrCreate(user, pass, createIfMissing){
    const handle = await ensureFileHandle(user);
    const passHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass)).then(buf => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''));
    let text = '';
    try{ const f = await handle.getFile(); text = await f.text(); }catch{ text=''; }
    if(!text.trim()){
      state.users = new Map([[user, passHash]]); state.saldoInicial=0; state.transacoes=[];
      const w = await handle.createWritable(); await w.write(toCSV()); await w.close();
      return {userOk:true, created:true};
    }
    importCSVText(text);
    const savedHash = state.users.get(user);
    if(!savedHash){
      if(createIfMissing){ state.users.set(user, passHash); const w=await handle.createWritable(); await w.write(toCSV()); await w.close(); return {userOk:true, added:true}; }
      return {userOk:false};
    }
    return {userOk: savedHash===passHash};
  }
  async function fsSave(){
    const w = await state.fileHandle.createWritable();
    await w.write(toCSV()); await w.close();
  }

  // ---- UI / Tabela / KPIs / Charts ----
  function getFiltros(){ return { mes: $('#filtroMes').value, tipo: $('#filtroTipo').value, q: ($('#busca').value||'').toLowerCase(), status: $('#filtroStatus').value } }
  function filtrar(trans){
    const f = getFiltros();
    return trans.filter(t=>{
      const d = parseDateISO(t.dataISO); const mk = monthKey(d);
      if(f.mes && mk!==f.mes) return false;
      if(f.tipo && t.tipo!==f.tipo) return false;
      if(f.status && (t.status||'pendente')!==f.status) return false;
      const hay = (t.descricao||'')+' '+(t.categoria||'');
      if(f.q && !hay.toLowerCase().includes(f.q)) return false;
      return true;
    }).sort((a,b)=> a.dataISO.localeCompare(b.dataISO));
  }
  function renderTabela(){
    const rows = filtrar(state.transacoes);
    const tb = $('#tbody'); tb.innerHTML='';
    for(const t of rows){
      const tr = document.createElement('tr');
      const d = parseDateISO(t.dataISO);
      tr.innerHTML = `
        <td>${d.toLocaleDateString('pt-BR')}</td>
        <td>${t.tipo==='PAGAR'? 'Pagar' : 'Receber'}</td>
        <td>${t.descricao||'-'}</td>
        <td>${t.categoria||'-'}</td>
        <td class="right">${BRL.format(Number(t.valor||0))}</td>
        <td><span class="pill ${t.status==='concluida'?'ok':'warn'}">${t.status||'pendente'}</span></td>
        <td>${t.parcelas>1? `${t.parcelaAtual}/${t.parcelas}` : (t.recorrencia||'—')}</td>
        <td class="right"><button class="btn small" data-editar="${t.id}">Editar</button> <button class="btn small" data-remover="${t.id}">Excluir</button></td>`;
      tb.appendChild(tr);
    }
    $$('button[data-editar]').forEach(b=> b.onclick=()=>editTransacao(b.dataset.editar));
    $$('button[data-remover]').forEach(b=> b.onclick=()=>{ if(confirm('Excluir esta transação?')) removeTransacao(b.dataset.remover) });
  }
  function somatoriosJanela(dias=30){
    const hoje = new Date(); const limite = new Date(); limite.setDate(limite.getDate()+dias);
    let pagar=0, receber=0;
    for(const t of state.transacoes){
      const d = parseDateISO(t.dataISO);
      if(d>=hoje && d<=limite){
        if(t.tipo==='PAGAR') pagar += Number(t.valor||0);
        else receber += Number(t.valor||0);
      }
    }
    return {pagar, receber, saldo: state.saldoInicial + receber - pagar};
  }
  function projecao12Meses(){
    const base = new Date(); base.setDate(1);
    const labels=[], pagar=[], receber=[];
    for(let i=0;i<12;i++){
      const di = new Date(base); di.setMonth(base.getMonth()+i);
      labels.push(fmtMes.format(di));
      const mk = monthKey(di);
      let tp=0,tr=0;
      for(const t of state.transacoes){
        const d = parseDateISO(t.dataISO);
        if(t.recorrencia==='mensal' && d<=di){
          const diff=(di.getFullYear()-d.getFullYear())*12 + (di.getMonth()-d.getMonth());
          if(diff>=0){ if(t.tipo==='PAGAR') tp+=Number(t.valor||0); else tr+=Number(t.valor||0); }
        } else if(monthKey(d)===mk){
          if(t.tipo==='PAGAR') tp+=Number(t.valor||0); else tr+=Number(t.valor||0);
        }
      }
      pagar.push(tp); receber.push(tr);
    }
    return {labels,pagar,receber};
  }
  function distribuicaoCategorias(){
    const map=new Map();
    for(const t of state.transacoes){
      const k=(t.categoria||'Outros') + ' — ' + (t.tipo==='PAGAR'? 'Pagar':'Receber');
      map.set(k,(map.get(k)||0) + Number(t.valor||0));
    }
    return {labels:[...map.keys()], data:[...map.values()]};
  }
  function renderKPIs(){
    const {pagar, receber, saldo} = somatoriosJanela(30);
    $('#kpiPagar').textContent = BRL.format(pagar);
    $('#kpiReceber').textContent = BRL.format(receber);
    $('#kpiSaldo').textContent = BRL.format(saldo);
    const tag = $('#kpiSaldoTag');
    tag.textContent = saldo>=0? 'OK' : 'A Descoberto';
    tag.className = 'pill ' + (saldo>=0? 'ok':'bad');
  }
  function renderCharts(){
    const ctx1=document.getElementById('chartFluxo');
    const ctx2=document.getElementById('chartPizza');
    const p=projecao12Meses(); const dist=distribuicaoCategorias();
    if(state.charts.fluxo) state.charts.fluxo.destroy();
    if(state.charts.pizza) state.charts.pizza.destroy();
    state.charts.fluxo=new Chart(ctx1,{ type:'bar', data:{ labels:p.labels, datasets:[{label:'A Receber', data:p.receber},{label:'A Pagar', data:p.pagar}] }, options:{ responsive:true, plugins:{ legend:{labels:{color:'#cbd5e1'}} }, scales:{ x:{ ticks:{color:'#94a3b8'}}, y:{ ticks:{color:'#94a3b8'} } } } });
    state.charts.pizza=new Chart(ctx2,{ type:'pie', data:{ labels:dist.labels, datasets:[{ data:dist.data }] }, options:{ plugins:{ legend:{labels:{color:'#cbd5e1'} } } } });
  }
  function renderAll(){ renderTabela(); renderKPIs(); renderCharts(); }

  // ---- CRUD ----
  function addOrUpdateTransacao(data){
    if(state.editingId){
      const i=state.transacoes.findIndex(t=>t.id===state.editingId);
      if(i>-1) state.transacoes[i] = {...state.transacoes[i], ...data};
      state.editingId=null;
    } else {
      const parcelas=Math.max(1, Number(data.parcelas||1));
      if(parcelas>1){
        const d0=parseDateISO(data.dataISO);
        for(let p=1;p<=parcelas;p++){
          const di=new Date(d0); di.setMonth(di.getMonth()+p-1);
          const row={...data, id:uid(), parcelaAtual:p, parcelas};
          row.dataISO=di.toISOString().slice(0,10);
          state.transacoes.push(row);
        }
      } else {
        state.transacoes.push({...data, id:uid(), parcelaAtual:1, parcelas:1});
      }
    }
    saveToDisk();
    clearForm();
  }
  function removeTransacao(id){ state.transacoes = state.transacoes.filter(t=>t.id!==id); saveToDisk(); }
  function editTransacao(id){
    const t = state.transacoes.find(x=>x.id===id); if(!t) return;
    state.editingId = id;
    $('#tipo').value=t.tipo; $('#data').value=t.dataISO; $('#valor').value=t.valor;
    $('#descricao').value=t.descricao||''; $('#categoria').value=t.categoria||'';
    $('#status').value=t.status||'pendente'; $('#recorrencia').value=t.recorrencia||'nenhuma';
    $('#parcelas').value=t.parcelas||1; $('#editHint').textContent='Editando: '+(t.descricao||t.id);
  }
  function clearForm(){ state.editingId=null; $('#tipo').value='PAGAR'; $('#data').value=''; $('#valor').value=''; $('#descricao').value=''; $('#categoria').value=''; $('#status').value='pendente'; $('#recorrencia').value='nenhuma'; $('#parcelas').value='1'; $('#editHint').textContent=''; renderAll(); }

  // ---- Filtros/Bind ----
  function setupFiltros(){
    const sel=$('#filtroMes'); sel.innerHTML='';
    const optAll=document.createElement('option'); optAll.value=''; optAll.textContent='Todos os meses'; sel.appendChild(optAll);
    const base=new Date(); base.setDate(1);
    for(let i=-12;i<=12;i++){ const d=new Date(base); d.setMonth(d.getMonth()+i); const opt=document.createElement('option'); opt.value=monthKey(d); opt.textContent=fmtMes.format(d); sel.appendChild(opt); }
    sel.value=monthKey(base);
  }
  function bindApp(){
    $('#btnSalvar').onclick = ()=>{
      const data={ tipo:$('#tipo').value, dataISO:$('#data').value, valor:Number($('#valor').value||0), descricao:$('#descricao').value.trim(), categoria:$('#categoria').value.trim(), status:$('#status').value, recorrencia:$('#recorrencia').value, parcelas:Number($('#parcelas').value||1) };
      if(!data.dataISO) return alert('Informe a data.');
      if(!data.valor || data.valor<=0) return alert('Informe um valor válido.');
      addOrUpdateTransacao(data);
    };
    $('#btnLimpar').onclick = ()=> clearForm();
    $('#btnNovo').onclick = ()=> { clearForm(); $('#descricao').focus() };
    $('#btnAplicarSaldo').onclick = ()=>{ state.saldoInicial = Number($('#saldoInicial').value||0); saveToDisk(); };
    $('#filtroMes').onchange = renderTabela; $('#filtroTipo').onchange = renderTabela; $('#filtroStatus').onchange = renderTabela; $('#busca').oninput = ()=> renderTabela();
    $('#btnSalvarCSV').onclick = ()=> saveToDisk();
  }
  function showApp(){ $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden'); setupFiltros(); $('#saldoInicial').value=state.saldoInicial; bindApp(); renderAll(); }

  async function saveToDisk(){
    const w = await state.fileHandle.createWritable();
    await w.write(toCSV()); await w.close();
    renderAll();
  }

  // ---- Login flow (pure static) ----
  async function handleLogin(createOnMissing=false){
    const u=($('#loginUser').value||'').trim(); const p=$('#loginPass').value||'';
    if(!u || !p) return alert('Informe usuário e senha.');
    try{
      const res = await fsLoadOrCreate(u,p, createOnMissing);
      if(!res.userOk) return alert('Usuário/senha inválidos.');
      state.loggedUser = u;
      showApp();
    }catch(e){ alert(e.message||String(e)); }
  }

  // Submit login form without page refresh
  document.getElementById('loginForm').addEventListener('submit', (ev)=>{
    ev.preventDefault();
    handleLogin(document.getElementById('loginCriar').checked);
  });
})();