# Tracks

A track is a project that keeps a log: a cert (RHCSA) or anything else with a
list of objectives or milestones. Each objective is a tree of the track's
species; practising gnaws it, passing fells it, and its log goes into the
track's structure. Tracks sit next to plain projects in `~/projects`, and
every track's build shows in the clearing at the top of that section.

Everything is rendered by `bin/build.py` into `dist/`. Preview with
`python3 bin/build.py`, then `docker compose up -d` and open `localhost:3000`.
The Docker build runs the same script, so bad input fails the build instead
of going live.

## Writing an entry

1. Copy `TEMPLATE.md` to `tracks/<track>/entries/<anything>.md`
   (e.g. `2026-w50.md`; the file name becomes the URL).
2. Fill in the front matter. Objective ids are listed in `tracks/<track>/README.md`.
3. Write the body in Markdown: headings, paragraphs, `-`/`1.` lists, fenced
   code, `>` quotes, `---`, inline code, **bold**, *italic*, links and images.

Objective states are computed, never set by hand:

- **todo**: no writeup mentions it
- **practising**: listed under `practised` in any writeup
- **done**: listed under `passed` (the track's README says what counts)

## Starting a new track

1. Make `tracks/<slug>/track.json`. Copy `rhcsa/track.json` and change:
   - `title`, `summary`, `intro`, `legend`, `passed_label`, `passed_rule`
     (translated fields take `{"en": ..., "pl": ...}`; `pl` is optional)
   - `group` and `order`: where its card sits in `~/projects` (`content/groups.json`)
   - `status`: active, complete, abandoned, discontinued or limbo
   - `species`: `oak`, `pine` or `birch`, so it looks different from the others
   - `structure`: what its logs build. `woodpile` works for anything; give a
     track its own structure by adding a piece list to `STRUCTURES` in
     `pixel.js` (see `cabinPieces`) and its name to `STRUCTURES` in `bin/build.py`
   - `finished`: true once it's done for good; the beaver gets his red hat
   - `groups`: the objectives. Ids are lowercase words joined by `-` and
     unique within the track
2. Add `tracks/<slug>/entries/` and write the first entry.
3. New species work the same way: a generator in `SPECIES` (`pixel.js`), its
   colours under `[data-species]` in `styles.css`, its name in `bin/build.py`.

## Plain projects

One file per project in `content/projects/<slug>.md`: front matter (`title`,
`group`, `order`, `status`, `date`, `summary`, `summary_pl`, `description`,
optional `name` for the card label) and a body. The body is Markdown, or
raw HTML with `format: html`.
