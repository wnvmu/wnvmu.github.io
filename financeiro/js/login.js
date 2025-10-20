// import: incluir validarCPF
import { ensureDirHandle, setNewDirHandle, readTextFileIfExists, writeTextFile, toCSV, parseCSV, sha256, normalizaCPF, fileExists, validarCPF } from './utils.js';

const form = document.getElementById('loginForm');
const btnNovaConta = document.getElementById('btnNovaConta');
const btnDefinirPasta = document.getElementById('btnDefinirPasta');
const msg = document.getElementById('msg');

const dlg = document.getElementById('dlgSignup');
const signupForm = document.getElementById('signupForm');
const s_msg = document.getElementById('signupMsg');

function showMsg(el, text, ok=false){
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'msg--ok' : 'msg--error');
}

// ao abrir “Definir/Alterar pasta…”
btnDefinirPasta.addEventListener('click', async () => {
  try { await setNewDirHandle(); showMsg(msg, 'Pasta definida com sucesso.', true); }
  catch (e) { showMsg(msg, (e && e.message) ? e.message : 'Erro ao definir pasta.'); }
});

// login
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const dir = await ensureDirHandle(true);
    if (!dir) return showMsg(msg, 'Permissão negada para acessar a pasta.');

    const cpfRaw = document.getElementById('cpf').value.trim();
    const senha = document.getElementById('senha').value;
    const cpf = normalizaCPF(cpfRaw);
    if (!cpf) return showMsg(msg, 'Informe um CPF.');
    if (!validarCPF(cpf)) return showMsg(msg, 'CPF inválido.');

    const filename = `${cpf}.csv`;
    const text = await readTextFileIfExists(dir, filename);
    if (!text) return showMsg(msg, 'Usuário não encontrado. Crie uma nova conta.');

    const rows = parseCSV(text);
    const meta = rows[0] || [];
    if ((meta[0] || '').toUpperCase() !== 'META') return showMsg(msg, 'Arquivo CSV inválido (sem META).');

    const hashCSV = meta[2] || '';
    const hash = await sha256(senha);
    if (hash !== hashCSV) return showMsg(msg, 'Senha incorreta.');

    // após autenticar:
    localStorage.setItem('cpf', cpf);
    sessionStorage.setItem('cpf', cpf);
    location.href = 'app.html';
  } catch (e) {
    showMsg(msg, (e && e.message) ? e.message : 'Erro no login.');
  }
});

btnNovaConta.addEventListener('click', () => {
  s_msg.textContent = '';
  signupForm.reset();
  document.getElementById('s_senha').value='';
  document.getElementById('s_senha2').value='';
  dlg.showModal();
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const dir = await ensureDirHandle(true);
    if (!dir) return showMsg(s_msg, 'Permissão negada para acessar a pasta.');

    const cpfRaw = document.getElementById('s_cpf').value.trim();
    const nome = document.getElementById('s_nome').value.trim();
    const email = document.getElementById('s_email').value.trim();
    const senha = document.getElementById('s_senha').value;
    const senha2 = document.getElementById('s_senha2').value;
    if (senha !== senha2) return showMsg(s_msg, 'As senhas não coincidem.');

    const cpf = normalizaCPF(cpfRaw);
    const filename = `${cpf}.csv`;

    if (await fileExists(dir, filename)) {
      return showMsg(s_msg, 'Já existe uma conta com este CPF. Faça login.');
    }

    const hash = await sha256(senha);
    const now = new Date().toISOString();
    const config = JSON.stringify({ contas: [], categorias: [] });

    const header = ['META', cpf, hash, nome, email, now];
    const cols = ['date','vencimento','type','descricao','conta','categoria','documento','forma','valor','parcela','status','obs'];
    const configRow = ['CONFIG', config];

    const csv = toCSV([header, cols, configRow]);
    await writeTextFile(dir, filename, csv);
    showMsg(s_msg, 'Conta criada com sucesso! Agora faça login.', true);
  } catch (e) {
    showMsg(s_msg, 'Erro ao criar conta: ' + e.message);
  }
});
