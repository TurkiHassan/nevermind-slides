// The CSS and script appended to the portable document before Chrome captures it. They freeze motion, pick one slide
// (from the URL hash) or all slides, and, for the probe hash, write the measured text boxes into the DOM so the driver
// can read them from --dump-dom. The deck source is never changed; this exists only in the temporary capture file.

export const CAPTURE_CSS = `
*,*::before,*::after{transition:none!important;animation-delay:0s!important;animation-duration:.001s!important;animation-iteration-count:1!important;caret-color:transparent!important}
.reveal,[data-entrance]{opacity:1!important;transform:none!important}
.deck-controls,#counter,.deck-hud,.deck-progress,.nm-export-hide{display:none!important}
html.nm-export-single .slide:not(.active){visibility:hidden!important;opacity:0!important}
html.nm-export-single .slide.active{visibility:visible!important;opacity:1!important}
html.nm-export-notext .slide *:not(svg):not(svg *){color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}
html.nm-export-notext .slide svg text,html.nm-export-notext .slide svg tspan{fill:transparent!important;stroke:none!important}
@page{size:1920px 1080px;margin:0}
@media print{
  html,body{width:1920px!important;height:auto!important;margin:0!important;overflow:visible!important;background:none!important}
  .deck-viewport{position:static!important;width:auto!important;height:auto!important;overflow:visible!important}
  .deck-stage{position:static!important;width:auto!important;height:auto!important;transform:none!important}
  .slide{position:relative!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;width:1920px!important;height:1080px!important;break-after:page;page-break-after:always;break-inside:avoid}
  .slide:last-of-type{break-after:auto;page-break-after:auto}
}`.trim();

export const CAPTURE_JS = String.raw`
(function () {
  var hash = location.hash.replace(/^#/, '');
  var m = /(?:^|&)nm-slide=(\d+)/.exec(hash);
  var single = m ? parseInt(m[1], 10) - 1 : -1;
  var probe = /(?:^|&)nm-probe(?:&|$)/.test(hash);
  var notext = /(?:^|&)nm-notext(?:&|$)/.test(hash);
  var root = document.documentElement;
  if (notext) root.classList.add('nm-export-notext');
  function slides() { return Array.prototype.slice.call(document.querySelectorAll('.slide')); }
  function select(index) {
    slides().forEach(function (el, i) {
      var on = index < 0 ? true : i === index;
      el.classList.toggle('active', on);
      el.classList.toggle('visible', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }
  function apply() {
    if (single >= 0) { root.classList.add('nm-export-single'); select(single); }
    else if (!probe) { select(-1); }
  }
  function measure() {
    var out = [];
    slides().forEach(function (slide, i) {
      select(i);
      var base = slide.getBoundingClientRect();
      var walker = document.createTreeWalker(slide, NodeFilter.SHOW_ELEMENT);
      var el;
      while ((el = walker.nextNode())) {
        if (el.closest('svg') || /^(SCRIPT|STYLE|IFRAME|NOSCRIPT)$/.test(el.tagName)) continue;
        var own = '';
        for (var c = el.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) own += c.nodeValue;
          else if (c.nodeType === 1 && c.tagName === 'BR') own += '\n';
        }
        own = own.replace(/[ \t\r\f]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
        if (!own) continue;
        var cs = getComputedStyle(el);
        if (cs.display === 'none') continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        out.push({
          slide: i + 1, text: own,
          x: Math.round((r.left - base.left) * 100) / 100, y: Math.round((r.top - base.top) * 100) / 100,
          width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100,
          fontSize: parseFloat(cs.fontSize) || 32, color: cs.color,
          fontFamily: (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim(),
          bold: parseInt(cs.fontWeight, 10) >= 600, rtl: cs.direction === 'rtl' || /[؀-ۿ]/.test(own)
        });
      }
    });
    var tag = document.createElement('script');
    tag.type = 'application/json';
    tag.id = 'nm-geometry';
    tag.textContent = JSON.stringify(out).replace(/</g, '\\u003c');
    document.body.appendChild(tag);
  }
  apply();
  window.addEventListener('load', function () {
    apply();
    var done = function () { if (probe) measure(); else apply(); };
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () { setTimeout(function () { apply(); setTimeout(done, 300); }, 300); });
  });
})();`.trim();

/** Append the capture runtime to a self-contained deck document. */
export function withCaptureRuntime(html: string): string {
  const tail = `<style id="nm-export-css">${CAPTURE_CSS}</style><script id="nm-export-js">${CAPTURE_JS.replace(/<\/script/gi, '<\\/script')}</script>`;
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i, () => `${tail}</body>`) : `${html}${tail}`;
}
