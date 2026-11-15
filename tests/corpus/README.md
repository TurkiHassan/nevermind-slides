# Golden corpus

Decks built only from files in this repository, with committed expectations ("goldens"). They answer one question
for every change: does the skill still write and play the decks it wrote before?

| Deck | Built from | What it covers |
|---|---|---|
| `ar-example` | `resources/templates/deck.plan.example.json` (scaffold) | every visual type, detail and focus steps, every `rel` |
| `ar-stubs-24` | `plans/ar-stubs-24.plan.json` (scaffold) | the largest allowed deck, the stub layout cycle, placeholders |
| `ar-showcase` | `examples/showcase` (hand-finished) | every morph kind, nine transitions, every isolation act, diagrams, charts, a live anatomy iframe |
| `en-general` | `plans/en-general.plan.json` (scaffold) | English, left to right: Morph of a title and a chart, every `rel`, rank steps, node focus, detail, compare, timeline, quote |
| `ar-bidi` | `plans/ar-bidi.plan.json` (scaffold) | Arabic dense with English terms, versions, units and years in parentheses; Western digits; a dark theme |
| `ar-science` | `plans/ar-science.plan.json` (scaffold) | Arabic physics: native MathML, a derivation revealed line by line whose `data-term` parts fly from the previous slide, inline TeX inside Arabic sentences and a TeX display formula (Temml staged by scaffold), an 8x5 measurement table with row steps and a static highlight, a 3x4 table with column highlight steps, a line chart, focus steps |
| `en-science` | `plans/en-science.plan.json` (scaffold) | English ML paper: architecture flow with rank steps, a TeX loss with inline TeX, a TeX derivation with a `data-term` morph, a 6x5 results table with row highlight steps, a training curve |

Not covered yet: error bars, scatter plots and pins on a figure in the science decks (NM-12).
Legacy v1 decks are covered by the editor suite (`editor/fixtures/legacy/`).

## Goldens

| File | Written by | Compared by |
|---|---|---|
| `golden/<deck>.scaffold.html` | `python3 tests/corpus/build.py --update` | `tests/python/test_corpus.py` (byte for byte) |
| `golden/<deck>.semantic.json` | `UPDATE_GOLDEN=1 npm test` in `tests/runtime` | `tests/runtime/corpus.test.mjs` (every slide and step) |

The semantic golden records logical state only (slide, step, which step elements are on, current and hidden, open
isolation act, overlay and ghost layers, camera at rest or moved, diagram nodes shown). It holds no pixels or
coordinates, so it does not depend on fonts, GPU or machine.

Builds use `NM_FONTS_BUNDLED_ONLY=1`: fonts a developer installed (Thmanyah, for example) never change the output.

## Changing a golden

Never regenerate a golden to make a test pass. A golden changes only when the change is intended:

1. Run the failing test and read the diff it prints.
2. Regenerate (`build.py --update` or `UPDATE_GOLDEN=1`), then `git diff tests/corpus/golden` and review every line.
3. Say in the commit message which change caused it and why the new output is right.
