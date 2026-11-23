#!/usr/bin/env python3
"""Build ~/log from weekly Markdown writeups.

Reads   log/objectives.json        the 62 official EX200 objectives
        log/entries/*.md           one writeup each, with front matter
        log/templates/shell.html   the page shell shared with the rest of the site
Writes  log/index.html             progress page: cabin, objective map, writeups
        log/<slug>.html            one page per writeup
        log/README.md              how to write an entry + the table of objective ids

Standard library only, so `python3 bin/build_log.py` works anywhere and the
Docker build stage needs no pip install. Fails loudly on bad input (unknown
objective id, bad date, missing title) instead of silently dropping progress.
"""

import html
import json
import re
import sys
from datetime import date
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "log"
SITE = "https://hugokatzer.tech"
STATES = ("todo", "practising", "done")


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


# ---------------------------------------------------------------------- model

def load_objectives():
    data = json.loads((LOG / "objectives.json").read_text(encoding="utf-8"))
    by_id = {}
    for g in data["groups"]:
        for o in g["objectives"]:
            o["group"] = g["name"]
            by_id[o["id"]] = o
    return data, by_id


def load_entries(by_id):
    entries, problems = [], []
    for path in sorted((LOG / "entries").glob("*.md")):
        name = str(path.relative_to(ROOT))
        try:
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"), name)
            for field in ("date", "title"):
                if not meta.get(field):
                    raise BuildError(f"{name}: missing '{field}'")
            try:
                when = date.fromisoformat(str(meta["date"]))
            except ValueError:
                raise BuildError(f"{name}: date must be YYYY-MM-DD, got {meta['date']!r}")
            lists = {}
            for field in ("practised", "passed"):
                ids = meta.get(field) or []
                if isinstance(ids, str):
                    ids = [ids]
                unknown = [x for x in ids if x not in by_id]
                if unknown:
                    raise BuildError(f"{name}: unknown objective id(s) in '{field}': {', '.join(unknown)}"
                                     " (see log/README.md for the list)")
                lists[field] = list(dict.fromkeys(ids))
            scripts = []
            for s in meta.get("scripts") or []:
                s = s if isinstance(s, dict) else {"name": s}
                if not s.get("name"):
                    raise BuildError(f"{name}: every script needs a 'name'")
                scripts.append(s)
            slug = re.sub(r"[^a-z0-9-]+", "-", path.stem.lower()).strip("-")
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
        raise BuildError("duplicate entry slugs: " + ", ".join(sorted(dupes)))
    entries.sort(key=lambda e: (e["date"], e["slug"]), reverse=True)
    return entries


def compute_states(by_id, entries):
    state = {oid: "todo" for oid in by_id}
    for e in entries:
        for oid in e["practised"]:
            if state[oid] == "todo":
                state[oid] = "practising"
    for e in entries:
        for oid in e["passed"]:
            state[oid] = "done"
    return state


# ---------------------------------------------------------------------- pages

GLYPH = {"todo": "tree", "practising": "gnawed", "done": "log"}


def page(shell, title, description, url, body, scripts=""):
    return shell.substitute(title=esc(title), description=esc(description), url=esc(url),
                            body=body, scripts=scripts)


def pass_order(entries, by_id):
    """Passed objectives in the order they were first passed, with the date:
    the cabin on ~/log is built from them, one piece per objective."""
    seen, out = set(), []
    for e in sorted(entries, key=lambda e: (e["date"], e["slug"])):
        for oid in e["passed"]:
            if oid not in seen:
                seen.add(oid)
                out.append({"id": oid, "text": by_id[oid]["text"], "date": e["date"].isoformat()})
    return out


def build_index(shell, data, by_id, entries, state, counts, n_scripts):
    exam = data["exam"]
    groves = []
    for g in data["groups"]:
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
            f'<span class="wu-go"><span data-i18n="lg_read">read</span> &rarr;</span></span>'
            f'</a>')
    writeups = "\n".join(rows) if rows else ""

    hat = "1" if exam.get("passed_exam") else "0"
    logs = esc(json.dumps(pass_order(entries, by_id), ensure_ascii=False, separators=(",", ":")))
    body = f'''  <div class="crumbs">$ cd ~/log</div>

  <section class="section section--proj">
    <h1 class="name name--proj">RHCSA log</h1>
    <p class="proj-sum" data-i18n="lg_intro">I landed on the RHCSA as a solid goal for my Linux development: it's clear-cut, practical and pretty comprehensive for a first cert. I'd already worked through a good chunk of Sander van Vugt's RHCSA prep book, but quickly found that understanding something is a long way from doing it from memory with just a man page at your disposal. Hence this log (badum-ts), where I periodically keep track of how things are progressing. I've thrown away what I did so far and started anew, with an emphasis on repetition: I only move on to the next chapter once I've hammered out a script or two quite a few times with no mistakes. I invite you to take a gander!</p>
    <div class="build-scene" id="build-scene" data-done="{counts["done"]}" data-total="{counts["total"]}" data-hat="{hat}" data-logs="{logs}"></div>
  </section>

  <section class="section" id="objectives">
    <div class="sec-head">
      <span class="prompt">$ ls ~/log/objectives</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{counts["total"]} · EX200 · {esc(exam["rhel"])}</span>
    </div>
    <p class="legend"><span data-i18n="lg_legend">Each tree is one official exam objective. Standing: not started. Gnawed: practised in a writeup. Felled: passed in a timed mock exam, and its log goes into the cabin above.</span> <a href="{esc(exam["source"])}" data-i18n="lg_source">objective list from Red Hat</a></p>
    <div class="groves">
{chr(10).join(groves)}
    </div>
    <div class="obj-detail" id="obj-detail" hidden>
      <span class="obj-detail-text" id="obj-detail-text"></span>
      <button type="button" class="theme-toggle" id="obj-clear" data-i18n="lg_clear">[clear filter]</button>
    </div>
  </section>

  <section class="section section--last" id="writeups">
    <div class="sec-head">
      <span class="prompt">$ ls -t ~/log/writeups</span>
      <span class="rule rule--dashed"></span>
      <span class="prompt">{len(entries)}</span>
    </div>
    <div class="wus" id="wus">
{writeups}
    </div>
    <p class="wu-empty" id="wu-empty"{"" if not entries else " hidden"} data-i18n="{"lg_none" if not entries else "lg_nomatch"}">{"No writeups yet: the first one lands at the end of week one." if not entries else "No writeup covers this objective yet."}</p>
  </section>'''
    desc = (f"RHCSA (EX200, {exam['rhel']}) practice log: {counts['done']} objectives done, "
            f"{counts['practising']} practising, {n_scripts} bash scripts, weekly writeups.")
    return page(shell, "RHCSA log — Hugo Sokołowski-Katzer", desc, f"{SITE}/log/", body,
                '<script src="log.js?v=14"></script>')


def build_entry(shell, e, by_id, state, newer, older):
    def obj_list(ids, label_key, label):
        if not ids:
            return ""
        items = "".join(
            f'<li><a href="index.html#obj={oid}"><span class="obj-inline" data-glyph="{GLYPH[state[oid]]}"></span>'
            f'{esc(by_id[oid]["text"])}</a> <span class="dim">· {esc(by_id[oid]["group"])}</span></li>'
            for oid in ids)
        return f'<h2 data-i18n="{label_key}">{label}</h2>\n<ul class="objs">{items}</ul>'

    scripts = ""
    if e["scripts"]:
        items = []
        for s in e["scripts"]:
            name = f'<code>{esc(s["name"])}</code>'
            if s.get("url"):
                name = f'<a href="{esc(s["url"])}">{name}</a>'
            what = f' — {esc(s["what"])}' if s.get("what") else ""
            items.append(f"<li>{name}{what}</li>")
        scripts = '<h2 data-i18n="lg_scripts">Scripts</h2>\n<ul>' + "".join(items) + "</ul>"

    nav = ['<a href="index.html">&larr; <span data-i18n="lg_back">back to the log</span></a>', '<span class="grow"></span>']
    if older:
        nav.append(f'<a href="{older["slug"]}.html">&larr; {older["date"].isoformat()}</a>')
    if newer:
        nav.append(f'<a href="{newer["slug"]}.html">{newer["date"].isoformat()} &rarr;</a>')

    chapter = f'<span>{esc(e["chapter"])}</span>' if e["chapter"] else ""
    body = f'''  <div class="crumbs">$ cd <a href="index.html">~/log</a>/{e["slug"]}</div>

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
{obj_list(e["practised"], "lg_practised", "Objectives practised")}
{obj_list(e["passed"], "lg_passed", "Passed in a timed mock exam")}
  </article>

  <nav class="proj-nav">
    {" ".join(nav)}
  </nav>'''
    desc = e["summary"] or f"RHCSA practice writeup, {e['date'].isoformat()}."
    return page(shell, f"{e['title']} — RHCSA log", desc, f"{SITE}/log/{e['slug']}.html", body,
                '<script src="log.js?v=14"></script>')


def build_readme(data):
    rows = []
    for g in data["groups"]:
        rows.append(f"\n### {g['name']}\n\n| id | objective |\n|---|---|")
        rows += [f"| `{o['id']}` | {o['text'].replace('|', '/')} |" for o in g["objectives"]]
    return f"""# ~/log — RHCSA practice writeups

Generated by `bin/build_log.py`. Edit the writeups in `entries/`, not the built pages.

## Writing this week's entry

1. Copy `TEMPLATE.md` to `entries/<anything>.md` (e.g. `entries/2026-w50.md`; the file name becomes the URL).
2. Fill in the front matter and write the body in Markdown.
3. Preview: `python3 bin/build_log.py`, then `docker compose up -d` and open `localhost:3000/log/`.
4. Commit and push. The Docker build runs the same script, so a bad id fails the build instead of going live.

Objective states are computed, never set by hand:

- **todo**: no writeup mentions it
- **practising**: listed under `practised` in any writeup
- **done**: listed under `passed`, which is for **timed mock exams only**

Markdown supported: headings, paragraphs, `-`/`1.` lists, fenced code blocks, `>` quotes, `---`, inline code, **bold**, *italic*, links and images.

## Objective ids

Source: [{data['exam']['code']} on redhat.com]({data['exam']['source']}) ({data['exam']['rhel']}, fetched {data['exam']['fetched']}).
{chr(10).join(rows)}
"""


# ----------------------------------------------------------------------- main

def main():
    data, by_id = load_objectives()
    entries = load_entries(by_id)
    state = compute_states(by_id, entries)
    counts = {s: sum(v == s for v in state.values()) for s in STATES}
    counts["total"] = len(state)
    n_scripts = len({s["name"] for e in entries for s in e["scripts"]})
    shell = Template((LOG / "templates" / "shell.html").read_text(encoding="utf-8"))

    for old in LOG.glob("*.html"):
        old.unlink()
    (LOG / "index.html").write_text(
        build_index(shell, data, by_id, entries, state, counts, n_scripts), encoding="utf-8")
    for i, e in enumerate(entries):
        newer = entries[i - 1] if i > 0 else None
        older = entries[i + 1] if i + 1 < len(entries) else None
        (LOG / f"{e['slug']}.html").write_text(build_entry(shell, e, by_id, state, newer, older), encoding="utf-8")

    (LOG / "README.md").write_text(build_readme(data), encoding="utf-8")
    print(f"log: {len(entries)} writeups · {counts['done']} done · {counts['practising']} practising · "
          f"{counts['todo']} todo · {n_scripts} scripts")


if __name__ == "__main__":
    try:
        main()
    except BuildError as err:
        sys.exit(f"build_log: {err}")
