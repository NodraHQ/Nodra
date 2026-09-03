// ==================================================================
// ROULETTE - play/play.js
//
// Reportado ao vivo: antes o jogador só entrava com o nome e via
// "você está dentro", sem nada além disso - o sorteio inteiro
// acontecia só na tela do host. Agora a roda gira aqui também,
// sincronizada com o host via realtime na própria linha da sala.
// ==================================================================

import translations from '../i18n/translations.js';
import themes from '../branding/branding-manifest.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('roulette:language') || 'pt';

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
// escolheu destacar, no banner de vencedor. Cópia própria desta
// pasta (mesma lógica dos outros jogos).
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
        window.ndquestSupabase.from('profiles_public').select('id, featured_badge_ids').in('id', validIds),
        window.ndquestSupabase
            .from('user_badges')
            .select('user_id, badge_id, badges(name_pt, background_color, icon, icon_color, image_url, badge_shape)')
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
            // Respeita a forma de verdade da badge (hex, coin, square...)
            // em vez de sempre forçar círculo - bug real reportado ao
            // vivo: "não pode cortar, qual o sentido disso?" - uma arte
            // desenhada pro formato hexagonal (pontas, número no topo)
            // ficava com as pontas cortadas quando o mini-badge sempre
            // recortava em círculo, não importa a forma escolhida na
            // criação. Mesmas classes/recortes que a badge em tamanho
            // grande já usa (ver account.css .badge--*), só que na
            // escala pequena - ver .mini-badge--* no CSS deste jogo.
            // Imagem própria já vem com forma e fundo desenhados nela
            // mesma - sem recorte extra, sem cor de fundo por trás
            // (mesma correção aplicada na badge em tamanho grande, ver
            // account.css .badge--image - senão sobra um "anel" da cor
            // de fundo em volta da arte, onde o recorte daqui não bate
            // pixel a pixel com o hexágono já desenhado na imagem).
            const shapeClass = b.image_url ? 'mini-badge--image' : `mini-badge--${b.badge_shape || 'circle'}`;

            if (b.image_url) {
                return `<span class="mini-badge ${shapeClass}"><img src="${b.image_url}" alt=""></span>`;
            }
            const color = b.icon_color || b.background_color || '#888';
            // Badge sem ícone e sem imagem é uma opção válida na hora de
            // criar (só forma+cor) - sem isso, ficava um círculo vazio
            // (reportado ao vivo: "só aparece um quadradinho azul"). Cai
            // pra inicial do nome, mesmo espírito de um avatar sem foto.
            // Checa o SVG de verdade, não só se b.icon existe - segunda
            // rodada do mesmo bug reportada ao vivo: um ícone com valor
            // que não bate com nenhuma chave conhecida (fora dos 8 que
            // o sistema reconhece) também gera SVG vazio, e só olhar
            // "b.icon existe" não pegava esse caso.
            const iconSvg = b.icon ? buildMiniIconSvg(b.icon) : '';
            // Cor do texto fixa em branco, não herdada de b.icon_color -
            // bug real reportado ao vivo: badge sem ícone também não tem
            // icon_color (não faz sentido ter cor de ícone sem ícone), e
            // "color" acima cai pro MESMO background_color do fundo -
            // letra invisível, escondida na própria cor do círculo.
            const fallback = iconSvg || `<span class="mini-badge__initial" style="color:#fff;">${(b.name_pt || '?').charAt(0).toUpperCase()}</span>`;
            return `<span class="mini-badge ${shapeClass}" style="background:${b.background_color || '#333'};color:${color};">${fallback}</span>`;
        })
        .join('');
    return `<div class="mini-badge-row">${chips}</div>`;
}

// Nome clicável, indo pro perfil público de quem tem conta -
// reportado ao vivo: "quero clicar no nome no ranking/dentro da
// rodada e ir pro card de perfil, pro host conseguir ver e dar a
// recompensa". Sem username (jogador convidado, sem conta), mostra
// só o texto puro, sem link nenhum.
function buildPlayerNameLink(name, username) {
    const safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!username) return safeName;
    const profileUrl = `../../../account/perfil.html?u=${encodeURIComponent(username)}`;
    return `<a href="${profileUrl}" target="_blank" rel="noopener" class="player-name-link">${safeName}</a>`;
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
    localStorage.setItem('roulette:language', lang);
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
const screenJoined = document.getElementById('screen-joined');
const logoImg = document.getElementById('logo-img');

const roomCodeInput = document.getElementById('room-code-input');
const nicknameInput = document.getElementById('nickname-input');
const joinError = document.getElementById('join-error');
const joinRoomBtn = document.getElementById('join-room-btn');

const joinedStatusText = document.getElementById('joined-status-text');
const winnerBanner = document.getElementById('winner-banner');
const winnerBannerName = document.getElementById('winner-banner-name');
const winnerBadgeRow = document.getElementById('winner-badge-row');
const wheelSvg = document.getElementById('wheel-svg');
const wheelHub = document.querySelector('.wheel-hub');
const winnersEmpty = document.getElementById('winners-empty');
const winnersList = document.getElementById('winners-list');

function showScreen(el) {
    [screenJoin, screenJoined].forEach((s) => { s.hidden = true; });
    el.hidden = false;
}

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl.toUpperCase();
}

// --------------------------------------------------------
// A roda em si - mesma lógica de desenho do host.js (cópia própria
// desta pasta). O ângulo exato não precisa bater com o do host -
// cada tela calcula a própria animação a partir do próprio zero,
// usando o MESMO índice de vencedor sincronizado pelo banco, então
// sempre pousa na pessoa certa mesmo sem replicar o giro pixel a
// pixel.
// --------------------------------------------------------

const WHEEL_CENTER = 150;
const WHEEL_RADIUS = 145;
let currentRotationDeg = 0;
let renderedPool = null; // controla se precisa redesenhar a roda (evita redesenhar toda atualização de realtime à toa)
let lastKnownPoolSize = 0; // controla se um "idle" é rodada nova de verdade (roda cresceu de volta) ou só o vencedor sendo removido (roda encolheu)
let lastHandledSpinStartedAt = null; // controla se já reagiu a ESSE giro específico (evita girar duas vezes pro mesmo evento)
let winnersHistory = [];
let previousRounds = [];
let roundCounter = 1;

function renderPreviousRounds() {
    const card = document.getElementById('previous-rounds-card');
    const list = document.getElementById('previous-rounds-list');
    if (!card || !list) return;

    if (previousRounds.length === 0) {
        card.hidden = true;
        return;
    }

    card.hidden = false;
    list.innerHTML = '';

    [...previousRounds].reverse().forEach((round) => {
        const block = document.createElement('div');
        block.className = 'previous-round-block';

        const title = document.createElement('p');
        title.className = 'previous-round-title';
        title.textContent = `${t('wheel.roundLabel')} ${round.roundNumber}`;
        block.appendChild(title);

        round.results.forEach((winner) => {
            const row = document.createElement('div');
            row.className = 'previous-round-row';
            row.innerHTML = buildPlayerNameLink(winner.name, winner.username);
            block.appendChild(row);
        });

        list.appendChild(block);
    });
}


function wheelPoint(angleDeg, radius) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
        x: WHEEL_CENTER + radius * Math.sin(rad),
        y: WHEEL_CENTER - radius * Math.cos(rad)
    };
}

function buildWheel(pool) {
    const svgNS = 'http://www.w3.org/2000/svg';
    wheelSvg.innerHTML = '';

    if (pool.length === 0) return;

    if (pool.length === 1) {
        if (wheelHub) wheelHub.style.display = 'none';

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', String(WHEEL_CENTER));
        circle.setAttribute('cy', String(WHEEL_CENTER));
        circle.setAttribute('r', String(WHEEL_RADIUS));
        circle.setAttribute('fill', 'var(--color-gold)');
        circle.setAttribute('stroke', 'var(--color-bg)');
        circle.setAttribute('stroke-width', '2');
        wheelSvg.appendChild(circle);

        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', String(WHEEL_CENTER));
        text.setAttribute('y', String(WHEEL_CENTER));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '16');
        const soleName = pool[0];
        text.textContent = soleName.length > 14 ? `${soleName.slice(0, 13)}…` : soleName;
        wheelSvg.appendChild(text);
        return;
    }

    if (wheelHub) wheelHub.style.display = '';

    const sliceAngle = 360 / pool.length;
    const fontSize = Math.max(8, Math.min(14, 160 / pool.length + 6));

    pool.forEach((name, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = (index + 1) * sliceAngle;
        const midAngle = (startAngle + endAngle) / 2;

        const p1 = wheelPoint(startAngle, WHEEL_RADIUS);
        const p2 = wheelPoint(endAngle, WHEEL_RADIUS);
        const largeArc = sliceAngle > 180 ? 1 : 0;

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute(
            'd',
            `M ${WHEEL_CENTER},${WHEEL_CENTER} L ${p1.x},${p1.y} A ${WHEEL_RADIUS},${WHEEL_RADIUS} 0 ${largeArc},1 ${p2.x},${p2.y} Z`
        );
        path.setAttribute('fill', index % 2 === 0 ? 'var(--color-gold)' : 'var(--color-gold-light)');
        path.setAttribute('stroke', 'var(--color-bg)');
        path.setAttribute('stroke-width', '2');
        wheelSvg.appendChild(path);

        const textPoint = wheelPoint(midAngle, WHEEL_RADIUS * 0.66);
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', String(textPoint.x));
        text.setAttribute('y', String(textPoint.y));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', String(fontSize));
        text.setAttribute('transform', `rotate(${midAngle}, ${textPoint.x}, ${textPoint.y})`);
        const label = name.length > 12 ? `${name.slice(0, 11)}…` : name;
        text.textContent = label;
        wheelSvg.appendChild(text);
    });
}

function spinToIndex(poolLength, winnerIndex) {
    const sliceAngle = 360 / poolLength;
    const winnerMidAngle = (winnerIndex + 0.5) * sliceAngle;
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.6;

    const targetMod = ((360 - winnerMidAngle + jitter) % 360 + 360) % 360;
    const currentMod = ((currentRotationDeg % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;

    const extraSpins = 6 * 360;
    currentRotationDeg += extraSpins + delta;

    wheelSvg.classList.remove('is-idle');
    wheelSvg.style.transition = 'none';
    void wheelSvg.offsetWidth;

    requestAnimationFrame(() => {
        wheelSvg.style.transition = 'transform 4.5s cubic-bezier(.12,.72,.14,1)';
        wheelSvg.style.transform = `rotate(${currentRotationDeg}deg)`;
    });
}

async function renderWinnerReveal(winnerName, roomId) {
    winnerBanner.hidden = false;
    winnerBannerName.textContent = winnerName;

    // Se o vencedor for eu mesmo, destaca de um jeito diferente -
    // reconhece direto na tela, sem precisar comparar nome.
    winnerBanner.classList.toggle('is-me', winnerName === currentNickname);

    // Acha o dono do nome vencedor (user_id e username) - reportado
    // ao vivo: só mostrava badge quando o vencedor era a própria
    // pessoa olhando. O pool da roda guarda só os nomes (não o
    // user_id de cada um), então busca o dono do nome na lista de
    // jogadores da sala. O username (diferente do apelido digitado
    // nesse jogo) é o que serve pra montar o link do perfil público -
    // reportado ao vivo: "quero clicar no nome no ranking/rodada e ir
    // pro perfil, pro host conseguir ver e dar a recompensa".
    let winnerUserId = await getCurrentUserId();
    let winnerUsername = null;
    if (winnerName !== currentNickname) {
        winnerUserId = null;
        const { data: matchingPlayers } = await window.ndquestSupabase
            .from('roulette_players')
            .select('user_id')
            .eq('room_id', roomId)
            .eq('nickname', winnerName)
            .limit(1);
        winnerUserId = matchingPlayers?.[0]?.user_id || null;
    }

    if (winnerUserId) {
        const { data: profileData } = await window.ndquestSupabase
            .from('profiles_public')
            .select('username')
            .eq('id', winnerUserId)
            .maybeSingle();
        winnerUsername = profileData?.username || null;
    }

    winnerBannerName.innerHTML = buildPlayerNameLink(winnerName, winnerUsername);

    const badgeMap = winnerUserId ? await loadPlayerBadgeMap([winnerUserId]) : new Map();

    if (winnerUserId) {
        winnerBadgeRow.innerHTML = buildMiniBadgeRow(badgeMap.get(winnerUserId));
    } else {
        winnerBadgeRow.innerHTML = '';
    }

    // Guarda o user_id e o username junto do nome na lista de
    // ganhadores - assim a lista embaixo também consegue mostrar o
    // badge e o link do perfil de cada um. Busca os badges de TODO
    // MUNDO já na lista de uma vez (não só do vencedor mais recente),
    // senão quem ganhou antes perderia o próprio badge assim que um
    // novo vencedor for revelado.
    winnersHistory.push({ name: winnerName, userId: winnerUserId, username: winnerUsername });
    winnersEmpty.hidden = winnersHistory.length > 0;

    const allWinnerIds = winnersHistory.map((w) => w.userId).filter(Boolean);
    const allBadgesMap = await loadPlayerBadgeMap(allWinnerIds);

    winnersList.innerHTML = winnersHistory
        .map((w) => `<span class="winner-chip">${buildPlayerNameLink(w.name, w.username)}${buildMiniBadgeRow(w.userId ? allBadgesMap.get(w.userId) : null)}</span>`)
        .join('');
}

function reactToRoomState(room) {
    const pool = room.current_pool || [];
    const previousPoolSize = lastKnownPoolSize;
    lastKnownPoolSize = pool.length;

    if (JSON.stringify(pool) !== JSON.stringify(renderedPool)) {
        renderedPool = pool;
        buildWheel(pool);
    }

    if (room.spin_status === 'spinning' && room.spin_started_at !== lastHandledSpinStartedAt) {
        lastHandledSpinStartedAt = room.spin_started_at;
        winnerBanner.hidden = true;
        joinedStatusText.textContent = t('joined.spinning');
        const winnerIndex = room.current_winner_index;
        if (typeof winnerIndex === 'number' && pool.length > 0) {
            spinToIndex(pool.length, winnerIndex);
            // Revela o resultado depois da mesma duração da animação
            // do host (4.5s) - não depende de outro evento de
            // realtime chegar bem cronometrado, sempre revela junto
            // com o giro terminando na tela de quem está assistindo.
            setTimeout(() => {
                joinedStatusText.textContent = t('joined.subtitle');
                renderWinnerReveal(room.current_winner_name, room.id);
            }, 4500);
        }
    } else if (room.spin_status === 'idle') {
        joinedStatusText.textContent = t('joined.subtitle');

        // Arquiva a rodada que fechou (mesmo esquema do Time Attack:
        // "Rodada 1", "Rodada 2") em vez de só apagar - reportado ao
        // vivo: o host resetava a PRÓPRIA lista ao clicar "Sortear de
        // Novo, Mesmos Nomes", mas cada jogador guarda a lista por
        // conta própria (local), e nunca era avisado pra também
        // resetar.
        //
        // MAS: "idle" também acontece toda vez que um vencedor é
        // REMOVIDO da roda depois de sortear (a roda é reconstruída
        // com a lista menor) - isso NÃO é rodada nova, é a MESMA
        // rodada continuando. Reportado ao vivo: sem essa distinção,
        // cada vencedor virava a própria "rodada", ignorando a ordem
        // de verdade. Só é rodada nova quando a roda CRESCE de volta
        // (volta pro tamanho cheio) - remover vencedor só ENCOLHE, só
        // "Sortear de Novo" enche de volta.
        const isGenuineNewRound = pool.length > previousPoolSize;

        if (isGenuineNewRound && winnersHistory.length > 0) {
            previousRounds.push({ roundNumber: roundCounter, results: [...winnersHistory] });
            roundCounter += 1;
            renderPreviousRounds();

            winnersHistory = [];
            winnersEmpty.hidden = false;
            winnersList.innerHTML = '';
        }
    }
}

function subscribeToRoomUpdates(roomId) {
    window.ndquestSupabase
        .channel(`roulette-room-updates-${roomId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'roulette_rooms', filter: `id=eq.${roomId}` },
            (payload) => {
                reactToRoomState(payload.new);
            }
        )
        .subscribe();
}

// --------------------------------------------------------
// Entrar na sala
// --------------------------------------------------------

let currentNickname = '';

joinRoomBtn.addEventListener('click', async () => {

    joinError.textContent = '';

    const roomCode = roomCodeInput.value.trim().toUpperCase();
    const nickname = nicknameInput.value.trim();
    currentNickname = nickname;

    if (!roomCode) {
        joinError.textContent = t('errors.roomCodeRequired');
        return;
    }
    if (!nickname) {
        joinError.textContent = t('errors.nicknameRequired');
        return;
    }

    joinRoomBtn.disabled = true;

    const { data, error } = await window.ndquestSupabase
        .from('roulette_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle();

    joinRoomBtn.disabled = false;

    if (error) {
        console.error('Roulette: erro ao buscar a sala', error);
    }

    if (error || !data) {
        joinError.textContent = t('errors.roomNotFound');
        return;
    }

    const joinUserId = await getCurrentUserId();

    // Se a pessoa está logada e já tem uma linha nessa sala, reaproveita
    // em vez de duplicar (mesma correção do Time Attack) - e não grava
    // "participei" de novo no histórico se já tiver entrado antes.
    let alreadyJoined = false;

    if (joinUserId) {
        const { data: existing } = await window.ndquestSupabase
            .from('roulette_players')
            .select('id')
            .eq('room_id', data.id)
            .eq('user_id', joinUserId)
            .maybeSingle();

        alreadyJoined = !!existing;
    }

    if (!alreadyJoined) {

        // Impede nome repetido dentro da mesma sala - vale pra
        // logado e pra quem entra sem login. Não bloqueia a própria
        // pessoa reconectando (checa pelo user_id, quando existe).
        const { data: existingWithName } = await window.ndquestSupabase
            .from('roulette_players')
            .select('id, user_id')
            .eq('room_id', data.id)
            .ilike('nickname', nickname);

        const nameTaken = (existingWithName || []).some((p) => {
            if (!joinUserId) return true;
            return !!p.user_id && p.user_id !== joinUserId;
        });

        let finalNameTaken = nameTaken;

        // Guest também não pode usar um nome que já é username de
        // alguma conta real, mesmo que essa conta nunca tenha entrado
        // nesta sala - prioridade é de quem tem conta, sempre.
        if (!finalNameTaken && !joinUserId) {
            const { data: isRegisteredUsername } = await window.ndquestSupabase
                .rpc('username_is_taken', { check_username: nickname });
            if (isRegisteredUsername) finalNameTaken = true;
        }

        if (finalNameTaken) {
            joinError.textContent = t('errors.nicknameTaken');
            return;
        }

        const { error: playerError } = await window.ndquestSupabase
            .from('roulette_players')
            .insert({ room_id: data.id, nickname, user_id: joinUserId });

        if (playerError) {
            joinError.textContent = t('errors.roomNotFound');
            console.error('Roulette join room error:', playerError);
            return;
        }
    }

    // Histórico de participação - grava na hora de entrar, não no fim
    // do sorteio: diferente dos outros jogos, o jogador nunca fica
    // sabendo o resultado pelo próprio código dele (o sorteio roda
    // inteiro do lado do host). Registra só a participação, sem
    // placement/resultado. Logado vai pro match_history (público);
    // sem login, se a sala tem host logado, vai pro guest_participants
    // (só o host vê). Ver docs/MATCH_HISTORY_ARCHITECTURE.md.
    if (!alreadyJoined) {
        if (joinUserId) {
            window.ndquestSupabase
                .from('match_history')
                .insert({
                    user_id: joinUserId,
                    role: 'player',
                    game: 'roulette',
                    room_code: roomCode
                })
                .then(({ error: historyError }) => {
                    if (historyError) console.error('Roulette match history error:', historyError);
                });
        } else if (data.host_id) {
            window.ndquestSupabase
                .from('guest_participants')
                .insert({
                    host_id: data.host_id,
                    game: 'roulette',
                    room_code: roomCode,
                    nickname
                })
                .then(({ error: guestError }) => {
                    if (guestError) console.error('Roulette guest participant error:', guestError);
                });
        }
    }

    const roomTheme = themes.find((th) => th.name === data.theme_name) || themes[0];
    applyTheme(roomTheme);

    showScreen(screenJoined);

    reactToRoomState(data);
    subscribeToRoomUpdates(data.id);
});

// --------------------------------------------------------
// Tema de marca (white label) - lido da sala, só aplicado.
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
