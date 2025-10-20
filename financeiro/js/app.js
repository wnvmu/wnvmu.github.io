// app.js (versão corrigida)
import { ensureDirHandle, readTextFileIfExists, writeTextFile, toCSV, parseCSV, moedaBR, debounce } from './utils.js';

const cpf = sessionStorage.getItem('cpf');
if (!cpf) location.href = 'index.html';

// ===== Elementos principais =====
const tabelaBody = document.querySelector('#tabela tbody');
const filtro = document.getElementById('filtro');
const form = document.getElementById('formLancamento'); // formulário do modal de lançamento
const btnTrocarUsuario = document.getElementById('btnTrocarUsuario');
const btnNovoLancamento = document.getElementById('btnNovoLancamento'); // botão que abre o modal de lançamento
const dlgLancamento = document.getElementById('dlgLancamento');

const kpiSaldo = document.getElementById('kpiSaldo');
const kpiReceitasMes = document.getElementById('kpiReceitasMes');
const kpiDespesasMes = document.getElementById('kpiDespesasMes');

// selects do form de lançamento
const selConta = document.getElementById('conta');
const selCategoria = document.getElementById('categoria');

// ===== Configurações (modal) =====
const btnConfig = document.getElementById('btnConfig');
const dlgConfig = document.getElementById('dlgConfig');
const formConfig = document.getElementById('formConfig');
const cfgSaldoInicial = document.getElementById('cfgSaldoInicial');
const cfgCancelar = document.getElementById('cfgCancelar');

// cadastro rápido dentro de Config
const listaContas = document.getElementById('listaContas');
const listaCategorias = document.getElementById('listaCategorias');
const novaConta = document.getElementById('novaConta');
const novaCategoria = document.getElementById('novaCategoria');
const addConta = document.getElementById('addConta');
const addCategoria = document.getElementById('addCategoria');

// SALÁRIO
const btnSalario = document.getElementById('btnSalario');
const dlgSalario = document.getElementById('dlgSalario');
const salCancelar = document.getElementById('salCancelar');

btnSalario?.addEventListener('click', (e) => {
  e.preventDefault(); // importante pois btn está dentro do formConfig
  // popular contas no select do salário, se precisar:
  // setSelectOptions(document.getElementById('salConta'), config.contas || []);
  if (dlgSalario && !dlgSalario.open) dlgSalario.showModal();
});
salCancelar?.addEventListener('click', () => { dlgSalario?.close(); });

// ===== Estado =====
let lancamentos = [];
let meta = null;
let config = { saldoInicial: 0, contas: [], categorias: [] };

// ===== Helpers =====
function setSelectOptions(sel, items) {
  if (!sel) return;
  sel.innerHTML = '';
  (items || []).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function bumpMonth(dateStr, add) {
  const [y, m, d] = (dateStr || '0000-01-01').split('-').map(n => parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1 + add, d || 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(Math.min(d || 1, new Date(yy, dt.getMonth() + 1, 0).getDate())).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Render lista simples (Config)
function renderList(container, items, onEdit, onDel) {
  if (!container) return;
  container.innerHTML = '';
  (items || []).forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `<span>${v}</span>
      <div class="actions">
        <button class="btn btn--ghost" data-edit="${i}" title="Editar">✏️</button>
        <button class="btn btn--ghost" data-del="${i}" title="Remover">🗑️</button>
      </div>`;
    container.appendChild(row);
  });
  container.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const i = Number(b.dataset.edit ?? b.dataset.del);
    if (b.hasAttribute('data-edit')) onEdit?.(i);
    if (b.hasAttribute('data-del')) onDel?.(i);
  };
}

// Atualiza selects do form de lançamento e listas do modal de Config
function refreshContasInConfig() {
  renderList(listaContas, config.contas || [],
    (i) => {
      const novo = prompt('Editar conta:', config.contas[i] || '');
      if (!novo) return;
      config.contas[i] = novo.toUpperCase();
      setSelectOptions(selConta, config.contas);
      refreshContasInConfig();
      autoSave();
    },
    (i) => {
      config.contas.splice(i, 1);
      setSelectOptions(selConta, config.contas);
      refreshContasInConfig();
      autoSave();
    }
  );
  setSelectOptions(selConta, config.contas);
}

function refreshCategoriasInConfig() {
  renderList(listaCategorias, config.categorias || [],
    (i) => {
      const novo = prompt('Editar categoria:', config.categorias[i] || '');
      if (!novo) return;
      config.categorias[i] = novo.toUpperCase();
      setSelectOptions(selCategoria, config.categorias);
      refreshCategoriasInConfig();
      autoSave();
    },
    (i) => {
      config.categorias.splice(i, 1);
      setSelectOptions(selCategoria, config.categorias);
      refreshCategoriasInConfig();
      autoSave();
    }
  );
  setSelectOptions(selCategoria, config.categorias);
}

// ===== Filtro + Tabela =====
function applyFilter() {
  const q = (filtro?.value || '').toLowerCase();
  const rows = (lancamentos || []).filter(l =>
    [l.descricao, l.conta, l.categoria, l.documento, l.status, l.obs]
      .some(v => (v || '').toLowerCase().includes(q))
  );
  renderTable(rows);
}

// Helper: transforma "YYYY-MM-DD" em timestamp (ou +∞ se vazio/invalid)
function dateNumISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return Number.POSITIVE_INFINITY; // sem data vai pro final
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
}

function renderTable(rows) {
  tabelaBody.innerHTML = '';

  // ordena por vencimento ASC; empate: por date
  const sorted = [...rows].sort((a, b) => {
    const av = dateNumISO(a.vencimento);
    const bv = dateNumISO(b.vencimento);
    if (av !== bv) return av - bv;

    const ad = dateNumISO(a.date);
    const bd = dateNumISO(b.date);
    if (ad !== bd) return ad - bd;

    // 2º desempate opcional: descrição
    return (a.descricao || '').localeCompare(b.descricao || '');
  });

  sorted.forEach((l) => {
    // índice verdadeiro no array principal (pra editar/excluir/toggle)
    const iReal = lancamentos.indexOf(l);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.date || ''}</td>
      <td>${l.vencimento || ''}</td>
      <td>${l.type || ''}</td>
      <td>${l.descricao || ''}</td>
      <td>${l.conta || ''}</td>
      <td>${l.categoria || ''}</td>
      <td>${l.documento || ''}</td>
      <td>${l.forma || ''}</td>
      <td>${moedaBR(Number(l.valor || 0))}</td>
      <td>${l.parcela || ''}</td>
      <td>${l.status || ''}</td>
      <td>${l.obs || ''}</td>
      <td class="actions">
        <button data-toggle="${iReal}" class="btn btn--ghost" title="Alternar status">✅</button>
        <button data-edit="${iReal}" class="btn btn--ghost" title="Editar">✏️</button>
        <button data-del="${iReal}" class="btn btn--ghost" title="Excluir">🗑️</button>
      </td>`;
    tabelaBody.appendChild(tr);
  });
}


// util: parse seguro de "YYYY-MM-DD" para evitar bugs de timezone
function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  return new Date(y, mo, d);
}

// ===== KPIs =====
function recalcKPIs() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0..11

  let receitasMesPagas = 0;
  let despesasMesPagas = 0;

  // Soma de todas as movimentações já pagas/recebidas (todas as datas)
  let saldoMovimentadoPago = 0;

  (lancamentos || []).forEach(l => {
    const v = Number(l.valor || 0);
    const tipo = (l.type || '').toUpperCase();
    const status = (l.status || '').toUpperCase();
    const isReceita = (tipo === 'RECEITA');
    const isPago = (status === 'PAGO/RECEBIDO');

    // entrada no saldo: toda movimentação paga/recebida conta imediatamente
    if (isPago) {
      saldoMovimentadoPago += isReceita ? v : -v;
    }

    // KPIs mensais: considerar apenas mês/ano atuais e status pago/recebido
    const baseDate = l.date || l.vencimento || '';
    const dt = parseISODate(baseDate);
    if (!dt) return;

    const sameYear  = dt.getFullYear() === y;
    const sameMonth = dt.getMonth()    === m;

    if (sameYear && sameMonth && isPago) {
      if (isReceita) receitasMesPagas += v;
      else           despesasMesPagas += v;
    }
  });

  // Saldo atual = saldoInicial + movimentações efetivadas (pagas/recebidas)
  const saldo = Number(config?.saldoInicial || 0) + saldoMovimentadoPago;

  kpiSaldo.textContent = moedaBR(saldo);
  kpiReceitasMes.textContent = moedaBR(receitasMesPagas);
  kpiDespesasMes.textContent = moedaBR(despesasMesPagas);
}



// gera array ["YYYY-MM", ..., "YYYY-MM"] dos últimos n meses (inclui mês atual)
function lastNMonths(n = 12) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push(ym);
  }
  return out;
}

function labelYM(ym) {
  // Exibe como MM/AAAA
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}

// ===== Gráficos (últimos 12 meses, somente PAGO/RECEBIDO) =====
let chart = null;

function groupByMonthLast12Paid() {
  // prepara mapa com últimos 12 meses zerados
  const months = lastNMonths(12);
  const map = {};
  months.forEach(ym => { map[ym] = { receita: 0, despesa: 0 }; });

  (lancamentos || []).forEach(l => {
    const status = (l.status || '').toUpperCase();
    if (status !== 'PAGO/RECEBIDO') return;

    const baseDate = l.date || l.vencimento || '';
    const dt = parseISODate(baseDate);
    if (!dt) return;

    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    if (!(ym in map)) return; // ignora fora da janela de 12 meses

    const v = Number(l.valor || 0);
    if ((l.type || '').toUpperCase() === 'RECEITA') map[ym].receita += v;
    else                                            map[ym].despesa += v;
  });

  return {
    labels: months,                                  // ["YYYY-MM", ...]
    receita: months.map(m => map[m].receita),
    despesa: months.map(m => map[m].despesa)
  };
}

function renderChart() {
  const el = document.getElementById('graficoFluxo');
  if (!el) return;

  const ctx = el.getContext('2d');
  const { labels, receita, despesa } = groupByMonthLast12Paid();

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(labelYM), // "MM/AAAA"
      datasets: [
        { label: 'Receitas (pagas)', data: receita, fill: false, tension: 0.2 },
        { label: 'Despesas (pagas)', data: despesa, fill: false, tension: 0.2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${moedaBR(ctx.parsed.y || 0)}`
          }
        },
        legend: { display: true }
      },
      scales: {
        y: {
          ticks: { callback: (v) => moedaBR(v) }
        }
      }
    }
  });
}


// ===== CSV =====
const autoSave = debounce(async () => { await saveCSV(); }, 700);

async function loadCSV() {
  const filename = `${cpf}.csv`;
  const dirBd = await ensureDirHandle(true);
  const text = await readTextFileIfExists(dirBd, filename);
  
  if (!text) {
    const dirRoot = await ensureDirHandle(false);
    text = await readTextFileIfExists(dirRoot, filename);
    if (text) {
      // migra para /bd
      await writeTextFile(dirBd, filename, text);
      // opcional: remover da raiz
      // await dirRoot.removeEntry(filename).catch(() => {});
    } else {
      return; // não existe ainda
    }
  }

  const rows = parseCSV(text);
  meta = rows[0];
  let i = 1;

  if (!rows[i]) return;
  // header
  i++;

  if (rows[i] && (rows[i][0] || '').toUpperCase() === 'CONFIG') {
    try { config = JSON.parse(rows[i][1] || '{}'); } catch { config = { contas: [], categorias: [] }; }
    i++;
  }
  if (typeof config.saldoInicial === 'undefined') config.saldoInicial = 0;
  if (!config.contas) config.contas = [];
  if (!config.categorias) config.categorias = [];

  lancamentos = rows.slice(i).filter(r => r.length >= 2).map(r => ({
    date: r[0] || '',
    vencimento: r[1] || '',
    type: (r[2] || 'DESPESA').toUpperCase(),
    descricao: (r[3] || '').toUpperCase(),
    conta: (r[4] || '').toUpperCase(),
    categoria: (r[5] || '').toUpperCase(),
    documento: (r[6] || '').toUpperCase(),
    forma: (r[7] || '').toUpperCase(),
    valor: Number(r[8] || 0),
    parcela: (r[9] || '').toUpperCase(),
    status: (r[10] || '').toUpperCase(),
    obs: (r[11] || '').toUpperCase()
  }));

  // Preenche selects iniciais
  setSelectOptions(selConta, config.contas);
  setSelectOptions(selCategoria, config.categorias);

  applyFilter();
  recalcKPIs();
  renderChart();
}

async function saveCSV() {
  const dirBd = await ensureDirHandle(true); // sempre em /bd
  const rows = [];
  rows.push(meta);
  rows.push(['date','vencimento','type','descricao','conta','categoria','documento','forma','valor','parcela','status','obs']);
  rows.push(['CONFIG', JSON.stringify(config)]);
  lancamentos.forEach(l => rows.push([
    l.date, l.vencimento, l.type, l.descricao, l.conta, l.categoria, l.documento, l.forma,
    String(Number(l.valor||0).toFixed(2)), l.parcela, l.status, l.obs
  ]));
  await writeTextFile(dirBd, `${cpf}.csv`, toCSV(rows));
}

// ===== Eventos =====
// Tabela
tabelaBody.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const idx = Number(btn.dataset.edit ?? btn.dataset.del ?? btn.dataset.toggle);
  if (Number.isNaN(idx)) return;

  if (btn.hasAttribute('data-toggle')) {
    const l = lancamentos[idx];
    l.status = (l.status === 'PAGO/RECEBIDO') ? 'ABERTO' : 'PAGO/RECEBIDO';
    applyFilter(); recalcKPIs(); renderChart(); autoSave();
  }
  if (btn.hasAttribute('data-edit')) {
    const l = lancamentos[idx];
    form?.reset();
    document.getElementById('data').value = l.date;
    document.getElementById('vencimento').value = l.vencimento;
    document.getElementById('tipo').value = l.type;
    document.getElementById('descricao').value = l.descricao;
    selConta.value = l.conta;
    selCategoria.value = l.categoria;
    document.getElementById('documento').value = l.documento;
    document.getElementById('forma').value = l.forma || 'PIX';
    document.getElementById('valor').value = l.valor;
    document.getElementById('parcelas').value = 1;
    document.getElementById('status').value = l.status;
    document.getElementById('obs').value = l.obs;
    lancamentos.splice(idx, 1); // remove item, será regravado ao salvar
    if (dlgLancamento && !dlgLancamento.open) dlgLancamento.showModal();
    applyFilter(); recalcKPIs(); renderChart(); autoSave();
  }
  if (btn.hasAttribute('data-del')) {
    lancamentos.splice(idx, 1);
    applyFilter(); recalcKPIs(); renderChart(); autoSave();
  }
});

// Form de lançamento (modal)
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const base = {
    date: document.getElementById('data').value,
    vencimento: document.getElementById('vencimento').value,
    type: (document.getElementById('tipo').value || '').toUpperCase(),
    descricao: (document.getElementById('descricao').value || '').toUpperCase(),
    conta: (selConta.value || '').toUpperCase(),
    categoria: (selCategoria.value || '').toUpperCase(),
    documento: (document.getElementById('documento').value || '').toUpperCase(),
    forma: (document.getElementById('forma').value || '').toUpperCase(),
    valor: Number(document.getElementById('valor').value || 0),
    parcela: '',
    status: (document.getElementById('status').value || '').toUpperCase(),
    obs: (document.getElementById('obs').value || '').toUpperCase()
  };
  const nParcelas = Math.max(1, parseInt(document.getElementById('parcelas').value || '1', 10));

  if (nParcelas === 1) {
    lancamentos.push({ ...base, parcela: '' });
  } else {
    const valorParcela = Number((base.valor / nParcelas).toFixed(2));
    for (let i = 0; i < nParcelas; i++) {
      lancamentos.push({
        ...base,
        valor: valorParcela,
        parcela: `${i + 1}/${nParcelas}`,
        date: (i === 0 ? base.date : bumpMonth(base.date, i)),
        vencimento: base.vencimento ? (i === 0 ? base.vencimento : bumpMonth(base.vencimento, i)) : ''
      });
    }
  }
  if (dlgLancamento?.open) dlgLancamento.close();
  form.reset();
  applyFilter(); recalcKPIs(); renderChart(); autoSave();
});

// Filtro
filtro?.addEventListener('input', applyFilter);

// Novo lançamento
btnNovoLancamento?.addEventListener('click', () => {
  form?.reset();
  if (dlgLancamento && !dlgLancamento.open) dlgLancamento.showModal();
});

// Trocar usuário
btnTrocarUsuario?.addEventListener('click', () => { sessionStorage.removeItem('cpf'); location.href = 'index.html'; });

// Maiúsculas nos inputs de texto
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  const types = ['text', 'search', 'email', 'password'];
  if (types.includes(el.type)) {
    const s = el.selectionStart, t = el.selectionEnd;
    el.value = el.value.toUpperCase();
    if (s !== null && t !== null) el.setSelectionRange(s, t);
  }
});

// ===== Modal Configurações =====
btnConfig?.addEventListener('click', () => {
  cfgSaldoInicial.value = (config?.saldoInicial ?? 0);
  refreshContasInConfig();
  refreshCategoriasInConfig();
  if (dlgConfig && !dlgConfig.open) dlgConfig.showModal();
});

cfgCancelar?.addEventListener('click', (e) => {
  e.preventDefault();
  if (dlgConfig?.open) dlgConfig.close();
});

formConfig?.addEventListener('submit', (e) => {
  e.preventDefault();
  const saldo = parseFloat(cfgSaldoInicial.value || '0') || 0;
  config.saldoInicial = saldo;

  // salva e atualiza
  autoSave();
  recalcKPIs();

  if (dlgConfig?.open) dlgConfig.close();
});

// Adicionar itens no cadastro rápido (Config)
addConta?.addEventListener('click', (e) => {
  e.preventDefault();
  const v = (novaConta.value || '').trim().toUpperCase();
  if (!v) return;
  if (!config.contas.includes(v)) config.contas.push(v);
  novaConta.value = '';
  refreshContasInConfig();
  autoSave();
});

addCategoria?.addEventListener('click', (e) => {
  e.preventDefault();
  const v = (novaCategoria.value || '').trim().toUpperCase();
  if (!v) return;
  if (!config.categorias.includes(v)) config.categorias.push(v);
  novaCategoria.value = '';
  refreshCategoriasInConfig();
  autoSave();
});

// ===== init =====
loadCSV();
