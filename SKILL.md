---
name: nevermind-slides
description: "Transforms research papers, technical articles, or complex topics into Arabic story-driven explanations and ambitious, motion-graphic-rich HTML presentations (1920x1080 fixed stage). Analyzes content upfront to recommend where to use the anatomy skill (as static or animated isometric mechanical SVG figures) vs. bespoke generated editorial illustrations, presents user options with 3 live browser style previews, and enforces zero emojis, bundled Thmanyah Display and KOMission typography, smooth Morph + Camera Zoom transitions, and live SVG motion graphics."
user-invocable: true
compatibility: codex, claude-code, opencode, antigravity
metadata:
  opencode/slash: "true"
---

# Nevermind Slides (`nevermind-slides`)

> **Note:** Throughout this file, `<SKILL_DIR>` refers to the folder containing this `SKILL.md` file. Nevermind Studio ships as a bundled single-file build (`<SKILL_DIR>/resources/nm-studio/nm-studio.mjs`, run with `node`), so the `edit` / `notes` subcommands work without a separate install; they exit with code `2` only when Node.js `>= 20` is missing. This skill is **100% self-contained**: all 25 Arabic font files (`Thmanyah Serif Display`, `KOMission`, `Thmanyah Sans`, `Qahwa Arabic`, `Setabr Display`, `Alkhalil Kufi`, `ZIAN`, `IBM Plex Sans Arabic`, `Zain Rounded`, `Readex Pro`), the `anatomy` isometric SVG engine (`resources/engine/anatomy/`), and the `frontend-slides` 1920×1080 layout engine (`resources/engine/frontend-slides/`) are bundled directly inside `<SKILL_DIR>/resources/`.

---

## Agent Zero-Friction Bootstrap (Install or Immediate Use)

Most users are non-technical and will either paste a GitHub link (`https://github.com/TurkiHassan/nevermind-slides`) asking you to **"install this skill"** or ask you to **"use this skill right away on this paper/topic"**. Never ask the user to run terminal commands or install dependencies manually:

1. **If the user gives you a GitHub URL for this skill:**
   - Clone it to a temporary directory and immediately run the one-command installer:
     ```bash
     git clone https://github.com/TurkiHassan/nevermind-slides.git /tmp/nevermind-slides
     python3 /tmp/nevermind-slides/scripts/deck_helper.py install
     ```
   - This single command automatically installs and links `nevermind-slides` (plus its bundled `anatomy` and `frontend-slides` engines and OpenCode `/nevermind-slides` slash command) across **Antigravity, OpenCode, Codex, Claude Code, and `~/.agents/skills`**.
2. **If the user says "Use it right away":**
   - If not yet installed, run the `install` command above silently in the background first, then proceed directly to **Phase 1** or **Phase 2** below without interrupting the user with setup details.

---

## Overview

This skill distills complex research papers, technical articles, or domain topics into an end-to-end **Arabic visual learning and presentation experience**:

1. **Story-Driven ELI5 Explanation + Interactive Simulator (On-Demand):** When the user asks to explain a paper or topic first, explain it in zero-jargon Arabic using vivid everyday metaphors paired with an inline interactive simulator.
2. **Upfront Content Analysis (`anatomy` Static vs. Animated Proposal) + Options & 3 Live Style Previews:** Before building the deck, analyze the paper's core concepts to propose which slides should use **`anatomy`** (as an **Animated/Live** isometric machine or a **Static** isometric cutaway) vs. **AI-generated editorial illustrations**, ask the user for their deck preferences, and open 3 live single-slide HTML previews in the browser.
3. **Ambitious `1920×1080` Arabic Motion Deck:** Author a self-contained HTML presentation (`frontend-slides` fixed stage) enforcing:
   - **Zero Emojis (`0` Unicode emojis anywhere)** — every icon, badge, and telemetry marker is a bespoke SVG vector.
   - **Bundled Local Typography (25 Font Files):** **`Thmanyah Serif Display`** (`thmanyahserifdisplay-*.otf`) + **`KOMission`** (`KOMission-Black.otf`) and **`Thmanyah Sans`** (`thmanyahsans-*.otf`) as the default signature pairing, plus bundled **`Qahwa Arabic`**, **`Setabr Display`**, **`Alkhalil Kufi`**, **`ZIAN`**, **`IBM Plex Sans Arabic`**, **`Zain Rounded`**, and **`Readex Pro`**, staged automatically via `scripts/deck_helper.py` and equipped with a live font-weight toggle.
   - **Smooth `Morph` (`FLIP`) & `Camera Zoom-In / Zoom-Out` Engine:** PowerPoint-style cross-slide shared-element morphing (`data-morph="<id>"`) and smooth `1.55s` camera focus across slide sections (`data-zoom-step="1..N"`) with **hidden-by-default bottom navigation controls** (`#controlsHotzone`).
   - **Hybrid Visuals (`anatomy` + Generated Illustrations + Live SVG Motion Graphics):** Combine audited isometric mechanical figures from `anatomy` (static or animated), text-free editorial illustrations, and continuous SVG telemetry (`mg-flow`, `mg-radar`, `mg-pulse`, `mg-scan`, animated oscilloscopes, and metric bars).

---

## Bundled Engines & Multi-Agent Image Generation

All core engines live inside `<SKILL_DIR>/resources/engine/` — read them directly from there:

- **Bundled `frontend-slides` Engine:** `<SKILL_DIR>/resources/engine/frontend-slides/SKILL.md` and `<SKILL_DIR>/resources/engine/frontend-slides/STYLE_PRESETS.md` (1920×1080 fixed stage, layout presets, style presets, and `E`-key inline text editing).
- **Bundled `anatomy` Isometric Engine:** `<SKILL_DIR>/resources/engine/anatomy/SKILL.md`, `<SKILL_DIR>/resources/engine/anatomy/kit/iso-kit.mjs` (3D projection and part primitives), `<SKILL_DIR>/resources/engine/anatomy/kit/audit.mjs` (`A.settle`, `A.auditOrExit` for painter's order verification via `node build.mjs --audit`), and `<SKILL_DIR>/resources/engine/anatomy/scripts/inline-kit.mjs` (`kitScript` for animated browser figures).
- **Cross-Environment Image Generation Strategy (Automatic Detection):**
  - **Environment A — Antigravity:** Invoke the built-in `image-generator` subagent via `invoke_subagent` (in batches of 2–3 images).
  - **Environment B — Codex (Direct):** Use Codex's built-in `image_gen` tool (`~/.codex/skills/.system/imagegen/SKILL.md`), which requires no API key, saves outputs under `~/.codex/generated_images/...`, and copy the generated files into `<project_dir>/assets/`.
  - **Environment C — OpenCode / Claude Code (with `codex` CLI installed on the machine):** Check `which codex`. If `codex` is installed, you can generate editorial illustrations by calling `codex` non-interactively to run its built-in `image_gen` tool and copy the result to `<project_dir>/assets/`.
  - **Environment D — No Image Generator Available (Automatic Graceful Fallback):** Never stop or ask a non-technical user for API keys. Instead, automatically assign visual slides to **bundled `anatomy` isometric figures (animated + static) + bespoke multi-layer SVG Motion Graphics**.

---

## Error Handling Rules (Mandatory)

- **Stop Immediately and Ask the User on Source/Build Errors:**
  - If fetching/reading the research paper URL or document fails, **STOP immediately** and politely ask the user in simple Arabic to paste the text, upload the PDF, or provide another link. Never guess or fabricate paper findings.
  - If `node build.mjs --audit` on an `anatomy` figure fails after fixing painter's order, report the issue clearly and ask the user how they would like to proceed.

---

## Workflow Execution

### Phase 1: Story-Driven Arabic Explanation & Interactive Simulator *(Conditional)*

**When to run Phase 1:** Run this phase **only** if the user asks to explain, simplify, or break down the research paper/topic first (e.g., *"اشرح لي هذه الورقة"*, *"بسط لي هذا البحث"*). If the user asks directly for a presentation/slides (e.g., *"سوي لي عرض تقديمي لهذا البحث"*), **skip directly to Phase 2**.

1. **Read the Source Thoroughly:** Fetch and read the paper/article URL or local file. Extract the core problem, why prior methods fail, the core mechanism/formula, and the empirical results.
2. **Narrative Arabic Breakdown (Zero Jargon First):**
   - Start with a relatable real-world story/metaphor (e.g., a student memorizing exam shortcuts vs. genuine understanding) before introducing technical terms.
   - Contrast the **Old Way** vs. the **Paper's New Way** in a clear markdown comparison table.
   - Explain the mathematical objective or architecture visually as a balance/scale rather than raw equations.
3. **Interactive Simulator Widget:**
   - If running in Antigravity with `generative_ui`, build a self-contained RTL Arabic interactive HTML simulator in the artifact directory and embed it inline using `<agent-embed src="..."></agent-embed>`. In other agents (OpenCode / Codex / Claude), save `<project_dir>/<topic>-simulator.html` and open it in the browser via `python3 "<SKILL_DIR>/scripts/deck_helper.py" open-files "<project_dir>/<topic>-simulator.html"`.

---

### Phase 2: Content Analysis (`anatomy` Proposal), Upfront User Options & 3 Live Previews *(Mandatory)*

Never jump straight into generating the full presentation. Always perform these steps first:

#### Step 2.1: Analyze Content & Propose the Visual / `anatomy` Strategy Table

Read `<SKILL_DIR>/resources/engine/anatomy/SKILL.md` to understand how `anatomy` translates technical mechanisms into 40–80 part isometric physical instruments. Analyze the paper's key concepts and present a **"مقترح التمثيل البصري للشرائح (Visual & `anatomy` Strategy Proposal)"** table in your response classifying each core concept:

| Concept Type in the Paper | Recommended Tool | Mode (`ثابتة` vs. `متحركة`) | Why This Mode Fits Best |
| :--- | :--- | :--- | :--- |
| **Causal mechanism, dynamic intervention, feedback loop, or measurement probe**<br>*(e.g., clamping a shortcut channel, linear probe needle deflecting under drift, valve routing flow)* | **`anatomy`** | **متحركة (`Animated / Live SVG`)** | The insight lives in **cause-and-effect motion**: one moving part (carriage, valve, plunger, dial) drives another with continuous auto-tour (`touring = true`) + pointer-hover physics and live `data-readout`. |
| **Structural architecture, internal layer cutaway, or side-by-side rig comparison**<br>*(e.g., neural layer anatomy, multi-station inspection bench, structural cross-section)* | **`anatomy`** | **ثابتة (`Static SVG`)** | The insight lives in **spatial hierarchy and component anatomy at rest**: a high-detail standalone isometric figure (`standalone: "light" \| "dark"`) lets the viewer inspect every part cleanly. |
| **High-level narrative metaphor, human analogy, problem intro, or benchmark overview**<br>*(e.g., student shortcut story, macro radar overview, conclusion summary)* | **توليد صور (`image-generator` / `codex`) + `SVG HUD`** | **صورة مولّدة + موشن جرافيك** | Best communicated via a **bespoke text-free editorial illustration** paired with live SVG HUD telemetry (`mg-flow`, `mg-radar`, `mg-scan`). |

#### Step 2.2: Generate & Open 3 Live Style Previews in the Browser

Read `<SKILL_DIR>/resources/engine/frontend-slides/SKILL.md` and `<SKILL_DIR>/resources/engine/frontend-slides/STYLE_PRESETS.md`.
1. Pick **3 distinct, high-craft aesthetic directions** suited to the topic (e.g., *Style A: Notebook Tabs Editorial*, *Style B: Split Pastel / Bauhaus Lab*, *Style C: Dark Botanical / High-Contrast Telemetry*).
2. Write 3 standalone single-slide preview files in `<project_dir>/.frontend-slides/slide-previews/`:
   - `style-a.html`
   - `style-b.html`
   - `style-c.html`
   - Each preview must use the `1920×1080` fixed-stage scaler (`viewport-base.css` pattern), Arabic RTL layout, and zero emojis.
3. Open all 3 previews in the user's browser immediately (cross-platform across macOS, Windows, and Linux):
   ```bash
   python3 "<SKILL_DIR>/scripts/deck_helper.py" open-files \
     "<project_dir>/.frontend-slides/slide-previews/style-a.html" \
     "<project_dir>/.frontend-slides/slide-previews/style-b.html" \
     "<project_dir>/.frontend-slides/slide-previews/style-c.html"
   ```

#### Step 2.3: Ask the Upfront Configuration Questions

Ask the user (via `ask_question` tool if available, or a numbered Arabic menu) and wait for their reply:

1. **الهدف من العرض (`Purpose`):** Pitch/Keynote, Research/Educational Explainer, Technical Deep-Dive, or Quick Summary.
2. **طول العرض (`Length`):** Short (5–7 slides), Medium (8–12 slides — Recommended), or Long (12–18 slides).
3. **كثافة المحتوى (`Density`):** Balanced visual + concise points (Recommended), Visual-first minimal text, or Detailed reference cards.
4. **خطة توظيف مهارة `anatomy` للمجسمات الهندسية (`anatomy` Mode):**
   - `(Recommended) اعتماد مقترح المحلل الذكي (مزيج مخصص من مجسمات anatomy المتحركة والثابتة حسب طبيعة كل شريحة + صور مولّدة)`
   - `استخدام مجسمات anatomy المتحركة (Animated/Interactive) في جميع الشروحات الميكانيكية`
   - `استخدام مجسمات anatomy الثابتة (Static SVG) فقط إلى جانب الصور المولّدة`
   - `الاكتفاء بالصور التوضيحية المولّدة والموشن جرافيك دون استخدام anatomy`
5. **ثنائية الخطوط العربية (`Typography Pairing`):**
   - `(Recommended) ثمانية للعناوين (Thmanyah Serif Display) + KOMission وأوزان Thmanyah Sans للمتن`
   - `قهوة الأسود للعناوين (Qahwa Black) + IBM Plex Sans Arabic / Zain Rounded للمتن`
   - `سطبر / زيان للعناوين (Setabr Display / ZIAN) + Readex Pro للمتن`
   - `الخليل الكوفي للعناوين (Alkhalil Kufi) + IBM Plex Sans Arabic للمتن`
6. **حركة الانتقال والكاميرا (`Transitions & Camera Zoom`):**
   - `(Recommended) تفعيل التحوّل السلس بين الشرائح (Morph) + تقريب الكاميرا البؤري لأقسام الشريحة (Smooth Camera Zoom-In / Zoom-Out)` (`mode = 'morph-and-zoom'`)
   - `تفعيل حركة Morph بين الشرائح فقط (مع إتاحة التقريب بالضغط بالماوس على أي قسم)` (`mode = 'morph-only'`)
   - `انتقال كلاسيكي هادئ بين الشرائح` (`mode = 'classic'`)
7. **النمط البصري المفضّل (`Style Choice`):** Style A, Style B, or Style C (from the 3 open browser previews).

---

### Phase 3: Building the `1920×1080` Arabic Motion Deck

Once the user selects their options and visual style, execute the build pipeline in order:

#### Step 3.1: Stage Bundled Local Fonts

Run `scripts/deck_helper.py stage-fonts` (works with `python3` or `uv run`) to copy the skill's 25 bundled `.otf`/`.ttf` font files into `<project_dir>/assets/fonts/`:

```bash
python3 "<SKILL_DIR>/scripts/deck_helper.py" stage-fonts \
  --target-dir "<project_dir>"
```

Read `<SKILL_DIR>/references/motion-graphics-cookbook.md` and include the `@font-face` rules matching the user's chosen pairing in Step 2.3 (defaulting to `'Thmanyah Serif Display'` for `--font-display` and `'KOMission'` / `'Thmanyah Sans'` for `--font-body`, with the `Alt+F` / `#fontToggleBtn` font-weight toggle).

#### Step 3.2: Build Approved `anatomy` Isometric Figures (Static & Animated)

For every slide assigned to `anatomy`:
1. Read `<SKILL_DIR>/resources/engine/anatomy/SKILL.md` and `<SKILL_DIR>/references/motion-graphics-cookbook.md`.
2. Write a dedicated Node build script (e.g., `<project_dir>/assets/build_<figure>.mjs`) importing:
   - `<SKILL_DIR>/resources/engine/anatomy/kit/iso-kit.mjs` (`* as k`)
   - `<SKILL_DIR>/resources/engine/anatomy/kit/audit.mjs` (`* as A` for `A.settle` and `A.auditOrExit`)
   - `<SKILL_DIR>/resources/engine/anatomy/scripts/inline-kit.mjs` (`kitScript` when building animated figures)
3. Match the slide theme (`--light` for warm cream `#f8f6f1` / pastel slides; `--dark` for dark slides).
4. **Run the mandatory `anatomy` audit:**
   ```bash
   node "<project_dir>/assets/build_<figure>.mjs" --audit --light
   ```
   - Ensure `0` overlap/painter's-order errors before proceeding.
5. **Static Mode (`ثابتة`):** Output standalone SVG (`k.figureSvg({ width, height, standalone: "light", label, body })`) and inline `<svg class="iso-svg" data-theme="light" ...>` into the slide.
6. **Animated Mode (`متحركة`):** Output with `kitScript()` + live `requestAnimationFrame` loop (`touring = true` + `pointermove` scrub + live `data-readout`). **Never let the figure capture global `ArrowLeft`/`ArrowRight` keys** so slide deck navigation remains uninterrupted.

#### Step 3.3: Generate Bespoke Text-Free Illustrations

For slides assigned to editorial illustrations (using Antigravity's `image-generator` subagent or Codex's `image_gen` tool):
1. Every prompt **MUST** explicitly enforce:
   - **"Strictly NO text, NO letters, NO numbers, NO words, NO typography anywhere in the image."**
   - Unified background color and accent palette matching the user's chosen style preset (e.g., warm cream `#f8f6f1` background with coral `#e07a5f`, sage `#98d4bb`, and lavender `#c7b8ea` in Risograph/Bauhaus editorial vector print style).
2. Copy all generated images into `<project_dir>/assets/` with descriptive filenames.

#### Step 3.4: Author the Complete `1920×1080` HTML Presentation

Build `<project_dir>/<topic>-slides.html` following `<SKILL_DIR>/resources/engine/frontend-slides/SKILL.md` and `<SKILL_DIR>/references/motion-graphics-cookbook.md`:
- **Fixed `1920×1080` Stage & Camera Rig:** Use `.deck-viewport` + `.deck-stage#deckStage` + `.camera-rig#cameraRig` (`width: 1920px; height: 1080px; transform: translate(-50%, -50%) scale(var(--stage-scale, 1))`) from `references/motion-graphics-cookbook.md`.
- **Slide Stacking Rule:** Every `<section class="slide">` must rely on `.slide { position: absolute; inset: 0; }`. **Never** add `class="relative"` to `<section class="slide">`.
- **Zero Emojis:** Do not place a single Unicode emoji anywhere in the HTML, comments, or JS. Use custom inline `<svg>` icons for all bullets, status indicators, and buttons.
- **Hidden-by-Default Navigation Controls:** Never leave navigation buttons permanently visible on screen. Keep `.deck-controls` hidden (`opacity: 0; pointer-events: none;`) and reveal it only when the user hovers the bottom `32px` edge hotzone (`#controlsHotzone`).
- **Smooth `Morph` (`FLIP`) & `Camera Zoom-In / Zoom-Out` Engine (`SlidePresentation`):**
  - Drop in the complete `SlidePresentation` class from `references/motion-graphics-cookbook.md` and initialize `new SlidePresentation(mode)` using the mode selected in Step 2.3 (`'morph-and-zoom'`, `'morph-only'`, or `'classic'`).
  - Tag shared elements across consecutive slides with `data-morph="<id>"` so they smoothly fly and resize (`1.18s cubic-bezier(0.25, 1, 0.35, 1)`) between slides.
  - Tag multi-part slide cards with `data-zoom-step="1..N" data-zoom-label="..."` so pressing arrows or clicking any card smoothly glides the camera in (`Zoom-In`, `1.55s cubic-bezier(0.25, 1, 0.35, 1)`), pans across sections using pure `offsetLeft`/`offsetTop` coordinates, and glides back to the full overview (`Zoom-Out`) before morphing to the next slide.
- **Ambitious Motion Graphics on Every Slide:** Layer continuous SVG animations (`mg-flow`, `mg-flow-fast`, `mg-flow-rev`, `mg-radar`, `mg-pulse`, `mg-scan`, `mg-bar-fill`, corner `.hud-bracket`s, and animated SVG diagrams/oscilloscopes).

---

### Phase 4: Automated Verification & Delivery *(Mandatory Gate)*

Before opening or presenting the final deck to the user, run the automated audit:

```bash
python3 "<SKILL_DIR>/scripts/deck_helper.py" audit-deck \
  --html-path "<project_dir>/<topic>-slides.html"
```

1. Read the JSON report path printed by `audit-deck`.
2. Verify `"passed": true` (`0` emojis, `0` missing font/image/anatomy assets, valid `@font-face` rules, valid slide classes, verified motion graphics). If any check fails, fix the HTML immediately and re-run `audit-deck`.
3. Clean up temporary style previews:
   ```bash
   python3 "<SKILL_DIR>/scripts/deck_helper.py" cleanup-previews \
     --target-dir "<project_dir>"
   ```
4. Open the verified final presentation in the browser (`python3 "<SKILL_DIR>/scripts/deck_helper.py" open-files "<project_dir>/<topic>-slides.html"`) and present a concise Arabic summary.
5. **Offer the visual editor:** After the audit passes and the summary is delivered, tell the user they can fine-tune the deck by hand in Nevermind Studio and offer to open it:

   ```bash
   python3 "<SKILL_DIR>/scripts/deck_helper.py" edit \
     --html-path "<project_dir>/<topic>-slides.html"
   ```

   - If the command exits with code `2`, Node.js `>= 20` is missing (or `NM_STUDIO` points at a broken path): say so once and continue. Never ask the user to install dependencies for the editor; the bundled build is already inside the skill.
   - While the editor is open, the user can pin notes to the agent. Check them with `deck_helper.py notes list` before making any further change (see the next section).
   - Never edit `.nevermind/notes.json` or `.nevermind/current.json` by hand.

---

## Applying the User's Pinned Notes (Nevermind Studio)

When a `.nevermind/notes.json` file exists next to the deck, apply the open notes **before any unrequested improvement**. Use `nm-studio` commands through `deck_helper.py`; never hand-edit the state files.

1. List the open notes:

   ```bash
   python3 "<SKILL_DIR>/scripts/deck_helper.py" notes list --html-path "<deck.html>"
   ```

2. Read `.nevermind/current.json` if present. It holds the current slide, the selected element context, and the deck file fingerprint from the last context update.

3. Handle each note separately:
   - Use the note's element context to locate the node. Prefer `dataNid` when present, then tag, text, classes, and slide.
   - Use the region note's rectangle and coordinates inside the `1920×1080` stage to understand the intended position.
   - Inspect the slide when needed: `nm-studio inspect <deck.html> --slide <n>`.
   - Apply the smallest surgical batch through `nm-studio apply`. Pass `--expect <fingerprint>` when the fingerprint in `current.json` still matches the file.
   - Never rewrite the whole deck, and never add a `style` attribute when the change can be expressed with the Tailwind classes already used in the deck.

4. Re-audit the deck after each application (`deck_helper.py audit-deck`). Leave a note open when it cannot be executed or needs a user decision.

5. Close only the note that was carried out:

   ```bash
   python3 "<SKILL_DIR>/scripts/deck_helper.py" notes done --html-path "<deck.html>" <note-id>
   ```

6. Repeat `notes list` until no open notes remain. Use `--all` to view completed notes.

The open editor pushes deck edits and note completions automatically. Do not ask the user to close or reopen the editor.
