# Nodra Tournament (NDQuest category)

Version: 1.1
Status: Implemented. Needs the SQL applied and the 4 functions deployed (see "Deploy").
Last Updated: October 2026

---

# What it is

A new NDQuest category, **Tournament**, next to Quiz, Action and Raffle. It is
not a game played inside NDQuest: it helps communities that run competitions in
*other* games. The organizer enters match results, Nodra keeps the bracket or
the table and calculates everything else.

Two formats:

- **Bracket** (knockout), random auto-balanced draw, byes when the number of
  participants is not a power of 2, optional losers route.
- **League** (points table, round robin, optional home-and-away).

Lives at `ndquest/tournament/`, self-contained like every other game folder
(own `style.css`, `branding/`, `i18n/`, `assets/js/`). Same company-theme
selector as the other games (`branding-manifest.js` with `GAME_SLUG =
'tournament'`, remote themes via `ndquest-get-themes`).

# One mode: always saved, same rules as the other games

(The first version had a separate "live link" mode with no database. It was
removed: the other NDQuest games already work as "anyone can use it, VIP gets
the history is open to any account", so Tournament follows the same model.)

Every tournament is stored in the database. Anyone can create and run one,
**guests included** (an anonymous Supabase session owns it, same mechanism as
room hosts). What changes with a VIP account:

| | Free (incl. guest) | VIP |
|---|---|---|
| Create | 10 tournaments per rolling 30 days (same number as hosted rooms) | no monthly cap |
| Participants | up to 32 | up to 128 (bracket), 32 (league) |
| Retention | 30 days after the last update | 180 days after the last update |
| History | listed in the account History tab (logged-in accounts) and on the tournament page, can resume open rooms | same |

These numbers are proposals (constants at the top of `tournament-create`).
Everyone also has a sanity cap of 200 non-expired tournaments.

Whoever creates it is the owner (`owner_id`); only the owner records or edits
results (Edge Functions check it). The page URL is `?t=<uuid>`.

## Inactivity: the room closes after 30 minutes

Same rule as the games (`ROOM_INACTIVITY_TIMEOUT_MINUTES = 30`). A tournament is
**closed** when `status = 'active'` and `last_activity_at` is older than 30
minutes. Closed is derived (no cron needed): the database only stores
`last_activity_at`.

- Activity = a result recorded or corrected, or the organizer touching the
  page (any pointer/key/scroll, throttled to one `tournament-touch` call every
  5 minutes). Opening the page as owner also counts, which is how the owner
  "returns to the room" from History while it is still open.
- Closed does not delete anything: everybody can still view it and save the
  image, but `tournament-record-result`, `tournament-edit-result` and
  `tournament-touch` answer `409 tournament_closed`. A closed room is not
  reopened.
- Finished tournaments are never "closed" and can still receive corrections
  (public log) until they expire.
- Trade-off to be aware of: a league that takes days will close at the first
  30-minute gap in the organizer's activity. If that hurts real use, the
  natural next step is a VIP-only "keep open" switch.

## Viewer cap (connections)

`LIVE_VIEWER_CAP = 100` per tournament (constant at the top of `host.js`).
Every viewer joins a Presence channel with `{role:'viewer', ts}`. Rank is
computed from `ts` (ties broken by presence key). Decided once, at join. Rank
above the cap: the viewer leaves the channel (frees the connection) and sees a
snapshot refreshed by plain requests every 45 s or by a Refresh button, with a
discreet notice.

Known limit: Presence rank is a client-side decision, not a server-enforced
quota. Same level of trust as the other client-side limits (see Open Items).

# Result image

The "Save image" button (visible to everyone, owner or viewer) draws the result
on a canvas, with no library and no external request, using the active theme's
colors and fonts: tournament name, status, champion(s), and then the bracket
(main, losers route, final/rematch) or the league table. Reads straight from
the loaded state. On phones that support the Web Share API it opens the share
sheet (save to photos, WhatsApp...); elsewhere it downloads a PNG. The theme
logo is intentionally not drawn: a logo from another origin would taint the
canvas and block export.

# Engine

`supabase/functions/_shared/tournamentEngine.js` is the single source of truth.
It is pure (no DOM, no network): state in, new state out. **The same file** is
copied to `ndquest/tournament/assets/js/tournament-engine.js` for the browser.
If you change one, copy it to the other (they must stay byte-identical; check
with `cmp`). It publishes `globalThis.TournamentBracketEngine`, so it uses no
`import`/`export` and loads both as a classic script and as a Deno side-effect
import.

State: `{ mode, config, participants[{id,name,seed}], matches[] }`.

## Bracket

- `size = nextPowerOf2(n)`, `byes = size - n`. Participants are shuffled (when
  "randomize" is on) and placed with classic seed order (1 vs size, 2 vs
  size-1...). Byes therefore land on different matches, spread over the bracket,
  and a bye never meets another bye. Bye matches get `status = 'bye'` and the
  player is already in round 2.
- Matches are wired with `next_match_id` / `next_slot` (`a`/`b`).
- No draws in a bracket (`tie_not_allowed`).

## Losers route (`config.losers_mode`)

- `none`: single elimination.
- `separate`: two champions (main and losers).
- `final`: after both finish, the losers champion faces the main champion in a
  `final` match. `config.final_rematch` (default **on**, only meaningful in this
  mode): a `final_rematch` is created **only if the losers champion wins the
  first final**. Otherwise whoever wins the final is champion.
- Needs at least 3 participants (forced to `none` below that).

How the losers route is built: **incrementally, by order of arrival**. Every
finished main match produces a "loser arrives" event; every finished losers
match produces a "winner arrives" event. Events are ordered by
`finished_seq` and paired two at a time as soon as two are waiting, creating a
`losers` match (`a_src`/`b_src` remember which match each player came from).
When the main bracket is done, no losers match is pending and exactly one event
is waiting, that player is the losers champion. With N players there are always
N-1 events and N-2 losers matches. Trade-off, by design: with an odd number
waiting, someone rests until the next arrival; pairing is not "fair seeding",
it is arrival order. The create form says so in a muted note.

## League

- Circle method, phantom team when the count is odd (that team rests the
  round). `double_round` appends the return leg with home/away swapped.
- Draws allowed. Points `win 3 / draw 1 / loss 0` (stored in `config.points`,
  defaults used today, no UI to change yet).
- **Standings are never stored.** `computeStandings` runs on read. Sort: points,
  goal difference, goals for, then name. Equal on all three shares the rank
  (1, 1, 3). Champion = first row when every match is done.

## Results and edits

- `applyResult`: only for a `ready` match. Advances the winner, then
  `syncDerived` creates losers matches, the final and the rematch as needed.
- `editResult`: only for a `done` match.
  - Same winner (score-only change) or league: always allowed.
  - Winner flips: allowed only if **no dependent match was already played**
    (`downstream_played` otherwise). Unplayed dependents get the new participant
    in place; the final/rematch are created or removed to stay consistent.
- `summarize` always derives `status`, `champion_id`, `losers_champion_id` from
  the matches.

Stress tested before delivery: bracket sizes 2 to 128 across all four configs
(single, separate, final, final+rematch) with random play-outs and random edits
(every run finished, byes = size-n, N-2 losers matches, nobody loses twice in
the losers route, rematch only when it should exist), and leagues from 2 to 32
participants single/double (every pair exactly once, nobody twice in a round,
points add up, draws share rank).

# Database

SQL is delivered in the chat (not stored in the repo); run it once in the SQL Editor.

- `tournaments` (owner, name, mode, config jsonb, status, champions,
  `version`, `expires_at`)
- `tournament_participants`
- `tournament_matches` (same columns as the engine fields). **No foreign keys
  between matches on purpose**: matches are written in one batch and insertion
  order must not matter.
- `tournament_edit_log` (append-only, public)

RLS: public `select` (only while `expires_at > now()`); the only direct write
right is the owner deleting their own tournament. There is no insert/update
policy, so nothing can be written from the browser. All writes go through Edge
Functions with the service role.

`tournament_apply_changes(...)` (SECURITY DEFINER, executable only by
`service_role`) writes in one transaction: locks the tournament row, checks
`version` (optimistic lock, `version_conflict` if someone else wrote first),
deletes/upserts matches, appends the log, bumps `version` and
`expires_at = now() + 180 days`. Two simultaneous clicks cannot corrupt a
bracket.

Weight: a 128 bracket is 127 match rows, a 32 double league is 992.

Retention: `expires_at` is set on every write (30 days Free, 180 VIP).
`tournament_cleanup_expired()` deletes expired tournaments and is scheduled with
`pg_cron` (job `tournament-cleanup`, daily 03:17 UTC). Until it runs, expired
tournaments are already invisible through RLS.

# Edge Functions

All use `withCallerAuth` (`_shared/tournamentAuth.ts`): any valid session,
anonymous included, and it reports `isAnonymous` and `isVip` (VIP only for real
accounts). Shared helper `_shared/tournamentStore.ts` loads state, diffs
before/after and calls `tournament_apply_changes`.

- `tournament-create`: body `{name, mode, participants[], config, shuffle,
  theme_name}`. The **server builds** the bracket with the engine. Applies the
  Free/VIP limits above and sets `expires_at`. `theme_name` is stored in `config`.
- `tournament-record-result`: first result of a ready match. Owner only,
  rejects closed rooms.
- `tournament-edit-result`: corrections. Owner only, rejects closed rooms,
  writes `tournament_edit_log` (old/new score and winner, optional reason up to
  200 chars). Errors map to HTTP codes (`downstream_played` 409, etc.).
- `tournament-touch`: owner's activity heartbeat (see Inactivity).

# Theme (company theme)

Same mechanism as Roulette: static default theme plus remote themes from
`custom_themes` through `ndquest-get-themes` with `game_slug = 'tournament'`.
So a VIP/admin theme must include **Tournament** in "applicable games" (checkbox
added in the VIP theme form in `account/index.html` and in the admin grant-theme
form in `admin/index.html`). Only the theme **name** is stored with the
tournament (stored as `config.theme_name`, viewers resolve it by name);
viewers resolve it by name, falling back to the default if they cannot see it
(for example a private theme), exactly like Roulette rooms.

# Deploy

1. Run the SQL (the SQL given in the chat is the full schema for a fresh
   database; an existing database needs the migration that adds
   `last_activity_at` and the new `tournament_apply_changes` signature).
2. Deploy the functions:
   ```
   npx supabase functions deploy tournament-create
   npx supabase functions deploy tournament-record-result
   npx supabase functions deploy tournament-edit-result
   npx supabase functions deploy tournament-touch
   ```
3. Front-end files need no deploy.

# Open Items

- Limits (Free 10 per 30 days, 32 participants; viewer cap) are client or
  per-function constants, same gap documented in `VIP_TIER_ARCHITECTURE.md`. The
  Presence cap is not server enforced.
- 30-minute closing vs long leagues (see Inactivity trade-off).
- League draw/points rules are fixed at 3/1/0 with the tie-breakers above, no UI
  to change them yet (the engine already reads `config.points`).
- Saved tournaments do not yet offer "rename" or "transfer".
