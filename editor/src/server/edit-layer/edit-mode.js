// Edit layer (from spike S2b), injected as the first child of <head>, so it runs before any deck script.
// Exposes window.__nm inside the preview frame.
// S2b: the freeze now reaches same-origin child frames (rAF gate, CSS pause, WAAPI/SMIL pause, key swallow).
(function () {
  'use strict';
  var root = document.documentElement;
  var frozen = true;
  var warnings = [];
  var textSession = null;
  root.setAttribute('data-nm-edit', '');

  function warn(code) {
    if (warnings.indexOf(code) < 0) warnings.push(code);
  }

  // --- legacy localStorage editors -------------------------------------------------------------
  // The decks ship their own inline editors that restore saved edits with el.innerHTML = ... on load.
  // That rewrites text nodes behind the source model (children lose data-nm-key) and would show text that
  // is not in the file. Inside the preview, localStorage is an empty in-memory store, so the deck neither
  // reads old edits nor writes new ones into the user's browser storage.
  try {
    var mem = Object.create(null);
    var shim = {
      getItem: function (k) { return k in mem ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = Object.create(null); },
      key: function (i) { var ks = Object.keys(mem); return i < ks.length ? ks[i] : null; },
    };
    Object.defineProperty(shim, 'length', { get: function () { return Object.keys(mem).length; } });
    Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return shim; } });
  } catch (e) {
    warn('localstorage-shim-failed');
  }

  // --- requestAnimationFrame gate -------------------------------------------------------------
  // While frozen, callbacks are parked (not run); on unfreeze they are scheduled again.
  // One gate per window: the deck window and every same-origin child frame.
  var gates = []; // every installed gate, so freeze(false) can release all of them
  function installGate(win) {
    if (win.__nmGate) return win.__nmGate;
    var nativeRAF = win.requestAnimationFrame.bind(win);
    var nativeCAF = win.cancelAnimationFrame.bind(win);
    var seq = 0;
    var live = new Map(); // our id -> native id
    var parked = new Map(); // our id -> callback
    function schedule(id, cb) {
      var nid = nativeRAF(function (t) {
        live.delete(id);
        if (frozen) {
          parked.set(id, cb);
          return;
        }
        cb(t);
      });
      live.set(id, nid);
    }
    win.requestAnimationFrame = function (cb) {
      var id = ++seq;
      if (frozen) parked.set(id, cb);
      else schedule(id, cb);
      return id;
    };
    win.cancelAnimationFrame = function (id) {
      if (live.has(id)) {
        nativeCAF(live.get(id));
        live.delete(id);
      }
      parked.delete(id);
    };
    var gate = {
      win: win,
      release: function () {
        var items = Array.from(parked.entries());
        parked.clear();
        items.forEach(function (kv) {
          schedule(kv[0], kv[1]);
        });
      },
      parkedCount: function () {
        return parked.size;
      },
    };
    win.__nmGate = gate;
    gates.push(gate);
    return gate;
  }
  var rootGate = installGate(window);

  // --- input swallowing -----------------------------------------------------------------------
  // Capture phase on window, registered before any deck listener. Propagation stops while frozen;
  // the default action is kept inside contenteditable so a text session can still type.
  function swallow(e) {
    if (!frozen) return;
    var inSession = textSession && (e.target === textSession.el || textSession.el.contains(e.target));
    if (inSession && e.type === 'keydown') {
      var mod = e.ctrlKey || e.metaKey;
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        dispatchTextCommand(endText(false), false);
        return;
      }
      if (mod && (e.code === 'Enter' || e.code === 'KeyS')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dispatchTextCommand(endText(true), e.code === 'KeyS');
        return;
      }
    }
    e.stopImmediatePropagation();
    var t = e.target;
    if (!(t && t.isContentEditable)) e.preventDefault();
  }
  var SWALLOWED = ['keydown', 'keyup', 'click', 'dblclick', 'wheel'];
  function swallowOn(win) {
    SWALLOWED.forEach(function (type) {
      win.addEventListener(type, swallow, { capture: true, passive: false });
    });
  }
  swallowOn(window);

  // Capture before deck-owned [data-edit] listeners. Default editing and native undo still run.
  window.addEventListener('input', function (e) {
    if (textSession && (e.target === textSession.el || textSession.el.contains(e.target))) e.stopImmediatePropagation();
  }, true);
  window.addEventListener('paste', function (e) {
    if (!textSession || !(e.target === textSession.el || textSession.el.contains(e.target))) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var text = e.clipboardData ? e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n') : '';
    document.execCommand('insertText', false, text);
  }, true);

  // --- warnings -------------------------------------------------------------------------------
  window.addEventListener(
    'error',
    function (e) {
      var t = e.target;
      if (t && t.tagName === 'SCRIPT' && t.src) {
        if (/cdn\.tailwindcss\.com/.test(t.src)) warn('tailwind-cdn-unreachable');
        else if (/tailwind/i.test(t.src)) warn('tailwind-script-failed');
        else warn('script-failed:' + t.src);
      }
    },
    true,
  );

  // --- same-origin child frames ---------------------------------------------------------------
  // Present at load or added later. A child gets: rAF gate, a pause stylesheet, key swallowing.
  // Cross-origin frames cannot be reached: they raise a warning instead.
  var CHILD_CSS =
    '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' +
    'html{pointer-events:none!important}'; // child pointer handlers (hover steering) must not fire in edit mode
  var childDocs = []; // { doc, style }
  var watched = new WeakSet(); // iframe elements we already hook

  function patchChildDoc(iframe) {
    var win, doc;
    try {
      win = iframe.contentWindow;
      doc = iframe.contentDocument;
    } catch (e) {
      doc = null;
    }
    if (!win || !doc) {
      warn('cross-origin-frame:' + (iframe.getAttribute('src') || ''));
      return;
    }
    if (win.__nmGate) return; // this window object is already patched
    if (!doc.documentElement) return; // document not created yet
    if (doc.URL === 'about:blank' && iframe.getAttribute('src')) return; // navigation not committed yet
    installGate(win);
    swallowOn(win);
    var style = doc.createElement('style');
    style.id = 'nm-edit-child-css';
    style.textContent = CHILD_CSS;
    style.media = frozen ? 'all' : 'not all';
    (doc.head || doc.documentElement).appendChild(style);
    childDocs.push({ doc: doc, style: style });
    if (frozen) pauseScriptAnimations(doc);
    applyAnatomyOverrides(iframe, doc);
    watchFrames(doc); // frames inside the child
  }

  // CSS custom properties do not inherit through an iframe boundary. Persist overrides on the iframe host, then
  // mirror them onto declarations inside the same-origin anatomy document for an immediate, source-backed preview.
  function applyAnatomyOverrides(iframe, doc) {
    if (!iframe || !doc) return;
    var names = [];
    for (var i = 0; i < iframe.style.length; i++) if (/^--anatomy-/.test(iframe.style[i])) names.push(iframe.style[i]);
    if (!names.length) return;
    var targets = Array.prototype.slice.call(doc.querySelectorAll('[style]')).filter(function (el) {
      return names.some(function (name) { return el.style.getPropertyValue(name); });
    });
    if (!targets.length && doc.documentElement) targets.push(doc.documentElement);
    targets.forEach(function (target) {
      names.forEach(function (name) { target.style.setProperty(name, iframe.style.getPropertyValue(name)); });
    });
  }

  function hookFrame(iframe) {
    if (watched.has(iframe)) return;
    watched.add(iframe);
    iframe.addEventListener('load', function () {
      patchChildDoc(iframe);
    });
    patchChildDoc(iframe); // already loaded (or in-flight): no-op until its document is committed
    // Earlier hook: poll for the moment the new document exists, before its scripts have all run.
    var tries = 0;
    (function poll() {
      var w;
      try {
        w = iframe.contentWindow;
        if (w && w.__nmGate) return;
        if (w && w.document && w.document.URL !== 'about:blank' && w.document.readyState === 'loading') {
          patchChildDoc(iframe);
          if (w.__nmGate) return;
        }
      } catch (e) {
        return;
      }
      if (++tries < 400) setTimeout(poll, 0);
    })();
  }

  function watchFrames(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('iframe'), hookFrame);
    var mo = new (doc.defaultView.MutationObserver || MutationObserver)(function (list) {
      list.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'IFRAME') hookFrame(n);
          else if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('iframe'), hookFrame);
        });
      });
    });
    mo.observe(doc, { childList: true, subtree: true });
  }
  watchFrames(document);

  // --- script-driven animations (WAAPI, SMIL) -------------------------------------------------
  var pausedByUs = [];
  function pauseScriptAnimations(doc) {
    // Script-driven Web Animations (el.animate) are not covered by the CSS rule.
    doc.getAnimations().forEach(function (a) {
      var w = doc.defaultView;
      var css = (typeof w.CSSAnimation !== 'undefined' && a instanceof w.CSSAnimation) ||
        (typeof w.CSSTransition !== 'undefined' && a instanceof w.CSSTransition);
      if (!css && a.playState === 'running') {
        a.pause();
        pausedByUs.push(a);
      }
    });
    Array.prototype.forEach.call(doc.querySelectorAll('svg'), function (s) {
      if (s.pauseAnimations && !s.animationsPaused()) {
        s.pauseAnimations();
        pausedByUs.push({ play: function () { s.unpauseAnimations(); } });
      }
    });
  }

  // --- slides ---------------------------------------------------------------------------------
  function slides() {
    return Array.prototype.slice.call(document.querySelectorAll('.slide'));
  }
  // Sets data-nm-current, and mirrors the deck's own state classes so deck CSS keyed on
  // .slide.active / .slide.visible (bars, image zoom, reveal variants) shows its final state too.
  function goTo(i) {
    var before = document.querySelector('.slide[data-nm-current]');
    var beforeRects = {};
    if (before) Array.prototype.forEach.call(before.querySelectorAll('[data-morph]'), function (el) {
      beforeRects[el.getAttribute('data-morph')] = el.getBoundingClientRect();
    });
    slides().forEach(function (s, k) {
      var on = k === i;
      if (on) s.setAttribute('data-nm-current', '');
      else s.removeAttribute('data-nm-current');
      s.classList.toggle('active', on);
      s.classList.toggle('visible', on);
    });
    var after = slides()[i];
    if (after && before !== after) Array.prototype.forEach.call(after.querySelectorAll('[data-morph]'), function (el) {
      var from = beforeRects[el.getAttribute('data-morph')];
      if (!from || typeof el.animate !== 'function') return;
      var to = el.getBoundingClientRect();
      var sx = to.width ? from.width / to.width : 1;
      var sy = to.height ? from.height / to.height : 1;
      el.animate([
        { transformOrigin: 'top left', transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + sx + ',' + sy + ')', opacity: 0.55 },
        { transformOrigin: 'top left', transform: 'none', opacity: 1 },
      ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  function resetMotion() {
    slides().forEach(function (slide) {
      slide.removeAttribute('data-nm-motion-preview');
      slide.classList.remove('is-camera-zoomed');
      Array.prototype.forEach.call(slide.querySelectorAll('.zoom-focused'), function (el) { el.classList.remove('zoom-focused'); });
    });
  }

  function previewEntrance(slideIndex) {
    resetMotion();
    goTo(slideIndex);
    var slide = slides()[slideIndex];
    if (!slide) return;
    var items = Array.prototype.slice.call(slide.querySelectorAll('[data-entrance], .reveal'));
    items.sort(function (a, b) {
      return Number(a.getAttribute('data-entrance-order') || ((a.className || '').match(/\bd(\d+)\b/) || [0, 1])[1]) -
        Number(b.getAttribute('data-entrance-order') || ((b.className || '').match(/\bd(\d+)\b/) || [0, 1])[1]);
    });
    items.forEach(function (el, index) {
      if (typeof el.animate !== 'function') return;
      var kind = el.getAttribute('data-entrance') || 'reveal';
      var first = { opacity: 0, transform: kind === 'scale' ? 'scale(.88)' : kind === 'slide-right' ? 'translateX(70px)' : kind === 'fade' ? 'none' : 'translateY(48px)' };
      el.animate([first, { opacity: 1, transform: 'none' }], {
        duration: 480,
        delay: Number(el.getAttribute('data-entrance-delay') || index * 120),
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'both',
      });
    });
  }

  function previewZoom(slideIndex, step) {
    resetMotion();
    goTo(slideIndex);
    var slide = slides()[slideIndex];
    if (!slide) return;
    slide.setAttribute('data-nm-motion-preview', 'zoom');
    slide.classList.add('is-camera-zoomed');
    var target = slide.querySelector('[data-zoom-step="' + Number(step) + '"]');
    if (target) target.classList.add('zoom-focused');
  }

  function freeze(on) {
    frozen = !!on;
    if (frozen) {
      root.setAttribute('data-nm-edit', '');
      pauseScriptAnimations(document);
      childDocs.forEach(function (c) {
        c.style.media = 'all';
        pauseScriptAnimations(c.doc);
      });
    } else {
      root.removeAttribute('data-nm-edit');
      childDocs.forEach(function (c) {
        c.style.media = 'not all';
      });
      pausedByUs.forEach(function (a) {
        a.play();
      });
      pausedByUs = [];
      gates.forEach(function (g) {
        g.release();
      });
    }
  }

  // --- plaintext text sessions ---------------------------------------------------------------
  function keyedElement(key) {
    return document.querySelector('[data-nm-key="' + String(key).replace(/[^a-z0-9]/gi, '') + '"]');
  }

  function editableText(el) {
    if (!el || /^(IMG|SVG|IFRAME|VIDEO|CANVAS|PICTURE|SCRIPT|STYLE)$/.test(el.tagName)) return false;
    return (el.textContent || '').trim().length > 0;
  }

  function textNodes(el) {
    var out = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function normaliseBegin(el) {
    var nodes = textNodes(el);
    nodes.forEach(function (n) { n.data = n.data.replace(/\s+/g, ' '); });
    if (nodes.length) {
      nodes[0].data = nodes[0].data.replace(/^\s+/, '');
      nodes[nodes.length - 1].data = nodes[nodes.length - 1].data.replace(/\s+$/, '');
    }
  }

  function sessionText(el) {
    function lineContainer(n) {
      return n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName);
    }
    function read(n) {
      if (n.nodeType === 3) return n.data;
      if (n.nodeType !== 1) return '';
      if (n.tagName === 'BR') return '\n';
      var s = '';
      var previousWasLine = false;
      Array.prototype.forEach.call(n.childNodes, function (c) {
        var isLine = lineContainer(c);
        // Chromium represents Enter in plaintext-only contenteditable as sibling DIVs (and, depending on the
        // edit shape, text followed by a DIV). textContent omits those visual line boundaries, so preserve them
        // explicitly just as we preserve BR. Existing inline spans remain contiguous.
        if ((isLine || previousWasLine) && s && s.charAt(s.length - 1) !== '\n') s += '\n';
        s += read(c);
        previousWasLine = isLine;
      });
      return s;
    }
    return read(el).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\n$/, '');
  }

  function placeCaretEnd(el) {
    var sel = window.getSelection();
    if (!sel) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function beginText(key) {
    if (textSession && textSession.key === key) return { key: key, text: sessionText(textSession.el) };
    if (textSession) endText(true);
    var el = keyedElement(key);
    if (!editableText(el)) return null;
    var prior = el.getAttribute('contenteditable');
    var priorSpellcheck = el.getAttribute('spellcheck');
    var original = el.innerHTML;
    normaliseBegin(el);
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('spellcheck', 'true');
    el.setAttribute('data-nm-text-session', '');
    textSession = { key: key, el: el, original: original, originalText: sessionText(el), prior: prior, priorSpellcheck: priorSpellcheck };
    el.focus({ preventScroll: true });
    placeCaretEnd(el);
    return { key: key, text: sessionText(el) };
  }

  function restoreSessionAttrs(s) {
    if (s.prior === null) s.el.removeAttribute('contenteditable');
    else s.el.setAttribute('contenteditable', s.prior);
    if (s.priorSpellcheck === null) s.el.removeAttribute('spellcheck');
    else s.el.setAttribute('spellcheck', s.priorSpellcheck);
    s.el.removeAttribute('data-nm-text-session');
  }

  function endText(commit) {
    if (!textSession) return null;
    var s = textSession;
    var text = sessionText(s.el);
    var changed = text !== s.originalText;
    if (!commit) s.el.innerHTML = s.original;
    restoreSessionAttrs(s);
    textSession = null;
    return { key: s.key, text: text, changed: !!commit && changed, cancelled: !commit };
  }

  function activeText() {
    return textSession ? { key: textSession.key, text: sessionText(textSession.el) } : null;
  }

  function dispatchTextCommand(result, save) {
    window.dispatchEvent(new CustomEvent('nm-text-command', { detail: { result: result, save: !!save } }));
  }

  // Hit-test in frame coordinates, limited to the current slide; runtime-created nodes resolve upward.
  function hitLocal(x, y) {
    var cur = document.querySelector('.slide[data-nm-current]');
    var els = document.elementsFromPoint(x, y);
    // Decoration the deck itself marks as inert (pointer-events-none, aria-hidden) is hit-testable, but only as a
    // last resort: a click on a picture should select the picture, not the ornament drawn over it.
    function inert(el) {
      for (var n = el; n && n !== cur && n.nodeType === 1; n = n.parentElement) {
        if (n.matches && n.matches('.pointer-events-none,[aria-hidden="true"]')) return true;
      }
      return false;
    }
    var firstChoice = els.filter(function (el) { return !inert(el); });
    els = firstChoice.length && firstChoice.some(function (el) { return (!cur || cur.contains(el)) && el.closest('[data-nm-key]'); }) ? firstChoice : els;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (cur && !cur.contains(el)) continue;
      var t = el.closest('[data-nm-key]');
      if (t) {
        var smart = t.closest('svg[data-anatomy],svg[class*="anatomy"],svg[style*="--anatomy-"],iframe[data-anatomy],iframe[class*="anatomy"],iframe[src*="anatomy"]');
        if (smart && smart.hasAttribute('data-nm-key')) t = smart;
        return { key: t.getAttribute('data-nm-key'), tag: t.tagName.toLowerCase() };
      }
    }
    return null;
  }

  // --- preview patches --------------------------------------------------------------------------
  // The server answers an op with { key, outerHTML, attrsOnly }[] for elements whose source changed. attrsOnly:
  // copy the attributes onto the live element and keep its children (iframes and running state are untouched).
  // Otherwise the element is replaced. Returns the keys that could not be found or parsed: the caller reloads.
  // State the edit layer owns on slides (data-nm-current, active, visible) is kept.
  function syncAttributes(el, fresh) {
    var isSlide = el.classList.contains('slide');
    var current = el.hasAttribute('data-nm-current');
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      if (a.name === 'data-nm-current') return;
      if (!fresh.hasAttribute(a.name)) el.removeAttribute(a.name);
    });
    Array.prototype.forEach.call(fresh.attributes, function (a) {
      if (a.name === 'data-nm-current') return;
      if (el.getAttribute(a.name) === a.value) return;
      if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, a.name, a.value);
      else el.setAttribute(a.name, a.value);
    });
    if (isSlide) {
      el.classList.toggle('active', current);
      el.classList.toggle('visible', current);
    }
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MATH_NS = 'http://www.w3.org/1998/Math/MathML';
  // Parse an outerHTML string in the namespace of the live element it replaces: the HTML parser puts <text> or
  // <path> in the HTML namespace (nothing renders) and lowercases viewBox unless it is inside <svg> / <math>.
  function parseLike(el, html) {
    var holder = document.createElement('template');
    var wrap = null;
    if (el.namespaceURI === SVG_NS && el.localName !== 'svg') wrap = 'svg';
    else if (el.namespaceURI === MATH_NS && el.localName !== 'math') wrap = 'math';
    holder.innerHTML = wrap ? '<' + wrap + '>' + html + '</' + wrap + '>' : html;
    var root = holder.content.firstElementChild;
    return wrap && root ? root.firstElementChild : root;
  }
  function applyPatch(patches) {
    var missing = [];
    patches.forEach(function (p) {
      var el = document.querySelector('[data-nm-key="' + String(p.key).replace(/[^a-z0-9]/g, '') + '"]');
      var fresh = el ? parseLike(el, p.outerHTML) : null;
      if (!el || !fresh) {
        missing.push(p.key);
        return;
      }
      if (p.attrsOnly) syncAttributes(el, fresh);
      else el.replaceWith(fresh);
      if (p.attrsOnly && el.tagName === 'IFRAME') applyAnatomyOverrides(el, el.contentDocument);
    });
    return missing;
  }

  window.__nm = {
    applyPatch: applyPatch,
    goTo: goTo,
    freeze: freeze,
    isFrozen: function () {
      return frozen;
    },
    slides: slides,
    hitLocal: hitLocal,
    beginText: beginText,
    endText: endText,
    activeText: activeText,
    previewEntrance: previewEntrance,
    previewZoom: previewZoom,
    resetMotion: resetMotion,
    warnings: warnings,
    parkedCount: function () {
      return rootGate.parkedCount();
    },
    childFrames: function () {
      return childDocs.length;
    },
  };
  // Cookbook runtime contract. Old decks receive it in preview without source changes; a deck-owned method wins.
  var runtime = window.deck && typeof window.deck === 'object' ? window.deck : {};
  if (typeof runtime.goTo !== 'function') runtime.goTo = goTo;
  if (typeof runtime.setEditMode !== 'function') runtime.setEditMode = function (on) { freeze(!!on); };
  if (!runtime.runtimeVersion) runtime.runtimeVersion = 1;
  window.deck = runtime;
})();
