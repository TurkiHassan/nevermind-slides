/* ==========================================================================
   Nevermind Runtime v2 - core (nm-deck.js)
   Stage, navigation, step timeline, morph engine, slide transitions,
   entrances, camera, overview, chrome. Classic script, no dependencies.
   Contract: references/runtime-contract.md. Chrome only. No emojis.
   ========================================================================== */
(function () {
  'use strict';
  if (window.NM && window.NM.deck && window.NM.version === 2) return;

  /* ------------------------------------------------------------------------
     0. Environment, config, global namespace
     ------------------------------------------------------------------------ */
  var W = 1920, H = 1080;
  var params = new URLSearchParams(location.search);
  var PRINT = params.has('nm-print');
  var reduceMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var speedParam = params.has('nm-speed') ? parseFloat(params.get('nm-speed')) : 1;
  var CONFIG = window.NM_CONFIG || {};

  var NM = window.NM = window.NM || {};
  var queuedPlugins = Array.isArray(NM._queue) ? NM._queue.slice() : [];
  NM.version = 2;
  NM.speed = (!isFinite(speedParam) || speedParam < 0) ? 1 : speedParam;
  if (reduceMQ.matches || PRINT) NM.speed = 0;

  var acts = {};
  var listeners = {};
  var deck = null;
  var ready = false;
  var stage, viewport, ghostLayer, overlayLayer, body, rtl = true;
  var slides = [];
  var SS = new WeakMap(); // per-slide state

  /* ------------------------------------------------------------------------
     1. Easing and durations (springs solved once, emitted as CSS linear())
     ------------------------------------------------------------------------ */
  // Damped spring step response, time normalised so it settles at t = 1.
  function springCurve(zeta, n) {
    n = n || 60;
    var pts = [];
    var w = zeta < 1 ? 6.9 / zeta : 9.2;
    var wd = zeta < 1 ? w * Math.sqrt(1 - zeta * zeta) : 0;
    for (var i = 0; i <= n; i++) {
      var t = i / n, x;
      if (zeta < 1) x = 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
      else x = 1 - Math.exp(-w * t) * (1 + w * t);
      pts.push(i === n ? 1 : Math.round(x * 10000) / 10000);
    }
    return 'linear(' + pts.join(', ') + ')';
  }
  NM.ease = {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
    enter: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
    exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    move: 'cubic-bezier(0.65, 0, 0.15, 1)',
    camera: 'cubic-bezier(0.55, 0, 0.1, 1)',
    spring: springCurve(0.82),
    springSoft: springCurve(1),
    springBouncy: springCurve(0.55)
  };
  NM.dur = { fast: 200, base: 400, slow: 700, morph: 900, camera: 1150 };
  NM.springCurve = springCurve;

  function easeOf(name, fallback) {
    if (!name) return fallback;
    return NM.ease[name] || name;
  }

  /* ------------------------------------------------------------------------
     2. Animation tracking, timers, settle
     ------------------------------------------------------------------------ */
  var live = new Set();
  var pendingTimers = 0;
  function track(a) {
    live.add(a);
    var done = function () { live.delete(a); };
    a.finished.then(done, done);
    return a;
  }
  function instantNow() { return !NM.speed; }
  // Internal animation helper: speed aware, default fill none, optional bucket.
  function anim(el, kf, o, bucket) {
    o = Object.assign({ fill: 'none' }, o || {});
    var s = NM.speed;
    var a;
    if (!s) {
      o.duration = 0; o.delay = 0; o.endDelay = 0;
      a = el.animate(kf, o);
      a.finish();
      return a;
    }
    if (s !== 1) {
      o.duration = (o.duration || 0) / s;
      if (o.delay) o.delay = o.delay / s;
    }
    a = track(el.animate(kf, o));
    if (bucket) bucket.push(a);
    return a;
  }
  NM.animate = function (el, keyframes, opts) {
    return anim(el, keyframes, Object.assign({ fill: 'both' }, opts || {}));
  };
  function later(fn, ms) {
    if (!NM.speed) { fn(); return 0; }
    pendingTimers++;
    var id = setTimeout(function () { pendingTimers--; fn(); }, ms / NM.speed);
    return id;
  }
  function finiteRunning(a) {
    if (!a.effect) return false;
    var t = a.effect.getComputedTiming();
    if (!isFinite(t.endTime)) return false;
    return a.pending || a.playState === 'running';
  }

  /* ------------------------------------------------------------------------
     3. Small helpers
     ------------------------------------------------------------------------ */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function safe(fn) {
    try { return fn(); } catch (err) { console.error('[nm-deck]', err); }
  }
  function emit(name, detail) {
    (listeners[name] || []).slice().forEach(function (f) { safe(function () { f(detail); }); });
    document.dispatchEvent(new CustomEvent('nm:' + name, { detail: detail }));
  }
  function px(n) { return (Math.round(n * 1000) / 1000) + 'px'; }
  function isSvgChild(e) { return e instanceof SVGElement && !(e instanceof SVGSVGElement); }
  function parseColor(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function transparentOf(c) {
    var p = parseColor(c);
    return p ? 'rgba(' + p.r + ', ' + p.g + ', ' + p.b + ', 0)' : 'rgba(0, 0, 0, 0)';
  }
  function isClear(c) { var p = parseColor(c); return !p || p.a === 0; }

  /* ------------------------------------------------------------------------
     4. Geometry
     ------------------------------------------------------------------------ */
  function stageScale() {
    if (!stage) return 1;
    var r = stage.getBoundingClientRect();
    return r.width / W || 1;
  }
  function toStage(r) {
    var sr = stage.getBoundingClientRect(), s = sr.width / W || 1;
    return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s };
  }
  // What the eye sees, in stage px: includes camera zoom and transitions.
  function visualRect(e) { return toStage(e.getBoundingClientRect()); }
  function layoutOrigin(e, stop) {
    var x = 0, y = 0, c = e;
    while (c && c !== stop && c !== stage && c.offsetParent !== undefined) {
      x += c.offsetLeft || 0; y += c.offsetTop || 0;
      c = c.offsetParent;
    }
    return { x: x, y: y };
  }
  function invertPoint(pt, A, L) {
    var cs = getComputedStyle(A);
    if (!cs.transform || cs.transform === 'none') return pt;
    var m;
    try { m = new DOMMatrix(cs.transform).inverse(); } catch (e) { return pt; }
    var o = cs.transformOrigin.split(' ').map(parseFloat);
    var ox = L.x + (o[0] || 0), oy = L.y + (o[1] || 0);
    var q = m.transformPoint(new DOMPoint(pt.x - ox, pt.y - oy));
    return { x: q.x + ox, y: q.y + oy };
  }
  // Layout rect in stage px, independent of viewport scale, camera and slide transitions.
  function rectInStage(e) {
    var r = visualRect(e);
    var slide = e.closest && e.closest('.slide');
    var rig = e.closest && e.closest('.camera-rig');
    var pts = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }];
    if (slide && slide !== e && slide.parentElement === stage) {
      var Ls = { x: slide.offsetLeft, y: slide.offsetTop };
      pts = pts.map(function (p) { return invertPoint(p, slide, Ls); });
    }
    if (rig && rig !== e && slide && slide.contains(rig)) {
      var Lr = layoutOrigin(rig, stage);
      pts = pts.map(function (p) { return invertPoint(p, rig, Lr); });
    }
    var x0 = Math.min(pts[0].x, pts[1].x), y0 = Math.min(pts[0].y, pts[1].y);
    return { x: x0, y: y0, w: Math.abs(pts[1].x - pts[0].x), h: Math.abs(pts[1].y - pts[0].y) };
  }
  NM.geom = {
    rectInStage: rectInStage,
    visualRect: visualRect,
    stageScale: stageScale,
    toStage: function (clientX, clientY) {
      var sr = stage.getBoundingClientRect(), s = sr.width / W || 1;
      return { x: (clientX - sr.left) / s, y: (clientY - sr.top) / s };
    }
  };
  NM.layer = function (name) { return name === 'ghost' ? ghostLayer : overlayLayer; };

  /* ------------------------------------------------------------------------
     5. Stage: skeleton, rigs, scale-to-fit
     ------------------------------------------------------------------------ */
  function setupDom() {
    body = document.body;
    stage = document.getElementById('deckStage') || document.querySelector('.deck-stage');
    if (!stage) {
      stage = el('main', 'deck-stage');
      $$('.slide').forEach(function (s) { stage.appendChild(s); });
      body.appendChild(stage);
    }
    if (!stage.id) stage.id = 'deckStage';
    stage.classList.add('deck-stage');
    viewport = stage.closest('.deck-viewport');
    if (!viewport) {
      viewport = el('div', 'deck-viewport');
      stage.parentNode.insertBefore(viewport, stage);
      viewport.appendChild(stage);
    }
    var dirAttr = (document.body.getAttribute('dir') || document.documentElement.getAttribute('dir') || '').toLowerCase();
    if (!dirAttr) { document.body.setAttribute('dir', 'rtl'); dirAttr = 'rtl'; }
    rtl = dirAttr !== 'ltr';

    slides = $$(':scope > .slide', stage);
    if (!slides.length) slides = $$('.slide', stage);
    slides.forEach(function (s) {
      s.classList.remove('relative');
      var rig = s.querySelector('.camera-rig');
      if (!rig) {
        rig = el('div', 'camera-rig');
        while (s.firstChild) rig.appendChild(s.firstChild);
        s.appendChild(rig);
      }
      SS.set(s, { all: [], steps: [], index: 0, active: [], released: false, cam: { tx: 0, ty: 0, k: 1 }, dimmed: [], rig: rig });
    });

    overlayLayer = document.getElementById('nmOverlayLayer');
    if (!overlayLayer) { overlayLayer = el('div', 'nm-layer'); overlayLayer.id = 'nmOverlayLayer'; stage.appendChild(overlayLayer); }
    ghostLayer = document.getElementById('nmGhostLayer');
    if (!ghostLayer) { ghostLayer = el('div', 'nm-layer'); ghostLayer.id = 'nmGhostLayer'; stage.appendChild(ghostLayer); }
    overlayLayer.classList.add('nm-layer');
    ghostLayer.classList.add('nm-layer');
  }
  function fit() {
    if (PRINT) { stage.style.transform = ''; return; }
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = Math.min(vw / W, vh / H);
    var x = (vw - W * s) / 2, y = (vh - H * s) / 2;
    stage.style.transform = 'translate(' + px(x) + ', ' + px(y) + ') scale(' + s + ')';
  }
  function S(slide) { return SS.get(slide); }
  function rigOf(slide) { return S(slide).rig; }

  /* ------------------------------------------------------------------------
     6. Step timeline
     ------------------------------------------------------------------------ */
  function isTransient(act) { return !!(acts[act] && acts[act].transient); }
  function readSteps(slide) {
    var map = new Map();
    $$('[data-step],[data-zoom-step]', slide).forEach(function (e) {
      var n = parseFloat(e.getAttribute('data-step')), legacy = false;
      if (!isFinite(n)) { n = parseFloat(e.getAttribute('data-zoom-step')); legacy = true; }
      if (!isFinite(n)) return;
      var act = e.getAttribute('data-act') || (legacy ? 'zoom' : 'reveal');
      if (!map.has(n)) map.set(n, []);
      map.get(n).push({ el: e, act: act });
    });
    return Array.from(map.keys()).sort(function (a, b) { return a - b; }).map(function (k) { return { n: k, items: map.get(k) }; });
  }
  function computeSteps(slide) {
    var st = S(slide), list = st.all;
    if (deck.mode !== 'morph-and-zoom') {
      list = list.map(function (s) { return { n: s.n, items: s.items.filter(function (i) { return i.act !== 'zoom'; }) }; })
        .filter(function (s) { return s.items.length; });
    }
    var last = list[list.length - 1];
    if (last && last.items.some(function (i) { return isTransient(i.act); })) list = list.concat([{ n: Infinity, items: [], release: true }]);
    st.steps = list;
    return list;
  }
  function isHiddenStep(e, slide) {
    for (var n = e; n && n !== slide && n.nodeType === 1; n = n.parentElement) {
      if (n.hasAttribute('data-step') && !n.classList.contains('is-on')) {
        var a = n.getAttribute('data-act');
        if (!a || a === 'reveal') return true;
      }
    }
    return false;
  }
  function makeCtx(slide, step, dir, instant, extra) {
    return Object.assign({ deck: deck, slide: slide, rig: rigOf(slide), step: step, dir: dir, instant: !!instant || instantNow() }, extra || {});
  }
  function enterItem(slide, it, ctx) {
    it.el.classList.add('is-on');
    var a = acts[it.act];
    if (a && a.enter) safe(function () { a.enter(it.el, ctx); });
    if (isTransient(it.act)) S(slide).active.push(it);
  }
  function exitItem(it, ctx) {
    var a = acts[it.act];
    if (a && a.exit) safe(function () { a.exit(it.el, ctx); });
  }
  function exitTransients(slide, ctx) {
    var st = S(slide), list = st.active;
    st.active = [];
    list.forEach(function (it) { exitItem(it, ctx); });
    return list.length > 0;
  }
  function markCurrent(slide) {
    var st = S(slide);
    st.all.forEach(function (s) { s.items.forEach(function (i) { i.el.classList.remove('is-current'); }); });
    var cur = st.steps[st.index - 1];
    if (cur) cur.items.forEach(function (i) { i.el.classList.add('is-current'); });
  }
  // Move the slide's timeline to `target` (0 = nothing entered).
  function setStep(slide, target, o) {
    o = o || {};
    var st = S(slide), steps = st.steps, cur = st.index;
    target = clamp(target, 0, steps.length);
    var dir = target >= cur ? 1 : -1;
    var instant = !!o.instant;
    var nextActs = target > 0 ? steps[target - 1].items.map(function (i) { return i.act; }) : [];
    exitTransients(slide, makeCtx(slide, target, dir, instant, { next: nextActs }));
    if (target > cur) {
      for (var i = cur + 1; i <= target; i++) {
        var stepI = steps[i - 1], last = i === target;
        stepI.items.forEach(function (it) {
          if (isTransient(it.act) && (!last || o.deferTransient)) { it.el.classList.add('is-on'); return; }
          enterItem(slide, it, makeCtx(slide, i, 1, instant || !last));
        });
      }
    } else if (target < cur) {
      for (var j = cur; j > target; j--) {
        steps[j - 1].items.forEach(function (it) {
          if (!isTransient(it.act)) exitItem(it, makeCtx(slide, j, -1, instant || j > target + 1));
          it.el.classList.remove('is-on');
        });
      }
      if (target > 0 && !o.deferTransient) {
        steps[target - 1].items.forEach(function (it) {
          if (isTransient(it.act)) enterItem(slide, it, makeCtx(slide, target, -1, instant));
        });
      }
    }
    st.index = target;
    st.released = false;
    st.deferred = !!o.deferTransient;
    markCurrent(slide);
    if (slide === slides[deck.index]) { deck.stepIndex = target; if (!o.silent) writeHash(); }
    if (!o.silent) emit('step', { slide: slide, index: slides.indexOf(slide), step: target, dir: dir });
    updateHud();
  }
  function enterDeferred(slide) {
    var st = S(slide);
    if (!st.deferred) return;
    st.deferred = false;
    var cur = st.steps[st.index - 1];
    if (!cur) return;
    cur.items.forEach(function (it) {
      if (isTransient(it.act)) enterItem(slide, it, makeCtx(slide, st.index, 1, false));
    });
    updateHud();
  }
  function release(slide) {
    slide = slide || slides[deck.index];
    var st = S(slide);
    var had = exitTransients(slide, makeCtx(slide, st.index, 0, false, { next: [] }));
    if (had) st.released = true;
    updateHud();
    return had;
  }
  function resetSlide(slide) {
    var st = S(slide);
    st.active = [];
    st.all.forEach(function (s) {
      s.items.forEach(function (it) {
        var a = acts[it.act];
        if (a && a.reset) safe(function () { a.reset(it.el, makeCtx(slide, 0, 0, true, { leaving: true })); });
        it.el.classList.remove('is-on', 'is-current', 'zoom-focused', 'nm-highlighted');
      });
    });
    slide.classList.remove('is-camera-zoomed');
    undim(slide, true);
    setCam(slide, { tx: 0, ty: 0, k: 1 }, { instant: true });
    st.index = 0;
    st.released = false;
    st.deferred = false;
  }

  /* ------------------------------------------------------------------------
     7. Camera
     ------------------------------------------------------------------------ */
  function camString(c) {
    if (c.k === 1 && c.tx === 0 && c.ty === 0) return '';
    return 'translate(' + px(c.tx) + ', ' + px(c.ty) + ') scale(' + Math.round(c.k * 10000) / 10000 + ')';
  }
  function setCam(slide, cam, o) {
    o = o || {};
    var st = S(slide), rig = st.rig;
    var from = getComputedStyle(rig).transform;
    if (st.camAnim) { st.camAnim.cancel(); st.camAnim = null; }
    st.cam = cam;
    var to = camString(cam);
    rig.style.transform = to;
    if (!rig.getAttribute('style')) rig.removeAttribute('style');
    if (o.instant || instantNow()) return Promise.resolve();
    var a = anim(rig, [{ transform: from === 'none' ? 'none' : from }, { transform: to || 'none' }],
      { duration: o.duration || NM.dur.camera, easing: o.easing || NM.ease.camera }, entranceBucket);
    st.camAnim = a;
    return a.finished.then(function () { if (st.camAnim === a) st.camAnim = null; }, function () {});
  }
  function cameraTo(target, o) {
    o = o || {};
    if (o === true) o = { instant: true };
    var slide = slides[deck.index], st = S(slide), rig = st.rig;
    var r = target && target.nodeType ? rectInStage(target) : target;
    if (!r) return Promise.resolve();
    var L = layoutOrigin(rig, stage);
    var rw = rig.offsetWidth || W, rh = rig.offsetHeight || H;
    var pad = o.pad == null ? 90 : o.pad;
    var k = o.scale || clamp(Math.min((W - 2 * pad) / Math.max(r.w, 1), (H - 2 * pad) / Math.max(r.h, 1)) * 0.86, 1.12, 2.6);
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    var tx = W / 2 - L.x - k * (cx - L.x);
    var ty = H / 2 - L.y - k * (cy - L.y);
    // keep the rig covering its own box (never reveal the void around it)
    tx = clamp(tx, rw * (1 - k), 0);
    ty = clamp(ty, rh * (1 - k), 0);
    slide.classList.add('is-camera-zoomed');
    return setCam(slide, { tx: tx, ty: ty, k: k }, o);
  }
  function cameraReset(o) {
    if (o === true) o = { instant: true };
    o = o || {};
    var slide = slides[deck.index];
    slide.classList.remove('is-camera-zoomed');
    return setCam(slide, { tx: 0, ty: 0, k: 1 }, o);
  }
  function dimAround(target, slide) {
    var st = S(slide), rig = st.rig;
    undim(slide, true);
    for (var n = target; n && n !== rig && n !== slide; n = n.parentElement) {
      var p = n.parentElement;
      if (!p) break;
      Array.prototype.forEach.call(p.children, function (sib) {
        if (sib === n || sib.contains(target) || /^(SCRIPT|STYLE|TEMPLATE)$/.test(sib.tagName)) return;
        sib.classList.remove('nm-undim');
        sib.classList.add('nm-dim');
        st.dimmed.push(sib);
      });
      if (p === rig) break;
    }
  }
  function undim(slide, instant) {
    var st = S(slide);
    var list = st.dimmed;
    st.dimmed = [];
    list.forEach(function (e) {
      e.classList.remove('nm-dim');
      if (!instant && !instantNow()) {
        e.classList.add('nm-undim');
        later(function () { if (!e.classList.contains('nm-dim')) e.classList.remove('nm-undim'); }, 650);
      } else {
        e.classList.remove('nm-undim');
      }
      if (!e.classList.length) e.removeAttribute('class');
    });
  }

  /* ------------------------------------------------------------------------
     8. Core acts: reveal, zoom, highlight
     ------------------------------------------------------------------------ */
  NM.registerAct = function (name, def) { acts[name] = def || {}; if (ready) slides.forEach(computeSteps); };
  function registerCoreActs() {
    NM.registerAct('reveal', {
      enter: function (e, ctx) {
        if (ctx.instant) return;
        playEntrance(e, e.getAttribute('data-entrance') || 'rise', { dir: ctx.dir, delay: parseFloat(e.getAttribute('data-entrance-delay')) || 0 }, entranceBucket);
      },
      exit: function (e, ctx) {
        if (ctx.instant) return;
        anim(e, [{ opacity: 1, visibility: 'visible' }, { opacity: 0, visibility: 'visible' }], { duration: 220, easing: NM.ease.exit }, entranceBucket);
      },
      reset: function () {}
    });
    NM.registerAct('zoom', {
      transient: true,
      enter: function (e, ctx) {
        var slide = ctx.slide;
        slide.classList.add('is-camera-zoomed');
        e.classList.add('zoom-focused');
        dimAround(e, slide);
        if (slide === slides[deck.index]) cameraTo(e, { instant: ctx.instant, pad: parseFloat(e.getAttribute('data-zoom-pad')) || undefined, scale: parseFloat(e.getAttribute('data-zoom-scale')) || undefined });
      },
      exit: function (e, ctx) {
        if (ctx.leaving) return;
        e.classList.remove('zoom-focused');
        var chain = (ctx.next || []).indexOf('zoom') >= 0;
        if (!chain) {
          undim(ctx.slide, ctx.instant);
          if (ctx.slide === slides[deck.index]) cameraReset({ instant: ctx.instant });
        }
      },
      reset: function (e) { e.classList.remove('zoom-focused'); }
    });
    NM.registerAct('highlight', {
      transient: true,
      enter: function (e) { e.classList.add('nm-highlighted'); },
      exit: function (e) { e.classList.remove('nm-highlighted'); },
      reset: function (e) { e.classList.remove('nm-highlighted'); }
    });
  }

  /* ------------------------------------------------------------------------
     9. Numbers (Arabic-Indic and Western digits, separators kept)
     ------------------------------------------------------------------------ */
  var AR = '٠١٢٣٤٥٦٧٨٩', FA = '۰۱۲۳۴۵۶۷۸۹';
  var NUM_RE = /[0-9٠-٩۰-۹]+(?:[.,٬٫][0-9٠-٩۰-۹]+)*/;
  function toLatinDigits(s) {
    return s.replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); });
  }
  function parseNum(text) {
    var m = NUM_RE.exec(text || '');
    if (!m) return null;
    var raw = m[0];
    var digits = /[٠-٩]/.test(raw) ? 'arab' : /[۰-۹]/.test(raw) ? 'pers' : 'latn';
    var lat = toLatinDigits(raw);
    var group = '', dec = '.', decimals = 0, intPart = lat, frac = '';
    var seps = lat.replace(/[0-9]/g, '');
    if (seps) {
      var lastSep = seps[seps.length - 1];
      var lastIdx = lat.lastIndexOf(lastSep);
      var tail = lat.slice(lastIdx + 1);
      var isDec = lastSep === '٫' || (lastSep !== '٬' && (seps.length === 1 || seps[0] !== lastSep) && (tail.length !== 3 || (seps.length > 1 && seps[0] !== lastSep)));
      if (seps.length === 1 && (lastSep === '.' ) && tail.length !== 3) isDec = true;
      if (isDec) { dec = lastSep; frac = tail; intPart = lat.slice(0, lastIdx); decimals = frac.length; }
      var g = intPart.replace(/[0-9]/g, '');
      if (g) group = g[0];
      intPart = intPart.replace(/[^0-9]/g, '');
    }
    var value = parseFloat(intPart + (frac ? '.' + frac : ''));
    var prefix = text.slice(0, m.index), suffix = text.slice(m.index + raw.length);
    var neg = /[-−]\s*$/.test(prefix);
    if (neg) { value = -value; prefix = prefix.replace(/[-−]\s*$/, ''); }
    return { value: value, decimals: decimals, group: group, dec: dec, digits: digits, prefix: prefix, suffix: suffix, neg: neg };
  }
  function formatNum(v, f) {
    var neg = v < 0;
    var s = Math.abs(v).toFixed(f.decimals);
    var parts = s.split('.');
    var ip = parts[0];
    if (f.group) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, f.group);
    var out = ip + (parts[1] ? f.dec + parts[1] : '');
    if (f.digits === 'arab') out = out.replace(/[0-9]/g, function (d) { return AR[d]; });
    else if (f.digits === 'pers') out = out.replace(/[0-9]/g, function (d) { return FA[d]; });
    return f.prefix + (neg ? '-' : '') + out + f.suffix;
  }
  NM.number = { parse: parseNum, format: formatNum };
  function numericTextNode(e) {
    var tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), n;
    while ((n = tw.nextNode())) if (NUM_RE.test(n.nodeValue)) return n;
    return null;
  }
  function isNumberEl(e) {
    if (isSvgChild(e) && e.tagName.toLowerCase() !== 'text') return false;
    var t = (e.textContent || '').trim();
    var m = NUM_RE.exec(t);
    if (!m) return false;
    var rest = t.slice(0, m.index) + t.slice(m.index + m[0].length);
    return !/[0-9٠-٩۰-۹]/.test(rest) && t.slice(0, m.index).length <= 4 && rest.length <= 16;
  }

  /* ------------------------------------------------------------------------
     10. Entrances (replay on every visit)
     ------------------------------------------------------------------------ */
  var entranceBucket = [];
  function travelSign(dir) { return (dir < 0 ? -1 : 1) * (rtl ? 1 : -1); }
  function baseOpacity(e) { var o = parseFloat(getComputedStyle(e).opacity); return isFinite(o) ? o : 1; }
  function moveKF(e, from) {
    // offsets through the individual `translate` property so authored transforms survive
    var cs = getComputedStyle(e);
    var ok = cs.translate === 'none' || cs.translate === '0px';
    return ok ? from : null;
  }
  var ENTRANCES = {
    rise: function (e, o) {
      var op = baseOpacity(e), t = moveKF(e, '0px 30px');
      return [[t ? { opacity: 0, translate: t } : { opacity: 0 }, t ? { opacity: op, translate: '0px 0px' } : { opacity: op }], 760, NM.ease.enter];
    },
    fade: function (e) { var op = baseOpacity(e); return [[{ opacity: 0 }, { opacity: op }], 640, NM.ease.standard]; },
    clip: function (e) {
      var from = rtl ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)';
      return [[{ clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)' }], 820, NM.ease.move];
    },
    scale: function (e) {
      var op = baseOpacity(e), cs = getComputedStyle(e);
      if (cs.scale !== 'none') return [[{ opacity: 0 }, { opacity: op }], 600, NM.ease.standard];
      return [[{ opacity: 0, scale: '0.88' }, { opacity: op, offset: 0.35 }, { opacity: op, scale: '1' }], 820, NM.ease.spring];
    },
    blur: function (e) {
      var op = baseOpacity(e);
      return [[{ opacity: 0, filter: 'blur(16px)' }, { opacity: op, filter: 'blur(0px)' }], 820, NM.ease.standard];
    },
    slide: function (e, o) {
      var op = baseOpacity(e), t = moveKF(e), sx = travelSign(o.dir);
      if (!t && t !== undefined) return [[{ opacity: 0 }, { opacity: op }], 600, NM.ease.standard];
      return [[{ opacity: 0, translate: (-sx * 72) + 'px 0px' }, { opacity: op, translate: '0px 0px' }], 780, NM.ease.enter];
    }
  };
  // Play one entrance. Returns the animations created.
  function playEntrance(e, kind, o, bucket) {
    o = o || {};
    if (instantNow() || kind === 'none') return [];
    var delay = o.delay || 0;
    if (kind === 'draw') return entranceDraw(e, delay, bucket);
    if (kind === 'type') return entranceType(e, delay, bucket);
    if (kind === 'count') return entranceCount(e, delay, bucket);
    var f = ENTRANCES[kind] || ENTRANCES.rise;
    var spec = f(e, o);
    return [anim(e, spec[0], { duration: spec[1], easing: spec[2], delay: delay, fill: 'backwards' }, bucket)];
  }
  var SHAPES = 'path,line,polyline,polygon,circle,ellipse,rect';
  function entranceDraw(e, delay, bucket) {
    var shapes = e.matches && e.matches(SHAPES) ? [e] : $$(SHAPES, e);
    shapes = shapes.filter(function (s) {
      return typeof s.getTotalLength === 'function' && !/\bmg-/.test(s.getAttribute('class') || '') && getComputedStyle(s).stroke !== 'none';
    });
    if (!shapes.length) return playEntrance(e, isSvgChild(e) || e.tagName === 'svg' ? 'fade' : 'clip', { delay: delay }, bucket);
    var out = [];
    shapes.forEach(function (s, i) {
      var len = 0;
      try { len = s.getTotalLength(); } catch (err) { len = 0; }
      if (!len) return;
      var cs = getComputedStyle(s);
      var d = delay + Math.min(i * 60, 600);
      out.push(anim(s, [{ strokeDasharray: len + ' ' + len, strokeDashoffset: len }, { strokeDasharray: len + ' ' + len, strokeDashoffset: 0 }],
        { duration: 1300, easing: NM.ease.move, delay: d, fill: 'backwards' }, bucket));
      if (cs.fill !== 'none' && !isClear(cs.fill)) {
        var fo = parseFloat(cs.fillOpacity);
        out.push(anim(s, [{ fillOpacity: 0 }, { fillOpacity: 0, offset: 0.55 }, { fillOpacity: isFinite(fo) ? fo : 1 }],
          { duration: 1300, easing: 'linear', delay: d, fill: 'backwards' }, bucket));
      }
    });
    return out;
  }
  // Split text into WORDS (never characters: Arabic letters stay joined), then restore.
  function splitWords(e) {
    var groups = [];
    var tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null), n, nodes = [];
    while ((n = tw.nextNode())) {
      if (n.parentElement && n.parentElement.closest('svg,script,style')) continue;
      if (/\S/.test(n.nodeValue)) nodes.push(n);
    }
    var spans = [];
    nodes.forEach(function (tn) {
      var text = tn.nodeValue;
      var prev = tn.previousSibling, next = tn.nextSibling;
      var joinBefore = prev && !/\s$/.test(prev.textContent || ' ') && /^\S/.test(text);
      var joinAfter = next && !/^\s/.test(next.textContent || ' ') && /\S$/.test(text);
      var parts = text.split(/(\s+)/);
      var frag = document.createDocumentFragment(), made = [];
      parts.forEach(function (p, i) {
        if (!p) return;
        var edge = (i === 0 && joinBefore) || (i === parts.length - 1 && joinAfter);
        if (/^\s+$/.test(p) || edge) { var t = document.createTextNode(p); frag.appendChild(t); made.push(t); return; }
        var sp = document.createElement('span');
        sp.className = 'nm-word';
        sp.style.display = 'inline-block';
        sp.textContent = p;
        frag.appendChild(sp); made.push(sp); spans.push(sp);
      });
      groups.push({ orig: tn, made: made });
      tn.parentNode.replaceChild(frag, tn);
    });
    return {
      spans: spans,
      restore: function () {
        groups.forEach(function (g) {
          var first = g.made[0];
          if (!first || !first.parentNode) return;
          first.parentNode.insertBefore(g.orig, first);
          g.made.forEach(function (m) { if (m.parentNode) m.parentNode.removeChild(m); });
        });
        groups = [];
      }
    };
  }
  function entranceType(e, delay, bucket) {
    if (e instanceof SVGElement) return playEntrance(e, 'fade', { delay: delay }, bucket);
    var sp = splitWords(e);
    if (!sp.spans.length) { sp.restore(); return []; }
    var step = clamp(900 / sp.spans.length, 28, 90);
    var out = sp.spans.map(function (s, i) {
      return anim(s, [{ opacity: 0, translate: '0px 0.32em', filter: 'blur(6px)' }, { opacity: 1, translate: '0px 0px', filter: 'blur(0px)' }],
        { duration: 520, easing: NM.ease.enter, delay: delay + i * step, fill: 'backwards' }, bucket);
    });
    Promise.all(out.map(function (a) { return a.finished; })).then(sp.restore, sp.restore);
    return out;
  }
  function entranceCount(e, delay, bucket) {
    var tn = numericTextNode(e);
    if (!tn) return playEntrance(e, 'fade', { delay: delay }, bucket);
    var original = tn.nodeValue;
    var fmt = parseNum(original);
    if (!fmt || !isFinite(fmt.value)) return [];
    var a = anim(e, [{ opacity: 0 }, { opacity: baseOpacity(e), offset: 0.15 }, { opacity: baseOpacity(e) }],
      { duration: 1400, easing: NM.ease.move, delay: delay, fill: 'backwards' }, bucket);
    var stopped = false;
    tn.nodeValue = formatNum(0, fmt);
    (function tick() {
      if (stopped) return;
      var p = a.effect ? a.effect.getComputedTiming().progress : 1;
      if (p == null) p = a.playState === 'finished' ? 1 : 0;
      tn.nodeValue = formatNum(fmt.value * p, fmt);
      if (a.playState !== 'finished' && a.playState !== 'idle') requestAnimationFrame(tick);
    })();
    var done = function () { stopped = true; tn.nodeValue = original; };
    a.finished.then(done, done);
    return [a];
  }

  // Top-level blocks of a rig, descending through single-child wrappers.
  function blocksOf(root) {
    var c = root;
    while (c.children.length === 1 && c.children[0].children.length > 1 &&
           !c.children[0].matches('[data-step],[data-entrance],[data-morph],svg,img,[data-entrance-auto]')) c = c.children[0];
    return Array.prototype.filter.call(c.children, usableBlock);
  }
  function usableBlock(e) {
    if (/^(SCRIPT|STYLE|TEMPLATE|LINK|META|NOSCRIPT)$/.test(e.tagName)) return false;
    if (e.classList.contains('nm-layer')) return false;
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function readingSort(list) {
    var rects = new Map();
    list.forEach(function (e) { rects.set(e, rectInStage(e)); });
    return list.slice().sort(function (a, b) {
      var ra = rects.get(a), rb = rects.get(b);
      var ya = Math.round(ra.y / 48), yb = Math.round(rb.y / 48);
      if (ya !== yb) return ya - yb;
      return rtl ? (rb.x + rb.w) - (ra.x + ra.w) : ra.x - rb.x;
    });
  }
  function touches(e, set) {
    if (!set || !set.size) return 0;
    var hit = 0;
    set.forEach(function (x) {
      if (x === e || e.contains(x)) hit = hit || 2; // contains a morph target
      else if (x.contains(e)) hit = 1;             // inside a morph target
    });
    return hit;
  }
  // Play the arrival entrances of a slide. `exclude` = elements that arrived by morph.
  function playArrival(slide, o) {
    o = o || {};
    if (instantNow()) return;
    var exclude = o.exclude || new Set();
    var startAt = o.startAt || 0;
    var auto = slide.getAttribute('data-entrance-auto') !== 'off' && body.getAttribute('data-entrance-auto') !== 'off';
    var items = [];
    function skip(e) {
      return e.hasAttribute('data-step') || e.hasAttribute('data-entrance') || e.classList.contains('reveal') || isHiddenStep(e, slide);
    }
    if (auto) {
      (function collect(list) {
        list.forEach(function (b) {
          if (skip(b)) return;
          var t = touches(b, exclude);
          if (t === 1) return;
          if (t === 2) { collect(Array.prototype.filter.call(b.children, usableBlock)); return; }
          items.push({ el: b, kind: 'auto' });
        });
      })(blocksOf(S(slide).rig));
    }
    $$('[data-entrance]', slide).forEach(function (e) {
      if (e.hasAttribute('data-step') || isHiddenStep(e, slide) || touches(e, exclude)) return;
      var k = e.getAttribute('data-entrance');
      if (!k || k === 'none') return;
      items.push({ el: e, kind: k, order: parseFloat(e.getAttribute('data-entrance-order')), delay: parseFloat(e.getAttribute('data-entrance-delay')) || 0 });
    });
    if (!items.length) return;
    var sorted = readingSort(items.map(function (i) { return i.el; }));
    items.forEach(function (it) {
      var rank = sorted.indexOf(it.el);
      var d;
      if (it.kind === 'auto') {
        var r = rectInStage(it.el);
        var big = r.w * r.h > W * H * 0.6;
        it.kind = big ? 'fade' : 'rise';
        d = startAt + Math.min(rank, 9) * 75;
      } else {
        d = startAt + (isFinite(it.order) ? (it.order - 1) * 120 : Math.min(rank, 9) * 75) + it.delay;
      }
      playEntrance(it.el, it.kind, { dir: o.dir || 1, delay: d }, entranceBucket);
    });
  }

  /* ------------------------------------------------------------------------
     11. Morph engine: pairing
     ------------------------------------------------------------------------ */
  function normText(t) {
    return (t || '').replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim();
  }
  function morphCandidates(slide, sel) {
    return $$(sel, slide).filter(function (e) {
      if (isHiddenStep(e, slide)) return false;
      if (e.closest('.nm-layer')) return false;
      var r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }
  function findPairs(from, to) {
    var pairs = [], usedA = new Set(), usedB = new Set();
    function add(a, b, auto) {
      if (usedA.has(a) || usedB.has(b)) return;
      usedA.add(a); usedB.add(b);
      pairs.push({ a: a, b: b, id: a.getAttribute('data-morph') || (auto || 'auto') });
    }
    var A = morphCandidates(from, '[data-morph]'), B = morphCandidates(to, '[data-morph]');
    var byId = {};
    B.forEach(function (b) { (byId[b.getAttribute('data-morph')] = byId[b.getAttribute('data-morph')] || []).push(b); });
    A.forEach(function (a) { var l = byId[a.getAttribute('data-morph')]; if (l && l.length) add(a, l.shift()); });
    var autoOn = (body.getAttribute('data-nm-automorph') || 'on') !== 'off' && from.getAttribute('data-nm-automorph') !== 'off' && to.getAttribute('data-nm-automorph') !== 'off';
    if (autoOn) {
      var hsel = 'h1:not([data-morph]),h2:not([data-morph]),h3:not([data-morph]),h4:not([data-morph]),h5:not([data-morph]),h6:not([data-morph])';
      var hb = morphCandidates(to, hsel);
      morphCandidates(from, hsel).forEach(function (a) {
        var t = normText(a.textContent);
        if (!t) return;
        var b = hb.find(function (x) { return !usedB.has(x) && normText(x.textContent) === t; });
        if (b) add(a, b, 'heading');
      });
      var ib = morphCandidates(to, 'img[src]:not([data-morph])');
      morphCandidates(from, 'img[src]:not([data-morph])').forEach(function (a) {
        var b = ib.find(function (x) { return !usedB.has(x) && x.getAttribute('src') === a.getAttribute('src'); });
        if (b) add(a, b, 'image');
      });
      var nb = morphCandidates(to, '[data-node]:not([data-morph])');
      morphCandidates(from, '[data-node]:not([data-morph])').forEach(function (a) {
        var b = nb.find(function (x) { return !usedB.has(x) && x.getAttribute('data-node') === a.getAttribute('data-node'); });
        if (b) add(a, b, 'node');
      });
    }
    // an outer pair carries its contents; drop pairs nested inside another pair
    return pairs.filter(function (p) {
      return !pairs.some(function (q) { return q !== p && ((q.a !== p.a && q.a.contains(p.a)) || (q.b !== p.b && q.b.contains(p.b))); });
    });
  }
  var INLINE_TAGS = /^(SPAN|B|STRONG|EM|I|U|SMALL|SUP|SUB|MARK|A|BR|ABBR|BDI|BDO|Q|S|CODE|KBD|TIME|VAR|CITE|DFN|WBR)$/;
  function hasBoxVisual(cs) {
    return !isClear(cs.backgroundColor) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' ||
      (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && !isClear(cs.borderTopColor));
  }
  function isTextEl(e) {
    if (e instanceof SVGElement) return false;
    if (!normText(e.textContent)) return false;
    var all = e.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) if (!INLINE_TAGS.test(all[i].tagName)) return false;
    return !hasBoxVisual(getComputedStyle(e));
  }
  function isShape(e) { return typeof SVGGeometryElement !== 'undefined' && e instanceof SVGGeometryElement; }
  function kindOf(a, b) {
    var k = b.getAttribute('data-morph-kind') || a.getAttribute('data-morph-kind');
    if (k === 'words' || k === 'text' || k === 'number') {
      if (a instanceof SVGElement || b instanceof SVGElement) return null;
      if (k === 'number' && !(numericTextNode(a) && numericTextNode(b))) return 'text';
      return k;
    }
    if (k === 'path') return isShape(a) && isShape(b) ? 'path' : null;
    if (k === 'image') return a.tagName === 'IMG' && b.tagName === 'IMG' ? 'image' : 'box';
    if (k === 'box') return isSvgChild(a) || isSvgChild(b) ? null : 'box';
    if (isShape(a) && isShape(b)) return 'path';
    if (isSvgChild(a) || isSvgChild(b)) return null;
    if (a.tagName === 'IMG' && b.tagName === 'IMG') return 'image';
    if (isNumberEl(a) && isNumberEl(b)) {
      var na = parseNum(a.textContent.trim()), nb = parseNum(b.textContent.trim());
      if (na && nb && na.value !== nb.value) return 'number';
    }
    if (isTextEl(a) && isTextEl(b)) return 'text';
    return 'box';
  }

  /* ------------------------------------------------------------------------
     12. Morph engine: measuring and style-faithful clones
     ------------------------------------------------------------------------ */
  var SKIP_PROP = /^(transition|animation|will-change|view-transition|offset|anchor|position-try|position-anchor|position-area|position-visibility|contain-intrinsic|interpolate-size|cursor|pointer-events|user-select|-webkit-user|visibility|content-visibility|translate$|rotate$|scale$|transform$|-webkit-app-region|app-region|timeline|scroll-timeline|view-timeline|animation-timeline|field-sizing|zoom)/;
  var INHERITED = new Set(('color font-family font-size font-style font-weight font-variant font-stretch font-feature-settings ' +
    'font-variation-settings font-kerning font-optical-sizing font-size-adjust font-synthesis-weight font-synthesis-style ' +
    'font-synthesis-small-caps font-variant-ligatures font-variant-numeric font-variant-east-asian font-variant-caps ' +
    'font-variant-alternates font-variant-position font-palette line-height letter-spacing word-spacing text-align ' +
    'text-align-last text-indent text-transform text-shadow white-space white-space-collapse text-wrap text-wrap-mode ' +
    'text-wrap-style word-break overflow-wrap line-break hyphens direction writing-mode text-rendering -webkit-font-smoothing ' +
    'fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray ' +
    'stroke-dashoffset stroke-miterlimit paint-order list-style-type list-style-position list-style-image quotes tab-size ' +
    'orphans widows caret-color -webkit-text-fill-color -webkit-text-stroke-color -webkit-text-stroke-width ' +
    'text-emphasis-color text-emphasis-style text-emphasis-position text-underline-position text-decoration-skip-ink ' +
    'border-collapse border-spacing empty-cells caption-side image-rendering color-scheme text-size-adjust -webkit-locale ' +
    'dominant-baseline clip-rule color-interpolation color-interpolation-filters color-rendering marker-start marker-mid ' +
    'marker-end shape-rendering text-anchor speak forced-color-adjust print-color-adjust math-depth math-style ' +
    '-webkit-border-horizontal-spacing -webkit-border-vertical-spacing -webkit-highlight -webkit-hyphenate-character ' +
    '-webkit-line-break -webkit-rtl-ordering -webkit-text-combine -webkit-text-security -webkit-text-orientation ' +
    'text-orientation ruby-position ruby-align -webkit-tap-highlight-color text-spacing-trim text-autospace hanging-punctuation').split(' '));
  var STRIP_CLASSES = ['nm-morph-hidden', 'nm-morph-hidden-svg', 'is-current', 'nm-dim', 'nm-undim', 'zoom-focused', 'nm-highlighted', 'nm-word'];
  function styleText(src, parentCS) {
    var cs = getComputedStyle(src), out = '';
    for (var i = 0; i < cs.length; i++) {
      var p = cs[i];
      if (SKIP_PROP.test(p)) continue;
      var v = cs.getPropertyValue(p);
      if (parentCS && INHERITED.has(p) && parentCS.getPropertyValue(p) === v) continue;
      out += p + ':' + v + ';';
    }
    return { css: out, cs: cs };
  }
  function scrubAttrs(e) {
    ['id', 'data-step', 'data-act', 'data-morph', 'data-morph-kind', 'data-morph-arc', 'data-morph-ease', 'data-morph-z',
      'data-entrance', 'data-entrance-order', 'data-entrance-delay', 'data-zoom-step', 'contenteditable', 'data-node'].forEach(function (a) { e.removeAttribute(a); });
    if (e.classList) STRIP_CLASSES.forEach(function (c) { e.classList.remove(c); });
  }
  // Deep clone with every computed style inlined, so it renders identically out of context.
  function styledClone(src, slide) {
    var dst = src.cloneNode(true);
    (function walk(s, d, parentCS) {
      if (s.nodeType !== 1) return;
      var st = styleText(s, parentCS);
      scrubAttrs(d);
      var vis = parentCS === null ? 'visible' : (isHiddenStep(s, slide) && s.hasAttribute('data-step') ? 'hidden' : null);
      d.setAttribute('style', st.css + (vis ? 'visibility:' + vis + ';' : ''));
      var sc = s.childNodes, dc = d.childNodes;
      for (var i = 0; i < sc.length && i < dc.length; i++) walk(sc[i], dc[i], st.cs);
    })(src, dst, null);
    return dst;
  }
  function layoutSize(e, vr, camK) {
    var w = vr.w / camK, h = vr.h / camK;
    if (e.offsetWidth != null && !(e instanceof SVGElement)) {
      if (e.offsetWidth && Math.abs(e.offsetWidth - w) > 2) { w = e.offsetWidth; h = e.offsetHeight; }
    }
    return { w: w || 1, h: h || 1, k: vr.w / (w || 1) };
  }
  function radiusOf(cs, w, h, k) {
    var corners = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
    var hs = [], vs = [];
    corners.forEach(function (c) {
      var parts = (cs[c] || '0px').split(' ');
      var hv = parts[0], vv = parts[1] || parts[0];
      hs.push(/%$/.test(hv) ? parseFloat(hv) / 100 * w : parseFloat(hv) * k || 0);
      vs.push(/%$/.test(vv) ? parseFloat(vv) / 100 * h : parseFloat(vv) * k || 0);
    });
    // CSS clamps radii that do not fit; mimic the uniform reduction
    var f = Math.min(1, w / Math.max(hs[0] + hs[1], 1e-6), w / Math.max(hs[2] + hs[3], 1e-6), h / Math.max(vs[0] + vs[3], 1e-6), h / Math.max(vs[1] + vs[2], 1e-6));
    return hs.map(function (x) { return px(x * f); }).join(' ') + ' / ' + vs.map(function (x) { return px(x * f); }).join(' ');
  }
  function scaleShadow(sh, k) {
    if (!sh || sh === 'none' || k === 1) return sh;
    return sh.replace(/(-?\d*\.?\d+)px/g, function (m, n) { return px(parseFloat(n) * k); });
  }
  function boxVisual(e, r, k) {
    var cs = getComputedStyle(e);
    var bw = parseFloat(cs.borderTopWidth) || 0;
    var hasBorder = bw > 0 && cs.borderTopStyle !== 'none';
    return {
      bg: cs.backgroundColor,
      radius: radiusOf(cs, r.w, r.h, k),
      shadow: cs.boxShadow === 'none' ? 'none' : scaleShadow(cs.boxShadow, k),
      opacity: cs.opacity,
      bw: hasBorder ? px(bw * k) : '0px',
      bc: hasBorder ? cs.borderTopColor : transparentOf(cs.borderTopColor),
      overflow: cs.overflow !== 'visible' && cs.overflow !== 'visible visible',
      color: cs.color,
      fontSize: parseFloat(cs.fontSize) || 16,
      align: cs.textAlign,
      dir: cs.direction
    };
  }
  // Snapshot of one side of a pair, taken while that side is laid out.
  function snapshot(e, slide, kind) {
    var vr = visualRect(e);
    var camK = S(slide).cam.k || 1;
    var side = { el: e, r: vr, kind: kind };
    if (kind === 'path') { side.path = shapeSample(e); return side; }
    var ls = layoutSize(e, vr, camK);
    side.lw = ls.w; side.lh = ls.h; side.k = ls.k;
    side.vis = boxVisual(e, vr, ls.k);
    if (kind === 'words') { side.words = wordsOf(e, slide); return side; }
    if (kind === 'image') {
      var cs = getComputedStyle(e);
      side.img = { src: e.currentSrc || e.src, nw: e.naturalWidth || ls.w, nh: e.naturalHeight || ls.h, fit: cs.objectFit, pos: cs.objectPosition };
      return side;
    }
    side.clone = styledClone(e, slide);
    if (kind === 'number') side.num = parseNum((numericTextNode(e) || {}).nodeValue || '');
    side.text = normText(e.textContent);
    return side;
  }

  /* ------------------------------------------------------------------------
     13. Morph engine: ghosts
     ------------------------------------------------------------------------ */
  var SAMPLES = 20;
  function anchorOf(vis) {
    var a = vis.align;
    if (a === 'center' || a === '-webkit-center') return 'center';
    if (a === 'left' || a === '-webkit-left') return 'left';
    if (a === 'right' || a === '-webkit-right') return 'right';
    var startRight = vis.dir === 'rtl';
    if (a === 'end') return startRight ? 'left' : 'right';
    return startRight ? 'right' : 'left';
  }
  function placeClone(c, side, anchor) {
    var s = c.style;
    s.position = 'absolute';
    s.margin = '0';
    s.top = '0px';
    s.bottom = 'auto';
    s.inset = '';
    s.top = '0px';
    s.width = px(side.lw);
    s.height = px(side.lh);
    s.boxSizing = 'border-box';
    s.opacity = '1';
    s.visibility = 'visible';
    s.transform = 'none';
    s.zIndex = 'auto';
    s.float = 'none';
    s.maxWidth = 'none'; s.maxHeight = 'none'; s.minWidth = '0px'; s.minHeight = '0px';
    if (/^inline($|\s)/.test(getComputedStyle(side.el).display)) s.display = 'inline-block';
    if (anchor === 'center') { s.left = '50%'; s.right = 'auto'; s.marginLeft = px(-side.lw / 2); s.transformOrigin = '50% 0'; }
    else if (anchor === 'right') { s.right = '0px'; s.left = 'auto'; s.transformOrigin = '100% 0'; }
    else { s.left = '0px'; s.right = 'auto'; s.transformOrigin = '0 0'; }
  }
  function stripBoxVisual(c) {
    c.style.backgroundColor = 'transparent';
    c.style.borderColor = 'transparent';
    c.style.boxShadow = 'none';
    c.style.outline = 'none';
  }
  // Path of the ghost centre: straight, or a Material-style arc.
  function pathFn(c0, c1, mode) {
    var dx = c1.x - c0.x, dy = c1.y - c0.y;
    if (mode === 'off' || Math.abs(dx) < 70 || Math.abs(dy) < 70) {
      return function (t) { return { x: lerp(c0.x, c1.x, t), y: lerp(c0.y, c1.y, t) }; };
    }
    var mid = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    var A = { x: c0.x, y: c1.y }, B = { x: c1.x, y: c0.y };
    var corner;
    if (mode === 'cw' || mode === 'ccw') {
      var cross = dx * (B.y - mid.y) - dy * (B.x - mid.x);
      corner = ((cross > 0) === (mode === 'cw')) ? B : A;
    } else {
      corner = dy > 0 ? B : A;
    }
    var ctrl = { x: lerp(mid.x, corner.x, 0.6), y: lerp(mid.y, corner.y, 0.6) };
    return function (t) {
      var u = 1 - t;
      return { x: u * u * c0.x + 2 * u * t * ctrl.x + t * t * c1.x, y: u * u * c0.y + 2 * u * t * ctrl.y + t * t * c1.y };
    };
  }
  function centre(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  // Geometry keyframes of a ghost container: real left/top/width/height along the path.
  function geomFrames(p, path) {
    var f = [];
    for (var i = 0; i <= SAMPLES; i++) {
      var t = i / SAMPLES, c = path(t);
      var w = lerp(p.A.r.w, p.B.r.w, t), h = lerp(p.A.r.h, p.B.r.h, t);
      f.push({ offset: t, left: px(c.x - w / 2), top: px(c.y - h / 2), width: px(w), height: px(h) });
    }
    f[0].left = px(p.A.r.x); f[0].top = px(p.A.r.y);
    f[SAMPLES].left = px(p.B.r.x); f[SAMPLES].top = px(p.B.r.y);
    return f;
  }
  function scaleFrames(fn) {
    var f = [];
    for (var i = 0; i <= SAMPLES; i++) {
      var t = i / SAMPLES;
      f.push({ offset: t, transform: 'scale(' + Math.round(fn(t) * 100000) / 100000 + ')' });
    }
    return f;
  }
  function makeShell(p, z) {
    var g = el('div', 'nm-ghost');
    g.style.cssText = 'left:' + px(p.A.r.x) + ';top:' + px(p.A.r.y) + ';width:' + px(p.A.r.w) + ';height:' + px(p.A.r.h) + ';z-index:' + z + ';';
    return g;
  }
  function ghostBox(p, T, bucket) {
    var A = p.A, B = p.B, g = makeShell(p, p.z);
    var va = A.vis, vb = B.vis;
    g.style.backgroundColor = va.bg;
    g.style.borderRadius = va.radius;
    g.style.boxShadow = va.shadow;
    g.style.opacity = va.opacity;
    if (va.overflow || vb.overflow || va.radius.replace(/[^1-9]/g, '') || vb.radius.replace(/[^1-9]/g, '')) g.style.overflow = 'hidden';
    var anchor = anchorOf(vb);
    var ca = A.clone, cb = B.clone;
    placeClone(ca, A, anchor); placeClone(cb, B, anchor);
    stripBoxVisual(ca); stripBoxVisual(cb);
    var same = A.text === B.text && A.clone.innerHTML.length > 0 && Math.abs(A.lw / A.lh - B.lw / B.lh) < 0.04 && !A.clone.querySelector('img,svg,video,canvas');
    var border = el('div', 'nm-ghost-border');
    border.style.cssText = 'border-width:' + va.bw + ';border-color:' + va.bc + ';border-radius:' + va.radius + ';';
    var fitA = function (t) { var w = lerp(A.r.w, B.r.w, t), h = lerp(A.r.h, B.r.h, t); return Math.min(w / A.lw, h / A.lh); };
    var fitB = function (t) { var w = lerp(A.r.w, B.r.w, t), h = lerp(A.r.h, B.r.h, t); return Math.min(w / B.lw, h / B.lh); };
    if (!same) g.appendChild(ca);
    g.appendChild(cb);
    g.appendChild(border);
    ghostLayer.appendChild(g);
    var path = pathFn(centre(A.r), centre(B.r), p.arc);
    var o = { duration: T.dur, delay: T.delay, easing: T.ease, fill: 'both' };
    anim(g, geomFrames(p, path), o, bucket);
    anim(g, [{ backgroundColor: va.bg, borderRadius: va.radius, boxShadow: va.shadow, opacity: va.opacity },
      { backgroundColor: vb.bg, borderRadius: vb.radius, boxShadow: vb.shadow, opacity: vb.opacity }], o, bucket);
    anim(border, [{ borderWidth: va.bw, borderColor: va.bc, borderRadius: va.radius }, { borderWidth: vb.bw, borderColor: vb.bc, borderRadius: vb.radius }], o, bucket);
    anim(cb, scaleFrames(fitB), o, bucket);
    if (same) {
      if (va.color !== vb.color) anim(cb, [{ color: va.color }, { color: vb.color }], o, bucket);
    } else {
      anim(ca, scaleFrames(fitA), o, bucket);
      anim(ca, [{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], o, bucket);
      anim(cb, [{ opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.62 }, { opacity: 1 }], o, bucket);
    }
    return g;
  }
  function ghostText(p, T, bucket) {
    var A = p.A, B = p.B, g = makeShell(p, p.z);
    var anchor = anchorOf(B.vis);
    var ca = A.clone, cb = B.clone;
    placeClone(ca, A, anchor); placeClone(cb, B, anchor);
    var Fa = A.vis.fontSize * A.k, Fb = B.vis.fontSize * B.k;
    var sameText = A.text === B.text;
    var sameWrap = Math.abs((A.r.w / A.r.h) - (B.r.w / B.r.h)) / Math.max(B.r.w / B.r.h, 1e-6) < 0.06;
    var single = p.kind === 'number' || (sameText && sameWrap);
    var o = { duration: T.dur, delay: T.delay, easing: T.ease, fill: 'both' };
    if (!single) g.appendChild(ca);
    g.appendChild(cb);
    ghostLayer.appendChild(g);
    var path = pathFn(centre(A.r), centre(B.r), p.arc);
    anim(g, geomFrames(p, path), o, bucket);
    anim(cb, scaleFrames(function (t) { return lerp(Fa, Fb, t) / B.vis.fontSize; }), o, bucket);
    if (A.vis.color !== B.vis.color) anim(cb, [{ color: A.vis.color }, { color: B.vis.color }], o, bucket);
    if (!single) {
      anim(ca, scaleFrames(function (t) { return lerp(Fa, Fb, t) / A.vis.fontSize; }), o, bucket);
      if (A.vis.color !== B.vis.color) anim(ca, [{ color: A.vis.color }, { color: B.vis.color }], o, bucket);
      anim(ca, [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], o, bucket);
      anim(cb, [{ opacity: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.6 }, { opacity: 1 }], o, bucket);
    }
    if (p.kind === 'number' && A.num && B.num) {
      var tn = numericTextNode(cb);
      if (tn) {
        var driver = bucket[bucket.length - 1] || null;
        var v0 = A.num.value, v1 = B.num.value, fmt = Object.assign({}, B.num);
        fmt.decimals = Math.max(A.num.decimals, B.num.decimals);
        var finalText = tn.nodeValue;
        tn.nodeValue = formatNum(v0, fmt);
        (function tick() {
          if (!driver || !tn.isConnected) return;
          var ct = driver.effect.getComputedTiming();
          var pr = ct.progress == null ? (driver.playState === 'finished' ? 1 : 0) : ct.progress;
          if (driver.playState === 'finished' || (ct.localTime != null && ct.localTime >= ct.endTime)) { tn.nodeValue = finalText; return; }
          tn.nodeValue = formatNum(lerp(v0, v1, clamp(pr, 0, 1.05)), fmt);
          requestAnimationFrame(tick);
        })();
        driver.finished.then(function () { tn.nodeValue = finalText; }, function () {});
      }
    }
    return g;
  }
  function objectRect(img, w, h, k) {
    var nw = img.nw, nh = img.nh, s;
    switch (img.fit) {
      case 'cover': s = Math.max(w / nw, h / nh); break;
      case 'contain': s = Math.min(w / nw, h / nh); break;
      case 'none': s = k; break;
      case 'scale-down': s = Math.min(k, Math.min(w / nw, h / nh)); break;
      default: return { x: 0, y: 0, w: w, h: h };
    }
    var iw = nw * s, ih = nh * s;
    var pos = (img.pos || '50% 50%').split(' ');
    function off(v, free) { return /%$/.test(v) ? free * parseFloat(v) / 100 : (parseFloat(v) || 0) * k; }
    return { x: off(pos[0], w - iw), y: off(pos[1] || '50%', h - ih), w: iw, h: ih };
  }
  function ghostImage(p, T, bucket) {
    var A = p.A, B = p.B, g = makeShell(p, p.z);
    var va = A.vis, vb = B.vis;
    g.style.borderRadius = va.radius;
    g.style.boxShadow = va.shadow;
    g.style.backgroundColor = va.bg;
    g.style.opacity = va.opacity;
    g.style.overflow = 'hidden';
    var same = A.img.src === B.img.src;
    var o = { duration: T.dur, delay: T.delay, easing: T.ease, fill: 'both' };
    function imgEl(src) {
      var i = document.createElement('img');
      i.src = src; i.alt = '';
      i.style.cssText = 'position:absolute;left:0;top:0;max-width:none;max-height:none;margin:0;padding:0;border:0;display:block;';
      g.appendChild(i);
      return i;
    }
    function frames(fn) {
      var f = [];
      for (var i = 0; i <= SAMPLES; i++) {
        var t = i / SAMPLES, w = lerp(A.r.w, B.r.w, t), h = lerp(A.r.h, B.r.h, t), k = lerp(A.k, B.k, t);
        var r = fn(t, w, h, k);
        f.push({ offset: t, left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) });
      }
      return f;
    }
    var rA = function (t, w, h, k) { return objectRect(A.img, w, h, k); };
    var rB = function (t, w, h, k) { return objectRect(B.img, w, h, k); };
    var border = el('div', 'nm-ghost-border');
    border.style.cssText = 'border-width:' + va.bw + ';border-color:' + va.bc + ';border-radius:' + va.radius + ';';
    if (same) {
      var i1 = imgEl(B.img.src);
      anim(i1, frames(function (t, w, h, k) {
        var a = rA(t, w, h, k), b = rB(t, w, h, k);
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
      }), o, bucket);
    } else {
      var ia = imgEl(A.img.src), ib = imgEl(B.img.src);
      anim(ia, frames(rA), o, bucket);
      anim(ib, frames(rB), o, bucket);
      anim(ib, [{ opacity: 0 }, { opacity: 1, offset: 0.55 }, { opacity: 1 }], o, bucket);
    }
    g.appendChild(border);
    ghostLayer.appendChild(g);
    var path = pathFn(centre(A.r), centre(B.r), p.arc);
    anim(g, geomFrames(p, path), o, bucket);
    anim(g, [{ borderRadius: va.radius, boxShadow: va.shadow, backgroundColor: va.bg, opacity: va.opacity },
      { borderRadius: vb.radius, boxShadow: vb.shadow, backgroundColor: vb.bg, opacity: vb.opacity }], o, bucket);
    anim(border, [{ borderWidth: va.bw, borderColor: va.bc, borderRadius: va.radius }, { borderWidth: vb.bw, borderColor: vb.bc, borderRadius: vb.radius }], o, bucket);
    return g;
  }

  /* ---- words: split by WORD, matching words fly individually ------------- */
  function normWord(w) { return normText(w).replace(/[،,.:;؛!؟?"'«»()\[\]{}\-–—]/g, ''); }
  function wordsOf(e, slide) {
    var out = [], tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), n;
    while ((n = tw.nextNode())) {
      var p = n.parentElement;
      if (!p || p.closest('svg,script,style') || isHiddenStep(p, slide)) continue;
      var re = /\S+/g, m, cs = null;
      while ((m = re.exec(n.nodeValue))) {
        var rg = document.createRange();
        rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        var rc = rg.getBoundingClientRect();
        if (!rc.width) continue;
        cs = cs || getComputedStyle(p);
        out.push({ text: m[0], norm: normWord(m[0]), r: toStage(rc), font: wordFont(cs), color: cs.color });
      }
    }
    return out;
  }
  function wordFont(cs) {
    return 'font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize + ';font-weight:' + cs.fontWeight + ';font-style:' + cs.fontStyle +
      ';font-stretch:' + cs.fontStretch + ';font-feature-settings:' + cs.fontFeatureSettings + ';font-variation-settings:' + cs.fontVariationSettings +
      ';letter-spacing:' + cs.letterSpacing + ';text-transform:' + cs.textTransform + ';text-shadow:' + cs.textShadow +
      ';font-kerning:' + cs.fontKerning + ';line-height:normal;direction:' + cs.direction + ';';
  }
  function wordGhost(w, z) {
    var s = el('span', 'nm-ghost nm-ghost-word');
    s.textContent = w.text;
    s.style.cssText = w.font + 'color:' + w.color + ';-webkit-text-fill-color:currentColor;z-index:' + z + ';';
    ghostLayer.appendChild(s);
    var rg = document.createRange();
    rg.selectNodeContents(s);
    var tr = toStage(rg.getBoundingClientRect()), sr = toStage(s.getBoundingClientRect());
    var gx = ghostLayer.getBoundingClientRect();
    var lo = toStage(gx);
    s._t = { ox: tr.x - lo.x, oy: tr.y - lo.y, tw: tr.w || 1, th: tr.h || 1, bx: sr.x - lo.x, by: sr.y - lo.y };
    s.style.transformOrigin = px(s._t.ox + s._t.tw / 2) + ' ' + px(s._t.oy + s._t.th / 2);
    return s;
  }
  function wordTransform(s, c, scale) {
    var t = s._t;
    return 'translate(' + px(c.x - (t.ox + t.tw / 2)) + ', ' + px(c.y - (t.oy + t.th / 2)) + ') scale(' + Math.round(scale * 100000) / 100000 + ')';
  }
  // Words that swap places lift apart (leftward travellers rise, rightward ones dip) so they never collide.
  function wordPath(c0, c1, arc) {
    if (arc === 'cw' || arc === 'ccw') return pathFn(c0, c1, arc);
    var dx = c1.x - c0.x;
    var lift = arc === 'off' || Math.abs(dx) < 40 ? 0 : clamp(Math.abs(dx) * 0.16, 0, 70) * (dx < 0 ? -1 : 1);
    var ctrl = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 + lift * 2 };
    return function (t) {
      var u = 1 - t;
      return { x: u * u * c0.x + 2 * u * t * ctrl.x + t * t * c1.x, y: u * u * c0.y + 2 * u * t * ctrl.y + t * t * c1.y };
    };
  }
  function ghostWords(p, T, bucket) {
    var wa = p.A.words, wb = p.B.words, used = new Set(), matches = [];
    wb.forEach(function (b, bi) {
      var best = -1, bestD = Infinity;
      wa.forEach(function (a, ai) {
        if (used.has(ai) || a.norm !== b.norm || !a.norm) return;
        var d = Math.abs(ai / Math.max(wa.length, 1) - bi / Math.max(wb.length, 1));
        if (d < bestD) { bestD = d; best = ai; }
      });
      if (best >= 0) { used.add(best); matches.push({ a: wa[best], b: b }); }
      else matches.push({ a: null, b: b });
    });
    var nodes = [];
    var o = function (d) { return { duration: T.dur, delay: T.delay + d, easing: T.ease, fill: 'both' }; };
    matches.forEach(function (m, i) {
      var s = wordGhost(m.b, p.z + 1);
      nodes.push(s);
      var sb = m.b.r.h / s._t.th;
      if (Math.abs(sb - 1) < 0.03) sb = 1;
      var cb = centre(m.b.r);
      if (m.a) {
        var sa = m.a.r.h / s._t.th, ca = centre(m.a.r);
        var path = wordPath(ca, cb, p.arc);
        var f = [];
        for (var k = 0; k <= SAMPLES; k++) {
          var t = k / SAMPLES;
          f.push({ offset: t, transform: wordTransform(s, path(t), lerp(sa, sb, t)) });
        }
        var d = Math.min(i * 16, 220);
        anim(s, f, o(d), bucket);
        if (m.a.color !== m.b.color) anim(s, [{ color: m.a.color }, { color: m.b.color }], o(d), bucket);
      } else {
        s.style.transform = wordTransform(s, cb, sb);
        anim(s, [{ opacity: 0, translate: '0px 14px' }, { opacity: 0, translate: '0px 14px', offset: 0.35 }, { opacity: 1, translate: '0px 0px', offset: 0.85 }, { opacity: 1, translate: '0px 0px' }], o(0), bucket);
      }
    });
    wa.forEach(function (a, ai) {
      if (used.has(ai)) return;
      var s = wordGhost(a, p.z);
      nodes.push(s);
      s.style.transform = wordTransform(s, centre(a.r), a.r.h / s._t.th);
      anim(s, [{ opacity: 1, translate: '0px 0px' }, { opacity: 0, translate: '0px -10px', offset: 0.3 }, { opacity: 0, translate: '0px -10px' }], o(0), bucket);
    });
    return nodes;
  }

  /* ---- path: resample both outlines to N points, interpolate `d` --------- */
  var PATH_N = 120;
  function shapeSample(e) {
    var ctm = e.getScreenCTM();
    var sr = stage.getBoundingClientRect(), s = sr.width / W || 1;
    function map(pt) {
      var q = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
      return [(q.x - sr.left) / s, (q.y - sr.top) / s];
    }
    var tag = e.tagName.toLowerCase();
    var closed = /^(circle|ellipse|rect|polygon)$/.test(tag) || (tag === 'path' && /z\s*$/i.test(e.getAttribute('d') || ''));
    var pts = [];
    var verts = null;
    if (tag === 'polygon' || tag === 'polyline') verts = Array.prototype.map.call(e.points, function (p) { return { x: p.x, y: p.y }; });
    else if (tag === 'line') verts = [{ x: e.x1.baseVal.value, y: e.y1.baseVal.value }, { x: e.x2.baseVal.value, y: e.y2.baseVal.value }];
    else if (tag === 'rect' && !(e.rx.baseVal.value || e.ry.baseVal.value)) {
      var x = e.x.baseVal.value, y = e.y.baseVal.value, w = e.width.baseVal.value, h = e.height.baseVal.value;
      verts = [{ x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }];
    }
    if (verts && verts.length > 1) {
      // distribute N points along the segments, every vertex included exactly
      var segs = [], total = 0, cnt = verts.length - (closed ? 0 : 1);
      for (var i = 0; i < cnt; i++) {
        var a = verts[i], b = verts[(i + 1) % verts.length], L = Math.hypot(b.x - a.x, b.y - a.y);
        segs.push({ a: a, b: b, L: L }); total += L;
      }
      var budget = PATH_N - (closed ? 0 : 1), alloc = segs.map(function (sg) { return Math.max(1, Math.floor(budget * sg.L / (total || 1))); });
      var sum = alloc.reduce(function (x, y) { return x + y; }, 0), j = 0;
      while (sum < budget) { alloc[j % alloc.length]++; sum++; j++; }
      while (sum > budget) { var mx = alloc.indexOf(Math.max.apply(null, alloc)); alloc[mx]--; sum--; }
      segs.forEach(function (sg, si) {
        for (var q = 0; q < alloc[si]; q++) { var t = q / alloc[si]; pts.push(map({ x: lerp(sg.a.x, sg.b.x, t), y: lerp(sg.a.y, sg.b.y, t) })); }
      });
      if (!closed) pts.push(map(verts[verts.length - 1]));
    } else {
      var len = e.getTotalLength();
      for (var k = 0; k < PATH_N; k++) pts.push(map(e.getPointAtLength(len * k / (closed ? PATH_N : PATH_N - 1))));
    }
    var cs = getComputedStyle(e);
    var sc = Math.sqrt(Math.abs(ctm.a * ctm.d - ctm.b * ctm.c)) / s;
    return {
      pts: pts, closed: closed,
      fill: cs.fill, stroke: cs.stroke, sw: (parseFloat(cs.strokeWidth) || 0) * sc,
      fo: cs.fillOpacity, so: cs.strokeOpacity, op: cs.opacity, cap: cs.strokeLinecap, join: cs.strokeLinejoin
    };
  }
  function alignPoints(a, b, closed) {
    function cost(arr) { var c = 0; for (var i = 0; i < a.length; i++) { var dx = a[i][0] - arr[i][0], dy = a[i][1] - arr[i][1]; c += dx * dx + dy * dy; } return c; }
    var cands = [b, b.slice().reverse()];
    var best = b, bestC = Infinity;
    cands.forEach(function (base) {
      if (!closed) { var c0 = cost(base); if (c0 < bestC) { bestC = c0; best = base; } return; }
      for (var off = 0; off < base.length; off++) {
        var rot = base.slice(off).concat(base.slice(0, off));
        var c = cost(rot);
        if (c < bestC) { bestC = c; best = rot; }
      }
    });
    return best;
  }
  function dOf(pts, closed) {
    return 'path("M' + pts.map(function (p) { return (Math.round(p[0] * 100) / 100) + ' ' + (Math.round(p[1] * 100) / 100); }).join(' L') + (closed ? ' Z' : '') + '")';
  }
  function paintPair(a, b) {
    var na = a === 'none' || isClear(a), nb = b === 'none' || isClear(b);
    if (na && nb) return ['none', 'none'];
    return [na ? transparentOf(b) : a, nb ? transparentOf(a) : b];
  }
  function ghostPath(p, T, bucket) {
    var A = p.A.path, B = p.B.path, closed = A.closed && B.closed;
    var pb = alignPoints(A.pts, B.pts, closed);
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'nm-ghost nm-ghost-svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.zIndex = p.z;
    var path = document.createElementNS(NS, 'path');
    var fills = paintPair(A.fill, B.fill), strokes = paintPair(A.stroke, B.stroke);
    path.style.cssText = 'd:' + dOf(A.pts, closed) + ';fill:' + fills[0] + ';stroke:' + strokes[0] + ';stroke-width:' + px(A.sw) +
      ';stroke-linecap:' + B.cap + ';stroke-linejoin:' + B.join + ';';
    svg.appendChild(path);
    ghostLayer.appendChild(svg);
    var o = { duration: T.dur, delay: T.delay, easing: T.ease, fill: 'both' };
    anim(path, [
      { d: dOf(A.pts, closed), fill: fills[0], stroke: strokes[0], strokeWidth: px(A.sw), fillOpacity: A.fo, strokeOpacity: A.so, opacity: A.op },
      { d: dOf(pb, closed), fill: fills[1], stroke: strokes[1], strokeWidth: px(B.sw), fillOpacity: B.fo, strokeOpacity: B.so, opacity: B.op }
    ], o, bucket);
    return svg;
  }

  /* ---- build every ghost for a transition -------------------------------- */
  function morphTiming(p, i) {
    var dist = Math.hypot(centre(p.A.r).x - centre(p.B.r).x, centre(p.A.r).y - centre(p.B.r).y);
    var sz = Math.abs(Math.sqrt(p.A.r.w * p.A.r.h) - Math.sqrt(p.B.r.w * p.B.r.h));
    var dur = clamp(620 + dist * 0.3 + sz * 0.22, 700, 1250);
    if (p.kind === 'words') dur = Math.max(dur, 950);
    if (p.kind === 'number') dur = Math.max(dur, 1100);
    var ease = easeOf(p.b.getAttribute('data-morph-ease') || p.a.getAttribute('data-morph-ease'), NM.ease.spring);
    return { dur: dur, delay: Math.min(i * 40, 200), ease: ease };
  }
  function buildGhosts(pairs, bucket) {
    // z: larger elements below, data-morph-z overrides
    var order = pairs.slice().sort(function (x, y) {
      var zx = parseFloat(x.b.getAttribute('data-morph-z') || x.a.getAttribute('data-morph-z'));
      var zy = parseFloat(y.b.getAttribute('data-morph-z') || y.a.getAttribute('data-morph-z'));
      if (isFinite(zx) || isFinite(zy)) return (isFinite(zx) ? zx : 0) - (isFinite(zy) ? zy : 0);
      return (y.B.r.w * y.B.r.h) - (x.B.r.w * x.B.r.h);
    });
    order.forEach(function (p, i) { p.z = 10 + i * 3; });
    var reading = readingSort(pairs.map(function (p) { return p.b; }));
    pairs.forEach(function (p) {
      var T = morphTiming(p, reading.indexOf(p.b));
      p.T = T;
      var arcAttr = p.b.getAttribute('data-morph-arc') || p.a.getAttribute('data-morph-arc') || 'auto';
      p.arc = arcAttr;
      if (p.kind === 'box') p.ghost = ghostBox(p, T, bucket);
      else if (p.kind === 'text' || p.kind === 'number') p.ghost = ghostText(p, T, bucket);
      else if (p.kind === 'image') p.ghost = ghostImage(p, T, bucket);
      else if (p.kind === 'words') p.ghost = ghostWords(p, T, bucket);
      else if (p.kind === 'path') p.ghost = ghostPath(p, T, bucket);
    });
  }
  function hideOriginal(e) { e.classList.add(e instanceof SVGElement && !(e instanceof SVGSVGElement) ? 'nm-morph-hidden-svg' : 'nm-morph-hidden'); }
  function showOriginal(e) {
    e.classList.remove('nm-morph-hidden', 'nm-morph-hidden-svg');
    if (!e.classList.length) e.removeAttribute('class');
  }

  /* ------------------------------------------------------------------------
     14. Slide transitions (transform / opacity / clip-path only)
     ------------------------------------------------------------------------ */
  var TRANSITIONS = ['fade-through', 'push', 'zoom-through', 'iris', 'wipe', 'curtain', 'depth', 'fold', 'dissolve', 'none'];
  function resolveTransition(from, to, dir, hasPairs) {
    var later = dir > 0 ? to : from;
    var t = (later.getAttribute('data-transition') || 'auto').trim();
    var rel = (later.getAttribute('data-rel') || '').trim();
    var info = { name: t, out: false };
    if (deck.mode === 'classic') {
      info.name = t !== 'auto' && TRANSITIONS.indexOf(t) >= 0 ? t : 'dissolve';
      return info;
    }
    if (t === 'auto' || TRANSITIONS.indexOf(t) < 0) {
      if (rel === 'deeper') info.name = 'zoom-through';
      else if (rel === 'back-out') { info.name = 'zoom-through'; info.out = true; }
      else if (rel === 'chapter') info.name = 'curtain';
      else if (rel === 'contrast') info.name = 'wipe';
      else if (rel === 'time') info.name = 'push';
      else if (rel === 'next') info.name = hasPairs ? 'fade-through' : 'push';
      else {
        var deckDefault = body.getAttribute('data-nm-transition');
        info.name = hasPairs ? 'fade-through' : (deckDefault && TRANSITIONS.indexOf(deckDefault) >= 0 && deckDefault !== 'auto' ? deckDefault : 'fade-through');
      }
    }
    return info;
  }
  // Runs the slide-level part of a transition; returns ms at which entrances start.
  function runTransition(info, from, to, dir, ctx, bucket) {
    var sx = travelSign(dir), back = dir < 0;
    var hold = { fill: 'both' };
    function A(e, kf, o) { return anim(e, kf, Object.assign({}, hold, o), bucket); }
    switch (info.name) {
      case 'none':
        return 0;
      case 'push':
        A(from, [{ transform: 'translateX(0px)' }, { transform: 'translateX(' + (sx * W) + 'px)' }], { duration: 950, easing: NM.ease.move });
        A(to, [{ transform: 'translateX(' + (-sx * W) + 'px)' }, { transform: 'translateX(0px)' }], { duration: 950, easing: NM.ease.move });
        return 420;
      case 'zoom-through': {
        var inward = info.out ? back : !back;
        var big = 'scale(1.3)', small = 'scale(0.8)';
        A(from, [{ transform: 'scale(1)', opacity: 1 }, { transform: inward ? big : small, opacity: 0 }], { duration: 520, easing: NM.ease.exit });
        A(to, [{ transform: inward ? small : big, opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 760, delay: 140, easing: NM.ease.emphasized });
        return 330;
      }
      case 'iris': {
        var c = ctx.focus || { x: W / 2, y: H / 2 };
        var R = Math.ceil(Math.max(Math.hypot(c.x, c.y), Math.hypot(W - c.x, c.y), Math.hypot(c.x, H - c.y), Math.hypot(W - c.x, H - c.y)));
        var at = ' at ' + px(c.x) + ' ' + px(c.y) + ')';
        if (!back) {
          A(from, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.94)', opacity: 0.4 }], { duration: 900, easing: NM.ease.standard });
          A(to, [{ clipPath: 'circle(0px' + at }, { clipPath: 'circle(' + R + 'px' + at }], { duration: 900, easing: NM.ease.move });
        } else {
          from.classList.add('nm-on-top');
          A(from, [{ clipPath: 'circle(' + R + 'px' + at }, { clipPath: 'circle(0px' + at }], { duration: 850, easing: NM.ease.move });
          A(to, [{ transform: 'scale(0.94)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 850, easing: NM.ease.standard });
        }
        return 300;
      }
      case 'wipe': {
        var startClip = sx > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
        A(to, [{ clipPath: startClip }, { clipPath: 'inset(0% 0% 0% 0%)' }], { duration: 850, easing: NM.ease.move });
        A(from, [{ transform: 'translateX(0px)', opacity: 1 }, { transform: 'translateX(' + (sx * W * 0.14) + 'px)', opacity: 0.55 }], { duration: 850, easing: NM.ease.move });
        return 320;
      }
      case 'curtain':
        if (!back) {
          from.classList.add('nm-on-top');
          A(from, [{ transform: 'translateY(0px)' }, { transform: 'translateY(' + (-H) + 'px)' }], { duration: 950, easing: NM.ease.move });
          A(to, [{ transform: 'scale(0.92)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }], { duration: 950, easing: NM.ease.standard });
        } else {
          A(to, [{ transform: 'translateY(' + (-H) + 'px)' }, { transform: 'translateY(0px)' }], { duration: 950, easing: NM.ease.move });
          A(from, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.92)', opacity: 0.3 }], { duration: 950, easing: NM.ease.standard });
        }
        return 440;
      case 'depth':
        if (!back) {
          A(from, [{ transform: 'scale(1) translateY(0px)', opacity: 1 }, { transform: 'scale(0.86) translateY(-30px)', opacity: 0 }], { duration: 900, easing: NM.ease.standard });
          A(to, [{ transform: 'translateY(' + H + 'px)' }, { transform: 'translateY(0px)' }], { duration: 900, easing: NM.ease.emphasized });
        } else {
          from.classList.add('nm-on-top');
          A(from, [{ transform: 'translateY(0px)' }, { transform: 'translateY(' + H + 'px)' }], { duration: 800, easing: NM.ease.move });
          A(to, [{ transform: 'scale(0.86) translateY(-30px)', opacity: 0 }, { transform: 'scale(1) translateY(0px)', opacity: 1 }], { duration: 900, easing: NM.ease.emphasized });
        }
        return 380;
      case 'fold': {
        var hingeOut = sx > 0 ? '100% 50%' : '0% 50%', hingeIn = sx > 0 ? '0% 50%' : '100% 50%';
        var p = 'perspective(2600px) ';
        A(from, [{ transformOrigin: hingeOut, transform: p + 'rotateY(0deg)', opacity: 1 }, { transformOrigin: hingeOut, transform: p + 'rotateY(' + (-sx * 88) + 'deg)', opacity: 0.4 }],
          { duration: 560, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)' });
        A(to, [{ transformOrigin: hingeIn, transform: p + 'rotateY(' + (sx * 88) + 'deg)', opacity: 0.4 }, { transformOrigin: hingeIn, transform: p + 'rotateY(0deg)', opacity: 1 }],
          { duration: 700, delay: 420, easing: NM.ease.emphasized });
        return 640;
      }
      case 'dissolve':
        from.classList.add('nm-on-top');
        A(from, [{ opacity: 1 }, { opacity: 0 }], { duration: 750, easing: NM.ease.standard });
        return 200;
      case 'fade-through':
      default: {
        // unmatched outgoing blocks exit fast toward the travel direction; morphs carry the eye
        A(from, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: NM.ease.exit });
        (function exitBlocks(list) {
          list.forEach(function (b) {
            var t = touches(b, ctx.outgoing);
            if (t === 1) return;
            if (t === 2) { exitBlocks(Array.prototype.filter.call(b.children, usableBlock)); return; }
            var cs = getComputedStyle(b);
            var kf = cs.translate === 'none' && cs.scale === 'none'
              ? [{ translate: '0px 0px', scale: '1' }, { translate: (sx * 28) + 'px 0px', scale: '0.985' }]
              : [{ opacity: 1 }, { opacity: 1 }];
            A(b, kf, { duration: 300, easing: NM.ease.exit });
          });
        })(blocksOf(rigOf(from)));
        A(to, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 100, easing: NM.ease.standard });
        return 150;
      }
    }
  }

  /* ------------------------------------------------------------------------
     15. Navigation: go / next / prev, flights, interruption
     ------------------------------------------------------------------------ */
  var flight = null;
  function finishEntrances() {
    var list = entranceBucket.splice(0);
    list.forEach(function (a) { try { if (a.playState !== 'finished' && a.playState !== 'idle') a.finish(); } catch (e) { a.cancel(); } });
  }
  function finishFlight() {
    if (!flight) return;
    var f = flight;
    f.anims.forEach(function (a) { try { if (a.playState !== 'idle') a.finish(); } catch (e) { a.cancel(); } });
    f.end();
  }
  function settleAll() {
    finishFlight();
    finishEntrances();
  }
  function go(i, o) {
    o = o || {};
    if (!slides.length) return;
    if (overview && !o.fromOverview) closeOverview(true);
    settleAll();
    i = clamp(i | 0, 0, slides.length - 1);
    var fromIdx = deck.index, from = slides[fromIdx], to = slides[i];
    if (i === fromIdx) {
      if (o.step != null) setStep(to, o.step === 'end' ? S(to).steps.length : o.step, { instant: o.instant });
      return;
    }
    var dir = o.dir || (i > fromIdx ? 1 : -1);
    var instant = instantNow() || !!o.instant;
    emit('beforeslidechange', { from: fromIdx, to: i, slide: to });

    // 1. leave: transient acts exit without touching what the eye sees
    exitTransients(from, makeCtx(from, S(from).index, dir, instant, { leaving: true, next: [] }));

    // 2. arrival state of the incoming slide (non-transient steps applied instantly)
    resetSlide(to);
    computeSteps(to);
    var target = o.step != null ? o.step : (dir < 0 ? 'end' : 0);
    setStep(to, target === 'end' ? S(to).steps.length : target, { instant: true, silent: true, deferTransient: true });

    // 3. measure outgoing side of shared elements
    var pairs = [];
    if (!instant && deck.mode !== 'classic' && !o.noMorph) {
      pairs = findPairs(from, to).map(function (p) { p.kind = kindOf(p.a, p.b); return p; }).filter(function (p) { return p.kind; });
      pairs.forEach(function (p) { p.A = safe(function () { return snapshot(p.a, from, p.kind); }); });
      pairs = pairs.filter(function (p) { return p.A; });
    }

    // 4. switch
    from.classList.remove('active', 'visible');
    from.classList.add('is-leaving');
    to.classList.add('active', 'visible');
    to.removeAttribute('aria-hidden');
    from.setAttribute('aria-hidden', 'true');
    deck.index = i;
    deck.stepIndex = S(to).index;
    writeHash();
    updateHud();

    if (instant) {
      from.classList.remove('is-leaving');
      resetSlide(from);
      emit('slidechange', { from: fromIdx, to: i, slide: to });
      enterDeferred(to);
      return;
    }

    // 5. measure incoming side, build ghosts, run the transition
    pairs.forEach(function (p) { p.B = safe(function () { return snapshot(p.b, to, p.kind); }); });
    pairs = pairs.filter(function (p) { return p.B; });
    var info = resolveTransition(from, to, dir, pairs.length > 0);
    if (o.transition) info = { name: o.transition, out: false };
    var bucket = [];
    var f = flight = { anims: bucket, pairs: pairs, from: from, to: to, info: info, done: false };
    safe(function () { buildGhosts(pairs, bucket); });
    pairs.forEach(function (p) { hideOriginal(p.a); hideOriginal(p.b); });
    var outgoing = new Set(pairs.map(function (p) { return p.a; }));
    var incoming = new Set(pairs.map(function (p) { return p.b; }));
    var focus = pairs.length ? centre(pairs[0].B.r) : null;
    var enterAt = safe(function () { return runTransition(info, from, to, dir, { outgoing: outgoing, focus: focus }, bucket); }) || 0;
    if (!o.noEntrances) safe(function () { playArrival(to, { exclude: incoming, startAt: enterAt, dir: dir }); });

    f.end = function () {
      if (f.done) return;
      f.done = true;
      if (flight === f) flight = null;
      bucket.forEach(function (a) { a.cancel(); });
      pairs.forEach(function (p) {
        showOriginal(p.a); showOriginal(p.b);
        var g = p.ghost;
        (Array.isArray(g) ? g : [g]).forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
      });
      while (ghostLayer.firstChild) ghostLayer.removeChild(ghostLayer.firstChild);
      from.classList.remove('is-leaving', 'nm-on-top');
      to.classList.remove('nm-on-top');
      resetSlide(from);
      enterDeferred(to);
    };
    emit('slidechange', { from: fromIdx, to: i, slide: to });
    if (!bucket.length) { f.end(); return; }
    Promise.all(bucket.map(function (a) { return a.finished.catch(function () {}); })).then(function () { f.end(); });
  }
  function next(o) {
    o = o || {};
    if (overview) return;
    finishFlight();
    var slide = slides[deck.index], st = S(slide);
    if (!o.skipSteps && st.index < st.steps.length) {
      var t = st.index + 1;
      if (st.released && st.steps[t - 1] && st.steps[t - 1].release) t++;
      if (t <= st.steps.length) { setStep(slide, t); return; }
    }
    if (deck.index < slides.length - 1) go(deck.index + 1, { dir: 1 });
  }
  function prev(o) {
    o = o || {};
    if (overview) return;
    finishFlight();
    var slide = slides[deck.index], st = S(slide);
    if (!o.skipSteps && st.index > 0) { setStep(slide, st.index - 1); return; }
    if (deck.index > 0) go(deck.index - 1, { dir: -1, step: o.skipSteps ? 0 : undefined });
  }

  /* ------------------------------------------------------------------------
     16. Hash deep links: #/3 and #/3/2
     ------------------------------------------------------------------------ */
  function parseHash() {
    var m = /^#\/?(\d+)(?:\/(\d+))?$/.exec(location.hash || '');
    if (!m) return null;
    return { slide: clamp(parseInt(m[1], 10) - 1, 0, slides.length - 1), step: m[2] != null ? parseInt(m[2], 10) : 0 };
  }
  var hashWriting = false;
  function writeHash() {
    if (PRINT || !ready) return;
    if (location.hash && !/^#\/?\d+(\/\d+)?$/.test(location.hash)) return;
    var st = S(slides[deck.index]);
    var h = '#/' + (deck.index + 1) + (st.index ? '/' + st.index : '');
    if (location.hash !== h) {
      hashWriting = true;
      try { history.replaceState(null, '', h); } catch (e) { /* file:// sandboxes */ }
      hashWriting = false;
    }
  }

  /* ------------------------------------------------------------------------
     17. Chrome: controls, progress, help, blackout, edit mode
     ------------------------------------------------------------------------ */
  var ICON = {
    prev: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 19l-7-7 7-7"/></svg>',
    zoom: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>',
    motion: '<svg viewBox="0 0 24 24"><path d="M4 12h3l3-7 4 14 3-7h3"/></svg>',
    font: '<svg viewBox="0 0 24 24"><path d="M4 20l6-16h2l6 16M7 14h8"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
  };
  var MODE_ORDER = ['morph-and-zoom', 'morph-only', 'classic'];
  var MODE_LABEL = {
    'morph-and-zoom': 'الحركة: تحويل وتقريب بالأسهم',
    'morph-only': 'الحركة: تحويل فقط (التقريب بالنقر)',
    'classic': 'الحركة: انتقال كلاسيكي'
  };
  var fontIndex = 0;
  var hud = {};
  function btn(id, cls, icon, label, title) {
    var b = el('button', 'nm-btn ' + (cls || ''));
    b.type = 'button';
    if (id) b.id = id;
    if (title) b.title = title;
    b.innerHTML = (icon || '') + (label != null ? '<span>' + label + '</span>' : '');
    return b;
  }
  function setupChrome() {
    var hot = document.getElementById('controlsHotzone');
    if (!hot) { hot = el('div'); hot.id = 'controlsHotzone'; body.appendChild(hot); }
    var nav = document.getElementById('deckControls');
    if (!nav) {
      nav = el('nav', 'deck-controls');
      nav.id = 'deckControls';
      nav.setAttribute('aria-label', 'التحكم في الشرائح');
      var prevB = btn('prevBtn', '', ICON.prev, 'السابق', 'السابق');
      var counter = el('span'); counter.id = 'slideCounter'; counter.dir = 'ltr';
      var nextB = btn('nextBtn', 'nm-primary', '', null, 'التالي');
      nextB.innerHTML = '<span>التالي</span>' + ICON.next;
      var cam = btn('cameraStatusBtn', '', ICON.zoom, null, 'الكاميرا (Z)');
      cam.insertAdjacentHTML('beforeend', '<span id="cameraStatusLabel">الكاميرا: نظرة عامة</span>');
      var mode = btn('motionModeBtn', '', ICON.motion, null, 'نمط الحركة');
      mode.insertAdjacentHTML('beforeend', '<span id="motionModeLabel"></span>');
      nav.appendChild(prevB); nav.appendChild(counter); nav.appendChild(nextB);
      nav.appendChild(el('span', 'nm-sep')); nav.appendChild(cam); nav.appendChild(mode);
      if (fontModes().length) {
        var fb = btn('fontToggleBtn', '', ICON.font, null, 'الخط');
        fb.insertAdjacentHTML('beforeend', '<span id="fontModeLabel"></span>');
        nav.appendChild(el('span', 'nm-sep')); nav.appendChild(fb);
      }
      nav.appendChild(el('span', 'nm-sep'));
      nav.appendChild(btn('nmOverviewBtn', 'nm-icon', ICON.grid, null, 'نظرة شاملة (O)'));
      nav.appendChild(btn('nmEditBtn', 'nm-icon', ICON.edit, null, 'تعديل النصوص (E)'));
      nav.appendChild(btn('nmFullBtn', 'nm-icon', ICON.full, null, 'ملء الشاشة (F)'));
      nav.appendChild(btn('nmHelpBtn', 'nm-icon', ICON.help, null, 'اختصارات المفاتيح (?)'));
      body.appendChild(nav);
    }
    var bind = function (id, fn) {
      var b = document.getElementById(id);
      if (b && !b.hasAttribute('onclick')) b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    };
    bind('prevBtn', function () { prev(); });
    bind('nextBtn', function () { next(); });
    bind('cameraStatusBtn', function () { resetZoomOrStep(); });
    bind('motionModeBtn', function () { cycleMotionMode(); });
    bind('fontToggleBtn', function () { cycleFontMode(); });
    bind('nmOverviewBtn', function () { toggleOverview(); });
    bind('nmEditBtn', function () { toggleEdit(); });
    bind('nmFullBtn', function () { toggleFullscreen(); });
    bind('nmHelpBtn', function () { toggleHelp(); });

    var prog = document.querySelector('.nm-progress');
    if (!prog) { prog = el('div', 'nm-progress', '<i></i>'); body.appendChild(prog); }
    var help = el('div', 'nm-help');
    help.innerHTML = '<div class="nm-help-card" role="dialog" aria-label="اختصارات المفاتيح"><h2>اختصارات المفاتيح</h2><dl>' +
      [['<kbd>&larr;</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd>', 'الخطوة أو الشريحة التالية'],
       ['<kbd>&rarr;</kbd> <kbd>PgUp</kbd>', 'الخطوة أو الشريحة السابقة'],
       ['<kbd>Shift</kbd> + <kbd>&larr;</kbd> <kbd>&rarr;</kbd>', 'تخطي الخطوات'],
       ['<kbd>Home</kbd> <kbd>End</kbd>', 'الشريحة الأولى أو الأخيرة'],
       ['<kbd>O</kbd> <kbd>G</kbd>', 'نظرة شاملة على الشرائح'],
       ['<kbd>Z</kbd>', 'تقريب الكاميرا أو إلغاؤه'],
       ['<kbd>Esc</kbd>', 'إلغاء التقريب أو الإغلاق'],
       ['<kbd>F</kbd>', 'ملء الشاشة'],
       ['<kbd>B</kbd>', 'شاشة سوداء'],
       ['<kbd>E</kbd>', 'تعديل النصوص مباشرة'],
       ['<kbd>?</kbd>', 'هذه القائمة']].map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') +
      '</dl></div>';
    help.addEventListener('click', function () { toggleHelp(false); });
    body.appendChild(help);
    body.appendChild(el('div', 'nm-blackout'));
    body.appendChild(el('div', 'nm-badge', 'وضع التعديل: اضغط E للخروج'));

    hud.counter = document.getElementById('slideCounter');
    hud.cam = document.getElementById('cameraStatusLabel');
    hud.mode = document.getElementById('motionModeLabel');
    hud.font = document.getElementById('fontModeLabel');
    hud.bar = prog.querySelector('i');

    var hideT = null;
    var show = function () { clearTimeout(hideT); nav.classList.add('show'); };
    var hide = function () { clearTimeout(hideT); hideT = setTimeout(function () { nav.classList.remove('show'); }, 500); };
    hot.addEventListener('mouseenter', show);
    hot.addEventListener('mouseleave', hide);
    nav.addEventListener('mouseenter', show);
    nav.addEventListener('mouseleave', hide);
    if (hud.font) hud.font.textContent = (fontModes()[0] || {}).label || '';
  }
  function fontModes() { var f = (window.NM_CONFIG || CONFIG).fontModes; return Array.isArray(f) ? f : []; }
  function cycleFontMode() {
    var modes = fontModes();
    if (!modes.length) return;
    modes.forEach(function (m) { if (m.className) body.classList.remove(m.className); });
    fontIndex = (fontIndex + 1) % modes.length;
    if (modes[fontIndex].className) body.classList.add(modes[fontIndex].className);
    if (hud.font) hud.font.textContent = modes[fontIndex].label || '';
  }
  function updateHud() {
    if (!deck || !hud.counter && !hud.bar) return;
    var n = slides.length, slide = slides[deck.index], st = S(slide);
    if (hud.counter) hud.counter.textContent = String(deck.index + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    if (hud.bar) {
      var frac = st.steps.length ? st.index / st.steps.length : 0;
      var p = n > 1 ? (deck.index + frac) / (n - 1) : 1;
      hud.bar.style.transform = 'scaleX(' + clamp(p, 0, 1) + ')';
    }
    if (hud.cam) {
      var zoomSteps = st.steps.filter(function (s) { return s.items.some(function (i) { return i.act === 'zoom'; }); });
      var activeZoom = st.active.find(function (i) { return i.act === 'zoom'; });
      var real = st.steps.filter(function (s) { return !s.release; }).length;
      if (activeZoom) {
        var zi = zoomSteps.findIndex(function (s) { return s.items.indexOf(activeZoom) >= 0; });
        var label = activeZoom.el.getAttribute('data-zoom-label') || activeZoom.el.getAttribute('data-step-label') || ('قسم ' + (zi + 1));
        hud.cam.textContent = 'تقريب ' + (zi + 1) + '/' + zoomSteps.length + ': ' + label;
      } else if (st.index > 0 && real) {
        hud.cam.textContent = 'الخطوة ' + Math.min(st.index, real) + '/' + real;
      } else {
        hud.cam.textContent = zoomSteps.length ? 'الكاميرا: نظرة عامة (' + zoomSteps.length + ' أقسام)' : (real ? 'الخطوات: ' + real : 'الكاميرا: نظرة عامة');
      }
    }
    if (hud.mode) hud.mode.textContent = MODE_LABEL[deck.mode] || deck.mode;
  }
  function cycleMotionMode(mode) {
    settleAll();
    var slide = slides[deck.index];
    release(slide);
    deck.mode = MODE_ORDER.indexOf(mode) >= 0 ? mode : MODE_ORDER[(MODE_ORDER.indexOf(deck.mode) + 1) % MODE_ORDER.length];
    body.setAttribute('data-nm-mode', deck.mode);
    var keep = S(slide).index;
    resetSlide(slide);
    slides.forEach(computeSteps);
    setStep(slide, Math.min(keep, S(slide).steps.length), { instant: true, silent: true, deferTransient: true });
    updateHud();
  }
  function resetZoomOrStep() {
    var slide = slides[deck.index], st = S(slide);
    if (st.active.length) { release(slide); return; }
    var zi = -1;
    st.steps.some(function (s, i) { if (s.items.some(function (it) { return it.act === 'zoom'; })) { zi = i; return true; } return false; });
    if (zi >= 0) setStep(slide, zi + 1);
    else {
      var item = null;
      st.all.some(function (s) { item = s.items.find(function (it) { return it.act === 'zoom'; }); return !!item; });
      if (item) enterAdHoc(slide, item);
    }
  }
  function enterAdHoc(slide, it) {
    exitTransients(slide, makeCtx(slide, S(slide).index, 1, false, { next: [it.act] }));
    enterItem(slide, it, makeCtx(slide, S(slide).index, 1, false));
    updateHud();
  }
  function toggleHelp(force) { body.classList.toggle('nm-help-open', force); }
  function toggleBlack(force) { body.classList.toggle('nm-black', force); }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function () {});
  }
  var EDIT_SEL = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,dt,dd,label,small,[data-edit]';
  var edited = [];
  function toggleEdit(force) {
    var on = force != null ? force : !body.classList.contains('nm-editing');
    if (on) {
      settleAll();
      slides.forEach(function (s) {
        $$(EDIT_SEL + ',span', s).forEach(function (e) {
          if (e.closest('svg') || e.closest('[contenteditable="true"]')) return;
          if (e.tagName === 'SPAN' && (e.children.length || !normText(e.textContent) || e.parentElement.closest(EDIT_SEL))) return;
          if (!normText(e.textContent)) return;
          e.setAttribute('contenteditable', 'true');
          e.setAttribute('spellcheck', 'false');
          edited.push(e);
        });
      });
    } else {
      edited.forEach(function (e) { e.removeAttribute('contenteditable'); e.removeAttribute('spellcheck'); });
      edited = [];
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
    body.classList.toggle('nm-editing', on);
  }

  /* ------------------------------------------------------------------------
     18. Overview grid (live scaled thumbnails, chosen one grows back)
     ------------------------------------------------------------------------ */
  var overview = null;
  function thumbOf(slide) {
    var c = slide.cloneNode(true);
    c.classList.remove('is-leaving', 'nm-on-top');
    c.classList.add('active', 'visible');
    c.removeAttribute('aria-hidden');
    c.removeAttribute('id');
    c.style.transform = ''; c.style.opacity = ''; c.style.clipPath = '';
    $$('*', c).forEach(function (e) {
      e.removeAttribute('id');
      e.removeAttribute('contenteditable');
      if (e.classList) e.classList.remove('is-on', 'is-current', 'zoom-focused', 'nm-dim', 'nm-undim', 'nm-highlighted', 'nm-morph-hidden', 'nm-morph-hidden-svg');
    });
    var rig = c.querySelector('.camera-rig');
    if (rig) rig.style.transform = '';
    c.classList.remove('is-camera-zoomed');
    return c;
  }
  function overviewLayout(n) {
    var cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5;
    var pad = 72, gap = 40;
    var cw = (W - 2 * pad - gap * (cols - 1)) / cols, ch = cw * H / W;
    var rows = Math.ceil(n / cols);
    var total = 2 * pad + rows * ch + (rows - 1) * gap;
    var top = total < H ? (H - total) / 2 + pad : pad;
    var cells = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      var x = rtl ? W - pad - cw - c * (cw + gap) : pad + c * (cw + gap);
      cells.push({ x: x, y: top + r * (ch + gap), w: cw, h: ch });
    }
    return { cells: cells, height: Math.max(H, total), cols: cols };
  }
  function openOverview() {
    if (overview || PRINT) return;
    settleAll();
    release(slides[deck.index]);
    var L = overviewLayout(slides.length);
    var ov = el('div', 'nm-overview');
    ov.id = 'nmOverview';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'نظرة شاملة على الشرائح');
    var grid = el('div', 'nm-overview-grid');
    grid.style.height = px(L.height);
    var cards = slides.map(function (s, i) {
      var c = L.cells[i];
      var card = el('div', 'nm-ov-card' + (i === deck.index ? ' is-current is-selected' : ''));
      card.style.cssText = 'left:' + px(c.x) + ';top:' + px(c.y) + ';width:' + px(c.w) + ';height:' + px(c.h) + ';';
      var holder = el('div', 'deck-stage');
      holder.style.transform = 'scale(' + (c.w / W) + ')';
      holder.appendChild(thumbOf(s));
      card.appendChild(holder);
      card.appendChild(el('span', 'nm-ov-num', String(i + 1).padStart(2, '0')));
      card.addEventListener('click', function (e) { e.stopPropagation(); chooseOverview(i); });
      grid.appendChild(card);
      return card;
    });
    ov.appendChild(grid);
    stage.appendChild(ov);
    overview = { el: ov, cards: cards, cells: L.cells, sel: deck.index, cols: L.cols };
    body.classList.add('nm-overview');
    var cur = L.cells[deck.index];
    if (cur.y + cur.h > H) ov.scrollTop = cur.y + cur.h - H + 72;
    var bucket = [];
    anim(ov, [{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: getComputedStyle(ov).backgroundColor }], { duration: 420, easing: NM.ease.standard }, bucket);
    cards.forEach(function (card, i) {
      if (i === deck.index) {
        var c = L.cells[i], k = W / c.w;
        var tx = 0 - c.x, ty = 0 - (c.y - ov.scrollTop);
        card.style.transformOrigin = '0 0';
        anim(card, [{ transform: 'translate(' + px(tx) + ', ' + px(ty) + ') scale(' + k + ')', borderRadius: '0px' }, { transform: 'none', borderRadius: '14px' }],
          { duration: 720, easing: NM.ease.emphasized, fill: 'backwards' }, bucket);
        card.style.zIndex = 2;
      } else {
        anim(card, [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }],
          { duration: 520, delay: 120 + Math.min(Math.abs(i - deck.index) * 30, 360), easing: NM.ease.enter, fill: 'backwards' }, bucket);
      }
    });
  }
  function selectOverview(i) {
    if (!overview) return;
    i = clamp(i, 0, slides.length - 1);
    overview.cards[overview.sel].classList.remove('is-selected');
    overview.sel = i;
    var card = overview.cards[i];
    card.classList.add('is-selected');
    var c = overview.cells[i], ov = overview.el;
    if (c.y < ov.scrollTop) ov.scrollTop = c.y - 40;
    else if (c.y + c.h > ov.scrollTop + H) ov.scrollTop = c.y + c.h - H + 40;
  }
  function chooseOverview(i, instant) {
    if (!overview) return;
    var ov = overview;
    overview = null;
    body.classList.remove('nm-overview');
    if (i !== deck.index) go(i, { instant: true, fromOverview: true, step: 0 });
    var remove = function () { if (ov.el.parentNode) ov.el.parentNode.removeChild(ov.el); };
    if (instant || instantNow()) { remove(); return; }
    var c = ov.cells[i], card = ov.cards[i], k = W / c.w;
    var tx = 0 - c.x, ty = 0 - (c.y - ov.el.scrollTop);
    card.style.zIndex = 3;
    card.style.transformOrigin = '0 0';
    var bucket = [];
    anim(card, [{ transform: 'none', borderRadius: '14px' }, { transform: 'translate(' + px(tx) + ', ' + px(ty) + ') scale(' + k + ')', borderRadius: '0px' }],
      { duration: 680, easing: NM.ease.emphasized, fill: 'forwards' }, bucket);
    anim(ov.el, [{ backgroundColor: getComputedStyle(ov.el).backgroundColor }, { backgroundColor: 'rgba(0,0,0,0)' }], { duration: 500, easing: NM.ease.standard, fill: 'forwards' }, bucket);
    ov.cards.forEach(function (cd, j) {
      if (j !== i) anim(cd, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: NM.ease.exit, fill: 'forwards' }, bucket);
    });
    var f = flight = { anims: bucket, pairs: [], done: false };
    f.end = function () { if (f.done) return; f.done = true; if (flight === f) flight = null; remove(); };
    Promise.all(bucket.map(function (a) { return a.finished.catch(function () {}); })).then(f.end);
  }
  function closeOverview(instant) { if (overview) chooseOverview(instant ? deck.index : overview.sel === deck.index ? deck.index : deck.index, instant); }
  function toggleOverview() { if (overview) closeOverview(); else openOverview(); }

  /* ------------------------------------------------------------------------
     19. Input: keys, clicks, touch
     ------------------------------------------------------------------------ */
  function onKey(e) {
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
      if (e.key === 'Escape' && t.blur) t.blur();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key, code = e.code;
    var fwdArrow = rtl ? 'ArrowLeft' : 'ArrowRight', backArrow = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (body.classList.contains('nm-help-open')) { e.preventDefault(); toggleHelp(false); return; }
    if (body.classList.contains('nm-black')) {
      if (key === 'Escape' || code === 'KeyB' || code === 'Period') { e.preventDefault(); toggleBlack(false); }
      return;
    }
    if (overview) {
      var cols = overview.cols;
      if (key === fwdArrow) { e.preventDefault(); selectOverview(overview.sel + 1); }
      else if (key === backArrow) { e.preventDefault(); selectOverview(overview.sel - 1); }
      else if (key === 'ArrowDown') { e.preventDefault(); selectOverview(overview.sel + cols); }
      else if (key === 'ArrowUp') { e.preventDefault(); selectOverview(overview.sel - cols); }
      else if (key === 'Enter' || key === ' ') { e.preventDefault(); chooseOverview(overview.sel); }
      else if (key === 'Escape' || code === 'KeyO' || code === 'KeyG') { e.preventDefault(); chooseOverview(deck.index); }
      else if (key === 'Home') { e.preventDefault(); selectOverview(0); }
      else if (key === 'End') { e.preventDefault(); selectOverview(slides.length - 1); }
      return;
    }
    if (key === '?' || key === '؟' || (code === 'Slash' && e.shiftKey)) { e.preventDefault(); toggleHelp(); return; }
    switch (code) {
      case 'KeyO': case 'KeyG': e.preventDefault(); openOverview(); return;
      case 'KeyF': e.preventDefault(); toggleFullscreen(); return;
      case 'KeyB': case 'Period': e.preventDefault(); toggleBlack(); return;
      case 'KeyE': e.preventDefault(); toggleEdit(); return;
      case 'KeyZ': e.preventDefault(); resetZoomOrStep(); return;
    }
    if (body.classList.contains('nm-editing')) return;
    if (key === 'Escape') { if (release()) e.preventDefault(); return; }
    if (key === fwdArrow || key === 'ArrowDown' || key === 'PageDown' || key === ' ' || code === 'Space') {
      e.preventDefault(); next({ skipSteps: e.shiftKey });
    } else if (key === backArrow || key === 'ArrowUp' || key === 'PageUp') {
      e.preventDefault(); prev({ skipSteps: e.shiftKey });
    } else if (key === 'Home') { e.preventDefault(); go(0, { dir: -1, step: 0 }); }
    else if (key === 'End') { e.preventDefault(); go(slides.length - 1, { dir: 1 }); }
  }
  function onStageClick(e) {
    if (overview || body.classList.contains('nm-editing')) return;
    if (e.target.closest('button, a, input, textarea, select, [contenteditable="true"], .deck-controls')) return;
    var slide = slides[deck.index];
    if (!slide.contains(e.target)) return;
    var st = S(slide);
    var hit = null, hitIndex = -1;
    st.all.forEach(function (s) {
      s.items.forEach(function (it) {
        if (!isTransient(it.act) || !it.el.contains(e.target)) return;
        if (!hit || hit.el.contains(it.el)) hit = it;
      });
    });
    if (hit) {
      st.steps.forEach(function (s, i) { if (s.items.indexOf(hit) >= 0) hitIndex = i + 1; });
      e.stopPropagation();
      finishFlight();
      if (st.active.indexOf(hit) >= 0) { release(slide); return; }
      if (hitIndex > 0) setStep(slide, hitIndex);
      else enterAdHoc(slide, hit);
      return;
    }
    if (st.active.length) release(slide);
  }
  function setupInput() {
    document.addEventListener('keydown', onKey);
    stage.addEventListener('click', onStageClick);
    var sx = 0, sy = 0;
    window.addEventListener('touchstart', function (e) { sx = e.changedTouches[0].screenX; sy = e.changedTouches[0].screenY; }, { passive: true });
    window.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].screenX - sx, dy = e.changedTouches[0].screenY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        var forward = rtl ? dx > 0 : dx < 0;
        forward ? next() : prev();
      }
    }, { passive: true });
    window.addEventListener('resize', fit);
    window.addEventListener('hashchange', function () {
      if (hashWriting) return;
      var h = parseHash();
      if (h && (h.slide !== deck.index || h.step !== S(slides[deck.index]).index)) go(h.slide, { step: h.step });
    });
    if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function (ev) { if (ev.matches) NM.speed = 0; });
  }

  /* ------------------------------------------------------------------------
     20. Print / audit mode (?nm-print): all slides stacked, all steps entered
     ------------------------------------------------------------------------ */
  function setupPrint() {
    document.documentElement.classList.add('nm-print-root');
    body.classList.add('nm-print');
    slides.forEach(function (s) {
      s.classList.add('active', 'visible');
      computeSteps(s);
      setStep(s, S(s).steps.length, { instant: true, silent: true });
    });
  }

  /* ------------------------------------------------------------------------
     21. Test hooks
     ------------------------------------------------------------------------ */
  NM.test = {
    settle: function () {
      return new Promise(function (resolve) {
        var calm = 0;
        (function tick() {
          var busy = pendingTimers > 0 || !!flight;
          if (!busy) live.forEach(function (a) { if (finiteRunning(a)) busy = true; });
          if (!busy) document.getAnimations().forEach(function (a) { if (finiteRunning(a)) busy = true; });
          calm = busy ? 0 : calm + 1;
          if (calm >= 2) resolve(); else requestAnimationFrame(tick);
        })();
      });
    },
    // Current morph flight, for audits: pairs with measured rects and ghost nodes.
    flight: function () {
      if (!flight) return null;
      return {
        transition: flight.info && flight.info.name,
        pairs: (flight.pairs || []).map(function (p) {
          return { id: p.id, kind: p.kind, from: p.A.r, to: p.B.r, ghost: p.ghost, duration: p.T && p.T.dur, delay: p.T && p.T.delay };
        })
      };
    },
    // Pause every flight animation at an absolute time (ms) in its own timeline.
    seek: function (ms) {
      if (!flight) return false;
      flight.anims.forEach(function (a) { a.pause(); a.currentTime = ms; });
      return true;
    },
    seekFraction: function (f) {
      if (!flight) return false;
      flight.anims.forEach(function (a) {
        var t = a.effect.getComputedTiming();
        a.pause();
        a.currentTime = (t.delay || 0) + f * (t.activeDuration || 0);
      });
      return true;
    },
    play: function () { if (flight) flight.anims.forEach(function (a) { a.play(); }); },
    finish: function () { settleAll(); }
  };

  /* ------------------------------------------------------------------------
     22. Controller and init
     ------------------------------------------------------------------------ */
  NM.use = function (plugin) {
    if (!plugin) return;
    if (ready || (deck && deck._initPlugins)) safe(function () { plugin.init(deck); });
    else queuedPlugins.push(plugin);
  };
  NM.on = function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); };

  function buildController() {
    deck = {
      slides: slides,
      index: 0,
      stepIndex: 0,
      mode: MODE_ORDER.indexOf(body.getAttribute('data-nm-mode')) >= 0 ? body.getAttribute('data-nm-mode') : 'morph-and-zoom',
      next: next,
      prev: prev,
      go: function (i, o) {
        o = Object.assign({}, o || {});
        if (o.atEnd) o.step = 'end';
        go(i, o);
      },
      refreshSteps: function (slide) {
        (slide ? [slide] : slides).forEach(function (s) {
          var st = S(s);
          if (!st) return;
          var cur = s === slides[deck.index] ? st.index : 0;
          if (cur) resetSlide(s);
          st.all = readSteps(s);
          computeSteps(s);
          if (cur) setStep(s, Math.min(cur, st.steps.length), { instant: true, silent: true });
        });
        updateHud();
      },
      camera: { to: cameraTo, reset: cameraReset, get state() { return Object.assign({}, S(slides[deck.index]).cam); } },
      on: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
      off: function (name, fn) { listeners[name] = (listeners[name] || []).filter(function (f) { return f !== fn; }); },
      release: function () { return release(); },
      overview: { open: openOverview, close: function () { closeOverview(); }, toggle: toggleOverview, get isOpen() { return !!overview; } },
      setMode: function (m) { cycleMotionMode(m); },
      cycleMotionMode: function () { cycleMotionMode(); },
      cycleFontMode: cycleFontMode,
      toggleEdit: toggleEdit,
      toggleBlackout: toggleBlack,
      toggleHelp: toggleHelp,
      // legacy v1 names
      showSlide: function (i) { go(i); },
      resetZoomOrStep: resetZoomOrStep,
      zoomToIndex: function (z) {
        var slide = slides[deck.index], st = S(slide);
        if (z < 0) { release(slide); return; }
        var zs = [];
        st.steps.forEach(function (s, i) { if (s.items.some(function (it) { return it.act === 'zoom'; })) zs.push(i + 1); });
        if (zs[z]) setStep(slide, zs[z]);
      },
      get currentSlide() { return deck.index; },
      get busy() { return !!flight; }
    };
    NM.deck = deck;
    if (!('deck' in window)) window.deck = deck;
    if (typeof window.cycleFontMode !== 'function') window.cycleFontMode = cycleFontMode;
  }

  function init() {
    if (ready) return;
    setupDom();
    registerCoreActs();
    buildController();
    body.setAttribute('data-nm-mode', deck.mode);
    if (!NM.speed) body.classList.add('nm-instant');
    fit();
    // plugins first, so their acts and steps exist before the first slide shows
    deck._initPlugins = true;
    queuedPlugins.splice(0).forEach(function (p) { safe(function () { p.init(deck); }); });
    slides.forEach(function (s) { S(s).all = readSteps(s); computeSteps(s); });
    if (PRINT) {
      setupPrint();
    } else {
      setupChrome();
      setupInput();
      var h = parseHash() || { slide: 0, step: 0 };
      slides.forEach(function (s, i) {
        var on = i === h.slide;
        s.classList.toggle('active', on);
        s.classList.toggle('visible', on);
        if (!on) s.setAttribute('aria-hidden', 'true');
      });
      deck.index = h.slide;
      var first = slides[h.slide];
      setStep(first, Math.min(h.step, S(first).steps.length), { instant: true, silent: true, deferTransient: true });
      playArrival(first, { startAt: 150, dir: 1 });
      enterDeferred(first);
    }
    ready = true;
    deck._initPlugins = false;
    body.classList.add('nm-ready');
    updateHud();
    writeHash();
    emit('ready', { deck: deck });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
