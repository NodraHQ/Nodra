// ==================================================================
// NDQUEST — submit.js
// Page-specific logic for the question-pack submission form.
// Depends on `ndquestSupabase`, defined in supabase-client.js
// (loaded before this file).
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

    if (draftQuestions.length >= 60) {
        showFeedback("Limite de 60 perguntas por pacote atingido. / 60-question limit per pack reached.", "error");
        return;
    }

    const difficulty = document.getElementById("q-difficulty").value;
    const questionPt = document.getElementById("q-text-pt").value.trim();
    const questionEn = document.getElementById("q-text-en").value.trim();
    const answersPt = getAnswerInputs("pt").map(i => i.value.trim());
    const answersEn = getAnswerInputs("en").map(i => i.value.trim());
    const correct = Number(document.getElementById("q-correct").value);

    if (!questionPt || !questionEn) {
        showFeedback("Preencha a pergunta nos dois idiomas antes de adicionar. / Fill in the question in both languages first.", "error");
        return;
    }

    if (answersPt.some(a => !a) || answersEn.some(a => !a)) {
        showFeedback("Preencha as 4 respostas nos dois idiomas antes de adicionar. / Fill in all 4 answers in both languages first.", "error");
        return;
    }

    if (draftQuestions.length >= 50) {
        showFeedback("Limite de 50 perguntas por pacote atingido. / Limit of 50 questions per pack reached.", "error");
        return;
    }

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

    const namePt = document.getElementById("pack-name-pt").value.trim();
    const nameEn = document.getElementById("pack-name-en").value.trim();
    const submitterName = document.getElementById("submitter-name").value.trim();
    const submitterEmail = document.getElementById("submitter-email").value.trim();

    if (!namePt || !nameEn || !submitterName || !submitterEmail) {
        showFeedback("Preencha as informações do pacote antes de enviar. / Fill in the pack info before submitting.", "error");
        return;
    }

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

    const { error } = await ndquestSupabase.from("submitted_packs").insert({
        slug: `${slugify(nameEn)}-${Date.now()}`,
        name_pt: namePt,
        name_en: nameEn,
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        questions,
    });

    submitBtn.disabled = false;

    if (error) {
        showFeedback("Algo deu errado ao enviar. Tente novamente. / Something went wrong sending your pack. Please try again.", "error");
        console.error("NDQuest submit error:", error);
        return;
    }

    showFeedback("Pacote enviado! Nossa equipe vai revisar em breve. / Pack sent! Our team will review it soon.", "success");
    document.getElementById("submit-form").reset();
    draftQuestions.length = 0;
    renderDraftList();

});

renderDraftList();
