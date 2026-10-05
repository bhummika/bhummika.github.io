# bhummika.github.io

Bhumika Choudhary's portfolio, built as a wall of LEGO style bricks. Plain HTML, CSS and JavaScript,
no frameworks, nothing to install. GitHub Pages serves it straight from `main`.

## Editing

All the words and numbers live in **`content.json`**. After editing it, or `style.css`, `app.js` or
`art.js`, run:

```sh
python sync_content.py
```

It regenerates everything that is derived, so always run it before committing:

- `content.js`: the content as a script, so the page draws itself with no extra request and also
  works when `index.html` is opened by double click.
- the plain text copy of the whole site inside `index.html` (between the STATIC markers), for search
  engines, resume parsers, printing and anyone without JavaScript;
- the schema.org Person data, title, description and preview text;
- version tags on the script links, so browsers never mix new and old files;
- `style.css` inlined into `index.html` (between the CSS markers), so the first screen appears fast.

Never edit `content.js` or the generated parts of `index.html` by hand.

**Numbers that count up:** each number in `about.numbers` has a `value` (what is shown) and a
`count` (how it counts: `to`, optional `prefix`, `suffix`, and `group` for a thousands comma). If
you change a number, change both.

## Tailored links

`?for=` highlights the work that matters for one kind of role and dims the rest:

- `https://bhummika.github.io/?for=supply-chain`
- `https://bhummika.github.io/?for=risk-compliance`
- `https://bhummika.github.io/?for=program-management`

The groups live under `focus` in `content.json`; each lists the project, role, problem and number
ids to bring forward, and the Targeting line to show. Unknown values are ignored.

## Projects

`projects.layout` is `featured`: the item with `featured: true` spans the full width, the others
are cards with `oneProblem`, `did`, `result`, one `headline` number, an optional `cta` button and a
`role` chip. Items with `workbench: true` go in the slim "On the workbench" strip. Remove
`layout` to go back to the original equal cards.

## Checking it locally

```sh
python3 -m http.server 8000     # then open http://127.0.0.1:8000/
```

After a change, also check: JavaScript turned off and print preview (both should show the plain
copy), a phone width, and the system "reduce motion" setting (bricks fade instead of flying and
numbers do not count).
