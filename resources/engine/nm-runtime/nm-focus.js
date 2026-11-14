/* Nevermind Runtime v2 - nm-focus.js
   Isolation acts: focus, detail, lens, pins, slice.
   Classic script, no deps. Load after nm-deck.js. See references/focus-isolation.md.
   Every act is transient, measured in stage px, drawn in NM.layer('overlay'),
   animated with NM.animate (WAAPI) and fully reversible: on exit every clone,
   overlay node and held animation is removed, so the slide DOM is byte-identical. */
(function () {
  'use strict';
  var NM = window.NM;
  if (!NM || !NM.registerAct) { console.warn('[nm-focus] load nm-deck.js first'); return; }

  var W = 1920, H = 1080, M = 48, SVGNS = 'http://www.w3.org/2000/svg';
  var GEO = ['x', 'y', 'width', 'height', 'rx', 'ry'];
  var FE = {
    standard: 'cubic-bezier(.2,0,0,1)', emphasized: 'cubic-bezier(.3,0,0,1)', enter: 'cubic-bezier(0,0,0,1)',
    exit: 'cubic-bezier(.3,0,1,1)', spring: 'cubic-bezier(.34,1.3,.64,1)', springSoft: 'cubic-bezier(.3,1.08,.5,1)',
    springBouncy: 'cubic-bezier(.34,1.56,.64,1)'
  };
  var deck = null, active = null, uid = 0;
  var IMPL = {};

  /* ------------------------------------------------------------------ utils */
  function ease(n) { return (NM.ease && NM.ease[n]) || FE[n]; }
  function camDur() { return (NM.dur && NM.dur.camera) || 820; }
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
  function attr(el, n, d) { var v = el.getAttribute(n); return v == null || v === '' ? d : v; }
  function h(tag, cls, parent) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e;
  }
  function s(tag, at, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in at) if (at[k] != null) e.setAttribute(k, at[k]);
    if (parent) parent.appendChild(e); return e;
  }
  function px(v) { return Math.round(v * 100) / 100 + 'px'; }
  function stageEl() { return document.getElementById('deckStage') || document.querySelector('.deck-stage'); }
  function layer() { return NM.layer ? NM.layer('overlay') : stageEl(); }
  function scaleF() {
    var g = NM.geom && NM.geom.stageScale && NM.geom.stageScale();
    return g || (stageEl().getBoundingClientRect().width / W) || 1;
  }
  function live(el) {
    var k = scaleF(), a = stageEl().getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - a.left) / k, y: (r.top - a.top) / k, w: r.width / k, h: r.height / k };
  }
  function rest(el) {
    if (NM.geom && NM.geom.rectInStage) {
      var r = NM.geom.rectInStage(el);
      if (r) {
        var o = { x: r.x, y: r.y, w: r.w != null ? r.w : r.width, h: r.h != null ? r.h : r.height };
        if (isFinite(o.x + o.y + o.w + o.h)) return o;
      }
    }
    return live(el);
  }
  function radiusOf(el, r) {
    var v = getComputedStyle(el).borderTopLeftRadius || '0';
    var n = parseFloat(v) || 0;
    if (/%/.test(v)) n = n / 100 * Math.min(r.w, r.h);
    return Math.min(n, Math.min(r.w, r.h) / 2);
  }
  function inflate(r, p) { return { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p, r: r.r != null ? r.r + p : undefined }; }
  function cen(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  function inSafe(r) { return r.x >= M - 0.5 && r.y >= M - 0.5 && r.x + r.w <= W - M + 0.5 && r.y + r.h <= H - M + 0.5; }
  function clampSafe(r) {
    var o = { x: r.x, y: r.y, w: Math.min(r.w, W - 2 * M), h: Math.min(r.h, H - 2 * M), r: r.r };
    o.x = Math.max(M, Math.min(W - M - o.w, o.x)); o.y = Math.max(M, Math.min(H - M - o.h, o.y)); return o;
  }
  function ovl(a, b) {
    var x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    var y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); return x * y;
  }
  function nearest(r, p) { return { x: Math.max(r.x, Math.min(r.x + r.w, p.x)), y: Math.max(r.y, Math.min(r.y + r.h, p.y)) }; }
  function rigOf(slide) { return slide.querySelector(':scope > .camera-rig') || slide; }
  function isRtl(el) { return getComputedStyle(el).direction === 'rtl'; }
  function digits(n, el) {
    var host = el.closest('[data-pin-digits]'), mode = host ? host.getAttribute('data-pin-digits') : (isRtl(el) ? 'arabic' : 'latin');
    var str = String(n);
    return mode === 'latin' ? str : str.replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; });
  }
  function svgIcon(path, parent, size) {
    var v = s('svg', { viewBox: '0 0 24 24', width: size || 20, height: size || 20, 'aria-hidden': 'true' }, parent);
    s('path', { d: path, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, v);
    return v;
  }

  /* easing strings -> functions (for the rAF tracker that follows the camera) */
  function easeFn(str) {
    str = String(str || '');
    if (/^linear\(/.test(str)) {
      var pts = [];
      str.slice(7, -1).split(',').forEach(function (p) {
        var t = p.trim().split(/\s+/), v = parseFloat(t[0]);
        if (t.length < 2) pts.push({ v: v, t: null });
        t.slice(1).forEach(function (q) { pts.push({ v: v, t: parseFloat(q) / 100 }); });
      });
      if (pts[0].t == null) pts[0].t = 0;
      if (pts[pts.length - 1].t == null) pts[pts.length - 1].t = 1;
      for (var i = 1; i < pts.length; i++) {
        if (pts[i].t != null) { if (pts[i].t < pts[i - 1].t) pts[i].t = pts[i - 1].t; continue; }
        var j = i; while (pts[j].t == null) j++;
        for (var k = i; k < j; k++) pts[k].t = pts[i - 1].t + (pts[j].t - pts[i - 1].t) * (k - i + 1) / (j - i + 1);
      }
      return function (x) {
        for (var i = 1; i < pts.length; i++) if (x <= pts[i].t) {
          var a = pts[i - 1], b = pts[i], d = b.t - a.t; return d ? a.v + (b.v - a.v) * (x - a.t) / d : b.v;
        }
        return 1;
      };
    }
    var m = /cubic-bezier\(([^)]+)\)/.exec(str);
    if (m) {
      var c = m[1].split(',').map(parseFloat);
      var bz = function (t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; };
      return function (x) {
        var lo = 0, hi = 1, t = x;
        for (var i = 0; i < 24; i++) { t = (lo + hi) / 2; if (bz(t, c[0], c[2]) < x) lo = t; else hi = t; }
        return bz(t, c[1], c[3]);
      };
    }
    return function (x) { return 1 - Math.pow(1 - x, 3); };
  }

  /* ---------------------------------------------------------------- session */
  function Session(act, el, ctx, manual) {
    this.act = act; this.el = el; this.slide = el.closest('.slide'); this.rig = rigOf(this.slide);
    this.manual = !!manual; this.instant = !!(ctx && ctx.instant); this.id = ++uid;
    this.anims = []; this.touched = []; this.closed = false; this.opened = false; this.trackId = 0;
    this.rtl = isRtl(this.slide);
    this.root = h('div', 'nmf nmf-' + act);
    this.root.dir = this.rtl ? 'rtl' : 'ltr';
  }
  var SP = Session.prototype;
  SP.f = function () { return this.instant || NM.speed === 0 ? 0 : 1; };
  /* tween el from its current computed values (or o.from) to `to`; holds the end state (fill both)
     until finalize() cancels it, so nothing is ever written to the real DOM. */
  SP.tween = function (el, to, o) {
    o = o || {};
    var key = Object.keys(to).sort().join(','), map = el.__nmf || (el.__nmf = {}), from = o.from;
    if (!from) { var cs = getComputedStyle(el); from = {}; for (var k in to) from[k] = cs[k] || cs.getPropertyValue(k); }
    if (map[key]) map[key].cancel();
    var f = this.f();
    var a = NM.animate(el, [from, to], {
      duration: (o.dur == null ? 600 : o.dur) * f, delay: (o.delay || 0) * f,
      easing: o.ease || ease('standard'), fill: 'both'
    });
    map[key] = a; this.anims.push(a);
    if (this.touched.indexOf(el) < 0) this.touched.push(el);
    return a;
  };
  SP.stop = function (el, keys) { var m = el.__nmf; if (m && m[keys]) { m[keys].cancel(); delete m[keys]; } };
  SP.settled = function (list) {
    return Promise.all((list || []).map(function (a) { return a && a.finished ? a.finished.catch(function () {}) : null; }));
  };
  SP.svg = function () {
    if (!this._svg) this._svg = s('svg', { class: 'nmf-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }, this.root);
    return this._svg;
  };
  SP.finalize = function () {
    this.trackId++;
    this.anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
    this.touched.forEach(function (el) { try { delete el.__nmf; } catch (e) { el.__nmf = undefined; } });
    this.anims = []; this.touched = [];
    if (this.keyOff) this.keyOff();
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    if (this.zoomed && deck && deck.camera) { this.zoomed = false; deck.camera.reset(); }
  };

  /* -------------------------------------------------------------- dispatch */
  function owns(S, el) { return S && (S.el === el || (S.owns && S.owns(el))); }
  function cameraIdle(rig) {
    var t = getComputedStyle(rig).transform;
    return !t || t === 'none' || new DOMMatrix(t).isIdentity;
  }
  function settleCamera(S) {
    if (cameraIdle(S.rig)) return null;
    try { deck && deck.camera && deck.camera.reset(); } catch (e) { /* ignore */ }
    return new Promise(function (res) {
      var t0 = performance.now();
      (function f() { if (cameraIdle(S.rig) || performance.now() - t0 > 2500) res(); else requestAnimationFrame(f); })();
    });
  }
  function enterAct(name, el, ctx, manual) {
    var slide = el.closest('.slide');
    if (!slide) return;
    if (active && !active.closed) {
      if (active.act === name && active.slide === slide && IMPL[name].cont && IMPL[name].cont(active, el, ctx || {})) {
        clearTimeout(active.pendingTimer); active.pendingTimer = null;
        active.instant = !!(ctx && ctx.instant);
        if (manual) active.manual = true;
        return;
      }
      closeSession(active, ctx && ctx.instant);
    }
    var S = new Session(name, el, ctx, manual);
    active = S;
    var go = function () {
      if (S.closed) return;
      layer().appendChild(S.root);
      S.opened = true;
      IMPL[name].open(S);
    };
    var wait = settleCamera(S);
    if (wait) wait.then(go); else go();
    return S;
  }
  function exitAct(name, el, ctx) {
    var S = active;
    if (!S || S.act !== name || !owns(S, el) || S.closed) return;
    if (ctx && ctx.instant) return closeSession(S, true);
    clearTimeout(S.pendingTimer);
    /* defer one task: if the very next step re-enters the same act on this slide
       (focus to focus, pin to pin, lens to lens) the session continues instead of closing. */
    S.pendingTimer = setTimeout(function () { S.pendingTimer = null; closeSession(S, false); }, 0);
  }
  function closeSession(S, instant) {
    if (!S || S.closed) return Promise.resolve();
    S.closed = true; clearTimeout(S.pendingTimer);
    if (active === S) active = null;
    if (instant || !S.opened) { S.instant = true; S.finalize(); return Promise.resolve(); }
    var p;
    try { p = Promise.resolve(IMPL[S.act].close(S)); } catch (e) { console.error(e); p = Promise.resolve(); }
    return p.then(function () { S.finalize(); }, function () { S.finalize(); });
  }

  /* ---------------------------------------------------------------- shared */
  /* Veil: one full-stage layer that dims, blurs and desaturates everything behind it,
     with a soft-edged rounded-rect hole drawn by an SVG mask. */
  function buildVeil(S, cls) {
    var mid = 'nmf-mask-' + S.id, fid = 'nmf-soft-' + S.id;
    var defs = s('svg', { class: 'nmf-defs', width: 0, height: 0, 'aria-hidden': 'true' }, S.root);
    var d = s('defs', {}, defs);
    var fl = s('filter', { id: fid, x: '-20%', y: '-20%', width: '140%', height: '140%' }, d);
    s('feGaussianBlur', { stdDeviation: 13 }, fl);
    var mk = s('mask', { id: mid, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, d);
    s('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }, mk);
    S.hole = s('rect', { x: 960, y: 540, width: 0, height: 0, rx: 0, ry: 0, fill: '#000', filter: 'url(#' + fid + ')' }, mk);
    S.veil = h('div', 'nmf-veil' + (cls ? ' ' + cls : ''), S.root);
    S.veil.style.maskImage = S.veil.style.webkitMaskImage = 'url(#' + mid + ')';
    return S.veil;
  }
  function geoCss(g) { return { x: px(g.x), y: px(g.y), width: px(Math.max(0, g.w)), height: px(Math.max(0, g.h)), rx: px(g.r || 0), ry: px(g.r || 0) }; }
  function setGeo(node, g) { if (!node) return; var c = geoCss(g); GEO.forEach(function (k) { node.setAttribute(k, parseFloat(c[k])); }); }
  function readGeo(node) {
    var cs = getComputedStyle(node);
    var g = { x: parseFloat(cs.x), y: parseFloat(cs.y), w: parseFloat(cs.width), h: parseFloat(cs.height), r: parseFloat(cs.rx) };
    if (!isFinite(g.w)) g.w = +node.getAttribute('width');
    if (!isFinite(g.h)) g.h = +node.getAttribute('height');
    if (!isFinite(g.r)) g.r = +node.getAttribute('rx') || 0;
    return g;
  }
  function tweenGeo(S, nodes, g, o) {
    var list = [];
    nodes.forEach(function (n) { if (!n) return; var from = geoCss(readGeo(n)); setGeo(n, g); list.push(S.tween(n, geoCss(g), Object.assign({ from: from }, o))); });
    return list;
  }
  function ring(S, g, cls) {
    var svg = S.svg();
    var glow = s('rect', { class: 'nmf-ring-glow' + (cls ? ' ' + cls : ''), pathLength: 1 }, svg);
    var r = s('rect', { class: 'nmf-ring' + (S.rtl ? ' nmf-rtl' : '') + (cls ? ' ' + cls : ''), pathLength: 1 }, svg);
    setGeo(r, g); setGeo(glow, g);
    return { line: r, glow: glow };
  }
  function drawRing(S, R, delay) {
    return [
      S.tween(R.line, { strokeDashoffset: '0' }, { from: { strokeDashoffset: '1' }, dur: 820, delay: delay || 0, ease: ease('emphasized') }),
      S.tween(R.glow, { opacity: '1' }, { from: { opacity: '0' }, dur: 700, delay: (delay || 0) + 200 })
    ];
  }
  function undrawRing(S, R) {
    if (!R) return [];
    return [S.tween(R.line, { opacity: '0' }, { dur: 320 }), S.tween(R.glow, { opacity: '0' }, { dur: 260 })];
  }
  /* Ghost: a clone of the whole slide shell + rig (so every ancestor selector still
     matches) with only the subject visible; ids stripped, inert, aria-hidden. */
  function cloneSlide(S, only) {
    var slide = S.slide, rig = S.rig;
    var shell = slide.cloneNode(rig === slide), rc = rig === slide ? shell : rig.cloneNode(true);
    if (rc !== shell) shell.appendChild(rc);
    var src = [rig].concat(Array.prototype.slice.call(rig.querySelectorAll('*')));
    var dst = [rc].concat(Array.prototype.slice.call(rc.querySelectorAll('*')));
    var vals = src.map(function (e) {
      var c = getComputedStyle(e); return [c.opacity, c.transform, c.visibility, c.translate, c.scale, c.rotate, e instanceof SVGElement && e.tagName.toLowerCase() !== 'svg'];
    });
    dst.forEach(function (e, i) {
      var v = vals[i], st = e.style;
      if (i === 0 && rc !== shell) { st.transform = 'none'; st.translate = 'none'; st.scale = 'none'; st.filter = 'none'; st.opacity = '1'; }
      else if (i > 0) {
        if (v[0] !== '1') st.opacity = v[0];
        if (!v[6]) {
          if (v[1] !== 'none') st.transform = v[1];
          if (v[3] !== 'none') st.translate = v[3];
          if (v[4] !== 'none') st.scale = v[4];
          if (v[5] !== 'none') st.rotate = v[5];
        }
      }
      if (v[2] === 'hidden') st.visibility = 'hidden';
      else if (only && i > 0 && src[i] === only) st.visibility = 'visible';
      e.removeAttribute('id'); e.removeAttribute('data-morph');
    });
    shell.removeAttribute('id'); shell.removeAttribute('data-morph');
    shell.classList.add('nmf-clone');
    shell.setAttribute('aria-hidden', 'true'); shell.setAttribute('inert', '');
    var st = shell.style;
    st.position = 'absolute'; st.left = '0px'; st.top = '0px'; st.width = W + 'px'; st.height = H + 'px';
    st.margin = '0'; st.transform = 'none'; st.opacity = '1'; st.pointerEvents = 'none'; st.zIndex = 'auto';
    st.transformOrigin = '0 0'; st.visibility = only ? 'hidden' : 'visible';
    if (only) st.background = 'transparent';
    return { shell: shell, find: function (el) { return dst[src.indexOf(el)]; } };
  }
  function ghost(S) {
    var c = cloneSlide(S, S.el);
    var g = h('div', 'nmf-ghost', S.root);
    g.appendChild(c.shell);
    S.ghost = g;
    S.tween(S.el, { opacity: '0' }, { from: { opacity: '0' }, dur: 0 });   /* hold: real subject hidden */
    return g;
  }
  function ghostTo(S, R, T, o) {
    var k = T.w / R.w;
    return S.tween(S.ghost, { transform: 'translate(' + px(T.x - k * R.x) + ',' + px(T.y - k * R.y) + ') scale(' + k + ')' }, o);
  }
  /* depth recede of the real rig, about the stage centre (individual transform
     properties, so it composes with whatever the camera does on `transform`). */
  function recede(S, o) {
    var rig = S.rig, sc = o.scale || 1, sh = o.shift || 0;
    var org = getComputedStyle(rig).transformOrigin.split(' ').map(parseFloat);
    var tx = (960 - (org[0] || 0)) * (1 - sc), ty = (540 - (org[1] || 0)) * (1 - sc) + sh;
    S.recedeMap = function (r) {
      return { x: 960 + sc * (r.x - 960), y: 540 + sc * (r.y - 540) + sh, w: r.w * sc, h: r.h * sc };
    };
    return S.tween(rig, { scale: String(sc), translate: px(tx) + ' ' + px(ty), filter: o.filter },
      { dur: o.dur || 820, ease: ease('emphasized'), delay: o.delay || 0 });
  }
  function unrecede(S, dur) {
    return S.tween(S.rig, { scale: '1', translate: '0px 0px', filter: 'blur(0px) brightness(1) saturate(1)' },
      { dur: dur || 640, ease: ease('emphasized') });
  }
  /* curved leader between two points with end dots */
  function leader(S, a, b, o) {
    o = o || {};
    var svg = S.svg(), g = s('g', { class: 'nmf-leader' + (o.cls ? ' ' + o.cls : '') }, svg);
    var dx = b.x - a.x, dy = b.y - a.y, d;
    if (o.elbow) {
      var kx = o.elbow.x, ky = o.elbow.y;
      d = 'M' + a.x + ' ' + a.y + ' L' + kx + ' ' + ky + ' L' + b.x + ' ' + b.y;
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      d = 'M' + a.x + ' ' + a.y + ' C' + (a.x + dx * 0.5) + ' ' + a.y + ' ' + (b.x - dx * 0.5) + ' ' + b.y + ' ' + b.x + ' ' + b.y;
    } else {
      d = 'M' + a.x + ' ' + a.y + ' C' + a.x + ' ' + (a.y + dy * 0.5) + ' ' + b.x + ' ' + (b.y - dy * 0.5) + ' ' + b.x + ' ' + b.y;
    }
    var p = s('path', { d: d, pathLength: 1, class: 'nmf-leader-line' }, g);
    var d1 = s('circle', { cx: a.x, cy: a.y, r: o.r1 == null ? 6 : o.r1, class: 'nmf-leader-dot' }, g);
    var d2 = o.noEnd ? null : s('circle', { cx: b.x, cy: b.y, r: 4, class: 'nmf-leader-dot nmf-end' }, g);
    var dl = o.delay || 0;
    S.tween(g, { opacity: '1' }, { from: { opacity: '0' }, dur: 200, delay: dl });
    S.tween(p, { strokeDashoffset: '0' }, { from: { strokeDashoffset: '1' }, dur: o.dur || 620, delay: dl, ease: ease('emphasized') });
    S.tween(d1, { transform: 'scale(1)' }, { from: { transform: 'scale(0)' }, dur: 420, delay: dl, ease: ease('springBouncy') });
    if (d2) S.tween(d2, { transform: 'scale(1)' }, { from: { transform: 'scale(0)' }, dur: 420, delay: dl + (o.dur || 620) * 0.8, ease: ease('springBouncy') });
    return g;
  }
  function edgeLink(A, B) {
    var ca = cen(A), cb = cen(B);
    if (A.x + A.w <= B.x || B.x + B.w <= A.x) {
      var left = A.x + A.w <= B.x;
      return { a: { x: left ? A.x + A.w : A.x, y: ca.y }, b: { x: left ? B.x : B.x + B.w, y: Math.max(B.y + 24, Math.min(B.y + B.h - 24, ca.y)) } };
    }
    if (A.y + A.h <= B.y || B.y + B.h <= A.y) {
      var up = A.y + A.h <= B.y;
      return { a: { x: ca.x, y: up ? A.y + A.h : A.y }, b: { x: Math.max(B.x + 24, Math.min(B.x + B.w - 24, ca.x)), y: up ? B.y : B.y + B.h } };
    }
    return null;
  }
  function socket(S, r, rad) {
    var e = s('rect', { class: 'nmf-socket', x: r.x, y: r.y, width: r.w, height: r.h, rx: rad, ry: rad }, S.svg());
    S.tween(e, { opacity: '1' }, { from: { opacity: '0' }, dur: 500, delay: 260 });
    return e;
  }
  function fadeOut(S, nodes, dur) {
    return nodes.filter(Boolean).map(function (n) { return S.tween(n, { opacity: '0' }, { dur: dur || 260, ease: ease('exit') }); });
  }

  /* detail content: <template data-detail-for="ID"> (any number = pages) or hidden .nm-detail children */
  function detailPages(el) {
    var id = el.getAttribute('data-detail-id') || el.id, out = [];
    if (id) {
      Array.prototype.forEach.call(document.querySelectorAll('template[data-detail-for]'), function (t) {
        if (t.getAttribute('data-detail-for') === id) out.push(t.content.cloneNode(true));
      });
    }
    Array.prototype.forEach.call(el.querySelectorAll('.nm-detail'), function (d) {
      var f = document.createDocumentFragment();
      Array.prototype.forEach.call(d.childNodes, function (n) { f.appendChild(n.cloneNode(true)); });
      out.push(f);
    });
    if (!out.length && el.getAttribute('data-detail-text')) {
      var f = document.createDocumentFragment(), p = document.createElement('p');
      p.textContent = el.getAttribute('data-detail-text'); f.appendChild(p); out.push(f);
    }
    out.forEach(function (f) { Array.prototype.forEach.call(f.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); }); });
    return out;
  }
  function leafBlocks(page) {
    var out = [];
    Array.prototype.forEach.call(page.children, function (c) {
      if (/^(UL|OL)$/.test(c.tagName) || c.classList.contains('nm-stagger')) Array.prototype.forEach.call(c.children, function (li) { out.push(li); });
      else out.push(c);
    });
    return out;
  }
  function stagger(S, page, delay, dirX) {
    var list = leafBlocks(page);
    return list.map(function (n, i) {
      return S.tween(n, { opacity: '1', transform: 'none' }, {
        from: { opacity: '0', transform: dirX ? 'translateX(' + dirX + 'px)' : 'translateY(22px)' },
        dur: 560, delay: delay + i * 70, ease: ease('enter')
      });
    });
  }
  function closeBtn(S, parent) {
    var b = h('button', 'nmf-close', parent);
    b.type = 'button'; b.setAttribute('aria-label', S.rtl ? 'إغلاق' : 'Close');
    svgIcon('M6 6l12 12M18 6L6 18', b, 18);
    b.addEventListener('click', function (e) { e.stopPropagation(); closeSession(S, false); });
    return b;
  }
  function buildPanel(S, cls, width) {
    var pages = detailPages(S.el);
    if (!pages.length) return null;
    var panel = h('div', 'nmf-panel ' + (cls || ''), S.root);
    panel.dir = S.rtl ? 'rtl' : 'ltr';
    var body = h('div', 'nmf-pages', panel);
    S.pageEls = pages.map(function (f, i) {
      var pg = h('div', 'nmf-page' + (i ? ' nmf-off' : ''), body); pg.appendChild(f); return pg;
    });
    S.page = 0;
    if (pages.length > 1) {
      var nav = h('div', 'nmf-pager', panel);
      var prev = h('button', 'nmf-pg nmf-pg-prev', nav), dots = h('div', 'nmf-dots', nav), next = h('button', 'nmf-pg nmf-pg-next', nav);
      prev.type = next.type = 'button';
      prev.setAttribute('aria-label', S.rtl ? 'السابق' : 'Previous');
      next.setAttribute('aria-label', S.rtl ? 'التالي' : 'Next');
      svgIcon(S.rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6', prev, 18);
      svgIcon(S.rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6', next, 18);
      S.dots = pages.map(function (p, i) { return h('i', i ? '' : 'on', dots); });
      prev.addEventListener('click', function (e) { e.stopPropagation(); pageTo(S, S.page - 1); });
      next.addEventListener('click', function (e) { e.stopPropagation(); pageTo(S, S.page + 1); });
    }
    closeBtn(S, panel);
    panel.style.width = px(width);
    panel.style.visibility = 'hidden';
    S.panel = panel;
    return panel;
  }
  function measure(panel, maxH) {
    var hgt = Math.min(panel.offsetHeight, maxH);
    panel.style.visibility = '';
    if (panel.offsetHeight > maxH) { panel.style.height = px(maxH); panel.classList.add('nmf-clip'); }
    return hgt;
  }
  function pageTo(S, i) {
    if (!S.pageEls || i < 0 || i >= S.pageEls.length || i === S.page) return false;
    var dir = i > S.page ? 1 : -1, old = S.pageEls[S.page], nw = S.pageEls[i];
    var lead = (S.rtl ? -1 : 1) * dir; /* content travels toward the reading direction */
    S.tween(old, { opacity: '0', transform: 'translateX(' + (-40 * lead) + 'px)' }, { from: { opacity: '1', transform: 'none' }, dur: 300, ease: ease('exit') });
    nw.classList.remove('nmf-off');
    S.tween(nw, { opacity: '1', transform: 'none' }, { from: { opacity: '1', transform: 'none' }, dur: 0 });
    stagger(S, nw, 140, 36 * lead);
    var o = old;
    setTimeout(function () { if (S.page !== S.pageEls.indexOf(o)) o.classList.add('nmf-off'); }, 300 * S.f());
    S.page = i;
    if (S.dots) S.dots.forEach(function (d, k) { d.className = k === i ? 'on' : ''; });
    return true;
  }

  /* ------------------------------------------------------------------ focus */
  function focusGeom(el, r, zoomK) {
    var pad = num(el.getAttribute('data-focus-pad'), 18), shape = attr(el, 'data-focus-shape', 'auto');
    var rad = radiusOf(el, { w: r.w / (zoomK || 1), h: r.h / (zoomK || 1) }) * (zoomK || 1), ar = r.w / r.h;
    var roundish = rad >= Math.min(r.w, r.h) * 0.3;
    if (shape === 'auto') shape = ar > 0.75 && ar < 1.33 && roundish ? 'circle' : 'rect';
    var c = cen(r);
    if (shape === 'circle') {
      var d = (roundish ? Math.max(r.w, r.h) : Math.hypot(r.w, r.h)) + pad * 2;
      return { x: c.x - d / 2, y: c.y - d / 2, w: d, h: d, r: d / 2 };
    }
    return { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad, r: Math.min(rad > 0 ? rad + pad : 16, (Math.min(r.w, r.h) + 2 * pad) / 2) };
  }
  function lerpG(a, b, k) { return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, r: a.r + (b.r - a.r) * k }; }
  /* follow the subject's live rect while the camera moves */
  function track(S, from, dur, total, after) {
    var id = ++S.trackId, el = S.el, fn = easeFn(ease('emphasized')), t0 = performance.now();
    var nodes = [S.hole, S.ring && S.ring.line, S.ring && S.ring.glow];
    nodes.forEach(function (n) { if (n) S.stop(n, 'height,rx,ry,width,x,y'); });
    S.tween(S.root, { '--nmf-busy': '1' }, { from: { '--nmf-busy': '0' }, dur: total });   /* keeps NM.test.settle() pending */
    var base = rest(el);
    var step = function (now) {
      if (id !== S.trackId || !S.root.parentNode) return;
      var lr = live(el), k = lr.w / (base.w || 1);
      var t = S.f() ? Math.min(1, (now - t0) / dur) : 1;
      var g = lerpG(from, focusGeom(el, lr, k), fn(t));
      nodes.forEach(function (n) { setGeo(n, g); });
      S.g = g; placeNote(S, g);
      if (now - t0 < total * S.f()) requestAnimationFrame(step); else if (after) after();
    };
    requestAnimationFrame(step);
    step(t0);
  }
  function placeNote(S, g) {
    if (!S.note) return;
    var nh = S.noteH || 64, nw = S.noteW || 300, below = g.y + g.h + 22 + nh <= H - M;
    var x = Math.max(M, Math.min(W - M - nw, g.x + g.w / 2 - nw / 2)), y = below ? g.y + g.h + 22 : Math.max(M, g.y - 22 - nh);
    S.note.style.transform = 'translate(' + px(x) + ',' + px(y) + ')';
  }
  function makeNote(S, el, delay) {
    var t = el.getAttribute('data-focus-note');
    if (S.note) { var old = S.note; S.note = null; S.tween(old, { opacity: '0' }, { dur: 200 }).finished.then(function () { old.remove(); }, function () {}); }
    if (!t) return;
    var n = h('div', 'nmf-note', S.root); n.textContent = t;
    S.note = n; S.noteW = n.offsetWidth; S.noteH = n.offsetHeight;
    var inner = n;
    S.tween(inner, { opacity: '1', translate: '0px 0px' }, { from: { opacity: '0', translate: '0px 12px' }, dur: 520, delay: delay, ease: ease('enter') });
  }
  IMPL.focus = {
    open: function (S) {
      var el = S.el, r = rest(el), g = focusGeom(el, r);
      buildVeil(S); S.ring = ring(S, g);
      var start = inflate(g, 90); start.r = g.r + 60;
      S.tween(S.veil, { opacity: '1' }, { from: { opacity: '0' }, dur: 620 });
      makeNote(S, el, 520);
      if (el.hasAttribute('data-focus-zoom')) {
        S.zoomed = true; setGeo(S.hole, start);
        deck.camera.to(el, { scale: num(el.getAttribute('data-focus-zoom'), undefined), pad: 160, duration: camDur() });
        track(S, start, camDur(), camDur() + 300);
      } else {
        setGeo(S.hole, g); S.g = g; placeNote(S, g);
        S.tween(S.hole, geoCss(g), { from: geoCss(start), dur: 820, ease: ease('springSoft') });
      }
      drawRing(S, S.ring, 180);
    },
    cont: function (S, el) {
      if (S.closed) return false;
      var wasZoom = S.zoomed, zoom = el.hasAttribute('data-focus-zoom'), from = readGeo(S.hole);
      S.el = el;
      makeNote(S, el, 380);
      if (zoom) {
        S.zoomed = true;
        deck.camera.to(el, { scale: num(el.getAttribute('data-focus-zoom'), undefined), pad: 160, duration: camDur() });
        track(S, from, camDur(), camDur() + 300);
      } else if (wasZoom) {
        S.zoomed = false; deck.camera.reset();
        track(S, from, camDur(), camDur() + 300);
      } else {
        var g = focusGeom(el, rest(el)); S.g = g; placeNote(S, g);
        tweenGeo(S, [S.hole, S.ring.line, S.ring.glow], g, { dur: 780, ease: ease('springSoft') });
      }
      S.tween(S.ring.glow, { opacity: '1' }, { from: { opacity: '0.2' }, dur: 900, delay: 300 });
      return true;
    },
    close: function (S) {
      var list = [S.tween(S.veil, { opacity: '0' }, { dur: 520, ease: ease('standard') })].concat(undrawRing(S, S.ring), fadeOut(S, [S.note], 220));
      if (S.zoomed) {
        S.zoomed = false; deck.camera.reset();
        track(S, readGeo(S.hole), camDur(), camDur());
      } else if (S.g) {
        var big = inflate(S.g, 70); big.r = S.g.r + 50;
        tweenGeo(S, [S.hole], big, { dur: 520, ease: ease('exit') });
      }
      return S.settled(list);
    }
  };

  /* ----------------------------------------------------------------- detail */
  IMPL.detail = {
    open: function (S) {
      var el = S.el, R = rest(el), rad = radiusOf(el, R), v = attr(el, 'data-detail', 'auto');
      if (v === 'auto') v = R.w * R.h < 140000 && R.w < 520 ? 'popover' : 'side';
      S.variant = v; S.R = R; S.rad = rad;
      ghost(S);
      DETAIL[v] ? DETAIL[v](S, el, R, rad) : DETAIL.side(S, el, R, rad);
      if (S.pageEls && S.pageEls.length > 1) S.pages = true;
    },
    close: function (S) {
      var list = [], R = S.R;
      if (S.pageEls) S.pageEls.forEach(function (p) { list.push(S.tween(p, { opacity: '0' }, { dur: 200, ease: ease('exit') })); });
      var pnl = S.panel;
      if (pnl) {
        if (S.variant === 'sheet') list.push(S.tween(pnl, { translate: '0px ' + px(S.sheetH + 60) }, { dur: 560, delay: 80, ease: ease('emphasized') }));
        else if (S.variant === 'popover') list.push(S.tween(pnl, { opacity: '0', scale: '.92' }, { dur: 300, ease: ease('exit') }));
        else if (S.clipFrom) list.push(S.tween(pnl, { clipPath: S.clipFrom }, { dur: 560, delay: 60, ease: ease('emphasized') }));
        else list.push(S.tween(pnl, { opacity: '0' }, { dur: 300 }));
        if (S.clipFrom && S.variant !== 'expand') list.push(S.tween(pnl, { opacity: '0' }, { dur: 240, delay: 380 }));
      }
      list = list.concat(fadeOut(S, [S.svg()], 240), undrawRing(S, S.ring));
      if (S.ghost) {
        list.push(S.tween(S.ghost, { transform: 'translate(0px,0px) scale(1)' }, { dur: 720, delay: S.variant === 'expand' ? 120 : 160, ease: ease('emphasized') }));
        list.push(S.tween(S.ghost, { opacity: '1', filter: 'drop-shadow(0px 0px 0px rgba(0,0,0,0))' }, { dur: 520, delay: S.variant === 'expand' ? 300 : 200 }));
      }
      list.push(unrecede(S, 720));
      void R;
      return S.settled(list);
    }
  };
  var DETAIL = {
    side: function (S, el, R, rad) {
      recede(S, { scale: 0.94, filter: 'blur(6px) brightness(.74) saturate(.7)' });
      var pw = Math.min(num(el.getAttribute('data-detail-width'), 820), 900), gap = 72;
      var k = Math.min(1.3, (W - 2 * M - pw - gap) / R.w, (H - 2 * M - 40) / R.h, 860 / R.w);
      var T = { w: R.w * k, h: R.h * k }, total = T.w + gap + pw, x0 = (W - total) / 2;
      T.x = S.rtl ? x0 + pw + gap : x0; T.y = (H - T.h) / 2;
      var panel = buildPanel(S, 'nmf-side', pw);
      var P = { x: S.rtl ? x0 : x0 + T.w + gap, w: pw };
      if (panel) {
        var ph = measure(panel, H - 2 * M);
        P.h = ph; P.y = Math.max(M, Math.min(H - M - ph, T.y + T.h / 2 - ph / 2));
        panel.style.transform = 'translate(' + px(P.x) + ',' + px(P.y) + ')';
        var ti = Math.max(0, Math.min(ph - 2, T.y - P.y)), bi = Math.max(0, Math.min(ph - 2 - ti, P.y + ph - (T.y + T.h)));
        S.clipFrom = S.rtl ? 'inset(' + px(ti) + ' 0px ' + px(bi) + ' ' + px(pw) + ' round ' + px(rad * k) + ')' : 'inset(' + px(ti) + ' ' + px(pw) + ' ' + px(bi) + ' 0px round ' + px(rad * k) + ')';
        S.tween(panel, { clipPath: 'inset(0px 0px 0px 0px round var(--nmf-radius))' }, { from: { clipPath: S.clipFrom }, dur: 780, delay: 300, ease: ease('emphasized') });
        stagger(S, S.pageEls[0], 560);
      }
      ghostTo(S, R, T, { from: { transform: 'translate(0px,0px) scale(1)' }, dur: 820, ease: ease('springSoft') });
      S.tween(S.ghost, { filter: 'drop-shadow(0px 34px 46px rgba(10,14,24,.28))' }, { from: { filter: 'drop-shadow(0px 0px 0px rgba(10,14,24,0))' }, dur: 700 });
      var home = S.recedeMap(R); socket(S, home, rad * 0.94);
      var L = edgeLink(home, T);
      if (L) leader(S, L.a, L.b, { delay: 640 });
    },
    expand: function (S, el, R, rad) {
      recede(S, { scale: 0.94, filter: 'blur(7px) brightness(.7) saturate(.65)' });
      var hw = Math.min(num(el.getAttribute('data-detail-width'), 1360), W - 2 * M);
      var panel = buildPanel(S, 'nmf-hero', hw);
      var hh = panel ? Math.max(380, measure(panel, H - 2 * M)) : 480;
      var Hr = { x: (W - hw) / 2, y: (H - hh) / 2, w: hw, h: hh };
      var bg = getComputedStyle(el).backgroundColor;
      if (panel) {
        if (bg && !/rgba\(.*,\s*0\)$|transparent/.test(bg)) panel.style.setProperty('--nmf-hero-bg', bg);
        panel.style.height = px(hh);
        panel.style.transform = 'translate(' + px(Hr.x) + ',' + px(Hr.y) + ')';
        var t = Math.max(0, R.y - Hr.y), b = Math.max(0, Hr.y + hh - (R.y + R.h)), l = Math.max(0, R.x - Hr.x), r = Math.max(0, Hr.x + hw - (R.x + R.w));
        S.clipFrom = 'inset(' + px(t) + ' ' + px(r) + ' ' + px(b) + ' ' + px(l) + ' round ' + px(rad) + ')';
        S.tween(panel, { clipPath: 'inset(0px 0px 0px 0px round var(--nmf-radius))' }, { from: { clipPath: S.clipFrom }, dur: 860, ease: ease('emphasized') });
        S.tween(panel, { opacity: '1' }, { from: { opacity: '0' }, dur: 160 });
        stagger(S, S.pageEls[0], 460);
      }
      /* the subject swells toward the hero box and dissolves into it */
      var k = Math.min(Hr.w / R.w, Hr.h / R.h) * 0.6, T = { w: R.w * k, h: R.h * k };
      T.x = Hr.x + (Hr.w - T.w) / 2; T.y = Hr.y + (Hr.h - T.h) / 2;
      ghostTo(S, R, T, { from: { transform: 'translate(0px,0px) scale(1)' }, dur: 860, ease: ease('emphasized') });
      S.tween(S.ghost, { opacity: '0' }, { from: { opacity: '1' }, dur: 380, delay: 120 });
      var home = S.recedeMap(R); socket(S, home, rad * 0.94);
      S.root.insertBefore(S.svg(), S.root.firstChild);
      S.root.appendChild(S.ghost);
    },
    sheet: function (S, el, R, rad) {
      var panel = buildPanel(S, 'nmf-sheet', W - 2 * M);
      var sh = panel ? Math.max(260, measure(panel, 620)) : 320;
      S.sheetH = sh;
      var avail = H - sh - 56, shift = 0;
      if (R.y + R.h > avail) shift = Math.max(M - R.y, avail - (R.y + R.h));
      recede(S, { scale: 1, shift: shift, filter: 'blur(3px) brightness(.8) saturate(.75)', dur: 760 });
      var T = { x: R.x, y: R.y + shift, w: R.w, h: R.h };
      ghostTo(S, R, T, { from: { transform: 'translate(0px,0px) scale(1)' }, dur: 760, ease: ease('emphasized') });
      S.tween(S.ghost, { filter: 'drop-shadow(0px 20px 30px rgba(10,14,24,.22))' }, { from: { filter: 'drop-shadow(0px 0px 0px rgba(10,14,24,0))' }, dur: 600 });
      var g = inflate({ x: T.x, y: T.y, w: T.w, h: T.h }, 12); g.r = rad + 12;
      S.ring = ring(S, g); drawRing(S, S.ring, 420);
      if (panel) {
        panel.style.height = px(sh);
        panel.style.transform = 'translate(' + px(M) + ',' + px(H - sh) + ')';
        S.tween(panel, { translate: '0px 0px' }, { from: { translate: '0px ' + px(sh + 60) }, dur: 780, delay: 80, ease: ease('emphasized') });
        stagger(S, S.pageEls[0], 420);
        var a = { x: g.x + g.w / 2, y: g.y + g.h }, b = { x: a.x, y: H - sh };
        if (b.y - a.y > 28) leader(S, a, b, { delay: 700, dur: 360 });
      }
    },
    popover: function (S, el, R, rad) {
      recede(S, { scale: 1, filter: 'blur(2.5px) brightness(.86) saturate(.8)', dur: 600 });
      S.tween(S.ghost, { filter: 'drop-shadow(0px 16px 24px rgba(10,14,24,.22))' }, { from: { filter: 'drop-shadow(0px 0px 0px rgba(10,14,24,0))' }, dur: 500 });
      var g = inflate(R, 10); g.r = rad + 10;
      S.ring = ring(S, g); drawRing(S, S.ring, 80);
      var pw = Math.min(num(el.getAttribute('data-detail-width'), 560), W - 2 * M);
      var panel = buildPanel(S, 'nmf-pop', pw);
      if (!panel) return;
      var ph = measure(panel, H - 2 * M), gap = 64;
      var space = { after: S.rtl ? R.x - M : W - M - R.x - R.w, before: S.rtl ? W - M - R.x - R.w : R.x - M, above: R.y - M, below: H - M - R.y - R.h };
      var need = { after: pw + gap, before: pw + gap, above: ph + gap, below: ph + gap };
      var pref = ['after', 'before', 'below', 'above'], side = null, best = -1e9;
      pref.forEach(function (k, i) { var sc = space[k] - need[k] - i * 30; if (space[k] >= need[k] && sc > best) { best = sc; side = k; } });
      if (!side) side = pref.reduce(function (a, k) { return space[k] - need[k] > space[a] - need[a] ? k : a; }, 'after');
      var c = cen(R), P = { w: pw, h: ph }, phys = side === 'after' ? (S.rtl ? 'left' : 'right') : side === 'before' ? (S.rtl ? 'right' : 'left') : side;
      if (phys === 'left') { P.x = R.x - gap - pw; P.y = c.y - ph / 2; }
      if (phys === 'right') { P.x = R.x + R.w + gap; P.y = c.y - ph / 2; }
      if (phys === 'above') { P.x = c.x - pw / 2; P.y = R.y - gap - ph; }
      if (phys === 'below') { P.x = c.x - pw / 2; P.y = R.y + R.h + gap; }
      P = clampSafe(P);
      panel.style.transform = 'translate(' + px(P.x) + ',' + px(P.y) + ')';
      var ox = phys === 'left' ? '100%' : phys === 'right' ? '0%' : '50%', oy = phys === 'above' ? '100%' : phys === 'below' ? '0%' : '50%';
      panel.style.transformOrigin = ox + ' ' + oy;
      panel.classList.add('nmf-from-' + phys);
      S.tween(panel, { opacity: '1', scale: '1' }, { from: { opacity: '0', scale: '.86' }, dur: 620, delay: 200, ease: ease('spring') });
      stagger(S, S.pageEls[0], 360);
      var L = edgeLink(g, P);
      if (L) leader(S, L.a, L.b, { delay: 160, dur: 380 });
    }
  };

  /* ------------------------------------------------------------------- lens */
  function tangents(c1, r1, c2, r2) {
    var dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
    if (d <= Math.abs(r2 - r1) + 1) return null;
    var th = Math.atan2(dy, dx), b = Math.acos((r1 - r2) / d), out = [];
    [th + b, th - b].forEach(function (a) {
      out.push({ x: c1.x + r1 * Math.cos(a), y: c1.y + r1 * Math.sin(a) }, { x: c2.x + r2 * Math.cos(a), y: c2.y + r2 * Math.sin(a) });
    });
    return out;
  }
  function lensPlan(S, el) {
    var R = rest(el), c = cen(R), m = Math.max(1.2, num(el.getAttribute('data-lens'), 2.2));
    var shape = attr(el, 'data-lens-shape', 'circle'), D = num(el.getAttribute('data-lens-size'), 440);
    var lw = shape === 'rect' ? D * 1.45 : D, lh = D;
    var r0 = Math.max(lw, lh) / (2 * m);
    var off = el.getAttribute('data-lens-offset'), L = null;
    if (off) {
      var o = off.split(',').map(parseFloat);
      L = clampSafe({ x: c.x + (o[0] || 0) - lw / 2, y: c.y + (o[1] || 0) - lh / 2, w: lw, h: lh });
    } else {
      var best = 1e12;
      [1, 1.25, 1.6].forEach(function (mul) {
        for (var a = 0; a < 16; a++) {
          var ang = a / 16 * Math.PI * 2, dist = (r0 + Math.max(lw, lh) / 2 + 70) * mul;
          var r = { x: c.x + Math.cos(ang) * dist - lw / 2, y: c.y + Math.sin(ang) * dist - lh / 2, w: lw, h: lh };
          if (!inSafe(r)) continue;
          var sc = ovl(r, inflate(R, 24)) * 4 + dist * 2 + Math.abs(Math.sin(ang)) * 60;
          if (sc < best) { best = sc; L = r; }
        }
      });
      if (!L) L = clampSafe({ x: c.x + r0 + 80, y: c.y - lh / 2, w: lw, h: lh });
    }
    return { R: R, c: c, m: m, lw: lw, lh: lh, r0: r0, L: L, shape: shape };
  }
  function lensContentT(p) { return 'translate(' + px(p.lw / 2 - p.m * p.c.x) + ',' + px(p.lh / 2 - p.m * p.c.y) + ') scale(' + p.m + ')'; }
  function lensBoxT(p) { return 'translate(' + px(p.L.x) + ',' + px(p.L.y) + ') scale(1)'; }
  function lensStartT(p) {
    var k = (2 * p.r0) / Math.max(p.lw, p.lh);
    return 'translate(' + px(p.c.x - p.lw * k / 2) + ',' + px(p.c.y - p.lh * k / 2) + ') scale(' + k + ')';
  }
  function lensCone(S, p) {
    var Lc = cen(p.L), r2 = Math.min(p.lw, p.lh) / 2, t = tangents(p.c, p.r0, Lc, r2);
    var g = s('g', { class: 'nmf-cone' }, S.svg());
    if (t) {
      s('path', { d: 'M' + t[0].x + ' ' + t[0].y + ' L' + t[1].x + ' ' + t[1].y + ' L' + t[3].x + ' ' + t[3].y + ' L' + t[2].x + ' ' + t[2].y + ' Z', class: 'nmf-cone-fill' }, g);
      s('line', { x1: t[0].x, y1: t[0].y, x2: t[1].x, y2: t[1].y, class: 'nmf-cone-edge' }, g);
      s('line', { x1: t[2].x, y1: t[2].y, x2: t[3].x, y2: t[3].y, class: 'nmf-cone-edge' }, g);
    }
    s('circle', { cx: p.c.x, cy: p.c.y, r: p.r0, class: 'nmf-origin' }, g);
    S.svg().insertBefore(g, S.svg().firstChild);
    return g;
  }
  IMPL.lens = {
    open: function (S) {
      var p = lensPlan(S, S.el); S.plan = p;
      buildVeil(S, 'nmf-veil-soft');
      var hole = { x: p.c.x - p.r0, y: p.c.y - p.r0, w: 2 * p.r0, h: 2 * p.r0, r: p.r0 };
      setGeo(S.hole, hole);
      S.tween(S.veil, { opacity: '1' }, { from: { opacity: '0' }, dur: 600 });
      S.cone = lensCone(S, p);
      S.tween(S.cone, { opacity: '1' }, { from: { opacity: '0' }, dur: 500, delay: 420 });
      var box = h('div', 'nmf-lens' + (p.shape === 'rect' ? ' nmf-lens-rect' : ''), S.root);
      box.style.width = px(p.lw); box.style.height = px(p.lh);
      var view = h('div', 'nmf-lens-view', box);
      var c = cloneSlide(S, null); view.appendChild(c.shell);
      c.shell.style.transform = lensContentT(p);
      h('div', 'nmf-lens-gloss', box);
      var badge = h('div', 'nmf-lens-badge', box);
      badge.textContent = (S.rtl ? digits(String(p.m).replace('.', '٫'), S.el) : String(p.m)) + '×';
      S.box = box; S.view = c.shell;
      S.tween(box, { transform: lensBoxT(p), opacity: '1' }, { from: { transform: lensStartT(p), opacity: '0.4' }, dur: 860, ease: ease('springSoft') });
      S.tween(badge, { opacity: '1', scale: '1' }, { from: { opacity: '0', scale: '.6' }, dur: 520, delay: 640, ease: ease('springBouncy') });
    },
    cont: function (S, el) {
      if (S.closed) return false;
      S.el = el;
      var p = lensPlan(S, el), old = S.plan; S.plan = p;
      tweenGeo(S, [S.hole], { x: p.c.x - p.r0, y: p.c.y - p.r0, w: 2 * p.r0, h: 2 * p.r0, r: p.r0 }, { dur: 760, ease: ease('emphasized') });
      S.tween(S.box, { transform: lensBoxT(p), opacity: '1' }, { dur: 820, ease: ease('springSoft') });
      S.tween(S.view, { transform: lensContentT(p) }, { from: { transform: lensContentT(old) }, dur: 820, ease: ease('emphasized') });
      var oc = S.cone; S.tween(oc, { opacity: '0' }, { dur: 200 }).finished.then(function () { oc.remove(); }, function () {});
      S.cone = lensCone(S, p);
      S.tween(S.cone, { opacity: '1' }, { from: { opacity: '0' }, dur: 420, delay: 640 });
      return true;
    },
    close: function (S) {
      var p = S.plan;
      return S.settled([
        S.tween(S.box, { transform: lensStartT(p), opacity: '0' }, { dur: 560, ease: ease('emphasized') }),
        S.tween(S.veil, { opacity: '0' }, { dur: 520 }),
        S.tween(S.cone, { opacity: '0' }, { dur: 200 })
      ]);
    }
  };

  /* ------------------------------------------------------------------- pins */
  function pinHost(el) { return el.classList.contains('nm-pin') ? el.parentElement.closest('[data-act="pins"]') : el; }
  function pinList(host) { return Array.prototype.filter.call(host.querySelectorAll('.nm-pin'), function (p) { return pinHost(p) === host; }); }
  function placeCards(C, pts, sizes) {
    var placed = [], res = [], gap = 64;
    var marks = pts.map(function (p) { return { x: p.x - 34, y: p.y - 34, w: 68, h: 68 }; });
    pts.forEach(function (p, i) {
      var w = sizes[i].w, hh = sizes[i].h, cands = [], best = null, bs = 1e12;
      [C.x - gap - w, C.x + C.w + gap].forEach(function (x) {
        [0, -1, 1, -2, 2, -3, 3, -4, 4].forEach(function (k) { cands.push({ x: x, y: p.y - hh / 2 + k * (hh / 2 + 10), g: 1 }); });
      });
      [C.y - gap - hh, C.y + C.h + gap].forEach(function (y) {
        [0, -1, 1, -2, 2].forEach(function (k) { cands.push({ x: p.x - w / 2 + k * (w / 2 + 10), y: y, g: 1 }); });
      });
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) {
        [70, 130, 210].forEach(function (dist) {
          cands.push({ x: d[0] > 0 ? p.x + dist : d[0] < 0 ? p.x - dist - w : p.x - w / 2, y: d[1] > 0 ? p.y + dist : d[1] < 0 ? p.y - dist - hh : p.y - hh / 2 });
        });
      });
      cands.forEach(function (c) {
        var r = { x: c.x, y: c.y, w: w, h: hh };
        if (!inSafe(r)) return;
        var sc = 0;
        placed.forEach(function (q) { sc += 80 * ovl(r, inflate(q, 16)) / (w * hh); });
        marks.forEach(function (q) { sc += 40 * ovl(r, q) / (68 * 68); });
        sc += 5 * ovl(r, C) / (w * hh);
        var n = nearest(r, p); sc += Math.hypot(n.x - p.x, n.y - p.y) / 140;
        if (sc < bs) { bs = sc; best = r; }
      });
      if (!best) best = clampSafe({ x: p.x + 60, y: p.y - hh / 2, w: w, h: hh });
      placed.push(best); res.push(best);
    });
    return res;
  }
  function pinLeader(p, r) {
    var cx = r.x + r.w / 2;
    if (p.x <= r.x || p.x >= r.x + r.w) {
      var leftSide = p.x < r.x, ex = leftSide ? r.x : r.x + r.w, ey = Math.max(r.y + 30, Math.min(r.y + r.h - 30, p.y));
      var kx = ex + (leftSide ? -30 : 30);
      return { a: p, b: { x: ex, y: ey }, elbow: { x: kx, y: ey }, side: leftSide ? 'left' : 'right' };
    }
    var up = p.y < r.y, eyy = up ? r.y : r.y + r.h, exx = Math.max(r.x + 30, Math.min(r.x + r.w - 30, p.x));
    void cx;
    return { a: p, b: { x: exx, y: eyy }, elbow: { x: exx, y: eyy + (up ? -30 : 30) }, side: up ? 'top' : 'bottom' };
  }
  function trimFrom(a, b, d) { var l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: a.x + (b.x - a.x) * d / l, y: a.y + (b.y - a.y) * d / l }; }
  IMPL.pins = {
    owns: null,
    open: function (S) {
      var host = pinHost(S.el); S.host = host; S.el = host;
      S.owns = function (e) { return e === host || pinHost(e) === host; };
      var C = rest(host), pins = pinList(host);
      S.C = C;
      buildVeil(S, 'nmf-veil-soft');
      var g = inflate(C, 10); g.r = radiusOf(host, C) + 10; setGeo(S.hole, g);
      S.tween(S.veil, { opacity: '1' }, { from: { opacity: '0' }, dur: 560 });
      var pts = pins.map(function (p) { return { x: C.x + num(p.getAttribute('data-x'), 50) / 100 * C.w, y: C.y + num(p.getAttribute('data-y'), 50) / 100 * C.h }; });
      var cw = num(host.getAttribute('data-pin-width'), 360);
      var cards = pins.map(function (p, i) {
        var c = h('div', 'nmf-card', S.root); c.style.width = px(cw);
        var badge = h('span', 'nmf-card-n', c); badge.textContent = digits(i + 1, host);
        var tx = h('div', 'nmf-card-t', c);
        var t = h('div', 'nmf-card-title', tx); t.textContent = p.getAttribute('data-label') || '';
        var body = (p.textContent || '').trim();
        if (body) { var b = h('div', 'nmf-card-body', tx); b.textContent = body; }
        c.style.visibility = 'hidden';
        return c;
      });
      var sizes = cards.map(function (c) { return { w: cw, h: c.offsetHeight }; });
      var spots = placeCards(C, pts, sizes);
      var svg = S.svg();
      S.items = pins.map(function (p, i) {
        var r = spots[i], c = cards[i], L = pinLeader(pts[i], r);
        c.style.visibility = ''; c.style.transform = 'translate(' + px(r.x) + ',' + px(r.y) + ')';
        c.classList.add('nmf-card-' + L.side);
        var a = trimFrom(L.a, L.elbow, 26);
        var path = s('path', { d: 'M' + a.x + ' ' + a.y + ' L' + L.elbow.x + ' ' + L.elbow.y + ' L' + L.b.x + ' ' + L.b.y, pathLength: 1, class: 'nmf-pin-line' }, svg);
        var end = s('circle', { cx: L.b.x, cy: L.b.y, r: 4.5, class: 'nmf-leader-dot nmf-end' }, svg);
        var mk = h('div', 'nmf-pin', S.root);
        mk.style.left = px(pts[i].x); mk.style.top = px(pts[i].y);
        var ripple = h('span', 'nmf-pin-ripple', mk), dot = h('span', 'nmf-pin-dot', mk), n = h('b', '', dot);
        n.textContent = digits(i + 1, host);
        [c, path, end, mk].forEach(function (e) { e.style.opacity = '0'; });
        return { card: c, path: path, end: end, mk: mk, dot: dot, n: n, ripple: ripple, state: 'hidden' };
      });
      S.idx = -1;
      var all = host.getAttribute('data-pins') === 'all' || S.manual;
      IMPL.pins.setIndex(S, all ? pins.length - 1 : S.pinEl ? pins.indexOf(S.pinEl) : 0 /* host step = pin 0 */, all);
    },
    setIndex: function (S, i, all) {
      S.idx = i;
      S.items.forEach(function (it, j) {
        var want = j > i ? 'hidden' : all || j === i ? 'current' : 'past';
        if (want === it.state) return;
        var was = it.state; it.state = want;
        var dl = all ? j * 140 : 0;
        if (want === 'hidden') { fadeOut(S, [it.card, it.path, it.end, it.mk], 220); return; }
        if (was === 'hidden') {
          S.tween(it.mk, { opacity: '1' }, { from: { opacity: '0' }, dur: 120, delay: dl });
          S.tween(it.dot, { transform: 'translateY(0px) scale(1)' }, { from: { transform: 'translateY(-80px) scale(.3)' }, dur: 760, delay: dl, ease: ease('springBouncy') });
          S.tween(it.ripple, { transform: 'scale(2.6)', opacity: '0' }, { from: { transform: 'scale(.6)', opacity: '.7' }, dur: 900, delay: dl + 320, ease: ease('enter') });
          S.tween(it.path, { opacity: '1', strokeDashoffset: '0' }, { from: { opacity: '1', strokeDashoffset: '1' }, dur: 560, delay: dl + 260, ease: ease('emphasized') });
          S.tween(it.end, { opacity: '1' }, { from: { opacity: '0' }, dur: 200, delay: dl + 700 });
          var sx = it.card.classList.contains('nmf-card-left') ? -18 : it.card.classList.contains('nmf-card-right') ? 18 : 0;
          var sy = it.card.classList.contains('nmf-card-top') ? -14 : it.card.classList.contains('nmf-card-bottom') ? 14 : 0;
          S.tween(it.card, { opacity: '1', translate: '0px 0px' }, { from: { opacity: '0', translate: px(sx) + ' ' + px(sy) }, dur: 600, delay: dl + 520, ease: ease('enter') });
        }
        if (want === 'past') {
          S.tween(it.dot, { transform: 'translateY(0px) scale(.42)' }, { dur: 520, ease: ease('spring') });
          S.tween(it.n, { opacity: '0' }, { dur: 160 });
          S.tween(it.card, { opacity: '.5', translate: '0px 0px' }, { dur: 420 });
          S.tween(it.path, { opacity: '.35', strokeDashoffset: '0' }, { dur: 420 });
        } else if (was === 'past') {
          S.tween(it.dot, { transform: 'translateY(0px) scale(1)' }, { dur: 560, ease: ease('springBouncy') });
          S.tween(it.n, { opacity: '1' }, { dur: 260, delay: 120 });
          S.tween(it.card, { opacity: '1', translate: '0px 0px' }, { dur: 420 });
          S.tween(it.path, { opacity: '1', strokeDashoffset: '0' }, { dur: 420 });
        }
      });
    },
    cont: function (S, el) {
      if (S.closed || !S.owns(el)) return false;
      var pins = pinList(S.host);
      IMPL.pins.setIndex(S, el === S.host ? 0 : pins.indexOf(el), false);
      return true;
    },
    close: function (S) {
      var list = [S.tween(S.veil, { opacity: '0' }, { dur: 480 })];
      S.items.forEach(function (it) { list = list.concat(fadeOut(S, [it.card, it.path, it.end], 260)); list.push(S.tween(it.dot, { transform: 'translateY(0px) scale(0)' }, { dur: 360, ease: ease('exit') })); });
      return S.settled(list);
    }
  };
  /* auto-expand: a pins container with k pins and no per-pin steps occupies k steps */
  function setupPins(slide) {
    var changed = false;
    Array.prototype.forEach.call(slide.querySelectorAll('[data-act="pins"][data-step]'), function (host) {
      if (host.classList.contains('nm-pin') || host.getAttribute('data-pins') === 'all') return;
      var pins = pinList(host);
      if (pins.length < 2 || pins.some(function (p) { return p.hasAttribute('data-step'); })) return;
      var n = +host.getAttribute('data-step'), k = pins.length - 1;
      Array.prototype.forEach.call(slide.querySelectorAll('[data-step]'), function (e) {
        var v = +e.getAttribute('data-step'); if (v > n) e.setAttribute('data-step', v + k);
      });
      pins.forEach(function (p, i) { if (i) { p.setAttribute('data-step', n + i); p.setAttribute('data-act', 'pins'); } });
      changed = true;
    });
    if (changed && deck && deck.refreshSteps) deck.refreshSteps(slide);
  }

  /* ------------------------------------------------------------------ slice */
  IMPL.slice = {
    open: function (S) {
      var el = S.el, R = rest(el), mode = attr(el, 'data-slice', 'below'), horiz = mode === 'below' || mode === 'above';
      var before = (mode === 'before') === S.rtl; /* true: cut on the physical right edge */
      var cut = mode === 'below' ? R.y + R.h + 24 : mode === 'above' ? R.y - 24 : before ? R.x + R.w + 24 : R.x - 24;
      cut = Math.max(40, Math.min((horiz ? H : W) - 40, cut));
      var strip = h('div', 'nmf-strip ' + (horiz ? 'nmf-strip-h' : 'nmf-strip-v'), S.root);
      strip.dir = S.rtl ? 'rtl' : 'ltr';
      var inner = h('div', 'nmf-strip-inner', strip), pages = detailPages(el);
      var pg = h('div', 'nmf-page', inner); if (pages[0]) pg.appendChild(pages[0]);
      S.pageEls = [pg];
      var size;
      if (horiz) { inner.style.width = px(Math.min(1500, W - 2 * M - 120)); size = Math.max(220, Math.min(640, inner.offsetHeight + 112)); }
      else { size = num(el.getAttribute('data-slice-size'), 640); inner.style.width = px(size - 112); }
      /* split the opening so the subject stays on stage */
      var a, b;
      if (horiz) {
        if (mode === 'below') { a = Math.min(size / 2, Math.max(0, R.y - M)); b = size - a; }
        else { b = Math.min(size / 2, Math.max(0, H - M - R.y - R.h)); a = size - b; }
      } else {
        var subjLow = before; /* cut on the subject's right edge: subject sits on the low-x half */
        if (subjLow) { a = Math.min(size / 2, Math.max(0, R.x - M)); b = size - a; } else { b = Math.min(size / 2, Math.max(0, W - M - R.x - R.w)); a = size - b; }
      }
      var gap = { x: horiz ? 0 : cut - a, y: horiz ? cut - a : 0, w: horiz ? W : size, h: horiz ? size : H };
      strip.style.transform = 'translate(' + px(gap.x) + ',' + px(gap.y) + ')';
      strip.style.width = px(gap.w); strip.style.height = px(gap.h);
      S.halves = [0, 1].map(function (i) {
        var wrap = h('div', 'nmf-half nmf-half-' + (horiz ? (i ? 'b' : 't') : (i ? 'r' : 'l')), S.root);
        var c = cloneSlide(S, null); wrap.appendChild(c.shell);
        c.shell.style.clipPath = horiz ? (i ? 'inset(' + px(cut) + ' 0px 0px 0px)' : 'inset(0px 0px ' + px(H - cut) + ' 0px)')
          : (i ? 'inset(0px 0px 0px ' + px(cut) + ')' : 'inset(0px ' + px(W - cut) + ' 0px 0px)');
        return wrap;
      });
      S.tween(S.rig, { opacity: '0' }, { from: { opacity: '0' }, dur: 0 });
      var line = h('div', 'nmf-cut ' + (horiz ? 'nmf-cut-h' : 'nmf-cut-v'), S.root);
      line.style.transform = 'translate(' + px(horiz ? M : cut - 1) + ',' + px(horiz ? cut - 1 : M) + ')';
      line.style.transformOrigin = horiz ? (S.rtl ? '100% 50%' : '0% 50%') : '50% 0%';
      S.line = line;
      S.tween(line, { scale: horiz ? '1 1' : '1 1', opacity: '1' }, { from: { scale: horiz ? '0 1' : '1 0', opacity: '1' }, dur: 360, ease: ease('emphasized') });
      S.tween(line, { opacity: '0' }, { from: { opacity: '1' }, dur: 260, delay: 520 });
      S.ab = { a: a, b: b, horiz: horiz };
      var mv = function (v) { return horiz ? 'translate(0px,' + px(v) + ')' : 'translate(' + px(v) + ',0px)'; };
      S.tween(S.halves[0], { transform: mv(-a) }, { from: { transform: mv(0) }, dur: 820, delay: 300, ease: ease('emphasized') });
      S.tween(S.halves[1], { transform: mv(b) }, { from: { transform: mv(0) }, dur: 820, delay: 300, ease: ease('emphasized') });
      S.tween(strip, { opacity: '1' }, { from: { opacity: '0' }, dur: 200, delay: 300 });
      stagger(S, pg, 620);
    },
    close: function (S) {
      var horiz = S.ab.horiz, mv = function (v) { return horiz ? 'translate(0px,' + px(v) + ')' : 'translate(' + px(v) + ',0px)'; };
      var list = [S.tween(S.pageEls[0], { opacity: '0' }, { dur: 200 })];
      list.push(S.tween(S.halves[0], { transform: mv(0) }, { dur: 640, delay: 80, ease: ease('emphasized') }));
      list.push(S.tween(S.halves[1], { transform: mv(0) }, { dur: 640, delay: 80, ease: ease('emphasized') }));
      return S.settled(list);
    }
  };

  /* --------------------------------------------------------------- binding */
  function actOf(el) { var a = el.getAttribute('data-act'); return IMPL[a] ? a : null; }
  function curSlide() { return deck && deck.slides ? deck.slides[deck.index] : document.querySelector('.slide.active'); }
  function keyDir(e) {
    var rtl = isRtl(document.body);
    if (['ArrowDown', 'PageDown', ' ', rtl ? 'ArrowLeft' : 'ArrowRight'].indexOf(e.key) >= 0) return 1;
    if (['ArrowUp', 'PageUp', rtl ? 'ArrowRight' : 'ArrowLeft'].indexOf(e.key) >= 0) return -1;
    return 0;
  }
  function onKey(e) {
    var S = active;
    if (!S || S.closed || e.defaultPrevented && e.key !== 'Escape') return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeSession(S, false); return; }
    var d = keyDir(e);
    if (!d || e.shiftKey) return;
    if (S.pageEls && S.pageEls.length > 1 && pageTo(S, S.page + d)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (S.manual) { e.preventDefault(); e.stopImmediatePropagation(); closeSession(S, false); }
  }
  function onClick(e) {
    if (!deck || e.button) return;
    var t = e.target, S = active;
    var st = stageEl();
    if (!st || !st.contains(t)) return;
    if (S && !S.closed) {
      if (S.root.contains(t)) return;              /* panels and buttons */
      e.preventDefault(); e.stopImmediatePropagation();
      closeSession(S, false);
      return;
    }
    var slide = curSlide();
    if (!slide || !slide.contains(t) || document.body.classList.contains('nm-overview')) return;
    var el = t.closest('[data-act]');
    while (el && slide.contains(el) && !actOf(el)) el = el.parentElement && el.parentElement.closest('[data-act]');
    if (!el || !slide.contains(el) || !actOf(el)) return;
    if (el.classList.contains('nm-pin')) el = pinHost(el);
    e.preventDefault(); e.stopImmediatePropagation();
    enterAct(actOf(el), el, { deck: deck, slide: slide, rig: rigOf(slide), step: 0, dir: 1, instant: false }, true);
  }

  Object.keys(IMPL).forEach(function (name) {
    NM.registerAct(name, {
      transient: true,
      enter: function (el, ctx) {
        if (name === 'pins') {
          var host = pinHost(el);
          if (active && !active.closed && active.act === 'pins' && active.host === host) return enterAct(name, el, ctx, false);
          if (active && !active.closed) closeSession(active, ctx && ctx.instant);
          var S = new Session('pins', host, ctx, false);
          S.pinEl = el === host ? null : el; active = S;
          var go = function () { if (S.closed) return; layer().appendChild(S.root); S.opened = true; IMPL.pins.open(S); };
          var w = settleCamera(S); if (w) w.then(go); else go();
          return;
        }
        enterAct(name, el, ctx, false);
      },
      exit: function (el, ctx) { exitAct(name, el, ctx); },
      reset: function (el) { if (active && active.act === name && owns(active, el)) closeSession(active, true); }
    });
  });

  NM.use({
    name: 'focus',
    init: function (d) {
      deck = d;
      Array.prototype.forEach.call(d.slides || document.querySelectorAll('.slide'), setupPins);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('click', onClick, true);
      var drop = function () { if (active) closeSession(active, true); };
      document.addEventListener('nm:beforeslidechange', drop);
      document.addEventListener('nm:step', function () { if (active && active.manual && !active.closed) closeSession(active, false); });
    }
  });

  /* test / authoring hooks */
  NM.focus = {
    open: function (el) { var a = actOf(el); return a ? enterAct(a, a === 'pins' ? pinHost(el) : el, { instant: false }, true) : null; },
    close: function (instant) { return active ? closeSession(active, instant) : Promise.resolve(); },
    get active() { return active ? { act: active.act, el: active.el, variant: active.variant } : null; }
  };
})();
