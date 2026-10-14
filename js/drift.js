/* ============================================================
   PAPER ARCADE — drift.js
   The plate room: a sliding merge puzzle. Tiles are objects
   with identity so the DOM can animate real movement, not a
   redraw. One undo per run, 2048 recognized, jam detected.
   ============================================================ */
(function () {
  'use strict';

  var PA = window.PA;
  var $ = PA.$;
  var store = PA.store;

  var SIZE = 4;

  var tilesEl = $('#tiles');
  var scoreEl = $('#score');
  var bestEl = $('#best');
  var deltaEl = $('#score-delta');
  var overlay = $('#drift-overlay');

  var tiles = [];          /* [{id,x,y,val,el}] */
  var nextId = 1;
  var score = 0;
  var best = store.get('drift-best', 0);
  var runsFinished = store.get('drift-runs', 0);
  var topPlate = store.get('drift-top', 0);
  var locked = false;      /* during a slide animation */
  var won = false;         /* printed a 2048 plate */
  var over = false;
  var undoSnapshot = null; /* {tiles:[{x,y,val}], score} */

  bestEl.textContent = best;
  $('#stat-best').textContent = best;
  $('#stat-runs').textContent = runsFinished;
  $('#stat-top').textContent = topPlate ? topPlate : '\u2013';

  /* ---------- geometry ---------- */

  function pos(x, y) {
    var step = 100 / SIZE;
    return { x: y * step, y: x * step };
  }

  function cellAt(x, y) {
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].x === x && tiles[i].y === y) return tiles[i];
    }
    return null;
  }

  /* ---------- DOM ---------- */

  function makeTile(x, y, val, isNew) {
    var t = { id: nextId++, x: x, y: y, val: val };
    var el = document.createElement('div');
    el.className = 'drift-tile' + (isNew ? ' is-new' : '');
    el.textContent = val;
    el.setAttribute('data-val', val);
    var p = pos(x, y);
    el.style.transform = 'translate(' + p.x + '%, ' + p.y + '%)';
    tilesEl.appendChild(el);
    t.el = el;
    tiles.push(t);
    return t;
  }

  function placeTile(t) {
    var p = pos(t.x, t.y);
    t.el.style.transform = 'translate(' + p.x + '%, ' + p.y + '%)';
  }

  function removeTile(t) {
    t.el.remove();
    tiles = tiles.filter(function (o) { return o !== t; });
  }

  function bumpDelta(amount) {
    deltaEl.textContent = '+' + amount;
    deltaEl.classList.remove('bump');
    void deltaEl.offsetWidth;
    deltaEl.classList.add('bump');
  }

  /* ---------- movement ----------
     A direction walk visits cells in an order that guarantees the
     far tile along the move is settled before the near one arrives. */

  function lineCoordinates(dir) {
    var lines = [];
    var x, y;
    if (dir === 'left' || dir === 'right') {
      for (y = 0; y < SIZE; y++) {
        var row = [];
        for (x = 0; x < SIZE; x++) row.push([x, y]);
        lines.push(dir === 'left' ? row : row.reverse());
      }
    } else {
      for (x = 0; x < SIZE; x++) {
        var col = [];
        for (y = 0; y < SIZE; y++) col.push([x, y]);
        lines.push(dir === 'up' ? col : col.reverse());
      }
    }
    return lines;
  }

  function stepFor(dir) {
    if (dir === 'left') return [0, -1];
    if (dir === 'right') return [0, 1];
    if (dir === 'up') return [-1, 0];
    return [1, 0];
  }

  function move(dir) {
    if (locked || over) return;
    var before = snapshot();
    var moved = false;
    var gained = 0;
    var merged = [];

    lineCoordinates(dir).forEach(function (line) {
      var dx = stepFor(dir)[0];
      var dy = stepFor(dir)[1];
      var slot = null; /* value of the last settled cell, or a tile object */

      line.forEach(function (pair, idx) {
        var x = pair[0];
        var y = pair[1];
        var t = cellAt(x, y);
        if (!t) return;
        /* find the destination: walk back along the line while empty */
        var nx = x;
        var ny = y;
        while (true) {
          var tx = nx - dx;
          var ty = ny - dy;
          if (tx < 0 || ty < 0 || tx >= SIZE || ty >= SIZE) break;
          if (cellAt(tx, ty)) break;
          nx = tx;
          ny = ty;
        }
        var ahead = (nx - dx >= 0 && nx - dx < SIZE && ny - dy >= 0 && ny - dy < SIZE)
          ? cellAt(nx - dx, ny - dy) : null;

        if (ahead && ahead.val === t.val && !ahead.lockedMerge) {
          /* merge into the tile ahead */
          ahead.val *= 2;
          ahead.lockedMerge = true;
          gained += ahead.val;
          ahead.el.textContent = ahead.val;
          ahead.el.setAttribute('data-val', ahead.val);
          removeTile(t);
          moved = true;
          merged.push(ahead);
        } else if (nx !== x || ny !== y) {
          t.x = nx;
          t.y = ny;
          placeTile(t);
          moved = true;
        }
      });
    });

    merged.forEach(function (t) {
      t.lockedMerge = false;
      t.el.classList.remove('is-merged');
      void t.el.offsetWidth;
      t.el.classList.add('is-merged');
      if (t.val > topPlate) {
        topPlate = t.val;
        store.set('drift-top', topPlate);
        $('#stat-top').textContent = topPlate;
      }
    });

    if (!moved) return;

    score += gained;
    if (gained) bumpDelta(gained);
    if (score > best) {
      best = score;
      store.set('drift-best', best);
      bestEl.textContent = best;
      $('#stat-best').textContent = best;
    }
    scoreEl.textContent = score;
    undoSnapshot = before;
    $('#undo').disabled = false;

    locked = true;
    setTimeout(function () {
      spawn();
      locked = false;
      if (!won && hasTile(2048)) {
        won = true;
        PA.sound.win();
        PA.confetti();
        showOverlay('2048 printed', 'Score ' + score, 'The press recognizes 2048. Keep sliding if you want a bigger number.', true);
      } else if (!anyMoveLeft()) {
        endRun();
      }
    }, 130);
  }

  function snapshot() {
    return {
      score: score,
      tiles: tiles.map(function (t) { return { x: t.x, y: t.y, val: t.val }; })
    };
  }

  function restore(snap) {
    if (!snap) return;
    tilesEl.innerHTML = '';
    tiles = [];
    snap.tiles.forEach(function (t) {
      makeTile(t.x, t.y, t.val, false);
    });
    score = snap.score;
    scoreEl.textContent = score;
  }

  function hasTile(val) {
    return tiles.some(function (t) { return t.val === val; });
  }

  function anyMoveLeft() {
    if (tiles.length < SIZE * SIZE) return true;
    for (var x = 0; x < SIZE; x++) {
      for (var y = 0; y < SIZE; y++) {
        var t = cellAt(x, y);
        var r = cellAt(x + 1, y);
        var d = cellAt(x, y + 1);
        if (r && r.val === t.val) return true;
        if (d && d.val === t.val) return true;
      }
    }
    return false;
  }

  function spawn() {
    var empty = [];
    for (var x = 0; x < SIZE; x++) {
      for (var y = 0; y < SIZE; y++) {
        if (!cellAt(x, y)) empty.push([x, y]);
      }
    }
    if (!empty.length) return;
    var pick = empty[Math.floor(Math.random() * empty.length)];
    makeTile(pick[0], pick[1], Math.random() < 0.9 ? 2 : 4, true);
  }

  /* ---------- run lifecycle ---------- */

  function startRun() {
    tilesEl.innerHTML = '';
    tiles = [];
    score = 0;
    won = false;
    over = false;
    undoSnapshot = null;
    $('#undo').disabled = true;
    scoreEl.textContent = '0';
    overlay.hidden = true;
    spawn();
    spawn();
  }

  function endRun() {
    over = true;
    runsFinished++;
    store.set('drift-runs', runsFinished);
    $('#stat-runs').textContent = runsFinished;
    PA.logPlay('drift', { score: score, top: topPlate });
    PA.sound.bad();
    showOverlay('The bed is jammed', 'Score ' + score, 'Best on record: ' + best + '. A new run costs nothing.', false);
  }

  function showOverlay(title, scoreLine, note, canContinue) {
    $('#drift-overlay-title').textContent = title;
    $('#drift-overlay-score').textContent = scoreLine;
    $('#drift-overlay-note').textContent = note;
    var again = $('#drift-again');
    again.textContent = canContinue ? 'Keep printing' : 'Press again';
    overlay.hidden = false;
  }

  /* ---------- input: keyboard + swipe ---------- */

  PA.keys.on({
    ArrowLeft: function () { move('left'); },
    ArrowRight: function () { move('right'); },
    ArrowUp: function () { move('up'); },
    ArrowDown: function () { move('down'); },
    w: function () { move('up'); },
    a: function () { move('left'); },
    s: function () { move('down'); },
    d: function () { move('right'); },
    z: function () { doUndo(); }
  });

  var touchStart = null;

  var bed = $('#bed');
  bed.addEventListener('touchstart', function (e) {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  bed.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var dx = e.changedTouches[0].clientX - touchStart.x;
    var dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  function doUndo() {
    if (!undoSnapshot || locked || over) return;
    restore(undoSnapshot);
    undoSnapshot = null;
    $('#undo').disabled = true;
    PA.sound.key();
  }

  $('#undo').addEventListener('click', doUndo);
  $('#restart').addEventListener('click', function () {
    PA.sound.key();
    startRun();
  });
  $('#drift-again').addEventListener('click', function () {
    if (over) {
      startRun();
    } else {
      overlay.hidden = true;
    }
  });

  startRun();
})();
