/* =========================================================
   Contas a Pagar — lógica do app
   Persistência: localStorage (100% local)
   ========================================================= */

const STORAGE_KEY = 'contasPagar.contas';
const SERIES_KEY = 'contasPagar.series';
const FILTROS_KEY = 'contasPagar.filtros';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Persistência ---------- */
function loadContas() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveContas(contas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contas));
}
function loadSeries() {
  try { return JSON.parse(localStorage.getItem(SERIES_KEY)) || {}; }
  catch { return {}; }
}
function saveSeries(series) {
  localStorage.setItem(SERIES_KEY, JSON.stringify(series));
}
function loadFiltros() {
  try { return JSON.parse(localStorage.getItem(FILTROS_KEY)) || []; }
  catch { return []; }
}
function saveFiltros(filtros) {
  localStorage.setItem(FILTROS_KEY, JSON.stringify(filtros));
}

let contas = loadContas();
let series = loadSeries();
let filtros = loadFiltros();
let filtroAtivoId = null;

/* ---------- Utilidades de data/valor ---------- */
function hojeISO() {
  const d = new Date();
  return isoFromParts(d.getFullYear(), d.getMonth(), d.getDate());
}
function isoFromParts(y, m, d) {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return isoFromParts(date.getFullYear(), date.getMonth(), day);
}
function monthsBetween(isoA, isoB) {
  const [ay, am] = isoA.split('-').map(Number);
  const [by, bm] = isoB.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
function formatBRL(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDataBR(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return d.toLocaleDateString('pt-BR');
}
function nomeMes(y, m) {
  const d = new Date(y, m, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
function isVencida(conta) {
  return conta.status === 'pendente' && conta.dataVencimento < hojeISO();
}

/* =========================================================
   RECORRÊNCIA
   ========================================================= */

// Garante que toda série ativa tenha lançamentos até 12 meses à frente.
function ensureRecurringCoverage() {
  const hoje = hojeISO();
  let mudou = false;

  Object.keys(series).forEach((serieId) => {
    const s = series[serieId];
    if (!s.ativo) return;

    const instancias = contas.filter(c => c.recorrenciaId === serieId);
    if (instancias.length === 0) return;

    const maxVenc = instancias.reduce((max, c) => c.dataVencimento > max ? c.dataVencimento : max, instancias[0].dataVencimento);
    const mesesFalta = 12 - monthsBetween(hoje, maxVenc);

    if (mesesFalta > 0) {
      // usa a última instância como modelo (categoria/nome/valor/observações)
      const modelo = instancias.reduce((last, c) => c.dataVencimento > last.dataVencimento ? c : last, instancias[0]);
      let ultimaData = maxVenc;
      for (let i = 0; i < mesesFalta; i++) {
        ultimaData = addMonths(ultimaData, 1);
        contas.push({
          id: uid(),
          categoria: modelo.categoria,
          nome: modelo.nome,
          valorOriginal: modelo.valorOriginal,
          dataVencimento: ultimaData,
          valorPago: null,
          dataPagamento: null,
          observacoes: modelo.observacoes,
          recorrente: true,
          recorrenciaId: serieId,
          status: 'pendente',
        });
        mudou = true;
      }
    }
  });

  if (mudou) saveContas(contas);
}

/* =========================================================
   RENDERIZAÇÃO — LISTAS
   ========================================================= */

function ordenarPendentes(lista) {
  return [...lista].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
}
function ordenarPagas(lista) {
  return [...lista].sort((a, b) => (b.dataPagamento || '').localeCompare(a.dataPagamento || ''));
}

function criarLinhaConta(conta, { mostrarDataPagamento = false } = {}) {
  const row = document.createElement('div');
  row.className = 'conta-row';
  row.dataset.id = conta.id;

  const vencida = isVencida(conta);
  const stripeClass = conta.status === 'pago' ? 'pago' : (vencida ? 'vencida' : 'pendente');

  const stripe = document.createElement('div');
  stripe.className = `conta-stripe ${stripeClass}`;

  const info = document.createElement('div');
  info.className = 'conta-info';

  const nome = document.createElement('div');
  nome.className = 'conta-nome';
  nome.textContent = conta.nome;

  const meta = document.createElement('div');
  meta.className = 'conta-meta';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = conta.categoria;
  meta.appendChild(badge);

  const dataSpan = document.createElement('span');
  if (mostrarDataPagamento) {
    dataSpan.textContent = `pago em ${formatDataBR(conta.dataPagamento)}`;
  } else {
    dataSpan.textContent = vencida ? `venceu em ${formatDataBR(conta.dataVencimento)}` : `vence em ${formatDataBR(conta.dataVencimento)}`;
  }
  meta.appendChild(dataSpan);

  if (conta.recorrente) {
    const rec = document.createElement('span');
    rec.className = 'recorrente-icon';
    rec.textContent = '↻';
    rec.title = 'Cobrança recorrente';
    meta.appendChild(rec);
  }

  info.appendChild(nome);
  info.appendChild(meta);

  const valor = document.createElement('div');
  valor.className = `conta-valor ${stripeClass === 'vencida' ? 'vencida' : ''} ${conta.status === 'pago' ? 'pago' : ''}`;
  valor.textContent = formatBRL(conta.status === 'pago' ? conta.valorPago : conta.valorOriginal);

  row.appendChild(stripe);
  row.appendChild(info);
  row.appendChild(valor);

  row.addEventListener('click', () => abrirDetalhe(conta.id));
  return row;
}

function renderPendentes() {
  const container = $('#listaPendentes');
  const pendentes = ordenarPendentes(contas.filter(c => c.status === 'pendente'));
  container.innerHTML = '';
  pendentes.forEach(c => container.appendChild(criarLinhaConta(c)));
  $('#emptyPendentes').hidden = pendentes.length > 0;
}

function renderPagas() {
  const container = $('#listaPagas');
  const pagas = ordenarPagas(contas.filter(c => c.status === 'pago'));
  container.innerHTML = '';
  pagas.forEach(c => container.appendChild(criarLinhaConta(c, { mostrarDataPagamento: true })));
  $('#emptyPagas').hidden = pagas.length > 0;
}

function renderResumo() {
  const hoje = hojeISO();
  const [anoAtual, mesAtual] = [parseISO(hoje).getFullYear(), parseISO(hoje).getMonth()];

  const doMes = contas.filter(c => {
    const d = parseISO(c.dataVencimento);
    return d.getFullYear() === anoAtual && d.getMonth() === mesAtual;
  });

  const pendentesMes = doMes.filter(c => c.status === 'pendente');
  const pagasMes = doMes.filter(c => c.status === 'pago');
  const vencidasMes = pendentesMes.filter(isVencida);

  const totalPendente = pendentesMes.reduce((s, c) => s + Number(c.valorOriginal), 0);
  const totalGeralMes = doMes.reduce((s, c) => s + Number(c.valorOriginal), 0);
  const pct = totalGeralMes > 0 ? Math.round((pagasMes.length / doMes.length) * 100) : 0;

  $('#summaryPendenteValor').textContent = formatBRL(totalPendente);
  $('#summaryVencidas').textContent = vencidasMes.length;
  $('#summaryPagas').textContent = pagasMes.length;

  const circumference = 326.7;
  const offset = circumference - (pct / 100) * circumference;
  $('#ringProgress').style.strokeDashoffset = doMes.length ? offset : circumference;
  $('#ringPercent').textContent = `${pct}%`;
}

/* =========================================================
   ABA "POR PERÍODO"
   ========================================================= */

let periodoRef = (() => {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() };
})();

function contaPassaNoFiltro(conta, f) {
  if (!f) return true;
  if (f.categoria && conta.categoria !== f.categoria) return false;
  if (f.status && conta.status !== f.status) return false;
  if (f.dataInicio && conta.dataVencimento < f.dataInicio) return false;
  if (f.dataFim && conta.dataVencimento > f.dataFim) return false;
  return true;
}

function renderPeriodo() {
  $('#mesAtualLabel').textContent = nomeMes(periodoRef.ano, periodoRef.mes);

  const filtroAtivo = filtros.find(f => f.id === filtroAtivoId);

  let doMes = contas.filter(c => {
    const d = parseISO(c.dataVencimento);
    return d.getFullYear() === periodoRef.ano && d.getMonth() === periodoRef.mes;
  });

  if (filtroAtivo) {
    doMes = doMes.filter(c => contaPassaNoFiltro(c, filtroAtivo));
  }

  doMes = ordenarPendentes(doMes);

  const container = $('#listaPeriodo');
  container.innerHTML = '';
  doMes.forEach(c => container.appendChild(criarLinhaConta(c, { mostrarDataPagamento: c.status === 'pago' })));
  $('#emptyPeriodo').hidden = doMes.length > 0;

  const total = doMes.reduce((s, c) => s + Number(c.valorOriginal), 0);
  const pagas = doMes.filter(c => c.status === 'pago').length;
  $('#periodoResumo').innerHTML = `<strong>${doMes.length}</strong> conta(s) · <strong>${formatBRL(total)}</strong> no total · <strong>${pagas}</strong> paga(s)`;

  renderFiltrosPinados();
}

function renderFiltrosPinados() {
  const container = $('#filtrosPinados');
  container.innerHTML = '';
  filtros.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'filtro-chip' + (f.id === filtroAtivoId ? ' active' : '');
    const label = document.createElement('span');
    label.textContent = f.nome;
    chip.appendChild(label);

    const remove = document.createElement('button');
    remove.className = 'filtro-remove';
    remove.textContent = '×';
    remove.title = 'Remover filtro';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      filtros = filtros.filter(x => x.id !== f.id);
      saveFiltros(filtros);
      if (filtroAtivoId === f.id) filtroAtivoId = null;
      renderPeriodo();
    });
    chip.appendChild(remove);

    chip.addEventListener('click', () => {
      filtroAtivoId = (filtroAtivoId === f.id) ? null : f.id;
      renderPeriodo();
    });

    container.appendChild(chip);
  });
}

$('#mesAnterior').addEventListener('click', () => {
  periodoRef.mes -= 1;
  if (periodoRef.mes < 0) { periodoRef.mes = 11; periodoRef.ano -= 1; }
  renderPeriodo();
});
$('#mesProximo').addEventListener('click', () => {
  periodoRef.mes += 1;
  if (periodoRef.mes > 11) { periodoRef.mes = 0; periodoRef.ano += 1; }
  renderPeriodo();
});

/* Novo filtro personalizado */
$('#btnNovoFiltro').addEventListener('click', () => abrirModal('#modalFiltro'));

$('#formFiltro').addEventListener('submit', (e) => {
  e.preventDefault();
  const novo = {
    id: uid(),
    nome: $('#ffNome').value.trim(),
    categoria: $('#ffCategoria').value,
    status: $('#ffStatus').value,
    dataInicio: $('#ffInicio').value,
    dataFim: $('#ffFim').value,
  };
  filtros.push(novo);
  saveFiltros(filtros);
  filtroAtivoId = novo.id;
  fecharTodosModais();
  e.target.reset();
  renderPeriodo();
  toast('Filtro salvo e fixado');
});

/* =========================================================
   ABAS PRINCIPAIS
   ========================================================= */

$$('.tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    $$('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tabBtn.classList.add('active');
    tabBtn.setAttribute('aria-selected', 'true');
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    $('#panel-' + tabBtn.dataset.tab).classList.add('active');
    if (tabBtn.dataset.tab === 'periodo') renderPeriodo();
  });
});

/* =========================================================
   MODAIS — controle genérico
   ========================================================= */

function abrirModal(sel) { $(sel).hidden = false; }
function fecharTodosModais() {
  $$('.modal-overlay').forEach(m => m.hidden = true);
}
$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
});
$$('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.modal-overlay').hidden = true);
});

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* =========================================================
   DETALHE DA CONTA
   ========================================================= */

let contaSelecionadaId = null;

function abrirDetalhe(id) {
  const conta = contas.find(c => c.id === id);
  if (!conta) return;
  contaSelecionadaId = id;

  const vencida = isVencida(conta);
  const statusClasse = conta.status === 'pago' ? 'pago' : (vencida ? 'vencida' : 'pendente');
  const statusTexto = conta.status === 'pago' ? 'Paga' : (vencida ? 'Vencida' : 'Pendente');

  $('#detCategoria').textContent = conta.categoria;
  $('#detStatus').textContent = statusTexto;
  $('#detStatus').className = `status-pill ${statusClasse}`;
  $('#detNome').textContent = conta.nome;
  $('#detValorOriginal').textContent = formatBRL(conta.valorOriginal);
  $('#detVencimento').textContent = formatDataBR(conta.dataVencimento);
  $('#detValorPago').textContent = conta.valorPago != null ? formatBRL(conta.valorPago) : '—';
  $('#detDataPagamento').textContent = conta.dataPagamento ? formatDataBR(conta.dataPagamento) : '—';

  if (conta.observacoes) {
    $('#detObsWrap').hidden = false;
    $('#detObs').textContent = conta.observacoes;
  } else {
    $('#detObsWrap').hidden = true;
  }

  $('#detRecorrenteTag').hidden = !conta.recorrente;

  $('#btnMarcarPago').style.display = conta.status === 'pago' ? 'none' : '';
  $('#btnMarcarPago').textContent = 'Marcar como pago';

  abrirModal('#modalDetalhe');
}

$('#btnEditar').addEventListener('click', () => {
  fecharTodosModais();
  abrirFormEdicao(contaSelecionadaId);
});

$('#btnMarcarPago').addEventListener('click', () => {
  fecharTodosModais();
  abrirFormPagamento(contaSelecionadaId);
});

/* =========================================================
   FORMULÁRIO — criar / editar / marcar como pago
   ========================================================= */

let modoForm = 'novo'; // 'novo' | 'editar' | 'pagar'
let contaEmEdicaoId = null;

function limparForm() {
  $('#formConta').reset();
  $('#fId').value = '';
  $('#pagamentoFields').style.opacity = '1';
  $$('#pagamentoFields input').forEach(i => i.disabled = false);
}

function abrirFormNovo() {
  modoForm = 'novo';
  contaEmEdicaoId = null;
  limparForm();
  $('#formTitulo').textContent = 'Nova conta';
  $('#btnSalvarForm').textContent = 'Salvar';
  abrirModal('#modalForm');
}

function preencherFormComConta(conta) {
  $('#fId').value = conta.id;
  $('#fCategoria').value = conta.categoria;
  $('#fNome').value = conta.nome;
  $('#fValorOriginal').value = conta.valorOriginal;
  $('#fVencimento').value = conta.dataVencimento;
  $('#fValorPago').value = conta.valorPago != null ? conta.valorPago : '';
  $('#fDataPagamento').value = conta.dataPagamento || '';
  $('#fObservacoes').value = conta.observacoes || '';
  $('#fRecorrente').checked = !!conta.recorrente;
}

function abrirFormEdicao(id) {
  const conta = contas.find(c => c.id === id);
  if (!conta) return;
  modoForm = 'editar';
  contaEmEdicaoId = id;
  limparForm();
  preencherFormComConta(conta);
  $('#formTitulo').textContent = 'Editar conta';
  $('#btnSalvarForm').textContent = 'Salvar alterações';
  abrirModal('#modalForm');
}

function abrirFormPagamento(id) {
  const conta = contas.find(c => c.id === id);
  if (!conta) return;
  modoForm = 'pagar';
  contaEmEdicaoId = id;
  limparForm();
  preencherFormComConta(conta);
  $('#fValorPago').value = conta.valorOriginal;
  $('#fDataPagamento').value = hojeISO();
  $('#formTitulo').textContent = 'Marcar como pago';
  $('#btnSalvarForm').textContent = 'Confirmar pagamento';
  abrirModal('#modalForm');
}

$('#btnNovaConta').addEventListener('click', abrirFormNovo);

/* --- Guarda estado anterior do checkbox "recorrente" para detectar quando é desmarcado --- */
let recorrenteEstadoAnterior = false;
$('#fRecorrente').addEventListener('change', (e) => {
  // Se estava marcado e o usuário desmarcou, e é uma conta que já existe e pertence a uma série:
  if (!e.target.checked && contaEmEdicaoId) {
    const conta = contas.find(c => c.id === contaEmEdicaoId);
    if (conta && conta.recorrenciaId) {
      const futuras = contas.filter(c => c.recorrenciaId === conta.recorrenciaId && c.dataVencimento > conta.dataVencimento);
      if (futuras.length > 0) {
        perguntarExclusaoFuturas(conta);
      } else {
        // sem futuras, apenas desativa a série
        if (series[conta.recorrenciaId]) series[conta.recorrenciaId].ativo = false;
        saveSeries(series);
      }
    }
  }
});

function perguntarExclusaoFuturas(conta) {
  $('#confirmTexto').textContent = 'Deseja excluir todas as cobranças futuras desta conta recorrente? A conta atual será mantida.';
  abrirModal('#modalConfirm');

  const onSim = () => {
    contas = contas.filter(c => !(c.recorrenciaId === conta.recorrenciaId && c.dataVencimento > conta.dataVencimento));
    if (series[conta.recorrenciaId]) series[conta.recorrenciaId].ativo = false;
    saveContas(contas);
    saveSeries(series);
    fecharTodosModais();
    toast('Cobranças futuras removidas');
    // reabre o form de edição para o usuário continuar
    abrirFormEdicao(conta.id);
    limpar();
  };
  const onNao = () => {
    if (series[conta.recorrenciaId]) series[conta.recorrenciaId].ativo = false;
    saveSeries(series);
    fecharTodosModais();
    abrirFormEdicao(conta.id);
    limpar();
  };
  function limpar() {
    $('#confirmSim').removeEventListener('click', onSim);
    $('#confirmNao').removeEventListener('click', onNao);
  }
  $('#confirmSim').addEventListener('click', onSim);
  $('#confirmNao').addEventListener('click', onNao);
}

$('#formConta').addEventListener('submit', (e) => {
  e.preventDefault();

  const dados = {
    categoria: $('#fCategoria').value,
    nome: $('#fNome').value.trim(),
    valorOriginal: parseFloat($('#fValorOriginal').value),
    dataVencimento: $('#fVencimento').value,
    valorPago: $('#fValorPago').value !== '' ? parseFloat($('#fValorPago').value) : null,
    dataPagamento: $('#fDataPagamento').value || null,
    observacoes: $('#fObservacoes').value.trim(),
    recorrente: $('#fRecorrente').checked,
  };

  if (modoForm === 'novo') {
    const id = uid();
    let recorrenciaId = null;

    if (dados.recorrente) {
      recorrenciaId = uid();
      series[recorrenciaId] = { ativo: true };
    }

    const novaConta = {
      id, ...dados, status: 'pendente', recorrenciaId,
    };
    // se marcado como pago diretamente na criação (raro, mas suportado)
    if (dados.valorPago != null && dados.dataPagamento) novaConta.status = 'pago';

    contas.push(novaConta);

    if (recorrenciaId) {
      for (let i = 1; i <= 11; i++) {
        contas.push({
          id: uid(),
          categoria: dados.categoria,
          nome: dados.nome,
          valorOriginal: dados.valorOriginal,
          dataVencimento: addMonths(dados.dataVencimento, i),
          valorPago: null,
          dataPagamento: null,
          observacoes: dados.observacoes,
          recorrente: true,
          recorrenciaId,
          status: 'pendente',
        });
      }
    }

    saveContas(contas);
    saveSeries(series);
    toast('Conta lançada');
  }

  if (modoForm === 'editar' || modoForm === 'pagar') {
    const idx = contas.findIndex(c => c.id === contaEmEdicaoId);
    if (idx !== -1) {
      const contaAtual = contas[idx];

      // Se marcou recorrente numa conta que ainda não fazia parte de série, cria série a partir daqui
      let recorrenciaId = contaAtual.recorrenciaId;
      if (dados.recorrente && !recorrenciaId) {
        recorrenciaId = uid();
        series[recorrenciaId] = { ativo: true };
        saveSeries(series);
      }

      const status = (dados.valorPago != null && dados.dataPagamento) ? 'pago' : 'pendente';

      contas[idx] = {
        ...contaAtual,
        ...dados,
        recorrenciaId: dados.recorrente ? recorrenciaId : null,
        status,
      };
      saveContas(contas);
      toast(modoForm === 'pagar' ? 'Pagamento confirmado' : 'Conta atualizada');
    }
  }

  fecharTodosModais();
  ensureRecurringCoverage();
  renderTudo();
});

/* =========================================================
   RENDER GERAL
   ========================================================= */

function renderTudo() {
  renderResumo();
  renderPendentes();
  renderPagas();
  const painelPeriodoAtivo = $('#panel-periodo').classList.contains('active');
  if (painelPeriodoAtivo) renderPeriodo();
}

/* =========================================================
   INIT
   ========================================================= */

ensureRecurringCoverage();
renderTudo();

/* Registro do service worker (permite instalar como app / uso offline) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
