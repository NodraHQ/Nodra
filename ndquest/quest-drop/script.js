/* =========================================================
   PACOTES DE PERGUNTAS E TEMAS DE MARCA
   Conteúdo (perguntas) e identidade visual (branding) vivem
   fora deste arquivo. Para adicionar ou trocar qualquer um
   dos dois, edite apenas as pastas /questions e /branding —
   o script.js não precisa ser alterado.

   Exceção deliberada: a opção "Minhas Próprias Perguntas" (uso
   pessoal, não salvo — ver bloco CUSTOM PACK mais abaixo) monta
   um pacote em memória a partir do que a pessoa colar/enviar, e
   por isso precisa de lógica própria aqui. Isso não substitui o
   sistema de manifestos, é um terceiro caminho além dele.
   ========================================================= */
import questionPacks from './questions/questions-manifest.js';
import themes from './branding/branding-manifest.js';
import translations from './i18n/translations.js';

/* =========================================================
   ESTADO EM MEMÓRIA
   ========================================================= */
const state = {
  language: 'pt',     // idioma ativo da interface e das perguntas ('pt' | 'en')
  envelopes: [],      // [{ prizeLabel: String|null, difficulty: 'easy'|'medium'|'hard', conquered: Boolean }]
  unit: 'USD',
  prizeMode: 'budget', // 'budget' (número calculado) | 'list' (sorteia do estoque)
  prizeStock: { easy: [], medium: [], hard: [] }, // [{ label, quantity }], descontado a cada acerto no modo lista
  questionPack: null, // pacote de perguntas selecionado para o evento atual
  theme: null,        // tema de marca selecionado para o evento atual
  usedQuestionIndexes: { easy: [], medium: [], hard: [] }, // índices descartados nesta sessão, por nível
  currentEnvelopeIndex: null,
  currentCorrectAnswer: null,
  lastAnswerCorrect: null
};

/* =========================================================
   REFERÊNCIAS DOM
   ========================================================= */
const screenConfig = document.getElementById('screen-config');
const screenEnvelopes = document.getElementById('screen-envelopes');

const budgetInput = document.getElementById('budget-input');
const envelopeCountInput = document.getElementById('envelope-count-input');
const prizeModeSelect = document.getElementById('prize-mode-select');
const budgetModeOnlyEls = document.querySelectorAll('.budget-mode-only');
const prizeModeOnlyEls = document.querySelectorAll('.prize-mode-only');
const prizeListSummary = document.getElementById('prize-list-summary');
const prizeListStatus = document.getElementById('prize-list-status');
const openPrizeModalBtn = document.getElementById('open-prize-modal-btn');
const prizeOverlay = document.getElementById('prize-overlay');
const prizeModalCloseX = document.getElementById('prize-modal-close-x');
const prizeModalDoneBtn = document.getElementById('prize-modal-done-btn');
const prizeTotalSummary = document.getElementById('prize-total-summary');
const packSelect = document.getElementById('pack-select');
const packCustomSummary = document.getElementById('pack-custom-summary');
const packCustomStatus = document.getElementById('pack-custom-status');
const openPackModalBtn = document.getElementById('open-pack-modal-btn');
const packOverlay = document.getElementById('pack-overlay');
const packModalCloseX = document.getElementById('pack-modal-close-x');
const packModalDoneBtn = document.getElementById('pack-modal-done-btn');
const bulkTextarea = document.getElementById('bulk-textarea');
const downloadTemplateBtn = document.getElementById('download-template-btn');
const fileUploadInput = document.getElementById('file-upload');
const parseBtn = document.getElementById('parse-btn');
const parseErrorsBox = document.getElementById('parse-errors');
const previewList = document.getElementById('preview-list');
const themeSelect = document.getElementById('theme-select');
const unitSelect = document.getElementById('unit-select');
const unitCustomField = document.getElementById('unit-custom-field');
const unitCustomInput = document.getElementById('unit-custom-input');

const diffEasyInput = document.getElementById('diff-easy');
const diffMediumInput = document.getElementById('diff-medium');
const diffHardInput = document.getElementById('diff-hard');
const difficultySummaryStatus = document.getElementById('difficulty-summary-status');
const openDifficultyModalBtn = document.getElementById('open-difficulty-modal-btn');
const difficultyOverlay = document.getElementById('difficulty-overlay');
const difficultyModalCloseX = document.getElementById('difficulty-modal-close-x');
const difficultyModalDoneBtn = document.getElementById('difficulty-modal-done-btn');

const budgetEasyInput = document.getElementById('budget-easy');
const budgetMediumInput = document.getElementById('budget-medium');
const budgetHardInput = document.getElementById('budget-hard');

const rewardModeSelect = document.getElementById('reward-mode-select');
const rewardWeightOnlyEls = document.querySelectorAll('.reward-weight-only');
const rewardFixedOnlyEls = document.querySelectorAll('.reward-fixed-only');
const rewardBalanceWarning = document.getElementById('reward-balance-warning');
const rewardBalanceWarningMain = document.getElementById('reward-balance-warning-main');
const fixedEasyInput = document.getElementById('fixed-easy');
const fixedMediumInput = document.getElementById('fixed-medium');
const fixedHardInput = document.getElementById('fixed-hard');
const fixedTotalSummary = document.getElementById('fixed-total-summary');
const budgetComputedDisplay = document.getElementById('budget-computed-display');

const configError = document.getElementById('config-error');
const startBtn = document.getElementById('start-btn');

const heroLogoImg = document.getElementById('hero-logo-img');
const heroBrandName = document.getElementById('hero-brand-name');
const heroSlogan = document.getElementById('hero-slogan');
const brandWatermarkImg = document.getElementById('brand-watermark-img');
const envelopeGrid = document.getElementById('envelope-grid');
const eventFinishedBadge = document.getElementById('event-finished-badge');
const backToConfigBtn = document.getElementById('back-to-config-btn');

const questionOverlay = document.getElementById('question-overlay');
const questionText = document.getElementById('question-text');
const answersList = document.getElementById('answers-list');
const questionCloseX = document.getElementById('question-close-x');

const resultOverlay = document.getElementById('result-overlay');
const resultSuccess = document.getElementById('result-success');
const resultFail = document.getElementById('result-fail');
const resultPrize = document.getElementById('result-prize');
const resultCloseX = document.getElementById('result-close-x');

const finishedOverlay = document.getElementById('finished-overlay');
const viewResultBtn = document.getElementById('view-result-btn');
const newEventBtn = document.getElementById('new-event-btn');
const finishedCloseBtn = document.getElementById('finished-close-btn');
const finishedCloseX = document.getElementById('finished-close-x');

const languageButtons = document.querySelectorAll('.language-btn');

/* =========================================================
   PACOTES DE PERGUNTAS — seletor
   ========================================================= */
function populatePackSelect() {
  packSelect.innerHTML = '';
  questionPacks.forEach((pack, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = pack.name[state.language] || pack.name.pt;
    packSelect.appendChild(option);
  });
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = t('pack.customOption');
  packSelect.appendChild(customOption);
  packCustomSummary.hidden = true;
}
populatePackSelect();

packSelect.addEventListener('change', () => {
  const isCustom = packSelect.value === 'custom';
  packCustomSummary.hidden = !isCustom;
  if (isCustom) {
    updatePackCustomSummary();
    if (customParsedQuestions.length === 0) {
      openOverlay(packOverlay);
    }
  } else {
    closeOverlay(packOverlay);
    restoreDifficultyDefaults();
  }
});

openPackModalBtn.addEventListener('click', () => openOverlay(packOverlay));
packModalCloseX.addEventListener('click', () => closeOverlay(packOverlay));
packModalDoneBtn.addEventListener('click', () => closeOverlay(packOverlay));

/* =========================================================
   PACOTE PERSONALIZADO (uso pessoal, não salvo)
   Cola/envia texto em lote, processa em memória, usa só nesta
   sessão. Não fica salvo em lugar nenhum, não fica disponível
   pra mais ninguém — é individual, diferente dos pacotes que
   aparecem pra todo mundo (esses continuam sendo arquivo em
   /questions, adicionados manualmente por enquanto).

   Formato não exige idioma: uma pergunta só, usada como PT e
   EN ao mesmo tempo (o resto do app espera question.pt/en, e é
   assim que fica compatível sem obrigar ninguém a duplicar
   texto). Só a estrutura é validada (4 respostas, dificuldade
   válida, resposta correta de 1 a 4) — isso é o mínimo pra não
   quebrar a tela do jogo, não é sobre idioma.
   ========================================================= */
let customParsedQuestions = [];

const CUSTOM_TEMPLATE_TEXT = `DIFICULDADE: facil
PERGUNTA: Qual é a capital do Brasil?
RESPOSTAS: Brasília; São Paulo; Rio de Janeiro; Salvador
CORRETA: 1
---
DIFICULDADE: medio
PERGUNTA: O que é um smart contract?
RESPOSTAS: Um contrato em papel; Código que executa regras automaticamente; Um tipo de carteira; Uma exchange
CORRETA: 2
`;

downloadTemplateBtn.addEventListener('click', () => {
  const blob = new Blob([CUSTOM_TEMPLATE_TEXT], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-perguntas-quest-drop.txt';
  a.click();
  URL.revokeObjectURL(url);
});

fileUploadInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { bulkTextarea.value = reader.result; };
  reader.readAsText(file, 'utf-8');
});

const CUSTOM_DIFFICULTY_MAP = {
  'facil': 'easy', 'fácil': 'easy', 'easy': 'easy',
  'medio': 'medium', 'médio': 'medium', 'medium': 'medium',
  'dificil': 'hard', 'difícil': 'hard', 'hard': 'hard'
};

function parseCustomBulkText(text) {
  const blocks = text.split(/\n\s*---\s*\n/).map((b) => b.trim()).filter(Boolean);
  const parsed = [];
  const errors = [];

  blocks.forEach((block, i) => {
    const label = `Pergunta ${i + 1}`;
    const data = {};
    block.split('\n').forEach((line) => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) data[match[1].trim().toUpperCase()] = match[2].trim();
    });

    const difficulty = CUSTOM_DIFFICULTY_MAP[(data['DIFICULDADE'] || '').toLowerCase()];
    if (!difficulty) {
      errors.push(`${label}: DIFICULDADE ausente ou inválida (use FACIL, MEDIO ou DIFICIL).`);
      return;
    }

    const questionText = data['PERGUNTA'];
    if (!questionText) {
      errors.push(`${label}: faltou PERGUNTA.`);
      return;
    }

    const answersRaw = data['RESPOSTAS'];
    if (!answersRaw) {
      errors.push(`${label}: faltou RESPOSTAS.`);
      return;
    }

    const answers = answersRaw.split(';').map((a) => a.trim()).filter(Boolean);
    if (answers.length !== 4) {
      errors.push(`${label}: precisa ter exatamente 4 respostas separadas por ";" (encontrei ${answers.length}).`);
      return;
    }

    const correctRaw = Number(data['CORRETA']);
    if (!correctRaw || correctRaw < 1 || correctRaw > 4) {
      errors.push(`${label}: CORRETA precisa ser um número de 1 a 4.`);
      return;
    }

    // A mesma pergunta serve pra PT e EN — o resto do app espera
    // question.pt/question.en, então preenchemos os dois com o
    // mesmo texto em vez de obrigar quem está enviando a traduzir.
    parsed.push({
      difficulty,
      question: { pt: questionText, en: questionText },
      answers: { pt: answers, en: answers },
      correct: correctRaw - 1
    });
  });

  if (parsed.length > 50) {
    errors.push(`Máximo de 50 perguntas por pacote (encontrei ${parsed.length}).`);
  }

  return { parsed, errors };
}

function renderCustomPreview(parsed, errors) {
  if (errors.length > 0) {
    parseErrorsBox.hidden = false;
    parseErrorsBox.innerHTML = `<strong>Encontrei ${errors.length} problema(s):</strong><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>`;
  } else {
    parseErrorsBox.hidden = true;
  }

  previewList.innerHTML = '';
  parsed.forEach((q) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `<span class="preview-item__tag">${q.difficulty}</span><span>${q.question.pt}</span>`;
    previewList.appendChild(item);
  });
}

function updatePackCustomSummary() {
  if (customParsedQuestions.length === 0) {
    packCustomStatus.textContent = t('pack.noneYet');
  } else {
    packCustomStatus.textContent = t('pack.someProcessed').replace('{n}', String(customParsedQuestions.length));
  }
}

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Evita gerar envelope vazio: se o pacote pessoal só tem perguntas de
// algumas dificuldades, desliga e zera as que não têm pergunta nenhuma,
// e redistribui 100% só entre as que têm.
function updateDifficultySummary() {
  const isDefault = diffEasyInput.value === '33' && diffMediumInput.value === '33' && diffHardInput.value === '34'
    && budgetEasyInput.value === '3' && budgetMediumInput.value === '5' && budgetHardInput.value === '7'
    && rewardModeSelect.value === 'weight';

  if (isDefault) {
    difficultySummaryStatus.textContent = t('difficulty.usingDefault');
    return;
  }

  const diffPart = t('difficulty.customSummary')
    .replace('{easy}', diffEasyInput.value || '0')
    .replace('{medium}', diffMediumInput.value || '0')
    .replace('{hard}', diffHardInput.value || '0');

  const rewardPart = rewardModeSelect.value === 'fixed'
    ? t('difficulty.rewardFixedSummary')
    : t('difficulty.rewardWeightSummary')
      .replace('{easy}', budgetEasyInput.value || '0')
      .replace('{medium}', budgetMediumInput.value || '0')
      .replace('{hard}', budgetHardInput.value || '0');

  difficultySummaryStatus.textContent = `${diffPart} · ${rewardPart}`;
}

function applyCustomDifficultyAvailability(presentDifficulties) {
  const diffInputs = { easy: diffEasyInput, medium: diffMediumInput, hard: diffHardInput };
  const budgetInputs = { easy: budgetEasyInput, medium: budgetMediumInput, hard: budgetHardInput };
  const present = DIFFICULTY_LEVELS.filter((level) => presentDifficulties.has(level));
  const n = present.length || 1;

  DIFFICULTY_LEVELS.forEach((level) => {
    const isPresent = presentDifficulties.has(level);
    diffInputs[level].disabled = !isPresent;
    budgetInputs[level].disabled = !isPresent;
    if (!isPresent) {
      diffInputs[level].value = '0';
      budgetInputs[level].value = '0';
    }
  });

  present.forEach((level, i) => {
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    const value = String(base + (i === n - 1 ? remainder : 0));
    diffInputs[level].value = value;
    budgetInputs[level].value = value;
  });

  updateDifficultySummary();
}

function restoreDifficultyDefaults() {
  [diffEasyInput, diffMediumInput, diffHardInput, budgetEasyInput, budgetMediumInput, budgetHardInput].forEach((input) => {
    input.disabled = false;
  });
  diffEasyInput.value = '33';
  diffMediumInput.value = '33';
  diffHardInput.value = '34';
  budgetEasyInput.value = '3';
  budgetMediumInput.value = '5';
  budgetHardInput.value = '7';
  rewardModeSelect.value = 'weight';
  setRewardModeVisibility('weight');
  updateDifficultySummary();
  updateRewardBalanceWarning();
}

[diffEasyInput, diffMediumInput, diffHardInput, budgetEasyInput, budgetMediumInput, budgetHardInput].forEach((input) => {
  input.addEventListener('input', updateDifficultySummary);
});

openDifficultyModalBtn.addEventListener('click', () => openOverlay(difficultyOverlay));
difficultyModalCloseX.addEventListener('click', () => closeOverlay(difficultyOverlay));
difficultyModalDoneBtn.addEventListener('click', () => closeOverlay(difficultyOverlay));

parseBtn.addEventListener('click', () => {
  const { parsed, errors } = parseCustomBulkText(bulkTextarea.value);
  customParsedQuestions = errors.length === 0 ? parsed : [];
  renderCustomPreview(parsed, errors);
  updatePackCustomSummary();
  if (errors.length === 0 && parsed.length > 0) {
    applyCustomDifficultyAvailability(new Set(parsed.map((q) => q.difficulty)));
  }
});

/* =========================================================
   MODO DE PRÊMIO — orçamento simples (padrão, como sempre foi)
   ou lista de prêmios personalizada (itens diferentes por
   dificuldade, quantidade de envelopes de cada uma é a soma
   dos itens que ela tiver).
   ========================================================= */
let customPrizeLists = { easy: [], medium: [], hard: [] };

function setPrizeModeVisibility(mode) {
  const isList = mode === 'list';
  budgetModeOnlyEls.forEach((el) => { el.hidden = isList; });
  prizeModeOnlyEls.forEach((el) => { el.hidden = !isList; });
}

prizeModeSelect.addEventListener('change', () => {
  const mode = prizeModeSelect.value;
  setPrizeModeVisibility(mode);
  if (mode === 'list') {
    updatePrizeSummary();
    const isEmpty = DIFFICULTY_LEVELS.every((level) => customPrizeLists[level].length === 0);
    if (isEmpty) {
      openOverlay(prizeOverlay);
    }
  } else {
    closeOverlay(prizeOverlay);
  }
});

/* =========================================================
   MODO DE RECOMPENSA — peso proporcional (padrão) ou valor
   fixo por envelope. Só existe dentro do modo de prêmio
   "orçamento"; no modo "lista" nenhum dos dois aparece.
   ========================================================= */
function currentCountPerLevelForPreview() {
  const envelopeCount = Math.round(Number(envelopeCountInput.value)) || 0;
  const difficultyPercentages = {
    easy: Number(diffEasyInput.value) || 0,
    medium: Number(diffMediumInput.value) || 0,
    hard: Number(diffHardInput.value) || 0
  };
  if (envelopeCount <= 0 || difficultyPercentages.easy + difficultyPercentages.medium + difficultyPercentages.hard !== 100) {
    return null;
  }
  return distributeByPercentages(envelopeCount, difficultyPercentages);
}

function setRewardModeVisibility(mode) {
  const isFixed = mode === 'fixed';
  rewardWeightOnlyEls.forEach((el) => { el.hidden = isFixed; });
  rewardFixedOnlyEls.forEach((el) => { el.hidden = !isFixed; });
}

function currentUnitLabel() {
  if (unitSelect.value === 'custom') {
    return unitCustomInput.value.trim() || 'USD';
  }
  return unitSelect.value;
}

function updateRewardBalanceWarning() {
  if (rewardModeSelect.value !== 'weight') {
    rewardBalanceWarning.hidden = true;
    rewardBalanceWarningMain.hidden = true;
    return;
  }
  const countPerLevel = currentCountPerLevelForPreview();
  const totalDollars = Math.round(Number(budgetInput.value));
  const weights = {
    easy: Number(budgetEasyInput.value) || 0,
    medium: Number(budgetMediumInput.value) || 0,
    hard: Number(budgetHardInput.value) || 0
  };
  if (!countPerLevel || !totalDollars || totalDollars <= 0) {
    rewardBalanceWarning.hidden = true;
    rewardBalanceWarningMain.hidden = true;
    return;
  }
  const distribution = distributeWeightWholeDollars(totalDollars, countPerLevel, weights);
  if (isWeightDistributionBalanced(distribution)) {
    rewardBalanceWarning.hidden = true;
    rewardBalanceWarningMain.hidden = true;
    return;
  }
  const nearby = findNearestBalancedTotal(totalDollars, countPerLevel, weights);
  const unit = currentUnitLabel();
  let message;
  if (!nearby) {
    message = t('rewardMode.unbalancedNoSuggestion');
  } else {
    const options = [nearby.down, nearby.up].filter((v) => v !== undefined);
    message = t('rewardMode.unbalanced').replace('{values}', options.map((v) => `${v} ${unit}`).join(' ' + t('rewardMode.or') + ' '));
  }
  rewardBalanceWarning.hidden = false;
  rewardBalanceWarning.textContent = message;
  rewardBalanceWarningMain.hidden = false;
  rewardBalanceWarningMain.textContent = message;
}

function updateFixedTotalPreview() {
  const countPerLevel = currentCountPerLevelForPreview();
  const values = {
    easy: Number(fixedEasyInput.value) || 0,
    medium: Number(fixedMediumInput.value) || 0,
    hard: Number(fixedHardInput.value) || 0
  };
  if (!countPerLevel) {
    fixedTotalSummary.textContent = '';
    budgetComputedDisplay.textContent = '';
    return;
  }
  const total = values.easy * countPerLevel.easy + values.medium * countPerLevel.medium + values.hard * countPerLevel.hard;
  const totalText = `${total.toFixed(2)} ${currentUnitLabel()}`;
  fixedTotalSummary.textContent = t('rewardMode.computedTotal').replace('{total}', totalText);
  budgetComputedDisplay.textContent = totalText;
}

rewardModeSelect.addEventListener('change', () => {
  setRewardModeVisibility(rewardModeSelect.value);
  updateRewardBalanceWarning();
  updateFixedTotalPreview();
  updateDifficultySummary();
});

[budgetInput, budgetEasyInput, budgetMediumInput, budgetHardInput, envelopeCountInput, diffEasyInput, diffMediumInput, diffHardInput, unitSelect, unitCustomInput].forEach((input) => {
  input.addEventListener('input', updateRewardBalanceWarning);
});

[fixedEasyInput, fixedMediumInput, fixedHardInput, envelopeCountInput, diffEasyInput, diffMediumInput, diffHardInput, unitSelect, unitCustomInput].forEach((input) => {
  input.addEventListener('input', updateFixedTotalPreview);
});

function renderPrizeTierList(tier) {
  const container = document.getElementById(`prize-list-${tier}`);
  container.innerHTML = '';
  customPrizeLists[tier].forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'prize-item';
    row.innerHTML = `<span>${item.label} × ${item.quantity}</span>`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'prize-item__remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      customPrizeLists[tier].splice(index, 1);
      renderPrizeTierList(tier);
      updatePrizeSummary();
    });
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

function prizeTotalsByTier() {
  const totals = { easy: 0, medium: 0, hard: 0 };
  DIFFICULTY_LEVELS.forEach((level) => {
    totals[level] = customPrizeLists[level].reduce((sum, item) => sum + item.quantity, 0);
  });
  return totals;
}

function updatePrizeSummary() {
  const totals = prizeTotalsByTier();
  const grandTotal = totals.easy + totals.medium + totals.hard;

  if (grandTotal === 0) {
    prizeListStatus.textContent = t('prizeList.noneYet');
  } else {
    prizeListStatus.textContent = t('prizeList.someConfigured').replace('{n}', String(grandTotal));
  }

  prizeTotalSummary.textContent = t('prizeList.totalSummary')
    .replace('{easy}', String(totals.easy))
    .replace('{medium}', String(totals.medium))
    .replace('{hard}', String(totals.hard))
    .replace('{total}', String(grandTotal));
}

function parsePrizeBulkText(text) {
  const items = [];
  const errors = [];

  text.split('\n').forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;

    const parts = line.split(';').map((p) => p.trim());
    if (parts.length !== 2) {
      errors.push(`Linha ${i + 1}: use o formato "Nome; Quantidade".`);
      return;
    }

    const [label, qtyRaw] = parts;
    const quantity = Math.round(Number(qtyRaw));

    if (!label) {
      errors.push(`Linha ${i + 1}: nome do prêmio vazio.`);
      return;
    }

    if (!quantity || quantity < 1) {
      errors.push(`Linha ${i + 1}: quantidade precisa ser um número maior que 0.`);
      return;
    }

    items.push({ label, quantity });
  });

  return { items, errors };
}

document.querySelectorAll('.prize-tier').forEach((tierEl) => {
  const tier = tierEl.dataset.tier;
  const bulkTextareaEl = tierEl.querySelector('.prize-bulk-textarea');
  const parseBtnEl = tierEl.querySelector('.prize-parse-btn');
  const errorsEl = tierEl.querySelector('.prize-tier__errors');

  parseBtnEl.addEventListener('click', () => {
    const { items, errors } = parsePrizeBulkText(bulkTextareaEl.value);

    if (errors.length > 0) {
      errorsEl.hidden = false;
      errorsEl.textContent = errors.join(' ');
      return;
    }

    errorsEl.hidden = true;

    // Processar substitui a lista dessa dificuldade pelo que acabou de
    // ser colado, em vez de somar — assim reprocessar depois de
    // corrigir um erro de digitação não duplica os itens já certos.
    customPrizeLists[tier] = items;
    renderPrizeTierList(tier);
    updatePrizeSummary();
    bulkTextareaEl.value = '';
  });
});

openPrizeModalBtn.addEventListener('click', () => openOverlay(prizeOverlay));
prizeModalCloseX.addEventListener('click', () => closeOverlay(prizeOverlay));
prizeModalDoneBtn.addEventListener('click', () => closeOverlay(prizeOverlay));

/* =========================================================
   TEMAS DE MARCA (WHITE LABEL) — seletor e aplicação
   ========================================================= */
function populateThemeSelect() {
  themeSelect.innerHTML = '';
  themes.forEach((theme, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  });
}
populateThemeSelect();

/* =========================================================
   IDIOMA (PT / EN) — interface e conteúdo das perguntas

   Vale para o jogo inteiro, da Tela 1 (configuração) até o
   fim, diferente do tema de marca (que só vale a partir da
   tela de envelopes). A escolha é lembrada entre sessões
   (localStorage) e começa em português por padrão.
   ========================================================= */
const LANGUAGE_STORAGE_KEY = 'quest-drop:language';

function t(key) {
  const dict = translations[state.language] || translations.pt;
  return dict[key] !== undefined ? dict[key] : key;
}

function getInitialLanguage() {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch (error) {
    // localStorage indisponível (ex.: navegação privada) — segue com o padrão
  }
  return 'pt';
}

function applyLanguage(lang) {
  state.language = (lang === 'en') ? 'en' : 'pt';

  document.documentElement.lang = state.language === 'en' ? 'en' : 'pt-BR';

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  } catch (error) {
    // localStorage indisponível — segue sem persistir a escolha
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });

  languageButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.lang === state.language);
  });

  // Nomes dos pacotes de perguntas são bilíngues — repopula o seletor.
  // Nomes de tema de marca não são traduzidos (identidade da empresa).
  populatePackSelect();

  // Se já houver envelopes na tela (evento em andamento), as etiquetas
  // de dificuldade de cada envelope precisam refletir o novo idioma.
  if (screenEnvelopes.classList.contains('is-active') && state.envelopes.length > 0) {
    renderEnvelopes();
  }

  // Se há um tema ativo (evento em andamento), reaplica pra atualizar o
  // slogan, que também é bilíngue.
  if (state.theme) {
    applyTheme(state.theme);
  }

  // Textos dinâmicos (com valor interpolado, tipo "{values}" ou
  // "{total}") não têm data-i18n porque são montados na hora em JS —
  // por isso precisam ser regerados manualmente aqui, ou ficam presos
  // no idioma em que foram gerados da primeira vez.
  updateDifficultySummary();
  updateRewardBalanceWarning();
  updateFixedTotalPreview();
}

languageButtons.forEach((btn) => {
  btn.addEventListener('click', () => applyLanguage(btn.dataset.lang));
});

applyLanguage(getInitialLanguage());

// Converte "#rrggbb" em "r, g, b" para permitir rgba(var(--x-rgb), alpha)
// em glows e realces sutis tingidos pela cor da marca.
function hexToRgbChannels(hex) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

// <style> injetado dinamicamente com os @font-face do tema ativo.
// Guardado aqui pra poder remover o tema anterior antes de aplicar
// as fontes do novo, evitando acúmulo de @font-face de temas antigos.
let themeFontStyleEl = null;

function applyThemeFonts(theme) {
  if (themeFontStyleEl) {
    themeFontStyleEl.remove();
    themeFontStyleEl = null;
  }

  if (theme.fonts.files.length > 0) {
    // Convenção: arquivos de fonte de tema são sempre .woff2, e
    // ficam dentro da própria pasta do tema (ex.: branding/<slug>/fonts/).
    const rules = theme.fonts.files
      .map((file) => `
@font-face {
  font-family: '${file.family}';
  src: url('${file.path}') format('woff2');
  font-weight: ${file.weight || '400'};
  font-style: ${file.style || 'normal'};
  font-display: swap;
}`)
      .join('\n');

    themeFontStyleEl = document.createElement('style');
    themeFontStyleEl.setAttribute('data-theme-fonts', '');
    themeFontStyleEl.textContent = rules;
    document.head.appendChild(themeFontStyleEl);
  }

  const root = document.documentElement;
  root.style.setProperty('--font-display', theme.fonts.display);
  root.style.setProperty('--font-body', theme.fonts.body);
}

// Nomes de todas as CSS custom properties controladas por um tema —
// usado pra limpar qualquer resíduo antes de aplicar um novo tema,
// garantindo que nada de um tema anterior fique "grudado".
const THEME_CSS_PROPERTIES = [
  '--color-gold', '--color-gold-light', '--color-gold-rgb',
  '--color-bg', '--color-bg-alt', '--color-bg-rgb',
  '--color-surface', '--color-surface-border',
  '--color-text', '--color-text-muted',
  '--color-success', '--color-error',
  '--color-paper', '--color-paper-dark', '--color-paper-shadow',
  '--envelope-texture-image',
  '--font-display', '--font-body'
];

function applyTheme(theme) {
  const root = document.documentElement;

  // Limpa qualquer valor inline deixado por um tema anterior antes de
  // aplicar o novo — se algum campo não for setado abaixo por qualquer
  // motivo, o navegador volta pro valor padrão do :root em vez de
  // manter a cor do tema anterior.
  THEME_CSS_PROPERTIES.forEach((prop) => root.style.removeProperty(prop));

  // Cor de destaque (botões, bordas, glow)
  root.style.setProperty('--color-gold', theme.colors.primary);
  root.style.setProperty('--color-gold-light', theme.colors.primaryLight);
  root.style.setProperty('--color-gold-rgb', hexToRgbChannels(theme.colors.primary));

  // Fundo da tela
  root.style.setProperty('--color-bg', theme.colors.background);
  root.style.setProperty('--color-bg-alt', theme.colors.backgroundAlt);
  root.style.setProperty('--color-bg-rgb', hexToRgbChannels(theme.colors.background));

  // Superfícies (cards e overlays: pergunta, resultado, fim de evento)
  root.style.setProperty('--color-surface', theme.colors.surface);
  root.style.setProperty('--color-surface-border', theme.colors.surfaceBorder);

  // Texto
  root.style.setProperty('--color-text', theme.colors.text);
  root.style.setProperty('--color-text-muted', theme.colors.textMuted);

  // Feedback de acerto/erro
  root.style.setProperty('--color-success', theme.colors.success);
  root.style.setProperty('--color-error', theme.colors.error);

  // Papel do envelope
  root.style.setProperty('--color-paper', theme.colors.paper);
  root.style.setProperty('--color-paper-dark', theme.colors.paperDark);
  root.style.setProperty('--color-paper-shadow', theme.colors.paperShadow);

  root.style.setProperty(
    '--envelope-texture-image',
    theme.envelopeTexture ? `url('${theme.envelopeTexture}')` : 'none'
  );

  // Fontes do tema (títulos, corpo, e @font-face locais se houver)
  applyThemeFonts(theme);

  // Hero (logo real + nome de reserva caso a imagem falhe)
  heroBrandName.hidden = true;
  heroBrandName.textContent = theme.name;
  heroLogoImg.style.display = '';
  heroLogoImg.src = theme.logo || '';

  // Slogan opcional — bilíngue, resolve o idioma atual — some quando o tema não define um
  const slogan = theme.slogan ? (theme.slogan[state.language] || theme.slogan.pt) : null;
  if (slogan) {
    heroSlogan.textContent = slogan;
    heroSlogan.hidden = false;
  } else {
    heroSlogan.hidden = true;
  }

  // Marca d'água de fundo, extremamente sutil, derivada da mesma logo
  brandWatermarkImg.src = theme.logo || '';
}

/* =========================================================
   UNIDADE DO PRÊMIO
   ========================================================= */
unitSelect.addEventListener('change', () => {
  const isCustom = unitSelect.value === 'custom';
  unitCustomField.hidden = !isCustom;
});

// Fator de precisão usado internamente para permitir prêmios com casas
// decimais (ex.: 0,50 EVA) sem perder a exatidão da soma: todo o cálculo
// de distribuição roda em "centavos" (valor × 100) e só é convertido de
// volta para a unidade real no momento de montar os envelopes.
const CENTS_FACTOR = 100;

function formatPrize(value, unit) {
  const rounded = Math.round(value * CENTS_FACTOR) / CENTS_FACTOR; // remove ruído de ponto flutuante
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${display} ${unit}`;
}

/* =========================================================
   UTILITÁRIOS
   ========================================================= */
function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Gera "count" valores inteiros (em centavos), todos >= 1, cuja soma
// é exatamente "total". Prioriza igualdade acima de "parecer
// redondo": divide o total o mais igualmente possível entre os
// envelopes (base = total/count, arredondado pra baixo). Se sobrar
// resto (sempre menos que "count" centavos, já que a base já
// absorveu o resto todo que dava pra dividir igual), esse resto
// mínimo é espalhado 1 centavo por vez entre alguns envelopes
// sorteados — é a menor desigualdade matematicamente possível
// quando o total não é múltiplo exato da quantidade de envelopes.
function generatePrizes(total, count) {
  const base = Math.floor(total / count);
  const remainder = total - base * count;

  const prizes = new Array(count).fill(base);
  const order = shuffleArray([...Array(count).keys()]);
  for (let i = 0; i < remainder; i += 1) {
    prizes[order[i]] += 1;
  }

  return shuffleArray(prizes);
}

// Distribui "total" entre easy/medium/hard segundo os percentuais informados,
// sempre somando exatamente "total" (método dos maiores restos).
function distributeByPercentages(total, percentages) {
  const levels = ['easy', 'medium', 'hard'];

  const raw = {};
  levels.forEach((level) => {
    raw[level] = (total * percentages[level]) / 100;
  });

  const result = {};
  levels.forEach((level) => {
    result[level] = Math.floor(raw[level]);
  });

  let remaining = total - levels.reduce((sum, level) => sum + result[level], 0);

  const remainders = levels
    .map((level) => ({ level, frac: raw[level] - result[level] }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remaining; i += 1) {
    result[remainders[i % remainders.length].level] += 1;
  }

  return result;
}

// Calcula o orçamento final por nível a partir dos percentuais
// configurados, mas ignorando (zerando) o percentual de qualquer
// nível sem nenhum envelope e renormalizando os demais — assim a
// fatia orçamentária entre os níveis que EXISTEM segue a mesma
// proporção relativa configurada (em vez de descartar a fatia do
// nível vazio, ou empilhar tudo em um único nível "sortudo").
function distributeBudgetAmongActiveLevels(countPerLevel, budgetPercentages, totalBudget) {
  const levels = ['easy', 'medium', 'hard'];

  const activePercentages = {};
  levels.forEach((level) => {
    activePercentages[level] = countPerLevel[level] > 0 ? budgetPercentages[level] : 0;
  });

  const activeSum = levels.reduce((sum, level) => sum + activePercentages[level], 0);

  if (activeSum === 0) {
    // Nenhum nível ativo tinha percentual configurado (> 0%):
    // divide igualmente entre os níveis que têm envelope.
    const activeLevels = levels.filter((level) => countPerLevel[level] > 0);
    activeLevels.forEach((level) => {
      activePercentages[level] = 100 / activeLevels.length;
    });
  } else {
    levels.forEach((level) => {
      activePercentages[level] = (activePercentages[level] / activeSum) * 100;
    });
  }

  return distributeByPercentages(totalBudget, activePercentages);
}

/* =========================================================
   MODO "PESO PROPORCIONAL" — em vez de porcentagem do
   orçamento, o host define um peso por dificuldade (padrão
   3/5/7). O valor final é sempre em dólar inteiro (sem
   centavo), calculado peso a peso por ENVELOPE individual
   (não por dificuldade e depois dividido), usando o método dos
   maiores restos — o mesmo usado pra distribuir cadeira de
   eleição proporcional. Isso garante que a soma bate exato com
   o orçamento, e que dentro da mesma dificuldade os envelopes
   saem idênticos sempre que a divisão permitir.
   ========================================================= */
function distributeWeightWholeDollars(totalDollars, countPerLevel, weights) {
  const levels = ['easy', 'medium', 'hard'];

  const flatWeights = [];
  levels.forEach((level) => {
    for (let i = 0; i < countPerLevel[level]; i += 1) {
      flatWeights.push({ level, weight: weights[level] });
    }
  });

  const sumWeights = flatWeights.reduce((sum, item) => sum + item.weight, 0);
  if (sumWeights <= 0 || flatWeights.length === 0) {
    const empty = {};
    levels.forEach((level) => { empty[level] = new Array(countPerLevel[level]).fill(0); });
    return empty;
  }

  const raw = flatWeights.map((item) => (totalDollars * item.weight) / sumWeights);
  const base = raw.map((value) => Math.floor(value));
  let remaining = totalDollars - base.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, i) => ({ i, frac: value - base[i] }))
    .sort((a, b) => b.frac - a.frac);

  const finalValues = [...base];
  for (let i = 0; i < remaining; i += 1) {
    finalValues[order[i % order.length].i] += 1;
  }

  const result = {};
  levels.forEach((level) => { result[level] = []; });
  flatWeights.forEach((item, i) => { result[item.level].push(finalValues[i]); });
  return result;
}

// Confere se, dentro de cada dificuldade que tem envelope, todos os
// valores saíram idênticos entre si.
function isWeightDistributionBalanced(perLevelValues) {
  return ['easy', 'medium', 'hard'].every((level) => {
    const values = perLevelValues[level];
    return values.length === 0 || values.every((v) => v === values[0]);
  });
}

// Procura, pra cima e pra baixo a partir do orçamento digitado, o
// valor mais próximo (em dólar inteiro) que deixaria a distribuição
// perfeitamente balanceada. Para depois de "maxSearch" tentativas
// pra cada lado pra nunca travar a interface.
function findNearestBalancedTotal(startTotal, countPerLevel, weights, maxSearch = 60) {
  for (let delta = 1; delta <= maxSearch; delta += 1) {
    const down = startTotal - delta;
    const up = startTotal + delta;
    const downOk = down > 0 && isWeightDistributionBalanced(distributeWeightWholeDollars(down, countPerLevel, weights));
    const upOk = isWeightDistributionBalanced(distributeWeightWholeDollars(up, countPerLevel, weights));
    if (downOk && upOk) return { down, up };
    if (downOk) return { down };
    if (upOk) return { up };
  }
  return null;
}

/* =========================================================
   NAVEGAÇÃO ENTRE TELAS
   ========================================================= */
function showScreen(screenEl) {
  [screenConfig, screenEnvelopes].forEach((s) => s.classList.remove('is-active'));
  screenEl.classList.add('is-active');
}

function openOverlay(overlayEl) {
  overlayEl.classList.add('is-active');
}

function closeOverlay(overlayEl) {
  overlayEl.classList.remove('is-active');
}

/* =========================================================
   TELA 1 — CONFIGURAÇÃO
   ========================================================= */
startBtn.addEventListener('click', () => {
  configError.textContent = '';

  if (questionPacks.length === 0) {
    configError.textContent = t('errors.noPacks');
    return;
  }

  if (themes.length === 0) {
    configError.textContent = t('errors.noThemes');
    return;
  }

  const prizeMode = prizeModeSelect.value;
  let explicitPrizesCents = null;
  let unit = 'USD';

  const envelopeCount = Math.round(Number(envelopeCountInput.value));
  if (!envelopeCount || envelopeCount <= 0) {
    configError.textContent = t('errors.invalidCount');
    return;
  }

  const difficultyPercentages = {
    easy: Number(diffEasyInput.value) || 0,
    medium: Number(diffMediumInput.value) || 0,
    hard: Number(diffHardInput.value) || 0
  };

  const diffSum = difficultyPercentages.easy + difficultyPercentages.medium + difficultyPercentages.hard;
  if (diffSum !== 100) {
    configError.textContent = t('errors.difficultySum');
    return;
  }

  const countPerLevel = distributeByPercentages(envelopeCount, difficultyPercentages);

  if (prizeMode === 'list') {
    const stockTotals = prizeTotalsByTier();
    const tierMissingStock = ['easy', 'medium', 'hard'].find(
      (level) => countPerLevel[level] > 0 && stockTotals[level] === 0
    );
    if (tierMissingStock) {
      configError.textContent = t('errors.tierMissingStock');
      return;
    }
  } else {
    unit = unitSelect.value;
    if (unit === 'custom') {
      unit = unitCustomInput.value.trim();
      if (!unit) {
        configError.textContent = t('errors.customUnit');
        return;
      }
    }

    const rewardMode = rewardModeSelect.value;

    if (rewardMode === 'fixed') {
      const fixedValues = {
        easy: Number(fixedEasyInput.value) || 0,
        medium: Number(fixedMediumInput.value) || 0,
        hard: Number(fixedHardInput.value) || 0
      };
      const missingValue = ['easy', 'medium', 'hard'].find(
        (level) => countPerLevel[level] > 0 && fixedValues[level] <= 0
      );
      if (missingValue) {
        configError.textContent = t('errors.invalidFixedValue');
        return;
      }
      explicitPrizesCents = { easy: [], medium: [], hard: [] };
      ['easy', 'medium', 'hard'].forEach((level) => {
        const cents = Math.round(fixedValues[level] * CENTS_FACTOR);
        for (let i = 0; i < countPerLevel[level]; i += 1) explicitPrizesCents[level].push(cents);
      });
    } else {
      const budget = Math.round(Number(budgetInput.value));
      if (!budget || budget <= 0) {
        configError.textContent = t('errors.invalidBudget');
        return;
      }

      const weights = {
        easy: Number(budgetEasyInput.value) || 0,
        medium: Number(budgetMediumInput.value) || 0,
        hard: Number(budgetHardInput.value) || 0
      };
      const weightSum = weights.easy + weights.medium + weights.hard;
      if (weightSum <= 0) {
        configError.textContent = t('errors.invalidWeights');
        return;
      }

      const distribution = distributeWeightWholeDollars(budget, countPerLevel, weights);
      const insufficientLevel = ['easy', 'medium', 'hard'].find(
        (level) => countPerLevel[level] > 0 && distribution[level].some((v) => v <= 0)
      );
      if (insufficientLevel) {
        configError.textContent = t('errors.insufficientBudget');
        return;
      }

      explicitPrizesCents = {
        easy: distribution.easy.map((v) => v * CENTS_FACTOR),
        medium: distribution.medium.map((v) => v * CENTS_FACTOR),
        hard: distribution.hard.map((v) => v * CENTS_FACTOR)
      };
    }
  }

  let selectedPack;
  if (packSelect.value === 'custom') {
    if (customParsedQuestions.length === 0) {
      configError.textContent = t('errors.customPackNotProcessed');
      return;
    }
    const questions = { easy: [], medium: [], hard: [] };
    customParsedQuestions.forEach((q) => {
      questions[q.difficulty].push({ question: q.question, answers: q.answers, correct: q.correct });
    });
    selectedPack = {
      name: { pt: 'Minhas Perguntas', en: 'My Questions' },
      questions
    };
  } else {
    selectedPack = questionPacks[Number(packSelect.value)];
  }
  const selectedTheme = themes[Number(themeSelect.value)];

  startEvent(countPerLevel, explicitPrizesCents, unit, selectedPack, selectedTheme, prizeMode, customPrizeLists);
});

// Modo "lista": gera countPerLevel[level] envelopes por dificuldade,
// todos com prizeLabel null — o prêmio de cada um só é sorteado do
// estoque configurado (e descontado) no momento em que a pessoa
// acerta, não na hora de montar o pool (ver drawPrizeFromStock).
// Modo "orçamento" (peso proporcional ou valor fixo): o valor de
// cada envelope já vem pronto e exato em "explicitPrizesCents"
// (calculado antes, em distributeWeightWholeDollars ou direto do
// valor fixo digitado) — aqui só monta o pool com esses valores.
function buildEnvelopePool(countPerLevel, explicitPrizesCents, unit, prizeMode) {
  const levels = ['easy', 'medium', 'hard'];
  let pool = [];

  levels.forEach((level) => {
    if (countPerLevel[level] <= 0) return;

    if (prizeMode === 'list') {
      // prizeLabel fica null de propósito: o prêmio desse envelope só é
      // sorteado do estoque (e descontado) no momento em que a pessoa
      // acerta a pergunta, não na hora de montar o pool. Isso é o que
      // permite ter, por exemplo, 6 envelopes fáceis puxando de um
      // estoque de 50 chaveiros, em vez de precisar de 50 envelopes.
      for (let i = 0; i < countPerLevel[level]; i += 1) {
        pool.push({ prizeLabel: null, difficulty: level, conquered: false });
      }
    } else {
      explicitPrizesCents[level].forEach((prizeCents) => {
        pool.push({ prizeLabel: formatPrize(prizeCents / CENTS_FACTOR, unit), difficulty: level, conquered: false });
      });
    }
  });

  // Sem shuffle: os envelopes ficam agrupados na ordem easy → medium → hard.
  return pool;
}

function startEvent(countPerLevel, explicitPrizesCents, unit, pack, theme, prizeMode, prizeLists) {
  state.envelopes = buildEnvelopePool(countPerLevel, explicitPrizesCents, unit, prizeMode);
  state.unit = unit;
  state.prizeMode = prizeMode;
  // Cópia própria (não referência) do estoque configurado, pra cada
  // sorteio/desconto durante o evento não mexer no que está na tela
  // de configuração — importante pro "Novo Evento" recomeçar do
  // estoque original configurado, não do que sobrou do evento anterior.
  state.prizeStock = {
    easy: prizeLists.easy.map((item) => ({ ...item })),
    medium: prizeLists.medium.map((item) => ({ ...item })),
    hard: prizeLists.hard.map((item) => ({ ...item }))
  };
  state.questionPack = pack;
  state.theme = theme;
  state.usedQuestionIndexes = { easy: [], medium: [], hard: [] };
  state.currentEnvelopeIndex = null;
  state.currentCorrectAnswer = null;
  state.lastAnswerCorrect = null;

  applyTheme(theme);

  renderEnvelopes();
  showScreen(screenEnvelopes);
}

/* =========================================================
   TELA 2 — ENVELOPES
   ========================================================= */
function difficultyLabel(level) {
  return t(`difficulty.${level}`);
}

// Calcula a quantidade de colunas que deixa a grade visualmente
// equilibrada para a quantidade de envelopes (ex.: 6 = 3×2).
function computeGridColumns(count) {
  if (count <= 1) return 1;
  const start = Math.ceil(Math.sqrt(count));
  for (let offset = 0; offset <= 1; offset += 1) {
    const candidate = start + offset;
    if (candidate <= count && count % candidate === 0) {
      return candidate;
    }
  }
  return start;
}

// Limita a largura da grade para que o auto-fit assente exatamente
// nessa quantidade de colunas (sem remover a responsividade em telas
// menores, onde o auto-fit continua reduzindo colunas normalmente).
function applyBalancedGridWidth(count) {
  const columns = computeGridColumns(count);
  const styles = getComputedStyle(envelopeGrid);
  const cell = parseFloat(styles.getPropertyValue('--envelope-cell-min')) || 150;
  const colGap = parseFloat(styles.getPropertyValue('--envelope-gap-col')) || 22;
  const width = columns * cell + (columns - 1) * colGap;
  envelopeGrid.style.maxWidth = `${width}px`;
}

function renderEnvelopes() {
  envelopeGrid.innerHTML = '';

  state.envelopes.forEach((envelope, index) => {
    const btn = document.createElement('button');
    btn.className = 'envelope' + (envelope.conquered ? ' is-used' : '');
    btn.type = 'button';
    btn.dataset.index = String(index);
    btn.innerHTML = `
      <div class="envelope-shape">
        <div class="envelope-back"></div>
        <div class="difficulty-tag difficulty-${envelope.difficulty}">${difficultyLabel(envelope.difficulty)}</div>
        <div class="envelope-flap"></div>
        <div class="seal">${index + 1}</div>
        <div class="used-badge">${envelope.conquered ? envelope.prizeLabel : ''}</div>
      </div>
    `;
    btn.addEventListener('click', () => handleEnvelopeClick(index, btn));
    envelopeGrid.appendChild(btn);
  });

  applyBalancedGridWidth(state.envelopes.length);
}

let gridResizeTimer = null;
window.addEventListener('resize', () => {
  if (!screenEnvelopes.classList.contains('is-active')) return;
  clearTimeout(gridResizeTimer);
  gridResizeTimer = window.setTimeout(() => {
    applyBalancedGridWidth(state.envelopes.length);
  }, 150);
});

function handleEnvelopeClick(index, envelopeEl) {
  if (state.envelopes[index].conquered) return;
  if (state.currentEnvelopeIndex !== null) return; // já existe uma tentativa em andamento

  state.currentEnvelopeIndex = index;

  envelopeEl.classList.add('is-opening');

  window.setTimeout(() => {
    envelopeEl.classList.remove('is-opening');
    envelopeEl.classList.add('is-open');
    showQuestion(state.envelopes[index].difficulty);
  }, 550);
}

/* =========================================================
   PERGUNTAS
   ========================================================= */
function pickRandomQuestion(level) {
  const pool = state.questionPack.questions[level];

  if (!pool || pool.length === 0) {
    return null;
  }

  // Se já usamos todas as perguntas desse nível nesta sessão (mais
  // envelopes do que perguntas cadastradas), reinicia o controle de
  // repetição em vez de travar o jogo com "nenhuma pergunta
  // disponível" no meio de um evento — melhor repetir pergunta do
  // que interromper a experiência de quem está jogando.
  if (state.usedQuestionIndexes[level].length >= pool.length) {
    state.usedQuestionIndexes[level] = [];
  }

  let index;
  do {
    index = Math.floor(Math.random() * pool.length);
  } while (state.usedQuestionIndexes[level].includes(index));

  state.usedQuestionIndexes[level].push(index);
  return pool[index];
}

function showQuestion(level) {
  const question = pickRandomQuestion(level);
  answersList.innerHTML = '';

  if (!question) {
    // Nível sem perguntas disponíveis (pacote vazio ou esgotado nesta sessão).
    questionText.textContent = t('question.none');

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = t('buttons.backToEnvelopes');
    backBtn.addEventListener('click', () => {
      closeOverlay(questionOverlay);
      closeEnvelopeBack();
    });
    answersList.appendChild(backBtn);

    openOverlay(questionOverlay);
    return;
  }

  const questionAnswers = question.answers[state.language] || question.answers.pt;
  const correctAnswerText = questionAnswers[question.correct];
  const shuffledAnswers = shuffleArray(questionAnswers);

  state.currentCorrectAnswer = correctAnswerText;
  questionText.textContent = question.question[state.language] || question.question.pt;

  shuffledAnswers.forEach((answerText) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-btn';
    btn.textContent = answerText;
    btn.addEventListener('click', () => handleAnswer(answerText === correctAnswerText));
    answersList.appendChild(btn);
  });

  openOverlay(questionOverlay);
}

// Sorteia um item do estoque daquela dificuldade e desconta 1 unidade.
// Retorna null se o estoque dessa dificuldade já esgotou.
function drawPrizeFromStock(level) {
  const stock = state.prizeStock[level].filter((item) => item.quantity > 0);
  if (stock.length === 0) return null;

  const picked = stock[Math.floor(Math.random() * stock.length)];
  picked.quantity -= 1;
  return picked.label;
}

function handleAnswer(isCorrect) {
  closeOverlay(questionOverlay);
  state.lastAnswerCorrect = isCorrect;

  resultSuccess.classList.toggle('is-active', isCorrect);
  resultFail.classList.toggle('is-active', !isCorrect);

  if (isCorrect) {
    const envelope = state.envelopes[state.currentEnvelopeIndex];

    if (state.prizeMode === 'list' && envelope.prizeLabel === null) {
      const drawnLabel = drawPrizeFromStock(envelope.difficulty);
      if (drawnLabel) {
        envelope.prizeLabel = drawnLabel;
        resultPrize.textContent = `${t('result.wonPrefix')} ${drawnLabel}`;
      } else {
        envelope.prizeLabel = t('prizeList.soldOut');
        resultPrize.textContent = t('result.soldOutMessage');
      }
    } else {
      resultPrize.textContent = `${t('result.wonPrefix')} ${envelope.prizeLabel}`;
    }
  }

  openOverlay(resultOverlay);
}

/* =========================================================
   CONSEQUÊNCIA DA TENTATIVA (ACERTO OU ERRO)
   ========================================================= */

// Acertou: o envelope abre definitivamente e o prêmio fica visível.
function conquerEnvelope() {
  const index = state.currentEnvelopeIndex;
  if (index === null) return;

  const envelopeEl = envelopeGrid.querySelector(`[data-index="${index}"]`);
  if (!envelopeEl) return;

  const envelope = state.envelopes[index];
  const difficulty = envelope.difficulty;
  envelope.conquered = true;

  const badge = envelopeEl.querySelector('.used-badge');
  badge.textContent = envelope.prizeLabel;

  envelopeEl.classList.remove('is-open');
  envelopeEl.classList.add('is-used');

  state.currentEnvelopeIndex = null;

  // Modo lista: o limite real de quanta gente joga é o estoque de
  // prêmios, não a quantidade de envelopes visíveis na tela — se
  // ainda sobrar estoque dessa dificuldade, este mesmo espaço no
  // grid volta a ficar disponível pra uma nova tentativa em vez de
  // ficar "usado" pra sempre. Só fica definitivamente usado quando o
  // estoque daquela dificuldade realmente acaba.
  if (state.prizeMode === 'list') {
    const hasStockLeft = state.prizeStock[difficulty].some((item) => item.quantity > 0);
    if (hasStockLeft) {
      state.envelopes[index] = { prizeLabel: null, difficulty, conquered: false };
      envelopeEl.classList.remove('is-used');
      badge.textContent = '';
    }
  }
}

// Errou (ou não há pergunta disponível): o envelope fecha e continua disponível.
function closeEnvelopeBack() {
  const index = state.currentEnvelopeIndex;
  if (index === null) return;

  const envelopeEl = envelopeGrid.querySelector(`[data-index="${index}"]`);
  if (envelopeEl) {
    envelopeEl.classList.remove('is-open');
  }

  state.currentEnvelopeIndex = null;
}

function checkEventFinished() {
  if (state.prizeMode === 'list') {
    // No modo lista os envelopes reciclam enquanto sobrar estoque, então
    // "todos conquistados" não é mais o critério certo — o evento só
    // termina quando o estoque de TODAS as dificuldades zera.
    const hasAnyStockLeft = ['easy', 'medium', 'hard'].some((level) =>
      state.prizeStock[level].some((item) => item.quantity > 0)
    );
    if (!hasAnyStockLeft) {
      openOverlay(finishedOverlay);
    }
    return;
  }

  const allConquered = state.envelopes.every((e) => e.conquered);
  if (allConquered) {
    openOverlay(finishedOverlay);
  }
}

/* =========================================================
   CONTINUAR APÓS RESULTADO
   ========================================================= */
function resolveCurrentAttempt() {
  closeOverlay(resultOverlay);

  if (state.lastAnswerCorrect) {
    conquerEnvelope();
  } else {
    closeEnvelopeBack();
  }

  checkEventFinished();
}

document.querySelectorAll('.result-continue-btn').forEach((btn) => {
  btn.addEventListener('click', resolveCurrentAttempt);
});

/* =========================================================
   BOTÕES "X" DE FECHAR (NÃO ALTERAM O RESULTADO DA TENTATIVA)
   ========================================================= */
questionCloseX.addEventListener('click', () => {
  closeOverlay(questionOverlay);
  closeEnvelopeBack(); // pergunta abandonada: envelope volta a ficar disponível
});

resultCloseX.addEventListener('click', resolveCurrentAttempt);

finishedCloseX.addEventListener('click', () => {
  closeOverlay(finishedOverlay);
});

/* =========================================================
   POPUP DE EVENTO FINALIZADO
   ========================================================= */
viewResultBtn.addEventListener('click', () => {
  closeOverlay(finishedOverlay);
  eventFinishedBadge.hidden = false;
});

finishedCloseBtn.addEventListener('click', () => {
  closeOverlay(finishedOverlay);
});

/* =========================================================
   RESET PARA A TELA DE CONFIGURAÇÃO (compartilhado)
   ========================================================= */
function resetToConfig() {
  budgetInput.value = '';
  envelopeCountInput.value = '';
  packSelect.selectedIndex = 0;
  packCustomSummary.hidden = true;
  bulkTextarea.value = '';
  customParsedQuestions = [];
  parseErrorsBox.hidden = true;
  previewList.innerHTML = '';
  themeSelect.selectedIndex = 0;
  unitSelect.value = 'USD';
  unitCustomField.hidden = true;
  unitCustomInput.value = '';
  restoreDifficultyDefaults();
  closeOverlay(difficultyOverlay);
  prizeModeSelect.value = 'budget';
  setPrizeModeVisibility('budget');
  closeOverlay(prizeOverlay);
  customPrizeLists = { easy: [], medium: [], hard: [] };
  DIFFICULTY_LEVELS.forEach((level) => renderPrizeTierList(level));
  updatePrizeSummary();
  configError.textContent = '';
  eventFinishedBadge.hidden = true;

  state.envelopes = [];
  state.unit = 'USD';
  state.prizeMode = 'budget';
  state.prizeStock = { easy: [], medium: [], hard: [] };
  state.questionPack = null;
  state.theme = null;
  state.usedQuestionIndexes = { easy: [], medium: [], hard: [] };
  state.currentEnvelopeIndex = null;
  state.currentCorrectAnswer = null;
  state.lastAnswerCorrect = null;

  if (themes.length > 0) {
    applyTheme(themes[0]);
  }

  showScreen(screenConfig);
}

/* =========================================================
   NOVO EVENTO
   ========================================================= */
newEventBtn.addEventListener('click', () => {
  closeOverlay(finishedOverlay);
  resetToConfig();
});

/* =========================================================
   VOLTAR / CANCELAR EVENTO EM ANDAMENTO
   ========================================================= */
backToConfigBtn.addEventListener('click', () => {
  const confirmed = window.confirm(t('confirm.cancelEvent'));
  if (!confirmed) return;

  closeOverlay(questionOverlay);
  closeOverlay(resultOverlay);
  closeOverlay(finishedOverlay);
  resetToConfig();
});
