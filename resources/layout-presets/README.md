# Layout presets (editor)

The 23 layout presets that Nevermind Studio offers in its layout panel (`editor/src/server/layout-presets.ts` reads
`<preset>/preview.html`). They come from a modified copy of zarazhangrui/frontend-slides (MIT, Copyright (c) 2025
Zara Zhang; `LICENSE` in this folder). The rest of that bundle was removed in roadmap NM-21 (decision D4).

Decks written by the skill do not use these files: twelve of the compositions were ported to `nm-layout.css` as
`nm-l-*` classes with logical properties for right-to-left slides (see `references/diagrams.md`, section 6).
