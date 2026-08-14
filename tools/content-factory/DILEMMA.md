# DILEMMA-B1 — `the-dilemma`, the experiment lane's second occupant (2026-08-14)

One real draft decision per edition. 20.0s, 1080×1920@30, Charlie @ 0.4,
ink/lime WEEKEND world, no likenesses/crests, no music baked. **It does not
resolve.**

Occupies the experiment lane's single weekly slot after `chain-long` was killed
on the lane law — see [`docs/DECISIONS.md`](../../docs/DECISIONS.md), entry
*"2026-08-14 — chain-long is KILLED"*.

## THE ONE COMMAND (re-render before posting)

```
node weekend/render-dilemma.mjs                 # both editions
node weekend/render-dilemma.mjs wknd-dilemma-2  # one
```

It (1) re-pulls prod `fantasyMarket:getMarket` and re-verifies EVERY on-screen
fact — every price, position, opponent, venue, kickoff, both side totals and the
edition-1 superlative — any drift THROWS; (2) fit-checks/refreshes VO; (3)
renders + captions via `weekend.mjs`; (4) runs the delivery gate incl. the motion
gate.

There is **no countdown baked into the picture**, so unlike `wknd-42h` there is
no 15-minute posting window. But the PRICES are live: if the board is repriced
between render and post, re-run the command.

## The two laws this format is built on

**THE WITHHOLD LAW.** The reel never says which side is right — not in VO, not in
the caption, not on a card. Both sides are drawn by the same component with the
same geometry; the only asymmetry is *which side is being read right now*, and
that alternates. `task` and `count` render both cards neutral. **There is no
winner state in the composition to ship by accident.** The count numeral is
positioned on the gap between the two cards rather than the safe-area centre,
because a centred numeral lands over card A and reads as A being struck out.

**THE NEUTRALITY LAW.** Both sides of an edition cost *exactly* the same, or it
is not a trade. Asserted per render by `weekend/dilemma-live.mjs`.

## Spine → grid (`grid.json` `dilemma1`/`dilemma2`, 600f, identical shape)

| scene | frames | on screen | continuous ticker |
|---|---|---|---|
| task | 0–90 | frame 0 IS the task: question + both option cards + draining clock, already in motion | decide clock + second-drain |
| sideA | 90–216 | card A lit (lime border, deeper shadow), card B to 0.42; A's rows nudge on the 18f cadence | clock + drain + row nudges |
| sideB | 216–342 | the same, mirrored | as above |
| count | 342–450 | 3–2–1 on a 36f step, scrimmed over BOTH cards, neither marked | clock + drain + numeral |
| closer | 450–600 | NO RIGHT ANSWER. / PICK IN THE COMMENTS. / VERVEQ.COM/WEEKEND / OR PICK FOR REAL · FREE, NO SIGNUP | clock + drain + card pops |

Frame 0 carries no countdown card, no logo bumper and no fade — hard cuts
throughout, and the chrome is identical across scenes so a cut is seamless.

## Editions — casting + price source

All prices, positions, fixtures and venues: **prod `fantasyMarket:getMarket` on
`different-lynx-153`, pulled 2026-08-14**, re-verified per render. Never
`career_paths.json`, never memory. Day tags only — no timezone claims on screen.

**Edition 1 · `wknd-dilemma-1` — "9.5 TO SPEND. ONE PLAYER, OR TWO?"**

| side | players | total |
|---|---|---|
| A | Aleix Febas · Celta Vigo · MID · **9.5** · v Osasuna · SUN | 9.5 |
| B | K. Dolberg · Ajax · ATT · **4.5** + S. Berghuis · Ajax · ATT · **5.0** · both v Heerenveen · SUN | 9.5 |

Card A carries the gated claim **MOST EXPENSIVE PLAYER WITH A FIXTURE** — the
highest price among players with a fixture this gameweek, uniquely held. The
argument runs both ways and neither way is stated: one premium in the top slot,
or two shirts and two chances — with both of side B's returns riding on the same
match.

**Edition 2 · `wknd-dilemma-2` — "8.0 EACH. TWO STRIKERS, ONE SLOT."**

| side | player | total |
|---|---|---|
| A | P. Aubameyang · Deportivo La Coruna · ATT · **8.0** · v Elche · MON | 8.0 |
| B | A. Budimir · Osasuna · ATT · **8.0** · at Celta Vigo · SUN | 8.0 |

Same price, same position, opposed on every axis the board actually gives:
home/away, and Sunday against Monday — which is the lock clock, since every
player locks at his own kickoff. The cards state the lock day; the reel does not
say which lock is better.

## Why the Yamal-shaped marquee trade was NOT built

The ticket's edition (a) was "most expensive player vs 3 cheap starters
(Yamal-shaped)". It is not buildable this gameweek, and the reason is a product
rule rather than a taste call:

- **Yamal (13.0), Olise (13.0), Kane (12.5), Mbappé (12.0) have no fixture in
  GW1** — the big leagues are asleep, the same fact `wknd-42h` is built on.
- A budget-mode WEEKEND squad **server-rejects** a fixtureless pick:
  `app/convex/fantasySquads.ts:422` throws `FIXTURE_MISSING_MESSAGE`, and the
  picker hides those players by default
  (`app/src/pages/shell/weekend/BudgetSquadScreen.tsx:454`, `:578`). The spec
  says it outright — *"a player who cannot play this weekend … is a trap that
  burns budget for a guaranteed zero"*
  (`research/fantasy/specs/BUDGET_MODE_SPEC.md:129-145`).

So the marquee trade would have offered a move the product forbids, under a "no
right answer" banner. That is a worse credibility wound than a wrong price.

The shape is also arithmetically impossible with anyone who *can* be picked: the
price floor is 4.0, so "three cheap" costs ≥ 12.0, and the dearest player with a
fixture this gameweek is 9.5. **One-vs-two is the widest honest version of the
trade on this board**, and edition 1 runs it at exactly 9.5 a side.

`weekend/dilemma-live.mjs` now enforces this permanently: a named player with no
fixture fails the render.

## Ledger

**No ledger spend.** No career paths are shown, so no ids are consumed —
`ledger.json` is untouched, the `chain-long` precedent.

## Gates (transcript: `out/2026-08-14/wknd-dilemma-{1,2}-verify.txt`)

Standard reel gate (container, duration, 5/5 VO cues on frame, no dead air,
safe-zone strips, frame-0 luma) **plus the motion gate** — this format opts in,
because its premise is a clock running down and a static stretch would be a lie
about the piece. Final: **ALL CHECKS PASSED** on both, safe zone worst YMAX 39
(limit 110), motion weakest pair 0.32% (floor 0.20%).

Two real defects were caught by the gate and fixed at the source, never by
softening a threshold:

- **Safe zone, YMAX 217 on both side strips.** The lit card scaled 1.02, which
  moved a full-safe-width card's lime border to x=50.4 and x=1029.6 — inside both
  chrome strips. Replaced with a 3px lift; the cards also gained a 14px inset.
- **Motion, 0.19% across three windows.** The second-drain bar refills each
  second, so between samples 0.75s apart it changes by 75% *or* 25% of its track
  depending on phase, and 25% at 20px tall was under the floor. Bar height 20 →
  32; worst case is now ~0.37%.

A third defect the gate cannot see was caught on the stills: side B's second
player was staggered in on the row cadence, so **Berghuis vanished at f216 and
re-landed at f240** after the viewer had already read him at frame 0. Rows are
now never hidden — the read is marked by a nudge.

## VO — 8 takes, 2 of them shared

`dl-hold` and `dl-cta` are a **single cue key used by both editions**: same text,
one cached take, billed once. Per-edition keys are `d{1,2}-{q,a,b}`.

The batch re-priced the estimator. `estimate()` charged only `[.!?—]` and so
under-predicted every comma-heavy line: draft 1 estimated 8/8 inside budget and
came back **7/8 over**, worst +2.08s. Commas are now charged at 0.9s
(`weekend/reels-vo.mjs`), which over-predicts on 6 of the 8 measured takes — the
safe direction for a guard that exists to catch an overrun before the spend.

Final fits (measured / budget): `d1-q` 2.80/2.80 · `d1-a` 3.44/4.00 ·
`d1-b` 3.36/4.00 · `d2-q` 2.32/2.80 · `d2-a` 3.84/4.00 · `d2-b` 3.60/4.00 ·
`dl-hold` 2.80/3.40 · `dl-cta` 3.12/4.80.

## Reading the experiment

Per the lane law, judged at **n=2–3** against the **560–2.5K** ladder band —
**plus comments/1000 as a co-primary**, because this format's job is votes, not
watch time. A 700-view edition at 5/1000 comments is a keep signal. Report both.
