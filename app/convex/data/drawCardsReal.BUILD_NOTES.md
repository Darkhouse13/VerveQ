# THE DRAW — real card set "real-v2" (Tickets E1 → E0.2) — BUILD NOTES

**Built:** 2026-07-17 · **Candidates:** 430 · **Set version:** `real-v2`

**Files**
- `drawCardsReal.candidates.json` — the card data
- `drawCardsReal.dossier.json` — per-fact provenance, for blind verify
- `ownerPositionRulings.json` — the 25 owner position rulings (E1.1)
- `ownerNationRulings.json` — Puskás, Davids (E0.3) + Di Stéfano reviewed-not-overridden
- `ownerDebutRulings.json` — Busquets (E0.3)
- `playersSourced.json` — the canonical sourced layer these are selected from
- `../../../scripts/buildDrawCardSet.ts` — **the selector (new in E0.2)**
- `../../src/test/drawDataRulesContract.test.ts` — **the CI guards (new in E0.3)**
- this file

Engine untouched (CONTRACT v1.0, frozen). No app code. Nothing imports these
yet; seeding under a new `setVersion` is a later ticket.

---

## 0. What E0.2 changed, and why

E2 verified real-v1 and returned **RED: 143 of 430 cards**. It did not ask for 143
fixes — it found **one derivation bug** behind 138 of them and said so: *"Fix the
rule upstream... This is the same 'fix the rule, not the output' lesson E1.1
already learned once."* E0.2 is that fix, plus the four smaller rule faults E2
found alongside it.

| # | E2 finding | E0.2 |
|---|---|---|
| F1 | **Multi-spell collapse** — 207/1260 memberships merged to a min/max hull; 158 across 138 cards affirmatively false | `clubs[].spells` — **one spell per P54 statement, never merged** (§1) |
| F4 | Reserve/B-side debut bias, systematic and one-directional | reserve sides excluded from `debutYear`; **85 debuts move** (§3) |
| — | `wdt:P413` returned best-rank only, hiding real position ambiguity | P413 read **statement-level** (`p:/ps:`); Ronaldinho + Endo fixed (§4) |
| — | dual internationals decided by **alphabetical order** | most recent senior national team, sourced (§5) |
| — | memberships citing an unresolvable club QID, dropped in silence | dropped **and logged** (§9) |
| §11 | the selector was never committed and could not be reproduced | **`scripts/buildDrawCardSet.ts` exists** (§11) |

### E0.3 — rulings applied, guards wired, sweep completed

| item | outcome |
|---|---|
| **Phantom sweep, live** | All 1314 players re-checked against Wikidata: **8436 memberships vs 12185 live (player,club) pairs → 0 refs fail to resolve.** Nothing further to drop; E0.2's 10 drops (§9) are the complete set. |
| **Dybala/Emelec** | The ticket named it as the known instance. **It is not one.** `Club Sport Emelec (Q1421829)` is a live, NormalRank P54 statement resolving to a real described club — verified live on 2026-07-17. The ref resolves; the *statement* is false. That is F2, and dropping it would have moved a correct debut (2011, confirmed by E2 against Argentine press) to a wrong one (Palermo 2012), because his real first club is absent from Wikidata entirely. |
| **Owner rulings** | 3 applied — Puskás, Davids, Busquets (§14). Selection unchanged 430/430. |
| **Nation override mechanism** | `ownerNationRulings.json`, same signed pattern as positions. |
| **Tiers** | Ruled descriptive, not enforced (§1). F5 quoted verbatim there. |
| **CI** | `cp-assert` + `selector --check` now run in `npm run check` (§11). Mutation-proved. |

**What E0.2 did NOT do**, and must not be read as having done:

- **F2 (inherited source falsehood) is untouched and remains the ceiling.** E2's own
  recommendation says F2 *"should govern the timeline"* and that it is the most
  consequential item on its list. A Wikidata-only audit grades a faithful
  transcription ~100% and learns nothing about whether the cards are TRUE. Dybala's
  debut is still sourced to a statement placing him at **Club Sport Emelec, a club he
  never played for**; the value (2011) is right only because the phantom club and his
  real first club share a start year. No rule here can see that — E2 found all three
  instances by accident, and the only instrument that found any of them was a second
  source. **How much second-sourcing this set warrants before it faces players is
  still an open owner decision.**
- **F3 (the `membershipStart` clamp is undocumented)** — out of scope by owner ruling.
  Still true, still owed: `membershipStart` is `max(P580, birthYear+16)` and is
  presented as a bare P54 fact, so a checker reading Piqué/Barcelona sees 1997 on
  Wikidata, 2003 on the card, and concludes the artifact is wrong.
- **F5 (`tier` wrong on ≥3 cards)** — out of scope by owner ruling. `tier` is not a
  card field and its E1 rule was session-only and unrecoverable, so rather than
  invent a rule that would reproduce the defect, **the dossier no longer carries
  `tier` at all**. Keegan/Vertonghen/Ochoa are no longer labelled "active" because
  nothing labels them.
- **F4's date-vs-year note** — out of scope by owner ruling. The age-16 rule is
  **year subtraction** (`startYear >= birthYear + 16`), which is what the committed
  set holds. Messi 2003→2004, Puskás 1943 and Bellingham 2019 depend on it. Pinned
  here so a future re-run cannot silently disagree.

---

## 0a. What E1.1 changed (kept for the record)

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

**E0.2:** the selection above is now performed by the committed
`scripts/buildDrawCardSet.ts` (§11), and the exact funnel is recorded in
`dossier.selector.pool` rather than in prose here — so it can never drift from the
code that produced it.

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

> **`tier` is GONE (E0.2), and this table with it. E0.3 records the owner ruling
> that makes that permanent: composition tiers are DESCRIPTIVE, not enforced.**
>
> **The selector enforces exactly two things: fame-ordering and the floors.** It
> does not target a tier mix, and no card is selected or dropped to hit one. The
> 150/195/85 table above described an *outcome* of E1's selection, and it was read
> ever since as though it were a specification — which is how a number nobody chose
> became a constraint nobody could reproduce.
>
> E2's finding, quoted verbatim so it is on the record in the file it concerns
> (**F5, severity METADATA — "tier is wrong on at least 3 cards"**):
>
> > "Kevin Keegan (real_0328) tier=active — born 1951, retired as a player in 1984.
> > Jan Vertonghen (real_0281) tier=active — retired 2025. Guillermo Ochoa
> > (real_0303) tier=active — retired. Outside the four verified facts, so not part
> > of the RED/AMBER verdict, but plainly wrong. A second agent found no tier errors
> > among its own 10 cards, so this is 3 confirmed instances rather than a general
> > claim."
>
> `tier` was dossier metadata only — it was never a card field and nothing read it.
> Its E1 rule was session-only and is unrecoverable, so re-authoring the selector
> offered only two options: invent a tier rule (which would have had to reproduce
> F5's defect in order to reproduce the documented table) or drop the field. It is
> dropped, and F5 is retired by removal rather than by fix.
>
> **Descriptive composition of real-v2, for owner review** (observed, not enforced;
> the cut is declared here, not sourced):
>
> | descriptive band | definition (declared here, not sourced) | cards |
> |---|---|---|
> | active | ≥1 open club spell (P582 absent) | **156** |
> | retired icons & legends | no open spell, sitelinks ≥ 100 | **19** |
> | cult heroes / journeymen | no open spell, sitelinks < 100 | **255** |
>
> Fame spread: max 221 (Messi), median 67, min 43.
>
> **These bands do not reproduce E1's 150/195/85 and no honest choice of cut would.**
> The ≥100 line is arbitrary — it is stated so the counts are checkable, not because
> 100 means anything. Read the two real dimensions instead: **156 active / 274
> retired**, and a fame range of 43–221. If the owner wants a tier mix to be a
> *target* rather than a description, that is a new rule and needs a ticket; the
> selector would then have to enforce it alongside the position quota and era floors,
> and the two can conflict.
>
> **"active" here is the same observable that produced F5** — an open spell means
> Wikidata carries no end date. It is now honest for 2 of E2's 3 cards (Keegan
> real_0251 and Vertonghen real_0298 both read retired), but **Ochoa (real_0305)
> still has an open spell and would still band as "active" despite having retired.**
> That is F5's root cause surviving in descriptive form, which is exactly why the
> band is published as a description of the data and not as a claim about the player.

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

### E0.2 — the two club filters are ONE again

E1.1 split them so `debutYear` **counted** reserve/B sides ("they are senior league
football"). E2 measured the result: **65 of 430 cards (15%) had their debut set by a
reserve/B/C side**, applied faithfully and consistently (64 of 65), and **every single
divergence from the commonly-cited senior debut ran the same direction — earlier.**
A rule whose errors are all one-directional is a biased rule, not a noisy one.

The owner ruled the definition: **`debutYear` is the first-team debut**, so
`cpCountsForDebut === cpIsSeniorClub`. Measured offline against the fetch cache
before the change: **85 debuts move, 84 of them by +1..+4 onto the commonly-cited
year** — Messi 2003→**2004**, Iniesta 2001→**2002**, Pedro 2005→**2008**,
Neuer/Khedira 2004→**2006**, Villa 2000→**2001**, Butragueño 1981→**1984**.

Club listing is unchanged: reserve sides are still never printed, a membership that
merely *starts* early is kept, and one that both starts *and ends* before age 16 is
dropped — Messi's Newell's Old Boys spell (1995–2000, ages 8–13) is a real P54
statement about a real senior club he never played a senior minute for.

> **The one regression, declared not buried: Sergio Busquets 2006 → 2023.**
> E1.1's note predicted exactly this and it is worth reading twice, because the
> reason is subtle. His FC Barcelona membership is **ONE statement, P580 = 2000** —
> his age-12 academy entry — running to 2023. `debutYear` **filters out** statements
> starting before age 16 rather than clamping them, so that statement is discarded
> whole, and the only senior first team left is **Inter Miami 2023**. He is the sole
> shift beyond +4 across all 1302 players.
>
> This is a *source-modelling* fault (Wikidata files his academy entry on the
> first-team QID), not a rule fault, and no rule reading only P54 can tell it apart
> from a genuine 2000 debut. **Busquets is on the owner list.** The mechanism to
> resolve him already exists — a QID-pinned `ownerRuling` in `playerAdditions.json`,
> exactly as Maldini's identity was resolved. Inventing a threshold to catch him
> would be an opinion dressed as a rule.

### Why the definition FILTERS rather than reading the spells

Ticket E0.2 item 1 says "debutYear read spells". Taken literally that means `min()`
over the emitted spell starts — which are **clamped** to `birthYear+16`, so an
academy-start statement still contributes `birthYear+16` instead of being discarded.
Both readings were measured against the committed cache:

| reading | debuts changed | matched a known senior debut (16 spot checks) |
|---|---|---|
| **filter** (shipped) | 85 | **13/16** |
| clamped spells | 123 | 11/16 |

The clamped reading regresses **Piqué 2004→2003, ter Stegen 2011→2008, Xabi Alonso
1999→1997** — in each case an academy-entry P580 on the first-team statement,
floored to `birthYear+16`, undercutting the real debut. So the filter stays, and
with it the definition a verifier can check without judgement. (It would have fixed
Busquets to 2004 — still wrong, and at the cost of two players it breaks.)

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

| floor (S2) | required | real-v1 | **real-v2 (E0.2)** |
|---|---|---|---|
| distinct club tags with ≥6 cards | ≥25 | 48 (of 335) | **49** (of 325 distinct) |
| nations with ≥8 cards | ≥10 | 13 (of 57) | **13** |
| every era bucket | ≥40 | 40 / 70 / 132 / 188 | **40 / 76 / 138 / 176** |
| every card ≥1 club tag | yes | yes | **yes** (1 card has 1 club, 25 have 2, 404 have 3) |
| positions within ±3pp of generator | ±3pp | 0.00pp | **0.00pp on all four** |

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

| fact | real-v1 green | real-v1 amber | **real-v2 green** | **real-v2 amber** |
|---|---|---|---|---|
| nation | 414 | 16 | **413** | **17** |
| position | 384 | 46 | **380** | **50** |
| debutYear | 425 | 5 | **424** | **6** |

Amber went **up**, which is the point: E0.2 did not make the data worse, it stopped
the file claiming certainty it never had. The 4 new amber positions are the cards
whose second P413 value `wdt:` was hiding (§4).

**Amber identity (6):** Xavi, Ferenc Puskás, Ole Gunnar Solskjær, Nacho, Just
Fontaine, Daniel Agger — single-anchor identity resolution. *Maldini is not among
them:* the owner ruling resolved him. (Solskjær is back in the set: he was the
E1.1 rebalance's self-inflicted casualty, and the re-authored selector's declared
tie-breaks put him back.)

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

**The selector gap is CLOSED (E0.2).** `scripts/buildDrawCardSet.ts` is committed.
It is pure and offline, reads only the canonical file plus the sitelink cache, and
`--check` asserts the committed artifacts reproduce from it byte for byte:

```
npx tsx scripts/buildDrawCardSet.ts --check
  -> selector --check OK: both artifacts reproduce exactly (430 cards, modulo retrievedAt)
```

**It is a re-authoring, not a recovery — and that distinction is load-bearing.**
E1's selector was never committed and is gone. What survived is prose: the floors,
the quotas, the fame backbone, the era rule. Everything the prose did not pin down
— selection order, tie-breaks, tier, club-tag spelling, display codes — is
**DECLARED afresh** in that file, not transcribed from anything.

So running the new selector on the OLD canonical does **not** reproduce real-v1.
It reproduces **405 of 430 (94.2%)**; 25 cards differ. That 25 is the price of the
missing selector, and it is reported separately from the rule changes precisely so
it cannot be mistaken for one (§13).

**The lesson E1.2 recorded still stands, and is now paid off rather than repeated:**
*a rule that lives only in the build session is not documented, however well the
data is asserted.* Asserting every property of the output says nothing about the
rule that produced it.

**E0.3 — both guards now run in `npm run check`**, via
`app/src/test/drawDataRulesContract.test.ts` (`npm run test` is already inside
`check`). They are imported and run in-process rather than shelled out to, so they
need no `tsx` dependency and no subprocess; both scripts guard their own `main()`, so
importing them is inert. Mutation-proved at authoring, one deliberate mutation per
guard:

| mutation | cp-assert guard | selector guard |
|---|---|---|
| canonical `playersSourced.json`: Messi debutYear 2004 → 1999 | **FAIL** ✓ | **FAIL** ✓ (correctly — it derives from the canonical) |
| card `drawCardsReal.candidates.json`: real_0001 rating 95 → 60 | pass ✓ (reads canonical only) | **FAIL** ✓ |

Both reverted; both green.

**E0.4 — the cache is COMMITTED and the guards no longer skip.** While
`scripts/cache/careerPath/` was gitignored, a fresh checkout had nothing to re-derive
from, so both guards **skipped** and CI reported them green without ever running them
— a guard that cannot fail is indistinguishable from no guard. The owner ruled the
cache in: **5 files, 3.74 MB** (`playerFacts`, `clubDict`, `searchCandidates`,
`candidateClubQids`, `sitelinks`). `full-run.log` stays out — it is a transcript of
one run, not an input to any rule.

The cache is now an **input, not a scratch directory**: it is the evidence the
committed data derives from, and deleting it is a defect rather than a clean slate.
The guards fail closed on a missing cache rather than skipping (a third assertion
checks it is present), and a fresh-worktree run proves they execute on a clean
checkout.

> **`.gitignore` trap, worth knowing:** git **cannot re-include a path whose parent
> directory is excluded**, so `!scripts/cache/careerPath/` under a `scripts/cache/`
> rule silently does nothing. The rule had to become `scripts/cache/*` first. This is
> the same class of trap as E1.1's note that `git check-ignore` exits 0 on a negated
> path — an ignore rule that quietly fails to do what it looks like it does.

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
could not recover what the build did. `peakYear <= 1980 -> bucket 0` is a
forward-binding choice, made so the four ranges are contiguous with no gap. Every
other boundary is pinned by cards on both sides.

> **E0.4 — this declaration is no longer free, and the sentence that used to sit
> here is now false.** It read: *"No card has `debutYear` 1975 (peakYear 1980), so
> `peakYear <= 1980` and `peakYear <= 1979` classify all 430 committed cards
> identically; the data cannot discriminate them."* That was true of real-v1. It is
> not true of real-v2: E0.2's debut rules moved 85 values, and the set now contains
> **Jean Tigana (real_0427, debut 1975, peakYear 1980)** sitting exactly on the
> boundary.
>
> He is in bucket 0 *because of the declaration*. And **bucket 0 holds exactly 40
> cards — the floor** — so under `peakYear <= 1979` he moves to bucket 1, bucket 0
> falls to **39**, and the selector must swap a card in to stay legal. A boundary
> that classified nothing now decides a card and a floor.
>
> **Kept as declared** — it is still the documented choice and still the one that
> keeps the ranges contiguous — but it is flagged for owner review, and it is a
> worked example of why a claim about the data has to be re-checked whenever the
> data moves. Nothing failed here: the era contract passed, every floor passed, and
> the prose was quietly wrong anyway.

Ticket text specified bucket 1 as `"80s-90s"`; the committed label is
`"1980s-90s"` and was left alone (E1.2 item 2 permitted only the bucket 0
relabel). The table records the label as it IS.

**Drift guard:** `app/src/test/drawCardSetEraContract.test.ts` recomputes every
card's `eraIndex` from the stated rule, checks labels, counts, bounds,
contiguity and the >=40 floor. It runs in `npm run check`. Mutation-tested at
authoring: flipping one card's `eraIndex`, flipping one label, and shifting a
stated boundary each fail the gate. The mapping and the cards can no longer
drift apart silently in either direction.

---

## 13. E0.2 — the dual diff, and what may be attributed to what

The selector had to be re-authored (§11), so a single `real-v1 -> real-v2` diff
would blame the rule fixes for drift they did not cause. Two diffs, measured by
running the SAME committed selector over both canonical files:

| diff | meaning | result |
|---|---|---|
| `real-v1 -> X` | **re-authoring drift.** Same facts, re-declared selector rules. | **25 out / 25 in** (405/430 unchanged) |
| `X -> Y` | **the E0.2 rule effects.** Same selector, only the facts changed. | **0 out / 0 in — composition identical** |

*X = new selector on the OLD canonical; Y = new selector on the NEW canonical = the
committed real-v2.*

**The rule fixes changed no card's membership of the set.** The ticket's
"composition changes via lowest-fameRank swaps only" is satisfied vacuously: there
are none. Position quotas held (0 position changes), fame is unchanged, and the era
floors stayed satisfied without a swap. Every composition difference from real-v1 is
selector re-authoring, disclosed above and not attributable to E0.2's rules.

**Fact changes across the 430 cards present in both X and Y:**

| field | changed | notes |
|---|---|---|
| `position` | **0** | Ronaldinho/Endo widened to amber but their *pick* did not move |
| `nation` | **6** | §5 |
| `debutYear` | **45** | §3 |
| `eraIndex` | **3** | Neuer, Khedira, Kevin-Prince Boateng — all `2000s -> 2010s-20s` on corrected debuts |

### Era redistribution

| eraIndex | label | real-v1 | X | **real-v2** |
|---|---|---|---|---|
| 0 | `≤70s` | 40 | 40 | **40** |
| 1 | `1980s-90s` | 70 | 76 | **76** |
| 2 | `2000s` | 132 | 141 | **138** |
| 3 | `2010s-20s` | 188 | 173 | **176** |

Bucket 0 still sits **exactly** at the ≥40 floor and remains the binding constraint
on the partition. 18 era-floor swaps ran inside selection (lowest-fameRank, within
the same position), all recorded in `dossier.selector.eraSwaps`.

> **The §8 observation still stands and is now worse, not better.** 40/76/138/176 is
> not the ~uniform distribution the tuned generator produces, and **era is a synergy
> family** — era-chain frequency in live play will differ from the c13-1 sim. The
> still-owed Ticket 0.4 requirement (≥99.5% natural clear over ≥2000 boards on the
> pinned production set) has not been run against this set.

## 14. Owner rulings — applied (E0.3)

Three signed overrides, all applied to the POOL before selection re-ran. **Selection
was unchanged: 430/430, zero swaps** — nation enters no selection criterion, and
Busquets' ruled debut lands in the same era bucket as the rule's output (peakYear
2013 and 2028 are both bucket 3). All floors, the ±3pp band and the era assert were
re-checked and hold.

| card | field | rule output | **ruled** | file |
|---|---|---|---|---|
| real_0039 Ferenc Puskás | nation | Spain | **Hungary** | `ownerNationRulings.json` |
| real_0344 Edgar Davids | nation | Suriname | **Netherlands** | `ownerNationRulings.json` |
| real_0083 Sergio Busquets | debutYear | 2023 | **2008** | `ownerDebutRulings.json` |

**A ruling never edits a fact, and this is now mechanically visible:** applying all
three left `playersSourced.json` byte-identical, and `cp-assert` still proves the
canonical file reproduces from the rules alone. The rule's output travels beside the
override in the card dossier (`ruleOutput`, `ruleBasis`, `sourcedValue`), so a reader
always sees what the rule said and that a human overruled it.

**Reviewed and deliberately NOT overridden:** Di Stéfano keeps the rule's **Spain**
(31 caps for Spain vs 6 for Argentina). Recorded in `ownerNationRulings.json` under
`reviewedNotOverridden` so absence of a ruling is never mistaken for the case never
having been looked at.

**Busquets' `independentRef` — RESOLVED (1 ref), E0.4.** E0.3 published it as `null`
because none was supplied. E0.4 supplied two descriptors; the fcbarcelona.com piece
was identified by its id (**860614**), **fetched, verified to resolve, and verified to
support the ruled value** before being recorded — "Busquets tested on 10 years at
Barça" (11 Sept 2018): *"Sergio Busquets made his first team debut on 13 September
2008."* The second intended ref, a uefa.com appearances piece, carries no URL, id or
slug and none was supplied when asked, so **it is not recorded.** A citation nobody
can resolve is not a citation, and a plausible-looking uefa.com URL is exactly the
fabrication this pattern exists to prevent. The ruled value is independently sourced
by the ref that does exist.

### Disputed statements (E0.4) — the F2 ledger

`ownerDisputedStatements.json` is a new signed record type, and deliberately **not a
rule**: F2 is the class where a statement resolves perfectly and is simply false, so
every provenance check we have passes on it (E0.3's live sweep re-checked all 8436
memberships and found 0 unresolvable refs). It is a ledger of instances a human
established by other means, so that what we know does not live only in a transcript.

| card | statement | verdict | effect |
|---|---|---|---|
| real_0101 **Paulo Dybala** | `P54 → Club Sport Emelec (Q1421829)`, 2011–2012, NormalRank, **live and resolving as of 2026-07-17** | **`notCredited`** (class F2) | `debutYear` **2011 stands**, forced **green → amber**, record attached |

**`notCredited` means the statement is preserved verbatim and not credited as
provenance — it is deliberately NOT dropped.** Dropping it would be strictly worse:
E0.2 measured that removing the Emelec statement moves Dybala's debut to Palermo
**2012**, turning a value E2 *independently confirmed correct* (Instituto de Córdoba,
senior debut 12 August 2011, Argentine press) into a wrong one — because his real
first club is absent from Wikidata entirely. The value was right by coincidence of
year, and that coincidence is not something to keep silently trading on. Emelec is not
printed on his card (his three printed clubs are Juventus, Roma, Palermo, by tenure),
so the artifact has never asserted he played there.

## 15. F2 — the second-sourcing scope rule (E0.4)

E2 called F2 the most consequential item on its list and said it *"should govern the
timeline"*. E0.4 rules the scope rather than leaving it open:

> **SCOPE RULE: second-source a disputed fact only where the dispute would cross an
> era boundary.**

**Why that line and not another.** F2 is unbounded by construction — a faithful
transcription of a wrong source cannot be detected from the source, so "verify
everything" is the only exhaustive answer and it is not affordable. The scope rule
picks the one place a wrong debut year does mechanical damage rather than cosmetic
damage: **era is a synergy family.** A debut that is wrong by a year inside a bucket
changes a number nobody plays against; a debut that is wrong across a bucket boundary
changes the card's `eraIndex`, and therefore its synergy chains, the era histogram and
the ≥40 floors. The first is an inaccuracy; the second is a gameplay defect.

**The population this scopes to** (measured against real-v2, under
`peakYear := debutYear + 5`):

| dispute size | cards whose `eraIndex` would change | share |
|---|---|---|
| ±1 year | 67 | 15.6% |
| ±2 years | 120 | 27.9% |
| ±3 years | 169 | 39.3% |

Boundary-adjacent debut years in the set: 1974, 1975, 1976, 1993, 1994, 1995, 1996,
2003, 2004, 2005, 2006. So a ±2 review — the band E2's own F4 used when it flagged
Benzema, Neuer and Khedira as sitting on the 2/3 boundary — is **120 cards, not 430.**

### Residual risk, accepted

This is what the owner is accepting, stated so it cannot be discovered later as a
surprise:

- **Every non-boundary-crossing F2 instance stays unverified and ships.** A card can
  carry a debut that is wrong by a year or two, sourced to a statement that resolves
  perfectly, and nothing in this pipeline will ever flag it. Ozil (Real Madrid start
  2009 vs an actual 2010) is a known live instance and is **still green**.
- **The size of that class is unknown and unestimated.** E2 was explicit: *"There is
  no basis for estimating how many more of the 430 carry this class, and the 38-card
  second sample is far too small to size it."* Three instances were found, all three
  by accident.
- **The cheap detector does not exist.** E2 tested it: a debut statement with zero
  references or only P143 "imported from Wikipedia" fires on **406 of 430 (94.4%)** —
  that is the baseline for football data on Wikidata, not a signal. Messi's debut
  statement has zero references; Ronaldo's and Maradona's are P143-only.
- **What is NOT accepted:** an F2 instance a human has actually established. Those go
  in `ownerDisputedStatements.json`, force the affected fact to amber, and are never
  silently carried as green (§14).

The accepted risk is therefore **unverified accuracy inside a bucket**, in exchange
for bounded verification effort at the boundaries where the engine can feel it.

### Still owed

| # | item | why it is not closed |
|---|---|---|
| 1 | **F2 — the ±2 boundary review itself** | The scope rule is now ruled; the 120-card review has not been RUN. That is the work the rule authorises, not work it completes. |
| 2 | **Bucket 0/1 boundary is now load-bearing** | §12. Jean Tigana sits exactly on the declared boundary and bucket 0 sits exactly at the floor. Kept as declared, flagged for review. |
| 3 | **Ronaldinho, Wataru Endo** | Positions widened green→amber by the statement-level P413 fetch; picks unchanged, no membership impact. Ruling needed only to resolve the ambiguity rather than disclose it. |
| 4 | **10 dropped memberships** | Unresolvable club refs (§9). Błaszczykowski's is E2's amber: KS Częstochowa 2003 is a real senior club whose QID resolves to nothing, so his debut stays 2004. |
| 5 | **Busquets' 2nd ref** | **CLOSED to 1 of 2 (E0.4).** The fcbarcelona.com piece is recorded and verified. The intended uefa.com "appearances piece" was never supplied as a URL and is NOT recorded — a citation nobody can resolve is not a citation. |
| 6 | **Tier as a target** | §1 — descriptive today. Making it a constraint is a new rule and a new ticket. |
| 7 | **P0-set sim** | Ticket 0.4's forward requirement: ≥99.5% natural clear over ≥2000 boards on the pinned production set. Never run against real-v2. Era is a synergy family and real-v2's era spread (40/76/138/176) is not the generator's, so this is not a formality. |

**Closed by E0.4:** ~~CI guards skip without the cache~~ (§11 — cache committed,
guards fail closed, fresh-worktree proved). ~~Dybala ships green~~ (§14 — signed
disputed-statement record, now amber). ~~F2 scope undecided~~ (§15 — scope ruled,
residual risk accepted).

## 16. E0.5 — fact-model realignment, cited-override layer, real-v3

Built ENTIRELY from E2.1's blind re-verify (`drawCardsReal.verify2.json`, committed
first). E2.1 re-retrieved all 430 cards live and found `debutYear` systematically
EARLIER than the competitive debut: ~25% of the cards for which a qualifying
non-Wikidata source was actually retrieved were contradicted, every era from Banks
(1958) to Rashford (2016). The field was not patched — it was renamed and redefined.

**Fact model.** `debutYear → sourceStartYear` across canonical, dossier and selector.
It now means "earliest senior-club membership START per P54 (age ≥16, first teams) —
NOT a debut". The dossier's `sourceStartYearMeaning` lists the five contamination
classes (signing/registration, academy-on-first-team-QID, reserve/B-team, split-season
label, friendly). **No date is a published fact:** the card face carries no year at
all; `sourceStartYear` and `eraYear` live in the dossier only. Per-club spell dates are
demoted to internal identity evidence — the published club fact is membership EXISTENCE.

**Cited overrides (`ownerCitedOverrides.json`).** eraYear := citedValue where a signed
record exists, else sourceStartYear. Era mapping runs on eraYear. A record is minted
ONLY for a verify2 RED that CROSSES an era bucket — 8 of them, each built from the
verifier's own publisher + URL + verbatim quote. Within-bucket contradictions change no
bucket and are `acceptedNoise`, not overrides (guarded: an override that doesn't cross a
bucket is a STOP). Keyed on **qid**, not cardId — cardId is positional and shifts when
the pool changes. Note **Gordon Banks**: the headline 5-year error (1953 youth contract
vs 1958 debut) is NOT overridden — both years sit in bucket 0, so it crosses nothing.
The ticket's "Banks class" names the contradiction class, not a bucket crossing.

**RED triage.**
- **van der Sar (V1d, fix never landed).** Diagnosed at the rule: his Ajax years
  (1990–99) are filed under Q1492 = Barcelona the CITY. `cpIsClubEntity`'s allow-list
  (E1.1) correctly refuses the non-club entity, but SILENTLY — deleting his earliest
  career and promoting the 1999 Juventus transfer to the start. Fixed at the rule: a
  malformed non-club membership (real entity, not club/national/youth/phantom) whose
  start predates the surviving earliest senior start ⇒ `sourceStartYear` nulled, card
  fails the pool (`cpErasedCareerLog`). Catches **De Bruyne** too (a Romanian commune +
  a pharmacy predate his Genk start; his card was right only by luck). Both drop;
  owner-approved. Narrowed to exclude youth/academy entities (else Eriksen's "Ajax Youth
  Academy" and Donovan's "IMG Soccer Academy" would false-positive).
- **Benatia (membership-vs-appearance).** ESPN omits Marseille entirely; the printed
  Marseille chip asserted a first-team spell the appearance record doesn't support.
  CHIP dropped via `ownerDisputedStatements.dropPrintedClub`; membership stays in
  canonical + dossier (marked `disputedAppearance`). Card fills the slot from Udinese.
- **Brehme (representative-team-in-club-slot).** "Germany Olympic football team"
  (typed `national Olympic football team`) printed as a club. Fixed at the rule
  (`cpIsRepresentativeTeam`, TYPE-matched so real clubs — Sydney Olympic FC, BK Olympic —
  survive); dropped from canonical + chips.
- **Falcao — NOT overridden.** verify2's 1999 is bucket-crossing but was a debut at 13,
  excluded by the age-16 rule. Under the realigned model there is no contradiction:
  sourceStartYear is the earliest SENIOR start. Definitional non-defect, flagged.
- **Valderrama.** His impossible spell dates (start>end) are no longer published — dates
  aren't a published club fact — so the defect dissolves; the club memberships are real.

**Rebuild (real-v3).** Selector re-runs rulings-before-selection. Floors held
(40/76/133/181, ≥40), position quota exact (GK43/DEF129/MID129/ATT129, ±0pp), era assert
green. Composition change: **−2 / +2** — van der Sar (GK) and De Bruyne (MID) fail
closed; Dida (GK) and Çalhanoğlu (MID) backfill by fame. The 8 era overrides re-bucketed
their cards within era2/era3 (both far above the floor), so they moved no set membership.
18 era-0 floor swaps (same mechanism as real-v2).

**Owed to owner (E0.5):** De Bruyne — dropped fail-closed, a Busquets-class candidate for
a signed ruling to restore once a clean start year is sourced. Falcao — definitional
ruling (is a debut-at-13 the era anchor, or not?). Agüero — the one override where the
corrected debut (2003) files him one era EARLIER than fame suggests, a property of the +5
peak heuristic, not the override. And the standing owed items from §15 (F2 120-card
review, bucket 0/1 boundary).

## 17. E0.6 — age-16 CLAMP, two restores, real-v4

**The change.** `sourceStartYear` derivation switched from the age-16 DISCARD to an
age-16 CLAMP: `min` over senior first-team starts of `max(membershipStart, birthYear+16)`.
A statement starting before the player's 16th year is now anchored to born+16 instead of
thrown away. The two differ only when a player's EARLIEST senior start is sub-16: the
discard skipped it and surfaced the next membership (often a later transfer), the clamp
floors it to born+16. Since E0.5 this field is not a debut and publishes no date, so the
old debut-accuracy objection to the clamp is moot; what the discard cost was letting an
academy P580 delete the earliest career point and cross an era bucket (Agüero).

**Clamp delta.** 52 of 1314 canonical `sourceStartYear` values shift (all downward — the
clamp reaches an earlier, previously-discarded statement). 45 shift WITHIN a bucket and
change nothing a player sees (e.g. Piqué 2004→2003, ter Stegen 2011→2008, Xabi Alonso
1999→1997 — the three E0.2 named as "regressions", all same-bucket). 7 cross an era
bucket:

| player | qid | old ssy → new | bucket | in set? | net card bucket |
|---|---|---|---|---|---|
| Radamel Falcao | Q138172 | 2005 → 2002 | 3 → 2 | yes | **3 → 2** (definitional ruling) |
| David Luiz | Q193706 | 2006 → 2003 | 3 → 2 | yes | **3 → 2** |
| Mark van Bommel | Q151853 | 1999 → 1993 | 2 → 1 | yes | **2 → 1** |
| Sergio Agüero | Q119562 | 2006 → 2004 | 3 → 2 | yes | 2 → 2 (override→acceptedNoise; unchanged) |
| Sergio Busquets | Q49704 | 2023 → 2004 | 3 → 2 | yes | 3 → 3 (debut ruling 2008 holds it) |
| Kakha Kaladze | Q192031 | 1998 → 1994 | 2 → 1 | no | — (pool only) |
| Javi Martínez | Q201752 | 2006 → 2004 | 3 → 2 | no | — (pool only) |

So among SELECTED cards the clamp re-buckets three (Falcao, David Luiz, van Bommel) and
holds two in place by an override/ruling. These three are late-bloomers whose earliest
senior P54 statement is a sub-16 academy/prodigy entry; the clamp files them one era
earlier by construction. This is the owner's definition (item 4), stated in the dossier's
`sourceStartYearMeaning.clampAndCuriosities` and in DECISIONS.md, not patched per-player.

**Agüero — override retired to acceptedNoise.** His E0.5 override (bucketMove 3→2, cited
2003) was load-bearing only because the discard surfaced 2006. Under the clamp the
Independiente 2003 statement anchors to born+16=2004, same bucket (2) as the cited 2003,
so the correction crosses nothing. Moved to `ownerCitedOverrides.acceptedNoise` with the
citation preserved for audit; card bucket unchanged (2) by construction.

**Busquets — rule output 2023→2004, ruling now load-bearing.** The clamp surfaces his FC
Barcelona P580=2000 as 2004 (was discarded to Inter Miami 2023). His signed debut ruling
(2008) stands; but 2004 (peak 2009) is bucket 2 while the ruled 2008 (peak 2013) is bucket
3, so the ruling — previously a no-op on era — now holds the card in bucket 3. `ruleOutput`
and `eraImpact` amended in ownerDebutRulings.json.

**Two restores (ownerEraRestores.json, signed).** The erased-earliest-career rule
(unchanged) still nulls both:
- **Kevin De Bruyne** (Q357984): a Romanian commune (Q12725066, 1995) and a pharmacy
  business (Q115689400, 2000) predate his Genk start (2008). Restored eraYear **2009**,
  his first-team debut, verified live at en.wikipedia.org/wiki/Kevin_De_Bruyne (quote:
  "De Bruyne made his first team debut for Genk in a 3-0 defeat at Charleroi on 9 May
  2009"). Genk membership start is 2008; both 2008 and 2009 are bucket 3. MID, bucket 3.
- **Edwin van der Sar** (Q482955): his Ajax 1990-1999 membership is filed under Q1492 =
  Barcelona the CITY, predating the surviving Juventus 1999. Restored eraYear **1990**.
  CITATION HONESTY: verify2's RED record carries NO resolvable external citation — its own
  words are "A non-Wikidata confirmation of the Ajax 1990 debut was attempted but blocked
  (Britannica/Ajax/ManUtd/UEFA/ESPN/worldfootball all 403 or 404)". So 1990 is sourced to
  his OWN Wikidata P54 Ajax statement (the one the rule refused for wrong TARGET, not wrong
  START), and a plausible external URL was deliberately NOT fabricated. GK, bucket 1. Ajax
  chip stays absent (unsourceable club QID); chips are Juventus/Fulham/Man Utd.

**Rebuild real-v4.** Rulings-before-selection, restores re-admitted to the pool. Position
quota exact (GK43/DEF129/MID129/ATT129, ±0.0pp, 10/30/30/30). Era 40/77/134/179 (all ≥40;
bucket 0 still exactly at the floor). Composition **−2 / +2** vs real-v3: **De Bruyne (MID)
+ van der Sar (GK) IN; Çalhanoğlu (MID) + Dida (GK) OUT** — the restores re-enter high in
fame order (fameRank 49, 109), pushing the lowest-fame MID/GK off the quota edge, exactly
as E0.5 predicted when it dropped them. 18 era-0 floor swaps (same mechanism as real-v3).
Guards green offline (cp-assert, selector --check, era contract 7 tests), full suite
909/909, fresh-worktree reproduction byte-exact.

**Owed to owner (E0.6).** The clamp files three selected late-bloomers (Falcao, David
Luiz, van Bommel) one era earlier than fame places them — accepted as definitional, but
the owner may want a per-player era override layer if that reads wrong on the card. van der
Sar's 1990 has no external corroboration (blocked); a resolvable citation remains welcome.
Standing items from §15 (F2 120-card review, bucket 0/1 boundary) still open.
