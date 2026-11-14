# Nevermind Runtime v2 — Contract

The single source of truth for how the bundled runtime files fit together. A deck author (any model, however small) never writes motion JavaScript: they link the runtime and describe intent with `data-*` attributes.

## 0. Hard constraints (every runtime file)

- **Classic scripts only.** No ES modules, no `import`, no build step, no dependencies, no network. Decks open from `file://`.
- **Chrome/Chromium is the only target.** Modern CSS/JS is fine (`linear()` easings, WAAPI, `:has()`, container queries, `structuredClone`).
- **Arabic RTL first.** `dir="rtl"` is the default. "Forward" in reading order is right-to-left: the next slide arrives from the left side and pushes toward the right unless stated otherwise. **Never split Arabic text into characters** (letters must stay joined); split by words at most.
- **Zero emojis** anywhere (code, comments, docs, UI labels). Icons are inline SVG.
- **Fixed stage 1920×1080.** All geometry is in stage pixels.
- **Never `display:none` a slide.** Inactive slides are `visibility:hidden; opacity:0` so layout can always be measured.
- **Reduced motion and `?nm-speed=0`** make every animation finish instantly with the same end state.
- Everything is namespaced: global `window.NM`, CSS classes `nm-*`, CSS variables `--nm-*`. Legacy class names listed below stay valid.
- Files live in `resources/engine/nm-runtime/` and are staged into `<project>/assets/nm/` next to the deck.

## 1. Files and owners

| File | Purpose |
|---|---|
| `nm-deck.css`, `nm-deck.js` | Core: stage scaling, navigation, step timeline, morph engine, slide transitions, entrances, camera, overview, chrome |
| `nm-focus.css`, `nm-focus.js` | Isolation acts: `focus`, `detail`, `lens`, `pins`, `slice` |
| `nm-diagram.css`, `nm-diagram.js` | Declarative diagrams, connectors between DOM nodes, small charts |
| `nm-media.css` | Image frames, focal crop, masks, duotone/grain treatments, slow camera moves |
| `scripts/image_fetch.py` | Web image search, download, crop, treat, credits |

Load order in a deck (end of `<body>`): `nm-deck.js`, then plugins in any order. CSS in `<head>`.

```html
<meta name="nm-runtime" content="2">
<link rel="stylesheet" href="assets/nm/nm-deck.css">
<link rel="stylesheet" href="assets/nm/nm-focus.css">
<link rel="stylesheet" href="assets/nm/nm-diagram.css">
<link rel="stylesheet" href="assets/nm/nm-media.css">
...
<script src="assets/nm/nm-deck.js"></script>
<script src="assets/nm/nm-focus.js"></script>
<script src="assets/nm/nm-diagram.js"></script>
```

## 2. DOM skeleton

```html
<body dir="rtl" data-nm-mode="morph-and-zoom">
  <div class="deck-viewport">
    <main class="deck-stage" id="deckStage">
      <section class="slide" data-title="..." data-transition="auto" data-rel="next">
        <div class="camera-rig"> ...slide content... </div>
      </section>
    </main>
  </div>
</body>
```

- If a slide has no `.camera-rig`, core wraps its children in one.
- Core injects everything else when missing: bottom controls (`#deckControls`, hidden until the bottom 32px hotzone `#controlsHotzone` is hovered), progress line, overview grid, key help, and two overlay layers inside the stage above all slides: `#nmGhostLayer` (morph ghosts) and `#nmOverlayLayer` (plugins).
- `<section class="slide">` never carries class `relative`.
- Body config attributes: `data-nm-mode` = `morph-and-zoom` (default) | `morph-only` | `classic`; `data-nm-transition` = deck default transition; `data-nm-automorph` = `on` (default) | `off`.
- Optional `window.NM_CONFIG = { fontModes: [{ className, label }], ... }` defined before `nm-deck.js`.

## 3. Global API (`window.NM`)

```js
NM.version            // 2
NM.deck               // the controller, set before plugins init
NM.use(plugin)        // plugin = { name, init(deck) }; runs now if the deck is ready, else at init
NM.registerAct(name, { enter(el, ctx), exit(el, ctx), reset(el, ctx), transient })
NM.geom.rectInStage(el)      // {x,y,w,h} in stage px, independent of viewport scale and camera
NM.geom.stageScale()         // current viewport scale factor
NM.layer('ghost' | 'overlay')// the overlay layer elements
NM.ease                      // named easings: { standard, emphasized, enter, exit, spring, springSoft, springBouncy } (CSS strings, springs as linear())
NM.dur                       // named durations in ms: { fast, base, slow, morph, camera }
NM.animate(el, keyframes, opts) // WAAPI wrapper that honours speed 0 / reduced motion; returns Animation
NM.speed                     // 1 normally, 0 when ?nm-speed=0 or reduced motion
NM.test.settle()             // Promise resolved when no runtime animation is pending
```

Controller:

```js
deck.slides; deck.index; deck.stepIndex; deck.mode
deck.next(opts); deck.prev(opts); deck.go(i, opts)
deck.refreshSteps(slideEl)       // re-read data-step attributes (plugins call it after adding steps)
deck.camera.to(elOrRect, { scale, pad, duration }); deck.camera.reset()
deck.on(name, fn)                // 'slidechange' | 'step' | 'ready' | 'beforeslidechange'
```

DOM events on `document`: `nm:ready`, `nm:beforeslidechange`, `nm:slidechange` (`detail: { from, to, slide }`), `nm:step` (`detail: { slide, step, dir }`).

State classes core maintains: `.slide.active` (also `.visible` for legacy CSS), `.slide.is-leaving`, `.is-on` on every step element that has been entered, `.is-current` on the step elements of the current step, `body.nm-ready`, `body.nm-overview`.

## 4. Step timeline (one numbering space per slide)

Any element inside a slide may carry `data-step="N"` (N ≥ 1) and `data-act="<act>"` (default `reveal`). Elements sharing N fire together. Arrow/space advance steps first, then the slide. `Shift+Arrow` skips steps.

| Act | Owner | Behaviour | Transient |
|---|---|---|---|
| `reveal` | core | element is hidden until its step, then plays its entrance | no |
| `zoom` | core | camera glides to the element, others dim | yes |
| `highlight` | core | element gets `.is-current` emphasis, nothing else changes | yes |
| `focus`, `detail`, `lens`, `pins`, `slice` | nm-focus | isolation acts | yes |
| `draw` | nm-diagram | strokes draw on | no |

A transient act is exited before the next step is entered and when leaving the slide. Legacy `data-zoom-step="N"` + `data-zoom-label` equals `data-step="N" data-act="zoom"`; in `morph-only` and `classic` modes zoom steps are skipped by arrows and reachable by click.

`ctx` passed to acts: `{ deck, slide, rig, step, dir, instant }`. `enter`/`exit` may return a Promise; core does not block navigation on it.

## 5. Morph and transitions (core)

- `data-morph="<id>"` on an element in two consecutive slides makes it a shared element. Optional: `data-morph-kind` = `box` | `text` | `image` | `path` | `number` (auto-detected), `data-morph-arc` = `auto` | `off` | `cw` | `ccw`, `data-morph-ease`, `data-morph-z`.
- Auto-morph (when on): identical heading text, identical `img[src]`, identical `data-node` ids pair up without tags.
- `data-transition` on the incoming slide: `auto` | `fade-through` | `push` | `zoom-through` | `iris` | `wipe` | `curtain` | `depth` | `fold` | `dissolve` | `none`. `data-rel` states the narrative relation and drives `auto`: `next`, `deeper`, `back-out`, `chapter`, `contrast`, `time`.
- Entrances (editor-compatible names): `data-entrance="rise|fade|clip|scale|blur|draw|type|count|slide"`, `data-entrance-order`, `data-entrance-delay` (ms). Core auto-staggers unmarked top-level blocks unless the slide has `data-entrance-auto="off"`.

## 6. Theme variables every file reads

`--nm-paper` (slide background), `--nm-ink` (text), `--nm-muted`, `--nm-line` (rules/edges), `--nm-accent`, `--nm-accent-2`, `--nm-surface` (cards), `--nm-radius`, `--nm-font-display`, `--nm-font-body`. Each file provides fallbacks so it works with no tokens defined. Legacy `--lp-accent`, `--slide-bg`, `--stage-bg` are honoured as fallbacks.

## 7. Legacy names that must keep working

`.deck-viewport`, `.deck-stage#deckStage`, `.slide`, `.slide.active`, `.slide.visible`, `.camera-rig`, `data-morph`, `data-zoom-step`, `data-zoom-label`, `#controlsHotzone`, `#deckControls`, `.deck-controls`, `data-entrance*`, `data-anatomy`, `.mg-flow`, `.mg-flow-fast`, `.mg-flow-rev`, `.mg-pulse`, `.mg-radar`, `.mg-radar-reverse`, `.mg-scan`, `.mg-drift`, `.mg-bar-fill`, `.bar-grow`, `.hud-bracket`, `<meta name="nm-runtime">`.
