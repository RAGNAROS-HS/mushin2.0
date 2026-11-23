/* The cabin: hover caption, and the popup for books and the odd things in
   the room. The room itself is drawn by pixel.js from the data on #room;
   this only adds behaviour. Popups are linkable: #book=<id>, #egg=<id>. */
(function () {
  "use strict";

  var P = window.HSKPixel;
  var roomEl = document.getElementById("room");
  var dialog = document.getElementById("popup");
  if (!roomEl || !dialog) return;

  var data = {};
  try { data = JSON.parse(roomEl.getAttribute("data-room") || "{}"); } catch (e) {}
  var books = {}, eggs = {};
  (data.books || []).forEach(function (b) { books[b.id] = b; });
  (data.eggs || []).forEach(function (g) { eggs[g.id] = g; });

  /* ------------------------------------------------------------ caption */

  var caption = document.getElementById("caption");
  var idle = "Hover over things: most of them do something.";
  caption.textContent = idle;
  function say(el) { caption.textContent = el ? el.getAttribute("data-label") : idle; }
  roomEl.addEventListener("mouseover", function (ev) { say(ev.target.closest(".hot")); });
  roomEl.addEventListener("mouseleave", function () { say(null); });
  roomEl.addEventListener("focusin", function (ev) { say(ev.target.closest(".hot")); });
  roomEl.addEventListener("focusout", function () { say(null); });

  /* -------------------------------------------------------------- popup */

  var art = document.getElementById("popup-art");
  var title = document.getElementById("popup-title");
  var text = document.getElementById("popup-text");

  function el(tag, cls, content) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (content) n.textContent = content;
    return n;
  }

  function fill(kind, id) {
    var owner, head, body = [];
    if (kind === "book" && books[id]) {
      var b = books[id];
      owner = "book:" + id;
      head = b.title;
      body.push(el("p", "dim", b.author + " · " + b.topic));
      var cited = el("p");
      if (b.cited.length) {
        cited.appendChild(document.createTextNode("Cited in "));
        b.cited.forEach(function (c, i) {
          var a = el("a", null, c.label);
          a.href = c.href;
          if (i) cited.appendChild(document.createTextNode(", "));
          cited.appendChild(a);
        });
        cited.appendChild(document.createTextNode("."));
      } else {
        cited.textContent = "Not cited in an entry yet.";
      }
      body.push(cited);
    } else if (kind === "egg" && eggs[id]) {
      owner = id;
      head = eggs[id].title;
      body.push(el("p", null, eggs[id].text));
    } else {
      return false;
    }
    art.innerHTML = P && P.closeUp ? P.closeUp(owner) : "";
    title.textContent = head;
    text.innerHTML = "";
    body.forEach(function (n) { text.appendChild(n); });
    return true;
  }

  function fromHash() {
    var m = /^#(book|egg)=([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(window.location.hash);
    if (m && fill(m[1], m[2])) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }

  /* Closing (Esc, [x] or a click outside) clears the hash, so the same
     thing can be opened again and the URL stays honest. */
  dialog.addEventListener("close", function () {
    if (/^#(book|egg)=/.test(window.location.hash)) history.replaceState(null, "", window.location.pathname);
  });
  dialog.addEventListener("click", function (ev) { if (ev.target === dialog) dialog.close(); });

  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
