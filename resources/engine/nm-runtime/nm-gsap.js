/*
 * nm-gsap.js - Nevermind Runtime v2: optional GSAP adapter (roadmap NM-17).
 * Classic script. It does NOT contain GSAP and loads nothing: it works only when the deck itself provides
 * window.gsap (GSAP is under GreenSock's own license, so the skill neither bundles nor recommends it by default).
 *
 *   <p data-step="1" data-act="gsap" data-gsap='{"from": {"x": 80, "opacity": 0}, "duration": 0.6, "ease": "power2.out"}'>
 *
 * Every element of one step with data-act="gsap" joins one gsap.timeline for that step; data-at (roadmap NM-14)
 * places it on the timeline (the core resolves "<", ">", "+=200", labels into ctx.at). Leaving the step kills the
 * timeline and clears only the properties the tween set. ?nm-speed=0, ?nm-print and reduced motion skip GSAP and
 * show the end state. Without window.gsap the element fades in with WAAPI and the console says so once.
 */
(function () {
  'use strict';
  if (window.NM && window.NM.gsap) return;
  var NM = window.NM = window.NM || {};
  var DEFAULT = { from: { opacity: 0, y: 24 }, duration: 0.6, ease: 'power2.out' };
  var lines = new Map();   // "slideIndex:step" -> { tl, els }
  var warned = false;

  function config(e) {
    var raw = e.getAttribute('data-gsap');
    if (!raw) return DEFAULT;
    try {
      var c = JSON.parse(raw);
      return { from: c.from || DEFAULT.from, duration: c.duration != null ? c.duration : DEFAULT.duration, ease: c.ease || DEFAULT.ease };
    } catch (err) {
      console.warn('[nm-gsap] data-gsap is not JSON: ' + raw.slice(0, 80));
      return DEFAULT;
    }
  }
  function keyOf(ctx) { return (ctx.deck && ctx.deck.slides ? ctx.deck.slides.indexOf(ctx.slide) : 0) + ':' + ctx.step; }
  function props(c) { return Object.keys(c.from).join(','); }
  /* core's data-at timer reads e._nmAnims to find when an element ends; give it the tween's span */
  function span(e, at, seconds) {
    e._nmAnims = [{ effect: { getTiming: function () { return { delay: at, duration: seconds * 1000 }; } } }];
  }

  function enter(e, ctx) {
    var c = config(e), at = ctx.at || 0;
    if (ctx.instant) return;
    var g = window.gsap;
    if (!g || typeof g.timeline !== 'function') {
      if (!warned) { warned = true; console.warn('[nm-gsap] window.gsap is not loaded: data-act="gsap" elements fade in instead. Load GSAP in the deck to use it.'); }
      if (NM.animate) e._nmAnims = [NM.animate(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: at, easing: 'ease-out', fill: 'backwards' })];
      return;
    }
    var key = keyOf(ctx), entry = lines.get(key);
    if (!entry || entry.done) {
      entry = { tl: g.timeline(), els: [] };
      lines.set(key, entry);
      // the timeline belongs to this pass through the step: the next frame closes it to new members
      requestAnimationFrame(function () { entry.done = true; });
    }
    entry.els.push(e);
    entry.tl.from(e, Object.assign({}, c.from, { duration: c.duration, ease: c.ease, immediateRender: true }), at / 1000);
    span(e, at, c.duration);
  }
  function leave(e, ctx) {
    var g = window.gsap, key = keyOf(ctx), entry = lines.get(key);
    if (entry) {
      if (entry.tl && entry.tl.kill) entry.tl.kill();
      lines.delete(key);
    }
    if (g && g.set) g.set(e, { clearProps: props(config(e)) });
    e._nmAnims = null;
  }

  function register() {
    if (typeof NM.registerAct !== 'function' || register.done) return;
    register.done = true;
    NM.registerAct('gsap', { enter: enter, exit: leave, reset: leave, transient: false });
  }
  NM.gsap = {
    version: 1,
    get available() { return !!(window.gsap && typeof window.gsap.timeline === 'function'); },
    get timelines() { return lines.size; }
  };
  register();
  if (typeof NM.use === 'function') NM.use({ name: 'gsap', init: register });
  document.addEventListener('nm:ready', register);
})();
