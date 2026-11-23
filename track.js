/* A track page (~/projects/<track>): draw the objective saplings in the
   track's species and filter writeups by objective. The page is generated
   by bin/build.py; this only adds behaviour. Filters live in the URL
   (#obj=<id>) so a filtered view can be linked. */
(function () {
  "use strict";

  var P = window.HSKPixel;

  /* Trees (map) and inline glyphs (entry pages) from the shared sprites. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-glyph]"), function (el) {
    if (!P) return;
    var svg = P.sprite(el.getAttribute("data-glyph"));
    if (!svg) return;
    el.insertAdjacentHTML("afterbegin", svg);
    el.classList.add("has-px");
  });

  var buttons = document.querySelectorAll(".obj");
  if (!buttons.length) return;

  /* The objective map: one sapling per objective, felled to a stump once passed. */
  var groves = document.querySelector(".groves");
  var species = groves ? groves.getAttribute("data-species") : null;
  if (P && P.grove) {
    Array.prototype.forEach.call(buttons, function (b) {
      b.insertAdjacentHTML("afterbegin", P.grove(b.getAttribute("data-state"), b.getAttribute("data-obj"), species));
      b.classList.add("has-px");
    });
  }

  var detail = document.getElementById("obj-detail");
  var detailText = document.getElementById("obj-detail-text");
  var clear = document.getElementById("obj-clear");
  var rows = document.querySelectorAll(".wu");
  var empty = document.getElementById("wu-empty");

  function current() {
    var m = /(?:^|[#&])obj=([a-z0-9]+(?:-[a-z0-9]+)*)/.exec(window.location.hash);
    return m ? m[1] : null;
  }

  function apply() {
    var id = current(), btn = null;

    Array.prototype.forEach.call(buttons, function (b) {
      var on = b.getAttribute("data-obj") === id;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) btn = b;
    });
    if (!btn) id = null;

    var shown = 0;
    Array.prototype.forEach.call(rows, function (r) {
      var match = !id || (" " + r.getAttribute("data-objs") + " ").indexOf(" " + id + " ") > -1;
      r.hidden = !match;
      if (match) shown++;
    });
    if (empty) empty.hidden = rows.length > 0 ? shown > 0 : false;

    if (detail) {
      detail.hidden = !btn;
      if (btn) {
        /* open right under the clicked tree's grove, pushing the rest down,
           so the detail is where the eye already is */
        var trees = btn.closest(".grove-trees");
        if (trees && trees.nextElementSibling !== detail) trees.insertAdjacentElement("afterend", detail);
        detailText.textContent = id + " · " + btn.getAttribute("data-text") + " — " + btn.getAttribute("data-state");
      }
    }
  }

  Array.prototype.forEach.call(buttons, function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-obj");
      if (current() === id) {
        history.replaceState(null, "", window.location.pathname);
        apply();
      } else {
        window.location.hash = "obj=" + id;
      }
      if (P && P.chew) P.chew();
    });
  });

  if (clear) {
    clear.addEventListener("click", function () {
      history.replaceState(null, "", window.location.pathname);
      apply();
    });
  }

  window.addEventListener("hashchange", apply);
  apply();
})();
