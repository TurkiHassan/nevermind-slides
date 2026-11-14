# Isolation acts (nm-focus)

Use these to isolate part of a slide and add details. You write plain HTML with `data-*` attributes; `nm-focus.js` does all motion. Never write CSS or JS for these effects.

## Setup

Link after the core:

```html
<link rel="stylesheet" href="assets/nm/nm-focus.css">
<script src="assets/nm/nm-deck.js"></script>
<script src="assets/nm/nm-focus.js"></script>
```

## Rules for every act

- Put `data-step="N" data-act="<act>"` on the element to isolate. The act runs at step N and closes before the next step.
- Every act also opens when the presenter clicks the element. It closes with Esc, a click outside, or the next step.
- Give the element an `id` when it needs detail content.
- Detail content goes in `<template data-detail-for="ID">` anywhere in the slide, or in a hidden child `<div class="nm-detail">`.
- Inside detail content use plain tags: `<small>` (kicker), `<h3>` (title), `<p>`, `<ul>`/`<ol>`, `<table>`, and stat boxes: `<div class="nm-stats"><div class="nm-stat"><b>٤٢</b><span>شاشة</span></div></div>`.
- Keep detail content short: one title, one or two sentences, up to four bullets or three stats.
- Do not nest steps inside detail content.

## Which act when

| You want to | Use | Key attribute |
|---|---|---|
| Point at one thing, dim the rest | `focus` | `data-focus-note` |
| Walk through several items one by one | `focus` on each, consecutive steps | the spotlight travels |
| Read a small chart or region up close | `focus` + `data-focus-zoom` | |
| Explain a card with a full panel beside it | `detail` | `data-detail="side"` |
| Turn a card into a big hero card | `detail` | `data-detail="expand"` |
| Explain a table row or a wide element | `detail` | `data-detail="sheet"` |
| Add a short note to a small icon or badge | `detail` | `data-detail="popover"` |
| Magnify tiny labels in a diagram or map | `lens` | `data-lens="2.2"` |
| Label parts of an image or figure | `pins` | `.nm-pin` children |
| Insert a band of details between two rows | `slice` | `data-slice="below"` |
| Insert a column of details beside a column | `slice` | `data-slice="before"` or `"after"` |

## focus

Dims, blurs and desaturates everything except the element; an accent ring draws around it. Consecutive focus steps on one slide move the spotlight from item to item.

| Attribute | Values | Default |
|---|---|---|
| `data-focus-note` | short caption shown under the spotlight | none |
| `data-focus-zoom` | empty, or a max zoom such as `1.8` | off |
| `data-focus-shape` | `auto`, `rect`, `circle` | `auto` (round elements get a circle) |
| `data-focus-pad` | px around the element | `18` |

```html
<div class="card" data-step="1" data-act="focus" data-focus-note="أعلى نمو منذ عامين">...</div>
<div class="card" data-step="2" data-act="focus">...</div>
<div class="chart" data-step="3" data-act="focus" data-focus-zoom>...</div>
```

## detail

The element lifts out of the slide, the slide recedes, and a panel shows the detail content.

| Attribute | Values | Default |
|---|---|---|
| `data-detail` | `side`, `expand`, `sheet`, `popover`, `auto` | `auto` (`popover` for small elements, else `side`) |
| `data-detail-width` | panel width in px | side 820, expand 1360, popover 560 |
| `data-detail-id` | id to match templates when the element has no `id` | element `id` |
| `data-detail-text` | one-line text when you have no template | none |

- `side`: the element parks on the right half, the panel opens on the left (mirrored in LTR).
- `expand`: the element grows into a centred hero card holding the detail.
- `sheet`: a drawer rises from the bottom; the slide shifts up so the element stays visible.
- `popover`: a bubble opens next to the element on the side with most room.
- Pages: write several templates with the same `data-detail-for`. Arrow keys page through them before the next step; the panel shows dots and arrows.

```html
<div class="card" id="st2" data-step="1" data-act="detail" data-detail="side">...</div>
<template data-detail-for="st2">
  <small>المرحلة الثانية</small>
  <h3>التصميم والنمذجة</h3>
  <p>نحول المتطلبات إلى نماذج قابلة للتجربة قبل كتابة أي شيفرة.</p>
  <ul><li>ثلاث جولات اختبار</li><li>اعتماد المعمارية</li></ul>
</template>

<tr id="row-north" data-step="2" data-act="detail" data-detail="sheet">...</tr>
<template data-detail-for="row-north"><h3>لماذا تراجعت المبيعات؟</h3><p>...</p></template>

<div class="icon" id="ch-app" data-step="3" data-act="detail" data-detail="popover">...</div>
<template data-detail-for="ch-app"><small>١ من ٢</small><h3>التطبيق</h3><p>...</p></template>
<template data-detail-for="ch-app"><small>٢ من ٢</small><h3>خطة التطوير</h3><ul><li>...</li></ul></template>
```

## lens

A round magnifier flies out of the element, shows that region enlarged, and stays connected to it by a cone. Consecutive lens steps on one slide glide the lens to the next spot. Works on HTML elements and on SVG groups (`<g>`).

| Attribute | Values | Default |
|---|---|---|
| `data-lens` | magnification | `2.2` |
| `data-lens-size` | lens diameter in px | `440` |
| `data-lens-shape` | `circle`, `rect` | `circle` |
| `data-lens-offset` | `x,y` px from the element centre to the lens centre | auto (free space) |

```html
<g id="hub" data-step="1" data-act="lens">...</g>
<g id="port" data-step="2" data-act="lens" data-lens="3">...</g>
```

## pins

Numbered pins drop onto a figure; each has a leader line to a label card placed in free space around the figure. Each step drops one pin and earlier pins shrink to dots.

- Put `data-act="pins"` and `data-step="N"` on the figure container.
- Add one `<span class="nm-pin" data-x="62" data-y="40" data-label="العنوان">optional body</span>` per pin. `data-x`/`data-y` are percent of the container.
- A container with k pins uses steps N to N+k-1. Later steps on the slide shift automatically; do not renumber them yourself.

| Attribute (on the container) | Values | Default |
|---|---|---|
| `data-pins` | `all` to show every pin at one step | sequential |
| `data-pin-digits` | `arabic`, `latin` | `arabic` in RTL |
| `data-pin-width` | label card width in px | `360` |

```html
<div class="fig" data-step="1" data-act="pins" style="width:820px">
  <img src="assets/plant.jpg" alt="">
  <span class="nm-pin" data-x="27" data-y="62" data-label="الألواح الشمسية">٢٤٠ لوحا بقدرة ٥٥٠ واط</span>
  <span class="nm-pin" data-x="66" data-y="72" data-label="العاكس المركزي">كفاءة ٩٨٪</span>
</div>
```

Leave space beside the figure (keep it under about 1000px wide) so cards sit outside it.

## slice

The slide is cut along the element's edge, the two halves slide apart like paper, and a strip with the detail content appears between them. Closing stitches the slide back.

| Attribute | Values | Default |
|---|---|---|
| `data-slice` | `below`, `above`, `before`, `after` | `below` |
| `data-slice-size` | strip width in px for `before`/`after` | `640` |

`before`/`after` follow reading order: in RTL `before` is the right edge.

```html
<div class="card" id="ph2" data-step="1" data-act="slice" data-slice="below">...</div>
<template data-detail-for="ph2">
  <h3>مرحلة الأتمتة بالأرقام</h3>
  <div class="nm-stats"><div class="nm-stat"><b>٣١٢</b><span>إجراء</span></div></div>
</template>
```

## Do not

- Do not hide or style the overlay yourself; theme it only through `--nm-*` variables (`--nm-accent`, `--nm-surface`, `--nm-radius`, fonts).
- Do not put `data-act` isolation acts on the slide itself or on the `.camera-rig`.
- Do not use `<canvas>` or `<video>` as a `lens`/`slice` subject: clones show them blank.
