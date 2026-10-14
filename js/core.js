/* ============================================================
   PAPER ARCADE — core.js
   Shared machinery: storage, toasts, the sound engine, scroll
   reveals, ink mode, nav, and a tiny confetti printer.
   Every game leans on this file; nothing here knows about the
   games, so it stays boring on purpose.
   ============================================================ */
(function () {
  'use strict';

  var PA = (window.PA = window.PA || {});

  /* ---------- DOM helpers ---------- */

  PA.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };

  PA.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ---------- local storage, namespaced under "pa:" ---------- */

  PA.store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem('pa:' + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem('pa:' + key, JSON.stringify(value));
      } catch (err) {
        /* private mode, full disk: the game still plays, records just vanish */
      }
    },
    remove: function (key) {
      try {
        localStorage.removeItem('pa:' + key);
      } catch (err) {}
    },
    wipe: function () {
      try {
        var dead = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('pa:') === 0) dead.push(k);
        }
        dead.forEach(function (k) {
          localStorage.removeItem(k);
        });
      } catch (err) {}
    }
  };

  /* ---------- the play log: every finished game writes a line ---------- */

  PA.logPlay = function (game, meta) {
    var log = PA.store.get('log', []);
    log.push({
      game: game,
      day: new Date().toISOString().slice(0, 10),
      ts: Date.now(),
      meta: meta || {}
    });
    /* keep the ledger at a sane size: two weeks is plenty */
    var cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    log = log.filter(function (row) { return row.ts >= cutoff; });
    PA.store.set('log', log);
  };

  /* ---------- toast ---------- */

  var toastTimer = null;

  PA.toast = function (message, ms) {
    var el = PA.$('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-shown');
    }, ms || 2600);
  };

  /* ---------- the sound engine: one oscillator, kept humble ---------- */

  var soundCtx = null;

  PA.sound = {
    muted: PA.store.get('sound-muted', false),

    ctx: function () {
      if (!soundCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        soundCtx = new AC();
      }
      if (soundCtx.state === 'suspended') soundCtx.resume();
      return soundCtx;
    },

    tone: function (freq, dur, type, volume) {
      if (this.muted) return null;
      var ctx = this.ctx();
      if (!ctx) return null;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume || 0.06, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (dur || 0.14));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (dur || 0.14) + 0.02);
      return osc;
    },

    /* named effects so games do not hand-tune frequencies */
    key: function () { this.tone(660, 0.05, 'square', 0.025); },
    ok: function () { this.tone(523.25, 0.1); this.tone(659.25, 0.12); },
    miss: function () { this.tone(196, 0.18, 'sawtooth', 0.05); },
    bad: function () {
      this.tone(233.08, 0.16, 'sawtooth', 0.05);
      setTimeout(function () { this.tone(155.56, 0.24, 'sawtooth', 0.05); }.bind(this), 120);
    },
    win: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (n, i) {
        setTimeout(function () { PA.sound.tone(n, 0.16); }, i * 110);
      });
    },
    toggle: function () {
      this.muted = !this.muted;
      PA.store.set('sound-muted', this.muted);
      return this.muted;
    }
  };

  /* ---------- scroll reveals ---------- */

  PA.initReveal = function () {
    var items = PA.$$('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el, i) {
      if (!el.style.getPropertyValue('--reveal-delay')) {
        el.style.setProperty('--reveal-delay', Math.min(i % 6, 5) * 60 + 'ms');
      }
      io.observe(el);
    });
  };

  /* ---------- ink mode: one attribute, everywhere ---------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    PA.store.set('theme', theme);
    PA.$$('[data-theme-label]').forEach(function (el) {
      el.textContent = theme === 'ink' ? 'Paper mode' : 'Ink mode';
    });
  }

  PA.initTheme = function () {
    applyTheme(PA.store.get('theme', 'paper'));
    PA.$$('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'ink' ? 'paper' : 'ink';
        applyTheme(next);
        PA.sound.key();
      });
    });
  };

  /* ---------- mobile nav ---------- */

  PA.initNav = function () {
    var toggle = PA.$('[data-nav-toggle]');
    var nav = PA.$('[data-nav]');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  };

  /* ---------- page transitions: view transitions where supported ---------- */

  function initTransitions() {
    if (!document.startViewTransition) return;
    document.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[href]') : null;
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#' || link.target === '_blank') return;
      var url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      document.startViewTransition(function () {
        location.href = url.href;
      });
    });
  }

  /* ---------- confetti: a small press run of scraps ---------- */

  PA.confetti = function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:400;pointer-events:none;';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var colors = ['#e8511c', '#2b6e62', '#d9a514', '#191510'];
    var bits = [];
    for (var i = 0; i < 90; i++) {
      bits.push({
        x: Math.random() * innerWidth,
        y: -20 - Math.random() * innerHeight * 0.4,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        vy: 2.4 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.22,
        color: colors[i % colors.length]
      });
    }
    var start = performance.now();
    function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      var done = true;
      bits.forEach(function (b) {
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        if (b.y < innerHeight + 30) done = false;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      });
      if (!done && now - start < 3200) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(frame);
  };

  /* ---------- keyboard utility ---------- */

  PA.keys = {
    on: function (map) {
      document.addEventListener('keydown', function (e) {
        var fn = map[e.key];
        if (fn) {
          var stop = fn(e);
          if (stop !== false) {
            /* handled: keep arrow keys from scrolling the page */
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) {
              e.preventDefault();
            }
          }
        }
      });
    }
  };

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    PA.initTheme();
    PA.initNav();
    PA.initReveal();
    initTransitions();
  });
})();
