# VerveQ Content Factory

Batch-renders short-form videos (TikTok / Instagram Reels / YouTube Shorts)
from `app/convex/data/football_career_paths.json`. One template — **Career
Path Reveal**: clubs slam in one by one, WHO IS HE?, 3-2-1, reveal, CTA to
verveq.com. 1080×1920, ~17–25s depending on club count. No UI, no scheduler,
no auto-posting — a render script.

## One-time setup

```
cd tools/content-factory
npm install
```

The first render downloads a headless Chrome build automatically (~1 min).

## Weekly workflow (~10 minutes, mostly waiting)

```
npm run render -- --count 7 --difficulty easy
```

Videos land in `out/<date>/`. Each rendered player id is recorded in
`ledger.json` and never picked again — commit the ledger after each batch.
Start with `easy` (recognizable players = mass appeal); mix in `medium` once
the account has an audience. `--dry` previews the picks without rendering,
`--id cp-messi` renders a specific player (filename = answer, mind spoilers
when screen-sharing).

## Daily workflow (~60 seconds)

1. Upload one MP4 to TikTok. Post the **same file** to IG Reels and YouTube
   Shorts.
2. Add a trending sound **in the TikTok app** — never bake music into the
   render (native sounds help distribution and dodge licensing).
3. Caption = a hook + 2–3 hashtags, e.g. *"Only real fans get this before
   club 3 🔥 #football #quiz #careerpath"*. Reply to good comments — that's
   the part you're already great at.

## Rules (deliberate, don't "fix")

- **No club crests/logos** — trademarked. Club names in brand type, always.
- **No baked-in audio** — see above.
- **English only** — broadest TikTok football audience.
- Brand tokens live in `src/theme.ts`, mirrored from `app/src/index.css`.
  If the app palette changes, update both.

## Preview / iterate on the template

```
npm run studio
```

opens Remotion Studio (dev preview with a timeline scrubber). The composition
props panel lets you paste any dataset entry to see how it lays out.

Remotion licensing: free for companies up to 3 people — fits VerveQ today;
revisit if the team grows.
