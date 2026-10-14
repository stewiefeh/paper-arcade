/* ============================================================
   PAPER ARCADE — stats.js
   The record desk: reads every game's record out of local
   storage, prints totals, draws the charts, and wipes the
   whole desk on request. Nothing here ever uploads anything.
   ============================================================ */
(function () {
  'use strict';

  var PA = window.PA;
  var $ = PA.$;
  var store = PA.store;

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function fmtTime(s) {
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  /* ---------- canvas helper: paper-style bars ---------- */

  function prepCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || 300;
    var h = canvas.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function drawBars(canvas, bars, labelFn) {
    var p = prepCanvas(canvas);
    var ctx = p.ctx;
    var w = p.w;
    var h = p.h;
    if (!bars.length || !bars.some(function (b) { return b.value > 0; })) return false;
    var max = Math.max.apply(null, bars.map(function (b) { return b.value; }));
    var n = bars.length;
    var slot = w / n;
    var barW = Math.min(34, slot * 0.62);
    var ink = css('--ink');
    var accent = css('--accent');
    var soft = css('--ink-faint');
    bars.forEach(function (b, i) {
      var x = i * slot + (slot - barW) / 2;
      var barH = b.value ? Math.max(8, (b.value / max) * (h - 40)) : 3;
      var y = h - 26 - barH;
      ctx.fillStyle = b.highlight ? accent : ink;
      ctx.globalAlpha = b.value ? 1 : 0.28;
      ctx.fillRect(x, y, barW, barH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = soft;
      ctx.font = '700 9px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(labelFn(b, i), x + barW / 2, h - 12);
      if (b.value) {
        ctx.fillStyle = ink;
        ctx.fillText(String(b.value), x + barW / 2, y - 4);
      }
    });
    return true;
  }

  /* ---------- readers ---------- */

  var lex = store.get('lexicon', null);
  var drift = {
    best: store.get('drift-best', 0),
    top: store.get('drift-top', 0),
    runs: store.get('drift-runs', 0)
  };
  var mine = {
    bests: store.get('minefield-bests', {}),
    cleared: store.get('minefield-cleared', 0)
  };
  var pairs = {
    bests: store.get('pairs-bests', {}),
    cleared: store.get('pairs-cleared', 0)
  };
  var sig = {
    best: store.get('signal-best', 0),
    runs: store.get('signal-runs', 0),
    strict: store.get('signal-strict', 0)
  };

  /* ---------- renderers ---------- */

  function renderTotals() {
    var log = store.get('log', []);
    var today = new Date().toISOString().slice(0, 10);
    var todayPlays = log.filter(function (r) { return r.day === today; }).length;
    var counts = {};
    var days = {};
    log.forEach(function (r) {
      counts[r.game] = (counts[r.game] || 0) + 1;
      days[r.day] = true;
    });
    var mostPlayed = null;
    Object.keys(counts).forEach(function (g) {
      if (!mostPlayed || counts[g] > counts[mostPlayed]) mostPlayed = g;
    });
    $('#total-plays').textContent = log.length;
    $('#total-today').textContent = todayPlays;
    $('#total-days').textContent = Object.keys(days).length;
    $('#total-best-game').textContent = mostPlayed
      ? mostPlayed.charAt(0).toUpperCase() + mostPlayed.slice(1)
      : '\u2013';
  }

  function renderLexicon() {
    if (!lex || !lex.played) return;
    $('#lex-streak').textContent = lex.streak || 0;
    $('#lex-max').textContent = lex.maxStreak || 0;
    $('#lex-win').textContent = Math.round((lex.wins / lex.played) * 100) + '%';
    var bars = (lex.distribution || []).map(function (count, i) {
      return { value: count, label: i + 1 };
    });
    drawBars($('#lex-chart'), bars, function (b) { return b.label; });
  }

  function renderDrift() {
    $('#drift-best').textContent = drift.best;
    $('#drift-top').textContent = drift.top ? drift.top : '\u2013';
    $('#drift-runs').textContent = drift.runs;
    var history = store.get('drift-history', []);
    if (!history.length && !drift.best) return;
    var bars = history.slice(-10).map(function (v, i, arr) {
      return { value: v, highlight: v === Math.max.apply(null, arr) };
    });
    drawBars($('#drift-chart'), bars, function (b, i) { return String(i + 1); });
  }

  function renderMinefield() {
    $('#mine-small').textContent = mine.bests.small ? fmtTime(mine.bests.small) : '\u2013';
    $('#mine-medium').textContent = mine.bests.medium ? fmtTime(mine.bests.medium) : '\u2013';
    $('#mine-large').textContent = mine.bests.large ? fmtTime(mine.bests.large) : '\u2013';
    $('#mine-sheets').textContent = 'Sheets cleared: ' + mine.cleared;
  }

  function renderPairs() {
    var s = pairs.bests.small;
    var l = pairs.bests.large;
    $('#pairs-small').textContent = s ? s.moves + ' in ' + fmtTime(s.time) : '\u2013';
    $('#pairs-large').textContent = l ? l.moves + ' in ' + fmtTime(l.time) : '\u2013';
    $('#pairs-cleared').textContent = pairs.cleared;
  }

  function renderSignal() {
    $('#sig-best').textContent = sig.best;
    $('#sig-runs').textContent = sig.runs;
    $('#sig-strict').textContent = sig.strict;
    /* signal logs only strict runs; show best round per day from the log */
    var log = store.get('log', []);
    var byDay = {};
    log.forEach(function (r) {
      if (r.game !== 'signal') return;
      var lvl = (r.meta && r.meta.level) || 0;
      if (!byDay[r.day] || lvl > byDay[r.day]) byDay[r.day] = lvl;
    });
    var days = Object.keys(byDay).sort().slice(-10);
    if (!days.length) return;
    var bars = days.map(function (d, i, arr) {
      return { value: byDay[d], highlight: byDay[d] === Math.max.apply(null, arr.map(function (x) { return byDay[x]; })), label: d.slice(5) };
    });
    drawBars($('#signal-chart'), bars, function (b) { return b.label; });
  }

  function renderLog() {
    var log = store.get('log', []);
    var labels = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000);
      labels.push(d.toISOString().slice(0, 10));
    }
    var counts = {};
    log.forEach(function (r) {
      counts[r.day] = (counts[r.day] || 0) + 1;
    });
    var max = 0;
    labels.forEach(function (d) { max = Math.max(max, counts[d] || 0); });
    if (!max) {
      $('#log-note').textContent = 'No games logged yet. Finish any game and the log fills in.';
      return;
    }
    var bars = labels.map(function (d, i, arr) {
      return { value: counts[d] || 0, highlight: counts[d] === Math.max.apply(null, arr.map(function (x) { return counts[x] || 0; })), label: d.slice(5) };
    });
    /* show MM-DD on the canvas */
    drawBars($('#log-chart'), bars, function (b, i) {
      if (bars.length > 8 && i % 2 === 1) return ' ';
      return b.label;
    });
  }

  /* ---------- wipe ---------- */

  function initWipe() {
    $('#wipe').addEventListener('click', function () {
      var sure = confirm('Wipe every score, streak, and best time from this browser? This cannot be undone.');
      if (!sure) return;
      store.wipe();
      PA.toast('Record wiped. The desk is clean.');
      setTimeout(function () { location.reload(); }, 900);
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    renderTotals();
    renderLexicon();
    renderDrift();
    renderMinefield();
    renderPairs();
    renderSignal();
    renderLog();
    initWipe();
    /* redraw charts once fonts settle, so the canvas labels match */
    setTimeout(function () {
      renderLexicon();
      renderDrift();
      renderSignal();
      renderLog();
    }, 350);
  });
})();
