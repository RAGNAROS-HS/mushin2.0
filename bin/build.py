#!/usr/bin/env python3
"""Build the whole site into dist/.

  /              whoami, what I'm on now, the latest posts, active projects
  /blog/         every post, newest first, grouped by year; one page per tag
  /rhcsa/        the RHCSA series: its objectives and the posts that cover them
  /projects/     everything I've built, `ls -l` style, one page each
  /cv/           the career tree and the resume PDF
  /books/        the shelf, and which posts cite each book
  /feed.xml      Atom feed of the posts

Reads   templates/shell.html        head, header and footer shared by every page
        templates/home.html         the home page body (bio is hand-written there)
        templates/cv.html           the career tree, hand-written
        posts/*.md                  one post each (front matter + Markdown)
        series/<slug>/series.json   a series with objectives, e.g. the RHCSA
        content/projects/*.md       one project each (front matter + Markdown or HTML)
        content/shelf.json          the books, by topic
Writes  dist/                       the deployable site, static files copied in
        series/<slug>/README.md     the series' objective ids, for writing posts

Standard library only, so `python3 bin/build.py` works anywhere and the
Docker build stage needs no pip install. Fails loudly on bad input (unknown
tag, objective, project or book id) instead of silently going live.
"""

import hashlib
import html
import json
import re
import shutil
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "templates"
CONTENT = ROOT / "content"
POSTS = ROOT / "posts"
SERIES = ROOT / "series"
DIST = ROOT / "dist"
SITE = "https://hugokatzer.tech"
OWNER = "Hugo Sokołowski-Katzer"
HOST = "hsk@hugokatzer"
RESUME = "pdfs/CV4_0.pdf"

STATIC_FILES = ("styles.css", "app.js", "series.js")
STATIC_DIRS = ("img", "pdfs")
RECENT = 10   # posts on the home page

# Old public URLs that must keep working: path in dist -> target, from the site root.
REDIRECTS = {
    "log/index.html": "rhcsa/index.html",
    "cabin/index.html": "blog/index.html",
    "cabin/rhcsa/index.html": "rhcsa/index.html",
    "cabin/notes/index.html": "blog/index.html",
    "earlier/index.html": "projects/index.html",
}

STATES = ("active", "complete", "abandoned", "discontinued", "limbo")
OBJ_STATES = ("todo", "practising", "done")
SLUG = r"[a-z0-9]+(-[a-z0-9]+)*"
MONTHS = ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")

# The beaver, the site's one bit of pixel art. One letter per palette slot
# (--px-* in styles.css), "." is empty. EYE cells blink (CSS).
BEAVER = (
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
    ".BBBB..BBB.BBBBBBBBBB.TTTTTTT.",
)
EYE = {(3, 4), (4, 4)}
# Light-theme colours, for the favicon (which can't read CSS variables).
FAVICON_FILL = {"O": "#2b1a10", "B": "#7a4a2a", "M": "#5c3720", "L": "#c08a5c", "G": "#f6eedc",
                "P": "#d98a7a", "N": "#2b1a10", "T": "#3d2a1f", "X": "#6b4e3a"}


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
    scalars or of `name:/url:` maps. Enough for a post header."""
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


def id_list(meta, field):
    v = meta.get(field) or []
    return [v] if isinstance(v, str) else list(dict.fromkeys(v))


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
    page title is the only h1 (`#` and `##` both become h2). A line that
    starts with `<` is passed through as raw HTML (for a demo's markup)."""
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
        elif s.startswith("<") and not para:
            # Raw HTML block, up to the next blank line.
            block = []
            while i < len(lines) and lines[i].strip():
                block.append(lines[i])
                i += 1
            out.append("\n".join(block))
            continue
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
        if b and not b.startswith(("#", "-", "*", ">", "|", "<")):
            b = re.sub(r"[`*_]|!\[[^\]]*\]\([^)]*\)", "", b)
            b = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", b)
            b = " ".join(b.split())
            return b if len(b) <= limit else b[: limit - 1].rsplit(" ", 1)[0] + "…"
    return ""


def words(text):
    return len(re.findall(r"\w+", re.sub(r"<[^>]+>", " ", text)))


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


def mon(d):
    return f"{MONTHS[d.month - 1]} {d.year}"


def plural(n, word, many=None):
    return f"{n} {word if n == 1 else (many or word + 's')}"


# ---------------------------------------------------------------------- beaver

def beaver_svg(cls="beaver", fills=None, label=OWNER + "'s beaver"):
    """The beaver as an SVG of run-length rects. With `fills` the colours are
    inline (favicon); otherwise each rect gets a palette class for CSS."""
    h, w = len(BEAVER), max(len(r) for r in BEAVER)
    rects = []

    def at(x, y):
        return BEAVER[y][x] if 0 <= y < h and 0 <= x < len(BEAVER[y]) else "."

    # A one-cell outline around the sprite, so it reads on both themes.
    if not fills:
        for y in range(-1, h + 1):
            for x in range(-1, w + 1):
                if at(x, y) == "." and any(at(x + dx, y + dy) != "." for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" class="pZ"/>')
    for y, row in enumerate(BEAVER):
        x = 0
        while x < len(row):
            c, x2 = row[x], x + 1
            while x2 < len(row) and row[x2] == c and (x2, y) not in EYE and (x, y) not in EYE:
                x2 += 1
            if c != ".":
                paint = f'fill="{fills[c]}"' if fills else f'class="p{c}{" eye" if (x, y) in EYE else ""}"'
                rects.append(f'<rect x="{x}" y="{y}" width="{x2 - x}" height="1" {paint}/>')
            x = x2
    a = f' role="img" aria-label="{esc(label)}"' if label else ' aria-hidden="true"'
    pad = 0 if fills else 1
    return (f'<svg class="{cls}" xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {w + 2 * pad} {h + 2 * pad}" '
            f'shape-rendering="crispEdges"{a}>' + "".join(rects) + "</svg>")


def favicon():
    svg = beaver_svg(cls="f", fills=FAVICON_FILL, label="")
    # Square it up: the sprite is 30x16, a favicon wants 1:1.
    svg = svg.replace('viewBox="0 0 30 16"', 'viewBox="0 -7 30 30"')
    return "data:image/svg+xml," + svg.replace('"', "'").replace("#", "%23").replace("<", "%3C").replace(">", "%3E")


# ---------------------------------------------------------------------- model

def load_shelf():
    data = json.loads((CONTENT / "shelf.json").read_text(encoding="utf-8"))
    topics = {t["id"]: t for t in data["topics"]}
    books = {}
    for b in data["books"]:
        for field in ("id", "title", "author", "topic"):
            if not b.get(field):
                raise BuildError(f"content/shelf.json: a book is missing '{field}'")
        if b["topic"] not in topics:
            raise BuildError(f"content/shelf.json: {b['id']}: unknown topic {b['topic']!r}")
        if b["id"] in books:
            raise BuildError(f"content/shelf.json: duplicate book id {b['id']!r}")
        books[b["id"]] = dict(b, cited=[])
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
                "repo": meta.get("repo") or "",
                "body": body if fmt == "html" else markdown(body), "posts": [],
            })
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    out.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    return out


def load_series():
    out = {}
    for path in sorted(SERIES.glob("*/series.json")):
        name = str(path.relative_to(ROOT))
        try:
            s = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise BuildError(f"{name}: {e}")
        for field in ("title", "summary", "intro"):
            if not s.get(field):
                raise BuildError(f"{name}: missing '{field}'")
        if s.get("status", "active") not in STATES:
            raise BuildError(f"{name}: status must be one of {', '.join(STATES)}")
        by_id = {}
        for g in s.get("groups") or []:
            for o in g["objectives"]:
                if not re.fullmatch(SLUG, o["id"]):
                    raise BuildError(f"{name}: objective id {o['id']!r} must be lowercase words joined by '-'")
                if o["id"] in by_id:
                    raise BuildError(f"{name}: duplicate objective id {o['id']!r}")
                o["group"] = g["name"]
                by_id[o["id"]] = o
        slug = path.parent.name
        out[slug] = dict(s, slug=slug, dir=path.parent, by_id=by_id, posts=[],
                         status=s.get("status", "active"))
    return out


def load_posts(series, projects, books):
    by_project = {p["slug"]: p for p in projects}
    posts, problems = [], []
    for path in sorted(POSTS.glob("*.md")):
        if path.name.startswith("_") or path.name == "README.md":
            continue
        name = str(path.relative_to(ROOT))
        try:
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"), name)
            for field in ("date", "title"):
                if not meta.get(field):
                    raise BuildError(f"{name}: missing '{field}'")
            if str(meta.get("draft", "")).lower() == "true":
                continue
            slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", path.stem.lower())
            if not re.fullmatch(SLUG, slug) or slug in ("index", "tag"):
                raise BuildError(f"{name}: file name must be lowercase words joined by '-' (not 'index' or 'tag')")
            tags = id_list(meta, "tags")
            bad = [t for t in tags if not re.fullmatch(SLUG, t)]
            if bad:
                raise BuildError(f"{name}: tags must be lowercase words joined by '-': {', '.join(bad)}")
            s = meta.get("series") or ""
            if s and s not in series:
                raise BuildError(f"{name}: unknown series {s!r} (have: {', '.join(series) or 'none'})")
            if s and s not in tags:
                tags.insert(0, s)
            obj = {f: id_list(meta, f) for f in ("practised", "passed")}
            for f, ids in obj.items():
                if ids and not s:
                    raise BuildError(f"{name}: '{f}' needs a 'series' to say whose objectives these are")
                unknown = [x for x in ids if x not in series[s]["by_id"]] if s else []
                if unknown:
                    raise BuildError(f"{name}: unknown id(s) in '{f}': {', '.join(unknown)} (see series/{s}/README.md)")
            cites = id_list(meta, "books")
            unknown = [b for b in cites if b not in books]
            if unknown:
                raise BuildError(f"{name}: unknown book id(s): {', '.join(unknown)} (see content/shelf.json)")
            proj = meta.get("project") or ""
            if proj and proj not in by_project:
                raise BuildError(f"{name}: unknown project {proj!r} (see content/projects/)")
            scripts = []
            for sc in meta.get("scripts") or []:
                sc = sc if isinstance(sc, dict) else {"name": sc}
                if not sc.get("name"):
                    raise BuildError(f"{name}: every script needs a 'name'")
                scripts.append(sc)
            html_body = markdown(body)
            posts.append({
                "slug": slug, "file": name, "date": iso_date(meta["date"], name),
                "title": str(meta["title"]), "tags": tags, "series": s, "project": proj,
                "practised": obj["practised"], "passed": obj["passed"], "books": cites,
                "scripts": scripts, "body": html_body, "words": words(html_body),
                "summary": str(meta.get("summary") or plain_summary(body)),
            })
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    seen = {}
    for p in posts:
        if p["slug"] in seen:
            raise BuildError(f"{p['file']} and {seen[p['slug']]} have the same slug ({p['slug']})")
        seen[p["slug"]] = p["file"]
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)

    for p in posts:
        if p["series"]:
            series[p["series"]]["posts"].append(p)
        if p["project"]:
            by_project[p["project"]]["posts"].append(p)
        for b in p["books"]:
            books[b]["cited"].append(p)
    for s in series.values():
        state = {oid: "todo" for oid in s["by_id"]}
        for p in s["posts"]:
            for oid in p["practised"]:
                if state[oid] == "todo":
                    state[oid] = "practising"
        for p in s["posts"]:
            for oid in p["passed"]:
                state[oid] = "done"
        s["state"] = state
        s["counts"] = dict({k: sum(v == k for v in state.values()) for k in OBJ_STATES}, total=len(state))
    return posts


# ------------------------------------------------------------------ fragments

def progress(s):
    bits = []
    if s["by_id"]:
        bits.append(f'{s["counts"]["done"]}/{s["counts"]["total"]} objectives')
    bits.append(plural(len(s["posts"]), "post"))
    return " · ".join(bits)


def tag_links(tags, prefix):
    return " ".join(f'<a class="tag" href="{prefix}blog/tag/{t}.html">#{t}</a>' for t in tags)


def post_rows(posts, prefix, by_year=False, objs=False):
    """One line per post: date, title, tags. `prefix` is the path to the root."""
    out, year = [], None
    for p in posts:
        if by_year and p["date"].year != year:
            if year is not None:
                out.append("</div>")
            year = p["date"].year
            n = sum(q["date"].year == year for q in posts)
            out.append(f'<div class="year"><h2 class="year-head"><span>{year}</span>'
                       f'<span class="dim">{plural(n, "post")}</span></h2>')
        data = f' data-objs="{" ".join(sorted(set(p["practised"]) | set(p["passed"])))}"' if objs else ""
        out.append(
            f'<div class="post"{data}><time datetime="{p["date"].isoformat()}">{p["date"].isoformat()}</time>'
            f'<a class="post-title" href="{prefix}blog/{p["slug"]}.html">{esc(p["title"])}</a>'
            f'<span class="post-tags">{tag_links(p["tags"], prefix)}</span></div>')
    if by_year and year is not None:
        out.append("</div>")
    return "\n".join(out)


def project_rows(projects, prefix):
    return "\n".join(
        f'<div class="ls"><span class="ls-state s-{p["status"]}">{p["status"]}</span>'
        f'<span class="ls-when">{mon(p["date"])}</span>'
        f'<a class="ls-name" href="{prefix}projects/{p["slug"]}.html">{esc(p["name"])}/</a>'
        f'<span class="ls-sum">{esc(p["summary"])}</span></div>'
        for p in projects)


def head(cmd, right=""):
    """A section heading written as the command that would list it."""
    r = f'<span class="dim">{right}</span>' if right else ""
    return f'<h2 class="cmd"><span class="ps1">$</span> {cmd}{r}</h2>'


# ---------------------------------------------------------------------- pages

class Site:
    def __init__(self):
        self.shell = (TEMPLATES / "shell.html").read_text(encoding="utf-8")
        digest = hashlib.sha1()
        for f in STATIC_FILES:
            digest.update((ROOT / f).read_bytes())
        self.v = digest.hexdigest()[:8]
        self.icon = favicon()

    def page(self, path, title, description, main, cwd, og_type="article", scripts=()):
        """Write dist/<path>. Links inside `main` are relative to that page.
        `cwd` is the prompt's working directory, e.g. "blog/tag"."""
        root = "../" * path.count("/")
        url = SITE + "/" + (path[: -len("index.html")] if path.endswith("index.html") else path)
        # The prompt in the header: every directory above the current one in
        # ~/a/b is a link; the last part is where you are.
        parts = [p for p in cwd.split("/") if p]
        crumbs = [f'<a href="{root or "./"}">~</a>' if parts else "~"]
        for i, part in enumerate(parts):
            last = i == len(parts) - 1
            crumbs.append(esc(part) if last else f'<a href="{root}{"/".join(parts[: i + 1])}/">{esc(part)}</a>')
        section = parts[0] if parts else "home"
        tags = "".join(f'<script src="{root}{s}?v={self.v}"></script>\n' for s in scripts)
        out = fill(self.shell, {
            "root": root, "home": root or "./", "section": section, "title": esc(title),
            "description": esc(description), "url": esc(url), "og_type": og_type,
            "cwd": "/".join(crumbs), "icon": self.icon, "resume": root + RESUME,
            "main": main, "scripts": tags, "v": self.v, "year": date.today().year,
        }, f"{path} (templates/shell.html)")
        target = DIST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(out, encoding="utf-8")


def build_home(site, posts, projects, series):
    meta, body = parse_front_matter((TEMPLATES / "home.html").read_text(encoding="utf-8"), "templates/home.html")
    now = []
    for s in series.values():
        if s["status"] == "active":
            bits = [esc(s.get("headline") or s["title"])]
            if s.get("target"):
                bits.append(esc(s["target"]))
            bits.append(progress(s))
            now.append(f'<p class="now"><span class="dim">now:</span> <a href="{s["slug"]}/">{" · ".join(bits)}</a></p>')
    recent = posts[:RECENT]
    more = (f'<p class="more"><a href="blog/">all {len(posts)} posts &rarr;</a></p>'
            if len(posts) > RECENT else "")
    active = [p for p in projects if p["status"] == "active"]
    main = fill(body, {
        "beaver": beaver_svg(), "now": "\n".join(now),
        "recent": post_rows(recent, "") or '<p class="dim">Nothing yet. Soon.</p>',
        "more_posts": more, "n_posts": plural(len(posts), "post"),
        "projects": project_rows(active, ""),
        "n_projects": f"{len(active)} active of {len(projects)}",
    }, "templates/home.html")
    site.page("index.html", meta["title"], meta["description"], main.strip("\n"), "",
              og_type="website")


def build_blog(site, posts):
    tags = {}
    for p in posts:
        for t in p["tags"]:
            tags.setdefault(t, []).append(p)
    cloud = " ".join(f'<a class="tag" href="tag/{t}.html">#{t}<sup>{len(ps)}</sup></a>'
                     for t, ps in sorted(tags.items(), key=lambda x: (-len(x[1]), x[0])))
    main = f'''<h1 class="title">Blog</h1>
<p class="lede">RHCSA progress, homelab notes, opinions and small demos. Newest first.
Subscribe with <a href="../feed.xml">the feed</a>.</p>
{f'<p class="tags">{cloud}</p>' if cloud else ""}
<section class="posts">
{post_rows(posts, "../", by_year=True) or '<p class="dim">Nothing yet.</p>'}
</section>'''
    site.page("blog/index.html", f"Blog — {OWNER}", "Posts by Hugo Sokołowski-Katzer: RHCSA progress, "
              "homelab notes, opinions and small demos.", main, "blog", og_type="website")

    for t, ps in tags.items():
        main = f'''<h1 class="title">#{esc(t)}</h1>
<p class="lede">{plural(len(ps), "post")} tagged <code>{esc(t)}</code>. <a href="../">All posts</a>.</p>
<section class="posts">
{post_rows(ps, "../../", by_year=True)}
</section>'''
        site.page(f"blog/tag/{t}.html", f"#{t} — {OWNER}", f"Posts tagged {t}.", main, f"blog/tag/{t}")
    redirect("blog/tag/index.html", "blog/index.html")   # the prompt links ~/blog/tag

    for i, p in enumerate(posts):
        build_post(site, p, posts[i - 1] if i else None, posts[i + 1] if i + 1 < len(posts) else None)
    return tags


def build_post(site, p, newer, older):
    r = "../"
    extra = []
    s = SERIES_BY_SLUG.get(p["series"])
    if s:
        by_id, state = s["by_id"], s["state"]

        def objs(ids, heading):
            if not ids:
                return ""
            items = "".join(
                f'<li><a href="{r}{s["slug"]}/#obj={oid}"><span class="obj" data-state="{state[oid]}"></span>'
                f'{esc(by_id[oid]["text"])}</a> <span class="dim">· {esc(by_id[oid]["group"])}</span></li>'
                for oid in ids)
            return f'<h2>{heading}</h2>\n<ul class="objs">{items}</ul>'
        extra.append(objs(p["practised"], "Objectives practised"))
        extra.append(objs(p["passed"], esc(s.get("passed_label", "Done"))))
    if p["scripts"]:
        items = []
        for sc in p["scripts"]:
            n = f'<code>{esc(sc["name"])}</code>'
            if sc.get("url"):
                n = f'<a href="{esc(sc["url"])}">{n}</a>'
            what = " — " + esc(sc["what"]) if sc.get("what") else ""
            items.append(f"<li>{n}{what}</li>")
        extra.append("<h2>Scripts</h2>\n<ul>" + "".join(items) + "</ul>")
    if p["books"]:
        items = "".join(f'<li><a href="{r}books/#{b}">{esc(BOOKS[b]["title"])}</a> '
                        f'<span class="dim">· {esc(BOOKS[b]["author"])}</span></li>' for b in p["books"])
        extra.append(f"<h2>From the shelf</h2>\n<ul>{items}</ul>")

    meta = [f'<time datetime="{p["date"].isoformat()}">{p["date"].isoformat()}</time>',
            f'{max(1, round(p["words"] / 220))} min read']
    if s:
        n = len(s["posts"]) - s["posts"].index(p)
        meta.append(f'<a href="{r}{s["slug"]}/">{esc(s["title"])}</a> #{n}')
    if p["project"]:
        meta.append(f'about <a href="{r}projects/{p["project"]}.html">{esc(PROJECTS[p["project"]]["name"])}/</a>')

    nav = [f'<a href="./">&larr; all posts</a>', '<span class="grow"></span>']
    if older:
        nav.append(f'<a href="{older["slug"]}.html" title="{esc(older["title"])}">older</a>')
    if newer:
        nav.append(f'<a href="{newer["slug"]}.html" title="{esc(newer["title"])}">newer</a>')
    main = f'''<article class="article">
<header class="art-head">
<h1 class="title">{esc(p["title"])}</h1>
<p class="art-meta">{" · ".join(meta)}</p>
<p class="art-tags">{tag_links(p["tags"], r)}</p>
</header>
<div class="prose">
{p["body"]}
{"".join(x for x in extra if x)}
</div>
</article>
<nav class="pager">{" ".join(nav)}</nav>'''
    site.page(f"blog/{p['slug']}.html", f"{p['title']} — {OWNER}",
              p["summary"] or p["title"], main, f"blog/{p['slug']}")


def build_series(site, s):
    state, counts = s["state"], s["counts"]
    groups = []
    for g in s.get("groups") or []:
        done = sum(state[o["id"]] == "done" for o in g["objectives"])
        cells = "".join(
            f'<button type="button" class="obj" data-obj="{o["id"]}" data-state="{state[o["id"]]}" '
            f'data-text="{esc(o["text"])}" aria-label="{esc(o["text"])} — {state[o["id"]]}" '
            f'title="{esc(o["text"])}"></button>' for o in g["objectives"])
        groups.append(f'<div class="ogroup"><span class="og-name">{esc(g["name"])}</span>'
                      f'<span class="og-cells">{cells}</span><span class="og-n dim">{done}/{len(g["objectives"])}</span></div>')
    objectives = ""
    if groups:
        src = f' <a href="{esc(s["source"]["url"])}">{esc(s["source"].get("label", "source"))}</a>.' if s.get("source") else ""
        objectives = f'''<section id="objectives">
{head(f"ls ~/{s['slug']}/objectives", f"{counts['done']}/{counts['total']}{' · ' + esc(s['label']) if s.get('label') else ''}")}
<p class="legend"><span class="obj" data-state="todo"></span> not started
<span class="obj" data-state="practising"></span> practised
<span class="obj" data-state="done"></span> {esc(s.get("passed_label", "done")).lower()}.
Click one to filter the posts.{src}</p>
<div class="ogroups">
{chr(10).join(groups)}
</div>
</section>'''
    target = f' · {esc(s["target"])}' if s.get("target") else ""
    main = f'''<h1 class="title">{esc(s["title"])}</h1>
<p class="lede">{esc(s["intro"])}</p>
<p class="art-meta">{progress(s)}{target}</p>
<section id="entries">
{head(f"ls -t ~/blog | grep {s['slug']}", plural(len(s["posts"]), "post"))}
<div class="obj-detail" id="obj-detail" hidden><span id="obj-detail-text"></span>
<button type="button" class="btn" id="obj-clear">[clear]</button></div>
<div class="posts">
{post_rows(s["posts"], "../", objs=True)}
</div>
<p class="dim" id="wu-empty"{" hidden" if s["posts"] else ""}>{"Nothing yet." if not s["posts"] else "No post covers this objective yet."}</p>
</section>
{objectives}'''
    site.page(f"{s['slug']}/index.html", f"{s['title']} — {OWNER}",
              f"{s['title']}: {progress(s)}. {s['summary']}.", main, s["slug"], scripts=["series.js"])
    if s["by_id"]:
        (s["dir"] / "README.md").write_text(series_readme(s), encoding="utf-8")


def series_readme(s):
    rows = []
    for g in s["groups"]:
        rows.append(f"\n### {g['name']}\n\n| id | objective |\n|---|---|")
        rows += [f"| `{o['id']}` | {o['text'].replace('|', '/')} |" for o in g["objectives"]]
    src = s.get("source") or {}
    source = (f"Source: [{src.get('label', 'source')}]({src['url']})"
              + (f" (fetched {src['fetched']}).\n" if src.get("fetched") else ".\n")) if src.get("url") else ""
    rule = s.get("passed_rule", "done for real, not just practised")
    return f"""# {s['title']} — objective ids

Generated by `bin/build.py` from `series.json`. How to write a post: `posts/README.md`.

In a post with `series: {s['slug']}`:

- **practised**: list ids you worked on in the post
- **passed**: {rule}

{source}{chr(10).join(rows)}
"""


def build_projects(site, projects):
    main = f'''<h1 class="title">Projects</h1>
<p class="lede">Things I've built, newest first, including the ones that didn't work out.
Each has a write-up; the status says how it ended.</p>
{head("ls -l ~/projects", plural(len(projects), "project"))}
<div class="lsl">
{project_rows(projects, "../")}
</div>'''
    site.page("projects/index.html", f"Projects — {OWNER}", "Projects by Hugo Sokołowski-Katzer, "
              "newest first, with write-ups.", main, "projects", og_type="website")
    for i, p in enumerate(projects):
        nav = ['<a href="./">&larr; all projects</a>', '<span class="grow"></span>']
        if i + 1 < len(projects):
            nav.append(f'<a href="{projects[i + 1]["slug"]}.html">{esc(projects[i + 1]["name"])}/</a>')
        if i:
            nav.append(f'<a href="{projects[i - 1]["slug"]}.html">{esc(projects[i - 1]["name"])}/</a>')
        meta = [f'<span class="s-{p["status"]}">{p["status"]}</span>', mon(p["date"])]
        if p["repo"]:
            meta.append(f'<a href="{esc(p["repo"])}">source</a>')
        related = ""
        if p["posts"]:
            related = (f'<section>{head("grep -l " + esc(p["name"]) + " ~/blog/*")}<div class="posts">'
                       f'{post_rows(p["posts"], "../")}</div></section>')
        main = f'''<article class="article">
<header class="art-head">
<h1 class="title">{esc(p["title"])}</h1>
<p class="lede">{esc(p["summary"])}</p>
<p class="art-meta">{" · ".join(meta)}</p>
</header>
<div class="prose">
{p["body"].strip()}
</div>
</article>
{related}
<nav class="pager">{" ".join(nav)}</nav>'''
        site.page(f"projects/{p['slug']}.html", f"{p['title']} — {OWNER}", p["description"], main,
                  f"projects/{p['name']}")


def build_cv(site):
    meta, body = parse_front_matter((TEMPLATES / "cv.html").read_text(encoding="utf-8"), "templates/cv.html")
    main = fill(body, {"resume": "../" + RESUME}, "templates/cv.html")
    site.page("cv/index.html", meta["title"], meta["description"], main.strip("\n"), "cv",
              og_type="profile")


def build_books(site, topics, books):
    out = []
    for tid, t in topics.items():
        rows = []
        for b in (b for b in books.values() if b["topic"] == tid):
            cited = ""
            if b["cited"]:
                cited = ' <span class="dim">· cited in ' + ", ".join(
                    f'<a href="../blog/{p["slug"]}.html">{esc(p["title"])}</a>' for p in b["cited"]) + "</span>"
            rows.append(f'<li id="{b["id"]}"><span class="book">{esc(b["title"])}</span> '
                        f'<span class="dim">— {esc(b["author"])}</span>{cited}</li>')
        if rows:
            out.append(f'<h2 class="cmd-sub">{esc(t["label"])}/</h2>\n<ul class="books">{"".join(rows)}</ul>')
    main = f'''<h1 class="title">Books</h1>
<p class="lede">What's on the shelf: what I'm reading and what I reach for. Posts cite them where they helped.</p>
{head("ls ~/books", plural(len(books), "book"))}
{chr(10).join(out)}'''
    site.page("books/index.html", f"Books — {OWNER}", "The books on Hugo Sokołowski-Katzer's shelf.",
              main, "books", og_type="website")


def build_feed(posts):
    def stamp(d):
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    entries = []
    for p in posts[:30]:
        url = f"{SITE}/blog/{p['slug']}.html"
        # Relative links in the body would break in a feed reader: make them absolute.
        body = re.sub(r'(href|src)="(?!https?:|mailto:|#)(?:\.\./)*([^"]*)"',
                      lambda m: f'{m.group(1)}="{SITE}/{m.group(2)}"', p["body"])
        cats = "".join(f'<category term="{esc(t)}"/>' for t in p["tags"])
        entries.append(f"""  <entry>
    <title>{esc(p['title'])}</title>
    <link href="{url}"/>
    <id>{url}</id>
    <updated>{stamp(p['date'])}</updated>
    <summary>{esc(p['summary'])}</summary>
    {cats}
    <content type="html">{esc(body)}</content>
  </entry>""")
    updated = stamp(posts[0]["date"]) if posts else stamp(date.today())
    (DIST / "feed.xml").write_text(f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>{esc(OWNER)}</title>
  <subtitle>RHCSA progress, homelab notes, opinions and small demos.</subtitle>
  <link href="{SITE}/feed.xml" rel="self"/>
  <link href="{SITE}/"/>
  <id>{SITE}/</id>
  <updated>{updated}</updated>
  <author><name>{esc(OWNER)}</name></author>
{chr(10).join(entries)}
</feed>
""", encoding="utf-8")


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


SERIES_BY_SLUG, BOOKS, PROJECTS = {}, {}, {}


def main():
    topics, books = load_shelf()
    projects = load_projects()
    series = load_series()
    reserved = {"blog", "projects", "cv", "books", "img", "pdfs"} | {p.split("/")[0] for p in REDIRECTS}
    clash = reserved & set(series)
    if clash:
        raise BuildError(f"series folder name(s) reserved for site paths: {', '.join(sorted(clash))}")
    posts = load_posts(series, projects, books)
    SERIES_BY_SLUG.update(series)
    BOOKS.update(books)
    PROJECTS.update({p["slug"]: p for p in projects})

    site = Site()
    clean_dist()
    for f in STATIC_FILES:
        shutil.copy2(ROOT / f, DIST / f)
    for d in STATIC_DIRS:
        shutil.copytree(ROOT / d, DIST / d)

    build_home(site, posts, projects, series)
    tags = build_blog(site, posts)
    for s in series.values():
        build_series(site, s)
    build_projects(site, projects)
    build_cv(site)
    build_books(site, topics, books)
    build_feed(posts)
    for path, target in REDIRECTS.items():
        redirect(path, target)

    print(f"site: {plural(len(posts), 'post')}, {plural(len(tags), 'tag')}, "
          f"{plural(len(projects), 'project')}, {plural(len(books), 'book')} → dist/ (v={site.v})")
    for s in series.values():
        print(f"  {s['slug']}: {progress(s)}")


if __name__ == "__main__":
    try:
        main()
    except BuildError as err:
        sys.exit(f"build: {err}")
