/* Pixel layer: the beaver and his hero scene, the cabin room (an isometric
   voxel scene), the favicon, and objective glyphs.
   Sprites are text maps — one letter per palette slot, "." is empty — drawn
   as SVG rects. Colours live in styles.css as --px-* tokens, switched by
   data-theme (light/dark) on <html> and data-species on a track's elements.
   Loaded before app.js, which calls window.HSKPixel on user actions. */
(function () {
  "use strict";

  var doc = document.documentElement;

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
    log:    ["........", "........", "........", "KKKKKGG.", "KKKKGKKG", "KKKKGKKG", "KKKKKGG.", "........"]
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
    flares(cv, x, gy, tw);
    if (gnawed) gnaw(cv, x, gy, tw);
  }

  /* Root flares are single pixels on purpose; put them back after lean(). */
  function flares(cv, x, gy, tw) {
    cv.set(x - 1, gy - 1, "K");
    cv.set(x + tw, gy - 1, "Q");
  }

  function gnaw(cv, x, gy, tw) {
    if (tw < 3) {
      /* a sapling's bite: one notch with pale wood showing */
      cv.set(x, gy - 4, "."); cv.set(x, gy - 3, "G"); cv.set(x + 1, gy - 4, "G");
    } else {
      /* hourglass bite out of the trunk */
      var r = x + tw - 1;
      cv.set(x, gy - 5, "."); cv.set(r, gy - 5, ".");
      cv.set(x, gy - 4, "."); cv.set(r, gy - 4, ".");
      cv.set(x, gy - 3, ".");
    }
  }

  /* Pine: a straight trunk under stacked, widening tiers of boughs. */
  function pine(cv, x, gy, h, seed, gnawed, opt) {
    opt = opt || {};
    var rand = rng(seed), tw = Math.max(2, (opt.tw || 4) - 1), cx = x + Math.floor(tw / 2);
    var bare = Math.max(5, Math.round(h * 0.22)), crownH = h - bare + 1, top = gy - h;
    var half = opt.r ? opt.r + 2 : Math.max(6, Math.round(h * 0.34));
    var tiers = crownH > 16 ? 4 : 3, th = crownH / tiers;
    trunk(cv, x, gy, h - 2, tw);
    for (var r = 0; r < crownH; r++) {
      var tier = Math.min(tiers - 1, Math.floor(r / th)), local = (r - tier * th) / th;
      var w = half * (tier + 1) / tiers * (0.3 + 0.7 * local);
      for (var dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        if (Math.abs(dx) > w) continue;
        cv.set(cx + dx, top + r, (dx > w * 0.3 || local > 0.8 || rand() < 0.06) ? "V" : "W");
      }
    }
    cv.lean();
    flares(cv, x, gy, tw);
    if (gnawed) gnaw(cv, x, gy, tw);
  }

  /* Birch: a slim, pale, marked trunk under a tall, narrow crown. */
  function birch(cv, x, gy, h, seed, gnawed, opt) {
    opt = opt || {};
    var rand = rng(seed), tw = Math.max(2, (opt.tw || 4) - 1), cx = x + Math.floor(tw / 2);
    var r = opt.r || Math.max(5, Math.round(h * 0.26)), rx = Math.max(3, Math.round(r * 0.75)), ry = Math.round(r * 1.15);
    var cy = gy - h + ry;
    for (var y = cy; y < gy; y++) {
      var mark = rand() < 0.3, from = Math.floor(rand() * tw);
      for (var i = 0; i < tw; i++) cv.set(x + i, y, mark && i >= from && i < from + 2 ? "Q" : "K");
    }
    for (var yy = -ry; yy <= ry; yy++) {
      for (var xx = -rx; xx <= rx; xx++) {
        var d = Math.sqrt((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry));
        if (d > 1 || (d > 0.85 && rand() < 0.45)) continue;
        cv.set(cx + xx, cy + yy, (xx + yy > rx * 0.4 || rand() < 0.08) ? "V" : "W");
      }
    }
    cv.lean();
    cv.set(x - 1, gy - 1, "K"); cv.set(x + tw, gy - 1, "K");
    if (gnawed) gnaw(cv, x, gy, tw);
  }

  /* One generator per tree species; a track picks its species in track.json
     (bin/build.py checks the name against its own list). Colours per
     species live in styles.css under [data-species]. */
  var SPECIES = { oak: oak, pine: pine, birch: birch };
  function species(name) { return SPECIES[name] || oak; }

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

  function heroTree(kind) {
    var cv = new Canvas(28, 34);
    species(kind)(cv, 11, 34, 32, 23, true);
    return cv.rows();
  }

  function heroLogs() {
    var cv = new Canvas(30, 8);
    stump(cv, 1, 8, 5);
    log(cv, 9, 8, 18, 29);
    return cv.rows();
  }

  /* The red hat: earned only when a track is finished. */
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

  /* -------------------------------------------------------------- tracks */

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
  function grove(st, id, kind) {
    var seed = hash(String(id)), rand = rng(seed), cv = new Canvas(16, 20);
    var h = 14 + Math.floor(rand() * 6);
    if (st === "done") {
      stump(cv, 6, 20, 4);
      cv.set(3, 19, "G"); cv.set(12, 19, "G"); cv.set(13, 18, "K");
    } else {
      species(kind)(cv, 7, 20, h, seed, st === "practising", { tw: 2, r: h > 16 ? 5 : 4 });
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

    CABIN = { name: "log cabin", w: W, h: H, pieces: list.map(function (cv) { return cv.rows(); }), smoke: smoke };
    return CABIN;
  }

  /* The fallback build for a new track until it gets its own structure:
     log ends stacked into a pyramid, bottom row first. */
  var WOODPILE;
  function woodpilePieces() {
    if (WOODPILE) return WOODPILE;
    var BASE = 6, W = BASE * 6 + 2, H = BASE * 6, list = [];
    for (var row = 0; row < BASE; row++) {
      for (var i = 0; i < BASE - row; i++) {
        var cv = new Canvas(W, H);
        cv.blit(LOG_END, 1 + row * 3 + i * 6, H - 6 - row * 6);
        list.push(cv.rows());
      }
    }
    WOODPILE = { name: "woodpile", w: W, h: H, pieces: list, smoke: [] };
    return WOODPILE;
  }

  /* What each track builds, named in track.json (bin/build.py checks it). */
  var STRUCTURES = { cabin: cabinPieces, woodpile: woodpilePieces };

  /* A structure n/total of the way built. Every passed objective adds at
     least one piece and the last one finishes it. logs: [{id, text, date}]
     in the order they were passed, shown as tooltips on their pieces.
     ghost: draw the unbuilt pieces faintly, as a plan of what's coming. */
  function structure(kind, n, total, logs, ghost) {
    var st = (STRUCTURES[kind] || woodpilePieces)(), all = st.pieces, P = all.length;
    var k = total > 0 ? Math.min(P, Math.floor(Math.min(n, total) * P / total)) : 0;
    var union = new Canvas(st.w, st.h), body = "", plan = "", i;
    for (i = 0; i < k; i++) {
      union.blit(all[i], 0, 0);
      var o = logs && logs[Math.floor(i * total / P)];
      var t = o ? "<title>" + attr(o.id + " · " + o.text + (o.date ? " · passed " + o.date : "")) + "</title>" : "";
      body += "<g>" + t + fills(all[i]) + "</g>";
    }
    if (ghost) {
      for (i = k; i < P; i++) plan += fills(all[i]);
      if (plan) plan = '<g class="ghost">' + plan + "</g>";
    }
    if (k === P) {
      st.smoke.forEach(function (f, j) {
        body += '<g class="smoke smoke-' + j + '">' + f.map(function (q) {
          return '<rect x="' + q[0] + '" y="' + q[1] + '" width="1" height="1" class="pL"/>';
        }).join("") + "</g>";
      });
    }
    var label = k === P ? st.name + ", finished" : st.name + " under construction, " + n + " of " + total + " logs";
    return wrap(st.w, st.h, label, plan + edges(union.rows(), st.w, st.h) + body);
  }

  /* The next log, waiting beside the builder. */
  function nextLog() {
    var cv = new Canvas(14, 6);
    log(cv, 0, 6, 14, 7);
    return cv.rows();
  }

  /* --------------------------------------------------------------- cabin */

  /* The cabin room is an isometric voxel scene. Each voxel has a material,
     [top, left (+y face), right (+x face)] palette letters, so everything
     built from boxes gets the same light: tops brightest, the two sides
     shaded. Each voxel also has an owner, the thing it belongs to; owners
     that do something (open a page or a popup) become links. */

  function Voxels(w, d, h) {
    this.w = w; this.d = d; this.h = h;
    this.mat = []; this.own = [];
  }
  Voxels.prototype.at = function (x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.d && z < this.h ? (z * this.d + y) * this.w + x : -1;
  };
  Voxels.prototype.get = function (x, y, z) { var i = this.at(x, y, z); return i < 0 ? undefined : this.mat[i]; };
  Voxels.prototype.set = function (x, y, z, m, o) {
    var i = this.at(x, y, z);
    if (i < 0) return;
    this.mat[i] = typeof m === "string" ? [m, m, m] : m;
    this.own[i] = o;
  };
  Voxels.prototype.box = function (x, y, z, w, d, h, m, o) {
    for (var k = z; k < z + h; k++)
      for (var j = y; j < y + d; j++)
        for (var i = x; i < x + w; i++) this.set(i, j, k, typeof m === "function" ? m(i, j, k) : m, o);
  };

  /* 2:1 isometric: each voxel is 2×2 px. Drawn back to front by x+y+z, so
     nearer voxels paint over farther ones. Returns pixel and owner grids. */
  Voxels.prototype.render = function () {
    var W = 2 * (this.w + this.d), H = this.w + this.d + this.h, px = [], ow = [], x, y, z, r;
    for (r = 0; r < H; r++) { px.push([]); ow.push([]); for (x = 0; x < W; x++) { px[r].push("."); ow[r].push(""); } }
    function put(sx, sy, c, o) { if (sx >= 0 && sy >= 0 && sx < W && sy < H) { px[sy][sx] = c; ow[sy][sx] = o; } }
    for (var depth = 0; depth < this.w + this.d + this.h; depth++) {
      for (z = 0; z < this.h; z++) {
        for (x = 0; x < this.w; x++) {
          y = depth - z - x;
          if (y < 0 || y >= this.d) continue;
          var m = this.get(x, y, z);
          if (!m) continue;
          var o = this.own[this.at(x, y, z)];
          var openY = !this.get(x, y + 1, z), openX = !this.get(x + 1, y, z);
          var sx = 2 * (x - y) + 2 * this.d - 2, sy = x + y - z + this.h - 1;
          put(sx, sy, m[0], o); put(sx + 1, sy, m[0], o);
          put(sx, sy + 1, openY ? m[1] : openX ? m[2] : m[0], o);
          put(sx + 1, sy + 1, openX ? m[2] : openY ? m[1] : m[0], o);
        }
      }
    }
    return { w: W, h: H, px: px, ow: ow };
  };

  /* A 1px dark outline around every object, drawn on the floor or wall
     next to it, the way hand-drawn pixel art outlines things. */
  function outline(img, plain) {
    var marks = [], x, y;
    for (y = 0; y < img.h; y++) {
      for (x = 0; x < img.w; x++) {
        var o = img.ow[y][x];
        if (!o || plain[o]) continue;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = x + d[0], ny = y + d[1];
          if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) return;
          if (img.px[ny][nx] === "." || plain[img.ow[ny][nx]]) marks.push([nx, ny, o]);
        });
      }
    }
    marks.forEach(function (m) { img.px[m[1]][m[0]] = "Z"; img.ow[m[1]][m[0]] = m[2]; });
  }

  var WOOD = ["L", "K", "Q"], DARKWOOD = ["K", "Q", "M"], METAL = ["S", "S", "M"], WHITE = ["G", "G", "S"], BLACK = ["O", "O", "O"];

  /* The room itself. data: what build.py passes in (tracks, notes, books). */
  function cabinScene(data) {
    var V = new Voxels(40, 40, 30), rand = rng(7), x, y, z, i;

    /* floor planks, running away from the window wall */
    V.box(0, 0, 0, 40, 40, 1, function (x) {
      return x % 4 === 0 || rand() < 0.03 ? ["K", "K", "Q"] : WOOD;
    }, "room");
    /* log walls: courses of three, a dark groove between logs */
    function log(x, y, z) { var c = z % 3; return c === 0 ? ["M", "M", "M"] : c === 1 ? ["L", "K", "Q"] : ["L", "L", "K"]; }
    V.box(0, 0, 1, 1, 40, 29, log, "room");
    V.box(0, 0, 1, 40, 1, 29, log, "room");

    /* rug */
    V.box(16, 16, 0, 15, 13, 1, function (x, y) {
      var edge = x === 16 || x === 30 || y === 16 || y === 28;
      return edge ? ["R", "K", "Q"] : (x + y) % 6 < 2 ? ["P", "K", "Q"] : ["L", "K", "Q"];
    }, "rug");

    /* window onto the mountains, in the back-right wall */
    for (x = 20; x <= 31; x++) {
      for (z = 13; z <= 25; z++) {
        var frame = x === 20 || x === 31 || z === 13 || z === 25 || x === 25 || z === 19;
        var c = "I";
        var peak = Math.max(0, 7 - Math.abs(x - 23) * 1.6, 5 - Math.abs(x - 29) * 1.8);
        if (z <= 13 + peak) c = z >= 13 + peak - 1 && peak > 4 ? "G" : "S";
        else if (z > 21 && hash("star" + x + z) % 5 === 0) c = "J";
        V.set(x, 0, z, frame ? "G" : c, "window");
      }
    }
    V.box(20, 1, 12, 12, 1, 1, WHITE, "window");   /* sill */

    /* desk against the back-right wall, laptop and mug on it */
    V.box(5, 1, 7, 13, 7, 1, WOOD, "desk");
    [[5, 1], [17, 1], [5, 7], [17, 7]].forEach(function (p) { V.box(p[0], p[1], 1, 1, 1, 6, DARKWOOD, "desk"); });
    var t = (data.tracks || [])[0], bar = 0;
    if (t && t.total) bar = Math.max(t.done > 0 ? 1 : 0, Math.round(7 * t.done / t.total));
    V.box(8, 2, 8, 7, 4, 1, METAL, "laptop");
    for (x = 8; x <= 14; x++) {
      for (z = 9; z <= 13; z++) {
        var sc = "O";
        if (x > 8 && x < 14 && z === 12) sc = (x + z) % 2 ? "A" : "O";          /* a line of text */
        if (x > 8 && x < 14 && z === 11) sc = x < 12 ? "A" : "O";
        if (z === 10) sc = x - 8 < bar ? "W" : "M";                             /* the progress bar */
        V.set(x, 2, z, ["O", sc, "O"], "laptop");
      }
    }
    V.box(15, 4, 8, 1, 1, 2, WHITE, "mug");

    /* stool, tucked under the desk */
    V.box(10, 9, 4, 3, 3, 1, WOOD, "stool");
    [[10, 9], [12, 9], [10, 11], [12, 11]].forEach(function (p) { V.box(p[0], p[1], 1, 1, 1, 3, DARKWOOD, "stool"); });

    /* homelab rack: three nodes, LEDs on the front */
    V.box(33, 1, 1, 5, 5, 13, BLACK, "rack");
    for (i = 0; i < 3; i++) {
      var zz = 2 + i * 4;
      V.box(33, 5, zz, 5, 1, 3, ["S", "S", "M"], "rack");
      V.set(34, 5, zz + 1, ["S", "W", "S"], "rack");
      V.set(35, 5, zz + 1, ["S", "Y", "S"], "rack");
    }

    /* bookshelf against the back-left wall: one shelf per topic */
    var topics = [], byTopic = {};
    (data.books || []).forEach(function (b) {
      if (!byTopic[b.topic]) { byTopic[b.topic] = []; topics.push(b.topic); }
      byTopic[b.topic].push(b);
    });
    /* Books stand flush with the shelf front so the board above doesn't
       hide them; every other spine gets a pale band so neighbours read
       as separate books. */
    var rows = Math.max(1, topics.length), top = 1 + rows * 5;
    V.box(1, 4, 1, 1, 11, top, BLACK, "shelf");                                   /* back */
    V.box(1, 3, 1, 5, 1, top + 1, DARKWOOD, "shelf");                             /* sides */
    V.box(1, 15, 1, 5, 1, top + 1, DARKWOOD, "shelf");
    for (i = 0; i <= rows; i++) V.box(1, 4, 1 + i * 5, 5, 11, 1, DARKWOOD, "shelf");
    topics.forEach(function (tid, k) {
      var yy = 5, zb = 2 + (rows - 1 - k) * 5;
      byTopic[tid].forEach(function (b, j) {
        var h = 3 + hash(b.id) % 2;
        if (yy > 14) return;
        V.box(2, yy, zb, 4, 1, h, ["G", b.tone, b.tone], "book:" + b.id);
        if (j % 2) V.set(5, yy, zb + 1, ["G", "G", "G"], "book:" + b.id);
        yy += 1;
      });
    });

    /* whiteboard on the back-left wall, one sticky note per note */
    for (y = 17; y <= 28; y++) {
      for (z = 12; z <= 21; z++) {
        var rim = y === 17 || y === 28 || z === 12 || z === 21;
        V.set(0, y, z, rim ? "S" : "G", "board");
      }
    }
    V.box(1, 17, 12, 1, 12, 1, METAL, "board");
    var n = data.notes ? Math.min(8, data.notes.count) : 0, colours = "YDPF";
    for (i = 0; i < n; i++) {
      var sy = 19 + (i % 4) * 2, sz = 18 - Math.floor(i / 4) * 4;
      V.box(0, sy, sz, 1, 2, 2, colours.charAt(i % 4), "board");
    }
    if (!n) for (y = 19; y <= 25; y++) V.set(0, y, 18 - (y % 2), "S", "board");     /* a doodle */

    /* the gi, hanging from a peg: white, with a blue belt */
    V.set(1, 34, 23, DARKWOOD, "gi");
    var GI = [
      ".GGGSGGG.",
      "GGGGSGGGG",
      "GGGSGSGGG",
      "GGG.S.GGG",
      "GGG.G.GGG",
      "G.GGGGG.G",
      "G.GGGGG.G",
      "G.UUUUU.G",
      "..GGUGG..",
      "..GGUGG..",
      "..GU.UG..",
      "..GG.GG.."
    ];
    GI.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch !== ".") V.set(1, 30 + c, 22 - r, ch, "gi");
      }
    });

    return V;
  }

  /* The room as SVG. spots: owner -> {href, label}. Owners with a spot are
     links; everything else is scenery. Keeps the last render for close-ups. */
  var lastRoom = null;
  function room(data, spots) {
    var img = cabinScene(data).render();
    outline(img, { room: true });
    lastRoom = img;
    var groups = {}, order = [], x, y;
    for (y = 0; y < img.h; y++) {
      for (x = 0; x < img.w; x++) {
        var o = img.ow[y][x];
        if (img.px[y][x] === ".") continue;
        if (!groups[o]) { groups[o] = []; order.push(o); }
        groups[o].push([x, y]);
      }
    }
    var body = "";
    order.forEach(function (o) {
      var rows = [];
      for (y = 0; y < img.h; y++) rows.push(new Array(img.w + 1).join("."));
      groups[o].forEach(function (p) {
        rows[p[1]] = rows[p[1]].substring(0, p[0]) + img.px[p[1]][p[0]] + rows[p[1]].substring(p[0] + 1);
      });
      var inner = fills(rows), spot = spots[o];
      if (spot) {
        body += '<a class="hot" href="' + attr(spot.href) + '" data-owner="' + attr(o) + '" data-label="' + attr(spot.label) + '">' +
          "<title>" + attr(spot.label) + "</title>" + inner + "</a>";
      } else {
        body += '<g data-owner="' + attr(o) + '">' + inner + "</g>";
      }
    });
    var all = img.px.map(function (r) { return r.join(""); });
    return wrap(img.w, img.h, "a log cabin room: a desk with a laptop, a bookshelf, a whiteboard, a window onto mountains, a homelab rack and a gi on the wall",
      edges(all, img.w, img.h) + body);
  }

  /* One object from the last room render, cropped, for the popup header. */
  function closeUp(owner) {
    if (!lastRoom) return "";
    var img = lastRoom, x0 = img.w, y0 = img.h, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < img.h; y++) {
      for (x = 0; x < img.w; x++) {
        if (img.ow[y][x] === owner && img.px[y][x] !== ".") {
          if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return "";
    var rows = [];
    for (y = y0; y <= y1; y++) {
      var r = "";
      for (x = x0; x <= x1; x++) r += img.ow[y][x] === owner ? img.px[y][x] : ".";
      rows.push(r);
    }
    return svg(rows);
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
    el.addEventListener("click", chew);   /* poke him and he chews */
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
    var key = name + doc.dataset.theme;
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

  function theme(t) { if (t === "dark") sleep(); else wake(); favicon(); }

  /* ---------------------------------------------------------------- wire */

  var scene = document.getElementById("hero-scene");

  if (scene) {
    scene.insertAdjacentHTML("beforeend", svg(heroTree(scene.getAttribute("data-species"))));
    scene.appendChild(host());
    scene.insertAdjacentHTML("beforeend", svg(heroLogs()));
  }
  /* The cabin: draw the room from the data bin/build.py writes on #room.
     The desk and laptop open the active track, the whiteboard the notes;
     books and the odd things on the walls open a popup (cabin.js). */
  var roomEl = document.getElementById("room");
  if (roomEl) {
    var rd = {};
    try { rd = JSON.parse(roomEl.getAttribute("data-room") || "{}"); } catch (e) {}
    var spots = {}, tr = (rd.tracks || [])[0];
    if (tr) {
      var desk = { href: tr.href, label: "laptop — " + tr.name + ", " + tr.done + "/" + tr.total + (tr.last ? ", last entry " + tr.last : "") };
      spots.laptop = desk;
      spots.desk = desk;
    }
    if (rd.notes) spots.board = { href: rd.notes.href, label: "whiteboard — notes, " + rd.notes.count + " pinned" };
    (rd.books || []).forEach(function (b) { spots["book:" + b.id] = { href: "#book=" + b.id, label: b.title + " — " + b.author }; });
    (rd.eggs || []).forEach(function (g) { spots[g.id] = { href: "#egg=" + g.id, label: g.label }; });
    roomEl.innerHTML = room(rd, spots);
  }

  draw();


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
    chew: chew, theme: theme, wake: wake, sprite: sprite, closeUp: closeUp,
    grove: function (st, id, kind, label) { return svg(grove(st, id, kind), label); },
    /* for previews and tests: raw text maps */
    _rows: { grove: grove, structures: STRUCTURES, species: SPECIES, dress: dress, FRAMES: FRAMES, cabinScene: cabinScene }
  };
})();
