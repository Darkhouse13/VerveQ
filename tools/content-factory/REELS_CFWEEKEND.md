# CF-WEEKEND — three reels (v2, famous-names recast), post Aug 13/14/15

Ticket: 3 promo reels marketing THE WEEKEND, zero ad-smell — each reel IS
the game; the product is the payoff frame, never the subject; withheld
final answer in all three. **v2 (owner note, 2026-08-13): v1 flopped on
casting — unknown Eredivisie/Liga Portugal names carried the content.
Recast entirely around superstars.** The fix that made it safe: the
receipts are now the LIVE BOARD's own prices (product facts — zero
sourcing risk), plus exactly two verified football facts. The
opening-weekend-FT rule constrains *claims about matches*, and v2 makes
almost none.

| slug | concept (v2) | length | withheld on purpose |
|---|---|---|---|
| `wknd-settleit` | group chat: best player on earth right now — Yamal vs Mbappé, Dave derails with Dembélé's Ballon d'Or | 80.0s | who wins the argument |
| `wknd-referee` | THE BOARD vs YOUR EYES — six of the live market's most argue-able price calls, superstars only | 78.0s | every verdict ("I'm not deciding.") |
| `wknd-squad` | Mbappé+Yamal+Kane+Olise don't all fit in 91.0 — build-along, the math turns, one has to go | 80.0s | which star drops + the final 13 |

Charlie @ 0.4, ink/lime WEEKEND world, no likenesses/crests, no music
baked, one CTA line each (play free, no signup, verveq.com). Timing truth:
`src/weekend/reels/grid.json` (unchanged from v1 — beds and grid frozen;
only content + 17 VO lines moved).

## Fact base (v2)

**Board prices** — prod `fantasyMarket:getMarket` (different-lynx-153),
pulled 2026-08-13, archive `scratchpad/market-prod.json`. The board is the
single authority for its own prices; scale/budget/slots cross-checked
against `fantasyConstants.ts` + BUDGET_MODE_SPEC v1.1.1 (LOCKED).

| price fact on screen | value |
|---|---|
| Yamal (Barcelona) / Olise (Bayern) | 13.0 · 13.0 (the only two at the cap) |
| Kane (Bayern) | 12.5 |
| Mbappé (Real Madrid) | 12.0 |
| Dembélé (PSG) | 11.5 |
| **Bellingham = JUDE (Real Madrid)** | 11.0 — ⚠ two "J. Bellingham" in the pool; Jobe (Dortmund) is 6.5 and is NOT shown; club chips on every card disambiguate |
| Lee Kang-in (Atlético) / Bruno Fernandes (Man Utd) | 10.5 · 10.5 |
| Cherki (Man City) / Nico Paz (Como) | 10.0 · 10.0 |
| Foden (Man City) | 9.5 |
| Fermín (Barcelona) | 11.0 (researched; cut in final row set) |
| Gyökeres (Arsenal) | 5.5 |
| Chiesa (Liverpool) | 5.0 |
| Szczęsny (Barcelona) | 4.0 |

R3 math (recomputed): 91.0 − (13+13+12.5+12 = 50.5) = 40.5 over 9 = 4.5;
drop Kane → 53.0 over 10 = 5.3. A legal 13 exists at the greedy start
(490 players priced 4.5). "Top of the board" phrasing for Yamal because
Olise ties him — never "the most expensive".

**Football facts** (the only two, each two-sourced):

1. **Dembélé won the 2025 Ballon d'Or** — verified in-repo 2026-07-16
   (`src/dave/films.ts` fact-check) + euronews.com 2025-09-23 ("PSG's
   Dembélé beats out Lamine Yamal in Ballon d'Or race") + Yahoo Sports.
   Still the holder until the Sept 2026 gala → "the Ballon d'Or holder"
   is current. Bonus: Yamal was the runner-up, which is why the board
   ranking them 13.0 vs 11.5 is R2's "BALLON D'OR GAP" row.
2. **Yamal is 19** — born 13 July 2007; Ballon d'Or's own account
   ("Turning 19 today", July 2026) + Euronews ("turned 18 in July
   [2025]"). Spoken as "at nineteen" / bubble "he's NINETEEN".

Everything else on screen or in VO is either a board price, arithmetic
over board prices, or clearly-voiced fan opinion in chat bubbles ("the
board is drunk", "he's still the answer") — no stat claims.

**v1's Eredivisie/Liga Portugal research** (fixtures, scorers,
double-source table) is preserved in git history and the 2026-08-12
session agents' reports — usable later for a matchday-shape piece, but no
longer load-bearing here.

## Standing-rule compliance (v2 deltas)

- Famous names only on screen; club chips everywhere (disambiguation +
  recognition). No Eredivisie/LP casting.
- Shapes-not-constants: prices are public board content (the ticket's own
  "91.0" title endorses them); no sim-tunables anywhere.
- Crowd-vote line stays manifesto-verbatim. FPL never named.
- Ledger: still no cp-* spends (names are argument subjects, not puzzle
  answers).
- Captions: comment-ask first, one CTA line, `/weekend` tagged links.

## Reproduce / verify

```
node weekend/reels-vo.mjs --plan
FAL_KEY=… node weekend/reels-vo.mjs        # 17 new takes; 11 v1 lines reused from cache
node weekend.mjs wknd-settleit wknd-referee wknd-squad
node weekend/verify-reels.mjs              # ffmpeg frame + silence + cue gate
```

VO fit: 28/28 within budget (one v2 first-take overran — `si-open` 4.56s
in 4.50s — ", right now" cut; the frame-0 bubble already says it).

## Delivery verification (v2 final renders)

```
== wknd-settleit ==            == wknd-referee ==             == wknd-squad ==
✓ video 1080×1920              ✓ video 1080×1920              ✓ video 1080×1920
✓ fps 30                       ✓ fps 30                       ✓ fps 30
✓ audio stream present (aac)   ✓ audio stream present (aac)   ✓ audio stream present (aac)
✓ duration 80.0s (80.06)       ✓ duration 78.0s (78.06)       ✓ duration 80.0s (80.06)
✓ VO cues on frame: 8/8        ✓ VO cues on frame: 10/10      ✓ VO cues on frame: 10/10
✓ no silent stretch ≥ 6s       ✓ no silent stretch ≥ 6s       ✓ no silent stretch ≥ 6s
✓ frame 0 readable YAVG 34.1   ✓ frame 0 readable YAVG 28.3   ✓ frame 0 readable YAVG 30.3
ALL CHECKS PASSED
```

Deliverables: `out/2026-08-13/wknd-{settleit,referee,squad}.mp4` + caption
`.txt` each; stills in `out/2026-08-13/stills-reels/`. The rejected v1
renders (out/2026-08-12) were deleted so the wrong file can't be posted.

## CF-SAFEZONE (2026-08-13) — vertical repositioning, this batch

Platform chrome eats the top ~200px (username/Reels header) and bottom
~300px (caption/actions) of a 9:16. The batch composed to the frame, not
the visible band. Fixed and made the STANDING DEFAULT:

- `src/promo/kit.tsx`: `SAFE = { top: 220, bottom: 320, x: 60 }` +
  `<SafeArea>` — every future format composes inside it; grandfathered
  MP4s untouched, but any re-render of an old format must adopt it.
- All three reels recomposed into the band, content vertically centered
  (chat header now at safe-top, receipts/footers at safe-bottom, heroes
  centered). R1's chat gained real-chat WINDOWING (last 6 messages stay,
  older scroll away) because the 8-bubble escalate stack no longer fit
  the shorter band; shaking/scaling card stacks got 16–20px insets so
  entrance overshoot can't cross the side strips.
- `verify-reels.mjs` gained the rendered-frame assert: every scene's
  midpoint + the densest frame, cropped to the four chrome strips (8px
  antialias tolerance), strip YMAX must stay < 110. Proven against the
  pre-fix MP4s first (top strip YMAX 255 everywhere → fail), and it then
  caught two real regressions in my own first safe-zone cut (R1 escalate
  bottom overflow; R3 tradeoff hot-card scale poking the side strips).

Final gate: ALL CHECKS PASSED for all three — worst chrome-strip YMAX
39 / 39 / 35 (background stripes only). VO cues 8/8 · 10/10 · 10/10,
durations 80.0 / 78.0 / 80.0s, no dead air, frame 0 readable.

Before/after stills (frame 0 + densest frame per reel):
`out/2026-08-13/safezone-before/` vs `out/2026-08-13/safezone-after/`.

**Owner checklist per reel (~5 min each):** watch WITH SOUND start to
finish (generated voice — standing rule), upload MP4 to TT/IG/YT, paste
the `.txt` caption, links per the LINKS block. No trending sound —
narrated pieces, standing rule.
