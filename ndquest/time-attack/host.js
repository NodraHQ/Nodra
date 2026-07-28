// ==================================================================
// TIME ATTACK — host.js
// ==================================================================

import questionPacks from './questions/questions-manifest.js';
import translations from './i18n/translations.js';

// --------------------------------------------------------
// Idioma
// --------------------------------------------------------

let currentLanguage = localStorage.getItem('time-attack:language') || 'pt';

function t(key) {
    const dict = translations[currentLanguage] || translations.pt;
    return dict[key] !== undefined ? dict[key] : key;
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

// --------------------------------------------------------
// Referências DOM
// --------------------------------------------------------

const screenConfig = document.getElementById('screen-config');
const screenRoom = document.getElementById('screen-room');

const hostNameInput = document.getElementById('host-name-input');
const packSelect = document.getElementById('pack-select');
const timeStartInput = document.getElementById('time-start-input');
const timeCapInput = document.getElementById('time-cap-input');
const timeBonusInput = document.getElementById('time-bonus-input');
const timePenaltyInput = document.getElementById('time-penalty-input');
const configError = document.getElementById('config-error');
const createRoomBtn = document.getElementById('create-room-btn');

const roomCodeText = document.getElementById('room-code-text');
const roomQrImg = document.getElementById('room-qr-img');
const roomLinkText = document.getElementById('room-link-text');
const copyLinkBtn = document.getElementById('copy-link-btn');
const roomSummary = document.getElementById('room-summary');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardEmpty = document.getElementById('leaderboard-empty');
const leaderboardPlayingNow = document.getElementById('leaderboard-playing-now');
const playAsHostLink = document.getElementById('play-as-host-link');
const closeRoomBtn = document.getElementById('close-room-btn');

const customQuestionsPanel = document.getElementById('custom-questions-panel');
const bulkTextarea = document.getElementById('bulk-textarea');
const downloadTemplateBtn = document.getElementById('download-template-btn');
const fileUploadInput = document.getElementById('file-upload');
const parseBtn = document.getElementById('parse-btn');
const parseErrorsBox = document.getElementById('parse-errors');
const previewStatus = document.getElementById('preview-status');
const previewList = document.getElementById('preview-list');

// --------------------------------------------------------
// Popular pacotes de perguntas (reaproveitado ao trocar idioma,
// já que os nomes dos pacotes não usam data-i18n)
// --------------------------------------------------------

function populatePackSelect() {
    const previousValue = packSelect.value;
    packSelect.innerHTML = '';

    questionPacks.forEach((pack, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = pack.name[currentLanguage] || pack.name.pt;
        packSelect.appendChild(option);
    });

    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = t('pack.customOption');
    packSelect.appendChild(customOption);

    if (previousValue) {
        packSelect.value = previousValue;
    }
}

populatePackSelect();

packSelect.addEventListener('change', () => {
    customQuestionsPanel.hidden = packSelect.value !== 'custom';
});

// --------------------------------------------------------
// Troca de idioma
// --------------------------------------------------------

function setActiveLanguageButton() {
    document.getElementById('lang-pt').classList.toggle('is-active', currentLanguage === 'pt');
    document.getElementById('lang-en').classList.toggle('is-active', currentLanguage === 'en');
}

function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('time-attack:language', lang);
    applyTranslations();
    setActiveLanguageButton();
    populatePackSelect();
    updatePreviewStatus();
}

document.getElementById('lang-pt').addEventListener('click', () => changeLanguage('pt'));
document.getElementById('lang-en').addEventListener('click', () => changeLanguage('en'));
setActiveLanguageButton();

// --------------------------------------------------------
// Código de sala (curto, fácil de digitar, sem caracteres
// ambíguos como 0/O ou 1/I)
// --------------------------------------------------------

// --------------------------------------------------------
// Minhas Próprias Perguntas — cola/envia, processa, usa só
// nesta sala (fica guardado na própria sala no banco, porque os
// jogadores estão em aparelhos diferentes do host, diferente do
// Quest Drop que fica tudo local no mesmo navegador).
// --------------------------------------------------------

let customQuestions = [];
updatePreviewStatus();

const CUSTOM_TEMPLATE_TEXT = `PERGUNTA: Qual é a capital do Brasil?
RESPOSTAS: Brasília; São Paulo; Rio de Janeiro; Salvador
CORRETA: 1
---
PERGUNTA: O que é uma stablecoin?
RESPOSTAS: Uma moeda que nunca muda de dono; Um token que tenta manter valor estável; Uma carteira offline; Um tipo de NFT
CORRETA: 2
`;

downloadTemplateBtn.addEventListener('click', () => {
    const blob = new Blob([CUSTOM_TEMPLATE_TEXT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-perguntas-time-attack.txt';
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

        parsed.push({
            question: { pt: questionText, en: questionText },
            answers: { pt: answers, en: answers },
            correct: correctRaw - 1
        });
    });

    if (parsed.length > 50) {
        errors.push(`Máximo de 50 perguntas por sala (encontrei ${parsed.length}).`);
    }

    return { parsed, errors };
}

function updatePreviewStatus() {
    if (customQuestions.length === 0) {
        previewStatus.textContent = t('customQuestions.noneYet');
    } else {
        previewStatus.textContent = t('customQuestions.someProcessed').replace('{n}', String(customQuestions.length));
    }
}

function renderPreview(parsed, errors) {
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
        item.textContent = q.question.pt;
        previewList.appendChild(item);
    });
}

parseBtn.addEventListener('click', () => {
    const { parsed, errors } = parseCustomBulkText(bulkTextarea.value);
    customQuestions = errors.length === 0 ? parsed : [];
    renderPreview(parsed, errors);
    updatePreviewStatus();
});

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// --------------------------------------------------------
// Criar sala
// --------------------------------------------------------

let activeRoomId = null;
let realtimeChannel = null;

createRoomBtn.addEventListener('click', async () => {

    configError.textContent = '';

    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        configError.textContent = t('errors.hostNameRequired');
        return;
    }

    const timeStart = Number(timeStartInput.value);
    const timeCap = Number(timeCapInput.value);
    const timeBonus = Number(timeBonusInput.value);
    const timePenalty = Number(timePenaltyInput.value);

    if (!timeStart || timeStart <= 0 || !timeCap || timeCap <= 0 || !timeBonus || timeBonus <= 0 || !timePenalty || timePenalty <= 0) {
        configError.textContent = t('errors.invalidTimeValues');
        return;
    }

    const packSlug = packSelect.value;

    if (packSlug === 'custom' && customQuestions.length === 0) {
        configError.textContent = t('errors.customQuestionsRequired');
        return;
    }

    createRoomBtn.disabled = true;

    const roomCode = generateRoomCode();

    const roomPayload = {
        room_code: roomCode,
        host_name: hostName,
        pack_slug: packSlug,
        time_bank_start: timeStart,
        time_bonus_correct: timeBonus,
        time_penalty_wrong: timePenalty,
        time_cap_seconds: timeCap
    };

    if (packSlug === 'custom') {
        roomPayload.custom_questions = customQuestions;
    }

    const { data, error } = await window.ndquestSupabase
        .from('time_attack_rooms')
        .insert(roomPayload)
        .select()
        .single();

    createRoomBtn.disabled = false;

    if (error || !data) {
        configError.textContent = t('errors.roomCreateFailed');
        console.error('Time Attack create room error:', error);
        return;
    }

    activeRoomId = data.id;
    showRoomScreen(roomCode, data, hostName);
});

// --------------------------------------------------------
// Tela da sala: código, QR, placar ao vivo
// --------------------------------------------------------

function showRoomScreen(roomCode, roomData, hostName) {

    screenConfig.hidden = true;
    screenRoom.hidden = false;

    roomCodeText.textContent = roomCode;

    const pack = questionPacks[Number(roomData.pack_slug)];
    const packName = roomData.pack_slug === 'custom'
        ? t('pack.customOption')
        : (pack ? (pack.name[currentLanguage] || pack.name.pt) : roomData.pack_slug);

    roomSummary.innerHTML = `
        <span class="room-summary__chip"><strong>${packName}</strong></span>
        <span class="room-summary__chip">${t('labels.timeBankStart')}: <strong>${roomData.time_bank_start}s</strong></span>
        <span class="room-summary__chip">${t('labels.timeBonusCorrect')}: <strong>+${roomData.time_bonus_correct}s</strong></span>
        <span class="room-summary__chip">${t('labels.timePenaltyWrong')}: <strong>-${roomData.time_penalty_wrong}s</strong></span>
        <span class="room-summary__chip">${t('labels.timeCapSeconds')}: <strong>${roomData.time_cap_seconds}s</strong></span>
    `;

    const baseUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}play/index.html`;

    // Link/QR público, sem nome nenhum — é o que qualquer jogador vê e usa.
    const publicPlayUrl = `${baseUrl}?room=${roomCode}`;
    roomLinkText.textContent = publicPlayUrl;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicPlayUrl)}`;
    roomQrImg.src = qrApiUrl;

    // Link só do botão "Jogar também", privado, já leva o nome do host
    // (que ele já digitou aqui na configuração) e pula direto pra tela
    // de pronto, sem pedir o nome de novo.
    const hostPlayUrl = `${baseUrl}?room=${roomCode}&nickname=${encodeURIComponent(hostName)}&autojoin=1`;
    playAsHostLink.href = hostPlayUrl;

    subscribeToLeaderboard(roomData.id);
}

function renderLeaderboard(players) {

    const finished = players.filter((p) => p.finished_at !== null);
    const playingCount = players.length - finished.length;

    if (playingCount > 0) {
        leaderboardPlayingNow.hidden = false;
        leaderboardPlayingNow.textContent = t('leaderboard.playingNow').replace('{n}', String(playingCount));
    } else {
        leaderboardPlayingNow.hidden = true;
    }

    leaderboardList.innerHTML = '';

    if (finished.length === 0) {
        leaderboardEmpty.hidden = false;
        return;
    }

    leaderboardEmpty.hidden = true;

    const sorted = [...finished].sort((a, b) => {
        if (b.correct_answers !== a.correct_answers) {
            return b.correct_answers - a.correct_answers;
        }
        return new Date(a.finished_at) - new Date(b.finished_at);
    });

    sorted.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.innerHTML = `
            <span class="leaderboard-row__rank">#${index + 1}</span>
            <span class="leaderboard-row__name">${player.nickname}</span>
            <span class="leaderboard-row__score">${player.correct_answers}</span>
        `;
        leaderboardList.appendChild(row);
    });
}

async function loadLeaderboard(roomId) {
    const { data, error } = await window.ndquestSupabase
        .from('time_attack_players')
        .select('nickname, correct_answers, finished_at')
        .eq('room_id', roomId);

    if (error) {
        console.error('Time Attack load leaderboard error:', error);
        return;
    }

    renderLeaderboard(data || []);
}

function subscribeToLeaderboard(roomId) {

    loadLeaderboard(roomId);

    realtimeChannel = window.ndquestSupabase
        .channel(`time-attack-room-${roomId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'time_attack_players', filter: `room_id=eq.${roomId}` },
            () => loadLeaderboard(roomId)
        )
        .subscribe();
}

// --------------------------------------------------------
// Encerrar sala
// --------------------------------------------------------

copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(roomLinkText.textContent);
        const originalLabel = copyLinkBtn.textContent;
        copyLinkBtn.textContent = t('buttons.linkCopied');
        copyLinkBtn.classList.add('is-copied');
        setTimeout(() => {
            copyLinkBtn.textContent = originalLabel;
            copyLinkBtn.classList.remove('is-copied');
        }, 1800);
    } catch (err) {
        console.error('Time Attack copy link error:', err);
    }
});

closeRoomBtn.addEventListener('click', async () => {

    if (!activeRoomId) return;

    closeRoomBtn.disabled = true;

    await window.ndquestSupabase
        .from('time_attack_rooms')
        .update({ status: 'closed' })
        .eq('id', activeRoomId);

    closeRoomBtn.disabled = false;
    closeRoomBtn.textContent = t('room.closedMessage');
    closeRoomBtn.disabled = true;

    if (realtimeChannel) {
        window.ndquestSupabase.removeChannel(realtimeChannel);
    }
});
