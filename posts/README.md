# Writing a post

Every post is one Markdown file in this folder. RHCSA updates, opinions,
homelab fixes and demos all go here; tags and series tell them apart.

1. Copy `_template.md` to `posts/YYYY-MM-DD-short-slug.md`. The date prefix
   only keeps the folder sorted; the URL is `/blog/short-slug.html`.
2. Fill in the front matter. Only `date` and `title` are required.
3. Write the body in Markdown: headings, paragraphs, `-`/`1.` lists, fenced
   code, `>` quotes, `---`, inline code, **bold**, *italic*, links, images.
   A block that starts with `<` is passed through as raw HTML, for a demo.
4. `python3 bin/build.py`, then `docker compose up -d` and open
   `localhost:3000`. The Docker build runs the same script, so bad input
   fails the build instead of going live.

## Front matter

| field       | what                                                                 |
|-------------|----------------------------------------------------------------------|
| `date`      | `YYYY-MM-DD`, required                                               |
| `title`     | required                                                             |
| `tags`      | `[linux, opinion]`: lowercase words joined by `-`; each gets a page  |
| `summary`   | one line for the feed and link previews; defaults to the first paragraph |
| `draft`     | `true` leaves the post out of the build                              |
| `series`    | `rhcsa`: puts the post in that series (and adds the tag)             |
| `practised` | objective ids worked on (needs `series`; ids in `series/<slug>/README.md`) |
| `passed`    | objective ids passed; the series README says what counts            |
| `scripts`   | list of `name:` / `url:` / `what:`                                   |
| `books`     | ids from `content/shelf.json`; the post shows up on `/books/`        |
| `project`   | a file name from `content/projects/`; the post shows up on that project's page |

Objective states on `/rhcsa/` are computed from the posts, never set by hand:
**todo** (no post mentions it), **practising** (under `practised` in any post),
**done** (under `passed`).

## Adding a book

Add it to `content/shelf.json` under one of its topics; cite it from a post
with `books: [id]`.
