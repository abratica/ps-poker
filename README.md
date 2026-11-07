# PS Poker

Andrew's Hungry Horse Poker study app. A static PWA on GitHub Pages: https://abratica.github.io/ps-poker/

Two things in it:

- **Episodes**: Marc's $100/hr challenge (19 episodes) as a playable series. Every hand plays street by street. You pick the action, then see what Marc did and his reasoning. Progress resumes per hand and per street.
- **Curriculum**: the Thought Process Curriculum (HH_Curriculum_v2) as phone-sized lessons. Each lesson is a short read followed by an A/B/C/D drill with reasoning after every answer.

Progress is saved in `localStorage` on the device. No accounts, no backend.

## Files

- `index.html`, `styles.css`, `app.js`: the app shell (hash router, views, progress).
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA plumbing and the home-screen icon.
- `data/episodes/index.json`: the episode list and which ones are built.
- `data/episodes/epNN.json`: one file per episode (see `CONTENT.md` for the format).
- `data/curriculum.json`: phases, modules and lessons. Modules with `"locked": true` are listed but not built yet.

## Adding content

See `CONTENT.md`. The content is extracted from the episode transcripts and the HHP transcript library in the Claude project, then checked against the transcript before it goes in.

## Cache busting

`sw.js` has a `CACHE` version and `index.html` loads `styles.css?v=N` and `app.js?v=N`. Bump all three together when the shell changes. Data files are always fetched fresh when online.
