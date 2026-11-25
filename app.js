/* hugokatzer.tech: the theme toggle, the writing expander, and less/vim keys
   (press ? on any page). The site works without any of this. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var body = document.body;
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var media = function (q) { return window.matchMedia ? window.matchMedia(q) : null; };
  var reduced = media("(prefers-reduced-motion: reduce)");
  var darkQuery = media("(prefers-color-scheme: dark)");
  var motion = function () { return reduced && reduced.matches ? "auto" : "smooth"; };

  /* ------------------------------------------------------------ theme */

  var themeButton = $("theme-toggle");
  function theme() {
    return doc.dataset.theme || (darkQuery && darkQuery.matches ? "dark" : "light");
  }
  function showTheme() {
    $("theme-label").textContent = theme();
    themeButton.setAttribute("aria-pressed", theme() === "dark" ? "true" : "false");
  }
  function toggleTheme() {
    var t = theme() === "dark" ? "light" : "dark";
    doc.dataset.theme = t;
    store.set("hsk.theme", t);
    showTheme();
  }
  themeButton.addEventListener("click", toggleTheme);
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", showTheme);
  showTheme();

  /* ------------------------------------------------- sticky bar height */

  var bar = $("man-bar");
  function measure() { doc.style.setProperty("--bar", bar.offsetHeight + "px"); }
  measure();
  if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
  else window.addEventListener("resize", measure);
  var topLine = function () { return bar.offsetHeight + 16; };

  /* ------------------------------------------------- writing expander */

  var list = $("writing-list");
  var toggle = $("writing-toggle");
  function expand(open) {
    if (!list || !toggle) return;
    list.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    // [--all] <-> [--latest]: only the flag's text changes.
    toggle.querySelector("b").textContent = open ? "--latest" : "--all";
    if (!toggle.dataset.more) toggle.dataset.more = toggle.getAttribute("aria-label");
    toggle.setAttribute("aria-label", open ? toggle.dataset.less : toggle.dataset.more);
  }
  if (list && toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", function () { expand(!list.classList.contains("open")); });
  }

  /* --------------------------------------------------------- sections */

  var headings = Array.prototype.slice.call(
    document.querySelectorAll(".man-sec > .man-h, .art-head h1, .prose h2"));
  headings.forEach(function (h) { if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1"); });

  function go(h) {
    h.focus({ preventScroll: true });
    pin(h);
    h.scrollIntoView({ behavior: motion(), block: "start" });
  }

  function step(dir) {
    if (!headings.length) return;
    var at = headings.indexOf(document.activeElement);
    var y = topLine();
    var pick = null;
    if (at >= 0) {
      pick = headings[at + dir] || null;
    } else if (dir > 0) {
      for (var i = 0; i < headings.length && !pick; i++)
        if (headings[i].getBoundingClientRect().top > y + 2) pick = headings[i];
    } else {
      for (var k = headings.length - 1; k >= 0 && !pick; k--)
        if (headings[k].getBoundingClientRect().top < y - 2) pick = headings[k];
    }
    if (pick) go(pick);
  }

  // Same-page nav links move focus too, so Tab carries on inside the section.
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"))
    .filter(function (a) { return a.getAttribute("href").charAt(0) === "#" && $(a.dataset.target); });
  navLinks.forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var sec = $(a.dataset.target);
      var h = sec.querySelector(".man-h") || sec;
      ev.preventDefault();
      go(h);
      if (history.replaceState) history.replaceState(null, "", "#" + a.dataset.target);
    });
  });

  // Light up the nav link for the part of the page you're reading. Each link
  // owns everything from its section down to the next linked one (so "cv"
  // covers EXPERIENCE through OTHER WORK).
  //
  // A section is current once its top passes a trigger line 30% down the
  // visible area. The last few sections can never scroll that far up (the
  // page ends first), so over the final screen of scrolling the line slides
  // down to the bottom of the window: each of them still gets its turn, in
  // order, and the bottom of the page lights the last one.
  //
  // A jump (nav click, h / l, or a #section URL) pins the highlight to where
  // you asked to go, until you scroll yourself.
  var pinned = null;
  var settling = 0;     // a jump is scrolling us; ignore scroll events until it lands

  function ownerOf(el) {
    var owner = null;
    navLinks.forEach(function (a) {
      var t = $(a.dataset.target);
      if (t === el || t.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) owner = a;
    });
    return owner;
  }

  function pin(el) {
    if (!navLinks.length) return;
    pinned = ownerOf(el) || navLinks[0];
    settling = Date.now();
    mark(pinned);
  }

  function mark(current) {
    navLinks.forEach(function (a) {
      if (a === current) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }

  function current() {
    var top = bar.offsetHeight;
    var view = window.innerHeight - top;
    var line = top + view * 0.3;
    var left = doc.scrollHeight - window.innerHeight - window.scrollY;   // px still to scroll
    if (left < view) line += (window.innerHeight - line) * (1 - Math.max(left, 0) / view);
    var found = navLinks[0];
    navLinks.forEach(function (a) {
      if ($(a.dataset.target).getBoundingClientRect().top <= line) found = a;
    });
    return found;
  }

  var ticking = false;
  function onScroll() {
    ticking = false;
    if (pinned) {
      // Scroll events while a jump is landing are ours; after that, any
      // scroll is the reader's own and the highlight follows the page again.
      if (Date.now() - settling < 1200) return;
      pinned = null;
    }
    mark(current());
  }

  if (navLinks.length) {
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    // A jump has landed: keep the pin, but let the next scroll release it.
    window.addEventListener("scrollend", function () { settling = 0; });
    window.addEventListener("resize", function () { if (!pinned) mark(current()); });
    var start = window.location.hash && $(window.location.hash.slice(1));
    if (start) pin(start); else mark(current());
  }

  /* ----------------------------------------------------------- search */
  // Like less: "/" opens a prompt at the bottom, Enter highlights every match
  // on this page, n / N walk through them, Esc clears. Smartcase: a capital
  // letter in the query makes it case-sensitive.

  var sbar = $("search-bar");
  var sform = $("search-form");
  var sinput = $("search-input");
  var sstatus = $("search-status");
  var useHL = !!(window.CSS && CSS.highlights && window.Highlight);
  var hits = [];
  var cur = -1;
  var lastQuery = "";

  function clearHits() {
    if (useHL) {
      CSS.highlights.delete("search");
      CSS.highlights.delete("search-current");
    } else {
      hits.forEach(function (m) {
        var parent = m.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
      });
    }
    hits = [];
    cur = -1;
  }

  function find(q) {
    clearHits();
    var smart = q !== q.toLowerCase();
    var needle = smart ? q : q.toLowerCase();
    var ranges = [];
    var walker = document.createTreeWalker($("main"), NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var text = smart ? node.data : node.data.toLowerCase();
      for (var i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) {
        var r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + needle.length);
        ranges.push(r);
      }
    }
    // A match in a post row the expander has hidden: show the whole list.
    if (list && !list.classList.contains("open") && ranges.some(function (r) {
      var el = r.startContainer.parentElement;
      return el && el.closest(".more");
    })) expand(true);

    if (useHL) {
      hits = ranges;
      var all = new Highlight();
      hits.forEach(function (r) { all.add(r); });
      CSS.highlights.set("search", all);
    } else {
      // Wrap from the last match back, so earlier offsets stay valid.
      for (var k = ranges.length - 1; k >= 0; k--) {
        var m = document.createElement("mark");
        m.className = "hit";
        ranges[k].surroundContents(m);
        hits.unshift(m);
      }
    }
  }

  function show(index) {
    if (!hits.length) return;
    cur = (index + hits.length) % hits.length;
    if (useHL) {
      CSS.highlights.set("search-current", new Highlight(hits[cur]));
    } else {
      hits.forEach(function (m, i) { m.classList.toggle("current", i === cur); });
    }
    var rect = hits[cur].getBoundingClientRect();
    if (rect.top < topLine() || rect.bottom > window.innerHeight - 64)
      window.scrollBy({ top: rect.top - window.innerHeight / 2, behavior: motion() });
    sstatus.textContent = (cur + 1) + " of " + hits.length + "   n/N";
  }

  function search(q) {
    lastQuery = q;
    find(q);
    if (!hits.length) { sstatus.textContent = "Pattern not found"; return; }
    // Start from the first match at or below the top of the screen, like less.
    var y = topLine();
    var first = 0;
    for (var i = 0; i < hits.length; i++)
      if (hits[i].getBoundingClientRect().top >= y) { first = i; break; }
    show(first);
  }

  function openSearch() {
    sbar.hidden = false;
    sinput.value = lastQuery;
    sinput.focus();
    sinput.select();
  }
  function closeSearch() {
    clearHits();
    sbar.hidden = true;
    sstatus.textContent = "";
  }

  sform.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = sinput.value || lastQuery;
    if (!q) { closeSearch(); return; }
    search(q);
    // Back to the page, so n / N work straight away.
    $("main").focus({ preventScroll: true });
  });
  sinput.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { ev.preventDefault(); closeSearch(); $("main").focus({ preventScroll: true }); }
  });

  /* ------------------------------------------------------- keys dialog */

  var keys = $("keys");
  var before = null;
  function openKeys() {
    if (!keys.showModal || keys.open) return;
    before = document.activeElement;
    keys.showModal();
  }
  keys.addEventListener("close", function () {
    if (before && before.focus) before.focus({ preventScroll: true });
  });
  $("keys-open").addEventListener("click", openKeys);

  /* -------------------------------------------------------------- keys */

  var pendingG = 0;
  var follow = function (sel) { var a = document.querySelector(sel); if (a) window.location.href = a.href; };

  var actions = {
    j: function () { window.scrollBy({ top: 60, behavior: "auto" }); },
    k: function () { window.scrollBy({ top: -60, behavior: "auto" }); },
    d: function () { window.scrollBy({ top: window.innerHeight / 2, behavior: motion() }); },
    u: function () { window.scrollBy({ top: -window.innerHeight / 2, behavior: motion() }); },
    G: function () { window.scrollTo({ top: doc.scrollHeight, behavior: motion() }); },
    l: function () { step(1); },
    h: function () { step(-1); },
    "/": openSearch,
    n: function () { show(cur + 1); },
    N: function () { show(cur - 1); },
    "]": function () { follow('a[rel="next"]'); },
    "[": function () { follow('a[rel="prev"]'); },
    q: function () { if (body.dataset.home !== "./") window.location.href = body.dataset.home; },
    t: toggleTheme,
    "?": openKeys,
    Escape: function () { if (!sbar.hidden || hits.length) closeSearch(); }
  };

  document.addEventListener("keydown", function (ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return;
    var t = ev.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (keys.open) {
      if (ev.key === "?" || ev.key === "q") { ev.preventDefault(); keys.close(); }
      return;   // the dialog handles Esc itself
    }
    if (ev.key === "g") {
      if (Date.now() - pendingG < 600) {
        pendingG = 0;
        window.scrollTo({ top: 0, behavior: motion() });
      } else {
        pendingG = Date.now();
      }
      ev.preventDefault();
      return;
    }
    pendingG = 0;
    var fn = actions[ev.key];
    if (fn) { ev.preventDefault(); fn(); }
  });

  /* --------------------------------------------------------------- 404 */

  var missing = $("missing");
  if (missing) missing.textContent = window.location.pathname;
})();
