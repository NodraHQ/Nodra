// ==================================================================
// SHOW DOWN - play/play.js
//
// Diferente do Time Attack (onde cada jogador roda sua própria
// partida sozinho), aqui quem manda na pergunta atual é o host. O
// jogador fica inscrito na linha da sala via Supabase Realtime: toda
// vez que o host muda o status ou avança a pergunta, essa inscrição
// dispara sozinha e a tela troca, sem precisar de F5.
// ==================================================================

import translations from '../i18n/translations.js';
import themes from '../branding/branding-manifest.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('show-down:language') || 'pt';

function t(key, vars) {
    const dict = translations[currentLanguage] || translations.pt;
    let text = dict[key] !== undefined ? dict[key] : key;
    if (vars) {
        Object.keys(vars).forEach((k) => {
            text = text.replace(`{${k}}`, String(vars[k]));
        });
    }
    return text;
}

// --------------------------------------------------------
// Badges do jogador - mini-card evoluído do "quadrinho simples só
// com nome", pedido ao vivo: até 3 badges pequenos que a pessoa
// escolheu destacar, no ranking. Cópia própria desta pasta (mesma
// lógica dos outros jogos).
// --------------------------------------------------------

const BADGE_ICONS = {
    trophy: '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
    award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
    medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    gem: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
    flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
};

function buildMiniIconSvg(iconKey) {
    const inner = BADGE_ICONS[iconKey];
    if (!inner) return '';
    return `<svg class="mini-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

async function loadPlayerBadgeMap(userIds) {
    const validIds = [...new Set(userIds.filter(Boolean))];
    if (validIds.length === 0) return new Map();

    const [{ data: profiles }, { data: userBadgeRows }] = await Promise.all([
        window.ndquestSupabase.from('profiles').select('id, featured_badge_ids').in('id', validIds),
        window.ndquestSupabase
            .from('user_badges')
            .select('user_id, badge_id, badges(background_color, icon, icon_color, image_url)')
            .in('user_id', validIds),
    ]);

    const featuredById = new Map((profiles || []).map((p) => [p.id, new Set(p.featured_badge_ids || [])]));
    const map = new Map();

    (userBadgeRows || []).forEach((row) => {
        const featuredSet = featuredById.get(row.user_id);
        const isFeatured = featuredSet && featuredSet.size > 0 ? featuredSet.has(row.badge_id) : true;
        if (!isFeatured) return;

        const list = map.get(row.user_id) || [];
        if (list.length >= 3) return;
        list.push(row.badges);
        map.set(row.user_id, list);
    });

    return map;
}

function buildMiniBadgeRow(badges) {
    if (!badges || badges.length === 0) return '';
    const chips = badges
        .map((b) => {
            if (b.image_url) {
                return `<span class="mini-badge"><img src="${b.image_url}" alt=""></span>`;
            }
            const color = b.icon_color || b.background_color || '#888';
            return `<span class="mini-badge" style="background:${b.background_color || '#333'};color:${color};">${b.icon ? buildMiniIconSvg(b.icon) : ''}</span>`;
        })
        .join('');
    return `<div class="mini-badge-row">${chips}</div>`;
}

// --------------------------------------------------------
// Identidade - se a pessoa estiver logada, user_id fica registrado
// junto do jogador (ver docs/MATCH_HISTORY_ARCHITECTURE.md).
// Deslogado, fica null - joga normal, só não entra no histórico.
// --------------------------------------------------------

// Bug real confirmado ao vivo: antes isso guardava o resultado em
// cache pra sempre depois da primeira checagem - numa aba que fica
// aberta por horas, ou depois de trocar de conta sem recarregar a
// página, esse valor guardado ficava desatualizado, e o servidor
// rejeitava porque o host_id/user_id enviado não batia mais com quem
// a pessoa realmente é agora. getSession() é uma leitura local e
// barata do Supabase (não faz chamada de rede), então nunca precisou
// desse cache - checa fresco toda vez.
let historyRecordedForRoom = null; // guarda o id da sala já registrada, evita duplicar se renderFinal disparar de novo

async function getCurrentUserId() {
    const { data: { session } } = await window.ndquestSupabase.auth.getSession();
    return session?.user?.id ?? null;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage] && translations[currentLanguage][key] !== undefined) {
            el.textContent = translations[currentLanguage][key];
        }
    });
    document.documentElement.lang = currentLanguage;
}

applyTranslations();

function setActiveLanguageButton() {
    document.getElementById('lang-pt').classList.toggle('is-active', currentLanguage === 'pt');
    document.getElementById('lang-en').classList.toggle('is-active', currentLanguage === 'en');
}

function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('show-down:language', lang);
    applyTranslations();
    setActiveLanguageButton();
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenJoin = document.getElementById('screen-join');
const screenWaitingPlayer = document.getElementById('screen-waiting-player');
const screenQuestion = document.getElementById('screen-question');
const screenResults = document.getElementById('screen-results');
const screenFinal = document.getElementById('screen-final');
const logoImg = document.getElementById('logo-img');

const roomCodeInput = document.getElementById('room-code-input');
const nicknameInput = document.getElementById('nickname-input');
const joinError = document.getElementById('join-error');
const joinRoomBtn = document.getElementById('join-room-btn');

const questionIndexLabel = document.getElementById('question-index-label');
const timerFill = document.getElementById('timer-fill');
const timerSeconds = document.getElementById('timer-seconds');
const questionText = document.getElementById('question-text');
const answersGrid = document.getElementById('answers-grid');
const answerSentMsg = document.getElementById('answer-sent-msg');

const resultsBadge = document.getElementById('results-badge');
const resultsPoints = document.getElementById('results-points');
const resultsRankingList = document.getElementById('results-ranking-list');

const finalYourPosition = document.getElementById('final-your-position');
const finalRankingList = document.getElementById('final-ranking-list');

function showScreen(el) {
    [screenJoin, screenWaitingPlayer, screenQuestion, screenResults, screenFinal].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

// --------------------------------------------------------
// Pré-preencher código da sala se veio por link/QR (?room=XXXX)
// --------------------------------------------------------

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl.toUpperCase();
}

// --------------------------------------------------------
// Entrar na sala
// --------------------------------------------------------

let currentRoom = null;
let currentPlayerId = null;

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function callGameFunction(name, payload) {
    const { data: { session } } = await window.ndquestSupabase.auth.getSession();
    const token = session?.access_token || window.ndquestSupabaseAnonKey;

    const response = await fetch(`${window.ndquestSupabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    return response.json();
}
let roomRealtimeChannel = null;
let questionTimerInterval = null;
let renderedQuestionIndex = -1;
let hasAnsweredThisQuestion = false;

joinRoomBtn.addEventListener('click', async () => {

    joinError.textContent = '';

    const roomCode = roomCodeInput.value.trim().toUpperCase();
    const nickname = nicknameInput.value.trim();

    if (!roomCode) {
        joinError.textContent = t('errors.roomCodeRequired');
        return;
    }
    if (!nickname) {
        joinError.textContent = t('errors.nicknameRequired');
        return;
    }

    joinRoomBtn.disabled = true;

    // try/finally garante que o botão sempre reabilita no fim, não
    // importa por qual caminho a função sai (erro de sala, nome
    // duplicado, sucesso) - bug real reportado ao vivo: antes o botão
    // reabilitava logo depois da busca da sala, mas o resto da
    // criação da linha do jogador continuava rodando com o botão já
    // liberado. Um clique duplo rápido conseguia disparar duas
    // execuções concorrentes, cada uma achando "ainda não existe" e
    // criando uma linha própria - duas linhas pra mesma conta na
    // mesma sala.
    try {

        const { data, error } = await window.ndquestSupabase
            .from('showdown_rooms')
            .select('*')
            .eq('room_code', roomCode)
            .maybeSingle();

        if (error || !data) {
            joinError.textContent = t('errors.roomNotFound');
            return;
        }

        if (data.status === 'closed') {
            joinError.textContent = t('errors.roomClosed');
            return;
        }

        currentRoom = data;

        const joinUserId = await getCurrentUserId();

        // Se a pessoa está logada e já tem uma linha nessa sala, reaproveita
        // em vez de duplicar (ver mesma correção no Time Attack).
        let playerRow = null;
        let playerError = null;

        if (joinUserId) {
            const { data: existing } = await window.ndquestSupabase
                .from('showdown_players')
                .select('*')
                .eq('room_id', currentRoom.id)
                .eq('user_id', joinUserId)
                .maybeSingle();

            if (existing) {
                playerRow = existing;
            }
        }

        if (!playerRow) {

            // Impede nome repetido dentro da mesma sala - vale pra
            // logado e pra quem entra sem login. Não bloqueia a própria
            // pessoa reconectando (checa pelo user_id, quando existe).
            const { data: existingWithName } = await window.ndquestSupabase
                .from('showdown_players')
                .select('id, user_id')
                .eq('room_id', currentRoom.id)
                .ilike('nickname', nickname);

            let nameTaken = (existingWithName || []).some((p) => {
                if (!joinUserId) return true;
                return !!p.user_id && p.user_id !== joinUserId;
            });

            // Guest também não pode usar um nome que já é username de
            // alguma conta real, mesmo que essa conta nunca tenha entrado
            // nesta sala - prioridade é de quem tem conta, sempre (mesma
            // regra do Time Attack).
            if (!nameTaken && !joinUserId) {
                const { data: isRegisteredUsername } = await window.ndquestSupabase
                    .rpc('username_is_taken', { check_username: nickname });
                if (isRegisteredUsername) nameTaken = true;
            }

            if (nameTaken) {
                joinError.textContent = t('errors.nicknameTaken');
                return;
            }

            const result = await window.ndquestSupabase
                .from('showdown_players')
                .insert({ room_id: currentRoom.id, nickname, total_score: 0, user_id: joinUserId })
                .select()
                .single();
            playerRow = result.data;
            playerError = result.error;
        }

        if (playerError || !playerRow) {
            joinError.textContent = t('errors.roomCreateFailed');
            console.error('Show Down join room error:', playerError);
            return;
        }

        currentPlayerId = playerRow.id;

        const roomTheme = themes.find((th) => th.name === currentRoom.theme_name) || themes[0];
        applyTheme(roomTheme);

        subscribeToRoom(currentRoom.id);
        reactToRoomState(currentRoom);
        startHeartbeat();

    } finally {
        joinRoomBtn.disabled = false;
    }

});

// --------------------------------------------------------
// Tema de marca (white label) - mesmo sistema do Quest Drop,
// cópia própria do branding/. O jogador não escolhe: o tema é
// lido da própria sala (salvo pelo host na criação) e só
// aplicado, garantindo que os dois aparelhos mostrem a mesma
// marca.
// --------------------------------------------------------

function hexToRgbChannels(hex) {
    const clean = hex.replace('#', '');
    const value = parseInt(clean, 16);
    return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

let themeFontStyleEl = null;

function applyThemeFonts(theme) {
    if (themeFontStyleEl) {
        themeFontStyleEl.remove();
        themeFontStyleEl = null;
    }

    if (theme.fonts.files.length > 0) {
        const rules = theme.fonts.files
            .map((file) => `
@font-face {
  font-family: '${file.family}';
  src: url('../${file.path}') format('woff2');
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

const THEME_CSS_PROPERTIES = [
    '--color-gold', '--color-gold-light', '--color-gold-rgb',
    '--color-bg', '--color-bg-alt', '--color-bg-rgb',
    '--color-surface', '--color-surface-border',
    '--color-text', '--color-text-muted',
    '--color-success', '--color-error',
    '--color-paper', '--color-paper-dark', '--color-paper-shadow',
    '--font-display', '--font-body'
];

function applyTheme(theme) {
    const root = document.documentElement;

    THEME_CSS_PROPERTIES.forEach((prop) => root.style.removeProperty(prop));

    root.style.setProperty('--color-gold', theme.colors.primary);
    root.style.setProperty('--color-gold-light', theme.colors.primaryLight);
    root.style.setProperty('--color-gold-rgb', hexToRgbChannels(theme.colors.primary));

    root.style.setProperty('--color-bg', theme.colors.background);
    root.style.setProperty('--color-bg-alt', theme.colors.backgroundAlt);
    root.style.setProperty('--color-bg-rgb', hexToRgbChannels(theme.colors.background));

    root.style.setProperty('--color-surface', theme.colors.surface);
    root.style.setProperty('--color-surface-border', theme.colors.surfaceBorder);

    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-text-muted', theme.colors.textMuted);

    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-error', theme.colors.error);

    root.style.setProperty('--color-paper', theme.colors.paper);
    root.style.setProperty('--color-paper-dark', theme.colors.paperDark);
    root.style.setProperty('--color-paper-shadow', theme.colors.paperShadow);

    applyThemeFonts(theme);

    if (logoImg && theme.logo) {
        logoImg.src = `../${theme.logo}`;
    }
}

// --------------------------------------------------------
// Inscrição em tempo real na linha da sala
// --------------------------------------------------------

let heartbeatInterval = null;

// Sinal de vida - reportado ao vivo no Time Attack (mesmo problema
// vale pra qualquer jogo com "jogando agora" ao vivo): sem isso, uma
// sessão abandonada (fecha a aba no meio do jogo) fica pra sempre
// marcada como ativa na tela do host, mesmo horas depois.
function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (!currentPlayerId) return;
        window.ndquestSupabase
            .from('showdown_players')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', currentPlayerId)
            .then(({ error }) => {
                if (error) console.error('Show Down: erro no sinal de vida', error);
            });
    }, 10000);
}

function subscribeToRoom(roomId) {
    roomRealtimeChannel = window.ndquestSupabase
        .channel(`show-down-room-${roomId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'showdown_rooms', filter: `id=eq.${roomId}` },
            (payload) => {
                // Mescla em vez de substituir - bug real já confirmado
                // no Time Attack: o pacote de UPDATE às vezes só traz
                // os campos que mudaram, não a sala inteira.
                // Substituir currentRoom por inteiro perderia campos
                // como selected_question_ids/num_questions/
                // question_seconds que não mudaram nesse evento
                // específico (ex: avançar de pergunta só muda
                // status/current_question_index/question_started_at),
                // mas que renderQuestion() ainda precisa.
                currentRoom = { ...currentRoom, ...payload.new };
                reactToRoomState(currentRoom);
            }
        )
        .subscribe();
}

let prefetchedQuestionPromise = null;
let prefetchedQuestionIndex = null;

function prefetchNextQuestion(room) {
    const nextIndex = room.current_question_index + 1;
    if (nextIndex >= room.num_questions) return; // não tem próxima, era a última
    prefetchedQuestionIndex = nextIndex;
    prefetchedQuestionPromise = callGameFunction('showdown-get-question', {
        room_id: room.id,
        question_index: nextIndex,
    });
}

function reactToRoomState(room) {

    if (room.status === 'waiting') {
        renderedQuestionIndex = -1;
        hasAnsweredThisQuestion = false;
        historyRecordedForRoom = null; // novo round na mesma sala (Jogar de novo) - reabre a trava
        showScreen(screenWaitingPlayer);
        return;
    }

    if (room.status === 'question') {
        if (room.current_question_index !== renderedQuestionIndex) {
            renderedQuestionIndex = room.current_question_index;
            hasAnsweredThisQuestion = false;
            renderQuestion(room);
        }
        return;
    }

    if (room.status === 'results') {
        if (questionTimerInterval) {
            clearInterval(questionTimerInterval);
            questionTimerInterval = null;
        }
        renderResults(room);
        // Já sai pedindo a próxima pergunta em segundo plano, sem
        // esperar o host clicar em avançar - reportado ao vivo: "um
        // pouco lento pra chamar a pergunta". Só o TEXTO antecipa,
        // nunca a resposta certa (a Edge Function só revela isso pra
        // pergunta que É a atual da sala, nunca pra uma futura).
        if (room.questions === null) {
            prefetchNextQuestion(room);
        }
        return;
    }

    if (room.status === 'finished') {
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        renderFinal(room);
        return;
    }

    if (room.status === 'closed') {
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        joinError.textContent = t('errors.roomClosed');
        showScreen(screenJoin);
    }
}

// --------------------------------------------------------
// Tela de pergunta
// --------------------------------------------------------

async function renderQuestion(room) {

    showScreen(screenQuestion);

    answerSentMsg.hidden = true;
    answersGrid.hidden = false;

    const index = room.current_question_index;
    questionIndexLabel.textContent = t('question.indexLabel', { current: index + 1, total: room.num_questions });

    if (room.questions) {

        // Modo custom - conteúdo já vem na própria sala, sem
        // validação de servidor (escopo menor de propósito, mesma
        // decisão do Time Attack).
        const q = room.questions[index];
        const answers = q.answers[currentLanguage] || q.answers.pt;
        const correctText = answers[q.correct];

        questionText.textContent = q.question[currentLanguage] || q.question.pt;

        answersGrid.innerHTML = '';
        answers.forEach((answerText) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'answer-btn';
            btn.textContent = answerText;
            btn.addEventListener('click', () => submitAnswerCustom(room, index, answerText === correctText, btn));
            answersGrid.appendChild(btn);
        });

    } else {

        // Pacote oficial - pergunta vem da Edge Function, sem a
        // resposta certa incluída (Mecanismo B, ver
        // docs/BADGE_INTEGRITY_ARCHITECTURE.md). Reaproveita o
        // pré-carregamento se já tiver pedido essa mesma pergunta
        // antes (durante a tela de resultado da anterior) - evita
        // esperar de novo por algo que já está a caminho.
        const usedPrefetch = prefetchedQuestionIndex === index && prefetchedQuestionPromise;

        const data = usedPrefetch
            ? await prefetchedQuestionPromise
            : await callGameFunction('showdown-get-question', { room_id: room.id, question_index: index });

        prefetchedQuestionPromise = null;
        prefetchedQuestionIndex = null;

        if (data.error || !data.question_id || !Array.isArray(data.options)) {
            console.error('Show Down: erro ao buscar pergunta', data);
            return;
        }

        questionText.textContent = currentLanguage === 'en' ? data.question_en : data.question_pt;

        // Embaralha a ORDEM que aparece na tela - o "index" de cada
        // opção continua sendo a posição real do banco (é isso que
        // volta pra Edge Function saber qual foi escolhida), só a
        // ORDEM VISUAL muda. Bug real reportado ao vivo: sem isso, a
        // resposta certa aparecia sempre na mesma posição, porque
        // várias perguntas do pacote foram digitadas com ela em
        // primeiro - sem embaralhar, isso ficava visível na tela.
        answersGrid.innerHTML = '';
        shuffleArray(data.options).forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'answer-btn';
            btn.textContent = currentLanguage === 'en' ? opt.en : opt.pt;
            btn.addEventListener('click', () => submitAnswerOfficial(room, data.question_id, opt.index, btn));
            answersGrid.appendChild(btn);
        });

    }

    startQuestionTimer(room.question_started_at, room.question_seconds);
}

function startQuestionTimer(startedAtISO, questionSeconds) {

    if (questionTimerInterval) {
        clearInterval(questionTimerInterval);
    }

    const startedAtMs = new Date(startedAtISO).getTime();

    function tick() {
        const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
        const remaining = Math.max(0, questionSeconds - elapsedSeconds);
        const ratio = Math.max(0, Math.min(1, remaining / questionSeconds));

        timerFill.style.width = `${ratio * 100}%`;
        timerFill.classList.toggle('is-low', remaining <= 5);
        timerSeconds.textContent = String(Math.ceil(remaining));

        if (remaining <= 0) {
            clearInterval(questionTimerInterval);
            questionTimerInterval = null;
            if (!hasAnsweredThisQuestion) {
                Array.from(answersGrid.children).forEach((b) => { b.disabled = true; });
                timerSeconds.textContent = t('game.timeUp');
            }
        }
    }

    tick();
    questionTimerInterval = setInterval(tick, 200);
}

// Só usado no modo custom agora - o pacote oficial tem a mesma
// fórmula rodando dentro da Edge Function, do lado do servidor
// (ver supabase/functions/showdown-submit-answer), calculada com o
// relógio do servidor, não o do navegador de quem está jogando.
function calcPoints(elapsedMs, questionSeconds) {
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 3) return 1000;
    if (elapsedSeconds >= questionSeconds) return 300;
    const ratio = (elapsedSeconds - 3) / (questionSeconds - 3);
    return Math.round(1000 - ratio * (1000 - 300));
}

async function submitAnswerCustom(room, questionIndex, isCorrect, btnEl) {

    if (hasAnsweredThisQuestion) return;
    hasAnsweredThisQuestion = true;

    Array.from(answersGrid.children).forEach((b) => { b.disabled = true; });
    btnEl.classList.add('is-selected');

    const elapsedMs = Date.now() - new Date(room.question_started_at).getTime();
    const points = isCorrect ? calcPoints(elapsedMs, room.question_seconds) : 0;

    answersGrid.hidden = true;
    answerSentMsg.hidden = false;

    const { error: answerError } = await window.ndquestSupabase
        .from('showdown_answers')
        .insert({
            room_id: room.id,
            player_id: currentPlayerId,
            question_index: questionIndex,
            is_correct: isCorrect,
            points_earned: points
        });

    if (answerError) {
        console.error('Show Down submit answer error:', answerError);
        return;
    }

    const { data: playerRow } = await window.ndquestSupabase
        .from('showdown_players')
        .select('total_score')
        .eq('id', currentPlayerId)
        .single();

    const newScore = (playerRow ? playerRow.total_score : 0) + points;

    await window.ndquestSupabase
        .from('showdown_players')
        .update({ total_score: newScore })
        .eq('id', currentPlayerId);
}

// Pacote oficial - a Edge Function decide certo/errado, calcula os
// pontos por velocidade (usando o horário de início que o banco
// trava contra manipulação) e grava tudo sozinha. O navegador só
// reflete o resultado na tela, nunca decide nem escreve nada direto.
async function submitAnswerOfficial(room, questionId, selectedIndex, btnEl) {

    if (hasAnsweredThisQuestion) return;
    hasAnsweredThisQuestion = true;

    Array.from(answersGrid.children).forEach((b) => { b.disabled = true; });
    btnEl.classList.add('is-selected');

    answersGrid.hidden = true;
    answerSentMsg.hidden = false;

    const result = await callGameFunction('showdown-submit-answer', {
        room_id: room.id,
        question_id: questionId,
        selected_index: selectedIndex,
        player_id: currentPlayerId,
    });

    if (result.error) {
        console.error('Show Down: erro ao enviar resposta', result.error);
    }

}

// --------------------------------------------------------
// Tela de resultado da pergunta
// --------------------------------------------------------

async function renderResults(room) {

    showScreen(screenResults);

    const index = room.current_question_index;

    const { data: myAnswer } = await window.ndquestSupabase
        .from('showdown_answers')
        .select('is_correct, points_earned')
        .eq('player_id', currentPlayerId)
        .eq('question_index', index)
        .maybeSingle();

    resultsBadge.classList.remove('is-correct', 'is-wrong');

    if (!myAnswer) {
        resultsBadge.textContent = t('results.noAnswer');
        resultsBadge.classList.add('is-wrong');
        resultsPoints.textContent = t('results.zeroPoints');
    } else if (myAnswer.is_correct) {
        resultsBadge.textContent = t('results.correct');
        resultsBadge.classList.add('is-correct');
        resultsPoints.textContent = t('results.pointsEarned', { n: myAnswer.points_earned });
    } else {
        resultsBadge.textContent = t('results.wrong');
        resultsBadge.classList.add('is-wrong');
        resultsPoints.textContent = t('results.zeroPoints');
    }

    const players = await loadPlayers(room.id);
    renderRankingList(resultsRankingList, players);
}

async function loadPlayers(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('showdown_players')
        .select('id, user_id, nickname, total_score')
        .eq('room_id', roomId);

    if (error) {
        console.error('Show Down load players error:', error);
        return [];
    }
    return data || [];
}

async function renderRankingList(container, players) {
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    const badgeMap = await loadPlayerBadgeMap(sorted.map((p) => p.user_id));
    container.innerHTML = sorted
        .map((p, i) => `
            <div class="leaderboard-row ${p.id === currentPlayerId ? 'is-selected' : ''}">
                <span class="leaderboard-row__rank">#${i + 1}</span>
                <span class="leaderboard-row__name-block">
                    <span class="leaderboard-row__name">${p.nickname}</span>
                    ${buildMiniBadgeRow(badgeMap.get(p.user_id))}
                </span>
                <span class="leaderboard-row__score">${p.total_score} ${t('ranking.pointsLabel')}</span>
            </div>
        `)
        .join('');
}

// --------------------------------------------------------
// Tela de ranking final
// --------------------------------------------------------

async function renderFinal(room) {

    // Trava contra renderFinal ser chamado mais de uma vez pra mesma
    // sala/round - precisa ficar ANTES de qualquer await. Mesmo bug
    // de corrida confirmado com dado real no Time Attack: duas
    // chamadas concorrentes passavam pelo await antes de qualquer
    // uma marcar a trava. O reset em "waiting" (acima) garante que um
    // novo round na mesma sala volta a gravar normal.
    const isNewFinal = historyRecordedForRoom !== room.id;
    if (isNewFinal) historyRecordedForRoom = room.id;

    showScreen(screenFinal);

    const players = await loadPlayers(room.id);
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    const myPosition = sorted.findIndex((p) => p.id === currentPlayerId) + 1;

    finalYourPosition.textContent = myPosition > 0
        ? t('finalRanking.yourPosition', { n: myPosition })
        : '';

    renderRankingList(finalRankingList, players);

    // Histórico de partida - logado vai pro match_history (público).
    // Sem login, se a sala tem host logado, vai pro guest_participants
    // - só o host daquela sala vê. Sem host logado, não tem pra quem
    // mostrar, não grava nada mesmo. A trava contra chamada duplicada
    // já foi feita no topo da função (isNewFinal).
    if (isNewFinal) {
        const historyUserId = await getCurrentUserId();
        const myRow = sorted.find((p) => p.id === currentPlayerId);

        if (historyUserId) {
            const { error: historyError } = await window.ndquestSupabase
                .from('match_history')
                .insert({
                    user_id: historyUserId,
                    role: 'player',
                    game: 'show_down',
                    room_code: currentRoom.room_code,
                    placement: myPosition > 0 ? myPosition : null,
                    details: { total_score: myRow ? myRow.total_score : 0 }
                });

            if (historyError) {
                console.error('Show Down match history error:', historyError);
            }
        } else if (currentRoom.host_id) {
            const { error: guestError } = await window.ndquestSupabase
                .from('guest_participants')
                .insert({
                    host_id: currentRoom.host_id,
                    game: 'show_down',
                    room_code: currentRoom.room_code,
                    nickname: myRow ? myRow.nickname : '',
                    placement: myPosition > 0 ? myPosition : null,
                    details: { total_score: myRow ? myRow.total_score : 0 }
                });

            if (guestError) {
                console.error('Show Down guest participant error:', guestError);
            }
        }
    }

    // A inscrição em tempo real continua ativa de propósito (não
    // remove o canal aqui): se o host apertar "Jogar de Novo", a
    // sala volta pro status "waiting" e o jogador precisa continuar
    // ouvindo essa mudança sem precisar recarregar a página. Só sai
    // de fato ao clicar em "Sair da sala" ou "Voltar pro NDQuest",
    // que navegam pra outra página e derrubam a conexão sozinhos.
}
