/*
 * nm-table.js - Nevermind Runtime v2: data tables (roadmap NM-10).
 * Classic script, no dependencies, no network. Works on a plain <table> inside <figure class="nm-table">:
 *
 *   data-steps="row|col|none"   one step per body row (or per data column), numbered after the slide's other steps,
 *                               or from data-step-from="N"
 *   data-steps-act="reveal|highlight"   what each of those steps does (default reveal; highlight keeps every row
 *                               visible and walks the emphasis through them)
 *   data-highlight="r2 c3"      static emphasis on body row 2 and data column 3 (1-based, header and row-header
 *                               column not counted)
 *
 * The runtime only adds attributes and classes to the author's cells (data-step, data-act, data-nm-tb-step,
 * .nm-tb-num, .nm-tb-hl); it never adds or removes cells, so the table stays the deck's source. Numeric columns are
 * detected and aligned; a table taller or wider than its figure is set smaller, down to 20px, and a warning names it;
 * a short table grows up to 36px (data-no-grow keeps the theme size).
 */
(function () {
  'use strict';
  if (window.NM && window.NM.table) return;
  var doc = document;
  var MIN_FONT = 20, MAX_FONT = 36;

  function $all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function warn(msg) { console.warn('[nm-table] ' + msg); }
  function name(fig) { return fig.getAttribute('data-id') || fig.id || 'table'; }

  /* ------------------------------------------------------------------ grid: rows x columns with spans resolved */
  function grid(table) {
    var rows = Array.prototype.slice.call(table.rows), out = [], taken = [];
    rows.forEach(function (tr, r) {
      out[r] = out[r] || [];
      taken[r] = taken[r] || [];
      var c = 0;
      Array.prototype.forEach.call(tr.cells, function (cell) {
        while (taken[r][c]) c++;
        var rs = Math.max(1, cell.rowSpan || 1), cs = Math.max(1, cell.colSpan || 1);
        for (var i = 0; i < rs; i++) for (var j = 0; j < cs; j++) {
          taken[r + i] = taken[r + i] || [];
          taken[r + i][c + j] = true;
          if (i === 0) { out[r] = out[r] || []; out[r][c + j] = cell; }
        }
        cell._nmCol = c;
        c += cs;
      });
    });
    return out;
  }
  function inHead(tr) { return tr.parentElement && tr.parentElement.tagName === 'THEAD'; }
  function bodyRows(table) { return Array.prototype.filter.call(table.rows, function (tr) { return !inHead(tr); }); }
  /* the first column is a row-header column when every body row starts with a <th> */
  function rowHeaderCols(table) {
    var rows = bodyRows(table);
    return rows.length && rows.every(function (tr) { return tr.cells[0] && tr.cells[0].tagName === 'TH'; }) ? 1 : 0;
  }

  /* ------------------------------------------------------------------ numbers */
  var UNIT = /(%|٪|‰|x|×|ms|µs|s|h|k|K|M|B|G|T|kb|KB|MB|GB|TB|px|pp|bp|°|°C|dB)$/;
  function isNumeric(text) {
    var t = String(text || '').trim();
    if (!t) return null; // empty: neutral
    if (/^[—–\-·.]+$/.test(t)) return null; // a dash for "no value"
    t = t.replace(/^[(\[]|[)\]]$/g, '').replace(/^[+\-−±~≈<>≤≥]+\s*/, '').replace(/^[$€£¥﷼]\s*/, '');
    t = t.replace(/\s*±\s*/g, '').replace(UNIT, '').replace(UNIT, '').trim();
    return /^[0-9٠-٩۰-۹]+(?:[.,٫٬\s][0-9٠-٩۰-۹]+)*$/.test(t);
  }
  function markNumeric(table, g) {
    var heads = rowHeaderCols(table), cols = 0;
    g.forEach(function (row) { cols = Math.max(cols, row.length); });
    var rows = bodyRows(table);
    for (var c = heads; c < cols; c++) {
      var yes = 0, no = 0, cells = [];
      g.forEach(function (row, r) {
        var cell = row[c];
        if (!cell || cell._nmCol !== c || cells.indexOf(cell) >= 0) return;
        cells.push(cell);
        if (inHead(table.rows[r])) return;
        var v = isNumeric(cell.textContent);
        if (v === true) yes++; else if (v === false) no++;
      });
      if (yes && yes >= Math.max(1, Math.ceil((yes + no) * 0.6)) && rows.length) cells.forEach(function (cell) { if (cell.colSpan <= 1) cell.classList.add('nm-tb-num'); });
    }
  }

  /* ------------------------------------------------------------------ static highlight */
  function highlight(fig, table, g) {
    var spec = String(fig.getAttribute('data-highlight') || '').trim();
    if (!spec) return;
    var rows = bodyRows(table), heads = rowHeaderCols(table);
    spec.split(/[\s,;]+/).forEach(function (tok) {
      var m = /^([rc])(\d+)$/i.exec(tok);
      if (!m) { warn(name(fig) + ': cannot read data-highlight entry "' + tok + '" (write r2 or c3)'); return; }
      var k = parseInt(m[2], 10);
      if (m[1].toLowerCase() === 'r') {
        if (rows[k - 1]) rows[k - 1].classList.add('nm-tb-hl'); else warn(name(fig) + ': data-highlight row ' + k + ' does not exist');
      } else {
        var c = heads + k - 1, hit = false;
        g.forEach(function (row) { var cell = row[c]; if (cell && cell._nmCol === c) { cell.classList.add('nm-tb-hl'); hit = true; } });
        if (!hit) warn(name(fig) + ': data-highlight column ' + k + ' does not exist');
      }
    });
  }

  /* ------------------------------------------------------------------ steps */
  var ACTS = ['reveal', 'highlight', 'focus', 'zoom'];
  function clearSteps(fig) {
    $all('[data-nm-tb-step]', fig).forEach(function (e) { e.removeAttribute('data-step'); e.removeAttribute('data-act'); e.removeAttribute('data-nm-tb-step'); });
  }
  function assignSteps(fig, table, g) {
    clearSteps(fig);
    var mode = String(fig.getAttribute('data-steps') || 'none').toLowerCase();
    if (mode === 'none' || mode === '') return 0;
    if (mode !== 'row' && mode !== 'col') { warn(name(fig) + ': data-steps="' + mode + '" is not row, col or none'); return 0; }
    var act = String(fig.getAttribute('data-steps-act') || 'reveal').toLowerCase();
    if (ACTS.indexOf(act) < 0) { warn(name(fig) + ': data-steps-act="' + act + '" is not one of ' + ACTS.join(', ') + '; using reveal'); act = 'reveal'; }
    var slide = fig.closest('.slide');
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
    function mark(el, n) { el.setAttribute('data-step', n); el.setAttribute('data-act', act); el.setAttribute('data-nm-tb-step', '1'); }
    var count = 0;
    if (mode === 'row') {
      bodyRows(table).forEach(function (tr, i) { if (tr.hasAttribute('data-step') && !tr.hasAttribute('data-nm-tb-step')) return; mark(tr, base + i); count++; });
    } else {
      var heads = rowHeaderCols(table), cols = 0;
      g.forEach(function (row) { cols = Math.max(cols, row.length); });
      for (var c = heads; c < cols; c++) {
        var n = base + (c - heads), any = false;
        g.forEach(function (row, r) {
          var cell = row[c];
          if (!cell || cell._nmCol !== c || cell.colSpan > 1) return;
          // reveal keeps the header visible; highlight takes the header cell along
          if (inHead(table.rows[r]) && act === 'reveal') return;
          if (cell.hasAttribute('data-step') && !cell.hasAttribute('data-nm-tb-step')) return;
          mark(cell, n); any = true;
        });
        if (any) count++;
      }
    }
    return count;
  }

  /* ------------------------------------------------------------------ fit: never smaller than 20px */
  function fit(fig, table) {
    if (fig._nmHadStyle === undefined) fig._nmHadStyle = fig.hasAttribute('style');
    fig.style.removeProperty('--nm-tb-fit');
    if (!fig._nmHadStyle && fig.getAttribute('style') === '') fig.removeAttribute('style'); // author markup stays as written
    var availH = fig.clientHeight, availW = fig.clientWidth;
    if (!availH || !availW) return;
    var cap = fig.querySelector(':scope > figcaption');
    var other = cap ? cap.offsetHeight + 18 : 0;
    function over() { return table.offsetHeight + other > availH + 1 || table.offsetWidth > availW + 1; }
    var size = Math.round(parseFloat(getComputedStyle(fig).fontSize) || 28);
    if (!over()) {
      // a short table grows into its figure (up to 36px) so a few rows do not float in an empty box
      if (fig.hasAttribute('data-no-grow') || table.offsetHeight + other > availH * 0.6) return;
      while (size < MAX_FONT) {
        fig.style.setProperty('--nm-tb-fit', (size + 1) + 'px');
        if (over() || table.offsetHeight + other > availH * 0.8) { fig.style.setProperty('--nm-tb-fit', size + 'px'); break; }
        size += 1;
      }
      return;
    }
    while (size > MIN_FONT && over()) {
      size -= 1;
      fig.style.setProperty('--nm-tb-fit', size + 'px');
    }
    if (over()) warn(name(fig) + ': the table does not fit its figure even at ' + MIN_FONT + 'px; split it or give it a larger cell');
  }

  /* ------------------------------------------------------------------ boot */
  var tables = [];
  function refreshDeck(fig) {
    var deck = window.NM && window.NM.deck, slide = fig.closest('.slide');
    if (!deck || !slide || typeof deck.refreshSteps !== 'function') return;
    var sig = $all('[data-nm-tb-step]', fig).map(function (e) { return e.getAttribute('data-step'); }).join(',');
    if (fig._nmTbSig === sig) return;
    fig._nmTbSig = sig;
    try { deck.refreshSteps(slide); } catch (e) { warn('refreshSteps failed: ' + e.message); }
  }
  function setup(fig) {
    var table = fig.querySelector('table');
    if (!table) { warn(name(fig) + ': figure.nm-table holds no <table>'); return; }
    var g = grid(table);
    if (!fig._nmTable) {
      markNumeric(table, g);
      highlight(fig, table, g);
      tables.push(fig);
    }
    fig._nmTable = { table: table };
    assignSteps(fig, table, g);
    fit(fig, table);
  }
  function scan(root) {
    $all('figure.nm-table, .nm-table', root || doc).forEach(function (fig) { if (!fig._nmTable) setup(fig); });
  }
  function refitAll() { tables.forEach(function (fig) { if (fig.isConnected && fig._nmTable) fit(fig, fig._nmTable.table); }); }
  function refreshAllSteps() { tables.forEach(function (fig) { fig._nmTbSig = null; refreshDeck(fig); }); }

  var started = false;
  function start() {
    if (started) { scan(doc); return; }
    started = true;
    scan(doc);
    if (doc.fonts && doc.fonts.ready) {
      var NMg = window.NM = window.NM || {};
      NMg.pending = (NMg.pending || 0) + 1; // settle() waits for the fit after webfonts load
      doc.fonts.ready.then(function () { refitAll(); NMg.pending--; }, function () { NMg.pending--; });
    }
  }

  var API = {
    version: 1,
    scan: scan,
    refit: refitAll,
    refreshSteps: refreshAllSteps,
    isNumeric: function (t) { return isNumeric(t) === true; }
  };
  window.NM = window.NM || {};
  window.NM.table = API;

  if (typeof window.NM.use === 'function') {
    window.NM.use({ name: 'table', init: function () { start(); refreshAllSteps(); } });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
  doc.addEventListener('nm:ready', refreshAllSteps);
})();
