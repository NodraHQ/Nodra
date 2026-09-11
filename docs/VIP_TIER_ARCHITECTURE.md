# Nodra VIP Tier System

Version: 1.0
Status: Implemented and deployed. Enforcement has a known gap — see Open Items.
Last Updated: September 2026

---

# Purpose

VIP grew from a single flat tier ($5/month, one set of perks) into three priced
tiers, each unlocking a bigger live-room player cap and higher creation quotas. This
document is the single source of truth for what each tier actually grants — read it
before changing a limit or price anywhere, rather than re-deriving numbers from
scattered code comments.

Read `LOGIN_WALLET_ARCHITECTURE.md` for the base VIP/profile/wallet foundation this
extends, and `MATCH_HISTORY_ARCHITECTURE.md` for how guest identity interacts with
some of the mechanisms below (especially the anonymous-auth section — several bugs
in this system came from that interaction).

---

# Why tiers exist: the cost problem

Every player connected to a live game room (Show Down, Time Attack, Tap Rush,
Roulette's QR mode) holds open a Supabase Realtime connection for as long as they're
in the room. Supabase bills/caps this per-project, not per-room. A single VIP
account hosting an very large room, or several VIPs hosting simultaneously, can push
the whole platform's concurrent-connection count close to the Realtime tier ceiling
— unrelated to how much any single person paid. Tiers exist to size each account's
blast radius to what their subscription price actually covers, with margin, not to
gate features for their own sake.

Two things never cost a live connection, regardless of tier or account status:
Roulette's "paste a list" / "import from another room" modes (no one's device
connects), and Quest Drop (single-screen host mode, no separate player connections
at all).

---

# The tiers

| Tier | Price | Live room player cap |
|---|---|---|
| Free (no VIP) | $0 | 30 players, 10 hosted rooms per 30 days |
| Bronze | $5 / 30 days | 100 players |
| Prata | $20 / 30 days | 250 players |
| Gold | $50 / 30 days | 1,000 players, priority support |

Paying again before the current period ends extends the existing expiry (adds 30
days on top, doesn't reset from the payment moment). Paying for a different tier
while already VIP switches the account to that tier's price/limits going forward —
there is no separate "upgrade" flow, it's the same payment path with a different
tier selected.

`profiles.vip_tier` holds the value (`'bronze' | 'prata' | 'gold'`, nullable).
`profiles.is_vip` still exists alongside it and is NOT derived from `vip_tier` — the
two are set together, by the same code paths (`verify-vip-payment`,
`redeem-vip-code`, `admin-grant-vip`), but nothing enforces they can't drift apart if
a future code path forgets to set both. Any code checking "is this account VIP at
all, regardless of tier" should keep checking `is_vip`; any code checking "which
tier" needs `vip_tier` specifically, and should treat `vip_tier === null` as
equivalent to Bronze when `is_vip` is true (this happens for admin-granted VIP with
no tier chosen, and for old pre-tier grants).

---

# Per-tier creation quotas

| | Bronze | Prata | Gold |
|---|---|---|---|
| Badges creatable per VIP cycle | 10 | 20 | 30 |
| Included custom themes per cycle | 3 | 10 | unlimited |
| Saved question packs (total, not per-cycle) | 5 | 20 | unlimited |

Badge and theme quotas reset each VIP renewal cycle, tracked by matching
`created_for_vip_expiry` against the account's current `vip_expires_at` (a value
that changes each renewal, so a new cycle naturally starts a fresh count). Enforced
server-side in `vip-create-badge` and `vip-create-theme`.

Saved packs are different: the quota is a live count of currently-existing packs,
not scoped to a cycle. Deleting an old pack frees a slot immediately, regardless of
renewal timing. Enforced server-side in `vip-create-saved-pack` — this is the ONLY
way to create a saved pack; there is no client-side insert path anymore (the RLS
insert policy on `vip_saved_packs` was deliberately dropped once this function
existed, closing a bypass where a direct insert skipped the quota check entirely).

Reviewing community-submitted packs (the admin-approval flow) is available equally
at every tier — it isn't gated.

---

# Live room player cap (per-room)

Enforced client-side, at the moment a NEW player tries to join a room — not at room
creation. Each of the 4 games' `play.js` has:

```js
const ROOM_PLAYER_CAPS = { bronze: 100, prata: 250, gold: 1000 };
const FREE_ROOM_PLAYER_CAP = 30;

async function getRoomPlayerCap(hostId) {
    if (!hostId) return FREE_ROOM_PLAYER_CAP;
    const { data: hostProfile } = await window.ndquestSupabase
        .from('profiles').select('is_vip, vip_tier').eq('id', hostId).maybeSingle();
    if (!hostProfile?.is_vip) return FREE_ROOM_PLAYER_CAP;
    return ROOM_PLAYER_CAPS[hostProfile.vip_tier] || FREE_ROOM_PLAYER_CAP;
}
```

The cap is based on the HOST's tier, not the joining player's. A reconnecting
player (already has a row in that room) is never blocked by this check — only
genuinely new joins are. See "Enforcement gap" in Open Items — this check can be
bypassed by calling the Supabase API directly instead of using the site.

---

# Free tier: monthly room limit

10 rooms hosted per 30 days, counted from `match_history` rows where
`role = 'host'` and `created_at` is within the last 30 days. VIP of any tier has no
monthly limit. Enforced client-side in each game's `host.js`, at room-creation time.

---

# One active room per account

A single account can't have more than one non-closed room across all 4 games at the
same time — prevents one VIP account hosting several large rooms simultaneously
(each within its own per-room cap, but stacking past what the tier price was sized
for). Checked at room-creation time in each game's `host.js`: queries all 4 games'
room tables for `host_id = <this account> AND status != 'closed'`.

This check also does inactivity cleanup as a side effect: any room it finds that's
been idle more than 30 minutes gets closed right there, rather than just being
skipped. Without this, a room abandoned without ever being properly closed would
block the account from ever hosting again — this was a real reported bug before the
cleanup was folded into the check.

If the check finds a genuinely-still-open room and blocks, the UI shows a "close old
room and continue" button rather than a dead-end error — closing detection (page
unload, back button) is best-effort and known to sometimes miss (see the
"Room-closing reliability" section below), so a manual recovery path always exists.

---

# Platform-wide connection aggregate

Beyond any single room's cap, there's a platform-wide ceiling: `count_active_platform_players()`,
a Postgres function, sums currently-connected players across all 4 games' non-closed
rooms in one query (join each `<game>_players` to its `<game>_rooms`, filter
`status != 'closed'`, count). Called via RPC before letting a new player join any
room:

```js
const PLATFORM_AGGREGATE_BLOCK_THRESHOLD = 420;
```

420 was chosen against the Supabase Pro tier's 500 included Realtime connections,
leaving headroom for connections still finishing their natural close. There's no
separate "warning" threshold enforced anywhere in code — a warning color (350+) only
exists as a visual cue on the admin Analytics card, not as a behavior change.

---

# Room-closing reliability (why a room might not close when you'd expect)

Three independent mechanisms exist, layered because none of them is individually
reliable:

1. **Explicit close button** — sets `status = 'closed'` directly. Reliable when
   clicked, but almost nobody clicks it (confirmed by live user testing) — most
   people just navigate away or close the tab.
2. **`pagehide` listener with `fetch(..., { keepalive: true })`** — fires on tab
   close, back button, refresh, or any navigation away. Not fully reliable:
   `keepalive` fetches are cross-origin here (the game's own domain calling out to
   the Supabase project's domain), and a CORS preflight may not have time to
   complete before the browser tears down the page. Known to sometimes silently not
   fire.
3. **30-minute inactivity cleanup** — the backstop. Checked lazily (not a
   background job) at two points: when a new player tries to join a room
   (`isRoomStale(updatedAt)`), and when the "one active room per account" check runs
   at room-creation time. A room's `updated_at` auto-refreshes on any write via a
   `touch_updated_at` trigger, so genuinely-active rooms never look stale even
   without an explicit heartbeat.

Given #1 and #2 both have real gaps, never assume a room is closed just because the
host appears to have left — always go through #3's staleness check before treating
an old room as safe to ignore or reuse.

---

# Anonymous auth (security foundation this all sits on)

Guests (no account) get a real, anonymous Supabase session via
`signInAnonymously()` on first action, instead of playing with no identity at all.
This exists specifically so RLS has something real to scope guest permissions to —
before this, guest player rows used `user_id IS NULL`, and RLS had no way to
distinguish "the actual guest who joined" from "any other anonymous visitor," so
policies had to allow anyone to modify any guest's row. Full detail and the bugs
this caused (guest names/placement not showing correctly in history, because
`getCurrentUserId()` now always returns something) are in
`MATCH_HISTORY_ARCHITECTURE.md`.

`getCurrentUserId()` in each game's `host.js`/`play.js` triggers this automatically
— any code calling it doesn't need to know or care whether the resulting id is a
real account or an anonymous session, EXCEPT where the distinction specifically
matters (routing to public vs. private history — see the other doc).

---

# Support ticket priority

Gold-tier VIPs' support tickets sort to the top of the admin's ticket queue, above
all other tickets regardless of creation time. Purely a display-order change in
`admin-list-support-tickets` — no different data model, no different ticket table.

---

# Open Items (known, deliberately deferred, not forgotten)

- **Enforcement gap, the important one**: every limit in this document (room
  player cap, monthly room limit, one-room-per-account, platform aggregate) is
  enforced CLIENT-SIDE only, in each game's own JavaScript. None of it is backed by
  an RLS policy or Edge Function check. A technically-savvy person could call the
  Supabase REST API directly, skipping the site's JS entirely, and bypass all of
  it. Assessed as acceptable launch risk (the worst case is a room exceeding its
  intended cap, not a security/data breach — the cost math was worked through and
  even a worst-case single incident doesn't blow the budget), but it should move
  server-side eventually, the same way `vip-create-badge` / `vip-create-theme` /
  `vip-create-saved-pack` already did for their quotas.
- Roulette's "import from another room" mode always shows imported guests as
  guests in history, even when the original player was a real account — see
  `MATCH_HISTORY_ARCHITECTURE.md`'s Open Items for why the obvious fix broke RLS
  and got reverted.
- No self-service tier upgrade/downgrade UI beyond "pay again at a different
  tier's price" — there's no prorating, no mid-cycle switch credit.
- Admin-generated VIP codes now carry a `tier` field (chosen at generation time),
  but there's still no UI for an admin to grant a specific tier via the
  grant/revoke toggle on the Users tab — that path always implies whatever
  `vip_tier` was already on the profile, or null/Bronze-equivalent for a fresh
  grant.
