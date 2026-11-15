# Third-party notices

Everything in this repository is MIT-licensed (see `LICENSE`) except the components listed below, which keep
their own licenses. Each row records where the component came from and what its license allows.

Status legend: **OK** (license allows redistribution here) · **CHECK** (unclear, needs written confirmation) ·
**REMOVED** (license forbids redistribution; no longer in the tree, see `IMPROVEMENT_ROADMAP.md`, decision D2;
`stage-fonts` picks these up from the user's own font folders or `NM_FONTS_DIR`).

## Code and engines

| Component | Path | License | Copyright | Status |
|---|---|---|---|---|
| anatomy isometric engine | `resources/engine/anatomy/` | MIT (`resources/engine/anatomy/LICENSE`) | 2026 Ryan | OK |
| frontend-slides layout presets (23 presets the editor's layout panel offers, from a modified copy of zarazhangrui/frontend-slides) | `resources/layout-presets/` | MIT (`resources/layout-presets/LICENSE`) | 2025 Zara Zhang | OK; upstream commit not recorded. The rest of the bundle was removed in roadmap NM-21 (decision D4) |
| Twelve compositions ported from those presets (ledger, keynote, stat-strip, ledger-list, meridian, chapter, plate, triptych, monolith, terminal, staircase, waypoint) | `resources/engine/nm-runtime/nm-layout.css` | MIT, attribution in the file | 2025 Zara Zhang | OK; rewritten (logical properties, no Tailwind) |
| GSAP | not included | GreenSock's own license | — | **Not bundled**. `nm-gsap.js` (MIT, this repository) is an adapter that uses `window.gsap` only if a deck loads it itself |
| Temml 0.14.0 (TeX to MathML; optional, staged only by `stage-runtime --math` or a plan with TeX) | `resources/engine/nm-runtime/vendor/temml.min.js` | MIT (`resources/engine/nm-runtime/vendor/temml.LICENSE.txt`) | 2020 Ron Kok | OK; unmodified `dist/temml.min.js` from the npm package, sha256 `56b43381…66af9d` |

## Fonts (`resources/fonts/`)

License text read from each file's OpenType `name` table (IDs 13 and 14).

| Family | Files | License stated in the font | Status |
|---|---|---|---|
| IBM Plex Sans Arabic | `IBMPlexSansArabic-{Regular,Medium,SemiBold}.ttf` | SIL Open Font License 1.1 · © 2019 IBM Corp. | OK |
| Readex Pro | `ReadexPro-VF.ttf` | SIL Open Font License 1.1 · © 2019 The Readex Pro Project Authors | OK |
| MT Alkhalil (Kufi) | `Alkhalil-Kufi.otf` | "OFL FREE OPEN SOURCE" (no full OFL text in the file) · © Mahbara / MT Type Foundry | CHECK (ask the foundry for the OFL text) |
| Setabr Display | `SetabrDisplay-Regular.otf` | Sakk Type Free Font License 1.0: redistribution allowed only for the original, unmodified files *together with the license* | CHECK (ship the license file next to the font) |
| Qahwa Arabic | `Qahwa-Arabic-Black.otf` | "Completely free, for both personal and commercial use" · "All Rights Reserved" (redistribution not stated) | CHECK |
| Zain Rounded | `ZainRounded-VF.ttf` | "eula or whatever" (no usable license) | CHECK |
| KOMission | `KOMission-Black.otf` | none in the file · designer Ahmed Hafez | CHECK |
| Thmanyah Sans / Serif Display / Serif Text | (was `thmanyah*.otf`, 15 files) | Thmanyah Font License: **forbids** redistributing, uploading or hosting the files on any website, server or platform; downloads only from the official Thmanyah site | **REMOVED** |
| ZIAN | (was `ZIAN-VF.ttf`) | "ALL RIGHTS RESERVED, to buy commercial version contact us" · © 2026 MUQLA FONTS | **REMOVED** |

Decks staged with fonts from the user's own folders contain those font files in `assets/fonts/`; they are
licensed to that user and the folder should not be published.

Removing files from the current tree does not remove them from git history. If a rights holder asks, history
must be rewritten by the repository owner.

## Example images

`examples/showcase/assets/img/` images are generated locally and recorded in `credits.json` (CC0).

## Projects studied for ideas only (no code or text copied)

| Project | License |
|---|---|
| emilkowalski/skills | MIT |
| greensock/gsap-skills | MIT (the GSAP library itself has its own GreenSock license and is not bundled) |
| nicobailon/visual-explainer | MIT |
| anthropics/skills (frontend-design) | Apache-2.0 |
| thedanielmay/visual-review-skill | no license file (all rights reserved); ideas only |
| archlizheng/frontend-slides-editable | MIT |
