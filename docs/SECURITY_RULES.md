# Security rules

Rules that came out of the November 2026 security audit. Read before touching
the database, Edge Functions, or anything that renders another person's data.
The migration `supabase/migrations/20261109230000_security_hardening.sql` has the
full reasoning for each database change.

## The browser is untrusted

Everything in `assets/js`, `ndquest/*`, `account/*` and `admin/*` runs in the
visitor's browser with the publishable key plus their session token. Anyone can
open the console and call the same Supabase APIs with any values. Anonymous
guests in the games are also role `authenticated`.

- **RLS decides rows, not columns.** A policy like "user updates own row" lets the
  user change *every* column of that row. Sensitive columns need their own
  protection: column `GRANT`s (`profiles`) or a `BEFORE` trigger that ignores
  changes from `anon`/`authenticated` (`showdown_players.total_score`,
  `time_attack_players.correct_answers`).
- **New user-editable column on `profiles`?** Add it to both `GRANT insert (...)`
  and `GRANT update (...)`, or the update fails with "permission denied".
  Never grant `is_vip`, `vip_tier` or `vip_expires_at`.
- **Scores, VIP, badges, payments** only change through Edge Functions using the
  service role key.

## Edge Functions

- Anything only the room host may do calls `requireRoomHost()` from
  `_shared/gameAuth.ts`.
- One answer per question: Show Down relies on the unique index on
  `showdown_answers (player_id, question_index)` and must stop if the insert
  fails; Time Attack uses `time_attack_players.answered_question_ids`.
- Never return the correct answer while the question is still open.
- Payments: normalize the hash with `normalizeTxHash()`, and claim it with
  `claimTxHash()` (table `payment_tx_claims`) before granting anything. One
  transaction pays for one thing, across all products.
- Fields that end up inside someone else's HTML/CSS (badge colors, image URLs,
  theme logos) are validated with `_shared/inputValidation.ts`.
- RPC functions meant only for Edge Functions get
  `revoke execute ... from public, anon, authenticated`.

## Front-end

- Any text from another person (nickname, team, badge name, pack name) goes
  through `esc()` before entering `innerHTML`, or use `textContent`.
- Colors from the database go through `safeColor()`, CSS class fragments through
  `safeToken()`.
- `supabase-js` is pinned to an exact version with an SRI `integrity` hash. To
  upgrade, change the version in every HTML file and recompute the hash:
  `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`.
- `_headers` sets the Netlify security headers. The admin page has a strict CSP;
  a new external resource there must be added to it.
