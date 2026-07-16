# THE DRAW — real card set "real-v1" (Tickets E1 + E1.1) — BUILD NOTES

**Built:** 2026-07-16 · **Candidates:** 430 (400 expected to survive E2 verification)

**Files**
- `drawCardsReal.candidates.json` — the card data
- `drawCardsReal.dossier.json` — per-fact provenance, for blind verify
- `ownerPositionRulings.json` — the 25 owner position rulings (E1.1)
- `playersSourced.json` — the canonical sourced layer these are selected from
- this file

Engine untouched (CONTRACT v1.0, frozen). No app code. Nothing imports these
yet; seeding under a new `setVersion` is a later ticket.

---

## 0. What E1.1 changed

E1 shipped 430 cards, but it derived four corrections **in the card build**,
leaving the canonical `playersSourced.json` still carrying the bugs. That is a
drift trap: the file every other consumer reads disagreed with the card set, and
nothing would have caught it. E1.1 moves every correction **upstream into the
ingest rules**, so the canonical file, the ingest script and the dossier now tell
one story.

| # | E1 (post-hoc, in the card build) | E1.1 (in the rules) |
|---|---|---|
| debutYear | card build re-derived it from the fetch cache | `cp-emit` derives it from P54/P580 + a P569 age floor; `cp-facts` fetches P569 |
| non-club entities | card build filtered the city of Barcelona out | `cpIsClubEntity` allow-list in the ingest |
| nation | card build overrode 8 Basques via P1532 | `cpIsSeniorNationalTeam` excludes non-FIFA regional sides — the bug is gone at source |
| position conflicts | card build applied the ruled rule | `cpMapPosition` applies it; canonical and cards agree |
| Maldini | card build annotated the ruling | `playerAdditions.json` carries a QID-pinned `ownerRuling`; the gate resolves him |

**Asserted, not asserted-by-hand:** `cp-assert` re-runs the emit in memory and
diffs it against the committed `playersSourced.json` (ignoring `retrievedAt`).
It is pure and offline, so it is safe in CI. The card build additionally asserts
the dossier agrees with the canonical file on **every fact** — nation, position,
debutYear and club membership — for all 430 cards. Both pass.

```
npx tsx scripts/ingestWikidataPlayerData.ts cp-assert
  -> cp-assert OK: committed file reproduces exactly (1314 players, modulo retrievedAt)
```

### Owner rulings this build depends on

| # | Ambiguity | Ruling |
|---|---|---|
| 1 | Ticket path `scripts/data/` is gitignored | Write to `app/convex/data/` + whitelist |
| 2 | `debutYear` included youth clubs (Messi read age 8) | Fetch P569, recompute against an age-16 floor |
| 3 | D2's "1960s–2020s" excluded 15 pre-1960 icons | Oldest era bucket is open-ended below |
| 4 | Maldini Q483027 unresolvable by club anchor | **GREEN** — Q483027 is Paolo. Recorded in both files |
| 5 | 48 conflicting equal-rank P413 positions | Specificity + attack precedence (§4) |
| 6 | 25 cards whose ONLY P413 value is "wing half" | **18 → ATT, 7 → MID**, per card, editorial (§4a) |

---

## 1. Source and selection (S1)

Input: `app/convex/data/playersSourced.json` (1314 records, Wikidata CC0,
per-fact provenance), which the card build now reads **exclusively** for facts.

```
1314 canonical records
 -12  duplicate QIDs collapsed (same player under two names)
 = 1302 distinct players
 -13  dropped, fail-closed (§9)
 = 1289 selectable
 -859 not selected
 =  430 candidates
```

**Fame is the selection criterion**, ranked on Wikidata sitelink count — the
number of Wikipedia language editions carrying an article. Objective,
reproducible, and already the fame proxy in `ingestWikidataPlayerData.ts`
(`sitelinks>=50`). No fame field exists anywhere reachable in the repo
(`playerQualityProfiles.json` has `fameScore` but lives in the gitignored,
absent `scripts/data/`). `fameRank` stays EDITORIAL — sitelinks are its
documented backbone, not a sourced fact.

| tier | cards | share |
|---|---|---|
| retired icons & legends | 150 | 34.9% |
| active stars | 195 | 45.3% |
| cult heroes / journeymen | 85 | 19.8% |

---

## 2. Facts vs editorial

**FACTS** (sourced, one dossier entry each, Wikidata CC0 — the §3 preferred
backbone of `CIE_SOURCING_POLICY`; GREEN/static under §4's sports-records row,
so one authoritative structured source suffices per §6):

- `nation` — senior national team via P54, else P1532, else P27
- `position` — P413, resolved by the §4 rule
- `debutYear` — P54/P580 floored by P569
- club membership — P54. *Membership is the fact; which ≤3 to print is not.*

**EDITORIAL** (VerveQ's own, unverified):

- `rating` — derived (§6); not a claim about the player
- `fameRank` — sitelink-backed editorial ordering
- **which** ≤3 clubs are listed — longest sourced first-team tenure
- `tag` / `displayCode` / `fullName` — text rendering of a sourced club identity
- **24 positions marked `provenance: "editorial-ruled"`** (§4a) — the owner's
  ruling *and* the sourced value it overrules, side by side

No stats. Asserted mechanically: no card carries a number that is not a year, a
rating, a fameRank or an eraIndex, and no stat-shaped key exists in the dossier.
Text club names only — no badges, crests or likenesses.

---

## 3. `debutYear` — definition and the youth-club correction

**Definition (verifiable exactly against Wikidata):**

> the earliest P54 club-membership **start year** at which the player was aged
> ≥16 (P569), counting reserve/B sides (senior league football), excluding
> national and age-group teams.

E0 emitted `min(P54 start)` with no age floor. P54 covers a player's whole club
history *including the academy*, so **71 of 1308 players (5.4%) had an
impossible debut** — Messi 1995 (aged 8), Pelé 1953 (13), De Bruyne 1995 (4),
Eriksen 1995 (3). P569 is now fetched for all 1302 QIDs (100% coverage) and
`cp-emit` applies the floor: **401 values changed; the under-16 population is
zero** (ages at debut now span 16–29).

Spot-checked against widely-cited senior debuts: Pelé 1956 ✓, Cristiano Ronaldo
2002 ✓, Zidane 1989 ✓, Beckham 1992 ✓, De Bruyne 2008 ✓, Piqué 2004 ✓,
Fàbregas 2003 ✓, Buffon 1995 ✓, Maldini 1985 ✓, Maradona 1976 ✓, Cruyff 1964 ✓.

**Known residual (≤2 years, systematic, not a defect):** P580 records *when the
player joined the club*, which for a few precedes their first senior appearance
— Messi 2003 (Barcelona C, genuine Tercera División football) vs the commonly
cited 2004; Busquets 2006 (Barcelona C) vs 2008. The emitted value is exactly
what the definition yields, so E2 can blind-verify it without judgement. It is
**not** "date of first appearance" and must not be labelled as such in UI copy.

### Why two different club filters exist

This is the subtle part, and getting it wrong silently deletes careers.

- **debutYear counts reserve/B sides.** They are senior league football. Exclude
  them and the only survivor is the academy-poisoned first-team span: Busquets'
  Barcelona membership is P580 = **2000**, his age-12 academy entry, running to
  2023 — so an age filter alone drops it and reads him as debuting in **2023** at
  Inter Miami.
- **Club listing excludes reserve/B sides** (never iconic) but **keeps** a
  membership that merely *starts* early, because of the same academy-entry
  modelling. A membership that both starts *and ends* before age 16 is dropped:
  Messi's Newell's Old Boys spell (1995–2000, ages 8–13) is a real P54 statement
  about a real senior club he never played a senior minute for, and the ticket's
  fact is "has played senior football for this club".

E0 had one predicate for both, and its `CP_YOUTH_TYPE_RE` carried
`reserve team` — so the first attempt at splitting them still read Iniesta as
debuting in 2002 rather than 2001, because FC Barcelona Atlètic was classed as
youth. The type regexes are now split too (`CP_AGEGROUP_TYPE_RE` vs
`CP_RESERVE_TYPE_RE`).

---

## 4. `position` — the P413 conflict rule

89 selected players carry >1 P413 value and **ranks cannot disambiguate**
(`wdt:` is already rank-filtered; only 6 of 529 statements are `preferred`).
**Order cannot either** — Ronaldo lists `wing half` *before* `forward`. E0
resolved conflicts with a `GK > DEF > MID > ATT` precedence it documented as
"arbitrary and carr[ying] no claim of correctness", explicitly deferring to E1.
That precedence always picks the least-attacking bucket, which emitted Messi,
Cristiano Ronaldo, Pelé, Maradona, Cruyff, Salah and Rooney as **MID** and
skewed the pool to 504 MID / 434 ATT.

The ruled rule, now in `cpMapPosition` (so canonical and cards agree):

1. Drop `coach`.
2. **Artifact** — discard `wing half` when the player debuted ≥1950 **and**
   another value survives. It is a 1930s half-back role that Wikidata editors
   use for modern wingers. Fired on 13 cards.
3. **Specificity** — specific values (`centre-back`, `full-back`, `winger`, …)
   outrank generic ones (`forward`, `midfielder`, `defender`).
4. **Ties → most attacking** (ATT > MID > DEF > GK).

Ronaldo/Messi/Pelé/Maradona/Cruyff → ATT; Zanetti/Mascherano/Alexander-Arnold →
DEF. Every conflict stays `sourceQuality: "amber"` (46 cards) with its raw
`statements` and `candidates` recorded. The pick is still **not a sourced
verdict**.

### 4a. The 25 solo `wing half` cards — owner-ruled (E1.1)

25 selected cards had `wing half` as their **only** P413 value. That is not a
conflict — Wikidata's P279 tree says wing half ⊂ midfielder, so the sourced
position is MID at *green* quality and nothing flags it. Rule (2) cannot fire:
there is nothing to fall back to. E1 shipped them as sourced MID and flagged the
problem, because overriding a sole source is an opinion, not a fact.

The owner ruled all 25 in `ownerPositionRulings.json` (`ruledOn: 2026-07-16`):
**18 → ATT, 7 → MID**. Each carries a per-card note. 24 are in the final set
(Solskjær is not — see §7).

- **→ ATT (17 in set):** Neymar, Gareth Bale, Franck Ribéry, Ángel Di María,
  Riyad Mahrez, Luís Figo, Robinho, Nani, Alexis Sánchez, Dirk Kuyt,
  Antonio Valencia, Ricardo Quaresma, Theo Walcott, Lucas Vázquez,
  Denis Cheryshev, Willian, Jairzinho *(+ Solskjær, ruled but not selected)*
- **→ MID, ruling confirms the source (7):** David Silva, Mario Götze,
  Park Ji-sung, Clarence Seedorf, Santi Cazorla, Maxi Rodríguez, Ibrahim Afellay

**A ruling never edits a fact.** `playersSourced.json` still says MID for all 25.
The card's position is marked `provenance: "editorial-ruled"` and carries
`ruledBy`, `ruledOn`, `note`, **plus `sourcedValue` and `sourcedStatements`
verbatim** — a reader always sees what Wikidata said and that a human overruled
it. Unruled would have meant "keeps the sourced MID"; absence of a ruling is
never read as agreement.

---

## 5. `nation` — non-FIFA regional sides (fixed at the rule)

E1 found **8 Basque Spaniards emitted as `France`** — Xabi Alonso, Zubizarreta,
Llorente, Javi Martínez, Illarramendi, Iván Campo, Mendieta, Julio Salinas — and
patched them post-hoc via P1532. E1.1 fixes the *rule*, so the bug cannot recur:

`cpIsSeniorNationalTeam` now excludes non-FIFA representative sides
(`CP_NT_NON_FIFA_RE`), the same class as the Team GB composite E0 already
excluded. **Q738846 "Basque Country regional football team"** is typed
`men's national association football team`, but its label says *regional*, so
`CP_NT_LABEL_RE` cannot parse a nation from it and the code fell through to P17
— and the Basque Country spans two states, so Q738846 carries **P17 = France**.
With it excluded, Spain is the only senior national team left and Xabi Alonso is
`Spain`, **green, via the ordinary P54 path** — better provenance than E1's
amber P1532 override. Catalonia and Galicia are equally non-FIFA but carry
P17 = Spain, so they were right by luck; they are excluded too, because being
right by luck is not a rule.

**Deliberately scoped.** A blanket "P1532/P27 must corroborate the nation" rule
was tried and **rejected**: it fires on 18 pool records and regresses two classes
E0 gets right — `Joe Cole England → United Kingdom` (P27 is United Kingdom for
every English player: exactly the P17 trap E0 fixed) and
`Jason Roberts Grenada → "Granada"` (a genuine P1532 error naming the Spanish
city). Both keep E0's value.

Still **not** corrected, left amber with candidates for E2: dual internationals
(Wilfried Zaha England/Ivory Coast; Diego Costa Brazil/Spain) and historical
states (Beckenbauer's P1532 is "West Germany"; we keep "Germany"). 16 of 430
nations are amber.

---

## 6. D1 — ratings (identical-by-construction)

`generateCardSet("realset-ratings-v1", {...C13V1_CONFIG.cardGen, setSize: 430})`,
ratings sorted descending, rating *k* → `fameRank` *k*. Only `setSize` is
overridden (50 → 430); every other c13v1 knob is untouched, so the real set's
rating distribution is identical by construction to the tuned one. Asserted
against a fresh generator run, byte-for-byte.

**The multiset** (min 61, max 95, mean 79.286, median 80) — unchanged from E1,
since it is a property of the seed and the size, not of which players are in:

```
95×9  94×20 93×13 92×14 91×11 90×17 89×11 88×11 87×10 86×15 85×15 84×12
83×14 82×15 81×17 80×14 79×7  78×16 77×14 76×22 75×12 74×15 73×8  72×12
71×10 70×6  69×15 68×11 67×12 66×8  65×14 64×14 63×6  62×3  61×7
```

| rating | cards | share |
|---|---|---|
| 60–64 | 30 | 7.0% |
| 65–69 | 60 | 14.0% |
| 70–74 | 51 | 11.9% |
| 75–79 | 71 | 16.5% |
| 80–84 | 72 | 16.7% |
| 85–89 | 62 | 14.4% |
| 90–94 | 75 | 17.4% |
| 95–99 | 9 | 2.1% |

---

## 7. Rebalance after the rulings + Maldini (E1.1 step 4)

The 18 MID→ATT rulings moved the pool to 508 ATT / 442 MID, which would have put
the set at **ATT 147 / MID 111** — far outside ±3pp. The selector enforces the
position quota by construction, so re-running it on the ruled pool restores
43/129/129/129 exactly; the effect is precisely the intended repair, because the
cards it drops are the **lowest-fameRank ATT** and the cards it promotes are the
**highest-fame unselected MID**.

**19 out** (18 ATT + 1 DEF, all low-fameRank):
Robbie Keane, Asamoah Gyan, Nicklas Bendtner, Dimitar Berbatov, Roberto Mancini,
**Ole Gunnar Solskjær**, Antonio Di Natale, Aleksandr Kerzhakov, Jadon Sancho,
Julián Álvarez, Cole Palmer, Anthony Martial, Richarlison, Rodrygo, Ansu Fati,
João Félix, Stephan El Shaarawy, Enner Valencia, Alex Song

**19 in** (18 MID + 1 DEF, by fame):
Claude Makélélé, Thiago Motta, Raul Meireles, Blaise Matuidi, Paulinho,
Marco Verratti, Lorenzo Insigne, Hakan Çalhanoğlu, Declan Rice,
Pierre Littbarski, Rui Costa, Juan Román Riquelme, Alex Oxlade-Chamberlain,
Adrien Rabiot, Leon Goretzka, Federico Chiesa, Takefusa Kubo, Enzo Fernández,
Ferland Mendy

> **Note the self-inflicted casualty.** **Ole Gunnar Solskjær was ruled ATT and
> that ruling pushed him out of the set.** As a MID he cleared the bar; as an ATT
> he competes with 508 candidates for 129 slots and does not. The ruling is still
> right — he is a striker — but it is worth seeing that a position ruling is not
> cosmetic: it decides who is in the set. If the owner wants him back, that is a
> fame-tier call, not a position one.

21 further era-floor swaps ran inside selection (same mechanism as E1: promote
the highest-fame unselected card of an under-floor era, drop the lowest-fame card
of an over-supplied era, **within the same position and tier**, so quotas and
composition stay exact).

Maldini needed no insertion: he was already in the set at E1. The GREEN ruling
resolved his identity, which lifted his facts from amber → **green** (E0's rule
is that every fact inherits an amber identity). He sits at **real_0079**,
rating 90, DEF, Italy, debut 1985, one club — AC Milan.

---

## 8. Histograms vs floors

| floor (S2) | required | actual |
|---|---|---|
| distinct club tags with ≥6 cards | ≥25 | **48** (of 335 distinct) |
| nations with ≥8 cards | ≥10 | **13** (of 57 distinct) |
| every era bucket | ≥40 | **40 / 70 / 132 / 188** |
| every card ≥1 club tag | yes | **yes** (1 card has 1 club, 28 have 2, 401 have 3) |
| positions within ±3pp of generator | ±3pp | **0.00pp on all four** |

### Positions (generator `positionWeights` GK1/DEF3/MID3/ATT3 → 10/30/30/30%)

| pos | cards | share | target | delta |
|---|---|---|---|---|
| GK | 43 | 10.0% | 10.0% | +0.00pp |
| DEF | 129 | 30.0% | 30.0% | +0.00pp |
| MID | 129 | 30.0% | 30.0% | +0.00pp |
| ATT | 129 | 30.0% | 30.0% | +0.00pp |

### D2 era mapping

`eraCount: 4` from `c13v1.cardGen`; `eraBefore: 3` / `eraAtLeast: 3` split at
index 3. `eraIndex` keeps the generator's semantics — **0 = oldest**, ascending.
Bucket = the group containing `debutYear + 5`; bucket 0 is **open-ended below**
(ruling #3), which is what keeps Puskás (1943) and Di Stéfano selectable.

| eraIndex | `debutYear+5` | debutYear | label | cards |
|---|---|---|---|---|
| 0 | ≤1979 | ≤1974 | `1960s-70s` | 40 |
| 1 | 1980–1999 | 1975–1994 | `1980s-90s` | 70 |
| 2 | 2000–2009 | 1995–2004 | `2000s` | 132 |
| 3 | ≥2010 | ≥2005 | `2010s-20s` | 188 |

> **Observation for the owner (not a ticket violation).** 40/70/132/188 is not
> the ~uniform 91/111/105/123 the tuned generator produces. The ticket sets only
> a ≥40 floor, which is met, but **era is a synergy family**: era-chain frequency
> in live play will differ from the c13-1 sim. Worth a sim pass before this set
> is served — which is also the still-owed P0-set requirement from Ticket 0.4
> (≥99.5% natural clear over ≥2000 boards on the pinned production set).

### Nations ≥8 cards

France 46 · Germany 41 · Brazil 38 · England 37 · Spain 35 · Argentina 27 ·
Italy 27 · Netherlands 26 · Portugal 20 · Japan 14 · Belgium 13 · Croatia 8 ·
Denmark 8

### Club tags ≥6 cards (48)

RMA 63 · BAR 51 · JUV 43 · MUN 41 · CHE 41 · BAY 38 · ARS 38 · LIV 33 · MCI 32 ·
INT 30 · MIL 29 · PSG 28 · AJA 21 · BVB 18 · ATM 18 · MON 16 · ROM 16 · TOT 15 ·
OM 14 · EVE 13 · POR 12 · BEN 12 · FIO 12 · NAP 11 · OL 10 · S04 10 · LAZ 10 ·
VFB 10 · PSV 9 · VIL 9 · VAL 9 · BORM 8 · ZENS 8 · WHU 7 · SOU 7 · SEV 7 ·
BAY0 7 · GALS 7 · CORP 7 · UDIC 7 · BOCJ 6 · PARC 6 · HAMS 6 · REAS 6 · ASTV 6 ·
LEIC 6 · SCP 6 · CLUD 6

`tag` is unique per club QID and 1:1 with `displayCode`. Load-bearing: a tag is a
synergy key, and distinct clubs *do* share names — **Club Atlético River Plate
exists in both Argentina and Uruguay**, and Al Ahli SC / Al Ahli FC are different
clubs. Collisions are suffixed (`-2`), never merged; merging would forge a
synergy chain between players who never shared a club.

---

## 9. Exclusions (fail closed)

**13 players dropped**, none for convenience:

| reason | n |
|---|---|
| no sourced position (P413 absent) | 8 |
| no sourced senior debut (no P54/P580 at age ≥16) | 5 |

**12 duplicate QIDs collapsed** — the same player emitted twice under two names;
two cards for one person is a visible defect and could forge synergy chains with
himself. Kept the fuller name: Marcelo/Marcelo Vieira, Alisson/Alisson Becker,
Ederson/Ederson Moraes, Simão/Simão Sabrosa, Andriy/Andrey Arshavin,
Take/Takefusa Kubo, Yakubu/Yakubu Aiyegbeni, Toni/Harald Schumacher,
Anthony/Tony Yeboah, Márcio Amoroso/Amoroso, Rivelino/Rivellino,
Geremi/Geremi Njitap.

**Non-club entities** are excluded by an allow-list (`cpIsClubEntity`): a club
must positively declare a club-ish P31 type. P54 carries **Q1492 — the *city* of
Barcelona**, typed `municipality of Catalonia`/`city`, which would otherwise have
become a club tag colliding with FC Barcelona. A deny-list cannot anticipate the
next non-club entity; an allow-list fails closed.

No player was invented. No fact was guessed.

---

## 10. Source quality of the 430 (for E2)

| fact | green | amber |
|---|---|---|
| nation | 414 | 16 |
| position | 384 | 46 |
| debutYear | 425 | 5 |

**Amber identity (5):** Xavi, Ferenc Puskás, Nacho, Just Fontaine, Daniel Agger
— single-anchor identity resolution. *Maldini is no longer among them:* the
owner ruling resolved him.

Every fact carries a resolvable ref (`qid`, `property`, `retrievedAt`) and every
`qid` resolves at `https://www.wikidata.org/wiki/<qid>`. Volatility is `static`
throughout — these facts never become false (past-tense membership, a
birth-anchored debut year, a nation represented) — so no refresh owner is needed
under `CIE_SOURCING_POLICY` §5.

---

## 11. Reproducing

```
Canonical  app/convex/data/playersSourced.json   (committed; cp-assert proves it
                                                  reproduces from the rules)
Rulings    app/convex/data/ownerPositionRulings.json   (committed)
           app/convex/data/playerAdditions.json        (Maldini ownerRuling)
Cache      scripts/cache/careerPath/            (gitignored; network stages only)
Fetched    P569 birth years  — 1302/1302 QIDs, 2026-07-16 (now in cp-facts)
           sitelink counts   — 1302/1302 QIDs (editorial fame backbone)
Pinned     cardGen seed "realset-ratings-v1", setSize 430, c13v1 genome
           configVersion c13-1
```

Pipeline: `cp-search → cp-clubqids → cp-clubdict → cp-facts → cp-emit`, then
`cp-assert` (pure, offline) to prove the committed file matches its rules.
Selection, era assignment and rating assignment are pure functions of the
canonical file plus the sitelink fame backbone.

**Known gap (selector reproducibility) — this has now bitten once.** The
card-build step is not a committed script; E1 was specified as data-only
deliverables. A third party cannot regenerate `drawCardsReal.*` from the
canonical file without re-authoring the selector.

The claim above once read "the dossier and these notes fully document it." E2's
blind verify falsified that: the era partition was documented **nowhere** — not
in the dossier, not here — and E2 stopped rather than verify 430 cards against a
rule it could only have reverse-engineered from the cards themselves. E1.2 then
found there was no selector to transcribe the rule *from*, so one boundary could
not be recovered at all and had to be declared (see §12).

The lesson is narrower than "write the selector": **a rule that lives only in the
build session is not documented, however well the data is asserted.** Asserting
every property of the output says nothing about the rule that produced it. §12
and `drawCardSetEraContract` close this for `eraIndex` specifically. The rest of
the selector — selection, quotas, tier and fame handling — is still session-only
knowledge and remains a follow-up ticket, now known to be load-bearing rather
than merely tidy.

---

## 12. Era mapping (E1.2)

`eraIndex` is the only card field with no source behind it and no editorial
sibling in the dossier's original `_doc` list — it was neither sourced nor
declared. It is now stated in `dossier.eraMapping`, marked
`provenance: "editorial"`: a game-mechanical partition, not a truth claim about
when a player "belonged."

Stated as a **rule**, not as ranges. Ranges alone are unfalsifiable — read back
off the cards they confirm the cards by construction, which is exactly why E2
stopped.

```
peakYear := debutYear + 5          (debutYear is sourced; peakYear is editorial)

bucket 3  "2010s-20s"   peakYear >= 2010          debut >= 2005     188 cards
bucket 2  "2000s"       2000 <= peakYear <= 2009  debut 1995-2004   132 cards
bucket 1  "1980s-90s"   1981 <= peakYear <= 1999  debut 1976-1994    70 cards
bucket 0  "<=70s"       peakYear <= 1980          debut <= 1975      40 cards
```

**Why +5.** A card belongs to the era a player was *known* in, not the year they
first appeared; a debut is typically followed by ~5 years to first-team
prominence. Bucketing on `debutYear` alone files late bloomers an era earlier
than fans place them. The +5 is flat and uniform on purpose — a per-player peak
would be an unsourced judgement on all 430 cards, i.e. 430 more things to verify.

**It is transcription, not a fit.** The rule reproduces all 430 committed
`eraIndex` values exactly (0 mismatches). It is the rule the set was built
under, recovered rather than invented — with one exception below.

**Bucket 0 is open-ended below** and exists to satisfy the >=40-per-bucket floor
(§8). Per D2→D3, a closed "1960s–2020s" partition excluded 15 pre-1960 icons
outright; an open bottom gives them a home (earliest committed debut 1943).
Bucket 0 sits *exactly* at 40 — it is the binding constraint on the partition,
so its range cannot narrow without dropping below the floor or re-selecting.

**The bucket 0/1 boundary is DECLARED, not transcribed** — the one place E1.2
could not recover what the build did. No card has `debutYear` 1975 (peakYear
1980), so `peakYear <= 1980` and `peakYear <= 1979` classify all 430 committed
cards **identically**; the data cannot discriminate them and no selector exists
to ask. `peakYear <= 1980 -> bucket 0` is therefore a forward-binding choice for
cards added later, made so the four ranges are contiguous with no gap. Every
other boundary is pinned by cards on both sides.

Ticket text specified bucket 1 as `"80s-90s"`; the committed label is
`"1980s-90s"` and was left alone (E1.2 item 2 permitted only the bucket 0
relabel). The table records the label as it IS.

**Drift guard:** `app/src/test/drawCardSetEraContract.test.ts` recomputes every
card's `eraIndex` from the stated rule, checks labels, counts, bounds,
contiguity and the >=40 floor. It runs in `npm run check`. Mutation-tested at
authoring: flipping one card's `eraIndex`, flipping one label, and shifting a
stated boundary each fail the gate. The mapping and the cards can no longer
drift apart silently in either direction.
