/* ============================================================
   PAPER ARCADE — minefield.js
   The proof room: minesweeper on three sheet sizes. The field
   is seeded after the first tap so the opener can never kill.
   Flood fill, chording, flags, and best times kept locally.
   ============================================================ */
(function () {
  'use strict';

  var PA = window.PA;
  var $ = PA.$;
  var store = PA.store;

  var SIZES = {
    small:  { cols: 9,  rows: 9,  mines: 10, cell: 36 },
    medium: { cols: 14, rows: 12, mines: 30, cell: 30 },
    large:  { cols: 20, rows: 14, mines: 60, cell: 26 }
  };

  var sheetEl = $('#sheet');
  var minesEl = $('#mines-left');
  var clockEl = $('#clock');
  var faceEl = $('#reset');
  var overlay = $('#mine-overlay');

  var sizeKey = 'small';
  var grid = [];           /* [{x,y,mine,revealed,flagged,count,el}] */
  var cols = 0;
  var rows = 0;
  var mines = 0;
  var seeded = false;
  var revealedCount = 0;
  var flags = 0;
  var timer = null;
  var seconds = 0;
  var status = 'idle';     /* idle | playing | won | lost */
  var bests = store.get('minefield-bests', {});
  var clearedSheets = store.get('minefield-cleared', 0);

  renderBests();

  /* ---------- field ---------- */

  function idx(x, y) {
    return grid[y * cols + x];
  }

  function neighbors(c) {
    var out = [];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = c.x + dx;
        var ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        out.push(idx(nx, ny));
      }
    }
    return out;
  }

  function buildField() {
    var spec = SIZES[sizeKey];
    cols = spec.cols;
    rows = spec.rows;
    mines = spec.mines;
    grid = [];
    sheetEl.innerHTML = '';
    sheetEl.style.setProperty('--cell', spec.cell + 'px');
    sheetEl.style.gridTemplateColumns = 'repeat(' + cols + ', ' + spec.cell + 'px)';
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var c = { x: x, y: y, mine: false, revealed: false, flagged: false, count: 0, el: null };
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'mine-cell';
        el.setAttribute('role', 'gridcell');
        el.setAttribute('aria-label', 'Covered square, row ' + (y + 1) + ' column ' + (x + 1));
        c.el = el;
        grid.push(c);
        sheetEl.appendChild(el);
      }
    }
    seeded = false;
    revealedCount = 0;
    flags = 0;
    seconds = 0;
    status = 'idle';
    stopClock();
    clockEl.textContent = '0:00';
    minesEl.textContent = mines;
    faceEl.textContent = ':)';
    overlay.hidden = true;
  }

  /* place mines after the first tap, avoiding it and its ring */
  function seed(safeCell) {
    var forbidden = {};
    forbidden[safeCell.y * cols + safeCell.x] = true;
    neighbors(safeCell).forEach(function (n) {
      forbidden[n.y * cols + n.x] = true;
    });
    var placed = 0;
    while (placed < mines) {
      var i = Math.floor(Math.random() * grid.length);
      if (grid[i].mine || forbidden[i]) continue;
      grid[i].mine = true;
      placed++;
    }
    grid.forEach(function (c) {
      if (c.mine) return;
      c.count = neighbors(c).filter(function (n) { return n.mine; }).length;
    });
    seeded = true;
    startClock();
    status = 'playing';
  }

  /* ---------- play ---------- */

  function reveal(c) {
    if (status === 'won' || status === 'lost') return;
    if (!seeded) seed(c);
    if (c.flagged || c.revealed) return;

    if (c.mine) {
      boom(c);
      return;
    }

    /* flood fill with a stack, standard minesweeper */
    var stack = [c];
    while (stack.length) {
      var cur = stack.pop();
      if (cur.revealed || cur.flagged) continue;
      cur.revealed = true;
      revealedCount++;
      cur.el.classList.add('is-revealed');
      cur.el.setAttribute('aria-label', 'Cleared square, row ' + (cur.y + 1) + ' column ' + (cur.x + 1));
      if (cur.count) {
        cur.el.textContent = cur.count;
        cur.el.classList.add('n' + cur.count);
      } else {
        neighbors(cur).forEach(function (n) {
          if (!n.revealed && !n.mine) stack.push(n);
        });
      }
    }
    PA.sound.key();
    checkWin();
  }

  function chord(c) {
    if (!c.revealed || !c.count || status !== 'playing') return;
    var ring = neighbors(c);
    var flagged = ring.filter(function (n) { return n.flagged; }).length;
    if (flagged !== c.count) return;
    ring.forEach(function (n) {
      if (!n.revealed && !n.flagged) {
        if (n.mine) {
          boom(n);
        } else {
          reveal(n);
        }
      }
    });
  }

  function toggleFlag(c) {
    if (status === 'won' || status === 'lost' || c.revealed) return;
    if (!seeded) {
      PA.toast('The field seeds on your first clear, not a flag.');
      return;
    }
    c.flagged = !c.flagged;
    flags += c.flagged ? 1 : -1;
    c.el.classList.toggle('is-flag', c.flagged);
    c.el.textContent = c.flagged ? '\u2691' : '';
    c.el.setAttribute('aria-label', (c.flagged ? 'Flagged' : 'Covered') + ' square, row ' + (c.y + 1) + ' column ' + (c.x + 1));
    minesEl.textContent = mines - flags;
    PA.sound.key();
  }

  function boom(hit) {
    status = 'lost';
    stopClock();
    faceEl.textContent = 'D:';
    grid.forEach(function (c) {
      if (c.mine && !c.flagged) {
        c.el.classList.add('is-revealed', 'is-mine');
        c.el.textContent = '\u2738';
      }
    });
    hit.el.classList.add('is-boom');
    hit.el.textContent = '\u2738';
    PA.sound.bad();
    showOverlay('Boom', 'Time ' + clockEl.textContent, 'You lasted ' + formatTime(seconds) + '. The face knows how this feels.', false);
  }

  function checkWin() {
    var hidden = grid.length - revealedCount;
    if (hidden === mines) {
      status = 'won';
      stopClock();
      faceEl.textContent = 'B)';
      clearedSheets++;
      store.set('minefield-cleared', clearedSheets);
      $('#mine-sheets', document).textContent = 'Sheets cleared: ' + clearedSheets;
      /* flag the leftovers so the final sheet looks done */
      grid.forEach(function (c) {
        if (c.mine && !c.flagged) {
          c.flagged = true;
          flags++;
          c.el.classList.add('is-flag');
          c.el.textContent = '\u2691';
        }
      });
      minesEl.textContent = 0;
      var best = bests[sizeKey];
      var isRecord = !best || seconds < best;
      if (isRecord) {
        bests[sizeKey] = seconds;
        store.set('minefield-bests', bests);
        renderBests();
      }
      PA.sound.win();
      PA.confetti();
      showOverlay('Sheet cleared', 'Time ' + formatTime(seconds),
        isRecord ? 'New best time on this sheet size.' : 'Your best here is still ' + formatTime(bests[sizeKey]) + '.',
        false);
    }
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
    $('#best-small').textContent = bests.small ? formatTime(bests.small) : '\u2013';
    $('#best-medium').textContent = bests.medium ? formatTime(bests.medium) : '\u2013';
    $('#best-large').textContent = bests.large ? formatTime(bests.large) : '\u2013';
  }

  function showOverlay(title, timeLine, note) {
    $('#mine-overlay-title').textContent = title;
    $('#mine-overlay-time').textContent = timeLine;
    $('#mine-overlay-note').textContent = note;
    overlay.hidden = false;
  }

  /* ---------- events ---------- */

  var pressTimer = null;
  var longPressed = false;

  sheetEl.addEventListener('click', function (e) {
    var cell = e.target.closest('.mine-cell');
    if (!cell) return;
    var c = grid[cell ? grid.indexOf(cell) : -1];
    /* grid indexOf on the el wrapper does not work; map back via index */
    c = null;
    var i = Array.prototype.indexOf.call(sheetEl.children, cell);
    c = grid[i];
    if (longPressed) {
      longPressed = false;
      return;
    }
    if (c.revealed) {
      chord(c);
    } else {
      reveal(c);
    }
  });

  sheetEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    var cell = e.target.closest('.mine-cell');
    if (!cell) return;
    var i = Array.prototype.indexOf.call(sheetEl.children, cell);
    toggleFlag(grid[i]);
  });

  /* touch: press and hold to flag */
  sheetEl.addEventListener('touchstart', function (e) {
    var cell = e.target.closest('.mine-cell');
    if (!cell) return;
    longPressed = false;
    pressTimer = setTimeout(function () {
      longPressed = true;
      var i = Array.prototype.indexOf.call(sheetEl.children, cell);
      toggleFlag(grid[i]);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 420);
  }, { passive: true });

  ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
    sheetEl.addEventListener(ev, function () {
      clearTimeout(pressTimer);
    }, { passive: true });
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
      buildField();
    });
  });

  faceEl.addEventListener('click', buildField);
  $('#mine-again').addEventListener('click', buildField);

  buildField();
})();
