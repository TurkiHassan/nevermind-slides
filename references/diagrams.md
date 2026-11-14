# Diagrams, connectors, charts and slide layouts

Files: `assets/nm/nm-diagram.css`, `assets/nm/nm-layout.css` in `<head>`; `assets/nm/nm-diagram.js` at the end of `<body>` after `nm-deck.js`. Works without the core too.

Rules:
- Never position diagram parts by hand. Write the data, the plugin does layout, routing, sizing and animation.
- Keep labels short (1-4 words). Put detail in the second line after `|`.
- One accent per diagram. Mark the single most important node with `.accent` (graphs) or `!` (data lines).
- Give every diagram a `data-id`. The same `data-id` on the next slide morphs node by node.
- The figure fills its box. Put it in a layout cell (see Layouts) or give it a height.
- No emojis. Use `icon=name` for icons.

## 1. Pick the type

| The idea you want to show | `data-type` |
|---|---|
| Steps or a pipeline, with branches or loops | `flow` |
| Hierarchy, org chart, breakdown | `tree` |
| A repeating process (no start, no end) | `cycle` |
| One core thing and its parts or partners | `hub` |
| Events in time, milestones, roadmap | `timeline` |
| Architecture, stack, levels that sit on each other | `layers` |
| Prioritise items on two criteria | `matrix` |
| Drop-off between stages (with numbers) | `funnel` |
| Foundation-to-peak hierarchy of needs or value | `pyramid` |
| Overlap of 2-3 domains | `venn` |
| A process across teams / owners | `swimlane` |
| Messages between actors over time | `sequence` |
| Before / after, option A vs option B, point by point | `compare` |
| Compare quantities across categories | `bars` |
| Trend over time (1-3 series) | `line` |
| Share of a whole (2-6 parts) | `donut` |
| One value against a target or range | `gauge` |
| One to four headline numbers | `stat` |
| Arrows between your own cards | `data-links` (section 5) |

## 2. The figure

```html
<figure class="nm-diagram" data-type="flow" data-id="pipeline" data-steps="rank">
  <script type="text/nm-diagram">
    ...lines...
  </script>
</figure>
```

Attributes on the figure:

| Attribute | Values | Default |
|---|---|---|
| `data-type` | see table above | `flow` |
| `data-id` | any id; prefixes `data-morph` / `data-node` as `<data-id>:<nodeId>` | auto |
| `data-dir` | `rtl` `ltr` `ttb` `btt` (flow, tree, swimlane); `ttb` (timeline vertical); `ccw` (cycle) | flow: `rtl`, tree: `ttb` |
| `data-edges` | `ortho` `curve` `straight` (flow, tree) | `ortho` |
| `data-steps` | `none` `all` `rank` `node` `edge` `series` | `none` |
| `data-step-from` | first step number | slide max step + 1 |
| `data-flow` | `on`: dots run along edges while the slide is active | off |
| `data-orient` | `h` `v` (bars) | `h` |
| `data-area` | `on` (line: fill under the first series) | off |
| `data-numbers` | `off` (pyramid: hide tier numbers) | on |

Steps: `rank` reveals layer by layer, `node` one node at a time, `edge` one arrow at a time (best for `sequence`), `series` one bar / slice / series at a time. Arrows draw on (`data-act="draw"`), nodes rise in (`data-act="reveal"`). Without steps the whole figure animates in when its slide becomes active.

A `<figcaption>` inside the figure is kept as a caption under the drawing.

## 3. DSL grammar (graph types: flow, tree, cycle, hub, swimlane, sequence)

One statement per line. `#` starts a comment.

```
id[Label]            rectangle            id(Label)       pill
id((Label))          circle               id{Label}       diamond (decision)
id[Label | second line]                   two-line node
id[Label] icon=database                   icon (see list)
id.accent  id.muted  id.danger  id.ok  id.warn  id.strong  id.ghost   tone (on its own line or after the node)

a -> b        arrow              a -.-> b  or  a ~> b   dashed arrow
a <-> b       both ends          a => b                 thick accent arrow
a -- b        plain line         a -.- b                dashed plain line
a -> b -> c   chain              a -> b: label          edge label (last edge of the line)

group Name: a b c          soft container behind members (flow)
lane Name: a b c           swimlane row (swimlane)
actors: u[User], s[Server] actor order (sequence)
center: Text | sub         centre label (cycle) / centre node id or text (hub)
```

- Ids: letters (Latin or Arabic), digits, `_`. Declare a node once with its label, then use its id.
- A line with no arrow and spaces (`الفريق التقني`) is a plain node. In `tree`, indentation makes it a child of the line above.
- Back edges and cycles in `flow` are routed around the outside automatically.
- Mistakes do not break the slide: the line is skipped and `console.warn` names the figure and line.

JSON is accepted instead: `<script type="application/json">{"nodes":[{"id","label","sub","shape","icon","tone"}],"edges":[{"from","to","label","style":"dashed|solid|thick","arrow":"end|both|none"}],"groups":[{"name","ids":[]}]}</script>`.

Icons: `database server cloud user users document gear shield chart clock target bolt chip globe lock flag search layers arrow check spark link`.

## 4. Data lines (all other types)

`key: value | second line`, one per line. End a line with ` !` to highlight it. Numbers keep the digits you write (Arabic-Indic or Western).

### flow
```html
<figure class="nm-diagram" data-type="flow" data-id="pipeline" data-steps="rank">
  <script type="text/nm-diagram">
    in[المدخلات] icon=document -> enc[المشفّر] -> lat((الفضاء الكامن)) -> dec[المفكّك] -> out[المخرجات]
    lat -> probe{المسبار}: قياس
    dec -.-> enc: تغذية راجعة
    group الحلقة: enc lat dec
    enc.accent
  </script>
</figure>
```

### tree (indentation outline)
```html
<figure class="nm-diagram" data-type="tree" data-id="org" data-steps="rank">
  <script type="text/nm-diagram">
    إدارة المشروع | القيادة
      الفريق التقني
        الهندسة
        البيانات
      الفريق التشغيلي
        الدعم
  </script>
</figure>
```

### cycle
```html
<figure class="nm-diagram" data-type="cycle" data-id="pdca" data-steps="node">
  <script type="text/nm-diagram">
    center: التحسين | كل أسبوعين
    plan[التخطيط] icon=target
    do[التنفيذ] icon=gear
    check[القياس] icon=chart
    act[التعديل] icon=check
    plan.accent
  </script>
</figure>
```

### hub
```html
<figure class="nm-diagram" data-type="hub" data-id="eco">
  <script type="text/nm-diagram">
    core((المنصة الموحدة)).accent
    core -- a[المبيعات] icon=chart
    core -- b[المالية] icon=document
    core -- c[الأمن] icon=shield
  </script>
</figure>
```

### timeline
```html
<figure class="nm-diagram" data-type="timeline" data-id="road" data-steps="node">
  <script type="text/nm-diagram">
    ٢٠١٨: التأسيس | فريق من خمسة مهندسين
    ٢٠٢١: التوسع الإقليمي | ثلاث دول جديدة
    ٢٠٢٣: الذكاء الاصطناعي | محرك توصيات ذكي !
    ٢٠٢٦: الطرح العام
  </script>
</figure>
```
Add `data-dir="ttb"` for a vertical timeline (more than 7 items).

### layers (top line = top layer; items after the colon, comma separated)
```html
<figure class="nm-diagram" data-type="layers" data-id="stack" data-steps="rank">
  <script type="text/nm-diagram">
    الواجهة | ما يراه المستخدم: الويب، تطبيق الجوال
    الخدمات | منطق الأعمال: الطلبات، المدفوعات، الإشعارات !
    البيانات: قاعدة البيانات، مستودع البيانات
  </script>
</figure>
```

### matrix (x, y from 0 to 1; x grows along reading direction)
```html
<figure class="nm-diagram" data-type="matrix" data-id="prio">
  <script type="text/nm-diagram">
    x: الجهد | منخفض | مرتفع
    y: الأثر | منخفض | مرتفع
    quad: مكاسب سريعة | مشاريع كبرى | مهام هامشية | استنزاف
    أتمتة التقارير: 0.2, 0.85 !
    بوابة العملاء: 0.75, 0.8
  </script>
</figure>
```
`quad` order is reading order: top-start, top-end, bottom-start, bottom-end.

### funnel
```html
<figure class="nm-diagram" data-type="funnel" data-id="sales" data-steps="node">
  <script type="text/nm-diagram">
    الزيارات: ١٢٠٬٠٠٠ | من جميع القنوات
    التسجيل: ٤٨٬٠٠٠
    الشراء: ٦٬٢٠٠
  </script>
</figure>
```

### pyramid (first line = top)
```html
<figure class="nm-diagram" data-type="pyramid" data-id="needs">
  <script type="text/nm-diagram">
    الابتكار: تجارب جديدة تصنع الفارق
    السهولة: رحلة واضحة بلا عوائق
    الموثوقية: خدمة متاحة وآمنة دائمًا
  </script>
</figure>
```

### venn (2 or 3 sets; join keys with `&`)
```html
<figure class="nm-diagram" data-type="venn" data-id="innov">
  <script type="text/nm-diagram">
    أ: التقنية
    ب: التصميم
    ج: الأعمال
    أ&ب: تجربة المنتج
    أ&ب&ج: الابتكار !
  </script>
</figure>
```

### swimlane
```html
<figure class="nm-diagram" data-type="swimlane" data-id="proc" data-steps="node">
  <script type="text/nm-diagram">
    lane العميل: req ok
    lane المبيعات: rev
    lane المالية: approve inv
    req[تقديم الطلب] -> rev[مراجعة] -> approve{اعتماد} -> inv[الفاتورة] -> ok[الاستلام]
  </script>
</figure>
```

### sequence (dashed arrows for replies)
```html
<figure class="nm-diagram" data-type="sequence" data-id="pay" data-steps="edge">
  <script type="text/nm-diagram">
    actors: u[العميل] icon=user, app[التطبيق], pg[بوابة الدفع]
    u -> app: تأكيد الطلب
    app -> pg: طلب الدفع
    pg -.-> app: موافقة
  </script>
</figure>
```

### compare (`!` after a heading accents that column)
```html
<figure class="nm-diagram" data-type="compare" data-id="cmp" data-steps="rank">
  <script type="text/nm-diagram">
    head: الطريقة الحالية | المنصة الجديدة !
    السرعة: ثلاثة أيام | دقائق
    التكلفة: مرتفعة | منخفضة
  </script>
</figure>
```

### bars (axis always starts at zero)
```html
<figure class="nm-diagram" data-type="bars" data-id="growth" data-steps="series">
  <script type="text/nm-diagram">
    unit: ٪
    الشمال: ٤٢ !
    الوسط: ٣١
    الجنوب: ١٢
  </script>
</figure>
```
`data-orient="v"` for columns (use for 3-8 time periods).

### line (end labels replace the legend)
```html
<figure class="nm-diagram" data-type="line" data-id="mau" data-area="on" data-steps="series">
  <script type="text/nm-diagram">
    x: يناير, فبراير, مارس, أبريل
    series التطبيق: ١٢, ١٨, ٢٥, ٣١
    series الويب: ٢٠, ٢٢, ٢٣, ٢٦
  </script>
</figure>
```

### donut
```html
<figure class="nm-diagram" data-type="donut" data-id="mix" data-steps="series">
  <script type="text/nm-diagram">
    center: ٦٢٪ | من الاشتراكات
    الاشتراكات: ٦٢ !
    الخدمات: ٢١
    أخرى: ١٧
  </script>
</figure>
```

### gauge
```html
<figure class="nm-diagram" data-type="gauge" data-id="sla">
  <script type="text/nm-diagram">
    value: ٨٧
    max: 100
    unit: ٪
    label: مؤشر الرضا
    sub: الهدف ٩٠٪
  </script>
</figure>
```

### stat (numbers count up)
```html
<figure class="nm-diagram" data-type="stat" data-id="year" data-steps="series">
  <script type="text/nm-diagram">
    مستخدم نشط: ١٫٢ مليون | +٣٨٪ عن العام الماضي !
    دولة: ١٤
  </script>
</figure>
```

## 5. Connectors between your own elements

Tag elements with `data-node`, then declare links on the slide or any ancestor:

```html
<div class="nm-slide-pad nm-l-cards-3 nm-gap-wide" data-links="a>b: يغذّي; b>c@2; c~>a: مراجعة">
  <article class="nm-card" data-node="a">...</article>
  <article class="nm-card" data-node="b">...</article>
  <article class="nm-card" data-node="c">...</article>
</div>
```

`a>b` arrow, `a~>b` dashed arrow, `a<>b` both ends, `a-b` plain line, `: text` label, `@N` reveal on step N. Separate links with `;`. Sides, corners and spreading are automatic; links re-route on resize and font load. Add `data-links-style="curve"` for curves, `data-flow="on"` for running dots. Use `nm-gap-wide` so arrows have room.

## 6. Layouts (`nm-layout.css`)

Put one composition class next to `nm-slide-pad` on the rig's child. Never position with pixels.

```html
<section class="slide"><div class="camera-rig">
  <div class="nm-slide-pad nm-l-split" data-ratio="5:7"> ...two children... </div>
</div></section>
```

| Class | Children |
|---|---|
| `nm-l-title` | kicker, `nm-t-display` title, `nm-t-lead` |
| `nm-l-section` | `nm-section-num`, `nm-rule is-accent`, `nm-t-h1`, lead |
| `nm-l-split` + `data-ratio="1:1|5:7|7:5|golden"` | exactly two (text, figure) |
| `nm-l-hero-figure` | `nm-head`, then one figure |
| `nm-l-figure-full` | image or figure, then `figcaption` strip |
| `nm-l-bento-3|4|5|6` | optional `nm-head`, then 3-6 `nm-card` (first is largest) |
| `nm-l-cards-2|3|4` | optional `nm-head`, then equal cards |
| `nm-l-rail` | `aside` rail (context), main (evidence) |
| `nm-l-quote` | `blockquote`, `cite` |
| `nm-l-stat-row` | optional `nm-head`, then 2-6 blocks with `nm-t-num` + text |
| `nm-l-compare` | optional header, then two sides |
| `nm-l-steps` | optional `nm-head`, then 2-6 steps (auto-numbered) |

Type: `nm-t-display` 124, `nm-t-h1` 84, `nm-t-h2` 62, `nm-t-h3` 42, `nm-t-lead` 36, `nm-t-body` 30, `nm-t-caption` 24, `nm-t-num` 168 (px). Body text never below 28px.
Parts: `nm-head` (title group), `nm-kicker`, `nm-card` (`is-accent`, `is-quiet`), `nm-chip`, `nm-rule` (`is-accent`), `nm-span-1..12`, `nm-gap-wide`, theme presets `nm-theme-light` / `nm-theme-dark`.

## 7. Theme

Everything reads `--nm-paper --nm-ink --nm-muted --nm-line --nm-accent --nm-accent-2 --nm-surface --nm-radius --nm-font-display --nm-font-body`. Set them once on the deck; light and dark both work. Do not restyle diagram internals.

## 8. Checklist

- Type matches the concept (table 1).
- 3-9 nodes per diagram; split bigger ideas over two slides with the same `data-id`.
- One `.accent` / `!`.
- Labels short, second line after `|`.
- Figure sits in a layout cell. If the console says "content scaled to N%", shorten labels or give the figure more room.
