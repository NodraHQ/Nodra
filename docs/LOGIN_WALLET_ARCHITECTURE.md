# Nodra Login, Wallet & Payout Architecture

Version: 1.0
Status: Approved for build, not yet implemented
Last Updated: August 2026

---

# Purpose

This document defines the official architecture for login, wallets, badges, and prize
payment across Nodra. It exists because these decisions took a long back-and-forth to
reach, several early ideas were deliberately reversed, and the reasoning behind the
final choice matters as much as the choice itself.

If a future session touches login, wallets, badges, or payment, read this document
first. Do not re-derive the architecture from the code alone, and do not assume an
idea explored earlier in the project's history (embedded/custodial wallets, Stellar as
base chain, cross-chain bridging) is still the plan — it was explicitly reversed. See
"Rejected Approaches" below before reintroducing any of it.

Any implementation that violates this document should be considered incorrect.

---

# Core Principle: Nodra Never Has Custody

This is the single rule everything else in this document exists to protect.

Nodra never holds a private key on anyone's behalf, never holds user funds even in
transit, and never has a wallet of its own capable of moving someone else's money.
Every on-chain action is signed by the wallet that actually owns the funds — the
player's, or the host's. Nodra's job is to calculate correct numbers and hand back a
ready-to-sign transaction (or a plain list, in manual mode) — never to execute a
transfer on anyone's behalf.

This has a direct product consequence: a user who never connects a wallet can still
play, host, and rank — they just can't receive a badge or an automated on-chain prize
until they do.

---

# Rejected Approaches (do not reintroduce without a new discussion)

These were seriously explored and explicitly abandoned. Keeping them here so a future
session doesn't rediscover them and assume they're still live options.

- **Embedded/custodial wallets (Privy, Dynamic, etc.)**, where login by email or
  Google would silently generate and manage a wallet for the user. Rejected because
  it puts Nodra in the custody business — exactly what the Core Principle above
  forbids. Login and wallet are now fully separate: login proves identity, wallet
  connection is a distinct, explicit, user-owned step.
- **Stellar as a fixed base settlement chain**, with cross-chain bridging (Circle
  CCTP, Allbridge) so deposits/withdrawals from any chain would land as Stellar-native
  assets. Rejected in favor of: the host picks whatever chain they want per event, no
  bridging, no chain conversion. v1 hardcodes that chain to Avalanche (see below), but
  the architecture is chain-per-event, not chain-fixed-forever.
- **Nodra choosing the payment chain.** The host chooses, when organizing the event.
  Nodra only calculates the split on top of whatever the host configured.

---

# Login

Login uses **Supabase Auth** (the same Supabase project NDQuest's game rooms already
run on) — email/password or Google. No new backend service.

## Site URL and Redirect URLs (Supabase Authentication → URL Configuration)

- **Site URL** must be the real production domain: `https://nodrahq.com`. Never point
  this at a Codespaces preview URL or `localhost` — Site URL is also used in
  transactional email templates, so it needs to be the real thing.
- **Redirect URLs** is a list, not a single value — add entries here, don't replace
  Site URL to make local testing work. At minimum: `https://nodrahq.com/**` plus
  whatever you're testing from.
- **Known annoyance, not a bug:** a GitHub Codespaces preview URL is not stable — it
  changes every time the Codespace is recreated, so the entry in Redirect URLs needs
  to be re-added each time. If this gets old, run the site with `python3 -m http.server`
  on your own machine instead — `http://localhost:PORT` stays fixed, so it only needs
  to be added to Redirect URLs once, permanently, instead of every session.

## Email rate limit (default Supabase SMTP)

Every new Supabase project ships with a shared SMTP provider for sending
confirmation/magic-link emails — fine for a handful of real signups, but its limit is
low enough that a few minutes of manual testing (creating and deleting test accounts
repeatedly) hits it fast. When that happens, signups can silently fail to send their
confirmation email, which then shows up later as a confusing "Invalid login
credentials" on the account's first sign-in attempt — the account exists, it's just
stuck unconfirmed with no way to confirm it.

- **While testing:** turn off Authentication → Providers → Email → **Confirm email**.
  No email needs to send at all, so there's nothing to rate-limit. Fully reversible.
- **Before real production traffic:** configure a real SMTP provider (Resend,
  SendGrid, Postmark, etc.) under Authentication → Emails → SMTP Settings, and turn
  Confirm email back on. Do this before launch, not after — the default provider isn't
  meant for production volume either.

Login is **optional and feature-gated**, not required to use Nodra:

- Playing a game: never requires login, exactly as it works today (session nickname).
  A player who wins without being logged in gets paid manually — the host types their
  address in at payout time. Nothing is saved for that player.
- Hosting a game with no prize and no badge involved: never requires login, exactly as
  it works today.
- Hosting a game that will distribute a badge and/or an on-chain prize: **requires
  login**. This is what gives the room a `host_id`, which is what makes the
  restricted-visibility rule below enforceable.

---

# Profile

One `profiles` table, extended from the login identity, with two distinct visibility
layers. Do not merge them into a single access level — they were deliberately split.

## Public layer (visible to any logged-in user)

- `username` (chosen by the user, unique — this is what a profile URL is keyed on,
  e.g. `nodra.xyz/perfil/<username>`)
- `x_handle`, `telegram_handle`, `instagram_handle` (free text for now, not
  OAuth-verified)
- Badges earned

## Restricted layer (visible only to the profile's owner, and to the host of the
specific event a given line item belongs to)

- `wallet_evm` (see "Wallets" below — the only wallet field in v1)
- What the user won, per event, and from which host/room

A host seeing a restricted line does **not** imply they can see any other host's data
about the same user — the restriction is scoped per event, not "any host can see
anyone's earnings."

## Deferred for later expansion

- `wallet_solana`, `wallet_stellar` — intentionally left out of the v1 schema, not
  just unused. Add them back only when multi-chain payout is actually being built,
  not preemptively.

---

# Wallets

Wallet connection is a separate, explicit action from login — never automatic.

**v1 uses a single wallet-connect surface: Reown AppKit** (formerly WalletConnect),
covering EVM chains including Avalanche. This is the only kit in v1. The earlier plan
to also integrate Stellar Wallets Kit is deferred along with Stellar itself — do not
add it until Nodra actually supports a non-EVM chain again.

Connecting a wallet fills `wallet_evm` automatically; the field remains manually
editable afterward (a user can paste a different address without connecting).

---

# Chain: Avalanche, full, v1

Both badge minting and prize payment happen on Avalanche in v1. This was a deliberate
simplification, not a technical limitation — see "Rejected Approaches" for what was
considered and dropped in favor of this.

The architecture is still conceptually **chain-per-event** (the host picks the chain
when organizing an event) — v1 just has exactly one option on that menu. When a second
chain is added, the per-event chain choice and its corresponding wallet-connect kit
need a real selection UI, which doesn't exist yet because it was never needed with
only one option.

## Multisend caveat (for whenever a second chain is added)

Not every chain supports "one transaction, many recipients, different amounts"
equally well or equally cheaply. Some chains need an auditable multisend contract to
do this in one signature; without one, the host signs once per winner. This did not
block v1 (Avalanche handles it acceptably), but must be checked again, per chain,
before any new chain is added — do not assume it "just works" everywhere.

---

# Badges

Badge eligibility is proven by a **signed voucher**: when the host grants a badge to a
player, the backend signs an attestation ("wallet X may mint badge Y"). The mint
transaction itself checks that signature before allowing the mint to succeed. This is
what prevents anyone from self-minting a badge they didn't earn — the mint being
user-signed does not mean the mint is unrestricted.

The host has **two options at grant time**, both valid, host's choice per player:

- **Mint now** — the host signs the mint transaction immediately (alongside payment,
  same screen). The badge is minted on the spot.
- **Make available** — the backend marks the voucher as pending/claimable. The player
  sees it on their own profile and mints it later, whenever they want, with their own
  wallet and their own signature.

## Gas, v1

There is no gas sponsorship in v1. A player minting their own badge via "make
available" needs to already hold a small amount of AVAX to pay the network fee — this
is a known, accepted rough edge for v1, not an oversight. Sponsoring this later would
require an ERC-4337 smart account + paymaster setup, which is real infrastructure work
and was explicitly deferred, not silently skipped.

## Marketplace note

Because badges are minted directly to the player's own external wallet (never
custodied by Nodra), they're ordinary NFTs on whatever chain they're minted on and can
be traded on that chain's existing official marketplaces — Nodra does not need to
build one. This is a real advantage of the no-custody model and a legitimate factor
(alongside cost/speed) when a future chain choice is evaluated.

---

# Prize Payment (Split Payment)

Nodra calculates; the host executes; Nodra never touches the money.

The host configures the payout the same way Quest Drop already works today (budget,
weight or fixed mode, largest-remainder rounding — see `NDQUEST_ARCHITECTURE.md`'s
Prize Distribution section, unchanged). What's new is what happens after the ranking
is final:

- **Direct** — Nodra builds a ready-to-sign transaction with every winner's address
  and correct amount already filled in. The host signs once with their own connected
  wallet. Money moves directly from the host's wallet to each winner's wallet.
- **Manual** — Nodra hands the host a plain list (address, amount, per winner). The
  host pays however they want, outside of Nodra entirely. Nodra records that this list
  was generated and that the room reached a "paid" state, but does not build or track
  individual transactions in this path.

If a winner has no `wallet_evm` on file (or, in a future multi-chain world, a wallet
on a different chain than the one the host chose), there is no automatic fallback.
The host can type an address in manually at payout time if they choose to; Nodra does
not try to guess or reconcile a mismatch.

## End-of-game flow (current game, to be generalized to the others later)

```
Final do jogo
  -> Ranking final
  -> Lista de players (nome + wallet cadastrada, se houver) com botão de pagar
  -> Host confirma 1 a 1 ou por bulk
       (nesta mesma etapa, host pode conceder badges: mintar agora ou disponibilizar)
  -> Player recebe o valor
```

This flow is being built for the game that already has the prize/envelope system
(Quest Drop). Extending the same payout configuration to the other games (Time
Attack, Show Down, Tap Rush, Roulette) is explicitly out of scope for now — do not
propagate it during this build. Revisit as a separate, later task.

---

# Rooms & Host Scoping

Game rooms gain a `host_id`, populated only when the host is logged in (i.e., only
when the room will involve a badge or an on-chain prize — see "Login" above). This is
what the restricted-profile-visibility rule checks against: a user can see a winner's
`wallet_evm` and per-event earnings only if they are that profile's owner, or the
`host_id` of the room that earning came from.

A room's payout chain, badge grants, and payment records are build-time schema
decisions, not product decisions — they were intentionally left for implementation
time rather than specified here in detail.

---

# Data Retention

A host's room list, and the associated winner/payout lists (including rooms paid
manually), are kept on the host's profile for a limited window, not indefinitely:

- Default: 30 days.
- VIP: 6 months.

This needs a scheduled cleanup job, not just a UI that hides old data — the retention
window is a real deletion policy, and it is one of the first concrete pieces of value
tied to VIP status (see the product roadmap for the rest of the VIP perks).

---

# Scope Discipline (additions specific to this feature)

- Do not build multi-chain payout (`wallet_solana`, `wallet_stellar`, a chain-picker
  UI, a second wallet-connect kit) preemptively. Wait until it's actually requested.
- Do not build gas sponsorship for self-minted badges preemptively. v1 accepts that
  friction on purpose.
- Do not propagate the end-of-game payout flow to games other than the one it's built
  for first, even though it's an obvious future need — that's a separate task.
- Do not reintroduce embedded/custodial wallets or Stellar-as-base-chain without a new
  explicit discussion — see "Rejected Approaches."

---

# Public Repository Discipline

The repository is edited and published directly on GitHub. Nothing about "the repo
being private" can ever be part of how user data stays protected — it isn't private,
and any code committed here is visible to anyone. This section exists to keep that
fact from ever becoming a data leak.

## What's safe to commit (by design, not by luck)

- The Supabase **publishable/anon key** and project URL. These are meant to be public
  — they identify which project a request talks to, they don't grant access on their
  own. The actual access boundary is Row Level Security on the tables behind them.
- The Reown **Project ID**. Same category — a public client-side identifier, not a
  secret.
- Full SQL schema, including table/column names and RLS policy definitions. Knowing
  the shape of the database is not the same as being able to read data out of it, as
  long as the RLS policies are actually correct — schema secrecy was never the
  defense, RLS was.

## What must never be committed

- A Supabase **service role / secret key**, or any key whose name contains "secret"
  or "service_role". These bypass RLS entirely — if one of these ever ends up in a
  commit, it must be rotated in the Supabase dashboard immediately, not just removed
  from the file (git history keeps it, deleting the file after the fact does not).
- Google OAuth client secret, or any provider's client secret. These belong only in
  Supabase's own Authentication → Providers settings, never in a repo file.
- Any real user data — a test account's real email, an actual wallet address used for
  debugging, exported rows from `profiles`. Test with throwaway values only, and never
  paste real query results into a file that gets committed.

## Why RLS is the actual defense, not git

Because the anon key is public, **anyone can send requests directly to the Supabase
API using it**, without ever going through the Nodra UI. This isn't a hypothetical —
it's the normal, expected way client-side apps talk to Supabase, and it's exactly why
`profiles` has real RLS (see `account/supabase-setup.sql`) instead of being open like
the game-room tables: `wallet_evm` and future per-event earnings data must stay
inaccessible even to someone hitting the API directly with dev tools, using nothing
but the same public key that ships in this repo. If a future table holds anything
sensitive, it needs real RLS from the moment it's created — "no one will think to
query it" is not a policy, and "the repo has some private folders" does not apply to
data that already left the repo and lives in the database.

---



# Open Items (known, deliberately deferred, not forgotten)

- Wallet auto-reconnect on a fresh account: if a wallet extension is already
  connected in the browser (from a previous session/account), `subscribeProvider`
  currently saves it automatically to whichever account is logged in, with no
  explicit click required. Flagged as worth changing to require an explicit
  "connect" action every time, even if the browser wallet is already connected —
  not fixed yet, deliberately deferred.
- Exact table schemas (room payout-chain config, badge/payment grant registry) —
  build-time detail, decide during implementation.
- Multi-chain payout (Solana, Stellar, others) and the chain-picker UI that would come
  with a second option.
- Gas sponsorship for player-initiated badge minting.
- Rolling the end-of-game payout flow out to Time Attack, Show Down, Tap Rush, and
  Roulette.
- Badge chain is fixed to Avalanche alongside payment for v1; if badges and payments
  ever need to live on different chains, the "host connects one wallet" assumption in
  the payout screen needs revisiting (may need two separate wallet connections on the
  same screen).

---

# Final Principle

No custody, ever — every other decision in this document is either a direct
consequence of that rule or an explicit, temporary simplification for v1 that trades
completeness for shipping something real before the event. Where this document says
"deferred," that means genuinely not built yet, not "quietly worked around."
