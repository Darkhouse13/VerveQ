# THE DRAW — real card set "real-v1" (Ticket E1) — BUILD NOTES

**Built:** 2026-07-16 · **Candidates:** 430 (400 expected to survive E2 verification)
**Files:** `drawCardsReal.candidates.json` (card data) · `drawCardsReal.dossier.json`
(per-fact provenance, for blind verify) · this file.

Engine untouched (CONTRACT v1.0, frozen). No app code changed. These are data
files only; nothing imports them yet — seeding under a new `setVersion` is a
later ticket.

---

## 0. Owner rulings this build depends on

Five ambiguities were escalated rather than guessed. All five were ruled on
2026-07-16 and are recorded here because the build is not reproducible without
them:

| # | Ambiguity | Ruling |
|---|---|---|
| 1 | Ticket's output path `scripts/data/` is gitignored (`.gitignore:14`), so deliverables would never commit | Write to `app/convex/data/` (the committed-data precedent, where `playersSourced.json` lives) + whitelist the 3 files |
| 2 | `debutYear` from E0 is min(P54 start) and includes YOUTH clubs — Messi read 1995 (age 8) | Fetch P569 birth years and recompute senior debut |
| 3 | D2's stated "1960s–2020s" coverage excludes 15 pre-1960 icons (Pelé, Puskás, Di Stéfano, Garrincha, Banks) | Oldest era bucket is **open-ended below** |
| 4 | Paolo Maldini Q483027 identity unresolvable by club anchor (Cesare, Q296350, also has AC Milan) | Owner ruled Q483027 = Paolo. Included; recorded in the dossier as `identity.ownerRuling` |
| 5 | 48 cards had conflicting equal-rank P413 positions; E0's tie-break shipped Messi/Ronaldo/Pelé as MID | Apply the specificity + attack-precedence rule (§4) |

---

## 1. Source and selection (S1)

Input is the E0/E0.1 sourced layer `app/convex/data/playersSourced.json` (1314
records, Wikidata CC0, per-fact provenance) plus its raw retrieval cache
`scripts/cache/careerPath/` for the fields E0 did not emit (`memberships`,
`positions`, `countryForSport`, `citizenships`).

```
1314 pool records
 -12  duplicate QIDs collapsed (same player under two names)
 = 1302 distinct players
 -13  dropped, fail-closed (§7)
 = 1289 selectable
 -859 not selected
 =  430 candidates
```

**Fame is the selection criterion.** No fame field exists anywhere in the repo
(`playerQualityProfiles.json` has `fameScore` but lives in the gitignored,
absent `scripts/data/`). Fame is therefore ranked on **Wikidata sitelink count**
— the number of Wikipedia language editions carrying an article — which is
objective, cross-cultural, reproducible, and already used as a fame proxy by
`scripts/ingestWikidataPlayerData.ts` (`sitelinks>=50`). Every selected player
has ≥8 sitelinks; the pool's own floor is 8, so no unrecognizable name exists in
the input. `fameRank` remains EDITORIAL — the sitelink ordering is its
documented backbone, not a sourced fact.

### Composition (S1 targets met exactly)

| tier | cards | share |
|---|---|---|
| retired icons & legends | 150 | 34.9% |
| active stars | 195 | 45.3% |
| cult heroes / journeymen | 85 | 19.8% |

`active` = not deceased, age ≤41, and holding an open first-team membership or
one ending ≥2025. Tiers are filled by fame within per-position quotas, so the
composition and the position mix are both exact by construction.

---

## 2. Facts vs editorial

**FACTS** (sourced, one dossier entry each, all Wikidata CC0 — the §3
preferred backbone of `CIE_SOURCING_POLICY`, GREEN/static per §4's
sports-records row, so one authoritative structured source suffices under §6):

- `nation` — P54 national-team path (E0), or P1532 where corrected (§5)
- `position` — P413, resolved by the §4 rule
- `debutYear` — P54/P580, floored by P569 (§3)
- club membership — P54. *Membership is the fact; which ≤3 to print is not.*

**EDITORIAL** (VerveQ's own, unverified, no source ref):

- `rating` — derived (§6), not a claim about the player
- `fameRank` — sitelink-backed editorial ordering
- **which** ≤3 clubs are listed — the 3 with the longest sourced first-team
  tenure (ties → earlier start), VerveQ's proxy for "most iconic"
- `tag`, `displayCode`, `fullName` — text rendering of a sourced club identity;
  the dossier carries `clubQid` so E2 verifies membership, not our wording

No stats. Asserted mechanically: no card carries any number that is not a year,
a rating, a fameRank or an eraIndex, and no stat-shaped key exists in the
dossier. Text club names only — no badges, crests or likenesses.

---

## 3. `debutYear` — definition and the youth-club correction

**Definition (verifiable exactly against Wikidata):**

> `debutYear` = the earliest P54 club-membership **start year** at which the
> player was aged ≥16 (P569), counting reserve/B sides (senior league
> football), excluding national and explicit age-group teams.

E0 emitted `min(P54 start)` with no age floor. Wikidata's P54 includes academy
entries, so **71 of 1308 pool players (5.4%) had an impossible debut year** —
Messi 1995 (age 8), De Bruyne 1995 (4), Eriksen 1995 (3), **Pelé 1953 (13)**.
P569 was fetched for all 1302 QIDs (100% coverage) and the rule re-derived
`debutYear` for the whole pool: **401 values changed; the <16 population is now
zero** (ages at debut now span 16–25).

Spot-check against widely-cited senior debuts: Pelé 1956 ✓, Cristiano Ronaldo
2002 ✓, Zidane 1989 ✓, Beckham 1992 ✓, De Bruyne 2008 ✓, Piqué 2004 ✓,
Fàbregas 2003 ✓, Buffon 1995 ✓, Maldini 1985 ✓, Maradona 1976 ✓, Cruyff 1964 ✓.

**Known residual (≤2 years, systematic, not a defect):** P580 records *when the
player joined the club*, which for a few players precedes their first senior
appearance — Messi 2003 (Barcelona C, genuine Tercera División football) vs the
commonly cited 2004; Busquets 2006 (Barcelona C) vs 2008. The emitted value is
exactly what the definition above yields from P54/P580, so E2 can blind-verify
it without judgement. It is not "date of first appearance", and must not be
labelled as such in UI copy.

Two filters are deliberately different, because one filter cannot serve both:

- **debut** counts reserve/B teams (they play senior league football) — without
  this, Busquets' Barcelona span (P580 = 2000, his academy entry, ending 2023)
  is dropped by the age floor and he reads as debuting in 2023 at Inter Miami.
- **club listing** excludes reserve/B teams, but keeps a membership whose start
  predates age 16 if it runs into the senior career, and clamps tenure to age 16
  so an academy P580 cannot inflate "most iconic".

---

## 4. `position` — the P413 conflict rule (owner ruling #5)

89 selected players carry >1 P413 statement and **ranks do not disambiguate**
(523 normal vs 6 preferred across the whole set); statement order is unreliable
(Ronaldo lists `wing half` *before* `forward`). E0's tie-break took the
least-attacking bucket, which shipped Messi, Ronaldo, Pelé, Maradona, Cruyff,
Salah, Rooney, Vinícius and Garrincha as **MID**, and inflated the pool to 504
MID / 434 ATT.

The ruled rule, applied pool-wide (it changes position supply, so selection runs
after it — **68 of 1289 players changed**, pool → 490 ATT / 460 MID / 235 DEF /
104 GK):

1. Drop `coach`.
2. **Artifact rule** — discard `wing half` when the player debuted ≥1950 **and**
   another statement survives. `wing half` is a 1930s half-back role; Wikidata
   editors use it for modern wingers. Fired on 23 cards.
3. **Specificity** — if specific items (`centre-back`, `full-back`, `winger`,
   `attacking midfielder`, …) exist, they name the bucket; generic items
   (`forward`, `midfielder`, `defender`) only apply when nothing specific does.
4. **Ties → most attacking** (ATT > MID > DEF > GK).

Result: Ronaldo/Messi/Pelé/Maradona/Cruyff → ATT; Zanetti/Mascherano/
Alexander-Arnold → DEF. Every conflict stays `sourceQuality: "amber"` with its
raw `statements`, `candidates` and `artifactDropped` recorded for E2.

### ⚠ Known limitation — 25 cards with a solo `wing half`

25 selected players have `wing half` as their **only** P413 statement, so the
artifact rule cannot fire (there is nothing to fall back to) and they resolve to
**MID** on Wikidata's own `wing half ⊂ midfielder` subclass:

> Neymar, Gareth Bale, Franck Ribéry, Ángel Di María, Riyad Mahrez, Luís Figo,
> Robinho, David Silva, Mario Götze, Nani, Alexis Sánchez, Dirk Kuyt,
> Park Ji-sung, Antonio Valencia, Ricardo Quaresma, Theo Walcott,
> Clarence Seedorf, Santi Cazorla, Maxi Rodríguez, Lucas Vázquez,
> Denis Cheryshev, Ole Gunnar Solskjær, Willian, Ibrahim Afellay, Jairzinho

Several are correct (Silva, Seedorf, Cazorla, Park, Götze). Several read wrong
to a football fan (**Neymar**, Bale, Ribéry, Di María, Figo, Mahrez). Assigning
them ATT would mean overriding the sole source with our own judgement, which
this ticket forbids for a FACT — so they ship as sourced and flagged. **This is
the highest-value target for an owner ruling or a second approved source**; it
is the one place where the set knowingly prints a position a fan may dispute.

---

## 5. `nation` — the non-FIFA regional-team correction

**8 Basque Spaniards were emitted by E0 as `France`** — Xabi Alonso, Zubizarreta,
Llorente, Javi Martínez, Illarramendi, Iván Campo, Mendieta, Julio Salinas (1 of
the 8, Xabi Alonso, is in the selected 430). Cause: E0 derives nation from
national-team P54 memberships, and the **Basque Country regional football team**
is a non-FIFA regional side whose P17 spans Spain *and* France. This is the same
class as the Team GB trap E0 already excluded. P1532 and P27 both say Spain.

The correction is scoped deliberately — it fires **only** when a non-FIFA
regional side is present **and** the emitted nation is corroborated by neither
P1532 nor P27. A blanket "P1532/P27 must corroborate" rule was tried and
rejected: it fires on 18 pool records and **regresses** two classes E0 gets
right — `Joe Cole England → United Kingdom` (P27 is United Kingdom for every
English player: the P17 trap E0 fixed) and `Jason Roberts Grenada → "Granada"`
(a genuine P1532 data error, the Spanish city). Both keep E0's value.

Deliberately **not** corrected (genuinely ambiguous, left amber with candidates
for E2): dual internationals such as Wilfried Zaha (England / Ivory Coast) and
Diego Costa (Brazil / Spain); historical states (Beckenbauer's P1532 is "West
Germany"; we keep E0's "Germany"). 19 of 430 nations are amber.

---

## 6. D1 — ratings (identical-by-construction)

Generated by the pinned synthetic generator: `generateCardSet("realset-ratings-v1",
{...C13V1_CONFIG.cardGen, setSize: 430})`, ratings sorted descending, rating *k*
assigned to `fameRank` *k*. Only `setSize` is overridden (50 → 430); every other
c13v1 cardGen knob is untouched, so the real set's rating distribution is
identical by construction to the tuned one. Verified mechanically: the emitted
multiset equals a fresh generator run byte-for-byte.

**The multiset** (min 61, max 95, mean 79.286, median 80):

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

## 7. D2 — era mapping

`eraCount: 4` is read from `c13v1.cardGen`; the `eraBefore: 3` / `eraAtLeast: 3`
thresholds (ARCH_THROWBACK / ARCH_NEWWAVE) split at index 3. `eraIndex` keeps
the generator's semantics — **0 = oldest**, ascending.

**Bucket = the group containing `debutYear + 5`.** Bucket 0 is open-ended below
(owner ruling #3), which is what keeps Puskás (1943), Di Stéfano (1945) and
Zamora (in pool) selectable at all — the ticket's literal "1960s–2020s" would
have excluded 15 icons, Pelé among them.

| eraIndex | `debutYear+5` | debutYear | label | cards |
|---|---|---|---|---|
| 0 | ≤1979 | ≤1974 | `1960s-70s` | 40 |
| 1 | 1980–1999 | 1975–1994 | `1980s-90s` | 69 |
| 2 | 2000–2009 | 1995–2004 | `2000s` | 133 |
| 3 | ≥2010 | ≥2005 | `2010s-20s` | 188 |

Every bucket clears the ≥40 floor. Bucket 0 is at the floor exactly, by design:
only 65 pool players debuted ≤1974, and the selector's era-repair step promotes
the highest-fame unselected card of an under-floor era, swapping out the
lowest-fame card of an over-supplied era **within the same position and tier**,
so the position mix and composition stay exact.

> **Observation for the owner (not a ticket violation).** The distribution is
> 40/69/133/188, not the ~uniform 91/111/105/123 the tuned generator produces.
> The ticket sets only a ≥40 floor, which is met, but era is a synergy family:
> a real fame-ranked set is inescapably modern-skewed, so era-chain frequency in
> live play will differ from the c13-1 sim. Worth a sim pass before this set is
> served.

---

## 8. Histograms vs floors

| floor (S2) | required | actual |
|---|---|---|
| distinct club tags with ≥6 cards | ≥25 | **45** (of 332 distinct) |
| nations with ≥8 cards | ≥10 | **13** (of 58 distinct) |
| every era bucket | ≥40 | **40 / 69 / 133 / 188** |
| every card ≥1 club tag | yes | **yes** (1 card has 1 club, 30 have 2, 399 have 3) |
| positions within ±3pp of generator | ±3pp | **0.00pp on all four** |

### Positions (generator `positionWeights` GK1/DEF3/MID3/ATT3 → 10/30/30/30%)

| pos | cards | share | target | delta |
|---|---|---|---|---|
| GK | 43 | 10.0% | 10.0% | +0.00pp |
| DEF | 129 | 30.0% | 30.0% | +0.00pp |
| MID | 129 | 30.0% | 30.0% | +0.00pp |
| ATT | 129 | 30.0% | 30.0% | +0.00pp |

### Nations ≥8 cards

France 43 · Germany 39 · Brazil 38 · England 37 · Spain 36 · Italy 27 ·
Argentina 26 · Netherlands 26 · Portugal 19 · Belgium 13 · Japan 13 ·
Denmark 9 · Croatia 8

### Club tags ≥6 cards (45)

RMA 60 · BAR 52 · MUN 45 · CHE 43 · JUV 41 · ARS 38 · BAY 37 · MCI 34 ·
LIV 31 · INT 29 · MIL 27 · PSG 24 · AJA 21 · BVB 19 · ROM 19 · MON 18 ·
ATM 18 · TOT 16 · EVE 14 · OM 13 · LAZ 11 · BEN 11 · NAP 10 · OL 10 ·
POR 10 · FIO 10 · VFB 10 · PSV 9 · S04 9 · VAL 9 · UDIC 9 · ZENS 9 ·
WHU 8 · SEV 8 · VIL 8 · BORM 8 · SOU 7 · BAY0 7 · GALS 7 · PARC 6 ·
HAMS 6 · VFLW 6 · LEIC 6 · SCP 6 · CORP 6

`tag` is unique per club QID and 1:1 with `displayCode`. This is load-bearing:
a tag is a synergy key, and distinct clubs *do* share names — **Club Atlético
River Plate exists in both Argentina and Uruguay**, and Al Ahli SC / Al Ahli FC
are different clubs. Collisions are suffixed (`-2`), never merged; merging would
forge a synergy chain between players who never shared a club.

---

## 9. Exclusions (fail closed)

**13 pool players dropped**, none for convenience:

| reason | n |
|---|---|
| no sourced position (P413 absent) | 8 |
| no senior club membership starting at age ≥16 | 5 |

**12 duplicate QIDs collapsed** — the same player emitted twice under two names;
two cards for one person would be a visible defect and could forge synergy
chains with himself. Kept the fuller name form: Marcelo/Marcelo Vieira,
Alisson/Alisson Becker, Ederson/Ederson Moraes, Simão/Simão Sabrosa,
Andriy/Andrey Arshavin, Take/Takefusa Kubo, Yakubu/Yakubu Aiyegbeni,
Toni/Harald Schumacher, Anthony/Tony Yeboah, Márcio Amoroso/Amoroso,
Rivelino/Rivellino, Geremi/Geremi Njitap.

**Non-club entities excluded from P54** by an allow-list (a club must positively
declare a club-ish type): P54 carries **Q1492, the *city* of Barcelona**, typed
`municipality/city`, which would otherwise have become a club tag colliding with
FC Barcelona.

No player was invented. No fact was guessed. Where a fact could not be sourced,
the player is excluded rather than filled in.

---

## 10. Source quality of the 430 (for E2)

| fact | green | amber |
|---|---|---|
| nation | 411 | 19 |
| position | 386 | 44 |
| debutYear | 423 | 7 |

**Amber identity (7):** Xavi, Ferenc Puskás, Paolo Maldini, Nacho,
Just Fontaine, Ole Gunnar Solskjær, Daniel Agger — single-anchor identity
resolution. Maldini carries the explicit owner ruling in
`identity.ownerRuling`.

Every fact in the dossier carries a resolvable ref (`qid`, `property`,
`retrievedAt`); every `qid` resolves at `https://www.wikidata.org/wiki/<qid>`.
Volatility is `static` throughout — these facts never become false (past-tense
membership, a birth-anchored debut year, a nation represented), which is why
this set needs no refresh owner under `CIE_SOURCING_POLICY` §5.

---

## 11. Reproducing

```
Inputs   app/convex/data/playersSourced.json      (E0, committed)
         scripts/cache/careerPath/playerFacts.json (E0 cache, gitignored)
Fetched  P569 birth years   — 1302/1302 QIDs, 2026-07-16
         sitelink counts    — 1302/1302 QIDs (fame backbone)
         P413 + ranks       — 430 selected QIDs (rank check; ranks did not disambiguate)
Pinned   cardGen seed "realset-ratings-v1", setSize 430, c13v1 genome
         configVersion c13-1
```

Selection, era assignment and rating assignment are pure functions of those
inputs. The Wikidata fetches are the only non-hermetic step; the pool's own
`retrievedAt` is 2026-07-16, matching this build.
