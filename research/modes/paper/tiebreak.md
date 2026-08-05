# CANDIDATE — `tiebreak`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**

## Axis

**Allocation** — scarcity under a cap. Simultaneous, adversarial, zero-content.

## Loop (3 sentences)

You and one opponent each receive the same 100 units of effort and the same
five fixtures, and you secretly split your effort across those five. Both
splits lock, then the fixtures resolve left to right: whoever committed more to
a fixture wins it, ties go to neither, and three fixtures wins the tie. The
whole game is deciding where to be strong and — harder — where to be willing to
lose by a mile.

This is the Colonel Blotto game (Borel, 1921) given a football skin. That is a
deliberate choice, not an accident: Blotto is the cleanest known structure in
which a player with zero domain knowledge and good game sense beats a
knowledgeable player with bad game sense, because there is no domain to know.

## Heartbeat G2 — **THE SPLIT REVEAL**

*One named moment: the simultaneous unmasking.*

Both slips lock. Then the five fixtures uncover **one at a time**, left to
right, each showing your number against theirs. The sequencing is the entire
craft of the moment: by fixture three you know whether your sacrifice fixtures
were read, and you watch the last two resolve already knowing whether you won
or lost — or, in the good case, not knowing until the fifth flips.

It qualifies as a heartbeat on the same grounds as BANK/PUSH: an irreversible
commitment made under genuine uncertainty, with the resolution deferred just
long enough to hurt. It differs in kind — DRAW's uncertainty is against the
board, `tiebreak`'s is against a **person**, which is the sharper feeling and
the one the app does not currently have anywhere.

## Content G3 — data needed + source

**Effectively none. This is the candidate's defining property.**

The minimum viable version needs five fixture labels and nothing else, and
those may be **fully synthetic** — the DRAW engine already establishes that
synthetic vocabularies are legitimate in-engine content (`app/src/lib/
drawEngine/DECISIONS.md` decision 9: syllable names, `CLUB_A…`, `ERA_1990s`).

If real club names are wanted for flavour, they come from the existing
`sportsTeams` curated layer already in the repo — no new fetch, no new source
approval, and **no football facts are asserted by the game** (a fixture label
is not a claim about the world). G3 passes trivially and is the strongest G3
position in the set.

## Uncertainty source

**The opponent's mind.** There is no RNG in the resolution at all — the game is
deterministic given both slips. Uncertainty is purely strategic: Blotto has no
pure-strategy equilibrium, so correct play is genuinely mixed and reading a
specific opponent's tendencies over repeated duels is a real, learnable,
non-football skill.

Secondary lever if the equilibrium proves too flat in the harness: give the
five fixtures unequal *weights* (visible to both), which sharpens the
allocation problem without adding content or luck.

## Session shape

**duel** (primary — the design is a duel; it does not meaningfully exist
solo). **daily** (secondary) — a shared-seed weighted board where you play the
same slip against the whole population's aggregate, so a solo player still gets
a daily.

## Scores — PROVISIONAL

Prior-art score status: **SWEPT 2026-07-26.**

| Criterion | Weight | Raw | Weighted | One-line justification |
| --- | --- | --- | --- | --- |
| Adrenaline | ×3 | 4 | 12 | Simultaneous reveal against a human is the sharpest spike available, though each duel is short and the tension does not escalate within a session. |
| Shareable artifact | ×3 | 3 | 9 | The paired allocation bars and a 3–2 scoreline read well, but a duel result is a private two-person artifact rather than a broadcast one. |
| Daily refresh w/o burn | ×2 | 5 | 10 | Pure structure with no content to consume — the well is literally bottomless. |
| Content cost (inv.) | ×2 | 5 | 10 | Zero required content; synthetic labels suffice and the repo already sanctions synthetic vocabularies in-engine. |
| Build cost (inv.) | ×2 | 4 | 8 | An allocation slider UI plus a resolver, riding on async duel plumbing that already exists at `app/convex/duels.ts`. |
| Prior-art headroom | ×2 | 5 | 10 | The sweep found Blotto only as academic literature and as an electoral metaphor — no consumer football implementation surfaced at all. |
| Social fit | ×1 | 5 | 5 | It is a duel by construction; social fit is not a feature bolted on, it is the design. |
| **TOTAL** | | | **64 / 75** | |

## Risk lines

1. **Is it football?** The honest answer is: barely. The skin is thin and a
   sceptical player will notice that nothing about football is being tested.
   That is simultaneously the strongest possible answer to the hard identity
   rule and the biggest threat to fit on a football platform. This tension is
   the single thing the owner should rule on.
2. **Solvability.** Blotto's equilibria are well characterised in the
   literature. A determined player can look up near-optimal mixed strategies.
   Unequal fixture weights and a small number of battlefields blunt this but do
   not remove it.
3. **Thin solo mode.** The daily fallback (play the population aggregate) is
   real but weaker than the duel, and dailies are the platform's spine.
