/*
 * nm-diagram.js - Nevermind Runtime v2: declarative diagrams, DOM connectors, small charts.
 * Classic script, no dependencies, no network. Works standalone; integrates with nm-deck.js
 * through data-step / data-act attributes, .is-on, .slide.active, data-morph and NM.use.
 */
(function () {
  'use strict';
  if (window.NM && window.NM.diagram) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var doc = document;
  var uid = 0;

  /* ------------------------------------------------------------------ utils */
  function $all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function h(tag, cls, parent) { var e = doc.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function sv(tag, attrs, parent) { var e = doc.createElementNS(SVGNS, tag); if (attrs) setA(e, attrs); if (parent) parent.appendChild(e); return e; }
  function setA(e, a) { for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); return e; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function warn(msg) { console.warn('[nm-diagram] ' + msg); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function speed() {
    if (window.NM && typeof window.NM.speed === 'number') return window.NM.speed;
    if (/[?&]nm-speed=0(\b|$)/.test(location.search)) return 0;
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 0; } catch (e) { /* noop */ }
    return 1;
  }
  function raf2(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }

  var AR_DIG = '٠١٢٣٤٥٦٧٨٩';
  var FA_DIG = '۰۱۲۳۴۵۶۷۸۹';
  function latinDigits(s) {
    return String(s).replace(/[٠-٩]/g, function (d) { return AR_DIG.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return FA_DIG.indexOf(d); });
  }
  function parseNum(s) {
    var t = latinDigits(s).replace(/٫/g, '.').replace(/[٬,\s]/g, '').replace(/−/g, '-');
    var m = t.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }
  function digitSystem(s) { return /[٠-٩]/.test(s) ? AR_DIG : /[۰-۹]/.test(s) ? FA_DIG : null; }
  function withDigits(str, digits) { return digits ? String(str).replace(/\d/g, function (d) { return digits[d]; }) : String(str); }
  /* Parse an authored number ("٨٧٪", "$1,200", "3.5x") into value + formatter that keeps its look. */
  function numFormat(str) {
    var s = String(str);
    var m = s.match(/[\d٠-٩۰-۹]+(?:[٬,][\d٠-٩۰-۹]{3})*(?:[.٫][\d٠-٩۰-۹]+)?/);
    if (!m) return null;
    var raw = m[0], pre = s.slice(0, m.index), post = s.slice(m.index + raw.length);
    var digits = digitSystem(raw);
    var decm = raw.match(/[.٫]([\d٠-٩۰-۹]+)$/);
    var decimals = decm ? decm[1].length : 0;
    var decSep = raw.indexOf('٫') >= 0 ? '٫' : '.';
    var thSep = raw.indexOf('٬') >= 0 ? '٬' : (raw.indexOf(',') >= 0 ? ',' : '');
    var value = parseNum(raw);
    if (/[-−]\s*$/.test(pre)) { value = -value; pre = pre.replace(/[-−]\s*$/, ''); }
    return {
      value: value,
      fmt: function (v) {
        var neg = v < 0; v = Math.abs(v);
        var parts = v.toFixed(decimals).split('.');
        var ip = parts[0];
        if (thSep) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, thSep);
        var out = ip + (parts[1] ? decSep + parts[1] : '');
        return pre + (neg ? '-' : '') + withDigits(out, digits) + post;
      }
    };
  }
  function niceStep(span, count) {
    var raw = span / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }

  /* ------------------------------------------------------------------ icons (24x24 line) */
  var ICONS = {
    database: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    server: '<rect x="4" y="4" width="16" height="7" rx="1.6"/><rect x="4" y="13" width="16" height="7" rx="1.6"/><path d="M8 7.5h.01M8 16.5h.01M12 7.5h4M12 16.5h4"/>',
    cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.6 4.5 4.5 0 0 0 7 18.5z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5a6.5 6.5 0 0 1 13 0"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14a6.5 6.5 0 0 1 4 5.5"/>',
    document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.5 2.6 3-.6.6 3 2.6 1.5-1.4 2.7 1.4 2.7-2.6 1.5-.6 3-3-.6L12 21.2l-1.5-2.6-3 .6-.6-3-2.6-1.5L5.7 12 4.3 9.3l2.6-1.5.6-3 3 .6z"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.4"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16.5v-5M12 16.5V7M17 16.5v-8"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".6"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.4-3.7-8.5S9.5 6.1 12 3.5z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
    layers: '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.2l8.5 4.5 8.5-4.5M3.5 16.2l8.5 4.5 8.5-4.5"/>',
    arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.7 5.7l1.2-1.2"/>'
  };
  function iconSvg(name, cls) {
    var body = ICONS[name];
    if (!body) { warn('unknown icon "' + name + '". Known: ' + Object.keys(ICONS).join(', ')); return ''; }
    return '<svg class="' + (cls || 'nm-dg-ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /* ------------------------------------------------------------------ parser */
  var TONES = { accent: 1, muted: 1, danger: 1, ok: 1, warn: 1, ghost: 1, strong: 1 };
  var GRAPH_TYPES = { flow: 1, tree: 1, cycle: 1, hub: 1, swimlane: 1, sequence: 1 };
  var OPS = ['<-.->', '<~>', '-.->', '<->', '-->', '->', '-.-', '---', '--', '~>', '=>'];
  var OPDEF = {
    '->': { arrow: 'end', style: 'solid' }, '-->': { arrow: 'end', style: 'solid' }, '=>': { arrow: 'end', style: 'thick' },
    '-.->': { arrow: 'end', style: 'dashed' }, '~>': { arrow: 'end', style: 'dashed' },
    '<->': { arrow: 'both', style: 'solid' }, '<-.->': { arrow: 'both', style: 'dashed' }, '<~>': { arrow: 'both', style: 'dashed' },
    '--': { arrow: 'none', style: 'solid' }, '---': { arrow: 'none', style: 'solid' }, '-.-': { arrow: 'none', style: 'dashed' }
  };
  var ID_CH = /[A-Za-z0-9_؀-ٟٮ-ۓە-ۿݐ-ݿࢠ-ࣿ]/;

  function Model() { this.nodes = []; this.byId = {}; this.edges = []; this.groups = []; this.lanes = []; this.items = []; this.opts = {}; this.series = []; this.errors = 0; this.auto = 0; }
  Model.prototype.node = function (id, props) {
    var n = this.byId[id];
    if (!n) { n = { id: id, label: null, sub: '', shape: null, tone: [], icon: null, idx: this.nodes.length }; this.byId[id] = n; this.nodes.push(n); }
    if (props) {
      if (props.label != null) n.label = props.label;
      if (props.sub) n.sub = props.sub;
      if (props.shape) n.shape = props.shape;
      if (props.icon) n.icon = props.icon;
      if (props.tone) (Array.isArray(props.tone) ? props.tone : String(props.tone).split(/[\s.]+/)).forEach(function (t) { if (t && n.tone.indexOf(t) < 0) n.tone.push(t); });
      if (props.x != null) n.px = props.x;
      if (props.y != null) n.py = props.y;
    }
    return n;
  };
  Model.prototype.finish = function () {
    this.nodes.forEach(function (n) {
      if (n.label == null) n.label = /^_auto/.test(n.id) ? '' : n.id.replace(/_/g, ' ');
      if (!n.shape) { n.shape = 'rect'; n.shapeAuto = true; }
    });
    return this;
  };

  function splitPipe(text) {
    var i = text.indexOf('|');
    if (i < 0) return { label: text.trim(), sub: '' };
    return { label: text.slice(0, i).trim(), sub: text.slice(i + 1).trim() };
  }
  /* index of first char c at bracket depth 0 */
  function topIndex(s, c) {
    var depth = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1);
      else if (ch === c && depth === 0) return i;
    }
    return -1;
  }
  function stripComment(line) {
    var t = line.replace(/\s+$/, '');
    if (/^\s*(#|\/\/)/.test(t)) return '';
    var depth = 0;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0 && ch === '#' && /\s/.test(t[i - 1] || ' ') && /\s|$/.test(t[i + 1] || '')) return t.slice(0, i).replace(/\s+$/, '');
    }
    return t;
  }
  function readBracket(s, i) {
    var two = s.substr(i, 2), close, shape, start;
    if (two === '((') { close = '))'; shape = 'circle'; start = i + 2; }
    else if (two === '([') { close = '])'; shape = 'pill'; start = i + 2; }
    else if (two === '{{') { close = '}}'; shape = 'diamond'; start = i + 2; }
    else if (s[i] === '[') { close = ']'; shape = 'rect'; start = i + 1; }
    else if (s[i] === '(') { close = ')'; shape = 'pill'; start = i + 1; }
    else { close = '}'; shape = 'diamond'; start = i + 1; }
    var end = s.indexOf(close, start);
    if (end < 0) return null;
    return { shape: shape, text: s.slice(start, end), end: end + close.length };
  }
  function tokenizeChain(s, M) {
    var toks = [], i = 0, n = s.length;
    while (i < n) {
      var c = s[i];
      if (/[\s,\u060C]/.test(c)) { i++; continue; }
      var op = null;
      for (var k = 0; k < OPS.length; k++) if (s.substr(i, OPS[k].length) === OPS[k]) { op = OPS[k]; break; }
      if (op) { toks.push({ t: 'op', v: op }); i += op.length; continue; }
      var j = i;
      while (j < n && ID_CH.test(s[j])) j++;
      var id = s.slice(i, j), shape = null, text = null;
      if (j < n && '[({'.indexOf(s[j]) >= 0) {
        var rb = readBracket(s, j);
        if (!rb) throw new Error('unclosed bracket after "' + (id || s.slice(i, i + 12)) + '"');
        shape = rb.shape; text = rb.text; j = rb.end;
      }
      var tones = [], icon = null, guard = 0;
      while (j < n && guard++ < 12) {
        var rest = s.slice(j), mm;
        if ((mm = rest.match(/^\.([A-Za-z][A-Za-z-]*)/))) { tones.push(mm[1]); j += mm[0].length; continue; }
        if ((mm = rest.match(/^\s*icon\s*=\s*([A-Za-z-]+)/))) { icon = mm[1]; j += mm[0].length; continue; }
        break;
      }
      if (j === i) throw new Error('unexpected "' + c + '"');
      if (!id) id = '_auto' + (++M.auto);
      toks.push({ t: 'node', id: id, shape: shape, text: text, tones: tones, icon: icon });
      i = j;
    }
    return toks;
  }
  function applyNodeTok(M, tk) {
    var p = { shape: tk.shape, icon: tk.icon, tone: tk.tones };
    if (tk.text != null) { var sp = splitPipe(tk.text); p.label = sp.label; p.sub = sp.sub; }
    tk.tones.forEach(function (t) { if (!TONES[t]) warn('unknown tone ".' + t + '" (use accent, muted, danger, ok, warn, strong, ghost)'); });
    return M.node(tk.id, p);
  }
  function parseIds(M, s) {
    return s.split(/[\s,،]+/).filter(Boolean).map(function (id) { return id.replace(/\.[A-Za-z-]+$/, ''); });
  }

  function parseGraphLine(M, line, lineNo, type) {
    var m;
    if ((m = line.match(/^(group|lane|actors?|same)\s*(.*?)\s*:\s*(.*)$/i))) {
      var kw = m[1].toLowerCase();
      var raw = m[2].replace(/^["']|["']$/g, '');
      if (kw === 'actor' || kw === 'actors') {
        var toks = tokenizeChain(m[3], M);
        M.opts.actors = toks.filter(function (t) { return t.t === 'node'; }).map(function (t) { return applyNodeTok(M, t).id; });
        return;
      }
      var gtoks = tokenizeChain(m[3], M).filter(function (t) { return t.t === 'node'; });
      var ids = gtoks.map(function (t) { return applyNodeTok(M, t).id; });
      var sp = splitPipe(raw);
      var tone = (sp.label.match(/\.([A-Za-z]+)$/) || [])[1];
      var g = { name: sp.label.replace(/\.[A-Za-z]+$/, ''), sub: sp.sub, ids: ids, tone: tone || '' };
      (kw === 'lane' ? M.lanes : M.groups).push(g);
      return;
    }
    if ((m = line.match(/^(center|centre|title|note|dir)\s*:\s*(.*)$/i))) { M.opts[m[1].toLowerCase().replace('centre', 'center')] = m[2].trim(); return; }
    var lab = null, ci = topIndex(line, ':');
    var body = line;
    if (ci >= 0) { lab = line.slice(ci + 1).trim(); body = line.slice(0, ci); }
    var hasOp = OPS.some(function (o) { return body.indexOf(o) >= 0; });
    if (!hasOp && !/[\[\(\{]/.test(body) && /\s/.test(body.trim()) ) {
      /* a plain phrase: a list item for cycle / hub / tree */
      var sp2 = splitPipe(body);
      var n0 = M.node('_auto' + (++M.auto), { label: sp2.label, sub: lab != null ? lab : sp2.sub });
      return n0;
    }
    var tk = tokenizeChain(body, M);
    if (!tk.length) return;
    tk.forEach(function (t) { if (t.t === 'node' && t.text && /[\[\]{}]|->/.test(t.text)) warn('line ' + lineNo + ': label of "' + t.id + '" contains a bracket or arrow; is a closing bracket missing?'); });
    if (tk[0].t !== 'node') throw new Error('line must start with a node, found "' + tk[0].v + '"');
    var prev = applyNodeTok(M, tk[0]), first = prev, added = [];
    for (var i = 1; i < tk.length; i += 2) {
      var opk = tk[i], nx = tk[i + 1];
      if (opk.t !== 'op') throw new Error('two nodes without an arrow between "' + prev.id + '" and "' + (opk.id || '') + '" (write a -> b, or put the label in [brackets])');
      if (!nx || nx.t !== 'node') throw new Error('arrow "' + opk.v + '" has no target');
      var nn = applyNodeTok(M, nx);
      var d = OPDEF[opk.v];
      var e = { from: prev.id, to: nn.id, arrow: d.arrow, style: d.style, label: '', idx: M.edges.length, line: lineNo };
      M.edges.push(e); added.push(e);
      prev = nn;
    }
    if (lab != null) {
      if (added.length) added[added.length - 1].label = lab;
      else if (lab) { var sp3 = splitPipe(lab); first.label = sp3.label || first.label; if (sp3.sub) first.sub = sp3.sub; }
    }
    return first;
  }

  function parseDataLine(M, line, lineNo, type) {
    var m, accent = false;
    if (/\s!\s*$|^!/.test(line)) { accent = true; line = line.replace(/\s!\s*$/, '').replace(/^!\s*/, ''); }
    m = line.match(/^(series|s)\s+(.+?)\s*:\s*(.+)$/i);
    if (m) { M.series.push({ name: m[2].trim(), raw: m[3].split(/[,،]\s*/).map(function (x) { return x.trim(); }), accent: accent }); return; }
    var ci = line.indexOf(':');
    if (ci < 0) { var sp0 = splitPipe(line); M.items.push({ key: '', label: sp0.label, sub: sp0.sub, accent: accent, line: lineNo }); return; }
    var key = line.slice(0, ci).trim(), val = line.slice(ci + 1).trim();
    var lk = key.toLowerCase();
    var DIRECTIVES = { x: 1, y: 1, quad: 1, center: 1, centre: 1, unit: 1, max: 1, min: 1, value: 1, label: 1, sub: 1, head: 1, area: 1, title: 1, orient: 1, note: 1 };
    if (DIRECTIVES[lk]) {
      if (lk === 'head') {
        var hp = val.split('|');
        if (accent) M.opts.headAccent = 1;
        else if (/!\s*$/.test(hp[0])) M.opts.headAccent = 0;
        val = val.replace(/\s*!\s*(?=\||$)/g, '');
      }
      M.opts[lk.replace('centre', 'center')] = val;
      return;
    }
    var kp = splitPipe(key), vp = splitPipe(val);
    M.items.push({ key: kp.label, keySub: kp.sub, label: vp.label, sub: vp.sub, raw: val, accent: accent, line: lineNo });
  }

  function parseDSL(text, type, figId) {
    var M = new Model();
    var lines = String(text).replace(/\r/g, '').split('\n');
    var graph = !!GRAPH_TYPES[type];
    var stack = [];
    lines.forEach(function (raw, i) {
      var line = stripComment(raw);
      if (!line.trim()) return;
      var indent = (line.match(/^\s*/)[0] || '').replace(/\t/g, '    ').length;
      line = line.trim().replace(/^[-*•]\s+/, '');
      try {
        if (graph) {
          /* modifier-only line: "enc.accent" or "enc icon=chip" */
          var mm = line.match(/^([A-Za-z0-9_؀-ۿ]+)((?:\.[A-Za-z-]+)+)?(\s+icon\s*=\s*[A-Za-z-]+)?$/);
          if (mm && (mm[2] || mm[3]) && !/[\[\(\{]/.test(line)) {
            var tk = tokenizeChain(line, M)[0];
            if (!M.byId[tk.id]) warn(figId + ' line ' + (i + 1) + ': modifier for unknown node "' + tk.id + '" creates it');
            applyNodeTok(M, tk);
            return;
          }
          var before = M.edges.length;
          var n = parseGraphLine(M, line, i + 1, type);
          if (type === 'tree' && n && M.edges.length === before) {
            while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
            if (stack.length) M.edges.push({ from: stack[stack.length - 1].id, to: n.id, arrow: 'none', style: 'solid', label: '', idx: M.edges.length, implicit: true });
            stack.push({ indent: indent, id: n.id });
          }
        } else parseDataLine(M, line, i + 1, type);
      } catch (err) {
        M.errors++;
        warn(figId + ' line ' + (i + 1) + ': ' + err.message + '  >>  ' + raw.trim());
      }
    });
    return M.finish();
  }

  function parseJSON(text, type, figId) {
    var M = new Model(), data;
    try { data = JSON.parse(text); } catch (e) { warn(figId + ': invalid JSON (' + e.message + ')'); M.errors++; return M.finish(); }
    if (Array.isArray(data)) data = GRAPH_TYPES[type] ? { nodes: data } : { items: data };
    (data.nodes || []).forEach(function (n, i) {
      if (typeof n === 'string') n = { id: n, label: n };
      M.node(String(n.id != null ? n.id : 'n' + i), { label: n.label != null ? String(n.label) : null, sub: n.sub, shape: n.shape, icon: n.icon, tone: n.tone, x: n.x, y: n.y });
    });
    (data.edges || []).forEach(function (e) {
      if (!M.byId[e.from]) M.node(String(e.from)); if (!M.byId[e.to]) M.node(String(e.to));
      var st = e.style || 'solid';
      M.edges.push({ from: String(e.from), to: String(e.to), label: e.label || '', style: st === 'dash' ? 'dashed' : st, arrow: e.arrow || (st === 'plain' || e.plain ? 'none' : 'end'), idx: M.edges.length });
    });
    (data.groups || []).forEach(function (g) { M.groups.push({ name: g.name || g.label || '', sub: g.sub || '', ids: (g.ids || g.nodes || []).map(String), tone: g.tone || '' }); });
    (data.lanes || []).forEach(function (g) { M.lanes.push({ name: g.name || g.label || '', sub: g.sub || '', ids: (g.ids || g.nodes || []).map(String) }); });
    (data.items || data.data || []).forEach(function (it, i) {
      if (typeof it !== 'object') it = { label: String(it) };
      var val = it.value != null ? String(it.value) : (it.text || '');
      M.items.push({ key: String(it.key != null ? it.key : (it.date != null ? it.date : (it.label != null && it.value != null ? it.label : ''))),
        label: it.value != null && it.label != null ? String(it.value) : String(it.label != null ? it.label : val),
        raw: it.value != null ? String(it.value) : (it.x != null ? it.x + ',' + it.y : String(it.items || it.label || '')),
        sub: it.sub || '', accent: !!(it.accent || it.highlight), line: i + 1 });
    });
    (data.series || []).forEach(function (s) { M.series.push({ name: s.name || '', raw: (s.values || s.data || []).map(String), accent: !!s.accent }); });
    ['x', 'y', 'quad', 'center', 'unit', 'max', 'min', 'value', 'label', 'sub', 'head', 'area', 'title', 'actors', 'orient'].forEach(function (k) {
      if (data[k] != null) M.opts[k] = Array.isArray(data[k]) && k !== 'actors' ? data[k].join(k === 'quad' || k === 'head' || k === 'x' && type === 'matrix' ? ' | ' : ', ') : data[k];
    });
    return M.finish();
  }

  /* ------------------------------------------------------------------ geometry */
  function inside(n, x, y) {
    var dx = Math.abs(x - n.x), dy = Math.abs(y - n.y), hw = n.w / 2, hh = n.h / 2;
    if (n.shape === 'circle') return (dx * dx) / (hw * hw) + (dy * dy) / (hh * hh) <= 1;
    if (n.shape === 'diamond') return dx / hw + dy / hh <= 1;
    if (dx > hw || dy > hh) return false;
    var r = n.shape === 'pill' ? Math.min(hw, hh) : Math.min(n.r || 0, hw, hh);
    if (r > 0 && dx > hw - r && dy > hh - r) { var ex = dx - (hw - r), ey = dy - (hh - r); return ex * ex + ey * ey <= r * r; }
    return true;
  }
  /* point where a ray from (ox,oy) (inside n) leaves the node outline */
  function exitPoint(n, ox, oy, dx, dy) {
    var len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    if (!inside(n, ox, oy)) { ox = n.x; oy = n.y; }
    var lo = 0, hi = Math.hypot(n.w, n.h) + 4;
    for (var i = 0; i < 34; i++) { var m = (lo + hi) / 2; if (inside(n, ox + dx * m, oy + dy * m)) lo = m; else hi = m; }
    return { x: ox + dx * lo, y: oy + dy * lo };
  }
  function toward(n, tx, ty) { return exitPoint(n, n.x, n.y, tx - n.x, ty - n.y); }
  function rectOf(n, pad) { pad = pad || 0; return { x: n.x - n.w / 2 - pad, y: n.y - n.h / 2 - pad, w: n.w + 2 * pad, h: n.h + 2 * pad }; }
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  function dedupe(pts) {
    var out = [];
    pts.forEach(function (p) {
      var l = out[out.length - 1];
      if (l && Math.abs(l.x - p.x) < 0.5 && Math.abs(l.y - p.y) < 0.5) return;
      out.push({ x: p.x, y: p.y });
    });
    for (var i = out.length - 2; i >= 1; i--) {
      var a = out[i - 1], b = out[i], c = out[i + 1];
      if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 0.5) out.splice(i, 1);
    }
    return out;
  }
  function roundedPath(pts, r) {
    pts = dedupe(pts);
    if (pts.length < 2) return '';
    var d = 'M' + r1(pts[0].x) + ' ' + r1(pts[0].y), n = pts.length;
    for (var i = 1; i < n - 1; i++) {
      var a = pts[i - 1], b = pts[i], c = pts[i + 1];
      var l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
      var rr = Math.min(r, i === 1 ? l1 * 0.9 : l1 / 2, i === n - 2 ? l2 * 0.9 : l2 / 2);
      var p1 = { x: b.x - (b.x - a.x) / l1 * rr, y: b.y - (b.y - a.y) / l1 * rr };
      var p2 = { x: b.x + (c.x - b.x) / l2 * rr, y: b.y + (c.y - b.y) / l2 * rr };
      d += 'L' + r1(p1.x) + ' ' + r1(p1.y) + 'Q' + r1(b.x) + ' ' + r1(b.y) + ' ' + r1(p2.x) + ' ' + r1(p2.y);
    }
    return d + 'L' + r1(pts[n - 1].x) + ' ' + r1(pts[n - 1].y);
  }
  function arrowD(tip, ux, uy, L, W) {
    var bx = tip.x - ux * L, by = tip.y - uy * L, vx = -uy, vy = ux, nx = tip.x - ux * L * 0.72, ny = tip.y - uy * L * 0.72;
    return 'M' + r1(tip.x) + ' ' + r1(tip.y) + 'L' + r1(bx + vx * W / 2) + ' ' + r1(by + vy * W / 2) + 'L' + r1(nx) + ' ' + r1(ny) + 'L' + r1(bx - vx * W / 2) + ' ' + r1(by - vy * W / 2) + 'Z';
  }
  function unit(ax, ay, bx, by) { var l = Math.hypot(bx - ax, by - ay) || 1; return { x: (bx - ax) / l, y: (by - ay) / l }; }
  function pt(x, y) { return { x: x, y: y }; }

  /* ------------------------------------------------------------------ diagram object */
  var STATE_CLS = ['is-on', 'is-current', 'nm-dg-drawn'];
  var registry = [];

  function Diagram(fig) {
    this.fig = fig;
    this.id = fig.getAttribute('data-id') || fig.id || ('dg' + (++uid));
    this.type = (fig.getAttribute('data-type') || 'flow').toLowerCase().trim();
    this.map = new Map();
    this.used = null;
    fig.classList.add('nm-dg', 'nm-dg-t-' + this.type);
    if (!fig.hasAttribute('role')) fig.setAttribute('role', 'img');
    this.canvas = h('div', 'nm-dg-canvas', null);
    this.svg = sv('svg', { 'class': 'nm-dg-svg', 'aria-hidden': 'true' }, this.canvas);
    this.defs = sv('defs', null, this.svg);
    this.gBack = sv('g', { 'class': 'nm-dg-back' }, this.svg);
    this.gEdges = sv('g', { 'class': 'nm-dg-edges' }, this.svg);
    this.gFront = sv('g', { 'class': 'nm-dg-front' }, this.svg);
    this.html = h('div', 'nm-dg-html', this.canvas);
    var cap = fig.querySelector(':scope > figcaption');
    if (cap) fig.insertBefore(this.canvas, cap); else fig.appendChild(this.canvas);
    this.caption = cap;
    this.parse();
  }
  Diagram.prototype.parse = function () {
    var fig = this.fig, sc = fig.querySelector('script[type="text/nm-diagram"], script[type="application/json"], script[type="text/plain"]');
    var txt = sc ? sc.textContent : '';
    if (!sc) warn(this.id + ': no <script type="text/nm-diagram"> block found');
    var json = sc && (sc.type === 'application/json' || /^\s*[\[{]/.test(txt) && !GRAPH_TYPES[this.type] && /^\s*\{/.test(txt));
    if (sc && sc.type === 'application/json') json = true;
    this.model = json ? parseJSON(txt, this.type, this.id) : parseDSL(txt, this.type, this.id);
    if (!fig.hasAttribute('aria-label')) {
      var words = this.model.nodes.map(function (n) { return n.label; }).concat(this.model.items.map(function (i) { return i.key || i.label; }));
      fig.setAttribute('aria-label', words.filter(Boolean).slice(0, 24).join(' - '));
    }
  };
  Diagram.prototype.get = function (key, make) {
    var e = this.map.get(key);
    if (!e || !e.isConnected) { e = make(); this.map.set(key, e); }
    this.used.add(key);
    return e;
  };
  Diagram.prototype.opt = function (name, def) { var v = this.fig.getAttribute('data-' + name); return v == null || v === '' ? def : v; };
  function keepState(e, cls) {
    STATE_CLS.forEach(function (s) { if (e.classList.contains(s)) cls += ' ' + s; });
    if (e.getAttribute('class') !== cls) e.setAttribute('class', cls);
  }
  Diagram.prototype.nodeEl = function (n) {
    var self = this, key = 'n:' + n.id;
    var e = this.get(key, function () { return h('div', 'nm-dg-node', self.html); });
    keepState(e, 'nm-dg-node nm-dg-' + n.shape + n.tone.map(function (t) { return ' is-' + t; }).join('') + (n.icon ? ' has-icon' : '') + (n.cls ? ' ' + n.cls : ''));
    var lab = esc(n.label).replace(/\\n/g, '<br>');
    var sig = n.shape + '|' + n.icon + '|' + lab + '|' + n.sub + '|' + (n.html || '');
    if (e._sig !== sig) {
      e._sig = sig;
      e.innerHTML = (n.shape === 'diamond' ? '<svg class="nm-dg-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,1.5 98.5,50 50,98.5 1.5,50" vector-effect="non-scaling-stroke"/></svg>' : '') +
        (n.icon ? iconSvg(n.icon) : '') +
        '<div class="nm-dg-txt">' + (n.html || '') + (lab ? '<div class="nm-dg-t">' + lab + '</div>' : '') + (n.sub ? '<div class="nm-dg-s">' + esc(n.sub).replace(/\\n/g, '<br>') + '</div>' : '') + '</div>';
    }
    if (n.id.indexOf('_') !== 0 || true) {
      var mid = this.id + ':' + n.id;
      if (e.getAttribute('data-node') !== mid) { e.setAttribute('data-node', mid); e.setAttribute('data-morph', mid); }
    }
    e.setAttribute('data-shape', n.shape);
    return e;
  };
  Diagram.prototype.measure = function (n, maxW) {
    var e = this.nodeEl(n), txt = e.querySelector('.nm-dg-txt');
    e.style.width = ''; e.style.height = ''; e.style.left = '0px'; e.style.top = '0px';
    e.classList.remove('nm-dg-fs1', 'nm-dg-fs2', 'nm-dg-fs3');
    var shape = n.shape;
    var mw = shape === 'circle' ? Math.min(maxW, 250) : shape === 'diamond' ? Math.min(maxW, 220) : maxW;
    e.style.maxWidth = Math.round(mw) + 'px';
    for (var k = 1; k <= 3; k++) {
      if (txt.scrollWidth <= txt.clientWidth + 1) break;
      e.classList.remove('nm-dg-fs' + (k - 1)); e.classList.add('nm-dg-fs' + k);
    }
    if (txt.scrollWidth > txt.clientWidth + 1) e.style.maxWidth = Math.ceil(mw + txt.scrollWidth - txt.clientWidth + 4) + 'px';
    var bw = e.getBoundingClientRect().width, sc = bw && e.offsetWidth ? bw / e.offsetWidth : 1;
    var w = Math.ceil(bw / sc) + 2, hh = e.offsetHeight;
    var tw = txt.offsetWidth + 2, th = txt.offsetHeight;
    if (e.querySelector(':scope > .nm-dg-ico') && (shape === 'circle' || shape === 'diamond')) th += 40;
    if (shape === 'circle') { w = hh = Math.ceil(Math.max(Math.hypot(tw, th) + 22, n.minD || 110)); }
    else if (shape === 'diamond') { w = Math.ceil(Math.max(tw * 1.5 + 44, 150)); hh = Math.ceil(Math.max(th * 2.6 + 18, 110)); }
    n.w = w; n.h = hh; n.el = e; n.tw = tw; n.th = th;
    n.r = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0;
    e.style.maxWidth = '';
    return n;
  };
  /* make rect / pill nodes share widths and heights when they are close: calmer rhythm */
  function equalize(nodes, opts) {
    opts = opts || {};
    var box = nodes.filter(function (n) { return n.shape === 'rect' || n.shape === 'pill'; });
    if (box.length < 2) return;
    var ws = box.map(function (n) { return n.w; }), hs = box.map(function (n) { return n.h; });
    var maxW = Math.max.apply(null, ws), minW = Math.min.apply(null, ws), maxH = Math.max.apply(null, hs), minH = Math.min.apply(null, hs);
    if (opts.width !== false && maxW / minW <= (opts.ratio || 1.75)) box.forEach(function (n) { n.w = maxW; });
    else box.forEach(function (n) { n.w = Math.max(n.w, Math.min(maxW, minW * 1.25)); });
    if (opts.height !== false && maxH / minH <= 1.9) box.forEach(function (n) { n.h = maxH; });
  }
  Diagram.prototype.place = function (n, x, y) {
    n.x = x; n.y = y;
    var e = n.el || this.nodeEl(n);
    if (!this.used.has('n:' + n.id)) this.nodeEl(n);
    e.style.left = r1(x - n.w / 2) + 'px'; e.style.top = r1(y - n.h / 2) + 'px';
    e.style.width = Math.round(n.w) + 'px'; e.style.height = Math.round(n.h) + 'px';
    this.placed.push(n);
    this.parts.push({ el: e, kind: 'node', node: n });
  };
  /* generic HTML label: measured, then positioned by its centre with put() */
  Diagram.prototype.label = function (key, html, cls, maxW) {
    var self = this;
    var e = this.get('l:' + key, function () { return h('div', '', self.html); });
    keepState(e, 'nm-dg-label ' + (cls || ''));
    if (e._nmCount) { cancelAnimationFrame(e._nmCount); e._nmCount = 0; }
    $all('.nm-dg-count', e).forEach(function (c) { if (c._nmCount) { cancelAnimationFrame(c._nmCount); c._nmCount = 0; } });
    e._html = html; e.innerHTML = html;
    e.style.left = '0px'; e.style.top = '0px'; e.style.width = '';
    e.style.maxWidth = maxW ? Math.round(maxW) + 'px' : '';
    var lb = e.getBoundingClientRect().width, ls = lb && e.offsetWidth ? lb / e.offsetWidth : 1;
    var L = { el: e, w: Math.ceil(lb / ls) + 1, h: e.offsetHeight, key: key };
    e.style.width = L.w + 'px';
    e.style.maxWidth = '';
    return L;
  };
  Diagram.prototype.put = function (L, x, y, part) {
    L.x = x; L.y = y;
    L.el.style.left = r1(x - L.w / 2) + 'px'; L.el.style.top = r1(y - L.h / 2) + 'px';
    if (part !== false) this.parts.push(Object.assign({ el: L.el, kind: 'label' }, part || {}));
    this.lrects.push({ x: x - L.w / 2, y: y - L.h / 2, w: L.w, h: L.h });
    return L;
  };
  Diagram.prototype.shape = function (key, tag, attrs, layer, part) {
    var self = this;
    var e = this.get('s:' + key, function () { return sv(tag, null, layer || self.gBack); });
    if (e.tagName !== tag) { e.remove(); this.map.delete('s:' + key); e = this.get('s:' + key, function () { return sv(tag, null, layer || self.gBack); }); }
    var cls = attrs['class'] || '';
    delete attrs['class'];
    keepState(e, cls);
    setA(e, attrs);
    if (part) this.parts.push(Object.assign({ el: e, kind: 'shape' }, part));
    return e;
  };
  /* An edge. spec: { pts | bez:[p0,c1,c2,p3] | arc:{cx,cy,R,a0,a1}, from, to, arrow, style, label, cls, radius } */
  Diagram.prototype.edge = function (key, sp) {
    var self = this;
    var g = this.get('e:' + key, function () { return sv('g', null, self.gEdges); });
    keepState(g, 'nm-dg-edge is-' + (sp.style || 'solid') + (sp.cls ? ' ' + sp.cls : ''));
    while (g.firstChild) g.removeChild(g.firstChild);
    var thick = sp.style === 'thick';
    var AL = thick ? 17 : 14, AW = thick ? 15 : 12, cut = AL * 0.7;
    var aEnd = sp.arrow === 'end' || sp.arrow === 'both', aStart = sp.arrow === 'both';
    var d, tip = null, tail = null, ue = null, us = null, ends;
    if (sp.pts) {
      var pts = dedupe(sp.pts);
      if (pts.length < 2) return null;
      var n = pts.length;
      tip = pts[n - 1]; tail = pts[0];
      ends = [tail.x, tail.y, tip.x, tip.y];
      ue = unit(pts[n - 2].x, pts[n - 2].y, tip.x, tip.y);
      us = unit(pts[1].x, pts[1].y, tail.x, tail.y);
      var segE = Math.hypot(tip.x - pts[n - 2].x, tip.y - pts[n - 2].y), segS = Math.hypot(pts[1].x - tail.x, pts[1].y - tail.y);
      if (aEnd) pts[n - 1] = pt(tip.x - ue.x * Math.min(cut, segE * 0.6), tip.y - ue.y * Math.min(cut, segE * 0.6));
      if (aStart) pts[0] = pt(tail.x - us.x * Math.min(cut, segS * 0.6), tail.y - us.y * Math.min(cut, segS * 0.6));
      d = roundedPath(pts, sp.radius == null ? 18 : sp.radius);
    } else if (sp.bezs) {
      var segs = sp.bezs.map(function (sg) { return sg.map(function (p) { return pt(p.x, p.y); }); });
      var fs = segs[0], ls = segs[segs.length - 1];
      tail = pt(fs[0].x, fs[0].y); tip = pt(ls[3].x, ls[3].y);
      ends = [tail.x, tail.y, tip.x, tip.y];
      ue = unit(ls[2].x, ls[2].y, tip.x, tip.y); us = unit(fs[1].x, fs[1].y, tail.x, tail.y);
      if (Math.hypot(ls[2].x - tip.x, ls[2].y - tip.y) < 1) ue = unit(ls[0].x, ls[0].y, tip.x, tip.y);
      if (aEnd) ls[3] = pt(tip.x - ue.x * cut, tip.y - ue.y * cut);
      if (aStart) fs[0] = pt(tail.x - us.x * cut, tail.y - us.y * cut);
      d = 'M' + r1(fs[0].x) + ' ' + r1(fs[0].y);
      segs.forEach(function (b) { d += 'C' + r1(b[1].x) + ' ' + r1(b[1].y) + ' ' + r1(b[2].x) + ' ' + r1(b[2].y) + ' ' + r1(b[3].x) + ' ' + r1(b[3].y); });
    } else if (sp.bez) {
      var b = sp.bez.map(function (p) { return pt(p.x, p.y); });
      tail = pt(b[0].x, b[0].y); tip = pt(b[3].x, b[3].y);
      ends = [tail.x, tail.y, tip.x, tip.y];
      ue = unit(b[2].x, b[2].y, tip.x, tip.y); us = unit(b[1].x, b[1].y, tail.x, tail.y);
      if (Math.hypot(b[2].x - tip.x, b[2].y - tip.y) < 1) ue = unit(b[0].x, b[0].y, tip.x, tip.y);
      if (aEnd) { b[3] = pt(tip.x - ue.x * cut, tip.y - ue.y * cut); }
      if (aStart) { b[0] = pt(tail.x - us.x * cut, tail.y - us.y * cut); }
      d = 'M' + r1(b[0].x) + ' ' + r1(b[0].y) + 'C' + r1(b[1].x) + ' ' + r1(b[1].y) + ' ' + r1(b[2].x) + ' ' + r1(b[2].y) + ' ' + r1(b[3].x) + ' ' + r1(b[3].y);
    } else if (sp.arc) {
      var A = sp.arc, a0 = A.a0, a1 = A.a1, R = A.R, sg = a1 >= a0 ? 1 : -1;
      tail = pt(A.cx + R * Math.cos(a0), A.cy + R * Math.sin(a0));
      tip = pt(A.cx + R * Math.cos(a1), A.cy + R * Math.sin(a1));
      ends = [tail.x, tail.y, tip.x, tip.y];
      ue = { x: -Math.sin(a1) * sg, y: Math.cos(a1) * sg };
      us = { x: Math.sin(a0) * sg, y: -Math.cos(a0) * sg };
      var b1 = aEnd ? a1 - sg * cut / R : a1, b0 = aStart ? a0 + sg * cut / R : a0;
      var p0 = pt(A.cx + R * Math.cos(b0), A.cy + R * Math.sin(b0)), p1 = pt(A.cx + R * Math.cos(b1), A.cy + R * Math.sin(b1));
      d = 'M' + r1(p0.x) + ' ' + r1(p0.y) + 'A' + r1(R) + ' ' + r1(R) + ' 0 ' + (Math.abs(b1 - b0) > Math.PI ? 1 : 0) + ' ' + (sg > 0 ? 1 : 0) + ' ' + r1(p1.x) + ' ' + r1(p1.y);
    }
    var path = sv('path', { d: d, 'class': 'nm-dg-stroke', pathLength: 1 }, g);
    if (sp.style === 'dashed') {
      var mid = 'nmdgm' + (++uid);
      var mask = sv('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 12000, height: 12000 }, g);
      sv('path', { d: d, 'class': 'nm-dg-drawmask', pathLength: 1 }, mask);
      path.setAttribute('class', 'nm-dg-stroke nm-dg-dash');
      path.removeAttribute('pathLength');
      path.setAttribute('mask', 'url(#' + mid + ')');
    }
    if (aEnd) sv('path', { d: arrowD(tip, ue.x, ue.y, AL, AW), 'class': 'nm-dg-head nm-dg-head-end' }, g);
    if (aStart) sv('path', { d: arrowD(tail, us.x, us.y, AL, AW), 'class': 'nm-dg-head nm-dg-head-start' }, g);
    if (this.flowOn && sp.flow !== false) sv('path', { d: d, 'class': 'nm-dg-flowdots' + (sp.style === 'dashed' ? ' is-slow' : '') }, g);
    if (ends) g.setAttribute('data-ends', ends.map(r1).join(','));
    if (sp.from) g.setAttribute('data-from', sp.from.id); else g.removeAttribute('data-from');
    if (sp.to) g.setAttribute('data-to', sp.to.id); else g.removeAttribute('data-to');
    if (sp.free) g.setAttribute('data-free', '1');
    var part = { el: g, kind: 'edge', from: sp.from, to: sp.to, eord: sp.eord != null ? sp.eord : this.edgeCount, seq: sp.seq, fixed: !!sp.fixed };
    this.edgeCount++;
    this.parts.push(part);
    if (sp.label) {
      var L = this.label('el:' + key, esc(sp.label), 'nm-dg-elabel' + (sp.labelCls ? ' ' + sp.labelCls : ''), 300);
      var pos;
      if (sp.labelAbove) {
        var tl = path.getTotalLength(), mp = path.getPointAtLength(tl / 2);
        pos = { x: mp.x, y: mp.y - L.h / 2 - 6 };
      } else pos = this.labelSpot(path, L, sp.labelAt);
      this.put(L, pos.x, pos.y, { kind: 'elabel', edgePart: part });
    }
    return g;
  };
  Diagram.prototype.labelSpot = function (path, L, prefer) {
    var len = 0;
    try { len = path.getTotalLength(); } catch (e) { len = 0; }
    var ts = prefer != null ? [prefer, 0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74] : [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8];
    var best = null, bestScore = Infinity;
    for (var i = 0; i < ts.length; i++) {
      var p = len ? path.getPointAtLength(len * ts[i]) : { x: 0, y: 0 };
      var r = { x: p.x - L.w / 2, y: p.y - L.h / 2, w: L.w, h: L.h }, score = i * 0.01;
      for (var k = 0; k < this.placed.length; k++) if (overlap(r, rectOf(this.placed[k], 6))) score += 10;
      for (var j = 0; j < this.lrects.length; j++) if (overlap(r, this.lrects[j])) score += 5;
      if (score < bestScore) { bestScore = score; best = p; }
      if (score < 1) break;
    }
    return { x: best.x, y: best.y };
  };

  Diagram.prototype.ctxDir = function (def) {
    var d = (this.opt('dir', '') || '').toLowerCase();
    var rtl = getComputedStyle(this.fig).direction !== 'ltr';
    if (!d) d = def === 'row' ? (rtl ? 'rtl' : 'ltr') : def;
    return { dir: d, rtl: rtl };
  };

  Diagram.prototype.render = function () {
    var fig = this.fig;
    var capH = this.caption ? this.caption.offsetHeight + 14 : 0;
    var W = fig.clientWidth, H = fig.clientHeight - capH;
    if (W < 40 || H < 40) return false;
    this.W = W; this.H = H;
    this.used = new Set(); this.placed = []; this.lrects = []; this.parts = []; this.edgeCount = 0; this.stepHint = null;
    this.flowOn = /^(on|true|1|dots|dash)$/.test(this.opt('flow', ''));
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    this.canvas.style.transform = 'none';
    var lay = LAYOUTS[this.type];
    if (!lay) { warn(this.id + ': unknown data-type "' + this.type + '", using flow. Types: ' + Object.keys(LAYOUTS).join(', ')); lay = LAYOUTS.flow; }
    try { lay.call(this, this.model, this); }
    catch (err) { warn(this.id + ': layout failed: ' + (err && err.message)); if (window.NM_DEBUG) throw err; }
    var self = this;
    this.map.forEach(function (e, k) { if (!self.used.has(k)) { e.remove(); self.map.delete(k); } });
    this.fit();
    this.assignSteps();
    this.rendered = true;
    return true;
  };
  Diagram.prototype.fit = function () {
    var bb = null;
    function add(x, y, w, hh) {
      if (!(w >= 0) || isNaN(x) || isNaN(y)) return;
      if (!bb) bb = { x0: x, y0: y, x1: x + w, y1: y + hh };
      else { bb.x0 = Math.min(bb.x0, x); bb.y0 = Math.min(bb.y0, y); bb.x1 = Math.max(bb.x1, x + w); bb.y1 = Math.max(bb.y1, y + hh); }
    }
    $all(':scope > *', this.html).forEach(function (e) { add(e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight); });
    [this.gBack, this.gEdges, this.gFront].forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (c) {
        try { var b = c.getBBox(); if (b.width || b.height) add(b.x - 3, b.y - 3, b.width + 6, b.height + 6); } catch (e) { /* noop */ }
      });
    });
    if (!bb) return;
    var W = this.W, H = this.H, m = 2;
    var bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
    var s = Math.min(1, (W - 2 * m) / bw, (H - 2 * m) / bh);
    var tx = (W - bw * s) / 2 - bb.x0 * s, ty = (H - bh * s) / 2 - bb.y0 * s;
    this.scale = s;
    this.canvas.style.transform = 'translate(' + r1(tx) + 'px,' + r1(ty) + 'px) scale(' + s.toFixed(4) + ')';
    if (s < 0.62) warn(this.id + ': content scaled to ' + Math.round(s * 100) + '% to fit; give the figure more room or shorten labels');
  };

  /* ------------------------------------------------------------------ steps + play */
  Diagram.prototype.assignSteps = function () {
    var fig = this.fig, mode = (this.opt('steps', 'none') || 'none').toLowerCase();
    if ((mode === 'rank' || mode === 'node') && this.stepHint) mode = this.stepHint;
    var parts = this.parts, slide = fig.closest('.slide');
    fig.classList.toggle('nm-dg-steps', mode !== 'none');
    /* play delays */
    var maxRank = 0;
    parts.forEach(function (p) { if (p.node && p.node.rank > maxRank) maxRank = p.node.rank; });
    var stagger = clamp(1500 / Math.max(1, maxRank + 1), 70, 240);
    var seqStagger = clamp(1300 / Math.max(1, parts.length), 30, 140);
    parts.forEach(function (p) {
      var d = 0;
      if (p.kind === 'node') d = (p.node.rank || 0) * stagger;
      else if (p.kind === 'edge') d = p.from ? (p.from.rank || 0) * stagger + 160 : (p.seq || 0) * seqStagger;
      else if (p.kind === 'elabel') d = (p.edgePart.from ? (p.edgePart.from.rank || 0) * stagger : 0) + 420;
      else if (p.seq != null) d = p.seq * seqStagger;
      else if (p.attach) d = (p.attach.rank || 0) * stagger;
      p.el.style.setProperty('--dg-d', Math.round(d) + 'ms');
    });
    if (mode === 'none') {
      parts.forEach(function (p) { if (p.el.getAttribute('data-nm-dg-step')) { p.el.removeAttribute('data-step'); p.el.removeAttribute('data-act'); p.el.removeAttribute('data-nm-dg-step'); } });
      return;
    }
    var base = parseInt(fig.getAttribute('data-step-from'), 10);
    if (!(base >= 1)) {
      base = parseInt(fig.getAttribute('data-nm-step-base'), 10);
      if (!(base >= 1)) {
        var mx = 0;
        if (slide) $all('[data-step]', slide).forEach(function (e) { if (!fig.contains(e)) { var v = parseInt(e.getAttribute('data-step'), 10); if (v > mx) mx = v; } });
        base = mx + 1;
        fig.setAttribute('data-nm-step-base', base);
      }
    }
    var nodeStep = new Map();
    var nodes = parts.filter(function (p) { return p.kind === 'node'; });
    var edges = parts.filter(function (p) { return p.kind === 'edge'; });
    var isChart = !nodes.length;
    if (mode === 'all') parts.forEach(function (p) { p.step = base; });
    else if (isChart || mode === 'series') {
      var seqs = [];
      parts.forEach(function (p) { var s = p.seq != null ? p.seq : (p.node ? p.node.ord : null); if (s != null && seqs.indexOf(s) < 0) seqs.push(s); });
      seqs.sort(function (a, b) { return a - b; });
      parts.forEach(function (p) {
        var s = p.seq != null ? p.seq : (p.node ? p.node.ord : (p.from && p.to ? Math.max(p.from.ord, p.to.ord) : null));
        p.step = s == null ? null : base + seqs.indexOf(s);
        if (p.node) nodeStep.set(p.node, p.step);
      });
    } else if (mode === 'rank' || mode === 'node') {
      var key = mode === 'rank' ? 'rank' : 'ord';
      var vals = [];
      nodes.forEach(function (p) { var v = p.node[key] || 0; if (vals.indexOf(v) < 0) vals.push(v); });
      vals.sort(function (a, b) { return a - b; });
      nodes.forEach(function (p) { p.step = base + vals.indexOf(p.node[key] || 0); nodeStep.set(p.node, p.step); });
      edges.forEach(function (p) {
        var a = p.from ? nodeStep.get(p.from) : null, b = p.to ? nodeStep.get(p.to) : null;
        p.step = Math.max(a || base, b || base);
        if (p.seq != null && a == null && b == null) p.step = base + p.seq;
      });
    } else if (mode === 'edge') {
      edges.sort(function (a, b) { return a.eord - b.eord; });
      edges.forEach(function (p, i) {
        p.step = base + i;
        [p.from, p.to].forEach(function (n) { if (n && !nodeStep.has(n)) nodeStep.set(n, p.step); });
      });
      nodes.forEach(function (p) { p.step = nodeStep.has(p.node) ? nodeStep.get(p.node) : base; nodeStep.set(p.node, p.step); });
    }
    parts.forEach(function (p) {
      if (p.kind === 'elabel') p.step = p.edgePart.step;
      else if (p.attach && p.step == null) {
        var ss = (Array.isArray(p.attach) ? p.attach : [p.attach]).map(function (n) { return nodeStep.get(n); }).filter(function (v) { return v != null; });
        p.step = ss.length ? Math.min.apply(null, ss) : null;
      }
    });
    parts.forEach(function (p) {
      if (p.step == null || p.fixed) {
        if (p.el.getAttribute('data-nm-dg-step')) { p.el.removeAttribute('data-step'); p.el.removeAttribute('data-act'); p.el.removeAttribute('data-nm-dg-step'); }
        return;
      }
      p.el.setAttribute('data-step', p.step);
      p.el.setAttribute('data-act', p.kind === 'edge' || p.draw ? 'draw' : 'reveal');
      p.el.setAttribute('data-nm-dg-step', '1');
      /* in-step delay: edges first, then the node they reach */
      var ds = p.kind === 'node' ? 160 : p.kind === 'elabel' ? 380 : 0;
      p.el.style.setProperty('--dg-ds', ds + 'ms');
    });
  };

  /* ------------------------------------------------------------------ layouts: graphs */
  var LAYOUTS = {};

  Diagram.prototype.syn = function (id, props) {
    this.synth = this.synth || {};
    var n = this.synth[id] || (this.synth[id] = { id: id });
    n.label = ''; n.sub = ''; n.shape = 'rect'; n.icon = null; n.tone = []; n.cls = ''; n.html = '';
    for (var k in props) n[k] = props[k];
    if (!Array.isArray(n.tone)) n.tone = n.tone ? [n.tone] : [];
    return n;
  };

  function rankGraph(M) {
    var N = M.nodes.length, idx = {}, i;
    M.nodes.forEach(function (n, k) { idx[n.id] = k; });
    var E = [];
    M.edges.forEach(function (e) { var u = idx[e.from], v = idx[e.to]; if (u == null || v == null) return; E.push({ e: e, u: u, v: v, rev: false, self: u === v }); });
    var adj = M.nodes.map(function () { return []; });
    E.forEach(function (x, k) { if (!x.self) adj[x.u].push(k); });
    var state = new Array(N).fill(0), indeg = new Array(N).fill(0);
    E.forEach(function (x) { if (!x.self) indeg[x.v]++; });
    function dfs(u) { state[u] = 1; adj[u].forEach(function (k) { var x = E[k]; if (state[x.v] === 1) x.rev = true; else if (state[x.v] === 0) dfs(x.v); }); state[u] = 2; }
    for (i = 0; i < N; i++) if (!indeg[i] && !state[i]) dfs(i);
    for (i = 0; i < N; i++) if (!state[i]) dfs(i);
    var dag = E.filter(function (x) { return !x.self; }).map(function (x) { return x.rev ? { a: x.v, b: x.u, x: x } : { a: x.u, b: x.v, x: x }; });
    var rank = new Array(N).fill(0), ind = new Array(N).fill(0), out = M.nodes.map(function () { return []; }), hasIn = new Array(N).fill(false);
    dag.forEach(function (d) { ind[d.b]++; out[d.a].push(d); hasIn[d.b] = true; });
    var q = [], order = [];
    for (i = 0; i < N; i++) if (!ind[i]) q.push(i);
    while (q.length) {
      var u = q.shift(); order.push(u);
      out[u].forEach(function (d) { rank[d.b] = Math.max(rank[d.b], rank[u] + 1); if (--ind[d.b] === 0) q.push(d.b); });
    }
    order.slice().reverse().forEach(function (u) {
      if (hasIn[u] || !out[u].length) return;
      rank[u] = Math.max(rank[u], Math.min.apply(null, out[u].map(function (d) { return rank[d.b]; })) - 1);
    });
    return { E: E, dag: dag, rank: rank, out: out, order: order, idx: idx };
  }

  /* direction helpers: (p = along the flow, c = across) -> (x, y) */
  function mapper(dir, rtl, Ptot, Ctot) {
    return function (p, c) {
      switch (dir) {
        case 'ltr': return pt(p, c);
        case 'ttb': return pt(rtl ? Ctot - c : c, p);
        case 'btt': return pt(rtl ? Ctot - c : c, Ptot - p);
        default: return pt(Ptot - p, c);
      }
    };
  }
  function primaryVec(dir) { return dir === 'ltr' ? pt(1, 0) : dir === 'ttb' ? pt(0, 1) : dir === 'btt' ? pt(0, -1) : pt(-1, 0); }

  function placeLayer(L, des, sepFn) {
    var n = L.length, a = new Array(n), b = new Array(n), m = new Array(n), i;
    if (!n) return;
    a[0] = des[0];
    for (i = 1; i < n; i++) a[i] = Math.max(des[i], a[i - 1] + sepFn(L[i - 1], L[i]));
    b[n - 1] = des[n - 1];
    for (i = n - 2; i >= 0; i--) b[i] = Math.min(des[i], b[i + 1] - sepFn(L[i], L[i + 1]));
    for (i = 0; i < n; i++) m[i] = (a[i] + b[i]) / 2;
    for (i = 1; i < n; i++) m[i] = Math.max(m[i], m[i - 1] + sepFn(L[i - 1], L[i]));
    var shift = 0;
    for (i = 0; i < n; i++) shift += des[i] - m[i];
    shift /= n;
    for (i = 0; i < n; i++) L[i].c = m[i] + shift;
  }

  LAYOUTS.flow = function (M, D) {
    var cd = D.ctxDir('row'), dir = cd.dir, rtl = cd.rtl, horiz = dir === 'rtl' || dir === 'ltr';
    var nodes = M.nodes;
    if (!nodes.length) return;
    var edgeMode = (D.opt('edges', 'ortho') || 'ortho').toLowerCase();
    var G = rankGraph(M), rank = G.rank;
    var R = Math.max.apply(null, rank) + 1;
    var counts = new Array(R).fill(0);
    rank.forEach(function (r) { counts[r]++; });
    var maxCount = Math.max.apply(null, counts);
    var maxW = horiz ? clamp((D.W - (R - 1) * 90) / R, 200, 320) : clamp((D.W - (maxCount - 1) * 48) / maxCount, 150, 320);
    nodes.forEach(function (n) { D.measure(n, maxW); });
    equalize(nodes);
    nodes.forEach(function (n, i) { n.rank = rank[i]; });
    var PS = function (n) { return horiz ? n.w : n.h; }, CS = function (n) { return horiz ? n.h : n.w; };
    var gid = {};
    M.groups.forEach(function (g, gi) { g.ids.forEach(function (id) { if (gid[id] == null) gid[id] = gi; }); });
    var V = nodes.map(function (n, i) { return { i: i, n: n, r: rank[i], ps: PS(n), cs: CS(n), g: gid[n.id] == null ? -1 : gid[n.id], pred: [], succ: [] }; });
    var chains = [], loops = [], selfs = [];
    G.dag.forEach(function (d) {
      if (d.x.rev) { loops.push(d.x); return; }
      var chain = [V[d.a]];
      for (var r = rank[d.a] + 1; r < rank[d.b]; r++) { var dv = { dummy: true, r: r, ps: 0, cs: 0, g: -2, pred: [], succ: [] }; V.push(dv); chain.push(dv); }
      chain.push(V[d.b]);
      chains.push({ x: d.x, chain: chain });
    });
    G.E.forEach(function (x) { if (x.self) selfs.push(x); });
    chains.forEach(function (c) { for (var k = 0; k < c.chain.length - 1; k++) { c.chain[k].succ.push(c.chain[k + 1]); c.chain[k + 1].pred.push(c.chain[k]); } });
    var layers = [];
    for (var r = 0; r < R; r++) layers.push(V.filter(function (v) { return v.r === r; }));
    function setO() { layers.forEach(function (L) { L.forEach(function (v, i) { v.o = i; }); }); }
    function crossings() {
      var c = 0;
      for (var r = 0; r < R - 1; r++) {
        var es = [];
        layers[r].forEach(function (v) { v.succ.forEach(function (w) { es.push([v.o, w.o]); }); });
        for (var i = 0; i < es.length; i++) for (var j = i + 1; j < es.length; j++) if ((es[i][0] - es[j][0]) * (es[i][1] - es[j][1]) < 0) c++;
      }
      return c;
    }
    function bary(v, list) { if (!list.length) return v.o; var s = 0; list.forEach(function (w) { s += w.o; }); return s / list.length + (v.g >= 0 ? v.g * 0.001 : 0); }
    setO();
    var best = layers.map(function (L) { return L.slice(); }), bestC = crossings();
    for (var it = 0; it < 18 && bestC > 0; it++) {
      if (it % 2 === 0) for (r = 1; r < R; r++) { layers[r].forEach(function (v) { v.b = bary(v, v.pred); }); layers[r].sort(function (a, b) { return a.b - b.b || a.o - b.o; }); layers[r].forEach(function (v, i) { v.o = i; }); }
      else for (r = R - 2; r >= 0; r--) { layers[r].forEach(function (v) { v.b = bary(v, v.succ); }); layers[r].sort(function (a, b) { return a.b - b.b || a.o - b.o; }); layers[r].forEach(function (v, i) { v.o = i; }); }
      var cc = crossings();
      if (cc < bestC) { bestC = cc; best = layers.map(function (L) { return L.slice(); }); }
    }
    layers = best; setO();

    /* primary axis */
    var T = layers.map(function (L) { return Math.max.apply(null, [0].concat(L.map(function (v) { return v.ps; }))); });
    var labGap = new Array(R).fill(0);
    chains.forEach(function (c) {
      if (!c.x.e.label) return;
      var L = D.label('el:f' + c.x.e.idx, esc(c.x.e.label), 'nm-dg-elabel', 300);
      var a = c.chain[0].r;
      labGap[a] = Math.max(labGap[a], (horiz ? L.w : L.h) + (horiz ? 44 : 40));
    });
    var sumT = T.reduce(function (s, v) { return s + v; }, 0);
    var baseGap = R > 1 ? clamp(((horiz ? D.W : D.H) - sumT) / (R - 1), 70, horiz ? 190 : 140) : 0;
    var gaps = [];
    for (r = 0; r < R - 1; r++) {
      var gg = Math.max(baseGap, labGap[r]);
      if (M.groups.length) {
        var boundary = M.groups.some(function (g, gi) { var a = layers[r].some(function (v) { return v.g === gi; }), b = layers[r + 1].some(function (v) { return v.g === gi; }); return a !== b; });
        if (boundary) gg += horiz ? 40 : 64;
      }
      gaps.push(gg);
    }
    var P = [], acc = 0;
    for (r = 0; r < R; r++) { P.push(acc + T[r] / 2); acc += T[r] + (gaps[r] || 0); }
    var Ptot = acc;
    V.forEach(function (v) { v.p = P[v.r]; });

    /* cross axis */
    function sep(a, b) {
      var s = (a.dummy || b.dummy) ? 22 : (horiz ? 44 : 48);
      if (a.g !== b.g && !(a.dummy || b.dummy)) s += (a.g >= 0 || b.g >= 0) ? 58 : 0;
      return a.cs / 2 + b.cs / 2 + s;
    }
    layers.forEach(function (L) { var c = 0; L.forEach(function (v, i) { if (i) c += sep(L[i - 1], v); v.c = c; }); var mid = c / 2; L.forEach(function (v) { v.c -= mid; }); });
    for (it = 0; it < 10; it++) {
      var down = it % 2 === 0;
      for (var k = 0; k < R; k++) {
        var rr = down ? k : R - 1 - k, L = layers[rr];
        var des = L.map(function (v) {
          var nb = down ? v.pred : v.succ;
          if (!nb.length) nb = down ? v.succ : v.pred;
          if (!nb.length) return v.c;
          var s = 0; nb.forEach(function (w) { s += w.c; }); return s / nb.length;
        });
        placeLayer(L, des, sep);
      }
    }
    var cmin = Infinity, cmax = -Infinity;
    V.forEach(function (v) { cmin = Math.min(cmin, v.c - v.cs / 2); cmax = Math.max(cmax, v.c + v.cs / 2); });
    V.forEach(function (v) { v.c -= cmin; });
    var Ctot = cmax - cmin;
    var map = mapper(dir, rtl, Ptot, Ctot), pv = primaryVec(dir);
    var ordList = V.filter(function (v) { return !v.dummy; }).sort(function (a, b) { return a.r - b.r || a.o - b.o; });
    ordList.forEach(function (v, i) { v.n.ord = i; });
    V.forEach(function (v) { if (v.dummy) return; var q = map(v.p, v.c); D.place(v.n, q.x, q.y); });

    /* groups (drawn behind) */
    M.groups.forEach(function (g, gi) {
      var mem = g.ids.map(function (id) { return M.byId[id]; }).filter(Boolean);
      if (!mem.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      mem.forEach(function (n) { x0 = Math.min(x0, n.x - n.w / 2); y0 = Math.min(y0, n.y - n.h / 2); x1 = Math.max(x1, n.x + n.w / 2); y1 = Math.max(y1, n.y + n.h / 2); });
      var padS = 28, padT = 60;
      x0 -= padS; x1 += padS; y0 -= padT; y1 += 26;
      D.shape('g' + gi, 'rect', { x: r1(x0), y: r1(y0), width: r1(x1 - x0), height: r1(y1 - y0), rx: 22, 'class': 'nm-dg-group' + (g.tone ? ' is-' + g.tone : '') }, D.gBack, { attach: mem });
      var GL = D.label('g' + gi, esc(g.name) + (g.sub ? ' <span>' + esc(g.sub) + '</span>' : ''), 'nm-dg-glabel', x1 - x0 - 40);
      D.put(GL, rtl ? x1 - 20 - GL.w / 2 : x0 + 20 + GL.w / 2, y0 + 16 + GL.h / 2, { attach: mem });
    });

    /* ports */
    function hopsOut(v) { return v.hopsOut || (v.hopsOut = []); }
    function hopsIn(v) { return v.hopsIn || (v.hopsIn = []); }
    var hops = [];
    chains.forEach(function (c) {
      c.hops = [];
      for (var k = 0; k < c.chain.length - 1; k++) {
        var hp = { a: c.chain[k], b: c.chain[k + 1], oa: 0, ob: 0, chain: c };
        c.hops.push(hp); hops.push(hp);
        hopsOut(hp.a).push(hp); hopsIn(hp.b).push(hp);
      }
    });
    V.forEach(function (v) {
      if (v.dummy) return;
      [['hopsOut', 'b', 'oa'], ['hopsIn', 'a', 'ob']].forEach(function (cfg) {
        var list = v[cfg[0]];
        if (!list || list.length < 2) return;
        list.sort(function (x, y) { return x[cfg[1]].c - y[cfg[1]].c; });
        var span = v.cs * (v.n.shape === 'circle' || v.n.shape === 'diamond' ? 0.4 : 0.62);
        var step = Math.min(24, span / (list.length - 1));
        list.forEach(function (hp, i) { hp[cfg[2]] = (i - (list.length - 1) / 2) * step; });
      });
    });
    /* snap almost-straight hops */
    hops.forEach(function (hp) {
      var ca = hp.a.c + hp.oa, cb = hp.b.c + hp.ob;
      if (Math.abs(ca - cb) < 10 && Math.abs(ca - cb) > 0) {
        var t = hp.a.dummy ? ca : hp.b.dummy ? cb : (ca + cb) / 2;
        if (!hp.a.dummy && Math.abs(t - hp.a.c) < hp.a.cs * 0.4) hp.oa = t - hp.a.c;
        if (!hp.b.dummy && Math.abs(t - hp.b.c) < hp.b.cs * 0.4) hp.ob = t - hp.b.c;
      }
    });
    /* channels */
    for (r = 0; r < R - 1; r++) {
      var g0 = P[r] + T[r] / 2, g1 = P[r + 1] - T[r + 1] / 2, mid = (g0 + g1) / 2;
      var turning = hops.filter(function (hp) { return hp.a.r === r && Math.abs((hp.a.c + hp.oa) - (hp.b.c + hp.ob)) > 1; });
      turning.forEach(function (hp) { var ca = hp.a.c + hp.oa, cb = hp.b.c + hp.ob; hp.key = cb > ca ? -ca : ca + 1e5; });
      turning.sort(function (x, y) { return x.key - y.key; });
      var cw = Math.min(18, (g1 - g0) * 0.5 / Math.max(1, turning.length));
      hops.forEach(function (hp) { if (hp.a.r === r) hp.ch = mid; });
      turning.forEach(function (hp, i) { hp.ch = mid + (i - (turning.length - 1) / 2) * cw; });
    }
    function portXY(v, off, sign) {
      var q = map(v.p, v.c + off);
      return exitPoint(v.n, q.x, q.y, pv.x * sign, pv.y * sign);
    }
    var eord = 0;
    chains.forEach(function (c) {
      var e = c.x.e, a = c.chain[0], b = c.chain[c.chain.length - 1];
      var sp = { from: a.n, to: b.n, arrow: e.arrow, style: e.style, label: e.label, eord: a.r * 1000 + e.idx, cls: e.style === 'thick' ? 'is-accent' : '' };
      if (edgeMode === 'straight') {
        sp.pts = [toward(a.n, b.n.x, b.n.y), toward(b.n, a.n.x, a.n.y)];
      } else if (edgeMode === 'curve') {
        var segs = [], prev = portXY(a, c.hops[0].oa, 1);
        c.hops.forEach(function (hp, k) {
          var endP = hp.b.dummy ? map(hp.b.p, hp.b.c) : portXY(hp.b, hp.ob, -1);
          var pa = hp.a.dummy ? hp.a.p : hp.a.p, pb = hp.b.p;
          var m1 = map((pa + pb) / 2, hp.a.c + hp.oa), m2 = map((pa + pb) / 2, hp.b.c + hp.ob);
          var c1 = horiz ? pt(m1.x, prev.y) : pt(prev.x, m1.y), c2 = horiz ? pt(m2.x, endP.y) : pt(endP.x, m2.y);
          segs.push([prev, c1, c2, endP]);
          prev = endP;
        });
        sp.bezs = segs;
      } else {
        var pts = [portXY(a, c.hops[0].oa, 1)];
        c.hops.forEach(function (hp) {
          var ca = hp.a.c + hp.oa, cb = hp.b.c + hp.ob;
          if (Math.abs(ca - cb) > 1) { pts.push(map(hp.ch, ca)); pts.push(map(hp.ch, cb)); }
          if (hp.b.dummy) pts.push(map(hp.b.p, cb));
        });
        pts.push(portXY(b, c.hops[c.hops.length - 1].ob, -1));
        sp.pts = pts;
      }
      D.edge('f' + e.idx, sp);
      eord++;
    });
    /* back edges: loop around the "after" side */
    var loopCount = {};
    loops.forEach(function (x, k) {
      var e = x.e, a = V[x.u], b = V[x.v];
      var lo = Math.min(a.r, b.r), hi = Math.max(a.r, b.r), cm = 0;
      V.forEach(function (v) { if (v.r >= lo && v.r <= hi) cm = Math.max(cm, v.c + v.cs / 2); });
      var Lc = cm + 46 + k * 26;
      loopCount[x.u] = (loopCount[x.u] || 0) + 1; loopCount[x.v] = (loopCount[x.v] || 0) + 1;
      var offA = (loopCount[x.u] - 1) * 22, offB = -(loopCount[x.v] - 1) * 22;
      var sv0 = map(a.p + offA, a.c), tv0 = map(b.p + offB, b.c), cvec = horiz ? pt(0, 1) : pt(rtl ? -1 : 1, 0);
      var S = exitPoint(a.n, sv0.x, sv0.y, cvec.x, cvec.y), Tt = exitPoint(b.n, tv0.x, tv0.y, cvec.x, cvec.y);
      var A1 = map(a.p + offA, Lc), B1 = map(b.p + offB, Lc);
      var sp = { from: a.n, to: b.n, arrow: e.arrow, style: e.style, label: e.label, eord: 1e6 + e.idx, cls: 'is-back' };
      if (edgeMode === 'curve') {
        var ext = map(0, Lc + 18), A2 = horiz ? pt(S.x, ext.y) : pt(ext.x, S.y), B2 = horiz ? pt(Tt.x, ext.y) : pt(ext.x, Tt.y);
        sp.bez = [S, A2, B2, Tt];
      } else sp.pts = [S, horiz ? pt(S.x, A1.y) : pt(A1.x, S.y), horiz ? pt(Tt.x, B1.y) : pt(B1.x, Tt.y), Tt];
      sp.radius = 22;
      D.edge('f' + e.idx, sp);
    });
    selfs.forEach(function (x) {
      var n = V[x.u].n, cvec = horiz ? pt(0, 1) : pt(rtl ? -1 : 1, 0);
      var q1 = map(V[x.u].p - 18, V[x.u].c), q2 = map(V[x.u].p + 18, V[x.u].c);
      var S = exitPoint(n, q1.x, q1.y, cvec.x, cvec.y), Tt = exitPoint(n, q2.x, q2.y, cvec.x, cvec.y);
      D.edge('f' + x.e.idx, { from: n, to: n, arrow: x.e.arrow, style: x.e.style, label: x.e.label, pts: [S, pt(S.x + cvec.x * 40, S.y + cvec.y * 40), pt(Tt.x + cvec.x * 40, Tt.y + cvec.y * 40), Tt], radius: 12, eord: 2e6 });
    });
  };

  /* tidy tree: subtree boxes, bus connectors */
  LAYOUTS.tree = function (M, D) {
    var cd = D.ctxDir('ttb'), dir = cd.dir, rtl = cd.rtl, horiz = dir === 'rtl' || dir === 'ltr';
    var nodes = M.nodes;
    if (!nodes.length) return;
    var edgeMode = (D.opt('edges', 'ortho') || 'ortho').toLowerCase();
    var parent = {}, kids = {}, extra = [];
    nodes.forEach(function (n) { kids[n.id] = []; });
    function isAnc(a, b) { while (b) { if (b === a) return true; b = parent[b]; } return false; }
    M.edges.forEach(function (e) {
      if (parent[e.to] == null && e.to !== e.from && !isAnc(e.to, e.from)) { parent[e.to] = e.from; kids[e.from].push({ id: e.to, e: e }); }
      else extra.push(e);
    });
    var roots = nodes.filter(function (n) { return parent[n.id] == null; });
    var depth = {}, maxD = 0, leaves = 0;
    function walk(id, d) { depth[id] = d; maxD = Math.max(maxD, d); if (!kids[id].length) leaves++; kids[id].forEach(function (k) { walk(k.id, d + 1); }); }
    roots.forEach(function (n) { walk(n.id, 0); });
    var maxW = horiz ? clamp((D.W - maxD * 90) / (maxD + 1), 140, 300) : clamp((D.W - (leaves - 1) * 28) / Math.max(1, leaves), 120, 300);
    nodes.forEach(function (n) { D.measure(n, maxW); });
    equalize(nodes, { ratio: 1.5 });
    var PS = function (n) { return horiz ? n.w : n.h; }, CS = function (n) { return horiz ? n.h : n.w; };
    var T = new Array(maxD + 1).fill(0);
    nodes.forEach(function (n) { T[depth[n.id]] = Math.max(T[depth[n.id]], PS(n)); });
    var sumT = T.reduce(function (s, v) { return s + v; }, 0);
    var gap = maxD ? clamp(((horiz ? D.W : D.H) - sumT) / maxD, 64, 150) : 0;
    var P = [], acc = 0;
    for (var d = 0; d <= maxD; d++) { P.push(acc + T[d] / 2); acc += T[d] + gap; }
    var Ptot = acc - gap;
    var SIB = horiz ? 22 : 28, SUB = horiz ? 30 : 44;
    var ext = {};
    function size(id) {
      var n = M.byId[id], ks = kids[id], s = 0;
      ks.forEach(function (k, i) { s += size(k.id) + (i ? (kids[k.id].length || kids[ks[i - 1].id].length ? SUB : SIB) : 0); });
      ext[id] = { kids: s, all: Math.max(CS(n), s) };
      return ext[id].all;
    }
    var cpos = {};
    function lay(id, start) {
      var ks = kids[id], e = ext[id], c0 = start + (e.all - e.kids) / 2;
      ks.forEach(function (k, i) { if (i) c0 += kids[k.id].length || kids[ks[i - 1].id].length ? SUB : SIB; lay(k.id, c0); c0 += ext[k.id].all; });
      cpos[id] = ks.length ? (cpos[ks[0].id] + cpos[ks[ks.length - 1].id]) / 2 : start + e.all / 2;
      if (!ks.length) cpos[id] = start + e.all / 2;
    }
    var cstart = 0;
    roots.forEach(function (n) { size(n.id); lay(n.id, cstart); cstart += ext[n.id].all + SUB * 1.5; });
    var Ctot = cstart - SUB * 1.5;
    var map = mapper(dir, rtl, Ptot, Ctot), pv = primaryVec(dir);
    var ord = 0;
    function order(id) { M.byId[id].ord = ord++; kids[id].forEach(function (k) { order(k.id); }); }
    roots.forEach(function (n) { order(n.id); });
    nodes.forEach(function (n) { n.rank = depth[n.id]; var q = map(P[depth[n.id]], cpos[n.id]); D.place(n, q.x, q.y); });
    nodes.forEach(function (n) {
      var ks = kids[n.id];
      if (!ks.length) return;
      var d0 = depth[n.id], chan = P[d0] + T[d0] / 2 + gap / 2;
      var start = exitPoint(n, n.x, n.y, pv.x, pv.y);
      ks.forEach(function (k) {
        var c = M.byId[k.id], e = k.e;
        var end = exitPoint(c, c.x, c.y, -pv.x, -pv.y);
        var sp = { from: n, to: c, arrow: e.implicit ? 'none' : e.arrow, style: e.style, label: e.label, eord: c.ord };
        if (edgeMode === 'curve') {
          var m = map(chan, 0), c1 = horiz ? pt(m.x, start.y) : pt(start.x, m.y), c2 = horiz ? pt(m.x, end.y) : pt(end.x, m.y);
          sp.bez = [start, c1, c2, end];
        } else if (edgeMode === 'straight') sp.pts = [toward(n, c.x, c.y), toward(c, n.x, n.y)];
        else {
          var mm = map(chan, 0);
          sp.pts = horiz ? [start, pt(mm.x, start.y), pt(mm.x, end.y), end] : [start, pt(start.x, mm.y), pt(end.x, mm.y), end];
          sp.radius = 14;
        }
        D.edge('t' + e.idx, sp);
      });
    });
    extra.forEach(function (e) {
      var a = M.byId[e.from], b = M.byId[e.to];
      var p0 = toward(a, b.x, b.y), p3 = toward(b, a.x, a.y), mx = (p0.x + p3.x) / 2, my = (p0.y + p3.y) / 2;
      var off = horiz ? pt(0, -60) : pt(60, 0);
      D.edge('t' + e.idx, { from: a, to: b, arrow: e.arrow, style: e.style === 'solid' ? 'dashed' : e.style, label: e.label, bez: [p0, pt(mx + off.x, p0.y + off.y), pt(mx + off.x, p3.y + off.y), p3], eord: 1e5 + e.idx });
    });
  };

  /* swimlanes: lanes as rows, columns from ranks */
  LAYOUTS.swimlane = function (M, D) {
    var rtl = D.ctxDir('row').rtl, nodes = M.nodes;
    if (!nodes.length) return;
    var lanes = M.lanes.slice(), laneOf = {};
    lanes.forEach(function (l, li) { l.ids.forEach(function (id) { if (laneOf[id] == null) laneOf[id] = li; }); });
    var stray = nodes.filter(function (n) { return laneOf[n.id] == null; });
    if (stray.length) { lanes.push({ name: '', sub: '', ids: stray.map(function (n) { return n.id; }) }); stray.forEach(function (n) { laneOf[n.id] = lanes.length - 1; }); }
    var G = rankGraph(M), col = {}, occ = {};
    var order = G.order.slice();
    nodes.forEach(function (n, i) { if (order.indexOf(i) < 0) order.push(i); });
    order.forEach(function (i) {
      var n = nodes[i], c = G.rank[i];
      G.dag.forEach(function (d) { if (d.b === i && col[nodes[d.a].id] != null) c = Math.max(c, col[nodes[d.a].id] + 1); });
      while (occ[laneOf[n.id] + ':' + c]) c++;
      occ[laneOf[n.id] + ':' + c] = 1; col[n.id] = c;
    });
    var ncol = 0;
    nodes.forEach(function (n) { ncol = Math.max(ncol, col[n.id] + 1); n.rank = col[n.id]; });
    var heads = lanes.map(function (l, li) { return D.label('lane' + li, '<b>' + esc(l.name) + '</b>' + (l.sub ? '<span>' + esc(l.sub) + '</span>' : ''), 'nm-dg-lanehead', 220); });
    var hw = Math.max.apply(null, heads.map(function (L) { return L.w; }).concat([120])) + 48;
    var areaW = D.W - hw;
    var maxW = clamp(areaW / ncol - 70, 120, 280);
    nodes.forEach(function (n) { D.measure(n, maxW); });
    equalize(nodes);
    var nw = Math.max.apply(null, nodes.map(function (n) { return n.w; }));
    var colW = Math.max(areaW / ncol, nw + 72);
    var laneH = lanes.map(function (l, li) {
      var hmax = 0; nodes.forEach(function (n) { if (laneOf[n.id] === li) hmax = Math.max(hmax, n.h); });
      return Math.max(hmax + 64, heads[li].h + 40);
    });
    var sumH = laneH.reduce(function (s, v) { return s + v; }, 0);
    if (sumH < D.H) { var extra = Math.min((D.H - sumH) / lanes.length, 120); laneH = laneH.map(function (v) { return v + extra; }); }
    var totalW = hw + colW * ncol, y = 0, laneY = [];
    var X = function (x) { return rtl ? totalW - x : x; };
    lanes.forEach(function (l, li) {
      laneY.push(y);
      var hgt = laneH[li];
      D.shape('lane' + li, 'rect', { x: 0, y: r1(y), width: r1(totalW), height: r1(hgt), 'class': 'nm-dg-lane' + (li % 2 ? ' is-alt' : '') });
      D.shape('lanehd' + li, 'rect', { x: r1(rtl ? totalW - hw : 0), y: r1(y), width: r1(hw), height: r1(hgt), 'class': 'nm-dg-lanehd' });
      D.put(heads[li], X(hw / 2), y + hgt / 2, false);
      y += hgt;
    });
    nodes.forEach(function (n) {
      var li = laneOf[n.id];
      D.place(n, X(hw + colW * (col[n.id] + 0.5)), laneY[li] + laneH[li] / 2);
    });
    var ordered = nodes.slice().sort(function (a, b) { return col[a.id] - col[b.id] || laneOf[a.id] - laneOf[b.id]; });
    ordered.forEach(function (n, i) { n.ord = i; });
    var fwd = rtl ? -1 : 1;
    M.edges.forEach(function (e) {
      var a = M.byId[e.from], b = M.byId[e.to];
      if (!a || !b || a === b) return;
      var ca = col[a.id], cb = col[b.id], pts;
      if (cb > ca) {
        var S = exitPoint(a, a.x, a.y, fwd, 0), Tt = exitPoint(b, b.x, b.y, -fwd, 0);
        var mx = X(hw + colW * (ca + 1));
        if (cb === ca + 1) mx = (S.x + Tt.x) / 2;
        pts = Math.abs(S.y - Tt.y) < 2 ? [S, Tt] : [S, pt(mx, S.y), pt(mx, Tt.y), Tt];
      } else {
        var down = b.y > a.y ? 1 : -1;
        var S2 = exitPoint(a, a.x, a.y, 0, down), T2 = exitPoint(b, b.x, b.y, 0, -down);
        if (ca === cb) pts = [S2, T2];
        else {
          var la = laneOf[a.id], ym = down > 0 ? laneY[la] + laneH[la] - 12 : laneY[la] + 12;
          if (la === laneOf[b.id]) { S2 = exitPoint(a, a.x, a.y, 0, 1); T2 = exitPoint(b, b.x, b.y, 0, 1); ym = laneY[la] + laneH[la] - 14; }
          pts = [S2, pt(S2.x, ym), pt(T2.x, ym), T2];
        }
      }
      D.edge('s' + e.idx, { from: a, to: b, arrow: e.arrow, style: e.style, label: e.label, pts: pts, eord: col[a.id] * 1000 + e.idx });
    });
  };

  function findEdge(M, a, b) { for (var i = 0; i < M.edges.length; i++) if (M.edges[i].from === a && M.edges[i].to === b) return M.edges[i]; return null; }

  LAYOUTS.cycle = function (M, D) {
    var nodes = M.nodes, N = nodes.length;
    if (!N) return;
    var ccw = /ccw|counter/.test(D.opt('dir', '') || '');
    var sg = ccw ? -1 : 1;
    var maxW = clamp(Math.min(D.W, D.H) * 0.34, 150, 280);
    nodes.forEach(function (n) { D.measure(n, maxW); });
    equalize(nodes, { ratio: 1.6 });
    var maxNW = Math.max.apply(null, nodes.map(function (n) { return n.w; })), maxNH = Math.max.apply(null, nodes.map(function (n) { return n.h; }));
    var diag = Math.max.apply(null, nodes.map(function (n) { return Math.hypot(n.w, n.h); }));
    var Rmin = N > 1 ? (diag + 70) / (2 * Math.sin(Math.PI / N)) : 0;
    var Rfit = Math.min(D.W - maxNW, D.H - maxNH) / 2 - 6;
    var CL = null;
    if (M.opts.center) {
      var cp = splitPipe(M.opts.center);
      CL = D.label('center', '<b>' + esc(cp.label) + '</b>' + (cp.sub ? '<span>' + esc(cp.sub) + '</span>' : ''), 'nm-dg-center', Math.max(180, Rfit * 0.9));
      Rmin = Math.max(Rmin, Math.hypot(CL.w, CL.h) / 2 + Math.max(maxNW, maxNH) / 2 + 40);
    }
    var R = Math.max(Rmin, Math.min(Rfit, 460));
    var cx = D.W / 2, cy = D.H / 2, step = 2 * Math.PI / N;
    nodes.forEach(function (n, i) {
      var a = -Math.PI / 2 + sg * i * step;
      n.ang = a; n.rank = i; n.ord = i;
      D.place(n, cx + R * Math.cos(a), cy + R * Math.sin(a));
    });
    if (CL) D.put(CL, cx, cy, { attach: nodes[0], fixed: true });
    D.shape('ring', 'circle', { cx: r1(cx), cy: r1(cy), r: r1(R), 'class': 'nm-dg-ring' });
    var gapA = 0.5 / R;
    function clearAngle(n, a, dirn) {
      var lo = 0, hi = step * 0.5;
      for (var k = 0; k < 30; k++) { var m = (lo + hi) / 2; if (inside(n, cx + R * Math.cos(a + dirn * m), cy + R * Math.sin(a + dirn * m))) lo = m; else hi = m; }
      return hi;
    }
    if (N < 2) return;
    nodes.forEach(function (n, i) {
      var m = nodes[(i + 1) % N];
      var e = findEdge(M, n.id, m.id) || { arrow: 'end', style: 'solid', label: '', idx: 1000 + i };
      var a0 = n.ang + sg * (clearAngle(n, n.ang, sg) + gapA);
      var a1 = n.ang + sg * step - sg * (clearAngle(m, m.ang, -sg) + gapA);
      if ((a1 - a0) * sg <= 0.02) return;
      D.edge('c' + i, { from: n, to: m, arrow: e.arrow, style: e.style, label: e.label, arc: { cx: cx, cy: cy, R: R, a0: a0, a1: a1 }, eord: i });
    });
  };

  LAYOUTS.hub = function (M, D) {
    var nodes = M.nodes;
    if (!nodes.length) return;
    var hub = null, c = M.opts.center;
    if (c) hub = M.byId[c] || nodes.filter(function (n) { return n.label === c; })[0];
    if (!hub && !c && M.edges.length) {
      var deg = {}; M.edges.forEach(function (e) { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; });
      hub = nodes.slice().sort(function (a, b) { return (deg[b.id] || 0) - (deg[a.id] || 0) || a.idx - b.idx; })[0];
    }
    if (!hub && c) hub = D.syn('_hub', { label: splitPipe(c).label, sub: splitPipe(c).sub, shape: 'circle', tone: ['accent'] });
    if (!hub) hub = nodes[0];
    var spokes = nodes.filter(function (n) { return n !== hub; }), K = spokes.length;
    if (hub.shapeAuto || hub.id === '_hub') hub.shape = 'circle';
    D.measure(hub, 280);
    var maxW = clamp(D.W / (K > 6 ? 4.6 : 3.8), 150, 300);
    spokes.forEach(function (n) { D.measure(n, maxW); });
    equalize(spokes, { ratio: 1.6 });
    var mw = Math.max.apply(null, spokes.map(function (n) { return n.w; }).concat([0])), mh = Math.max.apply(null, spokes.map(function (n) { return n.h; }).concat([0]));
    var rx = Math.max((D.W - mw) / 2 - 6, hub.w / 2 + mw / 2 + 90), ry = Math.max((D.H - mh) / 2 - 6, hub.h / 2 + mh / 2 + 56);
    var cx = D.W / 2, cy = D.H / 2, step = 2 * Math.PI / Math.max(1, K);
    var start = -Math.PI / 2 + (K % 2 === 0 ? step / 2 : 0);
    if (K === 2) start = 0;
    var pos = function (s) { return spokes.map(function (n, i) { var a = start + i * step; return pt(cx + rx * s * Math.cos(a), cy + ry * s * Math.sin(a)); }); };
    var s = 1, ps = pos(1);
    for (var it = 0; it < 12; it++) {
      var bad = false;
      for (var i = 0; i < K && !bad; i++) for (var j = i + 1; j < K; j++) {
        var A = spokes[i], B = spokes[j];
        if (Math.abs(ps[i].x - ps[j].x) < (A.w + B.w) / 2 + 24 && Math.abs(ps[i].y - ps[j].y) < (A.h + B.h) / 2 + 20) { bad = true; break; }
      }
      if (!bad) break;
      s *= 1.12; ps = pos(s);
    }
    hub.rank = 0; hub.ord = 0;
    D.place(hub, cx, cy);
    spokes.forEach(function (n, i) { n.rank = 1 + (D.opt('steps') === 'rank' ? 0 : i); n.ord = i + 1; D.place(n, ps[i].x, ps[i].y); });
    spokes.forEach(function (n, i) {
      var e = findEdge(M, hub.id, n.id), rev = false;
      if (!e) { e = findEdge(M, n.id, hub.id); rev = !!e; }
      e = e || { arrow: 'none', style: 'solid', label: '', idx: 500 + i };
      var a = rev ? n : hub, b = rev ? hub : n;
      D.edge('h' + i, { from: a, to: b, arrow: e.arrow, style: e.style, label: e.label, pts: [toward(a, b.x, b.y), toward(b, a.x, a.y)], eord: i });
    });
    M.edges.forEach(function (e) {
      if (e.from === hub.id || e.to === hub.id) return;
      var a = M.byId[e.from], b = M.byId[e.to];
      D.edge('x' + e.idx, { from: a, to: b, arrow: e.arrow, style: e.style, label: e.label, pts: [toward(a, b.x, b.y), toward(b, a.x, a.y)], eord: 100 + e.idx });
    });
  };

  LAYOUTS.sequence = function (M, D) {
    var rtl = D.ctxDir('row').rtl;
    var ids = M.opts.actors && M.opts.actors.length ? M.opts.actors.slice() : [];
    M.nodes.forEach(function (n) { if (ids.indexOf(n.id) < 0) ids.push(n.id); });
    var actors = ids.map(function (id) { return M.byId[id]; }), K = actors.length;
    if (!K) return;
    var msgs = M.edges, m = msgs.length;
    var maxW = clamp(D.W / K - 48, 130, 280);
    actors.forEach(function (n) { D.measure(n, maxW); });
    equalize(actors, { ratio: 3 });
    var aw = actors[0].w, ah = Math.max.apply(null, actors.map(function (n) { return n.h; }));
    var span = Math.max(D.W - aw, (K - 1) * (aw + 40));
    var xs = actors.map(function (n, i) { var x = aw / 2 + (K > 1 ? span * i / (K - 1) : span / 2); return rtl ? aw + span - x : x; });
    var rowH = clamp((D.H - ah - 70) / Math.max(1, m), 74, 130);
    var top = ah + 34, bottom = top + rowH * m + 26;
    actors.forEach(function (n, i) {
      n.rank = 0; n.ord = i;
      D.place(n, xs[i], ah / 2);
      D.shape('life' + i, 'line', { x1: r1(xs[i]), y1: r1(ah), x2: r1(xs[i]), y2: r1(bottom), 'class': 'nm-dg-lifeline' }, D.gBack, { attach: n });
    });
    var pos = {}; actors.forEach(function (n, i) { pos[n.id] = xs[i]; });
    msgs.forEach(function (e, k) {
      var y = top + rowH * (k + 0.62), xa = pos[e.from], xb = pos[e.to], pts;
      if (xa == null || xb == null) return;
      if (e.from === e.to) { var o = rtl ? -64 : 64; pts = [pt(xa, y - 16), pt(xa + o, y - 16), pt(xa + o, y + 18), pt(xa, y + 18)]; }
      else pts = [pt(xa, y), pt(xb, y)];
      D.edge('q' + k, { from: null, to: null, free: true, arrow: e.arrow, style: e.style, label: e.label, labelCls: 'is-above', pts: pts, radius: 10, eord: k, seq: k, labelAbove: true });
    });
    D.stepHint = 'edge';
  };

  /* ------------------------------------------------------------------ layouts: structured data */
  function itemNodes(D, M, prefix, props) {
    return M.items.map(function (it, i) {
      var p = { label: it.label, sub: it.sub, shape: 'rect', tone: it.accent ? ['accent'] : [] };
      for (var k in props) p[k] = props[k];
      var n = D.syn(prefix + i, p);
      n.item = it; n.rank = i; n.ord = i;
      return n;
    });
  }

  LAYOUTS.timeline = function (M, D) {
    var cd = D.ctxDir('row'), rtl = cd.rtl, vertical = cd.dir === 'ttb' || cd.dir === 'btt';
    var nodes = itemNodes(D, M, 't', { cls: 'nm-dg-card' }), n = nodes.length;
    if (!n) return;
    var W = D.W, H = D.H;
    if (!vertical) {
      var margin = 24, step = (W - 2 * margin) / n;
      var oneSide = false, cardMax = Math.min(420, step * 2 - 40);
      nodes.forEach(function (nd) { D.measure(nd, cardMax); });
      if (Math.max.apply(null, nodes.map(function (nd) { return nd.w; })) <= step - 28 || n <= 2) {
        oneSide = true;
        nodes.forEach(function (nd) { D.measure(nd, Math.min(420, step - 28)); });
      }
      equalize(nodes, { ratio: 1.4 });
      var mh = Math.max.apply(null, nodes.map(function (nd) { return nd.h; }));
      var stem = 60, axisY = oneSide ? mh + stem + 10 : H / 2;
      var xs = nodes.map(function (nd, i) { var x = margin + step * (i + 0.5); return rtl ? W - x : x; });
      var a0 = rtl ? W - 4 : 4, a1 = rtl ? 4 : W - 4;
      D.edge('axis', { pts: [pt(a0, axisY), pt(a1, axisY)], arrow: 'end', style: 'solid', free: true, fixed: true, cls: 'nm-dg-axisline', flow: false });
      nodes.forEach(function (nd, i) {
        var up = oneSide || i % 2 === 0, x = xs[i];
        var cy = up ? axisY - stem - nd.h / 2 : axisY + stem + nd.h / 2;
        D.place(nd, x, cy);
        var acc = nd.item.accent;
        D.shape('stem' + i, 'line', { x1: r1(x), y1: r1(axisY + (up ? -11 : 11)), x2: r1(x), y2: r1(up ? cy + nd.h / 2 : cy - nd.h / 2), 'class': 'nm-dg-stem' }, D.gBack, { attach: nd });
        D.shape('dot' + i, 'circle', { cx: r1(x), cy: r1(axisY), r: acc ? 11 : 8, 'class': 'nm-dg-dot' + (acc ? ' is-accent' : '') }, D.gFront, { attach: nd });
        if (nd.item.key) {
          var L = D.label('date' + i, esc(nd.item.key), 'nm-dg-date' + (acc ? ' is-accent' : ''), step * 1.6);
          D.put(L, x, axisY + (up ? 1 : -1) * (24 + L.h / 2), { attach: nd });
        }
      });
    } else {
      var mg = 10, stepV = (H - 2 * mg) / n, colW = W / 2 - 110;
      nodes.forEach(function (nd) { D.measure(nd, Math.min(460, colW)); });
      equalize(nodes, { ratio: 1.4 });
      var ax = W / 2;
      var ys = nodes.map(function (nd, i) { return mg + stepV * (i + 0.5); });
      D.edge('axis', { pts: [pt(ax, 2), pt(ax, H - 2)], arrow: 'end', style: 'solid', free: true, fixed: true, cls: 'nm-dg-axisline', flow: false });
      nodes.forEach(function (nd, i) {
        var startSide = i % 2 === 0, sgn = (startSide ? 1 : -1) * (rtl ? 1 : -1), y = ys[i];
        var cx = ax + sgn * (70 + nd.w / 2);
        D.place(nd, cx, y);
        var acc = nd.item.accent;
        D.shape('stem' + i, 'line', { x1: r1(ax + sgn * 11), y1: r1(y), x2: r1(cx - sgn * nd.w / 2), y2: r1(y), 'class': 'nm-dg-stem' }, D.gBack, { attach: nd });
        D.shape('dot' + i, 'circle', { cx: r1(ax), cy: r1(y), r: acc ? 11 : 8, 'class': 'nm-dg-dot' + (acc ? ' is-accent' : '') }, D.gFront, { attach: nd });
        if (nd.item.key) {
          var L = D.label('date' + i, esc(nd.item.key), 'nm-dg-date' + (acc ? ' is-accent' : ''), 260);
          D.put(L, ax - sgn * (26 + L.w / 2), y, { attach: nd });
        }
      });
    }
  };

  LAYOUTS.layers = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H, items = M.items, n = items.length;
    if (!n) return;
    var sides = items.map(function (it, i) {
      return D.label('side' + i, '<b>' + esc(it.key || it.label) + '</b>' + (it.keySub ? '<span>' + esc(it.keySub) + '</span>' : ''), 'nm-dg-side' + (it.accent ? ' is-accent' : ''), 300);
    });
    var sideW = Math.max.apply(null, sides.map(function (L) { return L.w; })) + 36;
    var bandW = W - sideW, gap = 14, chipGap = 18, padX = 28;
    var rows = items.map(function (it, i) {
      var list = it.key ? it.raw.split(/\s*[,،]\s*/).filter(Boolean) : [];
      var chips = list.map(function (txt, j) {
        var sp = splitPipe(txt);
        var nd = D.syn('c' + i + '_' + j, { label: sp.label, sub: sp.sub, shape: 'rect', cls: 'nm-dg-chip', tone: it.accent ? ['accent-soft'] : [] });
        nd.rank = i; nd.ord = i * 100 + j;
        D.measure(nd, Math.max(140, (bandW - 2 * padX) / 2.2));
        return nd;
      });
      var lines = [[]], lw = 0;
      chips.forEach(function (c) {
        if (lines[lines.length - 1].length && lw + c.w > bandW - 2 * padX) { lines.push([]); lw = 0; }
        lines[lines.length - 1].push(c); lw += c.w + chipGap;
      });
      var ch = chips.length ? Math.max.apply(null, chips.map(function (c) { return c.h; })) : 0;
      chips.forEach(function (c) { c.h = ch; });
      return { chips: chips, lines: lines, ch: ch, h: Math.max(lines.length * ch + (lines.length - 1) * 14 + 44, sides[i].h + 32) };
    });
    var total = rows.reduce(function (s, r) { return s + r.h; }, 0) + gap * (n - 1);
    if (total < H) { var add = Math.min((H - total) / n, 70); rows.forEach(function (r) { r.h += add; }); }
    var y = 0, bx = rtl ? 0 : sideW;
    rows.forEach(function (row, i) {
      var it = items[i];
      var band = D.shape('band' + i, 'rect', { x: r1(bx), y: r1(y), width: r1(bandW), height: r1(row.h), rx: 16, 'class': 'nm-dg-band' + (it.accent ? ' is-accent' : '') + ' t' + (i % 4) }, D.gBack, row.chips.length ? { attach: row.chips } : { seq: i });
      D.put(sides[i], rtl ? W - sides[i].w / 2 : sides[i].w / 2, y + row.h / 2, row.chips.length ? { attach: row.chips } : { seq: i });
      var lh = row.lines.length * row.ch + (row.lines.length - 1) * 14, ly = y + (row.h - lh) / 2 + row.ch / 2;
      row.lines.forEach(function (line) {
        var lw = line.reduce(function (s, c) { return s + c.w; }, 0) + chipGap * (line.length - 1);
        var x = bx + (bandW - lw) / 2;
        if (rtl) line = line.slice().reverse();
        line.forEach(function (c) { D.place(c, x + c.w / 2, ly); x += c.w + chipGap; });
        ly += row.ch + 14;
      });
      y += row.h + gap;
    });
  };

  LAYOUTS.matrix = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H, o = M.opts;
    var xa = splitAll(o.x), ya = splitAll(o.y), quads = splitAll(o.quad);
    var top = ya[0] ? 64 : 24, bottom = 96, side = 40;
    var pw = W - 2 * side, ph = H - top - bottom;
    if (pw > ph * 1.7) pw = ph * 1.7;
    var px0 = (W - pw) / 2, py0 = top, px1 = px0 + pw, py1 = py0 + ph;
    var xs = function (v) { return rtl ? px1 - v * pw : px0 + v * pw; }, ys = function (v) { return py1 - v * ph; };
    D.shape('frame', 'rect', { x: r1(px0), y: r1(py0), width: r1(pw), height: r1(ph), rx: 18, 'class': 'nm-dg-plot' });
    D.shape('qv', 'line', { x1: r1((px0 + px1) / 2), y1: r1(py0 + 10), x2: r1((px0 + px1) / 2), y2: r1(py1 - 10), 'class': 'nm-dg-divider' });
    D.shape('qh', 'line', { x1: r1(px0 + 10), y1: r1((py0 + py1) / 2), x2: r1(px1 - 10), y2: r1((py0 + py1) / 2), 'class': 'nm-dg-divider' });
    var obstacles = [];
    var qpos = [[1, 1], [0, 1], [1, 0], [0, 0]];
    quads.forEach(function (q, i) {
      if (!q || i > 3) return;
      var hi = qpos[i], inStart = hi[0] === 1;
      var L = D.label('quad' + i, esc(q), 'nm-dg-quad', pw / 2 - 48);
      var qx = (inStart === rtl) ? px1 - 22 - L.w / 2 : px0 + 22 + L.w / 2;
      var qy = hi[1] ? py0 + 20 + L.h / 2 : py1 - 20 - L.h / 2;
      D.put(L, qx, qy, false);
      obstacles.push({ x: qx - L.w / 2 - 8, y: qy - L.h / 2 - 8, w: L.w + 16, h: L.h + 16 });
    });
    D.edge('xaxis', { pts: [pt(xs(0), py1 + 26), pt(xs(1), py1 + 26)], arrow: 'end', style: 'solid', free: true, fixed: true, cls: 'nm-dg-axisline', flow: false });
    D.edge('yaxis', { pts: [pt(rtl ? px1 + 22 : px0 - 22, py1), pt(rtl ? px1 + 22 : px0 - 22, py0)], arrow: 'end', style: 'solid', free: true, fixed: true, cls: 'nm-dg-axisline', flow: false });
    if (xa[0]) { var XT = D.label('xt', esc(xa[0]), 'nm-dg-axtitle', pw * 0.6); D.put(XT, (px0 + px1) / 2, py1 + 62, false); }
    if (xa[1]) { var XL = D.label('xl', esc(xa[1]), 'nm-dg-axend', 260); D.put(XL, rtl ? px1 - XL.w / 2 : px0 + XL.w / 2, py1 + 62, false); }
    if (xa[2]) { var XH = D.label('xh', esc(xa[2]), 'nm-dg-axend', 260); D.put(XH, rtl ? px0 + XH.w / 2 : px1 - XH.w / 2, py1 + 62, false); }
    if (ya[0]) { var YT = D.label('yt', esc(ya[0]) + (ya[2] ? ' <span>' + esc(ya[2]) + '</span>' : ''), 'nm-dg-axtitle', pw * 0.6); D.put(YT, rtl ? px1 + 22 - YT.w / 2 + 14 : px0 - 22 + YT.w / 2 - 14, py0 - 18 - YT.h / 2, false); }
    if (ya[1]) { var YL = D.label('yl', esc(ya[1]), 'nm-dg-axend is-small', 200); D.put(YL, rtl ? px1 - 12 - YL.w / 2 : px0 + 12 + YL.w / 2, py1 - 12 - YL.h / 2, false); obstacles.push({ x: YL.x - YL.w / 2, y: YL.y - YL.h / 2, w: YL.w, h: YL.h }); }
    var nodes = M.items.map(function (it, i) {
      var v = it.raw.split(/\s*[,،]\s*/).map(parseNum);
      var nd = D.syn('m' + i, { label: it.key || it.label, sub: it.key ? '' : it.sub, shape: 'pill', cls: 'nm-dg-pin', tone: it.accent ? ['accent'] : [] });
      nd.rank = i; nd.ord = i;
      D.measure(nd, 260);
      var vx = clamp(isNaN(v[0]) ? 0.5 : (v[0] > 1 ? v[0] / 100 : v[0]), 0, 1), vy = clamp(isNaN(v[1]) ? 0.5 : (v[1] > 1 ? v[1] / 100 : v[1]), 0, 1);
      nd.tx = xs(vx); nd.ty = ys(vy); nd.x = nd.tx; nd.y = nd.ty;
      return nd;
    });
    for (var it = 0; it < 80; it++) {
      var moved = false;
      nodes.forEach(function (a, i) {
        nodes.forEach(function (b, j) {
          if (j <= i) return;
          var ox = (a.w + b.w) / 2 + 14 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 + 12 - Math.abs(a.y - b.y);
          if (ox > 0 && oy > 0) {
            moved = true;
            if (oy < ox) { var s = a.y < b.y || (a.y === b.y && i < j) ? -1 : 1; a.y += s * oy / 2; b.y -= s * oy / 2; }
            else { var s2 = a.x < b.x ? -1 : 1; a.x += s2 * ox / 2; b.x -= s2 * ox / 2; }
          }
        });
        obstacles.forEach(function (r) {
          var ox = Math.min(a.x + a.w / 2, r.x + r.w) - Math.max(a.x - a.w / 2, r.x), oy = Math.min(a.y + a.h / 2, r.y + r.h) - Math.max(a.y - a.h / 2, r.y);
          if (ox > 0 && oy > 0) { moved = true; a.y += (a.y < r.y + r.h / 2 ? -1 : 1) * (oy + 1); }
        });
        a.x = clamp(a.x, px0 + a.w / 2 + 8, px1 - a.w / 2 - 8); a.y = clamp(a.y, py0 + a.h / 2 + 8, py1 - a.h / 2 - 8);
      });
      if (!moved) break;
    }
    nodes.forEach(function (nd) { D.place(nd, nd.x, nd.y); });
  };
  function splitAll(s) { return s ? String(s).split('|').map(function (x) { return x.trim(); }) : []; }

  function stackLayout(M, D, kind) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H, items = M.items, n = items.length;
    if (!n) return;
    var shapeW = clamp(W * 0.46, 260, 880), gapX = 64, textW = W - shapeW - gapX;
    var vals = items.map(function (it) { return it.key ? parseNum(it.label) : NaN; });
    var hasVals = kind === 'funnel' && vals.every(function (v) { return !isNaN(v); });
    var nodes = items.map(function (it, i) {
      var nd = D.syn('k' + i, { label: it.key || it.label, sub: it.key ? (kind === 'funnel' && hasVals ? it.sub : (hasVals ? it.sub : [it.label, it.sub].filter(Boolean).join(' - '))) : it.sub, shape: 'plain', cls: 'nm-dg-sidenode', tone: it.accent ? ['accent'] : [] });
      nd.rank = i; nd.ord = i; nd.item = it;
      D.measure(nd, Math.max(180, textW));
      return nd;
    });
    var tw = Math.max.apply(null, nodes.map(function (nd) { return nd.w; }));
    nodes.forEach(function (nd) { nd.w = tw; });
    var gap = 8, bandH = clamp((H - gap * (n - 1)) / n, 64, 150);
    bandH = Math.max(bandH, Math.max.apply(null, nodes.map(function (nd) { return nd.h; })) + 8);
    var Ht = bandH * n + gap * (n - 1);
    var sx0 = rtl ? 0 : W - shapeW, scx = sx0 + shapeW / 2;
    var tx1 = rtl ? W : tw, anyAcc = items.some(function (it) { return it.accent; });
    var max0 = hasVals ? Math.max.apply(null, vals) : 1;
    function widthAt(i, bottom) {
      if (kind === 'pyramid') { var y = i * (bandH + gap) + (bottom ? bandH : 0); return shapeW * Math.max(0.0, y / Ht); }
      if (hasVals) { var v = bottom ? (i + 1 < n ? vals[i + 1] : vals[i] * 0.8) : vals[i]; return shapeW * Math.max(0.2, v / max0); }
      var t = (i + (bottom ? 1 : 0)) / n; return shapeW * (1 - 0.68 * t);
    }
    items.forEach(function (it, i) {
      var y0 = i * (bandH + gap), wt = widthAt(i, false), wb = widthAt(i, true);
      var ptsS = [[scx - wt / 2, y0], [scx + wt / 2, y0], [scx + wb / 2, y0 + bandH], [scx - wb / 2, y0 + bandH]].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ');
      var shade = anyAcc ? (it.accent ? ' is-accent' : ' is-neutral') : ' g' + Math.min(5, Math.round(i * 5 / Math.max(1, n - 1)));
      D.shape('band' + i, 'polygon', { points: ptsS, 'class': 'nm-dg-tier' + shade }, D.gBack, { attach: nodes[i] });
      var nd = nodes[i], cy = y0 + bandH / 2;
      var tcx = rtl ? tx1 - tw / 2 : tw / 2;
      D.place(nd, tcx, cy);
      var wm = (wt + wb) / 2, edgeX = rtl ? scx + wm / 2 : scx - wm / 2, nodeEdge = rtl ? tcx - tw / 2 : tcx + tw / 2;
      D.shape('lead' + i, 'line', { x1: r1(edgeX + (rtl ? 10 : -10)), y1: r1(cy), x2: r1(nodeEdge + (rtl ? -14 : 14)), y2: r1(cy), 'class': 'nm-dg-leader' }, D.gBack, { attach: nd });
      if (hasVals || (kind === 'pyramid' && D.opt('numbers', 'on') !== 'off')) {
        var txt = hasVals ? esc(it.label) : withDigits(String(i + 1), digitSystem(it.key + it.label) || (rtl ? AR_DIG : null));
        var V = D.label('val' + i, txt, 'nm-dg-tierval' + ((anyAcc ? it.accent : Math.round(i * 5 / Math.max(1, n - 1)) <= 2) ? ' is-on-fill' : '') + (hasVals ? ' nm-dg-count' : ''), 300);
        if (hasVals) V.el.setAttribute('data-count', it.label);
        var room = kind === 'pyramid' ? widthAt(i, false) * 0.5 + widthAt(i, true) * 0.5 : wm;
        if (room > V.w + 24 && bandH > V.h + 4) D.put(V, scx, cy + (kind === 'pyramid' && i === 0 ? bandH * 0.18 : 0), { attach: nd });
        else { V.el.classList.remove('is-on-fill'); D.put(V, rtl ? edgeX - 0 + 0 : edgeX, cy, false); V.el.style.display = 'none'; }
      }
    });
  }
  LAYOUTS.funnel = function (M, D) { stackLayout(M, D, 'funnel'); };
  LAYOUTS.pyramid = function (M, D) { stackLayout(M, D, 'pyramid'); };

  LAYOUTS.venn = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H;
    var sets = M.items.filter(function (it) { return !/[&∩+]/.test(it.key); });
    var inter = M.items.filter(function (it) { return /[&∩+]/.test(it.key); });
    if (sets.length > 3) { warn(D.id + ': venn supports 2-3 sets; extra sets ignored'); sets = sets.slice(0, 3); }
    var k = sets.length;
    if (k < 2) { warn(D.id + ': venn needs at least 2 sets (lines like "a: name")'); if (!k) return; }
    var r = k === 3 ? Math.min(H * 0.34, W * 0.24) : Math.min(H * 0.44, W * 0.27);
    var cx = W / 2, cy = H / 2, centers;
    var sgn = rtl ? 1 : -1;
    if (k === 2) centers = [pt(cx + sgn * r * 0.56, cy), pt(cx - sgn * r * 0.56, cy)];
    else if (k === 3) { var d = r * 0.64; centers = [-30, -150, 90].map(function (a) { a = a * Math.PI / 180; return pt(cx + sgn * d * Math.cos(a), cy + d * Math.sin(a) + r * 0.08); }); }
    else centers = [pt(cx, cy)];
    var cen = centers.reduce(function (s, p) { return pt(s.x + p.x / k, s.y + p.y / k); }, pt(0, 0));
    var idmap = {};
    sets.forEach(function (it, i) {
      idmap[it.key] = i;
      var c = centers[i];
      var u = unit(cen.x, cen.y, c.x, c.y);
      if (k === 1) u = pt(0, 0);
      var nd = D.syn('v' + i, { label: it.label, sub: it.sub, shape: 'plain', cls: 'nm-dg-setlabel s' + i, tone: it.accent ? ['accent'] : [] });
      nd.rank = i; nd.ord = i;
      D.measure(nd, r * (k === 3 ? 0.78 : 0.7));
      D.place(nd, c.x + u.x * r * 0.5, c.y + u.y * r * (k === 3 ? 0.52 : 0.5));
      D.shape('set' + i, 'circle', { cx: r1(c.x), cy: r1(c.y), r: r1(r), 'class': 'nm-dg-set s' + i + (it.accent ? ' is-accent' : '') }, D.gBack, { attach: nd });
    });
    inter.forEach(function (it, j) {
      var keys = it.key.split(/\s*[&∩+]\s*/), ids = keys.map(function (q) { return idmap[q]; }).filter(function (v) { return v != null; });
      if (ids.length < 2) { warn(D.id + ': intersection "' + it.key + '" names unknown sets'); return; }
      var p;
      if (ids.length >= 3 || k === 2) p = ids.length >= 3 ? cen : pt((centers[ids[0]].x + centers[ids[1]].x) / 2, (centers[ids[0]].y + centers[ids[1]].y) / 2);
      else {
        var mid = pt((centers[ids[0]].x + centers[ids[1]].x) / 2, (centers[ids[0]].y + centers[ids[1]].y) / 2);
        var third = centers[[0, 1, 2].filter(function (q) { return ids.indexOf(q) < 0; })[0]], u = unit(third.x, third.y, mid.x, mid.y);
        p = pt(mid.x + u.x * r * 0.3, mid.y + u.y * r * 0.3);
      }
      var nd = D.syn('vi' + j, { label: it.label, sub: it.sub, shape: 'plain', cls: 'nm-dg-interlabel', tone: it.accent ? ['accent'] : [] });
      nd.rank = k + j; nd.ord = k + j;
      D.measure(nd, r * (ids.length >= 3 ? 0.42 : (k === 2 ? 0.5 : 0.44)));
      D.place(nd, p.x, p.y);
    });
  };

  LAYOUTS.compare = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H;
    var head = splitAll(M.opts.head), acc = M.opts.headAccent;
    var crits = M.items.map(function (it, i) { return D.label('crit' + i, esc(it.key), 'nm-dg-crit' + (it.accent ? ' is-accent' : ''), 240); });
    var spineW = clamp(Math.max.apply(null, crits.map(function (L) { return L.w; }).concat([80])) + 56, 150, 300);
    var colW = (W - spineW) / 2 - 8;
    var xA = rtl ? W - colW / 2 : colW / 2, xB = rtl ? colW / 2 : W - colW / 2, xs = W / 2;
    var y = 0, hn = [];
    if (head.length) {
      hn = [0, 1].map(function (c) {
        var nd = D.syn('h' + c, { label: head[c] || '', shape: 'rect', cls: 'nm-dg-colhead', tone: acc === c ? ['accent'] : ['strong'] });
        nd.rank = 0; nd.ord = c;
        D.measure(nd, colW); nd.w = colW; return nd;
      });
      var hh = Math.max(hn[0].h, hn[1].h); hn.forEach(function (nd) { nd.h = hh; });
      D.place(hn[0], xA, hh / 2); D.place(hn[1], xB, hh / 2);
      y = hh + 22;
    }
    var rows = M.items.map(function (it, i) {
      var a = D.syn('a' + i, { label: it.label, shape: 'rect', cls: 'nm-dg-cell', tone: acc === 0 ? ['accent-soft'] : [] });
      var b = D.syn('b' + i, { label: it.sub, shape: 'rect', cls: 'nm-dg-cell', tone: acc === 1 ? ['accent-soft'] : [] });
      [a, b].forEach(function (nd, c) { nd.rank = i + 1; nd.ord = 2 + i * 2 + c; D.measure(nd, colW); nd.w = colW; });
      var rh = Math.max(a.h, b.h, crits[i].h + 16); a.h = b.h = rh;
      return { a: a, b: b, h: rh };
    });
    var n = rows.length, sumH = rows.reduce(function (s, r) { return s + r.h; }, 0);
    var rg = n > 1 ? clamp((H - y - sumH) / (n - 1), 14, 40) : 0;
    var y0 = y;
    rows.forEach(function (r, i) {
      var cy = y + r.h / 2;
      D.place(r.a, xA, cy); D.place(r.b, xB, cy);
      var C = crits[i];
      D.shape('tA' + i, 'line', { x1: r1(xs + (rtl ? 1 : -1) * C.w / 2), y1: r1(cy), x2: r1(rtl ? xA - colW / 2 : xA + colW / 2), y2: r1(cy), 'class': 'nm-dg-tie' }, D.gBack, { attach: [r.a, r.b] });
      D.shape('tB' + i, 'line', { x1: r1(xs - (rtl ? 1 : -1) * C.w / 2), y1: r1(cy), x2: r1(rtl ? xB + colW / 2 : xB - colW / 2), y2: r1(cy), 'class': 'nm-dg-tie' }, D.gBack, { attach: [r.a, r.b] });
      D.put(C, xs, cy, { attach: [r.a, r.b] });
      y += r.h + rg;
    });
    D.shape('spine', 'line', { x1: r1(xs), y1: r1(head.length ? 0 : y0), x2: r1(xs), y2: r1(y - rg), 'class': 'nm-dg-spine' });
  };

  /* ------------------------------------------------------------------ layouts: small charts */
  function chartItems(M) {
    return M.items.filter(function (it) { return it.key || it.label; }).map(function (it) {
      var lab = it.key ? it.key : it.label, raw = it.key ? it.label : '';
      return { label: lab, raw: raw, value: parseNum(raw), sub: it.sub, accent: it.accent };
    });
  }
  function unitText(raw, unit) { return unit && raw.indexOf(unit) < 0 ? raw + unit : raw; }
  function countLabel(D, key, raw, cls, maxW) {
    var L = D.label(key, esc(raw), cls + ' nm-dg-count', maxW);
    L.el.setAttribute('data-count', raw);
    return L;
  }

  LAYOUTS.bars = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H;
    var data = chartItems(M), n = data.length, unit = M.opts.unit || '';
    if (!n) return;
    var orient = (D.opt('orient', M.opts.orient || 'h') || 'h').charAt(0).toLowerCase();
    var any = data.some(function (d) { return d.accent; });
    var lo = Math.min(0, Math.min.apply(null, data.map(function (d) { return d.value || 0; }))), hi = Math.max(0, Math.max.apply(null, data.map(function (d) { return d.value || 0; })));
    if (hi === lo) hi = lo + 1;
    if (orient !== 'v') {
      var labs = data.map(function (d, i) { return D.label('bl' + i, esc(d.label) + (d.sub ? '<span>' + esc(d.sub) + '</span>' : ''), 'nm-dg-blabel' + (d.accent ? ' is-accent' : ''), W * 0.32); });
      var vals = data.map(function (d, i) { return countLabel(D, 'bv' + i, unitText(d.raw, unit), 'nm-dg-bvalue' + (d.accent || !any ? ' is-accent' : ''), 260); });
      var labW = Math.max.apply(null, labs.map(function (L) { return L.w; })), valW = Math.max.apply(null, vals.map(function (L) { return L.w; }));
      var rowH = clamp(H / n, 46, 108), barT = Math.min(rowH * 0.58, 52);
      rowH = Math.max(rowH, Math.max.apply(null, labs.map(function (L) { return L.h; })) + 14);
      var avail = W - labW - 28 - valW - 18;
      var zx = function (v) { var t = (v - lo) / (hi - lo) * avail; return rtl ? W - labW - 28 - t : labW + 28 + t; };
      var z = zx(0), top = 0, totalH = rowH * n;
      data.forEach(function (d, i) {
        var cy = top + rowH * (i + 0.5), x1 = zx(d.value || 0), bx = Math.min(z, x1), bw = Math.max(2, Math.abs(x1 - z));
        var bar = D.shape('bar' + i, 'rect', { x: r1(bx), y: r1(cy - barT / 2), width: r1(bw), height: r1(barT), rx: 4, 'class': 'nm-dg-bar' + (d.accent || !any ? ' is-accent' : '') }, D.gBack, { seq: i });
        bar.style.transformOrigin = (x1 < z ? '100%' : '0%') + ' 50%';
        bar.style.setProperty('--dg-axis', 'x');
        D.put(labs[i], rtl ? W - labs[i].w / 2 : labs[i].w / 2, cy, { seq: i });
        var dir = x1 < z ? -1 : 1;
        D.put(vals[i], x1 + dir * (12 + vals[i].w / 2), cy, { seq: i });
      });
      D.shape('base', 'line', { x1: r1(z), y1: -6, x2: r1(z), y2: r1(totalH + 6), 'class': 'nm-dg-baseline' }, D.gFront);
    } else {
      var colW = W / n, barW = Math.min(colW * 0.56, 110);
      var labsV = data.map(function (d, i) { return D.label('bl' + i, esc(d.label) + (d.sub ? '<span>' + esc(d.sub) + '</span>' : ''), 'nm-dg-blabel is-center' + (d.accent ? ' is-accent' : ''), colW - 12); });
      var valsV = data.map(function (d, i) { return countLabel(D, 'bv' + i, unitText(d.raw, unit), 'nm-dg-bvalue' + (d.accent || !any ? ' is-accent' : ''), colW); });
      var labH = Math.max.apply(null, labsV.map(function (L) { return L.h; })), valH = Math.max.apply(null, valsV.map(function (L) { return L.h; }));
      var base = H - labH - 18, availV = base - valH - 14;
      var zy = function (v) { return base - (v - lo) / (hi - lo) * availV; }, z0 = zy(0);
      data.forEach(function (d, i) {
        var cx = rtl ? W - colW * (i + 0.5) : colW * (i + 0.5), y1 = zy(d.value || 0);
        var bar = D.shape('bar' + i, 'rect', { x: r1(cx - barW / 2), y: r1(Math.min(y1, z0)), width: r1(barW), height: r1(Math.max(2, Math.abs(z0 - y1))), rx: 4, 'class': 'nm-dg-bar is-v' + (d.accent || !any ? ' is-accent' : '') }, D.gBack, { seq: i });
        bar.style.transformOrigin = '50% ' + (y1 < z0 ? '100%' : '0%');
        D.put(labsV[i], cx, base + 14 + labsV[i].h / 2, { seq: i });
        D.put(valsV[i], cx, (y1 < z0 ? y1 - 10 - valsV[i].h / 2 : y1 + 10 + valsV[i].h / 2), { seq: i });
      });
      D.shape('base', 'line', { x1: -6, y1: r1(z0), x2: r1(W + 6), y2: r1(z0), 'class': 'nm-dg-baseline' }, D.gFront);
    }
  };

  LAYOUTS.line = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H;
    var series = M.series.slice();
    if (!series.length) M.items.forEach(function (it) { var vs = it.raw ? it.raw.split(/\s*[,،]\s*/) : []; if (vs.length > 1 && it.key) series.push({ name: it.key, raw: vs, accent: it.accent }); });
    var xl = M.opts.x ? M.opts.x.split(/\s*[,،]\s*/) : [];
    if (!series.length) { var d = chartItems(M); if (d.length) { series = [{ name: M.opts.label || '', raw: d.map(function (q) { return q.raw; }) }]; xl = d.map(function (q) { return q.label; }); } }
    if (!series.length) return;
    if (series.length > 3) { warn(D.id + ': line shows at most 3 series'); series = series.slice(0, 3); }
    var npts = Math.max.apply(null, series.map(function (s) { return s.raw.length; }));
    var all = [];
    series.forEach(function (s) { s.vals = s.raw.map(parseNum); s.vals.forEach(function (v) { if (!isNaN(v)) all.push(v); }); });
    var digits = digitSystem(series.map(function (s) { return s.raw.join(''); }).join('')), unit = M.opts.unit || '';
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
    var lo = mn >= 0 && mn < mx * 0.45 ? 0 : mn, step = niceStep((mx - lo) || 1, 4);
    lo = Math.floor(lo / step) * step; var hi = Math.ceil(mx / step) * step; if (hi <= lo) hi = lo + step;
    var dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    var ticks = []; for (var t = lo; t <= hi + step / 2; t += step) ticks.push(t);
    var tl = ticks.map(function (v, i) { return D.label('yt' + i, withDigits(v.toFixed(dec), digits) + (i === ticks.length - 1 ? esc(unit) : ''), 'nm-dg-tick', 160); });
    var tickW = Math.max.apply(null, tl.map(function (L) { return L.w; }));
    var ends = series.map(function (s, k) {
      var last = s.raw[s.raw.length - 1];
      return D.label('end' + k, '<b>' + esc(s.name) + '</b> <span class="nm-dg-count" data-count="' + esc(unitText(last, unit)) + '">' + esc(unitText(last, unit)) + '</span>', 'nm-dg-endlabel c' + k + (s.accent ? ' is-accent' : ''), 280);
    });
    var endW = Math.max.apply(null, ends.map(function (L) { return L.w; }));
    var xlabs = xl.map(function (x, i) { return D.label('xl' + i, esc(x), 'nm-dg-tick is-x', 200); });
    var xlH = xlabs.length ? Math.max.apply(null, xlabs.map(function (L) { return L.h; })) : 0;
    var pt0 = 20, pb = H - xlH - 22;
    var pa = tickW + 20, pz = endW + 26;
    var X = function (i) { var t = npts > 1 ? i / (npts - 1) : 0.5, x = pa + t * (W - pa - pz); return rtl ? W - x : x; };
    var Y = function (v) { return pb - (v - lo) / (hi - lo) * (pb - pt0); };
    ticks.forEach(function (v, i) {
      var y = Y(v);
      D.shape('grid' + i, 'line', { x1: r1(X(0)), y1: r1(y), x2: r1(X(npts - 1)), y2: r1(y), 'class': i === 0 ? 'nm-dg-baseline' : 'nm-dg-grid' });
      D.put(tl[i], rtl ? W - tl[i].w / 2 : tl[i].w / 2, y, false);
    });
    var every = Math.max(1, Math.ceil(xlabs.reduce(function (s, L) { return Math.max(s, L.w); }, 0) * npts / (W - pa - pz) * 1.15));
    xlabs.forEach(function (L, i) { if (i % every && i !== npts - 1) { L.el.style.visibility = 'hidden'; } D.put(L, X(i), pb + 14 + L.h / 2, false); });
    var area = /^(on|true|1)$/.test(D.opt('area', M.opts.area || ''));
    var endYs = [];
    series.forEach(function (s, k) {
      var pts = s.vals.map(function (v, i) { return isNaN(v) ? null : pt(X(i), Y(v)); }).filter(Boolean);
      if (!pts.length) return;
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + r1(p.x) + ' ' + r1(p.y); }).join('');
      if (area && k === 0) {
        var ad = d + 'L' + r1(pts[pts.length - 1].x) + ' ' + r1(Y(lo)) + 'L' + r1(pts[0].x) + ' ' + r1(Y(lo)) + 'Z';
        D.shape('area' + k, 'path', { d: ad, 'class': 'nm-dg-area c' + k }, D.gBack, { seq: k });
      }
      D.shape('ser' + k, 'path', { d: d, pathLength: 1, 'class': 'nm-dg-series c' + k + (s.accent ? ' is-accent' : '') }, D.gEdges, { seq: k, draw: true });
      var lp = pts[pts.length - 1];
      D.shape('dot' + k, 'circle', { cx: r1(lp.x), cy: r1(lp.y), r: 7, 'class': 'nm-dg-sdot c' + k }, D.gFront, { seq: k });
      endYs.push({ k: k, y: lp.y, x: lp.x, L: ends[k] });
    });
    endYs.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < endYs.length; i++) { var need = (endYs[i - 1].L.h + endYs[i].L.h) / 2 + 6; if (endYs[i].y - endYs[i - 1].y < need) endYs[i].y = endYs[i - 1].y + need; }
    endYs.forEach(function (e) { D.put(e.L, rtl ? e.x - 16 - e.L.w / 2 : e.x + 16 + e.L.w / 2, e.y, { seq: e.k }); });
  };

  LAYOUTS.donut = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H, data = chartItems(M), unit = M.opts.unit || '';
    if (!data.length) return;
    var any = data.some(function (d) { return d.accent; });
    var total = data.reduce(function (s, d) { return s + (Math.max(0, d.value) || 0); }, 0) || 1;
    var Dm = Math.min(H * 0.94, W * 0.5), t = Dm * 0.15, R = (Dm - t) / 2;
    var legend = data.map(function (d, i) {
      return D.label('lg' + i, '<i class="nm-dg-sw c' + (any ? (d.accent ? 'a' : 'n' + Math.min(i, 4)) : i) + '"></i><b>' + esc(d.label) + '</b><span class="nm-dg-count" data-count="' + esc(unitText(d.raw, unit)) + '">' + esc(unitText(d.raw, unit)) + '</span>', 'nm-dg-legend', W - Dm - 80);
    });
    var lw = Math.max.apply(null, legend.map(function (L) { return L.w; })), lh = legend.reduce(function (s, L) { return s + L.h + 18; }, -18);
    var gap = 72, totalW = Dm + gap + lw, x0 = (W - totalW) / 2;
    var cx = rtl ? x0 + Dm / 2 : W - x0 - Dm / 2, cy = H / 2;
    D.shape('track', 'circle', { cx: r1(cx), cy: r1(cy), r: r1(R), 'class': 'nm-dg-track', 'stroke-width': r1(t) });
    var acc = 0, gapU = data.length > 1 ? 0.6 : 0;
    data.forEach(function (d, i) {
      var len = Math.max(0, d.value) / total * 100;
      var c = D.shape('slice' + i, 'circle', { cx: r1(cx), cy: r1(cy), r: r1(R), pathLength: 100, 'stroke-width': r1(t), transform: 'rotate(-90 ' + r1(cx) + ' ' + r1(cy) + ')', 'stroke-dashoffset': r1(-acc), 'class': 'nm-dg-slice c' + (any ? (d.accent ? 'a' : 'n' + Math.min(i, 4)) : i) }, D.gEdges, { seq: i, draw: true });
      c.style.setProperty('--dg-dash', r1(Math.max(0.01, len - gapU)) + ' ' + r1(100 - len + gapU));
      acc += len;
    });
    if (M.opts.center) {
      var cp = splitPipe(M.opts.center);
      var C = D.label('center', '<b class="nm-dg-count" data-count="' + esc(cp.label) + '">' + esc(cp.label) + '</b>' + (cp.sub ? '<span>' + esc(cp.sub) + '</span>' : ''), 'nm-dg-centerfig', R * 1.4);
      D.put(C, cx, cy, false);
    }
    var y = cy - lh / 2, lx = rtl ? W - x0 - lw : x0;
    legend.forEach(function (L, i) { D.put(L, rtl ? W - x0 - L.w / 2 : x0 + L.w / 2, y + L.h / 2, { seq: i }); y += L.h + 18; });
  };

  LAYOUTS.gauge = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H, o = M.opts;
    var it = M.items[0];
    var raw = o.value || (it ? (it.key ? it.label : it.label) : '0'), label = o.label || (it && it.key) || '', sub = o.sub || (it && it.sub) || '';
    var mn = o.min != null ? parseNum(o.min) : 0, mx = o.max != null ? parseNum(o.max) : 100, v = parseNum(raw);
    var frac = clamp((v - mn) / ((mx - mn) || 1), 0, 1);
    var R = Math.min(W * 0.4, H * 0.62), t = R * 0.15, cx = W / 2, cy = R + t / 2 + 4;
    var d = rtl ? 'M' + r1(cx + R) + ' ' + r1(cy) + 'A' + r1(R) + ' ' + r1(R) + ' 0 0 0 ' + r1(cx - R) + ' ' + r1(cy)
      : 'M' + r1(cx - R) + ' ' + r1(cy) + 'A' + r1(R) + ' ' + r1(R) + ' 0 0 1 ' + r1(cx + R) + ' ' + r1(cy);
    D.shape('track', 'path', { d: d, 'class': 'nm-dg-gtrack', 'stroke-width': r1(t) });
    var arc = D.shape('val', 'path', { d: d, pathLength: 1, 'class': 'nm-dg-gval', 'stroke-width': r1(t) }, D.gEdges, { seq: 0, draw: true });
    arc.style.setProperty('--dg-frac', frac.toFixed(4));
    var unit = o.unit || '';
    var N = D.label('num', '<b class="nm-dg-count" data-count="' + esc(unitText(raw, unit)) + '">' + esc(unitText(raw, unit)) + '</b>' + (label ? '<span>' + esc(label) + '</span>' : '') + (sub ? '<em>' + esc(sub) + '</em>' : ''), 'nm-dg-gaugefig', R * 1.5);
    D.put(N, cx, cy - N.h / 2 + Math.min(N.h * 0.35, R * 0.2), { seq: 0 });
    var dg = digitSystem(raw);
    var Lmin = D.label('min', withDigits(String(mn), dg), 'nm-dg-tick', 120), Lmax = D.label('max', withDigits(String(mx), dg), 'nm-dg-tick', 120);
    D.put(Lmin, rtl ? cx + R : cx - R, cy + t / 2 + 14 + Lmin.h / 2, false);
    D.put(Lmax, rtl ? cx - R : cx + R, cy + t / 2 + 14 + Lmax.h / 2, false);
  };

  LAYOUTS.stat = function (M, D) {
    var rtl = D.ctxDir('row').rtl, W = D.W, H = D.H, o = M.opts;
    var data = chartItems(M).map(function (d) { return { label: d.label, raw: d.raw || d.label, sub: d.sub, accent: d.accent }; });
    if (o.value) data.unshift({ label: o.label || '', raw: o.value, sub: o.sub || '', accent: false });
    var k = data.length;
    if (!k) return;
    var any = data.some(function (d) { return d.accent; });
    var cw = W / k, size = k === 1 ? 'is-1' : k === 2 ? 'is-2' : k === 3 ? 'is-3' : 'is-4';
    var unit = o.unit || '';
    var mkStat = function (d, i, size) {
      return D.label('st' + i, '<b class="nm-dg-count" data-count="' + esc(unitText(d.raw, unit)) + '">' + esc(unitText(d.raw, unit)) + '</b>' + (d.label ? '<span>' + esc(d.label) + '</span>' : '') + (d.sub ? '<em>' + esc(d.sub) + '</em>' : ''), 'nm-dg-stat ' + size + (d.accent || !any ? ' is-accent' : ''), cw - 48);
    };
    var sizes = ['is-1', 'is-2', 'is-3', 'is-4', 'is-5'];
    var Ls = data.map(function (d, i) {
      var si = sizes.indexOf(size), L = mkStat(d, i, size);
      while (si < sizes.length - 1 && L.el.scrollWidth > L.el.clientWidth + 1) { si++; L = mkStat(d, i, sizes[si]); }
      return L;
    });
    var mh = Math.max.apply(null, Ls.map(function (L) { return L.h; }));
    Ls.forEach(function (L, i) {
      var cx = rtl ? W - cw * (i + 0.5) : cw * (i + 0.5);
      D.put(L, cx, H / 2 - (mh - L.h) / 2, { seq: i });
      if (i) { var x = rtl ? W - cw * i : cw * i; D.shape('rule' + i, 'line', { x1: r1(x), y1: r1(H / 2 - mh / 2 + 10), x2: r1(x), y2: r1(H / 2 + mh / 2 - 10), 'class': 'nm-dg-rule' }); }
    });
  };

  /* ------------------------------------------------------------------ counters */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function runCount(el) {
    var f = numFormat(el.getAttribute('data-count') || '');
    if (!f || isNaN(f.value)) return;
    if (el._nmCount) cancelAnimationFrame(el._nmCount);
    if (speed() === 0) { el.textContent = f.fmt(f.value); return; }
    var t0 = null, dur = 1200;
    el.textContent = f.fmt(0);
    function tick(ts) {
      if (t0 == null) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur);
      el.textContent = f.fmt(f.value * easeOut(t));
      if (t < 1) el._nmCount = requestAnimationFrame(tick); else { el._nmCount = 0; el.textContent = f.fmt(f.value); }
    }
    el._nmCount = requestAnimationFrame(tick);
  }
  function steppingLive() { var b = doc.body; return !!b && (b.classList.contains('nm-ready') || b.getAttribute('data-nm-steps') === 'sim'); }
  function countIn(root, all) {
    var list = root.classList && root.classList.contains('nm-dg-count') ? [root] : $all('.nm-dg-count', root);
    list.forEach(function (c) {
      var host = c.closest('[data-step]');
      if (!all && host && steppingLive() && !host.classList.contains('is-on') && !host.classList.contains('nm-dg-drawn')) return;
      runCount(c);
    });
  }

  /* ------------------------------------------------------------------ play / arm */
  var slideObs = new WeakMap();
  function arm(box) {
    if (box._nmArmed) return;
    box._nmArmed = true;
    var slide = box.closest('.slide');
    box.classList.add('nm-dg-armed');
    function play() {
      if (box.classList.contains('nm-dg-play')) return;
      raf2(function () { box.classList.add('nm-dg-play'); countIn(box, false); });
    }
    if (!slide) { play(); return; }
    var list = slideObs.get(slide);
    if (!list) {
      list = [];
      slideObs.set(slide, list);
      new MutationObserver(function () { list.forEach(function (fn) { fn(); }); }).observe(slide, { attributes: true, attributeFilter: ['class'] });
    }
    function sync() {
      var on = slide.classList.contains('active') || slide.classList.contains('visible');
      if (on) play();
      else if (!slide.classList.contains('is-leaving')) box.classList.remove('nm-dg-play');
    }
    list.push(sync);
    sync();
    /* step reveals inside the box trigger counters */
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        var t = m.target;
        if ((t.classList.contains('is-on') || t.classList.contains('nm-dg-drawn')) && !(m.oldValue || '').match(/\bis-on\b|\bnm-dg-drawn\b/)) countIn(t, true);
      });
    }).observe(box, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
  }

  /* ------------------------------------------------------------------ connectors between DOM nodes */
  function parseLinks(spec, hostName) {
    var out = [];
    String(spec || '').split(/[;\n]/).forEach(function (part, i) {
      var s = part.trim();
      if (!s || /^#/.test(s)) return;
      var m = s.match(/^([^\s<>~:@]+?)\s*(<~>|<>|~>|>|-)\s*([^\s<>~:@]+)\s*(?:@\s*(\d+))?\s*(?::\s*(.*))?$/);
      if (!m) { warn('data-links on ' + hostName + ': cannot read "' + s + '" (write a>b: label; a~>b; a<>b; a-b; a>b@2)'); return; }
      var op = m[2];
      out.push({ from: m[1], to: m[3], step: m[4] ? parseInt(m[4], 10) : null, label: (m[5] || '').trim(), idx: i,
        arrow: op === '<>' || op === '<~>' ? 'both' : op === '-' ? 'none' : 'end', style: op === '~>' || op === '<~>' ? 'dashed' : 'solid' });
    });
    return out;
  }
  function Links(host) {
    this.host = host;
    this.box = host.querySelector(':scope > .camera-rig') || host;
    if (getComputedStyle(this.box).position === 'static') this.box.style.position = 'relative';
    this.layer = h('div', 'nm-links nm-dg', null);
    this.svg = sv('svg', { 'class': 'nm-dg-svg', 'aria-hidden': 'true' }, this.layer);
    this.gBack = sv('g', null, this.svg); this.gEdges = sv('g', { 'class': 'nm-dg-edges' }, this.svg); this.gFront = sv('g', null, this.svg);
    this.html = h('div', 'nm-dg-html', this.layer);
    this.box.appendChild(this.layer);
    this.map = new Map();
    this.id = host.id || host.getAttribute('data-title') || host.tagName.toLowerCase();
    this.links = parseLinks(host.getAttribute('data-links'), this.id);
    this.flowOn = /^(on|true|1)$/.test(host.getAttribute('data-flow') || '');
  }
  ['get', 'label', 'put', 'edge', 'labelSpot'].forEach(function (k) { Links.prototype[k] = Diagram.prototype[k]; });
  Links.prototype.render = function () {
    var box = this.box, self = this;
    var bw = box.offsetWidth, br = box.getBoundingClientRect();
    if (!bw || !br.width) return false;
    var sc = br.width / bw;
    var mode = (this.host.getAttribute('data-links-style') || 'ortho').toLowerCase();
    var nodes = {};
    $all('[data-node]', box).forEach(function (el) {
      if (el.closest('.nm-diagram') || el.closest('.nm-links')) return;
      var r = el.getBoundingClientRect(), id = el.getAttribute('data-node');
      if (!r.width && !r.height) return;
      var cs = getComputedStyle(el);
      nodes[id] = { id: id, el: el, x: (r.left - br.left) / sc + r.width / sc / 2 - box.clientLeft, y: (r.top - br.top) / sc + r.height / sc / 2 - box.clientTop, w: r.width / sc, h: r.height / sc, shape: 'rect', r: parseFloat(cs.borderTopLeftRadius) || 0 };
    });
    this.used = new Set(); this.placed = []; this.lrects = []; this.parts = []; this.edgeCount = 0;
    var all = Object.keys(nodes).map(function (k) { return nodes[k]; });
    this.placed = all;
    var plans = [];
    this.links.forEach(function (lk) {
      var A = nodes[lk.from], B = nodes[lk.to];
      if (!A || !B) { if (!self._warned) warn('data-links on ' + self.id + ': no [data-node="' + (!A ? lk.from : lk.to) + '"] inside'); return; }
      plans.push(planLink(lk, A, B, all));
    });
    self._warned = true;
    /* spread ports sharing a side */
    var groups = {};
    plans.forEach(function (p) {
      [['A', 'sa', 'B'], ['B', 'sb', 'A']].forEach(function (c) {
        var k = p[c[0]].id + ':' + p[c[1]];
        (groups[k] = groups[k] || []).push({ p: p, end: c[0], other: p[c[2]] });
      });
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 2) return;
      var side = k.split(':').pop(), horizSide = side === 'l' || side === 'r';
      g.sort(function (a, b) { return horizSide ? a.other.y - b.other.y : a.other.x - b.other.x; });
      var n = g[0].end === 'A' ? g[0].p.A : g[0].p.B, len = horizSide ? n.h : n.w, step = Math.min(26, len * 0.6 / (g.length - 1));
      g.forEach(function (e, i) { e.p['o' + e.end] = (i - (g.length - 1) / 2) * step; });
    });
    plans.forEach(function (p) {
      var pts = buildLink(p, p.kind, all);
      var sp = { from: p.A, to: p.B, arrow: p.lk.arrow, style: p.lk.style, label: p.lk.label, eord: p.lk.idx };
      if (mode === 'curve') {
        var s = pts[0], t = pts[pts.length - 1], d = Math.max(60, Math.hypot(t.x - s.x, t.y - s.y) * 0.45);
        var ns = sideVec(p.sa), nt = sideVec(p.sb);
        sp.bez = [s, pt(s.x + ns.x * d, s.y + ns.y * d), pt(t.x + nt.x * d, t.y + nt.y * d), t];
      } else sp.pts = pts;
      var g = self.edge('k' + p.lk.idx, sp);
      if (!g) return;
      var lab = self.map.get('l:el:k' + p.lk.idx);
      [g, lab].forEach(function (el) {
        if (!el) return;
        if (p.lk.step) { el.setAttribute('data-step', p.lk.step); el.setAttribute('data-act', el === g ? 'draw' : 'reveal'); }
        el.style.setProperty('--dg-d', (p.lk.idx * 140 + (el === g ? 0 : 420)) + 'ms');
      });
    });
    this.layer.classList.toggle('nm-dg-steps', this.links.some(function (l) { return l.step; }));
    this.map.forEach(function (e, k) { if (!self.used.has(k)) { e.remove(); self.map.delete(k); } });
    return true;
  };
  function sideVec(s) { return s === 'l' ? pt(-1, 0) : s === 'r' ? pt(1, 0) : s === 't' ? pt(0, -1) : pt(0, 1); }
  function portOn(n, side, off) {
    var v = sideVec(side);
    var ox = n.x + (v.x ? 0 : off || 0), oy = n.y + (v.y ? 0 : off || 0);
    return exitPoint(n, ox, oy, v.x, v.y);
  }
  function buildLink(p, kind, all) {
    var S = portOn(p.A, p.sa, p.oA), T = portOn(p.B, p.sb, p.oB);
    var hs = p.sa === 'l' || p.sa === 'r', ht = p.sb === 'l' || p.sb === 'r';
    if (hs && ht) { if (Math.abs(S.y - T.y) < 2) return [S, T]; var mx = (S.x + T.x) / 2; return [S, pt(mx, S.y), pt(mx, T.y), T]; }
    if (!hs && !ht) { if (Math.abs(S.x - T.x) < 2) return [S, T]; var my = (S.y + T.y) / 2; return [S, pt(S.x, my), pt(T.x, my), T]; }
    if (hs) return [S, pt(T.x, S.y), T];
    return [S, pt(S.x, T.y), T];
  }
  function segHits(a, b, r) {
    var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    return x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y;
  }
  function planLink(lk, A, B, all) {
    var dx = B.x - A.x, dy = B.y - A.y;
    var cands = [];
    var hA = dx < 0 ? 'l' : 'r', hB = dx < 0 ? 'r' : 'l', vA = dy < 0 ? 't' : 'b', vB = dy < 0 ? 'b' : 't';
    var gx = Math.abs(dx) - (A.w + B.w) / 2, gy = Math.abs(dy) - (A.h + B.h) / 2;
    if (gx > 16) cands.push([hA, hB]);
    if (gy > 16) cands.push([vA, vB]);
    if (gx > -A.w / 2 && gy > -B.h / 2) cands.push([hA, vB]);
    if (gy > -A.h / 2 && gx > -B.w / 2) cands.push([vA, hB]);
    if (!cands.length) cands.push(gx > gy ? [hA, hB] : [vA, vB]);
    var best = null, bestS = Infinity;
    cands.forEach(function (c, ci) {
      var p = { lk: lk, A: A, B: B, sa: c[0], sb: c[1], oA: 0, oB: 0 };
      var pts = buildLink(p, null, all), len = 0, hits = 0;
      for (var i = 1; i < pts.length; i++) {
        len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        all.forEach(function (n) { if (n !== A && n !== B && segHits(pts[i - 1], pts[i], rectOf(n, 10))) hits++; });
      }
      var score = len + hits * 2000 + (pts.length - 2) * 60 + ci;
      if (score < bestS) { bestS = score; best = p; }
    });
    return best;
  }

  /* ------------------------------------------------------------------ boot */
  var diagrams = [], linkSets = [];
  function signature(el) { return $all('[data-nm-dg-step],[data-step]', el).map(function (e) { return e.getAttribute('data-step'); }).join(','); }
  function refreshDeck(el) {
    var deck = window.NM && window.NM.deck, slide = el.closest('.slide');
    if (!deck || !slide || typeof deck.refreshSteps !== 'function') return;
    var sig = signature(el);
    if (el._nmSig === sig) return;
    el._nmSig = sig;
    try { deck.refreshSteps(slide); } catch (e) { warn('refreshSteps failed: ' + e.message); }
  }
  function renderOne(obj, el) {
    var ok = obj.render();
    if (ok) { arm(el); refreshDeck(el); }
    return ok;
  }
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) {
      var t = en.target, obj = t._nmDiagram || t._nmLinks;
      if (!obj) return;
      var w = Math.round(en.contentRect.width), hh = Math.round(en.contentRect.height);
      if (t._nmSize === w + 'x' + hh) return;
      t._nmSize = w + 'x' + hh;
      cancelAnimationFrame(t._nmRaf);
      t._nmRaf = requestAnimationFrame(function () { renderOne(obj, obj.fig || obj.layer); });
    });
  }) : null;

  function initDraw(root) {
    $all('[data-act="draw"]', root).forEach(function (el) {
      if (el.closest('.nm-dg') || el._nmDraw) return;
      el._nmDraw = true;
      var shapes = /^(path|line|polyline|polygon|circle|rect|ellipse)$/i.test(el.tagName) ? [el] : $all('path, line, polyline, polygon, circle, rect, ellipse', el);
      shapes.forEach(function (s) { if (!s.hasAttribute('pathLength')) s.setAttribute('pathLength', '1'); s.classList.add('nm-draw-stroke'); });
    });
  }

  function scan(root) {
    root = root || doc;
    $all('.nm-diagram', root).forEach(function (fig) {
      if (fig._nmDiagram) return;
      var D;
      try { D = new Diagram(fig); } catch (e) { warn('could not build diagram: ' + e.message); return; }
      fig._nmDiagram = D;
      diagrams.push(D);
      renderOne(D, fig);
      if (ro) ro.observe(fig);
    });
    var hosts = $all('[data-links]', root);
    if (root.nodeType === 1 && root.hasAttribute('data-links')) hosts.unshift(root);
    hosts.forEach(function (host) {
      if (host._nmLinks) return;
      var L = new Links(host);
      host._nmLinks = L; L.layer._nmLinks = L;
      linkSets.push(L);
      renderOne(L, L.layer);
      if (ro) { ro.observe(L.box); L.box._nmLinks = L; $all('[data-node]', L.box).forEach(function (n) { if (!n.closest('.nm-diagram')) { n._nmLinks = L; ro.observe(n); } }); }
    });
    initDraw(root);
  }
  function rerenderAll() {
    diagrams.forEach(function (D) { if (D.fig.isConnected) renderOne(D, D.fig); });
    linkSets.forEach(function (L) { if (L.layer.isConnected) renderOne(L, L.layer); });
  }

  function registerAct() {
    var NM = window.NM;
    if (!NM || typeof NM.registerAct !== 'function' || registerAct.done) return;
    registerAct.done = true;
    function on(el, ctx) {
      if (ctx && ctx.instant) { el.classList.add('nm-dg-instant'); raf2(function () { el.classList.remove('nm-dg-instant'); }); }
      el.classList.add('nm-dg-drawn');
      countIn(el, true);
    }
    function off(el) { el.classList.remove('nm-dg-drawn'); }
    NM.registerAct('draw', { enter: on, exit: off, reset: off, transient: false });
  }

  var started = false;
  function start() {
    if (speed() === 0) doc.documentElement.classList.add('nm-dg-nomotion');
    if (started) { scan(doc); return; }
    started = true;
    registerAct();
    scan(doc);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { rerenderAll(); });
    if (doc.fonts && doc.fonts.addEventListener) doc.fonts.addEventListener('loadingdone', function () { rerenderAll(); });
  }

  var API = {
    version: 2,
    icons: ICONS,
    icon: iconSvg,
    parse: function (text, type) { return parseDSL(text, type || 'flow', 'parse'); },
    scan: scan,
    refresh: rerenderAll,
    render: function (el) { if (el && el._nmDiagram) return renderOne(el._nmDiagram, el); scan(el && el.parentNode || doc); return true; },
    layouts: LAYOUTS
  };
  window.NM = window.NM || {};
  window.NM.diagram = API;

  if (typeof window.NM.use === 'function') {
    window.NM.use({ name: 'diagram', init: function () { registerAct(); start(); } });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
  doc.addEventListener('nm:ready', function () { registerAct(); diagrams.forEach(function (D) { D.fig._nmSig = null; refreshDeck(D.fig); }); linkSets.forEach(function (L) { L.layer._nmSig = null; refreshDeck(L.layer); }); });
})();
