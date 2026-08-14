# SLATE — Aug 15–31 (16 reels, 1/day + stories)

The plan every content session executes against. Owner posts; sessions render.
Facts discipline: all prices from live prod pricing surface at render time;
all career paths from football_career_paths.json; nothing from memory.

---

## 1. Portfolio (what earns a slot)

| Lane | Slots | Why |
|---|---|---|
| **ladder-long** (banker) | 9 | Only format proven 1.6–2.5K organic, no decay at n=13+ |
| **the-dilemma** (campaign engine) | 5 | The live-product marketing vehicle; organic read still pending (boost ≠ validation). Comments = someone played a turn of THE WEEKEND in-feed |
| **weekend-cast ladder** (campaign field on the banker) | 2 | B2.5 pattern: quiz carries the pitch, zero format risk |
| Promos | 0 | Retired permanently (DECISIONS) |
| wall-long | 0 | Queued; experiment lane is occupied by DILEMMA until its n=3 verdict |

## 2. Weekly rhythm (anchored to the football weekend)

- **Mon/Wed** — ladder (evergreen, strongest casting themes)
- **Tue/Thu** — dilemma (fresh GW prices; Thu = deadline-eve urgency)
- **Fri** — ladder + **story countdown to first kickoff** (caption: "draft before kickoff")
- **Sat** — weekend-cast ladder or dilemma (live CTA while games run)
- **Sun** — ladder (biggest scroll day)

Stories daily from Fri–Sun: countdown sticker + link sticker to /weekend.
Every reel cross-posts to TikTok same day (no link until 1K followers; it's a warming channel).

## 3. The 16 reels

Casting themes chosen for frame-0 variety (different rung-1 clubs every day)
and share-bait (the Anderlecht→Hamburg→City→Anderlecht loop pulled 18 shares —
one "absurd path" per week minimum). Withheld finals per standing law.
Hooks are specs, not final VO — factory fit-check governs final copy.

| # | Date | Format | Working title / theme | Hook (frame 0 + VO open) | CTA |
|---|---|---|---|---|---|
| 1 | Fri 15 | ladder | **South American kings** (Brazilian/Argentine legends, EU careers) | "Ten career paths. All ended up legends. Keep score." | follow + score ask; story: countdown |
| 2 | Sat 16 | dilemma | **The marquee trade** (GW's most expensive vs 3 starters, live prices) | "91 budget. [X] costs [p]. Or three starters. Pick." | LIVE: "pick for real — verveq.com/weekend" |
| 3 | Sun 17 | ladder | **One-club men… almost** (paths with one surprise club) | "Ten one-club legends. Except one club each. Name them." | score ask |
| 4 | Mon 18 | ladder | **Bosman bargains** (great free-transfer careers) | "Ten paths. Every move was a free transfer." | score ask; caption: GW1 settles tonight |
| 5 | Tue 19 | dilemma | **Keeper premium** (top GK vs outfield value, GW2 prices) | "Best keeper: [p]. Or an extra midfielder. Pick." | LIVE CTA + "GW2 board is open" |
| 6 | Wed 20 | ladder | **The absurd loop** (weekly share-bait: circular/returning path) | "Ten paths. One of them goes home. Twice." | score ask |
| 7 | Thu 21 | dilemma | **Deadline eve** (contested mid-price trade) | "[A] or [B]. Same price. One slot. You have until Friday." | LIVE CTA + deadline |
| 8 | Fri 22 | weekend-cast ladder | **Five leagues, one squad II** (all current, all draftable) | "Ten paths. Five leagues. You could draft every one tonight." | LIVE CTA; story: countdown |
| 9 | Sat 23 | ladder | **Cup final men** (players defined by one final) | "Ten careers. One final each made them." | score ask |
| 10 | Sun 24 | dilemma | **The captain call** (premium mid vs premium fwd, live GW prices) | "One armband. [X] or [Y]. Prices say it's close." | LIVE CTA |
| 11 | Mon 25 | ladder | **Journeymen deluxe** (7-club paths, famous tails) | "Ten paths. Nobody stayed anywhere. You know them all." | score ask |
| 12 | Tue 26 | ladder | **The number nines** (pure strikers across eras) | "Ten nines. Easy to impossible." | score ask |
| 13 | Wed 27 | dilemma | **Budget hero** (cheapest viable starter debate, GW3 prices) | "4.5. Starts every week. Trap or steal?" | LIVE CTA + "GW3 open" |
| 14 | Thu 28 | ladder | **Premier League only** (strongest market: all-PL paths) | "Ten paths. Never left England. Keep score." | score ask; story: countdown |
| 15 | Fri 29 | weekend-cast ladder | **The differentials** (draftable players casuals don't know) | "Ten paths your mates can't name. Draft them anyway." | LIVE CTA; story: countdown |
| 16 | Sat/Sun 30–31 | ladder | **The GOAT tier** (highest-recognition close to the month) | "Ten paths. You know all ten. Prove it." | score ask + follow |

Fixture-date caveat: GW open/close dates in captions (#5, #7, #13) must be
read from the live app at posting time, not from this table.

## 4. Production tickets (three, not sixteen)

1. **LADDER-LONG-B3** — 11 editions from the table (rows 1,3,4,6,9,11,12,14,16 + two weekend-cast 8,15). Table-row + answer-lines work only; carrier reused. Casting per themes above, S-tier rules, ledger discipline, absurd-loop hunt for #6 (Anderlecht precedent). Weekend-cast rows carry the campaign field + live CTA line (already cached or one new line).
2. **DILEMMA-WEEKLY** — standing weekly micro-batch: pull live prices for the open GW from prod, propose 2–3 dilemmas per week (marquee/contested/budget shapes per slate), render the week's 2. Prices verified against prod at render, cited in report. STOP if any price unverifiable.
3. **WKND-ENTRY** — `/weekend?start=budget` (or equivalent) lands paid/ad clicks directly in the budget-squad builder, skipping the hub. Small, frontend-only. Becomes the destination for campaign #2.

## 5. Paid (campaign #2, next weekend when more leagues live)

- Creative: best **organic** performer of the week (proven before boosted) — likely a dilemma with the live CTA.
- Geo: UK, IE, ES, PT, IT, DE, FR only. No Advantage+ expansion. AR/BR excluded (learned).
- Destination: the WKND-ENTRY deep link, not the hub.
- Budget: same $10 test scale until the entry-screen fix shows in the funnel numbers; scale only on cost-per-squad, not cost-per-click.

## 6. Measurement (what next Sunday's read looks at)

- Banker floor: does the ladder hold ≥1.5K through the run? (fatigue watch)
- DILEMMA organic: vs 560–2.5K band AND comments/1000 (co-primary — votes are the point) at n=3 by Aug 24 → keep/kill; wall-long enters if killed
- Weekend funnel weekly: landers → past-entry → squads (PostHog, the Aug 14 read as baseline: 47/9/3 from paid)
- TikTok: follower count only (1K unlocks the link)
- North star for the month: **squads built by strangers**, not views
