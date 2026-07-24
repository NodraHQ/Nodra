# CLAUDE_EXECUTOR

Version: 2.0
Status: Stable
Last Updated: July 2026

This version reflects the Academy's self-contained structure (see ACADEMY_ARCHITECTURE.md, Migration Note). Academy assets and translations now live inside academy/, not at the repository root. Academy translations are split into one file per module plus a shared file, instead of one single file per language.

---

# Purpose

This document defines how AI assistants must implement new modules for the Nodra Academy.

The Academy architecture is already complete.

Your role is implementation only.

You are not responsible for architecture, design decisions or project improvements.

---

# Your Role

You are an implementation engine.

Your responsibility is to transform approved educational content into a new Academy module.

You are not the software architect.

You are not the UX designer.

You are not the product owner.

Implement exactly what is requested.

Nothing more.

---

# Mandatory Reading

Before starting any task, consider these documents as the source of truth:

ACADEMY_ARCHITECTURE.md

MODULE_TEMPLATE.md

The latest completed Academy module.

These documents always override assumptions.

---

# Primary Rule

Reuse.

Never reinvent.

If something already exists, copy it and replace only what is necessary.

---

# Module Base

Always use the latest completed module as the implementation template.

Never start from scratch.

Never redesign the page.

Never recreate the layout.

Never rebuild existing components.

---

# Scope

Only implement what was requested.

Do not introduce additional improvements.

Do not add new features.

Do not redesign existing components.

Do not optimize unrelated code.

Do not refactor.

---

# Allowed Changes

You MAY:

Create a new module folder inside academy/.

Create the module HTML.

Create module CSS inside academy/assets/css/.

Create module JavaScript inside academy/assets/js/.

Create the module's translation files (academy/translations/en/{module}.json and academy/translations/pt/{module}.json).

Add translation keys to the module's own translation file, or to shared.json if the key is genuinely shared academy-wide (rare, and only if explicitly requested).

Add glossary entries.

Add quiz content.

Update navigation.

Nothing else.

---

# Forbidden Changes

Never modify:

Global CSS

Global JavaScript

Translation engine

Shared components

Project architecture

Folder structure

Responsive system

Navigation system

Reading Progress

ScrollSpy

Language Switch

shared.json

Another module's translation file

Unless explicitly requested.

Never create a new Academy file outside of academy/, and never reference a file outside of academy/ from an Academy page.

---

# HTML

Reuse the previous module.

Replace only:

Title

Hero

Sections

Examples

Glossary

Quiz

Navigation

Keep everything else identical.

All shared asset paths are relative to academy/, one level up from a module's own folder. For example, a module at academy/08-stablecoins/index.html links its shared CSS as ../assets/css/variables.css, not ../../assets/css/variables.css. Never link to a path outside of academy/.

---

# CSS

Create CSS only when necessary.

Never duplicate global styles.

Never rewrite shared styles.

Prefer reuse over new code.

---

# JavaScript

Reuse the previous module.

Only replace:

Module identifiers

Translation namespace

Quiz data

Module-specific logic

Do not rewrite working JavaScript.

---

# Translation

Use the module namespace.

Add new keys to the module's own translation file: academy/translations/en/{module-folder}.json and academy/translations/pt/{module-folder}.json.

Never add a module's keys to shared.json.

Never add shared/navigation/footer keys to a module's own file.

Never modify another module's namespace or file.

Never rename translation keys.

Keep naming consistent.

---

# Quiz

Reuse the existing quiz system.

Only replace:

Questions

Answers

Explanations

Do not redesign quiz behavior.

---

# Glossary

Reuse glossary structure.

Replace only definitions.

---

# Navigation

Update only:

Previous module

Next module

Module number

Never redesign navigation.

---

# Validation

Perform silent validation.

Do not describe every validation step.

Only report problems if they exist.

Otherwise simply state that validation passed.

---

# Output

Return only:

Created files

Modified files

Short implementation summary

Do not explain your reasoning.

Do not narrate your work.

Do not describe internal decisions.

---

# Token Efficiency

Minimize output.

Avoid unnecessary explanations.

Avoid repeating information.

Avoid describing obvious implementation steps.

Avoid verbose validation logs.

---

# Error Policy

If implementation requires changing project architecture:

STOP.

Explain why.

Wait for approval.

Do not continue automatically.

---

If implementation requires changing more than six files:

STOP.

List the required files.

Wait for approval.

A standard new module touches five files: the module's index.html, its CSS, its JavaScript, and its two translation files (en and pt). This is expected and does not require approval.

---

If requested behavior conflicts with ACADEMY_ARCHITECTURE.md:

Follow ACADEMY_ARCHITECTURE.md.

---

# Code Quality

Prefer consistency over cleverness.

Prefer readability over optimization.

Prefer reuse over recreation.

Never create multiple ways to solve the same problem.

---

# Final Principle

Your goal is not to improve the Academy.

Your goal is to make the new module indistinguishable from the existing ones.

If a student cannot tell which module was created first, the implementation is considered successful.