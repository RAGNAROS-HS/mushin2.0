# Writing a post

Three commands, run from the repo root on `main`:

```sh
bin/site new "Why I broke my LVM on purpose" linux rhcsa   # start a draft, opens $EDITOR
bin/site preview                                           # localhost:3000, rebuilds on save
bin/site publish                                           # commit, push, deploy, check it's live
```

- **`new`** writes `drafts/why-i-broke-my-lvm-on-purpose.md`. `drafts/` is
  git-ignored, so nothing you write there reaches the public repo until you
  publish it. (It also means a draft lives only on this machine.)
- **`preview`** starts the dev container and rebuilds `dist/` whenever you
  save. Drafts show up, marked `[draft]`. Bad front matter fails the rebuild
  right there in the terminal.
- **`publish`** takes the newest draft (or the one you name), sets its date
  to today and moves it to `posts/YYYY-MM-DD-slug.md`. Then it builds as a
  check, commits `post: <title>`, pushes, waits for CI to build the image,
  runs that exact image on the VPS and waits until the site reports the new
  commit. It ends by printing the post's URL. The URL is `/writing/<slug>/`.

Other commands:

| command                | does                                                         |
|------------------------|--------------------------------------------------------------|
| `bin/site deploy`      | ship whatever is on `main` (after editing a post, CSS, ...)  |
| `bin/site deploy <sha>`| ship a specific commit                                       |
| `bin/site rollback`    | go back to the previous deploy; run it again to undo         |
| `bin/site status`      | local vs pushed vs built vs live, and how many drafts        |

To edit a published post: change the file in `posts/`, commit, push, then
`bin/site deploy`.

## Front matter

| field     | what                                                                     |
|-----------|--------------------------------------------------------------------------|
| `title`   | required                                                                 |
| `date`    | `YYYY-MM-DD`, required; `publish` sets it to the day you publish         |
| `tags`    | `[linux, rhcsa]`: lowercase words joined by `-`; shown next to the post  |
| `summary` | one line for the feed and link previews; defaults to the first paragraph |

Any other field is a build error, so typos don't go unnoticed.

## The body

Plain Markdown: paragraphs, `##` headings (each one is a stop for the `h`/`l`
keys and gets a linkable id), `-`/`1.` lists, `**bold**`, `*italic*`,
`` `code` ``, links, images, `---` rules, and fenced code for commands and
output:

    ```
    $ systemctl --failed
    0 loaded units listed.
    ```

A quote starting with `NOTE:`, `WARNING:` or `TIP:` becomes a boxed callout,
the way a man page sets off NOTES:

    > NOTE: Asides and caveats go here.

Any other `>` quote is an ordinary indented quote. A block that starts with `<`
is passed through as raw HTML. The site's CSP allows no inline scripts or
styles, so keep it to plain markup.
