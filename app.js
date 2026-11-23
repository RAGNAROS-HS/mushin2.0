/* Personal site: theme toggle, career-tree connectors, folded sections.
   Ships as-is and is shared by every page bin/build.py writes. */
(function () {
  "use strict";

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  var themeButton = document.getElementById("theme-toggle");
  var theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  /* Pixel layer hooks (pixel.js). Optional: the site works without it. */
  function px(fn, arg) {
    if (window.HSKPixel && window.HSKPixel[fn]) return window.HSKPixel[fn](arg);
  }

  /* ---------------------------------------------------------------- theme */

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    if (themeButton) themeButton.textContent = theme === "dark" ? "[light]" : "[dark]";
    px("theme", theme);
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    store.set("hsk.theme", theme);
    applyTheme();
  }

  /* ----------------------------------------------------------------- tree */

  /* Swap the box-drawing prefixes for drawn segments so the connectors run
     unbroken through tall rows and wrapped notes. The glyphs stay as the
     no-JS fallback and as the source of truth in the HTML. */
  var SEG = { "\u2502   ": "pass", "\u251c\u2500\u2500 ": "tee", "\u2514\u2500\u2500 ": "elbow", "    ": "blank", "\u2502": "pass" };

  function pixelTree() {
    Array.prototype.forEach.call(document.querySelectorAll(".tree .pre"), function (pre) {
      var src = pre.textContent, kinds = [], i, k;
      for (i = 0; i < src.length; i += 4) {
        k = SEG[src.slice(i, i + 4)];
        if (!k) return;                       /* not a connector, e.g. ~/career/ */
        kinds.push(k);
      }
      if (!kinds.length) return;
      var row = pre.parentNode;
      pre.setAttribute("data-ascii", src);
      pre.setAttribute("aria-hidden", "true");
      pre.textContent = "";
      pre.classList.add("is-px");
      kinds.forEach(function (kind, n) {
        var seg = document.createElement("i");
        seg.className = "seg seg--" + kind;
        if (n === kinds.length - 1 && kind !== "pass" && kind !== "blank") {
          seg.classList.add(row.classList.contains("row--head") ? "is-head" : "is-leaf");
        }
        pre.appendChild(seg);
      });
    });
  }

  /* --------------------------------------------------------------- wiring */

  if (themeButton) themeButton.addEventListener("click", toggleTheme);

  /* Folded sections (earlier work) open when the URL points at them, e.g.
     the "back" link on an archived project's page. */
  function unfold() {
    var el = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (el && el.tagName === "DETAILS" && !el.open) {
      el.open = true;
      el.scrollIntoView();
    }
  }
  window.addEventListener("hashchange", unfold);
  unfold();

  pixelTree();
  applyTheme();
})();
