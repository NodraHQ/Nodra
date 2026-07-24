# Nodra Academy Architecture

Version: 2.0
Status: Stable
Last Updated: July 2026

---

# Migration Note (v1.0 to v2.0)

Nodra is growing beyond the Academy. Community, Games, Labs and Tools are planned as independent verticals, each living at the repository root next to academy/.

Version 1.0 of this document assumed a single shared assets/ and translations/ folder at the repository root, used by both the Academy and the Nodra home page.

That model does not scale once multiple verticals exist: a single shared folder means changing one vertical (for example, swapping a logo in Games) risks touching files another vertical (Academy) depends on, and a single translation file grows without bound as verticals and modules are added.

Version 2.0 compartmentalizes the Academy: it becomes fully self-contained, with its own assets/ and translations/ living inside academy/ itself. The Nodra home page (the root index.html) is likewise self-contained, with its own assets/ and translations/ at the repository root. Future verticals (community/, games/, etc.) follow the exact same self-contained pattern.

Nothing in this migration changes the visual identity, behavior, HTML structure, CSS rules, JavaScript rules, quiz system, glossary system or any other rule in this document. It only changes where shared Academy resources physically live, and how Academy translations are split into files.

---

# Purpose

This document defines the official architecture of the Nodra Academy.

Its purpose is to ensure that every module follows the exact same structure, behavior and user experience.

All future implementations must respect these rules.

Any implementation that violates this document should be considered incorrect.

---

# Architecture Philosophy

The Academy follows a fixed architecture.

Content evolves.

Architecture does not.

Every module should feel like another chapter of the same course instead of an independent webpage.

Consistency is more important than creativity.

The Academy is also fully self-contained. It does not share assets, translations or JavaScript with the Nodra home page or with any other Nodra vertical. This is intentional: it must be possible to change the Academy without any risk of affecting Community, Games, Labs, Tools or the Nodra home page, and vice versa.

---

# Project Structure

The repository root contains one folder per Nodra vertical, plus the Nodra home page itself. Each of these is independent and self-contained.

Repository root:

academy/
community/ (future)
games/ (future)
labs/ (future)
tools/ (future)
assets/ (home page only)
translations/ (home page only)
index.html (Nodra home page)
docs/
README.md

The Academy owns everything it needs inside its own folder. Current structure:

academy/
academy/assets/
academy/translations/
academy/index.html
academy/01-blockchain/
academy/02-wallets/
...

No new top-level folders should be created inside academy/ unless explicitly requested.

No files should be created for the Academy outside of academy/, and no Academy file should depend on a path outside of academy/.

---

# Academy Modules

Each module is an independent page.

Each module has its own folder, inside academy/.

Example:

academy/

01-blockchain/

02-wallets/

03-networks/

04-assets/

...

Each module contains:

index.html

No additional HTML files should be created inside module folders unless explicitly requested.

---

# Academy Assets

All resources shared across Academy modules are located inside:

academy/assets/

academy/assets/css/

academy/assets/js/

Shared CSS (variables, components, academy-wide layout)

Shared JavaScript (translation engine, Academy-wide behavior)

Module-specific CSS

Module-specific JavaScript

Images, icons and fonts, if needed

These files are considered global to the Academy, and only to the Academy.

Global Academy files must never be modified unless explicitly requested.

Academy modules must reference these assets using paths relative to academy/, never reaching outside of academy/ (for example, never linking to a root-level assets/ folder).

The Nodra home page and any other Nodra vertical maintain their own separate assets/, and must never be referenced from inside academy/, and vice versa. A small amount of duplication (for example, variables.css existing both in academy/assets/ and in the root assets/) is expected and accepted, in exchange for each vertical being independently changeable.

---

# Translation System

Academy translations are centralized within the Academy, and only within the Academy.

Location:

academy/translations/en/

academy/translations/pt/

Inside each language folder:

shared.json contains strings used across the whole Academy: navigation, footer, and any other text that is not specific to a single module.

Each module has its own translation file, named after the module folder. Example:

academy/translations/en/01-blockchain.json

academy/translations/en/05-defi.json

academy/translations/pt/05-defi.json

Every module page loads shared.json plus its own module file for the active language. The translation engine is responsible for merging these into a single lookup table before applying data-i18n bindings.

Every module must use the same translation engine.

Never create a second translation system.

Never duplicate translation logic.

Never hardcode translatable text when translation keys already exist.

Never split a single module's translations across more than one file.

Never place Academy translation files outside of academy/translations/.

---

# Module Independence

Every module is independent.

Each module may contain its own:

CSS

JavaScript

Translation namespace

Quiz

Glossary

Examples

But all modules must behave consistently.

---

# User Experience

Every module must preserve the same experience.

Navigation

Sidebar

Table of Contents

ScrollSpy

Reading Progress

Language Switch

Quiz

Glossary

Previous / Next navigation

These elements must remain visually and functionally consistent across all modules.

---

# Visual Identity

The visual identity is frozen.

Do not redesign.

Do not introduce new visual styles.

Do not replace components.

Do not modify spacing rules.

Do not modify typography.

Do not introduce different animations.

Do not change colors.

Consistency has priority.

---

# HTML Rules

Every module must preserve:

Section hierarchy

Heading structure

Anchor IDs

Navigation IDs

Accessibility attributes

Existing component structure

Never redesign HTML.

Only replace content.

---

# CSS Rules

Global CSS is immutable.

Module CSS should only contain styles required by that module.

Never duplicate global styles.

Never modify variables unless explicitly requested.

Never create alternative themes.

---

# JavaScript Rules

Shared JavaScript is immutable.

Module JavaScript must only implement module-specific behavior.

Never duplicate global logic.

Never modify translation logic.

Never modify navigation logic.

Never modify reading progress logic.

Never modify ScrollSpy logic.

Never modify language switching.

---

# Translation Rules

Each module owns its own translation namespace, and its own translation file.

Example:

blockchain.* lives in academy/translations/{en,pt}/01-blockchain.json

wallets.* lives in academy/translations/{en,pt}/02-wallets.json

networks.* lives in academy/translations/{en,pt}/03-networks.json

assets.* lives in academy/translations/{en,pt}/04-assets.json

Future modules should follow the same pattern: one namespace, one pair of files (en and pt), named after the module folder.

Shared strings (navigation, footer, and anything not specific to one module) live in shared.json, under a shared namespace such as academyNav.* or footer.*. Never place module-specific strings inside shared.json, and never place shared strings inside a module's own file.

Never rename existing namespaces.

Never reuse another module's namespace.

Never merge two modules' translation files into one.

---

# Quiz System

Every module includes one quiz.

The quiz must follow the same interaction pattern used throughout the Academy.

Question flow

Feedback

Correct answers

Wrong answers

Progress

Completion

must remain identical.

---

# Glossary

Each module includes its own glossary.

Glossary entries must only explain concepts introduced inside that module.

Avoid duplicated definitions across modules whenever possible.

---

# Navigation

Every module contains:

Previous Module

Next Module

Navigation structure must remain identical throughout the Academy.

---

# Table of Contents

Every module includes a Table of Contents.

Every heading must appear correctly.

Every anchor must function.

Never change TOC behavior.

---

# Reading Progress

Reading progress is standardized.

Never redesign.

Never replace.

Never remove.

---

# ScrollSpy

ScrollSpy behavior is shared.

Never modify its logic.

Never replace its implementation.

---

# Responsive Design

All modules must support:

Desktop

Notebook

Tablet

Mobile

No module may intentionally break responsiveness.

---

# Performance

Avoid unnecessary JavaScript.

Avoid duplicated CSS within the Academy.

Avoid duplicated HTML structures.

Reuse existing architecture whenever possible.

This applies within the Academy's own assets. Duplication of shared files (such as variables.css) across different Nodra verticals is expected and accepted, since each vertical is self-contained by design.

---

# File Modification Policy

When implementing a new module, modify only the files that are strictly necessary.

Avoid touching unrelated files.

Avoid unnecessary formatting changes.

Avoid project-wide refactoring.

---

# Forbidden Changes

Do NOT:

Redesign layouts.

Change architecture.

Rename folders.

Rename translation namespaces.

Replace shared components.

Rewrite global CSS.

Rewrite global JavaScript.

Create alternative navigation systems.

Create a second translation engine.

Move project files.

Refactor unrelated modules.

Reference any file outside of academy/ from inside an Academy page.

Reference any file outside of the current vertical from inside another vertical's pages (Community must never reference Academy's assets, and vice versa).

Split a module's translations across more than one file, or merge multiple modules' translations into one file.

---

# Allowed Changes

You MAY:

Create a new module.

Create module-specific CSS.

Create module-specific JavaScript.

Add translation keys.

Add quiz content.

Add glossary entries.

Add illustrations.

Add educational content.

Improve explanations.

Fix implementation bugs.

---

# Final Principle

The Nodra Academy is a single product.

Every module should feel like another chapter of the same learning experience.

Architecture is permanent.

Content is replaceable.

Always preserve consistency over creativity.