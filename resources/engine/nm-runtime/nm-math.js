/*
 * nm-math.js - Nevermind Runtime v2: equations (roadmap NM-11).
 * Classic script, no dependencies, no network.
 *
 *   <math> ... </math>                 native MathML: the default; nothing to do here except data-term
 *   <span class="nm-math" data-tex="E = mc^2"></span>
 *                                      TeX, converted to MathML by Temml when the deck stages it
 *                                      (stage-runtime --math links assets/nm/vendor/temml.min.js before this file).
 *                                      data-display="block" for a display formula. The MathML it renders carries
 *                                      data-nm-generated="math" (runtime contract: generated markup, never saved).
 *                                      Without Temml the TeX is shown raw in a dashed box and a warning is logged;
 *                                      deck_check reports it as C-MATH.
 *   data-term="loss"                   on a MathML element (or \data{term=loss}{...} in TeX): the same term in the
 *                                      next slide's equation is a shared element, so it flies there with Morph.
 *                                      Implemented as data-morph="term-loss" when the element has no data-morph.
 */
(function () {
  'use strict';
  if (window.NM && window.NM.math) return;
  var doc = document;
  var MATHNS = 'http://www.w3.org/1998/Math/MathML';

  function $all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function warn(msg) { console.warn('[nm-math] ' + msg); }
  function converter() { return window.temml && typeof window.temml.render === 'function' ? window.temml : null; }

  var rendered = 0, failed = 0;
  function clearGenerated(host) { $all(':scope > [data-nm-generated="math"]', host).forEach(function (e) { e.remove(); }); }
  function renderTex(host) {
    var tex = host.getAttribute('data-tex');
    if (tex === null) return;
    clearGenerated(host);
    var block = (host.getAttribute('data-display') || '').toLowerCase() === 'block';
    var T = converter();
    if (T) {
      var holder = doc.createElement('span');
      try {
        T.render(tex, holder, {
          displayMode: block,
          throwOnError: true,
          // \data{term=x}{...} is the only command that may write attributes, and only the term key
          trust: function (ctx) {
            if (!ctx || ctx.command !== '\\data' || !ctx.attributes) return false;
            return Object.keys(ctx.attributes).every(function (k) { return k === 'data-term'; });
          }
        });
        var m = holder.querySelector('math');
        if (m) {
          m.setAttribute('data-nm-generated', 'math');
          host.appendChild(m);
          host.removeAttribute('data-nm-math-error');
          rendered++;
          return;
        }
      } catch (e) {
        warn('cannot convert TeX "' + tex.slice(0, 60) + '": ' + (e && e.message ? e.message.split('\n')[0] : e));
        host.setAttribute('data-nm-math-error', 'parse');
      }
    } else {
      host.setAttribute('data-nm-math-error', 'no-converter');
      warn('data-tex needs Temml: run deck_helper.py stage-runtime --math and link assets/nm/vendor/temml.min.js before nm-math.js');
    }
    failed++;
    var raw = doc.createElement('code');
    raw.className = 'nm-math-raw';
    raw.setAttribute('dir', 'ltr');
    raw.setAttribute('data-nm-generated', 'math');
    raw.textContent = tex;
    host.appendChild(raw);
  }

  /* data-term: a term shared by consecutive equations becomes a morph pair */
  function linkTerms(root) {
    $all('[data-term]', root).forEach(function (e) {
      var t = String(e.getAttribute('data-term') || '').trim();
      if (!t || e.hasAttribute('data-morph')) return;
      e.setAttribute('data-morph', 'term-' + t.replace(/\s+/g, '-'));
      e.setAttribute('data-nm-term-morph', '');
    });
  }

  /* an equation figure sets its formulas smaller (down to 36px) when the widest one does not fit across it */
  var MIN_EQ = 36;
  function fit(fig) {
    if (fig._nmHadStyle === undefined) fig._nmHadStyle = fig.hasAttribute('style');
    fig.style.removeProperty('--nm-eq-fit');
    if (!fig._nmHadStyle && fig.getAttribute('style') === '') fig.removeAttribute('style'); // author markup stays as written
    var avail = fig.clientWidth;
    if (!avail) return;
    var k = fig.getBoundingClientRect().width / (fig.offsetWidth || 1) || 1; // stage scale
    var notes = !!fig.querySelector('.nm-eq-note');
    var limit = avail * (notes ? 0.6 : 0.96);
    function widest() {
      var w = 0;
      $all('math', fig).forEach(function (m) { if (!m.parentElement.closest('math')) w = Math.max(w, m.getBoundingClientRect().width / k); });
      return w;
    }
    if (widest() <= limit) return;
    var size = Math.round(parseFloat(getComputedStyle(fig).fontSize) || 88);
    while (size > MIN_EQ && widest() > limit) { size -= 2; fig.style.setProperty('--nm-eq-fit', size + 'px'); }
    if (widest() > limit) warn((fig.getAttribute('data-id') || 'equation') + ': a formula is wider than its figure even at ' + MIN_EQ + 'px; break it over two lines');
  }
  function fitAll() { $all('.nm-equation').forEach(fit); }

  function scan(root) {
    root = root || doc;
    $all('[data-tex]', root).forEach(renderTex);
    linkTerms(root);
    $all('.nm-equation', root).forEach(fit);
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    scan(doc);
    if (doc.fonts && doc.fonts.ready) {
      var NMg = window.NM = window.NM || {};
      NMg.pending = (NMg.pending || 0) + 1; // settle() waits for the fit after webfonts load
      doc.fonts.ready.then(function () { fitAll(); NMg.pending--; }, function () { NMg.pending--; });
    }
  }

  var API = {
    version: 1,
    scan: scan,
    render: renderTex,
    refit: fitAll,
    get converter() { return converter() ? 'temml' : null; },
    get stats() { return { rendered: rendered, failed: failed }; },
    namespace: MATHNS
  };
  window.NM = window.NM || {};
  window.NM.math = API;

  if (typeof window.NM.use === 'function') window.NM.use({ name: 'math', init: start });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();
