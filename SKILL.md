---
name: nevermind-slides
description: "Transforms research papers, technical articles, or complex topics into Arabic story-driven explanations and cinematic 1920x1080 HTML presentations. A bundled runtime does all motion from data-* attributes (shared-element Morph with arcs and springs, ten narrative transitions, camera zoom, isolation acts that lift a part of a slide out to show details, declarative diagrams and charts), so the author writes a plan and plain HTML. Includes subject-first anatomy isometric figures drawn from the topic's own world, generated or web-sourced images cropped and toned to the deck, bundled Arabic fonts, zero emojis, and automated plan, audit and headless-Chrome checks."
user-invocable: true
compatibility: codex, claude-code, opencode, antigravity
metadata:
  opencode/slash: "true"
---

# Nevermind Slides (`nevermind-slides`) v2

`<SKILL_DIR>` is the folder containing this file. Everything is bundled inside it: fonts with a redistributable license (`resources/fonts/`; Thmanyah and ZIAN are not bundled, see below), the motion runtime (`resources/engine/nm-runtime/`), the `anatomy` isometric engine (`resources/engine/anatomy/`), the `frontend-slides` layout library (`resources/engine/frontend-slides/`), templates (`resources/templates/`) and the Nevermind Studio editor (`resources/nm-studio/nm-studio.mjs`).

All helper commands: `python3 "<SKILL_DIR>/scripts/deck_helper.py" <command>` (stdlib only; `uv run` also works).

---

## The five laws (read before anything else)

1. **Never write motion or navigation JavaScript.** Link the bundled runtime and describe intent with `data-*` attributes. A deck that contains `class SlidePresentation`, its own key handlers or its own transition CSS fails the audit.
2. **Plan first, then scaffold.** Write `deck.plan.json`, run `plan-lint` to zero errors, run `scaffold`. Never hand-write the deck skeleton.
3. **Every slide earns its motion from the story.** Each slide declares its narrative relation (`rel`) to the previous one. Continuity comes from shared elements (`morph`), not from effects.
4. **Pictures come from the topic's own world.** Anatomy figures follow the subject-first ladder; a generic dial gauge or test rig is a failure unless the topic is that object.
5. **Nothing is delivered until the gates pass:** `plan-lint`, `audit-deck`, `check` (headless Chrome), `image_fetch.py credits --check`, and `brief-check` for every anatomy figure.

Fonts: Thmanyah and ZIAN are not bundled because their licenses forbid redistribution. `stage-fonts` copies them from the user's own font folders (or `NM_FONTS_DIR`) when present; otherwise `scaffold` switches the deck to the open pairing (`open`: Readex Pro + IBM Plex Sans Arabic) and prints a note. Never download or copy those fonts into the skill yourself; tell the user once, in Arabic, where to get them if they want them.

Arabic and RTL rules everywhere: `dir="rtl"`, right-aligned text, never split Arabic words into letters, one digit system per deck (Arabic-Indic or Western), zero emojis (inline SVG icons only).

---

## Bootstrap (install or immediate use)

Users are usually non-technical. Never ask them to run commands.

- **GitHub link + "install this skill":**
  ```bash
  git clone https://github.com/TurkiHassan/nevermind-slides.git /tmp/nevermind-slides
  python3 /tmp/nevermind-slides/scripts/deck_helper.py install
  ```
  Installs and links the skill (with runtime, templates, engines and the OpenCode `/nevermind-slides` command) for Antigravity, OpenCode, Codex, Claude Code and `~/.agents/skills`.
- **"Use it right away":** install silently if needed, then go to Phase 1 or Phase 2.

---

## Reference map (open only what the current step needs)

| Need | Read |
|---|---|
| Plan file fields, layouts, rules, commands | `references/deck-plan.md` |
| Morph, transitions, steps, entrances, camera, keys | `references/morph-and-motion.md` |
| Isolate part of a slide: focus, detail, lens, pins, slice | `references/focus-isolation.md` |
| Diagrams, charts, connectors, `nm-l-*` layouts, type scale | `references/diagrams.md` |
| Images when no generator exists: search, crop, tone, credits | `references/web-images.md` |
| Runtime contract (API for advanced use only) | `references/runtime-contract.md` |
| Anatomy: choose the subject | `resources/engine/anatomy/references/subject-first.md` |
| Anatomy: topic-native props (`scene.mjs`) | `resources/engine/anatomy/references/scene-kit.md` |
| Anatomy: craft, API, verification | `resources/engine/anatomy/SKILL.md` and its `references/` |
| Legacy v1 decks (old `SlidePresentation` class) | `references/motion-graphics-cookbook.md` |
| A complete worked deck to imitate (14 slides, every feature, passes every gate) | `examples/showcase/` (`deck.plan.json` then `deck.html`) |

---

## Error handling (mandatory)

- Source cannot be read (URL fails, PDF unreadable): **stop** and ask the user in simple Arabic to paste the text, upload the PDF, or give another link. Never invent findings.
- An anatomy `--audit` or `brief-check` still fails after two honest fix attempts: report the exact failing line and ask how to proceed.
- A tool exits `2` (Node or Chrome missing): say so once in one line, skip that gate, continue. Exit `3` from `image_fetch.py` means no network: use its `placeholder` command.

---

## Phase 1: Story-driven Arabic explanation *(only when asked)*

Run only if the user asks to explain or simplify first ("اشرح لي هذه الورقة", "بسّط لي هذا البحث"). If they ask for slides directly, go to Phase 2.

1. Read the whole source. Extract: the problem, why earlier methods fail, the core mechanism, the results with their numbers.
2. Explain in zero-jargon Arabic: open with an everyday story, then a table "الطريقة القديمة / طريقة الورقة", then the mechanism as a physical picture, not an equation.
3. Build an interactive RTL simulator page `<project_dir>/<topic>-simulator.html` and open it with `open-files`. In Antigravity with `generative_ui`, embed it with `<agent-embed>`.

---

## Phase 2: Analyse, propose, preview *(mandatory before building)*

### 2.1 Content map

Read the source and fill this table for yourself (one row per future slide). It becomes the plan.

| Column | How to fill it |
|---|---|
| `role` | cover, section, concept, mechanism, evidence, comparison, process, quote, summary, closing |
| `rel` (to previous slide) | `next` same thread; `deeper` zoom into a part; `back-out` return to the whole; `chapter` new section; `contrast` opposite idea; `time` before/after |
| shared element | What carries over from the previous slide (title, a card, a number, a diagram node, the figure). Aim for one on most slides. |
| visual | Pick with table 2.2 |
| isolation | Which part deserves a closer look, and which act (table 2.3) |

### 2.2 Choose the visual for each slide

| The slide's idea is... | Visual | Plan `visual.type` |
|---|---|---|
| A physical mechanism, a place where the work happens, or a process with real objects | Anatomy isometric figure, subject-first | `anatomy` (`mode`: `animated` if the real subject moves and the motion is the point, else `static`) |
| Steps, flow, architecture, hierarchy, cycle, actors exchanging messages | Diagram | `diagram` with `diagram_type`: flow, tree, cycle, hub, timeline, layers, swimlane, sequence |
| Positioning, proportions, overlap, comparison of two options | Diagram | matrix, funnel, pyramid, venn, compare |
| Numbers that matter | Chart | `chart`: bars, line, donut, gauge, stat |
| A story, a human moment, a place, an atmosphere | Image (generated, else web) | `image` |
| A strong sentence | Typography alone (quote layout) | `none` (never two in a row) |

### 2.3 Choose how to isolate a part of a slide

| The viewer should... | Act | Why |
|---|---|---|
| look at one card among several, then the next | `focus` | Spotlight that travels between items; the rest recedes |
| learn more about one item than fits on the slide | `detail` (`side`, `expand`, `sheet`, `popover`) | The item lifts out and a details panel grows from it |
| see fine detail inside a figure, chart or photo | `lens` | Magnifier over the live slide |
| learn the named parts of an image or figure, in order | `pins` | Numbered pins drop one by one with labelled cards |
| see what is hidden between two layers of the story | `slice` | The slide splits open and a strip with details appears |
| follow one point being emphasised, nothing else changes | `highlight` | Lightest touch |
| read a dense area closer without new content | `zoom` | Camera glides in |

Limits: at most one `detail`, `lens` or `slice` per slide; at most 6 steps per slide (4 is better). Decks of 8+ slides need at least one isolation act.

### 2.4 Anatomy proposal (subject-first)

For every slide marked `anatomy`, before proposing it to the user:

1. Open `resources/engine/anatomy/references/subject-first.md`.
2. Extract 12+ concrete nouns, 5+ verbs and 3-5 true quantities from the source.
3. Climb the Subject Ladder: (1) the thing itself, (2) its native setting as a diorama, (3) the field's own instrument or workspace, (4) the process made physical with the domain's real objects, (5) a metaphor machine only if 1-4 are written down as rejected.
4. State in one line per figure: subject, setting, what moves and what that means.

Present the proposal to the user as a table: slide, visual type, subject (for anatomy), mode (ثابتة / متحركة), isolation act.

### 2.5 Three live style previews

1. Pick 3 distinct directions suited to the topic from `resources/templates/themes.json` (8 presets with tuned contrast) combined with a font pairing.
2. For each, write `<project_dir>/.frontend-slides/slide-previews/style-a.html` (b, c): one real slide of the deck (the cover or the strongest concept slide), built with the runtime and `nm-layout.css`, 1920x1080, RTL, zero emojis. Fastest path: `plan-init` a 5-slide plan, set the theme, `scaffold --out` into the previews folder.
3. Open all three with `open-files`.

### 2.6 Ask the user (one message, numbered Arabic menu, or the ask tool if available)

1. **الهدف:** عرض تقديمي رئيسي / شرح تعليمي / تعمّق تقني / ملخص سريع
2. **الطول:** قصير 5-7 / متوسط 8-12 (موصى به) / طويل 12-18
3. **الكثافة:** متوازن (موصى به) / بصري أولاً / بطاقات مرجعية مفصّلة
4. **مجسمات anatomy:** اعتماد المقترح (موصى به) / متحركة في كل الشروحات / ثابتة فقط / بدون anatomy
5. **الخطوط:** ريدكس + IBM Plex (مفتوحة، موصى به) / ثمانية Display + KOMission (إن كانت مثبّتة لدى المستخدم) / قهوة + IBM Plex / سطبر + Readex Pro / الخليل الكوفي + IBM Plex
6. **الحركة:** Morph + تقريب الكاميرا بالأسهم (موصى به، `morph-and-zoom`) / Morph فقط (`morph-only`) / انتقال هادئ (`classic`)
7. **النمط:** A / B / C من المعاينات المفتوحة

Wait for the answer.

---

## Phase 3: Build

### 3.1 Plan

```bash
python3 "<SKILL_DIR>/scripts/deck_helper.py" plan-init --target-dir "<project_dir>" --title "<العنوان>" --slides <N>
```

Fill `deck.plan.json` from the content map and the user's answers (`references/deck-plan.md` lists every field). Rules the linter enforces: first slide `cover`, last `closing` or `summary`; headline 9 words or fewer; 5 body items or fewer; continuity (shared `morph` id, or `rel` chapter/contrast, or an explicit transition); no layout three slides in a row; a diagram or chart when there is a process, comparison or evidence slide.

```bash
python3 "<SKILL_DIR>/scripts/deck_helper.py" plan-lint --plan "<project_dir>/deck.plan.json"
```

Fix until `PASSED`. Read the warnings and fix the ones that are cheap.

### 3.2 Scaffold

```bash
python3 "<SKILL_DIR>/scripts/deck_helper.py" scaffold --plan "<project_dir>/deck.plan.json"
```

This writes `<project_dir>/<slug>-slides.html`, stages fonts into `assets/fonts/` and the runtime into `assets/nm/`. The deck already navigates. Each slide starts with an HTML comment listing what is left to do; placeholders carry `data-nm-todo`.

### 3.3 Fill the slides

Work slide by slide. Keep the generated structure; change content, not scaffolding.

- **Text and layout:** use the type classes (`nm-t-display`, `nm-t-h1`..`nm-t-h3`, `nm-t-lead`, `nm-t-body`, `nm-t-caption`, `nm-t-num`) and the compositions scaffold already placed (`nm-l-title`, `nm-l-section`, `nm-l-split`, `nm-l-hero-figure`, `nm-l-figure-full`, `nm-l-bento-3..6`, `nm-l-cards-2..4`, `nm-l-rail`, `nm-l-quote`, `nm-l-stat-row`, `nm-l-compare`, `nm-l-steps`; details in `references/diagrams.md` section 6). Body text 28px or larger. One accent colour. No Tailwind: the deck works offline (`scaffold --tailwind` only if the user wants the editor's token panel).
- **Morph:** give an element the same `data-morph="id"` on two consecutive slides. Headings with identical text, identical images and diagram nodes pair automatically. Kinds: box, text, `words` (shared words fly individually), image, path, number. See `references/morph-and-motion.md`.
- **Transition:** leave `data-transition="auto"` and set `data-rel`; set a name only for a deliberate effect (`fade-through`, `push`, `zoom-through`, `iris`, `wipe`, `curtain`, `depth`, `fold`, `dissolve`, `none`).
- **Steps:** `data-step="N" data-act="reveal|zoom|highlight|focus|detail|lens|pins|slice|draw"`. Elements sharing N appear together. Arrows step first, then change slide. `data-focus-zoom` is a ceiling: the camera zooms only as far as the subject fits.
- **Images in frames:** put `data-morph` on the `<img>` inside `.nm-img`, not on the frame.
- **Live iframes** (animated anatomy): the deck keeps the arrow keys; add `data-nm-keys="frame"` only if the frame must own the keyboard.
- **Entrances:** automatic for top-level blocks. Override with `data-entrance="rise|fade|clip|scale|blur|draw|type|count|slide"`.
- **Ambient motion:** `.mg-flow`, `.mg-pulse`, `.mg-radar`, `.mg-scan`, `.mg-drift` on SVG parts, and `data-flow="on"` on diagrams. Use them where something really flows or watches; never as filler.

### 3.4 Diagrams and charts

```html
<figure class="nm-diagram" data-type="flow" data-id="pipeline" data-steps="rank">
  <script type="text/nm-diagram">
    in[المدخلات] -> enc[المشفّر] -> out[المخرجات]
    enc.accent
  </script>
</figure>
```

Pick the type with the table at the top of `references/diagrams.md`. Re-use the same `data-id` on the next slide with a different type, layout or emphasis and the nodes morph across. Reveal progressively with `data-steps="rank|node|edge|series|all"`, or name nodes yourself with `data-node-steps="enc:1, probe:2:highlight"`. `data-grow="1"` keeps a sparse diagram at natural size (default grows it to fill its cell). Connect your own cards with `data-node="a"` and `data-links="a>b: تسمية; b~>c"` on a parent.

### 3.5 Anatomy figures

For every `anatomy` slide:

1. Write `<project_dir>/assets/<figure>/<figure>.brief.json` (format in `subject-first.md`) and run:
   ```bash
   node "<SKILL_DIR>/resources/engine/anatomy/scripts/brief-check.mjs" "<project_dir>/assets/<figure>/<figure>.brief.json" --build "<project_dir>/assets/<figure>/build.mjs"
   ```
2. Build with topic-native props from `resources/engine/anatomy/kit/scene.mjs` (buildings, vehicles, people, technology, paperwork, terrain, logistics) plus the core kit. Start from the closest example: `examples/supply-port/` (animated scene), `examples/field-hospital/` (static scene), `examples/dial-indicator/` (smallest build).
3. Audit to zero: `node build.mjs --audit` must print `audit passed`.
4. Static: `node build.mjs --svg` and inline the SVG in the slide inside an element with `data-anatomy="<figure>"`. Animated: embed the built page in an `<iframe data-anatomy="<figure>">`; the figure must not bind global ArrowLeft/ArrowRight.
5. Match the slide theme (`--light` for light slides).

### 3.6 Images

| Environment | Do this |
|---|---|
| Antigravity | `image-generator` subagent via `invoke_subagent`, 2-3 images per batch |
| Codex | built-in `image_gen` tool; copy results to `<project_dir>/assets/img/` |
| Claude Code / OpenCode with `codex` on PATH (`which codex`) | call `codex` non-interactively to run `image_gen`, copy the result |
| Any other image-generation tool available to you | use it |
| **No generator** | web images, below |

Generated image prompts must say: "Strictly NO text, NO letters, NO numbers, NO words, NO typography anywhere in the image", plus the deck's background and accent colours and one shared art style.

**Web images (no generator):** one call searches open-licence sources, downloads the best match, crops it to the slot around its focal point, tones it to the palette and records credits:

```bash
python3 "<SKILL_DIR>/scripts/image_fetch.py" auto --query "<English keywords>" --slot 1100x900 \
  --name <slug> --project "<project_dir>" --style duotone --ink "<ink>" --paper "<paper>" --accent "<accent>"
```

Paste the printed `<figure class="nm-img ...">` snippet. If you found an image with your own web search tool, use `fetch --url ... --license ... --creator ... --source-page ...` then `fit` and `treat`. Search queries work best in English; keep one treatment (`duotone`, `mono` or `tint`) across the deck so photos from different sources read as one set. No network: `placeholder` makes an on-palette plate. Add the sources block (`credits --project DIR --format html`) to the closing slide. Never use an image with `"license": "unverified"` in a deck that will be published.

---

## Phase 4: Verify and deliver *(mandatory gate)*

Run in order and fix until each passes:

```bash
python3 "<SKILL_DIR>/scripts/deck_helper.py" audit-deck --html-path "<deck.html>"
python3 "<SKILL_DIR>/scripts/deck_helper.py" check --html-path "<deck.html>" --shots "<project_dir>/.nm-shots"
python3 "<SKILL_DIR>/scripts/image_fetch.py" credits --project "<project_dir>" --check "<deck.html>"
```

1. `audit-deck`: `"passed": true`. It checks emojis, fonts, assets, vocabulary of every `data-*` value (with suggestions), morph pairing, step numbering, detail templates, anatomy briefs, credits, and hand-written navigation.
2. `check`: opens the deck in headless Chrome, walks every slide and step, and reports text outside the stage, clipped or overlapping text, small text, low contrast, broken images, unloaded fonts, leftover morph ghosts, empty frames, broken Arabic joins, unisolated Latin runs, widows, dense slides, diagrams that use little of their box, nearly empty slides and drifting titles. Read `quality.json` in the shots folder: fix every `HOLD`, then the `FIX` items. **Open the contact sheet PNG and look at it.** Fix anything that looks cramped, misaligned or empty, then rerun.
3. Clean previews: `cleanup-previews --target-dir "<project_dir>"`.
4. Open the deck (`open-files`) and give a short Arabic summary: slide count, the visual plan, keys (الأسهم للتنقل، O للنظرة العامة، F ملء الشاشة، E تعديل النصوص، ? المساعدة).
5. Offer the visual editor:
   ```bash
   python3 "<SKILL_DIR>/scripts/deck_helper.py" edit --html-path "<deck.html>"
   ```
   Exit code `2` means Node.js 20+ is missing: say so once and continue.

---

## Applying the user's pinned notes (Nevermind Studio)

When `.nevermind/notes.json` exists next to the deck, apply open notes before any unrequested change. Never hand-edit `.nevermind/*.json`.

1. `deck_helper.py notes list --html-path "<deck.html>"`.
2. Read `.nevermind/current.json` if present (current slide, selected element, deck fingerprint).
3. For each note: locate the node (prefer `dataNid`, then tag, text, classes, slide); use region rectangles in 1920x1080 stage coordinates; inspect with `nm-studio inspect <deck.html> --slide <n>` when needed; apply the smallest batch through `nm-studio apply` (pass `--expect <fingerprint>` when it still matches). Never rewrite the whole deck.
4. Re-run `audit-deck` after each note. Leave a note open when it needs a user decision.
5. Close only what was done: `deck_helper.py notes done --html-path "<deck.html>" <note-id>`.
6. Repeat until no open notes remain.

The open editor picks up changes automatically; do not ask the user to reopen it.
