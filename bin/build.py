#!/usr/bin/env python3
"""Build the site into dist/: one man page and the posts.

  /                    HUGO(1): name, experience, projects, writing, contact
  /writing/<slug>/     one page per post
  /feed.xml            Atom feed of the posts
  /404.html            "No manual entry for ..."
  /sitemap.xml, /robots.txt, /version.txt

Reads   content/site.json     every word on the home page
        posts/*.md            published posts (front matter + Markdown)
        drafts/*.md           unpublished posts, only with --drafts (git-ignored)
        templates/*.html      base (head, sticky bar, footer), home, post
Writes  dist/

Usage   python3 bin/build.py              build once
        python3 bin/build.py --drafts     include drafts/ (local preview)
        python3 bin/build.py --watch      rebuild whenever a source file changes

Standard library only, so it runs anywhere and the Docker build needs no
pip install. Bad input (a malformed date, an unknown front matter field)
fails the build instead of silently going live.
"""

import base64
import hashlib
import html
import json
import os
import re
import shutil
import sys
import time
import traceback
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "templates"
CONTENT = ROOT / "content"
POSTS = ROOT / "posts"
DRAFTS = ROOT / "drafts"
DIST = ROOT / "dist"
STAGE = ROOT / ".dist-stage"   # a build renders here first; dist/ only changes if it succeeds
OUT = STAGE
SITE_URL = "https://www.hugokatzer.tech"

STATIC_FILES = ("styles.css", "app.js")
STATIC_DIRS = ("fonts", "pdfs")
WATCHED = ("content", "posts", "drafts", "templates", "styles.css", "app.js", "bin/build.py")
SLUG = r"[a-z0-9]+(-[a-z0-9]+)*"
POST_FIELDS = {"date", "title", "tags", "summary"}
WPM = 200

# Runs before first paint: the saved theme (no flash of the wrong palette)
# and the .js flag.
# Its hash goes into the CSP, so any edit here is picked up automatically.
PREPAINT = ('(function(){var d=document.documentElement,t;d.classList.add("js");'
            'try{t=localStorage.getItem("hsk.theme")}catch(e){}'
            'if(t==="light"||t==="dark")d.dataset.theme=t;})();')

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E"
           "%3Crect width='16' height='16' fill='%231B1B1A'/%3E%3Ctext x='8' y='12.5' "
           "font-family='monospace' font-size='13' font-weight='700' text-anchor='middle' "
           "fill='%23F6F5F1'%3Eh%3C/text%3E%3C/svg%3E")


class BuildError(Exception):
    pass


def esc(s):
    return html.escape(str(s), quote=True)


# --------------------------------------------------------------- front matter

def _scalar(v):
    v = v.strip()
    if " #" in v:  # trailing comment
        v = v[: v.index(" #")].rstrip()
    if len(v)>= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    if v.startswith("[") and v.endswith("]"):
        return [_scalar(x) for x in v[1:-1].split(",") if x.strip()]
    return v


def parse_front_matter(text, name):
    """A small YAML subset: `key: value`, `key: [a, b]` and block lists of
    scalars. Enough for a post header."""
    if not text.startswith("---"):
        raise BuildError(f"{name}: must start with a '---' front matter block")
    end = text.find("\n---", 3)
    if end < 0:
        raise BuildError(f"{name}: front matter is not closed with '---'")
    head, body = text[3:end], text[end + 4:].lstrip("\n")
    meta, key = {}, None
    for n, raw in enumerate(head.splitlines(), 2):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.strip()
        if raw[0] not in " \t":
            if ":" not in line:
                raise BuildError(f"{name}:{n}: expected 'key: value'")
            key, val = (x.strip() for x in line.split(":", 1))
            meta[key] = _scalar(val) if val else []
        elif line.startswith("- ") and key is not None and isinstance(meta.get(key), list):
            meta[key].append(_scalar(line[2:]))
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
    bold/italic, links and images. The post title is the only h1, so `#` and
    `##` both become h2. A quote that starts with `NOTE:` (or WARNING:/TIP:)
    becomes a callout box. A block starting with `<` is passed through as
    raw HTML."""
    out, para, lines, i = [], [], text.splitlines(), 0

    def flush():
        if para:
            out.append("<p>" + _inline(" ".join(para)) + "</p>")
            para.clear()

    while i < len(lines):
        s = lines[i].strip()
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
            block = []
            while i < len(lines) and lines[i].strip():
                block.append(lines[i])
                i += 1
            out.append("\n".join(block))
            continue
        elif re.match(r"^#{1,4}\s", s):
            flush()
            level = min(max(len(s) - len(s.lstrip("#")), 2), 4)
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
            m = re.match(r"^(NOTE|WARNING|TIP):?\s*", quote[0]) if quote else None
            if m:
                quote[0] = quote[0][m.end():]
                out.append(f'<aside class="note"><span class="note-h">{m.group(1)}</span>'
                           + markdown("\n".join(quote)) + "</aside>")
            else:
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


def heading_ids(body):
    """Give every h2-h4 an id, so sections can be linked and jumped to."""
    seen = set()

    def add(m):
        base = re.sub(r"[^a-z0-9]+", "-", re.sub(r"<[^>]+>", "", html.unescape(m.group(2))).lower()).strip("-") or "section"
        hid, n = base, 2
        while hid in seen:
            hid, n = f"{base}-{n}", n + 1
        seen.add(hid)
        return f'<h{m.group(1)} id="{hid}">{m.group(2)}</h{m.group(1)}>'
    return re.sub(r"<h([2-4])>(.*?)</h\1>", add, body)


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


def plural(n, word):
    return f"{n} {word if n == 1 else word + 's'}"


# ---------------------------------------------------------------------- model

def load_site():
    path = CONTENT / "site.json"
    try:
        site = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise BuildError(f"content/site.json: {e}")
    for field in ("page", "domain", "handle", "name", "tagline", "degrees", "description", "nav",
                  "experience", "otherWork", "education", "skills", "certifications",
                  "languages", "awards", "cvPdf", "projects", "writingShown", "links"):
        if field not in site:
            raise BuildError(f"content/site.json: missing '{field}' (an empty list is fine)")
    for key in ("experience", "otherWork", "education"):
        for e in site[key]:
            for field in ("dates", "org"):
                if not e.get(field):
                    raise BuildError(f"content/site.json: an entry in '{key}' is missing '{field}'")
    for key in ("skills", "certifications", "languages", "awards"):
        for e in site[key]:
            if not e.get("term") or not e.get("desc"):
                raise BuildError(f"content/site.json: an entry in '{key}' needs 'term' and 'desc'")
    for p in site["projects"]:
        for field in ("name", "desc", "state"):
            if not p.get(field):
                raise BuildError(f"content/site.json: a project is missing '{field}'")
    return site


def load_posts(include_drafts=False):
    files = [(p, False) for p in sorted(POSTS.glob("*.md"))]
    if include_drafts and DRAFTS.is_dir():
        files += [(p, True) for p in sorted(DRAFTS.glob("*.md"))]
    posts, problems = [], []
    for path, draft in files:
        if path.name.startswith("_") or path.name == "README.md":
            continue
        name = str(path.relative_to(ROOT))
        try:
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"), name)
            unknown = set(meta) - POST_FIELDS
            if unknown:
                raise BuildError(f"{name}: unknown field(s) {', '.join(sorted(unknown))} "
                                 f"(allowed: {', '.join(sorted(POST_FIELDS))})")
            for field in ("date", "title"):
                if not meta.get(field):
                    raise BuildError(f"{name}: missing '{field}'")
            slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", path.stem.lower())
            if not re.fullmatch(SLUG, slug):
                raise BuildError(f"{name}: file name must be lowercase words joined by '-'")
            tags = meta.get("tags") or []
            tags = [tags] if isinstance(tags, str) else list(dict.fromkeys(tags))
            bad = [t for t in tags if not re.fullmatch(SLUG, t)]
            if bad:
                raise BuildError(f"{name}: tags must be lowercase words joined by '-': {', '.join(bad)}")
            body_html = heading_ids(markdown(body))
            posts.append({
                "slug": slug, "file": name, "date": iso_date(meta["date"], name),
                "title": str(meta["title"]), "tags": tags, "draft": draft,
                "body": body_html, "words": words(body_html),
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
    return posts


# ---------------------------------------------------------------------- pages

class Site:
    def __init__(self, site):
        self.site = site
        self.base = (TEMPLATES / "base.html").read_text(encoding="utf-8")
        digest = hashlib.sha1()
        for f in STATIC_FILES:
            digest.update((ROOT / f).read_bytes())
        self.v = digest.hexdigest()[:8]
        sha = base64.b64encode(hashlib.sha256(PREPAINT.encode()).digest()).decode()
        self.csp = (f"default-src 'self'; script-src 'self' 'sha256-{sha}'; style-src 'self'; "
                    "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
                    "base-uri 'self'; form-action 'none'")

    def page(self, path, title, description, main, section, nav_prefix, body_class,
             og_type="article", root=None):
        """Write dist/<path>. `root` is the path back to the site root
        (relative by default; "/" for pages served at any URL, like 404)."""
        if root is None:
            root = "../" * path.count("/")
        url = SITE_URL + "/" + (path[: -len("index.html")] if path.endswith("index.html") else path)
        nav = "".join(f'<a href="{nav_prefix}#{n["id"]}" data-target="{n["id"]}">{esc(n["label"])}</a>'
                      for n in self.site["nav"])
        out = fill(self.base, {
            "root": root, "title": esc(title), "description": esc(description), "url": esc(url),
            "og_type": og_type, "icon": FAVICON, "csp": self.csp, "prepaint": PREPAINT,
            "v": self.v, "page": esc(self.site["page"]), "section": esc(section), "nav": nav,
            "main": main, "body_class": body_class, "domain": esc(self.site["domain"]),
            "updated": date.today().isoformat(), "home": root or "./",
        }, f"{path} (templates/base.html)")
        target = OUT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(out, encoding="utf-8")



def entries(items):
    """Dated entries (jobs, schooling): `dates  org  role`, an optional dim
    note, bullet points, and optional nested roles (several roles at one org)."""
    out = []

    def points(e):
        ps = e.get("points") or []
        return f'<ul class="dash">{"".join(f"<li>{esc(p)}</li>" for p in ps)}</ul>' if ps else ""

    for j, e in enumerate(items, 1):
        note = f'<p class="entry-note dim">{esc(e["note"])}</p>' if e.get("note") else ""
        roles = "".join(
            f'<div class="role"><div class="entry-head"><span class="when dim">{esc(r["dates"])}</span>'
            f'<span>{esc(r["role"])}</span></div>{points(r)}</div>'
            for r in e.get("roles") or [])
        role = f'<span>{esc(e["role"])}</span>' if e.get("role") else ""
        out.append(f'<div class="entry"><div class="entry-head"><span class="when dim">{esc(e["dates"])}</span>'
                   f'<b>{esc(e["org"])}</b>{role}</div>{note}{points(e)}{roles}</div>')
    return "\n".join(out)


def pairs(items):
    """`term  description` rows, like the OPTIONS list of a man page."""
    return "\n".join(
        f'<div class="row kv"><b>{esc(e["term"])}</b><span>{esc(e["desc"])}'
        + (f' <span class="dim">{esc(e["note"])}</span>' if e.get("note") else "")
        + "</span></div>"
        for j, e in enumerate(items, 1))


def build_home(s, posts):
    site = s.site
    description = "\n".join(f'<p class="man-body measure">{esc(d)}</p>'
                            for j, d in enumerate(site["description"], 1))
    experience = entries(site["experience"]) + (
        f'\n<div><a href="{esc(site["cvPdf"])}">cv.pdf</a> '
        '<span class="dim">this CV as a PDF</span></div>')

    projects = []
    for j, p in enumerate(site["projects"], 1):
        name = esc(p["name"]) + "/"
        name = f'<a href="{esc(p["href"])}">{name}</a>' if p.get("href") else f"<span>{name}</span>"
        state = f' <span class="dim">[{esc(p["state"])}]</span>' if p["state"] != "active" else ""
        projects.append(f'<div class="row kv">{name}<span>{esc(p["desc"])}{state}</span></div>')

    shown = site["writingShown"]
    rows = []
    for j, p in enumerate(posts, 1):
        more = " more" if j > shown else ""
        draft = ' <span class="dim">[draft]</span>' if p["draft"] else ""
        rows.append(f'<div class="row post{more}"><time class="dim" datetime="{p["date"].isoformat()}">'
                    f'{p["date"].isoformat()}</time><span><a href="writing/{p["slug"]}/">{esc(p["title"])}</a>{draft}</span>'
                    f'<span class="dim tags">{esc(" ".join(p["tags"]))}</span></div>')
    if not rows:
        rows.append(f'<p class="dim">Nothing yet. Soon.</p>')
    toggle = ""
    if len(posts) > shown:
        toggle = (f'<button type="button" class="btn" id="writing-toggle" hidden aria-expanded="false" '
                  f'aria-controls="writing-list" aria-label="Show all {len(posts)} posts" '
                  f'data-less="Show latest {shown}">[<b>--all</b>]</button>')

    links = "".join(f'<a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in site["links"])
    main = fill((TEMPLATES / "home.html").read_text(encoding="utf-8"), {
        "handle": esc(site["handle"]), "name": esc(site["name"]), "tagline": esc(site["tagline"]), "degrees": esc(site["degrees"]),
        "description": description, "experience": experience,
        "other_work": entries(site["otherWork"]), "education": entries(site["education"]),
        "skills": pairs(site["skills"]), "certifications": pairs(site["certifications"]),
        "languages": pairs(site["languages"]), "awards": pairs(site["awards"]),
        "projects": "\n".join(projects), "posts": "\n".join(rows), "toggle": toggle,
        "links": links,
    }, "templates/home.html")
    s.page("index.html", f"{site['name']} — {site['handle']}(1)",
           f"{site['name']}: {site['tagline']} CV, projects and writing.", main,
           "Personal Manual", "", "home",
           og_type="website")


def build_post(s, p, newer, older):
    meta = [p["date"].isoformat(), f'{max(1, round(p["words"] / WPM))} min read']
    if p["tags"]:
        meta.append("tags: " + ", ".join(p["tags"]))
    if p["draft"]:
        meta.append("[draft]")
    left = (f'<a href="../{older["slug"]}/" rel="prev">← {esc(older["title"])}</a>' if older
            else '<a href="../../">← ~</a>')
    right = f'<a href="../{newer["slug"]}/" rel="next">{esc(newer["title"])} →</a>' if newer else "<span></span>"
    main = fill((TEMPLATES / "post.html").read_text(encoding="utf-8"), {
        "title": esc(p["title"]), "meta": esc(" · ".join(meta)), "body": p["body"],
        "left": left, "right": right,
    }, "templates/post.html")
    s.page(f"writing/{p['slug']}/index.html", f"{p['title']} — {s.site['handle']}(1)",
           p["summary"] or p["title"], main, "writing", "../../", "post")


def build_404(s):
    main = '''<section class="man-sec" id="name">
<h2 class="man-h" tabindex="-1">NAME</h2>
<p class="man-body">No manual entry for <code id="missing">this page</code>.</p>
</section>
<section class="man-sec" id="see-also">
<h2 class="man-h" tabindex="-1">SEE ALSO</h2>
<p class="man-body"><a href="/">hugo(1)</a>, the front page: everything on this site is linked from there.</p>
</section>'''
    s.page("404.html", f"No manual entry — {s.site['handle']}(1)", "Page not found.", main,
           "404", "/", "home", root="/")


def build_feed(posts, site):
    def stamp(d):
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    entries = []
    for p in posts[:30]:
        url = f"{SITE_URL}/writing/{p['slug']}/"
        # Relative links in the body would break in a feed reader: make them absolute.
        body = re.sub(r'(href|src)="(?!https?:|mailto:|#)(?:\.\./)*([^"]*)"',
                      lambda m: f'{m.group(1)}="{SITE_URL}/{m.group(2)}"', p["body"])
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
    (OUT / "feed.xml").write_text(f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>{esc(site['name'])}</title>
  <subtitle>{esc(site['tagline'])}</subtitle>
  <link href="{SITE_URL}/feed.xml" rel="self"/>
  <link href="{SITE_URL}/"/>
  <id>{SITE_URL}/</id>
  <updated>{updated}</updated>
  <author><name>{esc(site['name'])}</name></author>
{chr(10).join(entries)}
</feed>
""", encoding="utf-8")


def build_meta(posts):
    urls = [(f"{SITE_URL}/", posts[0]["date"] if posts else date.today())]
    urls += [(f"{SITE_URL}/writing/{p['slug']}/", p["date"]) for p in posts]
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc><lastmod>{d.isoformat()}</lastmod></url>\n" for u, d in urls)
        + "</urlset>\n", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n",
                                     encoding="utf-8")
    (OUT / "version.txt").write_text(os.environ.get("GIT_SHA", "dev") + "\n", encoding="utf-8")


# ----------------------------------------------------------------------- main

def clean_dist():
    """Empty dist/ but keep the directory: the dev container bind-mounts it."""
    DIST.mkdir(exist_ok=True)
    for child in DIST.iterdir():
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()


def build(include_drafts=False):
    """Render everything into .dist-stage/, then swap it into dist/. A build
    that fails half-way leaves the last good dist/ alone, so the preview
    never goes blank."""
    site = load_site()
    posts = load_posts(include_drafts)
    s = Site(site)
    shutil.rmtree(STAGE, ignore_errors=True)
    STAGE.mkdir()
    try:
        for f in STATIC_FILES:
            shutil.copy2(ROOT / f, OUT / f)
        for d in STATIC_DIRS:
            shutil.copytree(ROOT / d, OUT / d)
        build_home(s, posts)
        for i, p in enumerate(posts):
            build_post(s, p, posts[i - 1] if i else None, posts[i + 1] if i + 1 < len(posts) else None)
        build_404(s)
        published = [p for p in posts if not p["draft"]]
        build_feed(published, site)
        build_meta(published)
        clean_dist()
        for child in STAGE.iterdir():
            shutil.move(str(child), DIST / child.name)
    finally:
        shutil.rmtree(STAGE, ignore_errors=True)
    drafts = sum(p["draft"] for p in posts)
    extra = f" (+{plural(drafts, 'draft')})" if drafts else ""
    print(f"site: {plural(len(posts) - drafts, 'post')}{extra} → dist/ (v={s.v})")


def snapshot():
    stamps = {}
    for w in WATCHED:
        p = ROOT / w
        for f in ([p] if p.is_file() else p.rglob("*") if p.is_dir() else []):
            if f.is_file():
                stamps[str(f)] = f.stat().st_mtime
    return stamps


def watch(include_drafts):
    print("watching for changes; ctrl-c to stop")
    me = Path(__file__).resolve()
    started = me.stat().st_mtime
    last = None
    while True:
        try:
            changed = me.stat().st_mtime != started
        except FileNotFoundError:   # mid branch switch: wait for it to come back
            time.sleep(0.5)
            continue
        if changed:
            # build.py itself changed: restart, so the new code is what runs.
            print("bin/build.py changed; restarting the watcher")
            os.execv(sys.executable, [sys.executable, str(me)] + sys.argv[1:])
        now = snapshot()
        if now != last:
            last = now
            try:
                build(include_drafts)
            except BuildError as err:
                print(f"build: {err} (dist/ unchanged)", file=sys.stderr)
            except Exception:   # a bug mid-edit shouldn't kill the preview
                traceback.print_exc()
                print("build: crashed (dist/ unchanged); fix it and save again", file=sys.stderr)
        time.sleep(0.5)


def main(argv):
    sys.stdout.reconfigure(line_buffering=True)   # show progress at once, even when piped
    unknown = set(argv) - {"--drafts", "--watch"}
    if unknown:
        sys.exit(f"build: unknown option(s) {' '.join(sorted(unknown))}; see the docstring")
    if "--watch" in argv:
        try:
            watch("--drafts" in argv)
        except KeyboardInterrupt:
            print()
        return
    build("--drafts" in argv)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except BuildError as err:
        sys.exit(f"build: {err}")
