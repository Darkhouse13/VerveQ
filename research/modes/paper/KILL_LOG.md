# Mode candidate KILL LOG

Killed and gate-failed candidates, with the reason and the date. A kill is not
a judgment on the idea's quality — it is a record that the idea was examined
and why it stopped, so it does not get re-proposed from scratch in six months.

**Status: PROVISIONAL. OWNER RATIFICATION REQUIRED.** Entry 1 is pre-ruled by
the owner. Entry 2 is a gate outcome, not a scored kill.

---

## Entry 1 — `full-career-sim` (Destiny Eleven clone)

**Killed:** 34 / 75. **Pre-ruled by owner.** Recorded here, not re-litigated.

**Shape.** A full football career simulator: create a player at sixteen, make
narrative choices season by season through to retirement, freeform, personal,
no shared seed.

**Reasons for the kill (as ruled):**

1. **Build cost.** A career state machine, branch authoring at volume, a season
   simulator, and a progression economy — four subsystems, none of which exist
   in the repo.
2. **Content cost.** Freeform careers need authored narrative branches in bulk,
   and authored branches are the most expensive content type available: they
   cannot be generated, cannot be fetched, and cannot be sourced.
3. **Prior art.** Thick, and hot. The 2026-07-26 sweep found
   **destinyeleven.com** launched 2026-07-20 and past 150,000 players within
   two days, plus **onze-de-reve.fr "Destin"** as a French analog and
   **Footballer — Life Simulator** on iOS. Entering this space now means being
   read as a clone of a six-day-old viral product.

**Salvaged kernel:** `daily-legend` (see `daily-legend.md`, scored 46/75).

What the salvage keeps: the career-shaped decision sequence and the emotional
arc of a life compressed into minutes.

What the salvage throws away — and these are the three things that killed the
parent:

- **freeform → shared daily seed.** Everyone plays the same career skeleton,
  which makes comparison possible and is the thing no competitor does.
- **authored branches → sourced skeletons.** The career comes from Wikidata
  (`P54` spells, `P166`/`P1346` palmares), not from a writer. This converts the
  content bill from authoring to fetching.
- **open-ended progression → a fixed win condition.** Beat the legend's real
  palmares. Bounded, legible, and instantly shareable.

`daily-legend` still scores only 46/75, and its own build cost (1/5) and prior
art (2/5) remain the worst-affected criteria — the salvage improved the parent
but did not escape its gravity. **Recorded as a caution, not a recommendation.**

---

## Entry 2 — `freeze-frame` — GATE-FAIL (G3), 2026-07-26

**Not scored.** Per the ticket's gate rule, a candidate with unsourceable
content is marked GATE-FAIL and receives no score. Full design retained at
`freeze-frame.md` so the gate can be re-run if the block clears.

**Shape.** Anonymised real freeze frames from real matches; choose the next
action; scored against what actually happened.

**Why it failed the gate.** The mode needs per-event positions of all
twenty-two players. The only well-known free source is **StatsBomb Open Data**,
which is a proprietary compilation under a bespoke *Public Data User
Agreement* (`LICENSE.pdf`), not a standard open licence. That PDF's terms
**could not be read in this sweep**, so its position on commercial use is
unverified. `docs/CIE_SOURCING_POLICY.md` §1 is default-deny and the source
belongs to no approved class in §3, while §2 specifically warns about
compilation and database rights over exactly this kind of curated dataset.

All alternatives are licensed commercial products (Opta/Stats Perform,
SkillCorner, Second Spectrum). The one remaining workaround — reconstructing
plausible frames from real matches — would mean **inventing football facts**,
which the ticket prohibits.

**Note this was not a weak candidate.** Its heartbeat (THE REVEAL — your call
superimposed on what actually happened) is stronger than that of `rondo`, the
procedural sibling that survived, because reality is a more authoritative
referee than a model we tuned ourselves. The gate stopped a good idea for a
non-design reason. That is the gate working: this would have stopped the build
in month three instead of on day one.

**To reopen:** read `LICENSE.pdf` in `github.com/statsbomb/open-data`, then run
the §7 source-approval checklist. If commercial use is excluded, the tactical
axis is represented by `rondo` (57/75) and this entry becomes permanent.

---

## Not killed, but flagged for the owner

Recorded here because they are the likeliest future entries, not because they
are dead:

- **`called-it` (36/75)** — scores barely above the pre-ruled kill line of
  entry 1, on the most saturated prior art in the sweep, with high gambling
  adjacency and a permanent operational settlement dependency. If a threshold
  is set anywhere near 40, this is the next entry in this log.
- **`daily-legend` (46/75)** — the salvaged kernel. Carries the highest
  identity risk in the set: a player who knows the legend's real career has a
  direct knowledge advantage, which cuts against the hard identity rule. If it
  is adapted to the sim harness and its `recallShare` comes back high, it dies
  here.
