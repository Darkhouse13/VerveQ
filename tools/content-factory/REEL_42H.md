# CF-42H — `wknd-42h`, the 30s paid-boost conversion reel (2026-08-13)

One reel, one job: a cold stranger taps verveq.com/weekend within 30
seconds. Conversion register — no withheld answers, no comment traps, one
CTA twice (VO + end card). 32.0s, 1080×1920@30, Charlie @ 0.4, ink/lime
WEEKEND world, no likenesses/crests, no music baked.

## THE ONE COMMAND (re-render before posting)

```
node weekend/render-42h.mjs          # FAL_KEY=… only if the hour changed
```

It (1) re-pulls prod `fantasyMarket:getMarket` and re-verifies EVERY
on-screen fact — 13 squad prices, 6 fixture pairings+times, the
asleep-league claim, the 36-game/4-league counts, the first-kickoff
pairing — any drift THROWS; (2) restamps the live countdown
(`boost-live.json`) and the spoken hours number (a changed hour
invalidates exactly that one cached VO take, so `FAL_KEY` is needed only
then); (3) renders + captions via `weekend.mjs wknd-42h`; (4) runs the
delivery gate incl. the motion gate. **Post within 15 minutes of
rendering** — the on-screen countdown is truthful at render time (±15min
ticket tolerance).

## Spine → grid (grid.json `boost`, 960f)

| scene | frames | on screen | continuous ticker |
|---|---|---|---|
| open | 0–90 | live countdown to Telstar v Sparta, mid-tick ON frame 0 (no fade, no logo) | countdown + second-drain bar |
| fixtures | 90–270 | "THE BIG LEAGUES ARE ASLEEP." / GOOD. + 6 real fixture cards slam @22f | card every 0.73s |
| fill | 270–450 | the product pitch (faithful PitchView recreation) fills 8 real players @21f, SPENT bar drains | a player lands every 0.7s + bar |
| squeeze | 450–630 | YAMAL 13.0 vs 3 dashed slots @4.5 (= 13.5), pulsing PICK., pick slams on "Choose.", 4-player sprint to 91.0/0.0 left | pops → pulse → sprint |
| rules | 630–810 | 13 PLAYERS. / 91.0 BUDGET. / EVERY PLAYER LOCKS AT HIS OWN KICKOFF. stamped over the finished board | 96px countdown + drain bar |
| cta | 810–960 | NO SIGNUP. NO APP. + VERVEQ.COM/WEEKEND + PLAY FREE, countdown still ticking | 104px countdown + drain bar |

The DOPAMINE LAW is enforced twice: designed (every scene carries a
meaningful ticker) and asserted (the motion gate below).

## Fact base — all prod board, pulled + re-verified per render

- **First kickoff**: Telstar v Sparta Rotterdam, Fri 2026-08-14 18:00 UTC,
  Eredivisie — the earliest `kickoffAt` on the board; checked as such.
- **Asleep**: Premier League, Bundesliga, Serie A, Ligue 1 have ZERO
  fixtures this GW (checked by league id, not vibes). Active: Championship
  12 + Eredivisie 9 + Liga Portugal 9 + La Liga 6 = 36 games, 4 leagues.
- **Cards**: Telstar–Sparta FRI · Wolves–Blackburn FRI ·
  Sporting–Guimarães FRI · Sevilla–Rayo SAT · Ajax–Heerenveen SUN ·
  Casa Pia–Benfica MON. Day tags only — no timezone claims on screen.
- **The 13** (sum exactly 91.0; 12 of 13 play this weekend): Sá WOL 4.0 ·
  Perišić PSV 7.5 · Inácio SPO 7.5 · Kiwior POR 7.5 · Itakura AJX 7.0 ·
  Veerman PSV 7.5 · Pote SPO 7.5 · Moutinho BRA 7.0 · **Yamal BAR 13.0** ·
  Pavlidis BEN 7.5 · Vargas SEV 6.5 · Brereton SOU 4.5 (F) ·
  Alonso CEL 4.0 (F). Formation 4-4-2 + 2 finishers, product-legal.
- **Yamal has no fixture this GW** — his 13.0 is a board price and the
  reel never claims he plays; the squeeze is pure board arithmetic
  (55.5 → +13.0 vs 3×4.5 → 68.5 → 91.0), the wknd-squad v2 precedent.
- Pitch recreated from the shipped `PitchView.tsx` (FW-IMMERSE A2): same
  jersey path, mow-stripe greens, converging-touchline markings, cream
  name plate / dark price plate, dashed lime empty slots, SPENT bar. No
  fabricated UI.

## Gates (transcript: `out/2026-08-13/wknd-42h-verify.txt`)

Standard reel gate (container, duration, 8/8 VO cues on frame, no dead
air, safe-zone strips, frame-0 luma) plus the NEW MOTION GATE
(`verify-reels.mjs`, `MOTION_GATED`): the full runtime sampled at 0.75s
intervals, full-res gray; EVERY consecutive pair must differ by ≥0.2% of
pixels at >20 luma. It caught 3 real near-static stretches in the first
cut (rules-scene stamp gaps, CTA tail — clock too small in pixel area);
fixed by making the countdown the dominant element there, not by
softening the threshold. Final: **ALL CHECKS PASSED**, weakest pair 0.24%.

VO fit 8/8 (worst: bo-r3 2.16s in 2.20s). The spoken hours line re-voiced
once mid-session as the real clock crossed 27.5h — the parameterization
working as designed.

**Copy ruling (owner, 2026-08-13):** cold traffic gets PLAIN words — this
reel says "players", never the organic lane's "shirts", and 91 always
carries its unit ("Ninety-one budget", "91.0 BUDGET.", "on a 91.0
budget"). The lane's board-jargon register stays for the warm organic
reels only. (The reworded squeeze take came back 7.04s in 5.80 — pure
take variance — fixed by cutting "flat", never the grid.)

## Deliverables

- `out/2026-08-13/wknd-42h.mp4` + `wknd-42h.txt` (clean caption, one CTA line; boost destination URL
  `?utm_source=ig&utm_medium=boost&utm_campaign=weekend26&utm_content=wknd-42h`)
- Stills: `stills-reels/wknd-42h-f0.png` + every scene boundary
  (`-open/-fixtures/-fill/-squeeze/-rules/-cta.png`) + eyeball extras
  (`-fill-late/-squeeze-landed/-rules-late/-cta-late.png`)
- `out/2026-08-13/wknd-42h-verify.txt` — verification transcript

**Owner checklist:** run the one command (fresh countdown), watch WITH
SOUND, then boost from IG: paste ONLY the text above the ——— line as the
caption, put the tagged URL in the boost flow's destination field, pick
the CTA button, post within 15 minutes of the render.
