/* Personal site: the theme toggle, and a tiny shell in the footer (press /).
   The site works without any of this; the shell is a toy that also happens
   to be a keyboard way around: ls, cd, open, grep. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var root = doc.getAttribute("data-root") || "";
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var $ = function (id) { return document.getElementById(id); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  /* ---------------------------------------------------------------- theme */

  var themeButton = $("theme-toggle");
  var dark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function theme() {
    return doc.dataset.theme || (dark && dark.matches ? "dark" : "light");
  }
  function label() {
    if (themeButton) themeButton.textContent = theme() === "dark" ? "[light]" : "[dark]";
  }
  function setTheme(t) {
    doc.dataset.theme = t;
    store.set("hsk.theme", t);
    label();
  }
  if (themeButton) themeButton.addEventListener("click", function () {
    setTheme(theme() === "dark" ? "light" : "dark");
  });
  if (dark && dark.addEventListener) dark.addEventListener("change", label);
  label();

  /* --------------------------------------------------------------- beaver */

  var beaver = $("beaver");
  function hop() {
    if (!beaver) return false;
    beaver.classList.remove("hop");
    void beaver.offsetWidth;            /* restart the animation */
    beaver.classList.add("hop");
    return true;
  }
  if (beaver) beaver.addEventListener("click", function (ev) { ev.preventDefault(); hop(); });

  /* ---------------------------------------------------------------- shell */

  var term = $("term"), out = $("term-out"), form = $("term-form"), input = $("term-in");
  if (!term || !input) return;

  var DIRS = ["blog", "projects", "cv", "rhcsa", "books"];
  var FILES = { "resume.pdf": "pdfs/CV4_0.pdf", "feed.xml": "feed.xml" };
  var path = window.location.pathname.replace(/index\.html$/, "");
  var here = (path.match(/^\/([a-z0-9-]+)\//) || [])[1] || "";   /* top-level dir, "" for ~ */
  if (DIRS.indexOf(here) < 0) here = "";
  $("term-cwd").textContent = "~" + (here ? "/" + here : "");

  var history_ = [], hpos = 0;

  function print(text, cls) {
    var line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = text;
    out.appendChild(line);
    while (out.childNodes.length > 40) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
  }

  function go(href) {
    print("…");
    window.location.href = href;
  }

  /* What's listed on this page: posts and projects, by slug. */
  function entries() {
    var found = [];
    each(document.querySelectorAll(".main a.post-title, .main a.ls-name"), function (a) {
      var slug = a.getAttribute("href").split("/").pop().replace(/\.html$/, "");
      if (slug && !found.some(function (e) { return e.slug === slug; })) {
        found.push({ slug: slug, href: a.href, title: a.textContent.replace(/\/$/, "") });
      }
    });
    return found;
  }

  function resolve(arg) {
    arg = (arg || "").replace(/\/+$/, "").replace(/^~\/?/, "");
    if (arg === "" || arg === "/" || arg === "..") return { href: root || "./" };   /* everything is one level deep */
    if (DIRS.indexOf(arg) >= 0) return { href: root + arg + "/" };
    if (FILES[arg]) return { href: root + FILES[arg], file: true };
    var m = arg.match(/^(blog|projects)\/([a-z0-9-]+)$/);
    if (m) return { href: root + m[1] + "/" + m[2] + ".html" };
    var e = entries().filter(function (x) { return x.slug === arg; })[0];
    return e ? { href: e.href } : null;
  }

  var COMMANDS = {
    help: function () {
      print("ls [dir]        list a directory, or what's on this page");
      print("cd <dir|post>   go somewhere (cd ~, cd .., cd blog, cd <slug>)");
      print("open <file>     resume.pdf, feed.xml, or anything ls shows");
      print("grep <word>     filter the posts on this page");
      print("theme           toggle light/dark");
      print("whoami · pwd · date · uname · history · clear · exit");
    },
    ls: function (a) {
      if (a[0]) {
        var r = resolve(a[0]);
        if (!r || r.file) return print("ls: cannot access '" + a[0] + "': No such file or directory", "err");
        return go(r.href);
      }
      var list = entries();
      if (list.length) return print(list.map(function (e) { return e.slug; }).join("  "));
      print(DIRS.map(function (d) { return d + "/"; }).concat(Object.keys(FILES)).join("  "));
    },
    cd: function (a) {
      var r = resolve(a[0] || "~");
      if (!r || r.file) return print("cd: " + a[0] + ": No such file or directory", "err");
      go(r.href);
    },
    open: function (a) {
      if (!a[0]) return print("open: missing operand. try: open resume.pdf", "err");
      var r = resolve(a[0]);
      if (!r) return print("open: " + a[0] + ": No such file or directory", "err");
      go(r.href);
    },
    grep: function (a) {
      var rows = document.querySelectorAll(".main .post, .main .ls");
      if (!rows.length) return print("grep: nothing to search on this page", "err");
      var q = (a.join(" ") || "").toLowerCase(), n = 0;
      each(rows, function (r) {
        var hit = !q || r.textContent.toLowerCase().indexOf(q) >= 0;
        r.hidden = !hit;
        if (hit) n++;
      });
      each(document.querySelectorAll(".main .year"), function (y) { y.hidden = !y.querySelector(".post:not([hidden])"); });
      print(q ? n + " match" + (n === 1 ? "" : "es") + " (grep with no word to reset)" : "reset");
    },
    pwd: function () { print("/home/hsk" + (here ? "/" + here : "")); },
    whoami: function () { print("hsk: Hugo Sokołowski-Katzer. IT support → Linux administration. Amsterdam."); },
    date: function () { print(new Date().toString()); },
    uname: function () { print("Linux hugokatzer.tech nginx:alpine static x86_64 GNU/Linux"); },
    theme: function () { setTheme(theme() === "dark" ? "light" : "dark"); print("theme: " + theme()); },
    history: function () { history_.forEach(function (h, i) { print(String(i + 1).padStart(4) + "  " + h); }); },
    clear: function () { out.textContent = ""; },
    exit: function () { close(); },
    echo: function (a) { print(a.join(" ")); },
    sudo: function () { print("hsk is not in the sudoers file. This incident will be reported.", "err"); },
    rm: function () { print("rm: this site is static. it will be back on the next build.", "err"); },
    vim: function () { print("you are now trapped. just kidding: :q", "err"); },
    beaver: function () { if (!hop()) print("the beaver lives at ~. try: cd ~"); }
  };
  COMMANDS.cat = COMMANDS.less = COMMANDS.xdg = COMMANDS.open;
  COMMANDS.dir = COMMANDS.ll = COMMANDS.ls;
  COMMANDS.man = COMMANDS.help;
  COMMANDS.nano = COMMANDS.emacs = COMMANDS.vi = COMMANDS.vim;
  COMMANDS.logout = COMMANDS.exit;

  function run(line) {
    var words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    var cmd = words[0], fn = COMMANDS[cmd];
    if (cmd === "rm" && words.indexOf("-rf") < 0 && words.indexOf("-fr") < 0) fn = function () { print("rm: missing operand", "err"); };
    if (fn) fn(words.slice(1));
    else print("bash: " + cmd + ": command not found. try: help", "err");
  }

  function complete() {
    var v = input.value, parts = v.split(/\s+/), last = parts[parts.length - 1];
    var pool = parts.length === 1 ? Object.keys(COMMANDS)
      : DIRS.concat(Object.keys(FILES), entries().map(function (e) { return e.slug; }), ["~", ".."]);
    var hits = pool.filter(function (p) { return p.indexOf(last) === 0; });
    if (hits.length === 1) {
      parts[parts.length - 1] = hits[0] + (parts.length === 1 ? " " : "");
      input.value = parts.join(" ");
    } else if (hits.length > 1) {
      print(hits.join("  "), "dim");
    }
  }

  function open() {
    term.hidden = false;
    if (!out.childNodes.length) print("type help. esc closes.", "dim");
    input.focus();
  }
  function close() {
    term.hidden = true;
    input.blur();
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var line = input.value;
    print(document.querySelector(".term-line .ps").textContent + " " + line, "echo");
    if (line.trim()) { history_.push(line); hpos = history_.length; }
    input.value = "";
    run(line);
  });

  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Tab") { ev.preventDefault(); complete(); }
    else if (ev.key === "Escape") close();
    else if (ev.key === "ArrowUp" && hpos > 0) { ev.preventDefault(); input.value = history_[--hpos]; }
    else if (ev.key === "ArrowDown") { ev.preventDefault(); hpos = Math.min(hpos + 1, history_.length); input.value = history_[hpos] || ""; }
    else if (ev.key === "l" && ev.ctrlKey) { ev.preventDefault(); out.textContent = ""; }
  });

  document.addEventListener("keydown", function (ev) {
    var t = ev.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (ev.key === "/" && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault();
      open();
    }
  });
  $("term-open").addEventListener("click", function () { term.hidden ? open() : close(); });
})();
