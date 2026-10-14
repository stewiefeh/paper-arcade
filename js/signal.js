/* ============================================================
   PAPER ARCADE — signal.js
   The tone bench: sequence memory with four pads, real tones
   from the shared sound engine, a tempo that climbs, and a
   strict mode that forgives nothing. Records kept locally.
   ============================================================ */
(function () {
  'use strict';

  var PA = window.PA;
  var $ = PA.$;
  var $$ = PA.$$;
  var store = PA.store;

  var TONES = [261.63, 329.63, 392.0, 523.25]; /* C4, E4, G4, C5 */

  var pads = $$('.signal-pad');
  var levelEl = $('#level');
  var bestEl = $('#best');
  var statusEl = $('#status');
  var overlay = $('#signal-overlay');
  var strictBox = $('#strict');

  var sequence = [];
  var step = 0;            /* where the player is in the current echo */
  var accepting = false;
  var running = false;
  var strict = false;
  var best = store.get('signal-best', 0);
  var runs = store.get('signal-runs', 0);
  var strictWins = store.get('signal-strict', 0);

  bestEl.textContent = best;
  $('#stat-best').textContent = best;
  $('#stat-runs').textContent = runs;
  $('#stat-strict').textContent = strictWins;

  /* ---------- playback ---------- */

  function playbackSpeed(level) {
    /* starts roomy, tightens as the rounds stack */
    var gap = Math.max(240, 640 - level * 32);
    return { light: Math.max(140, gap * 0.55), gap: gap };
  }

  function lightPad(i, dur) {
    var pad = pads[i];
    pad.classList.add('lit');
    PA.sound.tone(TONES[i], dur || 0.22, 'sine', 0.07);
    setTimeout(function () {
      pad.classList.remove('lit');
    }, (dur || 0.22) * 1000 * 0.85);
  }

  function playSequence() {
    accepting = false;
    statusEl.textContent = 'Listen';
    var speed = playbackSpeed(sequence.length);
    sequence.forEach(function (pad, i) {
      setTimeout(function () {
        lightPad(pad, speed.light / 1000 + 0.1);
        if (i === sequence.length - 1) {
          setTimeout(function () {
            accepting = true;
            step = 0;
            statusEl.textContent = 'Echo it';
          }, speed.gap);
        }
      }, i * speed.gap);
    });
  }

  function nextRound() {
    sequence.push(Math.floor(Math.random() * 4));
    levelEl.textContent = sequence.length;
    setTimeout(playSequence, 620);
  }

  /* ---------- player input ---------- */

  function tap(i) {
    if (!accepting) {
      if (running) {
        /* polite refusal while the line is playing */
        PA.sound.tone(TONES[i], 0.06, 'sine', 0.02);
      }
      return;
    }
    lightPad(i, 0.16);
    if (sequence[step] === i) {
      step++;
      if (step === sequence.length) {
        accepting = false;
        statusEl.textContent = 'Round ' + sequence.length + ' cleared';
        if (sequence.length % 4 === 0) PA.sound.ok();
        setTimeout(nextRound, 700);
      }
    } else {
      miss(i);
    }
  }

  function miss() {
    accepting = false;
    var reached = sequence.length - 1;
    if (sequence.length > best) {
      best = sequence.length - 1;
      store.set('signal-best', best);
      bestEl.textContent = best;
      $('#stat-best').textContent = best;
    }

    if (!strict) {
      statusEl.textContent = 'Miss. Line replays.';
      PA.sound.miss();
      setTimeout(playSequence, 900);
      return;
    }

    running = false;
    runs++;
    store.set('signal-runs', runs);
    $('#stat-runs').textContent = runs;
    PA.logPlay('signal', { level: reached, strict: true });
    PA.sound.bad();
    $('#signal-overlay-score').textContent = 'Round ' + reached;
    $('#signal-overlay-note').textContent =
      reached >= 12 ? 'Past twelve on strict. That is bragging material.' :
      'Strict mode keeps no second chances. Best round on record: ' + best + '.';
    statusEl.textContent = 'Press start';
    overlay.hidden = false;
  }

  /* ---------- lifecycle ---------- */

  function start() {
    sequence = [];
    step = 0;
    running = true;
    levelEl.textContent = '0';
    overlay.hidden = true;
    statusEl.textContent = 'Warming up';
    nextRound();
  }

  pads.forEach(function (pad) {
    pad.addEventListener('click', function () {
      tap(parseInt(pad.getAttribute('data-pad'), 10));
    });
  });

  document.addEventListener('keydown', function (e) {
    var map = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (map[e.key] !== undefined) {
      e.preventDefault();
      tap(map[e.key]);
    }
  });

  strictBox.addEventListener('change', function () {
    strict = strictBox.checked;
    PA.sound.key();
  });

  $('#start').addEventListener('click', function () {
    PA.sound.key();
    start();
  });

  $('#signal-again').addEventListener('click', start);
})();
