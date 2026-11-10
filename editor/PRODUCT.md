# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decided in the design doc (`docs/superpowers/specs/2026-11-10-slide-editor-design.md` §7): TypeScript, a local Node server (`node:http`, single bundled file), editor UI in Preact + signals, CSS with logical properties and design tokens, no Tailwind in the editor chrome. The deck being edited keeps its own Tailwind runtime inside an iframe.

## Users

People who used the `nevermind-slides` skill (an AI agent skill) to turn a paper or topic into an Arabic HTML presentation, and now need to change it. Mostly non-technical: researchers, trainers, officers, students. They work on a 13-14 inch laptop, often right before presenting, and want to fix a word, move an image, change a colour or reorder slides without asking the agent again.

## Product Purpose

Edit an HTML slide deck the way one edits a PowerPoint deck, and leave the file clean so the AI agent can keep working on it. Success: a non-technical user changes a title, moves an image and saves without instructions, and the saved file differs from the original only in the lines they touched.

## Positioning

The only editor that writes back into the deck's own source in the deck's own language (Tailwind utility classes, minimal line diffs), understands the skill's vocabulary (Morph pairs, camera zoom steps, anatomy figures, font pairings), and hands what it cannot do to the agent through pinned notes.

## Operating Context

- Started by the agent with one command (`nm-studio edit <deck.html>`), opens in the user's browser on 127.0.0.1.
- The agent and the user may edit the same file; the editor detects external changes.
- Decks are 1920x1080 fixed-stage, single HTML file, Arabic RTL, 5-18 slides, up to about 550 KB, with local fonts and assets.
- The previous tool the user knew is the open-slide inspector (a browser view with a side panel for colours, fonts and sizes). That is the baseline the editor must clearly beat.

## Capabilities and Constraints

- Phase 1 engine exists: 11 reversible ops, byte-identical undo, safe save with snapshots, lint.
- Interface language: Arabic and English, switchable. Arabic (RTL) is the default.
- Desktop browsers; Chromium is the tested target. No mobile editing.
- No accounts, no cloud, no real-time multi-user collaboration.

## Brand Commitments

- Carries the Nevermind identity: the skill's name and its signature type pairing, Thmanyah (Serif Display for display moments, Sans for UI text) and KOMission, both bundled with the skill.
- Zero emojis anywhere; all icons are bespoke SVG (a rule of the skill).

## Evidence on Hand

- Two real decks: `fixtures/real/attention/deck.html`, `fixtures/real/mechanistic/deck.html`, with screenshots in `spikes/s2-harness/shots/`.
- Fonts: `$HOME/.claude/skills/nevermind-slides/resources/fonts/`.
- No user testimonials, usage numbers or press exist; do not invent any.

## Product Principles

1. The deck is the hero; the chrome recedes and never competes with the slide's colours.
2. Every visible action maps to a clean edit in the file; nothing pretends.
3. What the editor cannot do well, it hands to the agent openly.
4. Arabic first: RTL layout, Arabic shortcuts that work on an Arabic keyboard, Arabic copy written natively, not translated.
5. Familiar to a PowerPoint user within a minute.

## Accessibility & Inclusion

Full keyboard operation of the chrome; visible focus; WCAG AA contrast for chrome text; respects reduced motion.
