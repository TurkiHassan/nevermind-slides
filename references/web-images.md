# Web image fallback

Use this only when no image-generation tool exists. Real images from the web, cropped and treated to fit the slide, with licences respected and credits recorded.

Script: `scripts/image_fetch.py` (Python 3.10+, stdlib only; Pillow optional). Styles: `resources/engine/nm-runtime/nm-media.css`. Demo: `resources/engine/nm-runtime/lab/media-lab.html`.

Exit codes: 0 ok, 1 failure, 2 bad usage, 3 network unavailable.

## Decision flow

1. Do you have an image-generation tool? Use it. Stop reading.
2. Pick the slot size from the layout (stage is 1920x1080). Full slide `1920x1080`, half slide `960x1080`, wide card `1200x675`, square `800x800`.
3. Pick the treatment from the deck palette. Photos from different sources must look like one set: use the same `--style` for every photo in the deck. Default: `duotone`.
4. Run `auto` (one call). If exit 3, run `placeholder` and move on. Never wait or retry in a loop.
5. If `auto` picks a poor image, rerun with `--pick 1`, `--pick 2`, or search by hand (below).
6. Paste the printed `<figure>` snippet into the slide. Load `nm-media.css`.
7. Add a sources slide with `credits`. Run `credits --check` before delivering.

## One call: search, fetch, fit, treat

```bash
python3 scripts/image_fetch.py auto \
  --query "desert dunes sunrise" --query-ar "كثبان رملية شروق" \
  --slot 1920x1080 --name hero --project DIR \
  --style duotone --ink "#1c1b19" --paper "#f8f6f1" --accent "#c83e37" \
  --placeholder-on-fail
```

Take `--ink`, `--paper`, `--accent` from the deck theme variables (`--nm-ink`, `--nm-paper`, `--nm-accent`). The command prints the final path and a ready `<figure class="nm-img ...">` with the credit caption. Use `--no-caption` if the credit lives only on the sources slide. Use `--alt "..."` for real alt text.

Write queries in English first (best coverage), add `--query-ar` for Arabic subjects. Name the concrete subject, not the idea: "oil refinery at dusk", not "energy security".

## Step by step

```bash
# 1. search (writes candidates.json, prints a ranked list)
python3 scripts/image_fetch.py search --query "old city street" --orientation landscape --min-width 1600 --out candidates.json

# 2. fetch candidate 0 (downloads to DIR/assets/img/src/NAME.ext and records credits)
python3 scripts/image_fetch.py fetch --candidate candidates.json#0 --name street --project DIR

# 3. fit to the slot (crop to ratio, focal point, resize)
python3 scripts/image_fetch.py fit --src DIR/assets/img/src/street.jpg --slot 960x1080 --trim

# 4. treat (bake the palette)
python3 scripts/image_fetch.py treat --src DIR/assets/img/street.jpg --style duotone --ink "#1c1b19" --paper "#f8f6f1" --in-place
```

Search options: `--license commercial` (default: CC0, PDM, CC BY, CC BY-SA), `public-domain` (CC0 and PDM only), `any-open` (adds NonCommercial; internal decks only). NoDerivatives is never returned because cropping modifies the image.

## Image found with your own web search tool

Download it with `fetch --url`. The licence flag is mandatory.

```bash
python3 scripts/image_fetch.py fetch --url "https://example.org/photo.jpg" --name map \
  --project DIR --license "CC BY 4.0" --creator "Name" --source-page "https://example.org/photo" --title "Old map"
```

If you cannot find the licence, pass `--license unknown`. The entry is recorded as `unverified` and the command warns. An unverified deck must not be shared publicly: tell the user. Prefer a candidate with a known licence.

## Focal point and crop

`fit` crops for real, never upscales above 1.25x, and warns when the source is too small (pick a larger image or a smaller slot).

- `--focus auto` (default): finds the busiest region and keeps it. Check the result visually.
- `--focus 70%,30%`: set it by hand when auto cuts the subject. X and Y are percentages of the source.
- `--trim`: removes black bars, white borders, letterboxing. Use it on screenshots, scans, maps.
- Output goes to `DIR/assets/img/NAME.jpg`. Use `--format webp` for smaller files, `png` for transparency.

Tool cascade: Pillow, then ImageMagick, then macOS `sips`, then none. With no tool, `fit` copies the source and prints `css_fallback` (object-position). Use the snippet with `--focus-x` and `--focus-y` and let CSS crop.

## Treatments

Baked (Pillow) or live (CSS, no Pillow needed). Never use both on the same image.

| Style | Look | Live class |
|---|---|---|
| `duotone` | shadows to ink, highlights to paper (accent adds a warm midtone) | `nm-duotone` |
| `mono` | neutral greyscale on the paper white point | `nm-mono` |
| `tint` | colour kept, pulled toward the accent | `nm-tint` |
| `none` | untouched | none |

Add `--grain 0.3` for film noise. Without Pillow, `treat` exits 0 and prints the `css_class` and `style_attr` to put on the figure.

## Frames, masks, motion (nm-media.css)

```html
<link rel="stylesheet" href="assets/nm/nm-media.css">
<figure class="nm-img nm-ar-16x9 nm-duotone" style="--focus-x:62%; --focus-y:38%">
  <img src="assets/img/hero.jpg" alt="...">
  <figcaption class="nm-credit">Creator &middot; CC BY 4.0</figcaption>
</figure>
```

- Aspect: `nm-ar-16x9`, `nm-ar-4x3`, `nm-ar-1x1`, `nm-ar-3x4`, `nm-ar-21x9`.
- Masks: `nm-mask-arch`, `nm-mask-circle`, `nm-mask-blob`, `nm-mask-slant`, `nm-mask-tab`, `nm-mask-notch`. They mirror in RTL by themselves.
- Live treatments: `nm-duotone`, `nm-mono`, `nm-tint`, `nm-grain`, `nm-vignette`, `nm-halftone` (halftone needs a light paper colour).
- Motion: `nm-kenburns` (only while `.slide.active`), `nm-parallax` with `.nm-px nm-px-1..3` layers, `nm-reveal-wipe` (reveals on `.is-on`, so make it a step element).
- Layouts: `nm-img-bleed` (full-slide background, scrim on the text side; put it first in the slide), `nm-img-stack` (2 to 3 tilted prints), `nm-img-strip` (film strip of 3 to 5).

Rules:
- Keep text off the busy part of the photo. Use `nm-img-bleed` for text over an image.
- One treatment per deck. Do not mix duotone and untouched photos.
- Do not put `nm-reveal-wipe` and a clip-path mask on the same element if you add your own clip-path.

## No network

Exit 3 prints an Arabic message and the fix. Generate a plate so no slide has an empty hole:

```bash
python3 scripts/image_fetch.py placeholder --slot 1200x675 --name hero --project DIR \
  --ink "#1c1b19" --paper "#f8f6f1" --accent "#c83e37" --motif topo
```

Motifs: `topo`, `waves`, `grid`, `rays`. Vary the motif between slides. Tell the user the plate can be replaced with a real image later (rerun `auto` with the same `--name`).

## Credits (required)

Every fetched image is recorded in `DIR/assets/img/credits.json` with title, creator, licence, links and the fit/treat result. Do not edit by hand.

```bash
# sources block for the closing slide (Arabic heading "مصادر الصور")
python3 scripts/image_fetch.py credits --project DIR --format html --deck DIR/index.html

# gate before delivery: exits 1 if any image under assets/img has no credits entry
python3 scripts/image_fetch.py credits --project DIR --check DIR/index.html
```

Paste the HTML block into a closing slide and style `.nm-sources` (small text, two columns). Placeholders are not listed (they are generated). Fix every "missing" line, and report every "unverified" line to the user.

## Environment

`NM_NO_PILLOW=1`, `NM_NO_MAGICK=1`, `NM_NO_SIPS=1` disable a tool (testing). `NM_OPENVERSE_API` and `NM_WIKIMEDIA_API` override provider URLs. `HTTPS_PROXY` and the system CA bundle are honoured. Requests carry a generic User-Agent and no personal data.
