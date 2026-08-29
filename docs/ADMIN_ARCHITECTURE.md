# Nodra Admin Panel Architecture

Version: 1.0
Status: Approved for build, not yet implemented
Last Updated: August 2026

---

# Purpose

This document defines the architecture for Nodra's admin panel: live room visibility,
user management, VIP granting, badge granting outside the normal player/host flow, and
platform-wide analytics.

Read `docs/LOGIN_WALLET_ARCHITECTURE.md` first — the admin panel builds directly on
its login, profile, and RLS foundations, and reuses the same Supabase project.

---

# Core Principle: Every Admin Action Goes Through an Edge Function

Nothing in the admin panel — not reads, not writes — talks to Supabase directly with
the public anon key. Every admin operation, including ones that only display data
(live rooms, user list, analytics), goes through a Supabase Edge Function that:

1. Verifies the caller is signed in (checks their auth session).
2. Verifies the caller is an admin (looks them up server-side — see "Admin Identity"
   below).
3. Only then performs the read or write, using the service role key.

The service role key lives only in the Edge Function's environment, on Supabase's
servers. It is never sent to the browser, never appears in any file in this
repository, and is a different category of secret than the anon key — see
`LOGIN_WALLET_ARCHITECTURE.md`'s "Public Repository Discipline" section for why that
distinction matters given this repo is edited directly on GitHub.

This was a deliberate choice over a cheaper RLS-only alternative: an RLS policy bug is
directly exploitable by anyone with the (public, committed) anon key, with no need to
ever touch the admin panel's UI. Routing everything through Edge Functions means a bug
in the admin panel's client-side code can, at worst, get a request rejected — it
cannot leak data or grant privilege on its own, because the client never holds a key
capable of either.

---

# Admin Identity

Admin status lives in its own table, not as a column on `profiles`:

```sql
create table admins (
    id uuid primary key references auth.users(id) on delete cascade,
    granted_at timestamptz not null default now(),
    granted_by uuid references auth.users(id)
);
```

This table needs no RLS policy granting broad read access — it's checked only from
inside Edge Functions, using the service role key, which bypasses RLS by design. A
regular client (anon key) gets nothing from this table either way.

Keeping this separate from `profiles` (rather than an `is_admin` boolean column) means
admin status is never at risk of being accidentally exposed through the profile system
— `profiles_public`, or any future profile-read path, has no column to leak.

## Bootstrapping the first admin

The very first admin can't be created through the panel — there's no admin yet to
authorize it. The first row in `admins` must be inserted manually, once, via the
Supabase SQL Editor, for one trusted account. Every admin after that can be granted
through the panel itself (an "admin management" action, also gated the same way as
everything else).

---

# What the Panel Shows

- **Live rooms** — across all 5 NDQuest games (Quest Drop, Time Attack, Show Down, Tap
  Rush, Roulette). Reads the game-specific room tables (`time_attack_rooms`,
  `showdown_rooms`, etc.) directly from the Edge Function. This does not violate
  NDQuest's no-cross-import rule (`NDQUEST_ARCHITECTURE.md`) — that rule is about game
  *code* not depending on other games' files. The admin panel is its own, separate,
  self-contained area reading the same underlying Supabase project, the same way each
  game already does independently.
- **User overview** — list/search of profiles, VIP status, join date.
- **VIP granting** — toggle a user's `is_vip`.
- **Badge granting outside the normal flow** — the same signed-voucher mint mechanism
  from `LOGIN_WALLET_ARCHITECTURE.md`'s Badges section, just triggered by an admin
  instead of a host at end-of-game. Still "mint now" or "make available" — an admin
  isn't a third option, they're using the same two paths a host has.
- **Analytics** — both aggregate counts (total users, rooms created, badges minted)
  and engagement over time (signups/activity by day). Exact metrics and chart shapes
  are a build-time detail, not specified further here.

---

# Placement

The admin panel is a new, separate, self-contained top-level folder — `admin/` —
following the same pattern as `about/`, `account/`, `academy/`: its own assets, own
translations, no cross-imports from `ndquest/` or elsewhere.

The panel's own login reuses the same Supabase Auth session as `account/` (one login
across the whole site, per `LOGIN_WALLET_ARCHITECTURE.md`) — there is no separate
admin login system. On load, the panel calls an Edge Function to check admin status;
if the caller isn't an admin, it shows a plain "not authorized" state and reveals
nothing else, not even which parts of the panel exist.

---

# Audit Log

Every admin action writes a row to `admin_audit_log`, inside the same Edge Function
call that performs the action — not as an afterthought bolted on later:

```sql
create table admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references auth.users(id),
    action text not null,              -- e.g. 'grant_vip', 'revoke_vip', 'mint_badge'
    target_user_id uuid references auth.users(id),
    details jsonb,                     -- action-specific extra data (e.g. badge id)
    created_at timestamptz not null default now()
);
```

Like `admins`, this table needs no client-facing RLS policy — it's written and read
only from inside Edge Functions via the service role key. This was decided up front,
not deferred: an audit log only covers actions taken after it exists, so retrofitting
one later would leave a permanent gap for everything granted before it was added.

---

# Open Items (known, deliberately deferred, not forgotten)

- Exact list and signatures of the Edge Functions (one per action vs. a few
  multi-purpose ones) — build-time detail.
- Exact analytics metrics and chart types.

---

# Final Principle

The admin panel is the highest-privilege surface in Nodra — it can grant VIP, mint
badges outside the normal audit trail, and see any user's restricted data. It gets the
strongest protection in the codebase on purpose: the actual secret capable of doing
any of that never leaves Supabase's own servers.
