# Nodra NDQuest Architecture

Version: 1.0
Status: Stable
Last Updated: August 2026

---

# Purpose

This document defines the official architecture and working rules of NDQuest, Nodra's game platform.

Its purpose is to keep every game consistent, keep question packs trustworthy, and prevent scope drift — several rules here exist specifically because they were violated at least once during development.

Any implementation that violates this document should be considered incorrect.

---

# Project Structure

NDQuest lives at the repository root, next to academy/ and about/, fully self-contained (see ACADEMY_ARCHITECTURE.md's Migration Note for why verticals don't share assets).

ndquest/
  index.html          (NDQuest landing, category tabs: Quiz / Ação / Sorteio)
  quest-drop/          (envelope-opening quiz, host-only, prize distribution)
  time-attack/          (race-the-clock quiz)
  show-down/          (live synchronized quiz, everyone answers together)
  tap-rush/          (tap race: target, endless, or tug of war)
  roulette/          (name wheel: import, QR/code, or paste a list.
                      QR mode syncs live to watching players via
                      roulette_rooms columns: current_pool, spin_status,
                      spin_started_at, current_winner_name/index.
                      Import mode has no live room behind it, host-only.)

# Rule: No Cross-Imports

Every game folder is fully independent. A game must never import, reference, or depend on a file inside another game's folder.

This means real duplication is expected and accepted: the same question pack, the same branding theme, or the same style rule may exist as separate physical files in quest-drop/, time-attack/ and show-down/. This is intentional, in exchange for each game being safely changeable without breaking the others.

When a change (a fixed pack, a new theme) needs to reach more than one game, copy the file into each game that needs it. Do not create a shared folder to avoid duplication.

---

# Per-Game Structure

A typical game folder contains:

index.html (host/config view)
script.js or host.js
style.css
i18n/translations.js (or translations.js at the game root)
questions/ (question packs, one file per pack + questions-manifest.js)
branding/ (white-label themes, one folder per theme + branding-manifest.js + theme-schema.js)
play/ (player-facing join screen, for multiplayer games)

Not every game has every folder (Quest Drop has no play/, since it's host-only with no separate player view; Roulette and Tap Rush have their own player join flow).

---

# Question Pack Rules

This is the section most worth reading carefully. Every rule below exists because an earlier pack shipped without it and had to be rebuilt.

## Sourcing

Every fact in a question must trace back to something real and checkable — the project's own official docs, its GitHub, or reputable coverage. Search before writing. Never invent a scenario, a company, a statistic, or a "team fact" to make a question more interesting.

If a fact can only be reasonably inferred (not directly stated anywhere), the question must say so honestly ("o que é razoável supor", not "o que a documentação diz"), and the inference must still be grounded in something real (a naming pattern, a known relationship between two real entities), not invented from nothing.

Before writing a pack for a company or protocol, confirm it's real, not a placeholder brand — this was wrongly assumed at least once.

## Question Style

Every question gives the network/protocol/company as context already stated, never as the thing to guess. "Você usa a Stellar pra mandar dinheiro. O que faz isso ser barato?" — not "Qual rede é feita pra pagamento barato?" (the second framing turns the answer into free advertising for whichever brand happens to be correct).

Keep the enunciado short. Do not open with filler like "Você quer saber por que..." or "Segundo a documentação...". State the scenario in one clean sentence and ask.

Mix formats across a pack: direct scenario, "mito ou verdade", "o que aconteceria se", and the occasional straight comparison. A pack that is 60 questions of the exact same "O que é X?" shape reads as trivia, not as a quiz.

## Answers

Alternativas erradas need to sit in the same neighborhood of plausibility as the correct one. A wrong answer that anyone could eliminate without knowing the topic ("Guardar fotos", "Enviar PIX") teaches nothing and must be replaced — ideally with a real term from a different, related project, not a made-up phrase.

Length balance is not optional and must be measured, not assumed. After writing a pack, run a script that checks, for every question, whether the correct answer is the longest of the four. If that rate is much above roughly 40-50%, the length itself is giving the answer away — fix it before delivering. Preference order when balancing: keep every option's content real and plausible first; only pad wording as a last resort, and never invent a longer wrong answer that isn't true of anything.

When editing answers via find-and-replace across a large pack, check whether the same short phrase is reused across multiple different questions before assuming a single edit applies everywhere. This has caused real cross-question corruption before (fixing question 19's wrong answer accidentally also changed question 25's).

## Format & Validation

Every pack: 60 questions unless otherwise agreed, split 20/20/20 across easy/medium/hard. `name: {pt, en}`, `questions: {easy: [...], medium: [...], hard: [...]}`. Each question: `question: {pt, en}`, `answers: {pt: [4], en: [4]}`, `correct: <index>`.

No em-dash ("—") anywhere in visible pt/en text (comments in the file header are fine).

PT and EN must stay in sync: same number of answers, same meaning per position. After any bulk edit, re-read the full PT/EN pairing side by side at least once — this has caught real drift before (one language keeping old text after the other was edited).

Before delivering: `node --check` the file, confirm no duplicate answer within a single question, confirm the em-dash count, and run the length-balance measurement. Report the actual numbers, not an assumption that it's fine.

---

# Branding / Theme Rules

Themes live in `branding/{theme-name}/{theme-name}.js` per game, validated against `branding/theme-schema.js`'s `validateTheme()` before being trusted. A theme that fails validation must not ship.

A theme needs, at minimum: primary/background/text colors (with light and dark-adjacent variants), fonts, a logo path, and a bilingual slogan. If a logo has light-colored text and will sit on a light paper/card background, set a dark `logoBackground` so it stays legible — this was a real bug the first time a light-on-light logo was used.

New themes are registered in that game's `branding-manifest.js`. A theme file existing on disk without a manifest entry does nothing — always check both.

---

# Prize Distribution (Quest Drop)

Quest Drop supports two reward modes, both landing on whole, human-friendly numbers rather than random cents:

**Weight mode** (default): the host sets a relative weight per difficulty (default 3/5/7, not a percentage — weights don't need to sum to 100). The total budget is split by weight, in whole currency units, using a largest-remainder method applied per individual envelope (not per difficulty tier and then divided) — this is what guarantees envelopes of the same difficulty come out identical whenever the math allows it. When a budget doesn't divide evenly, the UI must warn and suggest the nearest budget that would.

**Fixed mode**: the host types the exact value per difficulty directly. No calculation happens; the total is derived and shown, not entered.

If this logic is ever touched again: prioritize exact equality between envelopes of the same difficulty over "looks round" (a value like 4.95/4.95 is a better outcome than 4.90/5.00, even though the second looks rounder — this was gotten wrong once before being corrected).

---

# Translation Rules

Each game has its own translation table (`t(key)` pattern), applied to the DOM via `data-i18n` attributes, refreshed on language switch.

Any text that is built dynamically in JavaScript (with an interpolated value, like a warning that inserts a suggested number) does **not** have a `data-i18n` attribute and will not refresh automatically on language switch. If a dynamic message is added, the function that regenerates it must also be called from the language-switch handler — this was a real bug (a warning stayed in Portuguese after switching to English) until fixed.

---

# Testing & Validation

Prefer checking real behavior over trusting the code alone: `node --check` for syntax, then load the actual page (Playwright or equivalent) and drive the real flow (fill the form, click, read the resulting DOM) rather than assuming a fix works.

When a value is only visible inside a JS closure not exposed to `window` (common, since most game scripts are ES modules), it is acceptable to temporarily add a `window.__debugX = x` line to inspect it — but it must be removed, and its removal confirmed (grep for it, re-run `node --check`), before the file is considered done. Never ship a debug expose.

---

# Scope Discipline

This section exists because scope drift happened multiple times during development, and each instance required a follow-up correction.

- If a change is requested "only for X" (one game, one difficulty axis, one file), do not propagate it to the others, even if it seems like it would be an improvement everywhere. Ask, if unsure, rather than assume broader scope is welcome.
- If asked to remove/clean up something (a pack, a theme), actually delete it and confirm it's gone — don't leave it half-registered (removed from a manifest but still present in branding, or vice versa).
- Adding one new thing (a theme, a pack) does not justify also rewriting unrelated things nearby "while you're in there." Do the requested thing; mention adjacent opportunities without acting on them unprompted.
- When delivering files, only hand over what actually changed, not a full folder, unless the person explicitly asks for the complete folder as a drop-in replacement.

---

# Forbidden Changes

Do NOT:

Create a shared folder between games to avoid duplication.

Ship a question pack without running the length-balance check.

Invent a fact, scenario, or company to fill out a pack.

Leave a `window.__debug*` expose in delivered code.

Apply a game-specific or difficulty-specific change platform-wide without confirming that's wanted.

Round a prize distribution in a way that breaks equality between same-difficulty envelopes when an equal, if less round, split was possible.

---

# Allowed Changes

You MAY:

Create a new game-specific question pack, following the Question Pack Rules above.

Create a new branding theme, following the Branding Rules above.

Fix a bug in one game without touching the others, even if the same bug likely exists elsewhere — but mention that it likely does.

Add a new prize/reward mode, following the same "measure, don't assume" discipline as the existing ones.

---

# Final Principle

A question pack is only as good as the source behind it, and a distribution system is only as fair as its worst-case rounding. Measure both. Don't assume either is fine because the code looks reasonable — run it, read the real numbers, and only then call it done.
