# Deck plan: write the plan, let the tools build and check

Fill in `deck.plan.json`. The tools turn it into a deck skeleton and tell you what is wrong. Do not write motion code, navigation code or font rules by hand.

All commands: `python3 "<SKILL_DIR>/scripts/deck_helper.py" <command> ...`

## Workflow

1. `plan-init --target-dir DIR --title "العنوان" [--slides N] [--lang ar|en]` writes `DIR/deck.plan.json`. Without `--slides` you get the full 8-slide example (Arabic; English gets 8 stubs). With `--slides N` (5..24) you get N stubs in the chosen language.
2. Edit the plan. Keep headlines short, keep one idea per slide.
3. `plan-lint --plan DIR/deck.plan.json [--output report.json]`. Fix every error. Read every warning.
4. `scaffold --plan DIR/deck.plan.json [--out DIR/name-slides.html] [--force] [--tailwind]`. Refuses to run while plan-lint has errors. Also stages fonts and runtime into `DIR/assets/`.
5. Open the generated HTML. Each slide starts with a comment listing its remaining TODOs. Replace placeholders (`data-nm-todo`) with real content.
6. `audit-deck --html-path FILE`. Fix errors. Placeholders left in the deck show up as warnings.
7. `check --html-path FILE [--shots DIR] [--slides 1-5]`. Needs Node 20+ and Chrome. Exit code 2 means Node or Chrome is missing (not a deck problem). Read the contact sheet PNG and the per-slide table. Fix, rerun.
8. `open-files FILE` for the final look.

Other commands: `stage-runtime --target-dir DIR [--inline] [--math]` copies `assets/nm/` (use `--inline` for a paste-in `nm-inline.html`; `--math` adds the optional TeX converter for hand-written `data-tex` formulas, see `references/tables-and-equations.md`). `scaffold --force` regenerates only the output HTML (the old one is kept as `.bak`); assets and placeholder images are never overwritten.

## Plan shape

```json
{
  "title": "كيف يتعلّم الدماغ",
  "lang": "ar",
  "theme": { "preset": "paper" },
  "fonts": { "pairing": "thmanyah" },
  "mode": "morph-and-zoom",
  "image_source": "generate",
  "slides": [ { "id": "s1", "title": "الغلاف", "role": "cover", "layout": "cover",
      "visual": { "type": "image", "ref": "cover-brain", "query": "..." },
      "rel": "next", "transition": "auto", "morph": ["title"],
      "steps": [ { "act": "reveal", "target": "body1", "note": "..." } ],
      "text": { "kicker": "...", "headline": "...", "body": ["..."], "stat": { "value": "70%", "label": "..." } },
      "speaker_note": "..." } ]
}
```

| Field | Values |
|---|---|
| `lang` | `ar` (default: right to left, Arabic scaffolding) or `en` (left to right, English scaffolding, Western digits). The runtime takes its keys and its own labels from it. |
| `theme.preset` | `paper`, `mist`, `dune`, `olive` (light); `ink`, `night-sea`, `emerald`, `ember` (dark). Or custom hex tokens `paper ink muted line accent accent2 surface radius`. A preset plus overrides is allowed. |
| `theme.derive` | colours from the topic (NM-19): `{ "materials": ["ميناء", "بحر"], "mood": "calm", "pick": 1 }`. Empty materials: they are found in the plan (title, headlines, body, `content.entities`). `pick` chooses palette 1 (light), 2 (tinted by the second material) or 3 (dark). Explicit tokens still override. `theme-derive --plan FILE [--materials ...] [--mood ...] [--previews DIR] [--apply N]` shows the three. `plan-init` starts new plans from `derive`. The lexicon is data: `resources/templates/identity-lexicon.json` |
| `fonts.pairing` | `thmanyah` (default), `sans`, `qahwa`, `setabr`, `kufi`, `open`. A pairing whose fonts are not installed falls back to `open` (Readex Pro + IBM Plex Sans Arabic, bundled under OFL); Thmanyah and ZIAN must be installed by the user (`NM_FONTS_DIR` or the system font folders) because their licenses forbid redistribution. |
| `mode` | `morph-and-zoom`, `morph-only`, `classic` |
| `image_source` | `generate`, `web`, `none` |
| `role` | `cover section concept mechanism evidence comparison process quote summary closing` |
| `layout` | short names `cover section split split-rev hero stat cards compare diagram timeline quote center list`, or any real `nm-layout.css` composition: `title section split hero-figure figure-full bento-3..6 cards-2..4 rail quote stat-row compare steps` (table below) |
| `visual.type` | `anatomy image diagram chart motion table equation none` (tables and equations: `references/tables-and-equations.md`) |
| `visual.mode` | `static`, `animated` (required for anatomy) |
| `visual.diagram_type` | what `nm-diagram.js` renders: `flow tree cycle hub swimlane sequence timeline layers matrix funnel pyramid venn compare bars line donut gauge stat`; friendly aliases `bar column` (bars), `area` (line with fill), `pie` (donut), `stack` (layers), `network graph` (flow), `kpi` (stat) |
| `visual.columns`, `visual.rows` | table: header labels, then one list of cells per body row (text or numbers; numbers follow the deck's digit system, text is written as given). `row_headers` (default `true`) makes the first column label the rows. `highlight`: static emphasis such as `"r2 c3"`. `caption` |
| `visual.mathml`, `visual.tex`, `visual.lines` | equation: one native `<math>` element (the default, no library), or TeX without `$` (scaffold then stages the optional Temml converter), or `lines`, a derivation: `[{ "mathml" or "tex", "note" }]`. `caption` |
| `rel` | `next deeper back-out chapter contrast time` |
| `transition` | `auto fade-through push zoom-through iris wipe curtain depth fold dissolve none` |
| step `act` | `reveal zoom highlight focus detail lens pins slice draw` |

`morph` lists shared element ids. Conventional ids: `title` (headline), `kicker`, `visual`, `stat`, `body1..bodyN`. The same id must be on the previous or the next slide.

Step `target`: `headline`, `kicker`, `visual`, `stat`, `body` (the whole list), `bodyN` (item N), or `node:<id>` (a node of a flow, tree, cycle, hub, swimlane or sequence diagram; the node is created in the starter diagram and the step lands in the figure's `data-node-steps`, so any act works on a single node). Steps are numbered in the order you write them. Default target is `visual`. One element carries one step; give two steps to two elements.

On a table, `reveal` or `highlight` on `visual:row` gives one step per body row, `visual:col` one per data column (highlight takes the header cell along; reveal keeps the header visible). On a derivation (`lines`), `reveal` on `visual:line` keeps the first line on screen and reveals the next ones one per step. The runtime numbers these steps from `data-step-from`, so later plan steps are renumbered for you.

Inline formulas inside any text: write TeX between `\(` and `\)` (in JSON: `"\\(x^2\\)"`); scaffold turns it into an `nm-math` host and stages the converter.

On a diagram or chart, `reveal` or `draw` on `visual` builds the whole figure in one step. Write `visual:rank` (graph diagrams) or `visual:series` (charts) to build it piece by piece; the diagram then takes a block of step numbers, so later steps are renumbered for you. If you edit the diagram by hand afterwards, renumber the other `data-step` values on that slide.

## Describing the information (`content`) and `plan-advise` (NM-29)

Optional. A slide may say what its information is; `plan-advise` then suggests how to show it. The decision happens here, in the plan, never in the runtime. Without `content` nothing changes.

```json
"content": {
  "kind": "comparison",
  "items": 4,
  "dimensions": { "options": 2, "criteria": 4 },
  "quantities": [ { "label": "قبل", "value": 22, "unit": "حاوية/ساعة" } ],
  "sequence": "ordered",
  "formula": false,
  "detail": "standard",
  "entities": ["الرافعة", "المكدس"]
}
```

| Field | Values and effect |
|---|---|
| `kind` | `concept comparison process causal data finding argument definition hierarchy part-whole timeline` (required for advice) |
| `items` | how many elements (steps, parts, points); also the number of starter nodes scaffold writes |
| `dimensions` | `options` x `criteria` of a comparison (2 x 4 suggests a table) |
| `quantities` | the numbers, in order, with label and unit. A `chart` visual is drawn from them (bars, donut, line, stat, gauge, funnel) in the deck's digit system; `audit-deck` warns when the drawn chart and the plan disagree |
| `sequence` | `ordered` (flow, line), `unordered`, `cyclic` (cycle) |
| `formula` | `true`, or the formula itself (MathML or TeX) so `--apply` can write the equation |
| `detail` | `overview` (no progressive reveal), `standard`, `deep` (detail act, tables for many values) |
| `entities` | named things on the slide; one shared with the previous slide suggests Morph; three or more on a picture suggest pins |

Deck level: `"audience": "general" | "practitioner" | "expert"` (experts get tables for exact values sooner) and `"advisor": true` (advisory A-codes in `plan-lint`).

`plan-advise --plan FILE [--output advice.json] [--apply]` prints a table in the plan's language and writes `advice.json`: per slide `current`, `fit` (`good`, `fair`, `weak`, `poor`, `unknown`), up to three suggestions with reason codes and Arabic and English text, `acts` (or `still`), `morph`, and data `checks`; plus `repetition` across slides. Deterministic. `--apply` writes the first suggestion into slides whose fit is weak or poor and whose visual is not locked, only when scaffold can build it from the plan (a table needs `quantities`, an equation needs the formula in `content.formula`, an image needs an image source), keeps the old plan as `.bak`, and never applies a change that would make `plan-lint` fail. The rules are data: `resources/templates/representation-rules.json`.

## Design rules (plan-lint)

Errors block `scaffold`. Warnings are advice.

| Code | Level | Rule and fix |
|---|---|---|
| P001 P002 P003 P004 P005 | error | Missing field, bad enum value (the message suggests the closest), unknown theme preset or bad hex, duplicate or invalid slide id, unknown layout. |
| R101 | error | Slide 1 has role `cover`. |
| R102 | error | Last slide has role `closing` or `summary`. |
| R103 | error | 5 to 24 slides. |
| R104 | error | The same layout on 3 slides in a row. Change one. |
| R105 | warn | The same layout on 2 slides in a row. |
| R106 | error | Every slide after the first must link to the previous one: share a morph id, or set a non-auto `transition`, or a `rel` other than `next` (chapter, contrast, deeper, back-out, time each pick a transition). |
| R107 | error | A morph id must also be on the previous or next slide. |
| R108 | error | At most one `detail`, `slice` or `lens` act per slide. |
| R109 / R110 | error / warn | More than 6 steps is an error; more than 4 is a warning. |
| R111 | error | A deck with 8+ slides needs at least one isolation act (`focus detail lens pins slice`). |
| R112 | error | Any `process`, `comparison` or `evidence` slide means the deck needs at least one diagram or chart. |
| R113 | error | No two slides in a row with `visual.type: none`. |
| R114 | error | Headline at most 9 words. |
| R115 / R116 | error / warn | At most 5 body items, at most 18 words each (warn). Long text goes in `speaker_note`. |
| R117 | error | `anatomy` needs `visual.ref` and `visual.mode`. |
| R118 | error | `visual.type: image` needs `image_source` other than `none`. |
| R119 | warn | The same non-auto transition more than 3 times. Vary. |
| R120 | error | No emojis anywhere. |
| R121 | warn | Do not mix Western (0-9) and Arabic-Indic digits in one deck. |
| R122 | warn | Custom theme contrast: ink on paper at least 7:1, accent on paper at least 3:1. |
| R123 R124 | warn | Image without `ref` or `query`; diagram or chart without `diagram_type`. |
| R125 | error | A table needs `columns` (2 or more) and `rows`, every row with one cell per column; `highlight` names existing rows (`r1`..) and data columns (`c1`..). |
| R126 | warn | A table larger than 8 rows x 6 columns cannot stay at 20px or more. Split it, or move rows to a `detail` act. |
| R127 | error | An equation (or each derivation line) needs exactly one of `mathml` (one `<math>` element, no scripts or event handlers) or `tex`. |
| R128 | error | `tex` starts with a `$`, `\(` or `\[` delimiter. Write the formula without delimiters. |
| R129 | warn | A derivation of more than 4 lines. Continue on the next slide and link the shared terms with `data-term`. |
| R130 | warn | `theme.derive` found no material word of the topic; the palette comes from the title alone. Name the topic's materials. |

With `"advisor": true` only (advisory, never errors):

| Code | Rule |
|---|---|
| A200 | A content slide does not describe its information (`content.kind` missing or unknown). |
| A290 / A291 | The current representation does not fit (a never-rule: a donut for parts that do not make 100, a chart without numbers, an equation without a formula, a line without a series, bars for one value) / works but another reads better. Lock the visual to keep your choice. |
| A401 / A402 | Three slides in a row look the same (layout, visual, number of items, acts) but carry different kinds of information / with no narrative link. A series of the same kind linked by Morph is not flagged. |
| A501 A502 A503 | Parts of a whole that do not add up to 100; a chart of values in different units; `items` that disagrees with the number of `quantities`. |

The motion note (`slides with little motion`) skips slides the advisor marks still (a definition, a quote, one number).

The report also lists a per-slide motion score (0 to 10) and the slides that are flat (score 2 or less). Give flat slides a morph, a step or an isolation act.

## Motion director habits

- Carry one element across slides (`title`, then `visual`). The eye follows it.
- Use `rel` to say why the slide follows: `deeper` zooms in, `back-out` zooms out, `chapter` and `contrast` break rhythm on purpose, `time` moves along a timeline.
- Reveal one point per step. Isolate (`focus`, `detail`) the one thing the speaker is explaining.
- Alternate dense and quiet slides. A `quote` or `section` slide is a breath.

## Language, digits and mixed text

- One digit system per deck. Digits inside formulas do not count (MathML and TeX write Western digits). English decks use Western digits. An Arabic deck uses Arabic-Indic digits unless its plan writes only Western ones; the starter chart data and section numbers follow the same rule.
- In Arabic decks, scaffold wraps Latin or numeric runs that carry punctuation or digits (`GPT-4 (2023)`, `v2.1`) in `<bdi>` so their order cannot jump. Plain Latin words are left alone. When you add such text by hand, wrap it the same way (`check` reports C-BIDI otherwise).
- Text on an accent fill uses `--nm-on-accent`, which scaffold sets per theme by contrast (white on dark accents, the theme's dark colour on light ones).

## What scaffold writes

Each slide becomes `<section class="slide" data-title data-rel data-transition>` with a `.camera-rig` holding one `<div class="nm-slide-pad nm-l-<composition>">` whose direct children are the parts that composition expects (no wrapper slots). Short plan names map to real compositions, adapting to the content:

| Plan `layout` | Composition written | Children |
|---|---|---|
| `cover` | `nm-l-title` (with an image: `nm-l-split` 7:5) | `nm-kicker`, `h1.nm-t-display`, `nm-t-lead` |
| `center` | `nm-l-title` (with a visual: `nm-l-split` 7:5) | kicker, `nm-t-h1`, lead |
| `section` | `nm-l-section` | `nm-section-num` (chapter number), `nm-rule is-accent`, kicker, `nm-t-h1`, lead |
| `split` / `split-rev` | `nm-l-split` (5:7 with a diagram or figure, 1:1 with a photo; `split-rev` puts the visual first) | `nm-head` text column, visual |
| `hero`, `diagram`, `timeline` | `nm-l-hero-figure` | `nm-head`, figure |
| `stat` | `nm-l-stat-row`, or `nm-l-split` with text when there are body points or a visual | `nm-stat-block` (`nm-t-num` + label) |
| `cards` | `nm-l-cards-2..4` by body count (`nm-l-bento-*` with a visual) | `nm-head`, one `nm-card` per body point |
| `compare` | `nm-l-compare` (with a visual: `nm-l-hero-figure`) | `nm-head`, two `nm-side` columns |
| `quote` | `nm-l-quote` | `blockquote`, `cite` |
| (any, with a table or equation) | as for a diagram: `nm-l-hero-figure` for `hero`/`diagram`/`compare`, `nm-l-split` 5:7 for `split` | `figure.nm-table` around a real `<table>`, or `figure.nm-equation` |
| `list` | `nm-l-rail` (with a visual: `nm-l-split`) | `nm-rail-head`, `nm-rail-main` |

One body point becomes a `nm-t-lead` paragraph, several become a `ul.nm-list`. Morph ids become `data-morph`; steps become `data-step` and `data-act`; a `detail` or `slice` step also writes the element `id` and a `<template data-detail-for>` to fill; a `pins` step on the visual writes a starter `.nm-pin`.

The deck links only local files: fonts in `assets/fonts/`, the runtime in `assets/nm/`, `nm-layout.css` for layout and type. No CDN and no Tailwind, so it works with no network. `scaffold --tailwind` adds the Tailwind CDN mapped to the theme tokens (needs network; only for users of the bundled editor's token panel).

Placeholders you must replace (each is marked `data-nm-todo` and explained in the slide's comment):

- image: `assets/img/_placeholders/<slide>.svg` stands in; save the real file as `assets/img/<ref>.jpg`, set `src`, and record it in `assets/img/credits.json` (`scripts/image_fetch.py` does this for web images).
- anatomy: a `div` with `data-anatomy="<ref>"`; build the figure with the anatomy engine and save `<ref>.brief.json`.
- diagram and chart: a `figure.nm-diagram` with `data-type` (always a real type) and `data-id` (the visual `ref`), whose `<script type="text/nm-diagram">` holds a starter text DSL that renders as is (for example `a[Label] -> b[Label]` for flows, `Label: value` lines for charts); edit labels and values, keep node ids used by `data-node-steps`.
- motion: an inline SVG placeholder; draw the motion graphic.

When you change the plan after editing the HTML, do not rerun `scaffold --force` over your edits; copy the new slide by hand, or keep the old file (it is saved as `.bak`).

## Check codes (`check`)

| Code | Meaning |
|---|---|
| C-OUT | Element leaves the 1920x1080 stage. Decorative parts must be `aria-hidden` or `.nm-bleed`. |
| C-CLIP | Text is cut by its box. |
| C-OVERLAP | Two text blocks overlap by more than 8px. |
| C-SMALL | Text rendered under 22px, measured after transforms (captions are exempt; labels inside diagrams and charts may go down to 18px). |
| C-CONTRAST | Text below 4.5:1 against its background (3:1 for text at 32px and above). Text over images is skipped. |
| C-IMG | Broken image. |
| C-FONT | A declared font did not load. |
| C-GHOST | Morph ghosts left after a transition. |
| C-STEPS | Declared steps are not all reachable with the arrow keys (the release step core adds after a final transient act is expected, not counted as extra). |
| C-CONSOLE | Console error or exception. Network errors for external hosts are warnings when offline (for example the Tailwind CDN of a `--tailwind` deck). |
| C-FRAME | error: an iframe or anatomy figure shows nothing (missing file, a path outside the deck folder, an empty page). |
| C-ARABIC | error: positive letter-spacing on Arabic text, or one Arabic word split across elements (the letters lose their joins). Warning: Arabic-Indic and Western digits on one slide. |
| C-BIDI | warn: Latin or numeric text with punctuation inside Arabic (`GPT-4 (2023)`) and not isolated. Wrap it in `<bdi>`. |
| C-WIDOW | warn: a title ends with one word on its own line. |
| C-DENSITY | warn: more than 60 words of visible text (diagram labels, table cells, formulas and the image sources block excluded). |
| C-TABLE | error: a table does not fit its figure, or its cells render below 20px (the runtime already set it as small as 20px). Warning: rows with different numbers of cells. |
| C-MATH | error: TeX shown raw (a `data-tex` formula without the converter, a TeX parse error, or `\frac`, `$x^2$` left in the text), or a `<math>` element that renders nothing. |
| C-BASELINE | with `--baseline DIR`: a screenshot differs from the saved one on more than 0.05% of its pixels (an unchanged deck differs by 0 on the same machine, one changed word by about 0.2%); a diff image goes to `<shots>/diff/`. `--save-baseline DIR` saves one; `--baseline-strict` makes it an error; `--steps` adds every step. Compare on the machine that made the baseline (fonts and Chrome change antialiasing). |
| C-MOTION | with `--motion`: a slide takes more than 2000ms to arrive at full speed (transition, morph and entrances). `report.json` records per slide `settle_ms`, the most animations running at once, and long frames. |
| C-JANK | with `--motion`: frames of 50ms or more while a slide arrives. Machine dependent: confirm on the presenting computer. |
| C-FILL | warn: a diagram draws on less than 45% of its box. Let it grow (`data-grow`) or give it a smaller cell. |
| C-EMPTY | warn: a content slide carries ink on less than 4% of the stage (cover, section, quote and closing exempt). |
| C-DRIFT | warn: the title of a top-anchored composition sits more than 8px from the titles of the other slides with the same composition. |

## Template tells (`audit-deck`, NM-20)

Warnings, never errors: each can be right on purpose, none is right on every slide.

| Code | Tell | Fix |
|---|---|---|
| T101 | A kicker (eyebrow line) above the title on more than 70% of content slides | Keep it where it adds information (a chapter, a source) |
| T102 | Rows of three or more identical cards on more than half of the content slides | Give some a diagram, a table, a figure or one strong sentence |
| T103 | Items numbered 01, 02 on a slide whose content is not a sequence | Number only steps that happen in order |
| T104 | One coloured word in the title on two slides or more | Spend the accent once, on the one thing the slide proves |

`check` also writes `quality.json` next to `report.json`: every finding with a tier (`HOLD` must be fixed before delivery, `FIX` should be, `NOTE` is advice), a confidence (`confident`, `likely`, `possible`), the evidence and a one-line fix, plus a score per slide and for the deck (`100 - 25 x HOLD - 5 x FIX - 1 x NOTE`). Fix every HOLD, then read the FIX items. Thresholds were calibrated on the golden corpus: the finished showcase passes with three diagram-fill notes.
