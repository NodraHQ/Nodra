# Nodra Frontend Conventions

A living list of site-wide UI/UX rules, decided once and applied incrementally as
files get touched — not a batch rewrite. If a page hasn't been updated to match a
rule here yet, that's expected; update it when you're already working in that file,
not as a standalone sweep.

---

## Logo click behavior

Every page has a brand logo (Nodra, or a module's own logo — NDQuest, Academy,
About). Clicking it:

- **Inside a module, on any page that is NOT that module's own landing page** (e.g.
  a game's host or play screen inside `ndquest/`, a lesson page inside `academy/`):
  the logo links to that **module's own landing page** (`ndquest/index.html`,
  `academy/index.html`, `about/index.html`).
- **On a module's own landing page itself** (e.g. `ndquest/index.html` itself): the
  logo links to the **root Nodra landing page** (`/index.html`).
- **On the root Nodra landing page itself**: the logo is not a link (already home).

This matches the general "logo goes up one level, and up again if you're already at
the top of that level" pattern used elsewhere on the web — nothing exotic, just
applied consistently.

Rolled out to: Time Attack (`ndquest/time-attack/play/index.html`, August 2026). Not
yet rolled out everywhere — update other pages' logos to this rule as you're already
touching them for something else, per the note above.
