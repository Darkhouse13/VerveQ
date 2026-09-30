# CONCEPT-SWEEP-2 — next test formats (2026-09-30)

Owner brief: always keep test slots filled; find the next winner. Spend: 26 TikHub
`v2/search_reels` ($0.078) + quiz.itup lookup/reels ($0.003) = **$0.081** via Monid.

## Own-account read (IG insights 2026-09-29)
- Who's Older: 5 editions > 2.5K views, best 16,275 (09-28), avg watch 24–30s. The engine.
- Imposter: steady ~2K. THE XI (11 players, one club): 1,608 views, 17 shares — best test.
- Ladder, tier list, pause, Ballon d'Or race, carousels: all < 600. Dead.

## Market evidence
- **quiz.itup (72.7K followers)**: normal reel ~30K views; "guess by MISSING LETTERS"
  reels 2.86M (Marvel), 3.04M (countries), 1.12M (football clubs), 838K (football
  legends) = 30–100× their median. Pure text, faceless, no voice. → **Missing Letters**.
- manutd "Who has scored more PL goals for United?" 3.2M (club account; higher-or-lower duel).
- teamballvs "every La Liga winner since 1929" 16M — data race; our own race flopped (378).

## Tests built (out/concepts/, queued by autofill's 1-in-8 test slot, alternating)
1. **test-clubolder / -e2 — WHICH CLUB IS OLDER?** Who's Older engine on founding
   dates, cards in club colours. Gate: Wikidata P571 (day precision) = enwiki
   infobox `founded`, to the day. 28/49 clubs pass; Man City + Monaco excluded as
   fan-contested. lab/clubolder-facts.mjs, lab/clubolder-render.mjs.
2. **test-letters / -e2 — MISSING LETTERS.** 10 names, easy→impossible, nation clue.
   Gate: name = Wikidata label = enwiki title; nation ∈ Wikidata P1532.
   lab/letters-facts.mjs, lab/letters-render.mjs.

Read each at 72h against Who's Older (reach, avg watch, comments/1k, shares).
