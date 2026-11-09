# Motion Graphics, Typography, `anatomy` & Morph/Camera Engine Cookbook

This reference provides the complete, drop-in CSS, `@font-face` rules, SVG motion graphics components, `anatomy` isometric build patterns, and the full JavaScript `SlidePresentation` controller (`Morph FLIP` + `1.55s Smooth Camera Zoom-In/Out` + `Auto-Hiding Controls`) for `1920×1080` HTML presentations built with `research-to-motion-slides`.

---

## 1. Local Typography (`25` Bundled Font Files in `resources/fonts/`)

Running `python3 "<SKILL_DIR>/scripts/deck_helper.py" stage-fonts --target-dir "<project_dir>"` copies all **25 bundled font files** into `<project_dir>/assets/fonts/`:
- **Thmanyah Serif Display** (`Light`, `Regular`, `Medium`, `Bold`, `Black` `.otf`)
- **Thmanyah Serif Text** (`Light`, `Regular`, `Medium`, `Bold`, `Black` `.otf`)
- **Thmanyah Sans** (`Light`, `Regular`, `Medium`, `Bold`, `Black` `.otf`)
- **KOMission** (`KOMission-Black.otf`)
- **Curated Tajmeea Display & Body Fonts:** `Qahwa-Arabic-Black.otf`, `SetabrDisplay-Regular.otf`, `Alkhalil-Kufi.otf`, `ZIAN-VF.ttf`, `IBMPlexSansArabic-Regular.ttf`, `IBMPlexSansArabic-Medium.ttf`, `IBMPlexSansArabic-SemiBold.ttf`, `ZainRounded-VF.ttf`, `ReadexPro-VF.ttf`

Paste this `@font-face` and token block into your presentation's `<style>` section:

```css
/* ==========================================
   1. BUNDLED LOCAL FONTS (assets/fonts/)
   ========================================== */
@font-face {
  font-family: 'Thmanyah Display';
  src: url('assets/fonts/thmanyahserifdisplay-Light.otf') format('opentype');
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Display';
  src: url('assets/fonts/thmanyahserifdisplay-Regular.otf') format('opentype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Display';
  src: url('assets/fonts/thmanyahserifdisplay-Medium.otf') format('opentype');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Display';
  src: url('assets/fonts/thmanyahserifdisplay-Bold.otf') format('opentype');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Display';
  src: url('assets/fonts/thmanyahserifdisplay-Black.otf') format('opentype');
  font-weight: 900;
  font-display: swap;
}

@font-face {
  font-family: 'KOMission';
  src: url('assets/fonts/KOMission-Black.otf') format('opentype');
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: 'Thmanyah Sans';
  src: url('assets/fonts/thmanyahsans-Light.otf') format('opentype');
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Sans';
  src: url('assets/fonts/thmanyahsans-Regular.otf') format('opentype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Sans';
  src: url('assets/fonts/thmanyahsans-Medium.otf') format('opentype');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Sans';
  src: url('assets/fonts/thmanyahsans-Bold.otf') format('opentype');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Thmanyah Sans';
  src: url('assets/fonts/thmanyahsans-Black.otf') format('opentype');
  font-weight: 900;
  font-display: swap;
}

/* Curated Tajmeea Display & Body Fonts */
@font-face {
  font-family: 'Qahwa Arabic';
  src: url('assets/fonts/Qahwa-Arabic-Black.otf') format('opentype');
  font-weight: 900;
  font-display: swap;
}
@font-face {
  font-family: 'Setabr Display';
  src: url('assets/fonts/SetabrDisplay-Regular.otf') format('opentype');
  font-weight: 400 800;
  font-display: swap;
}
@font-face {
  font-family: 'Alkhalil Kufi';
  src: url('assets/fonts/Alkhalil-Kufi.otf') format('opentype');
  font-weight: 400 800;
  font-display: swap;
}
@font-face {
  font-family: 'ZIAN';
  src: url('assets/fonts/ZIAN-VF.ttf') format('truetype');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'IBM Plex Sans Arabic';
  src: url('assets/fonts/IBMPlexSansArabic-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'IBM Plex Sans Arabic';
  src: url('assets/fonts/IBMPlexSansArabic-Medium.ttf') format('truetype');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'IBM Plex Sans Arabic';
  src: url('assets/fonts/IBMPlexSansArabic-SemiBold.ttf') format('truetype');
  font-weight: 600 700;
  font-display: swap;
}
@font-face {
  font-family: 'Zain Rounded';
  src: url('assets/fonts/ZainRounded-VF.ttf') format('truetype');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'Readex Pro';
  src: url('assets/fonts/ReadexPro-VF.ttf') format('truetype');
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --lp-font-display: 'Thmanyah Display', serif;
  --lp-font-body: 'KOMission', 'Thmanyah Sans', sans-serif;
  --lp-font-mono: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
}

/* Live Font Pairing Classes on <body> */
body.font-mode-sans {
  --lp-font-display: 'Thmanyah Display', serif;
  --lp-font-body: 'Thmanyah Sans', 'KOMission', sans-serif;
}
body.font-mode-qahwa {
  --lp-font-display: 'Qahwa Arabic', sans-serif;
  --lp-font-body: 'IBM Plex Sans Arabic', 'Zain Rounded', sans-serif;
}
body.font-mode-setabr {
  --lp-font-display: 'Setabr Display', 'ZIAN', sans-serif;
  --lp-font-body: 'Readex Pro', 'IBM Plex Sans Arabic', sans-serif;
}
body.font-mode-kufi {
  --lp-font-display: 'Alkhalil Kufi', sans-serif;
  --lp-font-body: 'IBM Plex Sans Arabic', sans-serif;
}
```

---

## 2. Stage Mechanics, Auto-Hiding Controls & SVG Motion Graphics CSS

Every presentation uses `.deck-viewport` -> `.deck-stage#deckStage` (`1920×1080`) -> `<section class="slide">` -> `.camera-rig`. Navigation controls (`.deck-controls`) are **hidden by default** (`opacity: 0; pointer-events: none;`) and reveal only when hovering `#controlsHotzone` at the bottom 32px edge of the screen.

```css
/* ==========================================
   2. 1920x1080 FIXED STAGE & AUTO-HIDE CHROME
   ========================================== */
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: var(--stage-bg, #1c1b19);
}
.deck-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--stage-bg, #1c1b19);
}
.deck-stage {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  transform-origin: 0 0;
  background: var(--slide-bg, #262523);
}
.slide {
  position: absolute !important;
  inset: 0;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  display: block;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  background: var(--slide-bg, #262523);
  transition: opacity 0.95s cubic-bezier(0.22, 1, 0.36, 1),
              visibility 0.95s cubic-bezier(0.22, 1, 0.36, 1);
}
.slide.active,
.slide.visible {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  z-index: 2 !important;
}
.slide.morph-leaving {
  visibility: visible !important;
  opacity: 0 !important;
  pointer-events: none !important;
  z-index: 0 !important;
}

/* Auto-Hiding Bottom Controls (Hidden by default) */
.deck-controls {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%) translateY(16px);
  z-index: 1000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.deck-controls.show {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

/* Smooth 1.55s Camera Rig & Spotlight Zoom-In / Zoom-Out */
.camera-rig {
  transform-origin: 0 0;
  transition: transform 1.55s cubic-bezier(0.25, 1, 0.35, 1);
  will-change: transform;
}
[data-zoom-step] {
  position: relative;
  cursor: zoom-in;
  transition: opacity 1.2s cubic-bezier(0.25, 1, 0.35, 1),
              filter 1.2s cubic-bezier(0.25, 1, 0.35, 1),
              box-shadow 1.2s cubic-bezier(0.25, 1, 0.35, 1);
}
[data-zoom-step]:hover {
  box-shadow: 0 10px 28px rgba(26, 26, 26, 0.14), 0 0 0 2px rgba(200, 62, 55, 0.45);
}
.slide.is-camera-zoomed [data-zoom-step]:not(.zoom-focused) {
  opacity: 0.25 !important;
  filter: blur(1.2px) grayscale(20%);
}
.slide.is-camera-zoomed [data-zoom-step].zoom-focused {
  opacity: 1 !important;
  filter: none !important;
  cursor: zoom-out;
  z-index: 30;
  box-shadow: 0 24px 60px rgba(26, 26, 26, 0.25), 0 0 0 3px var(--lp-accent, #c83e37) !important;
}
[data-morph] {
  will-change: transform, opacity;
}

/* ==========================================
   3. CONTINUOUS SVG MOTION GRAPHICS
   ========================================== */
@keyframes dashFlow {
  to { stroke-dashoffset: -120; }
}
@keyframes dashFlowReverse {
  to { stroke-dashoffset: 120; }
}
@keyframes pulseRing {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50%      { transform: scale(1.18); opacity: 0.25; }
}
@keyframes radarSweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes scanLineY {
  0%, 100% { transform: translateY(0px); opacity: 0.75; }
  50%      { transform: translateY(270px); opacity: 0.95; }
}
@keyframes driftNode {
  0%, 100% { transform: translate(0px, 0px); }
  50%      { transform: translate(-42px, -22px); }
}

.mg-flow {
  stroke-dasharray: 10 8;
  animation: dashFlow 3.2s linear infinite;
}
.mg-flow-fast {
  stroke-dasharray: 8 6;
  animation: dashFlow 1.8s linear infinite;
}
.mg-flow-rev {
  stroke-dasharray: 8 8;
  animation: dashFlowReverse 2.4s linear infinite;
}
.mg-pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: pulseRing 2.6s ease-in-out infinite;
}
.mg-radar {
  transform-box: fill-box;
  transform-origin: center;
  animation: radarSweep 9s linear infinite;
}
.mg-radar-reverse {
  transform-box: fill-box;
  transform-origin: center;
  animation: radarSweep 14s linear infinite reverse;
}
.mg-scan {
  animation: scanLineY 4.2s ease-in-out infinite;
}
.mg-drift {
  animation: driftNode 3.6s ease-in-out infinite;
}
.mg-bar-fill, .bar-grow {
  transform-origin: right center;
  transform: scaleX(0);
  transition: transform 1.15s cubic-bezier(0.16, 1, 0.3, 1) 0.35s;
}
.slide.visible :is(.mg-bar-fill, .bar-grow) {
  transform: scaleX(1);
}
```

---

## 3. Complete Drop-In HTML Chrome & JavaScript Controller (`Morph` + `Camera Zoom` + `Inline Editor`)

Include this exact HTML chrome and `<script>` block in your presentation so `Morph (FLIP)`, `1.55s Smooth Camera Zoom-In / Zoom-Out`, `Auto-Hiding Controls`, `Font Switching`, and `E-key Inline Editing` work out of the box:

```html
<!-- === INLINE EDITING CHROME (NO EMOJIS) === -->
<div class="edit-hotzone fixed top-0 left-0 w-[80px] h-[80px] z-[10000] cursor-pointer"></div>
<button id="editToggle" title="وضع التعديل المباشر (E)"
        class="edit-toggle fixed top-[16px] left-[16px] z-[10001] opacity-0 pointer-events-none transition-opacity duration-300 px-[16px] py-[8px] rounded-full bg-page text-ink font-body font-bold text-[14px] shadow-[0_6px_20px_rgba(0,0,0,0.4)] border border-ink/20 flex items-center gap-[8px]">
  <svg class="w-[14px] h-[14px] stroke-ink fill-none stroke-[2]" viewBox="0 0 24 24">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
  <span id="editLabel">تعديل النصوص (E)</span>
</button>

<!-- === AUTO-HIDING BOTTOM CONTROLS (Hidden by default; reveal on bottom-edge hover) === -->
<div id="controlsHotzone" class="fixed bottom-0 left-0 right-0 h-[32px] z-[999]"></div>
<nav id="deckControls" class="deck-controls flex items-center gap-[10px] px-[20px] py-[9px] rounded-full bg-outer/95 backdrop-blur-md border border-page/15 text-page shadow-[0_10px_36px_rgba(0,0,0,0.55)] font-body text-[14px]" aria-label="التحكم في الشرائح">
  <button id="prevBtn" class="px-[14px] py-[5px] rounded-full hover:bg-page/15 transition font-bold flex items-center gap-[6px]">
    <svg class="w-[14px] h-[14px] stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    <span>السابق</span>
  </button>
  <span id="slideCounter" class="font-mono text-[14px] px-[8px] text-tab-cream font-semibold" dir="ltr">01 / 08</span>
  <button id="nextBtn" class="px-[14px] py-[5px] rounded-full bg-tab-mint text-ink font-bold hover:opacity-90 transition flex items-center gap-[6px]">
    <span>التالي</span>
    <svg class="w-[14px] h-[14px] stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24"><path d="M19 12H5M11 19l-7-7 7-7"/></svg>
  </button>
  <div class="w-[1px] h-[18px] bg-page/20 mx-[2px]"></div>
  <button id="cameraStatusBtn" onclick="deck.resetZoomOrStep()" class="px-[12px] py-[4px] rounded-full bg-tab-sky/20 border border-tab-sky/40 hover:bg-tab-sky/30 text-tab-sky text-[13px] transition flex items-center gap-[6px]">
    <svg class="w-[14px] h-[14px] stroke-current fill-none stroke-[2.2]" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
    </svg>
    <span id="cameraStatusLabel">الكاميرا: نظرة عامة</span>
  </button>
  <button id="motionModeBtn" onclick="deck.cycleMotionMode()" class="px-[12px] py-[4px] rounded-full bg-tab-lavender/20 border border-tab-lavender/40 hover:bg-tab-lavender/30 text-tab-lavender text-[13px] transition font-bold">
    <span id="motionModeLabel">الحركة: Morph + Zoom بالأسهم</span>
  </button>
  <div class="w-[1px] h-[18px] bg-page/20 mx-[2px]"></div>
  <button id="fontToggleBtn" onclick="cycleFontMode()" class="px-[12px] py-[4px] rounded-full bg-page/10 hover:bg-page/20 text-page/90 text-[13px] transition font-mono">
    <span id="fontModeLabel">الخط: ثمانية + KOMission</span>
  </button>
</nav>

<div class="deck-viewport">
  <main class="deck-stage" id="deckStage">
    <!-- Each slide wraps its main inner page/card in class="camera-rig" -->
    <!-- Tag shared elements across slides with data-morph="unique-id" -->
    <!-- Tag focusable cards inside a slide with data-zoom-step="1" data-zoom-label="عنوان القسم" -->
  </main>
</div>

<script>
  let currentFontMode = 0;
  const fontModes = [
    { className: '', label: 'الخط: ثمانية + KOMission' },
    { className: 'font-mode-qahwa', label: 'الخط: قهوة Black + IBM Plex' },
    { className: 'font-mode-setabr', label: 'الخط: سطبر Display + Readex Pro' },
    { className: 'font-mode-kufi', label: 'الخط: الخليل الكوفي + IBM Plex' },
    { className: 'font-mode-sans', label: 'الخط: ثمانية Display + ثمانية Sans' }
  ];
  function cycleFontMode() {
    currentFontMode = (currentFontMode + 1) % fontModes.length;
    document.body.classList.remove('font-mode-sans', 'font-mode-qahwa', 'font-mode-setabr', 'font-mode-kufi');
    if (fontModes[currentFontMode].className) {
      document.body.classList.add(fontModes[currentFontMode].className);
    }
    document.getElementById('fontModeLabel').textContent = fontModes[currentFontMode].label;
  }

  class SlidePresentation {
    constructor(defaultMotionMode = 'morph-and-zoom') {
      this.slides = Array.from(document.querySelectorAll('.slide'));
      this.currentSlide = 0;
      this.currentZoomIndex = -1;
      this.camScale = 1;
      this.stageScaleFactor = 1;
      this.stage = document.getElementById('deckStage');
      this.counterEl = document.getElementById('slideCounter');
      this.cameraStatusEl = document.getElementById('cameraStatusLabel');
      this.motionModeEl = document.getElementById('motionModeLabel');
      this.motionMode = defaultMotionMode; // 'morph-and-zoom' | 'morph-only' | 'classic'

      this.initCameraRigsAndClickZoom();
      this.setupStageScale();
      this.setupKeyboardNav();
      this.setupTouchNav();
      this.setupButtons();
      this.showSlide(0, { skipMorph: true });
    }

    initCameraRigsAndClickZoom() {
      this.slides.forEach((slide, sIdx) => {
        const card = slide.querySelector('.camera-rig') || slide.querySelector('.bg-lp-bg') || slide.firstElementChild;
        if (card) card.classList.add('camera-rig');

        const zoomItems = this.getZoomItems(slide);
        zoomItems.forEach((item, zIdx) => {
          item.addEventListener('click', (e) => {
            if (e.target.closest('button, a, [contenteditable="true"]')) return;
            e.stopPropagation();
            if (this.currentSlide !== sIdx) return;
            this.zoomToIndex(this.currentZoomIndex === zIdx ? -1 : zIdx);
          });
        });

        slide.addEventListener('click', (e) => {
          if (this.currentSlide === sIdx && this.currentZoomIndex !== -1 && !e.target.closest('[data-zoom-step]')) {
            this.zoomToIndex(-1);
          }
        });
      });
    }

    getZoomItems(slide) {
      return Array.from(slide.querySelectorAll('[data-zoom-step]')).sort(
        (a, b) => Number(a.dataset.zoomStep || 0) - Number(b.dataset.zoomStep || 0)
      );
    }

    getLayoutBoxInRig(el, rig) {
      let x = 0, y = 0, cur = el;
      while (cur && cur !== rig && rig.contains(cur)) {
        x += cur.offsetLeft || 0;
        y += cur.offsetTop || 0;
        cur = cur.offsetParent;
      }
      return { x, y, w: el.offsetWidth || 240, h: el.offsetHeight || 180 };
    }

    setupStageScale() {
      const scale = () => {
        this.stageScaleFactor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        const x = (window.innerWidth - 1920 * this.stageScaleFactor) / 2;
        const y = (window.innerHeight - 1080 * this.stageScaleFactor) / 2;
        this.stage.style.transform = `translate(${x}px, ${y}px) scale(${this.stageScaleFactor})`;
      };
      scale();
      window.addEventListener('resize', scale);
    }

    setupButtons() {
      document.getElementById('nextBtn')?.addEventListener('click', () => this.next());
      document.getElementById('prevBtn')?.addEventListener('click', () => this.prev());
    }

    setupKeyboardNav() {
      document.addEventListener('keydown', (e) => {
        if (e.target.getAttribute('contenteditable') === 'true') return;
        if (e.key === 'Escape') {
          if (this.currentZoomIndex !== -1) { e.preventDefault(); this.zoomToIndex(-1); }
          return;
        }
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          this.resetZoomOrStep();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          this.next({ skipZoomSteps: e.shiftKey });
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          this.prev({ skipZoomSteps: e.shiftKey });
        } else if (e.key === 'Home') {
          e.preventDefault();
          this.showSlide(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          this.showSlide(this.slides.length - 1);
        }
      });
    }

    setupTouchNav() {
      let startX = 0;
      window.addEventListener('touchstart', (e) => { startX = e.changedTouches[0].screenX; }, { passive: true });
      window.addEventListener('touchend', (e) => {
        const diff = e.changedTouches[0].screenX - startX;
        if (Math.abs(diff) > 50) diff > 0 ? this.next() : this.prev();
      }, { passive: true });
    }

    cycleMotionMode() {
      const order = ['morph-and-zoom', 'morph-only', 'classic'];
      const labels = {
        'morph-and-zoom': 'الحركة: Morph + Zoom بالأسهم',
        'morph-only': 'الحركة: Morph فقط (تقريب بالماوس)',
        'classic': 'الحركة: انتقال كلاسيكي'
      };
      this.motionMode = order[(order.indexOf(this.motionMode) + 1) % order.length];
      if (this.motionModeEl) this.motionModeEl.textContent = labels[this.motionMode];
      if (this.motionMode !== 'morph-and-zoom') this.zoomToIndex(-1);
    }

    resetZoomOrStep() {
      const items = this.getZoomItems(this.slides[this.currentSlide]);
      if (!items.length) return;
      this.zoomToIndex(this.currentZoomIndex === -1 ? 0 : -1);
    }

    zoomToIndex(zIdx) {
      const slide = this.slides[this.currentSlide];
      if (!slide) return;
      const rig = slide.querySelector('.camera-rig');
      const items = this.getZoomItems(slide);

      if (!rig || zIdx < 0 || zIdx >= items.length) {
        this.currentZoomIndex = -1;
        this.camScale = 1;
        slide.classList.remove('is-camera-zoomed');
        items.forEach((el) => el.classList.remove('zoom-focused'));
        if (rig) rig.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
        this.updateHUD();
        return;
      }

      const rigW = rig.offsetWidth || 1764;
      const rigH = rig.offsetHeight || 976;
      const { x: itemX, y: itemY, w: itemW, h: itemH } = this.getLayoutBoxInRig(items[zIdx], rig);

      const scaleX = (rigW * 0.60) / Math.max(itemW, 240);
      const scaleY = (rigH * 0.60) / Math.max(itemH, 220);
      const zoomScale = Math.max(1.26, Math.min(1.52, Math.min(scaleX, scaleY)));

      let tx = rigW / 2 - (itemX + itemW / 2) * zoomScale;
      let ty = rigH / 2 - (itemY + itemH / 2) * zoomScale;
      const maxPanX = rigW * (zoomScale - 1);
      const maxPanY = rigH * (zoomScale - 1);
      tx = Math.max(-maxPanX + 36, Math.min(36, tx));
      ty = Math.max(-maxPanY + 36, Math.min(36, ty));

      this.currentZoomIndex = zIdx;
      this.camScale = zoomScale;
      slide.classList.add('is-camera-zoomed');
      items.forEach((el, idx) => el.classList.toggle('zoom-focused', idx === zIdx));
      rig.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0px) scale(${zoomScale.toFixed(3)})`;
      this.updateHUD();
    }

    next(opts = {}) {
      const items = this.getZoomItems(this.slides[this.currentSlide]);
      if (this.motionMode === 'morph-and-zoom' && !opts.skipZoomSteps && items.length > 0) {
        if (this.currentZoomIndex < items.length - 1) {
          this.zoomToIndex(this.currentZoomIndex + 1);
          return;
        } else if (this.currentZoomIndex === items.length - 1) {
          this.zoomToIndex(-1);
          return;
        }
      }
      if (this.currentSlide < this.slides.length - 1) this.showSlide(this.currentSlide + 1);
    }

    prev(opts = {}) {
      const items = this.getZoomItems(this.slides[this.currentSlide]);
      if (this.motionMode === 'morph-and-zoom' && !opts.skipZoomSteps && items.length > 0) {
        if (this.currentZoomIndex > 0) {
          this.zoomToIndex(this.currentZoomIndex - 1);
          return;
        } else if (this.currentZoomIndex === 0) {
          this.zoomToIndex(-1);
          return;
        }
      }
      if (this.currentSlide > 0) this.showSlide(this.currentSlide - 1);
    }

    captureMorphRects(slide) {
      const map = new Map();
      if (!slide) return map;
      const stageRect = this.stage.getBoundingClientRect();
      const s = this.stageScaleFactor || 1;
      slide.querySelectorAll('[data-morph]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          map.set(el.dataset.morph, {
            left: (r.left - stageRect.left) / s,
            top: (r.top - stageRect.top) / s,
            width: r.width / s,
            height: r.height / s,
          });
        }
      });
      return map;
    }

    showSlide(index, opts = {}) {
      const targetIndex = Math.max(0, Math.min(index, this.slides.length - 1));
      const prevIndex = this.currentSlide;
      const prevSlide = this.slides[prevIndex];
      const nextSlide = this.slides[targetIndex];
      const useMorph = !opts.skipMorph && this.motionMode !== 'classic' && prevSlide && prevSlide !== nextSlide;

      if (prevSlide && this.currentZoomIndex !== -1) {
        const prevRig = prevSlide.querySelector('.camera-rig');
        if (prevRig) {
          prevRig.style.transition = 'none';
          prevRig.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
          prevRig.getBoundingClientRect();
          prevRig.style.transition = '';
        }
        prevSlide.classList.remove('is-camera-zoomed');
        prevSlide.querySelectorAll('.zoom-focused').forEach((el) => el.classList.remove('zoom-focused'));
      }

      const firstRects = useMorph ? this.captureMorphRects(prevSlide) : new Map();

      this.currentSlide = targetIndex;
      this.currentZoomIndex = -1;
      this.camScale = 1;

      const nextRig = nextSlide.querySelector('.camera-rig');
      if (nextRig) nextRig.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      nextSlide.classList.remove('is-camera-zoomed');
      nextSlide.querySelectorAll('.zoom-focused').forEach((el) => el.classList.remove('zoom-focused'));

      this.slides.forEach((slide, i) => {
        const isTarget = i === this.currentSlide;
        const isLeaving = useMorph && i === prevIndex;
        slide.classList.toggle('active', isTarget);
        slide.classList.toggle('visible', isTarget);
        slide.classList.toggle('morph-leaving', isLeaving);
        if (isLeaving) setTimeout(() => slide.classList.remove('morph-leaving'), 960);
      });

      if (firstRects.size > 0) {
        const lastRects = this.captureMorphRects(nextSlide);
        nextSlide.querySelectorAll('[data-morph]').forEach((el) => {
          const first = firstRects.get(el.dataset.morph);
          const last = lastRects.get(el.dataset.morph);
          if (!first || !last) return;
          const dx = first.left + first.width / 2 - (last.left + last.width / 2);
          const dy = first.top + first.height / 2 - (last.top + last.height / 2);
          const sx = Math.max(0.2, Math.min(4.0, first.width / Math.max(last.width, 1)));
          const sy = Math.max(0.2, Math.min(4.0, first.height / Math.max(last.height, 1)));
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sx - 1) < 0.03 && Math.abs(sy - 1) < 0.03) return;
          el.animate(
            [
              { transformOrigin: 'center center', transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})` },
              { transformOrigin: 'center center', transform: 'translate3d(0px, 0px, 0px) scale(1, 1)' }
            ],
            { duration: 1180, easing: 'cubic-bezier(0.25, 1, 0.35, 1)', fill: 'both' }
          );
        });
      }
      this.updateHUD();
    }

    updateHUD() {
      const items = this.getZoomItems(this.slides[this.currentSlide]);
      if (this.counterEl) {
        this.counterEl.textContent = `${String(this.currentSlide + 1).padStart(2, '0')} / ${String(this.slides.length).padStart(2, '0')}`;
      }
      if (this.cameraStatusEl) {
        if (this.currentZoomIndex === -1) {
          this.cameraStatusEl.textContent = items.length ? `الكاميرا: نظرة عامة (${items.length} أقسام)` : 'الكاميرا: نظرة عامة';
        } else {
          const label = items[this.currentZoomIndex]?.dataset.zoomLabel || `قسم ${this.currentZoomIndex + 1}`;
          this.cameraStatusEl.textContent = `تقريب ${this.currentZoomIndex + 1}/${items.length}: ${label}`;
        }
      }
    }
  }

  const deck = new SlidePresentation('morph-and-zoom');

  // Auto-hide bottom controls bar unless mouse hovers bottom 32px edge
  const controlsHotzone = document.getElementById('controlsHotzone');
  const deckControls = document.getElementById('deckControls');
  let controlsHideTimeout = null;
  const scheduleControlsHide = () => {
    controlsHideTimeout = setTimeout(() => deckControls?.classList.remove('show'), 500);
  };
  controlsHotzone?.addEventListener('mouseenter', () => { clearTimeout(controlsHideTimeout); deckControls?.classList.add('show'); });
  controlsHotzone?.addEventListener('mouseleave', scheduleControlsHide);
  deckControls?.addEventListener('mouseenter', () => clearTimeout(controlsHideTimeout));
  deckControls?.addEventListener('mouseleave', scheduleControlsHide);
</script>
```

---

## 4. Integrating `anatomy` Isometric Figures (Static vs. Animated)

Always read `<SKILL_DIR>/resources/engine/anatomy/SKILL.md` and `<SKILL_DIR>/resources/engine/anatomy/references/craft.md` when authoring an `anatomy` figure.

### Correct Module Imports for Bundled `anatomy`

- **Core Isometric Geometry & SVG Builders (`iso-kit.mjs`):**
  ```js
  import * as k from "<SKILL_DIR>/resources/engine/anatomy/kit/iso-kit.mjs";
  ```
- **Painter's Order & Audit (`audit.mjs`):**
  ```js
  import * as A from "<SKILL_DIR>/resources/engine/anatomy/kit/audit.mjs";
  ```
- **Inline Runtime Script Helper for Animated Figures (`inline-kit.mjs`):**
  ```js
  import { kitScript } from "<SKILL_DIR>/resources/engine/anatomy/scripts/inline-kit.mjs";
  ```

### Pattern A: Static Isometric Figure (`ثابتة` — Structural / Cutaway Slide)

```js
import { writeFileSync } from "node:fs";
import * as k from "<SKILL_DIR>/resources/engine/anatomy/kit/iso-kit.mjs";
import * as A from "<SKILL_DIR>/resources/engine/anatomy/kit/audit.mjs";

const WIDTH = 680, HEIGHT = 420;
// Define projection P = k.fitProjection(...), recorder R = A.recorder(P, ...), and parts
// Settle painter's order and run --audit check:
// A.settle(R, P);
// if (process.argv.includes("--audit")) A.auditOrExit(R, P);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  standalone: "light", // embeds iso.css directly inside <svg class="iso-svg" data-theme="light">
  label: "Detailed description of the physical instrument and its parts",
  body: [ /* ... SVG part strings ... */ ],
});
writeFileSync("assets/anatomy-static-rig.svg", svg);
```

### Pattern B: Animated / Live Isometric Figure (`متحركة` — Dynamic Mechanism Slide)

1. Import `kitScript` from `<SKILL_DIR>/resources/engine/anatomy/scripts/inline-kit.mjs` and write `assets/anatomy-<name>.html` using `k.pageHtml({ title, theme: "light", body, script: kitScript() + live })` (see `<SKILL_DIR>/resources/engine/anatomy/examples/dial-indicator/build.mjs` for a complete working example).
2. **Slide Navigation Guard:** Keep `touring = true` (continuous auto-animation) and `pointermove` (interactive hover scrub) active, and omit global `ArrowLeft`/`ArrowRight` listeners inside the figure so arrow keys always control the presentation slides.
