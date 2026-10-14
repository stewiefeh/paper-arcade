/* ============================================================
   PAPER ARCADE — pairs.js
   The stamp drawer: memory match with printer's stamps.
   Two sheet sizes, 3D flips, stamped matches, best records
   (moves first, then time) kept locally.
   ============================================================ */
(function () {
  'use strict';

  var PA = window.PA;
  var $ = PA.$;
  var $$ = PA.$$;
  var store = PA.store;

  var SIZES = {
    small: { pairs: 8, cols: 4 },
    large: { pairs: 12, cols: 6 }
  };

  /* a drawer of printer's stamps: each gets one twin */
  var STAMPS = ['\u2605', '\u25C6', '\u25CF', '\u25B2', '\u271A', '\u263E', '\u2318', '\u2726', '\u2660', '\u26A1', '\u2744', '\u266A'];

  var sheetEl = $('#sheet');
  var movesEl = $('#moves');
  var foundEl = $('#found');
  var clockEl = $('#clock');
  var overlay = $('#pairs-overlay');

  var sizeKey = 'small';
  var deck = [];
  var flipped = [];        /* currently face-up, unmatched cards */
  var matched = 0;
  var moves = 0;
  var lock = false;
  var timer = null;
  var seconds = 0;
  var started = false;
  var finished = false;
  var bests = store.get('pairs-bests', {});
  var cleared = store.get('pairs-cleared', 0);

  renderBests();

  /* ---------- deck ---------- */

  function shuffle(list) {
    /* Fisher-Yates, the honest kind */
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function deal() {
    var spec = SIZES[sizeKey];
    var picks = shuffle(STAMPS).slice(0, spec.pairs);
    deck = shuffle(picks.concat(picks)).map(function (sym, i) {
      return { sym: sym, i: i };
    });
    sheetEl.innerHTML = '';
    sheetEl.setAttribute('data-size', sizeKey);
    /* column tracks come from the stylesheet (data-size rules) */

    deck.forEach(function (card) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pairs-card';
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-label', 'Face-down stamp ' + (card.i + 1));
      btn.innerHTML =
        '<span class="pairs-card__inner">' +
        '<span class="pairs-card__face pairs-card__face--back">PA</span>' +
        '<span class="pairs-card__face pairs-card__face--front" aria-hidden="true"></span>' +
        '</span>';
      btn.querySelector('.pairs-card__face--front').textContent = card.sym;
      btn.dataset.sym = card.sym;
      sheetEl.appendChild(btn);
    });

    flipped = [];
    matched = 0;
    moves = 0;
    seconds = 0;
    started = false;
    finished = false;
    lock = false;
    stopClock();
    movesEl.textContent = '0';
    foundEl.textContent = '0 / ' + spec.pairs;
    clockEl.textContent = '0:00';
    overlay.hidden = true;
  }

  /* ---------- play ---------- */

  function flip(btn) {
    if (lock || finished) return;
    if (btn.classList.contains('is-flipped') || btn.classList.contains('is-matched')) return;

    if (!started) {
      started = true;
      startClock();
    }

    btn.classList.add('is-flipped');
    btn.setAttribute('aria-label', 'Stamp ' + btn.dataset.sym);
    PA.sound.key();
    flipped.push(btn);

    if (flipped.length < 2) return;

    moves++;
    movesEl.textContent = moves;
    var a = flipped[0];
    var b = flipped[1];
    flipped = [];

    if (a.dataset.sym === b.dataset.sym) {
      matched++;
      foundEl.textContent = matched + ' / ' + SIZES[sizeKey].pairs;
      setTimeout(function () {
        a.classList.add('is-matched');
        b.classList.add('is-matched');
        a.setAttribute('aria-label', 'Matched stamp ' + a.dataset.sym);
        b.setAttribute('aria-label', 'Matched stamp ' + b.dataset.sym);
        PA.sound.ok();
        if (matched === SIZES[sizeKey].pairs) finish();
      }, 240);
    } else {
      lock = true;
      setTimeout(function () {
        a.classList.remove('is-flipped');
        b.classList.remove('is-flipped');
        a.setAttribute('aria-label', 'Face-down stamp');
        b.setAttribute('aria-label', 'Face-down stamp');
        PA.sound.miss();
        lock = false;
      }, 760);
    }
  }

  function finish() {
    finished = true;
    stopClock();
    cleared++;
    store.set('pairs-cleared', cleared);

    var best = bests[sizeKey];
    var isRecord = !best || moves < best.moves || (moves === best.moves && seconds < best.time);
    if (isRecord) {
      bests[sizeKey] = { moves: moves, time: seconds };
      store.set('pairs-bests', bests);
      renderBests();
    }

    PA.logPlay('pairs', { moves: moves, size: sizeKey, time: seconds });
    PA.sound.win();
    PA.confetti();

    $('#pairs-overlay-score').textContent = 'Moves ' + moves + ', time ' + formatTime(seconds);
    $('#pairs-overlay-note').textContent = isRecord
      ? 'New best record for this sheet size.'
      : 'Your best here: ' + bests[sizeKey].moves + ' moves in ' + formatTime(bests[sizeKey].time) + '.';
    overlay.hidden = false;
  }

  /* ---------- clock and records ---------- */

  function startClock() {
    stopClock();
    timer = setInterval(function () {
      seconds++;
      clockEl.textContent = formatTime(seconds);
    }, 1000);
  }

  function stopClock() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function renderBests() {
    var s = bests.small;
    var l = bests.large;
    $('#best-small').textContent = s ? s.moves + ' moves in ' + formatTime(s.time) : '\u2013';
    $('#best-large').textContent = l ? l.moves + ' moves in ' + formatTime(l.time) : '\u2013';
  }

  /* ---------- events ---------- */

  sheetEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.pairs-card');
    if (btn) flip(btn);
  });

  $$('.minefield-picker [data-size]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.minefield-picker [data-size]').forEach(function (b) {
        b.classList.remove('btn--primary');
        b.classList.add('btn--ghost');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.remove('btn--ghost');
      btn.classList.add('btn--primary');
      btn.setAttribute('aria-pressed', 'true');
      sizeKey = btn.getAttribute('data-size');
      PA.sound.key();
      deal();
    });
  });

  $('#restart').addEventListener('click', deal);
  $('#pairs-again').addEventListener('click', deal);

  deal();
})();
