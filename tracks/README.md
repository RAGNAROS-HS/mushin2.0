# The cabin: tracks, entries, books and easter eggs

The site has two spaces. **About** (`/`) is plain and recruiter-first: who I am,
the career tree, the CV and earlier work. **The cabin** (`/cabin/`) is a
pixel-art log cabin room, and everything in it does something:

- **the laptop on the desk** opens the active weekly **track** (the RHCSA log):
  its entries, and its objectives with their state
- **the whiteboard** opens the **notes** track: opinions, fixes and anything
  worth writing down, no schedule. One sticky note per note.
- **the bookshelf**: each spine opens a popup with the book and the entries
  that cite it (`content/shelf.json`)
- **the odd things** (the gi, the homelab rack, the window, the mug) open a
  popup with a tidbit (`content/cabin.json`)

Everything is rendered by `bin/build.py` into `dist/`. Preview with
`python3 bin/build.py`, then `docker compose up -d` and open `localhost:3000`.
The Docker build runs the same script, so bad input fails the build instead of
going live.

## Writing a weekly entry

1. Copy `TEMPLATE.md` to `tracks/<track>/entries/<anything>.md`.
2. Set `date`: the entry is keyed by its ISO week, so its URL is
   `/cabin/<track>/<year>-w<nn>.html` and a second entry in the same week
   fails the build.
3. List objective ids under `practised` / `passed` (ids are in
   `tracks/<track>/README.md`), and cite books under `books`.
4. Write the body in Markdown: headings, paragraphs, `-`/`1.` lists, fenced
   code, `>` quotes, `---`, inline code, **bold**, *italic*, links, images.

Objective states are computed, never set by hand:

- **todo**: no entry mentions it
- **practising**: listed under `practised` in any entry
- **done**: listed under `passed` (the track's README says what counts)

## Writing a note

Copy `notes/TEMPLATE.md` to `tracks/notes/entries/<slug>.md`. The file name is
the URL. Only `date` and `title` are required; `books` is optional.

## Adding a book

Add it to `content/shelf.json` with an `id`, `title`, `author` and `topic`
(one of the topic ids at the top). Optional: `link`, and `track` if the book
belongs to one. Up to five topics: one shelf and one spine colour each.

## Easter eggs

`content/cabin.json` holds the popup text for the things in the room that
aren't pages (`gi`, `rack`, `window`, `mug`). Edit the text freely. A new
object needs drawing first: add it in `cabinScene()` (`pixel.js`, built from
`V.box(...)` calls with an owner name) and the name to `ROOM_OBJECTS` in
`bin/build.py`.

## Starting a new track

1. Make `tracks/<slug>/track.json`. Copy `rhcsa/track.json` and change:
   - `title`, `summary`, `intro`, and for weekly tracks `headline` and
     `target` (they make the status line on the about page),
     `passed_label`, `passed_rule`
   - `cadence`: `weekly`, or `none` for a journal like notes
   - `status`: active, complete, abandoned, discontinued or limbo
   - `groups`: the objectives. Ids are lowercase words joined by `-`
   - `species`, `structure`, `finished`: kept for the pixel layer; use
     `oak`, `woodpile`/`none` and `false` if unsure
2. Add `tracks/<slug>/entries/` and write the first entry.
3. It shows up in the cabin's list and log on its own. The laptop shows the
   first active weekly track.

## Earlier work

One file per project in `content/projects/<slug>.md`: front matter (`title`,
`status`, `date`, `summary`, `description`, optional `name` for the label) and
a body, Markdown or raw HTML with `format: html`. They are listed, newest
first, in the folded "earlier work" section of the about page.
