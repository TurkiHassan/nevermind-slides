# Runtime and editor end-to-end tests

Chromium tests for the runtime contract (`references/runtime-contract.md`), the golden corpus and the editor guard.
Not shipped with the skill.

```bash
cd tests/runtime
npm install && npx playwright install chromium   # once
npm test
# Claude Code cloud container (Playwright preinstalled globally):
NODE_PATH=$(npm root -g) npm test
```

| File | Checks |
|---|---|
| `contract.test.mjs` | API, navigation, deep links, byte-identical markup after steps forward and back, semantic round trip, semantic parity of full motion and `?nm-speed=0` at every position, morph targets ending where the instant render puts them, reduced motion, interruption, lab pages |
| `corpus.test.mjs` | every position of every corpus deck against `tests/corpus/golden/*.semantic.json`, plus invariants (one active slide, no ghosts, no running animations after settle, revealed elements shown, every transient act closed by the release step, diagrams armed and fully shown) |
| `visual.test.mjs` | the frame after full motion equals the instant frame, with thresholds calibrated on every run |
| `quality.test.mjs` | every visual quality code (NM-05, plus C-TABLE and C-MATH) fires on the slide of `tests/quality/violations` built to break it and stays silent on clean slides; the finished showcase raises only its three known diagram-fill notes; `quality.json` classifies every finding |
| `editor-guard.test.mjs` | the bundled editor refuses to write runtime-generated content, a no-op save is byte-identical, a supported edit changes one line; on `ar-science`: tables and formulas reported, formulas and sentences holding one read-only for typing, MathML, TeX and cell edits one line each, runtime table and term state never saved |
| `science.test.mjs` | tables and equations (NM-10, NM-11) on `ar-science` and `en-science`: Temml converts every `data-tex` offline, formulas run left to right and an inline formula keeps its place in an Arabic sentence, a derivation keeps its first line and its `data-term` parts fly as Morph ghosts, wide formulas shrink to fit, the raw-TeX fallback without the converter, numeric alignment, row and column steps, static highlight, the 20px floor and 36px growth, byte-identical round trip, motion and `?nm-speed=0` parity |

## Visual thresholds (calibrated, not uniform)

Measured on the showcase (Playwright 1.63.0 Chromium, 1920x1080, deviceScaleFactor 1):

| Measure | Value |
|---|---|
| two instant renders of a static slide (noise) | 0 |
| live animated iframe, unmasked (slide 5) | 0.00024 noise, 0.00101 motion vs instant |
| one word of a heading changed | 0.00216 |
| full motion vs instant, every slide, iframe masked | 0 to 0.00006 |

So a fixed threshold such as 0.5% of pixels would miss a one-word change. Each run measures the noise per slide,
uses `max(4 x noise, 0.0002)`, masks live iframes, and first proves that a one-word change exceeds the tolerance.
Pixels count as different when a channel differs by more than 24 (absorbs anti-aliasing).

## Pinned environment, and what still differs between a laptop and CI

Pinned: the Playwright version (`package.json`, exact) and so its Chromium build; viewport 1920x1080;
`deviceScaleFactor: 1`; `--font-render-hinting=none`; `reducedMotion` set per test; only the deck's own bundled
fonts (`NM_FONTS_BUNDLED_ONLY=1` when building the corpus).

Not pinned, and why the visual test does not compare against committed screenshots: the operating system's
FreeType and HarfBuzz builds and its fallback fonts (glyphs a bundled font lacks), GPU or software rasterisation.
These shift antialiasing between a laptop and the `ubuntu-latest` runner. Every visual comparison is therefore made
inside one run, on one machine (motion against instant, render against re-render). Committed pixel baselines are
deferred to NM-07, which would generate them inside a pinned container image.
