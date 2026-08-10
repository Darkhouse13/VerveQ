# CHAIN-LONG — batch 1, the experiment lane's first format (2026-08-10)

Two editions rendered, **narrated, complete**. 21 new VO lines generated and
cached to `promo/vo-cache-chainlong/`; 10 carrier lines copied from
`promo/vo-cache-ladderlong/` and not re-billed. Renders are offline from here.

---

## 1. What this batch is

Two rulings landed first (`docs/DECISIONS.md`, 2026-08-10) and this batch is
the first artifact cut under both:

- **7.00s is the standing pace; the 5.50s arm is retired.** The batch-2 A/B
  read: 7.00s took 2.5K + 1.5K, 5.50s took 1.6K + 563.
- **The experiment lane.** `ladder-long` banks ~4 slots/week; one slot/week
  runs exactly ONE new format, judged vs the ladder band (**560–2.5K**) at
  n=2–3 editions, kept or killed.

`chain-long` is the relay mechanic (`chain`, 11.0s — the library's best
comment-per-view shape) wearing the ladder-long batch-2 winner spec whole: ten
slots at a metronomic 7.00s, nine resolved, score strip, follow hook, batch-2
closer. **One club pair per edition; every slot is a player whose dataset path
carries both clubs.** No outside facts anywhere — qualification is decided by
`football_career_paths.json` and nothing else, loans flattened to the bare
club as in every lane.

**Zero extra variables on a first read, by design:** control grid only, no
campaign field spent (it stays available for a WEEKEND-cast edition later),
standard batch-2 follow + closer lines, no trending sound (narrated format).

### The grid

`9×210f + 240f + 60f + 90f = 2280f = 76.00s` (152 beats). Slot 10 runs 240f,
not the ladder's 300f — there is no path to build — so the hand-over lands at
the answer beat (150f in) and holds 3.00s. The count-in window (2.50s) and
answer window (2.00s) are pinned to GRID_7 **as a reuse precondition**: the
inherited takes were measured against those budgets.

### The two withholds

1. **Slot 10 is never filled** — drawn empty from frame 0, caret blinking,
   stamped `YOUR TURN` at its beat. Spoken: *"Slot ten is yours."*
2. **The omission** — each cast deliberately excludes the pair's single most
   famous qualifying player, and the closing voice confesses it on the
   hand-over beat: *"And we left out the obvious one."* — with the same line
   stamped across the resolved rail.

**Withhold discipline covers both, and it is stricter than `chain`'s was**
(the old README row names that promo's omission; this lane never will): the
omitted player is not named in VO, captions, cards, filenames, or files —
including this document. His path is never shown, so he is **not spent in
`ledger.json`** (the `chain` precedent, `src/promo/chain/timeline.ts`). The
ANSWERS arrays and the `slots` tables being nine long is the discipline
enforced by construction.

## 2. Edition selection — how the pairs were chosen

Census over all 1,322 dataset entries: for every club pair, count the players
whose path carries both. 56 pairs have ≥11 qualifiers. Constraints from the
ticket, applied in order: **≥10 dataset-verifiable qualifiers AFTER excluding
the omission candidate; ≥5 of the cast recognisable to a casual fan; the
omission unambiguous S-tier; nine cast ids ledger-unspent; two different
pairs.**

Selected:

### `liverpool-city` — "THE M62" (Liverpool + Manchester City)

11 qualifiers, 10 after the omission — the constraint met exactly. The
omission is as unambiguous as this dataset gets: one crossing dominates the
pair in living memory, and the "you forgot X" writes itself.

| # | tier | rail | id | spoken |
|---|---|---|---|---|
| 1 | EASY | MILNER | `cp-james-milner` | James Milner. |
| 2 | EASY | BALOTELLI | `cp-balotelli` | Balotelli. |
| 3 | MEDIUM | STURRIDGE | `cp-daniel-sturridge` | Daniel Sturridge. |
| 4 | MEDIUM | FOWLER | `cp-robbie-fowler` | Robbie Fowler. |
| 5 | MEDIUM | KOLO TOURÉ | `cp-kolo-toure` | Kolo Touré. |
| 6 | HARD | ANELKA | `cp-anelka` | Anelka. |
| 7 | HARD | BELLAMY | `cp-bellamy` | Bellamy. |
| 8 | HARD | HAMANN | `cp-dietmar-hamann` | Didi Hamann. |
| 9 | IMPOSSIBLE | DAVID JAMES | `cp-david-james` | David James. |

The tenth qualifier, **Steve McManaman, is deliberately uncast** — the
McTominay principle: every rail name is set all-caps and "MCMANAMAN" reads as
a typo. He is not withheld, just not cast; he is slot-10 ammunition a viewer
can type and the dataset will back.

### `chelsea-marseille` — "THE CHANNEL" (Chelsea + Marseille)

13 qualifiers, 12 after the omission, 11 of them unspent — trap slack the
first edition doesn't have. Same unambiguity bar: one name owns this pair.

| # | tier | rail | id | spoken |
|---|---|---|---|---|
| 1 | EASY | AUBAMEYANG | `cp-pierre-emerick-aubameyang` | Aubameyang. |
| 2 | EASY | AZPILICUETA | `cp-azpilicueta` | Azpilicueta. |
| 3 | MEDIUM | BATSHUAYI | `cp-michy-batshuayi` | Batshuayi. |
| 4 | MEDIUM | MAKÉLÉLÉ | `cp-makelele` | Makélélé. |
| 5 | MEDIUM | GALLAS | `cp-william-gallas` | William Gallas. |
| 6 | HARD | LEBOEUF | `cp-frank-leboeuf` | Frank Leboeuf. |
| 7 | HARD | LASSANA DIARRA | `cp-lassana-diarra` | Lassana Diarra. |
| 8 | HARD | GEORGE WEAH | `cp-weah` | George Weah. |
| 9 | IMPOSSIBLE | DESCHAMPS | `cp-didier-deschamps` | Didier Deschamps. |

Uncast qualifiers left as slot-10 ammunition: Boudewijn Zenden and Loïc Rémy
(unspent), plus one spent id whose reveal an earlier batch already posted.

Tier here = **depth into the pair's qualifier pool**, not path difficulty —
the relay escalates from "everyone's second answer" to "no chance you had
this", which is why slot 9 in both decks is the kind of name that gets a
comment on its own (the current France manager; a keeper nobody files under
City). Shape: 2 EASY / 3 MEDIUM / 3 HARD / 1 IMPOSSIBLE, slot 10 the second
IMPOSSIBLE and it's yours.

### Near-misses, for the record

- **AC Milan + Chelsea** (22 qualifiers, the deepest pool on the board) —
  rejected on omission ambiguity: the pair's "obvious one" splits between
  Shevchenko (the historic answer) and Pulisic (the current one), and a split
  payoff fails the "unambiguous S-tier" constraint.
- **PSG + Real Madrid** (11) — the cleanest omission candidate anywhere
  (Mbappé), killed by the ledger: Beckham, Sergio Ramos, Di María and Hakimi
  are already spent, leaving only 7 castable.
- **Ajax + Barcelona** (15) — Cruyff vs Suárez splits the same way
  Milan+Chelsea does.

### Traps checked

- **Duplicate-id aliases.** The known families (`cp-alisson`/`-becker`,
  `cp-marcelo`/`-vieira`) plus **five newly catalogued this batch**, found by
  name-token + shared-clubs scan: `cp-andriy-arshavin`/`cp-andrey-arshavin`,
  `cp-take-kubo`/`cp-takefusa-kubo`, `cp-anthony-yeboah`/`cp-tony-yeboah`,
  `cp-marcio-amoroso`/`cp-amoroso`, `cp-toni-schumacher`/`cp-harald-schumacher`
  (the same keeper under nickname and given name). None of the 18 cast ids has
  an alias, spent or otherwise — near-hits (Panucci/Pulisic on "Christian",
  Milner/James on "James") are different men and were eyeballed as such.
- **Gullit pattern** (consecutive-duplicate clubs). No surface in this format:
  paths are never drawn — the rail is names-only and the caption prints no
  path, because **a path is a fingerprint** and the caption that printed the
  omission's would have named him. Noted anyway: `cp-james-milner`'s dataset
  path carries consecutive Aston Villa entries; nothing renders it.
- **McTominay principle** (all-caps rail). McManaman excluded, above. No cast
  name needs mixed case.
- **Reply-guy check on every cast spell.** Both-club spells verified real
  senior spells for all 18 (e.g. Aubameyang's Chelsea and Marseille years are
  load-bearing and solid — the same man's *Milan* entry is an academy fact
  that would not survive a reply thread, which is one more reason that pair
  was dropped).

## 3. VO — 10 reused, 21 billed, zero overruns shipping

The carrier crosses lanes for the first time (spec #13 taken across formats):

| line | source | measured / budget |
|---|---|---|
| `n2`…`n9` | **reused** from ladder-long, verbatim takes | 0.64–2.24s / 2.50s |
| `follow` | **reused** ("New gauntlet daily.") | 1.68s / 2.00s |
| `cta2` | **reused** ("Your score? And number ten?") — both its asks are this format's asks | 2.72s / 3.00s |
| `openc` | billed — "Ten slots, everyone played for both. Keep count." | 3.52s / 5.00s |
| `turn` | billed — "Slot ten is yours." | 2.08s / 2.50s |
| `omission` | billed — "And we left out the obvious one." | 2.00s / 3.00s |
| 18 × answer | billed | 0.72–1.36s / 2.00s |

`n10` and `withhold` are deliberately NOT reused: slot 10's count-in IS the
hand-over, and nothing is being withheld from slot 10 — it is being handed
over.

**Two overruns, both instructive:**

- `openc` first take — *"Ten slots. Everyone here played for both. Keep
  count."* — came back **5.52s / 5.00s**, right on batch 2.5's price model
  (~0.93s per sentence boundary + ~0.16s/word predicts 5.2s). The fix cut a
  **boundary, not words**: the middle full stop became a comma, the clause
  survived whole, and the retake measured **3.52s**. Third consecutive
  confirmation that punctuation is the expensive part of a slot.
- `chelsea-marseille-a6` — *"Frank Leboeuf."* — **2.88s / 2.00s** on the first
  roll, **1.20s** on the second, same text. Not a syllable problem; Charlie
  chewed the French. New house note: stability 0.4 rolls wide on foreign
  names — **a name-take that overruns is worth one re-roll before any copy
  surgery.**

Answer naming law held a fourth time (≥3-syllable surnames alone, short
surnames get first names; LASSANA DIARRA and DAVID JAMES carry first names on
the rail too, because the lone surname is a different famous player).

## 4. Verification

- **Coverage**: `checkCoverage()` passes — 31 lines, nothing scripted that
  never plays, nothing played that is never scripted.
- **Fit**: 31/31 lines inside budget (table above).
- **Frame counts**: both editions **2280f / 76.00s** exactly (promo.mjs
  printout; ffprobe 76.05s = AAC frame padding, same as every batch).
- **VO placement, envelope domain** (the batch 2.5 method — 100ms RMS
  envelopes, gain fitted on envelopes, residual vs median off-cue baseline):
  **22/22 cues carry voice energy on frame in both editions, 44/44 across the
  batch**, margins 19.8×–54.1×, envelope gains 0.80 / 0.79. No cue near the
  3× floor.
- **The ladder is untouched, proven not asserted**: all 10 `ladder-long` SFX
  beds regenerated from this tree and from a clean `HEAD` worktree are
  **md5-identical**. Per-name seeding means adding `chain-long-*` mixers
  cannot perturb them, and now didn't.
- **Withhold sweep**: the omitted players' names appear in **zero** changed
  files, **zero** new files, **zero** rendered captions and **zero**
  filenames (case-insensitive grep over the diff, the new sources, `out/` and
  the ledger delta). The ledger delta is exactly the 18 cast ids.

## 5. Renders

```
out/2026-08-10/verveq-chain-long-liverpool-city.mp4      76.00s  12.0 MB  (+ .txt)
out/2026-08-10/verveq-chain-long-chelsea-marseille.mp4   76.00s  12.0 MB  (+ .txt)
```

1080×1920, 30fps, h264 + AAC, 2280f each. Postable as-is: standard captions
(score ask first, then the two withhold asks; bare `verveq.com`, no campaign
links), own audio, no trending sound.

## 6. The read, when it comes

Judged vs the ladder band **560–2.5K at n=2–3**: inside the band → the format
earns more editions; below it → killed, and the experiment slot moves to the
next format. If it's kept, the third edition is a one-row table entry in
`src/promo/chainlong/timeline.ts` — and the `campaign` axis is still unspent
if THE WEEKEND wants a cast.
