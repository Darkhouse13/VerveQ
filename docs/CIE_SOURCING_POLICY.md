# VerveQ CIE — Sourcing Policy (per discipline)

**Status:** Live policy — written 2026-05-25, status corrected 2026-07-15. The
original "Design — not yet implemented" header is no longer accurate: the CIE's
sourcing backbone shipped and this policy describes it. Companion to
`docs/CONTENT_INGESTION.md`. This is the source-of-truth policy for *where the
Content Ingestion Engine is allowed to pull facts from*, per discipline, and
which subjects it must refuse. The policy text below is unchanged and
uncontradicted by the shipped engine.

**State framing (per working discipline), as of 2026-07-15:**

- Complete in repo: yes, as policy — and it is the policy the shipped batches
  follow. The §3 "preferred backbone" is what every shipped CIE batch records:
  all 24 entries in `app/convex/knowledgeCieScoreBatchRegistry.ts` carry
  `sourceType: "structured_open"`, `sourceName: "Wikidata"`,
  `sourceLicense: "CC0-1.0"`.
- Live in dev backend: yes — the sourcing metadata ships in-bundle with each
  batch module.
- Validated on reachable target: n/a — this is policy, not code.
- Blocked externally: no.

**Not legal advice.** The IP guidance below is an operating policy, not a legal
opinion. License terms must be verified at source-approval time.

---

## 1. Purpose and the three non-negotiables

This policy governs the **Fetch** stage of the CIE (`CONTENT_INGESTION.md` §4).
Every fact the engine uses must satisfy all three:

1. **Accuracy** — the fact is correct and comes from an authoritative source.
2. **Citability** — the fact is machine-resolvably citable, so the cross-family
   verifier (`CONTENT_INGESTION.md` §6) can check the question *against the
   source*, not against a model's confidence. A source that can't be cited and
   re-checked is not an approved source.
3. **IP cleanliness** — we source *facts* and author our *own* expression. We
   never reproduce a source's wording.

**Default-deny:** a source not on the approved registry is not allowed. Adding a
source requires the checklist in §7.

## 2. The IP principle (why we use open/structured sources, not "facts are free")

Facts themselves are generally not protected by copyright — *expression* is. That
is why the engine authors original stems and never lifts source prose.

But "facts are free" is too glib to rely on, because **database/compilation
rights exist** (e.g. the EU sui generis database right can protect a curated
compilation even of unprotectable facts). So the policy is stricter than the bare
copyright rule: we pull from **openly-licensed or public-domain structured
sources** (CC0, open-data licences, public-domain/government works), not from
arbitrary compilations. This keeps us clean on both the expression *and* the
compilation axis.

Brand logos follow the existing repo precedent: Simple Icons SVGs are CC0; brand
names/logos may still be trademarks, used here only for identification in a quiz
context (see `docs/CHALLENGE_ARENA.md`).

## 3. Approved source classes

| Class | Examples / nature | License posture | Role |
|---|---|---|---|
| **Open structured knowledge bases** | Wikidata (CC0) | CC0 — clean | **Preferred backbone** for factual shapes |
| **Official statistical / IGO datasets** | national statistics offices, UN/World-Bank-type open data | open-data licence — verify per source | volatile figures (populations, economics) |
| **Standards / governing bodies** | IUPAC (chemistry), IAU (astronomy), official sport federations | verify per source | domain-authoritative facts and records |
| **Established science reference** | peer-reviewed / textbook-level stable facts | cite, never reproduce text | stable scientific constants/classifications |
| **Public-domain / openly-licensed reference works** | PD encyclopaedias, open educational resources | PD / open licence | corroboration and gap-fill |
| **Simple Icons** | brand SVGs | CC0 (existing precedent) | enterprise-logo shape only |

**Prohibited as sources:** scraped web prose; forums / social media; content
farms and SEO pages; paywalled or all-rights-reserved text; AI-generated "fact"
pages (circular and unverifiable); any source where using the fact would mean
reproducing the source's *expression* or a protected compilation.

## 4. Per-discipline mapping and CIE-suitability

Suitability codes: **GREEN** = structured, authoritative single-source-of-truth
exists, ingest freely. **AMBER** = factual but volatile or interpretive at the
edges — ingest with corroboration (§6) and avoid the soft parts. **RED** = no
single authoritative source / inherently subjective — **not CIE-suitable**, hand-
author or skip.

| Discipline | Approved sources | Shapes fed | Volatility | Suitability |
|---|---|---|---|---|
| **Geography — capitals, borders, physical features** | structured KB, IGO data | MCQ, free-text recall, which-came-first | static | GREEN |
| **Geography — populations, areas, economic figures** | official statistical datasets | numeric-estimation, higher/lower | **volatile** | AMBER (snapshot + corroborate) |
| **History — dated events, chronology** | structured KB, PD reference | which-came-first, MCQ, connected-clue | static | GREEN |
| **History — causation, significance, "why"** | — | — | — | RED (interpretive) |
| **Science — constants, units, classification (phys/chem/astro)** | standards bodies, structured KB, science reference | MCQ, numeric-estimation, odd-one-out, "which is NOT" | static | GREEN |
| **Science — frontier / evolving findings** | peer-reviewed | MCQ | shifting | AMBER (corroborate, avoid contested) |
| **Biology — taxonomy, anatomy, classification** | structured KB, standards | odd-one-out, "which is NOT", MCQ | mostly static | GREEN |
| **Mathematics — definitions, computed results, sequences** | computed/derivable, reference | numeric-estimation, MCQ, ordering | static | GREEN (verify by computation, not just citation) |
| **Language — etymology, first-use dates, usage** | structured KB, PD dictionaries | which-came-first, matching, free-text | static | GREEN/AMBER (usage nuance = AMBER) |
| **Arts/culture — works, creators, creation dates** | structured KB | MCQ, which-came-first | static | GREEN (facts only) |
| **Arts/culture — interpretation, meaning, "greatest"** | — | — | — | RED (subjective) |
| **Sports — records, results, rosters (football/basketball/tennis)** | official federations, structured KB | MCQ, higher/lower, who-am-I, survival index | results static once played; rankings **volatile** | GREEN (records) / AMBER (live rankings) |
| **Enterprise — brand logos** | Simple Icons (CC0) | logo_text | static | GREEN (identification use, opaque serving) |
| **"Fun facts" / general** | structured KB + corroboration | MCQ | mixed | AMBER (high hoax risk — corroborate hard) |
| **Superlatives — "best / greatest / most famous"** | — | — | — | RED unless objectively measurable |

The pattern is consistent: **the objective spine of every subject is ingestible;
the interpretive layer is not.** When a subject is RED, that is a finding, not a
gap to paper over — author by hand or leave it out.

## 5. Volatility and freshness

- **Static** facts (capitals, historical dates, constants, settled records) need
  no refresh.
- **Volatile** facts (populations, economic figures, live rankings, "current X")
  carry `retrievedAt` and `volatility: "volatile"` in provenance
  (`CONTENT_INGESTION.md` §5). The harness blocks stale volatile claims past a
  freshness window and they must be re-verified on a cadence with a named owner.
- Renamed/contested entities (the Astana-rename class) are treated as volatile and
  prefer the most recent authoritative record.

## 6. Minimum corroboration rule

- **GREEN, static:** one approved authoritative structured source is sufficient.
- **AMBER or volatile:** require either a single official statistical source *or*
  agreement across **≥2 independent approved sources** before the candidate may
  pass to the harness. Math is special-cased: verify by **computation**, not only
  citation.
- This is source-level corroboration, *upstream* of and additional to the
  cross-family model verification.

## 7. Adding a new approved source (checklist — fail-closed)

A source may only be used after it is added to the registry. To add one:

1. **Licence verified** — CC0 / open-data / public-domain / government-works, with
   the specific licence recorded. All-rights-reserved or unclear → reject.
2. **Authority established** — recognised authoritative for the discipline.
3. **Machine-resolvable** — facts can be cited with a stable, re-checkable
   reference (so the verifier can check against it).
4. **Volatility classified** — static vs volatile, and refresh owner if volatile.
5. **Expression boundary noted** — confirm we take facts only, never wording or a
   protected compilation.

Until all five are recorded, the source is not approved and the engine must not
draw from it.

## 8. Open questions / risks

- **Per-source licence terms** for statistical/federation datasets vary by country
  and body — the §7 checklist must be done individually, not assumed.
- **Compilation rights** mean "I only took facts" is not automatically safe;
  staying on CC0/open structured sources is the mitigation, not a loophole.
- **RED-classified subjects** (arts interpretation, causation, superlatives) are a
  real coverage limit for a "learn anything" ambition — accept it and route those
  to hand-authoring rather than forcing the engine.
- **Fun-facts hoax risk** is high; treat that bucket as AMBER with aggressive
  corroboration or drop it.
- **Volatile-fact ownership** must be assigned, or the bank silently rots.

---

## Related docs

- `docs/CONTENT_INGESTION.md` — the engine this policy gates (§4 Fetch, §5
  provenance, §6 verification).
- `docs/CHALLENGE_ARENA.md` — Simple Icons CC0 / identification-use precedent.
