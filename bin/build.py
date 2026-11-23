#!/usr/bin/env python3
"""Build the whole site into dist/.

Reads   templates/shell.html       head, header and scripts shared by every page
        templates/home.html        the homepage body (timeline is hand-written there)
        content/groups.json        the project groups, in order
        content/projects/*.md      one page per project (front matter + Markdown or HTML)
        tracks/<slug>/track.json   a track: objectives or milestones, species, structure
        tracks/<slug>/entries/*.md the track's writeups
Writes  dist/                      the deployable site, static files copied in
        tracks/<slug>/README.md    the track's objective ids, for writing entries

A project is a single page. A track is a project that keeps a log: each
objective is a tree of the track's species, felled ones become logs, and the
logs go into the track's structure. All of them share ~/projects.

Standard library only, so `python3 bin/build.py` works anywhere and the
Docker build stage needs no pip install. Fails loudly on bad input (unknown
objective id, bad date, unknown species) instead of silently going live.
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
# Old URLs that must keep working: path in dist -> target, relative to the site root.
REDIRECTS = {"log/index.html": "projects/rhcsa/index.html"}

# Must match what pixel.js can draw (SPECIES / STRUCTURES there).
SPECIES = ("oak", "pine", "birch")
STRUCTURES = ("cabin", "woodpile")
# A project's life, and an objective's: both drawn as a tree (STATUS_GLYPH in pixel.js).
PROJECT_STATES = ("active", "complete", "abandoned", "discontinued", "limbo")
OBJ_STATES = ("todo", "practising", "done")


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



def pl_attr(text):
    """data-pl carries the Polish text; app.js swaps it in when PL is on."""
    return f' data-pl="{esc(text)}"' if text else ""


def tr(obj, field, name):
    """A translated field: {"en": ..., "pl": ...} (pl optional) or a plain string."""
    v = obj.get(field)
    if isinstance(v, str):
        v = {"en": v}
    if not isinstance(v, dict) or not v.get("en"):
        raise BuildError(f"{name}: '{field}' needs at least an 'en' text")
    return v["en"], v.get("pl", "")


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


# ---------------------------------------------------------------------- model

def load_groups():
    groups = json.loads((CONTENT / "groups.json").read_text(encoding="utf-8"))
    return {g["id"]: dict(g, index=i) for i, g in enumerate(groups)}


def check_place(meta, groups, name):
    if meta.get("group") not in groups:
        raise BuildError(f"{name}: group must be one of {', '.join(groups)}, got {meta.get('group')!r}")
    try:
        meta["order"] = int(meta.get("order", 99))
    except (TypeError, ValueError):
        raise BuildError(f"{name}: order must be a number")
    if meta.get("status") not in PROJECT_STATES:
        raise BuildError(f"{name}: status must be one of {', '.join(PROJECT_STATES)}")


def load_projects(groups):
    out, problems = [], []
    for path in sorted((CONTENT / "projects").glob("*.md")):
        name = str(path.relative_to(ROOT))
        try:
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"), name)
            for field in ("title", "summary", "date"):
                if not meta.get(field):
                    raise BuildError(f"{name}: missing '{field}'")
            check_place(meta, groups, name)
            fmt = meta.get("format", "md")
            if fmt not in ("md", "html"):
                raise BuildError(f"{name}: format must be md or html")
            out.append({
                "kind": "project", "slug": path.stem, "name": meta.get("name") or path.stem,
                "title": meta["title"], "group": meta["group"], "order": meta["order"],
                "status": meta["status"], "date": iso_date(meta["date"], name),
                "summary": meta["summary"], "summary_pl": meta.get("summary_pl", ""),
                "description": meta.get("description") or meta["summary"],
                "body": body if fmt == "html" else markdown(body),
            })
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    return out


def load_entries(tdir, by_id):
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
            for field in ("practised", "passed"):
                ids = meta.get(field) or []
                if isinstance(ids, str):
                    ids = [ids]
                unknown = [x for x in ids if x not in by_id]
                if unknown:
                    raise BuildError(f"{name}: unknown objective id(s) in '{field}': {', '.join(unknown)}"
                                     f" (see {tdir.relative_to(ROOT)}/README.md for the list)")
                lists[field] = list(dict.fromkeys(ids))
            scripts = []
            for s in meta.get("scripts") or []:
                s = s if isinstance(s, dict) else {"name": s}
                if not s.get("name"):
                    raise BuildError(f"{name}: every script needs a 'name'")
                scripts.append(s)
            slug = re.sub(r"[^a-z0-9-]+", "-", path.stem.lower()).strip("-")
            if slug == "index":
                raise BuildError(f"{name}: 'index' is reserved for the track page")
            entries.append({
                "slug": slug, "date": when, "title": str(meta["title"]),
                "chapter": str(meta.get("chapter") or ""),
                "practised": lists["practised"], "passed": lists["passed"],
                "scripts": scripts, "body": body,
                "summary": str(meta.get("summary") or plain_summary(body)),
            })
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    slugs = [e["slug"] for e in entries]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        raise BuildError(f"{tdir.name}: duplicate entry slugs: " + ", ".join(sorted(dupes)))
    entries.sort(key=lambda e: (e["date"], e["slug"]), reverse=True)
    return entries


def load_track(tdir, groups):
    name = str((tdir / "track.json").relative_to(ROOT))
    try:
        t = json.loads((tdir / "track.json").read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise BuildError(f"{name}: {e}")
    for field in ("title", "groups"):
        if not t.get(field):
            raise BuildError(f"{name}: missing '{field}'")
    check_place(t, groups, name)
    if t.get("species") not in SPECIES:
        raise BuildError(f"{name}: species must be one of {', '.join(SPECIES)}")
    if t.get("structure") not in STRUCTURES:
        raise BuildError(f"{name}: structure must be one of {', '.join(STRUCTURES)}")
    summary, summary_pl = tr(t, "summary", name)
    by_id = {}
    for g in t["groups"]:
        for o in g["objectives"]:
            if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", o["id"]):
                raise BuildError(f"{name}: objective id {o['id']!r} must be lowercase words joined by '-'")
            if o["id"] in by_id:
                raise BuildError(f"{name}: duplicate objective id {o['id']!r}")
            o["group"] = g["name"]
            by_id[o["id"]] = o
    entries = load_entries(tdir, by_id)
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
    return dict(t, kind="track", slug=tdir.name, name=t.get("name") or tdir.name, tdir=tdir,
                summary=summary, summary_pl=summary_pl, by_id=by_id, entries=entries,
                state=state, counts=counts, finished=bool(t.get("finished")),
                n_scripts=len({s["name"] for e in entries for s in e["scripts"]}))


def load_tracks(groups):
    tracks, problems = [], []
    for tdir in sorted(p.parent for p in TRACKS.glob("*/track.json")):
        try:
            tracks.append(load_track(tdir, groups))
        except BuildError as e:
            problems.append(str(e))
    if problems:
        raise BuildError("\n".join(problems))
    return tracks


# ---------------------------------------------------------------------- pages

GLYPH = {"todo": "tree", "practising": "gnawed", "done": "log"}


class Site:
    def __init__(self):
        self.shell = (TEMPLATES / "shell.html").read_text(encoding="utf-8")
        digest = hashlib.sha1()
        for f in STATIC_FILES:
            digest.update((ROOT / f).read_bytes())
        self.v = digest.hexdigest()[:8]

    def page(self, path, title, description, main, og_type="article", head="",
             body_class="", scripts=""):
        """Write dist/<path>. Links inside `main` are relative to that page."""
        depth = path.count("/")
        root = "../" * depth
        url = SITE + "/" + (path[: -len("index.html")] if path.endswith("index.html") else path)
        if scripts:
            scripts = "".join(f'<script src="{root}{s}?v={self.v}"></script>\n' for s in scripts)
        out = fill(self.shell, {
            "root": root, "home": "" if path == "index.html" else root + "index.html",
            "title": esc(title), "description": esc(description), "url": esc(url),
            "og_type": og_type, "head": head + "\n" if head else "",
            "body_class": f' class="{body_class}"' if body_class else "",
            "main": main, "scripts": scripts, "v": self.v,
        }, f"{path} (templates/shell.html)")
        target = DIST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(out, encoding="utf-8")


def href(item, prefix=""):
    """Where an item lives, relative to projects/."""
    return prefix + (f"{item['slug']}/index.html" if item["kind"] == "track" else f"{item['slug']}.html")


def proj_nav(items, item, prefix):
    i = items.index(item)
    out = [f'<a href="{prefix}../index.html#projects">&larr; <span data-i18n="back">back to projects</span></a>',
           '<span class="grow"></span>']
    if i > 0:
        out.append(f'<a href="{href(items[i - 1], prefix)}">&larr; {esc(items[i - 1]["name"])}</a>')
    if i + 1 < len(items):
        out.append(f'<a href="{href(items[i + 1], prefix)}">{esc(items[i + 1]["name"])} &rarr;</a>')
    return '  <nav class="proj-nav">\n    ' + "\n    ".join(out) + "\n  </nav>"


def build_project(site, items, p):
    main = f'''  <div class="crumbs">$ cd <a href="../index.html#projects">~/projects</a>/{esc(p["name"])}</div>

  <section class="section section--proj">
    <h1 class="name name--proj">{esc(p["title"])}</h1>
    <p class="proj-sum"{pl_attr(p["summary_pl"])}>{esc(p["summary"])}</p>
    <div class="proj-meta">
      <span class="status" data-status="{p["status"]}">{p["status"]}</span>
      <span>{p["date"].isoformat()}</span>
    </div>
  </section>

  <article class="section prose">
{p["body"].rstrip()}
  </article>

{proj_nav(items, p, "")}'''
    site.page(f"projects/{p['slug']}.html", f"{p['title']} — {OWNER}", p["description"], main)


def pass_order(t):
    """Passed objectives in the order they were first passed, with the date:
    the structure on the track page is built from them, one piece each."""
    seen, out = set(), []
    for e in sorted(t["entries"], key=lambda e: (e["date"], e["slug"])):
        for oid in e["passed"]:
            if oid not in seen:
                seen.add(oid)
                out.append({"id": oid, "text": t["by_id"][oid]["text"], "date": e["date"].isoformat()})
    return out


def scene_attrs(t):
    """Everything pixel.js needs to draw a track's build."""
    logs = esc(json.dumps(pass_order(t), ensure_ascii=False, separators=(",", ":")))
    c = t["counts"]
    return (f'data-species="{t["species"]}" data-structure="{t["structure"]}" '
            f'data-done="{c["done"]}" data-total="{c["total"]}" '
            f'data-hat="{"1" if t["finished"] else "0"}" data-logs="{logs}"')


def build_track(site, items, t):
    state, counts, entries, slug = t["state"], t["counts"], t["entries"], t["slug"]
    intro, intro_pl = tr(t, "intro", slug)
    legend, legend_pl = tr(t, "legend", slug)
    groves = []
    for g in t["groups"]:
        objs = g["objectives"]
        done = sum(state[o["id"]] == "done" for o in objs)
        prac = sum(state[o["id"]] == "practising" for o in objs)
        trees = "".join(
            f'<button type="button" class="obj" data-obj="{o["id"]}" data-state="{state[o["id"]]}" '
            f'data-text="{esc(o["text"])}" '
            f'aria-label="{esc(o["text"])} — {state[o["id"]]}" title="{esc(o["text"])}">'
            f'<span class="obj-fallback">{state[o["id"]][0]}</span></button>'
            for o in objs)
        groves.append(
            f'<div class="grove">\n'
            f'  <div class="row-line"><span class="label">{esc(g["name"])}</span>'
            f'<span class="rule rule--dotted"></span>'
            f'<span class="meta">{prac} practising</span><span class="when">{done}/{len(objs)}</span></div>\n'
            f'  <div class="grove-trees">{trees}</div>\n</div>')

    rows = []
    for e in entries:
        objs = sorted(set(e["practised"]) | set(e["passed"]))
        chapter = f'<span class="wu-chapter">{esc(e["chapter"])}</span>' if e["chapter"] else ""
        n_s = len(e["scripts"])
        summary = f'<span class="wu-sum">{esc(e["summary"])}</span>' if e["summary"] else ""
        rows.append(
            f'<a class="wu" href="{e["slug"]}.html" data-objs="{" ".join(objs)}">'
            f'<span class="wu-head"><span class="wu-date">{e["date"].isoformat()}</span>{chapter}</span>'
            f'<span class="wu-title">{esc(e["title"])}</span>'
            f'{summary}'
            f'<span class="wu-foot"><span class="wu-meta">{len(objs)} obj · {n_s} script{"s" if n_s != 1 else ""}</span>'
            f'<span class="wu-go"><span data-i18n="tr_read">read</span> &rarr;</span></span>'
            f'</a>')

    source = ""
    if t.get("source"):
        s_en, s_pl = tr(t, "source", slug)
        source = f' <a href="{esc(t["source"]["url"])}"{pl_attr(s_pl)}>{esc(s_en)}</a>'
    label = f' · {esc(t["label"])}' if t.get("label") else ""

    main = f'''  <div class="crumbs">$ cd <a href="../../index.html#projects">~/projects</a>/{esc(t["name"])}</div>

  <section class="section section--proj">
    <h1 class="name name--proj">{esc(t["title"])}</h1>
    <p class="proj-sum"{pl_attr(intro_pl)}>{esc(intro)}</p>
    <div class="build-scene" id="build-scene" {scene_attrs(t)}></div>
  </section>

  <section class="section" id="objectives">
    <div class="sec-head">
      <span class="prompt">$ ls ~/projects/{esc(t["name"])}/objectives</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{counts["total"]}{label}</span>
    </div>
    <p class="legend"><span{pl_attr(legend_pl)}>{esc(legend)}</span>{source}</p>
    <div class="groves" data-species="{t["species"]}">
{chr(10).join(groves)}
    </div>
    <div class="obj-detail" id="obj-detail" hidden>
      <span class="obj-detail-text" id="obj-detail-text"></span>
      <button type="button" class="theme-toggle" id="obj-clear" data-i18n="tr_clear">[clear filter]</button>
    </div>
  </section>

  <section class="section" id="writeups">
    <div class="sec-head">
      <span class="prompt">$ ls -t ~/projects/{esc(t["name"])}/writeups</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{len(entries)}</span>
    </div>
    <div class="wus" id="wus">
{chr(10).join(rows)}
    </div>
    <p class="wu-empty" id="wu-empty"{"" if not entries else " hidden"} data-i18n="{"tr_none" if not entries else "tr_nomatch"}">{"No writeups yet." if not entries else "No writeup covers this objective yet."}</p>
  </section>

{proj_nav(items, t, "../")}'''
    desc = (f"{t['title']}{' (' + t['label'] + ')' if t.get('label') else ''}: "
            f"{counts['done']} of {counts['total']} objectives done, {counts['practising']} practising, "
            f"{t['n_scripts']} scripts, {len(entries)} writeups.")
    site.page(f"projects/{slug}/index.html", f"{t['title']} — {OWNER}", desc, main, scripts=["track.js"])

    for i, e in enumerate(entries):
        newer = entries[i - 1] if i > 0 else None
        older = entries[i + 1] if i + 1 < len(entries) else None
        build_entry(site, t, e, newer, older)


def build_entry(site, t, e, newer, older):
    by_id, state = t["by_id"], t["state"]

    def obj_list(ids, heading):
        if not ids:
            return ""
        items = "".join(
            f'<li><a href="index.html#obj={oid}"><span class="obj-inline" data-glyph="{GLYPH[state[oid]]}"></span>'
            f'{esc(by_id[oid]["text"])}</a> <span class="dim">· {esc(by_id[oid]["group"])}</span></li>'
            for oid in ids)
        return f'{heading}\n<ul class="objs">{items}</ul>'

    scripts = ""
    if e["scripts"]:
        items = []
        for s in e["scripts"]:
            name = f'<code>{esc(s["name"])}</code>'
            if s.get("url"):
                name = f'<a href="{esc(s["url"])}">{name}</a>'
            what = f' — {esc(s["what"])}' if s.get("what") else ""
            items.append(f"<li>{name}{what}</li>")
        scripts = '<h2 data-i18n="tr_scripts">Scripts</h2>\n<ul>' + "".join(items) + "</ul>"

    p_en, p_pl = tr(t, "passed_label", t["slug"]) if t.get("passed_label") else ("Done", "Zrobione")
    nav = [f'<a href="index.html">&larr; {esc(t["name"])}</a>', '<span class="grow"></span>']
    if older:
        nav.append(f'<a href="{older["slug"]}.html">&larr; {older["date"].isoformat()}</a>')
    if newer:
        nav.append(f'<a href="{newer["slug"]}.html">{newer["date"].isoformat()} &rarr;</a>')

    chapter = f'<span>{esc(e["chapter"])}</span>' if e["chapter"] else ""
    main = f'''  <div class="crumbs">$ cd <a href="../../index.html#projects">~/projects</a>/<a href="index.html">{esc(t["name"])}</a>/{e["slug"]}</div>

  <section class="section section--proj">
    <h1 class="name name--proj">{esc(e["title"])}</h1>
    <div class="proj-meta">
      <span>{e["date"].isoformat()}</span>
      {chapter}
      <span>{len(e["practised"])} practised · {len(e["passed"])} passed · {len(e["scripts"])} scripts</span>
    </div>
  </section>

  <article class="section prose">
{markdown(e["body"])}
{scripts}
{obj_list(e["practised"], '<h2 data-i18n="tr_practised">Objectives practised</h2>')}
{obj_list(e["passed"], f'<h2{pl_attr(p_pl)}>{esc(p_en)}</h2>')}
  </article>

  <nav class="proj-nav">
    {" ".join(nav)}
  </nav>'''
    desc = e["summary"] or f"{t['title']} writeup, {e['date'].isoformat()}."
    site.page(f"projects/{t['slug']}/{e['slug']}.html", f"{e['title']} — {t['title']}", desc, main,
              scripts=["track.js"])


def card(item):
    if item["kind"] == "track":
        c = item["counts"]
        foot = f'<span class="card-foot">{c["done"]}/{c["total"]}</span>'
    else:
        foot = ""
    return (f'      <a class="card" href="{href(item, "projects/")}">\n'
            f'        <div class="card-slug"><span class="status" data-status="{item["status"]}"'
            f' title="{item["status"]}"></span>{esc(item["name"])}/{foot}</div>\n'
            f'        <div class="card-desc"{pl_attr(item["summary_pl"])}>{esc(item["summary"])}</div>\n'
            f'      </a>')


def clearing(tracks):
    """Every track's build side by side at the top of ~/projects."""
    plots = []
    for t in tracks:
        c = t["counts"]
        plots.append(
            f'      <a class="plot" href="{href(t, "projects/")}" title="{esc(t["title"])}">\n'
            f'        <span class="plot-scene" {scene_attrs(t)}></span>\n'
            f'        <span class="plot-name">{esc(t["name"])}/ <span class="dim">{c["done"]}/{c["total"]}</span></span>\n'
            f'      </a>')
    return '      <div class="clearing">\n' + "\n".join(plots) + "\n      </div>" if plots else ""


def build_home(site, groups, items):
    meta, body = parse_front_matter((TEMPLATES / "home.html").read_text(encoding="utf-8"), "templates/home.html")
    tracks = [i for i in items if i["kind"] == "track"]
    active = [t for t in tracks if t["status"] == "active"] or tracks
    out = [clearing(tracks)] if tracks else []
    for g in groups.values():
        members = [i for i in items if i["group"] == g["id"]]
        if not members:
            continue
        out.append(f'      <div class="group-head"><span class="group-name">{g["id"]}/</span>'
                   f'<span class="rule rule--dotted"></span>'
                   f'<span class="prompt"{pl_attr(g.get("pl"))}>{esc(g["en"])}</span></div>\n'
                   f'      <div class="cells cells--cards">\n' + "\n".join(card(i) for i in members) +
                   '\n      </div>')
    main = fill(body, {"projects": "\n".join(out), "count": len(items),
                       "hero_species": active[0]["species"] if active else "oak"}, "templates/home.html")
    site.page("index.html", meta["title"], meta["description"], main.strip("\n"),
              og_type="website", head=meta.get("head", ""), body_class="home")


def build_readme(t):
    rows = []
    for g in t["groups"]:
        rows.append(f"\n### {g['name']}\n\n| id | objective |\n|---|---|")
        rows += [f"| `{o['id']}` | {o['text'].replace('|', '/')} |" for o in g["objectives"]]
    src = t.get("source") or {}
    source = f"Source: [{src.get('en', 'source')}]({src['url']})" + (
        f" (fetched {src['fetched']}).\n" if src.get("fetched") else ".\n") if src.get("url") else ""
    rule = t.get("passed_rule", "done for real, not just practised")
    return f"""# {t['title']} — objective ids

Generated by `bin/build.py` from `track.json`. How to write an entry: `tracks/README.md`.

- **practised**: list ids you worked on in the writeup
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
    groups = load_groups()
    projects = load_projects(groups)
    tracks = load_tracks(groups)
    items = sorted(projects + tracks, key=lambda i: (groups[i["group"]]["index"], i["order"], i["slug"]))
    slugs = [i["slug"] for i in items]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        raise BuildError("a project and a track share a slug: " + ", ".join(sorted(dupes)))

    site = Site()
    clean_dist()
    for f in STATIC_FILES:
        shutil.copy2(ROOT / f, DIST / f)
    for d in STATIC_DIRS:
        shutil.copytree(ROOT / d, DIST / d)

    build_home(site, groups, items)
    for p in projects:
        build_project(site, items, p)
    for t in tracks:
        build_track(site, items, t)
        (t["tdir"] / "README.md").write_text(build_readme(t), encoding="utf-8")
    for path, target in REDIRECTS.items():
        redirect(path, target)

    print(f"site: {len(projects)} projects · {len(tracks)} tracks → dist/ (v={site.v})")
    for t in tracks:
        c = t["counts"]
        print(f"  {t['slug']}: {len(t['entries'])} writeups · {c['done']} done · {c['practising']} practising"
              f" · {c['todo']} todo · {t['n_scripts']} scripts")


if __name__ == "__main__":
    try:
        main()
    except BuildError as err:
        sys.exit(f"build: {err}")
