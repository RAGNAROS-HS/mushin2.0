#!/usr/bin/env python3
"""Build the whole site into dist/.

The site is two spaces:

  about (/)      plain and recruiter-first: who, where, career, CV, earlier work
  the woods      the pixel world: tracks (weekly logs with objectives, and the
  (/woods/)      notes track for opinions), and the shelf of books

Reads   templates/shell.html       head, header and scripts shared by every page
        templates/home.html        the about page body (career tree is hand-written there)
        templates/woods.html       the woods hub body
        content/projects/*.md      earlier work, one page each (front matter + Markdown or HTML)
        content/shelf.json         the books, by topic
        tracks/<slug>/track.json   a track: species, structure, cadence, objectives (optional)
        tracks/<slug>/entries/*.md the track's entries
Writes  dist/                      the deployable site, static files copied in
        tracks/<slug>/README.md    the track's objective ids, for writing entries

Standard library only, so `python3 bin/build.py` works anywhere and the
Docker build stage needs no pip install. Fails loudly on bad input (unknown
objective or book id, two entries in one week, unknown species) instead of
silently going live.
"""

import hashlib
import html
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "templates"
CONTENT = ROOT / "content"
TRACKS = ROOT / "tracks"
DIST = ROOT / "dist"
SITE = "https://hugokatzer.tech"
OWNER = "Hugo Sokołowski-Katzer"

STATIC_FILES = ("styles.css", "app.js", "pixel.js", "track.js")
STATIC_DIRS = ("img", "pdfs")
# Old public URLs that must keep working: path in dist -> target, from the site root.
REDIRECTS = {"log/index.html": "woods/rhcsa/index.html"}

# Must match what pixel.js can draw (SPECIES / STRUCTURES there).
SPECIES = ("oak", "pine", "birch")
STRUCTURES = ("cabin", "woodpile", "none")
CADENCES = ("weekly", "none")
STATES = ("active", "complete", "abandoned", "discontinued", "limbo")
OBJ_STATES = ("todo", "practising", "done")
TONES = "CDEFH"   # spine colours per shelf topic; must match TONES in pixel.js
MONTHS = ("january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december")


class BuildError(Exception):
    pass


def esc(s):
    return html.escape(str(s), quote=True)


# --------------------------------------------------------------- front matter

def _scalar(v):
    v = v.strip()
    if " #" in v:  # trailing comment
        v = v[: v.index(" #")].rstrip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    if v.startswith("[") and v.endswith("]"):
        return [_scalar(x) for x in v[1:-1].split(",") if x.strip()]
    return v


def parse_front_matter(text, name):
    """A small YAML subset: `key: value`, `key: [a, b]`, and block lists of
    scalars or of `name:/url:` maps. Enough for an entry header."""
    if not text.startswith("---"):
        raise BuildError(f"{name}: must start with a '---' front matter block")
    end = text.find("\n---", 3)
    if end < 0:
        raise BuildError(f"{name}: front matter is not closed with '---'")
    head, body = text[3:end], text[end + 4:].lstrip("\n")
    meta, key, item = {}, None, None
    for n, raw in enumerate(head.splitlines(), 2):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        line = raw.strip()
        if indent == 0:
            if ":" not in line:
                raise BuildError(f"{name}:{n}: expected 'key: value'")
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip()
            meta[key] = _scalar(val) if val else []
            item = None
        elif line.startswith("- "):
            if key is None or not isinstance(meta.get(key), list):
                raise BuildError(f"{name}:{n}: list item outside a list")
            rest = line[2:].strip()
            if re.match(r"^[A-Za-z_]+:\s", rest + " ") and not rest.startswith("http"):
                k, v = rest.split(":", 1)
                item = {k.strip(): _scalar(v)}
                meta[key].append(item)
            else:
                item = None
                meta[key].append(_scalar(rest))
        elif item is not None and ":" in line:
            k, v = line.split(":", 1)
            item[k.strip()] = _scalar(v)
        else:
            raise BuildError(f"{name}:{n}: could not read this line")
    return meta, body


# ------------------------------------------------------------------- markdown

def _inline(s):
    s = esc(s)
    codes = []

    def keep(m):
        codes.append("<code>" + m.group(1) + "</code>")
        return f"\x00{len(codes) - 1}\x00"

    s = re.sub(r"`([^`]+)`", keep, s)
    s = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", r'<img src="\2" alt="\1" loading="lazy">', s)
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"<em>\1</em>", s)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], s)


def markdown(text):
    """Headings, paragraphs, lists, fenced code, quotes, rules, inline code,
    bold/italic, links and images. Headings never go above h2, since the
    page title is the only h1 (`#` and `##` both become h2)."""
    out, para, lines, i = [], [], text.splitlines(), 0

    def flush():
        if para:
            out.append("<p>" + _inline(" ".join(para)) + "</p>")
            para.clear()

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("```"):
            flush()
            lang = s[3:].strip()
            i += 1
            code = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            cls = f' class="language-{esc(lang)}"' if lang else ""
            out.append(f"<pre><code{cls}>" + esc("\n".join(code)) + "</code></pre>")
        elif not s:
            flush()
        elif re.match(r"^#{1,4}\s", s):
            flush()
            level = min(max(len(s) - len(s.lstrip("#")), 2), 5)
            out.append(f"<h{level}>" + _inline(s.lstrip("#").strip()) + f"</h{level}>")
        elif re.match(r"^(-{3,}|\*{3,})$", s):
            flush()
            out.append("<hr>")
        elif s.startswith(">"):
            flush()
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            out.append("<blockquote>" + markdown("\n".join(quote)) + "</blockquote>")
            continue
        elif re.match(r"^([-*+]|\d+[.)])\s", s):
            flush()
            ordered = bool(re.match(r"^\d", s))
            items = []
            while i < len(lines) and re.match(r"^\s*([-*+]|\d+[.)])\s", lines[i]):
                items.append(re.sub(r"^\s*([-*+]|\d+[.)])\s+", "", lines[i]))
                i += 1
                while i < len(lines) and lines[i].startswith("  ") and lines[i].strip() \
                        and not re.match(r"^\s*([-*+]|\d+[.)])\s", lines[i]):
                    items[-1] += " " + lines[i].strip()
                    i += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join("<li>" + _inline(x) + "</li>" for x in items) + f"</{tag}>")
            continue
        else:
            para.append(s)
        i += 1
    flush()
    return "\n".join(out)


def plain_summary(body, limit=180):
    text = re.sub(r"```.*?```", " ", body, flags=re.S)
    for block in re.split(r"\n\s*\n", text):
        b = block.strip()
        if b and not b.startswith(("#", "-", "*", ">", "|")):
            b = re.sub(r"[`*_]|!\[[^\]]*\]\([^)]*\)", "", b)
            b = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", b)
            b = " ".join(b.split())
            return b if len(b) <= limit else b[: limit - 1].rsplit(" ", 1)[0] + "…"
    return ""




def iso_date(value, name):
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise BuildError(f"{name}: date must be YYYY-MM-DD, got {value!r}")


def fill(template, values, name):
    """{{key}} placeholders; an unfilled one is a build error, not a blank."""
    def sub(m):
        if m.group(1) not in values:
            raise BuildError(f"{name}: nothing to fill {{{{{m.group(1)}}}}} with")
        return str(values[m.group(1)])
    return re.sub(r"\{\{(\w+)\}\}", sub, template)


def month_label(d):
    return f"{MONTHS[d.month - 1]} {d.year}"


def json_attr(obj):
    return esc(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


# ---------------------------------------------------------------------- model

def load_shelf():
    data = json.loads((CONTENT / "shelf.json").read_text(encoding="utf-8"))
    if len(data["topics"]) > len(TONES):
        raise BuildError(f"content/shelf.json: at most {len(TONES)} topics (one spine colour each)")
    # Each topic gets a spine colour slot, in order (--px-C, D, E, F, H in styles.css).
    topics = {t["id"]: dict(t, tone=TONES[i]) for i, t in enumerate(data["topics"])}
    books = {}
    for b in data["books"]:
        for field in ("id", "title", "author", "topic"):
            if not b.get(field):
                raise BuildError(f"content/shelf.json: a book is missing '{field}'")
        if b["topic"] not in topics:
            raise BuildError(f"content/shelf.json: {b['id']}: unknown topic {b['topic']!r}")
        if b["id"] in books:
            raise BuildError(f"content/shelf.json: duplicate book id {b['id']!r}")
        books[b["id"]] = dict(b, cited=[], tone=topics[b["topic"]]["tone"])
    return topics, books


def load_projects():
    out, problems = [], []
    for path in sorted((CONTENT / "projects").glob("*.md")):
        name = str(path.relative_to(ROOT))
        try:
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"), name)
            for field in ("title", "summary", "date", "status"):
                if not meta.get(field):
                    raise BuildError(f"{name}: missing '{field}'")
            if meta["status"] not in STATES:
                raise BuildError(f"{name}: status must be one of {', '.join(STATES)}")
            fmt = meta.get("format", "md")
            if fmt not in ("md", "html"):
                raise BuildError(f"{name}: format must be md or html")
            out.append({
                "slug": path.stem, "name": meta.get("name") or path.stem, "title": meta["title"],
                "status": meta["status"], "date": iso_date(meta["date"], name),
                "summary": meta["summary"], "description": meta.get("description") or meta["summary"],
                "body": body if fmt == "html" else markdown(body),
            })
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    out.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    return out


def load_entries(tdir, by_id, cadence, books):
    entries, problems = [], []
    for path in sorted((tdir / "entries").glob("*.md")):
        name = str(path.relative_to(ROOT))
        try:
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"), name)
            for field in ("date", "title"):
                if not meta.get(field):
                    raise BuildError(f"{name}: missing '{field}'")
            when = iso_date(meta["date"], name)
            lists = {}
            for field in ("practised", "passed", "books"):
                ids = meta.get(field) or []
                if isinstance(ids, str):
                    ids = [ids]
                known = books if field == "books" else by_id
                unknown = [x for x in ids if x not in known]
                if unknown:
                    where = "content/shelf.json" if field == "books" else f"{tdir.relative_to(ROOT)}/README.md"
                    raise BuildError(f"{name}: unknown id(s) in '{field}': {', '.join(unknown)} (see {where})")
                lists[field] = list(dict.fromkeys(ids))
            scripts = []
            for s in meta.get("scripts") or []:
                s = s if isinstance(s, dict) else {"name": s}
                if not s.get("name"):
                    raise BuildError(f"{name}: every script needs a 'name'")
                scripts.append(s)
            if cadence == "weekly":
                # Weekly entries are keyed by ISO week: predictable URLs, one per week.
                year, week, _ = when.isocalendar()
                slug, label = f"{year}-w{week:02d}", f"w{week:02d}"
            else:
                slug = re.sub(r"[^a-z0-9-]+", "-", path.stem.lower()).strip("-")
                label = f"{when.day} {MONTHS[when.month - 1][:3]}"
            if slug == "index":
                raise BuildError(f"{name}: 'index' is reserved for the track page")
            entries.append({
                "slug": slug, "label": label, "date": when, "title": str(meta["title"]),
                "chapter": str(meta.get("chapter") or ""), "file": name,
                "practised": lists["practised"], "passed": lists["passed"], "books": lists["books"],
                "scripts": scripts, "body": body,
                "summary": str(meta.get("summary") or plain_summary(body)),
            })
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    seen = {}
    for e in entries:
        if e["slug"] in seen:
            what = "the same week" if cadence == "weekly" else "the same slug"
            raise BuildError(f"{e['file']} and {seen[e['slug']]} are in {what} ({e['slug']})")
        seen[e["slug"]] = e["file"]
    entries.sort(key=lambda e: (e["date"], e["slug"]), reverse=True)
    return entries


def load_track(tdir, books):
    name = str((tdir / "track.json").relative_to(ROOT))
    try:
        t = json.loads((tdir / "track.json").read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise BuildError(f"{name}: {e}")
    for field in ("title", "summary", "intro"):
        if not t.get(field):
            raise BuildError(f"{name}: missing '{field}'")
    checks = (("species", SPECIES), ("structure", STRUCTURES), ("cadence", CADENCES), ("status", STATES))
    for field, allowed in checks:
        if t.get(field) not in allowed:
            raise BuildError(f"{name}: {field} must be one of {', '.join(allowed)}")
    by_id = {}
    for g in t.get("groups") or []:
        for o in g["objectives"]:
            if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", o["id"]):
                raise BuildError(f"{name}: objective id {o['id']!r} must be lowercase words joined by '-'")
            if o["id"] in by_id:
                raise BuildError(f"{name}: duplicate objective id {o['id']!r}")
            o["group"] = g["name"]
            by_id[o["id"]] = o
    if t["structure"] != "none" and not by_id:
        raise BuildError(f"{name}: a structure is built from objectives; add 'groups' or use structure 'none'")
    entries = load_entries(tdir, by_id, t["cadence"], books)
    state = {oid: "todo" for oid in by_id}
    for e in entries:
        for oid in e["practised"]:
            if state[oid] == "todo":
                state[oid] = "practising"
    for e in entries:
        for oid in e["passed"]:
            state[oid] = "done"
    counts = {s: sum(v == s for v in state.values()) for s in OBJ_STATES}
    counts["total"] = len(state)
    return dict(t, slug=tdir.name, name=t.get("name") or tdir.name, tdir=tdir, by_id=by_id,
                entries=entries, state=state, counts=counts, finished=bool(t.get("finished")),
                n_scripts=len({s["name"] for e in entries for s in e["scripts"]}))


def load_tracks(books):
    tracks, problems = [], []
    for tdir in sorted(p.parent for p in TRACKS.glob("*/track.json")):
        try:
            tracks.append(load_track(tdir, books))
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    # Weekly tracks first (they are the stands in the woods), then the journals.
    tracks.sort(key=lambda t: (t["cadence"] != "weekly", t["status"] != "active", t["slug"]))
    for b in books.values():
        if b.get("track") and b["track"] not in {t["slug"] for t in tracks}:
            raise BuildError(f"content/shelf.json: {b['id']}: unknown track {b['track']!r}")
    for t in tracks:
        for e in t["entries"]:
            for bid in e["books"]:
                books[bid]["cited"].append((t, e))
    return tracks


# ------------------------------------------------------------------ fragments

GLYPH = {"todo": "tree", "practising": "gnawed", "done": "log"}
RING = {"todo": "t", "practising": "p", "done": "d"}


def ticon(t):
    """The track's icon: a small tree of its species (pixel.js draws it)."""
    return f'<span class="ticon" data-ticon="{t["species"]}" aria-hidden="true"></span>'


def ring(t):
    """The ring strip: one block per objective, in objective order."""
    if not t["by_id"]:
        return ""
    c = t["counts"]
    codes = "".join(RING[t["state"][oid]] for oid in t["by_id"])
    return (f'<span class="ring" data-species="{t["species"]}" data-ring="{codes}" role="img" '
            f'aria-label="{c["done"]} of {c["total"]} objectives done, {c["practising"]} practising"></span>')


def progress(t):
    """Plain-words progress for a track, e.g. '1/62 objectives · 3 weekly logs'."""
    n = len(t["entries"])
    bits = []
    if t["by_id"]:
        bits.append(f'{t["counts"]["done"]}/{t["counts"]["total"]} objectives')
    kind = "weekly log" if t["cadence"] == "weekly" else "note"
    bits.append(f'{n} {kind}{"s" if n != 1 else ""}')
    return " · ".join(bits)


def pass_order(t):
    """Passed objectives in the order they were first passed, with the date:
    the structure is built from them, one piece each."""
    seen, out = set(), []
    for e in sorted(t["entries"], key=lambda e: (e["date"], e["slug"])):
        for oid in e["passed"]:
            if oid not in seen:
                seen.add(oid)
                out.append({"id": oid, "text": t["by_id"][oid]["text"], "date": e["date"].isoformat()})
    return out


def scene_attrs(t):
    """Everything pixel.js needs to draw a track's build (or its growing tree)."""
    c = t["counts"]
    return (f'data-species="{t["species"]}" data-structure="{t["structure"]}" '
            f'data-done="{c["done"]}" data-total="{c["total"]}" data-notes="{len(t["entries"])}" '
            f'data-hat="{"1" if t["finished"] else "0"}" data-logs="{json_attr(pass_order(t))}"')


def feed(items, prefix):
    """Entries grouped by month, newest first. items: [(track, entry)].
    prefix: path from the page to woods/."""
    if not items:
        return ""
    out, month = [], None
    for t, e in items:
        m = month_label(e["date"])
        if m != month:
            if month:
                out.append("    </div>")
            out.append(f'    <div class="month"><h3 class="month-name">{m}</h3>')
            month = m
        objs = sorted(set(e["practised"]) | set(e["passed"]))
        chapter = f'<span class="wu-chapter">{esc(e["chapter"])}</span>' if e["chapter"] else ""
        meta = []
        if objs:
            meta.append(f'{len(objs)} obj')
        if e["scripts"]:
            meta.append(f'{len(e["scripts"])} script{"s" if len(e["scripts"]) != 1 else ""}')
        if e["books"]:
            meta.append(f'{len(e["books"])} book{"s" if len(e["books"]) != 1 else ""}')
        summary = f'<span class="wu-sum">{esc(e["summary"])}</span>' if e["summary"] else ""
        out.append(
            f'      <a class="wu" href="{prefix}{t["slug"]}/{e["slug"]}.html" data-track="{t["slug"]}" '
            f'data-objs="{" ".join(objs)}">'
            f'<span class="wu-head">{ticon(t)}<span class="wu-date">{e["label"]}</span>'
            f'<span class="wu-track">{esc(t["name"])}</span>{chapter}</span>'
            f'<span class="wu-title">{esc(e["title"])}</span>{summary}'
            f'<span class="wu-foot"><span class="wu-meta">{" · ".join(meta)}</span>'
            f'<span class="wu-go">read &rarr;</span></span></a>')
    out.append("    </div>")
    return "\n".join(out)


# ---------------------------------------------------------------------- pages

class Site:
    def __init__(self):
        self.shell = (TEMPLATES / "shell.html").read_text(encoding="utf-8")
        digest = hashlib.sha1()
        for f in STATIC_FILES:
            digest.update((ROOT / f).read_bytes())
        self.v = digest.hexdigest()[:8]

    def page(self, path, title, description, main, section, og_type="article", head="",
             body_class="", scripts=()):
        """Write dist/<path>. Links inside `main` are relative to that page."""
        root = "../" * path.count("/")
        url = SITE + "/" + (path[: -len("index.html")] if path.endswith("index.html") else path)
        tags = "".join(f'<script src="{root}{s}?v={self.v}"></script>\n' for s in scripts)
        out = fill(self.shell, {
            "root": root, "home": "./" if path == "index.html" else root + "index.html",
            "section": section, "title": esc(title), "description": esc(description), "url": esc(url),
            "og_type": og_type, "head": head + "\n" if head else "",
            "body_class": f' class="{body_class}"' if body_class else "",
            "main": main, "scripts": tags, "v": self.v,
        }, f"{path} (templates/shell.html)")
        target = DIST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(out, encoding="utf-8")


# --- about

def build_home(site, projects, tracks):
    meta, body = parse_front_matter((TEMPLATES / "home.html").read_text(encoding="utf-8"), "templates/home.html")
    weekly = [t for t in tracks if t["cadence"] == "weekly" and t["status"] == "active"]
    lines = []
    for t in weekly:
        bits = [esc(t.get("headline") or t["title"])]
        if t.get("target"):
            bits.append(esc(t["target"]))
        bits.append(progress(t))
        lines.append(f'<a href="woods/{t["slug"]}/index.html">{" · ".join(bits)}</a>')
    status = (f'    <p class="status-line">{"<br>".join(lines)} '
              f'<a class="dim" href="woods/index.html">&rarr; the woods</a></p>') if lines else ""

    rows = "\n".join(
        f'        <div class="row-line"><span class="label"><a class="label-link" href="projects/{p["slug"]}.html">'
        f'{esc(p["name"])}/</a></span><span class="rule rule--dotted"></span>'
        f'<span class="meta">{esc(p["summary"])}</span><span class="when">{MONTHS[p["date"].month - 1][:3]} {p["date"].year}</span></div>'
        for p in projects)
    earlier = f'''    <details class="fold" id="earlier">
      <summary class="sec-head"><span class="prompt">$ ls ~/earlier</span><span class="rule rule--dashed"></span><span class="prompt">projects from before the RHCSA · {len(projects)}</span></summary>
      <div class="earlier">
{rows}
      </div>
    </details>''' if projects else ""

    main = fill(body, {"status": status, "earlier": earlier,
                       "hero_species": weekly[0]["species"] if weekly else "oak"}, "templates/home.html")
    site.page("index.html", meta["title"], meta["description"], main.strip("\n"), "about",
              og_type="website", head=meta.get("head", ""), body_class="home")


def build_project(site, projects, p):
    i = projects.index(p)
    nav = ['<a href="../index.html#earlier">&larr; back to about</a>', '<span class="grow"></span>']
    if i + 1 < len(projects):
        nav.append(f'<a href="{projects[i + 1]["slug"]}.html">&larr; {esc(projects[i + 1]["name"])}</a>')
    if i > 0:
        nav.append(f'<a href="{projects[i - 1]["slug"]}.html">{esc(projects[i - 1]["name"])} &rarr;</a>')
    main = f'''  <div class="crumbs">$ cd <a href="../index.html#earlier">~/earlier</a>/{esc(p["name"])}</div>

  <section class="section section--proj">
    <h1 class="name name--proj">{esc(p["title"])}</h1>
    <p class="proj-sum">{esc(p["summary"])}</p>
    <div class="proj-meta">
      <span>{p["status"]}</span>
      <span>{p["date"].isoformat()}</span>
    </div>
  </section>

  <article class="section prose">
{p["body"].rstrip()}
  </article>

  <nav class="proj-nav">
    {chr(10).join("    " + n for n in nav).strip()}
  </nav>'''
    site.page(f"projects/{p['slug']}.html", f"{p['title']} — {OWNER}", p["description"], main, "about")


# --- the woods

def build_woods(site, tracks, books):
    meta, body = parse_front_matter((TEMPLATES / "woods.html").read_text(encoding="utf-8"), "templates/woods.html")
    places = [{"kind": "lodge", "href": "shelf/index.html", "label": "shelf", "n": len(books)}]
    for t in tracks:
        if t["structure"] != "none":
            c = t["counts"]
            places.append({"kind": "stand", "href": f'{t["slug"]}/index.html', "label": t["name"],
                           "species": t["species"], "structure": t["structure"], "done": c["done"],
                           "total": c["total"], "finished": t["finished"], "active": t["status"] == "active"})
        else:
            places.append({"kind": "board", "href": f'{t["slug"]}/index.html', "label": t["name"],
                           "species": t["species"], "n": len(t["entries"])})

    rows = []
    for t in tracks:
        last = t["entries"][0] if t["entries"] else None
        latest = (f'<a class="trow-last" href="{t["slug"]}/{last["slug"]}.html">latest: {last["label"]} &rarr;</a>'
                  if last else '<span class="trow-last dim">nothing yet</span>')
        rows.append(
            f'      <div class="trow" data-species="{t["species"]}">'
            f'<a class="trow-name" href="{t["slug"]}/index.html">{ticon(t)}{esc(t["name"])}/</a>'
            f'{ring(t)}<span class="trow-count">{progress(t)}</span>{latest}'
            f'<span class="trow-sum">{esc(t["summary"])}</span></div>')
    rows.append(
        f'      <div class="trow"><a class="trow-name" href="shelf/index.html">'
        f'<span class="ticon" data-ticon="book" aria-hidden="true"></span>shelf/</a>'
        f'<span class="trow-count">{len(books)} books</span>'
        f'<span class="trow-sum">What I read alongside the tracks, and where it shows up.</span></div>')

    items = sorted(((t, e) for t in tracks for e in t["entries"]),
                   key=lambda x: (x[1]["date"], x[0]["slug"]), reverse=True)
    chips = " ".join(f'<a class="chip" href="#track={t["slug"]}" data-track="{t["slug"]}">{ticon(t)}{esc(t["name"])}</a>'
                     for t in tracks)
    main = fill(body, {
        "places": json_attr(places), "tracks": "\n".join(rows),
        "chips": f'<a class="chip" href="#" data-track="">all</a> {chips}',
        "feed": feed(items, ""), "n_entries": f'{len(items)} entr{"y" if len(items) == 1 else "ies"}',
        "empty_hidden": " hidden" if items else "",
    }, "templates/woods.html")
    site.page("woods/index.html", meta["title"], meta["description"], main.strip("\n"), "woods",
              body_class="woods", scripts=["track.js"])


def build_track(site, t, books):
    state, counts, entries, slug = t["state"], t["counts"], t["entries"], t["slug"]
    sections = []

    sections.append(f'''  <section class="section" id="entries">
    <div class="sec-head">
      <span class="prompt">$ ls -t ~/woods/{esc(t["name"])}</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{len(entries)}</span>
    </div>
    <div class="wus" id="wus">
{feed([(t, e) for e in entries], "../")}
    </div>
    <p class="wu-empty" id="wu-empty"{" hidden" if entries else ""}>{"Nothing here yet." if not entries else "No entry covers this objective yet."}</p>
  </section>''')

    if t["by_id"]:
        groves = []
        for g in t["groups"]:
            objs = g["objectives"]
            done = sum(state[o["id"]] == "done" for o in objs)
            prac = sum(state[o["id"]] == "practising" for o in objs)
            trees = "".join(
                f'<button type="button" class="obj" data-obj="{o["id"]}" data-state="{state[o["id"]]}" '
                f'data-text="{esc(o["text"])}" aria-label="{esc(o["text"])} — {state[o["id"]]}" '
                f'title="{esc(o["text"])}"><span class="obj-fallback">{state[o["id"]][0]}</span></button>'
                for o in objs)
            groves.append(
                f'<div class="grove">\n'
                f'  <div class="row-line"><span class="label">{esc(g["name"])}</span>'
                f'<span class="rule rule--dotted"></span>'
                f'<span class="meta">{prac} practising</span><span class="when">{done}/{len(objs)}</span></div>\n'
                f'  <div class="grove-trees">{trees}</div>\n</div>')
        source = ""
        if t.get("source"):
            source = f' <a href="{esc(t["source"]["url"])}">{esc(t["source"].get("label", "source"))}</a>'
        label = f' · {esc(t["label"])}' if t.get("label") else ""
        sections.append(f'''  <section class="section" id="objectives">
    <div class="sec-head">
      <span class="prompt">$ ls ~/woods/{esc(t["name"])}/objectives</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{counts["total"]}{label}</span>
    </div>
    <p class="legend"><span>{esc(t.get("legend", ""))}</span>{source}</p>
    <div class="groves" data-species="{t["species"]}">
{chr(10).join(groves)}
    </div>
    <div class="obj-detail" id="obj-detail" hidden>
      <span class="obj-detail-text" id="obj-detail-text"></span>
      <button type="button" class="theme-toggle" id="obj-clear">[clear filter]</button>
    </div>
  </section>''')

    what = "the build" if t["structure"] != "none" else "the tree"
    sections.append(f'''  <section class="section section--last" id="build">
    <div class="sec-head">
      <span class="prompt">$ ls ~/woods/{esc(t["name"])}/{what.split()[-1]}</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{progress(t)}</span>
    </div>
    <div class="build-scene" id="build-scene" {scene_attrs(t)}></div>
  </section>''')

    target = f'<span>{esc(t["target"])}</span>' if t.get("target") else ""
    main = f'''  <div class="crumbs">$ cd <a href="../index.html">~/woods</a>/{esc(t["name"])}</div>

  <section class="section section--proj" data-species="{t["species"]}">
    <h1 class="name name--proj">{esc(t["title"])}</h1>
    <p class="proj-sum">{esc(t["intro"])}</p>
    <div class="proj-meta">
      {ring(t)}
      <span>{progress(t)}</span>
      {target}
    </div>
  </section>

{chr(10).join(sections)}

  <nav class="proj-nav">
    <a href="../index.html">&larr; back to the woods</a>
  </nav>'''
    desc = f"{t['title']}: {progress(t)}. {t['summary']}."
    site.page(f"woods/{slug}/index.html", f"{t['title']} — {OWNER}", desc, main, "woods",
              scripts=["track.js"])

    for i, e in enumerate(entries):
        newer = entries[i - 1] if i > 0 else None
        older = entries[i + 1] if i + 1 < len(entries) else None
        build_entry(site, t, e, newer, older, books)


def build_entry(site, t, e, newer, older, books):
    by_id, state = t["by_id"], t["state"]

    def obj_list(ids, heading):
        if not ids:
            return ""
        items = "".join(
            f'<li><a href="index.html#obj={oid}"><span class="obj-inline" data-glyph="{GLYPH[state[oid]]}"></span>'
            f'{esc(by_id[oid]["text"])}</a> <span class="dim">· {esc(by_id[oid]["group"])}</span></li>'
            for oid in ids)
        return f'<h2>{heading}</h2>\n<ul class="objs">{items}</ul>'

    scripts = ""
    if e["scripts"]:
        items = []
        for s in e["scripts"]:
            name = f'<code>{esc(s["name"])}</code>'
            if s.get("url"):
                name = f'<a href="{esc(s["url"])}">{name}</a>'
            what = f' — {esc(s["what"])}' if s.get("what") else ""
            items.append(f"<li>{name}{what}</li>")
        scripts = '<h2>Scripts</h2>\n<ul>' + "".join(items) + "</ul>"

    shelf = ""
    if e["books"]:
        items = "".join(
            f'<li><a href="../shelf/index.html#book={b}"><span class="spine-chip" data-tone="{books[b]["tone"]}"></span>'
            f'{esc(books[b]["title"])}</a> <span class="dim">· {esc(books[b]["author"])}</span></li>'
            for b in e["books"])
        shelf = f'<h2>From the shelf</h2>\n<ul class="objs">{items}</ul>'

    nav = [f'<a href="index.html">&larr; {esc(t["name"])}</a>', '<span class="grow"></span>']
    if older:
        nav.append(f'<a href="{older["slug"]}.html">&larr; {older["label"]}</a>')
    if newer:
        nav.append(f'<a href="{newer["slug"]}.html">{newer["label"]} &rarr;</a>')

    counts = []
    if e["practised"] or e["passed"]:
        counts.append(f'{len(e["practised"])} practised · {len(e["passed"])} passed')
    if e["scripts"]:
        counts.append(f'{len(e["scripts"])} scripts')
    chapter = f'<span>{esc(e["chapter"])}</span>' if e["chapter"] else ""
    when = f'{e["label"]} · {e["date"].isoformat()}' if t["cadence"] == "weekly" else e["date"].isoformat()
    main = f'''  <div class="crumbs">$ cd <a href="../index.html">~/woods</a>/<a href="index.html">{esc(t["name"])}</a>/{e["slug"]}</div>

  <section class="section section--proj" data-species="{t["species"]}">
    <h1 class="name name--proj">{esc(e["title"])}</h1>
    <div class="proj-meta">
      {ticon(t)}
      <span>{when}</span>
      {chapter}
      {"".join(f"<span>{c}</span>" for c in counts)}
    </div>
  </section>

  <article class="section prose">
{markdown(e["body"])}
{scripts}
{obj_list(e["practised"], "Objectives practised")}
{obj_list(e["passed"], esc(t.get("passed_label", "Done")))}
{shelf}
  </article>

  <nav class="proj-nav">
    {" ".join(nav)}
  </nav>'''
    desc = e["summary"] or f"{t['title']}, {e['date'].isoformat()}."
    site.page(f"woods/{t['slug']}/{e['slug']}.html", f"{e['title']} — {t['title']}", desc, main, "woods",
              scripts=["track.js"])


def build_shelf(site, topics, books):
    by_topic = []
    for tid, topic in topics.items():
        items = []
        for b in (b for b in books.values() if b["topic"] == tid):
            cited = ", ".join(f'<a href="../{t["slug"]}/{e["slug"]}.html">{esc(t["name"])} {e["label"]}</a>'
                              for t, e in b["cited"])
            cited = f' <span class="book-cited">cited in {cited}</span>' if cited else ""
            title = f'<a href="{esc(b["link"])}">{esc(b["title"])}</a>' if b.get("link") else esc(b["title"])
            items.append(f'<li class="book" id="book-{b["id"]}" data-book="{b["id"]}">'
                         f'<span class="spine-chip" data-tone="{topic["tone"]}"></span>'
                         f'<span class="book-title">{title}</span> <span class="dim">— {esc(b["author"])}</span>{cited}</li>')
        by_topic.append(f'    <h3 class="month-name">{esc(topic["label"])}</h3>\n    <ul class="books">{"".join(items)}</ul>')
    spines = [{"id": b["id"], "topic": b["topic"], "title": b["title"], "author": b["author"]} for b in books.values()]
    main = f'''  <div class="crumbs">$ cd <a href="../index.html">~/woods</a>/shelf</div>

  <section class="section section--proj">
    <h1 class="name name--proj">The shelf</h1>
    <p class="proj-sum">What I'm reading alongside the tracks: one shelf per topic, built from the same logs as everything else in the woods. Pick a spine to see the book and the entries that cite it.</p>
    <div class="shelf-scene" id="shelf-scene" data-books="{json_attr(spines)}" data-topics="{json_attr([t["id"] for t in topics.values()])}"></div>
    <div class="obj-detail" id="book-detail" hidden>
      <span class="obj-detail-text" id="book-detail-text"></span>
      <button type="button" class="theme-toggle" id="book-clear">[close]</button>
    </div>
  </section>

  <section class="section section--last" id="books">
    <div class="sec-head">
      <span class="prompt">$ ls ~/woods/shelf</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{len(books)} books</span>
    </div>
{chr(10).join(by_topic)}
  </section>

  <nav class="proj-nav">
    <a href="../index.html">&larr; back to the woods</a>
  </nav>'''
    site.page("woods/shelf/index.html", f"The shelf — {OWNER}",
              f"{len(books)} books on Linux, shell, infrastructure, networking and method, and the log entries that cite them.",
              main, "woods", scripts=["track.js"])


def build_readme(t):
    rows = []
    for g in t["groups"]:
        rows.append(f"\n### {g['name']}\n\n| id | objective |\n|---|---|")
        rows += [f"| `{o['id']}` | {o['text'].replace('|', '/')} |" for o in g["objectives"]]
    src = t.get("source") or {}
    source = (f"Source: [{src.get('label', 'source')}]({src['url']})"
              + (f" (fetched {src['fetched']}).\n" if src.get("fetched") else ".\n")) if src.get("url") else ""
    rule = t.get("passed_rule", "done for real, not just practised")
    return f"""# {t['title']} — objective ids

Generated by `bin/build.py` from `track.json`. How to write an entry: `tracks/README.md`.

- **practised**: list ids you worked on in the entry
- **passed**: {rule}

{source}{chr(10).join(rows)}
"""


def redirect(path, target):
    rel = "../" * path.count("/") + target
    out = DIST / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Moved</title>
<link rel="canonical" href="{SITE}/{target.replace("index.html", "")}">
<meta http-equiv="refresh" content="0; url={rel}">
</head><body><p>Moved to <a href="{rel}">{target}</a>.</p></body></html>
''', encoding="utf-8")


# ----------------------------------------------------------------------- main

def clean_dist():
    """Empty dist/ but keep the directory: the dev container bind-mounts it."""
    DIST.mkdir(exist_ok=True)
    for child in DIST.iterdir():
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()


def main():
    topics, books = load_shelf()
    projects = load_projects()
    tracks = load_tracks(books)
    reserved = {"shelf", "index"}
    clash = reserved & {t["slug"] for t in tracks}
    if clash:
        raise BuildError(f"track folder name(s) reserved in the woods: {', '.join(sorted(clash))}")

    site = Site()
    clean_dist()
    for f in STATIC_FILES:
        shutil.copy2(ROOT / f, DIST / f)
    for d in STATIC_DIRS:
        shutil.copytree(ROOT / d, DIST / d)

    build_home(site, projects, tracks)
    for p in projects:
        build_project(site, projects, p)
    build_woods(site, tracks, books)
    for t in tracks:
        build_track(site, t, books)
        if t["by_id"]:
            (t["tdir"] / "README.md").write_text(build_readme(t), encoding="utf-8")
    build_shelf(site, topics, books)
    for path, target in REDIRECTS.items():
        redirect(path, target)

    print(f"site: about + {len(projects)} earlier projects · woods: {len(tracks)} tracks, "
          f"{len(books)} books → dist/ (v={site.v})")
    for t in tracks:
        print(f"  {t['slug']}: {progress(t)}")


if __name__ == "__main__":
    try:
        main()
    except BuildError as err:
        sys.exit(f"build: {err}")
