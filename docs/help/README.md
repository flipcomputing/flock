# Help panel content

The Help tab in Flock's information panel is populated from the HTML files in this
folder. To change what the panel says, edit `en.html` — no JavaScript changes needed.

## Editing

`en.html` is an HTML **fragment**, not a whole page: no `<!doctype>`, `<html>`,
`<head>` or `<body>`. Start straight in at the content, using `<h3>` for section
headings (`<h2>` is the panel's own "Help" title, so start a level below it).

The panel supplies its own styling for headings, paragraphs, lists, links, `<code>`
and `<kbd>`, so plain semantic HTML is all that's needed — avoid inline `style`
attributes so the text keeps working with the panel's text-size buttons and with
both colour themes.

A plain `<a href="https://…">` is enough for an external link. When the panel renders,
each one gets `target="_blank"`, `rel="noopener noreferrer"`, an "opens in a new tab"
announcement for screen reader users, and a small external-link icon — placed at the
end of the list item when the link is inside an `<li>`, so it doesn't interrupt the
sentence, and immediately after the link otherwise. Don't add the icon by hand.

## Translations

One file per language, named with the same language codes as `locale/`:

| File      | Language   |
| --------- | ---------- |
| `en.html` | English    |
| `de.html` | German     |
| `es.html` | Spanish    |
| `fr.html` | French     |
| `it.html` | Italian    |
| `pl.html` | Polish     |
| `pt.html` | Portuguese |
| `sv.html` | Swedish    |

Only `en.html` is required. To add a translation, copy `en.html` to the new language
code and translate the text inside it — the panel picks up the new file with no code
change. Any language without a file falls back to `en.html`, so a missing or
half-finished translation never leaves the panel empty.

Unlike `locale/*.js`, which holds short UI strings keyed by name, each file here is a
whole document: translators work on the prose in context rather than on isolated
fragments.
