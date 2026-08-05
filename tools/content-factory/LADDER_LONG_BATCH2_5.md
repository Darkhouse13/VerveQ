# LADDER-LONG — batch 2.5, the two WEEKEND-cast editions (2026-08-05)

Two editions rendered, **narrated, complete.** Twenty new VO lines generated
against the owner's `FAL_KEY` and cached to `promo/vo-cache-ladderlong/` — the
cache now holds all 108 lines and renders are offline from here.

---

## 1. What this batch is, and what it deliberately is not

Batch 2.5 exists to point the retention lane at THE WEEKEND's waitlist during the
campaign's ARGUE I window, using the format that is already working rather than a
new one. So the **batch-2 spec is frozen here completely**: same score rail, same
follow card, same `?/9` ask, same shared carrier, no trending sound, no player
imagery.

**Both editions run the 7.00s control grid.** The 5.50s arm is still unproven —
that is the entire point of the batch-2 A/B, which has not reported — and a
campaign asset is the last place to spend an untested variable. It also keeps
this batch out of the experiment's way: two more editions on the control arm
cannot be mistaken for A/B data, whereas two more on the fast arm would have
silently doubled one cell of it.

Two things vary, and only two:

**(a) Casting intent.** Both decks are **current players only**. That is not a
style choice — the quiz is arguing for a mode you draft with this weekend's
actual teams, and a retired name is a fine quiz answer and a terrible advert for
a live draft.

**(b) One line of closing copy**, plus the wordmark that line points at.

## 2. Casting

Twenty fresh ids, zero collisions with the 132 already in `ledger.json`, all ≤7
clubs, whole paths copied from `football_career_paths.json` (loan spells
flattened to the bare club name, same as batches 1 and 2). Tier = difficulty of
the **path**, not obscurity of the **name**; ladder shape is the standing
2 EASY / 3 MEDIUM / 3 HARD / 2 IMPOSSIBLE.

### `five-leagues` — "FIVE LEAGUES, ONE SQUAD"

The mode's own pitch used as the quiz's premise. The deck is **two full passes
through the five leagues, in the same order both times**:

| # | tier | player | current league | path |
|---|---|---|---|---|
| 1 | EASY | Dani Carvajal | La Liga | Bayer Leverkusen → Real Madrid |
| 2 | EASY | Joshua Kimmich | Bundesliga | RB Leipzig → Bayern Munich |
| 3 | MEDIUM | Christian Pulisic | Serie A | Borussia Dortmund → Chelsea → AC Milan |
| 4 | MEDIUM | Alisson | Premier League | Internacional → Roma → Liverpool |
| 5 | MEDIUM | Vitinha | Ligue 1 | Porto → Wolverhampton Wanderers → Porto → Paris Saint-Germain |
| 6 | HARD | Dušan Vlahović | Serie A | Partizan Belgrade → Fiorentina → Juventus |
| 7 | HARD | Michael Olise | Bundesliga | Reading → Crystal Palace → Bayern Munich |
| 8 | HARD | Raphinha | La Liga | Vitória de Guimarães → Sporting CP → Rennes → Leeds United → Barcelona |
| 9 | IMPOSSIBLE | Andrew Robertson | Premier League | Queen's Park → Dundee United → Hull City → Liverpool |
| **10** | **IMPOSSIBLE** | **withheld** | **Ligue 1** | Dinamo Tbilisi → Rustavi → Lokomotiv Moscow → Rubin Kazan → Dinamo Batumi → Napoli → Paris Saint-Germain |

Exactly two players per league, and — the part that matters — **every league is
represented in the answered nine as well**, so the claim does not rest on the one
rung the video refuses to resolve. Nothing on screen announces the structure; the
card shows clubs, not competitions. It is why the deck can carry the premise, not
a thing the viewer is asked to notice.

### `one-squad` — "THE DRAFT BOARD"

Ten players a drafter could pick this month, cast in the **shape of a squad**
rather than a highlight reel — one keeper, three defenders, three midfielders,
three forwards. `number-ones` proved a positional deck reads as a different
puzzle even though the card never states a position; the shape is felt, not
announced.

| # | tier | player | pos | path |
|---|---|---|---|---|
| 1 | EASY | Rodrygo | FWD | Santos → Real Madrid |
| 2 | EASY | Alphonso Davies | DEF | Vancouver Whitecaps → Bayern Munich |
| 3 | MEDIUM | Mike Maignan | GK | Lille → AC Milan |
| 4 | MEDIUM | Federico Valverde | MID | Peñarol → Deportivo La Coruña → Real Madrid |
| 5 | MEDIUM | Alessandro Bastoni | DEF | Atalanta → Parma → Inter Milan |
| 6 | HARD | Frenkie de Jong | MID | Willem II → Ajax → Barcelona |
| 7 | HARD | Bruno Guimarães | MID | Audax → Athletico Paranaense → Lyon → Newcastle United |
| 8 | HARD | Rasmus Højlund | FWD | Copenhagen → Sturm Graz → Atalanta → Manchester United → Napoli |
| 9 | IMPOSSIBLE | Serge Gnabry | FWD | Arsenal → West Bromwich Albion → Werder Bremen → Hoffenheim → Bayern Munich |
| **10** | **IMPOSSIBLE** | **withheld** | **DEF** | Gyeongju KHNP → Jeonbuk Hyundai Motors → Beijing Guoan → Fenerbahçe → Napoli → Bayern Munich |

### Rung 10, both editions

Obscure head so it isn't free, famous tail so the answer is reachable:

- `five-leagues` — four clubs nobody outside Georgia and Russia can place, into
  Napoli → PSG. It is also the Ligue 1 slot of the second pass.
- `one-squad` — a Korean power-company side and a Chinese one, into Napoli →
  Bayern Munich.

### Traps checked

- **The known duplicate-id pattern.** `cp-alisson` and `cp-alisson-becker` are
  the same man and BOTH were unspent; `five-leagues` takes `cp-alisson` and
  `cp-alisson-becker` stays unspent and unusable. Same shape as batch 2's
  `cp-marcelo` / `cp-marcelo-vieira`. Every one of the 20 picks was checked
  against the ledger by id, and the ledger does not know these are aliases — the
  check that catches it is casting, not tooling.
- **Consecutive-duplicate clubs** (the Gullit rendering-bug pattern, batch 2 §2).
  All 20 paths were scanned; none carries a club twice in a row. This did drop a
  candidate: Alexis Mac Allister's path starts `Argentinos Juniors → Argentinos
  Juniors`, which reads as a bug on the card.
- **Scott McTominay was cast and then dropped**, for the rail rather than the
  path: every answer in the lane is set all-caps, and "MCTOMINAY" reads as a
  typo while "McTOMINAY" would be the only mixed-case name across 100 rungs.
  Pulisic covers the same Serie A slot with no such cost. Same principle as
  dropping Gullit — do not ship something that reads as a rendering bug.

## 3. The one copy change, and where it lives

The closer becomes **"Draft them for real. THE WEEKEND — link in bio."**

The comment asks do **not** leave. `? / 9` at 168pt and `AND NUMBER 10` at 86pt
stay on the CTA card exactly as batch 2 shipped them, and both captions still
lead with the score. What changes is what the **voice** spends its last three
seconds on, because the card cannot say this and the caption is read after the
fact.

`five-leagues` also opens on the mode's pitch — **"Ten career paths. Five
leagues. One squad."** — where `one-squad` keeps batch 2's `open2`. Two editions
opening on the same slogan would read as a template, and `one-squad`'s deck makes
the same argument by casting.

### The wordmark, and the 3.00s it is allowed

THE WEEKEND's wordmark appears on the CTA card and nowhere else in the piece, so
its total exposure is that card's own 90f / **3.00s**. It is set in brand type
(`FONTS.head`, the same face the campaign's own stinger sets it in) over the
existing ink ground in campaign lime — the standing no-imagery rule covers logos
as much as crests and likenesses, and lime-on-ink is the campaign's palette
rather than a new one. `CAREER PATH · VERVEQ.COM` stays under it, so the clean
URL is still the last line of the end card, and the in-run CTA strip carries
verveq.com for the other 75 seconds.

### `campaign` is a third orthogonal field

Batch 2 established that `batch` (the surface) and `grid` (the cadence under
test) have to be independent. Batch 2.5 needs a third axis for the same reason
and could not reuse either:

- gating the swap on **`batch`** would have invented a batch 3 and dragged a
  whole surface set behind a copy change — the precise thing that would
  contaminate the cadence A/B still running underneath;
- gating it on **`grid`** would have welded a campaign to a pace.

So `Edition.campaign?: "weekend"` gates exactly two things: the closing VO key
(`cta2` → `cta3`) and the wordmark block. Nothing else in the piece reads it.

## 4. Captions, and which link they assume

Batch 2's caption shape is intact, including the order it fought for — score ask
first (typeable by someone who bailed at rung 4), withhold second (only typeable
by someone who reached 68s). The campaign paragraph is a **third** block, after
both asks and before the `verveq.com` line: it never displaces a comment ask,
because the comment is what ranks the post and the waitlist click happens to
people who have already stopped scrolling.

**Which link, and which path.** The video says "link in bio" and the card says
LINK IN BIO, so what a viewer actually reaches is the **channel bio link**. Every
link in these captions lands on **`/weekend`**, not the bare `/`.

That is not a preference. `WKND-FUNNEL` (`ea66823`, landed while this batch was
being cut) added `app/src/lib/weekendDeepLink.ts` and names this batch in its own
docstring — it exists because the bare `/` is a **measured** dead end. A
signed-out visitor on `/` gets the cold-entry taste round, which carries no
WEEKEND card at all, so reel traffic could not reach the waitlist without first
playing a round and tapping through to Home. The 30-day read behind it: **5
Instagram visitors, 4 saw the card, 0 tapped.** `/weekend` lands on Home with the
teaser pinned to the top of the first screen, behind the build flag only — no
session guard, no account, no round. Attribution survives the hop:
`weekendShortLinkTarget()` preserves incoming params and the teaser reads
`utm_source ?? ref`, so these tags reach every waitlist event the visit produces.

The per-asset tagged links in each caption's `LINKS` block are for the placements
that take their own URL — IG story sticker, YouTube description, an X cross-post
— and carry `utm_content=ladder-long-five-leagues` / `-one-squad` so a join from
this quiz is separable from a join from the stinger.

> **BLOCKING for the owner, and it is now a different job than it was this
> morning.** `campaign/kits/bio-links-kit.md` still points all four channel bios
> at the bare `/` — the surface `WKND-FUNNEL` just proved cannot reach the card.
> Pasting that kit as written does **not** unblock these two: "link in bio" would
> land on the taste round. The bios need `https://verveq.com/weekend?…` with the
> same tags. The captions print the bio link they assume at the top of their
> `LINKS` block so it can be checked against the profile before posting.
>
> Out of scope for this ticket and left for the owner's call: the kit itself, and
> `weekend/captions.mjs` (the stinger's and manifesto's links), which point at the
> same bare `/` and have the same problem. Repointing those changes assets that
> are already posted, which is a campaign decision rather than a batch one.

Campaign rules honoured: launch copy says "late August" and never a date (CT-1),
no sim-tunable number appears anywhere (shapes, not constants), no invented
football facts — the club paths are verbatim and nothing asserts honours, counts
or appearances. `#fpl` is not used; these are TikTok/IG/YT captions and A2 keeps
FPL to X copy.

## 5. Verification

**Batch 1 and batch 2 are untouched, proven not asserted.** `all-timers`
(batch 1), `number-ones` (batch 2 control) and `old-guard` (batch 2 fast) were
re-rendered from this branch and are **byte-identical MP4s** — whole file, video
*and* audio — to the cuts sitting in `out/2026-08-05/` from before this ticket.

**The SFX generator is edition-neutral.** All eight pre-existing beds were
regenerated from `HEAD`'s `ladderlong-audio.mjs` in a clean worktree and from
this branch's, and all eight md5s match. Adding two editions to the table does
not perturb the others' beds. (This is the check batch 2 §5 says to run against
the *generator*, never against an old MP4 — batch 1's posted audio stopped being
reproducible under `bec8ab1` and that is still true and still unrelated.)

**Frame counts.** `five-leagues` and `one-squad` both resolve to **2340f /
78.00s**, the batch-2 7.00s length. Batch 1 still 2280f; batch 2's fast arm still
1890f.

**The withhold holds.** Rung-10 answers appear in **zero** captions, **zero**
filenames, **zero** VO lines (both ANSWERS arrays are nine long by construction)
and never on the rail, which holds `?????` through the follow card and the CTA.
Checked by string search across `captions.mjs`, `ladderlong-vo.mjs`, `vo.json`,
the rendered `.txt` files and the output filenames.

**Coverage.** `checkCoverage()` passes on 108 lines across 10 editions — nothing
scripted that is never played, nothing played that is never scripted.

### VO placement, verified — and the method batch 2 documented does not work here

"The voice is in there" is not proof it landed where it should. Batch 2 differenced
each render against its own pure SFX bed, scaling the bed by the least-squares gain
that best explains the render and calling the leftover energy the voice. Run in the
**sample domain** on these renders, that fit **collapses**: it returns a gain of
**−0.039**, i.e. it concludes the bed explains nothing. The render is AAC at 48k
stereo and the bed is PCM at 44.1k mono, so decoding and resampling shift sample
phase, and sample-wise correlation of broadband content dies with a fraction of a
sample of skew. A "difference" against a bed scaled by ~0 is just the render, and
every cue would have "passed" on the bed's own slams.

Redone in the **envelope domain** — 100ms RMS of both, gain fitted on the
envelopes, which is what "at 100ms resolution" has to mean for the check to be
sound — the fit behaves: **gain 0.85**, the bed explaining most of the render, and
the residual is the voice.

**22/22 cues carry voice energy on frame in both editions**, 44/44 across the
batch: `open3`/`open2` at 0.00s, each count-in on its rung boundary, each answer at
`answerAt`, `withhold`, `follow` and `cta3` on their cards. Baseline is the median
off-cue residual.

The weakest margin is `n6` — 11.2× and 10.5× — an order below its neighbours, so it
was checked rather than waved through. **Control: the shipped, already-verified
`number-ones` scores `n6` at 10.6× under the identical implementation.** The three
editions share that take and that grid, and rung 6's boundary sits under a club-slam
run, so more of the bin is bed and the scaled bed subtracts more of it. The dip is a
property of the measurement, not of these renders. Every other cue sits between 28×
and 169×.

## 6. VO — done, cached, offline from here

**20 lines generated** — 18 answers + `open3` + `cta3` — with the 88 existing
lines served from cache and not re-billed. Final: **108/108 fit, zero overruns.**

| line | slot | budget | measured | |
|---|---|---|---|---|
| `open3` | open | 5.00s | **4.48s** | fits |
| `cta3` | cta | 3.00s | 4.72s → **2.72s** | re-taken |
| 18 × answer | answer | 2.00s | 0.64–1.68s | all fit first time |

**All 18 answer names fit first time**, 0.64s ("Vitinha.") to 1.68s ("Alphonso
Davies." / "Bruno Guimarães.") against a 2.00s slot. `open3` had room by
construction — it is spoken only by the control arm, so it gets the full 5.00s
rather than the 3.50s that forced `open2`'s rewrite.

### The one throw, and what it actually taught

`cta3` overran as predicted, but **not for the predicted reason, and that is the
part worth keeping.**

```
4.72s / 3.00s   "Draft them for real. THE WEEKEND — link in bio."   10w, 3 breaks
2.72s / 3.00s   "Draft them for real. Link in bio."                  7w, 2 breaks
```

The prediction was ~3.5s on a words-per-second rate. It came back at **4.72s**,
+1.72s over. Fitting a two-term model to this voice's own measured carrier
(`cta` 7w/1 sentence 2.08s, `follow` 3w/1 1.68s, `open2` and `cta2` both 5w/2 at
2.64s and 2.72s) gives **~0.93s per sentence boundary and only ~0.16s per word**.
The missing ~1.2s is the em dash and the capitalised "THE WEEKEND": Charlie reads
a dash as a full stop and gives an all-caps proper noun its own emphasis beat.

The re-take **confirms the model rather than merely clearing the slot**: 2.72s is
the *exact* duration of `cta2` ("Your score? And number ten?"), which is two words
*shorter* at the same two boundaries. Dropping three words and one boundary bought
2.00s, and the words were worth about a quarter of it.

So there is a second rule alongside batch 2's, and it is the one that would have
made the first prediction right:

> **Punctuation is the expensive part of a slot, not length.** Prose written to
> this carrier should reach for the fewest sentence boundaries, not the fewest
> words — and an em dash costs a full stop.

The cut itself is still batch 2's rule (cut whatever the screen is already
saying — the card carries the wordmark in 96pt lime while the line plays). Both
halves of the ask survive: the instruction and the pointer.

The answer takes follow batch 1's paid-for lesson a third time: a surname of three
or more syllables goes alone, a one- or two-syllable surname is given its first
name because Charlie draws a short lone word out ("Gerrard." 2.32s vs "Steven
Gerrard." 1.36s). So Kimmich, Davies, Maignan, Højlund, Gnabry and Olise are named
in full; Carvajal, Pulisic, Alisson, Vitinha, Vlahović, Raphinha, Rodrygo and
Bastoni are not. The rule held: the six full-name takes average 1.44s and the
eight lone surnames 0.94s, with no lone surname anywhere near the slot.

## 7. Renders

```
out/2026-08-05/verveq-ladder-long-five-leagues.mp4   78.00s  5.76 MB  (+ .txt)
out/2026-08-05/verveq-ladder-long-one-squad.mp4      78.00s  5.77 MB  (+ .txt)
```

1080×1920, 30fps, h264 + AAC, 2340f each. Narrated and postable once the bio
links are repointed (§4).

The byte sizes are unchanged from the silent proofs, which is expected and not a
sign the re-render did not take: the video stream is identical (the VO changes no
pixels) and the AAC track is constant-bitrate over an unchanged duration, so a
track carrying voice and a track carrying silence weigh the same. The evidence
that the voice is there is §5's envelope check, which ran against these files.

## 8. What did NOT change

Both standing divergences from the winner spec still stand and still deserve
flagging when the A/B is read:

- **No player imagery.** Spec #20 found 4/4 winners use real subject imagery at
  the reveal. The no-likenesses/no-crests rule holds, and it now also covers the
  campaign wordmark, which is type rather than artwork for the same reason.
- **No trending sound.** Spec #11 found 4/4 winners on original audio, and a song
  over a VO fights the voice this format is paced by. Post these with their own
  audio, ignoring the README's daily workflow step.
