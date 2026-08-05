# CANDIDATE — `freeze-frame`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**
>
> # ⛔ GATE-FAIL — G3 (content unsourceable under current policy)
>
> **NO SCORE IS GIVEN.** Per the ticket's gate rule, a candidate with
> unsourceable content is marked GATE-FAIL and is not scored. The design is
> recorded in full below so the gate can be re-run if the blocking condition
> is cleared.

## Axis

**Tactical reading** — spatial judgment, no names required.

## Loop (3 sentences)

A real attacking phase from a real match is rendered as an anonymised freeze
frame — every player on the pitch as a dot, positions exactly as they were —
and pauses at the moment the ball arrives. You choose what the player on the
ball should do next from three or four options drawn on the pitch. You are then
shown what actually happened and scored against the outcome, so the referee is
reality rather than a model we authored.

## Heartbeat G2 — **THE REVEAL**

*One named moment: your call against what actually happened.*

Your arrow stays on screen. The real phase then plays forward over it, and for
about a second both are visible at once — your intention and the truth,
superimposed.

**G2 passes.** The moment is named, singular, and genuinely tense: being right
about a professional's decision is a strong, specific pleasure, and being
wrong in a way you can immediately see is a strong, specific sting. This is a
better heartbeat than its procedural sibling `rondo` has, because the answer
carries an authority `rondo` can never claim.

## Content G3 — WHY THIS FAILS

The mode requires per-event freeze-frame data: exact positions of all
twenty-two players at the instant of an on-ball action, plus the action that
followed. There is exactly one well-known free source of this shape.

**Source examined: StatsBomb Open Data** (`github.com/statsbomb/open-data`,
now under the `hudl` org).

**What the sweep established (2026-07-26):**

- The repository README states only: *"If you publish, share or distribute any
  research, analysis or insights based on this data, please state the data
  source as StatsBomb and use our logo, available in our Media Pack."*
- The binding terms are in a **`LICENSE.pdf`** in the repository — a bespoke
  *StatsBomb Public Data User Agreement*, not a standard open licence.
- **I could not read that PDF's contents in this sweep.** Its actual terms on
  commercial use, redistribution, and use inside a public-facing product are
  therefore **unverified**.
- Community framing consistently describes the data as released for *research
  projects and genuine interest in football analytics* — which is language
  about non-commercial use, though it is not itself the licence text.

**Why unverified terms mean GATE-FAIL and not "check later":**

`docs/CIE_SOURCING_POLICY.md` is **default-deny** (§1): *"a source not on the
approved registry is not allowed."* StatsBomb Open Data is not on the registry
and does not belong to any approved class in §3 — it is not an open structured
knowledge base, not an official statistical/IGO dataset, not a
standards/governing-body publication, and not a public-domain reference work.
It is a **proprietary compilation released under a bespoke agreement**, which
is precisely the category §2 singles out as risky: database and compilation
rights can protect a curated compilation even of individually unprotectable
facts.

So the failure is not "we suspect the licence is restrictive." It is that the
policy forbids building on an unapproved source, the terms needed to approve it
could not be read, and **VerveQ is a commercial product** — the one use case
most likely to be excluded. Proceeding on the assumption that it is fine would
be exactly the shortcut the sourcing policy exists to prevent.

**No substitute clears the gate either.** Tracking and event data with
freeze-frame granularity is a licensed commercial product across the industry
(Opta/Stats Perform, SkillCorner, Second Spectrum). None are open. There is no
Wikidata path to player coordinates.

**And the tempting workaround is itself forbidden:** reconstructing plausible
freeze frames "based on" real matches would mean **inventing football facts** —
asserting that twenty-two real people stood in positions we made up. The ticket
prohibits this outright, and correctly.

## What would clear the gate

1. Read `LICENSE.pdf` in `github.com/statsbomb/open-data` in full and extract
   the clauses on commercial use, redistribution, and public products.
2. If those clauses permit commercial use, run the §7 source-approval checklist
   in `docs/CIE_SOURCING_POLICY.md` and add StatsBomb to the registry as a new
   approved class.
3. If they do not — the likelier outcome — price a commercial licence from a
   provider, or accept `rondo` as the tactical-axis representative.

**Until step 1 or 2 completes, this candidate is not scoreable and no adapter
should be written.**

## Uncertainty source (recorded for completeness)

What the professional actually did. Epistemic, fixed, externally verified.

## Session shape (recorded for completeness)

**daily** — five frames, shared seed, ~2 minutes.

## Scores

**NONE — GATE-FAIL (G3).** Per the ticket's gate rule.

For the record, this candidate would likely have scored well on prior-art
headroom and adrenaline, which is exactly why the gate is worth having: a
strong-looking candidate was stopped by the thing that would have stopped it in
month three of a build instead.
