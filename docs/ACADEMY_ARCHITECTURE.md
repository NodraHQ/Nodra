# Nodra Academy Architecture

Version: 1.0
Status: Stable
Last Updated: July 2026

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

---

# Project Structure

The project structure is immutable.

Current folders:

academy/
assets/
translations/

No new top-level folders should be created unless explicitly requested.

---

# Academy Modules

Each module is an independent page.

Each module has its own folder.

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

# Shared Assets

All shared resources are located inside:

assets/

Shared CSS

Shared JavaScript

Images

Icons

Fonts

Components

These files are considered global.

Global files must never be modified unless explicitly requested.

---

# Translation System

Translations are centralized.

Location:

translations/

Every module must use the same translation engine.

Never create a second translation system.

Never duplicate translation logic.

Never hardcode translatable text when translation keys already exist.

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

Each module owns its own translation namespace.

Example:

blockchain.*

wallets.*

networks.*

assets.*

Future modules should follow the same pattern.

Never rename existing namespaces.

Never reuse another module's namespace.

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

Avoid duplicated CSS.

Avoid duplicated HTML structures.

Reuse existing architecture whenever possible.

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