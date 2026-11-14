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
      if (!n.shape) n.shape = 'rect';
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
      if (/\s/.test(c)) { i++; continue; }
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
    if (DIRECTIVES[lk] && !(type === 'stat' && (lk === 'label'))) {
      if (lk === 'head' && /!\s*$/.test(val)) { M.opts.headAccent = 1; val = val.replace(/\s*!\s*$/, ''); }
      if (lk === 'head' && accent) M.opts.headAccent = 0;
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
    var w = e.offsetWidth, hh = e.offsetHeight;
    var tw = txt.offsetWidth, th = txt.offsetHeight;
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
    if (e._html !== html) { e._html = html; e.innerHTML = html; }
    e.style.left = '0px'; e.style.top = '0px'; e.style.width = '';
    e.style.maxWidth = maxW ? Math.round(maxW) + 'px' : '';
    var L = { el: e, w: e.offsetWidth, h: e.offsetHeight, key: key };
    if (maxW) e.style.width = Math.ceil(L.w) + 'px';
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
    var part = { el: g, kind: 'edge', from: sp.from, to: sp.to, eord: sp.eord != null ? sp.eord : this.edgeCount, seq: sp.seq };
    this.edgeCount++;
    this.parts.push(part);
    if (sp.label) {
      var L = this.label('el:' + key, esc(sp.label), 'nm-dg-elabel' + (sp.labelCls ? ' ' + sp.labelCls : ''), 300);
      var pos = this.labelSpot(path, L, sp.labelAt);
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
    this.used = new Set(); this.placed = []; this.lrects = []; this.parts = []; this.edgeCount = 0;
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

  /*__CONTINUE__*/
})();
