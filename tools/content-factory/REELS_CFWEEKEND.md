# CF-WEEKEND — three reels, 2026-08-13/14/15

Ticket: 3 promo reels marketing THE WEEKEND, zero ad-smell — each reel IS
the game; the product is the payoff frame, never the subject. Withheld
final answer in all three. Charlie @ 0.4 stability, standing pace where a
metronome applies (R2 rows at 7.00s). All three end on the same single CTA
line: play free, no signup, verveq.com.

| slug | concept | length | withheld on purpose |
|---|---|---|---|
| `wknd-settleit` | the group-chat argument over real FT receipts | 80.0s | who won the argument (2-2 in the chat, no verdict) |
| `wknd-referee` | Prestianni vs Meulensteen, six tie-breakers, none breaks the tie | 78.0s | the verdict ("I'm not deciding. That's the point.") |
| `wknd-squad` | build-along: 91.0, 13 shirts, greedy start, the math turns | 80.0s | which star gets dropped + the final 13 |

Post order: R1 Aug 13, R2 Aug 14, R3 Aug 15 (all stats are from the Aug
7–10 opening round — FT before any render; nothing rides the GW1 matches
still to be played).

## The opening-weekend rule

Only two covered leagues had played FT football by 2026-08-12: Eredivisie
speelronde 1 and Liga Portugal jornada 1 (Aug 7–10). The top-five leagues
had not kicked off. Every performance stat in these reels comes from those
two rounds; nothing is claimed about matches not yet played.

## Fact-check table (two agreeing sources or cut)

Shorthand: NLW = nl.wikipedia Eredivisie 2026/27 wedstrijden page ·
ESPN(d) = espn.com/soccer/scoreboard/_/league/{ned.1,por.1}/date/2026080d ·
VSP = vsports.pt/vsports/competicao/i-liga/31 (+ match story pages) ·
full URLs in the agents' research reports (session 2026-08-12) and inline
in src/weekend/reels/timeline.ts.

| # | Fact (as used on screen / in VO / caption) | Source A | Source B | Status |
|---|---|---|---|---|
| 1 | Santa Clara 2-2 Nacional; Paciência 19' & 21' | ESPN(10) | VSP | ✅ |
| 2 | Nacional pulled it back to 2-2 by HT (Liziero 36', Baeza 45') | ESPN(10) | VSP | ✅ (Liziero's being a pen is ESPN-only → NOT used) |
| 3 | Cambuur 0-4 Excelsior; Naujoks 31' & 69' | NLW | ESPN(7); EN-wiki "biggest away win" | ✅ |
| 4 | Cambuur promoted this season, at home | NLW | NOS ("gepromoveerd Cambuur") | ✅ |
| 5 | Porto 2-0 Alverca; André Silva 9' pen, Gabri Veiga 44' pen, both after VAR reviews | ESPN + VSP (scores/mins) | O Jogo + Notícias ao Minuto (pens, ref to monitor twice) | ✅ |
| 6 | Prestianni: goal 58' + assist (Pavlidis 10'), Benfica 2-2 Académico de Viseu at home | ESPN match 401885485 | Maisfutebol destaques + VAVEL (+ slbenfica.pt video for the 58') | ✅ |
| 7 | Meulensteen: goal 61' + assist (Tengstedt), Go Ahead 4-1 Willem II at home | NLW + ESPN(8) (goal) | vi.nl + stedendriehoek.nl (assist) | ✅ |
| 8 | Académico de Viseu promoted (first top flight in 37 years — not claimed on screen, only "promoted") | VAVEL | Maisfutebol | ✅ |
| 9 | Willem II promoted | vi.nl ("Eredivisie-rentree") | omroepbrabant.nl | ✅ |
| 10 | Benfica match played behind closed doors at the Luz | VAVEL | A Bola liveblog + DN | ✅ (reason for closure not established → never stated) |
| 11 | Brandt: Ajax debut goal, 90+5', PEC Zwolle 0-2 Ajax | voetbalzone.nl + english.ajax.nl (debut/first goal) | NLW + ESPN(9) (minute) | ✅ |
| 12 | Michut: 90+2' equaliser, PSV 2-2 Fortuna Sittard (champions dropped points at home) | NLW | ESPN(8) + NOS ("titelverdediger… puntenverlies") | ✅ |
| 13 | "Forty messages" (R1 VO) | — | — | scene furniture, not a football fact (the chat itself is fiction; every receipt in it is real) |
| 14 | Prices: Yamal 13.0 · Olise 13.0 · Kane 12.5 · Mbappé 12.0 · Prestianni 7.5 · Meulensteen 5.0 · Naujoks 6.5 · Paciência 6.0 · Brandt 4.0 · Michut 4.5 · André Silva 4.0 | prod `fantasyMarket:getMarket` (different-lynx-153), pulled 2026-08-12, archived at scratchpad `market-prod.json` | product facts, single authority by design — the board IS the source; scale/budget/slots confirmed against `fantasyConstants.ts` + BUDGET_MODE_SPEC v1.1.1 (LOCKED) | ✅ |
| 15 | Board math: 91.0 − 50.5 = 40.5 over 9 = **4.5/shirt**; drop Kane → 53.0 over 10 = **5.3/shirt**; "all four fit if the other nine cost 4.5 each" (490 players priced 4.5, 2134 at 4.0 — a legal 13 exists) | arithmetic over #14 | recomputed twice (script + by hand) | ✅ |
| 16 | "Top of the board" for Yamal (NOT "the most expensive" — Olise is also 13.0) | price histogram: exactly two players at 13.0 | — | ✅ phrasing chosen to stay true |
| 17 | 13 shirts / 91.0 / eight leagues / crowd-vote mechanic | LOCKED specs (BUDGET_MODE_SPEC §Squad/§Budget; LEAGUE_IDS ×8) | live manifesto copy ("the crowd rates the players — not an algorithm", verbatim) | ✅ shapes only, no sim-tunables |

### Facts researched and DELIBERATELY CUT (single-source or disputed)

- Ewerton's 8 saves at the Luz (ESPN-only) — cut from all copy.
- Ioannidis' minute (54' vs 59' dispute) — Sporting collapse not used at all.
- Beni Souza vs "R. Silva OG" attribution dispute — not used.
- Fortuna's "first point at PSV in 26 years", Romeny "debut", GAE "first
  opening-day win since 1986", Meulensteen MOTM, Cambuur keeper's 5 saves,
  Benfica's 49-game unbeaten run — all single-source, all cut.
- ESPN's Vitória-Arouca 0-2 (contradicted by four sources) — fixture unused.
- All shot counts (ESPN internally inconsistent for the Excelsior match) — unused.

## Standing-rule compliance

- **No player likenesses, no crests**: names in brand type only, no imagery.
- **No music baked in**: beds are seeded synthesis accents (pops/ticks/
  slams/risers), narrated pieces take no trending sound (standing rule).
- **Withheld final answer**: R1 no verdict; R2 verdict explicitly refused;
  R3 final 13 + the drop withheld.
- **Shapes not constants** (CT-1): 13 / 91.0 / 8 leagues / prices are the
  product's own public board facts, not sim-tunables; the crowd-vote line is
  manifesto-verbatim.
- **FPL never in rendered video** (A2): generic frames only; captions avoid
  it too (hashtags name no competitor product; #fantasyfootball is a genre).
- **Ledger**: no career-path puzzle is rendered or spoiled by these reels —
  no cp-* ids are spent. Players are named as FT news facts, not quiz
  answers (the chain-long precedent: only *spent puzzle answers* enter
  ledger.json).
- **Captions**: confident-take register, comment-ask first, one CTA line,
  all links tagged `utm_campaign=weekend26`, pointed at `/weekend`
  (WKND-FUNNEL ea66823: bare `/` is a dead end for reel traffic).

## Reproduce / verify

```
node weekend/reels-vo.mjs --plan          # slot budgets (spends nothing)
FAL_KEY=… node weekend/reels-vo.mjs       # voice (cached; 28 lines)
node weekend.mjs wknd-settleit wknd-referee wknd-squad
node weekend/verify-reels.mjs             # ffmpeg frame + silence + cue checks
```

VO fit results (all 28 within budget; three first-takes overran and were
shortened by the batch-2 copy law — cut what the screen already says):
`si-cta` 8.48s→shortened, `sq-open` 5.92s→shortened, `sq-hold` 6.00s→shortened.

## Delivery verification (final renders, 2026-08-12)

```
== wknd-settleit ==            == wknd-referee ==             == wknd-squad ==
✓ video 1080×1920              ✓ video 1080×1920              ✓ video 1080×1920
✓ fps 30                       ✓ fps 30                       ✓ fps 30
✓ audio stream present (aac)   ✓ audio stream present (aac)   ✓ audio stream present (aac)
✓ duration 80.0s (80.06)       ✓ duration 78.0s (78.06)       ✓ duration 80.0s (80.06)
✓ VO cues on frame: 8/8        ✓ VO cues on frame: 10/10      ✓ VO cues on frame: 10/10
✓ no silent stretch ≥ 6s       ✓ no silent stretch ≥ 6s       ✓ no silent stretch ≥ 6s
✓ frame 0 readable YAVG 27.4   ✓ frame 0 readable YAVG 28.8   ✓ frame 0 readable YAVG 26.8
ALL CHECKS PASSED
```

Frame-0 stills + per-scene stills for the eyeball pass:
`out/2026-08-12/stills-reels/`. Two frame-0 defects were caught by this
gate and fixed before delivery (R2/R3 opens rode a Slam whose opacity
starts at 0 — swapped for the stinger's pre-landed punch), plus one
repo-wide latent bug: the pre-epoch `weekend/stinger-audio.mjs` /
`manifesto-audio.mjs` Mixer calls threw under post-epoch audio-lib at
import time, which had silently broken the whole weekend renderer.

**Owner checklist per reel (~5 min each):** watch WITH SOUND start to
finish (generated voice — standing rule), upload MP4 to TT/IG/YT, paste
the `.txt` caption beside it, links per the LINKS block. No trending
sound on any of these — narrated pieces, standing rule.
