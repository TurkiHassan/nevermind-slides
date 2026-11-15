# Optional third-party runtime files

Not loaded by default. `deck_helper.py stage-runtime --math` (and `scaffold` when the plan has TeX) copies them
into `<project>/assets/nm/vendor/`; nothing here is ever fetched from the network.

| File | What | Version | License | Source |
|---|---|---|---|---|
| `temml.min.js` | TeX to MathML converter used by `nm-math.js` for `data-tex` | 0.14.0, unmodified `dist/temml.min.js` | MIT (`temml.LICENSE.txt`, Copyright (c) 2020 Ron Kok) | npm package `temml`, https://github.com/ronkok/Temml |

Native MathML needs none of this: Chromium renders `<math>` on its own.
