/* =========================================================
   Contas a Pagar — lógica do app
   Persistência: localStorage (100% local)
   ========================================================= */

const STORAGE_KEY = 'contasPagar.contas';
const SCHEMA_VERSION_KEY = 'contasPagar.schemaVersion';
const SCHEMA_VERSION_ATUAL = 2; // v2 = valores monetários em centavos inteiros
const SERIES_KEY = 'contasPagar.series';
const FILTROS_KEY = 'contasPagar.filtros';
const CATEGORIAS_KEY = 'contasPagar.categorias';
const CATEGORIAS_PADRAO = ['Moradia', 'Contas fixas', 'Cartão de crédito', 'Transporte', 'Saúde', 'Educação', 'Alimentação', 'Lazer', 'Assinaturas', 'Impostos', 'Outros'];

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
function loadCategorias() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORIAS_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* ignora e usa padrão */ }
  return [...CATEGORIAS_PADRAO];
}
function saveCategorias(cats) {
  localStorage.setItem(CATEGORIAS_KEY, JSON.stringify(cats));
}

let contas = loadContas();
let series = loadSeries();
let filtros = loadFiltros();
let categorias = loadCategorias();

// Versões anteriores do app guardavam valorOriginal/valorPago em reais
// (ponto flutuante). A partir daqui eles passam a ser inteiros em
// centavos. Essa migração roda uma única vez, convertendo dados já
// salvos no aparelho para o novo formato.
function migrarParaCentavosSeNecessario() {
  const versaoSalva = parseInt(localStorage.getItem(SCHEMA_VERSION_KEY) || '1', 10);
  if (versaoSalva >= SCHEMA_VERSION_ATUAL) return;

  contas = contas.map(c => ({
    ...c,
    valorOriginal: c.valorOriginal != null ? Math.round(Number(c.valorOriginal) * 100) : null,
    valorPago: c.valorPago != null ? Math.round(Number(c.valorPago) * 100) : null,
  }));
  saveContas(contas);
  localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION_ATUAL));
}
migrarParaCentavosSeNecessario();
let filtroAtivoId = null;

/* =========================================================
   CATEGORIAS
   ========================================================= */

// Preenche um <select> com as categorias atuais, preservando a 1ª option
// (placeholder) e adicionando "+ Criar nova categoria..." ao final.
function popularSelectCategorias(selectEl) {
  const placeholder = selectEl.options[0] ? selectEl.options[0].cloneNode(true) : null;
  const valorAtual = selectEl.value;
  selectEl.innerHTML = '';
  if (placeholder) selectEl.appendChild(placeholder);
  categorias.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });
  const novaOpt = document.createElement('option');
  novaOpt.value = '__nova__';
  novaOpt.textContent = '+ Criar nova categoria...';
  selectEl.appendChild(novaOpt);
  if (categorias.includes(valorAtual)) selectEl.value = valorAtual;
}

function refreshCategoriaSelects() {
  popularSelectCategorias($('#fCategoria'));
  popularSelectCategorias($('#ffCategoria'));
}

// Select que disparou o fluxo de "+ Criar nova categoria...", para já
// deixá-la selecionada assim que for criada. Nulo quando o modal foi
// aberto pelo link "Gerenciar categorias".
let categoriaSelectAlvo = null;

function tratarSelecaoCategoria(selectEl) {
  if (selectEl.value === '__nova__') {
    selectEl.value = '';
    categoriaSelectAlvo = selectEl;
    abrirModal('#modalCategorias');
    setTimeout(() => $('#novaCategoriaInput').focus(), 50);
  }
}
$('#fCategoria').addEventListener('change', () => tratarSelecaoCategoria($('#fCategoria')));
$('#ffCategoria').addEventListener('change', () => tratarSelecaoCategoria($('#ffCategoria')));

// Sugere, no campo "Nome da conta", os nomes já usados anteriormente
// dentro da categoria selecionada (ex.: categoria "Assinaturas" já tendo
// "Netflix" e "Spotify" lançados antes). O campo continua totalmente
// livre para digitação — isso só oferece atalhos via datalist.
function popularSugestoesNome() {
  const datalist = $('#fNomeSugestoes');
  datalist.innerHTML = '';
  const categoriaAtual = $('#fCategoria').value;
  if (!categoriaAtual || categoriaAtual === '__nova__') return;
  const nomes = [...new Set(
    contas.filter(c => c.categoria === categoriaAtual).map(c => c.nome).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  nomes.forEach(nome => {
    const opt = document.createElement('option');
    opt.value = nome;
    datalist.appendChild(opt);
  });
}
$('#fCategoria').addEventListener('change', popularSugestoesNome);

function renderCategoriasModal() {
  const lista = $('#categoriasLista');
  lista.innerHTML = '';
  if (categorias.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'categorias-vazio';
    vazio.textContent = 'Nenhuma categoria cadastrada.';
    lista.appendChild(vazio);
    return;
  }
  categorias.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'categoria-row';

    const nome = document.createElement('span');
    nome.className = 'categoria-nome';
    nome.textContent = cat;

    const acoes = document.createElement('div');
    acoes.className = 'categoria-acoes';

    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'categoria-editar';
    editar.textContent = '✎';
    editar.title = 'Renomear categoria';
    editar.addEventListener('click', () => ativarEdicaoCategoria(row, cat));

    const excluir = document.createElement('button');
    excluir.type = 'button';
    excluir.className = 'categoria-excluir';
    excluir.textContent = '×';
    excluir.title = 'Excluir categoria';
    excluir.addEventListener('click', () => confirmarExclusaoCategoria(cat));

    acoes.appendChild(editar);
    acoes.appendChild(excluir);
    row.appendChild(nome);
    row.appendChild(acoes);
    lista.appendChild(row);
  });
}

function ativarEdicaoCategoria(row, catOriginal) {
  row.innerHTML = '';
  row.classList.add('categoria-row--editando');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'categoria-edit-input';
  input.maxLength = 30;
  input.value = catOriginal;

  const acoes = document.createElement('div');
  acoes.className = 'categoria-acoes';

  const salvar = document.createElement('button');
  salvar.type = 'button';
  salvar.className = 'categoria-salvar';
  salvar.textContent = '✓';
  salvar.title = 'Salvar novo nome';

  const cancelar = document.createElement('button');
  cancelar.type = 'button';
  cancelar.className = 'categoria-excluir';
  cancelar.textContent = '×';
  cancelar.title = 'Cancelar';

  function confirmarEdicao() {
    renomearCategoria(catOriginal, input.value.trim());
  }
  salvar.addEventListener('click', confirmarEdicao);
  cancelar.addEventListener('click', () => renderCategoriasModal());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmarEdicao(); }
    if (e.key === 'Escape') { e.preventDefault(); renderCategoriasModal(); }
  });

  acoes.appendChild(salvar);
  acoes.appendChild(cancelar);
  row.appendChild(input);
  row.appendChild(acoes);
  input.focus();
  input.select();
}

function renomearCategoria(nomeAntigo, nomeNovo) {
  if (!nomeNovo) { renderCategoriasModal(); return; }
  if (nomeNovo === nomeAntigo) { renderCategoriasModal(); return; }

  const conflito = categorias.some(c => c.toLowerCase() === nomeNovo.toLowerCase() && c !== nomeAntigo);
  if (conflito) {
    toast('Já existe uma categoria com esse nome');
    renderCategoriasModal();
    return;
  }

  categorias = categorias.map(c => c === nomeAntigo ? nomeNovo : c);
  saveCategorias(categorias);

  contas.forEach(c => { if (c.categoria === nomeAntigo) c.categoria = nomeNovo; });
  saveContas(contas);

  filtros.forEach(f => { if (f.categoria === nomeAntigo) f.categoria = nomeNovo; });
  saveFiltros(filtros);

  refreshCategoriaSelects();
  renderCategoriasModal();
  renderTudo();
  toast('Categoria renomeada');
}

function confirmarExclusaoCategoria(cat) {
  confirmar(
    `Excluir a categoria "${cat}"? Contas já lançadas mantêm o nome, mas ela não aparecerá mais na lista para novos lançamentos.`,
    () => {
      categorias = categorias.filter(c => c !== cat);
      saveCategorias(categorias);
      refreshCategoriaSelects();
      renderCategoriasModal();
      abrirModal('#modalCategorias');
      toast('Categoria excluída');
    },
    () => {
      abrirModal('#modalCategorias');
    }
  );
}

$('#btnGerenciarCategorias').addEventListener('click', () => {
  categoriaSelectAlvo = null;
  renderCategoriasModal();
  abrirModal('#modalCategorias');
});
$('#btnGerenciarCategoriasFiltro').addEventListener('click', () => {
  categoriaSelectAlvo = null;
  renderCategoriasModal();
  abrirModal('#modalCategorias');
});

$('#formNovaCategoria').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#novaCategoriaInput');
  const nome = input.value.trim();
  if (!nome) return;

  const jaExiste = categorias.some(c => c.toLowerCase() === nome.toLowerCase());
  if (jaExiste) {
    toast('Essa categoria já existe');
    return;
  }

  categorias.push(nome);
  saveCategorias(categorias);
  refreshCategoriaSelects();
  input.value = '';

  if (categoriaSelectAlvo) {
    categoriaSelectAlvo.value = nome;
    const alvo = categoriaSelectAlvo;
    categoriaSelectAlvo = null;
    fecharTodosModais();
    alvo.focus();
    toast('Categoria criada e selecionada');
  } else {
    renderCategoriasModal();
    toast('Categoria adicionada');
  }
});

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
// Todos os valores monetários são guardados internamente como número
// INTEIRO de centavos (ex.: R$ 12,34 => 1234). Isso evita erros de
// arredondamento de ponto flutuante nas somas e comparações. Ponto
// flutuante só é usado momentaneamente na exportação/importação do
// backup em Excel (formato mais legível para humanos), sempre com
// arredondamento explícito ao converter de volta para centavos.

// Formata um valor em CENTAVOS para exibição em reais (ex.: 1234 -> "R$ 12,34").
function formatBRL(centavos) {
  const c = Number.isFinite(centavos) ? Math.trunc(centavos) : 0;
  const negativo = c < 0;
  const abs = Math.abs(c);
  const reais = Math.floor(abs / 100);
  const parte = abs % 100;
  const reaisFormatado = reais.toLocaleString('pt-BR');
  return `${negativo ? '-' : ''}R$ ${reaisFormatado},${String(parte).padStart(2, '0')}`;
}
function formatValorOuIndefinido(centavos) {
  if (centavos === null || centavos === undefined || centavos === '') return 'Valor a definir';
  return formatBRL(centavos);
}

/* ---------- Máscara de moeda para os campos de valor (baseada em centavos inteiros) ---------- */

// Formata um número INTEIRO de centavos como texto mascarado (ex.: 1234 -> "12,34").
function centavosParaTexto(centavos) {
  if (centavos === null || centavos === undefined || centavos === '') return '';
  const c = Math.trunc(Number(centavos));
  const negativo = c < 0;
  const abs = Math.abs(c);
  const reais = Math.floor(abs / 100);
  const parte = abs % 100;
  return `${negativo ? '-' : ''}${reais.toLocaleString('pt-BR')},${String(parte).padStart(2, '0')}`;
}

function aplicarMascaraMoeda(e) {
  const el = e.target;
  const digitos = el.value.replace(/\D/g, '').slice(0, 12);
  const centavos = digitos ? parseInt(digitos, 10) : null;
  el.value = centavosParaTexto(centavos);
  const fim = el.value.length;
  el.setSelectionRange(fim, fim);
}

// Converte o texto mascarado (ex.: "1.234,56") direto para CENTAVOS inteiros (123456),
// extraindo apenas os dígitos — sem nenhuma divisão/multiplicação em ponto flutuante.
function textoParaCentavos(texto) {
  if (!texto) return null;
  const digitos = texto.replace(/\D/g, '');
  return digitos ? parseInt(digitos, 10) : null;
}

$('#fValorOriginal').addEventListener('input', aplicarMascaraMoeda);
$('#fValorPago').addEventListener('input', aplicarMascaraMoeda);
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

  const valorBruto = conta.status === 'pago' ? conta.valorPago : conta.valorOriginal;
  const semValor = valorBruto === null || valorBruto === undefined || valorBruto === '';
  const valor = document.createElement('div');
  valor.className = `conta-valor ${stripeClass === 'vencida' ? 'vencida' : ''} ${conta.status === 'pago' ? 'pago' : ''} ${semValor ? 'sem-valor' : ''}`;
  valor.textContent = formatValorOuIndefinido(valorBruto);

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
  $('#detValorOriginal').textContent = formatValorOuIndefinido(conta.valorOriginal);
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
  $('#fValorPago').required = false;
  $('#fDataPagamento').required = false;
}

function abrirFormNovo() {
  modoForm = 'novo';
  contaEmEdicaoId = null;
  limparForm();
  popularSugestoesNome();
  $('#formTitulo').textContent = 'Nova conta';
  $('#btnSalvarForm').textContent = 'Salvar';
  abrirModal('#modalForm');
}

function garantirOpcaoCategoria(selectEl, cat) {
  if (!cat) return;
  const existe = Array.from(selectEl.options).some(o => o.value === cat);
  if (!existe) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${cat} (excluída)`;
    selectEl.insertBefore(opt, selectEl.options[1] || null);
  }
}

function preencherFormComConta(conta) {
  $('#fId').value = conta.id;
  garantirOpcaoCategoria($('#fCategoria'), conta.categoria);
  $('#fCategoria').value = conta.categoria;
  popularSugestoesNome();
  $('#fNome').value = conta.nome;
  $('#fValorOriginal').value = centavosParaTexto(conta.valorOriginal);
  $('#fVencimento').value = conta.dataVencimento;
  $('#fValorPago').value = centavosParaTexto(conta.valorPago);
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
  $('#fValorPago').value = centavosParaTexto(conta.valorOriginal);
  $('#fDataPagamento').value = hojeISO();
  $('#fValorPago').required = true;
  $('#fDataPagamento').required = true;
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

// Helper genérico de confirmação sim/não. Fecha os modais e dispara o
// callback correspondente; quem chamar decide se reabre algum modal depois.
function confirmar(texto, onSim, onNao) {
  $('#confirmTexto').textContent = texto;
  abrirModal('#modalConfirm');

  const simBtn = $('#confirmSim');
  const naoBtn = $('#confirmNao');

  function limpar() {
    simBtn.removeEventListener('click', handleSim);
    naoBtn.removeEventListener('click', handleNao);
  }
  function handleSim() { limpar(); fecharTodosModais(); if (onSim) onSim(); }
  function handleNao() { limpar(); fecharTodosModais(); if (onNao) onNao(); }

  simBtn.addEventListener('click', handleSim);
  naoBtn.addEventListener('click', handleNao);
}

function perguntarExclusaoFuturas(conta) {
  confirmar(
    'Deseja excluir todas as cobranças futuras desta conta recorrente? A conta atual será mantida.',
    () => {
      contas = contas.filter(c => !(c.recorrenciaId === conta.recorrenciaId && c.dataVencimento > conta.dataVencimento));
      if (series[conta.recorrenciaId]) series[conta.recorrenciaId].ativo = false;
      saveContas(contas);
      saveSeries(series);
      toast('Cobranças futuras removidas');
      abrirFormEdicao(conta.id);
    },
    () => {
      if (series[conta.recorrenciaId]) series[conta.recorrenciaId].ativo = false;
      saveSeries(series);
      abrirFormEdicao(conta.id);
    }
  );
}

$('#formConta').addEventListener('submit', (e) => {
  e.preventDefault();

  const dados = {
    categoria: $('#fCategoria').value,
    nome: $('#fNome').value.trim(),
    valorOriginal: textoParaCentavos($('#fValorOriginal').value),
    dataVencimento: $('#fVencimento').value,
    valorPago: textoParaCentavos($('#fValorPago').value),
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
   BACKUP LOCAL (exportar / importar planilha .xlsx)
   ========================================================= */

const COLUNAS_CONTAS = ['id', 'categoria', 'nome', 'valorOriginal', 'dataVencimento', 'valorPago', 'dataPagamento', 'observacoes', 'recorrente', 'recorrenciaId', 'status'];
const COLUNAS_CATEGORIAS = ['nome'];
const COLUNAS_FILTROS = ['id', 'nome', 'categoria', 'status', 'dataInicio', 'dataFim'];
const COLUNAS_SERIES = ['recorrenciaId', 'ativo'];

function planilhaDe(linhas, colunas) {
  if (!linhas.length) return XLSX.utils.aoa_to_sheet([colunas]);
  return XLSX.utils.json_to_sheet(linhas, { header: colunas });
}

// Só na fronteira com a planilha (que humanos vão ler/editar) os valores
// aparecem em reais decimais — as contas de verdade continuam em centavos.
function centavosParaReaisOuNull(centavos) {
  return (centavos === null || centavos === undefined) ? null : centavos / 100;
}

function exportarBackup() {
  if (typeof XLSX === 'undefined') {
    toast('Não foi possível carregar o gerador de planilhas. Verifique sua conexão.');
    return;
  }

  const wb = XLSX.utils.book_new();

  const contasParaExportar = contas.map(c => ({
    ...c,
    valorOriginal: centavosParaReaisOuNull(c.valorOriginal),
    valorPago: centavosParaReaisOuNull(c.valorPago),
  }));

  XLSX.utils.book_append_sheet(wb, planilhaDe(contasParaExportar, COLUNAS_CONTAS), 'Contas');
  XLSX.utils.book_append_sheet(wb, planilhaDe(categorias.map(nome => ({ nome })), COLUNAS_CATEGORIAS), 'Categorias');
  XLSX.utils.book_append_sheet(wb, planilhaDe(filtros, COLUNAS_FILTROS), 'Filtros');
  XLSX.utils.book_append_sheet(
    wb,
    planilhaDe(Object.keys(series).map(id => ({ recorrenciaId: id, ativo: !!series[id].ativo })), COLUNAS_SERIES),
    'Series'
  );

  XLSX.writeFile(wb, `contas-a-pagar-backup-${hojeISO()}.xlsx`);
  toast('Backup exportado');
}

function paraBooleano(valor) {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor !== 0;
  if (typeof valor === 'string') return ['true', '1', 'verdadeiro'].includes(valor.trim().toLowerCase());
  return false;
}

function paraNumeroOuNull(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isNaN(n) ? null : n;
}

// Planilha traz reais decimais (ex.: 12.34); convertemos para centavos
// inteiros com arredondamento explícito, absorvendo aqui qualquer
// imprecisão de ponto flutuante que a própria planilha possa ter.
function reaisParaCentavosOuNull(valor) {
  const n = paraNumeroOuNull(valor);
  return n === null ? null : Math.round(n * 100);
}

function normalizarDataImportada(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) {
    return isoFromParts(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  if (typeof valor === 'number' && window.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code) {
    const p = XLSX.SSF.parse_date_code(valor);
    if (p) return isoFromParts(p.y, p.m - 1, p.d);
  }
  const texto = String(valor).trim();
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : (texto || null);
}

function lerAba(wb, nomeAba) {
  const sheet = wb.Sheets[nomeAba];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: null }) : [];
}

function importarBackup(file) {
  if (typeof XLSX === 'undefined') {
    toast('Não foi possível carregar o leitor de planilhas. Verifique sua conexão.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    let wb;
    try {
      wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
    } catch (err) {
      toast('Não foi possível ler esse arquivo. Verifique se é uma planilha .xlsx válida.');
      return;
    }

    const contasRows = lerAba(wb, 'Contas');
    const categoriasRows = lerAba(wb, 'Categorias');
    const filtrosRows = lerAba(wb, 'Filtros');
    const seriesRows = lerAba(wb, 'Series');

    if (contasRows.length === 0 && categoriasRows.length === 0) {
      toast('Esse arquivo não parece ser um backup válido deste app.');
      return;
    }

    confirmar(
      'Importar esta planilha vai substituir todos os dados atuais do app (contas, categorias e filtros). Deseja continuar?',
      () => {
        contas = contasRows
          .filter(r => r.nome || r.id)
          .map(r => ({
            id: r.id ? String(r.id) : uid(),
            categoria: r.categoria || '',
            nome: r.nome || '',
            valorOriginal: reaisParaCentavosOuNull(r.valorOriginal),
            dataVencimento: normalizarDataImportada(r.dataVencimento) || hojeISO(),
            valorPago: reaisParaCentavosOuNull(r.valorPago),
            dataPagamento: normalizarDataImportada(r.dataPagamento),
            observacoes: r.observacoes || '',
            recorrente: paraBooleano(r.recorrente),
            recorrenciaId: r.recorrenciaId ? String(r.recorrenciaId) : null,
            status: r.status === 'pago' ? 'pago' : 'pendente',
          }));

        categorias = categoriasRows.map(r => r.nome).filter(Boolean);
        if (categorias.length === 0) categorias = [...CATEGORIAS_PADRAO];

        filtros = filtrosRows
          .filter(r => r.nome)
          .map(r => ({
            id: r.id ? String(r.id) : uid(),
            nome: r.nome,
            categoria: r.categoria || '',
            status: r.status || '',
            dataInicio: normalizarDataImportada(r.dataInicio) || '',
            dataFim: normalizarDataImportada(r.dataFim) || '',
          }));

        series = {};
        seriesRows.forEach(r => {
          if (r.recorrenciaId) series[String(r.recorrenciaId)] = { ativo: paraBooleano(r.ativo) };
        });

        saveContas(contas);
        saveCategorias(categorias);
        saveFiltros(filtros);
        saveSeries(series);
        filtroAtivoId = null;

        ensureRecurringCoverage();
        refreshCategoriaSelects();
        renderTudo();
        toast('Backup importado com sucesso');
      }
    );
  };
  reader.readAsArrayBuffer(file);
}

$('#btnBackup').addEventListener('click', () => abrirModal('#modalBackup'));
$('#btnExportarBackup').addEventListener('click', exportarBackup);
$('#btnImportarBackup').addEventListener('click', () => $('#inputImportarBackup').click());
$('#inputImportarBackup').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importarBackup(file);
  e.target.value = '';
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
refreshCategoriaSelects();
renderTudo();

/* Registro do service worker (permite instalar como app / uso offline) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
