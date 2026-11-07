# Content format

All content is JSON under `data/`. The app renders whatever is there; nothing is hard-coded.

## Episodes

`data/episodes/index.json` lists all 19 episodes. An episode is playable when it has `"available": true` and a `"file"`.

`data/episodes/epNN.json`:

```
{
  "id": 1,
  "title": "...", "subtitle": "...", "stakes": "...",
  "intro": "shown once before the first hand",
  "result": "session result, shown when the episode is complete",
  "hands": [ { hand } ]
}
```

A hand:

```
{
  "id": "e1h4",                 // unique across all episodes
  "title": "...",
  "kind": "quiz",
  "setup": {
    "hero": { "pos": "SB", "cards": ["Td", "9d"], "label": "T♦9♦" },
    "villain": "who the opponent(s) are and any read",
    "note": "optional context"
  },
  "streets": [ { street } ],
  "outcome": "one or two sentences on how the hand ended"
}
```

A street:

```
{
  "name": "Flop",               // or "Flop (facing a stab)" for a second decision on the same street
  "board": ["Qx", "Kx", "Jx"],  // the FULL board at this point, not just the new card
  "boardNote": "rainbow",       // optional
  "pot": "~$85",                // optional
  "action": "what happened on this street before the decision",
  "decision": {                 // optional; streets without one just play through
    "id": "e1h4-flop",          // unique
    "question": "...",
    "options": [ { "key": "check", "text": "Check" }, ... ],   // 2–4
    "correct": "check",         // the action Marc endorses
    "marcDid": "check",         // what Marc actually did (may differ from correct)
    "reveal": "Marc's reasoning, then what happened next"
  }
}
```

Cards: rank + suit, e.g. `"Td"`, `"As"`. Rank `T` renders as 10. Unknown suit: `"Qx"` (renders a plain grey card). Unknown card: `"?"`.

Rules for extraction:

- Only facts the transcript states. If a card, size or suit isn't stated, mark it unknown (`x`, `?`) or describe it in words. Never invent it.
- `correct` is the line Marc endorses. When he says his own play was a mistake, `marcDid` is his play and `correct` is what he says he should have done. The app shows both.
- Decision points are Marc's own decisions where he explains his thinking. Forced spots and auto-folds are described in `action` and play through.
- Options are shuffled by the app at display time, so write them in natural order.
- Sizes in the options should be in dollars at the episode's stakes, with the pot fraction in brackets when it helps.

## Curriculum

`data/curriculum.json`: `phases[] → modules[] → lessons[]`.

A lesson:

```
{
  "id": "1.2.1", "title": "...", "minutes": 5,
  "concept": [ "paragraph", "## heading", "- bullet", "> callout", ... ],
  "drill": {
    "intro": "...",
    "questions": [
      { "id": "1.2.1-q1", "prompt": "...", "options": [ { "key": "a", "text": "..." }, ... ], "correct": "b", "explain": "..." }
    ]
  }
}
```

Concept blocks support `**bold**` inline. Modules carry `sources` (video titles and URLs) and optional `homework`. A module with `"locked": true` or no lessons shows as "Soon".

Rules:

- Scenarios at $1/2 or $1/3 with $200–$500 stacks unless a specific video hand is being retold.
- Every drill question has exactly one right answer and a one-paragraph `explain` that teaches, not just confirms.
- Balance the correct action types across a drill (folds, calls, raises, checks). Letter position doesn't matter because options are shuffled.
- Check every question's `correct` key exists in its options before committing (`python3 -m json.tool` plus a quick script).
