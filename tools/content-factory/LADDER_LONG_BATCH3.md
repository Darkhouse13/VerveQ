# LADDER-LONG — batch 3, the SLATE_AUG15-31 run (2026-08-14, LADDER-LONG-B3)

Eleven editions rendered, **narrated, complete** — the slate's nine banker rows
(1, 3, 4, 6, 9, 11, 12, 14, 16) plus the two WEEKEND-cast rows (8, 15).
Ninety-nine new VO lines generated against the owner's `FAL_KEY` and cached to
`promo/vo-cache-ladderlong/` — the cache now holds all **216** lines and
renders are offline from here.

---

## 1. What batch 3 is

Three things, and only three, move against batch 2's frozen spec:

**(a) Eleven new decks**, cast to the slate's themes. All on GRID_7 — the
standing pace since the cadence A/B reported (docs/DECISIONS.md, 2026-08-10) —
so nothing here touches the retired 5.50s arm.

**(b) `batch: 3` — burned native-style subtitles**, the one new surface.
MONID-SWEEP-2 measured the niche: **89% (31/35) of coded winners carry
subtitle-style captions on screen; we carried none** (−89pt, the largest gap
in the study). The treatment is **the DILEMMA-resolved one, adopted verbatim**
(now recorded in docs/DECISIONS.md 2026-08-14 "Native subtitles"; this
batch's first cut shipped a divergent word-pop version parked mid-frame and
was redone the same day against that ruling):

- **Chunks shown whole** — a word-timed chunk lands as one readable block,
  broken on terminal punctuation or at 4 words (the auto-caption cadence),
  never accumulating word-by-word. One overlay for the whole piece, driven by
  absolute frame, with the DilemmaV2 bridge rule (a chunk holds to the next
  chunk of its own cue; 8f release when the voice stops).
- **Bottom-centered inside SafeArea** — the platform-caption position, on
  every surface of the piece (rungs, follow card, CTA). The batch-3 score
  rail lifts 14px (1472 → 1458) so the band has its own strip; posted batches
  keep their shipped geometry.
- **Style**: sentence case, `FONTS.body` 700 / 46px, white on a four-corner
  black stroke, maxWidth 880 — deliberately NOT brand type, the lane's one
  exemption from the cream/ink/brand-type law.
- Because the manifest text IS the TTS input, the subtitle can never drift
  from the audio, and a withheld rung can never leak through a caption —
  rung 10 has no take.

Subtitles ride `batch` exactly the way the score rail and follow card did:
gates read `>= 2` / `>= 3`, so batch 3 inherits batch 2's whole surface set
and the eleven already-posted editions stay bit-stable (verified, §5).

**(c) The two campaign editions reuse the cached campaign lines.**
`five-leagues-2` opens on `open3` ("Ten career paths. Five leagues. One
squad.") and both close on `cta3` ("Draft them for real. Link in bio.") — the
ticket's "already cached or one new line" resolved to **zero new lines**: THE
WEEKEND is live and the cached copy is live copy. Captions updated to LIVE
language (no waitlist, no date — CT-1 stands) and the tagged links still land
on `/weekend`.

## 2. Casting

**110 fresh ids, zero collisions** with the 180 already in `ledger.json` nor
with any id cast in a timeline, all ≤7 clubs, whole paths verbatim from
`football_career_paths.json` (loans flattened, as every batch). Tier =
difficulty of the **path**; shape is the standing 2/3/3/2 + withheld.

Traps checked, per standing law:
- **Alias families**: `cp-marcelo-vieira`, `cp-alisson-becker`,
  `cp-ederson-moraes` (all duplicates of spent men) detected by token-subset
  scan and left unspent/unusable. `cp-diego`, `cp-juan`, `cp-raul-jimenez`,
  `cp-abedi-pele` matched the scan but are different people — usable, none
  needed.
- **Consecutive-duplicate clubs (Gullit)**: all 1,144 unspent paths scanned;
  this dropped **Mac Allister** (Argentinos Juniors ×2 head) and **Gvardiol**
  (Dinamo Zagreb ×2 head) from candidacy.
- **All-caps rail (McTominay)**: no Mc-prefix surname cast.

| # | s-a-kings | one-club | bosman | absurd-loop | cup-final | journeymen | nines | england | goat | five-leagues-2 | differentials |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 E | Kaká | De Rossi | Ballack | Rashford | Götze | Cavani | Icardi | Ferdinand | Puskás | Pedri | Mbeumo |
| 2 E | Zico | Kahn | Rüdiger | Grealish | Solskjær | Kluivert | Núñez | Gordon | Van Persie | Goretzka | Kudus |
| 3 M | Cafu | Lahm | Pogba | Hummels | Origi | João Félix | Mitrović | Eze | Roy Keane | M. Thuram | Cunha |
| 4 M | Batistuta | Terry | Gündoğan | Pepe | Coman | Nasri | Šeško | Carrick | Bale | Szoboszlai | Watkins |
| 5 M | Firmino | ter Stegen | Depay | Fernandinho | Milito | Schürrle | G. Barbosa | Lallana | Cannavaro | Balogun | Olmo |
| 6 H | Zanetti | Del Piero | Wijnaldum | Overmars | F. Inzaghi | Okocha | Élber | Welbeck | Cruyff | Christensen | Kepa |
| 7 H | Sócrates | Valdés | Szczęsny | M. Gómez | Mijatović | Witsel | Zapata | G. Barry | Di Stéfano | Schick | Douglas Luiz |
| 8 H | Lavezzi | Chiellini | Flamini | Rui Costa | Brehme | Sommer | Retegui | Walcott | Bobby Moore | Nkunku | Xhaka |
| 9 I | Júlio César | Montella | Mata | Rijkaard | Panenka | Hamšík | Ian Wright | Downing | Garrincha | Gallagher | Lo Celso |
| **10 I** | **Juninho P.** | **Aspas** | **Cambiasso** | **Maxi Rodríguez** | **Šmicer** | **Trossard** | **Di Natale** | **Seaman** | **Souness** | **Ndombele** | **Semenyo** |

Rung-10 law held everywhere — obscure head, famous tail:
Sport Recife → Lyon; Celta → Liverpool → Celta; Independiente → Real Madrid →
Inter; Newell's ×3 (he goes home **twice** — the absurd-loop hook, per the
Anderlecht precedent's hunt); Slavia Prague → Liverpool (Istanbul 2005);
Genk → Lommel ×2 → Arsenal; Empoli → Iperzola → Udinese; Peterborough →
Arsenal; Spurs (the start nobody remembers) → Liverpool; Amiens → Spurs;
Highworth Town → Manchester City.

Theme claims that go beyond the dataset (Bosman frees, cup-final receipts)
are **casting claims verified per man** in the Edition comments — the dugout
precedent — and captions state shapes, never fees, counts or honours.
`never-left-england` was verified club-by-club against the English pyramid
(it is why Grealish plays in the loop deck, and no Swansea/Cardiff path was
cast). `absurd-loop`: all ten paths loop. `journeymen-deluxe`: all ten rungs
are full 7-club cards. `five-leagues-2`: two passes through the five leagues
in the same order, every league represented in the answered nine (Balogun
carries Ligue 1's answered slot).

**Recognition note for the weekend rows**: `differentials` is cast to the
slate's own brief ("draftable players casuals don't know") — the names are
S-tier *for the football-native audience this lane serves* (Kepa, Xhaka,
Watkins), with the difficulty living in the routes. Flagged so the read isn't
mistaken for a casting-law drift.

## 3. Parser + gate changes (small, listed whole)

- `ladderlong-grid.mjs`: slug regex now admits digits (`five-leagues-2`);
  batch 3 legal in validation; `followFrames` gates `>= 2`.
- `timeline.ts` / `vo.ts` / `ladderlong-vo.mjs` / `LadderLong.tsx`: `batch
  1|2|3`, `b2` gates read `>= 2`, subtitles `>= 3`; `open3` keyed to both
  five-leagues slugs.

## 4. VO — 99 billed, 117 reused, zero overruns

The whole carrier is served from cache — `open2`/`open3`, all count-ins,
`withhold`, `follow`, `cta2`/`cta3` — **not re-billed**. The 99 new lines are
answer names only, all against the 2.00s answer slot (pace-independent by
construction, and only GRID_7 speaks in this batch).

**99/99 fit first time; final 216/216 fit, zero overruns.** Range 0.64s
("Zapata.", "Retegui.", "Pedri.") to **2.00s exactly** ("Ian Wright." — the
one take at its budget to the frame; the fit check passed it and the answer
hold is the full slot, recorded here as the batch's tightest line). The
syllable law (3+ syllable surname alone, 1–2 syllable takes a first name,
mononyms alone per "Xavi.") predicted every duration band. Disambiguating
first names were kept even where length allowed a lone surname: "Filippo
Inzaghi." (Simone), "Rio Ferdinand." (Les/Anton), "Marcus Thuram."
(Lilian/Khéphren), "Roy Keane." (Robbie).

## 5. Verification

**Bed neutrality, generator-vs-generator.** All 11 pre-existing SFX beds were
force-regenerated from `HEAD`'s `ladderlong-audio.mjs` in a clean worktree AND
from this branch's into a scratch dir: **11/11 md5-identical**. Adding eleven
editions to the table perturbs no existing bed (per-slug seeding, as
designed).

**Frozen batches are untouched, proven not asserted.** `all-timers` (batch 1),
`number-ones` (batch 2 control), `old-guard` (batch 2 fast) and `dugout`
(post-A/B) were re-rendered from this branch: all four are **byte-identical
MP4s** — whole file, video and audio — to the cuts in `out/2026-08-05/` /
`out/2026-08-11/`. The 99 new manifest lines and the subtitle surface reach no
batch ≤ 2 edition.

**Frame counts.** All eleven resolve to **2340f / 78.00s** (batch-2 7.00s
length: 9×210 + 300 + 60 + 90).

**The withhold holds.** Rung-10 answers appear in **zero** captions, **zero**
filenames, **zero** VO lines (all ANSWERS arrays nine long by construction),
never on the rail (`?????` through both closing cards) — and, new this batch,
**zero subtitle frames**, which follows from the same construction: subtitles
render only manifest words, and rung 10 has no take. Checked by string search
across `captions.mjs`, `ladderlong-vo.mjs`, `vo.json`, the rendered `.txt`
files and output filenames for all eleven withheld surnames.

**VO placement, envelope-domain** (the batch 2.5 method — 100ms RMS
envelopes, bed scaled by least-squares gain, residual = voice): **22/22 cues
carry voice energy on frame in all eleven editions** (242/242). Fitted gain
0.79–0.82 across the batch (the bed explains the render, as it must for the
residual to mean "voice"), and the weakest margin anywhere is **73.5×** the
median off-cue residual (`journeymen-deluxe` `n2`) — every edition's weakest
cue sits between 73× and 82×, an order above the 10.5× that passed after
being checked in batch 2.5. Nothing is marginal.

**Subtitle QA on stills**: band bottom-centered in SafeArea on all three
surfaces (rung, withhold, CTA), clear of the lifted score rail; whole-chunk
display never exceeds one line at the 4-word cap.

## 6. Captions

Batch-2 law: score ask first, withheld path second (verbatim, name nowhere),
daily line, tags. Theme hooks lead where the deck verified them (dugout
precedent). The two campaign captions carry the LIVE block third — "THE
WEEKEND is LIVE… Pick for real → link in bio", no date, no waitlist — and
`wkndLinks()` per-placement tagged URLs (`utm_content=ladder-long-<slug>`),
all landing on `/weekend`.

## 7. Renders

```
out/2026-08-14/verveq-ladder-long-south-american-kings.mp4   78.00s  6.48 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-one-club-almost.mp4        78.00s  6.22 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-bosman-bargains.mp4        78.00s  6.61 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-absurd-loop.mp4            78.00s  6.64 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-cup-final-men.mp4          78.00s  6.49 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-journeymen-deluxe.mp4      78.00s  6.65 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-number-nines.mp4           78.00s  6.44 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-never-left-england.mp4     78.00s  6.80 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-goat-tier.mp4              78.00s  6.66 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-five-leagues-2.mp4         78.00s  6.56 MB  (+ .txt)
out/2026-08-14/verveq-ladder-long-differentials.mp4          78.00s  6.60 MB  (+ .txt)
```

All 1080×1920, 30fps, h264 + AAC, 2340f (ffprobe-counted, 11/11). The four
frozen-batch identity re-renders were deleted from the date folder after
their md5 comparison so it holds only the eleven postables.

Posting map (slate §3): south-american-kings Fri 15 · one-club-almost Sun 17 ·
bosman-bargains Mon 18 · absurd-loop Wed 20 · five-leagues-2 Fri 22 ·
cup-final-men Sat 23 · journeymen-deluxe Mon 25 · number-nines Tue 26 ·
never-left-england Thu 28 · differentials Fri 29 · goat-tier Sat/Sun 30–31.

## 8. What did NOT change

- **No player imagery** (spec #20 divergence stands — answers land as brand
  type on the lime chip).
- **No trending sound** (spec #11 — post with their own audio; narrated
  format, standing rule).
- Posting order and dates are the slate's; GW-dependent caption facts (none in
  this lane) unaffected.
