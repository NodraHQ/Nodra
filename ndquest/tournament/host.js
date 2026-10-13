// ==================================================================
// TOURNAMENT - host.js
//
// Todo torneio e gravado no banco (tabelas tournament_*, leitura
// publica pra quem tem o link). Qualquer sessao cria e comanda,
// convidado incluso (sessao anonima), igual aos outros jogos. Escrita
// so pelas Edge Functions. VIP ganha retencao maior (180 dias contra
// 30) e historico na conta. Quem assiste ouve postgres_changes; o
// teto de conexoes ao vivo e controlado por Presence, e quem passa do
// teto ve uma foto (snapshot) atualizada por polling. A sala fecha
// sozinha apos 30 min sem atividade do organizador.
// Ver docs/TOURNAMENT_ARCHITECTURE.md.
// ==================================================================

import translations from './i18n/translations.js';
import { getStaticThemes, loadRemoteThemes } from './branding/branding-manifest.js';

{
    const E = window.TournamentBracketEngine;
    const sb = window.ndquestSupabase;

    // Teto de espectadores com conexao ao vivo POR torneio. O gargalo
    // real e o limite de conexoes simultaneas do Supabase, compartilhado
    // com os jogos (ver VIP_TIER_ARCHITECTURE.md).
    const LIVE_VIEWER_CAP = 100;
    const SNAPSHOT_POLL_MS = 45000;
    // Mesma regra de inatividade dos jogos (ROOM_INACTIVITY_TIMEOUT_MINUTES).
    const INACTIVITY_MINUTES = 30;
    const HEARTBEAT_MIN_INTERVAL_MS = 5 * 60 * 1000;
    const FREE_MAX_PARTICIPANTS = 32;

    const $ = (id) => document.getElementById(id);

    // --------------------------------------------------------
    // Idioma (mesmo padrão dos outros jogos)
    // --------------------------------------------------------

    let currentLanguage = localStorage.getItem('tournament:language') || 'pt';

    function t(key, vars) {
        const dict = translations[currentLanguage] || translations.pt;
        let text = dict[key] !== undefined ? dict[key] : key;
        if (vars) {
            Object.keys(vars).forEach((k) => {
                text = text.split('{' + k + '}').join(String(vars[k]));
            });
        }
        return text;
    }

    function hasKey(key) {
        return (translations[currentLanguage] || translations.pt)[key] !== undefined;
    }

    const app = {
        id: null,
        name: "",
        themeName: null,
        state: null,
        meta: null,           // { status, champion_id, losers_champion_id, version, owner_id }
        isOwner: false,
        log: [],
        tab: "main",
        channel: null,
        viewers: 0,
        snapshotOnly: false,
        pollTimer: null,
        userId: null,
        isRealAccount: false,
        lastTouchAt: 0,
        isVip: false,
    };

    // ---------------------------------------------------------------
    // DOM helper (nomes de participantes NUNCA entram como HTML)
    // ---------------------------------------------------------------

    function h(tag, attrs, ...children) {
        const el = document.createElement(tag);
        if (attrs) {
            for (const key of Object.keys(attrs)) {
                const value = attrs[key];
                if (value === null || value === undefined || value === false) continue;
                if (key === "class") el.className = value;
                else if (key === "text") el.textContent = value;
                else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
                else el.setAttribute(key, value === true ? "" : value);
            }
        }
        for (const child of children.flat()) {
            if (child === null || child === undefined || child === false) continue;
            el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
        }
        return el;
    }

    function show(viewId) {
        for (const id of ["screen-loading", "screen-config", "screen-tournament", "screen-error"]) {
            $(id).hidden = id !== viewId;
        }
        $("page-container").classList.toggle("is-wide", viewId === "screen-tournament");
    }

    function showError(titleKey, textKey, retry) {
        $("err-title").textContent = t(titleKey);
        $("err-text").textContent = t(textKey);
        $("err-retry").hidden = !retry;
        $("err-retry").onclick = retry || null;
        show("screen-error");
    }

    function randomId() {
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
    }

    // ---------------------------------------------------------------
    // Leitura de nomes colados (mesma regra do paste do Account)
    // ---------------------------------------------------------------

    function parsePastedNames(text) {
        return text
            .split(/[\n,]/)
            .map((line) => line.replace(/^\s*(\d+[.)]|#\d+|[-*•])\s*/, "").trim())
            .filter(Boolean);
    }

    // ---------------------------------------------------------------
    // Sessao
    // ---------------------------------------------------------------

    async function loadSession() {
        const { data: { session } } = await sb.auth.getSession();
        // Convidado tem sessao anonima e tambem pode ser dono de torneio;
        // mas "conta real" (historico, VIP) so com is_anonymous falso.
        app.userId = session?.user?.id ?? null;
        app.isRealAccount = !!session && !session.user.is_anonymous;
        app.isVip = false;
        if (app.isRealAccount) {
            const { data: profile } = await sb.from("profiles").select("is_vip").eq("id", session.user.id).maybeSingle();
            app.isVip = !!profile?.is_vip;
        }
    }

    // Quem ainda nao tem sessao entra como convidado na hora de criar
    // (mesmo mecanismo dos hosts dos outros jogos).
    async function ensureSession() {
        if (app.userId) return;
        const { data, error } = await sb.auth.signInAnonymously();
        if (error) throw new Error("generic");
        app.userId = data?.user?.id ?? null;
    }

    // ---------------------------------------------------------------
    // CRIACAO
    // ---------------------------------------------------------------

    function currentMode() {
        return document.querySelector('input[name="mode"]:checked').value;
    }

    function maxParticipants(mode) {
        const engineMax = mode === "league" ? E.LIMITS.leagueMax : E.LIMITS.bracketMax;
        return app.isVip ? engineMax : Math.min(engineMax, FREE_MAX_PARTICIPANTS);
    }

    function refreshCreateForm() {
        const mode = currentMode();
        $("opts-bracket").hidden = mode !== "bracket";
        $("opts-league").hidden = mode !== "league";

        const names = E.normalizeNames(parsePastedNames($("f-participants").value));
        $("f-count").textContent = t("create.count", { n: names.length, max: maxParticipants(mode) });

        const losers = $("f-losers");
        const tooFew = names.length < E.LIMITS.losersMin;
        losers.disabled = tooFew;
        if (tooFew && losers.value !== "none") losers.value = "none";
        const helpKey = { none: "create.losersNoneHelp", separate: "create.losersSeparateHelp", final: "create.losersFinalHelp" }[losers.value];
        $("f-losers-help").textContent = tooFew ? t("create.losersNeedThree") : t(helpKey);
        const isFinal = losers.value === "final";
        $("f-rematch-wrap").hidden = !isFinal;
        $("f-rematch-help").hidden = !isFinal;

        $("f-retention-help").textContent = t(app.isVip ? "create.retentionHelpVip" : "create.retentionHelp");
    }

    function creationErrorText(code) {
        const key = "error." + code;
        return hasKey(key) ? t(key) : t("error.generic");
    }

    async function onCreateSubmit(event) {
        event.preventDefault();
        const errorEl = $("create-error");
        errorEl.textContent = "";

        const mode = currentMode();
        const participants = parsePastedNames($("f-participants").value);
        const name = $("f-name").value.trim() || t("create.defaultName");
        const config = mode === "league"
            ? { double_round: $("f-double").checked }
            : { losers_mode: $("f-losers").value, final_rematch: $("f-rematch").checked };
        const shuffle = $("f-shuffle").checked;

        // Mesmas checagens do servidor, so pra responder rapido (o
        // servidor continua sendo quem decide).
        if (E.normalizeNames(participants).length > maxParticipants(mode)) {
            errorEl.textContent = creationErrorText(app.isVip ? "too_many_players" : "free_participants_limit");
            return;
        }

        $("create-submit").disabled = true;
        try {
            await ensureSession();
            const { data, error } = await sb.functions.invoke("tournament-create", {
                body: { name, mode, participants, config, shuffle, theme_name: selectedTheme().name },
            });
            if (error) throw new Error(await functionErrorCode(error));
            window.location.href = "index.html?t=" + encodeURIComponent(data.tournamentId);
        } catch (err) {
            errorEl.textContent = creationErrorText(err.message);
            $("create-submit").disabled = false;
        }
    }

    async function functionErrorCode(error) {
        try {
            const body = await error.context.json();
            if (body && typeof body.error === "string") return body.error;
        } catch (_) { /* corpo nao era JSON */ }
        return "generic";
    }

    // Historico de torneios: so pra conta VIP (mesma regra dos outros
    // jogos: guardar e VIP, ver o historico tambem).
    async function renderMine() {
        const list = $("mine-list");
        list.innerHTML = "";
        if (!app.isVip) {
            $("mine").hidden = true;
            return;
        }
        const { data } = await sb
            .from("tournaments")
            .select("id, name, mode, status, last_activity_at, created_at")
            .eq("owner_id", app.userId)
            .order("created_at", { ascending: false })
            .limit(50);
        for (const row of data || []) {
            list.appendChild(h("li", null,
                h("a", { href: "index.html?t=" + encodeURIComponent(row.id), text: row.name }),
                " ",
                h("span", { class: "tn-muted", text: t("mode." + row.mode) + " · " + t("status." + stateKey(row)) }),
            ));
        }
        $("mine").hidden = !(data && data.length);
    }

    function initCreate() {
        $("create-form").addEventListener("submit", onCreateSubmit);
        for (const el of document.querySelectorAll('input[name="mode"], #f-losers')) {
            el.addEventListener("change", refreshCreateForm);
        }
        $("f-participants").addEventListener("input", refreshCreateForm);
        refreshCreateForm();
        renderMine();
        show("screen-config");
    }

    // active | finished | closed (fechada por inatividade, derivado:
    // o banco so guarda active/finished e a hora da ultima atividade).
    function isClosedRow(row) {
        if (!row || row.status !== "active") return false;
        return Date.now() - new Date(row.last_activity_at).getTime() > INACTIVITY_MINUTES * 60 * 1000;
    }

    function stateKey(row) {
        if (row.status === "finished") return "finished";
        return isClosedRow(row) ? "closed" : "active";
    }

    // ---------------------------------------------------------------
    // Presence: teto de espectadores ao vivo
    // ---------------------------------------------------------------

    function viewerRank(presenceState, myKey) {
        const viewers = [];
        for (const key of Object.keys(presenceState)) {
            const meta = presenceState[key][0];
            if (meta && meta.role === "viewer") viewers.push({ key, ts: meta.ts });
        }
        viewers.sort((a, b) => a.ts - b.ts || (a.key < b.key ? -1 : 1));
        return { rank: viewers.findIndex((v) => v.key === myKey) + 1, total: viewers.length };
    }

    function setViewerCount(n) {
        app.viewers = n;
        const pill = $("t-viewers");
        pill.hidden = n === 0 && !app.isOwner;
        pill.textContent = t("t.viewers", { n });
    }

    // ---------------------------------------------------------------
    // SALVO: abrir
    // ---------------------------------------------------------------

    async function fetchSaved(id) {
        const { data: tournament, error } = await sb.from("tournaments").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!tournament) return null;
        const [p, m, l] = await Promise.all([
            sb.from("tournament_participants").select("id, name, seed").eq("tournament_id", id).order("seed", { ascending: true }),
            sb.from("tournament_matches")
                .select("id, bracket, round_no, pos, a_id, b_id, a_src, b_src, a_score, b_score, winner_id, status, next_match_id, next_slot, finished_seq")
                .eq("tournament_id", id).limit(5000),
            sb.from("tournament_edit_log").select("*").eq("tournament_id", id).order("created_at", { ascending: false }).limit(200),
        ]);
        if (p.error || m.error) throw (p.error || m.error);
        return {
            tournament,
            state: { mode: tournament.mode, config: tournament.config, participants: p.data, matches: m.data },
            log: l.data || [],
        };
    }

    async function refreshSaved() {
        const loaded = await fetchSaved(app.id);
        if (!loaded) {
            showError("error.notFoundTitle", "error.notFoundText");
            return;
        }
        app.name = loaded.tournament.name;
        app.themeName = (loaded.tournament.config && loaded.tournament.config.theme_name) || null;
        applyThemeByName(app.themeName);
        app.state = loaded.state;
        app.log = loaded.log;
        app.meta = loaded.tournament;
        app.isOwner = !!app.userId && loaded.tournament.owner_id === app.userId;
        renderTournament();
        show("screen-tournament");
    }

    let refreshTimer = null;
    function scheduleRefresh() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => { refreshSaved().catch(() => {}); }, 300);
    }

    async function openSaved(id) {
        app.id = id;
        try {
            await refreshSaved();
        } catch (_) {
            showError("error.loadTitle", "error.loadText", () => window.location.reload());
            return;
        }
        if (!app.state) return;

        const myKey = randomId();
        let decided = false;
        const channel = sb.channel("tournament-saved:" + id, { config: { presence: { key: myKey } } });
        app.channel = channel;

        channel
            .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: "tournament_id=eq." + id }, scheduleRefresh)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournaments", filter: "id=eq." + id }, scheduleRefresh)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "tournament_edit_log", filter: "tournament_id=eq." + id }, scheduleRefresh)
            .on("presence", { event: "sync" }, () => {
                const { rank, total } = viewerRank(channel.presenceState(), myKey);
                setViewerCount(total);
                if (!app.isOwner && !decided && rank > 0) {
                    decided = true;
                    if (rank > LIVE_VIEWER_CAP) enterSnapshotMode();
                }
            });

        channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                await channel.track({ role: app.isOwner ? "owner" : "viewer", ts: Date.now() });
            }
        });

        // Espectador que fecha a aba sai do canal na hora (libera a conexao e
        // o contador). O organizador continua conectado.
        if (!app.isOwner) {
            const leave = () => {
                if (!app.channel) return;
                try { app.channel.untrack(); } catch (_) { /* segue */ }
                try { sb.removeChannel(app.channel); } catch (_) { /* segue */ }
                app.channel = null;
            };
            window.addEventListener("pagehide", leave);
            // Voltar pelo botao "voltar" (cache do navegador): recarrega para reconectar.
            window.addEventListener("pageshow", (e) => { if (e.persisted) window.location.reload(); });
        }
    }

    // Acima do teto: sai do canal (libera a conexao) e passa a olhar uma
    // foto do torneio, atualizada por requisicao comum a cada 45s.
    function enterSnapshotMode() {
        if (app.channel) sb.removeChannel(app.channel);
        app.channel = null;
        app.snapshotOnly = true;
        $("t-refresh").hidden = false;
        $("t-notice").textContent = t("t.snapshotNotice");
        $("t-notice").hidden = false;
        clearInterval(app.pollTimer);
        app.pollTimer = setInterval(() => { refreshSaved().catch(() => {}); }, SNAPSHOT_POLL_MS);
    }

    // ---------------------------------------------------------------
    // Acoes do dono
    // ---------------------------------------------------------------

    async function submitResult(kind, matchId, a, b, reason) {
        const fn = kind === "edit" ? "tournament-edit-result" : "tournament-record-result";
        const body = { tournament_id: app.id, match_id: matchId, a_score: a, b_score: b };
        if (kind === "edit") body.reason = reason;
        const { error } = await sb.functions.invoke(fn, { body });
        if (error) {
            const code = await functionErrorCode(error);
            if (code === "version_conflict" || code === "tournament_closed") await refreshSaved();
            throw new Error(code);
        }
        app.lastTouchAt = Date.now();
        await refreshSaved();
    }

    async function deleteTournament() {
        if (!confirm(t("t.deleteConfirm"))) return;
        const { error } = await sb.from("tournaments").delete().eq("id", app.id);
        if (error) {
            alert(t("error.generic"));
            return;
        }
        window.location.href = "index.html";
    }

    // Batimento: qualquer interacao do organizador na pagina mantem a
    // sala aberta (no maximo 1 chamada a cada 5 min). Sem interacao por
    // 30 min a sala fecha sozinha - o servidor decide, isto so avisa.
    async function touchRoom() {
        if (!app.isOwner || !app.meta || app.meta.status !== "active" || isClosedRow(app.meta)) return;
        if (Date.now() - app.lastTouchAt < HEARTBEAT_MIN_INTERVAL_MS) return;
        app.lastTouchAt = Date.now();
        const { error } = await sb.functions.invoke("tournament-touch", { body: { tournament_id: app.id } });
        if (error) {
            if ((await functionErrorCode(error)) === "tournament_closed") await refreshSaved();
            return;
        }
        app.meta.last_activity_at = new Date().toISOString();
    }

    function startHeartbeat() {
        for (const evt of ["pointerdown", "keydown", "scroll", "touchstart"]) {
            window.addEventListener(evt, () => { touchRoom().catch(() => {}); }, { passive: true });
        }
        // Reavalia o estado "fechada" na tela sem precisar de recarregar.
        setInterval(() => {
            if (!$("screen-tournament").hidden) renderTournament();
        }, 60000);
        touchRoom().catch(() => {});
    }

    // ---------------------------------------------------------------
    // Modal de resultado
    // ---------------------------------------------------------------

    let modalCtx = null;

    function openModal(kind, match) {
        const nameA = nameOf(match.a_id);
        const nameB = nameOf(match.b_id);
        modalCtx = { kind, match };
        $("modal-title").textContent = t(kind === "edit" ? "modal.editTitle" : "modal.recordTitle");
        $("modal-a-name").textContent = nameA;
        $("modal-b-name").textContent = nameB;
        $("modal-a").value = kind === "edit" ? match.a_score : "";
        $("modal-b").value = kind === "edit" ? match.b_score : "";
        $("modal-reason").value = "";
        $("modal-reason-wrap").hidden = !(kind === "edit");
        $("modal-error").textContent = "";
        $("modal").hidden = false;
        $("modal-a").focus();
    }

    function closeModal() {
        $("modal").hidden = true;
        modalCtx = null;
    }

    async function onModalSubmit(event) {
        event.preventDefault();
        if (!modalCtx) return;
        // Campo vazio vale 0.
        const a = parseInt($("modal-a").value.trim() === "" ? "0" : $("modal-a").value, 10);
        const b = parseInt($("modal-b").value.trim() === "" ? "0" : $("modal-b").value, 10);
        const errorEl = $("modal-error");
        errorEl.textContent = "";
        $("modal-save").disabled = true;
        try {
            await submitResult(modalCtx.kind, modalCtx.match.id, a, b, $("modal-reason").value.trim());
            closeModal();
        } catch (err) {
            errorEl.textContent = creationErrorText(err.message);
        } finally {
            $("modal-save").disabled = false;
        }
    }

    // ---------------------------------------------------------------
    // Renderizacao
    // ---------------------------------------------------------------

    function nameOf(id) {
        if (!id) return t("match.tbd");
        const p = app.state.participants.find((x) => x.id === id);
        return p ? p.name : t("match.tbd");
    }

    function roundLabel(bracket, round, totalRounds) {
        if (bracket === "main") {
            const fromEnd = totalRounds - round;
            if (fromEnd === 0) return t("round.final");
            if (fromEnd === 1) return t("round.semi");
            if (fromEnd === 2) return t("round.quarter");
        }
        return t("round.n", { n: round });
    }

    function matchCard(match) {
        const ready = match.status === "ready";
        const done = match.status === "done";
        const bye = match.status === "bye";
        const side = (id, score, slot) => {
            const tbd = !id;
            const isWinner = done && match.winner_id && match.winner_id === id;
            const isLoser = done && match.winner_id && match.winner_id !== id;
            const label = bye && tbd ? t("match.bye") : nameOf(id);
            return h("div", { class: "tn-side" + (isWinner ? " is-winner" : "") + (isLoser ? " is-loser" : "") + (tbd ? " is-tbd" : "") },
                h("span", { class: "nm", text: label }),
                h("span", { class: "sc", text: done && score !== null ? String(score) : "" }),
            );
        };
        const card = h("div", { class: "tn-match" + (ready ? " is-ready" : "") + (done ? " is-done" : "") + (bye ? " is-bye" : "") },
            side(match.a_id, match.a_score, "a"),
            side(match.b_id, match.b_score, "b"),
        );
        if (app.isOwner && !app.snapshotOnly && !isClosedRow(app.meta) && (ready || done)) {
            card.appendChild(h("div", { class: "tn-match-foot" },
                h("button", {
                    type: "button",
                    class: "tn-link",
                    text: t(ready ? "match.enter" : "match.edit"),
                    onclick: () => openModal(ready ? "record" : "edit", match),
                }),
            ));
        }
        return card;
    }

    function renderRounds(matches, bracket, totalRounds) {
        const rounds = new Map();
        for (const m of matches) {
            if (!rounds.has(m.round_no)) rounds.set(m.round_no, []);
            rounds.get(m.round_no).push(m);
        }
        const wrap = h("div", { class: "tn-rounds" });
        for (const r of Array.from(rounds.keys()).sort((a, b) => a - b)) {
            const list = rounds.get(r).sort((a, b) => a.pos - b.pos);
            wrap.appendChild(h("div", { class: "tn-round" },
                h("div", { class: "tn-round-title", text: roundLabel(bracket, r, totalRounds) }),
                h("div", { class: "tn-round-matches" }, list.map(matchCard)),
            ));
        }
        return wrap;
    }

    function renderStandings() {
        const rules = app.state.config.points || { win: 3, draw: 1, loss: 0 };
        const rows = E.computeStandings(app.state.participants, app.state.matches, rules);
        const head = ["#", t("table.team"), t("table.p"), t("table.w"), t("table.d"), t("table.l"), t("table.gf"), t("table.ga"), t("table.gd"), t("table.pts")];
        const table = h("table", { class: "tn-table" },
            h("thead", null, h("tr", null, head.map((label, i) => h("th", { class: i === 1 ? "nm" : "", text: label })))),
            h("tbody", null, rows.map((r) => h("tr", { class: r.rank === 1 && r.played > 0 ? "is-first" : "" },
                h("td", { text: String(r.rank) }),
                h("td", { class: "nm", text: r.name }),
                h("td", { text: String(r.played) }),
                h("td", { text: String(r.w) }),
                h("td", { text: String(r.d) }),
                h("td", { text: String(r.l) }),
                h("td", { text: String(r.gf) }),
                h("td", { text: String(r.ga) }),
                h("td", { text: (r.gd > 0 ? "+" : "") + r.gd }),
                h("td", { class: "pts", text: String(r.pts) }),
            ))),
        );
        return h("div", null,
            h("div", { class: "tn-table-wrap" }, table),
            h("p", { class: "tn-muted", text: t("table.rules", { win: rules.win, draw: rules.draw, loss: rules.loss }) }),
        );
    }

    function renderFixtures() {
        const rounds = new Map();
        for (const m of app.state.matches) {
            if (!rounds.has(m.round_no)) rounds.set(m.round_no, []);
            rounds.get(m.round_no).push(m);
        }
        const wrap = h("div");
        for (const r of Array.from(rounds.keys()).sort((a, b) => a - b)) {
            wrap.appendChild(h("div", { class: "tn-fix-round" },
                h("div", { class: "tn-round-title", text: t("round.n", { n: r }) }),
                h("div", { class: "tn-fixtures" }, rounds.get(r).sort((a, b) => a.pos - b.pos).map(matchCard)),
            ));
        }
        return wrap;
    }

    function availableTabs() {
        const tabs = ["main"];
        if (app.state.mode === "league") return ["table", "fixtures"];
        const mode = app.state.config.losers_mode;
        if (mode !== "none") tabs.push("losers");
        if (mode === "final") tabs.push("final");
        return tabs;
    }

    function renderTabs(tabs) {
        const bar = $("t-tabs");
        bar.innerHTML = "";
        if (tabs.length < 2) {
            bar.hidden = true;
            return;
        }
        bar.hidden = false;
        for (const key of tabs) {
            bar.appendChild(h("button", {
                type: "button",
                class: "method-tab" + (app.tab === key ? " is-active" : ""),
                text: t("tab." + key),
                onclick: () => { app.tab = key; renderTournament(); },
            }));
        }
    }

    function renderBody(tabs) {
        const body = $("t-body");
        body.innerHTML = "";
        if (!tabs.includes(app.tab)) app.tab = tabs[0];
        const st = app.state;
        if (st.mode === "league") {
            body.appendChild(app.tab === "table" ? renderStandings() : renderFixtures());
            return;
        }
        const mainMatches = st.matches.filter((m) => m.bracket === "main");
        const totalRounds = mainMatches.reduce((mx, m) => Math.max(mx, m.round_no), 0);
        if (app.tab === "main") {
            body.appendChild(renderRounds(mainMatches, "main", totalRounds));
        } else if (app.tab === "losers") {
            const losers = st.matches.filter((m) => m.bracket === "losers");
            body.appendChild(losers.length
                ? renderRounds(losers, "losers", 0)
                : h("p", { class: "tn-muted", text: t("t.losersEmpty") }));
            body.appendChild(h("p", { class: "tn-muted", text: t("t.losersNote") }));
        } else if (app.tab === "final") {
            const finals = st.matches.filter((m) => m.bracket === "final" || m.bracket === "final_rematch");
            if (!finals.length) {
                body.appendChild(h("p", { class: "tn-muted", text: t("t.finalEmpty") }));
            } else {
                const wrap = h("div", { class: "tn-rounds" });
                for (const m of finals.sort((a, b) => (a.bracket < b.bracket ? -1 : 1))) {
                    wrap.appendChild(h("div", { class: "tn-round" },
                        h("div", { class: "tn-round-title", text: t(m.bracket === "final" ? "round.grandFinal" : "round.rematch") }),
                        matchCard(m),
                    ));
                }
                body.appendChild(wrap);
            }
        }
    }

    function renderChampion() {
        const box = $("t-champion");
        const meta = app.meta || {};
        if (meta.status !== "finished" || !meta.champion_id) {
            box.hidden = true;
            return;
        }
        box.innerHTML = "";
        box.appendChild(h("div", { text: t("t.champion", { name: nameOf(meta.champion_id) }) }));
        if (meta.losers_champion_id) {
            box.appendChild(h("div", { text: t("t.losersChampion", { name: nameOf(meta.losers_champion_id) }) }));
        }
        box.hidden = false;
    }

    function renderLog() {
        const section = $("t-log");
        section.hidden = false;
        const list = $("t-log-list");
        list.innerHTML = "";
        if (!app.log.length) {
            list.appendChild(h("li", { text: t("log.empty") }));
            return;
        }
        const matchById = new Map(app.state.matches.map((m) => [m.id, m]));
        for (const entry of app.log) {
            const m = matchById.get(entry.match_id);
            const who = m ? nameOf(m.a_id) + " x " + nameOf(m.b_id) : "?";
            const line = who + ": " + entry.old_a_score + "-" + entry.old_b_score + " → " + entry.new_a_score + "-" + entry.new_b_score;
            list.appendChild(h("li", null,
                h("div", { text: line }),
                h("div", { class: "tn-muted", text: new Date(entry.created_at).toLocaleString() + (entry.reason ? " · " + entry.reason : "") }),
            ));
        }
    }

    function renderTournament() {
        if (!app.state) return;
        $("t-name").textContent = app.name;
        const meta = app.meta || {};
        $("t-meta").textContent = [
            t("mode." + app.state.mode),
            t("status." + stateKey(meta)),
        ].join(" · ");

        // Aviso discreto, por ordem de importancia.
        let notice = "";
        if (app.snapshotOnly) notice = t("t.snapshotNotice");
        else if (isClosedRow(meta)) notice = t("t.closedNotice");
        else if (app.isOwner && meta.status === "active") notice = t("t.inactivityNotice");
        $("t-notice").textContent = notice;
        $("t-notice").hidden = !notice;
        $("t-delete").hidden = !app.isOwner;
        $("t-refresh").hidden = !app.snapshotOnly;
        setViewerCount(app.viewers);

        renderChampion();
        const tabs = availableTabs();
        renderTabs(tabs);
        renderBody(tabs);
        renderLog();
    }

    // ---------------------------------------------------------------
    // Imagem do resultado (print gerado em canvas, sem biblioteca)
    // ---------------------------------------------------------------

    function ellipsize(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let out = text;
        while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
        return out + "…";
    }

    function roundRect(ctx, x, y, w, hgt, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + hgt, r);
        ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
        ctx.arcTo(x, y + hgt, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // Monta a lista de blocos desenhaveis a partir do estado atual.
    function buildImageSections() {
        const st = app.state;
        const sections = [];
        if (st.mode === "league") {
            const rules = st.config.points || { win: 3, draw: 1, loss: 0 };
            sections.push({ kind: "table", title: t("tab.table"), rows: E.computeStandings(st.participants, st.matches, rules) });
            return sections;
        }
        const byRound = (list) => {
            const map = new Map();
            for (const m of list) {
                if (!map.has(m.round_no)) map.set(m.round_no, []);
                map.get(m.round_no).push(m);
            }
            return Array.from(map.keys()).sort((a, b) => a - b).map((r) => ({ round: r, matches: map.get(r).sort((a, b) => a.pos - b.pos) }));
        };
        const main = st.matches.filter((m) => m.bracket === "main");
        const totalRounds = main.reduce((mx, m) => Math.max(mx, m.round_no), 0);
        sections.push({
            kind: "tree",
            title: t("tab.main"),
            columns: byRound(main).map((c) => ({ label: roundLabel("main", c.round, totalRounds), matches: c.matches })),
            connect: true,
        });
        const losers = st.matches.filter((m) => m.bracket === "losers");
        if (losers.length) {
            sections.push({
                kind: "tree",
                title: t("tab.losers"),
                columns: byRound(losers).map((c) => ({ label: t("round.n", { n: c.round }), matches: c.matches })),
                connect: false,
            });
        }
        const finals = st.matches.filter((m) => m.bracket === "final" || m.bracket === "final_rematch");
        if (finals.length) {
            finals.sort((a, b) => (a.bracket < b.bracket ? -1 : 1));
            sections.push({
                kind: "tree",
                title: t("tab.final"),
                columns: finals.map((m) => ({ label: t(m.bracket === "final" ? "round.grandFinal" : "round.rematch"), matches: [m] })),
                connect: false,
            });
        }
        return sections;
    }

    async function exportResultImage() {
        const css = getComputedStyle(document.documentElement);
        const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
        const C = {
            bg: v("--color-bg", "#071b30"),
            surface: v("--color-surface", "#123a5e"),
            border: v("--color-surface-border", "rgba(254,162,3,0.18)"),
            gold: v("--color-gold", "#fea203"),
            goldLight: v("--color-gold-light", "#ffc24d"),
            text: v("--color-text", "#eaf2fa"),
            muted: v("--color-text-muted", "#9fb4c9"),
            success: v("--color-success", "#5fa77c"),
        };
        const F = {
            display: v("--font-display", "'Fraunces', serif"),
            body: v("--font-body", "'Work Sans', sans-serif"),
        };
        try {
            // Nao espera mais de 1,5 s pelas fontes (na 1a vez podem demorar).
            await Promise.race([
                Promise.all([
                    document.fonts.load("600 24px " + F.display),
                    document.fonts.load("600 16px " + F.body),
                ]),
                new Promise((resolve) => setTimeout(resolve, 1500)),
            ]);
        } catch (_) { /* segue com a fonte de fallback */ }

        const PAD = 48;
        const BOX_W = 250, BOX_H = 64, SLOT = 84, COL_GAP = 44, SEC_TITLE_H = 46, SEC_GAP = 36;
        const sections = buildImageSections();
        const meta = app.meta || {};

        // ---- medidas
        const headerLines = [];
        headerLines.push({ text: app.name, font: "600 38px " + F.display, color: C.text, h: 52 });
        headerLines.push({ text: t("mode." + app.state.mode) + " · " + t("status." + stateKey(meta)), font: "600 15px " + F.body, color: C.gold, h: 30 });
        if (meta.status === "finished" && meta.champion_id) {
            headerLines.push({ text: "★ " + t("t.champion", { name: nameOf(meta.champion_id) }), font: "600 26px " + F.display, color: C.goldLight, h: 44 });
            if (meta.losers_champion_id) {
                headerLines.push({ text: t("t.losersChampion", { name: nameOf(meta.losers_champion_id) }), font: "600 20px " + F.display, color: C.text, h: 36 });
            }
        }
        const headerH = headerLines.reduce((s, l) => s + l.h, 0) + 16;

        let contentW = 760;
        let bodyH = 0;
        for (const sec of sections) {
            if (sec.kind === "table") {
                sec.height = SEC_TITLE_H + 44 + sec.rows.length * 42;
                sec.width = 760;
            } else {
                const maxMatches = Math.max(...sec.columns.map((c) => c.matches.length));
                const slot = sec.connect ? SLOT : BOX_H + 18;
                sec.slot = slot;
                sec.height = SEC_TITLE_H + 26 + maxMatches * slot;
                sec.width = sec.columns.length * BOX_W + (sec.columns.length - 1) * COL_GAP;
            }
            contentW = Math.max(contentW, sec.width);
            bodyH += sec.height + SEC_GAP;
        }
        const footerH = 56;
        const W = contentW + PAD * 2;
        const H = PAD + headerH + bodyH + footerH;

        const scale = Math.max(1, Math.min(2, Math.sqrt(16000000 / (W * H))));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(W * scale);
        canvas.height = Math.round(H * scale);
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);

        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, W, H);

        // ---- cabecalho
        let y = PAD;
        ctx.textBaseline = "alphabetic";
        for (const line of headerLines) {
            ctx.font = line.font;
            ctx.fillStyle = line.color;
            ctx.fillText(ellipsize(ctx, line.text, W - PAD * 2), PAD, y + line.h - 14);
            y += line.h;
        }
        y += 16;

        const drawBox = (m, x, top) => {
            const done = m.status === "done";
            roundRect(ctx, x, top, BOX_W, BOX_H, 12);
            ctx.fillStyle = C.surface;
            ctx.fill();
            ctx.strokeStyle = m.status === "ready" ? C.gold : C.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, top + BOX_H / 2);
            ctx.lineTo(x + BOX_W, top + BOX_H / 2);
            ctx.strokeStyle = C.border;
            ctx.lineWidth = 1;
            ctx.stroke();
            const sides = [[m.a_id, m.a_score], [m.b_id, m.b_score]];
            sides.forEach(([id, score], i) => {
                const won = done && m.winner_id && m.winner_id === id;
                const lost = done && m.winner_id && m.winner_id !== id;
                const label = !id ? (m.status === "bye" ? t("match.bye") : t("match.tbd")) : nameOf(id);
                ctx.font = (won ? "700 " : "500 ") + "15px " + F.body;
                ctx.fillStyle = won ? C.goldLight : (lost || !id) ? C.muted : C.text;
                ctx.fillText(ellipsize(ctx, label, BOX_W - 64), x + 14, top + i * (BOX_H / 2) + 22);
                if (done && score !== null) {
                    ctx.textAlign = "right";
                    ctx.fillText(String(score), x + BOX_W - 14, top + i * (BOX_H / 2) + 22);
                    ctx.textAlign = "left";
                }
            });
        };

        for (const sec of sections) {
            ctx.font = "600 22px " + F.display;
            ctx.fillStyle = C.gold;
            ctx.fillText(sec.title, PAD, y + 26);
            const top0 = y + SEC_TITLE_H;

            if (sec.kind === "table") {
                const cols = [
                    { key: "rank", label: "#", w: 44, align: "center" },
                    { key: "name", label: t("table.team"), w: 260, align: "left" },
                    { key: "played", label: t("table.p"), w: 56, align: "center" },
                    { key: "w", label: t("table.w"), w: 56, align: "center" },
                    { key: "d", label: t("table.d"), w: 56, align: "center" },
                    { key: "l", label: t("table.l"), w: 56, align: "center" },
                    { key: "gd", label: t("table.gd"), w: 68, align: "center" },
                    { key: "pts", label: t("table.pts"), w: 64, align: "center" },
                ];
                let x = PAD;
                ctx.font = "700 13px " + F.body;
                ctx.fillStyle = C.muted;
                cols.forEach((c) => {
                    ctx.textAlign = c.align;
                    ctx.fillText(c.label.toUpperCase(), c.align === "left" ? x : x + c.w / 2, top0 + 16);
                    x += c.w;
                });
                sec.rows.forEach((r, i) => {
                    const ry = top0 + 44 + i * 42;
                    ctx.beginPath();
                    ctx.moveTo(PAD, ry - 8);
                    ctx.lineTo(PAD + cols.reduce((s, c) => s + c.w, 0), ry - 8);
                    ctx.strokeStyle = C.border;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    let cx = PAD;
                    cols.forEach((c) => {
                        let val = r[c.key];
                        if (c.key === "gd") val = (r.gd > 0 ? "+" : "") + r.gd;
                        ctx.font = (c.key === "pts" ? "700 " : "500 ") + "16px " + F.body;
                        ctx.fillStyle = c.key === "pts" ? C.goldLight : (r.rank === 1 && r.played > 0 ? C.success : C.text);
                        ctx.textAlign = c.align;
                        const txt = c.key === "name" ? ellipsize(ctx, String(val), c.w - 12) : String(val);
                        ctx.fillText(txt, c.align === "left" ? cx : cx + c.w / 2, ry + 14);
                        cx += c.w;
                    });
                });
                ctx.textAlign = "left";
            } else {
                // Passada 1: posicao vertical de todas as partidas (a de uma
                // rodada e a media das duas que a alimentam).
                const centers = new Map();
                sec.columns.forEach((col, ci) => {
                    col.matches.forEach((m, mi) => {
                        let cy = top0 + 26 + mi * sec.slot + sec.slot / 2;
                        if (sec.connect && ci > 0) {
                            const fc = sec.columns[ci - 1].matches
                                .filter((f) => f.next_match_id === m.id)
                                .map((f) => centers.get(f.id))
                                .filter((n) => n !== undefined);
                            if (fc.length) cy = fc.reduce((s, n) => s + n, 0) / fc.length;
                        }
                        centers.set(m.id, cy);
                    });
                });
                // Passada 2: desenha conectores e caixas.
                sec.columns.forEach((col, ci) => {
                    const x = PAD + ci * (BOX_W + COL_GAP);
                    ctx.font = "700 12px " + F.body;
                    ctx.fillStyle = C.gold;
                    ctx.fillText(col.label.toUpperCase(), x, top0 + 12);
                    col.matches.forEach((m) => {
                        const cy = centers.get(m.id);
                        if (sec.connect && m.next_match_id && ci < sec.columns.length - 1) {
                            const tcy = centers.get(m.next_match_id);
                            if (tcy !== undefined) {
                                ctx.beginPath();
                                ctx.moveTo(x + BOX_W, cy);
                                ctx.lineTo(x + BOX_W + COL_GAP / 2, cy);
                                ctx.lineTo(x + BOX_W + COL_GAP / 2, tcy);
                                ctx.lineTo(x + BOX_W + COL_GAP, tcy);
                                ctx.strokeStyle = C.border;
                                ctx.lineWidth = 1.5;
                                ctx.stroke();
                            }
                        }
                        drawBox(m, x, cy - BOX_H / 2);
                    });
                });
            }
            y += sec.height + SEC_GAP;
        }

        // ---- rodape
        ctx.font = "600 14px " + F.body;
        ctx.fillStyle = C.muted;
        ctx.textAlign = "left";
        ctx.fillText(t("image.footer"), PAD, H - 26);
        ctx.textAlign = "right";
        ctx.fillText(new Date().toLocaleDateString(), W - PAD, H - 26);
        ctx.textAlign = "left";

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("toBlob failed");
        const slug = (app.name || "tournament").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tournament";
        const file = new File([blob], slug + ".png", { type: "image/png" });

        // Celular: abre o menu de compartilhar (salvar nas fotos, WhatsApp...).
        // Desktop ou sem suporte: baixa o PNG.
        const touchDevice = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        if (touchDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: app.name });
                return;
            } catch (err) {
                if (err && err.name === "AbortError") return;
            }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = slug + ".png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    // ---------------------------------------------------------------
    // Boot
    // ---------------------------------------------------------------

    async function copyLink() {
        const url = new URL(window.location.href);
        try {
            await navigator.clipboard.writeText(url.toString());
            $("t-copy").textContent = t("t.copied");
            setTimeout(() => { $("t-copy").textContent = t("t.copyLink"); }, 1800);
        } catch (_) {
            window.prompt(t("t.copyLink"), url.toString());
        }
    }

    // ---------------------------------------------------------------
    // Idioma e tema (mesmo mecanismo do Roulette)
    // ---------------------------------------------------------------

    function applyTranslations() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (hasKey(key)) el.textContent = t(key);
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (hasKey(key)) el.placeholder = t(key);
        });
        document.documentElement.lang = currentLanguage;
    }

    function setActiveLanguageButton() {
        document.getElementById("lang-pt").classList.toggle("is-active", currentLanguage === "pt");
        document.getElementById("lang-en").classList.toggle("is-active", currentLanguage === "en");
    }

    function changeLanguage(lang) {
        currentLanguage = lang;
        localStorage.setItem("tournament:language", lang);
        applyTranslations();
        setActiveLanguageButton();
        if (!$("screen-config").hidden) refreshCreateForm();
        if (!$("screen-tournament").hidden) renderTournament();
    }

    // Começa só com o tema padrão, depois é substituído pela lista
    // completa (padrão + Supabase) quando a busca terminar.
    let themes = getStaticThemes();
    const themeSelect = $("theme-select");
    const logoImg = $("logo-img");

    function selectedTheme() {
        return themes[Number(themeSelect.value)] || themes[0];
    }

    function populateThemeSelect() {
        const previous = themes[Number(themeSelect.value)]?.name;
        themeSelect.innerHTML = "";
        themes.forEach((theme, index) => {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = theme.name;
            themeSelect.appendChild(option);
        });
        if (previous) {
            const idx = themes.findIndex((th) => th.name === previous);
            if (idx >= 0) themeSelect.value = String(idx);
        }
    }

    function applyThemeByName(name) {
        applyTheme(themes.find((th) => th.name === name) || themes[0]);
    }

    function hexToRgbChannels(hex) {
        const clean = hex.replace("#", "");
        const value = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
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
  src: url('${file.path}') format('woff2');
  font-weight: ${file.weight || "400"};
  font-style: ${file.style || "normal"};
  font-display: swap;
}`)
                .join("\n");
            themeFontStyleEl = document.createElement("style");
            themeFontStyleEl.setAttribute("data-theme-fonts", "");
            themeFontStyleEl.textContent = rules;
            document.head.appendChild(themeFontStyleEl);
        }
        const root = document.documentElement;
        root.style.setProperty("--font-display", theme.fonts.display);
        root.style.setProperty("--font-body", theme.fonts.body);
    }

    const THEME_CSS_PROPERTIES = [
        "--color-gold", "--color-gold-light", "--color-gold-rgb",
        "--color-bg", "--color-bg-alt", "--color-bg-rgb",
        "--color-surface", "--color-surface-border",
        "--color-text", "--color-text-muted",
        "--color-success", "--color-error",
        "--color-paper", "--color-paper-dark", "--color-paper-shadow",
        "--font-display", "--font-body",
    ];

    function applyTheme(theme) {
        const root = document.documentElement;
        THEME_CSS_PROPERTIES.forEach((prop) => root.style.removeProperty(prop));

        root.style.setProperty("--color-gold", theme.colors.primary);
        root.style.setProperty("--color-gold-light", theme.colors.primaryLight);
        root.style.setProperty("--color-gold-rgb", hexToRgbChannels(theme.colors.primary));
        root.style.setProperty("--color-bg", theme.colors.background);
        root.style.setProperty("--color-bg-alt", theme.colors.backgroundAlt);
        root.style.setProperty("--color-bg-rgb", hexToRgbChannels(theme.colors.background));
        root.style.setProperty("--color-surface", theme.colors.surface);
        root.style.setProperty("--color-surface-border", theme.colors.surfaceBorder);
        root.style.setProperty("--color-text", theme.colors.text);
        root.style.setProperty("--color-text-muted", theme.colors.textMuted);
        root.style.setProperty("--color-success", theme.colors.success);
        root.style.setProperty("--color-error", theme.colors.error);
        root.style.setProperty("--color-paper", theme.colors.paper);
        root.style.setProperty("--color-paper-dark", theme.colors.paperDark);
        root.style.setProperty("--color-paper-shadow", theme.colors.paperShadow);

        applyThemeFonts(theme);

        // Com logo: mostra a imagem. Sem logo: mostra o nome do tema em
        // texto (em vez de ficar a logo do NDQuest de outra marca).
        const logoText = $("logo-text");
        if (logoImg) {
            if (theme.logo) {
                logoImg.src = theme.logo;
                logoImg.alt = theme.name;
                logoImg.hidden = false;
                if (logoText) logoText.hidden = true;
            } else {
                logoImg.hidden = true;
                if (logoText) {
                    logoText.textContent = theme.name;
                    logoText.hidden = false;
                }
            }
        }
    }

    async function boot() {
        applyTranslations();
        setActiveLanguageButton();
        document.getElementById("lang-pt").addEventListener("click", () => changeLanguage("pt"));
        document.getElementById("lang-en").addEventListener("click", () => changeLanguage("en"));
        populateThemeSelect();
        themeSelect.addEventListener("change", () => applyTheme(selectedTheme()));
        loadRemoteThemes(sb).then((all) => {
            themes = all;
            populateThemeSelect();
            if (app.themeName) applyThemeByName(app.themeName);
            else if (!$("screen-config").hidden) applyTheme(selectedTheme());
        });

        $("modal-form").addEventListener("submit", onModalSubmit);
        $("modal-cancel").addEventListener("click", closeModal);
        $("t-copy").addEventListener("click", copyLink);
        $("t-image").addEventListener("click", async () => {
            const btn = $("t-image");
            if (btn.disabled) return;
            const label = btn.textContent;
            btn.disabled = true;
            btn.textContent = t("t.savingImage");
            try {
                await exportResultImage();
            } catch (err) {
                console.error("Falha ao gerar imagem:", err);
            } finally {
                btn.disabled = false;
                btn.textContent = label;
            }
        });
        $("t-delete").addEventListener("click", deleteTournament);
        $("t-refresh").addEventListener("click", () => { refreshSaved().catch(() => {}); });

        await loadSession();

        const params = new URLSearchParams(window.location.search);
        const savedId = params.get("t");
        if (savedId) {
            await openSaved(savedId);
            if (app.state && app.isOwner) startHeartbeat();
        } else {
            initCreate();
        }
    }

    boot().catch((err) => {
        console.error("Tournament boot failed:", err);
        showError("error.loadTitle", "error.loadText", () => window.location.reload());
    });

}
