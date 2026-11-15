# Third-party notices

Everything in this repository is MIT-licensed (see `LICENSE`) except the components listed below, which keep
their own licenses. Each row records where the component came from and what its license allows.

Status legend: **OK** (license allows redistribution here) · **CHECK** (unclear, needs written confirmation) ·
**REMOVE** (license forbids redistribution; scheduled for removal, see `IMPROVEMENT_ROADMAP.md`, decision D2).

## Code and engines

| Component | Path | License | Copyright | Status |
|---|---|---|---|---|
| anatomy isometric engine | `resources/engine/anatomy/` | MIT (`resources/engine/anatomy/LICENSE`) | 2026 Ryan | OK |
| frontend-slides (vendored, modified copy of zarazhangrui/frontend-slides) | `resources/engine/frontend-slides/` | MIT (`resources/engine/frontend-slides/LICENSE`) | 2025 Zara Zhang | OK; differs from upstream, upstream commit not recorded |

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
| Thmanyah Sans / Serif Display / Serif Text | `thmanyah*.otf` (15 files) | Thmanyah Font License: **forbids** redistributing, uploading or hosting the files on any website, server or platform; downloads only from the official Thmanyah site | **REMOVE** |
| ZIAN | `ZIAN-VF.ttf` | "ALL RIGHTS RESERVED, to buy commercial version contact us" · © 2026 MUQLA FONTS | **REMOVE** |

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
