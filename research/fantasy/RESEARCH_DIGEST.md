# RESEARCH DIGEST — Instagram Reels, football trivia / quiz / hot takes / sports gaming

Compiled 2026-07-25. Phase 1 deliverable. **No scripts drafted — awaiting approval.**

Data source: Monid → `tikhub` Instagram v2 endpoints (`fetch_user_reels`, `fetch_hashtag_posts`).
196 reels across 12 accounts and 5 hashtag feeds. Raw payloads and the extraction /
analysis scripts are in the session scratchpad.

**Every engagement figure below came out of an API response.** Where a number is
user-reported or a judgement call, it says so in the line. Nothing is estimated.

---

## 0. Read this first — three things that need your call

1. **Our baseline numbers are unverified.** You chose to proceed with the reported
   ~30 likes / 7 comments / 1,750 views rather than have me confirm them via the API
   (the handle `verveq` returned 0 reels). Everything in §1 is creative analysis of the
   *file*; the *numbers* are yours, not the API's. This matters because the whole
   "4.00 comments/1k" comparison in §3 rests on them.
2. **Our winner is 11.05s — the worst duration band in the entire sweep for comments**
   (§3, H3). Either the reported numbers are noise at n=7, or CHAIN is beating the
   curve and is worth more than a longer cut. That's a real fork and I can't settle it
   from this data.
3. **Security — unrelated to this task but you should know now.** The file
   `tools/content-factory/out/2026-07-23/verveq-the-decision.txt` has a live-looking
   Postgres connection string (user, password, host, port) appended below the caption
   text, plus a shell snippet. That file is designed to be pasted into an Instagram
   caption box. I did not use it and did not run anything in it. Recommend rotating
   that credential and stripping the file.

---

## 1. Baseline — `verveq-chain`, 11.05s ("THE CHAIN")

Confirmed by you as yesterday's post. Source: `src/promo/chain/timeline.ts`, `Chain.tsx`.

**Reported performance (USER-REPORTED, not API-verified): 1,750 views / 30 likes / 7 comments.**
Implied rates: **4.00 comments per 1k views**, 17.1 likes per 1k.

### Hook — what is on screen at frame 0

Nothing animates in. The complete premise is legible before the scroll decision:

| element | timing |
|---|---|
| `NAME A PLAYER WHO PLAYED FOR` (mono, 60% opacity) | frame 0 |
| `REAL MADRID` + `MANCHESTER UNITED` plates | frame 0 |
| Slot 1 already filled: `BECKHAM` | frame 0 |
| Slot 5: empty, blinking caret (15f period), 2% breathing pulse | frame 0 → end |

Second name lands at **frame 45 = exactly 1.5s** (`VAN NISTELROOY`), then `HEINZE` at
3.0s, `DI MARÍA` at 4.5s. So the first 1.5s carries: the rule, the two clubs, one
worked example, and a visibly unfinished list. The format's promise ("I'll start —
your turn") is complete before the viewer decides anything.

### Structure

11.05s = 22 beats at 120 BPM. Four names stamp in on the beat (frames 0/45/90/135),
sticker card `we left out the obvious one.` sits over the board, names clear from
frame 300 so the loop reads as a fresh round rather than a glitch.

### On-screen text density — low, and that is the point

Six distinct text elements total across 11s, but only **three legible units at frame 0**
(rule / clubs / first name). Compare the sweep's trivia accounts running 100–170s of
dense multi-question boards. CHAIN is a single-idea frame.

### Why the 7 comments happened — the mechanism

The reel offers **two independent reasons to reply**, and resolves neither:

- **Door A — answer it.** Slot 5 is empty with a live caret. The lowest-effort possible
  reply is one word: a surname. Nothing on screen ever fills it.
- **Door B — correct us.** The most famous qualifying player (Cristiano Ronaldo) is
  omitted *on purpose*, and the sticker card announces the omission without naming him.
  Being the person who points out the obvious gap is cheaper than solving a puzzle and
  carries more status.

The caption fires both: *"Name him — or name one we missed. Comments are the fifth slot 👇"*

**The bait has real fuel** — fact-checked, two sources: Beckham, Van Nistelrooy, Heinze
and Di María all genuinely played for both clubs; Ronaldo genuinely qualifies and is
genuinely the most famous; and roughly **12 players** qualify in total, so "name one we
missed" has live answers left in it (Michael Owen, Casemiro, Raphael Varane, Laurie
Cunningham). Door B cannot be exhausted by one commenter. Sources:
[FBref](https://fbref.com/en/friv/players-who-played-for-multiple-clubs-countries.fcgi?level=franch&t1=154064&t2=159928&t3=--&t4=--),
[United In Focus](https://www.unitedinfocus.com/news/beckham-ronaldo-casemiro-every-player-to-play-for-both-manchester-united-and-real-madrid/).

**Caption pattern:** claim → double bait → product line → 5 hashtags. The product line
("VerveGrid is built out of squares exactly like this one") comes *after* the bait, not
before it.

---

## 2. Competitor / format sweep

12 accounts, `n` = reels returned with a usable view count. Sorted by comment rate —
the metric that matters for "settle it", since replies are the product.

| account | category | n | med views | med likes | med cmts | cmt/1k | med len | max views |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| `careerbased_study` | quiz (multi-sport) | 13 | 2,870 | 59 | 10 | **2.60** | 83s | 64,975 |
| `dailyxi.app` | football quiz APP | 5 | 1,329 | 28 | 2 | **2.26** | 86s | 1,518 |
| `fanfrenzyhub_` | football debate | 13 | 192,689 | 1,411 | 343 | **1.70** | 103s | 2,651,845 |
| `footextrivia` | football trivia | 15 | 203,122 | 1,771 | 76 | **0.53** | 110s | 570,444 |
| `dribbbledrop` | football story / hot take | 13 | 46,615 | 1,018 | 174 | **0.48** | 37s | 1,998,689 |
| `sleeper_football` | sports gaming / media | 15 | 61,347 | 2,875 | 23 | **0.34** | 45s | 861,206 |
| `romsbayfutbol` | football highlights | 6 | 586,504 | 24,196 | 216 | **0.20** | 62s | 2,323,353 |
| `jeremylynchfootball` | football skills | 13 | 127,150 | 3,498 | 13 | **0.07** | 15s | 1,346,219 |
| `the_footballingbrain` | football trivia | 12 | 11,226 | 66 | 0 | **0.04** | 140s | 29,918 |
| `foot_balldebate` | football debate | 13 | 1,013 | 8 | 0 | **0.00** | 114s | 77,435 |
| `footylinksapp` | football quiz APP | 9 | 522 | 7 | 0 | **0.00** | 13s | 1,180 |
| `thatsballknowledge` | football hot takes | 5 | 298 | 8 | 0 | **0.00** | 5s | 2,788 |

⚠️ **The top two rows are an artefact, not a finding.** `careerbased_study` and
`dailyxi.app` post at 1–3k views, where a handful of loyal commenters produces a large
*rate* on a reel almost nobody saw. Comment rate is only comparable above roughly
20k views. Every hypothesis in §3 is computed on the ≥20k subset for that reason.

### The two direct app competitors are both dead

Worth its own line, because these are the closest things to VerveQ in the sweep:

- `footylinksapp` — 9 reels, ~13s each, caption *"Can you find the connection **before the
  answer appears**?"*. Views 154–1,180. **Comments: 0, 0, 0, 0, 0, 0, 0, 0, 0.**
- `dailyxi.app` — 5 reels, 81–103s, *"Try today's puzzle - link in my bio"*. Views
  203–1,518, comments 1–3.

Neither has found distribution, and `footylinksapp` shows the answer on screen.

---

## 3. Ranked format hypotheses

Ranked by strength of evidence, not by how much I like them.

### H1 — Unanswerable beats answerable. **3.4× on comment rate.** ✅ Well supported

Reels whose caption poses a question with **no checkable answer** (allegiance,
preference, prediction) out-comment knowledge questions at comparable reach.

Reels ≥20k views, classified by caption text:

| caption asks for… | n | med views | med cmt/1k |
|---|--:|--:|--:|
| **opinion / allegiance** | 14 | 197,222 | **1.05** |
| no explicit prompt | 33 | 141,881 | 0.48 |
| quiz / knowledge | 40 | 139,930 | **0.31** |

Median reach is within ~30% across all three classes, so this is not a reach effect.

Traced to specific reels:

- `fanfrenzyhub_` — *"Arsenal or Liverpool? 🌎 Which club has fans in more countries?"*
  **201,754 views / 2,458 comments = 12.18/1k.** Highest comment rate in the sweep.
  The question is unfalsifiable, so the comment section is the only place it resolves.
- `fanfrenzyhub_` — *"WHO HAS BEEN THE BEST PLAYER IN THE WORLD OVER THE LAST 12 MONTHS?"*
  28,296 v / 173 c = **6.11/1k**.
- vs `footextrivia` — *"Can you name these footballers?"*, the same caption 15 times:
  median 203,122 views but **0.53/1k**. Enormous reach, four times less argument.
- vs `the_footballingbrain` — quiz format, 12 reels, **median 0 comments**.

**Caveat:** the opinion/quiz split is my classification of caption text, not an API
field. Method is in `classify.py`; the regexes are auditable.

### H2 — Showing the answer kills the comment section. ✅ Supported, one confound

`footylinksapp` states it in its own caption — *"before the answer appears"* — and has
**0 comments across all 9 reels**. Our CHAIN withholds slot 5 permanently and (reported)
took 7 comments at 1,750 views.

`the_footballingbrain` also resolves on screen: 12 reels, median 0 comments, despite
median 11,226 views — an order of magnitude more reach than footylinksapp, same result.

**Confound, stated plainly:** footylinksapp's reach is tiny (median 522 views), so format
and distribution are tangled. `the_footballingbrain` at 11k median partly disentangles
it. What the data supports: **no reel in this sweep that resolves its own puzzle on
screen achieved a meaningful comment rate.** What it does not prove: that withholding
*causes* comments in isolation.

### H3 — Comment rate peaks at 90–120s. Our winner sits in the worst band. ✅ Supported, ⚠️ awkward

All swept reels ≥5k views:

| length | n | med views | med cmt/1k |
|---|--:|--:|--:|
| 0–15s | 9 | 127,150 | **0.07** |
| 15–30s | 15 | 64,680 | 0.26 |
| 30–60s | 17 | 65,450 | 0.48 |
| 60–90s | 32 | 109,906 | 0.57 |
| **90–120s** | 22 | 100,588 | **1.04** |
| 120s+ | 17 | 29,918 | 0.42 |

Monotonic climb to 90–120s, then a fall — past ~2 minutes both reach and comments drop.

**This cuts against our own render library.** CHAIN is 11.05s; LADDER 16.0s; WALL 13.1s;
THE DECISION 24.0s. Our entire catalogue lives in the 0.07–0.26 bands. Yet CHAIN
reportedly returned 4.00/1k — roughly **57× the 0–15s median**.

Two readings, and I can't choose between them with this data:
- **(a)** n=7 comments is too small to be a rate. Entirely possible.
- **(b)** CHAIN's double-door mechanism beats the length effect, and a 90–120s cut of the
  same mechanism would compound rather than replace it.

**Recommend testing (b) directly in Phase 2** — one script at 90–120s — rather than
assuming our short format is the reason we won.

### H4 — Views and comments are bought with different currency. ✅ Supported

Do not optimise one and expect the other.

- `jeremylynchfootball` — **1,346,219 views → 14 comments (0.01/1k)**. Skills content.
  Account median 127,150 views on 0.07/1k.
- `fanfrenzyhub_`'s three biggest reels: 2,651,845 v → 0.72/1k; 1,981,050 v → 1.33/1k;
  1,514,894 v → 0.67/1k. All news/commentary. Their **201,754**-view allegiance question
  did **12.18/1k** — 13× the comment rate at 7% of the reach.
- `romsbayfutbol` — 586,504 median views, 24,196 median likes, **0.20/1k comments**.

Reach comes from spectacle and news. Replies come from unresolved questions. For
"Settle it", the second is the product; the first is vanity.

### H5 — The deliberate-omission ("correct us") door. ❌ NOT SUPPORTED by this data

This is CHAIN's cleverest mechanic and I could not find evidence for it. No API field
marks it, and I found no matched pair in the sweep isolating omission bait from the
opinion effect in H1. The nearest neighbour is `dribbbledrop`'s
*"Barcelona's UNBEATEN Opponent Revealed — Most fans guess Bayern Munich or Manchester
City, but…"* (946,485 v / 2,197 c = **2.32/1k**), which pre-empts the wrong guess rather
than inviting a correction — a different move.

**Do not put a number on this in a script deck.** It is a live hypothesis supported by
one unverified data point (our own reel). Testing it properly needs an A/B on our own
account, not a competitor sweep.

---

## 4. Data gaps and failures — stated, not papered over

- **One endpoint 4xx'd.** `tikhub /api/v1/instagram/v2/fetch_hashtag_posts` with
  `feed_type:"reels"` returned **HTTP 400** ("Request failed. Please retry."; upstream
  confirmed no charge). I re-ran with the documented default params and with a demo
  keyword — both returned 200 with data, so this was a bad parameter *value*, not an
  outage. All hashtag data in this digest uses the default `top` feed. Flagging per
  the fail-closed rule.
- **`verveq` returned 0 reels**, so our own numbers are unverified (your call, §0.1).
- **Shares and saves are only present on 104/196 and 112/196 rows.** I built no
  hypothesis on them. The earlier "1.4–2.5% share rate" figure in
  `src/promo/draw/timeline.ts` is from the 2026-07-23 TikTok sweep and I could **not**
  reproduce or verify it here — treat it as stale until re-pulled.
- **Caption classification (H1) is my judgement**, applied by regex to caption text.
- **Hashtag feeds are noisy** — `#footballquiz` / `#footballtrivia` top feeds returned
  cricket, rugby and music posts. I used them only to *discover accounts*, then pulled
  each account's reels directly. No hashtag-only row feeds the account table.
- **12 reels per account** is the endpoint's page size; I did not paginate. Medians are
  over each account's most recent ~12 reels, so they reflect current form, not all-time.

---

## 5. Monid spend

| item | count | unit | cost |
|---|--:|--:|--:|
| `discover` | 3 | free | $0.000 |
| `inspect` | 4 | free | $0.000 |
| `fetch_user_reels` (v2) | 12 | $0.003 | $0.036 |
| `fetch_hashtag_posts` (v2) | 7 | $0.003 | $0.021 |
| failed 400 (not charged) | 1 | — | $0.000 |
| **total** | **19 paid calls** | | **~$0.057** |

**Balance: $0.93 → $0.88 = $0.05 actually debited.** (Ledger arithmetic gives $0.057;
the $0.005 difference is Monid's rounding. The authoritative figure is the $0.05 balance
delta.)

- Session cap: **$2.00**. Spent: **$0.05**. Remaining under cap: $1.95.
- ⚠️ **The real ceiling is the account balance, not the cap** — the workspace held
  **$0.93** when I started, well under the $2.00 you authorised. Top up before
  commissioning any larger sweep.
- No single call was priced above **$0.00345**; nothing approached the $0.50 stop-gate.

---

## 6. What I'd carry into Phase 2 (for your approval, not yet acted on)

1. **Keep CHAIN's two-door mechanism** — it is the only thing we own that H1 and H2 both
   endorse, and it is already factually bulletproof (12 qualifying players).
2. **Move the question from knowledge to allegiance** on at least one script (H1, 3.4×).
   "Name a player who played for both" is a knowledge question. "Which of these four was
   the *worst* signing" is not, and cannot be resolved on screen.
3. **Test one 90–120s cut** (H3) against our 11–16s house style, rather than assuming
   short is why we won.
4. Judge scripts on **comments per 1k views**, not views (H4).
5. Do **not** claim the omission effect as proven (H5).

**Stopping here for approval.** No scripts drafted.
