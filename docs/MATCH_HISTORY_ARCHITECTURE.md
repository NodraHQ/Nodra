# Nodra Match History, Host Payout Screen & VIP Scope

Version: 1.1
Status: Match history + guest routing implemented. Host payout screen and badge
voucher mechanism NOT implemented (see Open Items). VIP scope has grown far past
what this doc originally specified — see `VIP_TIER_ARCHITECTURE.md`.
Last Updated: September 2026

---

# Implementation Status (added Sept 2026 — read this before touching match history)

What actually got built, and how it diverges from the original plan below:

**`match_history` exists and is live**, matching the schema below, for all 4 games.
One real deviation from the original design: a **second table,
`guest_participants`**, was added as a companion. `match_history`'s insert policy
requires `auth.uid() = user_id` — a logged-in-only requirement — so a genuinely
anonymous player (no session at all) had no way to satisfy it. `guest_participants`
is host-only-visible (not public like `match_history`), keyed by `nickname` instead
of `user_id`, and is where non-logged-in players' results land instead. The routing
decision (which table a given result goes to) happens per-player, per-game, in each
game's own `play.js`.

**Anonymous auth changed the ground under this feature — read carefully.** Guests
now get a real (if anonymous) Supabase session via `signInAnonymously()`, for an
unrelated reason (RLS needed a real identity to scope guest player-row permissions
to, see `VIP_TIER_ARCHITECTURE.md`'s security section). The side effect: any code
that decided "logged in vs guest" by checking `if (userId)` broke, because
`getCurrentUserId()` now *always* returns something, even for guests. This caused
two real, separately-discovered bugs — guest names showing as "?" in host room
history, and guest placement never being recorded in Time Attack (a bug that lived
in the `time-attack-update-ranking` Edge Function itself, not just client code,
and required a real production report to notice, since it never causes an error,
just silently updates zero rows).

**The fix pattern, if you're routing to `match_history` vs `guest_participants`
anywhere new**: do not check truthiness of a user id. Check
`session.user.is_anonymous` explicitly (a real field Supabase exposes for exactly
this). A small `isAnonymousSession()` helper exists in each game's `play.js` for
this. If you're doing an UPDATE against one of these two tables based on a stored
row (not a live session, e.g. recalculating a ranking after the fact), the more
robust pattern is: don't branch on a check at all — attempt the update against
*both* tables unconditionally, scoped by a natural key (nickname + room_code +
round_number for guests, user_id + room_code + round_number for real accounts). The
`WHERE` clause on whichever table doesn't apply simply matches zero rows; no
if/else needed, and no future auth change can silently break the routing again.

**Host payout screen, prize sending, badge-grant-from-payout-screen: still not
built.** Everything in the "Host Payout Screen" section below is still the plan,
not the implementation. What exists instead today: badges are created and granted
from the VIP's own account page (not from an end-of-game screen), independent of
match results.

---

# Purpose

This document covers three things decided together, because they share the same
foundation and the same screen: match history, the host's end-of-game payout screen
(profile/wallet access + sending a prize), and what VIP actually unlocks in v1.

Read `LOGIN_WALLET_ARCHITECTURE.md` first — this document extends its Profile,
Badges, and Prize Payment sections rather than repeating them. Read
`NDQUEST_ARCHITECTURE.md` for the per-game self-containment rule this still respects
(each game keeps its own copy of anything it needs; no cross-imports between games).

---

# The Foundational Gap: Rooms and Players Don't Know Who's Real

Everything in this document is blocked on the same missing piece: today, a game
room's `host_name` and a player's `nickname` are free-typed text, even when that
person is logged in (the `accountIdentity.js` integration auto-fills the text with
their username, but it's still just text — nothing links that row back to a real
`auth.users` account). There is no reliable way to know "this ranked player is
actually this account" — only a naming convention that a manually-edited nickname can
break.

This has to be fixed before match history or the host payout screen can exist, in any
of the 4 games with live rooms (Time Attack, Show Down, Tap Rush, Roulette — Quest
Drop still excluded, no live room concept there).

## Schema addition (all 4 games, 8 tables total)

Each game's room table gains:
```sql
alter table <game>_rooms add column host_id uuid references auth.users(id);
```

Each game's player table gains:
```sql
alter table <game>_players add column user_id uuid references auth.users(id);
```

Both columns are **nullable**. A host or player who isn't logged in leaves it null —
they still play/host exactly as before, they just don't get a `host_id`/`user_id`
link, which means no match history entry and no clickable profile for them on the
payout screen. This matches what was already decided: login stays fully optional,
only logged-in people opt into being tracked.

Populated client-side, at the moment of creating/joining a room: if a session exists,
send the real `auth.uid()` alongside the existing nickname text. The nickname text
itself doesn't change — it's still what displays during the game — this just adds a
parallel, reliable identity link for whoever's actually logged in.

---

# Match History

## Table

One shared table across all 4 games (not 4 separate tables) — a single `game` column
distinguishes them, matching the same union pattern `admin-list-rooms` already uses.

```sql
create table match_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    role text not null check (role in ('player', 'host')),
    game text not null check (game in ('time_attack', 'show_down', 'tap_rush', 'roulette')),
    room_code text not null,
    placement integer,          -- ranking position, null for host rows
    details jsonb,               -- game-specific extras (score, time, etc.) — flexible on purpose
    created_at timestamptz not null default now()
);
```

A person can have two rows for the same room — one as host, one as player — if they
did both, which is allowed and not deduplicated.

## Visibility: public, by explicit decision

Unlike `wallet_evm` and per-event earnings (which stay owner+host-only, per
`LOGIN_WALLET_ARCHITECTURE.md`'s Profile section), match history is public to any
logged-in user — this was a deliberate choice, reasoned through live, not an
oversight or a default. It joins the public layer (username, socials, badges).

```sql
alter table match_history enable row level security;

create policy "qualquer usuário logado lê o histórico de qualquer um"
    on match_history for select
    to authenticated
    using (true);

create policy "usuário só grava a própria linha"
    on match_history for insert
    to authenticated
    with check (auth.uid() = user_id);
```

The insert policy matters for a real reason, not just tidiness: without `auth.uid() =
user_id`, any logged-in user could fabricate history rows claiming someone else
played or won something they didn't. Each person's own client writes only their own
row, when their own game ends (or when they finish hosting).

No update/delete policy for users — history isn't user-editable. Deletion only
happens via the retention job below, using the service role, which bypasses RLS by
design.

## Where it lives in the UI

A dedicated tab in the account profile — not a list dumped into the main profile
view. Filterable by game. This was explicit: a giant unfiltered list on the main
profile page was rejected in favor of its own tab.

## Retention

Same window already defined for host room/payout retention in
`LOGIN_WALLET_ARCHITECTURE.md`: **30 days default, 180 days (6 months) for VIP**. This
is not a new policy — it's the same rule, now also applied to `match_history`. One
scheduled cleanup job can prune both, checking each row's owner's `is_vip` to pick the
right cutoff. That job still doesn't exist yet (noted as an open item before, still
open — see below).

---

# Host Payout Screen

This is the real screen behind the flow already sketched in
`LOGIN_WALLET_ARCHITECTURE.md`'s "End-of-game flow" — now specified with what the
host actually sees and can do, per ranked player:

```
Ranking final
  -> por jogador logado (com user_id):
       nome + avatar + wallet_evm cadastrada (se houver)
       botão: ver perfil completo (bio, socials, badges — a parte pública)
       botão: enviar prêmio (Direct, já assinado pelo host — ou Manual, lista)
       botão: conceder badge (mintar agora / disponibilizar — ver Badges abaixo)
  -> por jogador sem login (sem user_id):
       só o nome que foi digitado, nenhum botão de perfil/wallet
       prêmio, se houver, só pelo caminho manual (endereço digitado na hora)
```

This is exactly what "host vê o nome no ranking, e mais nada" was missing — the host
now has a real reason to click into a name: send the prize, or look at who they're
paying before doing it. The access rule itself was already correct in
`LOGIN_WALLET_ARCHITECTURE.md` (host of that specific room sees that room's
participants' restricted data) — what was missing was `host_id`/`user_id` existing at
all to check against, and a screen that does anything with it.

## What the host is allowed to see here

Per the reasoning given live: "nada que solicitamos é fundamentalmente secreto" — the
host sees the participant's full profile (public layer + `wallet_evm`) for anyone who
played in *that specific room*. This does not change the existing rule that a host
never sees a participant's data from a room they didn't host — scoping is still
per-room, not "any host sees any player."

---

# Badges — grant hook lives on this same screen, mechanism is a separate build

The "conceder badge" button on the payout screen is the same two-option flow already
defined in `LOGIN_WALLET_ARCHITECTURE.md`'s Badges section (mint now / make
available). This document places that button on the real screen; it does not design
the signed-voucher issuing mechanism or the mint contract itself — that's still
unbuilt, and remains its own follow-up (needs an Edge Function to sign vouchers, and
the actual mint contract on Avalanche, neither of which exist yet). Building this
screen now with the button present (calling into that mechanism once it exists) is
intentional, not a shortcut — it avoids re-opening the payout screen a second time
later just to add a button that was always going to belong there.

---

# VIP Scope, v1 — SUPERSEDED, see VIP_TIER_ARCHITECTURE.md

This section is left below for history only. It was accurate as of August 2026, when
retention was the only decided VIP perk. That is no longer true — VIP grew into a
full 3-tier system (Bronze/Prata/Gold) with per-tier room-size limits, creation
quotas for badges/themes/packs, a platform-wide connection cap, and more. None of
that is documented in this file. Read `VIP_TIER_ARCHITECTURE.md` for the current,
accurate picture. The paragraphs below are kept only so old context isn't lost, not
as current guidance.

The only VIP perk that is actually decided and specified, anywhere, is the retention
window: 30 days default vs. 180 days (6 months) for VIP, applying to host room/payout
records and now `match_history` alike.

Everything else from the early product roadmap (badges as a VIP-only perk, wallet
abstraction, on-chain registration, custom themes, VIP-only Academy courses) was
brainstormed early on but never scoped or decided for v1. This document does not
invent new VIP perks to fill that gap — if more VIP perks are wanted, that's a
decision to make explicitly, the same way every other piece in this project has been,
not something to assume from an old roadmap sketch.

`profiles.is_vip` and the admin panel's grant/revoke action already exist and work
(`admin-grant-vip` Edge Function, built and deployed) — what's missing is anything
beyond retention that actually checks `is_vip` and changes behavior.

---

# Open Items (known, deliberately deferred, not forgotten)

- The retention cleanup job itself (prune `match_history` and host room/payout
  records past the 30-day/180-day window) — still not built, flagged before, still
  open.
- The badge voucher-signing Edge Function and the mint contract on Avalanche — the
  button on the payout screen will call into this once it exists; it doesn't exist
  yet.
- Rolling this same host-payout-screen pattern to Quest Drop once it gains a live room
  concept (it doesn't have one today, so it's excluded from this document entirely).
- Roulette's "import players from another game's room" mode always records
  imported players as guests in history, even when the original player was a real
  account. Attempted once (Sept 2026) by carrying the source `user_id` into the
  client-side `roulette_players` insert — this broke the entire insert, because RLS
  rejects any insert where `user_id` doesn't match `auth.uid()` (a host can't insert
  a row claiming to be someone else). Reverted. The correct fix needs an Edge
  Function running with the service role to do this insert, not a direct client
  write — not yet built.
- See `VIP_TIER_ARCHITECTURE.md`'s own Open Items for tier-limit enforcement gaps
  (room/pack/badge/theme caps are enforced client-side only, not at the RLS/Edge
  Function level — a technically-savvy user could bypass them by calling the
  Supabase REST API directly instead of going through the site).
