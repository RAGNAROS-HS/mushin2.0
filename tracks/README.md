# The woods: tracks, entries and the shelf

The site has two spaces. **About** (`/`) is plain and recruiter-first: who I am,
the career tree, the CV and earlier work. **The woods** (`/woods/`) is the pixel
world where the ongoing work lives:

- **Tracks** are long-running goals. Each is a stand of one tree species.
  - A **weekly** track (the RHCSA) has objectives: every objective is a tree,
    practising gnaws it, passing fells it, and its log goes into the track's
    structure (the cabin).
  - The **notes** track has no objectives and no schedule: opinions, fixes and
    anything worth writing down. Its birch grows a stage per note.
- **Entries** are what I write. Every entry belongs to a track.
- **The shelf** (`content/shelf.json`) lists the books; entries cite them, and
  each book shows where it was cited.

Everything is rendered by `bin/build.py` into `dist/`. Preview with
`python3 bin/build.py`, then `docker compose up -d` and open `localhost:3000`.
The Docker build runs the same script, so bad input fails the build instead of
going live.

## Writing a weekly entry

1. Copy `TEMPLATE.md` to `tracks/<track>/entries/<anything>.md`.
2. Set `date`: the entry is keyed by its ISO week, so its URL is
   `/woods/<track>/<year>-w<nn>.html` and a second entry in the same week
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
belongs to one. Up to five topics, one spine colour each.

## Starting a new track

1. Make `tracks/<slug>/track.json`. Copy `rhcsa/track.json` and change:
   - `title`, `summary`, `intro`, and for weekly tracks `headline` and
     `target` (they make the status line on the about page), `legend`,
     `passed_label`, `passed_rule`
   - `cadence`: `weekly`, or `none` for a journal like notes
   - `status`: active, complete, abandoned, discontinued or limbo
   - `species`: `oak`, `pine` or `birch`, so it looks different from the others
   - `structure`: what its logs build. `woodpile` works for anything;
     `none` for a track without objectives. A bespoke structure is a piece
     list in `STRUCTURES` (`pixel.js`, see `cabinPieces`) plus its name in
     `STRUCTURES` in `bin/build.py`
   - `finished`: true once it's done for good; the beaver gets his red hat
   - `groups`: the objectives. Ids are lowercase words joined by `-`
2. Add `tracks/<slug>/entries/` and write the first entry.
3. The track shows up on the woods map, in the track index and in the feed
   on its own. `shelf` is reserved as a name.
4. New species: a generator in `SPECIES` and an icon in `ICONS` (`pixel.js`),
   its colours under `[data-species]` in `styles.css`, its name in
   `bin/build.py`.

## Earlier work

One file per project in `content/projects/<slug>.md`: front matter (`title`,
`status`, `date`, `summary`, `description`, optional `name` for the label) and
a body, Markdown or raw HTML with `format: html`. They are listed, newest
first, in the folded "earlier work" section of the about page.
