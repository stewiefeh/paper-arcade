/* ============================================================
   PAPER ARCADE — lexicon.js
   The word desk: one daily five-letter word, six guesses,
   free play mode, flip reveals, and a record kept locally.
   ============================================================ */
(function () {
  'use strict';

  var PA = window.PA;
  var $ = PA.$;
  var $$ = PA.$$;
  var store = PA.store;

  /* The list. Common, playable, deliberately without plurals of four
     letters plus an S. Around 300 words is enough to feel endless without
     feeling like a dictionary dump. */
  var WORDS = [
    'ABOUT','ABOVE','ABUSE','ACTOR','ACUTE','ADMIT','ADOPT','ADULT','AFTER','AGAIN',
    'AGENT','AGREE','AHEAD','ALARM','ALBUM','ALERT','ALIKE','ALIVE','ALLOW','ALONE',
    'ALONG','ALTER','AMONG','ANGER','ANGLE','ANGRY','APART','APPLE','APPLY','ARENA',
    'ARGUE','ARISE','ARRAY','ASIDE','ASSET','AUDIO','AUDIT','AVOID','AWAKE','AWARD',
    'AWARE','BADLY','BAKER','BASES','BASIC','BEACH','BEGAN','BEGIN','BEING','BELOW',
    'BENCH','BILLY','BIRTH','BLACK','BLAME','BLANK','BLAST','BLIND','BLOCK','BLOOD',
    'BOARD','BOOST','BOOTH','BOUND','BRAIN','BRAND','BRAVE','BREAD','BREAK','BRIEF',
    'BRING','BROAD','BROKE','BROWN','BUILD','BUILT','BUYER','CABLE','CANDY','CARRY',
    'CATCH','CAUSE','CHAIN','CHAIR','CHALK','CHART','CHASE','CHEAP','CHECK','CHESS',
    'CHIEF','CHILD','CHINA','CHOSE','CIVIL','CLAIM','CLASS','CLEAN','CLEAR','CLICK',
    'CLIMB','CLOCK','CLOSE','COACH','COAST','COULD','COUNT','COURT','COVER','CRAFT',
    'CRANE','CRASH','CRAZY','CREAM','CRIME','CROSS','CROWD','CROWN','CRUSH','CURVE',
    'CYCLE','DAILY','DANCE','DATED','DEALT','DEATH','DEBUT','DELAY','DEPTH','DIRTY',
    'DOUBT','DOZEN','DRAFT','DRAMA','DRANK','DREAM','DRESS','DRIFT','DRINK','DRIVE',
    'DROVE','DYING','EAGER','EARLY','EARTH','EIGHT','ELITE','EMPTY','ENEMY','ENJOY',
    'ENTER','ENTRY','EQUAL','ERROR','EVENT','EVERY','EXACT','EXIST','EXTRA','FAITH',
    'FALSE','FAULT','FIBER','FIELD','FIFTH','FIFTY','FIGHT','FINAL','FIRST','FIXED',
    'FLAME','FLASH','FLEET','FLOOR','FLUID','FOCUS','FORCE','FORTH','FORTY','FORUM',
    'FOUND','FRAME','FRANK','FRAUD','FRESH','FRONT','FRUIT','FULLY','FUNNY','GIANT',
    'GIVEN','GLASS','GLOBE','GOING','GRACE','GRADE','GRAND','GRANT','GRASS','GRAVE',
    'GREAT','GREEN','GROSS','GROUP','GROWN','GUARD','GUESS','GUEST','GUIDE','HAPPY',
    'HEART','HEAVY','HENCE','HORSE','HOTEL','HOUSE','HUMAN','IDEAL','IMAGE','INDEX',
    'INNER','INPUT','ISSUE','JOINT','JUDGE','KNOWN','LABEL','LARGE','LASER','LATER',
    'LAUGH','LAYER','LEARN','LEASE','LEAST','LEAVE','LEGAL','LEVEL','LIGHT','LIMIT',
    'LINKS','LIVES','LOCAL','LOGIC','LOOSE','LOWER','LUCKY','LUNCH','LYING','MAGIC',
    'MAJOR','MAKER','MARCH','MATCH','MAYBE','MAYOR','MEANT','MEDIA','METAL','MIGHT',
    'MINOR','MINUS','MIXED','MODEL','MONEY','MONTH','MORAL','MOTOR','MOUNT','MOUSE',
    'MOUTH','MOVIE','MUSIC','NEEDS','NEVER','NEWLY','NIGHT','NOISE','NORTH','NOTED',
    'NOVEL','NURSE','OCCUR','OCEAN','OFFER','OFTEN','ORDER','OTHER','OUGHT','PAINT',
    'PANEL','PAPER','PARTY','PEACE','PHASE','PHONE','PHOTO','PIANO','PIECE','PILOT',
    'PITCH','PIZZA','PLACE','PLAIN','PLANE','PLANT','PLATE','POINT','POUND','POWER',
    'PRESS','PRICE','PRIDE','PRIME','PRINT','PRIOR','PRIZE','PROOF','PROUD','PROVE',
    'QUEEN','QUICK','QUIET','QUITE','RADIO','RAISE','RANGE','RAPID','RATIO','REACH',
    'READY','REALM','REBEL','REFER','RELAX','REPLY','RIGHT','RIVAL','RIVER','ROBIN',
    'ROBOT','ROMAN','ROUGH','ROUND','ROUTE','ROYAL','RURAL','SCALE','SCENE','SCOPE',
    'SCORE','SENSE','SERVE','SEVEN','SHALL','SHAPE','SHARE','SHARP','SHEET','SHELF',
    'SHELL','SHIFT','SHINE','SHIRT','SHOCK','SHOOT','SHORE','SHORT','SHOWN','SIGHT',
    'SILLY','SINCE','SIXTH','SIXTY','SIZED','SKILL','SLEEP','SLIDE','SMALL','SMART',
    'SMILE','SMOKE','SOLID','SOLVE','SORRY','SOUND','SOUTH','SPACE','SPARE','SPEAK',
    'SPEED','SPEND','SPENT','SPLIT','SPOKE','SPORT','STAFF','STAGE','STAKE','STAND',
    'START','STATE','STEAM','STEEL','STICK','STILL','STONE','STOOD','STORE','STORM',
    'STORY','STRIP','STUCK','STUDY','STUFF','STYLE','SUGAR','SUITE','SUPER','SWEET',
    'TABLE','TAKEN','TASTE','TAXES','TEACH','TEETH','TEXAS','THANK','THEFT','THEIR',
    'THEME','THERE','THESE','THICK','THIN','THING','THINK','THIRD','THOSE','THREE',
    'THREW','THROW','TIGHT','TIMES','TIRED','TITLE','TODAY','TOPIC','TOTAL','TOUCH',
    'TOUGH','TOWER','TRACK','TRADE','TRAIN','TREAT','TREND','TRIAL','TRIBE','TRICK',
    'TRIED','TRIES','TRUCK','TRULY','TRUST','TRUTH','TWICE','UNDER','UNDUE','UNION',
    'UNITY','UNTIL','UPPER','UPSET','URBAN','USAGE','USUAL','VALID','VALUE','VIDEO',
    'VIRUS','VISIT','VITAL','VOICE','WASTE','WATCH','WATER','WHEEL','WHERE','WHICH',
    'WHILE','WHITE','WHOLE','WHOSE','WOMAN','WOMEN','WORLD','WORRY','WORSE','WORST',
    'WORTH','WOULD','WOUND','WRITE','WRONG','WROTE','YIELD','YOUNG','YOURS','YOUTH'
  ];

  var WORD_SET = {};
  WORDS.forEach(function (w) { WORD_SET[w] = true; });

  /* every letter that can start a guess, for the on-screen keyboard */
  var ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  /* ---------- state ---------- */

  var MAX_GUESSES = 6;
  var WORD_LEN = 5;

  var mode = 'daily';            /* daily | free */
  var answer = '';
  var guessIndex = 0;            /* row currently being filled */
  var letters = [];              /* letters typed into the active row */
  var solved = false;
  var dead = false;              /* ran out of guesses */
  var freeSeed = null;

  var record = store.get('lexicon', {
    played: 0, wins: 0, streak: 0, maxStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0],
    lastDaily: null, lastDailyWin: null
  });

  /* ---------- helpers ---------- */

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function daysSinceEpoch() {
    return Math.floor(Date.now() / 86400000);
  }

  function pickDaily() {
    return WORDS[daysSinceEpoch() % WORDS.length];
  }

  function pickFree() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  function saveRecord() {
    store.set('lexicon', record);
  }

  /* ---------- board ---------- */

  var boardEl = $('#board');
  var rows = [];

  function buildBoard() {
    boardEl.innerHTML = '';
    rows = [];
    for (var r = 0; r < MAX_GUESSES; r++) {
      var row = document.createElement('div');
      row.className = 'board__row';
      row.setAttribute('role', 'row');
      var tiles = [];
      for (var c = 0; c < WORD_LEN; c++) {
        var tile = document.createElement('div');
        tile.className = 'tile';
        tile.setAttribute('aria-label', 'Row ' + (r + 1) + ' slot ' + (c + 1) + ', empty');
        row.appendChild(tile);
        tiles.push(tile);
      }
      boardEl.appendChild(row);
      rows.push({ el: row, tiles: tiles, letters: [] });
    }
  }

  function renderActiveRow() {
    var row = rows[guessIndex];
    if (!row) return;
    row.letters = letters.slice();
    for (var c = 0; c < WORD_LEN; c++) {
      var tile = row.tiles[c];
      var ch = letters[c] || '';
      tile.textContent = ch;
      if (ch) {
        tile.setAttribute('data-filled', '');
        tile.setAttribute('aria-label', 'Row ' + (guessIndex + 1) + ' slot ' + (c + 1) + ', letter ' + ch);
      } else {
        tile.removeAttribute('data-filled');
        tile.setAttribute('aria-label', 'Row ' + (guessIndex + 1) + ' slot ' + (c + 1) + ', empty');
      }
      if (ch && !tile.classList.contains('pop')) {
        tile.classList.remove('pop');
        void tile.offsetWidth;
        tile.classList.add('pop');
      }
    }
  }

  /* grade a guess against the answer, two passes so repeated letters
     cannot over-claim: greens lock first, then oranges from what is left */
  function grade(guess, target) {
    var result = [];
    var pool = {};
    var i;
    for (i = 0; i < WORD_LEN; i++) {
      if (guess[i] === target[i]) {
        result.push('correct');
      } else {
        result.push(null);
        pool[target[i]] = (pool[target[i]] || 0) + 1;
      }
    }
    for (i = 0; i < WORD_LEN; i++) {
      if (result[i]) continue;
      var ch = guess[i];
      if (pool[ch] > 0) {
        result[i] = 'present';
        pool[ch]--;
      } else {
        result[i] = 'absent';
      }
    }
    return result;
  }

  function revealRow(rowIndex, guess, cb) {
    var row = rows[rowIndex];
    var marks = grade(guess, answer);
    var delays = 0;
    marks.forEach(function (mark, c) {
      var tile = row.tiles[c];
      setTimeout(function () {
        tile.classList.add('flip');
        tile.classList.add('is-' + mark);
        tile.setAttribute('aria-label', 'Row ' + (rowIndex + 1) + ' slot ' + (c + 1) + ', letter ' + guess[c] + ', ' + mark);
        updateKeyboard(guess[c], mark);
      }, c * 280);
      delays = c * 280;
    });
    setTimeout(cb, delays + 600);
  }

  /* ---------- keyboard ---------- */

  var keyEls = {};

  function buildKeyboard() {
    var kb = $('#keyboard');
    kb.innerHTML = '';
    var rowEls = [];
    ROWS.forEach(function (rowStr) {
      var rowEl = document.createElement('div');
      rowEl.className = 'lex-keyboard__row';
      rowStr.split('').forEach(function (ch) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lex-key';
        b.textContent = ch;
        b.setAttribute('aria-label', 'Letter ' + ch);
        b.addEventListener('click', function () { handleKey(ch); });
        keyEls[ch] = b;
        rowEl.appendChild(b);
      });
      rowEls.push(rowEl);
    });
    var enterRow = rowEls[2];
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'lex-key lex-key--wide';
    back.textContent = 'BACK';
    back.setAttribute('aria-label', 'Backspace');
    back.addEventListener('click', function () { handleKey('BACK'); });
    enterRow.insertBefore(back, enterRow.firstChild);
    var enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'lex-key lex-key--wide';
    enter.textContent = 'ENTER';
    enter.setAttribute('aria-label', 'Submit guess');
    enter.addEventListener('click', function () { handleKey('ENTER'); });
    enterRow.appendChild(enter);
    kb.appendChild(rowEls[0]);
    kb.appendChild(rowEls[1]);
    kb.appendChild(rowEls[2]);
  }

  function updateKeyboard(ch, mark) {
    var el = keyEls[ch];
    if (!el) return;
    var rank = { absent: 1, present: 2, correct: 3 };
    var cur = el.getAttribute('data-correct') ? 'correct' :
              el.getAttribute('data-present') ? 'present' :
              el.getAttribute('data-absent') ? 'absent' : null;
    if (!cur || rank[mark] > rank[cur]) {
      el.removeAttribute('data-correct');
      el.removeAttribute('data-present');
      el.removeAttribute('data-absent');
      el.setAttribute('data-' + mark, '');
    }
  }

  /* ---------- game flow ---------- */

  function handleKey(key) {
    if (solved || dead) return;
    if (key === 'ENTER') return submit();
    if (key === 'BACK') {
      letters.pop();
      renderActiveRow();
      PA.sound.key();
      return;
    }
    if (/^[A-Z]$/.test(key) && letters.length < WORD_LEN) {
      letters.push(key);
      renderActiveRow();
      PA.sound.key();
    }
  }

  function submit() {
    if (letters.length < WORD_LEN) {
      shake('Not enough letters. The press wants five.');
      return;
    }
    var guess = letters.join('');
    if (!WORD_SET[guess]) {
      shake('That word is not on the list.');
      return;
    }
    var rowIndex = guessIndex;
    letters = [];
    PA.sound.ok();
    revealRow(rowIndex, guess, function () {
      guessIndex++;
      if (guess === answer) return finish(true, guess);
      if (guessIndex >= MAX_GUESSES) return finish(false, guess);
      renderActiveRow();
    });
  }

  function shake(message) {
    boardEl.classList.remove('shake');
    void boardEl.offsetWidth;
    boardEl.classList.add('shake');
    PA.sound.miss();
    PA.toast(message);
  }

  function finish(won, guess) {
    solved = won;
    dead = !won;
    record.played++;
    if (won) {
      record.wins++;
      record.streak++;
      record.maxStreak = Math.max(record.maxStreak, record.streak);
      record.distribution[guessIndex - 1]++;
      if (mode === 'daily') record.lastDailyWin = todayKey();
      PA.sound.win();
      PA.confetti();
    } else {
      record.streak = 0;
      PA.sound.bad();
    }
    if (mode === 'daily') record.lastDaily = todayKey();
    saveRecord();
    PA.logPlay('lexicon', { won: won, guesses: won ? guessIndex : null });
    renderStats();
    showOverlay(won, guess);
  }

  function showOverlay(won, guess) {
    var overlay = $('#board-overlay');
    var title = $('#overlay-title');
    var note = $('#overlay-note');
    var freeAgain = $('#free-again');
    $('#overlay-word').textContent = answer;
    if (won) {
      title.textContent = guessIndex === 1 ? 'First press, clean sheet' :
        guessIndex <= 3 ? 'Sharp eye' : 'Got there in the end';
      note.textContent = 'Solved in ' + guessIndex + ' of 6.';
    } else {
      title.textContent = 'Out of presses';
      note.textContent = 'The word was ' + answer + '. It happens to everyone.';
    }
    if (mode === 'daily') {
      var msLeft = (daysSinceEpoch() + 1) * 86400000 - Date.now();
      var hrs = Math.floor(msLeft / 3600000);
      var mins = Math.floor((msLeft % 3600000) / 60000);
      note.textContent += ' Next daily word in about ' + hrs + 'h ' + mins + 'm.';
    }
    freeAgain.hidden = mode !== 'daily';
    overlay.hidden = false;
  }

  /* ---------- modes ---------- */

  function setMode(next) {
    mode = next;
    var toggle = $('#mode-toggle');
    overlayHide();
    solved = false;
    dead = false;
    guessIndex = 0;
    letters = [];
    answer = next === 'daily' ? pickDaily() : (freeSeed ? freeSeed : (freeSeed = pickFree()));
    buildBoard();
    renderActiveRow();
    if (next === 'daily') {
      toggle.textContent = 'Switch to free play';
      toggle.setAttribute('aria-pressed', 'false');
    } else {
      toggle.textContent = 'Back to the daily word';
      toggle.setAttribute('aria-pressed', 'true');
      freeSeed = null;
    }
  }

  function overlayHide() {
    $('#board-overlay').hidden = true;
  }

  /* ---------- stats panel ---------- */

  function renderStats() {
    $('#stat-streak').textContent = record.streak;
    $('#stat-max').textContent = record.maxStreak;
    $('#stat-winpct').textContent = record.played
      ? Math.round((record.wins / record.played) * 100) + '%'
      : '\u2013';
    drawDistribution();
  }

  function drawDistribution() {
    var canvas = $('#dist-chart');
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || 280;
    var h = 120;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    var dist = record.distribution;
    var max = Math.max.apply(null, dist.concat([1]));
    var total = record.wins;
    var empty = $('#dist-empty');
    if (!total) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    var barW = w / 6 - 8;
    var styles = getComputedStyle(document.documentElement);
    var ink = styles.getPropertyValue('--ink').trim();
    var accent = styles.getPropertyValue('--green').trim();
    var soft = styles.getPropertyValue('--ink-faint').trim();
    dist.forEach(function (count, i) {
      var barH = count ? Math.max(10, (count / max) * (h - 34)) : 3;
      var x = i * (w / 6) + 4;
      var y = h - 22 - barH;
      ctx.fillStyle = count ? accent : soft;
      ctx.globalAlpha = count ? 1 : 0.4;
      ctx.fillRect(x, y, barW, barH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.font = '700 10px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x + barW / 2, h - 8);
      if (count) {
        ctx.fillText(String(count), x + barW / 2, y - 3);
      }
    });
  }

  /* ---------- share ---------- */

  function shareResult() {
    var marks = [];
    var lastRow = solved ? guessIndex : MAX_GUESSES;
    for (var r = 0; r < lastRow; r++) {
      var line = '';
      var row = rows[r];
      row.tiles.forEach(function (tile) {
        if (tile.classList.contains('is-correct')) line += '\uD83D\uDFE9';
        else if (tile.classList.contains('is-present')) line += '\uD83D\uDFE8';
        else if (tile.classList.contains('is-absent')) line += '\u2B1B';
      });
      if (line) marks.push(line);
    }
    var head = 'Paper Arcade Lexicon ' +
      (mode === 'daily' ? todayKey() : 'free play') + ' ' +
      (solved ? guessIndex + '/6' : 'X/6');
    var text = head + '\n' + marks.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        PA.toast('Result copied. Word stays secret.');
      });
    } else {
      PA.toast(text);
    }
  }

  /* ---------- help modal ---------- */

  function initModal() {
    var modal = $('#help-modal');
    $('#help-open').addEventListener('click', function () {
      modal.hidden = false;
      var close = $('.modal__close', modal);
      if (close) close.focus();
    });
    $$('[data-modal-close]', modal).forEach(function (b) {
      b.addEventListener('click', function () { modal.hidden = true; });
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) modal.hidden = true;
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    buildBoard();
    buildKeyboard();
    renderStats();
    initModal();

    /* daily already played? open on free play instead */
    if (record.lastDaily === todayKey()) {
      setMode('free');
      PA.toast('Today\'s word is solved. Free play is open.');
    } else {
      setMode('daily');
    }

    $('#mode-toggle').addEventListener('click', function () {
      freeSeed = null;
      setMode(mode === 'daily' ? 'free' : 'daily');
    });

    $('#share-result').addEventListener('click', shareResult);
    $('#free-again').addEventListener('click', function () {
      freeSeed = null;
      setMode('free');
    });

    PA.keys.on({
      Enter: function () { handleKey('ENTER'); return false; },
      Backspace: function () { handleKey('BACK'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        var active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        handleKey(e.key.toUpperCase());
      }
    });
  });
})();
