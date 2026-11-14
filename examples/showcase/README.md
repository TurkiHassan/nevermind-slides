# Showcase: رحلة الحاوية في ميناء حديث

A 14-slide Arabic deck built the way the skill tells a model to build one: `deck.plan.json` was linted with
`plan-lint`, turned into `deck.html` with `scaffold`, then filled in by hand following the references.
It exercises every runtime capability: image, box, words, path and number morphs; nine transitions chosen
by `data-rel`; reveal, zoom and highlight steps; focus (also with `data-focus-zoom`), detail (side and
popover), lens, pins and slice; flow, swimlane, bars, line and timeline diagrams (the flow re-lays out as a
swimlane on the next slide and every node flies); connectors between cards; nm-media frames, masks and
duotone images; the supply-port anatomy figure (static SVG with pins, and the live page in an iframe).

Fonts and the runtime are not committed. Stage them before opening the deck (from the repository root):

```bash
python3 scripts/deck_helper.py stage-fonts --target-dir examples/showcase
python3 scripts/deck_helper.py stage-runtime --target-dir examples/showcase
node resources/engine/anatomy/examples/supply-port/build.mjs --light
```

The last command builds the live port page used on the anatomy slide (built pages are not committed).

Then open `deck.html` in Chrome. Checks:

```bash
python3 scripts/deck_helper.py plan-lint --plan examples/showcase/deck.plan.json
python3 scripts/deck_helper.py audit-deck --html-path examples/showcase/deck.html
python3 scripts/deck_helper.py check --html-path examples/showcase/deck.html
python3 scripts/image_fetch.py credits --project examples/showcase --check examples/showcase/deck.html
```

The three photos are synthetic images drawn locally with Pillow (the build ran without network), registered
with `image_fetch.py fetch --url file://...`, then cropped with `fit` and given one duotone treatment with
`treat`. Their originals in `assets/img/src/` are not committed. `plate-waves.svg` is an `image_fetch.py
placeholder` plate. The live anatomy slide loads the page from
`resources/engine/anatomy/examples/supply-port/`, so open the deck from inside the repository.
