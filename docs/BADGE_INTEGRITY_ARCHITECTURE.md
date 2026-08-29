# Nodra Badge & Prize Integrity Architecture

Version: 1.0
Status: Approved for build
Last Updated: August 2026

---

# Purpose

`MATCH_HISTORY_ARCHITECTURE.md` built the recording pipeline (who played what, where).
This document exists because recording alone isn't enough once a match result can
trigger a real prize payout or an on-chain badge mint: recording only proves *someone
claimed something happened*, never that it actually did. This document defines what
closes that gap, and — just as importantly — what doesn't need it.

The trigger for this doc: a live test proved a logged-in user could insert an
arbitrary `match_history` row (`placement: 1`, fabricated `room_code`, fabricated
score) that passes RLS cleanly, because `with check (auth.uid() = user_id)` only
proves *who* is writing, never *whether the content is true*. RLS cannot fix this —
it operates on row ownership, not on truth.

---

# Core principle: stakes decide how much trust a result needs

Not every match matters the same amount, and the fix should match the stakes, not be
applied uniformly everywhere. This was explicit in the discussion that produced this
doc: a self-played, self-sabotaged casual match "não dá nada" (gives nothing) beyond
wasting a row in the database — it doesn't deserve the same defense as a match with a
real prize attached.

Two tiers:

## Tier 1 — Casual (no stakes attached)

The current model stays exactly as it is. Client computes the result, client writes
it, nobody validates it server-side. This is fine because nothing of value depends on
the result being true. This covers the overwhelming majority of NDQuest play.

## Tier 2 — Stakes attached (a real prize or a badge is on the line)

Requires a trust gate before any payout or mint can be triggered. Two mechanisms are
approved, deliberately not just one — "as 2 mecânicas" was explicit: use whichever
fits the situation, not a single mandated path.

### Mechanism A — Host approval gate

The host sees the real ranking and has to take an explicit confirm action before any
badge-grant or payout button becomes available. This reuses the "vale assinado" idea
from `LOGIN_WALLET_ARCHITECTURE.md`'s Badges section — the host's confirmation *is*
what authorizes the voucher to be issued, nothing is auto-issued from raw
`match_history` alone.

**Where this lives — corrected after a first pass got this wrong.** A first build put
the confirm button inside the profile's History tab (the "click a hosted match to see
participants" view), as a blanket action shown for every hosted match. That's the
wrong home for it and was reverted. Two problems with it: (1) it implied every casual
match needs confirming, when the whole point of the tiered model is that most matches
don't; (2) it's disconnected from the moment that actually matters — the host should
confirm right on the game's own results screen, at the point they're about to award a
badge, not go dig through their profile afterward.

Corrected shape: the confirm action belongs on each game's own finished/results
screen (host side), and only surfaces when the host is in a badge-awarding context —
not as a default element on every match. Casual matches stay exactly at Tier 1: the
server record is enough, no confirmation UI at all, nothing extra for the host to do.

This is explicitly **not** being rebuilt into the current game screens yet — the game
UIs are expected to change substantially soon, and building this into a screen that's
about to be redesigned would mean redoing it twice. The `host_confirmed_at` column on
`match_history` and its update policy are already in place and safe to build against
whenever the game UI work happens; only the account-page UI attempt was reverted.

**Known weakness, already surfaced live**: peer confirmation ("cada player confirma o
outro") was proposed and tested against the weakest realistic case — a 2-person room
where both accounts are controlled by the same attacker. Peer confirmation doesn't
stop that; the two accounts just confirm each other. It's not adopted as a trust
mechanism on its own. It may still be worth surfacing as a *soft signal* (e.g.
flagging a room for review if placements look suspicious) but never as the actual
gate.

### Mechanism B — Server-side computation

The gold-standard fix, described concretely: the client never learns the correct
answer before answering. It sends raw actions only ("selected option B, question 3, at
time X"); an Edge Function — the only place that knows the answer key — grades the
action and is the one that writes the result, using the service role, not the
player's own client. Nothing is left for a tampered client to lie about, because it
never had the information needed to lie with.

This is a real rewrite of each game's answer-checking core, not a policy tweak. It is
also the *only* option for Academy specifically (see below) — Academy has zero
backend today, so this is new construction there, not a retrofit.

### Choosing between them

Both are approved, not sequenced as "A now, B eventually only." Use host approval
first for existing NDQuest multiplayer games (host already exists in that flow, fast
to ship, real protection against the exploit that was proven). Server-side
computation is the deeper investment, worth doing where a host doesn't naturally
exist in the flow — Academy is the clearest case, since nobody is hosting an Academy
quiz attempt.

---

# Two badge issuance paths — they don't share the same trust problem

This was a key clarification: not all badges come from the same place, and one of the
two paths doesn't need the integrity chain above *at all*.

## Path 1 — Game-tied achievements ("Nodra" badges)

Earned automatically by playing — "completed N quizzes," "won a match," etc. These
*are* claims about game performance, so they need Tier 2 protection (host approval or
server computation) before a mint voucher is issued. This is the path this whole
document is about.

## Path 2 — VIP-granted badges

For things no automated system can verify by design: a community's weekly match,
attending an event, visiting a booth. These are inherently a human vouching for
something that happened in the physical or social world — there's no "result" to
fake-detect in the first place. This path doesn't need Mechanism A or B; it needs
**access control**, the same shape as the existing `admin-grant-vip` pattern: only a
VIP account can call a `grant-badge`-style action, targeting a specific user, and it
gets logged (same audit-log discipline as admin actions). No game data, no
`match_history`, no server-computed score involved.

Building Path 2 is materially simpler than Path 1 — it's an access-controlled mutation
plus an audit trail, not a fraud-proofing problem. It can ship before Path 1's server
computation work is done, since it doesn't depend on it.

---

# Rate limiting / room-spam — deferred, not forgotten

Explicitly requested, explicitly last-priority: a timer or IP-based limit on room
creation, so testing isn't slowed down by hitting a limit while iterating. Noted here
so it isn't lost, not being built yet. When it is: scope it to prevent database bloat
from spam, not to police legitimate rapid testing — whatever threshold gets picked
should be generous enough that normal dev/test iteration never trips it.

---

# What this doc does NOT change

- Tier 1 (no-stakes) play is untouched. No new friction for casual games.
- The RLS hardening already shipped (host_id/user_id spoofing protection across the 4
  games) stays as-is — it's still correct and necessary, just not sufficient on its
  own for stakes-attached results. It closes "pretend to be someone else." This doc
  closes "lie about what happened to yourself."
- Match History's public visibility (any logged-in user sees anyone's history) is
  unchanged — that was a deliberate product decision, unrelated to this integrity
  question.

---

# Open Items (known, deliberately deferred, not forgotten)

- Mechanism B (server-side computation) not yet built for any of the 4 NDQuest games
  or Academy. Academy has no backend at all yet — this is the prerequisite for Academy
  badges specifically, not an enhancement.
- Mechanism A (host approval gate) — reverted from the profile's History tab (wrong
  home, see Mechanism A section above). Not yet built in the right place, which is
  each game's own results screen, gated to badge-awarding context only. Waiting on
  the broader game UI redesign so this isn't built twice. The DB side
  (`host_confirmed_at` column + update policy) is already in place.
- Path 2 (VIP-granted badges) access-control action not yet built.
- Rate limiting on room creation — deferred per explicit instruction, revisit once
  testing is less frequent.
- The actual mint mechanism (signed voucher issuance + Avalanche contract) — still not
  built, unchanged from `LOGIN_WALLET_ARCHITECTURE.md`'s original Open Items. Both
  Mechanism A and B produce the *authorization* to mint; neither this doc nor
  `MATCH_HISTORY_ARCHITECTURE.md` builds the mint itself.
