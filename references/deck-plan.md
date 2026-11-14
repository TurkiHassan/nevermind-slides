# Deck plan: write the plan, let the tools build and check

Fill in `deck.plan.json`. The tools turn it into a deck skeleton and tell you what is wrong. Do not write motion code, navigation code or font rules by hand.

All commands: `python3 "<SKILL_DIR>/scripts/deck_helper.py" <command> ...`

## Workflow

1. `plan-init --target-dir DIR --title "العنوان" [--slides N]` writes `DIR/deck.plan.json`. Without `--slides` you get the full 8-slide example. With `--slides N` (5..24) you get N stubs.
2. Edit the plan. Keep headlines short, keep one idea per slide.
3. `plan-lint --plan DIR/deck.plan.json [--output report.json]`. Fix every error. Read every warning.
4. `scaffold --plan DIR/deck.plan.json [--out DIR/name-slides.html] [--force]`. Refuses to run while plan-lint has errors. Also stages fonts and runtime into `DIR/assets/`.
5. Open the generated HTML. Each slide starts with a comment listing its remaining TODOs. Replace placeholders (`data-nm-todo`) with real content.
6. `audit-deck --html-path FILE`. Fix errors. Placeholders left in the deck show up as warnings.
7. `check --html-path FILE [--shots DIR] [--slides 1-5]`. Needs Node 20+ and Chrome. Exit code 2 means Node or Chrome is missing (not a deck problem). Read the contact sheet PNG and the per-slide table. Fix, rerun.
8. `open-files FILE` for the final look.

Other commands: `stage-runtime --target-dir DIR [--inline]` copies `assets/nm/` (use `--inline` for a paste-in `nm-inline.html`). `scaffold --force` regenerates only the output HTML (the old one is kept as `.bak`); assets and placeholder images are never overwritten.

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
| `theme.preset` | `paper`, `mist`, `dune`, `olive` (light); `ink`, `night-sea`, `emerald`, `ember` (dark). Or custom hex tokens `paper ink muted line accent accent2 surface radius`. A preset plus overrides is allowed. |
| `fonts.pairing` | `thmanyah` (default), `sans`, `qahwa`, `setabr`, `kufi` |
| `mode` | `morph-and-zoom`, `morph-only`, `classic` |
| `image_source` | `generate`, `web`, `none` |
| `role` | `cover section concept mechanism evidence comparison process quote summary closing` |
| `layout` | `cover section split split-rev hero stat cards compare diagram timeline quote center list` |
| `visual.type` | `anatomy image diagram chart motion none` |
| `visual.mode` | `static`, `animated` (required for anatomy) |
| `visual.diagram_type` | `flow cycle tree hub layers timeline compare matrix funnel venn bar line area donut pie gauge scatter stat network graph stack steps` |
| `rel` | `next deeper back-out chapter contrast time` |
| `transition` | `auto fade-through push zoom-through iris wipe curtain depth fold dissolve none` |
| step `act` | `reveal zoom highlight focus detail lens pins slice draw` |

`morph` lists shared element ids. Conventional ids: `title` (headline), `kicker`, `visual`, `stat`, `body1..bodyN`. The same id must be on the previous or the next slide.

Step `target`: `headline`, `kicker`, `visual`, `stat`, `body` (the whole list), `bodyN` (item N), or `node:<id>` (a node of a flow, tree, cycle or hub diagram; the node is created in the starter diagram). Steps are numbered in the order you write them. Default target is `visual`. One element carries one step; give two steps to two elements.

On a diagram or chart, `reveal` or `draw` on `visual` builds the whole figure in one step. Write `visual:rank` (graph diagrams) or `visual:series` (charts) to build it piece by piece; the diagram then takes a block of step numbers, so later steps are renumbered for you. If you edit the diagram by hand afterwards, renumber the other `data-step` values on that slide.

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
| R106 | error | Every slide after the first must link to the previous one: share a morph id, or set a non-auto `transition`, or `rel` chapter or contrast. |
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

The report also lists a per-slide motion score (0 to 10) and the slides that are flat (score 2 or less). Give flat slides a morph, a step or an isolation act.

## Motion director habits

- Carry one element across slides (`title`, then `visual`). The eye follows it.
- Use `rel` to say why the slide follows: `deeper` zooms in, `back-out` zooms out, `chapter` and `contrast` break rhythm on purpose, `time` moves along a timeline.
- Reveal one point per step. Isolate (`focus`, `detail`) the one thing the speaker is explaining.
- Alternate dense and quiet slides. A `quote` or `section` slide is a breath.

## What scaffold writes

Each slide becomes `<section class="slide" data-title data-rel data-transition>` with a `.camera-rig` and an `nm-l-<layout>` composition. Text sits in slots (`nm-slot-head`, `nm-slot-body`, `nm-slot-visual`, `nm-slot-stat`) with `nm-t-*` type classes. Morph ids become `data-morph`; steps become `data-step` and `data-act`.

Placeholders you must replace (each is marked `data-nm-todo` and explained in the slide's comment):

- image: `assets/img/_placeholders/<slide>.svg` stands in; save the real file as `assets/img/<ref>.jpg`, set `src`, and record it in `assets/img/credits.json` (`scripts/image_fetch.py` does this for web images).
- anatomy: a `div` with `data-anatomy="<ref>"`; build the figure with the anatomy engine and save `<ref>.brief.json`.
- diagram and chart: a `figure.nm-diagram` whose `<script type="text/nm-diagram">` holds a starter text DSL (for example `a[Label] -> b[Label]` for flows, `Label: value` lines for charts); edit labels and values.
- motion: an inline SVG placeholder; draw the motion graphic.

When you change the plan after editing the HTML, do not rerun `scaffold --force` over your edits; copy the new slide by hand, or keep the old file (it is saved as `.bak`).

## Check codes (`check`)

| Code | Meaning |
|---|---|
| C-OUT | Element leaves the 1920x1080 stage. Decorative parts must be `aria-hidden` or `.nm-bleed`. |
| C-CLIP | Text is cut by its box. |
| C-OVERLAP | Two text blocks overlap by more than 8px. |
| C-SMALL | Text under 22px (captions are exempt). |
| C-CONTRAST | Text below 4.5:1 against its background (3:1 for text at 32px and above). Text over images is skipped. |
| C-IMG | Broken image. |
| C-FONT | A declared font did not load. |
| C-GHOST | Morph ghosts left after a transition. |
| C-STEPS | Declared steps are not all reachable with the arrow keys. |
| C-CONSOLE | Console error or exception. Network errors for external hosts are warnings when offline (for example the Tailwind CDN). |
