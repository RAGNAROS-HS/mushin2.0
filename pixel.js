/* Pixel layer: the beaver, his hero scene, the ~/log groves and cabin,
   the favicon and status glyphs.
   Sprites are text maps — one letter per palette slot, "." is empty — drawn
   as SVG rects. Colours live in styles.css as --px-* tokens, switched by
   data-theme (light/dark) and data-beaver (quiet/loud) on <html>.
   Loaded before app.js, which calls window.HSKPixel on user actions. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ------------------------------------------------------------- sprites */

  /* O eye/outline · B fur · M fur shade · L muzzle/belly · G teeth/highlight
     P blush · N nose · T/X tail, roof · K/Q wood · W/V leaves · R hat
     Y hard hat · U blueprint · S stone · A window glass */
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
    "..BBBLLLBBMBBBBBBBBBBB.TXTXTXT",
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
    gnawB: patch(BEAVER, { 8: ".LLLLBBBBBBBBBBBBBBBBBBBB.....", 9: ".....LLLBBBBBBBBBBBBBBBBB....." })
  };
  FRAMES.sleep = FRAMES.blink;

  var GLYPHS = {
    tree:   ["...WW...", "..WWWW..", ".WWWWWW.", "..WWWW..", ".WWWWWW.", "WWWWWWWW", "...KK...", "...KK..."],
    gnawed: ["...WW...", "..WWWW..", ".WWWWWW.", "WWWWWWWW", "...KK...", "....K...", "...KK...", "...KK..."],
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

  function width(rows) {
    var w = 0;
    for (var y = 0; y < rows.length; y++) if (rows[y].length > w) w = rows[y].length;
    return w;
  }

  function wrap(w, h, label, inner) {
    var a = label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="px" viewBox="0 0 ' + w + " " + h + '" style="--cols:' + w + ";--rows:" + h + '"' + a + ">" + inner + "</svg>";
  }

  /* Filled cells of `rows` as run-length rects, one class per palette slot. */
  function fills(rows) {
    var out = "";
    for (var y = 0; y < rows.length; y++) {
      var r = rows[y], x = 0;
      while (x < r.length) {
        var c = r.charAt(x), x2 = x + 1;
        while (x2 < r.length && r.charAt(x2) === c) x2++;
        if (c !== ".") {
          out += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" class="p' + c + '"/>';
        }
        x = x2;
      }
    }
    return out;
  }

  function svg(rows, label) {
    var h = rows.length, w = width(rows);
    return wrap(w, h, label, edges(rows, w, h) + fills(rows));
  }

  function edges(rows, w, h) {
    var out = "", x, y;

    function at(x, y) {
      var r = rows[y];
      return r && x >= 0 && x < r.length ? r.charAt(x) : ".";
    }

    /* Outline: every empty cell beside a filled one gets a rect (class `z`,
       coloured by --px-Z per palette). It sits one cell outside the sprite
       (svg.px is overflow: visible), so it never changes a sprite's size or
       position. */
    function edge(x, y) {
      return at(x, y) === "." &&
        (at(x - 1, y) !== "." || at(x + 1, y) !== "." || at(x, y - 1) !== "." || at(x, y + 1) !== ".");
    }
    for (y = -1; y <= h; y++) {
      x = -1;
      while (x <= w) {
        var e = edge(x, y), x2 = x + 1;
        while (x2 <= w && edge(x2, y) === e) x2++;
        if (e) {
          out += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" class="z"/>';
        }
        x = x2;
      }
    }
    return out;
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
  /* Lean pass for procedural shapes: drop pixels with at most one filled
     neighbour (strays) and fill gaps with three or more (notches), so the
     outline traces a clean edge instead of speckle. */
  Canvas.prototype.lean = function () {
    var self = this;
    function at(x, y) { return x >= 0 && y >= 0 && x < self.w && y < self.h ? self.px[y][x] : "."; }
    for (var pass = 0; pass < 2; pass++) {
      var next = this.px.map(function (r) { return r.slice(); });
      for (var y = 0; y < this.h; y++) {
        for (var x = 0; x < this.w; x++) {
          var n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter(function (c) { return c !== "."; });
          if (this.px[y][x] !== "." && n.length <= 1) next[y][x] = ".";
          else if (this.px[y][x] === "." && n.length >= 3) next[y][x] = n[0];
        }
      }
      this.px = next;
    }
    return this;
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

  /* opt.tw (trunk width) and opt.r (crown radius) shrink the hero oak into
     the ~/log saplings without changing its shape. */
  function oak(cv, x, gy, h, seed, gnawed, opt) {
    opt = opt || {};
    var rand = rng(seed), tw = opt.tw || 4, cx = x + Math.floor(tw / 2);
    var r = opt.r || Math.max(5, Math.round(h * 0.3)), cy = gy - h + r;
    trunk(cv, x, gy, h - r, tw);
    blob(cv, cx, cy, r, rand);
    blob(cv, cx - Math.round(r * 0.7), cy + Math.round(r * 0.5), Math.round(r * 0.7), rand);
    blob(cv, cx + Math.round(r * 0.7), cy + Math.round(r * 0.4), Math.round(r * 0.75), rand);
    cv.lean();
    /* root flares are single pixels on purpose; put them back after lean() */
    cv.set(x - 1, gy - 1, "K");
    cv.set(x + tw, gy - 1, "Q");
    if (gnawed && tw < 4) {
      /* a sapling's bite: one notch with pale wood showing */
      cv.set(x, gy - 4, "."); cv.set(x, gy - 3, "G"); cv.set(x + 1, gy - 4, "G");
    } else if (gnawed) {
      /* hourglass bite out of the trunk */
      cv.set(x, gy - 5, "."); cv.set(x + 3, gy - 5, ".");
      cv.set(x, gy - 4, "."); cv.set(x + 3, gy - 4, ".");
      cv.set(x, gy - 3, ".");
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

  /* While the cabin is going up he is the builder: hard hat (Y), carpenter's
     pencil behind the ear, blueprint (U) of the finished cabin held out. */
  var HARDHAT = [
    "......YYYY.....",
    "....YGYYYYYY...",
    "...YGYYYYYYYY..",
    "..YYYYYYYYYYYY.",
    "YYYYYYYYYYYYYYY"
  ];
  var BLUEPRINT = [
    ".UUUUUUU.",
    "UUUUGUUUU",
    "UUUGUGUUU",
    "UUGUUUGUU",
    "UUGUGUGUU",
    "UUGGGGGUU",
    ".UUUUUUU."
  ];

  function dress(rows, kit) {
    if (kit === "hat") return HAT.concat(rows);
    if (kit !== "build") return rows;
    var pad = 7, top = 3, cv = new Canvas(rows[0].length + pad, rows.length + top);
    cv.blit(rows, pad, top);
    cv.blit(HARDHAT, pad, 0);
    /* pencil, eraser end tucked under the hat */
    cv.set(pad + 15, 4, "P"); cv.set(pad + 16, 3, "Y"); cv.set(pad + 17, 2, "Y");
    cv.set(pad + 18, 1, "L"); cv.set(pad + 19, 0, "O");
    cv.blit(BLUEPRINT, 0, top + 9);
    for (var x = 8; x <= 10; x++) { cv.set(x, top + 11, "L"); cv.set(x, top + 13, "L"); }
    return cv.rows();
  }

  /* ---------------------------------------------------------------- ~/log */

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function attr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* One objective, one sapling: height and crown come from its id, so a
     grove reads as a stand of different trees and looks the same on every
     visit. A felled one leaves its stump; the log went to the cabin. */
  function grove(st, id) {
    var seed = hash(String(id)), rand = rng(seed), cv = new Canvas(16, 20);
    var h = 14 + Math.floor(rand() * 6);
    if (st === "done") {
      stump(cv, 6, 20, 4);
      cv.set(3, 19, "G"); cv.set(12, 19, "G"); cv.set(13, 18, "K");
    } else {
      oak(cv, 7, 20, h, seed, st === "practising", { tw: 2, r: h > 16 ? 5 : 4 });
    }
    return cv.rows();
  }

  /* The cabin built from the felled trees. Three-quarter view: the front
     wall faces us, the gable wall recedes up-right (1 px up per 2 across).
     It is a list of pieces in build order — foundation, notched wall
     courses, gable, roof, chimney, then door, window, flowers and step —
     and ~/log shows the first n/total of them, so every passed objective
     adds at least one piece and the last one finishes the house. */
  var CABIN;
  function cabinPieces() {
    if (CABIN) return CABIN;
    var C = 10, CH = 3, FX = 4, FW = 28, SX = FX + FW, SW = 14, MID = 7, GH = 9;
    var YT = 26, GY = YT + C * CH, W = SX + SW + 2, H = GY + 2;
    var DOOR = [FX + 5, FX + 10, 0, 5], WIN = [FX + 16, FX + 22, 4, 6];
    var RING = [".Q.", "QLQ", ".Q."];
    var rand = rng(41), list = [];
    var x, y, i, k, c, p;

    function piece() { var cv = new Canvas(W, H); list.push(cv); return cv; }
    function dy(i) { return -Math.floor(i / 2); }
    function gable(i) { return Math.round(GH * (1 - Math.abs(i - MID) / MID)); }
    function open(o, x, c) { return x >= o[0] && x <= o[1] && c >= o[2] && c <= o[3]; }
    function logRow(k) { return k === 2 ? "Q" : (k === 1 && rand() < 0.1 ? "Q" : "K"); }
    function sideRow(k) { return k === 2 ? "M" : (k === 1 && rand() < 0.1 ? "M" : "Q"); }

    /* foundation stones */
    p = piece();
    for (x = FX - 1; x < SX; x++) p.set(x, GY, x % 3 ? "S" : "M");
    p = piece();
    for (i = 0; i < SW; i++) p.set(SX + i, GY + dy(i), i % 3 ? "S" : "M");

    /* wall courses: front logs split around the door and window openings,
       then the side log, whose ends ring both corners */
    for (c = 0; c < C; c++) {
      var y0 = GY - CH * (c + 1), was = false;
      p = piece();
      p.blit(RING, FX - 3, y0);
      for (x = FX; x < SX; x++) {
        var hole = open(DOOR, x, c) || open(WIN, x, c);
        if (was && !hole) p = piece();
        for (k = 0; k < CH; k++) p.set(x, y0 + k, hole ? "O" : logRow(k));
        was = hole;
      }
      p = piece();
      for (i = 0; i < SW; i++) {
        for (k = 0; k < CH; k++) p.set(SX + i, y0 + dy(i) + k, sideRow(k));
      }
      p.blit(RING, SX - 1, y0);
      p.blit(RING, SX + SW - 1, y0 + dy(SW - 1));
    }

    /* gable, three short courses */
    for (k = 0; k < 3; k++) {
      p = piece();
      for (i = 1; i < SW; i++) {
        var top = YT + dy(i) - gable(i);
        for (var r = 0; r < CH; r++) {
          y = YT + dy(i) - CH * k - 1 - r;
          if (y >= top) p.set(SX + i, y, sideRow(r === 0 ? 2 : 0));
        }
      }
    }

    /* roof: the near plane, from the eave up to the ridge, in shingle
       bands of two rows laid in three runs */
    var RISE = gable(MID) - dy(MID), L0 = FX - 3, SPAN = SX + 1 - L0 + 1;
    function shift(y) { return Math.round((YT - y) * MID / RISE); }
    for (var band = 0; band * 2 <= RISE; band++) {
      for (var run = 0; run < 3; run++) {
        p = piece();
        for (var row = 0; row < 2; row++) {
          y = YT - band * 2 - row;
          if (y < YT - RISE) continue;
          var a = Math.floor(SPAN * run / 3), b = Math.floor(SPAN * (run + 1) / 3);
          for (i = a; i < b; i++) {
            var seam = (i + band * 2) % 5 === 0;
            p.set(L0 + shift(y) + i, y, row === 0 || seam ? "T" : "X");
          }
        }
      }
    }

    /* ridge cap, and the far roof's edge showing over the gable */
    p = piece();
    for (i = 0; i < SPAN; i++) p.set(L0 + shift(YT - RISE) + i, YT - RISE - 1, "T");
    for (i = MID; i <= SW + 1; i++) {
      y = YT + dy(i) - gable(i) - 1;
      p.set(SX + i, y, "T"); p.set(SX + i, y - 1, "T");
    }

    /* chimney, bottom up, then its cap */
    for (k = 0; k < 4; k++) {
      p = piece();
      for (r = 0; r < 3; r++) {
        y = YT - 6 - k * 3 - r;
        for (x = 30; x < 34; x++) p.set(x, y, (x + (r === 1 ? 2 : 0)) % 4 === 0 || r === 2 ? "M" : "S");
      }
      if (k === 3) for (x = 29; x < 35; x++) p.set(x, YT - 18, "Q");
    }

    /* finishing: door, window, flower box, doorstep */
    p = piece();
    for (y = GY - CH * 6; y < GY; y++) {
      for (x = DOOR[0]; x <= DOOR[1]; x++) p.set(x, y, (x - DOOR[0]) % 2 ? "Q" : "K");
    }
    p.set(DOOR[1] - 1, GY - 9, "G");
    p = piece();
    var wt = GY - CH * (WIN[3] + 1), wb = GY - CH * WIN[2] - 1;
    for (y = wt; y <= wb; y++) {
      for (x = WIN[0]; x <= WIN[1]; x++) {
        var edge = y === wt || y === wb || x === WIN[0] || x === WIN[1];
        var bar = x === (WIN[0] + WIN[1]) / 2 || y === Math.floor((wt + wb) / 2);
        p.set(x, y, edge || bar ? "Q" : "A");
      }
    }
    p.set(WIN[0] + 1, wt + 1, "G");
    p = piece();
    for (x = WIN[0] - 1; x <= WIN[1] + 1; x++) {
      p.set(x, wb + 2, "Q");
      p.set(x, wb + 1, x % 2 ? "W" : "P");
    }
    p = piece();
    for (x = DOOR[0] - 1; x <= DOOR[1] + 1; x++) p.set(x, GY + 1, "S");

    /* smoke, only once the house is finished: two frames for hover */
    var smoke = [[[31, 7], [32, 6], [32, 5], [33, 3]], [[32, 7], [31, 5], [32, 4], [31, 2]]];

    CABIN = { w: W, h: H, pieces: list.map(function (cv) { return cv.rows(); }), smoke: smoke };
    return CABIN;
  }

  /* logs: [{id, text, date}] in the order they were passed. */
  function cabin(n, total, logs) {
    var cab = cabinPieces(), all = cab.pieces, P = all.length;
    var k = total > 0 ? Math.min(P, Math.floor(Math.min(n, total) * P / total)) : 0;
    var union = new Canvas(cab.w, cab.h), body = "", i;
    for (i = 0; i < k; i++) {
      union.blit(all[i], 0, 0);
      var o = logs && logs[Math.floor(i * total / P)];
      var t = o ? "<title>" + attr(o.id + " · " + o.text + (o.date ? " · passed " + o.date : "")) + "</title>" : "";
      body += "<g>" + t + fills(all[i]) + "</g>";
    }
    if (k === P) {
      cab.smoke.forEach(function (f, j) {
        body += '<g class="smoke smoke-' + j + '">' + f.map(function (q) {
          return '<rect x="' + q[0] + '" y="' + q[1] + '" width="1" height="1" class="pL"/>';
        }).join("") + "</g>";
      });
    }
    var label = k === P ? "log cabin, finished" : "log cabin under construction, " + n + " of " + total + " logs";
    return wrap(cab.w, cab.h, label, edges(union.rows(), cab.w, cab.h) + body);
  }

  /* The next log, waiting beside the builder. */
  function nextLog() {
    var cv = new Canvas(14, 6);
    log(cv, 0, 6, 14, 7);
    return cv.rows();
  }

  /* -------------------------------------------------------------- beaver */

  var hosts = [];
  var state = { frame: "idle", asleep: false, last: Date.now() };

  /* kit: "hat" (exam passed), "build" (cabin going up) or nothing. */
  function host(kit) {
    var el = document.createElement("span");
    el.className = "bv";
    if (kit) el.setAttribute("data-kit", kit);
    el.innerHTML = '<span class="bv-sprite"></span><span class="bv-z" aria-hidden="true">z<sup>z</sup></span>';
    hosts.push(el);
    return el;
  }

  function draw() {
    var f = FRAMES[state.frame];
    var label = { hat: "pixel beaver wearing a red hat", build: "pixel beaver in a hard hat, holding the cabin's blueprint" };
    var cache = {};
    hosts.forEach(function (h) {
      var kit = h.getAttribute("data-kit") || "";
      cache[kit] = cache[kit] || svg(dress(f, kit), label[kit] || "pixel beaver");
      h.firstChild.innerHTML = cache[kit];
    });
    favicon();
  }

  /* Favicon: his head, in the current palette; eyes shut while the tab is
     hidden. A favicon can't read CSS variables, so colours are resolved. */
  var icon = document.querySelector('link[rel="icon"]'), iconKey = "";
  function favicon() {
    if (!icon || !window.getComputedStyle) return;
    var cs = getComputedStyle(doc);
    var name = document.hidden || state.asleep ? "blink" : "idle";
    var key = name + doc.dataset.theme + doc.dataset.beaver;
    if (key === iconKey) return;
    iconKey = key;
    var f = FRAMES[name];
    var head = f.slice(0, 10).map(function (r) { return r.slice(0, 13); });
    var inner = (edges(head, 13, 10) + fills(head)).replace(/class="(?:p(\w)|z)"/g, function (m, c) {
      return 'fill="' + cs.getPropertyValue("--px-" + (c || "Z")).trim() + '"';
    });
    icon.href = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.5 -3 16 16" shape-rendering="crispEdges">' + inner + "</svg>");
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

  function chew() {
    wake();
    var seq = ["gnawA", "gnawB", "gnawA", "gnawB", "idle"], i = 0;
    (function step() {
      show(seq[i++]);
      if (i < seq.length) setTimeout(step, 140);
    })();
  }

  function face(lang) { setClass("is-flipped", lang === "pl"); }

  function theme(t) { if (t === "dark") sleep(); else wake(); favicon(); }

  /* ------------------------------------------------------- quiet / loud */

  var modeBtn = document.getElementById("beaver-toggle");

  function mode(m) {
    if (m !== "loud" && m !== "quiet") return doc.dataset.beaver;
    doc.dataset.beaver = m;
    store.set("hsk.beaver", m);
    if (modeBtn) modeBtn.textContent = m === "loud" ? "[quiet]" : "[loud]";
    favicon();
    return m;
  }

  /* ---------------------------------------------------------------- wire */

  var scene = document.getElementById("hero-scene");

  if (scene) {
    scene.insertAdjacentHTML("beforeend", svg(heroTree()));
    scene.appendChild(host());
    scene.insertAdjacentHTML("beforeend", svg(heroLogs()));
  }
  /* ~/log: the cabin grows by one piece per objective passed. Cabin first:
     he faces left, towards his work, blueprint held out to it. */
  var build = document.getElementById("build-scene");
  if (build) {
    var done = parseInt(build.getAttribute("data-done"), 10) || 0;
    var total = parseInt(build.getAttribute("data-total"), 10) || 0;
    var passed = build.getAttribute("data-hat") === "1", logs = [];
    try { logs = JSON.parse(build.getAttribute("data-logs") || "[]"); } catch (e) {}
    build.insertAdjacentHTML("beforeend", cabin(done, total, logs));
    if (!passed && done > 0 && done < total) build.insertAdjacentHTML("beforeend", svg(nextLog()));
    build.appendChild(host(passed ? "hat" : "build"));
  }

  draw();

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

  document.addEventListener("visibilitychange", favicon);

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
    chew: chew, theme: theme, face: face, mode: mode, wake: wake,
    sprite: sprite, STATUS_GLYPH: STATUS_GLYPH,
    grove: function (st, id, label) { return svg(grove(st, id), label); },
    /* for previews and tests: raw text maps */
    _rows: { grove: grove, cabin: cabinPieces, dress: dress, FRAMES: FRAMES }
  };
})();
