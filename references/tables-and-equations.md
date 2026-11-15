# Tables and equations

Files (staged by `stage-runtime`, linked by `scaffold` only when the deck has a table or a formula):
`assets/nm/nm-table.css` and `assets/nm/nm-math.css` in `<head>` after `nm-media.css`;
`assets/nm/nm-table.js` and `assets/nm/nm-math.js` at the end of `<body>` after `nm-diagram.js`.
Everything works from `file://` with no network.

## 1. Pick the representation

| The information is... | Use | Not |
|---|---|---|
| Exact values to compare across rows and columns (results, measurements, specs) | table | a bar chart with eight series |
| A trend, a proportion, one striking number | chart (`references/diagrams.md`) | a table |
| A law, a definition, a loss function | equation | a sentence that spells the formula out |
| How one formula becomes the next | derivation (`lines`) with `data-term` | three separate slides with no link |

## 2. Tables

```html
<figure class="nm-table" data-id="results" data-steps="row" data-highlight="r5">
  <table>
    <thead><tr><th scope="col">النموذج</th><th scope="col">الدقة (٪)</th><th scope="col">الزمن (مث)</th></tr></thead>
    <tbody>
      <tr><th scope="row">الأساسي</th><td>٧٩٫٨</td><td>٦٫١</td></tr>
      ...
    </tbody>
  </table>
  <figcaption>المصدر: ...</figcaption>
</figure>
```

- A real `<table>`: the editor edits its cells as text, the viewer can copy it, screen readers read it.
- Columns follow the deck direction: the first column is on the right in Arabic decks.
- Numeric columns are found by the runtime (60% of their cells are numbers, with units such as `%`, `٪`, `ms`) and aligned to the physical right in both directions: digits run left to right in Arabic and Latin alike, so the right edge lines up units with units. Write one number of decimals per column.
- Size: cells start at 28px. A table taller or wider than its figure is set smaller down to 20px (a console warning names it, and `check` reports C-TABLE if it still does not fit). A short table grows up to 36px; `data-no-grow` keeps 28px.
- Keep a table at 8 body rows x 6 columns or less. More rows: split, or move the detail to a `detail` act.

| Attribute (on the figure) | Values |
|---|---|
| `data-steps` | `row` (one step per body row), `col` (one per data column), `none` |
| `data-steps-act` | `reveal` (default: hidden until its step; the header stays visible), `highlight` (everything visible, the emphasis walks through rows or columns, header cell included) |
| `data-step-from` | first step number (default: after the slide's other steps); scaffold writes it |
| `data-highlight` | static emphasis: `r2` (body row 2), `c3` (data column 3; the row-header column is not counted), several separated by spaces |

Any `<tr>` or cell can also carry its own `data-step` and `data-act` by hand, and a `data-morph` (put it on a `<span>` inside the cell) to carry a value from the previous slide.

## 3. Equations

Native MathML is the default (decision D3): Chromium renders `<math>` with no library and no network.

```html
<figure class="nm-equation" data-id="speed">
  <math display="block"><mi data-term="v">v</mi><mo>=</mo><mi data-term="g">g</mi><mo>&#x2062;</mo><mi data-term="t">t</mi></math>
  <figcaption>السرعة تساوي التسارع مضروبًا في الزمن</figcaption>
</figure>
```

- Formulas read left to right inside Arabic slides: nothing to add (`<math>` keeps `direction: ltr`). An inline `<math>` inside an Arabic sentence stays in its place in the sentence.
- Display size: 88px for one formula, 64px for a derivation; a formula wider than its figure is set smaller, down to 36px (`--nm-eq-size` overrides the start size).
- A derivation is a figure with one `div.nm-eq-line` per formula, each with an optional `p.nm-eq-note`. Reveal the lines with `data-step` on the `div`; keep the first line without a step (it is what the previous slide ended on).
- **`data-term="x"`** on a part of a formula (an `<mi>`, an `<mrow>`) makes it a shared element: the same term on the next slide flies there with Morph. This is how a derivation moves across slides step by step. The runtime writes it as `data-morph="term-x"` unless the element has its own `data-morph`.
- No math font is bundled. macOS and Windows have one (STIX Two Math, Cambria Math); elsewhere the browser falls back and stretchy symbols (a long square root) may look plain.

### TeX (optional)

```html
<span class="nm-math" data-tex="t = \sqrt{\frac{2d}{g}}" data-display="block"></span>
```

`data-tex` needs the converter: `stage-runtime --math` copies Temml (MIT, 168 KB) into `assets/nm/vendor/`, and the deck links `assets/nm/vendor/temml.min.js` before `nm-math.js`. `scaffold` does both by itself when the plan writes TeX. The MathML Temml renders is generated (`data-nm-generated="math"`): never edit it, edit `data-tex`. In TeX, `\data{term=x}{x}` gives a part its `data-term`. Without the converter the TeX shows raw in a dashed box, the console names the fix, and `check` reports C-MATH.

Write TeX without `$` delimiters. Inline formulas in plan text: `\( ... \)`.

## 4. Checks

| Gate | What it catches |
|---|---|
| `plan-lint` R125 to R129 | ragged rows, a highlight on a missing row, a table above 8 x 6, an equation with no source or two, unsafe MathML, `$` delimiters, a derivation above 4 lines |
| `audit-deck` | a table or formula without its module linked, `data-tex` without the converter, unknown `data-steps`, `data-steps-act` or `data-highlight` values; table cells and formulas do not count as prose |
| `check` C-TABLE | a table that does not fit, cells below 20px, ragged rows |
| `check` C-MATH | TeX shown raw, `\frac` or `$x^2$` left in slide text, a `<math>` that renders nothing |

In the editor, a table cell edits like any text. A formula, and a sentence that holds one, is read-only for typing: double-click the formula to edit its source (MathML or TeX); the save changes one line.
