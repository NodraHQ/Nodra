// ==================================================================
// NDQUEST — submit.js
// Page-specific logic for the question-pack submission form.
// Depends on `ndquestSupabase`, defined in supabase-client.js
// (loaded before this file).
//
// Dois idiomas era obrigatório antes - reportado ao vivo: "os 2
// idiomas é opcional". Agora basta um; o outro copia
// automaticamente o mesmo texto na hora de montar o pacote, mesmo
// truque já usado nas perguntas personalizadas dos jogos.
//
// Upload em lote (.txt) também não existia - só dava pra adicionar
// pergunta por pergunta no formulário. Mesmo formato de texto que
// os jogos já usam (PERGUNTA/RESPOSTAS/CORRETA), com um campo a
// mais (DIFICULDADE), já que aqui o pacote é dividido por nível.
// ==================================================================

const draftQuestions = [];

const difficultyLabel = {
    easy: { pt: "Fácil", en: "Easy" },
    medium: { pt: "Médio", en: "Medium" },
    hard: { pt: "Difícil", en: "Hard" },
};

function getAnswerInputs(lang) {
    return Array.from(
        document.querySelectorAll(`.answer-input[data-lang="${lang}"]`)
    ).sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
}

function clearQuestionFields() {
    document.getElementById("q-text-pt").value = "";
    document.getElementById("q-text-en").value = "";
    getAnswerInputs("pt").forEach(input => (input.value = ""));
    getAnswerInputs("en").forEach(input => (input.value = ""));
    document.getElementById("q-difficulty").value = "easy";
    document.getElementById("q-correct").value = "0";
}

function renderDraftList() {

    const list = document.getElementById("draft-list");
    const empty = document.getElementById("draft-empty");

    list.innerHTML = "";

    if (draftQuestions.length === 0) {
        empty.hidden = false;
        return;
    }

    empty.hidden = true;

    draftQuestions.forEach((q, index) => {

        const item = document.createElement("div");
        item.className = "draft-item";

        const lang = document.documentElement.dataset.lang || "en";

        item.innerHTML = `
            <span>
                <span class="draft-item__tag">${difficultyLabel[q.difficulty][lang]}</span>
                ${q.question[lang]}
            </span>
        `;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "draft-item__remove";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", () => {
            draftQuestions.splice(index, 1);
            renderDraftList();
        });

        item.appendChild(removeBtn);
        list.appendChild(item);

    });

}

function showFeedback(message, type) {
    const feedback = document.getElementById("submit-feedback");
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.className = `submit-feedback submit-feedback--${type}`;
}

document.getElementById("add-question-btn").addEventListener("click", () => {

    if (draftQuestions.length >= 50) {
        showFeedback("Limite de 50 perguntas por pacote atingido. / Limit of 50 questions per pack reached.", "error");
        return;
    }

    const difficulty = document.getElementById("q-difficulty").value;
    const questionPtRaw = document.getElementById("q-text-pt").value.trim();
    const questionEnRaw = document.getElementById("q-text-en").value.trim();

    // Um idioma só já basta - o que faltar copia do outro.
    if (!questionPtRaw && !questionEnRaw) {
        showFeedback("Preencha a pergunta em pelo menos um idioma. / Fill in the question in at least one language.", "error");
        return;
    }
    const questionPt = questionPtRaw || questionEnRaw;
    const questionEn = questionEnRaw || questionPtRaw;

    const answersPtRaw = getAnswerInputs("pt").map(i => i.value.trim());
    const answersEnRaw = getAnswerInputs("en").map(i => i.value.trim());
    const ptFilled = answersPtRaw.every(a => a);
    const enFilled = answersEnRaw.every(a => a);

    if (!ptFilled && !enFilled) {
        showFeedback("Preencha as 4 respostas em pelo menos um idioma. / Fill in all 4 answers in at least one language.", "error");
        return;
    }
    const answersPt = ptFilled ? answersPtRaw : answersEnRaw;
    const answersEn = enFilled ? answersEnRaw : answersPtRaw;

    const correct = Number(document.getElementById("q-correct").value);

    draftQuestions.push({
        difficulty,
        question: { pt: questionPt, en: questionEn },
        answers: { pt: answersPt, en: answersEn },
        correct,
    });

    clearQuestionFields();
    renderDraftList();
    document.getElementById("submit-feedback").hidden = true;

});

// ==================================================================
// LOTE (.txt) — mesmo formato dos jogos, mais um campo opcional de
// dificuldade. Cada bloco separado por "---".
// ==================================================================

const bulkTextarea = document.getElementById("bulk-textarea");
const fileUploadInput = document.getElementById("file-upload");
const parseBtn = document.getElementById("parse-btn");
const parseErrorsBox = document.getElementById("parse-errors");
const downloadTemplateBtn = document.getElementById("download-template-btn");

const SUBMIT_TEMPLATE_TEXT = `DIFICULDADE: facil
PERGUNTA: Qual é a capital do Brasil?
RESPOSTAS: Brasília; São Paulo; Rio de Janeiro; Salvador
CORRETA: 1
---
DIFICULDADE: dificil
PERGUNTA: O que é uma stablecoin?
RESPOSTAS: Uma moeda que nunca muda de dono; Um token que tenta manter valor estável; Uma carteira offline; Um tipo de NFT
CORRETA: 2
`;

downloadTemplateBtn.addEventListener("click", () => {
    const blob = new Blob([SUBMIT_TEMPLATE_TEXT], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-perguntas-ndquest.txt";
    a.click();
    URL.revokeObjectURL(url);
});

fileUploadInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { bulkTextarea.value = reader.result; };
    reader.readAsText(file, "utf-8");
});

const DIFFICULTY_ALIASES = {
    facil: "easy", fácil: "easy", easy: "easy",
    medio: "medium", médio: "medium", medium: "medium",
    dificil: "hard", difícil: "hard", hard: "hard",
};

function parseSubmitBulkText(text) {
    const blocks = text.split(/\n\s*---\s*\n/).map((b) => b.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];

    blocks.forEach((block, i) => {
        const label = `Pergunta ${i + 1}`;
        const data = {};
        block.split("\n").forEach((line) => {
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (match) data[match[1].trim().toUpperCase()] = match[2].trim();
        });

        const questionText = data["PERGUNTA"];
        if (!questionText) {
            errors.push(`${label}: faltou PERGUNTA.`);
            return;
        }

        const answersRaw = data["RESPOSTAS"];
        if (!answersRaw) {
            errors.push(`${label}: faltou RESPOSTAS.`);
            return;
        }

        const answers = answersRaw.split(";").map((a) => a.trim()).filter(Boolean);
        if (answers.length !== 4) {
            errors.push(`${label}: precisa ter exatamente 4 respostas separadas por ";" (encontrei ${answers.length}).`);
            return;
        }

        const correctRaw = Number(data["CORRETA"]);
        if (!correctRaw || correctRaw < 1 || correctRaw > 4) {
            errors.push(`${label}: CORRETA precisa ser um número de 1 a 4.`);
            return;
        }

        // DIFICULDADE é opcional - sem ela, cai em "medium". Aceita
        // com ou sem acento, maiúsculo ou minúsculo.
        const difficultyRaw = (data["DIFICULDADE"] || "").toLowerCase();
        const difficulty = DIFFICULTY_ALIASES[difficultyRaw] || "medium";

        parsed.push({
            difficulty,
            question: { pt: questionText, en: questionText },
            answers: { pt: answers, en: answers },
            correct: correctRaw - 1
        });
    });

    if (draftQuestions.length + parsed.length > 50) {
        errors.push(`Máximo de 50 perguntas por pacote (você já tem ${draftQuestions.length}, isso adicionaria mais ${parsed.length}).`);
    }

    return { parsed, errors };
}

parseBtn.addEventListener("click", () => {
    const { parsed, errors } = parseSubmitBulkText(bulkTextarea.value);

    if (errors.length > 0) {
        parseErrorsBox.hidden = false;
        parseErrorsBox.innerHTML = `<strong>Encontrei ${errors.length} problema(s):</strong><ul>${errors.map((e) => `<li>${e}</li>`).join("")}</ul>`;
        if (parsed.length === 0) return;
    } else {
        parseErrorsBox.hidden = true;
    }

    draftQuestions.push(...parsed);
    bulkTextarea.value = "";
    renderDraftList();
});

function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

document.getElementById("submit-form").addEventListener("submit", async (event) => {

    event.preventDefault();

    const namePtRaw = document.getElementById("pack-name-pt").value.trim();
    const nameEnRaw = document.getElementById("pack-name-en").value.trim();
    const submitterName = document.getElementById("submitter-name").value.trim();
    const submitterEmail = document.getElementById("submitter-email").value.trim();

    if (!namePtRaw && !nameEnRaw) {
        showFeedback("Preencha o nome do pacote em pelo menos um idioma. / Fill in the pack name in at least one language.", "error");
        return;
    }
    if (!submitterName || !submitterEmail) {
        showFeedback("Preencha seu nome e email antes de enviar. / Fill in your name and email before submitting.", "error");
        return;
    }
    const namePt = namePtRaw || nameEnRaw;
    const nameEn = nameEnRaw || namePtRaw;

    if (draftQuestions.length === 0) {
        showFeedback("Adicione pelo menos uma pergunta antes de enviar. / Add at least one question before submitting.", "error");
        return;
    }

    const questions = { easy: [], medium: [], hard: [] };
    draftQuestions.forEach(q => {
        questions[q.difficulty].push({
            question: q.question,
            answers: q.answers,
            correct: q.correct,
        });
    });

    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;

    // Passou a chamar a Edge Function em vez de inserir direto -
    // reportado ao vivo: "1 por dia sem login, 5 com login, 10 pra
    // VIP". Um limite checado só aqui no navegador seria decorativo,
    // dava pra pular reenviando o formulário - a contagem de verdade
    // agora mora no servidor (ver submit-question-pack), que decide
    // sozinho qual limite aplicar (login é opcional pra enviar
    // pacote, só muda a cota).
    const { data: { session } } = await ndquestSupabase.auth.getSession();
    const response = await fetch(`${NDQUEST_SUPABASE_URL}/functions/v1/submit-question-pack`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
            slug: `${slugify(nameEn)}-${Date.now()}`,
            namePt,
            nameEn,
            submitterName,
            submitterEmail,
            questions,
        }),
    });

    const result = await response.json().catch(() => ({}));

    submitBtn.disabled = false;

    if (!response.ok) {
        showFeedback(result.error || "Algo deu errado ao enviar. Tente novamente. / Something went wrong sending your pack. Please try again.", "error");
        return;
    }

    showFeedback("Pacote enviado! Nossa equipe vai revisar em breve. / Pack sent! Our team will review it soon.", "success");
    document.getElementById("submit-form").reset();
    draftQuestions.length = 0;
    renderDraftList();

});

renderDraftList();

// Preenche e trava nome/email com o que já está na conta, se
// estiver logado - reportado ao vivo: "deveria ser fixo o do login
// já", pra garantir que o nome bate com quem realmente enviou (e não
// dá pra digitar um nome diferente do seu pra disfarçar quem
// mandou). Sem login, os campos continuam livres pra digitar, do
// jeito que já era.
(async function lockSubmitterFieldsIfLoggedIn() {
    const { data: { session } } = await ndquestSupabase.auth.getSession();
    if (!session?.user) return;

    const nameInput = document.getElementById("submitter-name");
    const emailInput = document.getElementById("submitter-email");

    const { data: profile } = await ndquestSupabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profile?.username) nameInput.value = profile.username;
    if (session.user.email) emailInput.value = session.user.email;

    // Some os campos inteiros em vez de só travar readonly -
    // reportado ao vivo: "mesmo logado ainda pede email e nome, não
    // faz sentido isso". Já que o valor é fixo e não editável de
    // qualquer forma, mostrar os dois campos preenchidos e cinzas
    // ainda parecia "pedir" a informação de novo - mais claro só
    // confirmar com uma frase quem está enviando.
    //
    // required precisa sair dos dois - um campo escondido com
    // required trava o envio do formulário inteiro no navegador
    // ("an invalid form control is not focusable"), quase passou
    // batido nessa correção.
    nameInput.required = false;
    emailInput.required = false;
    document.getElementById("submitter-fields-anonymous").hidden = true;
    document.getElementById("submitter-email-anonymous").hidden = true;

    const note = document.getElementById("submitter-logged-in-note");
    const template = window.nodraTranslator?.translations?.["submit.submittingAs"] || "Submitting as {username} ({email}).";
    note.textContent = template
        .replace("{username}", profile?.username || "?")
        .replace("{email}", session.user.email || "?");
    note.hidden = false;
})();
