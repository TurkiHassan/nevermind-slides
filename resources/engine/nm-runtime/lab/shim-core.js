/* Nevermind Runtime v2 - minimal core shim for lab pages ONLY.
   Implements the subset of the contract (section 3/4) that plugins need for
   standalone testing: stage scaling, .slide.active, step timeline with
   registerAct, NM.geom, NM.layer, NM.ease/dur/animate/speed, camera, events.
   Never ship this in a deck: decks load nm-deck.js. */
(function () {
  'use strict';
  if (window.NM && window.NM.deck) return;
  var q = new URLSearchParams(location.search);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 1920, H = 1080;

  function spring(stiff, damp, n) {
    var w0 = Math.sqrt(stiff), z = damp / (2 * w0), wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
    var pts = [], T = 0;
    for (var t = 0; t < 10; t += 0.01) { // settle time
      var v = 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
      if (Math.abs(v - 1) > 0.002) T = t;
    }
    for (var i = 0; i <= n; i++) {
      var s = (i / n) * T;
      pts.push((1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + (z * w0 / wd) * Math.sin(wd * s))).toFixed(4));
    }
    pts[n] = '1';
    return 'linear(' + pts.join(', ') + ')';
  }

  var acts = {}, plugins = [], listeners = {}, ready = false;
  var NM = window.NM = window.NM || {};
  NM.version = 2;
  NM.speed = (q.get('nm-speed') === '0' || reduce) ? 0 : 1;
  NM.ease = {
    standard: 'cubic-bezier(.2,0,0,1)', emphasized: 'cubic-bezier(.3,0,0,1)',
    enter: 'cubic-bezier(0,0,0,1)', exit: 'cubic-bezier(.3,0,1,1)',
    spring: spring(170, 19, 40), springSoft: spring(120, 20, 40), springBouncy: spring(220, 14, 48)
  };
  NM.dur = { fast: 180, base: 320, slow: 560, morph: 720, camera: 820 };
  NM.animate = function (el, kf, opts) {
    opts = Object.assign({ fill: 'both' }, opts || {});
    if (!NM.speed) { opts.duration = 0; opts.delay = 0; }
    return el.animate(kf, opts);
  };
  NM.registerAct = function (name, def) { acts[name] = def; };
  NM.use = function (p) { plugins.push(p); if (ready) p.init(NM.deck); };
  NM.test = {
    settle: function () {
      return new Promise(function (res) {
        (function chk() {
          var busy = document.getAnimations().some(function (a) { return a.playState === 'running' || a.playState === 'pending'; });
          busy ? requestAnimationFrame(chk) : requestAnimationFrame(function () { res(); });
        })();
      });
    }
  };

  var stage, deck;
  NM.geom = {
    stageScale: function () { return stage ? (stage.getBoundingClientRect().width / W) || 1 : 1; },
    rectInStage: function (el) {
      var s = NM.geom.stageScale(), sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
      var x = (r.left - sr.left) / s, y = (r.top - sr.top) / s, w = r.width / s, h = r.height / s;
      var rig = el.closest('.camera-rig');
      if (rig) { // undo the camera transform (origin 0 0, translate+scale only)
        var m = new DOMMatrix(getComputedStyle(rig).transform === 'none' ? undefined : getComputedStyle(rig).transform);
        if (!m.isIdentity) { var k = m.a || 1; x = (x - m.e) / k; y = (y - m.f) / k; w /= k; h /= k; }
      }
      return { x: x, y: y, w: w, h: h };
    }
  };
  NM.layer = function (name) {
    var id = name === 'ghost' ? 'nmGhostLayer' : 'nmOverlayLayer', el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div'); el.id = id; el.className = 'nm-layer';
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:' + (name === 'ghost' ? 40 : 50);
      stage.appendChild(el);
    }
    return el;
  };

  function emit(name, detail) {
    (listeners[name] || []).forEach(function (f) { f(detail); });
    document.dispatchEvent(new CustomEvent('nm:' + name, { detail: detail }));
  }
  function fit() {
    var s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = 'translate(' + (innerWidth - W * s) / 2 + 'px,' + (innerHeight - H * s) / 2 + 'px) scale(' + s + ')';
  }
  function rigOf(slide) { return slide.querySelector(':scope > .camera-rig'); }
  function stepsOf(slide) {
    var set = {};
    slide.querySelectorAll('[data-step]').forEach(function (e) { var n = +e.getAttribute('data-step'); if (n >= 1) set[n] = 1; });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }
  function elsAt(slide, n) {
    return Array.prototype.filter.call(slide.querySelectorAll('[data-step]'), function (e) { return +e.getAttribute('data-step') === n; });
  }
  function ctxFor(slide, n, dir, instant) { return { deck: deck, slide: slide, rig: rigOf(slide), step: n, dir: dir, instant: !!instant }; }
  function runAct(kind, el, ctx) {
    var a = acts[el.getAttribute('data-act') || 'reveal'];
    if (a && a[kind]) a[kind](el, ctx);
  }
  function isTransient(el) { var a = acts[el.getAttribute('data-act') || 'reveal']; return a && a.transient; }

  function enterStep(i, dir, instant) {
    var slide = deck.slides[deck.index], list = deck._steps;
    if (deck.stepIndex > 0) {
      var cur = list[deck.stepIndex - 1];
      elsAt(slide, cur).forEach(function (e) {
        e.classList.remove('is-current');
        if (isTransient(e)) runAct('exit', e, ctxFor(slide, cur, dir, instant));
      });
      if (dir < 0) elsAt(slide, cur).forEach(function (e) { e.classList.remove('is-on'); if (!isTransient(e)) runAct('exit', e, ctxFor(slide, cur, dir, instant)); });
      elsAt(slide, cur).forEach(function (e) { if (!e.classList.length) e.removeAttribute('class'); });
    }
    deck.stepIndex = i;
    if (i > 0) {
      var n = list[i - 1];
      elsAt(slide, n).forEach(function (e) {
        e.classList.add('is-on', 'is-current');
        if (dir > 0 || isTransient(e)) runAct('enter', e, ctxFor(slide, n, dir, instant));
      });
    }
    emit('step', { slide: slide, step: i, dir: dir });
  }
  function resetSlide(slide) {
    var n = deck._steps[deck.stepIndex - 1];
    slide.querySelectorAll('[data-step]').forEach(function (e) {
      if (isTransient(e) && acts[e.getAttribute('data-act')].reset) acts[e.getAttribute('data-act')].reset(e, ctxFor(slide, n, 0, true));
      e.classList.remove('is-on', 'is-current');
      if (!e.classList.length) e.removeAttribute('class');
    });
  }
  function camAnimate(rig, to, dur) {
    var from = getComputedStyle(rig).transform;
    rig.style.transformOrigin = '0 0';
    var a = NM.animate(rig, [{ transform: from === 'none' ? 'none' : from }, { transform: to }], { duration: dur, easing: NM.ease.emphasized, fill: 'none' });
    rig.style.transform = to;
    return a.finished.catch(function () {});
  }

  function build() {
    stage = document.querySelector('.deck-stage') || document.getElementById('deckStage');
    var slides = Array.prototype.slice.call(stage.querySelectorAll(':scope > .slide'));
    slides.forEach(function (s) {
      if (!rigOf(s)) { var r = document.createElement('div'); r.className = 'camera-rig'; while (s.firstChild) r.appendChild(s.firstChild); s.appendChild(r); }
    });
    NM.layer('ghost'); NM.layer('overlay');
    deck = NM.deck = {
      slides: slides, index: 0, stepIndex: 0, mode: document.body.getAttribute('data-nm-mode') || 'morph-and-zoom', _steps: [],
      on: function (n, f) { (listeners[n] = listeners[n] || []).push(f); },
      refreshSteps: function (slide) { if (!slide || slide === slides[deck.index]) deck._steps = stepsOf(slides[deck.index]); },
      go: function (i, opts) {
        i = Math.max(0, Math.min(slides.length - 1, i));
        var from = deck.index, back = opts && opts.atEnd;
        emit('beforeslidechange', { from: from, to: i, slide: slides[i] });
        resetSlide(slides[from]); deck.camera.reset(true);
        slides[from].classList.remove('active', 'visible');
        deck.index = i; slides[i].classList.add('active', 'visible');
        deck._steps = stepsOf(slides[i]); deck.stepIndex = 0;
        if (back) for (var k = 1; k <= deck._steps.length; k++) enterStep(k, 1, true);
        emit('slidechange', { from: from, to: i, slide: slides[i] });
      },
      next: function (opts) {
        if (!(opts && opts.skipSteps) && deck.stepIndex < deck._steps.length) return enterStep(deck.stepIndex + 1, 1);
        if (deck.index < slides.length - 1) deck.go(deck.index + 1);
      },
      prev: function (opts) {
        if (!(opts && opts.skipSteps) && deck.stepIndex > 0) return enterStep(deck.stepIndex - 1, -1);
        if (deck.index > 0) deck.go(deck.index - 1, { atEnd: true });
      },
      camera: {
        zoomed: false,
        to: function (target, o) {
          o = o || {};
          var slide = slides[deck.index], rig = rigOf(slide);
          var r = target.nodeType ? NM.geom.rectInStage(target) : target, pad = o.pad == null ? 80 : o.pad;
          var k = Math.min(W / (r.w + 2 * pad), H / (r.h + 2 * pad), o.scale || 2.4);
          var tx = W / 2 - k * (r.x + r.w / 2), ty = H / 2 - k * (r.y + r.h / 2);
          deck.camera.zoomed = true;
          return camAnimate(rig, 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')', o.duration || NM.dur.camera);
        },
        reset: function (instant) {
          var rig = rigOf(slides[deck.index]);
          if (!deck.camera.zoomed) return Promise.resolve();
          deck.camera.zoomed = false;
          var p = camAnimate(rig, 'translate(0px,0px) scale(1)', instant === true ? 0 : NM.dur.camera);
          return p.then(function () {
            if (deck.camera.zoomed) return;
            rig.style.removeProperty('transform'); rig.style.removeProperty('transform-origin');
            if (!rig.getAttribute('style')) rig.removeAttribute('style');
          });
        }
      }
    };
    NM.registerAct('reveal', {
      enter: function (el, ctx) { NM.animate(el, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: ctx.instant ? 0 : NM.dur.slow, easing: NM.ease.enter, fill: 'none' }); },
      exit: function () {}
    });
    NM.registerAct('highlight', { transient: true, enter: function () {}, exit: function () {} });
    NM.registerAct('zoom', {
      transient: true,
      enter: function (el) { deck.camera.to(el, { pad: 120 }); },
      exit: function () { deck.camera.reset(); }, reset: function () { deck.camera.reset(true); }
    });
    var st = document.createElement('style');
    st.textContent = 'html,body{margin:0;height:100%;overflow:hidden;background:var(--stage-bg,#111)}' +
      '.deck-viewport{position:fixed;inset:0;overflow:hidden}' +
      '.deck-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;transform-origin:0 0;background:var(--nm-paper,#fff)}' +
      '.slide{position:absolute!important;inset:0;width:1920px;height:1080px;overflow:hidden;visibility:hidden;opacity:0;pointer-events:none;background:var(--nm-paper,#fff)}' +
      '.slide.active{visibility:visible;opacity:1;pointer-events:auto;z-index:1}' +
      '.camera-rig{position:absolute;inset:0}' +
      '.slide [data-step]:not([data-act]):not(.is-on),.slide [data-step][data-act="reveal"]:not(.is-on){opacity:0}';
    document.head.appendChild(st);
    fit(); addEventListener('resize', fit);
    var start = Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1);
    slides.forEach(function (s, i) { s.classList.toggle('active', i === start); s.classList.toggle('visible', i === start); });
    deck.index = start; deck._steps = stepsOf(slides[start]);
    document.addEventListener('keydown', function (e) {
      var rtl = (document.body.dir || document.documentElement.dir) === 'rtl';
      var fwd = ['ArrowDown', 'PageDown', ' ', rtl ? 'ArrowLeft' : 'ArrowRight'], back = ['ArrowUp', 'PageUp', rtl ? 'ArrowRight' : 'ArrowLeft'];
      if (fwd.indexOf(e.key) >= 0) { e.preventDefault(); deck.next({ skipSteps: e.shiftKey }); }
      else if (back.indexOf(e.key) >= 0) { e.preventDefault(); deck.prev({ skipSteps: e.shiftKey }); }
    });
    ready = true;
    plugins.forEach(function (p) { p.init(deck); });
    document.body.classList.add('nm-ready');
    emit('ready', { deck: deck });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
