# Morph and Motion (Nevermind Runtime v2, core)

You write plain HTML. The runtime (`nm-deck.js` + `nm-deck.css`) makes it move. Do not write motion JavaScript. Do not write CSS transitions on `.slide` or `.camera-rig`. Only add the attributes below.

## 1. Setup (copy as is)

```html
<head>
  <meta name="nm-runtime" content="2">
  <link rel="stylesheet" href="assets/nm/nm-deck.css">
</head>
<body dir="rtl" data-nm-mode="morph-and-zoom">
  <div class="deck-viewport">
    <main class="deck-stage" id="deckStage">
      <section class="slide" data-title="البداية">
        <div class="camera-rig"> ... </div>
      </section>
    </main>
  </div>
  <script src="assets/nm/nm-deck.js"></script>
</body>
```

Rules:
- One `<section class="slide">` per slide. Never put class `relative` on it. Never `display:none` a slide.
- Put the content inside `<div class="camera-rig">`. If you forget it, the runtime adds it.
- Do not add controls, progress bars, counters or key handlers. The runtime injects them.
- Stage is 1920 x 1080. Write sizes in px for that stage.

## 2. Morph: make one element fly from slide to slide

Give the element the same `data-morph` id on two consecutive slides.

```html
<!-- slide 1 -->
<div data-morph="card" style="width:300px;height:180px;border-radius:90px;background:#c8453a">بطاقة</div>
<!-- slide 2 -->
<div data-morph="card" style="width:1100px;height:600px;border-radius:12px;background:#17202a">بطاقة</div>
```

Position, size, corner radius, background, border, shadow and opacity all animate. Text inside never stretches.

| Attribute | Values | Use it when |
|---|---|---|
| `data-morph` | any id, same on both slides | always, to pair two elements |
| `data-morph-kind` | `box` `text` `words` `image` `path` `number` | only to override the auto choice (mostly `words`) |
| `data-morph-arc` | `auto` (default) `off` `cw` `ccw` | `off` for a straight flight; `cw`/`ccw` to choose the curve side |
| `data-morph-ease` | `spring` (default) `springSoft` `springBouncy` `standard` `emphasized` `move` or any CSS easing | `springBouncy` for playful, `springSoft` for calm |
| `data-morph-z` | number | the flying element must pass over/under another flier (higher = on top) |

Kinds (picked automatically; set `data-morph-kind` only to force):

| Kind | Picked when | Example |
|---|---|---|
| `box` | anything else (cards, panels, groups) | `<div data-morph="panel" class="card">...</div>` |
| `text` | text-only element, no background/border | `<h2 data-morph="t">العنوان</h2>` |
| `words` | never automatic. Set it. Matching words fly one by one | `<h1 data-morph="t" data-morph-kind="words">الحركة تصنع المعنى</h1>` then `<h1 data-morph="t" data-morph-kind="words">المعنى يصنع الحركة</h1>` |
| `image` | both are `<img>`. The crop (`object-fit`/`object-position`) morphs too | `<img data-morph="photo" src="a.jpg" style="object-fit:cover;border-radius:50%">` |
| `path` | both are SVG shapes: `path` `circle` `rect` `ellipse` `polygon` `polyline` `line` | `<circle data-morph="s" .../>` then `<polygon data-morph="s" .../>` |
| `number` | both contain one number with different values. Counts between them, keeps Arabic-Indic or Western digits, separators and suffix | `<p data-morph="n">١٢٬٥٠٠ ريال</p>` then `<p data-morph="n">٤٨٬٢٠٠ ريال</p>` |

Auto-morph (no attribute needed): identical heading text (`h1`-`h6`), identical `img src`, identical `data-node` id on two consecutive slides pair up by themselves. Turn off with `data-nm-automorph="off"` on `<body>` or on a slide.

Do:
- Keep the same id on exactly one element per slide.
- Morph 1 to 4 elements per transition. Let everything else enter fresh.
- Put `data-morph` on the outer card, not on both the card and its title.

Do not:
- Do not morph an element inside a step that is still hidden.
- Do not morph SVG shapes into HTML boxes (they will simply cross-fade).
- Do not split Arabic into letters. `words` is the smallest unit.

## 3. Slide transitions

Put `data-transition` on the INCOMING slide (the later one). Going back plays it in reverse.

| Value | Looks like | Use for |
|---|---|---|
| `auto` (default) | decided from `data-rel` and morphs | most slides |
| `fade-through` | old content drifts out, new content builds in; morphs carry the eye | same topic, shared elements |
| `push` | new slide pushes the old one sideways (from the left in RTL) | sequence, timeline |
| `zoom-through` | old slide grows and vanishes, new one comes from depth | going into detail |
| `iris` | circle opens from the first morph element (or centre) | reveal, highlight a result |
| `wipe` | hard edge sweeps across | contrast, before/after |
| `curtain` | old slide lifts up like a curtain | new chapter |
| `depth` | new slide slides up over the old one that recedes | stacking layers, next card |
| `fold` | 3D page turn | turning a page, new section |
| `dissolve` | old slide fades over the new one | quiet change, quotes |
| `none` | instant cut | final slide, surprise |

`data-rel` on the incoming slide drives `auto`:

| `data-rel` | auto becomes |
|---|---|
| `next` | `fade-through` if something morphs, else `push` |
| `deeper` | `zoom-through` (inward) |
| `back-out` | `zoom-through` (outward) |
| `chapter` | `curtain` |
| `contrast` | `wipe` |
| `time` | `push` |
| (none) | `fade-through` if something morphs, else `<body data-nm-transition="...">`, else `fade-through` |

### Which transition when (decision table)

| The next slide... | Write |
|---|---|
| shows the same thing bigger or rearranged | `data-morph` on it, no transition attribute |
| zooms into one part of this slide | `data-rel="deeper"` |
| returns to the overview | `data-rel="back-out"` |
| starts a new section | `data-rel="chapter"` |
| is the opposite / the problem vs the solution | `data-rel="contrast"` |
| is the next date or phase | `data-rel="time"` |
| is just the next point | nothing |

## 4. Entrances (play on every visit)

Unmarked top-level blocks of each slide rise in automatically, in reading order (right to left, top to bottom). Mark an element to choose its entrance:

```html
<h2 data-entrance="type">كل الكلمات تظهر تباعا</h2>
<div class="card" data-entrance="scale" data-entrance-order="2" data-entrance-delay="150">...</div>
<svg data-entrance="draw">...</svg>
<span data-entrance="count">١٬٢٥٠</span>
```

| `data-entrance` | Effect | Good for |
|---|---|---|
| `rise` | fades up 30px | default for text and cards |
| `fade` | opacity only | backgrounds, large images |
| `clip` | revealed from the reading start edge | titles, bars, images |
| `scale` | grows from 88% with a spring | icons, badges, numbers |
| `blur` | comes into focus | quotes, hero images |
| `slide` | slides in along the travel direction | list items |
| `draw` | SVG strokes draw on, then fills fade in | lines, icons, diagrams |
| `type` | words appear one by one (never letters) | short headlines |
| `count` | number counts up from zero | KPIs |
| `none` | no entrance | elements that must stay still |

- `data-entrance-order="N"`: N-th group (1, 2, 3...). Same N = together.
- `data-entrance-delay="ms"`: extra wait.
- `data-entrance-auto="off"` on a slide (or `<body>`): no automatic entrances, only marked elements animate.
- Elements that arrive by morph never play an entrance.

## 5. Steps inside a slide

Arrow keys run steps first, then move to the next slide.

```html
<li data-step="1">يظهر أولا</li>
<li data-step="2" data-entrance="slide">يظهر ثانيا</li>
<div class="card" data-step="3" data-act="highlight">يتم تمييزه</div>
<div class="card" data-step="4" data-act="zoom" data-zoom-label="التفاصيل">الكاميرا تقترب</div>
<div class="card" data-step="5" data-act="zoom">ثم تنتقل إلى هنا</div>
```

| `data-act` | Behaviour | Stays after the next step? |
|---|---|---|
| `reveal` (default) | hidden until its step, then plays its `data-entrance` (default `rise`) | yes |
| `highlight` | outline and lift on the element | no |
| `zoom` | camera glides to the element, the rest dims and blurs | no |
| `focus` `detail` `lens` `pins` `slice` | from `nm-focus.js` | no |
| `draw` | from `nm-diagram.js` | yes |

- Same number = same step. Numbers need not be consecutive.
- Consecutive `zoom` steps pan directly, without zooming out in between.
- Optional on zoom elements: `data-zoom-pad="120"` (px of margin), `data-zoom-scale="1.6"` (fixed zoom).
- Clicking an element with a `zoom` or `highlight` act jumps to it. Click elsewhere or press Esc to release.
- Legacy: `data-zoom-step="N" data-zoom-label="..."` equals `data-step="N" data-act="zoom"`.
- `<body data-nm-mode="morph-only">` or `classic`: zoom steps are skipped by arrows and only reachable by click. `classic` also turns off morphs.

## 6. Keys and controls

| Key | Action |
|---|---|
| Left arrow, Down, Space, PageDown | next step or slide (in `dir="ltr"` decks: Right arrow) |
| Right arrow, Up, PageUp | previous step or slide |
| Shift + arrow | skip steps, go straight to the next/previous slide |
| Home / End | first / last slide |
| O or G | overview grid; arrows to move, Enter to open, Esc to close |
| Z | zoom to the first zoom step, or release the zoom |
| Esc | release zoom/highlight; close overview or help |
| F | fullscreen |
| B or . | blackout |
| E | edit text in place |
| ? | key help |
| Swipe | next/previous on touch |

Controls appear when the mouse touches the bottom edge. A font button appears when you define, before `nm-deck.js`:

```html
<script>
  window.NM_CONFIG = { fontModes: [
    { className: '', label: 'الخط: الأساسي' },
    { className: 'font-mode-kufi', label: 'الخط: كوفي' }
  ] };
</script>
```

## 7. URLs

| URL | Effect |
|---|---|
| `deck.html#/3` | open slide 3 |
| `deck.html#/3/2` | open slide 3 at step 2 |
| `deck.html?nm-speed=0` | no animation, same final layout (audits, screenshots) |
| `deck.html?nm-speed=0.5` | everything at half speed (to inspect motion) |
| `deck.html?nm-print` | all slides stacked, every step shown, no controls (PDF, review) |

Reduced-motion users get the `nm-speed=0` behaviour automatically.

## 8. Theme variables the runtime reads

Define on `:root` to theme the chrome and highlights: `--nm-paper`, `--nm-ink`, `--nm-muted`, `--nm-line`, `--nm-accent`, `--nm-accent-2`, `--nm-surface`, `--nm-radius`, `--nm-font-display`, `--nm-font-body`. Legacy `--lp-accent`, `--slide-bg`, `--stage-bg` also work.

Legacy looping classes still work: `.mg-flow`, `.mg-flow-fast`, `.mg-flow-rev`, `.mg-pulse`, `.mg-radar`, `.mg-radar-reverse`, `.mg-scan`, `.mg-drift`, `.mg-bar-fill`, `.bar-grow`, `.hud-bracket`.

## 9. Checklist before you finish

1. Every slide is `<section class="slide">` with a `.camera-rig` inside.
2. Each `data-morph` id appears once per slide, on consecutive slides.
3. Titles that should swap words use `data-morph-kind="words"` on both.
4. Each slide has at most one `data-transition`, or a `data-rel`.
5. Steps are numbered from 1; zooms are on elements of reasonable size (cards, not single words).
6. Open `?nm-print` and check nothing is missing; open `?nm-speed=0` and check the layout.
