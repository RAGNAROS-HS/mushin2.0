/* Pixel layer: the beaver, his hero scene, the ~/log dam and status glyphs.
   Sprites are text maps — one letter per palette slot, "." is empty — drawn
   as SVG rects. Colours live in styles.css as --px-* tokens, switched by
   data-theme (light/dark) and data-beaver (quiet/loud) on <html>.
   Loaded before app.js, which calls window.HSKPixel on user actions. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ------------------------------------------------------------- sprites */

  /* O eye/outline · B fur · M fur shade · L muzzle/belly · G teeth/highlight
     P blush · N nose · T/X tail · K/Q wood · W/V leaves · D/E ground */
  var BEAVER = [
    ".........MM...................",
    "....BBBBBMMB..................",
    "..BBBBBBBBBBB..BBBB...........",
    ".BBBBBBBBBBBBBBBBBBBBB........",
    ".BBOGBBBBBBBBBBBBBBBBBB.......",
    ".BBOOBBBBBBBBBBBBBBBBBBB......",
    "NLLLBPBBBBBBBBBBBBBBBBBB......",
    "LLLLLBBBBBBBBBBBBBBBBBBBB.....",
    ".LGGLBBBBBBBBBBBBBBBBBBBB.....",
    "..GG.LLLBBBBBBBBBBBBBBBBB.....",
    "....LLLLBBBBBBBMBBBBBBBBB.....",
    "....LLLLLBBBBMMBBBBBBBBBB.....",
    "...BLLLLLBBBMBBBBBBBBBBB..TTT.",
    "...BLLLLLBBMBBBBBBBBBBB.TXTXTX",
    "..BBBLLL.BMBBBBBBBBBBB.TXTXTXT",
    ".BBBB..BBB.BBBBBBBBBB.TTTTTTT."
  ];

  function patch(base, rows) {
    var out = base.slice();
    for (var k in rows) out[k] = rows[k];
    return out;
  }

  var FRAMES = {
    idle:  BEAVER,
    blink: patch(BEAVER, { 4: ".BBBBBBBBBBBBBBBBBBBBBB......." }),
    gnawA: patch(BEAVER, { 8: ".LOOLBBBBBBBBBBBBBBBBBBBB....." }),
    gnawB: patch(BEAVER, { 10: "K...LLLLBBBBBBBMBBBBBBBBB....." })
  };
  FRAMES.sleep = FRAMES.blink;

  var GLYPHS = {
    tree:   ["...WW...", "..WWWW..", ".WWWWWW.", "..WWWW..", ".WWWWWW.", "WWWWWWWW", "...KK...", "...KK..."],
    gnawed: ["...WW...", "..WWWW..", ".WWWWWW.", "WWWWWWWW", "...KK...", "....K...", "...KK...", "G..KK.G."],
    log:    ["........", "........", "........", "KKKKKGG.", "KKKKGKKG", "KKKKGKKG", "KKKKKGG.", "........"],
    stump:  ["........", "........", "........", "........", "..GGGG..", "..KKKK..", "..KKKK..", ".KKKKKK."],
    lean:   [".....WW.", "....WWWW", "...WWWW.", "..WWWW..", "..KK....", "...K....", "...KK...", "...KK..."]
  };

  /* Project and objective states share one vocabulary: a tree's life. */
  var STATUS_GLYPH = {
    todo: "tree", active: "gnawed", practising: "gnawed", complete: "log", done: "log",
    abandoned: "stump", discontinued: "stump", limbo: "lean"
  };

  var LOG_END = [".QQQQ.", "QGGGGQ", "QGKKGQ", "QGKKGQ", "QGGGGQ", ".QQQQ."];

  function svg(rows, label) {
    var h = rows.length, w = 0, out = "";
    for (var y = 0; y < h; y++) {
      var r = rows[y], x = 0;
      if (r.length > w) w = r.length;
      while (x < r.length) {
        var c = r.charAt(x), x2 = x + 1;
        while (x2 < r.length && r.charAt(x2) === c) x2++;
        if (c !== ".") {
          out += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" class="p' + c + '"/>';
        }
        x = x2;
      }
    }
    var a = label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="px" viewBox="0 0 ' + w + " " + h + '" style="--cols:' + w + ";--rows:" + h + '"' + a + ">" + out + "</svg>";
  }

  /* ------------------------------------------------- procedural scenery */

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function Canvas(w, h) {
    this.w = w; this.h = h; this.px = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push(".");
      this.px.push(row);
    }
  }
  Canvas.prototype.set = function (x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y][x] = c;
  };
  Canvas.prototype.blit = function (rows, x0, y0) {
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var c = rows[y].charAt(x);
        if (c !== ".") this.set(x0 + x, y0 + y, c);
      }
    }
  };
  Canvas.prototype.rows = function () {
    return this.px.map(function (r) { return r.join(""); });
  };

  function trunk(cv, x, gy, h, w) {
    for (var y = gy - h; y < gy; y++) {
      for (var i = 0; i < w; i++) cv.set(x + i, y, i === w - 1 ? "Q" : "K");
    }
    cv.set(x - 1, gy - 1, "K");
    cv.set(x + w, gy - 1, "Q");
  }

  function blob(cv, cx, cy, r, rand) {
    for (var y = -r; y <= r; y++) {
      for (var x = -r; x <= r; x++) {
        var d = Math.sqrt(x * x + y * y * 1.3);
        if (d > r || (d > r - 1.2 && rand() < 0.45)) continue;
        cv.set(cx + x, cy + y, (x + y > r * 0.35 || rand() < 0.08) ? "V" : "W");
      }
    }
  }

  function chips(cv, x, gy, rand) {
    for (var i = -5; i < 10; i++) {
      if (rand() < 0.3) cv.set(x + i, gy - 1, rand() < 0.5 ? "G" : "K");
    }
  }

  function oak(cv, x, gy, h, seed, gnawed) {
    var rand = rng(seed), r = Math.max(5, Math.round(h * 0.3)), cy = gy - h + r;
    trunk(cv, x, gy, h - r, 4);
    blob(cv, x + 2, cy, r, rand);
    blob(cv, x + 2 - Math.round(r * 0.7), cy + Math.round(r * 0.5), Math.round(r * 0.7), rand);
    blob(cv, x + 2 + Math.round(r * 0.7), cy + Math.round(r * 0.4), Math.round(r * 0.75), rand);
    if (gnawed) {
      /* hourglass bite out of the trunk, chips at its foot */
      cv.set(x, gy - 5, "."); cv.set(x + 3, gy - 5, ".");
      cv.set(x, gy - 4, "."); cv.set(x + 3, gy - 4, "."); cv.set(x + 1, gy - 4, "G");
      cv.set(x, gy - 3, ".");
      chips(cv, x, gy, rand);
    }
  }

  function stump(cv, x, gy, w) {
    for (var i = 0; i < w; i++) cv.set(x + i, gy - 4, "G");
    cv.set(x + Math.floor(w / 2), gy - 4, "K");
    trunk(cv, x, gy, 3, w);
  }

  function log(cv, x, gy, len, seed) {
    var rand = rng(seed), y0 = gy - 6;
    for (var y = 0; y < 6; y++) {
      for (var i = 0; i < len; i++) {
        if ((y === 0 || y === 5) && i === 0) continue;
        cv.set(x + i, y0 + y, (y === 5 || (y > 0 && rand() < 0.12)) ? "Q" : "K");
      }
    }
    cv.blit(LOG_END, x + len - 3, y0);
  }

  function pile(cv, x, gy) {
    [[0, 0], [6, 0], [12, 0], [3, -6], [9, -6], [6, -12]].forEach(function (p) {
      cv.blit(LOG_END, x + p[0], gy - 6 + p[1]);
    });
  }

  function heroTree() {
    var cv = new Canvas(28, 34);
    oak(cv, 11, 34, 32, 23, true);
    return cv.rows();
  }

  function heroLogs() {
    var cv = new Canvas(30, 8);
    stump(cv, 1, 8, 5);
    log(cv, 9, 8, 18, 29);
    return cv.rows();
  }

  /* The red hat: earned only when the exam is passed (~/log). */
  var HAT = [
    "...RRRRRR.....................",
    "..RRRRRRRR....................",
    "RRRRRRRRRRRR.................."
  ];

  /* Dam: one log end per objective done, stacked in shrinking rows. */
  function dam(n) {
    var per = 12, rows = [], left = n;
    while (left > 0) { rows.push(Math.min(per, left)); left -= per; per--; }
    var cv = new Canvas(Math.max(6, 12 * 6), Math.max(6, rows.length * 6));
    rows.forEach(function (count, r) {
      for (var i = 0; i < count; i++) cv.blit(LOG_END, i * 6 + r * 3, cv.h - 6 - r * 6);
    });
    return cv.rows();
  }

  /* -------------------------------------------------------------- beaver */

  var hosts = [];
  var state = { frame: "idle", asleep: false, last: Date.now() };

  function host(hat) {
    var el = document.createElement("span");
    el.className = "bv";
    if (hat) el.setAttribute("data-hat", "1");
    el.innerHTML = '<span class="bv-sprite"></span><span class="bv-z" aria-hidden="true">z<sup>z</sup></span>';
    hosts.push(el);
    return el;
  }

  function draw() {
    var f = FRAMES[state.frame];
    var plain = svg(f, "pixel beaver"), hatted;
    hosts.forEach(function (h) {
      if (h.getAttribute("data-hat")) {
        hatted = hatted || svg(HAT.concat(f), "pixel beaver wearing a red hat");
        h.firstChild.innerHTML = hatted;
      } else {
        h.firstChild.innerHTML = plain;
      }
    });
  }

  function show(f) { state.frame = f; draw(); }

  function setClass(c, on) {
    hosts.forEach(function (h) { h.classList.toggle(c, on); });
  }

  function wake() {
    state.last = Date.now();
    if (!state.asleep) return;
    state.asleep = false;
    setClass("is-asleep", false);
    show("idle");
  }

  function sleep() {
    state.asleep = true;
    setClass("is-asleep", true);
    show("sleep");
  }

  var gnawTimer, gnawFlip = false;
  function key() {
    wake();
    gnawFlip = !gnawFlip;
    show(gnawFlip ? "gnawA" : "gnawB");
    clearTimeout(gnawTimer);
    gnawTimer = setTimeout(function () { show("idle"); }, 450);
  }

  function shake() {
    wake();
    if (RM) return;
    setClass("is-shaking", false);
    void (hosts[0] && hosts[0].offsetWidth);
    setClass("is-shaking", true);
    setTimeout(function () { setClass("is-shaking", false); }, 420);
  }

  function chew() {
    wake();
    var seq = ["gnawA", "gnawB", "gnawA", "gnawB", "idle"], i = 0;
    (function step() {
      show(seq[i++]);
      if (i < seq.length) setTimeout(step, 140);
    })();
  }

  function face(lang) { setClass("is-flipped", lang === "pl"); }

  function theme(t) { if (t === "dark") sleep(); else wake(); }

  /* ------------------------------------------------------- quiet / loud */

  var modeBtn = document.getElementById("beaver-toggle");

  function mode(m) {
    if (m !== "loud" && m !== "quiet") return doc.dataset.beaver;
    doc.dataset.beaver = m;
    store.set("hsk.beaver", m);
    if (modeBtn) modeBtn.textContent = m === "loud" ? "[quiet]" : "[loud]";
    return m;
  }

  /* ---------------------------------------------------------------- wire */

  var scene = document.getElementById("hero-scene");
  var mini = document.getElementById("beaver-mini");

  if (scene) {
    scene.insertAdjacentHTML("beforeend", svg(heroTree()));
    scene.appendChild(host());
    scene.insertAdjacentHTML("beforeend", svg(heroLogs()));
  }
  /* ~/log: the dam grows by one log per objective done. */
  var damScene = document.getElementById("dam-scene");
  if (damScene) {
    var done = parseInt(damScene.getAttribute("data-done"), 10) || 0;
    /* dam first: he faces left, towards his work */
    if (done > 0) damScene.insertAdjacentHTML("beforeend", svg(dam(done), done + " logs in the dam"));
    damScene.appendChild(host(damScene.getAttribute("data-hat") === "1"));
  }

  if (mini) mini.appendChild(host());
  draw();

  /* One beaver at a time: the hero one, or — once it scrolls away, or on
     pages without a hero — the small one in the console bar. */
  if (mini) {
    var big = scene || damScene;
    if (big && "IntersectionObserver" in window) {
      mini.hidden = true;
      new IntersectionObserver(function (entries) {
        var heroVisible = entries[0].isIntersecting;
        if (mini.hidden === heroVisible) return;
        mini.hidden = heroVisible;
        if (!heroVisible && !RM) {
          mini.classList.remove("is-hopping");
          void mini.offsetWidth;
          mini.classList.add("is-hopping");
        }
      }).observe(big);
    } else {
      mini.hidden = false;
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".status[data-status]"), function (el) {
    var g = GLYPHS[STATUS_GLYPH[el.getAttribute("data-status")]];
    if (!g) return;
    el.classList.add("has-px");
    el.insertAdjacentHTML("afterbegin", svg(g));
  });

  mode(doc.dataset.beaver === "loud" ? "loud" : "quiet");
  if (modeBtn) {
    modeBtn.addEventListener("click", function () {
      mode(doc.dataset.beaver === "loud" ? "quiet" : "loud");
      chew();
    });
  }

  ["keydown", "pointerdown"].forEach(function (ev) {
    document.addEventListener(ev, function () { wake(); }, true);
  });

  /* The only unprompted motion: a blink after 30 s of quiet, and in dark
     mode he dozes off again after 20 s. Nothing runs in a hidden tab. */
  setInterval(function () {
    if (document.hidden || state.asleep || state.frame !== "idle") return;
    var idle = Date.now() - state.last;
    if (doc.dataset.theme === "dark" && idle > 20000) { sleep(); return; }
    if (idle > 30000) {
      state.last = Date.now();
      show("blink");
      setTimeout(function () { if (state.frame === "blink") show("idle"); }, 180);
    }
  }, 1000);

  function sprite(name, label) {
    var g = GLYPHS[name];
    return g ? svg(g, label) : "";
  }

  window.HSKPixel = {
    key: key, shake: shake, chew: chew, theme: theme, face: face, mode: mode, wake: wake,
    sprite: sprite, STATUS_GLYPH: STATUS_GLYPH
  };
})();
