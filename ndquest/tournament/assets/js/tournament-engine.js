// ==================================================================
// _shared/tournamentEngine.js
//
// Motor puro do sistema de torneios (chaves e liga). Sem DOM, sem
// rede, sem banco: recebe um estado, devolve um estado novo. A MESMA
// copia deste arquivo roda no servidor (Edge Functions de torneio
// salvo) e no navegador (ndquest/tournament/assets/js/tournament-engine.js),
// por isso ele se publica em globalThis e nao usa import/export.
// Se mudar aqui, copie o arquivo identico pro outro lugar.
//
// Estado: { mode, config, participants:[{id,name,seed}], matches:[...] }
// Campos de match (iguais as colunas de tournament_matches):
//   id, bracket ('main'|'losers'|'final'|'final_rematch'|'league'),
//   round_no, pos, a_id, b_id, a_src, b_src, a_score, b_score,
//   winner_id, status ('pending'|'ready'|'done'|'bye'),
//   next_match_id, next_slot ('a'|'b'), finished_seq
// ==================================================================

(function (root) {
    "use strict";

    const LIMITS = {
        bracketMin: 2,
        bracketMax: 128,
        leagueMin: 2,
        leagueMax: 32,
        nameMax: 40,
        scoreMax: 9999,
        losersMin: 3,
    };

    function uuid() {
        const c = root.crypto;
        if (c && typeof c.randomUUID === "function") return c.randomUUID();
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
            const r = (Math.random() * 16) | 0;
            return (ch === "x" ? r : (r & 3) | 8).toString(16);
        });
    }

    function shuffle(list, rng) {
        const random = rng || Math.random;
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const tmp = out[i];
            out[i] = out[j];
            out[j] = tmp;
        }
        return out;
    }

    function nextPowerOf2(n) {
        let p = 1;
        while (p < n) p *= 2;
        return p;
    }

    // Ordem classica de cabecas de chave: 1 enfrenta P, 2 enfrenta P-1...
    // Como as pessoas ja entram embaralhadas, os "byes" (vagas vazias)
    // caem nos primeiros sorteados e ficam espalhados pela chave.
    function seedOrder(size) {
        let order = [1, 2];
        while (order.length < size) {
            const n = order.length * 2;
            const next = [];
            for (const s of order) {
                next.push(s, n + 1 - s);
            }
            order = next;
        }
        return order;
    }

    function clone(x) {
        return JSON.parse(JSON.stringify(x));
    }

    function newMatch(fields) {
        return Object.assign(
            {
                id: uuid(),
                bracket: "main",
                round_no: 1,
                pos: 1,
                a_id: null,
                b_id: null,
                a_src: null,
                b_src: null,
                a_score: null,
                b_score: null,
                winner_id: null,
                status: "pending",
                next_match_id: null,
                next_slot: null,
                finished_seq: null,
            },
            fields,
        );
    }

    function normalizeNames(list) {
        const seen = new Map();
        const out = [];
        for (const raw of list) {
            let name = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
            if (!name) continue;
            name = name.slice(0, LIMITS.nameMax);
            const key = name.toLowerCase();
            const count = (seen.get(key) || 0) + 1;
            seen.set(key, count);
            out.push(count === 1 ? name : name + " (" + count + ")");
        }
        return out;
    }

    function normalizeConfig(mode, count, cfg) {
        const c = cfg || {};
        if (mode === "league") {
            const p = c.points || {};
            const num = (v, d) => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : d);
            return {
                double_round: !!c.double_round,
                points: { win: num(p.win, 3), draw: num(p.draw, 1), loss: num(p.loss, 0) },
            };
        }
        let losers = ["none", "separate", "final"].includes(c.losers_mode) ? c.losers_mode : "none";
        if (count < LIMITS.losersMin) losers = "none";
        return {
            losers_mode: losers,
            final_rematch: losers === "final" ? c.final_rematch !== false : false,
        };
    }

    // ---------------------------------------------------------------
    // CHAVE PRINCIPAL
    // ---------------------------------------------------------------

    function buildMainBracket(ids, opts) {
        const o = opts || {};
        const players = o.shuffle === false ? ids.slice() : shuffle(ids, o.rng);
        const n = players.length;
        if (n < 2) throw new Error("need_two_players");
        const size = nextPowerOf2(n);
        const rounds = Math.log2(size);

        const byRound = [];
        for (let r = 1; r <= rounds; r++) {
            const count = size / Math.pow(2, r);
            const list = [];
            for (let p = 1; p <= count; p++) list.push(newMatch({ bracket: "main", round_no: r, pos: p }));
            byRound.push(list);
        }
        for (let r = 0; r < rounds - 1; r++) {
            byRound[r].forEach((m, i) => {
                const nxt = byRound[r + 1][Math.floor(i / 2)];
                m.next_match_id = nxt.id;
                m.next_slot = i % 2 === 0 ? "a" : "b";
            });
        }

        const order = seedOrder(size);
        const seatOf = (seed) => (seed <= n ? players[seed - 1] : null);
        byRound[0].forEach((m, i) => {
            const a = seatOf(order[i * 2]);
            const b = seatOf(order[i * 2 + 1]);
            m.a_id = a;
            m.b_id = b;
            if (a && b) {
                m.status = "ready";
            } else {
                m.status = "bye";
                m.winner_id = a || b;
                const nxt = m.next_match_id ? byRound.flat().find((x) => x.id === m.next_match_id) : null;
                if (nxt) {
                    if (m.next_slot === "a") nxt.a_id = m.winner_id;
                    else nxt.b_id = m.winner_id;
                }
            }
        });
        for (const m of byRound.flat()) {
            if (m.status === "pending" && m.a_id && m.b_id) m.status = "ready";
        }
        return byRound.flat();
    }

    // ---------------------------------------------------------------
    // LIGA (todos contra todos, metodo do circulo)
    // ---------------------------------------------------------------

    function buildLeagueSchedule(ids, opts) {
        const o = opts || {};
        const teams = o.shuffle === false ? ids.slice() : shuffle(ids, o.rng);
        if (teams.length < 2) throw new Error("need_two_players");
        if (teams.length % 2 === 1) teams.push(null);
        const n = teams.length;
        const rounds = n - 1;
        const matches = [];
        let arr = teams.slice();
        const firstLeg = [];
        for (let r = 1; r <= rounds; r++) {
            const pairs = [];
            for (let i = 0; i < n / 2; i++) {
                let a = arr[i];
                let b = arr[n - 1 - i];
                if (a == null || b == null) continue;
                if (i === 0 && r % 2 === 0) {
                    const t = a;
                    a = b;
                    b = t;
                }
                pairs.push([a, b]);
            }
            pairs.forEach((p, idx) => {
                firstLeg.push(
                    newMatch({
                        bracket: "league",
                        round_no: r,
                        pos: idx + 1,
                        a_id: p[0],
                        b_id: p[1],
                        status: "ready",
                    }),
                );
            });
            arr = [arr[0], arr[n - 1]].concat(arr.slice(1, n - 1));
        }
        matches.push(...firstLeg);
        if (o.double_round) {
            for (const m of firstLeg) {
                matches.push(
                    newMatch({
                        bracket: "league",
                        round_no: m.round_no + rounds,
                        pos: m.pos,
                        a_id: m.b_id,
                        b_id: m.a_id,
                        status: "ready",
                    }),
                );
            }
        }
        return matches;
    }

    function createTournamentState(mode, names, cfg, opts) {
        const clean = normalizeNames(names);
        const lim = mode === "league" ? [LIMITS.leagueMin, LIMITS.leagueMax] : [LIMITS.bracketMin, LIMITS.bracketMax];
        if (clean.length < lim[0]) throw new Error("too_few_players");
        if (clean.length > lim[1]) throw new Error("too_many_players");
        const config = normalizeConfig(mode, clean.length, cfg);
        const participants = clean.map((name, i) => ({ id: uuid(), name, seed: i + 1 }));
        const ids = participants.map((p) => p.id);
        const matches =
            mode === "league"
                ? buildLeagueSchedule(ids, { double_round: config.double_round, rng: opts && opts.rng, shuffle: !opts || opts.shuffle !== false })
                : buildMainBracket(ids, { rng: opts && opts.rng, shuffle: !opts || opts.shuffle !== false });
        const state = { mode, config, participants, matches };
        syncDerived(state);
        return state;
    }

    // ---------------------------------------------------------------
    // Helpers de leitura
    // ---------------------------------------------------------------

    function findMatch(state, id) {
        return state.matches.find((m) => m.id === id) || null;
    }

    function mainFinalOf(state) {
        let best = null;
        for (const m of state.matches) {
            if (m.bracket === "main" && (!best || m.round_no > best.round_no)) best = m;
        }
        return best;
    }

    function loserOf(m) {
        if (!m.winner_id) return null;
        return m.winner_id === m.a_id ? m.b_id : m.a_id;
    }

    function nextSeq(state) {
        let max = 0;
        for (const m of state.matches) if (m.finished_seq && m.finished_seq > max) max = m.finished_seq;
        return max + 1;
    }

    function parseScores(a, b, allowTie) {
        const ok = (v) => Number.isInteger(v) && v >= 0 && v <= LIMITS.scoreMax;
        if (!ok(a) || !ok(b)) throw new Error("invalid_score");
        if (!allowTie && a === b) throw new Error("tie_not_allowed");
    }

    function winnerFor(m, a, b) {
        if (a > b) return m.a_id;
        if (b > a) return m.b_id;
        return null;
    }

    // ---------------------------------------------------------------
    // Rota dos perdedores e final (derivados, idempotente)
    // ---------------------------------------------------------------

    function losersEvents(state) {
        // Cada partida da chave principal terminada gera um "perdedor
        // chegando"; cada partida da rota dos perdedores terminada gera
        // um "vencedor chegando". Pareia por ordem de chegada.
        const assigned = new Set();
        for (const m of state.matches) {
            if (m.bracket === "losers") {
                if (m.a_src) assigned.add(m.a_src);
                if (m.b_src) assigned.add(m.b_src);
            }
        }
        const waiting = [];
        for (const m of state.matches) {
            if (m.status !== "done" || assigned.has(m.id)) continue;
            if (m.bracket === "main") waiting.push({ pid: loserOf(m), src: m.id, seq: m.finished_seq, round: 0 });
            else if (m.bracket === "losers") waiting.push({ pid: m.winner_id, src: m.id, seq: m.finished_seq, round: m.round_no });
        }
        waiting.sort((x, y) => x.seq - y.seq);
        return waiting;
    }

    function syncLosers(state) {
        for (;;) {
            const waiting = losersEvents(state);
            if (waiting.length < 2) return waiting;
            const a = waiting[0];
            const b = waiting[1];
            const round = 1 + Math.max(a.round, b.round);
            const pos = state.matches.filter((m) => m.bracket === "losers" && m.round_no === round).length + 1;
            state.matches.push(
                newMatch({
                    bracket: "losers",
                    round_no: round,
                    pos,
                    a_id: a.pid,
                    b_id: b.pid,
                    a_src: a.src,
                    b_src: b.src,
                    status: "ready",
                }),
            );
        }
    }

    function syncDerived(state) {
        if (state.mode !== "bracket") return;
        const mode = state.config.losers_mode;
        if (mode === "none") return;
        const mainFinal = mainFinalOf(state);
        const waiting = syncLosers(state);
        const mainDone = mainFinal && mainFinal.status === "done";
        const losersPending = state.matches.some((m) => m.bracket === "losers" && m.status !== "done");
        const losersComplete = mainDone && !losersPending && waiting.length === 1;

        if (mode === "final") {
            let final = state.matches.find((m) => m.bracket === "final");
            if (!final && losersComplete) {
                final = newMatch({
                    bracket: "final",
                    round_no: 1,
                    pos: 1,
                    a_id: mainFinal.winner_id,
                    b_id: waiting[0].pid,
                    a_src: mainFinal.id,
                    b_src: waiting[0].src,
                    status: "ready",
                });
                state.matches.push(final);
            }
            const rematch = state.matches.find((m) => m.bracket === "final_rematch");
            if (final && final.status === "done") {
                const loserChampWon = final.winner_id === final.b_id;
                if (loserChampWon && state.config.final_rematch && !rematch) {
                    state.matches.push(
                        newMatch({
                            bracket: "final_rematch",
                            round_no: 1,
                            pos: 1,
                            a_id: final.a_id,
                            b_id: final.b_id,
                            a_src: final.id,
                            status: "ready",
                        }),
                    );
                } else if ((!loserChampWon || !state.config.final_rematch) && rematch && rematch.status !== "done") {
                    state.matches = state.matches.filter((m) => m.id !== rematch.id);
                }
            }
        }
    }

    // ---------------------------------------------------------------
    // Resumo (status e campeoes), sempre calculado do estado
    // ---------------------------------------------------------------

    function summarize(state) {
        const out = { status: "active", champion_id: null, losers_champion_id: null };
        if (state.mode === "league") {
            const pending = state.matches.some((m) => m.status !== "done");
            if (!pending && state.matches.length) {
                const table = computeStandings(state.participants, state.matches, state.config.points);
                out.status = "finished";
                out.champion_id = table[0] ? table[0].id : null;
            }
            return out;
        }
        const mainFinal = mainFinalOf(state);
        if (!mainFinal || mainFinal.status !== "done") return out;
        const mode = state.config.losers_mode;
        if (mode === "none") {
            out.status = "finished";
            out.champion_id = mainFinal.winner_id;
            return out;
        }
        const waiting = losersEvents(state);
        const losersPending = state.matches.some((m) => m.bracket === "losers" && m.status !== "done");
        const losersComplete = !losersPending && waiting.length === 1;
        if (mode === "separate") {
            if (losersComplete) {
                out.status = "finished";
                out.champion_id = mainFinal.winner_id;
                out.losers_champion_id = waiting[0].pid;
            }
            return out;
        }
        const final = state.matches.find((m) => m.bracket === "final");
        const rematch = state.matches.find((m) => m.bracket === "final_rematch");
        if (rematch) {
            if (rematch.status === "done") {
                out.status = "finished";
                out.champion_id = rematch.winner_id;
            }
            return out;
        }
        if (final && final.status === "done") {
            const loserChampWon = final.winner_id === final.b_id;
            if (!loserChampWon || !state.config.final_rematch) {
                out.status = "finished";
                out.champion_id = final.winner_id;
            }
        }
        return out;
    }

    // ---------------------------------------------------------------
    // Registrar e editar resultado
    // ---------------------------------------------------------------

    function applyResult(state, matchId, aScore, bScore) {
        const s = clone(state);
        const m = findMatch(s, matchId);
        if (!m) throw new Error("match_not_found");
        if (m.status !== "ready") throw new Error("match_not_ready");
        const isLeague = s.mode === "league";
        parseScores(aScore, bScore, isLeague);
        m.a_score = aScore;
        m.b_score = bScore;
        m.winner_id = winnerFor(m, aScore, bScore);
        m.status = "done";
        m.finished_seq = nextSeq(s);
        if (!isLeague && m.bracket === "main" && m.next_match_id) {
            const nxt = findMatch(s, m.next_match_id);
            if (m.next_slot === "a") nxt.a_id = m.winner_id;
            else nxt.b_id = m.winner_id;
            if (nxt.a_id && nxt.b_id && nxt.status === "pending") nxt.status = "ready";
        }
        syncDerived(s);
        return s;
    }

    function dependentsOf(state, m) {
        const out = [];
        if (m.next_match_id) {
            const nxt = findMatch(state, m.next_match_id);
            if (nxt) out.push(nxt);
        }
        for (const d of state.matches) {
            if (d.id === m.id) continue;
            if (d.a_src === m.id || d.b_src === m.id) out.push(d);
        }
        return out;
    }

    function editResult(state, matchId, aScore, bScore) {
        const s = clone(state);
        const m = findMatch(s, matchId);
        if (!m) throw new Error("match_not_found");
        if (m.status !== "done") throw new Error("match_not_done");
        const isLeague = s.mode === "league";
        parseScores(aScore, bScore, isLeague);
        const oldWinner = m.winner_id;
        const newWinner = winnerFor(m, aScore, bScore);

        if (isLeague || newWinner === oldWinner) {
            m.a_score = aScore;
            m.b_score = bScore;
            m.winner_id = newWinner;
            return s;
        }

        const deps = dependentsOf(s, m);
        if (deps.some((d) => d.status === "done")) throw new Error("downstream_played");

        const oldLoser = loserOf(m);
        m.a_score = aScore;
        m.b_score = bScore;
        m.winner_id = newWinner;
        const newLoser = loserOf(m);

        for (const d of deps) {
            const toLosersRoute = m.bracket === "main" && d.bracket === "losers";
            const pid = toLosersRoute ? newLoser : newWinner;
            if (d.id === m.next_match_id && m.bracket === "main") {
                if (m.next_slot === "a") d.a_id = newWinner;
                else d.b_id = newWinner;
                continue;
            }
            if (d.bracket === "final_rematch") continue;
            if (d.a_src === m.id) d.a_id = pid;
            if (d.b_src === m.id) d.b_id = pid;
        }
        // Se o perdedor trocou e ele ainda esta esperando adversario na
        // rota dos perdedores, nada a ajustar: o evento e derivado do
        // resultado atual.
        void oldLoser;
        syncDerived(s);
        return s;
    }

    // ---------------------------------------------------------------
    // Tabela da liga (sempre calculada na leitura)
    // ---------------------------------------------------------------

    function computeStandings(participants, matches, points) {
        const pts = points || { win: 3, draw: 1, loss: 0 };
        const rows = new Map();
        for (const p of participants) {
            rows.set(p.id, { id: p.id, name: p.name, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
        }
        for (const m of matches) {
            if (m.bracket !== "league" || m.status !== "done") continue;
            const a = rows.get(m.a_id);
            const b = rows.get(m.b_id);
            if (!a || !b) continue;
            a.played++;
            b.played++;
            a.gf += m.a_score;
            a.ga += m.b_score;
            b.gf += m.b_score;
            b.ga += m.a_score;
            if (m.a_score > m.b_score) {
                a.w++;
                b.l++;
                a.pts += pts.win;
                b.pts += pts.loss;
            } else if (m.b_score > m.a_score) {
                b.w++;
                a.l++;
                b.pts += pts.win;
                a.pts += pts.loss;
            } else {
                a.d++;
                b.d++;
                a.pts += pts.draw;
                b.pts += pts.draw;
            }
        }
        const list = Array.from(rows.values());
        for (const r of list) r.gd = r.gf - r.ga;
        list.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name));
        list.forEach((r, i) => {
            const prev = list[i - 1];
            r.rank = prev && prev.pts === r.pts && prev.gd === r.gd && prev.gf === r.gf ? prev.rank : i + 1;
        });
        return list;
    }

    root.TournamentBracketEngine = {
        LIMITS,
        uuid,
        shuffle,
        nextPowerOf2,
        normalizeNames,
        normalizeConfig,
        buildMainBracket,
        buildLeagueSchedule,
        createTournamentState,
        applyResult,
        editResult,
        computeStandings,
        summarize,
        syncDerived,
    };
})(typeof globalThis !== "undefined" ? globalThis : window);
